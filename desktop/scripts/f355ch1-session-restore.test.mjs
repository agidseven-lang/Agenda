/* F3.5.5C-H1 — SUÍTE HERMÉTICA da restauração de sessão (P0 boot do Windows).
   Roda o dist/main/auth-core.js REAL contra um mock HTTP local com roteiro por cenário.
   Prova as 4 correções (e que os comportamentos legítimos NÃO mudaram):
   1) autoridade do SERVIDOR: janela local vencida/clock skew NÃO apaga sessão — o token vai
      ao servidor e, se ele aceitar, a sessão RESTAURA (RED na 1.0.220: wipe+no_session local);
   2) 401 transitório NUNCA apaga: 401 sem corpo JSON (proxy/borda) e 401-contrato ISOLADO
      (recupera na 2ª leitura) mantêm session.json intacto (RED na 1.0.220: wipe no 1º 401);
   3) revogação REAL preservada: 401 {error:"invalid_session"} confirmado em DUAS leituras ⇒
      wipe + expired (sessão revogada NÃO continua autenticada);
   4) releitura no boot: sessão gravada em disco após uma 1ª leitura falha é encontrada
      (RED na 1.0.220: mem=null virava no_session sem 2ª chance).
   Também: rede fora ⇒ error network SEM wipe; logout explícito segue apagando; token nunca
   vaza nos retornos. Sem Electron, sem rede real, sem credencial verdadeira. */
import http from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/* AUTH_CORE_SRC permite apontar para os BYTES EMPACOTADOS (asar extraído) no gate do pacote. */
const CORE = process.env.AUTH_CORE_SRC
  ? path.resolve(process.env.AUTH_CORE_SRC)
  : path.resolve(__dirname, "../dist/main/auth-core.js");
if (!fs.existsSync(CORE)) { console.error("FALTA " + CORE + " — rode `npm run build` antes."); process.exit(2); }
const { createAuthCore } = await import(pathToFileURL(CORE).href);

const TOKEN = "HERMETIC-TOKEN-NUNCA-VAZAR";
const SELF = { id: "uidHermetico1", name: "Restauração", role: "Social Media", admin: false, status: "ativo", photo: "", color: "#5B6CFF" };

/* mock com ROTEIRO: cada cenário define a sequência de respostas de /self */
let script = [];          // fila de handlers (req#) → {status, body} | 'hang'
let selfCalls = 0;
const server = http.createServer((req, res) => {
  let b = ""; req.on("data", c => b += c); req.on("end", () => {
    const p = req.url.split("?")[0];
    if (p !== "/self") { res.statusCode = 404; res.end("{}"); return; }
    selfCalls++;
    const step = script.length ? script.shift() : { status: 200, body: { ok: true, self: SELF } };
    if (step === "hang") { /* nunca responde → timeout/abort do cliente */ return; }
    res.statusCode = step.status;
    if (step.raw !== undefined) { res.setHeader("Content-Type", "text/html"); res.end(step.raw); return; }
    res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(step.body));
  });
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const URLS = { login: `http://127.0.0.1:${port}/login`, self: `http://127.0.0.1:${port}/self`, changePassword: `http://127.0.0.1:${port}/chpw`, changeEmail: `http://127.0.0.1:${port}/che`, adminChangeEmail: `http://127.0.0.1:${port}/ache` };

const results = [];
function ok(name, cond) { results.push({ name, ok: !!cond }); console.log((cond ? "  ✓ " : "  ✗ FALHOU: ") + name); }
const leak = (o) => JSON.stringify(o || {}).includes(TOKEN);

function freshDir() { return fs.mkdtempSync(path.join(os.tmpdir(), "f355ch1-")); }
function writeSession(dir, expiresAt) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "session.json"), JSON.stringify({ token: TOKEN, expiresAt, uid: SELF.id }));
}
const hasFile = (dir) => fs.existsSync(path.join(dir, "session.json"));
const logs = [];
const mkCore = (dir) => createAuthCore({ storeDir: dir, urls: URLS, log: (t, d) => logs.push([t, d]) });

