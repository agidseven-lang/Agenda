#!/usr/bin/env node
// scripts/cleanup-dry-run.mjs
// Smoke test LOCAL da logica pura de limpeza de passwordResetCodes.
// NAO conecta no Firestore, NAO apaga nada — valida shouldDeleteResetCode().
// Uso: node scripts/cleanup-dry-run.mjs

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { _shouldDeleteResetCode: shouldDelete } = require("../functions/index.js");

const H = 60 * 60 * 1000;
const RET = 24 * H;
const now = 1_000_000_000_000; // referencia fixa

const cases = [
  { name: "usado ha 25h -> DELETE", doc: { usedAt: now - 25 * H, status: "used" }, expect: true },
  { name: "usado ha 1h -> KEEP", doc: { usedAt: now - 1 * H, status: "used" }, expect: false },
  { name: "expirado ha 25h -> DELETE", doc: { expiresAt: now - 25 * H, status: "pending" }, expect: true },
  { name: "expirado ha 2h -> KEEP", doc: { expiresAt: now - 2 * H, status: "pending" }, expect: false },
  { name: "pendente valido (expira em 10min) -> KEEP", doc: { expiresAt: now + 10 * 60 * 1000, usedAt: null, status: "pending" }, expect: false },
  { name: "recem-criado, sem usedAt -> KEEP", doc: { createdAt: now, expiresAt: now + 15 * 60 * 1000, usedAt: null }, expect: false },
  { name: "usado ha 25h E expirado ha 30h -> DELETE", doc: { usedAt: now - 25 * H, expiresAt: now - 30 * H }, expect: true },
  { name: "doc vazio -> KEEP", doc: {}, expect: false },
  { name: "null -> KEEP", doc: null, expect: false },
  { name: "campos nao-numericos -> KEEP", doc: { usedAt: "ontem", expiresAt: "x" }, expect: false },
];

let pass = 0; let fail = 0;
for (const c of cases) {
  let got;
  try { got = shouldDelete(c.doc, now, RET); } catch (e) { got = `THREW:${e.message}`; }
  const ok = got === c.expect;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${c.name} (got=${got}, expect=${c.expect})`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
