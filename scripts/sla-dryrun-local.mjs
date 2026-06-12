/* ════════════════════════════════════════════════════════════════════════
   DRY-RUN LOCAL do runSlaEnginePass REAL (FASE 4.3) — rede 100% stubada.
   Prova: (a) modo dry-run = ZERO escritas; (b) gating: write:true SEM flag
   slaEngine continua sem escrever; (c) com SLA_WRITE+flag: cria slaEvents
   com ID=dedupKey e a 2ª passada cai em 409 (dedupSkipped, sem duplicar);
   (d) NENHUMA chamada ao FCM em nenhum modo (push real inexistente na fase).
   Uso: node scripts/sla-dryrun-local.mjs
   ════════════════════════════════════════════════════════════════════════ */
import { copyFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..", "cloudflare-worker.js");
const TMP = "/tmp/idseven-worker-dryrun.mjs";
copyFileSync(SRC, TMP);
const { __slaCore: S } = await import(pathToFileURL(TMP).href);

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" });
const baseEnv = { FCM_PROJECT_ID: "test-project", FCM_CLIENT_EMAIL: "sla@test", FCM_PRIVATE_KEY: PEM, APP_TZ_OFFSET_MINUTES: "-180", SLA_ENGINE_ENABLED: "true", SLA_ACTIVATED_AT: "1" };  /* corte=1ms: tudo elegível p/ estes testes */

/* fixtures relativos a AGORA: 1 atrasada, 1 perto do prazo, 1 ok, 1 entregue,
   +2 em produção do MESMO designer (WIP hard 2 → 3 em produção = excedido) */
const now = Date.now(), MIN = 60000;
/* epoch UTC → "data/hora LOCAL -3" (inverso exato do slaToMs do worker) */
const dstr = (ms) => new Date(ms + (-180) * MIN).toISOString().slice(0, 10);
const tstr = (ms) => new Date(ms + (-180) * MIN).toISOString().slice(11, 16);
const mk = (id, designer, flow, startOff, endOff, extra) => Object.assign({
  id, designerFlowStatus: flow,
  designerAssignment: { designerId: designer, assignedBy: "S1", assignedAt: now - 120 * MIN,
    startDate: dstr(now + startOff), startTime: tstr(now + startOff),
    endDate: dstr(now + endOff), endTime: tstr(now + endOff) },
  startedAt: flow === "afazer" ? null : now - 90 * MIN, doneAt: null }, extra || {});
const FIXTURES = [
  mk("T-ATRASADA", "D1", "andamento", -180 * MIN, -45 * MIN),               // entrega_atrasada → vermelho+lock candidate
  mk("T-PERTO",    "D1", "andamento", -180 * MIN, +20 * MIN),               // entrega_proxima → laranja
  mk("T-OK",       "D2", "andamento", -180 * MIN, +600 * MIN),              // em_producao
  mk("T-FEITA",    "D2", "concluido", -300 * MIN, -60 * MIN, { doneAt: now - 70 * MIN }),
  mk("T-WIP3",     "D1", "andamento", -180 * MIN, +600 * MIN),              // 3º andamento de D1 → WIP excedido
  mk("T-NAOINI",   "D3", "afazer",    -40 * MIN,  +300 * MIN),              // inicio_atrasado >30min → candidato
];

function makeFetchStub(opts) {
  const calls = { fcm: 0, writes: [], created: new Set(opts.preCreated || []) };
  const stub = async (url, init) => {
    url = String(url);
    if (url.includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "stub-token", expires_in: 3600 }), { status: 200 });
    if (url.includes("fcm.googleapis.com")) { calls.fcm++; return new Response("{}", { status: 200 }); }
    if (url.includes("documents/appConfig/flags")) {
      if (!opts.flagsOn) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify({ fields: S.slaEncodeFields({ slaEngine: true }) }), { status: 200 });
    }
    if (url.includes("documents:runQuery")) {
      const body = init && init.body ? String(init.body) : "";
      if (opts.inFails && body.includes('"IN"'))
        return new Response(JSON.stringify({ error: { code: 400, message: "simulated: IN rejected" } }), { status: 400 });
      let rows = opts.legacyFixtures || FIXTURES;
      const eq = body.match(/"fieldPath":"([\w.]+)"\s*\},\s*"op":"EQUAL".*?"stringValue":"([\w-]+)"/s);
      if (eq) rows = rows.filter((t) => String(t[eq[1]] ?? (eq[1].includes(".") ? eq[1].split(".").reduce((o, k) => (o || {})[k], t) : undefined)) === eq[2]);
      return new Response(JSON.stringify(rows.map((t) => ({ document: { name: "projects/x/databases/(default)/documents/tasks/" + t.id, fields: S.slaEncodeFields(t) } }))), { status: 200 });
    }
    if (url.includes("/documents/slaEvents?documentId=")) {
      const id = decodeURIComponent(url.split("documentId=")[1]);
      if (calls.created.has(id)) return new Response(JSON.stringify({ error: { status: "ALREADY_EXISTS" } }), { status: 409 });
      calls.created.add(id); calls.writes.push({ kind: "slaEvent", id });
      return new Response("{}", { status: 200 });
    }
    if ((init && init.method) === "PATCH" && url.includes("/documents/tasks/")) {
      calls.writes.push({ kind: "designerSla", url: url.split("/documents/")[1].split("?")[0] });
      return new Response("{}", { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
  return { stub, calls };
}

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log("  PASS", n); } else { fail++; console.log("  FAIL", n, x !== undefined ? JSON.stringify(x) : ""); } };

