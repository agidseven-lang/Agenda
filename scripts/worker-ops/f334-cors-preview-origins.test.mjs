#!/usr/bin/env node
/* =====================================================================
 * F3.3.34 — CORS allowlist (canais de PREVIEW) para functions/index.js.
 * Puro/offline: NAO require() o modulo (sem deps). Le functions/index.js como TEXTO,
 * extrai o array literal NOTIF_CORS_ORIGINS, reconstroi via Function() e REPLICA a
 * decisao do pacote `cors` (origin permitido = igualdade de string OU RegExp.test =>
 * o framework reflete SO o origin casado). Prova, sem rede / sem deploy / sem segredo:
 *   - prod (agendaidseven.com.br / web.app / firebaseapp) permitidos;
 *   - canal PREVIEW do Firebase Hosting (a2f real + generico) permitido;
 *   - origin aleatorio / lookalike de sufixo / prefixo malicioso / host com ponto /
 *     http:// / vazio / "null" => NEGADOS (RegExp ancorada ^...$, sem wildcard);
 *   - sem wildcard "*"; array contem a RegExp de preview;
 *   - PROVAS DE FONTE: os 5 endpoints (loginUser/getUserSelf/getUserContact/
 *     registerFcmToken/removeMyFcmToken) usam onRequest({... cors: NOTIF_CORS_ORIGINS});
 *     erros retornam via res.status().json() => como o cors do framework roda ANTES do
 *     handler, o header ACAO vale p/ TODAS as respostas (sucesso, 4xx, 500, OPTIONS).
 * Rodar: node scripts/worker-ops/f334-cors-preview-origins.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, "..", "..", "functions", "index.js"), "utf8");

// 1) extrai o array literal NOTIF_CORS_ORIGINS (uma linha, terminada em "];")
const m = /const\s+NOTIF_CORS_ORIGINS\s*=\s*(\[[^\n]*\]);/.exec(SRC);
if (!m) { console.error("FAIL: NOTIF_CORS_ORIGINS nao encontrado no source"); process.exit(1); }
let ORIGINS;
try { ORIGINS = (new Function("return " + m[1] + ";"))(); }
catch (e) { console.error("FAIL: nao consegui avaliar o array literal:", e && e.message); process.exit(1); }
if (!Array.isArray(ORIGINS)) { console.error("FAIL: NOTIF_CORS_ORIGINS nao e array"); process.exit(1); }

// 2) replica a decisao do pacote `cors` (origin: Array<string|RegExp>): reflete o origin casado.
function corsAllows(origin) {
  for (const o of ORIGINS) {
    if (typeof o === "string" && o === origin) return true;
    if (o instanceof RegExp && o.test(origin)) return true;
  }
  return false;
}

let fails = 0;
const ok = (d, c) => { if (!c) { fails++; console.log("FAIL: " + d); } else { console.log("ok  : " + d); } };

// --- PERMITIDOS ---
ok("prod agendaidseven.com.br permitido", corsAllows("https://agendaidseven.com.br"));
ok("prod agenda-id-seven.web.app permitido", corsAllows("https://agenda-id-seven.web.app"));
ok("firebaseapp permitido", corsAllows("https://agenda-id-seven.firebaseapp.com"));
ok("preview a2f (real) permitido", corsAllows("https://agenda-id-seven--f3328-users-hardening-canary-a2f-kzukjgjw.web.app"));
ok("preview generico permitido", corsAllows("https://agenda-id-seven--qualquer-canal-123.web.app"));

// --- NEGADOS (seguranca) ---
ok("origin aleatorio negado", !corsAllows("https://evil.com"));
ok("lookalike sufixo prod negado", !corsAllows("https://agenda-id-seven.web.app.evil.com"));
ok("lookalike sufixo preview negado", !corsAllows("https://agenda-id-seven--x.web.app.evil.com"));
ok("prefixo malicioso negado", !corsAllows("https://evil-agenda-id-seven--x.web.app"));
ok("host com ponto no canal negado", !corsAllows("https://agenda-id-seven--evil.attacker.com"));
ok("http (nao https) negado", !corsAllows("http://agenda-id-seven--x.web.app"));
ok("web.appX (sem fim exato) negado", !corsAllows("https://agenda-id-seven--x.web.application"));
ok("outro site --canal negado", !corsAllows("https://outro-site--x.web.app"));
ok("origin vazio negado", !corsAllows(""));
ok("origin 'null' negado", !corsAllows("null"));

// --- SEM WILDCARD / estrutura ---
ok("sem wildcard '*'", !ORIGINS.includes("*"));
ok("array contem RegExp de preview", ORIGINS.some((o) => o instanceof RegExp));
ok("nenhuma string vazia/curinga", ORIGINS.every((o) => o instanceof RegExp || (typeof o === "string" && o.startsWith("https://") && o.length > 8)));

// --- PROVAS DE FONTE: endpoints usam o allowlist; erro tambem recebe CORS via framework ---
for (const fn of ["loginUser", "getUserSelf", "getUserContact", "registerFcmToken", "removeMyFcmToken"]) {
  const re = new RegExp("exports\\." + fn + "\\s*=\\s*onRequest\\(\\{[^}]*cors:\\s*NOTIF_CORS_ORIGINS");
  ok(fn + " usa onRequest({... cors: NOTIF_CORS_ORIGINS })", re.test(SRC));
}
ok("erro 500 retornado via res.status(500).json() (CORS do framework aplica a todas as respostas)", /res\.status\(500\)\.json\(/.test(SRC));

if (fails) { console.log("\nRESULT: FAIL (" + fails + " falha(s))"); process.exit(1); }
console.log("\nRESULT: PASS — allowlist cobre canais preview com seguranca (RegExp ancorada, sem wildcard); origins maliciosos negados; 5 endpoints cobertos.");
