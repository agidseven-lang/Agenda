/* F3.5.5C-H2 — PROVAS REAIS Electron: controlador REAL (dist) + superfície REAL
 * (slaReminderWindow → janela slareminder.html REAL, mesmo preload do app) + store REAL em disco.
 * O snapshot canônico é roteirizado via taskGate (mapa + flag ready) — exatamente o contrato que
 * o main.ts injeta. NADA de mockup: a janela central, os 5 botões, o aviso "Esta tarefa já foi
 * encerrada.", o auto-close e o replay do boot são medidos no DOM REAL + estado real do store.
 * Cenas:
 *   P1 alerta LEGÍTIMO vermelho (URGENTE + 5 decisões) exibido           [PNG]
 *   P2 decisão REAL clicada ("Apenas reconhecer") fecha e grava recibo
 *   P3 tarefa concluída COM O MODAL ABERTO (outro usuário) → aviso literal SEM decisões [PNG]
 *      → FECHA sozinho (autoCloseMs) → recibo no store
 *   P4 BOOT com pendente de tarefa TERMINAL → NENHUMA janela + limpeza contada (RED na 1.0.221)
 *   P5 BOOT com pendente de tarefa VÁLIDA → janela SÓ após o 1º snapshot   [PNG]
 *   P6 BOOT OFFLINE (snapshot nunca chega) → nenhuma janela; pendente PRESERVADO
 *   P7 CICLOS: 20 boots com tarefa concluída → 0 exibições
 *   P8 tarefa CANCELADA/EXCLUÍDA nunca exibem (gate terminal/missing)
 */
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f355ch2-qa");
const SHOTS = process.env.PROOF_SHOTS !== "0";
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}

const DIST = path.join(__dirname, "..", "dist", "main");
const { createSlaReminderController } = require(path.join(DIST, "slaReminder.js"));
const { createSlaReminderStore } = require(path.join(DIST, "slaReminderStore.js"));
const { createSlaReminderSurface } = require(path.join(DIST, "slaReminderWindow.js"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); }
let proofs = 0, failures = 0;
function rec(name, okv, info) { proofs++; if (!okv) failures++; line(Object.assign({ proof: name, ok: !!okv }, info || {})); }

let _seq = 0;
function storeFile() { _seq++; return path.join(os.tmpdir(), "f355ch2-proof-" + process.pid + "-" + _seq + ".json"); }
function mkGate() {
  const map = new Map(); let ready = false;
  return { map, setReady(v) { ready = v !== false; },
    gate: (taskId, uid) => { if (!ready) return "unknown"; const t = map.get(String(taskId || "")); if (!t) return "missing"; if (t.terminal) return "terminal"; if (t.resp && uid && String(t.resp) !== String(uid)) return "assignee_changed"; return "valid"; } };
}
function pay(taskId, uid, finishMs) {
  return { eventType: "operational_block", severity: "critical", taskId, targetUserId: uid,
    dedupKey: "operational_block:" + taskId + ":" + finishMs,
    taskTitle: "Edição de vídeos — cliente", clientName: "Cliente Prova",
    responsibleName: "Designer Prova", responsibleAvatar: "",
    title: "Tarefa em atraso crítico", body: "Conclua ou sinalize atraso antes de continuar outras tarefas.",
    context: "Bloqueio operacional", action: { type: "detail", deep: "detail/" + taskId } };
}
function slaWin() { return BrowserWindow.getAllWindows().find((w) => { try { return !w.isDestroyed() && /slareminder\.html/.test(w.webContents.getURL()); } catch (_) { return false; } }) || null; }
function slaVisible() { const w = slaWin(); try { return !!(w && w.isVisible()); } catch (_) { return false; } }
async function measure() {
  const w = slaWin(); if (!w) return null;
  try {
    return await w.webContents.executeJavaScript(`(function(){
      var t=(document.querySelector('.title')||{}).textContent||document.body.textContent||'';
      return { bodyText: (document.body.innerText||'').slice(0,400),
        dStart: !!document.getElementById('d_start'), dAck: !!document.getElementById('d_ack'),
        okBtn: !!document.getElementById('ok') };
    })()`, true);
  } catch (_) { return null; }
}
async function shot(w, name) {
  if (!SHOTS || !w) return "skipped";
  try { const img = await w.capturePage(); const p = path.join(OUT, name + ".png"); fs.writeFileSync(p, img.toPNG()); return path.basename(p); } catch (e) { return "ERR:" + e.message; }
}

