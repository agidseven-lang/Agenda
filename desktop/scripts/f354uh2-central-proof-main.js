/**
 * F3.5.4U-H2 — PROVA REAL (Electron 31.3.1, app.asar 1.0.211) do PROCESSAMENTO ATÔMICO do alerta central.
 * =====================================================================================================
 * Carrega os módulos REAIS de produção (dist/main/slaReminderWindow.js + dist/main/slaReminder.js), com store
 * em memória, e dirige o alerta amarelo REAL. Para CADA uma das 5 ações do card (Apenas reconhecer / Iniciar
 * agora / Estou finalizando / Estou bloqueado / Preciso de ajuda), CLICA no botão REAL dentro do renderer
 * (webContents.executeJavaScript) e PROVA, com a janela transparente VISÍVEL:
 *   1) win.setBounds NÃO é chamado durante o processamento (freeze renderer + center() congelado) ⇒ some o
 *      artefato de sobreposição do redimensionamento (o card antigo NÃO aparece atrás do "Registrando…").
 *   2) UM único .card no DOM; ZERO botões (.dbtn) atrás do spinner (o botão "Estou bloqueado" some no mesmo
 *      ciclo) — visibleCardCount=1, processingLayerCount(.busy)=1.
 *   3) UMA única BrowserWindow central em todo o ciclo.
 * Captura frames A (antes do clique) / B (1º frame após o clique) / C ("Registrando…") por ação, além do
 * cenário de FILA (2 alertas: reconhecer o 1º ⇒ MORFA para o 2º, janela nunca escondida) e ESCALA 150%.
 * Observação honesta: capturePage captura o CONTEÚDO da página (um card limpo), NÃO o backing-store do DWM do
 * Windows — por isso a PROVA definitiva do artefato é "setBounds=0 durante o processamento" (comportamental),
 * confirmada aqui em Electron real; a validação física final no Windows é do owner.
 */
const { app, BrowserWindow } = require("electron");
const fs = require("fs"), path = require("path");
const OUT = process.env.PROOF_OUT || path.join(process.cwd(), "docs", "f354uh2-qa");
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function centralWins() { return BrowserWindow.getAllWindows().filter((w) => { try { return /Lembrete de SLA/.test(w.getTitle()); } catch { return false; } }); }
function centralWin() { return centralWins()[0] || null; }
async function cap(name) { const w = centralWin(); if (!w || w.isDestroyed()) return 0; await wait(250); const png = (await w.capturePage()).toPNG(); fs.writeFileSync(path.join(OUT, name + ".png"), png); return png.length; }
async function jsp(expr) { const w = centralWin(); if (!w || w.isDestroyed()) return null; try { return await w.webContents.executeJavaScript(expr, true); } catch (e) { return { __err: String((e && e.message) || e) }; } }
function wrapSetBounds(w) { if (!w || w.__wrapped) return; w.__wrapped = true; w.__sb = 0; const orig = w.setBounds.bind(w); w.setBounds = function (...a) { w.__sb++; return orig(...a); }; }

// evita o quit automático do Electron quando destruímos a janela entre as ações (isolamento por ação).
app.on("window-all-closed", () => { /* mantém o processo vivo até app.exit no fim da prova */ });