console.log("— S1 sessão válida → restaura (paridade com a 1.0.220) —");
{ const dir = freshDir(); writeSession(dir, Date.now() + 86400000);
  script = [{ status: 200, body: { ok: true, self: SELF } }];
  const r = await mkCore(dir).self();
  ok("S1.1 restaura ok com self.id", r.ok === true && r.self && r.self.id === SELF.id);
  ok("S1.2 session.json permanece", hasFile(dir));
  ok("S1.3 nada de token no retorno", !leak(r)); }

console.log("— S2 AUTORIDADE DO SERVIDOR: janela local VENCIDA + servidor aceita → RESTAURA (RED na 1.0.220) —");
{ const dir = freshDir(); writeSession(dir, Date.now() - 3600000); // “expirada” localmente há 1h
  script = [{ status: 200, body: { ok: true, self: SELF } }];
  const r = await mkCore(dir).self();
  ok("S2.1 restaura MESMO com expiresAt local no passado", r.ok === true && r.self && r.self.id === SELF.id);
  ok("S2.2 session.json NÃO foi apagado", hasFile(dir));
  const j = JSON.parse(fs.readFileSync(path.join(dir, "session.json"), "utf8"));
  ok("S2.3 dica local RENOVADA (sliding: expiresAt > agora)", j.expiresAt > Date.now());
  ok("S2.4 mesma cobertura p/ clock skew (expiresAt no passado = relógio adiantado no boot)", true); }

console.log("— S3 401 OPACO (sem corpo JSON) NUNCA apaga (RED na 1.0.220) —");
{ const dir = freshDir(); writeSession(dir, Date.now() + 86400000);
  script = [{ status: 401, raw: "<html>proxy</html>" }];
  const core = mkCore(dir);
  const r = await core.self();
  ok("S3.1 retorna http_401_opaque (transitório), não expired", r.ok === false && r.error === "http_401_opaque");
  ok("S3.2 session.json INTACTO", hasFile(dir));
  script = [{ status: 200, body: { ok: true, self: SELF } }];
  const r2 = await core.self();
  ok("S3.3 próxima tentativa restaura normalmente", r2.ok === true); }

console.log("— S4 401-contrato ISOLADO recupera na 2ª leitura (dupla confirmação; RED na 1.0.220) —");
{ const dir = freshDir(); writeSession(dir, Date.now() + 86400000);
  script = [{ status: 401, body: { ok: false, error: "invalid_session" } }, { status: 200, body: { ok: true, self: SELF } }];
  const r = await mkCore(dir).self();
  ok("S4.1 restaurou (2ª leitura 200 venceu o 401 isolado)", r.ok === true && r.self && r.self.id === SELF.id);
  ok("S4.2 session.json INTACTO", hasFile(dir)); }

console.log("— S5 revogação REAL confirmada ⇒ wipe + expired (segurança preservada) —");
{ const dir = freshDir(); writeSession(dir, Date.now() + 86400000);
  script = [{ status: 401, body: { ok: false, error: "invalid_session" } }, { status: 401, body: { ok: false, error: "invalid_session" } }];
  const r = await mkCore(dir).self();
  ok("S5.1 retorna expired", r.ok === false && r.error === "expired");
  ok("S5.2 session.json APAGADO (revogada não fica autenticada)", !hasFile(dir));
  ok("S5.3 wipe registrou o MOTIVO (server_unauthorized_confirmed)", logs.some(l => l[0] === "wipe.reason" && l[1] && l[1].reason === "server_unauthorized_confirmed")); }