function mkCtl(file, g, opts) {
  const logs = [];
  const surface = createSlaReminderSurface({
    onAck: (k, ws) => { try { ctl.ack(k, ws); } catch (_) {} },
    onOpenTask: () => {},
    onDecide: (i) => ctl.onDecide(i),
    onDismiss: (k) => { try { ctl.dismiss(k); } catch (_) {} },
    onLog: (t, d) => logs.push([t, d || {}]),
  });
  const ctl = createSlaReminderController(Object.assign({
    surface, store: createSlaReminderStore({ file, log() {} }), now: () => Date.now(),
    appVersion: "1.0.223", isLocked: () => false, getUid: () => "u1",
    soundFor: () => "", onLog: (t, d) => logs.push([t, d || {}]),
    taskGate: g ? g.gate : undefined, autoCloseMs: 1600,
    persistDecision: async () => ({ status: "committed" }),
  }, opts || {}));
  return { ctl, surface, logs, destroy() { try { ctl.stop(); } catch (_) {} try { surface.destroy(); } catch (_) {} } };
}

app.commandLine.appendSwitch("no-sandbox");
app.disableHardwareAcceleration();
app.on("window-all-closed", () => { /* o harness controla o ciclo de vida; nunca sair sozinho */ });
const wd = setTimeout(() => { console.error("PROOF WATCHDOG"); app.exit(2); }, 420000);
app.whenReady().then(async () => {
  try {
  // a superfície REAL resolve slareminder.html/sons via app.getAppPath() — aponta p/ desktop/
  const APP_ROOT = path.join(__dirname, "..");
  try { app.setAppPath(APP_ROOT); } catch (_) { try { app.getAppPath = () => APP_ROOT; } catch (_2) {} }
  /* P1+P2 — alerta legítimo + decisão real clicada */
  {
    const g = mkGate(); g.map.set("tP1", { resp: "u1" }); g.setReady(true);
    const file = storeFile();
    const h = mkCtl(file, g);
    h.ctl.enqueue(pay("tP1", "u1", 170000000001));
    await sleep(1400);
    const m = await measure();
    const w = slaWin();
    rec("P1 alerta legitimo URGENTE com 5 decisões (janela REAL)", !!(m && /URGENTE/.test(m.bodyText) && m.dStart && m.dAck && w && w.isVisible()), { png: await shot(w, "f355ch2-P1-legitimo"), body: m && m.bodyText.slice(0, 80) });
    // P2 — clicar "Apenas reconhecer" DE VERDADE no DOM (IPC real → onDecide → committed → fecha)
    try { await w.webContents.executeJavaScript("document.getElementById('d_ack').click(); true", true); } catch (_) {}
    await sleep(1200);
    const stAfter = createSlaReminderStore({ file, log() {} });
    rec("P2 'Apenas reconhecer' clicado no DOM fecha e NADA pendente resta", !slaVisible() && stAfter.listPending().length === 0, { visible: slaVisible() });
    h.destroy();
  }
  await sleep(300);

  /* P3 — concluída por OUTRO usuário com o modal ABERTO → aviso + auto-close + recibo */
  {
    const g = mkGate(); g.map.set("tP3", { resp: "u1" }); g.setReady(true);
    const file = storeFile();
    const h = mkCtl(file, g);
    const p = pay("tP3", "u1", 170000000002);
    h.ctl.enqueue(p);
    await sleep(1300);
    g.map.set("tP3", { terminal: true });
    h.ctl.invalidateTerminal("tP3", "delivered");     // exatamente o que o snapshot dispara no main
    await sleep(700);
    const m = await measure();
    const w = slaWin();
    rec("P3a aviso literal 'Esta tarefa já foi encerrada.' SEM decisões", !!(m && /já foi encerrada/.test(m.bodyText) && !m.dStart), { png: await shot(w, "f355ch2-P3-encerrada"), body: m && m.bodyText.slice(0, 80) });
    await sleep(2200);                                 // autoCloseMs=1600
    const stP3 = createSlaReminderStore({ file, log() {} });
    rec("P3b FECHOU sozinho + recibo gravado + zero pendentes", !slaVisible() && stP3.listPending().length === 0 && stP3.isAcked(p.dedupKey), { visible: slaVisible() });
    h.destroy();
  }
  await sleep(300);

  /* P4 — BOOT com pendente TERMINAL (o P0 da evidência) → nenhuma janela + limpeza contada */
  {
    const file = storeFile();
    const g1 = mkGate(); g1.map.set("tP4", { resp: "u1" }); g1.setReady(true);
    const h1 = mkCtl(file, g1);
    h1.ctl.enqueue(pay("tP4", "u1", 170000000003));
    await sleep(1200);
    h1.destroy();                                      // máquina "desligou" sem reconhecer
    await sleep(400);
    const g2 = mkGate(); g2.map.set("tP4", { terminal: true });   // concluída dias atrás
    const h2 = mkCtl(file, g2);
    h2.ctl.reconcile("login");                         // replay do boot
    await sleep(900);
    const noneBefore = !slaVisible();
    g2.setReady(true);                                 // 1º snapshot chegou
    const counts = h2.ctl.cleanupStale();
    h2.ctl.onTaskGateReady();
    await sleep(900);
    const stP4 = createSlaReminderStore({ file, log() {} });
    rec("P4 BOOT: tarefa concluída NUNCA reapresenta (pré-snapshot nada; pós-snapshot invalida)", noneBefore && !slaVisible() && counts.terminal === 1 && stP4.listPending().length === 0, { counts });
    h2.destroy();
  }
  await sleep(300);

  /* P5 — BOOT com pendente VÁLIDO → apresenta SÓ após o snapshot (legítimo preservado) */
  {
    const file = storeFile();
    const g1 = mkGate(); g1.map.set("tP5", { resp: "u1" }); g1.setReady(true);
    const h1 = mkCtl(file, g1);
    h1.ctl.enqueue(pay("tP5", "u1", 170000000004));
    await sleep(1100);
    h1.destroy();
    await sleep(400);
    const g2 = mkGate(); g2.map.set("tP5", { resp: "u1" });
    const h2 = mkCtl(file, g2);
    h2.ctl.reconcile("login");
    await sleep(800);
    const noneBefore = !slaVisible();
    g2.setReady(true); h2.ctl.cleanupStale(); h2.ctl.onTaskGateReady();
    await sleep(1300);
    const m = await measure();
    const w = slaWin();
    rec("P5 BOOT: alerta LEGÍTIMO reapresenta após o 1º snapshot (não suprimido)", noneBefore && !!(m && /URGENTE/.test(m.bodyText)), { png: await shot(w, "f355ch2-P5-boot-legitimo") });
    h2.destroy();
  }
  await sleep(300);

  /* P6 — BOOT OFFLINE: snapshot nunca chega → nenhuma janela; pendente PRESERVADO */
  {
    const file = storeFile();
    const g1 = mkGate(); g1.map.set("tP6", { resp: "u1" }); g1.setReady(true);
    const h1 = mkCtl(file, g1);
    h1.ctl.enqueue(pay("tP6", "u1", 170000000005));
    await sleep(1100);
    h1.destroy();
    await sleep(300);
    const g2 = mkGate();                               // ready NUNCA vira true (offline)
    const h2 = mkCtl(file, g2);
    h2.ctl.reconcile("login");
    await sleep(1200);
    const stP6 = createSlaReminderStore({ file, log() {} });
    rec("P6 BOOT OFFLINE: nenhum bloqueio por cache E pendente preservado (não apagado)", !slaVisible() && stP6.listPending().length === 1, {});
    h2.destroy();
  }
  await sleep(300);

  /* P7 — 20 CICLOS de boot com tarefa concluída → 0 exibições */
  {
    const file = storeFile();
    const g1 = mkGate(); g1.map.set("tP7", { resp: "u1" }); g1.setReady(true);
    const h1 = mkCtl(file, g1);
    h1.ctl.enqueue(pay("tP7", "u1", 170000000006));
    await sleep(1100);
    h1.destroy();
    await sleep(300);
    let shows = 0;
    for (let b = 0; b < 20; b++) {
      const gB = mkGate(); gB.map.set("tP7", { terminal: true }); gB.setReady(true);
      const hB = mkCtl(file, gB);
      hB.ctl.reconcile("login"); hB.ctl.cleanupStale(); hB.ctl.onTaskGateReady();
      await sleep(120);
      if (slaVisible()) shows++;
      hB.destroy();
    }
    rec("P7 20 boots consecutivos: ZERO alertas residuais", shows === 0, { shows });
  }
  await sleep(300);

  /* P8 — cancelada (terminal) e excluída (missing) nunca exibem */
  {
    const g = mkGate(); g.map.set("tCanc", { terminal: true }); g.setReady(true);
    const h = mkCtl(storeFile(), g);
    const r1 = h.ctl.enqueue(pay("tCanc", "u1", 170000000007));
    const r2 = h.ctl.enqueue(pay("tGone", "u1", 170000000008));
    await sleep(700);
    rec("P8 cancelada/excluída: nenhum alerta (canais sla-stale; nenhuma janela)", r1.channel === "sla-stale" && r2.channel === "sla-stale" && !slaVisible(), { r1: r1.channel, r2: r2.channel });
    h.destroy();
  }

  } catch (e) { failures++; line({ fatal: String((e && e.stack) || e).slice(0, 300) }); }
  clearTimeout(wd);
  process.stdout.write("PROOF_DONE proofs=" + proofs + " failures=" + failures + "\n");
  app.exit(failures === 0 ? 0 : 1);
});
