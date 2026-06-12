/* ════════════════════════════════════════════════════════════════════════
   FASE 4.4-A2 — DEMONSTRAÇÃO DOS AJUSTES DE SEGURANÇA PRÉ-ESCRITA REAL
   (Worker REAL via export default.fetch; rede instrumentada; read-only)
   A: "antes"  — corte 72h atrás  → dataset todo elegível (relatório base);
   B: "depois" — corte = AGORA    → retroativos suprimidos, só novos elegíveis;
   C: SEM SLA_ACTIVATED_AT        → NADA elegível (corte obrigatório);
   D: tetos de backfill (20 tarefas / 10 eventos) → paginação reportada;
   E: /sla-reschedule-plan        → plano dry-run, marcadores resetados, 0 escrita.
   Uso: node scripts/sla-dryrun-fase44a2.mjs
   ════════════════════════════════════════════════════════════════════════ */
import { copyFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..", "cloudflare-worker.js");
const TMP = "/tmp/idseven-worker-fase44a2.mjs";
copyFileSync(SRC, TMP);
const mod = await import(pathToFileURL(TMP).href);
const worker = mod.default, S = mod.__slaCore;
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" });

/* mesmo gerador sintético da 4.4-A (seed fixo, schema 1:1, sem dados sensíveis) */
let seed = 20260612;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const now = Date.now(), MIN = 60000, H = 60 * MIN;
const dstr = (ms) => new Date(ms + (-180) * MIN).toISOString().slice(0, 10);
const tstr = (ms) => new Date(ms + (-180) * MIN).toISOString().slice(11, 16);
const DESIGNERS = ["D01", "D02", "D03", "D04", "D05", "D06"];
const TYPES = ["post", "video", "arte", "reels", "story", "feed", "ajuste", "cronograma"];
function mkTask(i, p) {
  const d = DESIGNERS[i % DESIGNERS.length];
  const t = { id: "T" + String(i).padStart(2, "0"), sector: "cronograma", cronSub: TYPES[i % TYPES.length],
    client: "CLIENTE-" + (1 + i % 9), title: "Demanda #" + i, by: "S" + (1 + i % 3), socialOwnerId: "S" + (1 + i % 3),
    status: p.cancelled ? "cancelada" : "afazer", designerFlowStatus: p.flow, cronStatus: "sent_to_designer",
    createdAt: now - 48 * H, startedAt: p.started ? now - 6 * H : null, doneAt: p.flow === "concluido" ? now - 1 * H : null,
    designerAssignment: { designerId: d, assignedBy: "S1", assignedAt: now - 24 * H, status: "sent",
      startDate: dstr(now + p.startOff), startTime: tstr(now + p.startOff), endDate: dstr(now + p.endOff), endTime: tstr(now + p.endOff) },
    history: [{ kind: "enviado_designer", at: now - 24 * H }] };
  if (p.resched) t.designerSla = { rescheduleCount: 1, assignedEventAt: now - 20 * H };
  return t;
}
const PROFILES = [
  { n: 9, flow: "afazer", started: false, startOff: +4 * H, endOff: +12 * H },
  { n: 5, flow: "afazer", started: false, startOff: +20 * MIN, endOff: +10 * H },
  { n: 6, flow: "afazer", started: false, startOff: -50 * MIN, endOff: +8 * H },
  { n: 14, flow: "andamento", started: true, startOff: -5 * H, endOff: +9 * H },
  { n: 6, flow: "andamento", started: true, startOff: -5 * H, endOff: +18 * MIN },
  { n: 8, flow: "andamento", started: true, startOff: -8 * H, endOff: -2 * H },
  { n: 7, flow: "concluido", started: true, startOff: -10 * H, endOff: -3 * H },
  { n: 3, flow: "andamento", started: true, startOff: -5 * H, endOff: +6 * H, resched: true },
  { n: 2, flow: "afazer", started: false, startOff: -2 * H, endOff: +2 * H, cancelled: true },
];
const TASKS = []; let idx = 0;
for (const p of PROFILES) for (let k = 0; k < p.n; k++) TASKS.push(mkTask(idx++, p));
for (const t of TASKS) if (t.designerFlowStatus === "andamento" && rnd() < 0.45) t.designerAssignment.designerId = rnd() < 0.6 ? "D01" : "D02";
const RESCHED_TASK = Object.assign({}, TASKS[40], { id: "T-RESCHED", designerSla: { rescheduleCount: 0, finishWarningSentAt: 123, finishOverdueSentAt: 456 } });

const net = { writes: [], fcm: 0, log: [] };
globalThis.fetch = async (url, init) => {
  url = String(url); const method = (init && init.method) || "GET";
  net.log.push(method + " " + url.slice(0, 90));
  if (url.includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "tk", expires_in: 3600 }), { status: 200 });
  if (url.includes("fcm.googleapis.com")) { net.fcm++; return new Response("{}", { status: 200 }); }
  if (url.includes("documents:runQuery"))
    return new Response(JSON.stringify(TASKS.map((t) => ({ document: { name: "p/d/documents/tasks/" + t.id, fields: S.slaEncodeFields(t) } }))), { status: 200 });
  if (method === "GET" && url.includes("/documents/tasks/T-RESCHED"))
    return new Response(JSON.stringify({ fields: S.slaEncodeFields(RESCHED_TASK) }), { status: 200 });
  if (method === "GET") return new Response("{}", { status: 404 });
  net.writes.push(method + " " + url);
  return new Response("{}", { status: 200 });
};
const baseEnv = { FCM_PROJECT_ID: "validacao-44a2", FCM_CLIENT_EMAIL: "sla@validacao", FCM_PRIVATE_KEY: PEM, APP_TZ_OFFSET_MINUTES: "-180", SLA_ENGINE_ENABLED: "true" };
const req = (p, b) => new Request("https://x" + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) });
const run = async (env) => (await (await worker.fetch(req("/sla-dryrun", {}), env, {})).json()).report;
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log("  PASS", n); } else { fail++; console.log("  FAIL", n, x !== undefined ? JSON.stringify(x) : ""); } };