console.log("== A) DRY-RUN PURO (default do cron com SLA_ENGINE_ENABLED, sem SLA_WRITE) ==");
{ const { stub, calls } = makeFetchStub({}); globalThis.fetch = stub;
  const r = await S.runSlaEnginePass(baseEnv, {});
  console.log("  relatório:", JSON.stringify({ scanned: r.scanned, writeAllowed: r.writeAllowed, computed: r.computed.map(c => c.taskId + "=" + c.slaStatus + "/" + c.slaSeverity + (c.blockedCandidate ? "+LOCKcand" : "")), eventos: r.events.map(e => e.eventType), wouldNotify: r.wouldNotify.length, wouldLock: r.wouldLock.length, writes: r.writes }, null, 1));
  ok("varreu 6 tarefas, writeAllowed=false", r.scanned === 6 && r.writeAllowed === false);
  ok("ZERO escritas no Firestore", r.writes === 0 && calls.writes.length === 0, calls.writes);
  ok("ZERO chamadas FCM (nenhum push real)", calls.fcm === 0);
  ok("T-ATRASADA → entrega_atrasada vermelho + candidato a bloqueio (só registro)", r.computed.some(c => c.taskId === "T-ATRASADA" && c.slaStatus === "entrega_atrasada" && c.blockedCandidate));
  ok("T-PERTO → entrega_proxima laranja", r.computed.some(c => c.taskId === "T-PERTO" && c.slaStatus === "entrega_proxima"));
  ok("T-NAOINI → inicio_atrasado", r.computed.some(c => c.taskId === "T-NAOINI" && c.slaStatus === "inicio_atrasado"));
  ok("wouldNotify SIMULADOS (laranja+vermelho) sem envio", r.wouldNotify.length >= 3 && r.wouldNotify.every(w => w.simulated));
  ok("wouldLock SIMULADO p/ D1 e D3 — designerLocks NÃO gravado", r.wouldLock.length >= 2 && !calls.writes.some(w => String(w.url || "").includes("designerLocks")));
  ok("WIP D1 observado=3 > hard 2 marcado (simulação, modo observe)", r.wip && r.wip.D1 && r.wip.D1.observed === 3 && r.wip.D1.hardExceeded === true); }

console.log("== B) GATING: write:true SEM flag slaEngine → continua sem escrever ==");
{ const { stub, calls } = makeFetchStub({}); globalThis.fetch = stub;
  const r = await S.runSlaEnginePass(Object.assign({}, baseEnv, { SLA_WRITE: "true" }), { write: true });
  ok("flag OFF no doc → writeAllowed=false, 0 escritas", r.writeAllowed === false && r.writes === 0 && calls.writes.length === 0); }

