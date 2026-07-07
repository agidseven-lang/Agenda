#!/usr/bin/env node
/* =====================================================================
 * F3.3.61-U2 — fcm_token_server OFF: cutoff dos fallbacks diretos em /users
 * da familia FCM. Register / remove / reset ficam endpoint-only / fail-closed.
 *
 * Prova (client, index.html):
 *   - fcm_token_server continua DEFAULT ON (!=="off" + catch=>true);
 *   - os 3 fallbacks diretos FCM OFF em /users SUMIRAM:
 *       B teardown:   update({... arrayRemove(fcmTokenSaved) ...})   -> removido
 *       C force-rereg:update({ fcmTokens: [], fcmTokenMeta: {} })    -> removido
 *       D register:   savedDb.runTransaction(...) tx.set(userRef,{fcmTokens..}) -> removido
 *   - nenhuma chamada real runTransaction( no client (register-tx legado foi-se);
 *   - nenhum write direto single-line em /users no client (== 0);
 *   - os fluxos FCM sao endpoint-only: removeFcmTokenClient / resetMyFcmTokensClient /
 *     registerFcmTokenClient sao o unico caminho de escrita de token; fail-closed
 *     (reset lanca em erro de endpoint); os helpers auto-guardam na flag (kill-switch);
 *   - nenhum ramo fcm_token_server OFF contem write direto em /users (nao ha else de
 *     escrita direta) => localStorage "off" NAO reativa write direto;
 *   - BLOCO A: comentario obsoleto do users_write_endpoints corrigido (nao descreve
 *     mais "Default OFF ... ===\"on\""); helper U1 mantem semantica default ON;
 *   - U1 preservado: users_write_endpoints default ON; 11 fallbacks users_write ausentes;
 *   - role hardening preservado (setRole read-only; self-save sem role/admin/status);
 *   - resetMyFcmTokensClient + cutover (const rr2) preservados;
 *   - users_read_hardening default ON preservado;
 *   - RESIDUAL U3 preservado e classificado (NAO regressao U2): push-send legado +
 *     cleanupDeadTokens cross-user (arrayRemove.apply(null, deadTokens)) intactos.
 *
 * Prova (server, functions/index.js — inalterado): endpoints registerFcmToken /
 *   removeMyFcmToken / resetMyFcmTokens existem.
 *
 * Regressao: f3361C passa (server intacto). f3361J e f3361S1 seguem verdes.
 *   f3361U1 (#27/#28/#30) e f3361R1 (#23/#24) tem falhas ESPERADAS por obsolescencia:
 *   ambos afirmavam a PRESENCA dos residuais FCM OFF que U2 remove de proposito. Como o
 *   escopo de arquivos de U2 e so index.html + este teste, eles NAO sao alterados aqui e
 *   devem ser atualizados numa fase U2B de test-refresh (espelha U1 -> U1B).
 *
 * Puro/offline: NAO deploya; NAO toca producao; NAO usa Firestore/FCM real.
 * Rodar: node scripts/worker-ops/f3361U2-fcm-off-fallback-cutoff.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { execSync } from "node:child_process";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const FSRC = fs.readFileSync(path.join(ROOT, "functions", "index.js"), "utf8");
const HSRC = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function count(hay, needle) { let n = 0, i = 0; for (;;) { const j = hay.indexOf(needle, i); if (j < 0) break; n++; i = j + needle.length; } return n; }

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error("FAIL " + n); } };

(async () => {
  // ---------- CLIENT: 3 fallbacks diretos FCM OFF removidos (1-4) ----------
  ok("1 BLOCO B teardown arrayRemove(fcmTokenSaved) removido", !HSRC.includes("arrayRemove(fcmTokenSaved)"));
  ok("2 BLOCO C force-rereg update({ fcmTokens: [], fcmTokenMeta: {} }) removido", !HSRC.includes("update({ fcmTokens: [], fcmTokenMeta: {} })"));
  ok("3 BLOCO D register-tx tx.set(userRef,{fcmTokens..}) removido", !/tx\.set\(userRef, \{ fcmTokens:/.test(HSRC));
  ok("4 nenhuma chamada real runTransaction( no client (register-tx legado removido)", !/runTransaction\(/.test(HSRC));

  // ---------- CLIENT: nenhum write direto single-line /users no client (5) ----------
  const singleLine = (HSRC.match(/collection\("users"\)\.doc\([^)]*\)\.(update|set|delete)\(/g) || []).length;
  ok("5 writes diretos single-line /users no client == 0 (nada da familia users_write/FCM sobra)", singleLine === 0);

  // ---------- CLIENT: unico write /users com fcmTokens e a forma U3 apply (6) ----------
  // Qualquer linha de codigo (nao-comentario) que escreve fcmTokens em /users deve ser
  // exclusivamente o cleanupDeadTokens (U3, cross-user, arrayRemove.apply).
  const fcmWriteLines = HSRC.split("\n").filter((l) => {
    const t = l.trim();
    if (t.startsWith("/*") || t.startsWith("*") || t.startsWith("//")) return false; // ignora comentario
    return /firebase\.firestore\.FieldValue\.arrayRemove/.test(l) || /\.(update|set)\(\{[^}]*fcmToken/.test(l) || /tx\.set\([^)]*fcmToken/.test(l);
  });
  ok("6 unico write /users c/ fcmTokens no client e o residual U3 (arrayRemove.apply)", fcmWriteLines.length === 1 && /arrayRemove\.apply\(null, deadTokens\)/.test(fcmWriteLines[0]));

  // ---------- CLIENT: fluxos FCM endpoint-only / fail-closed (7-11) ----------
  ok("7 teardown endpoint-only: removeFcmTokenClient chamado", HSRC.includes("await removeFcmTokenClient(fcmTokenSaved)"));
  ok("8 force-rereg endpoint-only + fail-closed: resetMyFcmTokensClient + throw", HSRC.includes("const rr2 = await resetMyFcmTokensClient();") && HSRC.includes('if(!rr2 || rr2.ok!==true) throw new Error("reset_fcm_failed");'));
  ok("9 register endpoint-only: registerFcmTokenClient chamado", HSRC.includes("await registerFcmTokenClient(token, devId, platform)"));
  for (const fn of ["registerFcmTokenClient", "removeFcmTokenClient", "resetMyFcmTokensClient"]) {
    ok("10.. helper FCM definido: " + fn, new RegExp("async function " + fn + "\\(").test(HSRC));
  }
  ok("11 helpers FCM auto-guardam na flag (kill-switch): 2x return {disabled}", (HSRC.match(/if\(!fcmTokenServerEnabled\(\)\) return \{ ok:false, error:"disabled" \}/g) || []).length >= 2);

  // ---------- CLIENT: nenhum ramo OFF com write direto (12) ----------
  // Nenhum "} else {" imediatamente seguido de write direto em /users (fallback OFF).
  ok("12 nenhum else-branch reabre write direto em /users (OFF nao reativa)", !/\}\s*else\s*\{\s*(try\{\s*)?(var \w+ = )?(await )?db?\.collection\("users"\)\.doc\([^)]*\)\.(update|set)\(/.test(HSRC));

  // ---------- CLIENT: flags default ON preservadas (13-15) ----------
  ok("13 fcm_token_server default ON preservado", /function fcmTokenServerEnabled\(\)\{ try\{ return lsGet\("fcm_token_server"\)!=="off"; \}catch\(_\)\{ return true; \} \}/.test(HSRC));
  ok("14 users_write_endpoints default ON (U1) preservado", /function usersWriteEndpointsEnabled\(\)\{ try\{ return lsGet\("users_write_endpoints"\)!=="off"; \}catch\(_\)\{ return true; \} \}/.test(HSRC));
  ok("15 users_read_hardening default ON preservado", /function usersReadHardeningEnabled\(\)\{ try\{ return lsGet\("users_read_hardening"\)!=="off"; \}catch\(_\)\{ return true; \} \}/.test(HSRC));

  // ---------- CLIENT: BLOCO A comentario obsoleto corrigido (16-17) ----------
  ok("16 comentario obsoleto 'Default OFF ... ===\"on\"' removido", !HSRC.includes('/* Default OFF (inverso dos flags default-ON): só ON quando lsGet(...)==="on". */'));
  ok("17 novo comentario U1 (default ON / kill-switch) presente acima do helper", HSRC.includes("users_write_endpoints é DEFAULT ON") && HSRC.includes("kill-switch local de diagnóstico"));

  // ---------- CLIENT: U1 preservado (18-19) ----------
  for (const s of ["update({color:hex})", "update({admin:mk})", 'update({status:"ativo"})', "doc(me.id).update(updates)", "update({pass:newHash, salt:newSalt})", "update({pass:np,salt:salt})"]) {
    ok("18.. fallback users_write (U1) segue ausente: " + s, !HSRC.includes(s));
  }
  ok("19 usersWriteEndpointsEnabled sem callers de guard (endpoint-only U1)", count(HSRC, "usersWriteEndpointsEnabled") === 1 && !/if\(usersWriteEndpointsEnabled\(\)\)\{/.test(HSRC));

  // ---------- CLIENT: role hardening preservado (20-21) ----------
  ok("20 role hardening: setRole read-only", HSRC.includes('field("setRole", "Função na agência", me.role, "text", "Definida pelo administrador", true)'));
  ok("21 role hardening: self-save delete role/admin/status", HSRC.includes("delete updates.role; delete updates.admin; delete updates.status;"));

  // ---------- CLIENT: RESIDUAL U3 preservado e classificado (22-24) ----------
  ok("22 residual U3: cleanupDeadTokens (cross-user) definido", /async function cleanupDeadTokens\(userIds, deadTokens\)/.test(HSRC));
  ok("23 residual U3: arrayRemove.apply(null, deadTokens) preservado", HSRC.includes("fcmTokens: firebase.firestore.FieldValue.arrayRemove.apply(null, deadTokens)"));
  ok("24 residual U3: push-send legado (marcadores) preservado", HSRC.includes("[PUSH-SEND]") && /function _sendDbg\(/.test(HSRC));

  // ---------- SERVER: endpoints FCM intactos (25) ----------
  for (const fn of ["registerFcmToken", "removeMyFcmToken", "resetMyFcmTokens"]) {
    ok("25.. endpoint server existe: " + fn, new RegExp("exports\\." + fn + " = onRequest").test(FSRC));
  }

  // ---------- SINTAXE: inline JS valido (26) ----------
  let syn = true;
  try {
    const blocks = [...HSRC.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    const tmp = path.join(ROOT, "scripts", "worker-ops", ".u2_inline.tmp.js");
    fs.writeFileSync(tmp, blocks.join("\n;\n"));
    try { execSync("node --check " + JSON.stringify(tmp), { stdio: "ignore" }); } catch (_) { syn = false; }
    fs.unlinkSync(tmp);
  } catch (_) { syn = false; }
  ok("26 index.html inline JS sintaxe valida", syn);

  // ---------- REGRESSAO + HIGIENE (27-31) ----------
  let regC = true;
  try { execSync("node " + JSON.stringify(path.join(__dirname, "f3361C-users-write-endpoints.test.mjs")), { stdio: "ignore" }); } catch (_) { regC = false; }
  ok("27 f3361C (server users-write) continua passando", regC);

  let st = "__gitfail__";
  try { st = execSync("git -C " + JSON.stringify(ROOT) + " status --porcelain", { encoding: "utf8" }); } catch (_) { st = "__gitfail__"; }
  const changed = st === "__gitfail__" ? [] : st.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  const allowed = new Set(["index.html", "scripts/worker-ops/f3361U2-fcm-off-fallback-cutoff.test.mjs"]);
  const disallowed = changed.filter((f) => !allowed.has(f));
  ok("28 diff restrito a index.html + teste U2", st !== "__gitfail__" && disallowed.length === 0);
  ok("29 sem Rules change", !changed.some((f) => /\.rules$|firestore.*rules/i.test(f)));
  ok("30 sem functions/ change (U2 e client-only)", !changed.some((f) => /^functions\//.test(f)));
  ok("31 sem workflow/Desktop/Android/Worker/Card change", !disallowed.some((f) => /\.github\/workflows|desktop|android|worker|card/i.test(f)));

  console.log("\nF3.3.61-U2: " + pass + " passaram, " + fail + " falharam (de " + (pass + fail) + ").");
  process.exit(fail ? 1 : 0);
})();
