/* F3.5.5A — ACOMPANHAMENTO INTELIGENTE DE EXECUÇÃO — planner PURO e DETERMINÍSTICO.
   Sem IA/opacidade: toda decisão é função explícita de campos canônicos + config. Sem timers,
   sem IPC, sem Firestore — os gatilhos são os ciclos reconcile EXISTENTES (nenhum scheduler novo).
   Consumido pelo orquestrador (taskIdleScheduler/slaReminder) e pelas suítes f355a.
   Privacidade: nunca lê teclado/mouse/janelas/tela — apenas sinais operacionais do Agenda. */
"use strict";

var ET_MATRIX_VERSION = "f355a-1";
var MIN30 = 30 * 60000, H1 = 60 * 60000, D24 = 24 * H1;

var ET_STATES = ["PLANNED", "DUE", "CLAIMED", "DISPLAYED", "RESPONDED", "MISSED", "SUPPRESSED", "CANCELLED", "SUPERSEDED"];

/* ---- Chave idempotente (nunca só timestamp) ---- */
function etKey(taskId, designerId, deadlineVersion, checkpointIndex) {
  return String(taskId || "") + "|" + String(designerId || "") + "|dl" + String(deadlineVersion || 0) + "|cp" + String(checkpointIndex);
}

/* ---- Elegibilidade (mandato) ---- */
function etEligibility(t, cfg) {
  t = t || {}; cfg = cfg || {};
  var no = function (r) { return { eligible: false, reason: r }; };
  if (!t.designerId) return no("sem_designer");
  if (!(t.dueMs > 0)) return no("sem_prazo");
  var st = String(t.status || "");
  if (st === "concluido" || st === "entregue") return no("concluida_entregue");
  if (t.removed || t.cancelled) return no("removida_cancelada");
  if (st === "revisao" && !t.designerActionPending) return no("revisao_sem_acao_designer");
  if (t.waitingClientFormal) return no("aguardando_cliente");
  if (t.blockedPaused) return no("bloqueada_pausada");
  if (t.adminOnly) return no("administrativa");
  var sectors = cfg.sectors || null;
  if (sectors && sectors.length && sectors.indexOf(String(t.sector || "")) < 0) return no("setor_desabilitado");
  var designers = cfg.designers || null;
  if (designers && designers.length && designers.indexOf(String(t.designerId)) < 0) return no("designer_fora_do_teste");
  return { eligible: true, reason: "" };
}

/* ---- Início canônico da janela: startAt explícito → assignedAt → nunca inventado ---- */
function etWindowStart(t) {
  t = t || {};
  if (t.startMs > 0) return { startMs: t.startMs, source: "startAt" };
  if (t.assignedAtMs > 0) return { startMs: t.assignedAtMs, source: "assignedAt" };
  return { startMs: 0, source: "none" };
}

/* ---- Matriz de duração (mandato F3.5.5A; percentuais de referência) ---- */
function etDurationBucket(D) {
  if (D < MIN30) return "lt30m";
  if (D <= H1) return "30to60m";
  if (D <= 1.5 * H1) return "1hto1h30";
  if (D <= 3 * H1) return "1h30to3h";
  if (D <= 8 * H1) return "3hto8h";
  if (D <= D24) return "8hto24h";
  if (D <= 3 * D24) return "24hto3d";
  return "gt3d";
}
function etPercentsFor(bucket) {
  switch (bucket) {
    case "lt30m": return [];
    case "30to60m": return [0.35];
    case "1hto1h30": return [0.30];
    case "1h30to3h": return [0.25, 0.60];
    case "3hto8h": return [0.20, 0.50, 0.75];
    case "8hto24h": return [0.25, 0.55, 0.75];
    case "24hto3d": return [0.25, 0.50, 0.75];
    default: return [0.20, 0.50, 0.75]; // gt3d (adicionais só por regra reativa, nunca no plano base)
  }
}

/* ---- Zona de proteção do SLA: NUNCA hardcode — warn do setor + margem configurável ---- */
function etSlaCutoff(dueMs, sectorWarnMs, marginMs) {
  var w = sectorWarnMs > 0 ? sectorWarnMs : 30 * 60000;
  var m = marginMs >= 0 ? marginMs : 10 * 60000;
  return dueMs - w - m;
}

