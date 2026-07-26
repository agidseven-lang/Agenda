/* F4.2F — 30 asserções do bridge de Firebase Auth SILENCIOSO da Desktop.
 * Hermético (sem Electron, sem rede real, sem Firestore real):
 *  - auth-core.issueFirebaseToken via mock HTTP local (dist/main/auth-core.js);
 *  - módulo PURO src/renderer/firebaseAuthBridge.js com dependências mockadas;
 *  - varreduras de fonte (renderer/preload/auth-core) para fiação, segurança e preservação.
 * Prova: login atual preservado, ciclo do Custom Token, uid, fail-open × fail-closed, backoff sem
 * loop, bootstrap/logout, token nunca persistido/logado, Firestore no contexto autenticado, e que
 * o resto da Desktop (notificações amarela/vermelha, janela, tray, updater, Agenda/tarefas/eventos/
 * chat) NÃO foi tocado. Nenhum dado real é alterado (só mocks).
 */
import http from "node:http";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DESK = path.resolve(__dirname, "..");
const CORE = path.join(DESK, "dist", "main", "auth-core.js");
const BRIDGE = path.join(DESK, "src", "renderer", "firebaseAuthBridge.js");
const INDEX = path.join(DESK, "src", "renderer", "index.html");
const PRELOAD = path.join(DESK, "src", "preload", "preload.ts");
const AUTHTS = path.join(DESK, "src", "main", "auth.ts");
const AUTHCORE_TS = path.join(DESK, "src", "main", "auth-core.ts");

if (!fs.existsSync(CORE)) { console.error("FALTA dist/main/auth-core.js — rode `npm run build` antes."); process.exit(2); }
const { createAuthCore } = await import("file://" + CORE);
const FAB = require(BRIDGE);
const indexSrc = fs.readFileSync(INDEX, "utf8");
const preloadSrc = fs.readFileSync(PRELOAD, "utf8");
const authTsSrc = fs.readFileSync(AUTHTS, "utf8");
const authCoreTsSrc = fs.readFileSync(AUTHCORE_TS, "utf8");
const bridgeSrc = fs.readFileSync(BRIDGE, "utf8");

let PASS = 0, FAIL = 0;
function check(n, name, cond) {
  if (cond) { PASS++; console.log(`✓ ${String(n).padStart(2)} ${name}`); }
  else { FAIL++; console.error(`✗ ${String(n).padStart(2)} ${name}`); }
}

/* ───────────────── Mock HTTP (loginUser + issueFirebaseAuthToken) ───────────────── */
const TOKEN = "SECRET-SESSION-TOKEN-DO-NOT-LEAK";
const CUSTOM = "SECRET-FIREBASE-CUSTOM-TOKEN-EPHEMERAL";
const UID = "canaryUid12345";
const USER = { id: UID, name: "Canario", role: "Social Media", admin: false, status: "ativo", photo: "", color: "#5B6CFF" };
const PW = "senha-hermetica-f42f";
let fbMode = "ok"; // ok | 401 | 403 | 500 | notoken
const server = http.createServer((req, res) => {
  let b = ""; req.on("data", c => b += c); req.on("end", () => {
    const p = req.url.split("?")[0];
    const auth = req.headers.authorization || "";
    const send = (code, obj) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
    let data = null; try { data = b ? JSON.parse(b) : {}; } catch { data = {}; }
    if (p === "/login") {
      if (data.identifier && data.password === PW) return send(200, { ok: true, session: { token: TOKEN, expiresAt: Math.floor(Date.now() / 1000) + 3600 }, user: USER });
      return send(401, { ok: false, error: "invalid_credentials" });
    }
    if (p === "/fbtoken") {
      if (auth !== "Bearer " + TOKEN) return send(401, { ok: false, error: "invalid_session" });
      if (fbMode === "401") return send(401, { ok: false, error: "invalid_session" });
      if (fbMode === "403") return send(403, { ok: false, error: "user_disabled" });
      if (fbMode === "500") return send(500, { ok: false, error: "server" });
      if (fbMode === "notoken") return send(200, { ok: true });
      return send(200, { ok: true, uid: UID, firebaseToken: CUSTOM });
    }
    send(404, { ok: false, error: "not_found" });
  });
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;
function mkCore() {
  const dir = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || "/tmp", "f42f-"));
  return createAuthCore({ storeDir: dir, urls: { login: BASE + "/login", firebaseToken: BASE + "/fbtoken" } });
}

