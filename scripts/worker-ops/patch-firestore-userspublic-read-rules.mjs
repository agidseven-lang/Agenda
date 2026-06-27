#!/usr/bin/env node
// scripts/worker-ops/patch-firestore-userspublic-read-rules.mjs
//
// F3.3.20-B1.7-E — Patch idempotente: injeta o bloco
//   match /usersPublic/{uid} { allow read: if true; allow create, update, delete: if false; }
// no firestore.rules de PRODUCAO (passado como entrada), SEM reformatar nada mais e
// SEM remover nenhuma linha existente. Trabalha por LINHAS para preservar o arquivo.
//
// Regras de seguranca:
//   - so ADICIONA (nunca edita/remove linhas de users/notifPrefs/password-reset/catch-all);
//   - insere IMEDIATAMENTE ANTES da linha "match /{document=**}" (catch-all);
//   - se o catch-all NAO existir => FALHA (sem fallback; nao deployar as cegas);
//   - se "match /usersPublic/{uid}" ja existir COM o conteudo esperado => no-op idempotente;
//   - se existir DIVERGENTE => FALHA (revisao manual; nunca auto-corrige);
//   - se o output tiver != 1 ocorrencia de usersPublic => FALHA (anti-duplicacao);
//   - NUNCA imprime as Rules completas; NUNCA toca Firestore; NUNCA invoca CLI de deploy/nuvem.
//
// Uso: node patch-firestore-userspublic-read-rules.mjs <input.rules> <output.rules> [report.json]
// Exit 0: patched OU alreadyPresent (idempotente). Exit 1: erro/divergencia. Exit 2: uso.

import fs from "node:fs";
import crypto from "node:crypto";
import process from "node:process";

const [, , inPath, outPath, reportPath] = process.argv;
if (!inPath || !outPath) {
  console.error("Uso: patch-firestore-userspublic-read-rules.mjs <input> <output> [report.json]");
  process.exit(2);
}
function abort(msg) { console.error(`::error:: ${msg}`); process.exit(1); }

const input = fs.readFileSync(inPath, "utf8");

// ---------- Validacoes do INPUT ----------
if (!/rules_version\s*=\s*'2'/.test(input)) abort("input nao contem rules_version = '2'");
if (!input.includes("service cloud.firestore")) abort('input nao contem "service cloud.firestore"');
if (!input.includes("match /databases/{database}/documents")) abort("input nao contem match /databases/{database}/documents");
if (/^[ \t]*```/m.test(input)) abort("input contem cerca markdown (```), provavel copia corrompida");

// ---------- Bloco a inserir (allowlist read; write fechado ao cliente) ----------
const BLOCK_LINES = [
  "",
  "    // -------- INICIO injetado: usersPublic read (F3.3.20-B1.7-E) --------",
  "    // Projecao publica PII-free {id,name,role,admin,status,photo,color}, mantida pela",
  "    // trigger syncUsersPublic / backfill (Admin SDK, que bypassa estas rules).",
  "    // Cliente: leitura liberada (sem PII); ESCRITA fechada (so Admin SDK escreve).",
  "    // app sem Firebase Auth => leitura aberta (read: if true), coerente com users/events/tasks.",
  "    match /usersPublic/{uid} {",
  "      allow read: if true;",
  "      allow create, update, delete: if false;",
  "    }",
  "    // -------- FIM injetado: usersPublic read --------",
];
const blockHash = crypto.createHash("sha256").update(BLOCK_LINES.join("\n")).digest("hex").slice(0, 16);

