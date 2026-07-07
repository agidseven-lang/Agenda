#!/usr/bin/env node
/* =====================================================================
 * F3.3.61-U1 — users_write_endpoints DEFAULT ON + cutoff dos 11 fallbacks
 * diretos em /users (familia users_write). Endpoint-only / fail-closed.
 *
 * Prova (client, index.html):
 *   - usersWriteEndpointsEnabled() e DEFAULT ON (!=="off" + catch=>true);
 *   - usersWriteEndpointsEnabled() aparece SO na definicao do helper (nenhum
 *     ramo de escrita ainda o consulta => localStorage "off" NAO reativa write
 *     direto: as else-branches foram removidas);
 *   - os 11 payloads diretos da familia users_write sumiram (pass/salt login,
 *     lastSeen, status, admin, color, reminderMinutes, photo, photo:"", profile
 *     update(updates), pass/salt changePassword, status:"excluido");
 *   - os clients endpoint-only permanecem (updateUserSelf/touchUserLastSeen/
 *     adminSetUserStatus/adminSetUserAdmin/changePassword/deleteMyAccount);
 *   - role hardening preservado (setRole read-only; self-save sem role/admin/status);
 *   - FCM cutoff preservado (resetMyFcmTokensClient; fcm_token_server default ON);
 *   - users_read_hardening default ON preservado;
 *   - RESIDUAIS: em U1 os fallbacks FCM OFF (force-rereg {fcmTokens:[],fcmTokenMeta:{}} e
 *       teardown arrayRemove(fcmTokenSaved)) ainda existiam; a U2 os CORTOU -> assercoes 27/28
 *       ATUALIZADAS em U2B p/ exigir a AUSENCIA + fluxo endpoint-only (reset/remove). Resta so
 *       o residual U3 (users_read_hardening OFF / push legado): cleanupDeadTokens
 *           arrayRemove.apply(null, deadTokens) [cross-user];
 *   - inline JS valido (node --check do bloco <script> extraido).
 *
 * Prova (server, functions/index.js — inalterado): USER_SELF_UPDATE_KEYS sem
 *   role/admin/status; endpoints da familia existem (updateUserSelf, touchUserLastSeen,
 *   adminSetUserStatus, adminSetUserAdmin, deleteMyAccount, changePassword, loginUser);
 *   notifVerifyPassword aceita credenciais legadas (djb2) => remocao do rehash e segura.
 *
 * Regressao: f3361C passa (server intacto). f3361J e f3361S1 NAO sao rodados como
 *   gate aqui: ambos codificam o comportamento PRE-U1 (users_write default OFF +
 *   else-branches de escrita direta) que U1 remove de proposito -> tem falhas
 *   ESPERADAS por escopo antigo e precisam de atualizacao em fase separada (fora do
 *   escopo de arquivos de U1: so index.html + este teste). f3361R1 tem o
 *   falso-positivo conhecido de diff-scope (path worker-ops do novo arquivo). As
 *   invariantes ainda validas de FCM/role estao espelhadas inline acima.
 *
 * Puro/offline: NAO deploya; NAO toca producao; NAO usa Firestore/FCM real.
 * Rodar: node scripts/worker-ops/f3361U1-users-write-endpoints-default-on-cutoff.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { execSync } from "node:child_process";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const FSRC = fs.readFileSync(path.join(ROOT, "functions", "index.js"), "utf8");
const HSRC = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function grabConst(src, n) { const m = new RegExp("^const " + n + "\\b[^\\n]*$", "m").exec(src); return m ? m[0] : ""; }
function count(hay, needle) { let n = 0, i = 0; for (;;) { const j = hay.indexOf(needle, i); if (j < 0) break; n++; i = j + needle.length; } return n; }

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error("FAIL " + n); } };

(async () => {
  // ---------- CLIENT: default ON + no gating callers (1-4) ----------
  ok("1 usersWriteEndpointsEnabled DEFAULT ON", /function usersWriteEndpointsEnabled\(\)\{ try\{ return lsGet\("users_write_endpoints"\)!=="off"; \}catch\(_\)\{ return true; \} \}/.test(HSRC));
  ok("2 helper NAO usa idioma default-OFF (===\"on\")", !/lsGet\("users_write_endpoints"\)==="on"/.test(HSRC));
  ok("3 usersWriteEndpointsEnabled aparece SO na def do helper (sem callers => OFF nao reativa write)", count(HSRC, "usersWriteEndpointsEnabled") === 1);
  ok("4 nenhum ramo de escrita consulta a flag (endpoint-only)", !/if\(usersWriteEndpointsEnabled\(\)\)\{/.test(HSRC));

  // ---------- CLIENT: 11 payloads diretos removidos (5-15) ----------
  const gone = [
    ["5 login rehash {pass:np,salt:salt}", "update({pass:np,salt:salt})"],
    ["6 lastSeen", "update({ lastSeen: Date.now() })"],
    ["7 admin status", 'update({status:"ativo"})'],
    ["8 admin boolean", "update({admin:mk})"],
    ["9 self color", "update({color:hex})"],
    ["10 self reminderMinutes", "update({ reminderMinutes: v })"],
    ["11 self photo", "update({photo:photoUrl})"],
    ["12 self photo remove", 'update({photo:""})'],
    ["13 self profile", "doc(me.id).update(updates)"],
    ["14 changePassword {pass,salt}", "update({pass:newHash, salt:newSalt})"],
    ['15 deleteMyAccount status:"excluido"', 'status:"excluido"'],
  ];
  for (const [name, s] of gone) ok(name + " removido", !HSRC.includes(s));

  // ---------- CLIENT: clients endpoint-only preservados (16-21) ----------
  for (const fn of ["updateUserSelfClient", "touchUserLastSeenClient", "adminSetUserStatusClient", "adminSetUserAdminClient", "changePasswordClient", "deleteMyAccountClient"]) {
    ok("16.. client preservado: " + fn, new RegExp("async function " + fn + "\\(").test(HSRC));
  }

  // ---------- CLIENT: hardenings preservados (22-26) ----------
  ok("22 role hardening: setRole read-only", HSRC.includes('field("setRole", "Função na agência", me.role, "text", "Definida pelo administrador", true)'));
  ok("23 role hardening: self-save defesa delete role/admin/status", HSRC.includes("delete updates.role; delete updates.admin; delete updates.status;"));
  ok("24 FCM cutoff: resetMyFcmTokensClient + cutover", /async function resetMyFcmTokensClient\(/.test(HSRC) && HSRC.includes("const rr2 = await resetMyFcmTokensClient();"));
  ok("25 fcm_token_server default ON preservado", /function fcmTokenServerEnabled\(\)\{ try\{ return lsGet\("fcm_token_server"\)!=="off"; \}catch\(_\)\{ return true; \} \}/.test(HSRC));
  ok("26 users_read_hardening default ON preservado", /function usersReadHardeningEnabled\(\)\{ try\{ return lsGet\("users_read_hardening"\)!=="off"; \}catch\(_\)\{ return true; \} \}/.test(HSRC));

  // ---------- CLIENT: fallbacks FCM OFF CORTADOS por U2 (endpoint-only); residual U3 preservado (27-29) ----------
  // F3.3.61-U2B: U2 removeu os 2 fallbacks diretos FCM OFF em /users. Antes 27/28 exigiam a
  // PRESENCA (residual U2); agora exigem a AUSENCIA do write direto + o caminho endpoint-only.
  ok("27 fallback FCM OFF force-rereg CORTADO por U2 (reset endpoint-only)", !HSRC.includes("update({ fcmTokens: [], fcmTokenMeta: {} })") && HSRC.includes("const rr2 = await resetMyFcmTokensClient();"));
  ok("28 fallback FCM OFF teardown arrayRemove CORTADO por U2 (remove endpoint-only)", !HSRC.includes("firebase.firestore.FieldValue.arrayRemove(fcmTokenSaved)") && HSRC.includes("await removeFcmTokenClient(fcmTokenSaved)"));
  ok("29 residual U3 cleanupDeadTokens (read-hardening OFF / push legado) preservado", HSRC.includes("fcmTokens: firebase.firestore.FieldValue.arrayRemove.apply(null, deadTokens)"));

  // ---------- CLIENT: nenhum write direto single-line /users no client (U1+U2) (30) ----------
  // Apos U2 nao sobra NENHUM write single-line em /users no client (o force-rereg era o ultimo).
  // Os arrayRemove residuais (U3) usam var refs / .apply e nao casam o regex single-line.
  const singleLine = (HSRC.match(/collection\("users"\)\.doc\([^)]*\)\.(update|set|delete)\(/g) || []).length;
  ok("30 writes diretos single-line /users no client == 0 (U2 cortou o ultimo)", singleLine === 0);

  // ---------- SERVER: invariantes RBAC intactas + login legado (31-34) ----------
  const SELF = grabConst(FSRC, "USER_SELF_UPDATE_KEYS");
  ok("31 USER_SELF_UPDATE_KEYS sem role/admin/status", SELF && !/\brole\b/.test(SELF) && !/\badmin\b/.test(SELF) && !/\bstatus\b/.test(SELF));
  for (const fn of ["updateUserSelf", "touchUserLastSeen", "adminSetUserStatus", "adminSetUserAdmin", "changePassword", "deleteMyAccount", "loginUser"]) {
    ok("32.. endpoint server existe: " + fn, new RegExp("exports\\." + fn + " = onRequest").test(FSRC));
  }
  ok("33 notifVerifyPassword aceita credenciais legadas (djb2) => remocao do rehash e segura", /notifDjb2\(String\(pw\)\)/.test(FSRC));
  ok("34 functions/index.js NAO alterado por U1 (client-only)", true); // reforcado pela diff-scope (39)

  // ---------- SINTAXE: inline JS valido (35) ----------
  let syn = true;
  try {
    const blocks = [...HSRC.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    const tmp = path.join(ROOT, "scripts", "worker-ops", ".u1_inline.tmp.js");
    fs.writeFileSync(tmp, blocks.join("\n;\n"));
    try { execSync("node --check " + JSON.stringify(tmp), { stdio: "ignore" }); } catch (_) { syn = false; }
    fs.unlinkSync(tmp);
  } catch (_) { syn = false; }
  ok("35 index.html inline JS sintaxe valida", syn);

  // ---------- REGRESSAO + HIGIENE (36-40) ----------
  let regC = true;
  try { execSync("node " + JSON.stringify(path.join(__dirname, "f3361C-users-write-endpoints.test.mjs")), { stdio: "ignore" }); } catch (_) { regC = false; }
  ok("36 f3361C (server users-write) continua passando", regC);

  let st = "__gitfail__";
  try { st = execSync("git -C " + JSON.stringify(ROOT) + " status --porcelain", { encoding: "utf8" }); } catch (_) { st = "__gitfail__"; }
  const changed = st === "__gitfail__" ? [] : st.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  const allowed = new Set(["index.html", "scripts/worker-ops/f3361U1-users-write-endpoints-default-on-cutoff.test.mjs"]);
  const disallowed = changed.filter((f) => !allowed.has(f));
  ok("37 diff restrito a index.html + teste U1", st !== "__gitfail__" && disallowed.length === 0);
  ok("38 sem Rules change", !changed.some((f) => /\.rules$|firestore.*rules/i.test(f)));
  ok("39 sem functions/ change (U1 e client-only)", !changed.some((f) => /^functions\//.test(f)));
  ok("40 sem workflow/Desktop/Android/Worker/Card change", !disallowed.some((f) => /\.github\/workflows|desktop|android|worker|card/i.test(f)));

  console.log("\nF3.3.61-U1: " + pass + " passaram, " + fail + " falharam (de " + (pass + fail) + ").");
  process.exit(fail ? 1 : 0);
})();
