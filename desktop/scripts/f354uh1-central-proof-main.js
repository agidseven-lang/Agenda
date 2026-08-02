/**
 * F3.5.4U-H1 — PROVA VISUAL do LEMBRETE CENTRAL (Electron REAL, app.asar 1.0.210).
 * Carrega os módulos REAIS de produção createSlaReminderController (dist/main/slaReminder.js) +
 * createSlaReminderSurface (dist/main/slaReminderWindow.js), com store em memória, e dirige alertas
 * amarelos reais. Prova, via BrowserWindow.getAllWindows(): UMA ÚNICA janela central em TODO o ciclo
 * (nunca a 2ª/retângulo preto atrás), REUTILIZADA no ack (mesmo webContents.id), e captura o card real
 * (win.capturePage) mostrando a sombra ENXUTA/contida (sem halo escuro).
 */
const { app, BrowserWindow } = require("electron");
const fs = require("fs"), path = require("path");
const OUT = process.env.PROOF_OUT || path.join(process.cwd(), "docs", "f354uh1-qa");
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function centralWin() { return BrowserWindow.getAllWindows().find((w) => { try { return /Lembrete de SLA/.test(w.getTitle()); } catch { return false; } }) || null; }
function centralCount() { return BrowserWindow.getAllWindows().filter((w) => { try { return /Lembrete de SLA/.test(w.getTitle()); } catch { return false; } }).length; }
async function cap(name) { const w = centralWin(); if (!w || w.isDestroyed()) return 0; await wait(300); const png = (await w.capturePage()).toPNG(); fs.writeFileSync(path.join(OUT, name + ".png"), png); return png.length; }

app.whenReady().then(async () => {
  const appPath = app.getAppPath();
  console.log("PROOF_IDENT " + JSON.stringify({ version: app.getVersion(), isAsar: /\.asar$/.test(appPath), electron: process.versions.electron, processType: process.type }));
  const win = require(path.join(appPath, "dist", "main", "slaReminderWindow.js"));
  const ctlmod = require(path.join(appPath, "dist", "main", "slaReminder.js"));
  const sounds = win.loadReminderSounds();
  const rendered = [];
  const surface = win.createSlaReminderSurface({
    onAck: (k, st) => { try { ctl.ack(k, st); } catch (e) {} },
    onOpenTask: () => {},
    onLog: (t, d) => { if (/central_alert\./.test(t)) console.log("OBS " + t); if (t === "sla.reminder.rendered") rendered.push(d); },
    nativeNotify: () => true,
  });
  const acked = new Set(), pend = new Map();
  const store = { isAcked: (k) => acked.has(k), markPending: (r) => pend.set(r.key, r), removePending: (k) => pend.delete(k), markAck: (k) => acked.add(k) };
  var ctl = ctlmod.createSlaReminderController({ surface, store, now: () => Date.now(), appVersion: app.getVersion(), taskValid: () => true, decisionsEnabled: () => false, soundFor: (lvl) => (lvl === "critical" ? sounds.critical : sounds.warning) });
  const P = (task, dk) => ({ eventType: "sla_warning", severity: "warning", dedupKey: dk, taskId: task, targetUserId: "u1", actorName: task === "A" ? "Ana Souza" : "Bruno Lima", taskTitle: task === "A" ? "Edição do Reels Institucional" : "Card Institucional", body: "O prazo desta tarefa está próximo (T-30).", context: "Faltam 30 min", action: { deep: "detail/" + task } });

  const manifest = { version: app.getVersion(), appPath, electron: process.versions.electron, steps: [] };
  const rec = (label) => { const w = centralWin(); manifest.steps.push({ label, centralWindowCount: centralCount(), webContentsId: w && !w.isDestroyed() ? w.webContents.id : null, visible: !!(w && !w.isDestroyed() && w.isVisible()) }); };

  // CENA 1 — um alerta amarelo: 1 janela, card limpo (sombra contida)
  ctl.enqueue(P("A", "kA-300000000000"));
  { const t0 = Date.now(); while (Date.now() - t0 < 4000 && !rendered.length) await wait(50); }
  await wait(400); rec("single_shown"); const b1 = await cap("h1central-01-single-yellow"); const idA = (centralWin() || {}).webContents && centralWin().webContents.id;
  console.log("PROOF single: windows=" + centralCount() + " bytes=" + b1);

  // CENA 2 — segundo alerta (tarefa diferente) enquanto o 1º está ativo: continua 1 janela; 2º fica na fila
  rendered.length = 0; ctl.enqueue(P("B", "kB-300000000000"));
  await wait(500); rec("second_enqueued_first_still_shown"); await cap("h1central-02-second-queued");
  console.log("PROOF second-enqueued: windows=" + centralCount() + " (deve ser 1)");

  // CENA 3 — reconhece o 1º (Apenas reconhecer/OK): a MESMA janela é REUTILIZADA p/ o 2º (sem recriar)
  const idBefore = centralWin() && centralWin().webContents.id;
  surface && ctl.ack("kA-300000000000");
  { const t0 = Date.now(); while (Date.now() - t0 < 4000 && !rendered.length) await wait(50); }
  await wait(400); rec("after_ack_second_shown"); const b3 = await cap("h1central-03-after-ack-second"); const idAfter = centralWin() && centralWin().webContents.id;
  console.log("PROOF after-ack: windows=" + centralCount() + " reused=" + (idBefore === idAfter) + " bytes=" + b3);

  // CENA 4 — reconhece o 2º: fila vazia ⇒ janela escondida (0 visíveis), mas NÃO recriada ao longo do ciclo
  ctl.ack("kB-300000000000"); await wait(400); rec("queue_empty_hidden");
  console.log("PROOF queue-empty: visible=" + (centralWin() && centralWin().isVisible()));

  manifest.singleWindowInvariant = manifest.steps.every((s) => s.centralWindowCount <= 1);
  manifest.reusedOnAck = manifest.steps.length >= 3 && manifest.steps[0].webContentsId && manifest.steps[3] && manifest.steps[3].webContentsId === manifest.steps[0].webContentsId;
  fs.writeFileSync(path.join(OUT, "h1central-manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("PROOF_DONE singleWindowInvariant=" + manifest.singleWindowInvariant + " reusedOnAck=" + manifest.reusedOnAck);
  try { surface.destroy(); } catch (e) {}
  app.exit(manifest.singleWindowInvariant ? 0 : 1);
}).catch((e) => { console.error("FATAL " + (e && e.message)); app.exit(1); });