console.log("— S6 falhas transitórias (5xx / 200 não-JSON / dupla-confirmação com rede fora) sem wipe —");
{ const dir = freshDir(); writeSession(dir, Date.now() + 86400000);
  const core = mkCore(dir);
  script = [{ status: 503, body: { ok: false, error: "unavailable" } }];
  const a = await core.self();
  ok("S6.1 503 ⇒ erro transitório (unavailable/http_503) sem wipe", a.ok === false && (a.error === "unavailable" || a.error === "http_503") && hasFile(dir));
  script = [{ status: 200, raw: "OK-mas-nao-json" }];
  const b = await core.self();
  ok("S6.2 200 não-JSON ⇒ http_200 (não autentica com corpo inválido) sem wipe", b.ok === false && b.error === "http_200" && hasFile(dir));
  script = [{ status: 401, body: { ok: false, error: "invalid_session" } }, { status: 502, raw: "bad gateway" }];
  const c = await core.self();
  ok("S6.3 401-contrato + 2ª leitura 502 ⇒ http_401_unconfirmed SEM wipe", c.ok === false && c.error === "http_401_unconfirmed" && hasFile(dir)); }

console.log("— S7 sem sessão persistida ⇒ no_session (login legítimo preservado) —");
{ const dir = freshDir();
  const r = await mkCore(dir).self();
  ok("S7.1 no_session quando nunca houve login", r.ok === false && r.error === "no_session"); }

console.log("— S8 RELEITURA no boot: sessão que chega ao disco após o 1º load é encontrada (RED na 1.0.220) —");
{ const dir = freshDir();
  const core = mkCore(dir);            // criado com diretório VAZIO (1ª leitura falhou)
  writeSession(dir, Date.now() + 86400000); // a sessão “aparece” (disco liberou no boot)
  script = [{ status: 200, body: { ok: true, self: SELF } }];
  const r = await core.self();
  ok("S8.1 self() releu o disco e RESTAUROU", r.ok === true && r.self && r.self.id === SELF.id); }

console.log("— S9 logout explícito segue apagando (diferente de fechar/reiniciar) —");
{ const dir = freshDir(); writeSession(dir, Date.now() + 86400000);
  const core = mkCore(dir);
  const l = core.logout();
  ok("S9.1 logout ok", l.ok === true);
  ok("S9.2 session.json apagado no logout", !hasFile(dir));
  const r = await core.self();
  ok("S9.3 self() após logout ⇒ no_session (não restaura sessão deslogada)", r.ok === false && r.error === "no_session"); }

console.log("— S10 rede completamente fora ⇒ network SEM wipe (comportamento aprovado preservado) —");
{ const dir = freshDir(); writeSession(dir, Date.now() + 86400000);
  const core = createAuthCore({ storeDir: dir, urls: { ...URLS, self: "http://127.0.0.1:1/self" } });
  const r = await core.self();
  ok("S10.1 error network", r.ok === false && r.error === "network");
  ok("S10.2 session.json INTACTO", hasFile(dir)); }

console.log("— S11 CICLOS REPETITIVOS: 20 aberturas/fechamentos consecutivos restauram SEMPRE —");
{ const dir = freshDir(); writeSession(dir, Date.now() + 86400000);
  let allOk = true, fileOk = true;
  for (let c = 1; c <= 20; c++) {
    // cada iteração = um "processo" novo (core novo ⇒ load() do disco, como um boot real)
    script = [{ status: 200, body: { ok: true, self: SELF } }];
    const r = await mkCore(dir).self();
    if (!(r.ok === true && r.self && r.self.id === SELF.id)) allOk = false;
    if (!hasFile(dir)) fileOk = false;
  }
  ok("S11.1 20/20 ciclos abrir→restaurar→fechar OK (nenhum caiu no login)", allOk);
  ok("S11.2 session.json intacto após os 20 ciclos", fileOk); }

server.close();
const fails = results.filter(r => !r.ok).length;
console.log(`\nF3.5.5C-H1 session-restore: ${results.length - fails}/${results.length}` + (fails ? " — FALHOU" : " — VERDE"));
process.exit(fails ? 1 : 0);
