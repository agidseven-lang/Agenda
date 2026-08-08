/* F3.5.6A-H1 — DUMP dos docs REAIS do cenário físico (Worker real em vm) p/ o RED de SUPERFÍCIE.
 * Mesma maquinaria provada do red-f356ah1.mjs; timestamps RELATIVOS AO AGORA (o harness Electron
 * roda com o relógio real). Gera: boot (antes da visualização), afterView (ev_view), afterDec
 * (decisão real do Worker) — para DUAS tarefas (cenário desfocado e cenário focado). */
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import url from "url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const wsrc = fs.readFileSync(path.join(here, "..", "..", "cloudflare-worker.js"), "utf8");

function extractFn(src, header) {
  const i = src.indexOf(header);
  if (i < 0) throw new Error("header não encontrado: " + header);
  let j = src.indexOf("{", i); let depth = 0;
  for (let k = j; k < src.length; k++) {
    const c = src[k];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(i, k + 1); }
  }
  throw new Error("chaves desbalanceadas: " + header);
}
function workerSandbox() {
  const ctx = { console: { log: () => {}, warn: () => {}, error: () => {} }, Math, JSON, Object, Array, Number, String, Date, parseInt, RegExp, encodeURIComponent, decodeURIComponent };
  vm.createContext(ctx);
  const fns = ["function wfRoundType(", "function wfWaitPhase(", "function wfAdjustPhase(", "function wfRounds(", "function wfRuns(",
    "function wfRoundSeq(", "function wfLatestRoundKey(", "function wfNextRoundKey(", "function wfNextRunKey(", "function wfActiveRunKeys(",
    "function wfSocialUid(", "function wfS(", "function wfI(", "function wfB(", "function wfMap(", "function wfFieldsSet(",
    "function wfLedger(", "function wfMirrors(", "function wfCloseActiveRuns(", "function wfOpenRun(", "function wfAugmentClientDecision("];
  let code = extractFn(wsrc, "const WF_PHASE = {") + ";\n";
  for (const m of fns) code += extractFn(wsrc, m) + "\n";
  vm.runInContext(code, ctx);
  return ctx;
}
function dec(v) {
  if (v == null || typeof v !== "object") return v;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if (v.mapValue) { const o = {}; const f = v.mapValue.fields || {}; for (const k in f) o[k] = dec(f[k]); return o; }
  return v;
}
function applyCommit(doc, fields, mask) {
  const out = JSON.parse(JSON.stringify(doc));
  for (const fp of mask) {
    const parts = fp.split(".");
    let srcV = fields[parts[0]];
    for (let i = 1; i < parts.length && srcV; i++) srcV = (srcV.mapValue && srcV.mapValue.fields) ? srcV.mapValue.fields[parts[i]] : undefined;
    if (srcV === undefined) continue;
    let tgt = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!tgt[parts[i]] || typeof tgt[parts[i]] !== "object") tgt[parts[i]] = {};
      tgt = tgt[parts[i]];
    }
    tgt[parts[parts.length - 1]] = dec(srcV);
  }
  return out;
}

const NOW = Date.now();
const ANA = "uid-ana-social";
const cx = workerSandbox();

function scenario(taskId, title, client, tOffset) {
  const T0 = NOW - tOffset;            // preparo
  const T_READY = T0 + 60000;
  const T_SENT = T0 + 120000;
  const T_VIEW = T0 + 180000;
  const T_DEC = T0 + 240000;
  const boot = {
    id: taskId,
    sector: "cronograma", status: "andamento",
    title, client,
    by: ANA, socialOwnerId: ANA,
    cronContents: [{ tema: "t1" }, { tema: "t2" }, { tema: "t3" }],
    cronStatus: "enviado_cliente", clientFlowStatus: "enviado",
    clientApprovalPhase: "themes",
    workflowPhase: "themes_waiting_client", workflowPhaseAt: T_SENT,
    workflowResponsibleType: "client", workflowResponsibleUid: "",
    externalWait: true, externalWaitSince: T_SENT,
    approvalRounds: { ar_themes_r1: { type: "themes", createdAt: T_READY, sentAt: T_SENT, firstViewedAt: 0, viewCount: 0 } },
    phaseRuns: {
      pr01_themes_preparation: { phase: "themes_preparation", responsibleType: "social", responsibleUid: ANA, startedAt: T0, completedAt: T_SENT, status: "done", outcome: "done" },
      pr02_themes_waiting_client: { phase: "themes_waiting_client", responsibleType: "client", responsibleUid: "", startedAt: T_SENT, dueAt: 0, completedAt: 0, status: "active", outcome: "" },
    },
    workflowEvents: {
      ev_tready_r1: { t: "THEMES_READY", ph: "themes_preparation", rd: "ar_themes_r1", at: T_READY, src: "team", by: ANA, v: 1 },
      ev_sent_ar_themes_r1: { t: "CLIENT_THEMES_APPROVAL_REQUESTED", ph: "themes_waiting_client", rd: "ar_themes_r1", at: T_SENT, src: "team", by: ANA, v: 1 },
    },
  };
  const afterView = JSON.parse(JSON.stringify(boot));
  afterView.approvalRounds.ar_themes_r1.firstViewedAt = T_VIEW;
  afterView.approvalRounds.ar_themes_r1.viewCount = 1;
  afterView.workflowEvents.ev_view_ar_themes_r1 = { t: "CLIENT_THEMES_FIRST_VIEWED", ph: "themes_waiting_client", rd: "ar_themes_r1", at: T_VIEW, src: "portal", by: "client", v: 1 };
  const fields = {}; const mask = [];
  cx.wfAugmentClientDecision(JSON.parse(JSON.stringify(afterView)), { g: { client: "aprovado" }, at: T_DEC, phaseIn: "themes", source: "portal", recordedBy: "" }, fields, mask);
  const afterDec = applyCommit(afterView, fields, mask);
  afterDec.clientFlowStatus = "aprovado"; afterDec.cronStatus = "aprovado_temas";  // espelhos legados do MESMO commit
  return { T: { T0, T_READY, T_SENT, T_VIEW, T_DEC }, boot, afterView, afterDec };
}

const s1 = scenario("task-cron-fisico", "Cronograma teste", "Cliente Físico LTDA", 10 * 60000);
const s2 = scenario("task-cron-fisico-2", "Cronograma teste 2", "Cliente Físico Dois ME", 9 * 60000);

const led1 = s1.afterDec.workflowEvents.ev_dec_ar_themes_r1;
if (!led1 || led1.t !== "CLIENT_THEMES_APPROVED" || s1.afterDec.workflowPhase !== "assignment_pending" || s1.afterDec.workflowResponsibleUid !== ANA) {
  console.error("DUMP INVÁLIDO: Worker não produziu o estado esperado", JSON.stringify({ led1, ph: s1.afterDec.workflowPhase }));
  process.exit(1);
}
const outPath = path.join(os.tmpdir(), "f356ah1-docs.json");
fs.writeFileSync(outPath, JSON.stringify({ generatedAt: NOW, ANA, s1, s2 }, null, 2));
console.log("docs gravados em", outPath);
console.log("s1 ledger:", JSON.stringify(led1));
console.log("s2 ledger:", JSON.stringify(s2.afterDec.workflowEvents.ev_dec_ar_themes_r1));
