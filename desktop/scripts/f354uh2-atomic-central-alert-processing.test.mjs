#!/usr/bin/env node
/**
 * F3.5.4U-H2 — TESTE: PROCESSAMENTO ATÔMICO do alerta central (correção da SOBREPOSIÇÃO no "Registrando…").
 * =====================================================================================================
 * Causa (provada, painel adversarial): UMA janela / UM #card / UM documento. A sobreposição física era um
 * artefato de backing-store do Windows/DWM causado por win.setBounds (redimensionar+recentralizar) na janela
 * TRANSPARENTE VISÍVEL durante o clique (renderer resizeSelf → center() → setBounds). NÃO era 2 janelas nem 2
 * DOM. Correção: durante o PROCESSAMENTO a janela NÃO redimensiona/move (freeze no renderer + center() congelado
 * no main) e a fila MORFA em vez de hide→show (hide coalescido).
 *
 * Este teste tem DUAS partes, ambas CI-safe (sem Chromium):
 *   PARTE A — CONTRATO ESTÁTICO sobre o FONTE real (renderer/preload/window) + INVARIANTES CONGELADOS.
 *   PARTE B — COMPORTAMENTAL sobre o COMPILADO (dist/main/slaReminderWindow.js + slaReminder.js) com Electron
 *             STUBADO: espiona win.setBounds e prova que NENHUM setBounds ocorre enquanto processing=true
 *             (nem via IPC de resize, nem via push/center direto), que o hide é COALESCIDO (morfa na fila), e
 *             que a observabilidade do clique é SANITIZADA. Integração real com o controller (onDecide→commit).
 *
 * Rodar: node desktop/scripts/f354uh2-atomic-central-alert-processing.test.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import Module from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(__dirname, "..", "src");
const D = path.resolve(__dirname, "..", "dist");
const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.log("FAIL:", n); } };
const eq = (n, a, b) => ok(n + " (got " + JSON.stringify(a) + ")", a === b);

const html = fs.readFileSync(path.resolve(R, "renderer", "slareminder.html"), "utf8");
const pre = fs.readFileSync(path.resolve(R, "preload", "slareminder-preload.ts"), "utf8");
const win = fs.readFileSync(path.resolve(R, "main", "slaReminderWindow.ts"), "utf8");
const ctl = fs.readFileSync(path.resolve(R, "main", "slaReminder.ts"), "utf8");

// ═══════════════════════════ PARTE A — CONTRATO ESTÁTICO ═══════════════════════════

// ── Preload: novos canais setProcessing + obs ──
ok("A01 preload: setProcessing → slareminder-set-processing", /setProcessing:\s*\(on:[^)]*\)\s*=>\s*ipcRenderer\.send\("slareminder-set-processing",\s*!!on\)/.test(pre));
ok("A02 preload: obs → slareminder-obs", /obs:\s*\(payload:[^)]*\)\s*=>\s*ipcRenderer\.send\("slareminder-obs",\s*payload\)/.test(pre));

// ── Renderer: freeze/unfreeze + contagens ──
ok("A03 renderer: freezeFoot mede getBoundingClientRect().height e trava minHeight", /function freezeFoot\(\)\{[\s\S]*?getBoundingClientRect\(\)\.height[\s\S]*?minHeight=/.test(html));
ok("A04 renderer: freezeFoot centraliza (display:flex/justify-content:center) na área reservada", /function freezeFoot\(\)\{[\s\S]*?display="flex"[\s\S]*?justifyContent="center"/.test(html));
ok("A05 renderer: unfreezeFoot limpa minHeight + display/justify", /function unfreezeFoot\(\)\{[\s\S]*?minHeight=""[\s\S]*?display=""[\s\S]*?justifyContent=""/.test(html));
ok("A06 renderer: centralCounts (cardElementCount/visibleCardCount/processingLayerCount)", /function centralCounts\(\)\{[\s\S]*?cardElementCount[\s\S]*?visibleCardCount[\s\S]*?processingLayerCount/.test(html));
ok("A07 renderer: sendObs sanitizado (só números/enums; sem título/nome/UID)", /function sendObs\([\s\S]*?api\.obs[\s\S]*?rendererState:"processing"/.test(html) && !/sendObs[\s\S]{0,400}(taskTitle|actorName|clientName)/.test(html));

// ── Renderer: sendDecision (SLA) — ordem obrigatória ──
const sd = (html.match(/function sendDecision\(extra\)\{[\s\S]*?\n  \}/) || [""])[0];
ok("A08 sendDecision: 1º bloqueia duplo-clique (if(busy) return)", /if\(busy\) return;/.test(sd));
ok("A09 sendDecision: freezeFoot ANTES de qualquer troca de foot", sd.indexOf("freezeFoot()") >= 0 && sd.indexOf("freezeFoot()") < sd.indexOf("renderFoot(cur)"));
ok("A10 sendDecision: setProcessing(true) antes de decide", /api\.setProcessing && api\.setProcessing\(true\)/.test(sd) && sd.indexOf("setProcessing && api.setProcessing(true)") < sd.indexOf("api.decide"));
ok("A11 sendDecision: renderFoot (troca atômica) + sendObs, e SEM resizeSelf", /renderFoot\(cur\);/.test(sd) && /sendObs\(extra\.decisionType\)/.test(sd) && !/resizeSelf\(\)/.test(sd));
ok("A12 sendDecision: catch de erro restaura via showError (não perde o alerta)", /catch\(_e\)\{ busy=false; showError\(/.test(sd));

// ── Renderer: restaura setProcessing(false) em TODOS os caminhos ──
ok("A13 renderer: showMsg libera setProcessing(false)", /function showMsg\([\s\S]*?api\.setProcessing && api\.setProcessing\(false\)/.test(html));
ok("A14 renderer: showError libera setProcessing(false) + restaura o MESMO card", /function showError\([\s\S]*?api\.setProcessing && api\.setProcessing\(false\)[\s\S]*?renderFoot\(cur\)/.test(html));
ok("A15 renderer: promoção amarelo→vermelho libera setProcessing(false)", /busy=false; if\(mode==="msg"\) mode="idle"; lastError="";\s*try\{ api\.setProcessing && api\.setProcessing\(false\)/.test(html));
ok("A16 renderer: novo alerta (reset) libera setProcessing(false)", /Novo alerta[\s\S]*?busy=false[\s\S]*?api\.setProcessing && api\.setProcessing\(false\)/.test(html));
ok("A17 renderer: renderFoot destrava quando !busy", /function renderFoot\(v\)\{[\s\S]*?if\(!busy\)\{ unfreezeFoot\(\); \}/.test(html));

// ── Renderer: check-in SIMÉTRICO ──
const cs = (html.match(/function cSend\(extra\)\{[\s\S]*?\n  \}/) || [""])[0];
ok("A18 cSend: freezeFoot + setProcessing(true) + sendObs + SEM resizeSelf", /freezeFoot\(\)/.test(cs) && /api\.setProcessing && api\.setProcessing\(true\)/.test(cs) && /sendObs\(extra\.responseType\)/.test(cs) && !/resizeSelf\(\)/.test(cs));
ok("A19 renderer: cShowMsg/cShowError liberam setProcessing(false)", /function cShowMsg\([\s\S]*?api\.setProcessing && api\.setProcessing\(false\)/.test(html) && /function cShowError\([\s\S]*?api\.setProcessing && api\.setProcessing\(false\)/.test(html));
ok("A20 renderer: renderCheckinFoot destrava quando !cbusy", /function renderCheckinFoot\(v\)\{[\s\S]*?if\(!cbusy\)\{ unfreezeFoot\(\); \}/.test(html));
ok("A21 renderer: check-in novo ciclo libera setProcessing(false)", /ciclo novo[\s\S]*?cbusy=false;[\s\S]*?api\.setProcessing && api\.setProcessing\(false\)/.test(html));

// ── Renderer: UM único #card, troca ATÔMICA (sem criar 2º card) ──
ok("A22 renderer: um único #card estrutural + #foot filho", /<div class="card" id="card">/.test(html) && /<div id="foot"><\/div>/.test(html));
ok("A23 renderer: sem criação de 2º card (nenhum createElement/insertAdjacentHTML/appendChild de card)", !/createElement|insertAdjacentHTML|appendChild|cloneNode|document\.write/.test(html));
ok("A24 renderer: troca é só foot.innerHTML (atômica, no mesmo card)", /foot\.innerHTML = html;/.test(html) && /foot\.innerHTML=html;/.test(html));

// ── Window: flag processing + center() congelado (cobre TODOS os setBounds) ──
ok("A25 window: flag processing + pendingHide declaradas", /let processing = false;/.test(win) && /let pendingHide = false;/.test(win));
ok("A26 window: center() early-return quando processing (congela bounds)", /function center\(h: number\): void \{[\s\S]*?if \(processing\) return;[\s\S]*?win\.setBounds/.test(win));
ok("A27 window: ipc slareminder-set-processing seta a flag", /ipcMain\.on\("slareminder-set-processing",\s*\(_e,\s*on\)\s*=>\s*\{\s*processing = !!on;/.test(win));

// ── Window: hide COALESCIDO (setImmediate + cancelamento no push) ──
ok("A28 window: close() agenda hide via setImmediate (não esconde síncrono)", /close\(\): void \{[\s\S]*?pendingHide = true;[\s\S]*?setImmediate\(\(\) => \{ if \(pendingHide\) doHide\(\); \}\)/.test(win));
ok("A29 window: close() reseta processing=false", /close\(\): void \{[\s\S]*?processing = false;/.test(win));
ok("A30 window: push() CANCELA hide agendado (pendingHide=false) → morfa", /function push\(view: CentralView\): void \{[\s\S]*?pendingHide = false;/.test(win));
ok("A31 window: push() só centraliza no 1º show (wasVisible) — sem resize em morph visível", /const wasVisible = !!\(win && !win\.isDestroyed\(\) && win\.isVisible\(\)\);/.test(win) && /if \(!wasVisible\) center\(260\);/.test(win));

// ── Window: observabilidade do clique SANITIZADA ──
ok("A32 window: ipc slareminder-obs → central_alert.action_received sanitizado", /ipcMain\.on\("slareminder-obs"[\s\S]*?cobs\("central_alert\.action_received",\s*\{[\s\S]*?cardElementCount[\s\S]*?visibleCardCount[\s\S]*?processingLayerCount[\s\S]*?browserWindowCount[\s\S]*?rendererState/.test(win));
ok("A33 window: obs computa browserWindowCount (janelas centrais)", /BrowserWindow\.getAllWindows\(\)\.filter\([\s\S]*?Lembrete de SLA[\s\S]*?\.length/.test(win));
const _obsStart = win.indexOf('ipcMain.on("slareminder-obs"');
const _obsEnd = win.indexOf('ipcMain.on("slareminder-ok"', _obsStart);
const obsBlock = win.slice(_obsStart, _obsEnd > _obsStart ? _obsEnd : _obsStart + 900);
ok("A34 window: obs NÃO carrega campos proibidos (nome/título/cliente/UID/e-mail/token/conteúdo)", _obsStart >= 0 && !/\b(actorName|taskTitle|clientName|body|context|title|deep|photo|avatar|email|token)\b/.test(obsBlock));

// ── NÃO ACEITAR COMO CORREÇÃO (proibições do mandato) ──
// (a) sem z-index inflado na correção; (b) sem cobrir com fundo branco a camada de trás; (c) sem setTimeout p/
//     apagar o card antigo; (d) sem fechar a janela ANTES da confirmação da transação (controller congelado).
const closeBlock = (win.match(/close\(\): void \{[\s\S]*?cobs\("central_alert\.closed"\);\s*\},/) || [""])[0];
ok("A35 window: close() coalesce hide com setImmediate — SEM setTimeout p/ apagar card", /setImmediate/.test(closeBlock) && !/setTimeout/.test(closeBlock));
ok("A36 window: fix NÃO infla z-index nem cobre com branco", !/zIndex|z-index/.test(win));

// ── INVARIANTES CONGELADOS (controller 1.0.210 intacto) ──
ok("A37 controller: onDecide committed só FECHA após commit confirmado (closeIfStillActive)", /case "committed":[\s\S]*?rememberReceipt\("decision:"[\s\S]*?closeIfStillActive\(\)/.test(ctl));
ok("A38 controller: closeIfStillActive = fecha só se ainda ativo + showNext (nunca promove antes do commit)", /const closeIfStillActive = \(\) => \{ if \(active === cur\) \{ active = null; try \{ surface\.close\(\); \} catch \{[^}]*\} showNext\(\); \} \};/.test(ctl));
ok("A39 controller: dedup lógico H1 preservado (logicalOf)", /function logicalOf\(/.test(ctl));
ok("A40 controller: T-30/T-10 e níveis inalterados (classifyReminderLevel presente)", /export function classifyReminderLevel/.test(ctl));

console.log("\n[PARTE A] contrato estático: " + pass + " PASS / " + fail + " FAIL");

// ═══════════════════════════ PARTE B — COMPORTAMENTAL (Electron STUBADO) ═══════════════════════════
const bStart = pass, fStart = fail;

// ---- fake Electron ----
const logs = [];
const ipc = new Map();
function emit(channel, payload) { const h = ipc.get(channel); if (!h) throw new Error("no ipc handler: " + channel); return h({}, payload); }
let instances = [];
class FakeWebContents { constructor(id){ this.id = id; this.sent = []; } send(ch, v){ this.sent.push({ ch, v }); } isLoading(){ return false; } once(){} }
let wcId = 0;
class FakeBrowserWindow {
  constructor(opts){ this.opts = opts || {}; this._destroyed = false; this._visible = false; this.webContents = new FakeWebContents(++wcId);
    this.setBoundsCalls = 0; this.hideCalls = 0; this.showInactiveCalls = 0; this._title = opts && opts.title || ""; instances.push(this); }
  setAlwaysOnTop(){} setVisibleOnAllWorkspaces(){} removeMenu(){} on(){} setFocusable(){}
  loadFile(){}
  setBounds(){ this.setBoundsCalls++; }
  showInactive(){ this.showInactiveCalls++; this._visible = true; }
  show(){ this._visible = true; }
  hide(){ this.hideCalls++; this._visible = false; }
  isDestroyed(){ return this._destroyed; }
  isVisible(){ return this._visible && !this._destroyed; }
  getTitle(){ return this._title; }
  destroy(){ this._destroyed = true; this._visible = false; }
  static getAllWindows(){ return instances.filter((w) => !w._destroyed); }
  static getFocusedWindow(){ return null; }
}
const fakeScreen = {
  getCursorScreenPoint(){ return { x: 100, y: 100 }; },
  getDisplayNearestPoint(){ return { workArea: { x: 0, y: 0, width: 1366, height: 768 } }; },
  getPrimaryDisplay(){ return { workArea: { x: 0, y: 0, width: 1366, height: 768 } }; },
};
const fakeElectron = {
  app: { getAppPath: () => path.resolve(__dirname, ".."), getVersion: () => "1.0.211" },
  BrowserWindow: FakeBrowserWindow,
  ipcMain: { on: (ch, h) => ipc.set(ch, h) },
  screen: fakeScreen,
  Notification: class { constructor(){} on(){} show(){} },
};
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") return fakeElectron;
  return origLoad.apply(this, arguments);
};

// diag.js also requires nothing electron-specific; load the compiled surface + controller
const winMod = require(path.resolve(D, "main", "slaReminderWindow.js"));
const ctlMod = require(path.resolve(D, "main", "slaReminder.js"));

// ---- build surface + controller wired like main.ts (surface.onDecide → controller.onDecide) ----
let controller = null;
const surface = winMod.createSlaReminderSurface({
  onAck: (k, st) => { try { controller && controller.ack(k, st); } catch (e) {} },
  onOpenTask: () => {},
  onLog: (t, d) => { logs.push({ t, d }); },
  nativeNotify: () => true,
  onDecide: async (input) => (controller ? controller.onDecide(input) : { status: "ignored" }),
});
const acked = new Set(), pend = new Map(), dsettled = new Set(), dpend = new Map();
const store = {
  isAcked: (k) => acked.has(k), markPending: (r) => pend.set(r.key, r), removePending: (k) => pend.delete(k), markAck: (k) => acked.add(k), listPending: () => [...pend.values()],
  isDecisionSettled: (k) => dsettled.has(k), markDecisionPending: (r) => dpend.set(r.decisionKey, r), markDecisionSynced: (k) => { dsettled.add(k); }, markDecisionSuperseded: (k) => { dsettled.add(k); }, listDecisionsPendingSync: () => [...dpend.values()],
};
let committedNext = "committed";
controller = ctlMod.createSlaReminderController({
  surface, store, now: () => 1700000000000, appVersion: "1.0.211", taskValid: () => true, decisionsEnabled: () => true,
  soundFor: () => "", getUid: () => "u1",
  persistDecision: async () => ({ status: committedNext, deep: "detail/A" }),
});
const P = (task, dk, sev) => ({ eventType: "sla_warning", severity: sev || "warning", dedupKey: dk, taskId: task, targetUserId: "u1", responsibleName: "Ana", taskTitle: "T " + task, body: "b", context: "c", action: { deep: "detail/" + task } });
const nextTick = () => new Promise((r) => setImmediate(r));
const central = () => FakeBrowserWindow.getAllWindows().filter((w) => /Lembrete de SLA/.test(w.getTitle()));
const w0 = () => central()[0];

// B01 — show inicial cria UMA janela e centraliza (não-processing)
controller.enqueue(P("A", "kA-300000000000"));
eq("B01 uma única BrowserWindow central após show", central().length, 1);
ok("B02 show inicial chamou setBounds (center) — janela oculta→visível", w0().setBoundsCalls >= 1);

// B03 — DURANTE processing NENHUM setBounds (nem via IPC de resize)
w0().setBoundsCalls = 0;
emit("slareminder-set-processing", true);
emit("slareminder-resize", 300);           // renderer NÃO deveria enviar isto no busy; se enviar, é IGNORADO
emit("slareminder-resize", 180);
eq("B03 setBounds NÃO chamado durante processing (IPC resize congelado)", w0().setBoundsCalls, 0);

// B04 — refreshCounter durante processing (2º alerta chega): surface.show → push → center congelado
controller.enqueue(P("B", "kB-300000000000"));   // chega enquanto o 1º está ativo+processing ⇒ refreshCounter→show
eq("B04 setBounds NÃO chamado no refreshCounter durante processing", w0().setBoundsCalls, 0);
eq("B04b continua UMA única janela central", central().length, 1);

// B05 — liberar processing ⇒ resize volta a funcionar
emit("slareminder-set-processing", false);
emit("slareminder-resize", 320);
ok("B05 setBounds volta a funcionar após liberar processing", w0().setBoundsCalls >= 1);

// B06 — hide COALESCIDO: close() não esconde síncrono; após tick esconde
w0()._visible = true; w0().hideCalls = 0;
surface.close();
eq("B06 close() NÃO esconde síncrono (hide coalescido)", w0().hideCalls, 0);
await nextTick();
eq("B06b após o tick, hide é chamado (fila vazia)", w0().hideCalls, 1);

// B07 — coalescência: close()+show() no mesmo tick ⇒ MORFA (hide cancelado)
w0()._visible = true; w0().hideCalls = 0; const beforeBounds = w0().setBoundsCalls;
surface.close();
surface.show(P("C", "kC-300000000000").action ? { key: "kC-300000000000", base: "C:u1", level: "warning", title: "ATENÇÃO", actorName: "A", actorAvatar: "", taskTitle: "T C", clientName: "", body: "b", context: "c", deep: "detail/C", queueLen: 1, soundDataUri: "", decisionsEnabled: true, taskId: "C" } : null);
await nextTick();
eq("B07 hide CANCELADO quando um show ocorre antes do tick (morfa)", w0().hideCalls, 0);
eq("B07b morph em janela já visível NÃO chama center (setBounds) no push", w0().setBoundsCalls, beforeBounds);
ok("B07c janela recebeu o novo card (morph via IPC)", w0().webContents.sent.some((s) => s.ch === "slareminder-card"));

// B08 — observabilidade do clique: sanitizada + browserWindowCount
logs.length = 0;
emit("slareminder-obs", { actionType: "acknowledge_only", cardElementCount: 1, visibleCardCount: 1, processingLayerCount: 1, rendererState: "processing" });
const ar = logs.map((l) => l).filter((l) => l.t === "central_alert.action_received").pop();
ok("B08 obs emite central_alert.action_received", !!ar);
if (ar) {
  eq("B08a cardElementCount=1", ar.d.cardElementCount, 1);
  eq("B08b visibleCardCount=1", ar.d.visibleCardCount, 1);
  eq("B08c processingLayerCount=1", ar.d.processingLayerCount, 1);
  eq("B08d browserWindowCount=1", ar.d.browserWindowCount, 1);
  eq("B08e actionType preservado", ar.d.actionType, "acknowledge_only");
  const j = JSON.stringify(ar.d);
  ok("B08f obs SEM campos proibidos", !/(actorName|taskTitle|clientName|"body"|"context"|"title"|"deep"|photo|avatar|email|token)/.test(j));
}

// B09 — INTEGRAÇÃO com o controller: clique → onDecide committed → NENHUM setBounds durante o processamento
//        e a janela só fecha (deferred hide) DEPOIS do commit.
instances = []; wcId = 0; ipc.clear(); logs.length = 0; acked.clear(); pend.clear(); dsettled.clear(); dpend.clear();
let controller2 = null;
const surface2 = winMod.createSlaReminderSurface({
  onAck: () => {}, onOpenTask: () => {}, onLog: (t, d) => logs.push({ t, d }), nativeNotify: () => true,
  onDecide: async (input) => (controller2 ? controller2.onDecide(input) : { status: "ignored" }),
});
controller2 = ctlMod.createSlaReminderController({
  surface: surface2, store, now: () => 1700000000000, appVersion: "1.0.211", taskValid: () => true, decisionsEnabled: () => true,
  soundFor: () => "", getUid: () => "u1", persistDecision: async () => ({ status: "committed", deep: "detail/A" }),
  onLog: (t, d) => logs.push({ t, d }),
});
controller2.enqueue(P("A", "kA-300000000000"));
const wc = central()[0];
wc._visible = true; wc.setBoundsCalls = 0; wc.hideCalls = 0;
emit("slareminder-set-processing", true);         // renderer marca processing no clique
const res = await emit("slareminder-decide", { key: "kA-300000000000", decisionType: "acknowledge_only" }); // clique real → onDecide
eq("B09 NENHUM setBounds durante o processamento do commit", wc.setBoundsCalls, 0);
eq("B09b janela NÃO fechada síncrono (aguarda o commit + tick)", wc.hideCalls, 0);
await nextTick();
eq("B09c após commit + tick, janela escondida (fila vazia)", wc.hideCalls, 1);
ok("B09d observabilidade central_alert.action_received emitida no clique/decisão", logs.some((l) => l.t === "central_alert.action_received"));

Module._load = origLoad;

console.log("[PARTE B] comportamental (electron-stub): " + (pass - bStart) + " PASS / " + (fail - fStart) + " FAIL");
console.log("\nF3.5.4U-H2 ATOMIC-CENTRAL-ALERT-PROCESSING: " + pass + " PASS / " + fail + " FAIL");
if (fail) { console.error("::error:: F3.5.4U-H2 divergiu do contrato de processamento atômico"); process.exit(1); }
console.log("OK — durante o processamento NÃO há setBounds na janela transparente visível (freeze renderer + center() congelado); hide COALESCIDO (morfa na fila); UMA janela / UM card; observabilidade sanitizada; controller 1.0.210 congelado.");
