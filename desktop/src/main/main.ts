/**
 * Agenda ID Seven Desktop — Main process
 * - Janela com renderer de paridade APK (UI igual a Web Preview 1.0.65)
 * - Fechar = esconde na Tray (nao encerra); "Sair" so pelo menu da Tray
 * - Autostart Windows opcional (sobe oculto na tray no login)
 * - Notifier + Reminder rodam aqui (sobrevivem a janela escondida)
 */
import { app, BrowserWindow, ipcMain, Notification, shell, clipboard, nativeImage, dialog, powerMonitor } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { ensureTray, recreateTray, getTrayState, destroyTray } from "./tray";
import { isAutoStart, setAutoStart } from "./autostart";
import { startNotifier } from "./notifier";
import { startNotifierA } from "./notifierA"; // F3.5.3 — produtor DURÁVEL Categoria A (todos os usuários ativos; backlog/cursor/recibos)
import { createToastAckTracker } from "./toastAck"; // F3.5.3 — prova de render do toast (paridade com o ACK da bg-window)
import { diag, diagPath } from "./diag"; // F3.3.10-DIAG (logger local; build instrumentada)
import { startReminder } from "./reminder";
import { startSlaScheduler } from "./slaScheduler"; // F3.4.3 — produtor AUTORITATIVO de SLA no main (amarelo/vermelho/crítico), sobrevive à janela oculta
import { initBgNotify, showBgNotify, stopBgNotify } from "./bgNotify"; // F3.3.10-BG (janela premium própria)
import { registerAuthIpc, getAuthUser } from "./auth"; // F3.3.56-G2 — auth server-side (token confinado ao main); F3.4.3 — papel autenticado p/ operational_block
import { registerPrewarmIpc } from "./prewarm"; // F3.3.73I6C18C — prewarm do Card Premium (IPC restrito ao /share)
import { createClockSync } from "./clockSync"; // F3.3.77A-R4B — relógio canônico via cabeçalho HTTP Date (Cloud Run read-only)
// UPDATER:BEGIN (F3.4.1A — atualizador nativo, processo main)
import { createUpdaterService } from "./updaterService";
// UPDATER:END

let mainWin: BrowserWindow | null = null;
let stopNotifier: (() => void) | null = null;
let stopReminder: (() => void) | null = null;
let slaScheduler: ReturnType<typeof startSlaScheduler> | null = null; // F3.4.3 — SLA producer autoritativo (main)
let clockSync: ReturnType<typeof createClockSync> | null = null; // F3.3.77A-R4B — relógio canônico (main)
let quitting = false;
// F3.3.70D3R10U — opts do tray centralizados (usados por startup, session-login,
// heartbeat e IPC tray-recreate; a recriacao usa SEMPRE o mesmo menu/quit).
const trayWin = () => mainWin;
const trayOpts = { isAutoStart, setAutoStart, quit: realQuit };
// UPDATER:BEGIN (F3.4.1A — instância do atualizador + teardown seguro para quitAndInstall)
let updater: ReturnType<typeof createUpdaterService> | null = null;
function updaterTeardownForInstall() {
  // Mesmo teardown do realQuit, porém SEM app.quit() (o quitAndInstall encerra e reabre).
  quitting = true;
  try { if (stopNotifier) stopNotifier(); } catch { /* */ }
  try { if (stopReminder) stopReminder(); } catch { /* */ }
  try { if (clockSync) { clockSync.stop(); clockSync = null; } } catch { /* */ }
  try { if (slaScheduler) { slaScheduler.stop(); slaScheduler = null; } } catch { /* */ } // F3.4.3
  try { stopBgNotify(); } catch { /* */ }
  try { destroyTray(); } catch { /* */ }
  diag("updater.teardownForInstall");
}
// UPDATER:END

// AUMID p/ toasts no Windows respeitarem o app
if (process.platform === "win32") app.setAppUserModelId("br.com.idseven.agenda.desktop");

