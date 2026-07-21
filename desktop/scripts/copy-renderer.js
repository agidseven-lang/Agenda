// Sem bundler — o renderer já é um único HTML. Este script existe para o npm script
// "build:renderer": (1) confirmar o renderer; (2) copiar os MÓDULOS .js escritos à mão de
// src/main para dist/main (o tsc só compila .ts). F3.4.3: slaRules.js (regras puras de SLA,
// CommonJS) é require()-ado por dist/main/slaScheduler.js em runtime → precisa existir em dist/main.
const fs = require("fs");
const path = require("path");

const DESK = path.resolve(__dirname, "..");
const outMain = path.join(DESK, "dist", "main");
try { fs.mkdirSync(outMain, { recursive: true }); } catch (_) {}

// Módulos .js escritos à mão (não passam pelo tsc) que precisam ir p/ dist/main.
const HANDWRITTEN_JS = ["slaRules.js"];
for (const name of HANDWRITTEN_JS) {
  const src = path.join(DESK, "src", "main", name);
  const dst = path.join(outMain, name);
  try { fs.copyFileSync(src, dst); console.log("copied src/main/" + name + " -> dist/main/" + name); }
  catch (e) { console.error("::error:: falha ao copiar " + name + ": " + (e && e.message || e)); process.exit(1); }
}
console.log("renderer ok (no bundle needed)");
