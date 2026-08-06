/**
 * Agenda ID Seven Desktop — Main process
 * - Janela com renderer de paridade APK (UI igual a Web Preview 1.0.65)
 * - Fechar = esconde na Tray (nao encerra); "Sair" so pelo menu da Tray
 * - Autostart Windows opcional (sobe oculto na tray no login)
 * - Notifier + Reminder rodam aqui (sobrevivem a janela escondida)
 */
import { app, BrowserWindow, ipcMain, Notification, shell, clipboard, nativeImage, dialog, powerMonitor, screen, Menu } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto"; // F3.5.5A — deviceHash estável (sha256 do userData; nunca caminho em claro)
import { ensureTray, recreateTray, getTrayState, destroyTray } from "./tray";
import { isAutoStart, setAutoStart } from "./autostart";
import { startNotifier } from "./notifier";
import { startNotifierA } from "./notifierA"; // F3.5.3 — produtor DURÁVEL Categoria A (todos os usuários ativos; backlog/cursor/recibos)
import { createToastAckTracker } from "./toastAck"; // F3.5.3 — prova de render do toast (paridade com o ACK da bg-window)
import { diag, diagPath } from "./diag"; // F3.3.10-DIAG (logger local; build instrumentada)
import { attachEditContextMenu } from "./editContextMenu"; // F3.5.5D — menu de contexto nativo de edição (roles PT-BR; só campos editáveis)
import { startReminder } from "./reminder";
import { startSlaScheduler } from "./slaScheduler"; // F3.4.3 — produtor AUTORITATIVO de SLA no main (amarelo/vermelho/crítico), sobrevive à janela oculta
import { createUserSlaSeen } from "./slaSeenUser"; // F3.5.4-C3 — seen de SLA POR USUÁRIO (uid|dedupKey; legado honrado) injetado SEM tocar no scheduler
import { initBgNotify, showBgNotify, stopBgNotify, bgStatus, updateBgGroup } from "./bgNotify"; // F3.3.10-BG (janela premium própria); F3.5.4O — updateBgGroup (atualização de grupo comum)
import { registerAuthIpc, getAuthUser } from "./auth"; // F3.3.56-G2 — auth server-side (token confinado ao main); F3.4.3 — papel autenticado p/ operational_block
import { registerPrewarmIpc } from "./prewarm"; // F3.3.73I6C18C — prewarm do Card Premium (IPC restrito ao /share)
import { createClockSync } from "./clockSync"; // F3.3.77A-R4B — relógio canônico via cabeçalho HTTP Date (Cloud Run read-only)
import { listen as fbListen, setListenHealthObserver } from "./firebase"; // F3.5.4L — escuta read-only p/ "tarefa concluída com modal aberto" (sessão); F3.5.4N — observador de saúde do listener
import { createListenerWatchdog } from "./listenerWatchdog"; // F3.5.4N — SUPERVISOR + ÚLTIMO RECURSO (firebase.ts é o 1º reconectador)
import { createStartupPrefs } from "./startupPrefs"; // F3.5.4N — iniciar com o Windows (default-ON 1x; SO é a verdade; verify)
import { createNotificationGrouping } from "./notificationGrouping"; // F3.5.4O — AGRUPAMENTO das notificações COMUNS (controlador puro; após dedup individual, antes da superfície comum)
import { createSlaReminderController, classifyReminderLevel } from "./slaReminder"; // F3.5.4L — lembrete CENTRAL persistente de SLA (amarelo/vermelho)
import { createSlaReminderSurface, loadReminderSounds } from "./slaReminderWindow"; // F3.5.4L — superfície Electron (janela central, som local)
import { createTaskIdleStore } from "./taskIdleStore"; // F3.5.4Q — store durável do check-in (recibo de ciclo + fila offline, isolado)
import { startTaskIdleScheduler } from "./taskIdleScheduler"; // F3.5.4Q — produtor ISOLADO do check-in de tarefa parada
import { createExecutionOrchestrator } from "./executionOrchestrator"; // F3.5.5A — orquestrador de execução (acoplado ao taskIdleScheduler)
import { authedBackendPost } from "./auth"; // F3.5.5A — claim/resposta server-side (token confinado ao auth-core)
import { createSlaReminderStore } from "./slaReminderStore"; // F3.5.4L — recibo de reconhecimento (OK) + pendentes persistentes
// UPDATER:BEGIN (F3.4.1A — atualizador nativo, processo main)
import { createUpdaterService } from "./updaterService";
// UPDATER:END

