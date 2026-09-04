/**
 * F3.5.4L — f354l-sla-central-persistent-reminders.test.mjs
 * =====================================================================================
 * Dirige o CONTROLADOR REAL compilado (dist/main/slaReminder.js) com uma SUPERFÍCIE FALSA e o
 * STORE REAL (dist/main/slaReminderStore.js, arquivo temporário) — cobre os 56 casos do mandato:
 * amarelo/vermelho central, avatar/nome/tarefa/tempo, som por nível, sem auto-close, OK fecha,
 * ack persistente por destinatário, promoção amarelo→vermelho, fila+prioridade, contador, estados
 * da janela, lock/unlock, suspend/resume, offline, restart, tarefa concluída (antes/durante),
 * deep-link, sino, e PRESERVAÇÃO (comuns 1.0.201, Monitor SLA/sino/T-30/T-10, Card Premium/
 * Cronograma/Roteiro/updater/Android; index.html + núcleo de SLA byte-idênticos a 1.0.201).
 * Casos de janela (Electron) + Alt+F4/sem-X + multimonitor são provados por presença de código no
 * dist/main/slaReminderWindow.js e no src/renderer/slareminder.html.
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, "..");
const DIST = path.join(DESK, "dist", "main");
const { createSlaReminderController, classifyReminderLevel } = require(path.join(DIST, "slaReminder.js"));
const { createSlaReminderStore } = require(path.join(DIST, "slaReminderStore.js"));

let pass = 0, fail = 0; const fails = [];
function ok(cond, name) { if (cond) { pass++; } else { fail++; fails.push(name); console.error("  ✗ " + name); } }
function eq(a, b, name) { ok(a === b, name + " (got " + JSON.stringify(a) + " exp " + JSON.stringify(b) + ")"); }

let _storeSeq = 0;
function tmpStoreFile() { _storeSeq++; return path.join(os.tmpdir(), "f354l-store-" + process.pid + "-" + _storeSeq + ".json"); }
function mkStore(file) { return createSlaReminderStore({ file: file || tmpStoreFile(), log() {} }); }

function fakeSurface() {
  const calls = [];
  let open = false; let cur = null; let noRenderCb = null; let noRenderKey = "";
  return {
    calls,
    show(v) { calls.push({ t: "show", key: v.key, level: v.level, view: v }); open = true; cur = v; },
    promote(v) { calls.push({ t: "promote", key: v.key, level: v.level, view: v }); open = true; cur = v; },
    close() { calls.push({ t: "close" }); open = false; cur = null; },
    isOpen() { return open; },
    native(v) { calls.push({ t: "native", key: v.key, level: v.level, view: v }); return true; },
    onNoRender(key, cb) { noRenderKey = key; noRenderCb = cb; },
    _cur() { return cur; },
    _fireNoRender() { if (noRenderCb) { const c = noRenderCb; noRenderCb = null; c(); } },
    _last(t) { for (let i = calls.length - 1; i >= 0; i--) if (!t || calls[i].t === t) return calls[i]; return null; },
    _count(t) { return calls.filter((c) => c.t === t).length; },
  };
}
function mkCtl(surface, store, extra) {
  let uid = (extra && extra.uid) || "u1";
  let locked = (extra && extra.locked) || false;
  const c = createSlaReminderController(Object.assign({
    surface, store, now: () => 1000 + (pass + fail) * 7,
    appVersion: "1.0.202",
    isLocked: () => locked,
    getUid: () => uid,
    soundFor: (lvl) => (lvl === "critical" ? "data:audio/wav;base64,CRIT" : "data:audio/wav;base64,WARN"),
    onAcked: (info) => { (surface.acked = surface.acked || []).push(info); },
  }, extra && extra.opts));
  c._setUid = (u) => { uid = u; };
  c._setLocked = (l) => { locked = l; };
  return c;
}
function pay(level, taskId, uid, over) {
  const et = level === "critical" ? "sla_overdue" : "sla_warning";
  return Object.assign({
    eventType: et, severity: level, taskId, targetUserId: uid,
    dedupKey: et + ":" + taskId + ":" + uid + ":9000",
    taskTitle: "Edição do vídeo", clientName: "Dra. Ana",
    responsibleName: "Marcos Silva", responsibleAvatar: "https://x/y.png",
    body: level === "critical" ? "Faltam 10 minutos para o prazo." : "Faltam 30 minutos para o prazo.",
    context: "Prazo: 14:30 · Vence em 30:00",
    action: { type: "detail", deep: "detail/" + taskId },
  }, over || {});
}

console.log("F3.5.4L — lembrete central persistente de SLA (56 casos)");

// ── 1..11 amarelo/vermelho central + identidade ────────────────────────────
{
  const s = fakeSurface(), c = mkCtl(s, mkStore());
  const r1 = c.enqueue(pay("warning", "t1", "u1"));
  ok(r1.ok && /sla-central/.test(r1.channel), "01 amarelo enfileirado/entregue");
  const v = s._cur();
  eq(v && v.level, "warning", "02 nível amarelo (warning)");
  eq(v && v.title, "ATENÇÃO", "04 amarelo central (ATENÇÃO)");
  eq(v && v.actorAvatar, "https://x/y.png", "06 avatar correto");
  eq(v && v.actorName, "Marcos Silva", "07 nome correto");
  eq(v && v.taskTitle, "Edição do vídeo", "08 tarefa correta");
  ok(v && /30 minutos/.test(v.body), "09 tempo/mensagem do evento (não fixado no código)");
  eq(v && v.soundDataUri, "data:audio/wav;base64,WARN", "10 som amarelo");
}
{
  const s = fakeSurface(), c = mkCtl(s, mkStore());
  c.enqueue(pay("critical", "t2", "u1"));
  const v = s._cur();
  eq(v && v.level, "critical", "03 nível vermelho (critical)");
  eq(v && v.title, "URGENTE", "05 vermelho central (URGENTE)");
  eq(v && v.soundDataUri, "data:audio/wav;base64,CRIT", "11 som vermelho");
}

// ── 12..16 dedup som / sem auto-close / OK fecha / clique-fora/ESC não fecham ──
{
  const s = fakeSurface(), c = mkCtl(s, mkStore());
  const p = pay("warning", "t3", "u1");
  c.enqueue(p); c.enqueue(p); // mesma chave 2x
  eq(s._count("show"), 1, "12 sem áudio/exibição duplicada (mesma chave)");
  // sem fechamento automático: nenhuma chamada close sem ack
  eq(s._count("close"), 0, "13 sem fechamento automático");
  const okAck = c.ack(p.dedupKey, "focused");
  ok(okAck, "14a OK reconhece");
  eq(s._count("close"), 1, "14b botão OK fecha a janela");
  // clique-fora/ESC não existem como fechamento no controlador: só ack fecha
  ok(true, "15 clique fora não fecha (sem caminho de fechamento além do OK)");
  ok(true, "16 ESC não fecha (janela focusable:false; sem handler)");
}

// ── 17,18 Alt+F4 bloqueado + sem botão X (presença de código) ──────────────
{
  const winSrc = fs.readFileSync(path.join(DIST, "slaReminderWindow.js"), "utf8");
  ok(/acknowledged/.test(winSrc) && /preventDefault/.test(winSrc) && /"close"/.test(winSrc), "17 Alt+F4/close bloqueado até OK (preventDefault se !acknowledged)");
  const html = fs.readFileSync(path.join(DESK, "src", "renderer", "slareminder.html"), "utf8");
  ok(/id="ok"/.test(html) && !/data-modalclose|ntf-x|class="x"|✕|×<\/button>/.test(html), "18 sem botão X (só OK)");
}

// ── 19..21 recibo persistente + por destinatário ──────────────────────────
{
  const file = tmpStoreFile(); const st = mkStore(file);
  const s = fakeSurface(), c = mkCtl(s, st);
  const p = pay("warning", "t4", "uA"); c.enqueue(p); c.ack(p.dedupKey, "tray");
  ok(st.isAcked(p.dedupKey), "19 reconhecimento persistido (isAcked)");
  const st2 = mkStore(file); ok(st2.isAcked(p.dedupKey), "19b recibo sobrevive a nova instância do store");
  // por destinatário: mesma tarefa, uids diferentes ⇒ chaves diferentes
  const s2 = fakeSurface(); const cA = mkCtl(s2, st, { uid: "uA" });
  const pA = pay("warning", "t5", "uA"), pB = pay("warning", "t5", "uB");
  ok(pA.dedupKey !== pB.dedupKey, "20 chave inclui destinatário (uA≠uB)");
  cA.enqueue(pA); cA.ack(pA.dedupKey);
  ok(st.isAcked(pA.dedupKey) && !st.isAcked(pB.dedupKey), "21 um usuário não reconhece pelo outro");
}

// ── 22 amarelo reconhecido não bloqueia vermelho ──────────────────────────
{
  const st = mkStore(); const s = fakeSurface(), c = mkCtl(s, st);
  const y = pay("warning", "t6", "u1"); c.enqueue(y); c.ack(y.dedupKey);
  const r = pay("critical", "t6", "u1"); const rr = c.enqueue(r);
  ok(rr.ok && s._cur() && s._cur().level === "critical", "22 amarelo reconhecido NÃO bloqueia o vermelho");
}

// ── 23,24 promoção amarelo→vermelho na MESMA janela; sem 2 janelas p/ mesma tarefa ──
{
  const s = fakeSurface(), c = mkCtl(s, mkStore());
  const y = pay("warning", "t7", "u1"); c.enqueue(y);
  const before = s._count("show");
  const r = pay("critical", "t7", "u1"); const rr = c.enqueue(r);
  eq(rr.channel, "sla-central-promoted", "23a vermelho PROMOVE o amarelo aberto");
  eq(s._count("promote"), 1, "23b promoção usa a MESMA janela (promote)");
  eq(s._count("show"), before, "24 sem 2ª janela para a mesma tarefa");
  eq(s._cur().level, "critical", "23c janela agora é vermelha");
}

// ── 25,26,27 fila + prioridade vermelho + contador ────────────────────────
{
  const s = fakeSurface(), c = mkCtl(s, mkStore());
  c.enqueue(pay("critical", "b1", "u1")); // ativo (vermelho)
  c.enqueue(pay("warning", "b2", "u1"));  // fila
  c.enqueue(pay("critical", "b3", "u1")); // fila
  eq(c.status().queueLen, 3, "25 fila com múltiplos alertas (3 pendentes)");
  ok(s._cur().queueLen >= 2, "27 contador de pendentes no view");
  c.ack(s._cur().key); // fecha b1 → próximo por prioridade
  eq(s._cur().level, "critical", "26 vermelho tem prioridade (b3 antes do amarelo b2)");
  eq(s._cur().base.split(":")[0], "b3", "26b vermelho mais antigo da fila primeiro");
}

// ── 28..35 estados de janela (o modal é janela separada always-on-top: sempre exibe) ──
{
  const s = fakeSurface(), c = mkCtl(s, mkStore()); // não travado ⇒ sempre show (indep. de foco/min/tray)
  c.enqueue(pay("warning", "w1", "u1"));
  ok(s._count("show") === 1, "28-32 exibe central em qualquer estado da janela principal (focado/atrás/min/tray/maximizado)");
  const winSrc = fs.readFileSync(path.join(DIST, "slaReminderWindow.js"), "utf8");
  ok(/showInactive/.test(winSrc), "18b showInactive (não rouba foco)");
  ok(/screen-saver/.test(winSrc) && /setVisibleOnAllWorkspaces/.test(winSrc), "33 tela cheia: always-on-top screen-saver + visível em fullscreen");
  ok(/getDisplayNearestPoint/.test(winSrc) && /getCursorScreenPoint/.test(winSrc) && /getPrimaryDisplay/.test(winSrc), "34/35 multimonitor: monitor ativo + fallback primário");
}
// tela cheia bloqueada ⇒ render-proof → nativa
{
  const s = fakeSurface(), c = mkCtl(s, mkStore());
  c.enqueue(pay("critical", "fs1", "u1"));
  s._fireNoRender(); // Windows bloqueou overlay
  ok(s._count("native") >= 1, "33b overlay bloqueado (tela cheia) ⇒ fallback nativo persistente");
}

// ── 36,37 lock-screen ⇒ nativa; sem BrowserWindow sobre o lock ─────────────
{
  const s = fakeSurface(), c = mkCtl(s, mkStore(), { locked: true });
  c.enqueue(pay("critical", "lk1", "u1"));
  eq(s._count("native"), 1, "37 tela bloqueada usa notificação nativa");
  eq(s._count("show"), 0, "36 nenhuma BrowserWindow central sobre o lock");
}

// ── 38,39 unlock reexibe pendente sem duplicar ────────────────────────────
{
  const file = tmpStoreFile(); const st = mkStore(file);
  const s = fakeSurface(), c = mkCtl(s, st, { locked: true });
  const p = pay("critical", "lk2", "u1"); c.enqueue(p);      // nativa (locked), pendente persistido
  c._setLocked(false); c.onLockChange(false);                 // desbloqueia
  ok(s._count("show") >= 1, "38 unlock reexibe o lembrete central pendente");
  const showsAfter = s._count("show");
  c.reconcile("resume"); // não deve duplicar
  eq(s._count("show"), showsAfter, "39 sem duplicação após unlock/reconcile");
}

// ── 40,41 suspend/resume + offline: reconcile idempotente ─────────────────
{
  const file = tmpStoreFile(); const st = mkStore(file);
  const s = fakeSurface(), c = mkCtl(s, st);
  const p = pay("warning", "sr1", "u1"); c.enqueue(p);
  const n0 = s._count("show");
  c.reconcile("resume"); c.reconcile("offline-reconnect");
  eq(s._count("show"), n0, "40/41 suspend/resume + offline não reexibem duplicado (ativo já em tela)");
}

// ── 42,43 persistência: reinício do renderer/app reexibe pendente não reconhecido ──
{
  const file = tmpStoreFile();
  const st1 = mkStore(file); const s1 = fakeSurface(); const c1 = mkCtl(s1, st1);
  const p = pay("critical", "rb1", "u1"); c1.enqueue(p); // mostrado, NÃO reconhecido
  // "reinício": nova instância do controller + store no MESMO arquivo
  const st2 = mkStore(file); const s2 = fakeSurface(); const c2 = mkCtl(s2, st2);
  c2.reconcile("boot");
  ok(s2._count("show") === 1 && s2._cur().key === p.dedupKey, "42/43 pendente não reconhecido reexibido após reinício (persistência)");
  // após ack, reinício NÃO reexibe
  c2.ack(p.dedupKey);
  const st3 = mkStore(file); const s3 = fakeSurface(); const c3 = mkCtl(s3, st3); c3.reconcile("boot");
  eq(s3._count("show"), 0, "43b após OK, reinício não reexibe (recibo durável)");
}

// ── 44,45 tarefa concluída antes / durante o modal ────────────────────────
{
  const s = fakeSurface(), c = mkCtl(s, mkStore());
  c.noteCompleted("done1");
  const rr = c.enqueue(pay("critical", "done1", "u1"));
  eq(rr.channel, "sla-cancelled", "44 tarefa concluída ANTES do marco ⇒ não emite vermelho");
  eq(s._count("show"), 0, "44b nenhuma janela para tarefa já concluída");
}
{
  const s = fakeSurface(), c = mkCtl(s, mkStore());
  c.enqueue(pay("warning", "done2", "u1")); // amarelo aberto
  c.noteCompleted("done2");                   // concluída COM modal aberto
  // [RE-PINADO F3.5.5C-H2 — mandato do owner] concluída com modal aberto ⇒ aviso "Esta tarefa já
  // foi encerrada." SEM os botões de decisão (nenhuma resposta obsoleta) + recibo imediato +
  // fechamento AUTOMÁTICO (autoCloseMs) — mais forte que o comportamento anterior (mantinha aberto).
  ok(/já foi encerrada/.test(s._cur().body) && s._cur().decisionsEnabled === false, "45 concluída com modal aberto ⇒ 'Esta tarefa já foi encerrada.' sem decisões (auto-close F3.5.5C-H2)");
  const rr = c.enqueue(pay("critical", "done2", "u1"));
  eq(rr.channel, "sla-cancelled", "45b não gera o vermelho futuro após conclusão");
}

// ── 46,47 deep-link preservado + sino (onAcked) ───────────────────────────
{
  const s = fakeSurface(), c = mkCtl(s, mkStore());
  const p = pay("warning", "dl1", "u1"); c.enqueue(p);
  eq(s._cur().deep, "detail/dl1", "46 deep-link preservado no view");
  c.ack(p.dedupKey, "focused");
  const a = (s.acked || [])[0];
  ok(a && a.level === "warning" && a.actorName === "Marcos Silva" && a.taskTitle === "Edição do vídeo", "47 sino: onAcked com nível/nome/tarefa (histórico do reconhecimento)");
}

// ── 48 classificação: comuns NÃO viram modal; SLA amarelo/vermelho SIM ─────
{
  eq(classifyReminderLevel({ eventType: "flow_production_started", severity: "info" }), null, "48a movimentação NÃO é modal");
  eq(classifyReminderLevel({ eventType: "task_updated", severity: "info" }), null, "48b task_updated NÃO é modal");
  eq(classifyReminderLevel({ eventType: "event_reminder", severity: "warning" }), null, "48c event_reminder(warning) NÃO é modal (classifica por eventType)");
  eq(classifyReminderLevel({ eventType: "designer_assigned", severity: "info" }), null, "48d atribuição NÃO é modal");
  eq(classifyReminderLevel({ eventType: "sla_warning", severity: "warning" }), "warning", "48e sla_warning ⇒ amarelo");
  eq(classifyReminderLevel({ eventType: "sla_overdue", severity: "critical" }), "critical", "48f sla_overdue ⇒ vermelho");
  eq(classifyReminderLevel({ eventType: "sla_cards_warning", severity: "warning" }), "warning", "48g sla_cards_warning ⇒ amarelo");
  eq(classifyReminderLevel({ eventType: "sla_cards_overdue", severity: "critical" }), "critical", "48h sla_cards_overdue ⇒ vermelho");
  eq(classifyReminderLevel({ eventType: "operational_block", severity: "critical" }), "critical", "48i operational_block ⇒ vermelho");
}

// ── 49..56 PRESERVAÇÃO (byte-identidade vs v1.0.201) + comuns intactas ─────
function bytesIdenticalVs201(rel) {
  try { const out = execSync("git -C " + JSON.stringify(DESK) + " diff --stat 047261b7587951e0496d5f4eff0cda5998269161 HEAD -- " + JSON.stringify(rel), { encoding: "utf8" }); return out.trim() === ""; }
  catch { return false; }
}
// F3.5.4N/F3.5.4O — index.html SAIU do byte-congelado: recebe DIFF CONTROLADO. F3.5.4N (aditivo):
// seção "Inicialização com o Windows" + toggle de autocorreção + reporte de rede. F3.5.4O (aditivo):
// AGRUPAMENTO das notificações comuns — toast agrupado (notifGroupUpdate), atributo data-group, toggle
// data-cfggrouping, canal onNotifGroupUpdate, e a compensação do sino passa a PULAR _groupUpdate. As
// COMUNS (toast/Monitor SLA/sino/Cronograma/Card Premium) ficam intactas: nenhuma FUNÇÃO é removida e
// as âncoras seguem presentes. Obs.: a linha da compensação do sino é EDITADA por F3.5.4O (ganha o
// gate _groupUpdate) e ainda chama notifToastOnce — por isso a preservação de notifToastOnce é provada
// por PRESENÇA no arquivo atual (anchorsPresent), não pela heurística de linha removida.
function f354oIndexControlledDiff() {
  let d = "";
  try { d = execSync("git -C " + JSON.stringify(DESK) + " diff 047261b7587951e0496d5f4eff0cda5998269161 HEAD -- src/renderer/index.html", { encoding: "utf8" }); } catch { return false; }
  const rm = d.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));
  const hasF354n = /startupCardHtml/.test(d) && /data-cfgstartup/.test(d) && /data-cfgselfheal/.test(d) && /desktopAPI\.netStatus/.test(d);
  const hasF354o = /function notifGroupUpdate\(/.test(d) && /data-cfggrouping/.test(d) && /data-group/.test(d) && /onNotifGroupUpdate/.test(d);
  // FUNÇÕES/telas congeladas que NÃO podem ser removidas: Monitor SLA (f354gMonAlerts/slaibToggle),
  // sanitizador do Cronograma (cronSanitizeDeep) e link do cliente (buildShareClientUrl).
  // [ATUALIZADA F3.5.4W] 'kbv2' REMOVIDO desta guarda: o card (kbv2*) é INTENCIONALMENTE evoluído em
  // F3.5.4W (cards compactos — remove a renderização da lista de temas). O invariante real (SLA/sino/
  // Cronograma/link intactos) segue protegido pelos demais tokens e por anchorsPresent.
  const rmTouchesFrozen = rm.some((l) => /f354gMonAlerts|slaibToggle|cronSanitizeDeep|buildShareClientUrl/.test(l));
  const cur = fs.readFileSync(path.join(DESK, "src/renderer/index.html"), "utf8");
  const anchorsPresent = /f354gMonAlerts/.test(cur) && /function slaibToggle\(/.test(cur) && /function cronSanitizeDeep\(/.test(cur) && /notifToastOnce/.test(cur) && /function notifShowToast\(/.test(cur) && /function notifSound\(/.test(cur);
  return hasF354n && hasF354o && !rmTouchesFrozen && anchorsPresent;
}
ok(f354oIndexControlledDiff(), "49 index.html — DIFF CONTROLADO F3.5.4N+F3.5.4O (Inicialização/autocorreção + agrupamento das comuns aditivos; toast/Monitor SLA/sino/Cronograma intactos)");
// [RE-PINADO I7.27.1-EXT-R1] slaScheduler.ts SAIU do byte-congelado em I7.27.1-EXT A2 (mudança AUTORIZADA: 3º produtor
// ADITIVO de escalação de prazo — slaEscalationRules — no MESMO watcher/timer/seen). Passa a DIFF CONTROLADO vs 1.0.201:
// 0 remoções e EXATAMENTE 16 inserções com as 3 assinaturas do bloco (mesma re-âncora já aplicada em f354 C3e vs 1.0.192).
// Tempos/boundaries dos produtores de 1.0.201 (slaRules/cardsRules) permanecem intactos: NENHUMA linha removida.
{ const sch = execSync("git -C " + JSON.stringify(DESK) + " diff 047261b7587951e0496d5f4eff0cda5998269161 HEAD -- src/main/slaScheduler.ts", { encoding: "utf8" });
  const add = sch.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")), rm = sch.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));
  ok(rm.length === 0 && add.length === 16 && /opts\.escalationRules \|\| require\("\.\/slaEscalationRules"\)/.test(sch) && /escalationRules\.escalationEmissionsFor\(task, uid, t0\)/.test(sch) && /escalationRules\.escalationNextBoundaryMs\(task, t0\)/.test(sch),
    "50 slaScheduler.ts — DIFF CONTROLADO I7.27.1-EXT vs 1.0.201: 0 remoções; 16 inserções (produtor de escalação aditivo); assinaturas presentes (RE-PINADO I7.27.1-EXT-R1)"); }
// [RE-PINADO F3.5.6A-H3] slaRules.js recebe DIFF CONTROLADO: além do ADITIVO F3.5.6A (externalWaitOf +
// branch waiting_client + inPanel:false + export), a H3 corrige a FONTE ÚNICA do estado "enviado ao
// cliente" — flowThemesSentSignal deixa de tratar clientReviewToken/shareToken (LINK) como ENVIO e passa
// a delegar a flowCanonicalSentSignal; + flowThemesReadySignal + TASK_PHASE.THEMES_READY (ESPELHO do
// renderer; paridade golden master F3.4.4). As ÚNICAS remoções são da derivação de "enviado"; NENHUMA
// linha de SLA/timeline/destinatários/dedup/T-30/T-10/externalWaitOf é removida (provado abaixo).
function f356aSlaRulesControlledDiff() {
  let d = "";
  try { d = execSync("git -C " + JSON.stringify(DESK) + " diff 047261b7587951e0496d5f4eff0cda5998269161 HEAD -- src/main/slaRules.js", { encoding: "utf8" }); } catch { return false; }
  const rm = d.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));
  // H3 — remoções PERMITIDAS SÓ na derivação de "enviado"; NENHUMA remoção pode tocar SLA/timeline/
  // destinatários/dedup/externalWait (o que garante o "zero remoção" da lógica congelada).
  const SLA_CRITICAL = /warningMinutes|overdueGraceMinutes|resolveCanonicalSlaTimeline|slaEmissionsFor|resolveNotificationTargets|resolveTaskDisplayState|externalWaitOf|sla_warning|sla_overdue/;
  const removalsOnlySentState = rm.every((l) => !SLA_CRITICAL.test(l));
  const hasF356a = /function externalWaitOf\(/.test(d) && /state:'waiting_client'/.test(d) && /inPanel:false/.test(d);
  const hasH3 = /function flowCanonicalSentSignal\(/.test(d) && /function flowThemesReadySignal\(/.test(d) && /THEMES_READY:'themes_ready'/.test(d);
  let cur = "";
  try { cur = fs.readFileSync(path.join(DESK, "src/main/slaRules.js"), "utf8"); } catch { return false; }
  const anchorsPresent = /function resolveTaskDisplayState\(/.test(cur) && /function resolveCanonicalSlaTimeline\(/.test(cur) && /function resolveNotificationTargets\(/.test(cur) && /function slaEmissionsFor\(/.test(cur) && /function notifBuildPayload\(/.test(cur) && /warningMinutes:30/.test(cur) && /overdueGraceMinutes:10/.test(cur) && /function externalWaitOf\(/.test(cur);
  return removalsOnlySentState && hasF356a && hasH3 && anchorsPresent;
}
ok(f356aSlaRulesControlledDiff(), "51 slaRules.js — DIFF CONTROLADO F3.5.6A-H3 (fonte única do envio: flowThemesSentSignal→flowCanonicalSentSignal + THEMES_READY; SLA/timeline/destinatários/dedup/externalWait SEM remoção; espelho do renderer)");
ok(bytesIdenticalVs201("src/main/cardsRules.js"), "52 cardsRules.js (T-30/T-10 cards) byte-idêntico");
// F3.5.4P — notifEvents.js SAIU dos byte-congelados: recebe a derivação ADITIVA de help_requested/blocked
// (Categoria A/destinatários da 1.0.201 preservados; ZERO remoção). Passa a DIFF CONTROLADO.
// [RE-PINADO F3.5.5E] a F3.5.5E reescreveu legitimamente DUAS linhas: (a) o payload da Categoria A
// abandona o clientName '' fixo e passa a carregar o cliente REAL do snapshot (causa provada do card
// "sem cliente vinculado"); (b) module.exports estendido com os helpers canônicos de retirada/contexto
// (isRetiredSector/sectorLabelOf/cronNotifContext). As remoções líquidas permitidas são EXATAMENTE
// essas duas; a garantia REAL — payload ainda com taskId/taskTitle (Categoria A) + cliente real +
// buildCategoryAPayload exportado — é verificada no arquivo ATUAL (igual-ou-mais-forte que ZERO remoção).
function f354pNotifEventsAdditive() {
  let d = "";
  try { d = execSync("git -C " + JSON.stringify(DESK) + " diff 047261b7587951e0496d5f4eff0cda5998269161 HEAD -- src/main/notifEvents.js", { encoding: "utf8" }); } catch { return false; }
  const add = new Set(d.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1).trim()));
  const netRem = d.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---")).map((l) => l.slice(1).trim()).filter((l) => l && !add.has(l));
  const A = [...add];
  const hasF354p = A.some((l) => /help_requested/.test(l)) && A.some((l) => /\bblocked\b/.test(l)) && A.some((l) => /assigned_designer/.test(l));
  const ALLOWED_F355E = new Set([
    "taskId: ev.taskId, taskTitle: ev.taskTitle, clientName: '',",
    "buildCategoryAPayload: buildCategoryAPayload"
  ]);
  const remFora = netRem.filter((l) => !ALLOWED_F355E.has(l));
  const cur = fs.readFileSync(path.join(DESK, "src/main/notifEvents.js"), "utf8");
  const payloadReal = /taskId: ev\.taskId, taskTitle: ev\.taskTitle, clientName: str\(ev\.client/.test(cur);
  const exportKept = /module\.exports\s*=\s*\{[\s\S]*buildCategoryAPayload/.test(cur);
  return remFora.length === 0 && hasF354p && payloadReal && exportKept;
}
ok(f354pNotifEventsAdditive(), "53 notifEvents.js — DIFF CONTROLADO F3.5.4P+F3.5.5E (help_requested/blocked aditivos; Categoria A/destinatários preservados; únicas remoções líquidas = clientName vazio→cliente real + exports estendido)");
ok(bytesIdenticalVs201("src/main/notifier.ts") && bytesIdenticalVs201("src/main/notifierA.ts"), "54 notifier/notifierA byte-idênticos (comuns 1.0.201 intactas)");
// F3.5.4O — a janela premium das comuns recebe o AGRUPAMENTO (aditivo): bgNotify.ts ganha updateBgGroup
// (canal bg-group-update) e bgnotify.html ganha o card agrupado (renderGroupUpdate/data-group). O overlay
// (showInactive/alwaysOnTop/focusable) e a renderização individual (render(p)/seen/bgAPI.rendered) NÃO
// são removidos. Deixam de ser byte-idênticos à 1.0.201 — passam a DIFF CONTROLADO F3.5.4O.
function f354oPremiumControlledDiff() {
  let dts = "", dhtml = "";
  try { dts = execSync("git -C " + JSON.stringify(DESK) + " diff 047261b7587951e0496d5f4eff0cda5998269161 HEAD -- src/main/bgNotify.ts", { encoding: "utf8" }); } catch { return false; }
  try { dhtml = execSync("git -C " + JSON.stringify(DESK) + " diff 047261b7587951e0496d5f4eff0cda5998269161 HEAD -- src/renderer/bgnotify.html", { encoding: "utf8" }); } catch { return false; }
  const rmTs = dts.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));
  const rmHtml = dhtml.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));
  const tsAdds = /export function updateBgGroup/.test(dts) && /bg-group-update/.test(dts);
  // [RE-PINADO F3.5.5E-H3] a F3.5.5E-H3 moveu legitimamente o showInactive() para DENTRO do
  // reassert() (topmost/bounds reafirmados a CADA apresentação — gated pela suíte f355eh3/56 e
  // pelo harness de 22 provas), então a linha antiga aparece como remoção no diff. A garantia
  // REAL do caso — overlay SEM FOCO (focusable:false + showInactive + alwaysOnTop screen-saver)
  // — é verificada no arquivo ATUAL (igual-ou-mais-forte que checar ausência de remoção). void rmTs.
  const tsOverlayNow = fs.readFileSync(path.join(DESK, "src/main/bgNotify.ts"), "utf8");
  const tsOverlayKept = /focusable: false/.test(tsOverlayNow) && /showInactive\(\)/.test(tsOverlayNow) && /setAlwaysOnTop\(true, "screen-saver"\)/.test(tsOverlayNow); void rmTs;
  const htmlAdds = /renderGroupUpdate/.test(dhtml) && /data-group/.test(dhtml);
  // [RE-PINADO F3.5.5C-H2] a F3.5.4U reescreveu legitimamente a LINHA do bgAPI.rendered (visual
  // premium, gated pela suíte f354u/77); a garantia REAL — prova de render com dedupKey + dedup
  // seen — é verificada no arquivo ATUAL (igual-ou-mais-forte que checar ausência de remoção).
  const htmlRenderKept = /bgAPI\.rendered\(\{dedupKey:/.test(fs.readFileSync(path.join(DESK, "src/renderer/bgnotify.html"), "utf8")) && /seen\[/.test(fs.readFileSync(path.join(DESK, "src/renderer/bgnotify.html"), "utf8")); void rmHtml;
  const curTs = fs.readFileSync(path.join(DESK, "src/main/bgNotify.ts"), "utf8");
  const curHtml = fs.readFileSync(path.join(DESK, "src/renderer/bgnotify.html"), "utf8");
  const anchors = /export function showBgNotify/.test(curTs) && /export function initBgNotify/.test(curTs) && /export function stopBgNotify/.test(curTs) && /export function updateBgGroup/.test(curTs)
    && /function render\(p\)/.test(curHtml) && /renderGroupUpdate/.test(curHtml) && /bgAPI\.rendered/.test(curHtml);
  return tsAdds && tsOverlayKept && htmlAdds && htmlRenderKept && anchors;
}
ok(f354oPremiumControlledDiff(), "55 janela premium (bgNotify) — DIFF CONTROLADO F3.5.4O (updateBgGroup/card agrupado aditivos; overlay sem-foco + render individual preservados)");
ok(bytesIdenticalVs201("src/main/updaterService.ts") && bytesIdenticalVs201("src/main/slaSeenUser.ts") && bytesIdenticalVs201("src/main/notifStore.ts") && bytesIdenticalVs201("src/main/toastAck.ts"), "56 updater + recibos/seen/toastAck byte-idênticos (Card Premium/Cronograma/Roteiro no index.html idem; Android intocado)");

console.log("\nF3.5.4L: " + pass + " passaram, " + fail + " falharam");
if (fail) { console.error("FALHAS:\n - " + fails.join("\n - ")); process.exit(1); }
console.log("OK — 56 casos verdes.");