// ===================================================================
// F3.3.3 — HUB de NOTIFICAÇÕES DESKTOP (local, sem provider externo).
// Canal único: se a janela está FOCADA/visível -> TOAST in-app premium
// (renderer); senão (minimizado/tray/sem foco) -> Notification NATIVA do
// SO. Dedup por dedupKey. Som por severidade só no toast (a nativa usa o
// som padrão do SO; limitação documentada). NUNCA chama FCM/Web Push/
// WhatsApp/Firestore — só Electron Notification local.
// ===================================================================
type NotifPayload = {
  eventId?: string; eventType?: string; taskId?: string; taskTitle?: string; clientName?: string;
  actorId?: string; actorName?: string; actorAvatar?: string;
  responsibleId?: string; responsibleName?: string; responsibleAvatar?: string;
  targetUserId?: string; notificationType?: string; etapa?: string; status?: string;
  title?: string; body?: string; context?: string; createdAt?: number;
  severity?: "info" | "success" | "warning" | "critical"; sound?: boolean;
  action?: { type?: string; deep?: string }; dedupKey?: string; source?: string; providerCalled?: boolean;
};
const _notifSeen = new Set<string>();
// F3.5.3 — ACK do toast: tracker do prazo de render (4s). Fallback bg/nativa quando não há prova.
const toastAck = createToastAckTracker({ onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } } });
function _appIcon(): string | undefined {
  try { return path.join(app.getAppPath(), "build", "icon.png"); } catch { return undefined; }
}
function windowActive(): boolean {
  // REGRA DE CANAL (correção de regressão): janela ABERTA e VISÍVEL ⇒ TOAST premium in-app —
  // mesmo SEM foco (usuário pode estar olhando o app atrás de outra janela). Só cai p/ a nativa
  // do SO quando minimizada/bandeja/oculta (isVisible()=false). NÃO exigir isFocused() — exigir
  // foco fazia "aberto sem foco" virar nativo genérico (a regressão reportada).
  const w = mainWin;
  return !!(w && !w.isDestroyed() && w.isVisible() && !w.isMinimized());
}
// F3.4.3 — "AGORA" CANÔNICO do produtor de SLA no main. Espelha EXATAMENTE o gate de offset do
// renderer (_slaApplyClockState): aplica o offset só para synced/degraded/stale; local_fallback/
// error ⇒ relógio local (offset 0). Assim o instante de disparo do amarelo/vermelho no MAIN é
// idêntico ao do cronômetro/visual do renderer (mesma referência canônica em todas as máquinas).
function slaNow(): number {
  try {
    const st = clockSync ? clockSync.getState() : null;
    const q = st ? st.quality : "";
    const useOffset = (q === "synced" || q === "degraded" || q === "stale");
    return Date.now() + (useOffset && st ? Math.round(st.offsetMs) : 0);
  } catch { return Date.now(); }
}
// F3.4.7 — Notification NATIVA extraída em helper: usada como fallback imediato (janela premium
// indisponível) E como fallback tardio (janela premium agendada mas SEM prova de render/ACK).
function nativeNotify(p: NotifPayload, key: string, deep: string): boolean {
  try {
    const n = new Notification({
      title: String(p.title || "Agenda ID Seven"),
      body: String(p.body || ""),
      silent: p.sound === false,
      icon: _appIcon(),
    });
    n.on("click", () => {
      diag("native.click", { dedupKey: key, deep });
      const w = mainWin;
      if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); if (deep) w.webContents.send("notif-open", deep); }
    });
    n.show();
    return true;
  } catch (e2) { diag("native.fallback.error", { err: String(((e2 as any) && (e2 as any).message) || e2) }); return false; }
}
function deliverNotification(p: NotifPayload): { ok: boolean; channel: string } {
  try {
    if (!p || typeof p !== "object") return { ok: false, channel: "none" };
    const key = String(p.dedupKey || `${p.eventType || "evt"}:${p.taskId || ""}:${p.createdAt || ""}`);
    if (_notifSeen.has(key)) { diag("deliver.dedup", { key }); return { ok: true, channel: "dedup" }; }
    diag("deliver.begin", { eventType: p.eventType, taskId: p.taskId, targetUserId: p.targetUserId, actorId: p.actorId, responsibleId: p.responsibleId, dedupKey: key, windowActive: windowActive(), visible: !!(mainWin && !mainWin.isDestroyed() && mainWin.isVisible()), minimized: !!(mainWin && !mainWin.isDestroyed() && mainWin.isMinimized()) });
    // F3.3.10 — CAPTURA p/ a Central (histórico local no renderer). CAPTURE-ONLY: encaminha o MESMO
    // payload já deduplicado, sem alterar roteamento/toast/nativa/dedup/som/severidade/destino. Nunca
    // pode impedir a entrega — por isso vem em try/catch isolado e ANTES da decisão toast×nativa.
    try { mainWin?.webContents.send("notif-history", p); } catch { /* captura nunca afeta a notificação real */ }
    const deep = (p.action && p.action.deep) ? String(p.action.deep) : "";
    // F3.4.7 — o dedup do HUB só é GRAVADO após um canal REAL aceitar a entrega. Antes, a chave era
    // marcada ANTES do resultado: uma falha silenciosa bloqueava aquela transição PARA SEMPRE
    // (contrato: nenhum bloqueio permanente de transições futuras). Falha total ⇒ chave livre ⇒
    // o produtor (slaScheduler) reentrega no próximo eval (≤60s).
    const markSeen = () => {
      _notifSeen.add(key);
      if (_notifSeen.size > 4000) { const it = _notifSeen.values(); for (let i = 0; i < 1000; i++) { const v = it.next(); if (v.done) break; _notifSeen.delete(v.value); } }
    };
    if (windowActive()) {
      mainWin?.webContents.send("notif-toast", p);
      diag("deliver.toast", { dedupKey: key, taskId: p.taskId });
      // F3.5.3 — WATCHDOG DE ACK (aditivo; roteamento/dedup 1.0.191 preservados): o renderer
      // confirma o RENDER via "notif-toast-ack" (dedupKey). Sem ACK em 4s (listener ausente, erro de
      // JS, recarga), o fallback entrega pela bg-window/nativa — a janela "aberta" deixa de perder
      // notificação em silêncio. Guarda typeof: harnesses que extraem só este corpo (fixtures f343)
      // rodam SEM o tracker e mantêm a semântica aprovada byte-a-byte.
      if (typeof toastAck !== "undefined" && toastAck) {
        toastAck.arm(key, () => {
          const bgOk2 = showBgNotify(p, () => { const l2 = nativeNotify(p, key, deep); diag("deliver.toast.noAck.bg.noAck.native", { dedupKey: key, nativeOk: l2 }); });
          let nOk2 = false;
          if (!bgOk2) nOk2 = nativeNotify(p, key, deep);
          diag("deliver.toast.noAck.fallback", { dedupKey: key, channel: bgOk2 ? "bg-window" : (nOk2 ? "native" : "none") });
        });
      }
      markSeen();
      return { ok: true, channel: "toast" };
    }
    // BACKGROUND (minimizado/oculto/bandeja) — F3.3.10-BG: a entrega visual CONFIÁVEL é a janela
    // PREMIUM própria do app (controlada pelo main, aparece mesmo com a mainWindow hidden e NÃO
    // depende da Notification nativa do Windows). A nativa do SO vira FALLBACK se a janela premium
    // não puder ser exibida — F3.4.7: OU se ela não PROVAR o render (ACK bgnotify-rendered) no
    // prazo (deixou de ser otimista). Clique → reabre a mainWindow e navega (deep link). A captura
    // p/ a Central já foi feita acima (notif-history), independente do canal.
    const bgOk = showBgNotify(p, () => {
      const lateOk = nativeNotify(p, key, deep);
      diag("deliver.bg.noAck→native", { dedupKey: key, taskId: p.taskId, nativeOk: lateOk });
    });
    let nativeOk = false;
    if (!bgOk) nativeOk = nativeNotify(p, key, deep);
    const channel = bgOk ? "bg-window" : (nativeOk ? "native" : "none");
    diag("deliver.bg", { dedupKey: key, deep, taskId: p.taskId, title: String(p.title || ""), channel, fallbackNative: !bgOk });
    if (bgOk || nativeOk) markSeen();
    return { ok: bgOk || nativeOk, channel };
  } catch (e) { diag("deliver.error", { err: String(((e as any) && (e as any).message) || e) }); return { ok: false, channel: "error" }; }
}