let mainWin: BrowserWindow | null = null;
let stopNotifier: (() => void) | null = null;
let stopReminder: (() => void) | null = null;
let slaScheduler: ReturnType<typeof startSlaScheduler> | null = null; // F3.4.3 — SLA producer autoritativo (main)
let clockSync: ReturnType<typeof createClockSync> | null = null; // F3.3.77A-R4B — relógio canônico (main)
let quitting = false;
// F3.5.4K — ENTREGA EM QUALQUER ESTADO DA JANELA. Estado do SO (lock) + fila de deep-link + handle da
// Categoria A + telemetria SANITIZADA da última entrega (painel Configurações → Notificações). Módulo-
// escopo porque a AUTORIDADE da entrega em segundo plano é o MAIN (sobrevive a foco/min/tray/lock).
let sessionLocked = false;
let pendingDeep: string | null = null;
let notifierAHandle: { stop: () => void; reconcile: (reason?: string) => void } | null = null;
const notifTele = { lastAt: 0, lastChannel: "", lastEventType: "", lastFailAt: 0, lastFailReason: "" };
// F3.5.4L — lembrete CENTRAL persistente de SLA (amarelo/vermelho). Controlador (fila/promoção/ack/
// persistência/lock) + superfície Electron (janela central). Uma instância; o uid logado filtra a
// reexibição de pendentes. Sons locais lidos UMA vez do pacote (data URI).
let slaReminderCtl: ReturnType<typeof createSlaReminderController> | null = null;
// F3.5.5C-H2 — SNAPSHOT CANÔNICO VIVO de tasks (Barreiras 2/3): alimentado pela MESMA escuta
// fbListen("tasks") da sessão; 'ready' só após o 1º snapshot — antes disso o gate responde
// 'unknown' e NENHUM modal bloqueante sai do cache local.
const slaTaskMap = new Map<string, any>();
let slaTaskMapReady = false;
let currentUid = "";
let slaReminderSounds: { warning: string; critical: string } = { warning: "", critical: "" };
let stopSlaWatch: (() => void) | null = null; // escuta read-only de conclusão (tarefa concluída c/ modal aberto)
const slaReminderTele = { lastShownAt: 0, lastLevel: "", lastAckAt: 0, queueLen: 0 };
// F3.5.4N — INICIALIZAÇÃO COM O WINDOWS + SUPERVISOR/ÚLTIMO RECURSO do canal de notificações.
// O reconectador PRIMÁRIO permanece no firebase.ts (re-attach 5s→60s, timer ÚNICO por coleção). O
// watchdog SÓ observa os sinais reais e, em falha SUSTENTADA, faz UM restart de último recurso (single-
// active). netOnline vem do renderer (navigator.onLine + eventos, sinal REAL do SO). selfHealingEnabled
// (item 17) desliga SOMENTE a autocorreção (firebase segue reconectando). Telemetria SANITIZADA p/ o
// painel Configurações → Notificações → Diagnóstico (itens 16/18).
let listenerWatchdog: ReturnType<typeof createListenerWatchdog> | null = null;
let startupPrefs: ReturnType<typeof createStartupPrefs> | null = null;
let netOnline = true;
let selfHealingEnabled = true;
const selfHealTele = { lastAlertAt: 0, lastReasonCode: "", alerts: 0, lastRestartAt: 0, restarts: 0, lastReconcileAt: 0, reconciles: 0 };
// F3.5.4O — AGRUPAMENTO INTELIGENTE DAS NOTIFICAÇÕES COMUNS. Controlador PURO (autoridade no
// MAIN). A 1ª notificação comum de <destinatário+tarefa> aparece em tempo real; as seguintes,
// dentro da janela de 5s, ATUALIZAM a MESMA superfície (contador + lista) — sem 2ª janela, sem
// repetir o som, sem roubar foco. Roda APÓS o dedup individual (_notifSeen) e a captura no sino
// (notif-history, POR EVENTO), e ANTES da superfície visual comum (toast/premium). SLA/locked/
// crítico/desconhecido ⇒ passthrough (1.0.204). Flag notificationCommonGroupingEnabled (default
// ON): OFF ⇒ passthrough sempre. Telemetria SANITIZADA p/ o painel Configurações → Notificações.
let notificationGrouping: ReturnType<typeof createNotificationGrouping> | null = null;
let groupingEnabled = true;
const groupTele = { updates: 0, lastUpdateAt: 0, lastOpenAt: 0, opens: 0 };
// F3.5.4U — LAYOUT PREMIUM das notificações COMUNS (default ON). Presentation-only: a flag só liga/desliga
// a APRESENTAÇÃO nas superfícies (toast/janela premium). Roteamento/entrega/dedup/recibos/agrupamento/
// destinatários permanecem IDÊNTICOS à 1.0.208. Propagada às superfícies pelo carimbo _premiumCommon.
let premiumCommonEnabled = true;
// F3.5.4P — AÇÕES DE DECISÃO no alerta de SLA. Flag default ON; OFF ⇒ só OK (1.0.205). Telemetria SANITIZADA.
let slaDecisionActionsEnabled = true;
const slaDecisionTele = { committed: 0, alreadyDecided: 0, queued: 0, failed: 0, lastAt: 0, lastType: "" };
// F3.5.4Q — DETECÇÃO DE TAREFA PARADA (check-in): produtor isolado + store durável + flag (default ON) + telemetria sanitizada
let taskIdleScheduler: ReturnType<typeof startTaskIdleScheduler> | null = null;
let taskIdleStore: ReturnType<typeof createTaskIdleStore> | null = null;
let taskIdleDetectionEnabled = true;
const taskIdleTele = { shown: 0, working: 0, blocked: 0, help: 0, returned: 0, lastAt: 0, lastType: "" };
// F3.5.5A — ACOMPANHAMENTO INTELIGENTE DE EXECUÇÃO: orquestrador acoplado + config OFF/SHADOW/ACTIVE
// (default OFF pós-update) + endpoints server-side de claim/resposta (transação atômica, relógio do servidor).
let executionOrch: ReturnType<typeof createExecutionOrchestrator> | null = null;
const ET_CLAIM_URL = process.env.IDS_ET_CLAIM_URL || "https://claimexecutioncheckpoint-de36pi7vza-uc.a.run.app";
const ET_RESPOND_URL = process.env.IDS_ET_RESPOND_URL || "https://respondexecutioncheckpoint-de36pi7vza-uc.a.run.app";
let _etDeviceHash = "";
function executionDeviceHash(): string {
  if (!_etDeviceHash) { try { _etDeviceHash = crypto.createHash("sha256").update(app.getPath("userData")).digest("hex").slice(0, 32); } catch { _etDeviceHash = "0".repeat(32); } }
  return _etDeviceHash;
}
let _etSound = "";
function executionCheckinSound(): string {
  if (_etSound) return _etSound;
  try { const p = path.join(app.getAppPath(), "src", "renderer", "sounds", "execution-checkin.wav"); _etSound = "data:audio/wav;base64," + fs.readFileSync(p).toString("base64"); } catch { _etSound = ""; }
  return _etSound;
}
// F3.3.70D3R10U — opts do tray centralizados (usados por startup, session-login,
// heartbeat e IPC tray-recreate; a recriacao usa SEMPRE o mesmo menu/quit).
const trayWin = () => mainWin;
const trayOpts = { isAutoStart, setAutoStart, quit: realQuit };
// UPDATER:BEGIN (F3.4.1A — instância do atualizador + teardown seguro para quitAndInstall)
let updater: ReturnType<typeof createUpdaterService> | null = null;
function updaterTeardownForInstall() {
  // Mesmo teardown do realQuit, porém SEM app.quit() (o quitAndInstall encerra e reabre).
  quitting = true;
  try { if (typeof listenerWatchdog !== "undefined" && listenerWatchdog) listenerWatchdog.onQuit(); } catch { /* */ } // F3.5.4N — encerra supervisão (limpa timer de último recurso)
  try { if (stopNotifier) stopNotifier(); } catch { /* */ }
  try { if (stopReminder) stopReminder(); } catch { /* */ }
  try { if (clockSync) { clockSync.stop(); clockSync = null; } } catch { /* */ }
  try { if (slaScheduler) { slaScheduler.stop(); slaScheduler = null; } } catch { /* */ } // F3.4.3
  try { if (typeof stopSlaWatch !== "undefined" && stopSlaWatch) { stopSlaWatch(); stopSlaWatch = null; } } catch { /* */ } // F3.5.4L (typeof-guard p/ harnesses)
  try { if (typeof slaReminderCtl !== "undefined" && slaReminderCtl) slaReminderCtl.stop(); } catch { /* */ } // F3.5.4L
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
  // F3.5.4U/F3.5.5E — campos ESTRUTURADOS do card premium (aditivos; produzidos em notifEvents.js):
  fromStatus?: string; toStatus?: string; sector?: string; sectorLabel?: string; cronContext?: string;
};
const _notifSeen = new Set<string>();
// F3.5.3 — ACK do toast: tracker do prazo de render (4s). Fallback bg/nativa quando não há prova.
const toastAck = createToastAckTracker({ onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } } });
function _appIcon(): string | undefined {
  try { return path.join(app.getAppPath(), "build", "icon.png"); } catch { return undefined; }
}
// F3.5.4K — CANAL POR FOCO REAL. O toast in-app só é o canal quando o usuário está REALMENTE olhando
// o Agenda (janela FOCADA). "Aberta atrás de outro programa" (visível, sem foco), minimizada, oculta/
// bandeja ⇒ NÃO é "ativo": a entrega vai para a JANELA PREMIUM always-on-top (aparece acima do outro
// programa SEM roubar foco). ANTES: isVisible() classificava a janela ocluída como "ativa" ⇒ o toast
// era enviado ao renderer atrás da outra aplicação (invisível) e o ACK do renderer cancelava o fallback
// premium — causa-raiz F3.5.4K (a notificação não aparecia com outro programa em 1º plano).
function windowActive(): boolean {
  const w = mainWin;
  return !!(w && !w.isDestroyed() && w.isFocused());
}
// F3.5.4K — mascara ids p/ logs sanitizados (NUNCA uid/taskId integrais).
function nmask(s: unknown): string { const v = String(s == null ? "" : s); if (!v) return ""; return v.length <= 6 ? (v.slice(0, 2) + "…") : (v.slice(0, 4) + "…" + v.slice(-2)); }
// F3.5.4K — estado da janela p/ observabilidade + painel (focada/visível/minimizada/tray).
function winState(): { focused: boolean; visible: boolean; minimized: boolean; tray: boolean } {
  const w = mainWin; const alive = !!(w && !w.isDestroyed());
  const visible = alive && w!.isVisible(); const minimized = alive && w!.isMinimized(); const focused = alive && w!.isFocused();
  return { focused, visible, minimized, tray: alive ? (!visible && !minimized) : false };
}
// F3.5.4K — evento de observabilidade SANITIZADO (nunca token/senha/conteúdo/uid|taskId integral).
function nlog(event: string, extra?: Record<string, unknown>): void {
  try {
    const ws = winState();
    diag(event, Object.assign({
      appState: ws.tray ? "tray" : (ws.minimized ? "minimized" : (ws.focused ? "focused" : (ws.visible ? "visible-unfocused" : "hidden"))),
      windowFocused: ws.focused, windowVisible: ws.visible, sessionLocked,
      nativeSupported: (() => { try { return Notification.isSupported(); } catch { return false; } })(),
      version: (() => { try { return app.getVersion(); } catch { return "dev"; } })(),
    }, extra || {}));
  } catch { /* observabilidade nunca derruba a entrega */ }
}
// F3.5.4K — FILA DE DEEP-LINK: se o renderer ainda não terminou de carregar (cold start / recém
// restaurado), o clique é ENFILEIRADO e drenado no did-finish-load. O clique nunca se perde e nunca
// abre a tarefa errada. Instância única preservada (requestSingleInstanceLock).
function openDeep(deep: string): void {
  const w = mainWin; const d = String(deep || ""); if (!d) return;
  if (!w || w.isDestroyed()) { pendingDeep = d; return; }
  if (w.webContents.isLoading()) { pendingDeep = d; nlog("notify.deeplink.queued", { deep: d }); return; }
  try { w.webContents.send("notif-open", d); nlog("notify.deeplink.opened", { deep: d }); } catch { pendingDeep = d; }
}
// F3.5.4K — traz a janela principal à frente (restore/show/focus) e abre a tarefa (deep-link enfileirável).
// Clique da janela premium, da Notification nativa e do protocolo idseven://. Uma única instância.
function bringToFrontAndOpen(deep: string): void {
  const w = mainWin;
  if (!w || w.isDestroyed()) { if (deep) pendingDeep = String(deep); return; }
  try { if (w.isMinimized()) w.restore(); w.show(); w.focus(); } catch { /* */ }
  if (deep) openDeep(String(deep));
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
      nlog("notify.click.received", { via: "native", dedupKey: key, taskId: nmask(p.taskId) });
      bringToFrontAndOpen(deep);
    });
    n.show();
    nlog("notify.native.sent", { dedupKey: key, taskId: nmask(p.taskId) });
    try { diag("notification.sound.native_fallback", { eventType: String(p.eventType || ""), deliverySurface: "native", soundEnabled: p.sound !== false, appVersion: app.getVersion(), timestamp: Date.now() }); } catch { /* F3.5.4W-H2 — observabilidade sanitizada */ }
    return true;
  } catch (e2) { nlog("notify.native.failed", { dedupKey: key, errorCode: String(((e2 as any) && (e2 as any).message) || e2) }); diag("native.fallback.error", { err: String(((e2 as any) && (e2 as any).message) || e2) }); return false; }
}
function deliverNotification(p: NotifPayload): { ok: boolean; channel: string } {
  try {
    if (!p || typeof p !== "object") return { ok: false, channel: "none" };
    // F3.5.5E — CINTO FINAL: payload de módulo retirado nunca é entregue (os produtores já bloqueiam
    // na fonte; isto cobre qualquer resíduo). Só payloads task_* carregam sector; demais passam.
    // Sintaxe JS-pura de propósito: os harnesses f343 extraem este corpo e avaliam como JS.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const _neD = require("./notifEvents");
      const _sctD = String((p && p.sector) || "");
      if (_sctD && _neD.isRetiredSector(_sctD)) {
        diag("notify.retired.dropped", { eventType: String(p.eventType || ""), taskId: nmask(p.taskId), motivo: "retired_module_" + _sctD });
        return { ok: false, channel: "retired-dropped" };
      }
    } catch { /* */ }
    const key = String(p.dedupKey || `${p.eventType || "evt"}:${p.taskId || ""}:${p.createdAt || ""}`);
    if (_notifSeen.has(key)) { diag("deliver.dedup", { key }); nlog("notify.dedup.skipped", { dedupKey: key, taskId: nmask(p.taskId) }); return { ok: true, channel: "dedup" }; }
    diag("deliver.begin", { eventType: p.eventType, taskId: p.taskId, targetUserId: p.targetUserId, actorId: p.actorId, responsibleId: p.responsibleId, dedupKey: key, windowActive: windowActive(), visible: !!(mainWin && !mainWin.isDestroyed() && mainWin.isVisible()), minimized: !!(mainWin && !mainWin.isDestroyed() && mainWin.isMinimized()) });
    // F3.5.4O — AGRUPAMENTO DAS NOTIFICAÇÕES COMUNS. Decisão TOMADA AQUI (após o dedup individual,
    // antes da captura no sino) para poder MARCAR a superfície: groupKey no 1º evento e _groupUpdate
    // nos subsequentes. A marca _groupUpdate só instrui o renderer a NÃO levantar um 2º toast pela
    // compensação (F3.5.4K) — NUNCA altera o histórico (o sino registra CADA evento individualmente,
    // logo abaixo). Locked ⇒ nunca agrupa (nativa individual; limitação documentada). SLA/crítico/
    // desconhecido ⇒ route=passthrough (comportamento 1.0.204 byte-a-byte). Flag OFF ⇒ passthrough.
    // typeof-guard (padrão slaReminderCtl/toastAck): as fixtures f343/f352/f354k extraem SÓ o corpo do
    // deliverNotification e rodam sem o escopo de módulo — o typeof evita ReferenceError e mantém o
    // comportamento 1.0.204 byte-a-byte quando o controlador não existe (passthrough).
    let __group = { action: "passthrough", groupKey: "", view: null as any };
    try { if (typeof notificationGrouping !== "undefined" && notificationGrouping && !sessionLocked) __group = notificationGrouping.route(p); } catch { __group = { action: "passthrough", groupKey: "", view: null as any }; }
    if (__group.action === "first" || __group.action === "update") { (p as any).groupKey = __group.groupKey; }
    if (__group.action === "update") { (p as any)._groupUpdate = true; }
    // F3.5.4U — carimba o estado do LAYOUT PREMIUM no payload p/ AMBAS as superfícies (toast in-app e
    // janela premium — esta não tem localStorage) escolherem a apresentação SEM novo canal/IPC. É metadado
    // de APRESENTAÇÃO: NÃO altera roteamento/dedup/recibos/destinatário/severidade/som/deep-link. typeof-guard
    // (padrão notificationGrouping/toastAck): fixtures f343/f354k extraem SÓ o corpo do deliverNotification e
    // rodam sem o escopo de módulo — o guard evita ReferenceError e mantém a semântica 1.0.208 (default premium).
    (p as any)._premiumCommon = (typeof premiumCommonEnabled !== "undefined") ? premiumCommonEnabled : true;
    // F3.3.10 — CAPTURA p/ a Central (histórico local no renderer). CAPTURE-ONLY: encaminha o MESMO
    // payload já deduplicado, sem alterar roteamento/toast/nativa/dedup/som/severidade/destino. Nunca
    // pode impedir a entrega — por isso vem em try/catch isolado e ANTES da decisão toast×nativa.
    try { mainWin?.webContents.send("notif-history", p); } catch { /* captura nunca afeta a notificação real */ }
    nlog("notify.event.detected", { eventType: p.eventType, taskId: nmask(p.taskId), recipientUid: nmask(p.targetUserId) });
    nlog("notify.main.received", { eventType: p.eventType, taskId: nmask(p.taskId), recipientUid: nmask(p.targetUserId), dedupKey: key });
    const deep = (p.action && p.action.deep) ? String(p.action.deep) : "";
    // F3.4.7 — o dedup do HUB só é GRAVADO após um canal REAL aceitar a entrega. Antes, a chave era
    // marcada ANTES do resultado: uma falha silenciosa bloqueava aquela transição PARA SEMPRE
    // (contrato: nenhum bloqueio permanente de transições futuras). Falha total ⇒ chave livre ⇒
    // o produtor (slaScheduler) reentrega no próximo eval (≤60s).
    const markSeen = () => {
      _notifSeen.add(key);
      if (_notifSeen.size > 4000) { const it = _notifSeen.values(); for (let i = 0; i < 1000; i++) { const v = it.next(); if (v.done) break; _notifSeen.delete(v.value); } }
    };
    // F3.5.4O — EVENTO DE ATUALIZAÇÃO DE GRUPO: já existe uma superfície do MESMO destinatário+tarefa
    // dentro da janela de 5s. Em vez de criar 2ª janela/toast, ATUALIZA a superfície existente (toast
    // in-app E janela premium) com o card agrupado (contador + até 5 itens + "+N") — SEM som, SEM roubar
    // foco. Não passa por SLA/locked/toast/premium abaixo (denylist já é passthrough; locked nunca chega
    // aqui como update). O sino já registrou ESTE evento individualmente (captura acima). markSeen grava
    // o dedup ⇒ o notifierA recebe ok:true, adiciona recibo e avança o cursor (sem reentrega/duplicação).
    if (__group.action === "update") {
      // F3.5.4U — carimba o estado do layout premium no VIEW do grupo p/ o renderer (toast e janela premium)
      // escolher a apresentação agrupada premium × antiga. Presentation-only; não altera contador/itens/deep.
      try { if (__group.view) (__group.view as any)._premiumCommon = premiumCommonEnabled; } catch { /* */ }
      try { mainWin?.webContents.send("notif-group-update", __group.view); } catch { /* atualização do toast é best-effort */ }
      try { if (typeof updateBgGroup === "function") updateBgGroup(__group.view); } catch { /* atualização da premium é best-effort */ }
      try { diag("notification.sound.suppressed_by_grouping", { eventType: String(p.eventType || ""), deliverySurface: "group_update", grouped: true, firstInGroup: false, appVersion: app.getVersion(), timestamp: Date.now() }); } catch { /* F3.5.4W-H2 — observabilidade sanitizada */ }
      markSeen();
      notifTele.lastAt = Date.now(); notifTele.lastChannel = "grouped"; notifTele.lastEventType = String(p.eventType || "");
      try { if (typeof groupTele !== "undefined") { groupTele.updates++; groupTele.lastUpdateAt = Date.now(); } } catch { /* */ }
      try { premiumObserveGroup(p, (__group.view && __group.view.count) || 0); } catch { /* */ }
      nlog("notify.group.updated", { dedupKey: key, taskId: nmask(p.taskId), recipientUid: nmask(p.targetUserId), count: (__group.view && __group.view.count) || 0 });
      return { ok: true, channel: "grouped" };
    }
    if (__group.action === "first") { try { if (typeof groupTele !== "undefined") { groupTele.opens++; groupTele.lastOpenAt = Date.now(); } } catch { /* */ } nlog("notify.group.opened", { dedupKey: key, taskId: nmask(p.taskId), recipientUid: nmask(p.targetUserId) }); }
    // F3.5.4L — LEMBRETE CENTRAL DE SLA: os alertas AMARELO/VERMELHO do Monitor SLA (eventType /^sla_/
    // ou operational_block) NÃO usam o toast/premium efêmero — vão para a JANELA CENTRAL PERSISTENTE que
    // só fecha no OK (fila, promoção amarelo→vermelho, som local, lock→nativa, persistência). As comuns
    // (movimentação/atribuição/task_updated/event_reminder/etc.) seguem INTACTAS pelo caminho 1.0.201
    // abaixo. Classificação por eventType (event_reminder é severity 'warning' mas NÃO é SLA).
    // typeof-guard: harnesses de teste que extraem SÓ o corpo de deliverNotification (fixtures f343/
    // f354k) rodam sem slaReminderCtl no escopo — o typeof evita ReferenceError e o ramo é ignorado,
    // preservando byte-a-byte a semântica das notificações COMUNS (toast/premium/nativa) da 1.0.201.
    if (typeof slaReminderCtl !== "undefined" && slaReminderCtl && classifyReminderLevel(p)) {
      const r = slaReminderCtl.enqueue(p);
      if (r && r.ok) {
        markSeen();
        notifTele.lastAt = Date.now(); notifTele.lastChannel = r.channel; notifTele.lastEventType = String(p.eventType || "");
        slaReminderTele.lastShownAt = Date.now(); slaReminderTele.lastLevel = String(classifyReminderLevel(p) || ""); try { slaReminderTele.queueLen = slaReminderCtl.status().queueLen || 0; } catch { /* */ }
      } else { notifTele.lastFailAt = Date.now(); notifTele.lastFailReason = "sla-central-failed"; }
      return { ok: !!(r && r.ok), channel: (r && r.channel) || "sla-central" };
    }
    // F3.5.4K — SESSÃO BLOQUEADA: uma BrowserWindow NÃO aparece sobre a tela de bloqueio do Windows.
    // Entrega direto pela Notification NATIVA (entra na Central; clique abre ao desbloquear). Respeita
    // Não Perturbe / Assistente de Foco / notificações desativadas / política corporativa (o SO decide
    // exibir). A captura p/ o sino já foi feita acima. Sem overlay sobre o lock-screen.
    if (sessionLocked) {
      nlog("notify.delivery.policy", { policy: "locked-native", dedupKey: key, taskId: nmask(p.taskId) });
      const nLk = nativeNotify(p, key, deep);
      nlog("notify.locked.native", { dedupKey: key, taskId: nmask(p.taskId), nativeOk: nLk });
      if (nLk) { markSeen(); notifTele.lastAt = Date.now(); notifTele.lastChannel = "native-locked"; notifTele.lastEventType = String(p.eventType || ""); }
      else { notifTele.lastFailAt = Date.now(); notifTele.lastFailReason = "locked-native-failed"; }
      return { ok: nLk, channel: nLk ? "native-locked" : "none" };
    }
    // FOCADO (usuário olhando o Agenda) — TOAST premium in-app. F3.5.4K: só com FOCO real (isFocused).
    if (windowActive()) {
      nlog("notify.delivery.policy", { policy: "toast-focused", dedupKey: key, taskId: nmask(p.taskId) });
      mainWin?.webContents.send("notif-toast", p);
      diag("deliver.toast", { dedupKey: key, taskId: p.taskId });
      // F3.5.3 — WATCHDOG DE ACK (aditivo; roteamento/dedup 1.0.191 preservados): o renderer
      // confirma o RENDER via "notif-toast-ack" (dedupKey). Sem ACK em 4s (listener ausente, erro de
      // JS, recarga), o fallback entrega pela bg-window/nativa — a janela "focada" deixa de perder
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
      try { premiumObserve(p, "toast"); } catch { /* observabilidade nunca derruba a entrega */ }
      markSeen();
      notifTele.lastAt = Date.now(); notifTele.lastChannel = "toast"; notifTele.lastEventType = String(p.eventType || "");
      return { ok: true, channel: "toast" };
    }
    // DESFOCADO (Agenda aberto ATRÁS de outro programa), minimizado, oculto/bandeja — F3.5.4K + F3.3.10-BG:
    // a entrega visual CONFIÁVEL é a JANELA PREMIUM always-on-top/showInactive (aparece ACIMA do outro
    // programa SEM roubar foco; controlada pelo main; independe do renderer visível). A nativa do SO vira
    // FALLBACK se a premium não puder ser exibida OU não PROVAR o render (ACK bgnotify-rendered) no prazo.
    // Clique → traz o Agenda e abre a tarefa (deep-link enfileirável). Captura p/ a Central já feita acima.
    nlog("notify.delivery.policy", { policy: "premium-overlay", dedupKey: key, taskId: nmask(p.taskId) });
    const bgOk = showBgNotify(p, () => {
      const lateOk = nativeNotify(p, key, deep);
      diag("deliver.bg.noAck→native", { dedupKey: key, taskId: p.taskId, nativeOk: lateOk });
    });
    if (bgOk) nlog("notify.premium.shown", { dedupKey: key, taskId: nmask(p.taskId) }); else nlog("notify.premium.failed", { dedupKey: key, taskId: nmask(p.taskId) });
    let nativeOk = false;
    if (!bgOk) nativeOk = nativeNotify(p, key, deep);
    const channel = bgOk ? "bg-window" : (nativeOk ? "native" : "none");
    diag("deliver.bg", { dedupKey: key, deep, taskId: p.taskId, title: String(p.title || ""), channel, fallbackNative: !bgOk });
    if (bgOk || nativeOk) { markSeen(); notifTele.lastAt = Date.now(); notifTele.lastChannel = channel; notifTele.lastEventType = String(p.eventType || ""); }
    else { notifTele.lastFailAt = Date.now(); notifTele.lastFailReason = "premium-and-native-failed"; }
    try { premiumObserve(p, bgOk ? "premium_window" : (nativeOk ? "native" : "none")); } catch { /* observabilidade nunca derruba a entrega */ }
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
  bringToFrontAndOpen(target); // F3.5.4K — traz à frente + deep-link enfileirável (nunca perde o clique)
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
  // F3.5.5D — menu de contexto NATIVO de edição (Desfazer/Refazer/Recortar/Copiar/Colar/Selecionar
  // tudo) em TODOS os campos realmente editáveis (params.isEditable + editFlags); botão direito em
  // botões/cards/labels/readonly não mostra nada. Sem app-menu (removeMenu preservado).
  try { attachEditContextMenu(mainWin.webContents, { Menu, onLog: (evt, p) => { try { diag(evt, p || {}); } catch { /* */ } } }); } catch { /* */ }
  mainWin.loadFile(path.join(app.getAppPath(), "src", "renderer", "index.html"));
  // Garante nitidez 1:1 (sem zoom acidental). Windows respeita HiDPI nativamente.
  mainWin.webContents.on("did-finish-load", () => {
    mainWin?.webContents.setZoomFactor(1.0);
    mainWin?.webContents.setVisualZoomLevelLimits(1, 1);
    // F3.5.4K — drena o deep-link ENFILEIRADO (clique recebido antes de o renderer ficar pronto).
    if (pendingDeep) { const d = pendingDeep; pendingDeep = null; try { mainWin?.webContents.send("notif-open", d); nlog("notify.deeplink.opened", { deep: d, drained: true }); } catch { /* */ } }
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
  try { if (typeof listenerWatchdog !== "undefined" && listenerWatchdog) listenerWatchdog.onQuit(); } catch { /* */ } // F3.5.4N — encerra supervisão (limpa timer de último recurso)
  if (stopNotifier) stopNotifier();
  if (stopReminder) stopReminder();
  if (clockSync) { try { clockSync.stop(); } catch { /* */ } clockSync = null; }
  if (slaScheduler) { try { slaScheduler.stop(); } catch { /* */ } slaScheduler = null; } // F3.4.3
  try { if (typeof stopSlaWatch !== "undefined" && stopSlaWatch) { stopSlaWatch(); stopSlaWatch = null; } } catch { /* */ } // F3.5.4L (typeof-guard p/ harnesses)
  try { if (typeof slaReminderCtl !== "undefined" && slaReminderCtl) slaReminderCtl.stop(); } catch { /* */ } // F3.5.4L
  try { stopBgNotify(); } catch { /* */ }
  // F3.3.73I6C11 — "Sair do aplicativo" remove o icone da bandeja (evita tray-fantasma no Windows).
  try { destroyTray(); } catch { /* */ }
  diag("app.realQuit→destroyTray"); // F3.3.10-DIAG
  app.quit();
}

// F3.5.4N — persistência mínima em JSON no userData (marcador de startup + flag de autocorreção).
// Sem segredo, sem PII: apenas booleans locais. Falha de I/O nunca derruba o app.
function jsonStore(file: string) {
  const full = () => path.join(app.getPath("userData"), file);
  return {
    read: (): any => { try { return JSON.parse(fs.readFileSync(full(), "utf8")); } catch { return {}; } },
    write: (o: any): void => { try { fs.writeFileSync(full(), JSON.stringify(o || {}, null, 2)); } catch (e) { diag("f354n.store.write.error", { file, err: String(((e as any) && (e as any).message) || e) }); } },
  };
}
// F3.5.4N — flag de autocorreção (item 17). Default ON (undefined ⇒ true). Desliga SOMENTE o último
// recurso do watchdog; o re-attach do firebase.ts continua SEMPRE (não é "autocorreção" opcional).
function loadSelfHealingFlag(): boolean { try { return (jsonStore("f354n-notify.json").read() || {}).selfHealingEnabled !== false; } catch { return true; } }
function saveSelfHealingFlag(v: boolean): void { try { const s = jsonStore("f354n-notify.json"); const raw = s.read() || {}; raw.selfHealingEnabled = !!v; s.write(raw); } catch { /* */ } }
// F3.5.4O — flag do AGRUPAMENTO das notificações COMUNS. Default ON (undefined ⇒ true). OFF ⇒
// passthrough sempre (comportamento 1.0.204 byte-a-byte). Constante local; NÃO é remota/configurável.
function loadGroupingFlag(): boolean { try { return (jsonStore("f354o-notify.json").read() || {}).notificationCommonGroupingEnabled !== false; } catch { return true; } }
function saveGroupingFlag(v: boolean): void { try { const s = jsonStore("f354o-notify.json"); const raw = s.read() || {}; raw.notificationCommonGroupingEnabled = !!v; s.write(raw); } catch { /* */ } }
// F3.5.4U — flag do LAYOUT PREMIUM das notificações COMUNS. Default ON (undefined ⇒ true). OFF ⇒
// apresentação equivalente à 1.0.208 (entrega/dedup/recibos/agrupamento inalterados). Arquivo próprio,
// isolado do agrupamento (f354o). Constante local; NÃO é remota/configurável.
function loadPremiumFlag(): boolean { try { return (jsonStore("f354u-notify.json").read() || {}).premiumCommonNotificationsEnabled !== false; } catch { return true; } }
function savePremiumFlag(v: boolean): void { try { const s = jsonStore("f354u-notify.json"); const raw = s.read() || {}; raw.premiumCommonNotificationsEnabled = !!v; s.write(raw); } catch { /* */ } }
// F3.5.4U — universo do layout premium (allowlist EXCLUSIVA, idêntica à do agrupamento). Fora daqui ⇒
// apresentação antiga (layout_fallback). designer_assigned/task_assigned entram (antes eram só isAttr).
const PREMIUM_COMMON_TYPES: Record<string, true> = {
  task_moved: true, task_assigned: true, task_reassigned: true,
  task_updated: true, task_completed: true, task_reopened: true, designer_assigned: true,
};
// F3.5.4U — comuns Categoria A que NÃO recebem o layout premium (renderizam o layout antigo de propósito):
// pedido de ajuda / bloqueio (fora do escopo desta fase). Só para observabilidade de layout_fallback.
const PREMIUM_FALLBACK_TYPES: Record<string, true> = { help_requested: true, blocked: true };
function premiumAppVersion(): string { try { return app.getVersion(); } catch { return "dev"; } }
function premiumScaleFactor(): number { try { return screen.getPrimaryDisplay().scaleFactor || 1; } catch { return 1; } }
// F3.5.4U — observabilidade SANITIZADA das notificações comuns premium. NOMES EXATOS do escopo. Campos
// permitidos APENAS: eventType, deliverySurface, hasAvatar, actorNameLength, taskTitleLength, groupedCount,
// scaleFactor, appVersion, timestamp. NUNCA nome/título/cliente/setor/UID/e-mail/token/URL de foto/conteúdo.
const PREMIUM_NAME_TRUNC = 28;   // limiar (aprox.) de possível truncamento do NOME (2 linhas ~500px)
const PREMIUM_TITLE_TRUNC = 48;  // limiar (aprox.) de possível truncamento do TÍTULO (2 linhas ~500px)
function premiumObserve(p: NotifPayload, surface: string): void {
  try {
    const et = String((p && (p as any).eventType) || "");
    if (PREMIUM_COMMON_TYPES[et]) {
      if (!premiumCommonEnabled) {
        diag("notification.premium.feature_disabled", { eventType: et, deliverySurface: surface, appVersion: premiumAppVersion(), timestamp: Date.now() });
        return;
      }
      const hasAvatar = !!(p && (p as any).actorAvatar);
      const actorNameLength = String((p && (p as any).actorName) || "").length;
      const taskTitleLength = String((p && (p as any).taskTitle) || "").length;
      diag("notification.premium.rendered", { eventType: et, deliverySurface: surface, hasAvatar, actorNameLength, taskTitleLength, scaleFactor: premiumScaleFactor(), appVersion: premiumAppVersion(), timestamp: Date.now() });
      if (!hasAvatar) diag("notification.premium.avatar_fallback", { eventType: et, deliverySurface: surface, appVersion: premiumAppVersion(), timestamp: Date.now() });
      if (actorNameLength > PREMIUM_NAME_TRUNC || taskTitleLength > PREMIUM_TITLE_TRUNC) diag("notification.premium.text_truncated", { eventType: et, deliverySurface: surface, actorNameLength, taskTitleLength, appVersion: premiumAppVersion(), timestamp: Date.now() });
    } else if (PREMIUM_FALLBACK_TYPES[et] && premiumCommonEnabled) {
      diag("notification.premium.layout_fallback", { eventType: et, deliverySurface: surface, appVersion: premiumAppVersion(), timestamp: Date.now() });
    }
  } catch { /* observabilidade nunca derruba a entrega */ }
}
function premiumObserveGroup(p: NotifPayload, count: number): void {
  try {
    if (!premiumCommonEnabled) return;
    const et = String((p && (p as any).eventType) || "");
    if (!PREMIUM_COMMON_TYPES[et]) return;
    diag("notification.premium.group_updated", { eventType: et, deliverySurface: "grouped", groupedCount: Number(count) || 0, scaleFactor: premiumScaleFactor(), appVersion: premiumAppVersion(), timestamp: Date.now() });
  } catch { /* */ }
}
// F3.5.4P — flag das AÇÕES DE DECISÃO nos alertas de prazo. Default ON (undefined ⇒ true). OFF ⇒ só OK
// (1.0.205), preserva tudo, NÃO apaga decisões, NÃO altera backend. Constante local; NÃO remota.
function loadSlaDecisionFlag(): boolean { try { return (jsonStore("f354p-notify.json").read() || {}).slaDecisionActionsEnabled !== false; } catch { return true; } }
function saveSlaDecisionFlag(v: boolean): void { try { const s = jsonStore("f354p-notify.json"); const raw = s.read() || {}; raw.slaDecisionActionsEnabled = !!v; s.write(raw); } catch { /* */ } }
// F3.5.4Q — flag da DETECÇÃO DE TAREFA PARADA (check-in). Default ON (undefined ⇒ true). OFF ⇒ nenhum novo
// check-in; não apaga histórico; não altera SLA/backend/agrupamento/watchdog. Constante local; NÃO remota.
function loadTaskIdleFlag(): boolean { try { return (jsonStore("f354q-notify.json").read() || {}).taskIdleDetectionEnabled !== false; } catch { return true; } }
function saveTaskIdleFlag(v: boolean): void { try { const s = jsonStore("f354q-notify.json"); const raw = s.read() || {}; raw.taskIdleDetectionEnabled = !!v; s.write(raw); } catch { /* */ } }
// F3.5.5A — config do Acompanhamento de Execução (f355a-execution.json). DEFAULT OFF pós-update;
// ACTIVE só é aceito com a JORNADA completa (etActiveAllowed) — sem horários inventados.
const ET_CFG_DEFAULTS = {
  mode: "off", sectors: [] as string[], designers: [] as string[],
  schedule: { configured: false, days: [] as number[], startMin: 0, endMin: 0, tzOffsetMin: 0 },
  maxPerDay: 3, maxPerTask: 6, minGapMin: 20, minIntervalMs: 20 * 60000, slaMarginMin: 10, responseMin: 10,
  snoozeAllowed: true, requireObservationOnNegative: false, autoPauseOnBlock: true,
  escalationResponsibles: [] as string[],
};
function loadExecutionCfg(): any {
  try {
    const raw = jsonStore("f355a-execution.json").read() || {};
    const sch = Object.assign({}, ET_CFG_DEFAULTS.schedule, (raw.schedule && typeof raw.schedule === "object") ? raw.schedule : {});
    return Object.assign({}, ET_CFG_DEFAULTS, raw, { schedule: sch });
  } catch { return Object.assign({}, ET_CFG_DEFAULTS); }
}
function saveExecutionCfg(v: any): void { try { jsonStore("f355a-execution.json").write(v || {}); } catch { /* */ } }
// F3.5.4Q — texto humano (LOCAL, sino) da resposta de check-in (enum; NUNCA texto livre — mesma sanitização).
function taskIdleSinoText(info: any): string {
  const nm = String((info && info.actorName) || "").trim(); const who = nm ? nm + " " : "";
  const t = String((info && info.taskTitle) || ""); const suf = t ? " da tarefa " + t : "";
  switch (String((info && info.responseType) || "")) {
    case "working": return who + "confirmou que está trabalhando" + suf + ".";
    case "blocked": return who + "informou bloqueio no check-in" + suf + (info && info.reasonCode ? " (" + slaReasonLabel(info.reasonCode) + ")." : ".");
    case "help_requested": return who + "pediu ajuda no check-in" + suf + (info && info.recipientName ? " para " + info.recipientName + "." : ".");
    case "return_to_todo": return who + "devolveu para A Fazer" + suf + ".";
    default: return who + "respondeu ao check-in" + suf + ".";
  }
}
// F3.5.4P — texto humano (LOCAL, sino) por tipo de decisão. Usa rótulo do reasonCode (enum) e etaMinutes;
// NUNCA o texto livre (reasonText/helpText) — mesma sanitização das notificações.
function slaReasonLabel(rc: string): string {
  const m: Record<string, string> = { material: "aguardando material", social: "aguardando Social Media", cliente: "aguardando cliente", aprovacao: "aguardando aprovação", tecnico: "problema técnico", informacao: "falta de informação", dependencia: "dependência", demanda: "demanda maior", outro: "outro motivo" };
  return m[String(rc || "")] || "motivo";
}
function slaDecisionSinoText(info: any): string {
  const nm = String((info && info.actorName) || "").trim(); const who = nm ? nm + " " : "";
  const t = String((info && info.taskTitle) || ""); const suf = t ? " da tarefa " + t : "";
  switch (String((info && info.decisionType) || "")) {
    case "start_now": return who + "vai iniciar agora" + suf + ".";
    case "finishing": return who + "informou que está finalizando" + suf + (info && info.etaMinutes ? " — previsão de +" + info.etaMinutes + " min." : ".");
    case "blocked": return who + "informou bloqueio" + suf + (info && info.reasonCode ? " (" + slaReasonLabel(info.reasonCode) + ")." : ".");
    case "help_requested": return who + "pediu ajuda" + suf + (info && info.recipientName ? " para " + info.recipientName + "." : ".");
    case "acknowledge_only": return who + "reconheceu o alerta" + suf + ".";
    default: return who + "registrou uma decisão" + suf + ".";
  }
}
// F3.5.4P — PERSISTÊNCIA OFICIAL da decisão: TRANSAÇÃO Firestore executada no RENDERER principal (único
// com o cliente db + state.user/tasks/users). O main obtém o resultado via executeJavaScript (req/resp),
// com timeout ⇒ offline (a decisão fica na fila durável e sincroniza depois). SEM backend novo: reusa o
// caminho de escrita em tasks/{id}, agora sob transação (relê+valida+append único).
async function persistSlaDecisionViaRenderer(req: any): Promise<any> {
  try {
    const w = mainWin;
    if (!w || w.isDestroyed() || !w.webContents || w.webContents.isLoading()) return { status: "offline", error: "no-renderer" };
    const arg = JSON.stringify(JSON.stringify(req || {}));
    const code = "(window.__slaPersistDecision ? window.__slaPersistDecision(JSON.parse(" + arg + ")) : {status:'offline',error:'no-fn'})";
    const p = w.webContents.executeJavaScript(code, true);
    const to = new Promise((resolve) => setTimeout(() => resolve({ status: "offline", error: "timeout" }), 15000));
    const res: any = await Promise.race([p, to]);
    if (!res || typeof res !== "object" || !res.status) return { status: "offline", error: "bad-result" };
    return res;
  } catch (e) { nlog("sla.decision.relay.error", { err: String(((e as any) && (e as any).message) || e) }); return { status: "offline", error: "relay-throw" }; }
}
async function resolveSlaHelpViaRenderer(taskId: string, key: string): Promise<any> {
  try {
    const w = mainWin;
    if (!w || w.isDestroyed() || !w.webContents || w.webContents.isLoading()) return { eligible: [], reason: "none" };
    const arg = JSON.stringify(JSON.stringify({ taskId: String(taskId || ""), key: String(key || "") }));
    const code = "(window.__slaResolveHelp ? window.__slaResolveHelp(JSON.parse(" + arg + ")) : {eligible:[],reason:'none'})";
    const p = w.webContents.executeJavaScript(code, true);
    const to = new Promise((resolve) => setTimeout(() => resolve({ eligible: [], reason: "none" }), 8000));
    const res: any = await Promise.race([p, to]);
    return (res && typeof res === "object" && Array.isArray(res.eligible)) ? res : { eligible: [], reason: "none" };
  } catch { return { eligible: [], reason: "none" }; }
}
// F3.5.4Q — PERSISTÊNCIA OFICIAL da resposta de check-in: TRANSAÇÃO Firestore no RENDERER (__idlePersistResponse).
// Mesmo padrão da decisão de SLA (executeJavaScript req/resp; timeout ⇒ offline ⇒ fila durável). SEM backend novo:
// reusa o caminho de escrita em tasks/{id} sob transação (relê+valida+append único; return_to_todo aplica a
// transição canônica via buildReturnToTodoPatch, no MESMO tx.update). A resolução de destinatário da ajuda REUSA
// __slaResolveHelp (resolveSlaHelpViaRenderer) — mesma recipient policy da 1.0.206.
async function persistIdleResponseViaRenderer(req: any): Promise<any> {
  try {
    const w = mainWin;
    if (!w || w.isDestroyed() || !w.webContents || w.webContents.isLoading()) return { status: "offline", error: "no-renderer" };
    const arg = JSON.stringify(JSON.stringify(req || {}));
    const code = "(window.__idlePersistResponse ? window.__idlePersistResponse(JSON.parse(" + arg + ")) : {status:'offline',error:'no-fn'})";
    const p = w.webContents.executeJavaScript(code, true);
    const to = new Promise((resolve) => setTimeout(() => resolve({ status: "offline", error: "timeout" }), 15000));
    const res: any = await Promise.race([p, to]);
    if (!res || typeof res !== "object" || !res.status) return { status: "offline", error: "bad-result" };
    return res;
  } catch (e) { nlog("task.idle.relay.error", { err: String(((e as any) && (e as any).message) || e) }); return { status: "offline", error: "relay-throw" }; }
}

// F3.5.4N — reconciliação IDEMPOTENTE dos produtores de rede (recibos do notifierA + seen persistente
// do slaScheduler impedem duplicação). Chamada pelo watchdog em reconexão/resume/unlock — 1 passada por
// produtor. slaReminderCtl (re-exibição LOCAL, sem rede) NÃO passa por aqui: segue no powerMonitor.
function reconcileAllProducers(reason: string): void {
  try { if (notifierAHandle) notifierAHandle.reconcile(reason); } catch { /* */ }
  try { if (slaScheduler) slaScheduler.reconcile(reason); } catch { /* */ }
  // F3.5.4P — no RETORNO DE REDE, sincroniza decisões de SLA pendentes (fila offline) com a MESMA transação
  // (idempotente por decisionKey: já-decidida ⇒ superseded; sem duplicação). Não bloqueia (fire-and-forget).
  try { if (slaReminderCtl) void slaReminderCtl.syncPendingDecisions(reason); } catch { /* */ }
  // F3.5.4Q — sincroniza respostas de check-in pendentes (fila offline) com a MESMA transação (idempotente por idleCheckKey).
  try { if (slaReminderCtl) void slaReminderCtl.syncPendingIdleResponses(reason); } catch { /* */ }
  try { if (taskIdleScheduler) taskIdleScheduler.reconcile(reason); } catch { /* */ }
  selfHealTele.lastReconcileAt = Date.now(); selfHealTele.reconciles++;
}

// F3.5.4N — INÍCIO dos listeners Firestore do usuário (o MESMO caminho do login). Único ponto que liga
// o notifier de eventos + a Categoria A durável + o slaScheduler + a escuta de conclusão. Reusado pelo
// ÚLTIMO RECURSO do watchdog. Recibos (notifierA) + seen persistente (slaScheduler) + gate sinceMs
// (notifier de eventos) impedem duplicação quando o 1º snapshot reentrega o estado após um restart.
function startUserListeners(uid: string): void {
  const _stopEventNew = startNotifier(() => mainWin, uid, deliverNotification, getAuthUser);
  const _notifierA = startNotifierA(uid, deliverNotification);
  notifierAHandle = _notifierA; // handle p/ reconcile (resume/unlock/reconexão) — recuperação única
  // stopNotifier COMPÕE os teardowns aprovados. _notifSeen.clear()/toastAck.clear() são POR SESSÃO DE
  // USUÁRIO (troca de usuário); num restart do MESMO usuário isso é inofensivo — a dedup REAL está nos
  // recibos persistentes (notifierA), no seen persistente (slaScheduler) e no gate sinceMs (eventos).
  stopNotifier = () => { try { _stopEventNew(); } catch { /* */ } try { _notifierA.stop(); } catch { /* */ } notifierAHandle = null; try { toastAck.clear(); } catch { /* */ } try { _notifSeen.clear(); } catch { /* */ } try { if (taskIdleScheduler) { taskIdleScheduler.stop(); taskIdleScheduler = null; } } catch { /* */ } try { if (executionOrch) { executionOrch.stop(); executionOrch = null; } } catch { /* F3.5.5A */ } };
  // F3.4.3/R4B — PRODUTOR AUTORITATIVO de SLA no MAIN (amarelo/vermelho/crítico), MESMO "agora" canônico
  // do renderer (slaNow → offset do clockSync), entrega pelo MESMO HUB (deliverNotification). authUser =
  // papel AUTENTICADO (só p/ o gate canSeeAll do operational_block). F3.5.4-C3 — seen POR USUÁRIO (opts.seen)
  // p/ isolar T-30/T-10 entre usuários na MESMA máquina. Forma aprovada F3.4.3/R4B (registro literal preservado):
  //   slaScheduler = startSlaScheduler(() => uid, deliverNotification, { now: slaNow, authUser: getAuthUser });
  slaScheduler = startSlaScheduler(() => uid, deliverNotification, { now: slaNow, authUser: getAuthUser, seen: createUserSlaSeen(uid) });
  slaScheduler.reconcile("boot");
  // F3.5.4Q — PRODUTOR ISOLADO do check-in de tarefa parada: listener/timer PRÓPRIOS (NÃO toca slaScheduler/
  // notifierA congelados). Emite para a MESMA janela central (enqueueCheckin, prioridade abaixo do SLA); só as
  // tarefas DO usuário logado; gated por flag + sem amarelo/vermelho ativo (isCentralBusy). Reinicia com esta
  // geração (restartAll do watchdog para stopNotifier→startUserListeners). Sem 2º watchdog/fila.
  try { if (taskIdleScheduler) { taskIdleScheduler.stop(); taskIdleScheduler = null; } } catch { /* */ }
  // F3.5.5A — orquestrador de EXECUÇÃO (evolução do mecanismo): mesmo listener/timer/fila do
  // taskIdleScheduler via hooks; autoridade única por tarefa (etAuthority); claim/resposta
  // SERVER-SIDE (transação atômica; relógio do servidor); OFF ⇒ inerte (comportamento 1.0.216).
  try { if (executionOrch) { executionOrch.stop(); executionOrch = null; } } catch { /* */ }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const _slaRulesEt: any = require("./slaRules");
  executionOrch = createExecutionOrchestrator({
    now: slaNow,
    getConfig: () => loadExecutionCfg(),
    getUid: () => uid,
    emit: (p) => { const r: any = slaReminderCtl ? slaReminderCtl.enqueueCheckin(p) : { ok: false, channel: "no-ctl" }; return r; },
    claim: async (req: any) => {
      const r = await authedBackendPost(ET_CLAIM_URL, Object.assign({}, req, { deviceHash: executionDeviceHash() }));
      if (!r.ok || !r.json) throw new Error(String(r.error || ("http_" + r.status)));
      return r.json;
    },
    isOnline: () => { try { return require("electron").net.isOnline(); } catch { return true; } },
    isCentralBusySla: () => { try { return !!(slaReminderCtl && slaReminderCtl.hasPendingSla()); } catch { return false; } },
    sectorWarn: (task: any) => { try { return Number(_slaRulesEt.slaCfgOf(task).warningMinutes) || 30; } catch { return 30; } },
    soundDataUri: () => executionCheckinSound(),
    appVersion: app.getVersion(),
    store: jsonStore("f355a-execution-state.json"),
    onRemoteClose: (key: string) => { try { slaReminderCtl && slaReminderCtl.dismissCheckin(key); } catch { /* */ } },
    onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } },
  });
  if (taskIdleStore) {
    taskIdleScheduler = startTaskIdleScheduler(
      () => uid,
      (p) => { const r: any = slaReminderCtl ? slaReminderCtl.enqueueCheckin(p) : { ok: false, channel: "no-ctl" }; try { if (r && r.channel === "idle-central") taskIdleTele.shown++; } catch { /* */ } return r; },
      {
        now: slaNow,
        isEnabled: () => taskIdleDetectionEnabled,
        isCentralBusy: () => { try { return !!(slaReminderCtl && slaReminderCtl.hasPendingSla()); } catch { return false; } },
        store: taskIdleStore,
        onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } },
        // F3.5.5A — acoplamento (no-op com modo OFF): mesmo mapa/tick/timer; autoridade única por tarefa.
        execution: {
          legacyGate: (task: any) => { try { return executionOrch ? executionOrch.authorityFor(task) !== "adaptive" : true; } catch { return true; } },
          onTasks: (m: Map<string, any>) => { try { executionOrch && executionOrch.onTasks(m); } catch { /* */ } },
          onEvaluate: () => { try { executionOrch && executionOrch.evaluate(); } catch { /* */ } },
          extraBoundary: () => { try { return executionOrch ? executionOrch.nextBoundary() : 0; } catch { return 0; } },
        },
      },
    );
  }
  // F3.5.4L — escuta READ-ONLY de conclusão (tarefa concluída com o modal aberto ⇒ mantém OK/suprime o
  // vermelho futuro). Aditiva; não toca scheduler/notifierA. Encerrada no logout/quit/restart.
  try {
    if (stopSlaWatch) { try { stopSlaWatch(); } catch { /* */ } stopSlaWatch = null; }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const _slaRulesRt: any = require("./slaRules");
    slaTaskMap.clear(); slaTaskMapReady = false;   // F3.5.5C-H2 — mapa canônico por sessão (gate volta a 'unknown')
    stopSlaWatch = fbListen("tasks", (snap: any) => {
      try {
        // F3.5.5C-H2 — MAPA CANÔNICO completo (Barreiras 2/3): o documento ATUAL da tarefa é a
        // autoridade do gate de exibição; refresh integral a cada snapshot (barato e correto).
        try {
          const docs = (snap && snap.docs) || [];
          slaTaskMap.clear();
          for (const dd of docs) { try { const did = dd && dd.id; if (did) slaTaskMap.set(String(did), (dd.data && dd.data()) || {}); } catch { /* */ } }
        } catch { /* o mapa nunca derruba a escuta */ }
        const changes = (snap && snap.docChanges && snap.docChanges()) || [];
        for (const ch of changes) {
          const id = ch && ch.doc && ch.doc.id; if (!id) continue;
          if (ch.type === "removed") { if (slaReminderCtl) slaReminderCtl.invalidateTerminal(String(id), "removed"); continue; }
          const d: any = (ch.doc.data && ch.doc.data()) || {};
          try { if (_slaRulesRt.slaPanelDelivered(Object.assign({ id }, d)) && slaReminderCtl) slaReminderCtl.invalidateTerminal(String(id), "delivered"); } catch { /* */ }
          try { deriveExecutionSmEvent(String(id), d); } catch { /* F3.5.5A — derivação nunca derruba a escuta */ }
        }
        // F3.5.5C-H2 — 1º snapshot da sessão: gate pronto ⇒ LIMPEZA REPARADORA (contagem primeiro,
        // remoção só dos comprovadamente residuais) e revalidação do replay do boot (Barreira 3).
        if (!slaTaskMapReady) {
          slaTaskMapReady = true;
          try { if (slaReminderCtl) slaReminderCtl.cleanupStale(); } catch { /* */ }
          try { if (slaReminderCtl) slaReminderCtl.onTaskGateReady(); } catch { /* */ }
        }
      } catch { /* escuta de conclusão nunca derruba nada */ }
    });
  } catch { /* */ }
}