/* ---- Jornada (config administrativa; sem horário inventado) ----
   schedule = { days:[0..6], startMin, endMin, tzOffsetMin, configured:true } */
function etInSchedule(ts, schedule) {
  if (!schedule || !schedule.configured) return false;
  var local = ts + (schedule.tzOffsetMin || 0) * 60000;
  var d = new Date(local);
  var day = d.getUTCDay(), min = d.getUTCHours() * 60 + d.getUTCMinutes();
  if ((schedule.days || []).indexOf(day) < 0) return false;
  return min >= (schedule.startMin || 0) && min < (schedule.endMin || 1440);
}
function etNextScheduleStart(ts, schedule) {
  if (!schedule || !schedule.configured) return null;
  for (var i = 0; i < 8 * 1440; i += 15) { // varre em passos de 15min até 8 dias
    var cand = ts + i * 60000;
    if (etInSchedule(cand, schedule)) return cand;
  }
  return null;
}

/* ---- Plano de checkpoints ---- */
function etPlan(input) {
  input = input || {};
  var startMs = input.startMs, dueMs = input.dueMs, cfg = input.cfg || {};
  var out = { matrixVersion: ET_MATRIX_VERSION, bucket: "", checkpoints: [], slaCutoffAt: 0, reason: "" };
  if (!(startMs > 0) || !(dueMs > startMs)) { out.reason = "janela_invalida"; return out; }
  var D = dueMs - startMs;
  out.bucket = etDurationBucket(D);
  out.slaCutoffAt = etSlaCutoff(dueMs, input.sectorWarnMs, cfg.slaMarginMs);
  var pcts = etPercentsFor(out.bucket);
  if (!pcts.length) { out.reason = "prazo_curto_sem_laranja"; return out; }
  var minGap = cfg.minIntervalMs > 0 ? cfg.minIntervalMs : 20 * 60000;
  var maxPerTask = cfg.maxPerTask > 0 ? cfg.maxPerTask : 6;
  var maxPerDay = cfg.maxPerDay > 0 ? cfg.maxPerDay : 1; // aplicado a buckets diários (>24h)
  var daily = out.bucket === "24hto3d" || out.bucket === "gt3d";
  // Teto diário VENCE os percentuais (mandato: "no máximo um check-in laranja por dia"):
  // gap relativo determinístico de 24h/maxPerDay entre laranjas em buckets diários.
  var dailyGap = daily ? Math.floor(D24 / maxPerDay) : 0;
  var last = -Infinity;
  for (var i = 0; i < pcts.length && out.checkpoints.length < maxPerTask; i++) {
    var at = Math.round(startMs + D * pcts[i]);
    if (at >= out.slaCutoffAt) continue;              // zona SLA: nunca laranja lá dentro
    if (at - last < minGap) continue;                 // intervalo mínimo
    if (daily && at - last < dailyGap) continue;      // máx 1/dia (salvo regra reativa, fora do plano base)
    out.checkpoints.push({ index: out.checkpoints.length, pct: pcts[i], plannedAt: at, state: "PLANNED" });
    last = at;
  }
  if (!out.checkpoints.length && !out.reason) out.reason = "todos_na_zona_sla";
  return out;
}

/* ---- Sinais de atividade SIGNIFICATIVA (lista canônica; o resto NÃO conta) ---- */
var ET_MEANINGFUL = ["started", "status_changed", "progress_increased", "checklist_item_done", "content_changed",
  "attachment_added", "observation_added", "checkin_answered", "sent_to_review", "resumed_after_review", "operational_update"];
var ET_NOT_MEANINGFUL = ["app_opened", "task_viewed", "notification_clicked", "login", "machine_on", "presence_online",
  "assigned", "auto_update", "rerender", "reconnect", "snapshot_repeat"];
function etLastMeaningful(signals) {
  var best = 0;
  (signals || []).forEach(function (s) {
    if (s && ET_MEANINGFUL.indexOf(String(s.type)) >= 0 && s.at > best) best = s.at;
  });
  return best;
}

