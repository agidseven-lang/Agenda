// =====================================================================
// F4.3C4C — BACKEND SINTÉTICO (local, em memória). Simula SOMENTE os contratos
// loginUser / issueFirebaseAuthToken / revokeMySession, com usuários FICTÍCIOS,
// secret DE TESTE, sessionVersion de teste e TTL reduzido. NÃO acessa produção,
// NÃO usa service account, NÃO registra tokens, NÃO loga corpo/segredo.
//
// Segurança do contrato (espelha o backend real):
//  - uid é derivado da SESSÃO (Bearer); uid/role/admin enviados no body são IGNORADOS;
//  - usuário inativo => 403; sessão expirada => 401; sessionVersion divergente => 403;
//  - o Custom Token é cunhado para o AUTH EMULATOR (JWT alg "none", claims mínimas) —
//    NENHUMA chave real; válido SOMENTE no emulador.
// Logs: método+rota+status apenas (categorias fechadas).
// =====================================================================
import http from "node:http";
import crypto from "node:crypto";

export const TEST_SECRET = "f43c4c-test-secret-NOT-PRODUCTION";
const b64u = (buf) => Buffer.from(buf).toString("base64url");

export function sha256Hex(s) { return crypto.createHash("sha256").update(s).digest("hex"); }

/** Sessão HMAC de teste: payload {uid, sv, scope:"session", iat, exp}. */
export function mintSession(uid, sv, ttlMs) {
  const payload = { uid, sv, scope: "session", iat: Date.now(), exp: Date.now() + ttlMs };
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", TEST_SECRET).update(body).digest("base64url");
  return { token: `${body}.${sig}`, expiresAt: payload.exp };
}

export function verifySession(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expect = crypto.createHmac("sha256", TEST_SECRET).update(body).digest("base64url");
  if (sig !== expect) return null;
  let p;
  try { p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
  if (p.scope !== "session" || typeof p.uid !== "string" || !p.uid) return null;
  if (typeof p.exp !== "number" || Date.now() >= p.exp) return { expired: true, uid: p.uid };
  return p;
}

/** Custom Token para o AUTH EMULATOR (alg none; o emulador aceita tokens não assinados). */
export function mintEmulatorCustomToken(uid) {
  const header = b64u(JSON.stringify({ alg: "none", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64u(JSON.stringify({
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iss: "synth-backend@demo-agenda-id-seven-f43c4c.local",
    sub: "synth-backend@demo-agenda-id-seven-f43c4c.local",
    iat: now, exp: now + 3600, uid,
  }));
  return `${header}.${payload}.`;
}

/**
 * Cria o backend sintético EM PROCESSO (os testes controlam `users` diretamente —
 * nenhum endpoint de controle extra além dos 3 contratos).
 */
export function createSynthBackend() {
  // Usuários FICTÍCIOS. Senha no esquema "s2:"+sha256(salt|senha) — sintético.
  const users = new Map([
    ["U1", { name: "Alice Sintética", role: "designer", status: "ativo", salt: "s1", pass: "s2:" + sha256Hex("s1|senha-um"), sessionVersion: 1 }],
    ["U2", { name: "Bruno Sintético", role: "social", status: "ativo", salt: "s2", pass: "s2:" + sha256Hex("s2|senha-dois"), sessionVersion: 1 }],
    ["U3", { name: "Carla Sintética", role: "gestor", status: "ativo", salt: "s3", pass: "s2:" + sha256Hex("s3|senha-tres"), sessionVersion: 1 }],
  ]);
  const calls = { loginUser: 0, issueFirebaseAuthToken: 0, revokeMySession: 0 };
  const logs = [];
  const log = (line) => logs.push(line);

  // Hooks EXCLUSIVOS DE TESTE (simulação de ataque/falha; nunca existem no contrato real):
  const testHooks = { overrideTokenUid: null, breakCustomToken: false };

  const server = http.createServer(async (req, res) => {
    const send = (code, obj) => {
      log(`${req.method} ${req.url} -> ${code}`);
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
    const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

    if (req.method !== "POST") return send(405, { ok: false, error: "method_not_allowed" });

    if (req.url === "/loginUser") {
      calls.loginUser++;
      const { identifier, password } = body;
      const entry = [...users.entries()].find(([, u]) => u.name === identifier);
      if (!entry) return send(401, { ok: false, error: "invalid_credentials" });
      const [uid, u] = entry;
      if (u.pass !== "s2:" + sha256Hex(`${u.salt}|${password}`)) return send(401, { ok: false, error: "invalid_credentials" });
      if (u.status !== "ativo") return send(403, { ok: false, error: "user_disabled" });
      const ttl = typeof body.__testTtlMs === "number" ? body.__testTtlMs : 60_000; // TTL de TESTE
      const session = mintSession(uid, u.sessionVersion, ttl);
      return send(200, { ok: true, session, user: { id: uid, name: u.name, role: u.role, admin: false, status: u.status } });
    }

    if (req.url === "/issueFirebaseAuthToken") {
      calls.issueFirebaseAuthToken++;
      const p = verifySession(bearer);
      if (!p) return send(401, { ok: false, error: "invalid_session" });
      if (p.expired) return send(401, { ok: false, error: "invalid_session" });
      // uid SEMPRE da sessão — body.uid/role/admin IGNORADOS por construção.
      const u = users.get(p.uid);
      if (!u) return send(404, { ok: false, error: "not_found" });
      if (u.status !== "ativo") return send(403, { ok: false, error: "user_disabled" });
      if (u.sessionVersion !== p.sv) return send(403, { ok: false, error: "session_revoked" });
      const uidForToken = testHooks.overrideTokenUid || p.uid; // hook de ATAQUE simulado (teste 10)
      const firebaseToken = testHooks.breakCustomToken ? "not-a-valid-custom-token" : mintEmulatorCustomToken(uidForToken);
      return send(200, { ok: true, uid: p.uid, firebaseToken, expiresInSec: 3600 });
    }

    if (req.url === "/revokeMySession") {
      calls.revokeMySession++;
      const p = verifySession(bearer);
      if (!p || p.expired) return send(401, { ok: false, error: "invalid_session" });
      const u = users.get(p.uid);
      if (!u) return send(404, { ok: false, error: "not_found" });
      u.sessionVersion += 1; // toda sessão anterior fica inválida (sv divergente)
      return send(200, { ok: true, revoked: true });
    }

    return send(404, { ok: false, error: "not_found" });
  });

  return {
    users, calls, logs, testHooks,
    listen: (port) => new Promise((r) => server.listen(port, "127.0.0.1", () => r(`http://127.0.0.1:${server.address().port}`))),
    close: () => new Promise((r) => server.close(() => r())),
  };
}
