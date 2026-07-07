#!/usr/bin/env node
/* =====================================================================
 * F3.3.61-U3 — read-hardening / push-send cutoff: remove o último residual
 * client-side que ainda podia TOCAR /users (ler tokens de terceiros / escrever
 * cross-user). Envio de push fica ENDPOINT-ONLY server-side (sendPush).
 *
 * Prova (client, index.html):
 *   - cleanupDeadTokens(userIds, deadTokens) REMOVIDO (era o último write cross-user
 *     direto em /users): sem `async function cleanupDeadTokens`, sem callers, sem
 *     arrayRemove.apply(null, deadTokens);
 *   - ZERO write direto em /users no client (nenhum collection("users").doc(...).update/set/delete);
 *   - push-send client legado REMOVIDO de sendPushToUsers: o corpo NÃO lê tokens em /users
 *     (sem db.collection("users").doc(uid).get()), NÃO usa o Worker relay (sem fetch ao Worker)
 *     e NÃO chama cleanupDeadTokens; delega ao endpoint via sendPushServerClient (fail-closed);
 *   - users_read_hardening OFF NÃO reativa o legado (o ramo de leitura de tokens em /users foi-se);
 *   - triggerPush (camada central) continua chamando sendPushToUsers;
 *   - sendPushServerClient preservado (POST + Bearer);
 *   - users_read_hardening default ON preservado;
 *   - U1 preservado (users_write_endpoints default ON; 11 fallbacks users_write ausentes);
 *   - U2 preservado (fcm_token_server default ON; FCM OFF fallbacks ausentes; register/remove/reset
 *     endpoint-only);
 *   - role hardening preservado (setRole read-only; self-save sem role/admin/status);
 *   - inline JS valido (node --check).
 *
 * Prova (server, functions/index.js — inalterado): exports.sendPush + handleSendPush existem
 *   (lookup de tokens + envio FCM + limpeza de dead tokens é server-side).
 *
 * CLASSIFICADO (permanece; NÃO é o push-send legado /users): dois botões de DIAGNÓSTICO manuais
 *   ainda enviam via Worker no client — self-test "Testar push" (tokens do PRÓPRIO device,
 *   me.fcmTokens) e "Diagnosticar TODA a equipe" (tokens do cache em memória do roster). NENHUM
 *   faz leitura fresca cross-user em /users nem write em /users. Ficam fora do escopo de U3
 *   (não é o fluxo de notificação legado); conversão p/ server-side é follow-up opcional.
 *
 * Obsolescência esperada pós-U3 (fora do escopo de arquivos U3 -> U3B test-refresh):
 *   f3361U1 #29 e f3361U2 #6/#22/#23 afirmavam a PRESENCA do residual U3 (cleanupDeadTokens /
 *   arrayRemove.apply) que U3 remove de proposito. Arquivos permitidos em U3 = so index.html +
 *   este teste; aqueles NAO sao tocados aqui.
 *
 * Puro/offline: NAO deploya; NAO toca producao; NAO usa Firestore/FCM real.
 * Rodar: node scripts/worker-ops/f3361U3-read-hardening-push-cutoff.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { execSync } from "node:child_process";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const FSRC = fs.readFileSync(path.join(ROOT, "functions", "index.js"), "utf8");
const HSRC = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* extrai o corpo {..} de uma função async por brace-match */
function fnBody(src, name) {
  const a = src.indexOf("async function " + name + "(");
  if (a < 0) return "";
  let d = 0, started = false;
  for (let j = src.indexOf("{", a); j < src.length; j++) {
    const c = src[j];
    if (c === "{") { d++; started = true; }
    else if (c === "}") { d--; if (started && d === 0) return src.slice(a, j + 1); }
  }
  return "";
}
function count(hay, needle) { let n = 0, i = 0; for (;;) { const j = hay.indexOf(needle, i); if (j < 0) break; n++; i = j + needle.length; } return n; }

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error("FAIL " + n); } };

