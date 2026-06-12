/* ════════════════════════════════════════════════════════════════════════
   FASE 4.4-A — VALIDAÇÃO DRY-RUN CONTROLADA (read-only absoluto)
   ════════════════════════════════════════════════════════════════════════
   Executa o Worker REAL (export default.fetch → rota /sla-dryrun) em ambiente
   local controlado, com dataset SINTÉTICO realista (schema 1:1 do app real,
   60 tarefas, 6 designers, todos os estados). Rede 100% instrumentada:
   QUALQUER tentativa de escrita (POST/PATCH/DELETE em documents) ou de push
   (fcm.googleapis.com) é capturada e zera o gate.
   Flags permanecem OFF (appConfig/flags → 404 no stub = defaults).
   env usa SOMENTE SLA_ENGINE_ENABLED="true" (libera apenas simulação);
   SLA_WRITE NÃO é definido — escrita real é impossível por construção.
   Uso: node scripts/sla-dryrun-fase44a.mjs
   ════════════════════════════════════════════════════════════════════════ */
import { copyFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..", "cloudflare-worker.js");
const TMP = "/tmp/idseven-worker-fase44a.mjs";
copyFileSync(SRC, TMP);
const mod = await import(pathToFileURL(TMP).href);
const worker = mod.default, S = mod.__slaCore;

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const env = {
  FCM_PROJECT_ID: "validacao-44a", FCM_CLIENT_EMAIL: "sla@validacao", APP_TZ_OFFSET_MINUTES: "-180",
  FCM_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }),
  SLA_ENGINE_ENABLED: "true",          // libera APENAS a simulação read-only
  SLA_ACTIVATED_AT: String(Date.now() - 72 * 3600000),  // corte 72h atrás: dataset todo elegível (cenário "antes")
  /* SLA_WRITE: ausente DE PROPÓSITO — escrita real impossível nesta fase */
};

/* ── dataset sintético realista (seed fixo → reproduzível) ──
   schema espelhado do app real (sendToDesigner/TaskItem): designerAssignment
   com startDate/Time + endDate/Time, designerFlowStatus, startedAt, doneAt,
   cronStatus, socialOwnerId, history. SEM dados sensíveis (IDs Dnn/Tnn/Snn). */
let seed = 20260612;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const now = Date.now(), MIN = 60000, H = 60 * MIN;
const dstr = (ms) => new Date(ms + (-180) * MIN).toISOString().slice(0, 10);
const tstr = (ms) => new Date(ms + (-180) * MIN).toISOString().slice(11, 16);
const DESIGNERS = ["D01", "D02", "D03", "D04", "D05", "D06"];
const TYPES = ["post", "video", "arte", "reels", "story", "feed", "ajuste", "cronograma"];
function mkTask(i, profile) {
  const d = DESIGNERS[i % DESIGNERS.length];
  const startOff = profile.startOff, endOff = profile.endOff;
  const t = {
    id: "T" + String(i).padStart(2, "0"), sector: "cronograma", client: "CLIENTE-" + (1 + i % 9),
    title: "Demanda " + TYPES[i % TYPES.length] + " #" + i, by: "S" + (1 + i % 3),
    socialOwnerId: "S" + (1 + i % 3), status: profile.cancelled ? "cancelada" : "afazer",
    designerFlowStatus: profile.flow, cronStatus: "sent_to_designer",
    createdAt: now - 48 * H, startedAt: profile.started ? now - 6 * H : null,
    doneAt: profile.flow === "concluido" ? now - 1 * H : null,
    designerAssignment: { designerId: d, designerName: "Designer " + d, assignedBy: "S1",
      assignedAt: now - 24 * H, status: "sent",
      startDate: dstr(now + startOff), startTime: tstr(now + startOff),
      endDate: dstr(now + endOff), endTime: tstr(now + endOff) },
    history: [{ kind: "enviado_designer", at: now - 24 * H }],
  };
  if (profile.resched) t.designerSla = { rescheduleCount: 1, plannedFinishAt: 0, assignedEventAt: now - 20 * H };
  return t;
}
const PROFILES = [ /* distribuição realista dos 9 cenários exigidos */
  { n: 9,  flow: "afazer",    started: false, startOff: +4 * H,   endOff: +12 * H },             // aguardando_inicio
  { n: 5,  flow: "afazer",    started: false, startOff: +20 * MIN, endOff: +10 * H },            // inicio_proximo (≤30min)
  { n: 6,  flow: "afazer",    started: false, startOff: -50 * MIN, endOff: +8 * H },             // inicio_atrasado (>30min → candidato)
  { n: 14, flow: "andamento", started: true,  startOff: -5 * H,   endOff: +9 * H },              // em_producao
  { n: 6,  flow: "andamento", started: true,  startOff: -5 * H,   endOff: +18 * MIN },           // entrega_proxima
  { n: 8,  flow: "andamento", started: true,  startOff: -8 * H,   endOff: -2 * H },              // entrega_atrasada
  { n: 7,  flow: "concluido", started: true,  startOff: -10 * H,  endOff: -3 * H },              // entregue
  { n: 3,  flow: "andamento", started: true,  startOff: -5 * H,   endOff: +6 * H, resched: true },// reprogramada (metadado)
  { n: 2,  flow: "afazer",    started: false, startOff: -2 * H,   endOff: +2 * H, cancelled: true },// cancelada
];
const TASKS = []; let idx = 0;
for (const p of PROFILES) for (let k = 0; k < p.n; k++) TASKS.push(mkTask(idx++, p));
/* embaralha designers p/ WIP heterogêneo: concentra 'andamento' extra em D01/D02 */
for (const t of TASKS) if (t.designerFlowStatus === "andamento" && rnd() < 0.45) t.designerAssignment.designerId = rnd() < 0.6 ? "D01" : "D02";

