/**
 * F3.5.5C-H2 — f355ch2-stale-alert.test.mjs
 * =====================================================================================
 * INVALIDAÇÃO DEFINITIVA DE ALERTAS RESIDUAIS DE TAREFAS TERMINAIS (P0 do boot).
 * Dirige o CONTROLADOR REAL compilado (dist/main/slaReminder.js) + STORE REAL
 * (dist/main/slaReminderStore.js, arquivo temporário) com uma SUPERFÍCIE FALSA e um
 * taskGate roteirizado (o snapshot canônico é simulado por um mapa; 'unknown' = 1º
 * snapshot ainda não chegou). Prova as 3 BARREIRAS do mandato + a limpeza reparadora:
 *   B1 invalidação na transição terminal (por QUALQUER usuário; modal aberto fecha
 *      automaticamente com "Esta tarefa já foi encerrada." sem os botões de decisão);
 *   B2 revalidação ANTES de exibir (terminal/inexistente/responsável ⇒ lápide+motivo;
 *      unknown ⇒ DIFERE — nada bloqueante sai do cache);
 *   B3 revalidação no BOOT (replay só apresenta após o 1º snapshot; offline não apaga
 *      nem bloqueia) + ciclos repetitivos (20 boots com tarefa concluída ⇒ 0 exibições)
 * e que os ALERTAS LEGÍTIMOS continuam funcionando (fluxo aprovado preservado, inclusive
 * SEM taskGate injetado — compat byte-igual coberta pela suíte f354l/56 que segue verde).
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, "..");
/* SLA_DIST permite apontar para os BYTES EMPACOTADOS (asar extraído) no gate do pacote. */
const DIST = process.env.SLA_DIST ? path.resolve(process.env.SLA_DIST) : path.join(DESK, "dist", "main");
const { createSlaReminderController } = require(path.join(DIST, "slaReminder.js"));
const { createSlaReminderStore } = require(path.join(DIST, "slaReminderStore.js"));