// F3.3.10-DIAG SELFTEST — GATED por IDSEVEN_SELFTEST=1 (NUNCA setado em produção → zero efeito).
// Prova, em Windows REAL (runner de CI), o CANAL do deliverNotification nos 3 estados, SEM
// Firestore/rede/write (payload sintético): visível→toast, minimizado→NATIVA, oculto/bandeja→NATIVA.
// Também loga Notification.isSupported(). O app se encerra sozinho ao fim. Removível (sentinela DIAG).
function runNotifSelfTest() {
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const synth = (n: number, state: string) => ({
    eventType: "selftest", source: "selftest", providerCalled: false,
    taskId: "ST" + n, taskTitle: "Selftest " + n, title: "Selftest " + n,
    body: "estado: " + state, severity: "info" as const, sound: false,
    action: { type: "board", deep: "board/" }, dedupKey: "selftest:" + n,
    targetUserId: "selftest", createdAt: Date.now(),
  });
  // failsafe: encerra o processo mesmo se algo travar (CI não pode pendurar)
  const hardExit = setTimeout(() => { try { quitting = true; app.exit(0); } catch { /* */ } }, 30000);
  (async () => {
    let stopST: (() => void) | null = null;
    try {
      diag("selftest.begin", { notificationSupported: Notification.isSupported(), platform: process.platform, aumidWin: process.platform === "win32" });
      // Liga o notifier REAL (read-only) p/ PROVAR que o listener Firestore do MAIN conecta e
      // recebe snapshot em Windows (transporte long-polling). uid sintético → não entrega nada
      // (nenhum doc casa), só comprova firestore.listen.attach + firestore.snapshot no main.
      try { stopST = startNotifier(() => mainWin, "selftest-uid", deliverNotification); diag("selftest.notifier.started", {}); }
      catch (e2) { diag("selftest.notifier.error", { err: String(((e2 as any) && (e2 as any).message) || e2) }); }
      const w = mainWin;
      if (w && !w.isDestroyed()) { w.show(); w.focus(); }
      await wait(2000);
      diag("selftest.state", { phase: "visible", windowActive: windowActive() });
      diag("selftest.deliver", { n: 1, expect: "toast", channel: deliverNotification(synth(1, "visible")).channel });
      await wait(2500);
      if (w && !w.isDestroyed()) w.minimize();
      await wait(2000);
      diag("selftest.state", { phase: "minimized", windowActive: windowActive() });
      diag("selftest.deliver", { n: 2, expect: "native", channel: deliverNotification(synth(2, "minimized")).channel });
      await wait(3000);
      if (w && !w.isDestroyed()) w.hide();
      await wait(2000);
      diag("selftest.state", { phase: "hidden(tray)", windowActive: windowActive() });
      diag("selftest.deliver", { n: 3, expect: "native", channel: deliverNotification(synth(3, "hidden")).channel });
      await wait(3000);
      diag("selftest.end", { ok: true });
    } catch (e) {
      diag("selftest.error", { err: String(((e as any) && (e as any).message) || e) });
    } finally {
      try { if (stopST) stopST(); } catch { /* */ }
      clearTimeout(hardExit);
      quitting = true;
      setTimeout(() => { try { app.exit(0); } catch { /* */ } }, 1200);
    }
  })();
}

