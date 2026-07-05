#!/usr/bin/env node
// scripts/worker-ops/patch-firestore-users-read-close-rules.mjs
//
// F3.3.58-B — Patch idempotente e CIRURGICO: FECHA o client READ de /users.
// Recebe o firestore.rules LIVE (baixado da PRODUCAO pelo workflow de deploy em
// tempo de execucao — NAO um arquivo local stale) e troca EXCLUSIVAMENTE, dentro
// do bloco `match /users/{id}`, a linha:
//     allow read: if true;   ->   allow read: if false;
//
// NAO altera create/update/delete de /users; NAO altera usersPublic; NAO altera
// NENHUM outro `allow read` (events/tasks/chats/usersPublic seguem if true); NAO
// reformata nada. Trabalha por LINHAS para preservar o arquivo byte-a-byte, exceto
// a UNICA linha trocada.
//
// Seguranca / invariantes:
//   - exige EXATAMENTE 1 bloco `match /users/{id}` (0 ou >1 => FALHA);
//   - so mexe na linha `allow read` DENTRO desse bloco (delimitado por profundidade
//     de chaves); exige EXATAMENTE 1 linha `allow read` no bloco;
//   - se o read ja for `if false` => IDEMPOTENTE: reporta already_closed (no-op);
//   - se o read tiver formato inesperado (nem `if true` nem `if false`) => FALHA
//     (nunca auto-corrige formato desconhecido);
//   - valida no OUTPUT: exatamente 1 linha diferente (a read de /users) quando
//     patched; usersPublic byte-identico; create/update/delete de /users intactos;
//     catch-all e notifPrefs presentes; contagem de `match` preservada; chaves
//     balanceadas;
//   - NUNCA imprime as Rules completas; NUNCA toca Firestore/nuvem/CLI/deploy.
//
// Uso: node patch-firestore-users-read-close-rules.mjs <input.rules> <output.rules> [report.json]
// Exit 0: patched OU already_closed (idempotente). Exit 1: erro/divergencia. Exit 2: uso.

import fs from "node:fs";
import crypto from "node:crypto";
import process from "node:process";

const [, , inPath, outPath, reportPath] = process.argv;
if (!inPath || !outPath) {
  console.error("Uso: patch-firestore-users-read-close-rules.mjs <input> <output> [report.json]");
  process.exit(2);
}
function abort(msg) { console.error(`::error:: ${msg}`); process.exit(1); }

const input = fs.readFileSync(inPath, "utf8");