/* ---- Reavaliação no horário: suprimir/adiar com MOTIVO sanitizado ---- */
function etShouldSuppress(x) {
  x = x || {}; var t = x.task || {}, tr = x.tracking || {}, cfg = x.cfg || {};
  var recentMs = cfg.recentActivityMs > 0 ? cfg.recentActivityMs : 45 * 60000;
  var s = function (r) { return { suppress: true, reason: r }; };
  var st = String(t.status || "");
  if (st === "concluido" || st === "entregue") return s("task_finished");
  if (st === "revisao") return s("sent_to_review");
  if (t.blockedPaused || tr.blocked) return s("blocked_formal");
  if (t.waitingClientFormal || tr.waitingDependency) return s("waiting_dependency");
  if (tr.pauseUntil && x.now < tr.pauseUntil) return s("pause_until_active");
  if (x.now >= x.slaCutoffAt) return s("sla_zone");
  if (!etInSchedule(x.now, x.schedule)) return s("outside_schedule");
  var lm = x.lastMeaningfulAt || 0;
  if (lm && x.now - lm < recentMs) return s("recent_meaningful_activity");
  if (tr.lastResponseAt && x.now - tr.lastResponseAt < recentMs) return s("recent_response");
  if (t.startedAtMs && x.now - t.startedAtMs < recentMs) return s("just_started");
  if (x.displayedElsewhere) return s("displayed_on_other_device");
  if (x.snapshotDuplicate) return s("duplicate_snapshot");
  if (x.mode === "SHADOW") return { suppress: false, reason: "shadow_log_only" }; // calcula; UI decide não exibir
  return { suppress: false, reason: "" };
}

/* ---- Relevância pós-offline/reconexão: um vencido só volta se ainda fizer sentido ---- */
function etStillRelevant(cp, now, slaCutoffAt, dueMs) {
  if (!cp) return false;
  if (now >= slaCutoffAt || now >= dueMs) return false;
  return now - cp.plannedAt <= 6 * 60 * 60000; // vencido há mais de 6h ⇒ superseded (sem fila histórica)
}

/* ---- Risco determinístico e explicável (fatores documentados; sem score secreto) ---- */
function etRisk(f) {
  f = f || {}; var score = 0, why = [];
  var add = function (n, tag) { score += n; why.push(tag); };
  if (f.stillTodoAfterPct >= 0.4) add(2, "afazer_apos_40pct");
  if (f.notStartedAnswer) add(2, "respondeu_nao_iniciei");
  if (f.unansweredCount >= 1) add(f.unansweredCount >= 2 ? 3 : 2, "sem_resposta");
  if (f.etaOverdue) add(2, "previsao_vencida");
  if (f.blocked) add(1, "bloqueio");
  if (f.progressIncompatible) add(1, "progresso_incompativel");
  if (f.deadlineShrunk) add(1, "prazo_reduzido");
  if (f.reviewReturnedNoResume) add(1, "revisao_sem_retomada");
  if (f.noMeaningfulLongMs > 0) add(1, "sem_atividade_prolongada");
  if (f.startedReal) add(-2, "inicio_real");
  if (f.recentProgress) add(-1, "progresso_recente");
  if (f.positiveAnswer) add(-1, "resposta_positiva");
  if (f.reviewSent) add(-2, "enviado_revisao");
  if (f.blockResolved) add(-1, "bloqueio_resolvido");
  if (score < 0) score = 0;
  return { score: score, level: score >= 4 ? "high" : (score >= 2 ? "medium" : "low"), factors: why };
}

/* ---- Recalcular em mudança de prazo/designer ---- */
function etOnDeadlineChange(tracking) {
  tracking = tracking || {};
  return { deadlineVersion: (tracking.deadlineVersion || 0) + 1, cancelPendingOf: tracking.deadlineVersion || 0 };
}

module.exports = {
  ET_MATRIX_VERSION: ET_MATRIX_VERSION, ET_STATES: ET_STATES,
  ET_MEANINGFUL: ET_MEANINGFUL, ET_NOT_MEANINGFUL: ET_NOT_MEANINGFUL,
  etKey: etKey, etEligibility: etEligibility, etWindowStart: etWindowStart,
  etDurationBucket: etDurationBucket, etPercentsFor: etPercentsFor, etSlaCutoff: etSlaCutoff,
  etInSchedule: etInSchedule, etNextScheduleStart: etNextScheduleStart, etPlan: etPlan,
  etLastMeaningful: etLastMeaningful, etShouldSuppress: etShouldSuppress,
  etStillRelevant: etStillRelevant, etRisk: etRisk, etOnDeadlineChange: etOnDeadlineChange,
};