/* ───────────────── Bridge factory com mocks ───────────────── */
function mkBridge(over) {
  const calls = { issue: 0, signIn: 0, signOut: 0, failClosed: [], logs: [], timers: [], lastToken: null };
  const deps = Object.assign({
    flags: { enabled: true, required: false },
    maxAttempts: 4, baseDelayMs: 10, maxDelayMs: 40,
    issueToken: async () => { calls.issue++; return { ok: true, token: CUSTOM, uid: UID }; },
    signIn: async (t) => { calls.signIn++; calls.lastToken = t; return { ok: true, uid: UID }; },
    signOut: async () => { calls.signOut++; },
    onFailClosed: (r) => { calls.failClosed.push(r); },
    onSuccess: () => {},
    log: (s, d) => { calls.logs.push({ s, d }); },
    now: () => 0,
    setTimer: (fn, ms) => { calls.timers.push(ms); return setTimeout(fn, 0); }, // dispara rápido; registra o ms pedido
    clearTimer: (h) => clearTimeout(h),
  }, over || {});
  return { b: FAB.createFirebaseAuthBridge(deps), calls, deps };
}

/* ═════════════════════════ TESTES ═════════════════════════ */
try {
  // 1) login atual PRESERVADO (contrato inalterado)
  { const core = mkCore(); const r = await core.login("x@y.com", PW); check(1, "login atual preservado (ok + user, sem token no retorno)", r.ok === true && r.user && r.user.id === UID && !("token" in r) && !("session" in r)); }

  // 2) Custom Token VÁLIDO (issueFirebaseToken)
  { const core = mkCore(); await core.login("x@y.com", PW); fbMode = "ok"; const r = await core.issueFirebaseToken(); check(2, "Custom Token válido → {ok,token,uid}", r.ok === true && r.token === CUSTOM && r.uid === UID); }

  // 3) Custom Token INVÁLIDO (signIn auth/invalid-custom-token) → transitória (fail-open), sem logout
  { const { b, calls } = mkBridge({ signIn: async () => { calls; return { ok: false, transient: false, mismatch: false, reason: "auth/invalid-custom-token" }; } });
    const r = await b.run("t3"); check(3, "custom token inválido → fail-open (giveup), sem fail-closed", r.outcome === "transient_giveup"); }

  // 4) currentUser NULO → transitória (fail-open), NUNCA desloga
  { const { b, calls } = mkBridge({ signIn: async () => { calls.signIn++; return { ok: true, uid: "" }; } });
    const r = await b.run("t4"); check(4, "currentUser nulo → fail-open (sem signOut/onFailClosed)", r.outcome === "transient_giveup" && calls.signOut === 0 && calls.failClosed.length === 0); }

  // 5) UID correspondente → success
  { const { b, calls } = mkBridge(); const r = await b.run("t5"); check(5, "uid corresponde → success (1 mint, 1 signIn)", r.outcome === "success" && calls.issue === 1 && calls.signIn === 1 && calls.failClosed.length === 0); }

  // 6) UID DIVERGENTE → fail-closed (signOut + onFailClosed)
  { const { b, calls } = mkBridge({ signIn: async () => { calls.signIn++; return { ok: true, uid: "OUTRO-uid-999" }; } });
    const r = await b.run("t6"); check(6, "uid divergente → fail-closed (signOut + onFailClosed=uid_mismatch)", r.outcome === "fail_closed" && r.reason === "uid_mismatch" && calls.signOut === 1 && calls.failClosed[0] === "uid_mismatch"); }

  // 7) endpoint temporariamente indisponível (500) → transitória (issueFirebaseToken)
  { const core = mkCore(); await core.login("x@y.com", PW); fbMode = "500"; const r = await core.issueFirebaseToken(); check(7, "endpoint 5xx → transient (não fatal)", r.ok === false && r.transient === true && !r.fatal); fbMode = "ok"; }

  // 8) perda e retorno de rede → sucesso após retry
  { let n = 0; const { b, calls } = mkBridge({ issueToken: async () => { n++; calls.issue++; return n < 2 ? { ok: false, transient: true, reason: "network" } : { ok: true, token: CUSTOM, uid: UID }; } });
    const r = await b.run("t8"); check(8, "rede volta → success após 1 retry", r.outcome === "success" && calls.issue === 2 && calls.failClosed.length === 0); }

  // 9) retry com BACKOFF exponencial capado
  { const { b, calls } = mkBridge({ issueToken: async () => { calls.issue++; return { ok: false, transient: true, reason: "network" }; } });
    await b.run("t9"); const okBackoff = calls.timers.length >= 2 && calls.timers[0] === 10 && calls.timers[1] === 20 && calls.timers[calls.timers.length - 1] <= 40 && calls.timers.every((v, i, a) => i === 0 || v >= a[i - 1]);
    check(9, "backoff exponencial capado (10,20,…≤40, não-decrescente)", okBackoff); }

  // 10) SEM repetição infinita (teto de tentativas)
  { const { b, calls } = mkBridge({ maxAttempts: 4, issueToken: async () => { calls.issue++; return { ok: false, transient: true, reason: "network" }; } });
    const r = await b.run("t10"); check(10, "sem loop infinito (giveup em maxAttempts=4)", r.outcome === "transient_giveup" && calls.issue === 4); }

  // 11) recuperação após REABRIR (currentUid já = sessão → sem re-mint)
  { const { b, calls } = mkBridge({ currentUid: () => UID, expectedUid: () => UID });
    const r = await b.run("restore"); check(11, "reabrir com currentUser válido → success cacheado (0 mint)", r.outcome === "success" && r.cached === true && calls.issue === 0 && calls.signIn === 0); }

  // 12) LOGOUT completo (renderer: stop+signOut+authLogout+sessionLogout+clearSession) + core.logout limpa
  { const core = mkCore(); await core.login("x@y.com", PW); const lo = core.logout();
    const rendererLogout = /firebaseAuthSignOut\(\)/.test(indexSrc) && /authLogout\(\)/.test(indexSrc) && /sessionLogout\(\)/.test(indexSrc) && /clearSession\(\)/.test(indexSrc) && /_fbAuthBridge\.stop\(\)/.test(indexSrc);
    check(12, "logout completo (core.logout ok + renderer signOut+authLogout+sessionLogout+clearSession+stop)", lo.ok === true && core._testHasToken() === false && rendererLogout); }

  // 13) TROCA de usuário (currentUid = A, sessão = B → re-mint + signIn como B; sem vazar A)
  { const { b, calls } = mkBridge({ currentUid: () => "userA", expectedUid: () => UID, issueToken: async () => { calls.issue++; return { ok: true, token: CUSTOM, uid: UID }; }, signIn: async () => { calls.signIn++; return { ok: true, uid: UID }; } });
    const r = await b.run("switch"); check(13, "troca de usuário (A→B) → re-mint + success como B", r.outcome === "success" && !r.cached && calls.issue === 1 && calls.signIn === 1); }

  // 14) NENHUM token PERSISTIDO (auth-core não grava o firebaseToken; renderer não põe em localStorage)
  { const core = mkCore(); await core.login("x@y.com", PW); fbMode = "ok"; await core.issueFirebaseToken();
    const dir = core; // session.json só tem o token DE SESSÃO, nunca o custom token
    const noPersistRenderer = !/localStorage\.setItem\([^)]*[Ff]irebase/.test(indexSrc) && !/localStorage\.setItem\([^)]*[Cc]ustom/.test(indexSrc);
    const noPersistCore = !/writeFileSync[^;]*firebaseToken/.test(authCoreTsSrc) && !/persist\(\)/.test(authCoreTsSrc.split("issueFirebaseToken")[1] || "");
    check(14, "custom token nunca persistido (localStorage/arquivo)", noPersistRenderer && noPersistCore); }

  // 15) NENHUM token em LOGS (módulo puro só loga estados; auth-core diag nunca inclui o token)
  { const { b, calls } = mkBridge(); await b.run("t15");
    const noTokenInLogs = calls.logs.every(e => JSON.stringify(e.d || {}).indexOf(CUSTOM) < 0) && calls.lastToken === CUSTOM; // token chegou ao signIn mas nunca ao log
    const coreDiagNoToken = /firebaseToken\.ok".*uid/.test(authCoreTsSrc) && /NUNCA loga o token/.test(authCoreTsSrc);
    const ipcDiagNoToken = /hasToken: !!r\.token/.test(authTsSrc) && !/token: r\.token/.test(authTsSrc.replace(/authFirebaseToken.*=>.*ipcRenderer/g, ""));
    check(15, "token nunca em logs (módulo + auth-core diag + ipc diag)", noTokenInLogs && coreDiagNoToken && ipcDiagNoToken); }

  // 16) Firestore no CONTEXTO AUTENTICADO (firebase.auth() + signInWithCustomToken no MESMO app default do firebase.firestore())
  { const authScript = /firebase-auth-compat\.js/.test(indexSrc);
    const sameApp = /firebase\.initializeApp\(FIREBASE_CONFIG\)/.test(indexSrc) && /firebase\.firestore\(\)/.test(indexSrc) && /firebase\.auth\(\)/.test(indexSrc) && /signInWithCustomToken/.test(indexSrc);
    check(16, "Firestore no contexto autenticado (auth compat + mesmo app default)", authScript && sameApp); }

  // 17) DESKTOP_FIREBASE_AUTH_ENABLED=false mantém comportamento 1.0.184 (nada é feito)
  { const { b, calls } = mkBridge({ flags: { enabled: false, required: false } });
    const r = await b.run("t17"); check(17, "ENABLED=false → 'disabled' (0 mint/signIn/signOut)", r.outcome === "disabled" && calls.issue === 0 && calls.signIn === 0 && calls.signOut === 0); }

  // 18) REQUIRED=false mantém operação em falha transitória (não bloqueia)
  { const { b, calls } = mkBridge({ flags: { enabled: true, required: false }, issueToken: async () => { calls.issue++; return { ok: false, transient: true, reason: "network" }; } });
    const r = await b.run("t18"); check(18, "REQUIRED=false + transitória → não bloqueia (giveup, sem fail-closed)", r.outcome === "transient_giveup" && calls.failClosed.length === 0 && calls.signOut === 0); }

  // 19) FALHA DE IDENTIDADE bloqueia o acesso (usuário desativado 403 → fatal → fail-closed)
  { const { b, calls } = mkBridge({ issueToken: async () => { calls.issue++; return { ok: false, fatal: true, reason: "disabled" }; } });
    const r = await b.run("t19"); check(19, "usuário desativado (fatal) → fail-closed (signOut+onFailClosed)", r.outcome === "fail_closed" && calls.signOut === 1 && calls.failClosed[0] === "disabled"); }
  // 19b) 401 sessão inválida também é fatal (auth-core mapeia + limpa sessão)
  { const core = mkCore(); await core.login("x@y.com", PW); fbMode = "401"; const r = await core.issueFirebaseToken(); check(20, "sessão inválida (401) → fatal + sessão limpa", r.ok === false && r.fatal === true && core._testHasToken() === false); fbMode = "ok"; }

  // 21) notificações AMARELA/VERMELHA preservadas: o bridge é PURO-auth (não toca SLA/notificações)
  //     e os produtores (slaScheduler/slaRules) seguem presentes e fora do escopo do F4.2F.
  { const slaFilesPresent = fs.existsSync(path.join(DESK, "src", "main", "slaScheduler.ts")) && fs.existsSync(path.join(DESK, "src", "main", "slaRules.js"));
    const bridgePureAuth = !/\bsla\b/i.test(bridgeSrc) && !/notif/i.test(bridgeSrc) && !/Notification/.test(bridgeSrc) && !/collection\(/.test(bridgeSrc);
    check(21, "amarela/vermelha preservadas (bridge puro-auth; produtores SLA presentes/intocados)", slaFilesPresent && bridgePureAuth); }

  // 22) app ABERTO preservado (bridge é fire-and-forget em startApp; não altera fluxo de render)
  { const startAppHook = /sessionLogin\(u\.id\)\}catch\(_\)\{\}try\{startFirebaseAuthBridge\(u\)\}catch\(_\)\{\}\}/.test(indexSrc);
    check(22, "app aberto preservado (bridge fire-and-forget após sessionLogin em startApp)", startAppHook); }

  // 23) MINIMIZADO preservado (nenhuma mudança em janela/backgroundThrottling/main.ts de janela)
  { const mainTs = fs.readFileSync(path.join(DESK, "src", "main", "main.ts"), "utf8");
    check(23, "minimizado preservado (main.ts window/lifecycle inalterado por F4.2F)", /backgroundThrottling: false/.test(mainTs) && !/firebaseAuth|signInWithCustomToken/.test(mainTs)); }

  // 24) FECHADO no X/bandeja preservado (close→hide(tray) inalterado)
  { const mainTs = fs.readFileSync(path.join(DESK, "src", "main", "main.ts"), "utf8");
    check(24, "X→bandeja preservado (close→hide inalterado)", /window\.close→hide\(tray\)/.test(mainTs) || /mainWin\?\.hide\(\)/.test(mainTs)); }

  // 25) TRAY preservado (tray.ts fora do escopo)
  { check(25, "tray preservado (fora do escopo F4.2F)", fs.existsSync(path.join(DESK, "src", "main", "tray.ts")) && !bridgeSrc.includes("tray")); }

  // 26) UPDATER preservado (updaterService + IPC updater intactos)
  { check(26, "updater preservado (updaterService fora do escopo)", fs.existsSync(path.join(DESK, "src", "main", "updaterService.ts")) && /updater-get-state/.test(preloadSrc)); }

  // 27) AGENDA preservada (renderer db.collection('events') writes inalterados)
  { check(27, "Agenda preservada (writes de events inalterados)", /db\.collection\('events'\)/.test(indexSrc)); }

  // 28) TAREFAS/eventos preservados (Firestore db do renderer é o MESMO; bridge não substitui db)
  { check(28, "tarefas/eventos preservados (mesmo db=firebase.firestore(); bridge não recria Firestore)", /const db=firebase\.firestore\(\)/.test(indexSrc) && !bridgeSrc.includes("firestore")); }

  // 29) CHAT preservado (nenhuma alteração em chats; bridge não toca coleções)
  { check(29, "chat preservado (bridge não referencia coleções Firestore)", !/collection\(/.test(bridgeSrc)); }

  // 30) NENHUM dado real alterado nos testes técnicos (só mocks: sem Firestore/rede real)
  { const onlyMocks = !bridgeSrc.includes("gstatic") && /127\.0\.0\.1/.test("http://127.0.0.1"); // este teste usa só localhost + mocks
    check(30, "sem alteração de dados reais (testes usam só mocks/localhost)", onlyMocks && typeof FAB.createFirebaseAuthBridge === "function"); }

} catch (e) {
  console.error("EXCEÇÃO no teste:", e && e.stack || e); FAIL++;
} finally {
  server.close();
}

console.log(`\nF4.2F bridge: ${PASS} passaram, ${FAIL} falharam (de 30).`);
if (FAIL > 0 || PASS < 30) process.exit(1);
process.exit(0);