/* ── instrumentação TOTAL de rede (prova read-only) ── */
const net = { reads: 0, writeAttempts: [], fcm: 0, log: [] };
globalThis.fetch = async (url, init) => {
  url = String(url); const method = (init && init.method) || "GET";
  net.log.push(method + " " + url.replace(/^https?:\/\//, "").slice(0, 90));
  if (url.includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "tk", expires_in: 3600 }), { status: 200 });
  if (url.includes("fcm.googleapis.com")) { net.fcm++; return new Response("{}", { status: 200 }); }
  if (url.includes("documents:runQuery")) { net.reads++;
    return new Response(JSON.stringify(TASKS.map((t) => ({ document: { name: "p/d/documents/tasks/" + t.id, fields: S.slaEncodeFields(t) } }))), { status: 200 }); }
  if (method === "GET") { net.reads++; return new Response("{}", { status: 404 }); }  // appConfig/flags ausente → defaults OFF
  net.writeAttempts.push(method + " " + url);   // QUALQUER POST/PATCH/DELETE em docs = violação
  return new Response("{}", { status: 200 });
};

const req = (path, body) => new Request("https://idseven-push.local" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log("  PASS", n); } else { fail++; console.log("  FAIL", n, x !== undefined ? JSON.stringify(x) : ""); } };

/* ── 0) regressão: rotas EXISTENTES do worker continuam respondendo ── */
console.log("== REGRESSÃO DO WORKER EXISTENTE ==");
{ const r = await worker.fetch(new Request("https://x/", { method: "GET" }), env, {});
  const j = await r.json();
  ok("GET / responde ok com a versão nova", r.status === 200 && j.ok === true && /V64\.54/.test(j.version), j); }
{ const r = await worker.fetch(req("/cron-test", {}), env, {});  // DRY-RUN por padrão (rota antiga)
  ok("POST /cron-test (rota antiga) segue funcional em dry-run", r.status === 200); }
const writesAfterLegacy = net.writeAttempts.length;

/* ── 1) /sla-dryrun: simulação read-only ── */
console.log("== /sla-dryrun (read-only) ==");
const res = await worker.fetch(req("/sla-dryrun", {}), env, {});
const out = await res.json();
ok("rota responde 200 em modo dry-run", res.status === 200 && out.ok === true && out.mode === "dry-run", out.mode);
const rep = out.report;

/* ── 2) gate de escrita: até pedindo write, continua read-only (flags OFF) ── */
const res2 = await worker.fetch(req("/sla-dryrun", { write: true }), env, {});
const out2 = await res2.json();
ok("body {write:true} NÃO habilita escrita (sem SLA_WRITE + flag OFF)", out2.mode === "dry-run" && out2.report.writes === 0, out2.mode);