/* F3.5.5A — NOTIFICAÇÃO AO SOCIAL MEDIA em tempo real (observação/risco/bloqueio/não-início/
   sem-resposta/parte-concluída): deriva do RESUMO projetado PELO SERVIDOR no task doc
   (executionTracking.lastCheckin — só existe se um Designer em ACTIVE respondeu/perdeu um
   check-in; SHADOW não escreve nada). Entrega pela MESMA notificação comum premium
   (deliverNotification: dedup/agrupamento por tarefa/1 som/deep-link herdados; eventTypes
   NOVOS execution_* nunca reutilizam sla_*; classifyReminderLevel não intercepta execution_*).
   Regras: NUNCA notifica "Sim" sem observação; destinatário = SM/Admin locais (papel
   server-verified); o próprio Designer que respondeu não é notificado. Preview truncado —
   texto integral SÓ nos Detalhes. */
const _etSmSeen = new Map<string, string>();
function deriveExecutionSmEvent(taskId: string, d: any): void {
  const tr = d && d.executionTracking; const lc = tr && tr.lastCheckin;
  if (!lc || !lc.key || !(lc.state === "RESPONDED" || lc.state === "MISSED")) return;
  const sig = String(lc.key) + "|" + String(lc.state);
  if (_etSmSeen.get(taskId) === sig) return;
  _etSmSeen.set(taskId, sig);
  const au = getAuthUser();
  if (!au) return;
  const role = String(au.role || "").toLowerCase();
  const isSm = au.admin === true || role.indexOf("social") >= 0;         // SM/Admin recebem
  if (!isSm) return;
  if (String(d.assigneeId || "") === String(au.id)) return;              // quem respondeu não se auto-notifica
  const tl = Array.isArray(tr.timeline) ? tr.timeline : [];
  const last = tl.length ? tl[tl.length - 1] : {};
  const rt = String(lc.responseType || "");
  const obsTxt = String((last && last.observation) || "").trim();
  let eventType = ""; let title = ""; let sev = "info";
  if (lc.state === "MISSED" || rt === "missed") { eventType = "execution_checkin_missed"; title = "Check-in de execução sem resposta"; sev = "warning"; }
  else if (rt === "nao_nao_iniciei") { eventType = "execution_not_started"; title = "Designer ainda não iniciou a tarefa"; sev = "warning"; }
  else if (rt === "nao_bloqueado") { eventType = "execution_blocked"; title = "Designer está bloqueado"; sev = "warning"; }
  else if (rt === "nao_aguardando_material") { eventType = "execution_waiting_dependency"; title = "Designer aguardando material ou retorno"; sev = "warning"; }
  else if (rt === "nao_conclui_minha_parte") { eventType = "execution_part_completed"; title = "Designer concluiu a parte dele"; sev = "info"; }
  else if ((rt === "sim" || rt === "nao_outro") && obsTxt) { eventType = "execution_checkin_note"; title = "Observação do Designer no check-in"; sev = "info"; }
  else return;                                                            // "Sim" sem observação NÃO notifica
  const preview = obsTxt ? (obsTxt.length > 90 ? obsTxt.slice(0, 90) + "…" : obsTxt) : "";
  const p: any = {
    dedupKey: "execution|" + String(lc.key) + "|" + String(lc.state),
    eventId: "execution|" + String(lc.key) + "|" + String(lc.state),
    eventType, severity: sev, title,
    taskId, taskTitle: String(d.title || d.cardTema || "Tarefa"), clientName: String(d.client || ""),
    actorName: String(d.assignee || d.designerResponsibleName || "Designer"),
    body: preview, preview,
    _premiumCommon: true, sound: true,
    action: { type: "detail", deep: "detail/" + taskId },
    createdAt: Date.now(), source: "desktop-" + app.getVersion(),
  };
  diag("execution_tracking.sm_notified", { eventType, taskIdHash: crypto.createHash("sha256").update(taskId).digest("hex").slice(0, 16), responseType: rt });
  try { deliverNotification(p); } catch { /* */ }
}