console.log("== C) MODO WRITE (flag ligada via doc stub) + IDEMPOTÊNCIA 409 ==");
{ const s1 = makeFetchStub({ flagsOn: true }); globalThis.fetch = s1.stub;
  const r1 = await S.runSlaEnginePass(Object.assign({}, baseEnv, { SLA_WRITE: "true" }), { write: true });
  const createdIds = s1.calls.writes.filter(w => w.kind === "slaEvent").map(w => w.id);
  ok("1ª passada grava slaEvents com ID=dedupKey", r1.writeAllowed === true && createdIds.length > 0, createdIds.slice(0, 3));
  ok("IDs determinísticos (taskId__tipo__âncora)", createdIds.every(id => /^T-.+__designer_.+__\d+$/.test(id)), createdIds[0]);
  const s2 = makeFetchStub({ flagsOn: true, preCreated: createdIds }); globalThis.fetch = s2.stub;
  const r2 = await S.runSlaEnginePass(Object.assign({}, baseEnv, { SLA_WRITE: "true" }), { write: true });
  const recreated = s2.calls.writes.filter(w => w.kind === "slaEvent");
  ok("2ª passada: mesmos eventos caem em 409 → dedupSkipped, ZERO duplicatas", recreated.length === 0 && r2.dedupSkipped >= createdIds.length, { dedupSkipped: r2.dedupSkipped });
  ok("FCM continua ZERO mesmo em modo write (push real OFF na fase)", s1.calls.fcm === 0 && s2.calls.fcm === 0); }

console.log("== D) V64.56: IN rejeitado (400) → fallback por IGUALDADE + diagnóstico no relatório ==");
{ const { stub, calls } = makeFetchStub({ inFails: true }); globalThis.fetch = stub;
  const r = await S.runSlaEnginePass(baseEnv, {});
  ok("fallback varre as 6 tarefas mesmo com IN falhando", r.scanned === 6, { scanned: r.scanned, diag: r.queryDiagnostics });
  ok("queryDiagnostics expõe a falha do IN (status 400 + corpo) e a estratégia", r.queryDiagnostics && r.queryDiagnostics.inStatus === 400 && /IN rejected/.test(r.queryDiagnostics.inError || "") && r.queryDiagnostics.strategy === "equality-fallback", r.queryDiagnostics);
  ok("contagens por igualdade preenchidas (andamento=4: ATRASADA/PERTO/OK/WIP3)", r.queryDiagnostics.eqCounts && r.queryDiagnostics.eqCounts.andamento === 4 && r.queryDiagnostics.merged === 6, r.queryDiagnostics.eqCounts);
  ok("fallback continua read-only (0 escritas, 0 FCM)", calls.writes.length === 0 && calls.fcm === 0); }
{ const { stub } = makeFetchStub({}); globalThis.fetch = stub;     // caminho feliz: IN funciona
  const r = await S.runSlaEnginePass(baseEnv, {});
  ok("caminho feliz: estratégia 'in' com diagnóstico presente", r.queryDiagnostics && r.queryDiagnostics.strategy === "in" && r.queryDiagnostics.merged === 6, r.queryDiagnostics); }

console.log("== E) V64.57: /sla-discover — agregados anônimos read-only ==");
{ const LEGACY = [
    { id: "L1", title: "SENSIVEL-titulo", client: "SENSIVEL-cliente", status: "andamento", dueDate: dstr(now - 120 * MIN), dueTime: tstr(now - 120 * MIN), createdAt: now - 3 * 86400000, assigneeId: "U9", sector: "design" },
    { id: "L2", title: "X", client: "Y", status: "afazer", dueDate: dstr(now + 600 * MIN), dueTime: tstr(now + 600 * MIN), createdAt: now - 40 * 86400000, sector: "copy" },
    { id: "L3", title: "X", client: "Y", status: "concluido", createdAt: now - 100 * 86400000 }];
  const MIX = LEGACY.concat([FIXTURES[0], FIXTURES[3]]);   // 2 beta com designerAssignment
  const agg = S.slaDiscoverAggregate(MIX, now, -180);
  ok("amostra=5; presença de campos contada (status=5, designerAssignment via withDesignerAssignment=2)", agg.sampled === 5 && agg.fieldPresence.status === 3 && agg.withDesignerAssignment === 2, agg.fieldPresence);
  ok("histograma de status legado (1 andamento/1 afazer/1 concluido; betas não têm status)", agg.valueHistograms.status.andamento === 1 && agg.valueHistograms.status.afazer === 1 && agg.valueHistograms.status.concluido === 1, agg.valueHistograms.status);
  ok("atraso REAL por dueDate detectado no legado (L1 vencida e não concluída)", agg.overdueByDueDate >= 1, { overdue: agg.overdueByDueDate });
  ok("ZERO dados sensíveis no agregado (sem títulos/clientes/ids)", !JSON.stringify(agg).includes("SENSIVEL") && !JSON.stringify(agg).includes("L1")); }

