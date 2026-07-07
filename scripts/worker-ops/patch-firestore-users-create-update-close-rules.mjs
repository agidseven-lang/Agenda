#!/usr/bin/env node
// scripts/worker-ops/patch-firestore-users-create-update-close-rules.mjs
//
// F3.3.61-T1 — Patch idempotente e CIRURGICO: FECHA o client CREATE e UPDATE de /users.
// Recebe o firestore.rules LIVE (baixado da PRODUCAO pelo workflow de deploy em
// tempo de execucao — NAO um arquivo local stale) e troca EXCLUSIVAMENTE, dentro
// do bloco `match /users/{id}`, as DUAS linhas:
//     allow create: if request.resource.data.size() < 60;   ->   allow create: if false;
//     allow update: if request.resource.data.size() < 60;   ->   allow update: if false;
//
// NAO altera read/delete de /users (que DEVEM ja estar `if false` — pre-condicao,
// pois o read-close F3.3.58 e o delete-close ja foram aplicados); NAO altera
// usersPublic; NAO altera NENHUM outro bloco (events/tasks/chats/passwordReset*/
// notif* seguem intactos); NAO reformata nada. Trabalha por LINHAS para preservar
// o arquivo byte-a-byte, exceto as DUAS linhas trocadas.
//
// Estrategia: Opcao A (T-PLAN) — fechar SOMENTE create/update, preservando
// read=false, delete=false, usersPublic read=true/write=false e catch-all deny.
//
// Seguranca / invariantes:
//   - exige EXATAMENTE 1 bloco `match /users/{id}` (0 ou >1 => FALHA);
//   - dentro do bloco, exige EXATAMENTE 1 `allow read`, 1 `allow create`,
//     1 `allow update`, 1 `allow delete`;
//   - PRE-CONDICAO: `allow read` e `allow delete` de /users DEVEM ser `if false`
//     (senao FALHA — nunca fecha create/update sobre um estado inesperado);
//   - create/update: se AMBOS `size() < 60` => patched (troca as 2 p/ `if false`);
//     se AMBOS ja `if false` => IDEMPOTENTE (already_closed, no-op);
//     qualquer outro estado (misto/formato desconhecido) => FALHA;
//   - valida no OUTPUT: exatamente 2 linhas diferentes (create+update de /users)
//     quando patched, 0 se already_closed; read/delete seguem `if false`;
//     usersPublic byte-identico; catch-all e notifPrefs presentes; contagem de
//     `match` preservada; chaves balanceadas;
//   - NUNCA imprime as Rules completas; NUNCA acessa Firestore/rede/Firebase Admin;
//     NUNCA faz deploy nem toca nuvem/CLI.
//
// Uso: node patch-firestore-users-create-update-close-rules.mjs <input.rules> <output.rules> [report.json]
// Exit 0: patched OU already_closed (idempotente). Exit 1: erro/divergencia. Exit 2: uso.

import fs from "node:fs";
import crypto from "node:crypto";
import process from "node:process";