/* ── 3) agregados exigidos ── */
const byStatus = {}; for (const c of rep.computed) byStatus[c.slaStatus] = (byStatus[c.slaStatus] || 0) + 1;
const reprogramadas = TASKS.filter((t) => t.designerSla && t.designerSla.rescheduleCount > 0).length;
const evByType = {}; for (const e of rep.events) evByType[e.eventType] = (evByType[e.eventType] || 0) + 1;
const lockedDesigners = [...new Set(rep.wouldLock.map((l) => l.designerId))];
console.log("\n──────── RELATÓRIO 4.4-A ────────");
console.log("tarefas no dataset:", TASKS.length, "| analisadas (eixo designer ativo):", rep.scanned);
console.log("por estado SLA:", JSON.stringify(byStatus));
console.log("reprogramadas (rescheduleCount>0, metadado):", reprogramadas, "| canceladas:", byStatus.cancelada || 0);
console.log("eventos que SERIAM gerados:", rep.events.length, JSON.stringify(evByType));
console.log("notificações SIMULADAS (laranja+vermelho):", rep.wouldNotify.length);
console.log("designers que SERIAM bloqueados (simulação):", lockedDesigners.length, lockedDesigners);
console.log("WIP simulado:", JSON.stringify(Object.fromEntries(Object.entries(rep.wip).map(([d, w]) => [d, w.observed + "/" + w.hard + (w.hardExceeded ? " EXCEDIDO" : "") + (w.blockingByOverdue ? " BLOQ-ATRASO(efetivo 0)" : "")]))));
console.log("amostra (5 tarefas, estados DIVERSOS, sem dados sensíveis):");
{ const seen = new Set();
  for (const c of rep.computed) {
    if (seen.has(c.slaStatus) || seen.size >= 5) continue;
    seen.add(c.slaStatus); console.log("  ", JSON.stringify(c));
  } }
console.log("──────────────────────────────────\n");

/* ── 4) gates de aceite ── */
console.log("== GATES ==");
ok("coerência: todos os 8 estados representados + contagens batem com perfis",
  byStatus.aguardando_inicio === 9 && byStatus.inicio_proximo === 5 && byStatus.inicio_atrasado === 6 &&
  byStatus.em_producao >= 14 && byStatus.entrega_proxima === 6 && byStatus.entrega_atrasada === 8 &&
  byStatus.entregue === 7 && byStatus.cancelada === 2, byStatus);
ok("ZERO escrita real (nenhum POST/PATCH/DELETE em documents)", net.writeAttempts.length === writesAfterLegacy && rep.writes === 0, net.writeAttempts);
ok("ZERO push (fcm.googleapis.com nunca chamado)", net.fcm === 0);
ok("ZERO lock criado (designerLocks jamais aparece na rede)", !net.log.some((l) => l.includes("designerLocks")));
ok("flags permanecem OFF no relatório", Object.values(rep.flags).every((v) => v === false), rep.flags);
ok("toda notificação/lock veio marcada simulated", rep.wouldNotify.every((w) => w.simulated) && rep.wouldLock.every((w) => w.simulated));
/* idempotência: 2ª passada gera EXATAMENTE os mesmos dedupKeys (se gravados, 409) */
const res3 = await worker.fetch(req("/sla-dryrun", {}), env, {});
const rep3 = (await res3.json()).report;
const keys1 = rep.events.map((e) => e.dedupKey).sort().join("|");
const keys3 = rep3.events.map((e) => e.dedupKey).sort().join("|");
ok("dedupKeys determinísticos entre passadas (idempotência preservada)", keys1 === keys3 && rep.events.length === rep3.events.length, { n1: rep.events.length, n3: rep3.events.length });

console.log(`\nRESULTADO FASE 4.4-A: ${pass} PASS, ${fail} FAIL`);
console.log("(read-only por construção: env sem SLA_WRITE; writeAttempts=" + (net.writeAttempts.length - writesAfterLegacy) + ", fcm=" + net.fcm + ")");
process.exit(fail ? 1 : 0);
