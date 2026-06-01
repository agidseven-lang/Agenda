#!/usr/bin/env node
// scripts/patch-firestore-password-reset-rules.mjs
//
// Patch idempotente: injeta o bloco match /passwordResetRequests/{reqId} no
// firestore.rules de PRODUCAO (passado como entrada) sem reformatar nada mais
// e sem remover nenhuma linha existente. Trabalha por LINHAS para preservar
// integralmente o arquivo de origem.
//
// Estrategia de insercao:
//   1) Preferencia: inserir IMEDIATAMENTE ANTES da linha que contem "match /{document=**}".
//   2) Fallback: inserir antes da linha que fecha "match /databases/{database}/documents".
//
// Uso: node patch-firestore-password-reset-rules.mjs <input> <output>
// Sai com codigo 0 quando o bloco ja existe (idempotente — escreve input no output).

import fs from 'node:fs';
import process from 'node:process';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('Uso: patch-firestore-password-reset-rules.mjs <input> <output>');
  process.exit(2);
}

function abort(msg) { console.error(`::error:: ${msg}`); process.exit(1); }

const input = fs.readFileSync(inPath, 'utf8');

// ---------- Validacoes do INPUT ----------
if (!/rules_version\s*=\s*'2'/.test(input)) abort("input nao contem rules_version = '2'");
if (!input.includes('service cloud.firestore')) abort('input nao contem "service cloud.firestore"');
if (!input.includes('match /databases/{database}/documents')) abort('input nao contem match /databases/{database}/documents');

// ---------- Idempotencia ----------
if (/match\s+\/passwordResetRequests\b/.test(input)) {
  console.log('Bloco passwordResetRequests JA presente no input — patch idempotente (no-op).');
  fs.writeFileSync(outPath, input, 'utf8');
  process.exit(0);
}

// ---------- Bloco a inserir (sem markdown, sem crases) ----------
const BLOCK_LINES = [
  '',
  '    // -------- INICIO injetado por scripts/patch-firestore-password-reset-rules.mjs --------',
  '    // passwordResetRequests — reset por administrador (app nativo 1.0.37+).',
  '    // App nao usa Firebase Auth (sem request.auth confiavel), entao a',
  '    // regra valida o SCHEMA do documento criado.',
  '    match /passwordResetRequests/{reqId} {',
  '      allow get, list: if false;',
  '      allow update, delete: if false;',
  '',
  '      allow create: if',
  '        request.resource.data.keys().hasOnly([',
  "          'identifier','kind','phoneDigits','createdAt',",
  "          'status','source','handledBy','handledAt'",
  '        ]) &&',
  '        request.resource.data.keys().hasAll([',
  "          'identifier','kind','phoneDigits','createdAt',",
  "          'status','source','handledBy','handledAt'",
  '        ]) &&',
  '        request.resource.data.identifier is string &&',
  '        request.resource.data.identifier.size() >= 3 &&',
  '        request.resource.data.identifier.size() <= 120 &&',
  '        request.resource.data.kind is string &&',
  '        (',
  "          request.resource.data.kind == 'email' ||",
  "          request.resource.data.kind == 'phone'",
  '        ) &&',
  '        request.resource.data.phoneDigits is string &&',
  '        request.resource.data.phoneDigits.size() <= 20 &&',
  '        (',
  "          request.resource.data.kind != 'phone' ||",
  '          request.resource.data.phoneDigits.size() >= 8',
  '        ) &&',
  '        request.resource.data.createdAt is number &&',
  '        request.resource.data.createdAt > 0 &&',
  "        request.resource.data.status == 'pending' &&",
  "        request.resource.data.source == 'nativebeta' &&",
  '        request.resource.data.handledBy == null &&',
  '        request.resource.data.handledAt == null;',
  '    }',
  '    // -------- FIM injetado --------',
];

// ---------- Localizar ponto de insercao por LINHAS ----------
const lines = input.split('\n');
let insertIdx = -1;
let mode = '';

const wildIdx = lines.findIndex((l) => /match\s+\/\{document=\*\*\}\s*\{/.test(l));
if (wildIdx >= 0) {
  insertIdx = wildIdx;
  mode = 'antes de match /{document=**}';
} else {
  // Fallback: linha que abre match /databases/{database}/documents -> contar profundidade
  // de chaves por linha ate a linha que fecha esse bloco; inserir ANTES dessa linha.
  const startIdx = lines.findIndex((l) => /match\s+\/databases\/\{database\}\/documents\s*\{/.test(l));
  if (startIdx < 0) abort('nao foi possivel localizar a linha de match /databases/{database}/documents');

  // Profundidade INICIA contando o '{' da propria linha startIdx.
  let depth = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const opens = (lines[i].match(/\{/g) || []).length;
    const closes = (lines[i].match(/\}/g) || []).length;
    depth += opens - closes;
    if (i > startIdx && depth === 0) {
      // a linha 'i' contem o '}' que fecha o bloco /databases.
      insertIdx = i;
      mode = 'antes da linha que fecha match /databases (fallback)';
      break;
    }
  }
  if (insertIdx < 0) abort('nao foi possivel localizar fechamento do bloco /databases');
}

const out = [...lines.slice(0, insertIdx), ...BLOCK_LINES, ...lines.slice(insertIdx)];
const patched = out.join('\n');

console.log(`Insercao: ${mode} (linha ${insertIdx + 1}).`);

// ---------- Validacoes do OUTPUT ----------
if (!/rules_version\s*=\s*'2'/.test(patched)) abort('output perdeu rules_version');
if (!patched.includes('service cloud.firestore')) abort('output perdeu service cloud.firestore');
if (!patched.includes('match /databases/{database}/documents')) abort('output perdeu match /databases');
const occ = (patched.match(/match\s+\/passwordResetRequests\b/g) || []).length;
if (occ !== 1) abort(`passwordResetRequests aparece ${occ}x (esperado 1)`);
if (patched.includes('`')) abort('output contem crase');
if (/^[ \t]*```/m.test(patched)) abort('output contem cerca markdown');
const opens = (patched.match(/\{/g) || []).length;
const closes = (patched.match(/\}/g) || []).length;
if (opens !== closes) abort(`chaves desbalanceadas: ${opens} { vs ${closes} }`);

// ---------- Garantia: nenhuma linha do input foi removida (so adicoes) ----------
const inLines = lines;
const outLines = out;
let j = 0;
for (let i = 0; i < inLines.length; i++) {
  while (j < outLines.length && outLines[j] !== inLines[i]) j++;
  if (j >= outLines.length) abort(`linha do input perdida no output (idx ${i}): ${JSON.stringify(inLines[i])}`);
  j++;
}

fs.writeFileSync(outPath, patched, 'utf8');
const added = outLines.length - inLines.length;
console.log(`OK: ${outPath} escrito; ${added} linha(s) adicionada(s); 0 linha(s) removida(s).`);