// Locale pt-BR: faz os inputs nativos date/time exibirem dd/mm/aaaa e HH:mm.
app.commandLine.appendSwitch("lang", "pt-BR");
// F3.3.10-FIX (minimizado/bandeja) — mantém o renderer e seus timers (scan de SLA, boundary timer)
// rodando em velocidade normal quando a janela está minimizada/oculta/ocluída na bandeja. Sem isso,
// o Chromium "backgrounda" o renderer e laranja/vermelho/crítico podem atrasar/não disparar a NATIVA.
// (Complementa backgroundThrottling:false da janela — sozinho às vezes não basta.) Não altera
// roteamento/dedup/severidade/som; só garante que o tempo seja respeitado em background.
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

// Deep link idseven:// -> abre a tela "Visão do cliente" no Desktop.
// Registra o app como handler do esquema (sem backend). Em dev usa argv.
try {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("idseven", process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient("idseven");
  }
} catch { /* nao bloquear o boot por causa do registro de protocolo */ }

// Extrai "client/<id>" (ou outro alvo) de um idseven://<alvo> presente no argv/url.
function deepLinkTarget(list: string[]): string | null {
  const hit = list.find((a) => typeof a === "string" && a.indexOf("idseven://") === 0);
  if (!hit) return null;
  return hit.replace(/^idseven:\/\//, "").replace(/\/+$/, "");
}
function routeDeepLink(target: string | null) {
  if (!target || !mainWin) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  mainWin.webContents.send("notif-open", target);
}

const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
    }
    routeDeepLink(deepLinkTarget(argv));
  });
}

// macOS: deep link chega por open-url.
app.on("open-url", (_e, url) => { routeDeepLink(deepLinkTarget([url])); });

