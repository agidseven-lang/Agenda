#!/usr/bin/env node
/* =====================================================================
   F3.3.73C — Testes HERMÉTICOS (texto/fonte) da migração do LOGIN Android
   para server-side. Lê os fontes Kotlin como TEXTO — NÃO compila, NÃO gera
   APK, NÃO chama rede, NÃO escreve. Vive em desktop/scripts/ (fora de
   android-native-beta/**) → não dispara nenhum workflow Android. A compilação
   real é validada por android-compile-check.yml (compileDebugKotlin, sem APK).
   Trava o contrato: login() 100% server-side (loginUser+getUserSelf), sem
   Firestore/hash-local no login, token cifrado, logout limpa, reset preservado.
   ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AND = path.resolve(__dirname, "..", "..", "android-native-beta", "app");
const rd = (p) => fs.readFileSync(path.join(AND, p), "utf8");
const AUTH = rd("src/main/java/br/com/idseven/agenda/nativebeta/data/AuthRepo.kt");
const SESS = rd("src/main/java/br/com/idseven/agenda/nativebeta/data/SessionStore.kt");
const VM = rd("src/main/java/br/com/idseven/agenda/nativebeta/features/auth/LoginViewModel.kt");
const GRADLE = rd("build.gradle");

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };

// Extrai o corpo textual de uma função `suspend fun <name>(` até o fechamento
// balanceado de chaves (para asserts escopados só ao login, não ao arquivo todo).
function fnBody(src, sig) {
  const a = src.indexOf(sig);
  if (a < 0) return "";
  const open = src.indexOf("{", a);
  let d = 0;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (c === "{") d++;
    else if (c === "}") { d--; if (!d) return src.slice(a, j + 1); }
  }
  return src.slice(a);
}
const LOGIN = fnBody(AUTH, "suspend fun login(");
const SELF = fnBody(AUTH, "suspend fun getUserSelf(");

console.log("F3.3.73C — login Android server-side (hermético por texto)");

/* ---- A: login() é server-side puro ---- */
ok("A1 login() NÃO usa FirebaseFirestore/db no corpo", LOGIN.length > 0 && !/FirebaseFirestore|db\.collection/.test(LOGIN));
ok("A2 login() NÃO valida hash local (Crypto.verify)", !/Crypto\.verify/.test(LOGIN));
ok("A3 login() chama o endpoint loginUser (FN_LOGIN_URL)", /postJson\(\s*FN_LOGIN_URL/.test(LOGIN));
ok("A4 login() envia identifier+password no corpo", /"identifier"/.test(LOGIN) && /"password"/.test(LOGIN));
ok("A5 login() lê session.token + user.id da resposta", /"token"/.test(LOGIN) && /"id"/.test(LOGIN));
ok("A6 login() valida o token via getUserSelf", /getUserSelf\(token\)/.test(LOGIN));
ok("A7 login() devolve Result.Ok com token", /Result\.Ok\([^)]*token\)/.test(LOGIN));
ok("A8 login() erro de credencial é genérico/seguro", /incorretos/.test(LOGIN));

/* ---- B: getUserSelf() autenticado por Bearer ---- */
ok("B1 getUserSelf() existe e chama FN_SELF_URL", SELF.length > 0 && /postJson\(\s*FN_SELF_URL/.test(SELF));
ok("B2 getUserSelf() envia token como bearer", /bearer\s*=\s*token/.test(SELF));
ok("B3 getUserSelf() trata 401 como expired", /http\s*==\s*401[\s\S]*expired/.test(SELF));

/* ---- C: postJson suporta Authorization Bearer, sem vazar token ---- */
ok("C1 postJson aceita bearer e injeta header Authorization", /fun postJson\([^)]*bearer:\s*String\?/.test(AUTH) && /setRequestProperty\("Authorization",\s*"Bearer \$bearer"\)/.test(AUTH));

/* ---- D: nada de token/senha/corpo em log no login/self ---- */
ok("D1 login() não loga corpo/body", !/Log\.[a-z]+\([^)]*body/.test(LOGIN));
ok("D2 login()/self() não logam token", !/Log\.[a-z]+\([^)]*token/.test(LOGIN) && !/Log\.[a-z]+\([^)]*token/.test(SELF));
ok("D3 senha nunca aparece em Log em todo o AuthRepo", !/Log\.[a-z]+\([^)]*password/i.test(AUTH));

/* ---- E: SessionStore token cifrado + logout limpa ---- */
ok("E1 SessionStore usa EncryptedSharedPreferences", /EncryptedSharedPreferences\.create/.test(SESS));
ok("E2 chave mestra via Android Keystore (MasterKey)", /MasterKey\.Builder/.test(SESS));
ok("E3 save() persiste token cifrado", /fun save\([^)]*token:\s*String\?/.test(SESS) && /putString\(KEY_TOKEN/.test(SESS));
ok("E4 token() lê do storage seguro", /fun token\(\):\s*String\?/.test(SESS));
ok("E5 clear() limpa DataStore E token cifrado", /fun clear\(\)[\s\S]*sessionDataStore\.edit[\s\S]*securePrefs\.edit\(\)\.clear\(\)/.test(SESS));
ok("E6 token NÃO vai para o DataStore (texto): sem it[KEY_TOKEN]", !/it\[KEY_TOKEN\]/.test(SESS) && /putString\(KEY_TOKEN/.test(SESS));
ok("E7 Flow de sessão (uid/name) preservado p/ navegação reativa", /val session:\s*Flow<UserSession\?>/.test(SESS));

/* ---- F: VM grava token no sucesso do login ---- */
ok("F1 VM salva uid+name+token na sessão", /sessionStore\.save\(r\.uid,\s*r\.name,\s*r\.token\)/.test(VM));

/* ---- G: build.gradle — dep segura + URLs dos endpoints ---- */
ok("G1 dependência security-crypto adicionada", /androidx\.security:security-crypto/.test(GRADLE));
ok("G2 buildConfigField LOGIN_USER_URL", /buildConfigField "String", "LOGIN_USER_URL"/.test(GRADLE));
ok("G3 buildConfigField GET_USER_SELF_URL", /buildConfigField "String", "GET_USER_SELF_URL"/.test(GRADLE));
ok("G4 URLs sobreponíveis pelo CI (findProperty)", /findProperty\('LOGIN_USER_URL'\)/.test(GRADLE) && /findProperty\('GET_USER_SELF_URL'\)/.test(GRADLE));

/* ---- H: password reset preservado (regressão) ---- */
ok("H1 requestPasswordReset preservado", /suspend fun requestPasswordReset\(/.test(AUTH) && /FN_REQUEST_URL/.test(AUTH));
ok("H2 confirmPasswordReset preservado", /suspend fun confirmPasswordReset\(/.test(AUTH) && /FN_CONFIRM_URL/.test(AUTH));

console.log("\nRESULTADO: " + pass + "/" + (pass + fail) + " PASS" + (fail ? " — HÁ FALHAS" : " — SUITE OK"));
process.exit(fail ? 1 : 0);