/* ==== COMPLEMENTO OBRIGATÓRIO F3.5.5A (aprovado pelo owner) ==== */

/* ---- 3) AUTORIDADE ÚNICA POR TAREFA (matriz modo × elegibilidade) ----
   OFF: legado = 1.0.216. SHADOW: legado segue AUTORIDADE REAL; adaptativo só observa.
   ACTIVE+elegível: adaptativo é a ÚNICA autoridade (legado suprime p/ a tarefa).
   ACTIVE+não-elegível: legado permanece. Nenhum cenário gera dois check-ins. */
function etAuthority(mode, eligible) {
  mode = String(mode || "OFF");
  if (mode === "ACTIVE" && eligible) return { authority: "adaptive", legacySuppressed: true, adaptiveObserves: false };
  if (mode === "SHADOW") return { authority: "legacy", legacySuppressed: false, adaptiveObserves: true };
  return { authority: "legacy", legacySuppressed: false, adaptiveObserves: false }; // OFF ou ACTIVE+inelegível
}

/* ---- 6) ACTIVE bloqueado com jornada incompleta (sem padrões silenciosos) ---- */
function etActiveAllowed(cfg) {
  cfg = cfg || {}; var sc = cfg.schedule || {};
  var missing = [];
  if (!(sc.days && sc.days.length)) missing.push("dias");
  if (!(sc.startMin >= 0)) missing.push("horario_inicial");
  if (!(sc.endMin > 0)) missing.push("horario_final");
  if (typeof sc.tzOffsetMin !== "number") missing.push("timezone");
  if (!(cfg.minIntervalMs > 0)) missing.push("intervalo_minimo");
  if (!(cfg.maxPerDay > 0)) missing.push("limite_diario");
  if (missing.length) return { allowed: false, reason: "schedule_incomplete", missing: missing,
    message: "Conclua a configuração da jornada antes de ativar os check-ins." };
  return { allowed: true, reason: "", missing: [] };
}

/* ---- 1) DECISÃO DE CLAIM (corpo PURO da transação; autoridade final = transação Firestore
   protegida por Rules com serverTimestamp — o renderer só SOLICITA; nunca relógio local
   como autoridade de plannedAt/claimedAt/leaseExpiresAt/respondedAt/missedAt). ----
   existing = doc atual (null se não existe); serverNow = tempo de SERVIDOR lido na transação. */
function etClaimDecision(existing, serverNow, deviceId, leaseMs) {
  leaseMs = leaseMs > 0 ? leaseMs : 3 * 60000;
  if (!existing) return { decision: "claim", state: "CLAIMED", leaseUntil: serverNow + leaseMs };
  var st = String(existing.state || "");
  if (st === "RESPONDED" || st === "MISSED" || st === "CANCELLED" || st === "SUPERSEDED" || st === "SUPPRESSED")
    return { decision: "closed", state: st };
  if (st === "CLAIMED" || st === "DISPLAYED") {
    if (String(existing.claimDeviceId || "") === String(deviceId || "")) return { decision: "own", state: st };
    if (existing.leaseExpiresAt > serverNow) return { decision: "leased", state: st, leaseExpiresAt: existing.leaseExpiresAt };
    return { decision: "takeover_expired", state: "CLAIMED", leaseUntil: serverNow + leaseMs }; // lease venceu ⇒ novo claim
  }
  return { decision: "claim", state: "CLAIMED", leaseUntil: serverNow + leaseMs }; // PLANNED/DUE
}

/* ---- 4) Cancelamento na zona SLA (transições explícitas; vermelho/amarelo NUNCA esperam) ---- */
function etSlaZoneTransition(cpState) {
  switch (String(cpState || "")) {
    case "PLANNED": return "CANCELLED";
    case "DUE": return "SUPERSEDED";      // devido e ainda não exibido ⇒ some sem som/promoção
    case "CLAIMED": return "SUPERSEDED";
    case "DISPLAYED": return "SUPERSEDED"; // laranja ativo recolhe (texto preservado pela UI) e cede ao crítico
    default: return String(cpState || "");
  }
}

module.exports.etAuthority = etAuthority;
module.exports.etActiveAllowed = etActiveAllowed;
module.exports.etClaimDecision = etClaimDecision;
module.exports.etSlaZoneTransition = etSlaZoneTransition;
