/* ════════════════════════════════════════════════════════════════════════
   FASE 4.4-A4-rev2 — EQUIVALÊNCIA EM FORMA DE BUNDLE: repro-V64.53 × V64.55 (artefato de deploy)
   ════════════════════════════════════════════════════════════════════════
   Executa AS DUAS versões reais do worker (V64.53 extraída de origin/worker/v64-42-team-adjust-idem-cleanup e
   V64.54 = HEAD) contra os MESMOS cenários, com rede stubada idêntica, e
   compara as respostas byte a byte (única diferença tolerada: string de
   versão no GET /). Prova:
   1. SEM env SLA_*: V64.7 responde IDÊNTICO ao V64.5 em todas as rotas;
   2. /sla-dryrun: 403 sem SLA_ENGINE_ENABLED (nas duas? na V64.5 é 404→relay);
   3. com SLA_ENGINE_ENABLED e SEM SLA_WRITE: read-only (0 escritas SLA);
   4. SEM SLA_ACTIVATED_AT: 0 eventos elegíveis;
   5. /sla-dryrun nunca chama FCM.
   Pré: git show origin/worker/v64-42-team-adjust-idem-cleanup:cloudflare-worker.js > /tmp/worker-PROD-v6453.mjs
   Uso: node scripts/sla-fase44a3-equivalencia.mjs
   ════════════════════════════════════════════════════════════════════════ */
import { copyFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import path from "node:path";

const NEW_SRC = path.resolve(import.meta.dirname, "..", "cloudflare-worker.js");
copyFileSync("/tmp/worker-v655-bundle.js", "/tmp/worker-NEW-v654.mjs");  // FORMA BUNDLE (igual ao editor)
const NEW = (await import(pathToFileURL("/tmp/worker-NEW-v654.mjs").href));
const OLD = (await import(pathToFileURL("/tmp/worker-PROD-v6453.mjs").href));
const S = NEW.__slaCore;

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" });
/* env de PRODUÇÃO simulada: SEM nenhuma var SLA_* (estado real do painel) */
const prodEnv = { ALLOWED_ORIGIN: "https://agendaidseven.com.br", FCM_PROJECT_ID: "p", FCM_CLIENT_EMAIL: "sa@p", FCM_PRIVATE_KEY: PEM, IMAGEKIT_PRIVATE_KEY: "ik-test", APP_TZ_OFFSET_MINUTES: "-180" };

/* fixtures estáveis p/ as rotas legadas */
const now = Date.now(), MIN = 60000;
const TASK = { id: "TT1", title: "Tarefa Teste", client: "C1", assigneeId: "U1", ownerId: "U1",
  dueDate: "2099-01-01", dueTime: "10:00", createdAt: now - 5 * MIN, src: "nativebeta",
  designerAssignment: { designerId: "U1", assignedAt: now - 5 * MIN } };
const USER = { name: "User Um", fcmTokens: ["tok-A"], fcmTokenMeta: { "tok-A": { deviceId: "dev1", lastSeenAt: now } } };
function makeStub() {
  const calls = { fcm: 0, writes: [], log: [] };
  const stub = async (url, init) => {
    url = String(url); const method = (init && init.method) || "GET";
    calls.log.push(method + " " + url.slice(0, 110));
    if (url.includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "tk", expires_in: 3600 }), { status: 200 });
    if (url.includes("fcm.googleapis.com")) { calls.fcm++; return new Response("{}", { status: 200 }); }
    if (url.includes("documents:runQuery")) return new Response(JSON.stringify([{ document: { name: "p/d/documents/tasks/TT1", fields: S.slaEncodeFields(TASK) } }]), { status: 200 });
    if (method === "GET" && url.includes("/documents/tasks/TT1")) return new Response(JSON.stringify({ fields: S.slaEncodeFields(TASK) }), { status: 200 });
    if (method === "GET" && url.includes("/documents/users/U1")) return new Response(JSON.stringify({ fields: S.slaEncodeFields(USER) }), { status: 200 });
    if (method === "GET") return new Response("{}", { status: 404 });
    calls.writes.push(method + " " + url.slice(0, 110));
    return new Response("{}", { status: 200 });
  };
  return { stub, calls };
}
const req = (m, p, b) => new Request("https://idseven-push.x" + p, { method: m, headers: { "Content-Type": "application/json" }, body: m === "POST" ? JSON.stringify(b || {}) : undefined });
async function call(workerMod, m, p, b, env) {
  const r = await workerMod.default.fetch(req(m, p, b), env || prodEnv, { waitUntil: () => {} });
  return { status: r.status, body: await r.text() };
}
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log("  PASS", n); } else { fail++; console.log("  FAIL", n, x !== undefined ? JSON.stringify(x).slice(0, 300) : ""); } };
const norm = (s) => s
  .replace(/V64\.\d+-[a-z-]+/g, "VER")
  .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, "TS")        // timestamps de relatório
  .replace(/"now":\s*\d{13}/g, '"now":TS')
  .replace(/"token":"[0-9a-f-]{36}"/g, '"token":"UUID"')                   // imagekit: token aleatório
  .replace(/"expire":\d{10}/g, '"expire":EXP')
  .replace(/"signature":"[0-9a-f]{40}"/g, '"signature":"HMAC40"');         // assinatura derivada do token

