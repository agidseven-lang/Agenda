/* F3.3.56-G2 — teste hermético do auth-core (sem Electron, sem rede real).
   Sobe um mock HTTP local (loginUser/getUserSelf/changePassword) e prova:
   login ok/errado/inativo, token confinado ao main (nunca no retorno),
   restore ok/expirado, troca de senha ok/erro, logout, status sem token,
   e que NENHUM token/senha aparece no que volta ao "renderer".
   Compila o auth-core.ts em memória (tsc já rodou? não — usamos import por
   transpile leve: o runner de CI roda ESTE arquivo APÓS `npm run build`,
   importando dist/main/auth-core.js). */
import http from "node:http";
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.resolve(__dirname, "../dist/main/auth-core.js");
if (!fs.existsSync(CORE)) { console.error("FALTA dist/main/auth-core.js — rode `npm run build` antes."); process.exit(2); }
const { createAuthCore } = await import("file://" + CORE);

const CANARY = "teste.webpush@idseven.com.br";
const PW = "senha-hermetica-g2";
const TOKEN = "SECRET-SESSION-TOKEN-DO-NOT-LEAK";
const SELF = { id: "canaryUid12345", name: "Canario", role: "Social Media", admin: false, status: "ativo", photo: "", color: "#5B6CFF" };
let mode = "ok";           // ok | expired
let chpwMode = "ok";       // ok | wrong | weak

const server = http.createServer((req, res) => {
  let b = ""; req.on("data", c => b += c); req.on("end", () => {
    const p = req.url.split("?")[0];
    const send = (code, obj) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
    let data = null; try { data = b ? JSON.parse(b) : {}; } catch { data = {}; }
    const auth = req.headers.authorization || "";
    if (p === "/login") {
      if (data.identifier && (data.identifier === CANARY || /^\+?\d+$/.test(String(data.identifier))) && data.password === PW)
        return send(200, { ok: true, session: { token: TOKEN, expiresAt: Math.floor(Date.now() / 1000) + 3600 }, user: SELF });
      if (data.password === "inativo") return send(403, { ok: false, error: "user_inactive" });
      return send(401, { ok: false, error: "invalid_credentials" });
    }
    if (p === "/self") {
      if (auth !== "Bearer " + TOKEN) return send(401, { ok: false, error: "invalid_session" });
      if (mode === "expired") return send(401, { ok: false, error: "invalid_session" });
      return send(200, { ok: true, self: SELF });
    }
    if (p === "/chpw") {
      if (auth !== "Bearer " + TOKEN) return send(401, { ok: false, error: "unauthorized" });
      if (chpwMode === "wrong") return send(401, { ok: false, error: "invalid_credentials" });
      if (chpwMode === "weak") return send(400, { ok: false, error: "weak_password" });
      return send(200, { ok: true });
    }
    send(404, { ok: false, error: "not_found" });
  });
});

const results = [];
function check(name, cond) { results.push({ name, ok: !!cond }); if (!cond) console.error("FAIL " + name); }
const leakScan = (obj) => JSON.stringify(obj || {}).includes(TOKEN) || JSON.stringify(obj || {}).includes(PW);

await new Promise(r => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "g2-auth-"));
const core = createAuthCore({ storeDir, urls: { login: base + "/login", self: base + "/self", changePassword: base + "/chpw" } });

// 1) login sucesso — retorna user, NUNCA token
const r1 = await core.login(CANARY, PW);
check("login-ok", r1.ok === true && r1.user && r1.user.id === "canaryUid12345");
check("login-no-token-no-leak", !leakScan(r1) && !("token" in r1) && !(r1.user && "token" in r1.user));
check("token-confinado-main", core._testHasToken() === true);

// 2) login por telefone (paridade email OU phone)
const r2 = await core.login("+5511999999999", PW);
check("login-phone-ok", r2.ok === true);

// 3) senha errada
const r3 = await core.login(CANARY, "errada");
check("login-wrong", r3.ok === false && r3.error === "invalid_credentials" && !leakScan(r3));

// 4) usuário inativo
const r4 = await core.login(CANARY, "inativo");
check("login-inactive", r4.ok === false && r4.error === "user_inactive");

// 5) sessão persistida em arquivo com mode restrito
await core.login(CANARY, PW);
const st = fs.statSync(path.join(storeDir, "session.json"));
check("session-file-0600", (st.mode & 0o777) === 0o600);

// 6) restore self com sessão válida
mode = "ok";
const r6 = await core.self();
check("self-ok", r6.ok === true && r6.self && r6.self.id === "canaryUid12345" && !leakScan(r6));

// 7) status sem token
const s7 = core.status();
check("status-active-no-token", s7.ok === true && s7.active === true && !("token" in s7) && !leakScan(s7));

// 8) troca de senha ok
chpwMode = "ok";
const r8 = await core.changePassword(PW, "nova-senha-123");
check("chpw-ok", r8.ok === true && !leakScan(r8));

// 9) troca de senha com senha atual errada
chpwMode = "wrong";
const r9 = await core.changePassword("errada", "nova-senha-123");
check("chpw-wrong", r9.ok === false && r9.error === "invalid_credentials");

// 10) self expirado => limpa sessão + reporta expired
mode = "expired";
await core.login(CANARY, PW); mode = "expired";
const r10 = await core.self();
check("self-expired-wipes", r10.ok === false && r10.error === "expired" && core._testHasToken() === false);

// 11) logout limpa arquivo + memória
await core.login(CANARY, PW); mode = "ok";
core.logout();
check("logout-clears", core._testHasToken() === false && !fs.existsSync(path.join(storeDir, "session.json")));

// 12) self sem sessão
const r12 = await core.self();
check("self-no-session", r12.ok === false && r12.error === "no_session");

server.close();
try { fs.rmSync(storeDir, { recursive: true, force: true }); } catch {}

const pass = results.filter(r => r.ok).length, fail = results.length - pass;
console.log(results.map(r => (r.ok ? "PASS " : "FAIL ") + r.name).join("\n"));
console.log(`\n==== AUTH-CORE HERMETIC ${pass} PASS / ${fail} FAIL ====`);
process.exit(fail === 0 ? 0 : 1);
