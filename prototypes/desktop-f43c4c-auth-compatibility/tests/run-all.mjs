// =====================================================================
// F4.3C4C — Runner dos 40 testes OBRIGATÓRIOS + prova anti-1.0.185.
// Roda DENTRO de `firebase emulators:exec` (Auth + Firestore emuladores).
// Sobe o backend sintético em memória. Sem produção, sem secrets, sem deploy.
// =====================================================================
import {
  makeClient, makeSessionStore, seedDoc, clearFirestore,
  doc, getDoc, setDoc, collection, onSnapshot,
  assertFails, assertSucceeds, makeReporter, waitFor,
} from "./_harness.mjs";
import { DesktopAuthBridge, AuthState } from "../src/auth-bridge.mjs";
import { createSynthBackend, mintSession } from "../src/synth-backend.mjs";

const clients = [];
function client() { const c = makeClient(); clients.push(c); return c; }
function bridge(store, backendUrl, c, log) {
  return new DesktopAuthBridge({ sessionStore: store, backendUrl, authAdapter: c.authAdapter, log });
}

async function main() {
  const backend = createSynthBackend();
  const backendUrl = await backend.listen(0);
  const { t, summary } = makeReporter("f43c4c-prototype");

  // Diretório PII-free e uma task de equipe (seed via REST — bypassa Rules, como a trigger real).
  async function seedBaseline() {
    await clearFirestore();
    backend.testHooks.overrideTokenUid = null;
    backend.testHooks.breakCustomToken = false;
    for (const [uid, u] of backend.users) {
      await seedDoc(`usersPublic/${uid}`, { id: uid, name: u.name, role: u.role, admin: false, status: u.status });
      await seedDoc(`users/${uid}`, { name: u.name, role: u.role, status: u.status, pass: "s2:SECRET", salt: u.salt });
    }
    await seedDoc("tasks/T1", { title: "Tarefa", by: "U1", status: "afazer", createdAt: 1, src: "nativebeta" });
    await seedDoc("events/E1", { title: "Evento", by: "U1", ownerId: "U1", date: "2026-08-01", createdAt: 1, src: "webpreview" });
  }
  // login sintético completo -> Bridge Authenticated
  async function loginAuthenticated(c, name, password) {
    const res = await fetch(`${backendUrl}/loginUser`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: name, password }) });
    const j = await res.json();
    const store = makeSessionStore({ uid: j.user.id, token: j.session.token, expiresAt: j.session.expiresAt });
    const br = bridge(store, backendUrl, c);
    const st = await br.ensureAuthenticated();
    return { store, br, st, uid: j.user.id };
  }

  // ============ AUTENTICAÇÃO (1..12) ============
  await seedBaseline();

  await t("A1", "nenhum acesso ao Firestore ANTES do login (Bridge Idle; usersPublic DENY sem auth)", async () => {
    const c = client();
    const br = bridge(makeSessionStore(null), backendUrl, c);
    if (br.authState() !== AuthState.Idle) throw new Error(`estado inicial=${br.authState()} (esperado Idle)`);
    await assertFails(getDoc(doc(c.db, "usersPublic/U1")), "leitura anônima");
  });
  await t("A2", "login explícito válido -> Authenticated + currentUid casa", async () => {
    const c = client();
    const { br, st, uid } = await loginAuthenticated(c, "Alice Sintética", "senha-um");
    if (st !== AuthState.Authenticated) throw new Error(`estado=${st}`);
    if (br.currentUid() !== uid) throw new Error(`currentUid=${br.currentUid()} != ${uid}`);
  });
  await t("A3", "login inválido (senha errada) -> SessionMissing (sem sessão emitida)", async () => {
    const res = await fetch(`${backendUrl}/loginUser`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "Alice Sintética", password: "errada" }) });
    if (res.status !== 401) throw new Error(`login errado status=${res.status}`);
    const c = client();
    const br = bridge(makeSessionStore(null), backendUrl, c);
    if (await br.ensureAuthenticated() !== AuthState.SessionMissing) throw new Error("esperava SessionMissing");
  });
  await t("A4", "sessão ausente -> SessionMissing (fail-closed)", async () => {
    const c = client();
    const br = bridge(makeSessionStore(null), backendUrl, c);
    if (await br.ensureAuthenticated() !== AuthState.SessionMissing) throw new Error("!=SessionMissing");
  });
  await t("A5", "sessão expirada (local) -> SessionExpired, sem chamar o backend", async () => {
    const c = client();
    const store = makeSessionStore({ uid: "U1", token: mintSession("U1", 1, -1000).token, expiresAt: Date.now() - 1000 });
    const before = backend.calls.issueFirebaseAuthToken;
    if (await bridge(store, backendUrl, c).ensureAuthenticated() !== AuthState.SessionExpired) throw new Error("!=SessionExpired");
    if (backend.calls.issueFirebaseAuthToken !== before) throw new Error("nao deveria chamar o backend com sessao expirada local");
  });
  await t("A6", "sessão revogada (sessionVersion divergente) -> SessionRevoked", async () => {
    const c = client();
    // sessão com sv=99 (nunca emitida); backend responde 403 session_revoked
    const store = makeSessionStore({ uid: "U1", token: mintSession("U1", 99, 60_000).token, expiresAt: Date.now() + 60_000 });
    if (await bridge(store, backendUrl, c).ensureAuthenticated() !== AuthState.SessionRevoked) throw new Error("!=SessionRevoked");
  });
  await t("A7", "usuário inativo -> SessionRevoked (403 do backend; bloqueado)", async () => {
    backend.users.get("U2").status = "inativo";
    const c = client();
    const store = makeSessionStore({ uid: "U2", token: mintSession("U2", 1, 60_000).token, expiresAt: Date.now() + 60_000 });
    const st = await bridge(store, backendUrl, c).ensureAuthenticated();
    backend.users.get("U2").status = "ativo";
    if (st !== AuthState.SessionRevoked) throw new Error(`estado=${st}`);
  });
  await t("A8", "Custom Token inválido -> FirebaseAuthFailure (signInWithCustomToken rejeita)", async () => {
    backend.testHooks.breakCustomToken = true;
    const c = client();
    const store = makeSessionStore({ uid: "U1", token: mintSession("U1", 1, 60_000).token, expiresAt: Date.now() + 60_000 });
    const st = await bridge(store, backendUrl, c).ensureAuthenticated();
    backend.testHooks.breakCustomToken = false;
    if (st !== AuthState.FirebaseAuthFailure) throw new Error(`estado=${st}`);
    if (c.authAdapter.currentUid() !== null) throw new Error("nao deveria ter sessao Firebase apos falha");
  });
  await t("A9", "Firebase Auth falha (token do backend malformado) NÃO libera Firestore", async () => {
    backend.testHooks.breakCustomToken = true;
    const c = client();
    const store = makeSessionStore({ uid: "U1", token: mintSession("U1", 1, 60_000).token, expiresAt: Date.now() + 60_000 });
    await bridge(store, backendUrl, c).ensureAuthenticated();
    backend.testHooks.breakCustomToken = false;
    await assertFails(getDoc(doc(c.db, "usersPublic/U1")), "acesso pos-falha");
  });
  await t("A10", "uid mismatch (backend cunha token de OUTRO uid) -> UidMismatch + signOut", async () => {
    backend.testHooks.overrideTokenUid = "U3";      // sessão é U1, token vira U3
    const c = client();
    const store = makeSessionStore({ uid: "U1", token: mintSession("U1", 1, 60_000).token, expiresAt: Date.now() + 60_000 });
    const st = await bridge(store, backendUrl, c).ensureAuthenticated();
    backend.testHooks.overrideTokenUid = null;
    if (st !== AuthState.UidMismatch) throw new Error(`estado=${st}`);
    if (c.authAdapter.currentUid() !== null) throw new Error("deveria ter feito signOut apos mismatch");
  });
  await t("A11", "campos uid/role/admin enviados pelo cliente são IGNORADOS (uid vem da sessão)", async () => {
    const c = client();
    const store = makeSessionStore({ uid: "U1", token: mintSession("U1", 1, 60_000).token, expiresAt: Date.now() + 60_000 });
    // body com uid/admin forjados vai direto ao backend; ele deriva o uid da sessão.
    const res = await fetch(`${backendUrl}/issueFirebaseAuthToken`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${store.load().token}` }, body: JSON.stringify({ uid: "U3", role: "gestor", admin: true }) });
    const j = await res.json();
    if (j.uid !== "U1") throw new Error(`uid retornado=${j.uid} (esperado U1 — body ignorado)`);
    const fbUid = await c.authAdapter.signInWithCustomToken(j.firebaseToken);
    if (fbUid !== "U1") throw new Error(`uid do Firebase=${fbUid} (body forjado nao pode mudar a identidade)`);
  });
  await t("A12", "autenticação NÃO inicia automaticamente (construtor sem side effects)", async () => {
    const c = client();
    const before = backend.calls.issueFirebaseAuthToken;
    const store = makeSessionStore({ uid: "U1", token: mintSession("U1", 1, 60_000).token, expiresAt: Date.now() + 60_000 });
    const br = bridge(store, backendUrl, c);       // NÃO chamamos ensureAuthenticated
    await new Promise((r) => setTimeout(r, 120));
    if (br.authState() !== AuthState.Idle) throw new Error(`estado=${br.authState()} (deveria continuar Idle)`);
    if (backend.calls.issueFirebaseAuthToken !== before) throw new Error("backend chamado sem ensureAuthenticated (auth silenciosa!)");
    if (c.authAdapter.currentUid() !== null) throw new Error("Firebase autenticou sozinho (proibido)");
  });

  // ============ FIRESTORE (13..22) ============
  await t("F13", "autenticado LÊ usersPublic (ALLOW)", async () => {
    const c = client();
    await loginAuthenticated(c, "Alice Sintética", "senha-um");
    await assertSucceeds(getDoc(doc(c.db, "usersPublic/U2")), "read usersPublic");
  });
  await t("F14", "anônimo NÃO lê usersPublic sob as Rules-alvo (DENY)", async () => {
    const c = client();
    await assertFails(getDoc(doc(c.db, "usersPublic/U1")), "read anon usersPublic");
  });
  await t("F15", "autenticado LÊ task permitida (equipe) (ALLOW)", async () => {
    const c = client();
    await loginAuthenticated(c, "Alice Sintética", "senha-um");
    await assertSucceeds(getDoc(doc(c.db, "tasks/T1")), "read task");
  });
  await t("F16", "operação proibida (escrever usersPublic pelo cliente) é NEGADA (DENY)", async () => {
    const c = client();
    await loginAuthenticated(c, "Alice Sintética", "senha-um");
    await assertFails(setDoc(doc(c.db, "usersPublic/U1"), { name: "hack" }), "write usersPublic");
  });
  await t("F17", "autenticado LÊ event permitido (equipe) (ALLOW)", async () => {
    const c = client();
    await loginAuthenticated(c, "Alice Sintética", "senha-um");
    await assertSucceeds(getDoc(doc(c.db, "events/E1")), "read event");
  });
  await t("F18", "acesso APÓS logout é NEGADO (DENY)", async () => {
    const c = client();
    const { br } = await loginAuthenticated(c, "Alice Sintética", "senha-um");
    await br.logout();
    await assertFails(getDoc(doc(c.db, "usersPublic/U1")), "read pos-logout");
  });
  await t("F19", "listener de tasks INICIA após Authenticated e recebe dados", async () => {
    const c = client();
    const { br } = await loginAuthenticated(c, "Alice Sintética", "senha-um");
    let seen = 0, errored = false;
    const unsub = br.trackListener(onSnapshot(collection(c.db, "tasks"), (s) => { seen = s.size; }, () => { errored = true; }));
    const ok = await waitFor(() => seen >= 1 || errored);
    unsub();
    if (!ok || errored || seen < 1) throw new Error(`listener nao entregou (seen=${seen} err=${errored})`);
  });
  await t("F20", "listener é ENCERRADO no logout (contador zera; sem novos dados)", async () => {
    const c = client();
    const { br } = await loginAuthenticated(c, "Alice Sintética", "senha-um");
    br.trackListener(onSnapshot(collection(c.db, "tasks"), () => {}, () => {}));
    if (br.activeListeners() !== 1) throw new Error("deveria ter 1 listener ativo");
    await br.logout();
    if (br.activeListeners() !== 0) throw new Error("logout nao encerrou o listener");
  });
  await t("F21", "listener anterior NÃO sobrevive à troca de usuário", async () => {
    const c = client();
    const { br } = await loginAuthenticated(c, "Alice Sintética", "senha-um");
    let deliveriesAfterSwitch = 0;
    br.trackListener(onSnapshot(collection(c.db, "tasks"), () => { deliveriesAfterSwitch++; }, () => {}));
    await br.logout();                          // troca de usuário = logout + novo login (nova instância)
    const baseline = deliveriesAfterSwitch;
    const c2 = client();
    await loginAuthenticated(c2, "Bruno Sintético", "senha-dois");
    await seedDoc("tasks/T2", { title: "Nova", by: "U2", status: "afazer", createdAt: 2, src: "nativebeta" });
    await new Promise((r) => setTimeout(r, 300));
    if (br.activeListeners() !== 0) throw new Error("listener antigo continua registrado");
    if (deliveriesAfterSwitch > baseline) throw new Error("listener do usuario anterior ainda recebe dados");
  });
  await t("F22", "NÃO existe fallback para Rules abertas: falha de auth => Firestore negado", async () => {
    backend.testHooks.breakCustomToken = true;
    const c = client();
    const store = makeSessionStore({ uid: "U1", token: mintSession("U1", 1, 60_000).token, expiresAt: Date.now() + 60_000 });
    const br = bridge(store, backendUrl, c);
    await br.ensureAuthenticated();
    backend.testHooks.breakCustomToken = false;
    if (br.authState() === AuthState.Authenticated) throw new Error("nao deveria autenticar");
    await assertFails(getDoc(doc(c.db, "tasks/T1")), "sem fallback aberto");
  });

  // ============ SESSÃO (23..30) ============
  await t("S23", "logout limpa a sessão local (cofre vazio)", async () => {
    const c = client();
    const { br, store } = await loginAuthenticated(c, "Alice Sintética", "senha-um");
    await br.logout();
    if (store.load() !== null) throw new Error("sessao nao foi limpa");
  });
  await t("S24", "logout executa FirebaseAuth.signOut (currentUid nulo)", async () => {
    const c = client();
    const { br } = await loginAuthenticated(c, "Alice Sintética", "senha-um");
    if (c.authAdapter.currentUid() === null) throw new Error("deveria estar autenticado antes do logout");
    await br.logout();
    if (c.authAdapter.currentUid() !== null) throw new Error("signOut nao ocorreu");
  });
  await t("S25", "logout encerra listeners (0 ativos)", async () => {
    const c = client();
    const { br } = await loginAuthenticated(c, "Alice Sintética", "senha-um");
    br.trackListener(onSnapshot(collection(c.db, "events"), () => {}, () => {}));
    await br.logout();
    if (br.activeListeners() !== 0) throw new Error("listeners nao encerrados");
  });
  await t("S26", "troca de usuário limpa o cache/estado (nova instância re-valida do zero)", async () => {
    const c1 = client();
    const a = await loginAuthenticated(c1, "Alice Sintética", "senha-um");
    await a.br.logout();
    const c2 = client();
    const b = await loginAuthenticated(c2, "Bruno Sintético", "senha-dois");
    if (b.br.currentUid() !== "U2") throw new Error(`novo uid=${b.br.currentUid()}`);
    if (a.br.currentUid() !== null) throw new Error("estado do usuario anterior vazou");
  });
  await t("S27", "sessão revogada bloqueia NOVA operação (revokeMySession -> sv++)", async () => {
    const c = client();
    const { br, store } = await loginAuthenticated(c, "Alice Sintética", "senha-um");
    // revoga a sessão atual pelo backend
    await fetch(`${backendUrl}/revokeMySession`, { method: "POST", headers: { authorization: `Bearer ${store.load().token}` } });
    // re-autenticar com a MESMA sessão (sv antigo) agora falha
    const c2 = client();
    const st = await bridge(store, backendUrl, c2).ensureAuthenticated();
    backend.users.get("U1").sessionVersion = 1;   // restaura p/ os demais testes
    if (st !== AuthState.SessionRevoked) throw new Error(`estado=${st}`);
  });
  await t("S28", "nova sessão válida (após revogação) volta a funcionar", async () => {
    const c = client();
    const { br } = await loginAuthenticated(c, "Alice Sintética", "senha-um");
    if (br.authState() !== AuthState.Authenticated) throw new Error(`estado=${br.authState()}`);
  });
  await t("S29", "expiração exige NOVO login (re-login emite nova sessão válida)", async () => {
    const c = client();
    const store = makeSessionStore({ uid: "U1", token: mintSession("U1", 1, 1).token, expiresAt: Date.now() - 1 });
    if (await bridge(store, backendUrl, c).ensureAuthenticated() !== AuthState.SessionExpired) throw new Error("!=SessionExpired");
    const c2 = client();
    const { st } = await loginAuthenticated(c2, "Alice Sintética", "senha-um");
    if (st !== AuthState.Authenticated) throw new Error(`novo login=${st}`);
  });
  await t("S30", "offline NÃO libera acesso anônimo (backendUrl inalcançável -> Offline + DENY)", async () => {
    const c = client();
    const store = makeSessionStore({ uid: "U1", token: mintSession("U1", 1, 60_000).token, expiresAt: Date.now() + 60_000 });
    const br = bridge(store, "http://127.0.0.1:1", c);   // porta morta
    const st = await br.ensureAuthenticated();
    if (st !== AuthState.Offline) throw new Error(`estado=${st}`);
    await assertFails(getDoc(doc(c.db, "usersPublic/U1")), "offline nao abre anon");
  });

  // ============ SEGURANÇA (31..40) ============
  const REPO_ROOT = new URL("../", import.meta.url);
  const fs = await import("node:fs");
  const path = await import("node:path");
  function readAll(dir) {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...readAll(p));
      else if (/\.(mjs|js|json)$/.test(e.name)) out.push([p, fs.readFileSync(p, "utf8")]);
    }
    return out;
  }
  const srcFiles = readAll(path.join(REPO_ROOT.pathname));

  await t("SEC31", "nenhum token aparece em logs do backend", async () => {
    const bad = backend.logs.filter((l) => /Bearer\s+\S|firebaseToken|eyJ/i.test(l));
    if (bad.length) throw new Error(`log com token: ${bad[0]}`);
  });
  await t("SEC32", "nenhum secret de TESTE aparece em log", async () => {
    const bad = backend.logs.filter((l) => l.includes("f43c4c-test-secret"));
    if (bad.length) throw new Error("secret em log");
  });
  await t("SEC33", "nenhum corpo/JSON completo aparece em logs do backend (só metodo+rota+status)", async () => {
    const bad = backend.logs.filter((l) => !/^(GET|POST|PUT|PATCH|DELETE)\s+\S+\s+->\s+\d{3}$/.test(l));
    if (bad.length) throw new Error(`log fora do formato: ${bad[0]}`);
  });
  // Padrões proibidos construídos por CONCATENAÇÃO para que o próprio runner
  // possa ser escaneado sem auto-match (cobertura total, sem arquivo excluído).
  await t("SEC34", "nenhum endpoint de PRODUÇÃO no código do protótipo", async () => {
    const re = new RegExp(["run\\." + "app", "cloudfunctions\\." + "net", "agenda" + "idseven", "firebase" + "io\\.com", "googleapis\\.com\\/.*agenda-" + "id-seven"].join("|"), "i");
    const bad = srcFiles.filter(([, s]) => re.test(s));
    if (bad.length) throw new Error(`endpoint real em ${path.basename(bad[0][0])}`);
  });
  await t("SEC35", "nenhum project ID REAL no código", async () => {
    const re = new RegExp("agenda-" + "id-seven(?!-f43c4c)|agenda-" + "id-sete");
    const bad = srcFiles.filter(([f, s]) => re.test(s) && !f.endsWith("firestore.f43c3-target.rules"));
    if (bad.length) throw new Error(`project real citado em ${path.basename(bad[0][0])}`);
  });
  await t("SEC36", "nenhuma service account real é usada (sem chave privada em nenhum arquivo)", async () => {
    const re = new RegExp(["private" + "_key", "BEGIN " + "PRIVATE KEY", "service" + "Account"].join("|"), "i");
    const bad = srcFiles.filter(([, s]) => re.test(s));
    if (bad.length) throw new Error(`service account em ${path.basename(bad[0][0])}`);
  });
  await t("SEC37", "nenhum dado real é criado (usuários fictícios 'Sintética/Sintético')", async () => {
    for (const [, u] of backend.users) if (!/Sintétic[ao]/.test(u.name)) throw new Error(`usuario nao-sintetico: ${u.name}`);
  });
  await t("SEC38", "Rules-alvo permanecem BYTE-idênticas ao F4.3C3 (SHA-256 pin)", async () => {
    const rulesPath = path.join(REPO_ROOT.pathname, "rules/firestore.f43c3-target.rules");
    const crypto = await import("node:crypto");
    const sha = crypto.createHash("sha256").update(fs.readFileSync(rulesPath)).digest("hex");
    const EXPECT = "3af8c08a25990e112c578662064a4333f466da72ca3ca359ef2c874537341c23";
    if (sha !== EXPECT) throw new Error(`rules SHA=${sha} != ${EXPECT} (nao pode enfraquecer as Rules)`);
  });
  await t("SEC39", "Desktop anônima SIMULADA continua recebendo DENY (sem request.auth em nada real)", async () => {
    const c = client();   // sem login/auth = Desktop 1.0.191 anônima
    await assertFails(getDoc(doc(c.db, "usersPublic/U1")), "desktop anon usersPublic");
    await assertFails(getDoc(doc(c.db, "tasks/T1")), "desktop anon tasks");
    await assertFails(getDoc(doc(c.db, "events/E1")), "desktop anon events");
  });
  await t("SEC40", "protótipo NÃO contém Card Premium / Worker / share-link / OG / tokens de cliente", async () => {
    // termos partidos por concatenação => o próprio runner também é escaneado
    const forbidden = ["cloudflare-" + "worker", "ensureReview" + "Token", "ensureStableClientReview" + "Token", "buildShareClient" + "Url", "buildClient" + "Message", "canSendTo" + "Client", "openSendClient" + "Modal", "/sha" + "re", "og:" + "image", "clientReview" + "Token", "share" + "Token"];
    for (const [f, s] of srcFiles) {
      for (const term of forbidden) if (s.includes(term)) throw new Error(`termo Card Premium '${term}' em ${path.basename(f)}`);
    }
  });

  for (const c of clients) await c.cleanup();
  await backend.close();

  const s = summary();
  console.log(`\nF4.3C4C PROTÓTIPO (emuladores): ${s.ok} OK, ${s.fail} FALHOU (de ${s.ok + s.fail})`);
  if (s.fail) { for (const f of s.failures) console.log("  FALHA: " + f); process.exit(1); }
  process.exit(0);
}
main().catch((e) => { console.error("runner erro fatal:", e); process.exit(1); });