app.whenReady().then(async () => {
  const appPath = app.getAppPath();
  console.log("PROOF_IDENT " + JSON.stringify({ version: app.getVersion(), isAsar: /\.asar$/.test(appPath), electron: process.versions.electron, processType: process.type }));
  const win = require(path.join(appPath, "dist", "main", "slaReminderWindow.js"));
  const ctlmod = require(path.join(appPath, "dist", "main", "slaReminder.js"));
  const sounds = win.loadReminderSounds();

  let ctl = null;
  const surface = win.createSlaReminderSurface({
    onAck: (k, st) => { try { ctl.ack(k, st); } catch (e) {} },
    onOpenTask: () => {},
    onLog: (t, d) => { if (/central_alert\./.test(t)) console.log("OBS " + t); },
    nativeNotify: () => true,
    onDecide: async (input) => (ctl ? ctl.onDecide(input) : { status: "ignored" }),
    onResolveHelp: async () => ({ reason: "preselected", preselect: { id: "u2", name: "Bruno Lima" }, eligible: [{ id: "u2", name: "Bruno Lima" }] }),
  });
  const acked = new Set(), pend = new Map(), dset = new Set(), dpend = new Map();
  const store = {
    isAcked: (k) => acked.has(k), markPending: (r) => pend.set(r.key, r), removePending: (k) => pend.delete(k), markAck: (k) => acked.add(k), listPending: () => [...pend.values()],
    isDecisionSettled: (k) => dset.has(k), markDecisionPending: (r) => dpend.set(r.decisionKey, r), markDecisionSynced: (k) => dset.add(k), markDecisionSuperseded: (k) => dset.add(k), listDecisionsPendingSync: () => [...dpend.values()],
  };
  ctl = ctlmod.createSlaReminderController({ surface, store, now: () => Date.now(), appVersion: app.getVersion(), taskValid: () => true, decisionsEnabled: () => true, soundFor: (lvl) => (lvl === "critical" ? sounds.critical : sounds.warning), getUid: () => "u1", persistDecision: async () => { await wait(120); return { status: "committed", deep: "detail/A" }; } });
  const P = (task, dk) => ({ eventType: "sla_warning", severity: "warning", dedupKey: dk, taskId: task, targetUserId: "u1", responsibleName: task === "A" ? "Ana Souza" : "Bruno Lima", taskTitle: task === "A" ? "Edição do Reels Institucional" : "Card Institucional", body: "O prazo desta tarefa está próximo (T-30).", context: "Faltam 30 min", action: { deep: "detail/" + task } });

  const manifest = { version: app.getVersion(), appPath, electron: process.versions.electron, actions: [], scenarios: [] };

  // helper: dirige UMA ação isolada (alerta próprio) e prova as invariantes durante o processamento.
  async function proveAction(idx, action, navExprs, captureFrames) {
    const key = "kX" + idx + "-30000000000" + idx;
    try { ctl.clearActive(); } catch (e) {}   // reseta active/queue do controller entre ações (isolamento)
    acked.clear(); pend.clear(); dset.clear(); dpend.clear();
    await wait(120);
    ctl.enqueue(P("A", key));
    { const t0 = Date.now(); while (Date.now() - t0 < 3000) { const s = await jsp('document.querySelectorAll(".dbtn").length'); if (s >= 5) break; await wait(50); } }
    await wait(250);
    const w = centralWin(); wrapSetBounds(w);
    const before = { dbtn: await jsp('document.querySelectorAll(".dbtn").length'), cards: await jsp('document.querySelectorAll(".card").length'), windows: centralWins().length };
    if (captureFrames) await cap("h2-" + action + "-A-idle");
    // navega até o botão de confirmação, se for subpainel (finishing/blocked/help)
    for (const nav of (navExprs || [])) { await jsp(nav); await wait(180); }
    w.__sb = 0;                                   // zera o contador ANTES do clique final (ação)
    const clickExpr = (navExprs && navExprs.length) ? 'var b=document.getElementById("c_go"); b&&b.click(); "clicked"' : 'var b=document.getElementById("' + (action === "start_now" ? "d_start" : "d_ack") + '"); b&&b.click(); "clicked"';
    await jsp(clickExpr);
    await wait(60);                               // 1º frame após o clique (processamento)
    const during = {
      setBoundsDuringProcessing: w.__sb,
      cardElementCount: await jsp('document.querySelectorAll(".card").length'),
      visibleCardCount: await jsp('[...document.querySelectorAll(".card")].filter(c=>c.getClientRects().length>0).length'),
      processingLayerCount: await jsp('document.querySelectorAll(".busy").length'),
      dbtnBehind: await jsp('document.querySelectorAll(".dbtn").length'),
      registrandoText: await jsp('(document.querySelector(".busy")||{}).textContent||""'),
      windows: centralWins().length,
    };
    if (captureFrames) { await cap("h2-" + action + "-B-processing"); }
    await wait(400);                              // aguarda commit (persistDecision 120ms) + hide coalescido
    const after = { windowsVisible: centralWins().filter((x) => { try { return x.isVisible(); } catch { return false; } }).length };
    const okAction = during.setBoundsDuringProcessing === 0 && during.cardElementCount === 1 && during.visibleCardCount === 1 && during.processingLayerCount === 1 && during.dbtnBehind === 0 && during.windows === 1 && /Registrando/.test(String(during.registrandoText));
    manifest.actions.push({ action, before, during, after, ok: okAction });
    console.log("PROOF action=" + action + " setBoundsDuringProcessing=" + during.setBoundsDuringProcessing + " cards=" + during.cardElementCount + " dbtnBehind=" + during.dbtnBehind + " windows=" + during.windows + " ok=" + okAction);
    // garante estado limpo p/ a próxima ação
    try { surface.destroy(); } catch (e) {}
    await wait(150);
  }

  // 5 ações (start_now e acknowledge_only vêm direto do idle — o caso EXATO com "Estou bloqueado" atrás)
  await proveAction(1, "acknowledge_only", [], true);
  await proveAction(2, "start_now", [], true);
  await proveAction(3, "finishing", ['var b=document.getElementById("d_fin"); b&&b.click()', 'var c=document.querySelector(".chip[data-eta]"); c&&c.click()'], true);
  await proveAction(4, "blocked", ['var b=document.getElementById("d_blk"); b&&b.click()', 'var r=document.querySelector(".rrow[data-rc]"); r&&r.click()'], true);
  await proveAction(5, "help_requested", ['var b=document.getElementById("d_help"); b&&b.click()'], true);
  // Nota: em help, d_help abre o subpainel (resolveHelp preseleciona) ⇒ c_go fica habilitado; o navExpr acima
  // clica d_help e o clickExpr final clica c_go.

  // CENÁRIO FILA — 2 alertas: reconhecer o 1º ⇒ MORFA para o 2º (janela NUNCA escondida entre itens)
  try { ctl.clearActive(); } catch (e) {}
  acked.clear(); pend.clear(); dset.clear(); dpend.clear(); await wait(150);
  ctl.enqueue(P("A", "kQ-A-300000000000"));
  { const t0 = Date.now(); while (Date.now() - t0 < 3000) { const s = await jsp('document.querySelectorAll(".dbtn").length'); if (s >= 5) break; await wait(50); } }
  ctl.enqueue(P("B", "kQ-B-300000000000"));   // 2º entra na fila (refreshCounter; UMA janela)
  await wait(300);
  const q1 = { windows: centralWins().length, visible: centralWins().filter((x) => { try { return x.isVisible(); } catch { return false; } }).length };
  await cap("h2-queue-01-first-shown");
  const w2 = centralWin(); wrapSetBounds(w2); w2.__hideCalls0 = 0;
  await jsp('var b=document.getElementById("d_ack"); b&&b.click(); "clicked"');   // reconhece o 1º
  await wait(500);                                                                 // commit + morfa p/ o 2º
  const q2 = { windows: centralWins().length, visibleAfter: centralWins().filter((x) => { try { return x.isVisible(); } catch { return false; } }).length, dbtnNow: await jsp('document.querySelectorAll(".dbtn").length'), cards: await jsp('document.querySelectorAll(".card").length') };
  await cap("h2-queue-02-after-ack-morph-second");
  manifest.scenarios.push({ scenario: "queue-advance", q1, q2, ok: q2.windows === 1 && q2.cards === 1 && q2.visibleAfter === 1 });
  console.log("PROOF queue-advance windows=" + q2.windows + " cards=" + q2.cards + " visibleAfter=" + q2.visibleAfter + " dbtnNow=" + q2.dbtnNow);
  try { surface.destroy(); } catch (e) {}
  await wait(150);

  // ESCALA 150% — mesma prova (setBounds=0 no processamento) sob zoomFactor 1.5
  try { ctl.clearActive(); } catch (e) {}
  acked.clear(); pend.clear(); dset.clear(); dpend.clear(); await wait(150);
  ctl.enqueue(P("A", "kS-300000000000"));
  { const t0 = Date.now(); while (Date.now() - t0 < 3000) { const s = await jsp('document.querySelectorAll(".dbtn").length'); if (s >= 5) break; await wait(50); } }
  const ws = centralWin();
  if (!ws) { manifest.scenarios.push({ scenario: "scale-150", skipped: true, ok: false }); console.log("PROOF scale150 SKIPPED (no window)"); }
  else {
  try { ws.webContents.setZoomFactor(1.5); } catch (e) {}
  await wait(300); wrapSetBounds(ws); ws.__sb = 0;
  await cap("h2-scale150-A-idle");
  await jsp('var b=document.getElementById("d_ack"); b&&b.click(); "clicked"');
  await wait(70);
  const s150 = { setBoundsDuringProcessing: ws.__sb, cards: await jsp('document.querySelectorAll(".card").length'), dbtnBehind: await jsp('document.querySelectorAll(".dbtn").length'), busy: await jsp('document.querySelectorAll(".busy").length') };
  await cap("h2-scale150-B-processing");
  manifest.scenarios.push({ scenario: "scale-150", s150, ok: s150.setBoundsDuringProcessing === 0 && s150.cards === 1 && s150.dbtnBehind === 0 && s150.busy === 1 });
  console.log("PROOF scale150 setBoundsDuringProcessing=" + s150.setBoundsDuringProcessing + " cards=" + s150.cards + " dbtnBehind=" + s150.dbtnBehind);
  }

  manifest.allActionsOk = manifest.actions.every((a) => a.ok);
  manifest.allScenariosOk = manifest.scenarios.every((s) => s.ok);
  manifest.PASS = manifest.allActionsOk && manifest.allScenariosOk;
  fs.writeFileSync(path.join(OUT, "h2-central-manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("PROOF_DONE PASS=" + manifest.PASS + " actionsOk=" + manifest.allActionsOk + " scenariosOk=" + manifest.allScenariosOk);
  try { surface.destroy(); } catch (e) {}
  app.exit(manifest.PASS ? 0 : 1);
}).catch((e) => { console.error("FATAL " + (e && e.stack || e)); app.exit(1); });