const [, , inPath, outPath, reportPath] = process.argv;
if (!inPath || !outPath) {
  console.error("Uso: patch-firestore-users-create-update-close-rules.mjs <input> <output> [report.json]");
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

// ---------- Helpers: delimitar blocos por profundidade de chaves ----------
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

// ---------- Achar as linhas allow read/create/update/delete dentro do bloco /users ----------
function singleAllowIdx(kind) {
  const re = new RegExp(`^\\s*allow\\s+${kind}\\s*:`);
  const idxs = [];
  for (let i = uStart; i <= uEnd; i++) if (re.test(lines[i])) idxs.push(i);
  if (idxs.length !== 1) abort(`esperado exatamente 1 'allow ${kind}' em /users (encontrado ${idxs.length})`);
  return idxs[0];
}
const rIdx = singleAllowIdx("read");
const cIdx = singleAllowIdx("create");
const uIdx = singleAllowIdx("update");
const dIdx = singleAllowIdx("delete");

// ---------- PRE-CONDICAO: read e delete DEVEM estar `if false` ----------
if (!/allow\s+read\s*:\s*if\s+false\s*;/.test(lines[rIdx])) {
  abort(`pre-condicao violada: /users allow read deve estar 'if false' (read-close F3.3.58); encontrado: '${lines[rIdx].trim()}'`);
}
if (!/allow\s+delete\s*:\s*if\s+false\s*;/.test(lines[dIdx])) {
  abort(`pre-condicao violada: /users allow delete deve estar 'if false'; encontrado: '${lines[dIdx].trim()}'`);
}

// ---------- Classificar create e update ----------
const OPEN60 = (kind, line) => new RegExp(`allow\\s+${kind}\\s*:\\s*if\\s+request\\.resource\\.data\\.size\\(\\)\\s*<\\s*60\\s*;`).test(line);
const CLOSED = (kind, line) => new RegExp(`allow\\s+${kind}\\s*:\\s*if\\s+false\\s*;`).test(line);

const createOpen = OPEN60("create", lines[cIdx]);
const updateOpen = OPEN60("update", lines[uIdx]);
const createClosed = CLOSED("create", lines[cIdx]);
const updateClosed = CLOSED("update", lines[uIdx]);

let status;
if (createOpen && updateOpen) {
  status = "patched";
} else if (createClosed && updateClosed) {
  status = "already_closed"; // idempotente
} else {
  abort(`estado inesperado/misto de /users create/update — create='${lines[cIdx].trim()}' update='${lines[uIdx].trim()}' (esperado ambos 'if request.resource.data.size() < 60;' ou ambos 'if false;')`);
}

// ---------- Aplicar (troca cirurgica de 2 linhas) ----------
const out = lines.slice();
let changed = 0;
if (status === "patched") {
  out[cIdx] = lines[cIdx].replace(/(allow\s+create\s*:\s*if\s+)request\.resource\.data\.size\(\)\s*<\s*60(\s*;)/, "$1false$2");
  out[uIdx] = lines[uIdx].replace(/(allow\s+update\s*:\s*if\s+)request\.resource\.data\.size\(\)\s*<\s*60(\s*;)/, "$1false$2");
  changed = 2;
}
const patched = out.join("\n");

// ---------- Validacoes do OUTPUT ----------
// (a) diff restrito: exatamente 2 linhas diferentes (create+update de /users) quando patched; 0 se already_closed
const diffIdxs = [];
for (let i = 0; i < Math.max(lines.length, out.length); i++) { if (lines[i] !== out[i]) diffIdxs.push(i); }
if (status === "patched") {
  if (diffIdxs.length !== 2 || diffIdxs[0] !== cIdx || diffIdxs[1] !== uIdx) {
    abort(`patch afetou linhas ${diffIdxs.map(i => i + 1).join(",")} (esperado exatamente ${cIdx + 1} e ${uIdx + 1})`);
  }
}
if (status === "already_closed" && diffIdxs.length !== 0) abort("already_closed mas houve diferenca de linhas (inesperado)");

// (b) /users: read/delete seguem if false; create/update agora if false; sem residuo size()<60
{
  const [, e2] = blockBounds(out, uStart);
  const body = out.slice(uStart, e2 + 1).join("\n");
  if (!/allow\s+read\s*:\s*if\s+false\s*;/.test(body)) abort("output: /users read deixou de ser if false");
  if (!/allow\s+delete\s*:\s*if\s+false\s*;/.test(body)) abort("output: /users delete deixou de ser if false");
  if (!/allow\s+create\s*:\s*if\s+false\s*;/.test(body)) abort("output: /users create nao ficou if false");
  if (!/allow\s+update\s*:\s*if\s+false\s*;/.test(body)) abort("output: /users update nao ficou if false");
  if (/allow\s+(create|update)\s*:\s*if\s+request\.resource\.data\.size\(\)\s*<\s*60\s*;/.test(body)) abort("output: /users ainda tem create/update com size()<60");
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
  status, changedLines: changed,
  usersBlockLine: uStart + 1, usersCreateLine: cIdx + 1, usersUpdateLine: uIdx + 1,
  matchCount: matchOut, shaIn, shaOut,
  note: "surgical: fecha SOMENTE /users allow create+update (size()<60 -> false); read/delete=false preservados; usersPublic e demais blocos intactos",
};
if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(`[users-create-update-close] status=${status} changedLines=${changed} matchBlocks=${matchOut} shaIn=${shaIn.slice(0, 16)}… shaOut=${shaOut.slice(0, 16)}…`);
process.exit(0);