// F3.5.4N — ÚLTIMO RECURSO do watchdog: PARA a geração antiga ANTES de iniciar a nova (single-active por
// usuário; nunca dois listeners do mesmo tipo). O watchdog garante 1 restart por vez (sem simultâneo).
// Só reinicia os listeners Firestore; clockSync/updater/slaReminder seguem intactos.
function restartAllListeners(reason: string): void {
  const uid = currentUid;
  if (!uid) { diag("listener.restartAll.skip", { reason, why: "no-session" }); return; }
  diag("listener.restartAll.begin", { reason });
  try { if (stopNotifier) { stopNotifier(); stopNotifier = null; } } catch { /* */ }           // PARA a geração antiga
  try { if (slaScheduler) { slaScheduler.stop(); slaScheduler = null; } } catch { /* */ }
  try { if (stopSlaWatch) { stopSlaWatch(); stopSlaWatch = null; } } catch { /* */ }
  startUserListeners(uid);                                                                       // inicia UMA nova geração
  selfHealTele.lastRestartAt = Date.now(); selfHealTele.restarts++;
  diag("listener.restartAll.done", { reason });
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

  // F3.5.4K — SESSÃO/ENERGIA p/ a POLÍTICA DE ENTREGA (aditivo; não altera SLA/updater acima).
  // lock-screen ⇒ o overlay premium NÃO pode aparecer sobre a tela de bloqueio ⇒ a entrega passa a
  // usar a Notification NATIVA (deliverNotification checa sessionLocked). unlock/resume ⇒ recupera a
  // Categoria A UMA vez (reconcile); os recibos persistentes impedem repetição (sem duplicar após
  // desbloquear/retomar). suspend ⇒ só diagnóstico. Vários listeners coexistem (EventEmitter).
  try {
    powerMonitor.on("lock-screen", () => { sessionLocked = true; nlog("notify.session.locked", {}); try { if (slaReminderCtl) slaReminderCtl.onLockChange(true); } catch { /* */ } });
    powerMonitor.on("unlock-screen", () => { sessionLocked = false; nlog("notify.session.unlocked", {}); try { if (notifierAHandle) notifierAHandle.reconcile("unlock"); } catch { /* */ } try { if (slaReminderCtl) slaReminderCtl.onLockChange(false); } catch { /* */ } try { if (taskIdleScheduler) taskIdleScheduler.reconcile("unlock"); } catch { /* */ } });
    // F3.5.4N — suspend PAUSA o timer de último recurso do watchdog (suspend NÃO é falha). O reconcile de
    // resume/unlock segue nos handlers aprovados (F3.4.3/F3.5.4K, acima/abaixo); o watchdog cobre a
    // recuperação por RETORNO DE REDE (setNetwork → reconcileAll) e o último recurso, sem 2º reconcile.
    powerMonitor.on("suspend", () => { diag("power.suspend"); try { if (listenerWatchdog) listenerWatchdog.onSuspend(); } catch { /* */ } });
    powerMonitor.on("resume", () => { try { if (notifierAHandle) notifierAHandle.reconcile("resume"); } catch { /* */ } try { if (slaReminderCtl) slaReminderCtl.reconcile("resume"); } catch { /* */ } try { if (slaReminderCtl) void slaReminderCtl.syncPendingDecisions("resume"); } catch { /* */ } try { if (slaReminderCtl) void slaReminderCtl.syncPendingIdleResponses("resume"); } catch { /* */ } try { if (taskIdleScheduler) taskIdleScheduler.reconcile("resume"); } catch { /* */ } });
  } catch { /* powerMonitor pode não existir em todas as plataformas */ }

  // F3.5.4L — LEMBRETE CENTRAL PERSISTENTE DE SLA (amarelo/vermelho). Superfície do MAIN (sobrevive a
  // renderer indisponível/min/tray): sons locais em data URI, store de recibo(OK)+pendentes, controlador
  // (fila/prioridade/promoção/lock/reconcile). O OK grava recibo ANTES de fechar e registra no sino
  // (via notif-history; sem toast pois a janela principal não está focada no clique do modal). NÃO
  // altera as notificações COMUNS (1.0.201) nem o produtor/tempos/destinatários de SLA (congelados).
  try {
    slaReminderSounds = loadReminderSounds();
    slaDecisionActionsEnabled = loadSlaDecisionFlag();   // F3.5.4P — flag persistida (default ON)
    taskIdleDetectionEnabled = loadTaskIdleFlag();       // F3.5.4Q — flag persistida (default ON)
    taskIdleStore = createTaskIdleStore({ log: (t: string, d?: unknown) => { try { diag(t, d as any); } catch { /* */ } } });
    const slaReminderStore = createSlaReminderStore({ log: (t: string, d?: unknown) => { try { diag(t, d as any); } catch { /* */ } } });
    const slaSurface = createSlaReminderSurface({
      onAck: (key, windowState) => { try { if (slaReminderCtl) slaReminderCtl.ack(key, windowState); } catch { /* */ } },
      onOpenTask: (deep) => { nlog("notify.click.received", { via: "sla-reminder", deep }); bringToFrontAndOpen(deep); },
      nativeNotify: (view) => {
        const anyv = view as any;
        const isCheckin = anyv.kind === "checkin";
        const title = isCheckin ? ("Check-in de atividade — " + (anyv.taskTitle || "Tarefa")) : ((anyv.title || "SLA") + " — " + (anyv.taskTitle || "SLA"));
        const body = isCheckin ? ("A tarefa permanece sem uma atualização registrada há " + (anyv.sinceText || "") + ". Esta tarefa ainda está sendo executada?") : (anyv.body || "");
        return nativeNotify({ title, body, eventType: isCheckin ? "task_idle_native" : "sla_reminder_native", taskId: (view.deep || "").replace(/^detail\//, ""), action: { type: "detail", deep: view.deep }, sound: true } as any, view.key, view.deep);
      },
      onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } },
      // F3.5.4P — decisão do responsável: a janela envia a decisão → controlador (transação); dismiss fecha
      // após mensagem informativa; resolveHelp resolve o destinatário da ajuda no renderer (state.users).
      onDecide: async (input) => { try { return slaReminderCtl ? await slaReminderCtl.onDecide(input) : { status: "ignored" }; } catch (e) { diag("sla.decision.ondecide.error", { err: String(((e as any) && (e as any).message) || e) }); return { status: "error", error: "onDecide" }; } },
      onDismiss: (key) => { try { if (slaReminderCtl) slaReminderCtl.dismiss(key); } catch { /* */ } },
      onResolveHelp: (taskId, key) => resolveSlaHelpViaRenderer(taskId, key),
      // F3.5.4Q — check-in de tarefa parada: 4 decisões (transação), rascunho (suspend/restore), dismiss, ajuda (reusa 1.0.206).
      onCheckinDecide: async (input) => { try { return slaReminderCtl ? await slaReminderCtl.onCheckinDecide(input) : { status: "ignored" }; } catch (e) { diag("task.idle.oncheckin.error", { err: String(((e as any) && (e as any).message) || e) }); return { status: "error", error: "onCheckinDecide" }; } },
      onCheckinDraft: (key, draft) => { try { if (slaReminderCtl) slaReminderCtl.onCheckinDraft(key, draft); } catch { /* */ } },
      onCheckinDismiss: (key) => { try { if (slaReminderCtl) slaReminderCtl.dismissCheckin(key); } catch { /* */ } },
      onCheckinRendered: (key) => { try { if (slaReminderCtl) slaReminderCtl.onExecutionRendered(key); } catch { /* F3.5.5A — timer do laranja só pós-ACK */ } },
      onCheckinResolveHelp: (taskId, key) => resolveSlaHelpViaRenderer(taskId, key),
    });
    slaReminderCtl = createSlaReminderController({
      // F3.5.5A — resposta/perda do CHECK-IN DE EXECUÇÃO via operação TRANSACIONAL server-side
      // (respondExecutionCheckpoint; relógio do servidor; deviceHash hasheado; token confinado).
      executionRespond: async (req: any) => {
        const r = await authedBackendPost(ET_RESPOND_URL, Object.assign({}, req, { deviceHash: executionDeviceHash() }));
        if (!r.ok || !r.json) throw new Error(String(r.error || ("http_" + r.status)));
        return r.json;
      },
      onExecutionClosed: (key: string, state: string) => { try { executionOrch && executionOrch.notifyClosed(key, state); } catch { /* */ } },
      surface: slaSurface, store: slaReminderStore, now: () => Date.now(),
      appVersion: (() => { try { return app.getVersion(); } catch { return "dev"; } })(),
      isLocked: () => sessionLocked, getUid: () => currentUid,
      // F3.5.5C-H2 — Barreiras 2/3: gate CANÔNICO de exibição sobre o snapshot vivo da sessão.
      // 'unknown' até o 1º snapshot (boot/offline) ⇒ difere; terminal = slaPanelDelivered (enums
      // REAIS: finishedAt/doneAt/entregue/concluido/cancelado/removido); responsável = resolvedor
      // canônico (designerAssignment.designerId || assigneeId). Incerteza NUNCA derruba alerta.
      taskGate: (taskId: string, recipientUid: string): "valid" | "terminal" | "missing" | "assignee_changed" | "unknown" => {
        try {
          if (!slaTaskMapReady) return "unknown";
          const t = slaTaskMap.get(String(taskId || ""));
          if (!t) return "missing";
          // F3.5.5E — MÓDULO RETIRADO (Copywriting/Roteiro/Programação de Posts): pendência/alerta
          // antigo é invalidado SELETIVAMENTE pelas barreiras H2 já aprovadas (boot + pré-exibição),
          // com motivo auditável. Identificação por chave canônica de setor (nunca título). NUNCA
          // apaga a tarefa; NUNCA altera status/responsável; alertas de outros setores intactos.
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const _ne: any = require("./notifEvents");
            const _sct = String(((t as any) && (t as any).sector) || "");
            if (_ne.isRetiredSector(_sct)) {
              diag("sla.reminder.retired_module", { taskId: String(taskId || ""), motivo: "retired_module_" + _sct });
              return "terminal";
            }
          } catch { /* incerteza nunca derruba o gate */ }
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const _sr: any = require("./slaRules");
          if (_sr.slaPanelDelivered(t)) return "terminal";
          const resp = String((t.designerAssignment && t.designerAssignment.designerId) || t.assigneeId || "");
          if (resp && recipientUid && resp !== String(recipientUid)) return "assignee_changed";
          return "valid";
        } catch { return "valid"; }
      },
      soundFor: (lvl) => (lvl === "critical" ? slaReminderSounds.critical : slaReminderSounds.warning),
      // F3.5.4P — persistência OFICIAL por TRANSAÇÃO no renderer; flag; sino/observabilidade pós-commit.
      persistDecision: (req) => persistSlaDecisionViaRenderer(req),
      decisionsEnabled: () => slaDecisionActionsEnabled,
      onDecided: (info) => {
        try {
          slaDecisionTele.committed++; slaDecisionTele.lastAt = Date.now(); slaDecisionTele.lastType = String(info.decisionType || "");
          mainWin?.webContents.send("notif-history", {
            eventType: "sla_decision", severity: "info", taskId: info.taskId, dedupKey: "sla_decision_ack:" + info.key,
            title: "Decisão registrada no alerta de SLA", body: slaDecisionSinoText(info),
            context: "", createdAt: Date.now(), source: "sla-reminder", providerCalled: false,
            action: { type: "detail", deep: info.taskId ? "detail/" + info.taskId : "" },
          });
        } catch { /* sino local nunca derruba o commit */ }
      },
      onAcked: (info) => {
        try {
          const lvlTxt = info.level === "critical" ? "vermelho" : "amarelo";
          const nm = String(info.actorName || "").trim();
          mainWin?.webContents.send("notif-history", {
            eventType: "sla_ack", severity: "info", taskId: info.taskId, dedupKey: "sla_ack:" + info.key,
            title: "Alerta de SLA reconhecido",
            body: (nm ? nm + " " : "") + "reconheceu o alerta " + lvlTxt + " da tarefa " + (info.taskTitle || ""),
            context: "", createdAt: Date.now(), source: "sla-reminder", providerCalled: false,
            action: { type: "detail", deep: info.taskId ? "detail/" + info.taskId : "" },
          });
          slaReminderTele.lastAckAt = Date.now();
        } catch { /* histórico local nunca derruba o ack */ }
      },
      onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } },
      // F3.5.4Q — check-in de tarefa parada (aditivo; prioridade abaixo do SLA; transação própria; sino/telemetria sanitizada).
      persistIdleResponse: (req) => persistIdleResponseViaRenderer(req),
      idleEnabled: () => taskIdleDetectionEnabled,
      idleStore: taskIdleStore || undefined,
      onIdleResponded: (info) => {
        try {
          const rt = String(info.responseType || "");
          if (rt === "working") taskIdleTele.working++; else if (rt === "blocked") taskIdleTele.blocked++; else if (rt === "help_requested") taskIdleTele.help++; else if (rt === "return_to_todo") taskIdleTele.returned++;
          taskIdleTele.lastAt = Date.now(); taskIdleTele.lastType = rt;
          mainWin?.webContents.send("notif-history", {
            eventType: "task_idle_response", severity: "info", taskId: info.taskId, dedupKey: "task_idle_ack:" + info.idleCheckKey,
            title: "Resposta de check-in registrada", body: taskIdleSinoText(info),
            context: "", createdAt: Date.now(), source: "task-idle", providerCalled: false,
            action: { type: "detail", deep: info.taskId ? "detail/" + info.taskId : "" },
          });
        } catch { /* sino local nunca derruba o commit */ }
      },
    });
    diag("sla.reminder.init", { warnBytes: (slaReminderSounds.warning || "").length, critBytes: (slaReminderSounds.critical || "").length });
  } catch (e) { diag("sla.reminder.init.error", { err: String(((e as any) && (e as any).message) || e) }); }

  // F3.5.4N — INICIALIZAÇÃO COM O WINDOWS (default-ON de 1ª execução; SO é a verdade; verify real).
  // Sobre o mecanismo NATIVO do Electron; MESMO arg "--hidden" da bandeja (autostart.ts, congelada) ⇒
  // as duas superfícies escrevem o MESMO item de login sem brigar. Aplica o default UMA vez só.
  try {
    startupPrefs = createStartupPrefs({
      sys: { platform: process.platform, get: (o?: { args?: string[] }) => app.getLoginItemSettings(o || {}) as any, set: (o: { openAtLogin: boolean; args?: string[] }) => app.setLoginItemSettings(o) },
      store: jsonStore("f354n-startup.json"),
      onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } },
      argv: () => process.argv,
    });
    const sr = startupPrefs.applyDefaultsOnce();
    diag("startup.ready", { openAtLogin: sr.openAtLogin, changed: sr.changed, wasOpenedAtLogin: startupPrefs.wasOpenedAtLogin() });
  } catch (e) { diag("startup.init.error", { err: String(((e as any) && (e as any).message) || e) }); }

  // F3.5.4N — SUPERVISOR + ÚLTIMO RECURSO do canal de notificações. O reconectador PRIMÁRIO é o
  // firebase.ts (re-attach 5s→60s, timer ÚNICO por coleção). O watchdog SÓ observa os sinais REAIS
  // (attach/snapshot/error/rearm + geração) via setListenHealthObserver — NÃO cria 2º ciclo de
  // reconexão. flag notificationSelfHealingEnabled (item 17; default ON) desliga SOMENTE o último
  // recurso; o re-attach do firebase continua. Alerta admin SÓ quando a autocorreção FALHA (item 18).
  selfHealingEnabled = loadSelfHealingFlag();
  try {
    listenerWatchdog = createListenerWatchdog({
      restartAll: (reason) => restartAllListeners(reason),      // PARA a geração antiga ANTES da nova (single-active)
      reconcileAll: (reason) => reconcileAllProducers(reason),  // idempotente (recibos/seen impedem duplicação)
      isAuthValid: () => !!currentUid,
      isOnline: () => netOnline,
      selfHealingEnabled: () => selfHealingEnabled,
      onAdminAlert: (info) => {
        // item 18 — autocorreção FALHOU: registro SANITIZADO + Notification NATIVA (local; independe do
        // Firestore que caiu). Sem PII/uid/token. Uma vez por episódio (o watchdog já garante 1x).
        selfHealTele.lastAlertAt = Date.now(); selfHealTele.lastReasonCode = String(info.reasonCode || ""); selfHealTele.alerts++;
        nlog("notify.selfheal.alert", { reasonCode: info.reasonCode, attempts: info.attempts });
        try { new Notification({ title: "Agenda ID Seven", body: "Reconectando as notificações… se persistir, reabra o aplicativo.", silent: true, icon: _appIcon() }).show(); } catch { /* */ }
      },
      onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } },
    });
    listenerWatchdog.start();
    setListenHealthObserver((h) => { try { if (listenerWatchdog) listenerWatchdog.onHealth(h as any); } catch { /* observador nunca derruba a entrega */ } });
    diag("listener.watchdog.ready", { selfHealingEnabled });
  } catch (e) { diag("listener.watchdog.init.error", { err: String(((e as any) && (e as any).message) || e) }); }

  // F3.5.4O — AGRUPAMENTO INTELIGENTE DAS NOTIFICAÇÕES COMUNS. Controlador PURO no MAIN. Chave
  // common_group:<destinatário>:<taskId>; janela FIXA de 5s a partir do 1º evento (não desliza; não
  // atrasa a 1ª entrega). Flag notificationCommonGroupingEnabled (default ON) desliga SOMENTE o
  // agrupamento (OFF ⇒ 1.0.204). Observabilidade SANITIZADA (notification.group.*).
  groupingEnabled = loadGroupingFlag();
  try {
    notificationGrouping = createNotificationGrouping({
      now: () => Date.now(),
      groupWindowMs: 5000,
      maxVisibleItems: 5,
      isEnabled: () => groupingEnabled,
      onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } },
    });
    diag("notification.grouping.ready", { enabled: groupingEnabled, windowMs: 5000, maxItems: 5 });
  } catch (e) { diag("notification.grouping.init.error", { err: String(((e as any) && (e as any).message) || e) }); }

  // F3.5.4U — LAYOUT PREMIUM das notificações comuns: carrega a flag persistente (default ON). Só
  // presentation-only; entrega/dedup/recibos/agrupamento inalterados. Diagnóstico SANITIZADO no painel.
  premiumCommonEnabled = loadPremiumFlag();
  diag("notify.premiumcommon.ready", { enabled: premiumCommonEnabled });

  // F3.3.10-BG — registra a janela premium de background + callback de "Abrir tarefa"
  // (reabre a mainWindow minimizada/oculta e navega via deep link). NÃO rouba foco do SO.
  initBgNotify((deep: string) => {
    nlog("notify.click.received", { via: "premium", deep }); // F3.5.4K — clique na janela premium
    try { diag("notification.premium.opened", { eventType: "", deliverySurface: "premium_window", appVersion: premiumAppVersion(), timestamp: Date.now() }); } catch { /* F3.5.4U — observabilidade sanitizada */ }
    bringToFrontAndOpen(deep); // traz o Agenda à frente + abre a tarefa (deep-link enfileirável)
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
  ipcMain.on("diag-log", (_e, tag: string, data?: unknown) => {
    try {
      const t = String(tag || "");
      // F3.5.4U — o toast in-app emite observabilidade premium de INTERAÇÃO (opened/closed) com NOME EXATO
      // do escopo. Reescreve SANITIZADO (allowlist de nomes + campos permitidos), sem o prefixo "renderer.".
      if (t === "notification.premium.opened" || t === "notification.premium.closed") {
        const d: any = (data && typeof data === "object") ? data : {};
        diag(t, { eventType: String(d.eventType || ""), deliverySurface: String(d.deliverySurface || "toast"), appVersion: premiumAppVersion(), timestamp: Date.now() });
        return;
      }
      diag("renderer." + t, data);
    } catch { /* */ }
  });
  ipcMain.handle("diag-path", () => diagPath());
  // F3.3.70D3R10I — fonte unica da versao p/ o renderer (Config mostra a versao real do build)
  ipcMain.on("app-version", (e) => { try { e.returnValue = app.getVersion(); } catch { e.returnValue = "dev"; } });
  // F3.3.3 — renderer pede notificação (fluxo/SLA/bloqueio detectados no renderer).
  // O HUB decide o canal (toast in-app x nativa) e faz dedup. Sem provider externo.
  ipcMain.handle("notify", (_e, payload: NotifPayload) => deliverNotification(payload));
  // F3.5.3 — renderer confirma o RENDER do toast (dedupKey): cancela o fallback pendente.
  ipcMain.on("notif-toast-ack", (_e, key: string) => { toastAck.ack(String(key || "")); });
  // F3.5.4K — painel Configurações → Notificações: status técnico SANITIZADO (sem token/senha/uid|taskId
  // integral/conteúdo). Somente booleans/rótulos/timestamps + versão. Read-only; nunca dispara entrega.
  ipcMain.handle("notif-diag", () => {
    const ws = winState();
    let premiumReady = false; try { premiumReady = !!bgStatus().initialized; } catch { premiumReady = false; }
    let nativeSupported = false; try { nativeSupported = Notification.isSupported(); } catch { nativeSupported = false; }
    // F3.5.4N — estado SANITIZADO da autocorreção (item 16/18) e da inicialização com o Windows.
    let wd: any = null; try { wd = listenerWatchdog ? listenerWatchdog.snapshot() : null; } catch { wd = null; }
    let sv: any = null; try { sv = startupPrefs ? startupPrefs.verify() : null; } catch { sv = null; }
    let wasOpenedAtLogin = false; try { wasOpenedAtLogin = !!(startupPrefs && startupPrefs.wasOpenedAtLogin()); } catch { wasOpenedAtLogin = false; }
    return {
      listenerMainActive: !!stopNotifier,
      nativeSupported,
      sessionLocked,
      windowFocused: ws.focused, windowVisible: ws.visible, windowMinimized: ws.minimized, windowTray: ws.tray,
      premiumReady,
      lastDeliveryAt: notifTele.lastAt, lastChannel: notifTele.lastChannel, lastEventType: notifTele.lastEventType,
      lastFailAt: notifTele.lastFailAt, lastFailReason: notifTele.lastFailReason,
      version: (() => { try { return app.getVersion(); } catch { return "dev"; } })(),
      // F3.5.4N — autocorreção do canal (supervisor/último recurso)
      selfHealingEnabled,
      netOnline,
      watchdogState: wd ? wd.state : "—",
      watchdogLastResortArmed: wd ? !!wd.lastResortArmed : false,
      selfHealRestarts: selfHealTele.restarts, selfHealLastRestartAt: selfHealTele.lastRestartAt,
      selfHealReconciles: selfHealTele.reconciles, selfHealLastReconcileAt: selfHealTele.lastReconcileAt,
      selfHealAlerts: selfHealTele.alerts, selfHealLastAlertAt: selfHealTele.lastAlertAt, selfHealLastReason: selfHealTele.lastReasonCode,
      // F3.5.4N — inicialização com o Windows (estado REAL do SO)
      startupSupported: process.platform === "win32",
      startupOpenAtLogin: sv ? !!sv.osOpenAtLogin : false,
      startupWillLaunch: sv ? !!sv.willLaunch : false,
      wasOpenedAtLogin,
      // F3.5.4O — agrupamento das notificações comuns (SANITIZADO; sem conteúdo/uid|taskId integral)
      groupingEnabled,
      // F3.5.4U — layout premium das notificações comuns (SANITIZADO; só boolean)
      premiumCommonEnabled,
      groupingWindowMs: (() => { try { return notificationGrouping ? notificationGrouping.windowMs : 5000; } catch { return 5000; } })(),
      groupingActive: (() => { try { return notificationGrouping ? notificationGrouping.activeCount() : 0; } catch { return 0; } })(),
      groupingUpdates: groupTele.updates, groupingLastUpdateAt: groupTele.lastUpdateAt,
      groupingOpens: groupTele.opens, groupingLastOpenAt: groupTele.lastOpenAt,
      // F3.5.4P — decisão do responsável (telemetria SANITIZADA: sem conteúdo/uid/reasonText)
      slaDecisionActionsEnabled, slaDecisionCommitted: slaDecisionTele.committed, slaDecisionLastType: slaDecisionTele.lastType, slaDecisionLastAt: slaDecisionTele.lastAt,
      // F3.5.4Q — check-in de tarefa parada (telemetria SANITIZADA: contadores/flag/últimoTipo; sem conteúdo/uid/reasonText)
      taskIdleDetectionEnabled, taskIdleShown: taskIdleTele.shown, taskIdleWorking: taskIdleTele.working, taskIdleBlocked: taskIdleTele.blocked, taskIdleHelp: taskIdleTele.help, taskIdleReturned: taskIdleTele.returned, taskIdleLastType: taskIdleTele.lastType, taskIdleLastAt: taskIdleTele.lastAt,
    };
  });
  // F3.5.4N — REDE: o renderer reporta navigator.onLine + eventos online/offline (sinal REAL do SO). O
  // firebase.ts reconecta sozinho; o watchdog usa isto p/ estado + reconcile ÚNICO ao voltar a rede.
  ipcMain.on("net-status", (_e, online: boolean) => {
    const b = !!online; if (b === netOnline) return;
    netOnline = b; nlog("net.status.changed", { online: b });
    try { if (listenerWatchdog) listenerWatchdog.setNetwork(b); } catch { /* */ }
  });
  // F3.5.4N — INICIALIZAÇÃO (Configurações): estado REAL do SO + toggle "iniciar com o Windows".
  ipcMain.handle("startup-get", () => {
    try {
      if (!startupPrefs) return { supported: false, openAtLogin: false, willLaunch: false, consistent: true, wasOpenedAtLogin: false };
      const v = startupPrefs.verify();
      return { supported: process.platform === "win32", openAtLogin: v.osOpenAtLogin, willLaunch: v.willLaunch, consistent: v.consistent, wasOpenedAtLogin: startupPrefs.wasOpenedAtLogin(), hiddenStart: true };
    } catch { return { supported: false, openAtLogin: false, willLaunch: false, consistent: true, wasOpenedAtLogin: false }; }
  });
  ipcMain.handle("startup-set", (_e, v: boolean) => {
    try {
      if (!startupPrefs) return { ok: false };
      startupPrefs.setOpenAtLogin(!!v); const vf = startupPrefs.verify();
      return { ok: true, openAtLogin: vf.osOpenAtLogin, willLaunch: vf.willLaunch, consistent: vf.consistent };
    } catch (e) { return { ok: false, error: String(((e as any) && (e as any).message) || e) }; }
  });
  // F3.5.4N — AUTOCORREÇÃO (item 17): flag que desliga SOMENTE a autocorreção (firebase segue reconectando).
  ipcMain.handle("selfheal-get", () => ({ enabled: selfHealingEnabled }));
  ipcMain.handle("selfheal-set", (_e, v: boolean) => { selfHealingEnabled = !!v; saveSelfHealingFlag(selfHealingEnabled); diag("notify.selfheal.flag", { enabled: selfHealingEnabled }); return { enabled: selfHealingEnabled }; });
  // F3.5.4O — AGRUPAMENTO (Configurações → Notificações): liga/desliga SOMENTE o agrupamento das
  // notificações comuns (OFF ⇒ 1.0.204; a entrega individual continua idêntica). Persistente e local.
  ipcMain.handle("grouping-get", () => ({ enabled: groupingEnabled }));
  ipcMain.handle("grouping-set", (_e, v: boolean) => { groupingEnabled = !!v; saveGroupingFlag(groupingEnabled); try { if (notificationGrouping && !groupingEnabled) notificationGrouping.reset(); } catch { /* */ } diag("notification.group.flag", { enabled: groupingEnabled }); return { enabled: groupingEnabled }; });
  // F3.5.4U — LAYOUT PREMIUM (Configurações → Notificações): liga/desliga SOMENTE a APRESENTAÇÃO das
  // notificações comuns (OFF ⇒ layout equivalente à 1.0.208; entrega/dedup/recibos/agrupamento/destinatários
  // idênticos). Persistente e local. Propagado às superfícies pelo carimbo _premiumCommon no payload.
  ipcMain.handle("premium-get", () => ({ enabled: premiumCommonEnabled }));
  ipcMain.handle("premium-set", (_e, v: boolean) => { premiumCommonEnabled = !!v; savePremiumFlag(premiumCommonEnabled); diag("notify.premiumcommon.flag", { enabled: premiumCommonEnabled }); return { enabled: premiumCommonEnabled }; });
  // F3.5.4P — AÇÕES DE DECISÃO (Configurações → Notificações): liga/desliga SOMENTE as opções de ação nos
  // alertas de prazo. OFF ⇒ só OK (1.0.205), preserva tudo, NÃO apaga decisões já gravadas, NÃO altera backend.
  ipcMain.handle("sla-decision-get", () => ({ enabled: slaDecisionActionsEnabled }));
  ipcMain.handle("sla-decision-set", (_e, v: boolean) => { slaDecisionActionsEnabled = !!v; saveSlaDecisionFlag(slaDecisionActionsEnabled); diag("sla.decision.flag", { enabled: slaDecisionActionsEnabled }); return { enabled: slaDecisionActionsEnabled }; });
  // F3.5.4Q — flag da DETECÇÃO DE TAREFA PARADA (Configurações → Notificações). OFF ⇒ nenhum novo check-in.
  ipcMain.handle("task-idle-get", () => ({ enabled: taskIdleDetectionEnabled }));
  ipcMain.handle("task-idle-set", (_e, v: boolean) => { taskIdleDetectionEnabled = !!v; saveTaskIdleFlag(taskIdleDetectionEnabled); diag("task.idle.flag", { enabled: taskIdleDetectionEnabled }); return { enabled: taskIdleDetectionEnabled }; });
  // F3.5.5A — Configurações → Acompanhamento de execução. Leitura: qualquer usuário logado
  // (a UI mostra o estado); ESCRITA global: SOMENTE Admin autenticado (papel server-verified).
  // ACTIVE com jornada incompleta é RECUSADO com a mensagem literal do mandato (sem defaults inventados).
  ipcMain.handle("execution-tracking-get", () => {
    const cfg = loadExecutionCfg();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ETm: any = require("./executionTracking");
    let gate: any = { allowed: false, missing: [] };
    try { gate = ETm.etActiveAllowed(cfg); } catch { /* */ }
    return { cfg, activeAllowed: !!gate.allowed, missing: gate.missing || [], message: gate.allowed ? "" : String(gate.message || "") };
  });
  ipcMain.handle("execution-tracking-set", (_e, next: any) => {
    const au = getAuthUser();
    if (!au || au.admin !== true) { diag("execution.cfg.denied_not_admin", {}); return { ok: false, error: "not_admin" }; }
    const cur = loadExecutionCfg();
    const cand = Object.assign({}, cur, (next && typeof next === "object") ? next : {});
    cand.schedule = Object.assign({}, cur.schedule, (next && next.schedule && typeof next.schedule === "object") ? next.schedule : {});
    const m = String(cand.mode || "off");
    cand.mode = (m === "shadow" || m === "active") ? m : "off";
    if (cand.mode === "active") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ETm: any = require("./executionTracking");
      let gate: any = { allowed: false };
      try { gate = ETm.etActiveAllowed(cand); } catch { /* */ }
      if (!gate.allowed) { diag("execution.cfg.active_blocked_incomplete", { missing: gate.missing || [] }); return { ok: false, error: "schedule_incomplete", missing: gate.missing || [], message: String(gate.message || "Conclua a configuração da jornada antes de ativar os check-ins.") }; }
    }
    cand.minIntervalMs = Math.max(60000, (Number(cand.minGapMin) || 20) * 60000);
    saveExecutionCfg(cand);
    diag("execution.cfg.saved", { mode: cand.mode, sectors: (cand.sectors || []).length, designers: (cand.designers || []).length, scheduleConfigured: !!(cand.schedule && cand.schedule.configured) });
    return { ok: true, cfg: cand };
  });
  // F3.5.3 — leitura de texto da área de transferência p/ o pipeline explícito de COLAGEM do
  // formulário (Legenda/Tema/Observações). SOMENTE texto simples; nunca HTML executável.
  ipcMain.handle("clipboard-read-text", () => { try { return String(clipboard.readText() || ""); } catch { return ""; } });
  // F3.5.5D — leitura do HTML do clipboard (fallback determinístico de Ctrl+V no editor rico:
  // Word/Google Docs preservam formatação básica APÓS o rteSanitize no renderer). Read-only;
  // o conteúdo NUNCA é registrado em log/telemetria.
  ipcMain.handle("clipboard-read-html", () => { try { return String(clipboard.readHTML() || ""); } catch { return ""; } });
  // F3.5.4W-H1 (E2) — ESCRITA de texto simples na área de transferência p/ os botões "Copiar tema" /
  // "Copiar legenda" da Central de Detalhes. SOMENTE texto puro (nunca HTML); determinístico via módulo
  // do Electron no main; espelha clipboard-read-text. Retorna boolean p/ o renderer decidir o feedback.
  ipcMain.handle("clipboard-write-text", (_e, s: string) => { try { clipboard.writeText(String(s ?? "")); return true; } catch { return false; } });
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
      currentUid = uid; // F3.5.4N — ANTES de iniciar os listeners (restartAll/isAuthValid dependem do uid)
      try { if (listenerWatchdog) listenerWatchdog.resetForLogin(); } catch { /* */ } // F3.5.4N — novo episódio de supervisão
      try { if (notificationGrouping) notificationGrouping.reset(); } catch { /* */ } // F3.5.4O — grupos são POR SESSÃO de usuário (troca de usuário zera a memória de grupos)
    slaTaskMap.clear(); slaTaskMapReady = false; // F3.5.5C-H2 — gate volta a 'unknown' fora de sessão (nada bloqueante sem snapshot)
      // F3.5.3/F3.5.4N — INÍCIO dos listeners Firestore (notifier de eventos + Categoria A DURÁVEL p/
      // TODOS os usuários ativos + produtor AUTORITATIVO de SLA + escuta de conclusão). Extraído p/
      // startUserListeners: é o MESMO caminho reusado pelo ÚLTIMO RECURSO do watchdog (para a geração
      // antiga ANTES da nova; single-active). authUser=papel AUTENTICADO (F3.4.3/R4B). Recibos
      // (notifierA) + seen POR USUÁRIO (slaScheduler, F3.5.4-C3) + gate sinceMs (eventos) + _notifSeen/
      // toastAck por sessão (F3.5.4-C1) impedem duplicação no 1º snapshot após login/restart.
      startUserListeners(uid);
      // F3.3.77A-R4B — RELÓGIO CANÔNICO: sincronização (main) via cabeçalho HTTP Date do getUserSelf
      // (Cloud Run, read-only, SEM auth ⇒ zero mutação). Empurra o offset ao renderer.
      if (clockSync) { try { clockSync.stop(); } catch { /* */ } }
      clockSync = createClockSync({
        emit: (s) => { try { const w = mainWin; if (w && !w.isDestroyed()) w.webContents.send("clock-state", s); } catch { /* */ } },
        onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } },
      });
      clockSync.start();
      // F3.5.4L — LEMBRETE CENTRAL: reexibe pendentes NÃO reconhecidos do usuário logado (persistência
      // entre reinícios). uid corrente (getUid) já foi setado acima; a escuta de conclusão foi ligada
      // dentro de startUserListeners.
      try { if (slaReminderCtl) slaReminderCtl.reconcile("login"); } catch { /* */ }
      try { if (slaReminderCtl) void slaReminderCtl.syncPendingDecisions("login"); } catch { /* */ } // F3.5.4P — sincroniza fila offline do usuário logado
      try { if (slaReminderCtl) void slaReminderCtl.syncPendingIdleResponses("login"); } catch { /* */ } // F3.5.4Q — sincroniza fila offline de check-in
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
    // F3.5.4L — encerra a escuta de conclusão e limpa o modal/fila em memória (store PRESERVADO;
    // o próximo login reexibe os pendentes do novo usuário). currentUid zerado.
    currentUid = "";
    try { if (listenerWatchdog) listenerWatchdog.onLogout(); } catch { /* */ } // F3.5.4N — encerra supervisão (limpa timer de último recurso)
    try { if (notificationGrouping) notificationGrouping.reset(); } catch { /* */ } // F3.5.4O — limpa grupos em memória (não afeta sino/recibos)
    try { if (stopSlaWatch) { stopSlaWatch(); stopSlaWatch = null; } } catch { /* */ }
    try { if (slaReminderCtl) slaReminderCtl.clearActive(); } catch { /* */ }
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