let pass = 0, fail = 0; const fails = [];
function ok(cond, name) { if (cond) { pass++; console.log("  ✓ " + name); } else { fail++; fails.push(name); console.error("  ✗ " + name); } }
function eq(a, b, name) { ok(a === b, name + " (got " + JSON.stringify(a) + " exp " + JSON.stringify(b) + ")"); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let _seq = 0;
function tmpStoreFile() { _seq++; return path.join(os.tmpdir(), "f355ch2-store-" + process.pid + "-" + _seq + ".json"); }
function mkStore(file) { return createSlaReminderStore({ file: file || tmpStoreFile(), log() {} }); }

function fakeSurface() {
  const calls = [];
  let open = false; let cur = null;
  return {
    calls,
    show(v) { calls.push({ t: "show", key: v.key, view: v }); open = true; cur = v; },
    promote(v) { calls.push({ t: "promote", key: v.key, view: v }); open = true; cur = v; },
    close() { calls.push({ t: "close" }); open = false; cur = null; },
    isOpen() { return open; },
    native(v) { calls.push({ t: "native", key: v.key, view: v }); return true; },
    _cur() { return cur; },
    _shows() { return calls.filter((c) => c.t === "show").length; },
  };
}

/** Mapa canônico simulado + gate REAL da fase (mesma semântica do main.ts). */
function mkGate() {
  const map = new Map();          // taskId → {terminal?:bool, resp?:uid}
  let ready = false;
  const gate = (taskId, uid) => {
    if (!ready) return "unknown";
    const t = map.get(String(taskId || ""));
    if (!t) return "missing";
    if (t.terminal) return "terminal";
    if (t.resp && uid && String(t.resp) !== String(uid)) return "assignee_changed";
    return "valid";
  };
  return { map, gate, setReady(v) { ready = v !== false; }, isReady() { return ready; } };
}

function mkCtl(surface, store, g, extra) {
  const logs = [];
  const c = createSlaReminderController(Object.assign({
    surface, store, now: () => Date.now(),
    appVersion: "1.0.222",
    isLocked: () => false,
    getUid: () => (extra && extra.uid) || "u1",
    soundFor: () => "data:audio/wav;base64,X",
    onLog: (t, d) => logs.push([t, d || {}]),
    taskGate: g ? g.gate : undefined,
    autoCloseMs: 600,   // teste: fechamento automático rápido
  }, (extra && extra.opts) || {}));
  c._logs = logs;
  return c;
}

/** Payload REAL da evidência: operational_block (vermelho URGENTE) do designer u1. */
function pay(level, taskId, uid, finishMs) {
  const et = level === "critical" ? "operational_block" : "sla_warning";
  return {
    eventType: et, severity: level === "critical" ? "critical" : "warning",
    taskId, targetUserId: uid,
    dedupKey: et + ":" + taskId + ":" + (finishMs || 170000000000 + _seq),
    taskTitle: "Edição de vídeos — cliente", clientName: "Cliente X",
    responsibleName: "Designer Um", responsibleAvatar: "",
    title: "Tarefa em atraso crítico",
    body: "Conclua ou sinalize atraso antes de continuar outras tarefas.",
    context: "Bloqueio operacional",
    action: { type: "detail", deep: "detail/" + taskId },
  };
}
const hasLog = (c, tag, pred) => c._logs.some(([t, d]) => t === tag && (!pred || pred(d)));

console.log("— A) ALERTA LEGÍTIMO continua funcionando (tarefa ativa, atrasada, do usuário) —");
{
  const s = fakeSurface(), st = mkStore(), g = mkGate();
  g.map.set("tA", { resp: "u1" }); g.setReady(true);
  const c = mkCtl(s, st, g);
  const r = c.enqueue(pay("critical", "tA", "u1"));
  eq(r.channel, "sla-central", "A1 alerta legítimo entra na fila central");
  ok(s._shows() === 1 && s._cur() && /URGENTE/.test(s._cur().title), "A2 modal URGENTE exibido para tarefa ATIVA");
  ok(s._cur().decisionsEnabled === true, "A3 os 5 botões de decisão presentes (view decisionsEnabled)");
  ok(c.ack(s._cur().key, "focused") === true && !s.isOpen(), "A4 'Apenas reconhecer'/OK grava recibo e fecha (fluxo aprovado)");
}

console.log("— B) BARREIRA 2: revalidação ANTES de exibir —");
{
  const s = fakeSurface(), st = mkStore(), g = mkGate();
  g.map.set("tDone", { terminal: true }); g.setReady(true);
  const c = mkCtl(s, st, g);
  const r = c.enqueue(pay("critical", "tDone", "u1"));
  eq(r.channel, "sla-stale", "B1 tarefa TERMINAL não entra na fila (gate na entrada)");
  eq(s._shows(), 0, "B2 nenhum modal exibido para tarefa terminal");
  ok(st.listPending().length === 0, "B3 nenhum pendente gravado para tarefa terminal");
  const r2 = c.enqueue(pay("critical", "tGone", "u1"));
  eq(r2.channel, "sla-stale", "B4 tarefa INEXISTENTE não entra na fila");
  ok(hasLog(c, "sla.reminder.stale_dropped", (d) => d.reason === "stale_terminal_task"), "B5 motivo técnico registrado (stale_terminal_task)");
}

console.log("— C) BARREIRA 3: replay do boot revalida ANTES de apresentar (RED da 1.0.221 → GREEN) —");
{
  // 1º processo: alerta legítimo mostrado e NÃO reconhecido (pendente persiste no disco)
  const file = tmpStoreFile();
  const s1 = fakeSurface(), g1 = mkGate();
  g1.map.set("tBoot", { resp: "u1" }); g1.setReady(true);
  const c1 = mkCtl(s1, mkStore(file), g1);
  c1.enqueue(pay("critical", "tBoot", "u1"));
  eq(s1._shows(), 1, "C1 alerta legítimo mostrado no 1º processo (pendente fica no disco)");
  c1.stop();
  // 2º processo (BOOT): a tarefa foi CONCLUÍDA enquanto a máquina estava DESLIGADA
  const s2 = fakeSurface(), g2 = mkGate();
  g2.map.set("tBoot", { terminal: true });          // snapshot canônico dirá: terminal
  const st2 = mkStore(file);
  const c2 = mkCtl(s2, st2, g2);
  c2.reconcile("login");                             // replay do boot (como main.ts:login)
  eq(s2._shows(), 0, "C2 ANTES do snapshot: NADA exibido (gate unknown ⇒ difere; sem modal do cache)");
  ok(st2.listPending().length === 1, "C3 offline/pré-snapshot NÃO apaga o pendente (preservado)");
  g2.setReady(true);                                 // 1º snapshot chegou
  c2.cleanupStale();                                 // limpeza reparadora (como main.ts:gate-ready)
  c2.onTaskGateReady();
  eq(s2._shows(), 0, "C4 tarefa terminal NUNCA exibida no boot (RED na 1.0.221: modal reaparecia)");
  ok(st2.listPending().length === 0, "C5 resíduo invalidado (pendente removido com lápide)");
  const _peek = st2._peek ? st2._peek() : {};
  ok(Object.keys((_peek && _peek.acked) || {}).length >= 1, "C6 recibo-lápide gravado (histórico preservado; nunca retorna)");
  // 3º processo: MESMO boot de novo ⇒ nada (idempotente)
  const s3 = fakeSurface(), g3 = mkGate(); g3.map.set("tBoot", { terminal: true }); g3.setReady(true);
  const c3 = mkCtl(s3, mkStore(file), g3);
  c3.reconcile("login"); c3.cleanupStale(); c3.onTaskGateReady();
  eq(s3._shows(), 0, "C7 novo boot: zero reapresentações (idempotente)");
}

console.log("— D) BARREIRA 3: boot com tarefa AINDA VÁLIDA apresenta APÓS o snapshot (legítimo preservado) —");
{
  const file = tmpStoreFile();
  const s1 = fakeSurface(), g1 = mkGate(); g1.map.set("tLive", { resp: "u1" }); g1.setReady(true);
  const c1 = mkCtl(s1, mkStore(file), g1);
  c1.enqueue(pay("critical", "tLive", "u1"));
  c1.stop();
  const s2 = fakeSurface(), g2 = mkGate(); g2.map.set("tLive", { resp: "u1" });
  const c2 = mkCtl(s2, mkStore(file), g2);
  c2.reconcile("login");
  eq(s2._shows(), 0, "D1 antes do snapshot: ainda nada (nunca só do cache)");
  g2.setReady(true); c2.onTaskGateReady();
  eq(s2._shows(), 1, "D2 após o snapshot: alerta LEGÍTIMO reapresentado (não suprimido)");
  ok(/URGENTE/.test(s2._cur().title), "D3 conteúdo do alerta legítimo preservado");
}

console.log("— E) BARREIRA 1: transição terminal AO VIVO (conclusão por OUTRO usuário) —");
{
  const s = fakeSurface(), st = mkStore(), g = mkGate();
  g.map.set("tOpen", { resp: "u1" }); g.setReady(true);
  const c = mkCtl(s, st, g);
  const p = pay("critical", "tOpen", "u1");
  c.enqueue(p);
  eq(s._shows(), 1, "E1 modal aberto para tarefa ativa");
  g.map.set("tOpen", { terminal: true });            // Admin concluiu em OUTRA máquina
  c.invalidateTerminal("tOpen", "delivered");        // snapshot entrega a transição (main.ts)
  ok(/já foi encerrada/.test(s._cur().body), "E2 aviso literal 'Esta tarefa já foi encerrada.'");
  ok(s._cur().decisionsEnabled === false, "E3 SEM botões de decisão (nenhuma resposta obsoleta)");
  ok(st.isAcked(p.dedupKey), "E4 recibo gravado IMEDIATAMENTE (nunca volta no boot)");
  ok(st.listPending().length === 0, "E5 pendente removido");
  const d = await c.onDecide({ key: p.dedupKey, decisionType: "start_now" });
  eq(d.status, "ignored", "E6 resposta OBSOLETA rejeitada (decisão pós-encerramento é ignorada até via IPC)");
  await sleep(900);                                   // autoCloseMs=600 no teste
  ok(!s.isOpen(), "E7 FECHOU automaticamente (sem exigir clique)");
  const r2 = c.enqueue(pay("critical", "tOpen", "u1", 999999999999));
  ok(r2.channel === "sla-stale" || r2.channel === "sla-cancelled", "E8 vermelho futuro da tarefa encerrada SUPRIMIDO");
}

console.log("— F) ESTADOS TERMINAIS REAIS (cada gatilho do slaPanelDelivered) + exclusão —");
{
  // o gate da produção usa slaPanelDelivered — aqui provamos o PREDICADO real (fonte main)
  const sr = require(path.join(DIST, "slaRules.js"));
  ok(sr.slaPanelDelivered({ status: "concluido" }) === true, "F1 status 'concluido' é terminal");
  ok(sr.slaPanelDelivered({ status: "cancelado" }) === true, "F2 status 'cancelado' é terminal");
  ok(sr.slaPanelDelivered({ status: "removido" }) === true, "F3 status 'removido' é terminal");
  ok(sr.slaPanelDelivered({ designerFlowStatus: "entregue" }) === true, "F4 flow 'entregue' é terminal");
  ok(sr.slaPanelDelivered({ designerFlowStatus: "concluido" }) === true, "F5 flow 'concluido' é terminal");
  ok(sr.slaPanelDelivered({ designerFlowStatus: "cancelado" }) === true, "F6 flow 'cancelado' é terminal");
  ok(sr.slaPanelDelivered({ designerSla: { finishedAt: 123 } }) === true, "F7 designerSla.finishedAt é terminal");
  ok(sr.slaPanelDelivered({ doneAt: 456 }) === true, "F8 doneAt é terminal");
  ok(sr.slaPanelDelivered({ status: "andamento" }) === false, "F9 'andamento' NÃO é terminal (ativa segue alertando)");
  ok(sr.slaPanelDelivered({ status: "afazer" }) === false, "F10 'afazer' NÃO é terminal");
}

console.log("— G) RESPONSÁVEL TROCADO + limpeza reparadora (contagem primeiro; só resíduos) —");
{
  const file = tmpStoreFile();
  const s1 = fakeSurface(), g1 = mkGate();
  g1.map.set("tGoneL", { resp: "u1" }); g1.map.set("tDoneL", { resp: "u1" }); g1.map.set("tKeep", { resp: "u1" });
  g1.setReady(true);
  const c1 = mkCtl(s1, mkStore(file), g1);
  c1.enqueue(pay("critical", "tKeep", "u1", 111111111111));
  c1.ack(s1._cur().key, "f");                        // tKeep: reconhecido (não é resíduo)
  c1.enqueue(pay("critical", "tDoneL", "u1", 222222222222));
  c1.enqueue(pay("warning", "tGoneL", "u1", 333333333333));
  c1.stop();
  const s2 = fakeSurface(), g2 = mkGate();
  g2.map.set("tDoneL", { terminal: true });          // concluída
  /* tGoneL: excluída (fora do mapa) */
  g2.setReady(true);
  const st2 = mkStore(file);
  const c2 = mkCtl(s2, st2, g2);
  const out = c2.cleanupStale();
  eq(out.scanned, 2, "G1 contagem PRIMEIRO (2 pendentes escaneados; ack não conta)");
  eq(out.terminal, 1, "G2 1 residual terminal contado");
  eq(out.missing, 1, "G3 1 residual de tarefa inexistente contado");
  ok(st2.listPending().length === 0, "G4 SÓ os residuais removidos (com lápide por chave)");
  ok(hasLog(c2, "sla.stale.cleanup.scan") && hasLog(c2, "sla.stale.cleanup.applied"), "G5 limpeza auditável (scan+applied no log)");
  const out2 = c2.cleanupStale();
  eq(out2.scanned + out2.terminal + out2.missing, 0, "G6 idempotente (2ª execução: nada a fazer)");
  // responsável trocado: pendente de u1, tarefa agora do u2 ⇒ NÃO exibe p/ u1 (gate no show)
  const s3 = fakeSurface(), g3 = mkGate(); g3.map.set("tSwap", { resp: "u2" }); g3.setReady(true);
  const c3 = mkCtl(s3, mkStore(), g3);
  const r3 = c3.enqueue(pay("critical", "tSwap", "u1", 444444444444));
  ok(r3.channel === "sla-central" || r3.channel === "sla-stale", "G7 assignee na entrada: segue ao gate de exibição");
  eq(s3._shows(), 0, "G8 responsável trocado NÃO exibe para o usuário anterior");
  ok(hasLog(c3, "sla.reminder.stale_dropped", (d) => d.reason === "stale_assignee_changed") || r3.channel === "sla-stale", "G9 motivo stale_assignee_changed registrado");
}

console.log("— H) CHECK-IN (azul/laranja) também revalida + invalidação terminal local —");
{
  const s = fakeSurface(), st = mkStore(), g = mkGate();
  g.map.set("tIdle", { resp: "u1" }); g.setReady(true);
  const c = mkCtl(s, st, g, { opts: { idleEnabled: () => true } });
  const r = c.enqueueCheckin({ idleCheckKey: "idle:tIdle:1", taskId: "tIdle", recipientUid: "u1", taskTitle: "T", statusVersion: "andamento|1", activityBoundaryVersion: 1, thresholdVersion: "v1" });
  eq(r.channel, "idle-central", "H1 check-in legítimo exibido (janela central livre)");
  c.invalidateTerminal("tIdle", "delivered");
  ok(!s.isOpen(), "H2 check-in ativo FECHA na transição terminal da tarefa");
  const s2 = fakeSurface(), g2 = mkGate(); g2.map.set("tIdle2", { terminal: true }); g2.setReady(true);
  const c2 = mkCtl(s2, mkStore(), g2, { opts: { idleEnabled: () => true } });
  c2.enqueueCheckin({ idleCheckKey: "idle:tIdle2:1", taskId: "tIdle2", recipientUid: "u1", taskTitle: "T" });
  eq(s2._shows(), 0, "H3 check-in de tarefa terminal NUNCA exibido (gate no show)");
}

console.log("— I) CICLOS REPETITIVOS: 20 boots com tarefa concluída ⇒ ZERO reapresentações —");
{
  const file = tmpStoreFile();
  const s1 = fakeSurface(), g1 = mkGate(); g1.map.set("tCycle", { resp: "u1" }); g1.setReady(true);
  const c1 = mkCtl(s1, mkStore(file), g1);
  c1.enqueue(pay("critical", "tCycle", "u1", 555555555555));
  c1.stop();
  // concluída com a máquina desligada; 20 boots consecutivos
  let shows = 0; let residualAfter = -1;
  for (let b = 1; b <= 20; b++) {
    const sB = fakeSurface(), gB = mkGate(); gB.map.set("tCycle", { terminal: true }); gB.setReady(true);
    const cB = mkCtl(sB, mkStore(file), gB);
    cB.reconcile("login"); cB.cleanupStale(); cB.onTaskGateReady();
    shows += sB._shows();
    if (b === 20) residualAfter = mkStore(file).listPending().length;
    cB.stop();
  }
  eq(shows, 0, "I1 20 boots: ZERO alertas residuais exibidos");
  eq(residualAfter, 0, "I2 estado local limpo e estável após os ciclos");
}

console.log("— J) COMPAT: sem taskGate injetado, fluxo aprovado byte-igual (f354l cobre os 56) —");
{
  const s = fakeSurface(), st = mkStore();
  const c = mkCtl(s, st, null);                       // SEM gate (legado)
  c.enqueue(pay("critical", "tLegacy", "u1", 666666666666));
  eq(s._shows(), 1, "J1 sem gate: exibe imediatamente (comportamento aprovado inalterado)");
  ok(c.ack(s._cur().key, "focused"), "J2 ack aprovado intacto");
}

const total = pass + fail;
console.log(`\nF3.5.5C-H2 stale-alert: ${pass}/${total}` + (fail ? " — FALHOU:\n - " + fails.join("\n - ") : " — VERDE"));
process.exit(fail ? 1 : 0);