// ---------- Validacoes do INPUT ----------
if (!/rules_version\s*=\s*'2'/.test(input)) abort("input nao contem rules_version = '2'");
if (!input.includes("service cloud.firestore")) abort('input nao contem "service cloud.firestore"');
if (!input.includes("match /databases/{database}/documents")) abort("input nao contem match /databases/{database}/documents");
if (/^[ \t]*```/m.test(input)) abort("input contem cerca markdown (```), provavel copia corrompida");
if (!/match\s+\/\{document=\*\*\}\s*\{/.test(input)) abort("input sem catch-all match /{document=**} — abortando (sem fallback)");

const lines = input.split("\n");

// ---------- Helper: delimitar um bloco por profundidade de chaves ----------
function blockBounds(arr, startIdx) {
  let depth = 0;
  for (let i = startIdx; i < arr.length; i++) {
    depth += (arr[i].match(/\{/g) || []).length - (arr[i].match(/\}/g) || []).length;
    if (i > startIdx && depth === 0) return [startIdx, i];
  }
  return [startIdx, -1];
}
function blockText(arr, headerRe) {
  let s = -1;
  for (let i = 0; i < arr.length; i++) { if (headerRe.test(arr[i])) { s = i; break; } }
  if (s < 0) return null;
  const [, e] = blockBounds(arr, s);
  return e < 0 ? null : arr.slice(s, e + 1).join("\n");
}

// ---------- Localizar EXATAMENTE 1 bloco match /users/{id} (NAO /usersPublic) ----------
const usersHeaderRe = /^\s*match\s+\/users\/\{id\}\s*\{/;
const usersIdxs = [];
for (let i = 0; i < lines.length; i++) if (usersHeaderRe.test(lines[i])) usersIdxs.push(i);
if (usersIdxs.length === 0) abort("bloco match /users/{id} nao encontrado");
if (usersIdxs.length > 1) abort(`match /users/{id} aparece ${usersIdxs.length}x (esperado exatamente 1)`);
const uStart = usersIdxs[0];
const [, uEnd] = blockBounds(lines, uStart);
if (uEnd < 0) abort("bloco /users/{id} sem fechamento de chave");

// ---------- Achar a UNICA linha `allow read` dentro do bloco /users ----------
const readIdxs = [];
for (let i = uStart; i <= uEnd; i++) if (/^\s*allow\s+read\s*:/.test(lines[i])) readIdxs.push(i);
if (readIdxs.length !== 1) abort(`esperado exatamente 1 'allow read' em /users (encontrado ${readIdxs.length})`);
const rIdx = readIdxs[0];
const readLine = lines[rIdx];

let status;
if (/allow\s+read\s*:\s*if\s+false\s*;/.test(readLine)) {
  status = "already_closed"; // idempotente
} else if (/allow\s+read\s*:\s*if\s+true\s*;/.test(readLine)) {
  status = "patched";
} else {
  abort(`/users allow read com formato inesperado: '${readLine.trim()}' (esperado 'if true;' ou 'if false;')`);
}

// ---------- Aplicar (troca cirurgica de 1 linha) ----------
const out = lines.slice();
let changed = 0;
if (status === "patched") {
  out[rIdx] = readLine.replace(/(allow\s+read\s*:\s*if\s+)true(\s*;)/, "$1false$2");
  changed = 1;
}
const patched = out.join("\n");

// ---------- Validacoes do OUTPUT ----------
// (a) diff restrito: exatamente 1 linha diferente (a read de /users) quando patched; 0 se already_closed
let diffCount = 0, diffIdx = -1;
for (let i = 0; i < Math.max(lines.length, out.length); i++) { if (lines[i] !== out[i]) { diffCount++; diffIdx = i; } }
if (status === "patched" && (diffCount !== 1 || diffIdx !== rIdx)) abort(`patch afetou ${diffCount} linha(s) (esperado 1 na linha ${rIdx + 1})`);
if (status === "already_closed" && diffCount !== 0) abort("already_closed mas houve diferenca de linhas (inesperado)");

// (b) /users: read agora if false; create/update/delete preservados
{
  const [, e2] = blockBounds(out, uStart);
  const body = out.slice(uStart, e2 + 1).join("\n");
  if (!/allow\s+read\s*:\s*if\s+false\s*;/.test(body)) abort("output: /users read nao ficou if false");
  if (/allow\s+read\s*:\s*if\s+true\s*;/.test(body)) abort("output: /users ainda tem read if true");
  if (!/allow\s+create\s*:\s*if\s+request\.resource\.data\.size\(\)\s*<\s*60\s*;/.test(body)) abort("output: /users create alterado/ausente");
  if (!/allow\s+update\s*:\s*if\s+request\.resource\.data\.size\(\)\s*<\s*60\s*;/.test(body)) abort("output: /users update alterado/ausente");
  if (!/allow\s+delete\s*:\s*if\s+false\s*;/.test(body)) abort("output: /users delete alterado/ausente");
}

// (c) usersPublic byte-identico input->output e ainda read:true / write fechado
const upRe = /^\s*match\s+\/usersPublic\/\{uid\}\s*\{/;
const upIn = blockText(lines, upRe), upOut = blockText(out, upRe);
if (!upIn || !upOut) abort("usersPublic ausente no input/output");
if (upIn !== upOut) abort("usersPublic foi alterado (deveria ficar byte-identico)");
if (!/allow\s+read\s*:\s*if\s+true\s*;/.test(upOut)) abort("usersPublic read deixou de ser if true");
if (!/allow\s+create\s*,\s*update\s*,\s*delete\s*:\s*if\s+false\s*;/.test(upOut)) abort("usersPublic write deixou de ser fechado");

// (d) estrutura global preservada
if (!/match\s+\/\{document=\*\*\}\s*\{/.test(patched)) abort("output perdeu catch-all");
if (!/match\s+\/notifPrefs\/\{uid\}\s*\{/.test(patched)) abort("output perdeu notifPrefs");
const matchIn = (input.match(/^\s*match\s+\//gm) || []).length;
const matchOut = (patched.match(/^\s*match\s+\//gm) || []).length;
if (matchIn !== matchOut) abort(`contagem de blocos match mudou (${matchIn} -> ${matchOut})`);
const opens = (patched.match(/\{/g) || []).length, closes = (patched.match(/\}/g) || []).length;
if (opens !== closes) abort(`chaves desbalanceadas: ${opens} { vs ${closes} }`);

// ---------- Escrita + relatorio (sem segredos) ----------
fs.writeFileSync(outPath, patched);
const shaIn = crypto.createHash("sha256").update(input).digest("hex");
const shaOut = crypto.createHash("sha256").update(patched).digest("hex");
const report = {
  status, changedLines: changed, usersBlockLine: uStart + 1, usersReadLine: rIdx + 1,
  matchCount: matchOut, shaIn, shaOut,
  note: "surgical: fecha SOMENTE /users allow read (true->false); usersPublic e demais blocos intactos",
};
if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(`[users-read-close] status=${status} changedLines=${changed} matchBlocks=${matchOut} shaIn=${shaIn.slice(0, 16)}… shaOut=${shaOut.slice(0, 16)}…`);
process.exit(0);