(async () => {
  const SPU = fnBody(HSRC, "sendPushToUsers");

  // ---------- CLIENT: cleanupDeadTokens + cross-user write removidos (1-4) ----------
  ok("1 cleanupDeadTokens function REMOVIDA (sem def)", !/async function cleanupDeadTokens\(/.test(HSRC));
  ok("2 sem callers de cleanupDeadTokens (removido; so o comentario U3 menciona)", !/cleanupDeadTokens\s*\(\s*\[/.test(HSRC) && count(HSRC, "cleanupDeadTokens") <= 1);
  ok("3 arrayRemove.apply(null, deadTokens) removido (cleanup cross-user)", !HSRC.includes("arrayRemove.apply(null, deadTokens)"));
  const singleLineW = (HSRC.match(/collection\("users"\)\.doc\([^)]*\)\.(update|set|delete)\(/g) || []).length;
  ok("4 ZERO write direto single-line em /users no client", singleLineW === 0);

  // ---------- CLIENT: sendPushToUsers ENDPOINT-ONLY server-side (5-9) ----------
  ok("5 sendPushToUsers existe", SPU.length > 0);
  ok("6 sendPushToUsers delega ao endpoint (sendPushServerClient)", /await sendPushServerClient\(/.test(SPU));
  ok("7 sendPushToUsers NAO le tokens em /users (sem db.collection(\"users\").*.get)", !/collection\("users"\)\.doc\([^)]*\)\.get\(/.test(SPU) && !/db\.collection\("users"\)/.test(SPU));
  ok("8 sendPushToUsers NAO usa Worker relay (sem fetch ao Worker no fluxo)", !/fetch\((PUSH_WORKER_URL|workerUrl)/.test(SPU));
  ok("9 sendPushToUsers NAO chama cleanup client-side de token morto", !/cleanupDeadTokens/.test(SPU) && !/arrayRemove/.test(SPU));

  // ---------- CLIENT: fail-closed + camada central (10-12) ----------
  ok("10 fail-closed: erro do endpoint so loga (_sendFail), sem fallback", /_sendFail\("sendPush server-side"/.test(SPU) && /_sendFail\("sendPush server-side exception"/.test(SPU));
  ok("11 triggerPush (camada central) ainda chama sendPushToUsers", /await sendPushToUsers\(/.test(fnBody(HSRC, "triggerPush")));
  ok("12 sendPushServerClient preservado (POST + Bearer)", /async function sendPushServerClient\(/.test(HSRC) && /method:"POST"[\s\S]*?Authorization":"Bearer "\+s\.token/.test(fnBody(HSRC, "sendPushServerClient")));

  // ---------- CLIENT: users_read_hardening OFF nao reativa read/write legado de push (13-14) ----------
  // O unico ramo !usersReadHardeningEnabled() que lia tokens crus em /users era o do push legado; foi removido.
  ok("13 nenhum ramo le fcmTokens crus de /users p/ envio client (data.fcmTokens sumiu do fluxo de envio)", !HSRC.includes("if(Array.isArray(data.fcmTokens)) freshTokens = data.fcmTokens.filter(Boolean)"));
  ok("14 users_read_hardening default ON preservado", /function usersReadHardeningEnabled\(\)\{ try\{ return lsGet\("users_read_hardening"\)!=="off"; \}catch\(_\)\{ return true; \} \}/.test(HSRC));

  // ---------- SERVER: sendPush server-side preservado (15) ----------
  ok("15 server sendPush existe (exports.sendPush + handleSendPush)", /exports\.sendPush = onRequest/.test(FSRC) && /async function handleSendPush\(/.test(FSRC));

  // ---------- CLIENT: U1 preservado (16-17) ----------
  ok("16 U1 users_write_endpoints default ON", /function usersWriteEndpointsEnabled\(\)\{ try\{ return lsGet\("users_write_endpoints"\)!=="off"; \}catch\(_\)\{ return true; \} \}/.test(HSRC));
  for (const s of ["update({color:hex})", "update({admin:mk})", 'update({status:"ativo"})', "doc(me.id).update(updates)"]) {
    ok("17.. U1 fallback users_write ausente: " + s, !HSRC.includes(s));
  }

  // ---------- CLIENT: U2 preservado (18-21) ----------
  ok("18 U2 fcm_token_server default ON", /function fcmTokenServerEnabled\(\)\{ try\{ return lsGet\("fcm_token_server"\)!=="off"; \}catch\(_\)\{ return true; \} \}/.test(HSRC));
  ok("19 U2 FCM OFF fallbacks ausentes (force-rereg/teardown/register-tx)", !HSRC.includes("update({ fcmTokens: [], fcmTokenMeta: {} })") && !HSRC.includes("arrayRemove(fcmTokenSaved)") && !/runTransaction\(/.test(HSRC));
  for (const fn of ["registerFcmTokenClient", "removeFcmTokenClient", "resetMyFcmTokensClient"]) {
    ok("20.. U2 helper FCM endpoint-only preservado: " + fn, new RegExp("async function " + fn + "\\(").test(HSRC));
  }
  ok("21 U2 force-rereg endpoint-only (const rr2) preservado", HSRC.includes("const rr2 = await resetMyFcmTokensClient();"));

  // ---------- CLIENT: role hardening preservado (22-23) ----------
  ok("22 role hardening: setRole read-only", HSRC.includes('field("setRole", "Função na agência", me.role, "text", "Definida pelo administrador", true)'));
  ok("23 role hardening: self-save delete role/admin/status", HSRC.includes("delete updates.role; delete updates.admin; delete updates.status;"));

  // ---------- CLASSIFICADO: diagnósticos manuais (Worker) permanecem, sem tocar /users (24) ----------
  // Não é o push-send legado: self-test usa me.fcmTokens (próprio device); team-diag usa cache do
  // roster em memória. Nenhum lê /users fresco cross-user nem escreve /users. Fora do escopo U3.
  ok("24 diagnósticos Worker (self-test + team) NAO estao no fluxo de notificacao (sendPushToUsers limpo)", !/fetch\((PUSH_WORKER_URL|workerUrl)/.test(SPU) && !/fetch\((PUSH_WORKER_URL|workerUrl)/.test(fnBody(HSRC, "triggerPush")));

  // ---------- SINTAXE: inline JS valido (25) ----------
  let syn = true;
  try {
    const blocks = [...HSRC.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    const tmp = path.join(ROOT, "scripts", "worker-ops", ".u3_inline.tmp.js");
    fs.writeFileSync(tmp, blocks.join("\n;\n"));
    try { execSync("node --check " + JSON.stringify(tmp), { stdio: "ignore" }); } catch (_) { syn = false; }
    fs.unlinkSync(tmp);
  } catch (_) { syn = false; }
  ok("25 index.html inline JS sintaxe valida", syn);

  // ---------- REGRESSAO + HIGIENE (26-30) ----------
  let regC = true;
  try { execSync("node " + JSON.stringify(path.join(__dirname, "f3361C-users-write-endpoints.test.mjs")), { stdio: "ignore" }); } catch (_) { regC = false; }
  ok("26 f3361C (server users-write) continua passando", regC);

  let st = "__gitfail__";
  try { st = execSync("git -C " + JSON.stringify(ROOT) + " status --porcelain", { encoding: "utf8" }); } catch (_) { st = "__gitfail__"; }
  const changed = st === "__gitfail__" ? [] : st.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  const allowed = new Set(["index.html", "scripts/worker-ops/f3361U3-read-hardening-push-cutoff.test.mjs"]);
  const disallowed = changed.filter((f) => !allowed.has(f));
  ok("27 diff restrito a index.html + teste U3", st !== "__gitfail__" && disallowed.length === 0);
  ok("28 sem Rules change", !changed.some((f) => /\.rules$|firestore.*rules/i.test(f)));
  ok("29 sem functions/ change (U3 e client-only)", !changed.some((f) => /^functions\//.test(f)));
  ok("30 sem workflow/Desktop/Android/Worker/Card change", !disallowed.some((f) => /\.github\/workflows|desktop|android|worker|card/i.test(f)));

  console.log("\nF3.3.61-U3: " + pass + " passaram, " + fail + " falharam (de " + (pass + fail) + ").");
  process.exit(fail ? 1 : 0);
})();
