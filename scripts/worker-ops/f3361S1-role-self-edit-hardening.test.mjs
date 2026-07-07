#!/usr/bin/env node
/* =====================================================================
 * F3.3.61-S1 — Hardening do self-edit de `role` no perfil (client) +
 * invariantes RBAC server-side (leitura estrutural, sem rede/Firestore real).
 *
 * Prova (client, index.html):
 *   - o campo setRole no editor de perfil e RENDERIZADO read-only (field(...,true))
 *     e o helper field() emite o atributo readonly;
 *   - o handler de "Salvar dados basicos" NAO le setRole para salvar, constroi um
 *     payload ALLOWLISTED (name/phone/email) e aplica defesa explicita
 *     delete updates.role/admin/status ANTES de qualquer write;
 *   - caminho users_write_endpoints ON: _selfPatch so name/phone/email (sem role/
 *     admin/status), via updateUserSelfClient;
 *   - caminho OFF (fallback direto): db...users/{me.id}.update(updates) com updates
 *     allowlisted (sem role); nenhum update inline com role;
 *   - role continua projetado para EXIBICAO (normalizeRosterUser);
 *   - preservados: users_write default OFF, fcm_token_server default ON,
 *     resetMyFcmTokensClient, cutover force-rereg, deleteMyAccount, changePassword,
 *     admin flows.
 *
 * Prova (server, functions/index.js — leitura estrutural):
 *   - USER_SELF_UPDATE_KEYS sem role/admin/status; updateUserSelf => forbidden_field;
 *   - USER_ADMIN_UPDATE_KEYS com role e SEM admin (boolean nunca via adminUpdateUser);
 *   - adminUpdateUser/adminSetUserAdmin/adminCreateUser exigem authRequireAdminSession;
 *   - authRequireAdminSession exige d.admin === true; role NAO e gate de autorizacao;
 *   - role e metadata/display (projecao str()).
 *
 * Regressao: f3361C + f3361J passam; functions/index.js node --check; diff so em
 *   index.html + este teste; sem Rules/workflow/functions/Desktop/Android/Worker/Card.
 *   (f3361R1 nao e re-executado aqui: seu diff-scope self-check acusaria falso-positivo
 *    com este novo arquivo worker-ops ainda nao commitado; suas invariantes de FCM
 *    cutover estao espelhadas inline abaixo, e f3361R1 volta a passar arvore-limpa
 *    pos-merge. f3361C/f3361J nao tem diff-scope e sao executados diretamente.)
 *
 * Puro/offline: NAO deploya; NAO toca producao; NAO usa Firestore/FCM real; NAO
 *   altera role de ninguem.
 * Rodar: node scripts/worker-ops/f3361S1-role-self-edit-hardening.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { execSync } from "node:child_process";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const FSRC = fs.readFileSync(path.join(ROOT, "functions", "index.js"), "utf8");
const HSRC = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function grab(src, n) {
  let a = src.indexOf("async function " + n + "(");
  if (a < 0) a = src.indexOf("function " + n + "(");
  if (a < 0) return "";
  let d = 0;
  for (let j = src.indexOf("{", a); j < src.length; j++) {
    const c = src[j];
    if (c === "{") d++;
    else if (c === "}") { d--; if (!d) return src.slice(a, j + 1); }
  }
  return "";
}
function grabConst(src, n) {
  const m = new RegExp("^const " + n + "\\b[^\\n]*$", "m").exec(src);
  return m ? m[0] : "";
}

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error("FAIL " + n); } };

// --- Slices client ---
const saveA = HSRC.indexOf("Salvar dados básicos");
const saveB = HSRC.indexOf("/* Alterar senha */", saveA >= 0 ? saveA : 0);
const SAVE = (saveA >= 0 && saveB > saveA) ? HSRC.slice(saveA, saveB) : "";
const fieldA = HSRC.indexOf("function field(id, label, value, type, placeholder");
const FIELD = fieldA >= 0 ? HSRC.slice(fieldA, fieldA + 700) : "";
const SET_ROLE_RENDER = (HSRC.match(/field\("setRole"[^\n]*\)/) || [""])[0];