function createWindow() {
  const startHidden = process.argv.includes("--hidden");
  mainWin = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: !startHidden,
    backgroundColor: "#0A0B10",
    title: "Agenda ID Seven Desktop",
    icon: path.join(app.getAppPath(), "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  mainWin.removeMenu();
  mainWin.loadFile(path.join(app.getAppPath(), "src", "renderer", "index.html"));
  // Garante nitidez 1:1 (sem zoom acidental). Windows respeita HiDPI nativamente.
  mainWin.webContents.on("did-finish-load", () => {
    mainWin?.webContents.setZoomFactor(1.0);
    mainWin?.webContents.setVisualZoomLevelLimits(1, 1);
  });

  // Fechar = esconde na tray (nao encerra). Quit real so pelo menu da tray.
  mainWin.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWin?.hide();
      diag("window.close→hide(tray)", { quitting }); // F3.3.10-DIAG: prova que X vai p/ bandeja (não quit)
    } else {
      diag("window.close→quit", { quitting });
    }
  });
  // F3.3.10-DIAG — lifecycle (só log; não altera comportamento)
  mainWin.on("minimize", () => diag("window.minimize"));
  mainWin.on("restore", () => diag("window.restore"));
  mainWin.on("show", () => diag("window.show"));
  mainWin.on("hide", () => diag("window.hide(tray)"));
}

function realQuit() {
  quitting = true;
  if (stopNotifier) stopNotifier();
  if (stopReminder) stopReminder();
  if (clockSync) { try { clockSync.stop(); } catch { /* */ } clockSync = null; }
  if (slaScheduler) { try { slaScheduler.stop(); } catch { /* */ } slaScheduler = null; } // F3.4.3
  try { stopBgNotify(); } catch { /* */ }
  // F3.3.73I6C11 — "Sair do aplicativo" remove o icone da bandeja (evita tray-fantasma no Windows).
  try { destroyTray(); } catch { /* */ }
  diag("app.realQuit→destroyTray"); // F3.3.10-DIAG
  app.quit();
}

