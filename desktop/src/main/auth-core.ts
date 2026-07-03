/**
 * F3.3.56-G2 — AUTH SERVER-SIDE do Desktop (núcleo PURO, sem Electron).
 * Fala com os endpoints já provados em produção (loginUser / getUserSelf /
 * changePassword). O TOKEN DE SESSÃO vive SOMENTE aqui (processo main):
 * memória + arquivo restrito em userData/session.json (mode 0600).
 * O token NUNCA é retornado ao renderer, NUNCA é logado, NUNCA vai a
 * localStorage. As URLs default são as de produção; os overrides via
 * opts.urls existem SOMENTE para os testes herméticos (mock local).
 * Zero dependência de Firestore/users: com "users read" fechado nas Rules,
 * login/restore/troca de senha continuam funcionando por aqui.
 */
import fs from "fs";
import path from "path";

export type AuthUser = {
  id: string; name: string; role: string; admin: boolean;
  status: string; photo: string; color: string;
};
export type AuthResult = {
  ok: boolean; error?: string; user?: AuthUser; self?: unknown;
  active?: boolean; expiresAt?: number;
};
type Session = { token: string; expiresAt: number; uid: string };
type Urls = { login: string; self: string; changePassword: string };

const DEFAULT_URLS: Urls = {
  login: "https://loginuser-de36pi7vza-uc.a.run.app",
  self: "https://getuserself-de36pi7vza-uc.a.run.app",
  changePassword: "https://changepassword-de36pi7vza-uc.a.run.app",
};
const HTTP_TIMEOUT_MS = 15000;
const EXP_SAFETY_MS = 30000;          // folga p/ não expirar "em voo"
const FALLBACK_TTL_MS = 6 * 3600 * 1000; // se o endpoint não mandar expiresAt

export function createAuthCore(opts: { storeDir: string; urls?: Partial<Urls> }) {
  const urls: Urls = { ...DEFAULT_URLS };
  if (opts.urls) {
    for (const k of Object.keys(DEFAULT_URLS) as (keyof Urls)[]) {
      const v = opts.urls[k];
      if (typeof v === "string" && v) urls[k] = v;
    }
  }
  const storeFile = path.join(opts.storeDir, "session.json");
  let mem: Session | null = null;

  function persist(): void {
    try {
      fs.mkdirSync(opts.storeDir, { recursive: true });
      fs.writeFileSync(storeFile, JSON.stringify(mem || {}), { mode: 0o600 });
    } catch { /* best-effort: sessão só em memória se o disco falhar */ }
  }
  function wipe(): void {
    mem = null;
    try { fs.rmSync(storeFile, { force: true }); } catch { /* */ }
  }
  function load(): void {
    try {
      const j = JSON.parse(fs.readFileSync(storeFile, "utf8"));
      if (j && typeof j.token === "string" && j.token && typeof j.expiresAt === "number") {
        mem = { token: j.token, expiresAt: j.expiresAt, uid: String(j.uid || "") };
      }
    } catch { /* sem sessão salva */ }
  }
  // exp JWT vem em SEGUNDOS; normaliza para ms.
  function normExp(e: unknown): number {
    const n = typeof e === "number" && isFinite(e) ? e : 0;
    return n > 0 && n < 1e12 ? n * 1000 : n;
  }
  function valid(): boolean {
    return !!(mem && mem.token && mem.expiresAt > Date.now() + EXP_SAFETY_MS);
  }

  async function post(url: string, body: unknown, token?: string): Promise<{ status: number; json: any }> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), HTTP_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = "Bearer " + token;
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body || {}), signal: ctl.signal });
      let j: any = null;
      try { j = await r.json(); } catch { /* corpo não-JSON */ }
      return { status: r.status, json: j };
    } finally { clearTimeout(t); }
  }

  load();

  return {
    /** Login via endpoint loginUser (email OU telefone). Retorna user público; token fica confinado. */
    async login(identifier: string, password: string): Promise<AuthResult> {
      const id = String(identifier || "").trim();
      const pw = String(password || "");
      if (!id || !pw) return { ok: false, error: "bad_request" };
      let r;
      try { r = await post(urls.login, { identifier: id, password: pw }); }
      catch { return { ok: false, error: "network" }; }
      const j = r.json || {};
      if (r.status === 200 && j.ok === true && j.session && typeof j.session.token === "string" &&
          j.session.token && j.user && j.user.id) {
        mem = {
          token: j.session.token,
          expiresAt: normExp(j.session.expiresAt) || (Date.now() + FALLBACK_TTL_MS),
          uid: String(j.user.id),
        };
        persist();
        return { ok: true, user: j.user as AuthUser }; // token NUNCA sai daqui
      }
      return { ok: false, error: (j && j.error) || ("http_" + r.status) };
    },
    /** Restore/perfil via getUserSelf. 401 => sessão expirada (limpa). Rede fora NÃO derruba a sessão. */
    async self(): Promise<AuthResult> {
      if (!valid()) { if (mem) wipe(); return { ok: false, error: "no_session" }; }
      let r;
      try { r = await post(urls.self, {}, (mem as Session).token); }
      catch { return { ok: false, error: "network" }; }
      const j = r.json || {};
      if (r.status === 200 && j.ok === true && j.self && j.self.id) return { ok: true, self: j.self };
      if (r.status === 401) { wipe(); return { ok: false, error: "expired" }; }
      return { ok: false, error: (j && j.error) || ("http_" + r.status) };
    },
    /** Troca de senha via endpoint (valida a senha atual NO SERVIDOR). */
    async changePassword(oldPassword: string, newPassword: string): Promise<AuthResult> {
      if (!valid()) return { ok: false, error: "no_session" };
      let r;
      try {
        r = await post(urls.changePassword,
          { oldPassword: String(oldPassword || ""), newPassword: String(newPassword || "") },
          (mem as Session).token);
      } catch { return { ok: false, error: "network" }; }
      const j = r.json || {};
      if (r.status === 200 && j.ok === true) return { ok: true };
      if (r.status === 401 && (j && j.error) === "unauthorized") { wipe(); return { ok: false, error: "expired" }; }
      return { ok: false, error: (j && j.error) || ("http_" + r.status) };
    },
    /** Logout seguro: limpa memória e o arquivo de sessão. */
    logout(): AuthResult { wipe(); return { ok: true }; },
    /** Status sem expor o token (só booleano + expiresAt). */
    status(): AuthResult { return { ok: true, active: valid(), expiresAt: mem ? mem.expiresAt : 0 }; },
    /** SOMENTE para testes herméticos (nunca chamado pelo app). */
    _testHasToken(): boolean { return !!(mem && mem.token); },
  };
}