console.log("== A) ANTES (corte 72h atrás — tudo elegível) ==");
const A = await run(Object.assign({}, baseEnv, { SLA_ACTIVATED_AT: String(now - 72 * H) }));
console.log("  elegíveis:", A.totals.eligibleEvents, "| retroIgnorados:", A.totals.retroIgnored);
ok("dataset todo elegível (retro=0)", A.totals.retroIgnored === 0 && A.totals.eligibleEvents > 100, A.totals);

console.log("== B) DEPOIS (corte = ATIVAÇÃO AGORA — rajada retroativa suprimida) ==");
const B = await run(Object.assign({}, baseEnv, { SLA_ACTIVATED_AT: String(now) }));
console.log("  elegíveis:", B.totals.eligibleEvents, "| retroIgnorados:", B.totals.retroIgnored);
console.log("  exemplos retro ignorados:", JSON.stringify(B.retroIgnored.slice(0, 3)));
ok("rajada suprimida: retroIgnorados >= 100 e elegíveis só de âncora futura", B.totals.retroIgnored >= 100 && B.totals.eligibleEvents < A.totals.eligibleEvents, B.totals);
ok("elegíveis pós-ativação = warnings com prazo FUTURO (ex.: inicio/entrega_proxima)", B.events.every((e) => e.dedupKey.split("__")[2] >= String(now - 1000)), B.events.slice(0, 2).map((e) => e.eventType));

console.log("== C) SEM SLA_ACTIVATED_AT (corte OBRIGATÓRIO ausente) ==");
const C = await run(baseEnv);
ok("NADA elegível sem autorização explícita (eventos=0, tudo retro)", C.totals.eligibleEvents === 0 && C.totals.retroIgnored > 100, C.totals);