/* ── 1) EQUIVALÊNCIA rota a rota, SEM env SLA_* ── */
console.log("== 1) EQUIVALÊNCIA V64.53 × V64.54 (env de produção, sem vars SLA) ==");
const SUITE = [
  ["GET", "/", null, "status do serviço"],
  ["POST", "/cron-test", {}, "cron dry-run (lembretes)"],
  ["POST", "/notify-assignee", { collection: "tasks", id: "TT1" }, "push imediato ao responsável"],
  ["POST", "/notify-designer", { id: "TT1" }, "push premium ao designer"],
  ["POST", "/", { tokens: ["tok-A"], title: "t", body: "b" }, "push relay"],
  ["POST", "/imagekit-auth", { token: "abc", expire: 9999999999 }, "assinatura ImageKit"],
  ["POST", "/sla-dryrun", {}, "rota NOVA (na V64.53 cai no relay; na V64.54 = 403)"],
  ["POST", "/sla-reschedule-plan", { taskId: "TT1" }, "rota NOVA (idem)"],
];
const results = {};
for (const W of [["OLD", OLD], ["NEW", NEW]]) {
  results[W[0]] = [];
  for (const [m, p, b] of SUITE) {
    const { stub, calls } = makeStub(); globalThis.fetch = stub;
    const r = await call(W[1], m, p, b);
    results[W[0]].push({ route: m + " " + p, status: r.status, body: norm(r.body), fcm: calls.fcm, writes: calls.writes.filter((w) => /slaEvents|designerLocks|wipLimits/.test(w)).length });
  }
}
for (let i = 0; i < SUITE.length; i++) {
  const o = results.OLD[i], n = results.NEW[i];
  const isNewRoute = SUITE[i][1].startsWith("/sla-");
  if (!isNewRoute)
    ok(`${o.route} — resposta IDÊNTICA (status ${o.status}) [${SUITE[i][3]}]`, o.status === n.status && o.body === n.body && o.fcm === n.fcm, { old: o, new: n });
  else
    ok(`${n.route} — V64.53: relay genérico (${o.status}); V64.54: 403 bloqueado sem env`, n.status === 403 && /desabilitado/.test(n.body), { old: o.status, new: n.status });
}
ok("nenhuma rota legada gravou em coleções SLA (nas duas versões)", results.OLD.concat(results.NEW).every((r) => r.writes === 0));

/* ── 2) /sla-dryrun read-only mesmo HABILITADO (sem SLA_WRITE / sem SLA_ACTIVATED_AT) ── */
console.log("== 2) V64.54 com SLA_ENGINE_ENABLED=true (cenário do baseline 4.4-A4) ==");
{ const { stub, calls } = makeStub(); globalThis.fetch = stub;
  const env = Object.assign({}, prodEnv, { SLA_ENGINE_ENABLED: "true" });   // ÚNICA var do baseline
  const r = await call(NEW, "POST", "/sla-dryrun", {}, env);
  const j = JSON.parse(r.body);
  ok("responde 200 em modo dry-run", r.status === 200 && j.mode === "dry-run");
  ok("SEM SLA_WRITE: writeAllowed=false e 0 escritas Firestore", j.report.writeAllowed === false && j.report.writes === 0 && calls.writes.length === 0, calls.writes);
  ok("SEM SLA_ACTIVATED_AT: 0 eventos elegíveis (tudo retroIgnored)", j.report.totals.eligibleEvents === 0 && j.report.totals.retroIgnored >= 1, j.report.totals);
  ok("ZERO FCM no /sla-dryrun", calls.fcm === 0);
  ok("relatório de baseline traz WIP observado + totais p/ calibração", !!j.report.wip && !!j.report.totals.byDesigner); }

/* ── 3) cron scheduled: no-op SLA sem env; lembretes intactos ── */
console.log("== 3) scheduled() — paridade do cron ==");
{ for (const W of [["OLD", OLD], ["NEW", NEW]]) {
    const { stub, calls } = makeStub(); globalThis.fetch = stub;
    let bg = []; await W[1].default.scheduled({}, prodEnv, { waitUntil: (p) => bg.push(p) });
    await Promise.all(bg.map((p) => p.catch(() => {})));
    results[W[0] + "_cron"] = { fcm: calls.fcm, slaTouches: calls.log.filter((l) => /slaEvents|designerLocks/.test(l)).length, tarefas: calls.log.filter((l) => l.includes("runQuery")).length };
  }
  ok("cron V64.54 SEM env SLA: mesmas chamadas de rede que V64.53 (zero toque SLA)",
    JSON.stringify(results.OLD_cron) === JSON.stringify(results.NEW_cron) && results.NEW_cron.slaTouches === 0, { old: results.OLD_cron, new: results.NEW_cron }); }

console.log(`\nRESULTADO EQUIVALÊNCIA 4.4-A3: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
