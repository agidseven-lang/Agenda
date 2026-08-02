/**
 * F3.5.4L — slaReminderWindow.ts — SUPERFÍCIE ELECTRON do lembrete central (usada pelo main).
 * =====================================================================================
 * Janela ÚNICA, central no monitor ativo, always-on-top ("screen-saver"), showInactive (não rouba
 * foco), focusable:false + acceptFirstMouse (clicável), skipTaskbar, visível em todas as áreas de
 * trabalho e sobre tela cheia, SEM frame/X, SEM auto-close. Alt+F4 bloqueado até o OK: interceptamos
 * 'close' e só permitimos quando `acknowledged` (setado pelo controller via close()).
 *
 * Prova de render (mesmo contrato do bgNotify): se o card não sinalizar 'slareminder-rendered' em
 * ACK_TIMEOUT_MS, o onNoRender dispara (fallback nativo) — cobre o caso de overlay bloqueado por
 * app em tela cheia exclusiva.
 *
 * Sons: lidos UMA vez do pacote (fs funciona dentro do app.asar) e convertidos p/ data:audio/wav;base64
 * — 100% local, sem rede/stream/download em runtime, sem depender de path de mídia no asar.
 */
import { app, BrowserWindow, ipcMain, screen, Notification } from "electron";
import path from "path";
import fs from "fs";
import { diag } from "./diag";
import type { ReminderSurface, ReminderView, CentralView, DecisionInput, DecisionPublicResult, CheckinDecisionInput, CheckinPublicResult } from "./slaReminder";

const WIDTH = 460;
const ACK_TIMEOUT_MS = 4000;

export function loadReminderSounds(): { warning: string; critical: string } {
  const read = (name: string): string => {
    try {
      const p = path.join(app.getAppPath(), "src", "renderer", "sounds", name);
      const b = fs.readFileSync(p);
      return "data:audio/wav;base64," + b.toString("base64");
    } catch { return ""; }
  };
  return { warning: read("sla-warning.wav"), critical: read("sla-critical.wav") };
}

export type SlaReminderSurfaceDeps = {
  onAck: (key: string, windowState: string) => void;   // OK do usuário
  onOpenTask: (deep: string) => void;                  // clique "Abrir tarefa" (traz Agenda + abre)
  nativeNotify?: (view: CentralView) => boolean;       // fallback nativo (injeta o do main)
  onLog?: (tag: string, data?: unknown) => void;
  // F3.5.4P — decisão do responsável
  onDecide?: (input: DecisionInput) => Promise<DecisionPublicResult>;  // decisão → transação (renderer)
  onDismiss?: (key: string) => void;                                   // fecha após mensagem informativa
  onResolveHelp?: (taskId: string, key: string) => Promise<any>;       // resolve destinatário da ajuda (renderer)
  // F3.5.4Q — check-in de tarefa parada
  onCheckinDecide?: (input: CheckinDecisionInput) => Promise<CheckinPublicResult>; // 4 decisões → transação (renderer)
  onCheckinDraft?: (key: string, draft: any) => void;                  // rascunho (suspend/restore)
  onCheckinDismiss?: (key: string) => void;                            // fecha o check-in após mensagem
  onCheckinResolveHelp?: (taskId: string, key: string) => Promise<any>; // resolve destinatário da ajuda (reusa 1.0.206)
};