console.log("== F) V64.58: /sla-legacy-baseline — lente legado measure-only ==");
{ const D = 86400000;
  const LEG = [
    { id: "SENS-ID-1", title: "SENSIVEL-T", client: "SENSIVEL-C", status: "afazer",    sector: "copy",   assigneeId: "uid-AAA", dueDate: dstr(now + 2 * D), dueTime: "18:00", createdAt: now - 2 * D },
    { id: "SENS-ID-2", title: "X", client: "Y", status: "andamento", sector: "design", assigneeId: "uid-AAA", dueDate: dstr(now - 2 * D), dueTime: "18:00", createdAt: now - 10 * D },
    { id: "SENS-ID-3", title: "X", client: "Y", status: "andamento", sector: "design", assigneeId: "uid-BBB", dueDate: dstr(now - 5 * D), dueTime: "18:00", createdAt: now - 40 * D },
    { id: "SENS-ID-4", title: "X", client: "Y", status: "revisao",   sector: "copy",   dueDate: dstr(now - 10 * D), dueTime: "18:00", createdAt: now - 100 * D },
    { id: "SENS-ID-5", title: "X", client: "Y", status: "concluido", sector: "design", assigneeId: "uid-BBB", dueDate: dstr(now - 3 * D), dueTime: "18:00" },
    { id: "SENS-ID-6", title: "X", client: "Y", status: "afazer" }];
  const wmod = (await import(pathToFileURL(TMP).href)).default;
  const { stub, calls } = makeFetchStub({ legacyFixtures: LEG }); globalThis.fetch = stub;
  const req2 = (p2, b) => new Request("https://x" + p2, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) });
  const r403 = await wmod.fetch(req2("/sla-legacy-baseline", {}), { FCM_PROJECT_ID: "t", FCM_CLIENT_EMAIL: "t", FCM_PRIVATE_KEY: PEM }, {});
  ok("SEM env → 403", r403.status === 403);
  const r = await wmod.fetch(req2("/sla-legacy-baseline", {}), baseEnv, {});
  const j = await r.json(); const a = j.report.aggregate;
  console.log("  agregado:", JSON.stringify(a).slice(0, 400));
  ok("modo legacy-baseline-read-only, 200", r.status === 200 && j.mode === "legacy-baseline-read-only");
  ok("contagens por status (2 afazer/2 andamento/1 revisao/1 concluido)", a.countsByStatus.afazer === 2 && a.countsByStatus.andamento === 2 && a.countsByStatus.revisao === 1 && a.countsByStatus.concluido === 1, a.countsByStatus);
  ok("ATRASADAS por dueDate = 3 (2 andamento + 1 revisao vencidas; concluída NÃO conta)", a.overdueByDueDate === 3, a);
  ok("magnitude do atraso bucketizada (1-3d, 3-7d, +7d)", a.overdueMagnitude.d1_3 === 1 && a.overdueMagnitude.d3_7 === 1 && a.overdueMagnitude.mais_7d === 1, a.overdueMagnitude);
  ok("setores copy/design + semSector/semDueDate/semAssignee contados", a.bySector.copy === 2 && a.bySector.design === 3 && a.semSector === 1 && a.semDueDate === 1 && a.semAssignee === 2, a);
  ok("responsáveis PSEUDONIMIZADOS (resp01/resp02; uid nunca sai)", a.byAssignee.resp01 === 2 && a.byAssignee.resp02 === 2 && !JSON.stringify(a).includes("uid-"), a.byAssignee);
  ok("atraso por responsável pseudonimizado", (a.overdueByAssignee.resp01 || 0) + (a.overdueByAssignee.resp02 || 0) === 2, a.overdueByAssignee);
  ok("ZERO dados sensíveis (sem títulos/clientes/ids de doc)", !JSON.stringify(j).includes("SENS"), null);
  ok("ZERO escrita / ZERO FCM na lente legado", calls.writes.length === 0 && calls.fcm === 0);
  ok("diag por consulta presente (4 igualdades 200)", Object.values(j.report.diag.queries).every(q => q.status === 200) && j.report.diag.totalQueried === 6, j.report.diag); }

console.log(`\nRESULTADO DRY-RUN LOCAL: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