// --- Consts/handlers server ---
const SELF_KEYS = grabConst(FSRC, "USER_SELF_UPDATE_KEYS");
const ADMIN_KEYS = grabConst(FSRC, "USER_ADMIN_UPDATE_KEYS");
const H_SELF = grab(FSRC, "handleUpdateUserSelf");
const H_ADMUPD = grab(FSRC, "handleAdminUpdateUser");
const H_ADMADMIN = grab(FSRC, "handleAdminSetUserAdmin");
const H_ADMCREATE = grab(FSRC, "handleAdminCreateUser");
const H_ADMREQ = grab(FSRC, "authRequireAdminSession");

(async () => {
  // ---------- CLIENT: role read-only + self-save allowlisted (1-10) ----------
  ok("1 setRole renderizado read-only (field(...,true))", /field\("setRole",[^\n]*,\s*true\)/.test(SET_ROLE_RENDER));
  ok("2 helper field() suporta readonly (emite atributo readonly)", /readonly/.test(FIELD) && /roAttr/.test(FIELD));
  ok("3 save NAO le setRole.value para salvar", SAVE.length > 0 && !/getElementById\("setRole"\)\.value/.test(SAVE));
  ok("4 updates ALLOWLISTED = {name,phone,email}", /var updates = \{name:name, phone:phone, email:email\};/.test(SAVE));
  ok("5 literal updates SEM role/admin/status", !/var updates = \{[^}]*\b(role|admin|status)\b/.test(SAVE));
  ok("6 defesa explicita delete role/admin/status", /delete updates\.role;\s*delete updates\.admin;\s*delete updates\.status;/.test(SAVE));
  ok("7 ON: _selfPatch so name/phone/email (sem role/admin/status)",
     /_selfPatch=\{\}/.test(SAVE) && /_selfPatch\.name=/.test(SAVE) && /_selfPatch\.phone=/.test(SAVE) && /_selfPatch\.email=/.test(SAVE)
     && !/_selfPatch\.role/.test(SAVE) && !/_selfPatch\.admin/.test(SAVE) && !/_selfPatch\.status/.test(SAVE));
  ok("8 ON: chama updateUserSelfClient(_selfPatch)", /updateUserSelfClient\(_selfPatch\)/.test(SAVE));
  ok("9 self-save endpoint-only (U1: sem write direto update(updates))", !/db\.collection\("users"\)\.doc\(me\.id\)\.update\(updates\)/.test(SAVE) && /updateUserSelfClient\(_selfPatch\)/.test(SAVE));
  ok("10 nenhum update inline com role no self-save", !/\.update\(\{[^}]*role/.test(SAVE));

  // ---------- CLIENT: display + comportamentos preservados (11-18) ----------
  ok("11 role ainda projetado p/ EXIBICAO (normalizeRosterUser)", /role: str\(src\.role\)/.test(HSRC));
  ok("12 users_write_endpoints default ON (U1)", /function usersWriteEndpointsEnabled\(\)\{ try\{ return lsGet\("users_write_endpoints"\)!=="off"; \}catch\(_\)\{ return true; \} \}/.test(HSRC));
  ok("13 fcm_token_server default ON preservado", /function fcmTokenServerEnabled\(\)\{ try\{ return lsGet\("fcm_token_server"\)!=="off"; \}catch\(_\)\{ return true; \} \}/.test(HSRC));
  ok("14 resetMyFcmTokensClient preservado", /async function resetMyFcmTokensClient\(/.test(HSRC));
  ok("15 cutover force-rereg preservado", /const rr2 = await resetMyFcmTokensClient\(\)/.test(HSRC));
  ok("16 deleteMyAccount preservado", /async function deleteMyAccountClient\(/.test(HSRC));
  ok("17 changePassword preservado", /async function changePasswordClient\(/.test(HSRC));
  ok("18 admin flows preservados", /async function adminSetUserAdminClient\(/.test(HSRC) && /async function adminSetUserStatusClient\(/.test(HSRC));

  // ---------- SERVER: invariantes RBAC (leitura estrutural) (19-31) ----------
  ok("19 USER_SELF_UPDATE_KEYS SEM role", SELF_KEYS.length > 0 && !/\brole\b/.test(SELF_KEYS));
  ok("20 USER_SELF_UPDATE_KEYS SEM admin", !/\badmin\b/.test(SELF_KEYS));
  ok("21 USER_SELF_UPDATE_KEYS SEM status", !/\bstatus\b/.test(SELF_KEYS));
  ok("22 USER_SELF_UPDATE_KEYS = keys seguras", /"color"/.test(SELF_KEYS) && /"photo"/.test(SELF_KEYS) && /"reminderMinutes"/.test(SELF_KEYS) && /"name"/.test(SELF_KEYS) && /"phone"/.test(SELF_KEYS) && /"email"/.test(SELF_KEYS));
  ok("23 updateUserSelf rejeita forbidden_field via allowlist", H_SELF.length > 0 && /USER_SELF_UPDATE_KEYS\.indexOf\(k\) < 0/.test(H_SELF) && /forbidden_field/.test(H_SELF));
  ok("24 USER_ADMIN_UPDATE_KEYS COM role", /\brole\b/.test(ADMIN_KEYS));
  ok("25 USER_ADMIN_UPDATE_KEYS SEM admin (boolean nunca via adminUpdateUser)", !/\badmin\b/.test(ADMIN_KEYS));
  ok("26 adminUpdateUser exige authRequireAdminSession", H_ADMUPD.length > 0 && /authRequireAdminSession\(ctx\)/.test(H_ADMUPD));
  ok("27 adminSetUserAdmin exige authRequireAdminSession", H_ADMADMIN.length > 0 && /authRequireAdminSession\(ctx\)/.test(H_ADMADMIN));
  ok("28 adminCreateUser exige admin session + admin:false hardcoded", H_ADMCREATE.length > 0 && /authRequireAdminSession\(ctx\)/.test(H_ADMCREATE) && /admin:\s*false/.test(H_ADMCREATE));
  ok("29 authRequireAdminSession exige d.admin === true", H_ADMREQ.length > 0 && /d\.admin !== true/.test(H_ADMREQ) && /403/.test(H_ADMREQ));
  ok("30 role NAO e gate de autorizacao (sem role===\"admin\")", !/role\s*===?\s*["']admin["']/.test(FSRC));
  ok("31 role e metadata/display (projecao str())", /role: str\(/.test(FSRC));

  // ---------- REGRESSAO + HIGIENE (32-40) ----------
  let regC = true, regJ = true;
  try { execSync("node " + JSON.stringify(path.join(__dirname, "f3361C-users-write-endpoints.test.mjs")), { stdio: "ignore" }); } catch (_) { regC = false; }
  try { execSync("node " + JSON.stringify(path.join(__dirname, "f3361J-web-users-write-client-cutover.test.mjs")), { stdio: "ignore" }); } catch (_) { regJ = false; }
  ok("32 f3361C continua passando", regC);
  ok("33 f3361J continua passando", regJ);
  let syn = true;
  try { execSync("node --check " + JSON.stringify(path.join(ROOT, "functions", "index.js")), { stdio: "ignore" }); } catch (_) { syn = false; }
  ok("34 functions/index.js sintaxe valida", syn);

  let st = "__gitfail__";
  try { st = execSync("git -C " + JSON.stringify(ROOT) + " status --porcelain", { encoding: "utf8" }); } catch (_) { st = "__gitfail__"; }
  const changed = st === "__gitfail__" ? [] : st.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  const allowed = new Set(["index.html", "scripts/worker-ops/f3361S1-role-self-edit-hardening.test.mjs"]);
  const disallowed = changed.filter((f) => !allowed.has(f));
  ok("35 diff restrito a index.html + teste S1", st !== "__gitfail__" && disallowed.length === 0);
  ok("36 functions/index.js NAO alterado (S1 e client-only)", !changed.some((f) => /^functions\//.test(f)));
  ok("37 sem Rules change", !changed.some((f) => /\.rules$|firestore.*rules/i.test(f)));
  ok("38 sem workflow change", !changed.some((f) => /\.github\/workflows/.test(f)));
  ok("39 sem Desktop/Android/Worker/Card change", !disallowed.some((f) => /desktop|android|worker|card/i.test(f)));
  ok("40 index.html carrega o handler de save + setRole", SAVE.length > 0 && SET_ROLE_RENDER.length > 0);

  console.log("\nF3.3.61-S1: " + pass + " passaram, " + fail + " falharam (de " + (pass + fail) + ").");
  process.exit(fail ? 1 : 0);
})();