// ---------- Idempotencia / divergencia ----------
const lines = input.split("\n");
const upStart = lines.findIndex((l) => /match\s+\/usersPublic\/\{uid\}\s*\{/.test(l));
let alreadyPresent = false;

if (upStart >= 0) {
  // Extrai o bloco existente (da linha de abertura ate o '}' que o fecha, por profundidade).
  let depth = 0, upEnd = -1;
  for (let i = upStart; i < lines.length; i++) {
    depth += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
    if (i > upStart && depth === 0) { upEnd = i; break; }
    if (i === upStart && depth === 0) { upEnd = i; break; } // bloco em 1 linha (improvavel)
  }
  if (upEnd < 0) abort("match /usersPublic/{uid} sem fechamento de bloco no input");
  const body = lines.slice(upStart, upEnd + 1).join("\n");

  const hasReadTrue = /allow\s+read\s*:\s*if\s+true\s*;/.test(body);
  const hasWriteClosed = /allow\s+create\s*,\s*update\s*,\s*delete\s*:\s*if\s+false\s*;/.test(body);
  const hasAuth = /request\.auth/.test(body);
  const hasOpenWrite = /allow\s+(write|create|update|delete)\s*:\s*if\s+true/.test(body);

  if (hasReadTrue && hasWriteClosed && !hasAuth && !hasOpenWrite) {
    alreadyPresent = true;
    console.log("match /usersPublic/{uid} JA presente com conteudo esperado — patch idempotente (no-op).");
  } else {
    abort("match /usersPublic/{uid} ja existe com conteudo DIVERGENTE — revisao manual exigida (nao auto-corrijo).");
  }
}

// ---------- Insercao (somente se ausente) ----------
let patched = input;
let insertIdx = -1;
let added = 0;

if (!alreadyPresent) {
  insertIdx = lines.findIndex((l) => /match\s+\/\{document=\*\*\}\s*\{/.test(l));
  if (insertIdx < 0) abort("catch-all 'match /{document=**}' nao encontrado — abortando (sem fallback).");

  const out = [...lines.slice(0, insertIdx), ...BLOCK_LINES, ...lines.slice(insertIdx)];
  patched = out.join("\n");
  added = out.length - lines.length;
  console.log(`Insercao: antes de match /{document=**} (linha ${insertIdx + 1}); ${added} linha(s) adicionada(s).`);

  // ---------- Validacoes do OUTPUT ----------
  if (!/rules_version\s*=\s*'2'/.test(patched)) abort("output perdeu rules_version");
  if (!patched.includes("service cloud.firestore")) abort("output perdeu service cloud.firestore");
  if (!patched.includes("match /databases/{database}/documents")) abort("output perdeu match /databases");
  if (/^[ \t]*```/m.test(patched)) abort("output contem cerca markdown (```)");
  // preserva users / notifPrefs / catch-all (linhas-chave intactas)
  if (!/match\s+\/users\/\{id\}\s*\{/.test(patched)) abort("output perdeu match /users/{id}");
  if (!/allow\s+read\s*:\s*if\s+true\s*;/.test(patched)) abort("output perdeu 'users read: if true'");
  if (!/match\s+\/notifPrefs\/\{uid\}\s*\{/.test(patched)) abort("output perdeu match /notifPrefs/{uid}");
  if (!/match\s+\/\{document=\*\*\}\s*\{/.test(patched)) abort("output perdeu catch-all");
  // chaves balanceadas
  const opens = (patched.match(/\{/g) || []).length;
  const closes = (patched.match(/\}/g) || []).length;
  if (opens !== closes) abort(`chaves desbalanceadas: ${opens} { vs ${closes} }`);
  // additive-only: nenhuma linha do input removida
  const outLines = out;
  let j = 0;
  for (let i = 0; i < lines.length; i++) {
    while (j < outLines.length && outLines[j] !== lines[i]) j++;
    if (j >= outLines.length) abort(`linha do input perdida no output (idx ${i})`);
    j++;
  }
}

// ---------- anti-duplicacao (vale p/ ambos os caminhos) ----------
const occ = (patched.match(/match\s+\/usersPublic\/\{uid\}\s*\{/g) || []).length;
if (occ !== 1) abort(`match /usersPublic/{uid} aparece ${occ}x (esperado 1)`);

// ---------- Escrita do output (unico ponto de escrita) ----------
fs.writeFileSync(outPath, patched, "utf8");

// ---------- Relatorio seguro (sem Rules completas) ----------
if (reportPath) {
  const report = {
    patched: !alreadyPresent,
    alreadyPresent,
    inserted: alreadyPresent ? 0 : added,
    anchorFound: alreadyPresent ? true : insertIdx >= 0,
    duplicateCount: occ,
    changed: !alreadyPresent,
    inputBytes: Buffer.byteLength(input, "utf8"),
    outputBytes: Buffer.byteLength(patched, "utf8"),
    blockHash,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Relatorio: ${reportPath} (patched=${report.patched}, alreadyPresent=${report.alreadyPresent}, dup=${report.duplicateCount}).`);
}

console.log(`OK: ${outPath} escrito; usersPublic match=${occ}; read aberto, write fechado.`);