app.whenReady().then(() => {
  diag("app.ready", { diagPath: diagPath() }); // F3.3.10-DIAG: caminho do log impresso no próprio log
  createWindow();
  // F3.3.70D3R10U — tray via ensureTray (cria no startup; recriavel depois sem duplicar)
  ensureTray(trayWin, trayOpts);

  // F3.3.77A-R4B — RETOMADA/DESBLOQUEIO: ao voltar do sleep ou desbloquear a tela, ressincroniza o
  // relógio canônico (offset antigo pode estar defasado) e o renderer rearma as timelines de SLA.
  try {
    powerMonitor.on("resume", () => { diag("power.resume"); if (clockSync) void clockSync.requestSync("resume"); if (slaScheduler) slaScheduler.reconcile("resume"); }); // F3.4.3 — reconcilia SLA perdido no sleep
    powerMonitor.on("unlock-screen", () => { diag("power.unlock"); if (clockSync) void clockSync.requestSync("unlock"); if (slaScheduler) slaScheduler.reconcile("unlock"); }); // F3.4.3
  } catch { /* powerMonitor pode não existir em todas as plataformas */ }
  // UPDATER:BEGIN (F3.4.1A — ao retomar/desbloquear, reverifica atualização SE a verificação venceu)
  try {
    powerMonitor.on("resume", () => { if (updater) updater.maybeCheckOnResume(); });
    powerMonitor.on("unlock-screen", () => { if (updater) updater.maybeCheckOnResume(); });
  } catch { /* */ }
  // UPDATER:END

  // F3.3.10-BG — registra a janela premium de background + callback de "Abrir tarefa"
  // (reabre a mainWindow minimizada/oculta e navega via deep link). NÃO rouba foco do SO.
  initBgNotify((deep: string) => {
    const w = mainWin;
    if (w && !w.isDestroyed()) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); if (deep) w.webContents.send("notif-open", deep); }
  });

  // IPC do renderer
  registerAuthIpc(); // F3.3.56-G2 — auth-login/auth-self/auth-change-password/auth-logout/auth-session-status
  registerPrewarmIpc(); // F3.3.73I6C18C — card-prewarm (GET read-only restrito ao /share; token redigido nos logs)
  ipcMain.handle("notif-test", () => {
    new Notification({ title: "Agenda ID Seven", body: "Notificacao de teste OK." }).show();
    diag("notif-test.shown");
    return true;
  });
  // F3.3.10-DIAG — renderer envia eventos p/ o MESMO arquivo de log local (scan/Central/visibility).
  ipcMain.on("diag-log", (_e, tag: string, data?: unknown) => { try { diag("renderer." + String(tag), data); } catch { /* */ } });
  ipcMain.handle("diag-path", () => diagPath());
  // F3.3.70D3R10I — fonte unica da versao p/ o renderer (Config mostra a versao real do build)
  ipcMain.on("app-version", (e) => { try { e.returnValue = app.getVersion(); } catch { e.returnValue = "dev"; } });
  // F3.3.3 — renderer pede notificação (fluxo/SLA/bloqueio detectados no renderer).
  // O HUB decide o canal (toast in-app x nativa) e faz dedup. Sem provider externo.
  ipcMain.handle("notify", (_e, payload: NotifPayload) => deliverNotification(payload));
  // F3.5.3 — renderer confirma o RENDER do toast (dedupKey): cancela o fallback pendente.
  ipcMain.on("notif-toast-ack", (_e, key: string) => { toastAck.ack(String(key || "")); });
  // F3.5.3 — leitura de texto da área de transferência p/ o pipeline explícito de COLAGEM do
  // formulário (Legenda/Tema/Observações). SOMENTE texto simples; nunca HTML executável.
  ipcMain.handle("clipboard-read-text", () => { try { return String(clipboard.readText() || ""); } catch { return ""; } });
  ipcMain.handle("autostart-get", () => isAutoStart());
  ipcMain.handle("autostart-set", (_e, v: boolean) => { setAutoStart(v); return isAutoStart(); });
  ipcMain.handle("app-quit", () => { realQuit(); });

  // Abrir URL no app externo (WhatsApp Desktop via whatsapp://, ou browser no
  // fallback web). Retorna false se o SO nao conseguiu abrir -> renderer cai
  // para o fallback web. Evita abrir a landing intermediaria dentro do app.
  ipcMain.handle("open-external", async (_e, url: string) => {
    try { await shell.openExternal(String(url)); return true; }
    catch { return false; }
  });

  // ===== 1.0.114 — ENVIO PREMIUM (imagem real do card p/ WhatsApp) =====
  // Salva os bytes do card (JPG) em disco e devolve o caminho. Pasta padrão: Downloads.
  ipcMain.handle("save-card-image", (_e, payload: { bytes: ArrayBuffer | Uint8Array; filename: string }) => {
    try {
      const dir = app.getPath("downloads") || os.tmpdir();
      const safe = String(payload?.filename || "agenda-id-seven-card.jpg").replace(/[^A-Za-z0-9._-]/g, "_");
      const dest = path.join(dir, safe);
      fs.writeFileSync(dest, Buffer.from(payload.bytes as any));
      return { ok: true, path: dest };
    } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
  });
  // Copia a IMAGEM do card para a área de transferência (ferramenta opcional).
  // F3.3.70D3R10Z — READ-BACK: após o write, confere se o clipboard REALMENTE retém a
  // imagem; sem isso o SO pode recusar silenciosamente e o app mentiria "ok".
  ipcMain.handle("copy-card-image", (_e, bytes: ArrayBuffer | Uint8Array) => {
    try {
      const img = nativeImage.createFromBuffer(Buffer.from(bytes as any));
      if (img.isEmpty()) return { ok: false, error: "imagem vazia" };
      clipboard.writeImage(img);
      const back = clipboard.readImage();
      if (!back || back.isEmpty()) return { ok: false, error: "clipboard nao reteve a imagem" };
      return { ok: true };
    } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
  });
  // Revela o arquivo salvo no explorador de arquivos.
  ipcMain.handle("show-in-folder", (_e, p: string) => {
    try { shell.showItemInFolder(String(p)); return true; } catch { return false; }
  });
  // Diálogo "Salvar como…" (opcional) — devolve caminho escolhido + grava.
  ipcMain.handle("save-card-image-as", async (_e, payload: { bytes: ArrayBuffer | Uint8Array; filename: string }) => {
    try {
      const safe = String(payload?.filename || "agenda-id-seven-card.jpg").replace(/[^A-Za-z0-9._-]/g, "_");
      const r = await dialog.showSaveDialog({ defaultPath: safe, filters: [{ name: "Imagem", extensions: ["jpg", "jpeg", "png"] }] });
      if (r.canceled || !r.filePath) return { ok: false, canceled: true };
      fs.writeFileSync(r.filePath, Buffer.from(payload.bytes as any));
      return { ok: true, path: r.filePath };
    } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
  });
  // F3.3.70D3R10U — "Abrir imagem": grava o card em Downloads e abre no visualizador
  // padrao do SO (shell.openPath). Auto-contido: NAO abre caminho arbitrario do renderer.
  ipcMain.handle("open-card-image", async (_e, payload: { bytes: ArrayBuffer | Uint8Array; filename: string }) => {
    try {
      const dir = app.getPath("downloads") || os.tmpdir();
      const safe = String(payload?.filename || "agenda-id-seven-card.jpg").replace(/[^A-Za-z0-9._-]/g, "_");
      const dest = path.join(dir, safe);
      fs.writeFileSync(dest, Buffer.from(payload.bytes as any));
      const err = await shell.openPath(dest);
      if (err) return { ok: false, path: dest, error: String(err) };
      return { ok: true, path: dest };
    } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
  });

  // F3.3.70D3R10U — TRAY: status p/ Configuracoes (sincrono, payload minusculo) e
  // recriacao forcada pelo botao "Recriar icone da bandeja".
  ipcMain.on("tray-status", (e) => { try { e.returnValue = getTrayState(); } catch { e.returnValue = null; } });
  ipcMain.handle("tray-recreate", () => {
    const r = recreateTray(trayWin, trayOpts);
    return { ...r, state: getTrayState() };
  });

  // Deep link no cold start (app aberto pelo proprio idseven://...).
  const coldTarget = deepLinkTarget(process.argv);
  if (coldTarget && mainWin) {
    mainWin.webContents.once("did-finish-load", () => {
      setTimeout(() => mainWin?.webContents.send("notif-open", coldTarget), 600);
    });
  }

  // Renderer avisa o uid logado -> ligamos os listeners de notificacao
  ipcMain.on("session-login", (_e, uid: string) => {
    diag("session-login", { uid }); // F3.3.10-DIAG
    // F3.3.70D3R10U — garante o tray apos login (recria se sumiu; no-op se ok)
    try { ensureTray(trayWin, trayOpts); } catch { /* */ }
    if (stopNotifier) stopNotifier();
    if (stopReminder) stopReminder();
    if (slaScheduler) { try { slaScheduler.stop(); } catch { /* */ } slaScheduler = null; } // F3.4.3
    if (uid) {
      // F3.3.3 — notifier/reminder roteiam pelo HUB (ganham toast in-app quando focado,
      // mantêm a nativa quando minimizado/tray). Mesmos eventos/dedup de antes.
      // F3.4.4 — passa o papel AUTENTICADO (main, F3.4.3) p/ o roteamento de FLUXO (supervisão
      // vê-tudo) do produtor u3; sem authUser ⇒ sem privilégio vê-tudo (fail-closed).
      // F3.5.3 — Categoria A DURÁVEL (atribuição/movimentação/conclusão/reabertura p/ TODOS os
      // usuários ativos, ator incluído): backlog do 1º snapshot (recupera o perdido com o PC
      // desligado) + tempo real, com cursor/recibos/deviceId persistentes. Instância ÚNICA por
      // login, COMPOSTA no stopNotifier — logout/troca/quit/updater já a encerram pelos teardowns
      // aprovados (nenhuma linha nova nas regiões pinadas). toastAck.clear() idem (sem fallback
      // tardio cruzando usuários).
      const _stopEventNew = startNotifier(() => mainWin, uid, deliverNotification, getAuthUser);
      const _notifierA = startNotifierA(uid, deliverNotification);
      stopNotifier = () => { try { _stopEventNew(); } catch { /* */ } try { _notifierA.stop(); } catch { /* */ } try { toastAck.clear(); } catch { /* */ } };
      // F3.3.77A-R4B — RELÓGIO CANÔNICO: liga a sincronização (main) via cabeçalho HTTP Date do
      // getUserSelf (Cloud Run, read-only, SEM auth ⇒ zero mutação). Empurra o offset ao renderer,
      // que o aplica em canonicalNowMs()/_slaClockOffsetMs e rearma as timelines de SLA.
      if (clockSync) { try { clockSync.stop(); } catch { /* */ } }
      clockSync = createClockSync({
        emit: (s) => { try { const w = mainWin; if (w && !w.isDestroyed()) w.webContents.send("clock-state", s); } catch { /* */ } },
        onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } },
      });
      clockSync.start();
      // F3.4.3 — PRODUTOR AUTORITATIVO DE SLA no MAIN (amarelo/vermelho/crítico). Reaproveita o
      // listener Firestore long-polling (main, nunca suspenso), usa o MESMO "agora" canônico do
      // renderer (slaNow → offset do clockSync) e entrega pelo MESMO HUB (deliverNotification →
      // toast quando visível / bg-window quando oculto). reconcile('boot') entrega os boundaries
      // já vencidos (ex.: app reaberto após o prazo) exatamente uma vez (seen-set persistente).
      // authUser: papel AUTENTICADO (auth-core getUserSelf/login), usado só p/ o gate canSeeAll do
      // operational_block — nunca o role do renderer, nunca a coleção users, nunca Rules/backend.
      slaScheduler = startSlaScheduler(() => uid, deliverNotification, { now: slaNow, authUser: getAuthUser });
      slaScheduler.reconcile("boot");
      // UPDATER:BEGIN (F3.4.1A — política de verificação item 2: após restauração da sessão)
      if (updater) updater.checkAuto("session-restore");
      // UPDATER:END
    }
  });
  ipcMain.on("session-logout", () => {
    diag("session-logout"); // F3.3.10-DIAG
    if (stopNotifier) { stopNotifier(); stopNotifier = null; }
    if (stopReminder) { stopReminder(); stopReminder = null; }
    if (clockSync) { try { clockSync.stop(); } catch { /* */ } clockSync = null; }
    if (slaScheduler) { try { slaScheduler.stop(); } catch { /* */ } slaScheduler = null; } // F3.4.3
  });
  // F3.3.77A-R4B — o renderer consulta/força a sincronização do relógio (sem expor token/URL/headers).
  ipcMain.handle("clock-get-state", () => (clockSync ? clockSync.getState() : null));
  ipcMain.handle("clock-request-sync", () => (clockSync ? clockSync.requestSync("renderer") : null));
  // UPDATER:BEGIN (F3.4.1A — atualizador nativo: instância + IPC restrito + verificação pós-ready)
  updater = createUpdaterService({
    getWindow: () => mainWin,
    onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } },
    beforeInstall: () => updaterTeardownForInstall(),
  });
  updater.start();
  ipcMain.handle("updater-get-state", () => (updater ? updater.getState() : null));
  ipcMain.handle("updater-check", () => (updater ? updater.check("manual") : { ok: false, reason: "no_updater" }));
  ipcMain.handle("updater-download", () => (updater ? updater.download() : { ok: false, reason: "no_updater" }));
  ipcMain.handle("updater-install", () => (updater ? updater.installAndRestart() : { ok: false, reason: "no_updater" }));
  ipcMain.handle("updater-defer", () => (updater ? updater.defer() : { ok: false }));
  // Política de verificação (item 1): após app.ready. (Respeita intervalo de 6h + guarda de in-flight.)
  updater.checkAuto("app-ready");
  // UPDATER:END

  // F3.3.10-DIAG — HEARTBEAT do MAIN: prova que o processo principal (e o notifier) seguem VIVOS
  // com a janela minimizada/oculta/bandeja. Se após uma atribuição em background não houver
  // firestore.snapshot mas houver main.alive, isola "listener silencioso" de "processo morto".
  // Só log local (sem rede/Firestore/efeito). Removível com as sentinelas F3.3.10-DIAG.
  setInterval(() => {
    try {
      const w = mainWin;
      // F3.3.70D3R10U — watchdog do tray: se sumiu (ex.: Explorer reiniciou), recria.
      // F3.3.73I6C11 — NAO recria durante o quit (senao o destroyTray do realQuit seria desfeito).
      const ts = getTrayState();
      if (!quitting && !ts.created) { try { ensureTray(trayWin, trayOpts); } catch { /* */ } }
      diag("main.alive", {
        notifier: !!stopNotifier, reminder: !!stopReminder,
        visible: !!(w && !w.isDestroyed() && w.isVisible()),
        minimized: !!(w && !w.isDestroyed() && w.isMinimized()),
        tray: ts.created, trayIconEmpty: ts.iconEmpty,
      });
    } catch { /* heartbeat de diagnóstico nunca pode quebrar o app */ }
  }, 30000);

  // F3.3.10-DIAG SELFTEST — só roda sob IDSEVEN_SELFTEST=1 (prova de canal em Windows REAL no CI).
  if (process.env.IDSEVEN_SELFTEST === "1") { try { runNotifSelfTest(); } catch { /* */ } }
});

// Nao encerrar quando todas as janelas fecharem (vivemos na tray).
app.on("window-all-closed", (e: any) => { if (!quitting) e.preventDefault?.(); });
app.on("before-quit", () => { quitting = true; });