console.log("== D) BACKFILL CONTROLADO (tetos por passada) ==");
const D = await run(Object.assign({}, baseEnv, { SLA_ACTIVATED_AT: String(now - 72 * H), SLA_MAX_TASKS_PER_PASS: "20", SLA_MAX_EVENTS_PER_PASS: "10" }));
console.log("  paginação:", JSON.stringify(D.pagination));
ok("teto de tarefas: 20 analisadas, 40 restantes, truncated", D.pagination.analyzed === 20 && D.pagination.remaining === 40 && D.pagination.truncatedTasks === true, D.pagination);
ok("teto de eventos: <=10 e eventsCapped=true", D.events.length <= 10 && D.pagination.eventsCapped === true, D.events.length);

console.log("== E) RELATÓRIO ENRIQUECIDO (totais p/ calibração) ==");
console.log("  WIP detalhado D01:", JSON.stringify(A.wip.D01));
console.log("  byDesigner D01:", JSON.stringify(A.totals.byDesigner.D01), "| byClient CLIENTE-1:", JSON.stringify(A.totals.byClient["CLIENTE-1"]), "| byType video:", JSON.stringify(A.totals.byType.video));
ok("WIP separa observado/soft/hard/efetivo/bloqueio-por-atraso (modo observe)",
  A.wip.D01.observed >= 3 && A.wip.D01.soft === 2 && A.wip.D01.hard === 2 && A.wip.D01.mode === "observe" && A.wip.D01.blockingByOverdue === true && A.wip.D01.effectiveLimit === 0, A.wip.D01);
ok("modo observe: ZERO eventos de WIP emitidos", !A.events.some((e) => e.eventType === "designer_wip_limit_reached"));
ok("totais por designer/cliente/tipo presentes", !!(A.totals.byDesigner && A.totals.byClient && A.totals.byType));
ok("lock CONSOLIDADO: 1 por designer, tarefas críticas como metadata, prioridade pelo pior atraso",
  Object.values(A.locksConsolidated).every((L) => L.simulated && L.tasks.length >= 1 && L.worstTaskId) &&
  A.wouldLock.length === Object.keys(A.locksConsolidated).length, A.wouldLock);

console.log("== F) /sla-reschedule-plan (plano dry-run, read-only) ==");
{ const r = await worker.fetch(req("/sla-reschedule-plan", { taskId: "T-RESCHED", endDate: dstr(now + 48 * H), endTime: "18:00" }), baseEnv, {});
  const j = await r.json();
  console.log("  plano:", JSON.stringify({ markersReset: j.plan.markersReset, resched: j.plan.wouldPatch.designerSla.rescheduleCount, anchors: j.plan.dedupAnchorChange }));
  ok("retorna plano sem aplicar (mode=plan-only, applied=false)", r.status === 200 && j.mode === "plan-only" && j.plan.applied === false);
  ok("reseta marcadores do prazo antigo + incrementa rescheduleCount", j.plan.markersReset.includes("finishWarningSentAt") && j.plan.wouldPatch.designerSla.rescheduleCount === 1);
  ok("history preservado no plano (from/to)", j.plan.historyEntry.kind === "designer_deadline_rescheduled" && !!j.plan.historyEntry.from && !!j.plan.historyEntry.to); }

console.log("== GATES READ-ONLY GLOBAIS ==");
ok("ZERO escrita real em toda a demonstração (A-F)", net.writes.length === 0, net.writes);
ok("ZERO push FCM em toda a demonstração", net.fcm === 0);
ok("designerLocks/wipLimits/slaEvents jamais na rede como escrita", !net.log.some((l) => /(POST|PATCH|DELETE).*(designerLocks|wipLimits|slaEvents)/.test(l)));

console.log(`\nRESULTADO FASE 4.4-A2: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