export function createSlaReminderSurface(deps: SlaReminderSurfaceDeps): ReminderSurface & { destroy: () => void; ackState: () => string } {
  const log = deps.onLog || ((t: string, d?: unknown) => { try { diag(t, d as any); } catch { /* */ } });
  let win: BrowserWindow | null = null;
  let acknowledged = false;         // libera o 'close' (Alt+F4) só após ack
  let curKey = "";
  let renderTimer: any = null;
  let onNoRenderCb: (() => void) | null = null;
  let lastFocusedBefore: BrowserWindow | null = null;
  let winId = 0;                    // F3.5.4U-H1 — id da janela ÚNICA (observabilidade central_alert.*)
  // F3.5.4U-H2 (processamento atômico): enquanto o renderer processa uma ação (spinner "Registrando…"),
  // o main CONGELA os bounds — NENHUM setBounds/move na janela transparente visível → elimina o artefato
  // de sobreposição (backing-store antigo do Windows/DWM aparecendo atrás do card durante o redimensionamento).
  let processing = false;
  // F3.5.4U-H2 (fila): hide COALESCIDO. close() agenda o hide p/ o próximo tick; se um show() (avanço da fila /
  // promoção) ocorrer antes, o hide é CANCELADO e a MESMA janela MORFA o conteúdo — sem hide→show (sem flash do
  // card anterior no backing-store). Fila vazia (nenhum show em seguida) ⇒ o hide agendado realmente esconde.
  let pendingHide = false;

  function winState(): string { return "reminder"; }
  function appVer(): string { try { return app.getVersion(); } catch { return "dev"; } }
  // F3.5.4U-H1 (Defeito 2) — observabilidade SANITIZADA do ciclo de vida da janela central (sem título/nome/etc.).
  function cobs(event: string, extra?: Record<string, unknown>): void {
    try { log(event, Object.assign({ windowCount: (win && !win.isDestroyed()) ? 1 : 0, windowId: winId, appVersion: appVer(), timestamp: Date.now() }, extra || {})); } catch { /* */ }
  }

  function ensure(): BrowserWindow {
    // F3.5.4U-H1 (Defeito 2) — GARANTIA de UMA ÚNICA janela central: reutiliza a existente (nunca cria a 2ª).
    if (win && !win.isDestroyed()) { acknowledged = false; cobs("central_alert.window_reused"); return win; }
    acknowledged = false;
    winId++;
    win = new BrowserWindow({
      width: WIDTH, height: 260, show: false, frame: false, transparent: true,
      resizable: false, movable: false, minimizable: false, maximizable: false, closable: true,
      fullscreenable: false, skipTaskbar: true, focusable: false, hasShadow: false,
      alwaysOnTop: true, acceptFirstMouse: true, title: "Agenda ID Seven — Lembrete de SLA",
      backgroundColor: "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "..", "preload", "slareminder-preload.js"),
        contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
      },
    });
    try { win.setAlwaysOnTop(true, "screen-saver"); } catch { /* */ }
    try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true } as any); } catch { /* */ }
    try { win.removeMenu(); } catch { /* */ }
    // Alt+F4 / qualquer close antes do OK ⇒ bloqueado
    win.on("close", (e) => { if (!acknowledged) { try { e.preventDefault(); } catch { /* */ } log("sla.reminder.close.blocked", { key: mask(curKey) }); } });
    win.loadFile(path.join(app.getAppPath(), "src", "renderer", "slareminder.html"));
    cobs("central_alert.window_created");
    return win;
  }

  function center(h: number): void {
    if (!win || win.isDestroyed()) return;
    // F3.5.4U-H2: NÃO redimensionar/mover a janela transparente enquanto uma ação está em PROCESSAMENTO.
    // Este early-return cobre TODAS as origens de setBounds (IPC slareminder-resize E o center() direto do
    // push()/show/promote/refreshCounter/task_completed/noteCompleted), não só o handler do IPC.
    if (processing) return;
    let disp;
    try { disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()); } catch { /* */ }
    try { if (!disp) disp = screen.getPrimaryDisplay(); } catch { /* */ }
    const wa = (disp && disp.workArea) || { x: 0, y: 0, width: 1280, height: 800 };
    const height = Math.max(180, Math.min(Math.round(h) || 260, wa.height - 40));
    const x = Math.round(wa.x + (wa.width - WIDTH) / 2);
    const y = Math.round(wa.y + (wa.height - height) / 2);
    try { win.setBounds({ x, y, width: WIDTH, height }); } catch { /* */ }
  }

  function armRenderProof(key: string): void {
    clearRenderProof();
    renderTimer = setTimeout(() => {
      renderTimer = null;
      log("sla.reminder.render.timeout", { key: mask(key) });
      const cb = onNoRenderCb; onNoRenderCb = null;
      if (cb) { try { cb(); } catch { /* */ } }
    }, ACK_TIMEOUT_MS);
  }
  function clearRenderProof(): void { if (renderTimer) { try { clearTimeout(renderTimer); } catch { /* */ } renderTimer = null; } }

  function push(view: CentralView): void {
    // F3.5.4U-H2: um show/promoção CANCELA um hide agendado ⇒ a MESMA janela MORFA o conteúdo (sem hide→show,
    // sem flash do card anterior). wasVisible é medido ANTES de ensure() (ensure pode criar a janela oculta).
    pendingHide = false;
    const wasVisible = !!(win && !win.isDestroyed() && win.isVisible());
    const w = ensure();
    curKey = view.key;
    // F3.5.4P: com decisões ON a janela precisa ser focável (inputs de texto de bloqueio/ajuda). showInactive
    // continua evitando roubo de foco NA EXIBIÇÃO; o foco só ocorre se o usuário CLICAR para digitar.
    // Flag OFF ⇒ focusable:false (idêntico à 1.0.205). F3.5.4Q: o check-in SEMPRE é focável (tem inputs).
    try { w.setFocusable(!!(view && ((view as any).decisionsEnabled || (view as any).kind === "checkin"))); } catch { /* */ }
    const send = () => { try { w.webContents.send("slareminder-card", view); } catch { /* */ } };
    if (w.webContents.isLoading()) { w.webContents.once("did-finish-load", send); } else { send(); }
    try { w.showInactive(); } catch { /* */ }
    // F3.5.4U-H2: só centraliza no PRIMEIRO show (oculta→visível). Num morfar de janela já visível (avanço da
    // fila/promoção) NÃO força center(260); o renderer ajusta a altura via resizeSelf (e center() é congelado
    // enquanto processing). Evita o setBounds "260→altura real" que redimensiona a janela visível a cada show.
    if (!wasVisible) center(260);
  }

  const surface: ReminderSurface & { destroy: () => void; ackState: () => string } = {
    show(view: CentralView): void {
      // guarda o foco atual só p/ garantir que NÃO roubamos foco (showInactive já garante)
      try { lastFocusedBefore = BrowserWindow.getFocusedWindow(); void lastFocusedBefore; } catch { /* */ }
      push(view);
      armRenderProof(view.key);
    },
    promote(view: ReminderView): void { push(view); armRenderProof(view.key); },
    close(): void {
      // F3.5.4U-H1 (Defeito 2): REUTILIZAR a janela — HIDE, não destruir. Destruir+recriar entre itens da fila
      // recriava a BrowserWindow e a mostrava (showInactive) ANTES do card pintar → janela transparente vazia
      // (retângulo/"2ª notificação" preta atrás). Com hide, a janela ÚNICA persiste (renderer vivo) e o próximo
      // item apenas MORFA o conteúdo. Teardown real (logout/quit) segue em destroy().
      // F3.5.4U-H2 (fila): hide COALESCIDO. Agenda o hide p/ o próximo tick; se um show()/promote ocorrer antes
      // (avanço da fila), push() zera pendingHide e o hide é CANCELADO — a MESMA janela MORFA o conteúdo (sem
      // hide→show, sem flash do backing-store do card anterior). Fila vazia ⇒ o hide agendado esconde de fato.
      clearRenderProof();
      acknowledged = true; onNoRenderCb = null; curKey = ""; processing = false;
      pendingHide = true;
      const doHide = () => { pendingHide = false; try { if (win && !win.isDestroyed() && win.isVisible()) win.hide(); } catch { /* */ } };
      try { setImmediate(() => { if (pendingHide) doHide(); }); } catch { doHide(); }
      cobs("central_alert.closed");
    },
    isOpen(): boolean { return !!(win && !win.isDestroyed() && win.isVisible()); },
    native(view: CentralView): boolean {
      if (deps.nativeNotify) { try { return deps.nativeNotify(view); } catch { return false; } }
      try {
        const isCheckin = (view as any).kind === "checkin";
        const title = isCheckin
          ? ("Check-in de atividade — " + ((view as any).taskTitle || "Tarefa"))
          : ((view as ReminderView).title + " — " + (view.taskTitle || "SLA"));
        const body = isCheckin
          ? ("A tarefa permanece sem uma atualização registrada há " + ((view as any).sinceText || "") + ". Esta tarefa ainda está sendo executada?")
          : ((view as ReminderView).body || "");
        const n = new Notification({ title, body, silent: false });
        n.on("click", () => { try { deps.onOpenTask(view.deep); } catch { /* */ } });
        (n as any).on && (n as any).on("close", () => { /* nativa fechada não reconhece: modal exigido no unlock */ });
        n.show();
        return true;
      } catch { return false; }
    },
    onNoRender(key: string, cb: () => void): void { onNoRenderCb = cb; if (curKey === key && !renderTimer) armRenderProof(key); },
    destroy(): void { clearRenderProof(); acknowledged = true; cobs("central_alert.destroyed"); if (win && !win.isDestroyed()) { try { win.destroy(); } catch { /* */ } } win = null; },
    ackState(): string { return winState(); },
  };

  // IPC do card (registrado uma vez)
  ipcMain.on("slareminder-rendered", (_e, key) => { if (String(key || "") === curKey) { clearRenderProof(); log("sla.reminder.rendered", { key: mask(curKey) }); cobs("central_alert.render_ack"); } });
  ipcMain.on("slareminder-resize", (_e, h) => { center(Number(h) || 260); });
  // F3.5.4U-H2 — o renderer sinaliza início/fim do PROCESSAMENTO (spinner "Registrando…"). Enquanto true,
  // center() congela os bounds (nenhum setBounds/move na janela transparente visível) — mata o artefato de
  // sobreposição do redimensionamento durante o clique. Sempre liberado no restore/commit (renderer) e no close().
  ipcMain.on("slareminder-set-processing", (_e, on) => { processing = !!on; });
  // F3.5.4U-H2 — PROVA SANITIZADA no clique: contagens de DOM (renderer) + contagem de janelas centrais (main).
  // NUNCA nome/título/cliente/UID/e-mail/conteúdo — apenas números e enums (actionType/rendererState).
  ipcMain.on("slareminder-obs", (_e, p) => {
    try {
      const o = (p || {}) as Record<string, unknown>;
      let bwc = 0;
      try { bwc = BrowserWindow.getAllWindows().filter((w) => { try { return /Lembrete de SLA/.test(w.getTitle()); } catch { return false; } }).length; } catch { /* */ }
      cobs("central_alert.action_received", {
        actionType: String((o.actionType as string) || ""),
        cardElementCount: Number(o.cardElementCount) || 0,
        visibleCardCount: Number(o.visibleCardCount) || 0,
        processingLayerCount: Number(o.processingLayerCount) || 0,
        browserWindowCount: bwc,
        rendererState: String((o.rendererState as string) || ""),
      });
    } catch { /* */ }
  });
  ipcMain.on("slareminder-ok", (_e, key) => { const k = String(key || ""); log("sla.reminder.ok.click", { key: mask(k) }); try { deps.onAck(k, winState()); } catch (e) { log("sla.reminder.ok.error", { err: String((e as any) && (e as any).message || e) }); } });
  ipcMain.on("slareminder-open", (_e, deep) => { try { deps.onOpenTask(String(deep || "")); } catch { /* */ } });

  // F3.5.4P — decisão do responsável (transação), dismiss e resolução de destinatário da ajuda.
  ipcMain.on("slareminder-decide", async (_e, payload) => {
    if (!deps.onDecide) return;
    let result: DecisionPublicResult;
    try { result = await deps.onDecide((payload || {}) as DecisionInput); }
    catch (e) { log("sla.decision.handler.error", { err: String((e as any) && (e as any).message || e) }); result = { status: "error", error: "handler" }; }
    try { if (win && !win.isDestroyed()) win.webContents.send("slareminder-result", result); } catch { /* */ }
    // INICIAR AGORA: abre a tarefa SÓ após o commit confirmado (nunca antes).
    try { if (result && result.status === "committed" && result.decisionType === "start_now" && result.deep) deps.onOpenTask(String(result.deep)); } catch { /* */ }
  });
  ipcMain.on("slareminder-dismiss", (_e, key) => { try { if (deps.onDismiss) deps.onDismiss(String(key || "")); } catch { /* */ } });
  ipcMain.on("slareminder-resolve-help", async (_e, req) => {
    if (!deps.onResolveHelp) return;
    const taskId = String((req && req.taskId) || ""); const key = String((req && req.key) || "");
    let cands: any = { eligible: [], reason: "none" };
    try { cands = await deps.onResolveHelp(taskId, key); } catch (e) { log("sla.decision.help.resolve.error", { err: String((e as any) && (e as any).message || e) }); }
    try { if (win && !win.isDestroyed()) win.webContents.send("slareminder-help-candidates", cands || { eligible: [], reason: "none" }); } catch { /* */ }
  });

  // F3.5.4Q — CHECK-IN DE TAREFA PARADA: 4 decisões (transação), rascunho, dismiss, resolução de ajuda.
  // ("Abrir tarefa" reusa 'slareminder-open' — abre a tarefa SEM encerrar o ciclo; o card se recolhe no renderer.)
  ipcMain.on("slareminder-checkin-decide", async (_e, payload) => {
    if (!deps.onCheckinDecide) return;
    let result: CheckinPublicResult;
    try { result = await deps.onCheckinDecide((payload || {}) as CheckinDecisionInput); }
    catch (e) { log("task.idle.handler.error", { err: String((e as any) && (e as any).message || e) }); result = { status: "error", error: "handler" }; }
    try { if (win && !win.isDestroyed()) win.webContents.send("slareminder-checkin-result", result); } catch { /* */ }
    // "SIM, estou trabalhando" e "Devolver para A Fazer": abre a tarefa SÓ após o commit confirmado.
    try { if (result && result.status === "committed" && (result.responseType === "working" || result.responseType === "return_to_todo") && result.deep) deps.onOpenTask(String(result.deep)); } catch { /* */ }
  });
  ipcMain.on("slareminder-checkin-draft", (_e, req) => { try { if (deps.onCheckinDraft) deps.onCheckinDraft(String((req && req.key) || ""), (req && req.draft) || {}); } catch { /* */ } });
  ipcMain.on("slareminder-checkin-dismiss", (_e, key) => { try { if (deps.onCheckinDismiss) deps.onCheckinDismiss(String(key || "")); } catch { /* */ } });
  ipcMain.on("slareminder-checkin-resolve-help", async (_e, req) => {
    if (!deps.onCheckinResolveHelp) return;
    const taskId = String((req && req.taskId) || ""); const key = String((req && req.key) || "");
    let cands: any = { eligible: [], reason: "none" };
    try { cands = await deps.onCheckinResolveHelp(taskId, key); } catch (e) { log("task.idle.help.resolve.error", { err: String((e as any) && (e as any).message || e) }); }
    try { if (win && !win.isDestroyed()) win.webContents.send("slareminder-checkin-help-candidates", cands || { eligible: [], reason: "none" }); } catch { /* */ }
  });

  return surface;
}

function mask(s: string): string { const v = String(s || ""); return v.length <= 8 ? v : v.slice(0, 4) + "…" + v.slice(-4); }
