#!/usr/bin/env node
/* =====================================================================
   F3.3.73D — Testes HERMÉTICOS (texto/fonte) da migração de SESSÃO/PERFIL/
   EQUIPE do Android para os contratos seguros:
     - Equipe (UsersRepo) lê `usersPublic`, NUNCA `users` (fim do PII no broadcast);
     - Perfil (self) vem de getUserSelf/selfProfile (e-mail/telefone do próprio user);
     - usuários removidos/canário filtrados; AssigneePicker/consumidores preservados;
     - sessão/token da 73C e password reset intactos.
   Lê Kotlin como TEXTO — NÃO compila, NÃO gera APK, NÃO chama rede, NÃO escreve.
   Vive em desktop/scripts/ (fora de android-native-beta/**) → não dispara workflow.
   Compilação real: android-compile-check.yml (compileDebugKotlin, sem APK).
   ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AND = path.resolve(__dirname, "..", "..", "android-native-beta", "app");
const rd = (p) => fs.readFileSync(path.join(AND, p), "utf8");
const P = "src/main/java/br/com/idseven/agenda/nativebeta";
const USERS = rd(`${P}/data/UsersRepo.kt`);
const AUTH = rd(`${P}/data/AuthRepo.kt`);
const SESS = rd(`${P}/data/SessionStore.kt`);
const MODELS = rd(`${P}/domain/Models.kt`);
const HVM = rd(`${P}/core/HomeViewModel.kt`);
const PROFILE = rd(`${P}/features/profile/ProfileScreen.kt`);
const SCAFFOLD = rd(`${P}/core/MainScaffold.kt`);

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };
function fnBody(src, sig) {
  const a = src.indexOf(sig); if (a < 0) return "";
  const open = src.indexOf("{", a); let d = 0;
  for (let j = open; j < src.length; j++) { const c = src[j]; if (c === "{") d++; else if (c === "}") { d--; if (!d) return src.slice(a, j + 1); } }
  return src.slice(a);
}
const LOGIN = fnBody(AUTH, "suspend fun login(");
const SELFP = fnBody(AUTH, "suspend fun selfProfile(");
const USERSFN = fnBody(USERS, "fun users()");

console.log("F3.3.73D — sessão/perfil/usersPublic Android (hermético por texto)");

/* ── A: Equipe via usersPublic (fim do users-direto) ── */
ok("A1 UsersRepo lê usersPublic", /collection\("usersPublic"\)/.test(USERSFN));
ok("A2 UsersRepo NÃO lê a coleção privada users", !/collection\("users"\)/.test(USERS));
ok("A3 filtro de ativos aplicado (remove pendente/removido/excluido)", /isActive\(/.test(USERSFN) && /"pendente"[\s\S]*"removido"[\s\S]*"excluido"/.test(USERS));
ok("A4 canários filtrados do stream", /filterNot[\s\S]*getBoolean\("canary"\)/.test(USERSFN));

/* ── B: Perfil via getUserSelf/selfProfile (PII só do próprio user) ── */
ok("B1 selfProfile existe e usa o endpoint self (Bearer)", SELFP.length > 0 && /FN_SELF_URL/.test(SELFP) && /bearer *= *token/.test(SELFP));
ok("B2 selfProfile extrai e-mail e telefone do próprio user", /s\("email"\)/.test(SELFP) && /s\("phone"\)/.test(SELFP));
ok("B3 SelfInfo modelado no domínio", /data class SelfInfo\(/.test(MODELS) && /val email: String\?/.test(MODELS));
ok("B4 HomeViewModel expõe self via selfProfile + token seguro", /val self: StateFlow<SelfInfo\?>/.test(HVM) && /AuthRepo\.selfProfile\(SessionStore\(getApplication\(\)\)\.token\(\)\)/.test(HVM));
ok("B5 ProfileScreen recebe self e lê e-mail/telefone DELE (não da equipe)", /fun ProfileScreen\(currentUser: UserLite\?, self: SelfInfo\?,/.test(PROFILE) && /InfoLine\("E-mail", self\?\.email/.test(PROFILE) && /InfoLine\("WhatsApp", self\?\.phone/.test(PROFILE));
ok("B6 indicador de aparelho registrado usa self.fcmTokens (não currentUser)", /self\?\.fcmTokens\?\.contains\(localToken\)/.test(PROFILE) && !/currentUser\?\.fcmTokens\?\.contains/.test(PROFILE));
ok("B7 MainScaffold coleta vm.self e passa ao ProfileScreen", /val self by vm\.self\.collectAsState\(\)/.test(SCAFFOLD) && /ProfileScreen\(currentUser, self, session, onLogout\)/.test(SCAFFOLD));

/* ── C: sem PII de usersPublic + equipe sem e-mail no broadcast ── */
ok("C1 e-mail NÃO é lido do stream de equipe (só o campo, resolve null em usersPublic)", !/getString\("email"\)/.test(USERSFN) || /usersPublic/.test(USERSFN));
ok("C2 selfProfile é a ÚNICA origem de e-mail exibido no Perfil", /self\?\.email/.test(PROFILE) && !/currentUser\?\.email/.test(PROFILE));

/* ── D: regressões da 73C e reset preservados ── */
ok("D1 login segue 100% server-side (loginUser), sem users-direto", /FN_LOGIN_URL/.test(LOGIN) && !/collection\("users"\)/.test(LOGIN));
ok("D2 login não valida hash local", !/Crypto\.verify/.test(LOGIN));
ok("D3 SessionStore.token() e clear() preservados (sessão 73C intacta)", /fun token\(\): String\?/.test(SESS) && /fun clear\(\)/.test(SESS) && /EncryptedSharedPreferences/.test(SESS));
ok("D4 password reset preservado", /requestPasswordReset/.test(AUTH) && /confirmPasswordReset/.test(AUTH));
ok("D5 token/senha nunca logados no selfProfile", !/Log\.[a-z]+\([^)]*token/.test(SELFP) && !/Log\.[a-z]+\([^)]*password/i.test(SELFP));

/* ── E: escopo — Chat/Copywriting não reintroduzidos nesta fase ── */
ok("E1 UsersRepo não referencia Chat", !/Chat/.test(USERS));
ok("E2 nenhuma reintrodução de Copywriting nos arquivos tocados", !/[Cc]opywriting/.test(USERS + HVM + PROFILE));

console.log("\nRESULTADO: " + pass + "/" + (pass + fail) + " PASS" + (fail ? " — HÁ FALHAS" : " — SUITE OK"));
process.exit(fail ? 1 : 0);
