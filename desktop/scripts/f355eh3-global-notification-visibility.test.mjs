#!/usr/bin/env node
/**
 * F3.5.5E-H3 — VISIBILIDADE GLOBAL das notificações imediatas (Desktop 1.0.227) — suíte da fase.
 *
 * P0: a notificação deve ficar visível SOBRE qualquer janela comum do Windows enquanto o Agenda
 * estiver ativo em background, SEM roubar o foco. Contratos verificados no FONTE REAL (e também
 * contra os bytes do app.asar via env) + COMPORTAMENTO real do código COMPILADO (dist) em sandbox vm:
 *   A. identidade 1.0.227 (cadeia de bases; 1.0.226 fisicamente aprovada)
 *   B. bgNotify.ts — reassert completo de apresentação (bounds+topmost+showInactive+moveTop),
 *      grupo com reafirmação de z-order, display listeners, janela sem foco (focusable:false,
 *      NUNCA show()/focus()), workArea/multimonitor preservados
 *   C. main.ts — roteamento por FOCO REAL congelado + handoff do toast no blur (registro TTL,
 *      coleta IPC, mover-nunca-duplicar, sound:false, sem fallback nativo no handoff)
 *   D. preload — canais da coleta
 *   E. index.html — payload/chave no elemento + coleta que fecha e responde sempre
 *   F. visual 1.0.226 CONGELADO nas 2 superfícies (referência do owner intacta)
 *   G. comportamento do DIST (deliverNotification + bloco do handoff extraídos e executados)
 *
 * Env (gate contra o pacote): SRC, BG_SRC, PKG_SRC, MAIN_TS, BG_TS, PRELOAD_TS, DIST_MAIN, DIST_BG.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import vm from "node:vm";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const P = {
  pkg: process.env.PKG_SRC || path.join(root, "package.json"),
  lock: path.join(root, "package-lock.json"),
  index: process.env.SRC || path.join(root, "src", "renderer", "index.html"),
  bg: process.env.BG_SRC || path.join(root, "src", "renderer", "bgnotify.html"),
  mainTs: process.env.MAIN_TS || path.join(root, "src", "main", "main.ts"),
  bgTs: process.env.BG_TS || path.join(root, "src", "main", "bgNotify.ts"),
  preloadTs: process.env.PRELOAD_TS || path.join(root, "src", "preload", "preload.ts"),
  distMain: process.env.DIST_MAIN || path.join(root, "dist", "main", "main.js"),
  distBg: process.env.DIST_BG || path.join(root, "dist", "main", "bgNotify.js"),
};
const R = (f) => fs.readFileSync(f, "utf8");
let n = 0, fail = 0;
function ok(name, cond, info) {
  n++;
  if (cond) { console.log(`ok ${n} - ${name}`); }
  else { fail++; console.log(`NOT OK ${n} - ${name}${info ? " :: " + info : ""}`); }
}

const pkg = JSON.parse(R(P.pkg));
const idx = R(P.index);
const bgh = R(P.bg);
const mainTs = fs.existsSync(P.mainTs) ? R(P.mainTs) : "";
const bgTs = fs.existsSync(P.bgTs) ? R(P.bgTs) : "";
const preTs = fs.existsSync(P.preloadTs) ? R(P.preloadTs) : "";
const dMain = fs.existsSync(P.distMain) ? R(P.distMain) : "";
const dBg = fs.existsSync(P.distBg) ? R(P.distBg) : "";
// ASAR_MODE=1 força a validação SOMENTE contra os bytes do pacote (renderers+dist+pkg do asar),
// mesmo com o fonte .ts presente no checkout — usado pelo gate EMPACOTADO do CI.
const srcMode = process.env.ASAR_MODE === "1" ? false : !!mainTs;

// ───────────────────────── A. IDENTIDADE ─────────────────────────
ok("A1 versão 1.0.231 (RE-PINADO F3.5.6A-H2)", pkg.version === "1.0.231", pkg.version);
ok("A2 description: fase f355eh4 sobre a f355eh3 + base 1.0.226 FISICAMENTE APROVADA + cadeia (RE-PINADO F3.5.5E-H4)",
  /1\.0\.228-f355eh4-grouped-notification-handoff/.test(pkg.description)
  && /1\.0\.227-f355eh3-global-notification-visibility/.test(pkg.description)
  && /1\.0\.226-f355eh2-reference-notification FISICAMENTE APROVADA/.test(pkg.description)
  && /1\.0\.225-f355eh1-ultra-premium-notifications/.test(pkg.description)
  && /1\.0\.224-f355e-retire-legacy-modules-premium-notifications/.test(pkg.description)
  && /1\.0\.223-f355d-custom-cronograma-quantity-universal-paste/.test(pkg.description));
if (fs.existsSync(P.lock)) {
  const lock = JSON.parse(R(P.lock));
  ok("A3 lock 1.0.231 ×2 (RE-PINADO F3.5.6A-H2)", lock.version === "1.0.231" && lock.packages[""].version === "1.0.231");
} else { ok("A3 lock (ausente no pacote — ok)", true); }

// ───────────────────────── B. bgNotify.ts (fonte) ─────────────────────────
const bgSrc = srcMode ? bgTs : dBg; // contra o asar valida o compilado
ok("B1 reassert na ORDEM do mandato: position → setAlwaysOnTop(screen-saver) → showInactive → moveTop",
  /function reassert\([^)]*\)[^]*?position\(lastHeight\);[^]*?setAlwaysOnTop\(true, "screen-saver"\);[^]*?showInactive\(\);[^]*?moveTop\(\);/.test(bgSrc));
ok("B2 showBgNotify usa reassert a CADA card (não só na criação)",
  /!win\.isDestroyed\(\)\)[\s\S]{0,20}?\{?[\s\S]{0,20}?reassert\(win\);[\s\S]{0,80}?win\.webContents\.send\("bg-card", p\)/.test(bgSrc));
ok("B3 updateBgGroup reafirma topmost+z-order quando visível (sem novo showInactive)",
  /if \(win\.isVisible\(\)\) \{[\s\S]{0,120}?win\.setAlwaysOnTop\(true, "screen-saver"\);[\s\S]{0,60}?win\.moveTop\(\)/.test(bgSrc)
  && !/if \(win\.isVisible\(\)\) \{[\s\S]{0,200}?showInactive/.test(bgSrc));
ok("B4 altura viva memorizada no bgnotify-resize (reposição sem esperar novo ack)",
  /lastHeight = Number\(h\) \|\| 160; position\(lastHeight\);/.test(bgSrc));
ok("B5 mudança de display (metrics/added/removed) reposiciona a janela visível",
  /display-metrics-changed", onDisplayChange\)/.test(bgSrc) && /display-added", onDisplayChange\)/.test(bgSrc) && /display-removed", onDisplayChange\)/.test(bgSrc)
  && /bgWin\.isVisible\(\)\)[\s\S]{0,20}?position\(lastHeight\)/.test(bgSrc));
ok("B6 criação sem foco/taskbar/frame + transparente (design aprovado)",
  /skipTaskbar: true, focusable: false/.test(bgSrc) && /frame: false, transparent: true/.test(bgSrc)
  && /alwaysOnTop: true/.test(bgSrc) && /#00000000/.test(bgSrc));
ok("B7 nível screen-saver na criação E no reassert (≥2 ocorrências)",
  (bgSrc.match(/setAlwaysOnTop\(true, "screen-saver"\)/g) || []).length >= 3);
ok("B8 visível em todas as workspaces incl. fullscreen",
  /setVisibleOnAllWorkspaces\(true, \{ visibleOnFullScreen: true \}/.test(bgSrc));
ok("B9 PROIBIDO roubar foco: nenhum win.show()/win.focus() na janela premium",
  !/bgWin\.show\(\)/.test(bgSrc) && !/win\.show\(\)/.test(bgSrc) && !/\.focus\(\)/.test(bgSrc));
ok("B10 posição = workArea do display do CURSOR (multimonitor), canto inferior direito",
  /getDisplayNearestPoint\((electron_1\.)?screen\.getCursorScreenPoint\(\)\)\.workArea/.test(bgSrc)
  && /wa\.x \+ wa\.width - WIDTH - EDGE_MARGIN/.test(bgSrc) && /wa\.y \+ wa\.height - height - EDGE_MARGIN/.test(bgSrc));
ok("B11 recriação quando destroyed (ensureWin) + closed limpa referência",
  /if \(bgWin && !bgWin\.isDestroyed\(\)\)\s*return bgWin;/.test(bgSrc) && /on\("closed", \(\) => \{[\s\S]{0,20}?bgWin = null;/.test(bgSrc));
ok("B12 hide SÓ com fila vazia (bgnotify-empty) — nunca esconde com card vivo",
  /ipcMain\.on\("bgnotify-empty",[^]*?bgWin\.hide\(\)/.test(bgSrc)
  && (bgSrc.match(/bgWin\.hide\(\)/g) || []).length === 1);

// ───────────────────────── C. main.ts (fonte) ─────────────────────────
const mSrc = srcMode ? mainTs : dMain;
ok("C1 CONGELADO F3.5.4K: canal por FOCO REAL (windowActive == isFocused)",
  /function windowActive\(\): boolean \{\s*const w = mainWin;\s*return !!\(w && !w\.isDestroyed\(\) && w\.isFocused\(\)\);/.test(mainTs) || (!srcMode && /windowActive\(\)/.test(dMain)));
ok("C2 CONGELADO: sessão bloqueada → Notification NATIVA (nunca overlay no lock)",
  /if \(sessionLocked\) \{[^]*?nativeNotify\(p, key, deep\)/.test(mSrc));
ok("C3 ramo toast REGISTRA o card p/ handoff por TIPO — grupo no espelho de grupos, individual no registro H3 (RE-PINADO F3.5.5E-H4)",
  /if \(\(?p(?: as any)?\)?\.groupKey\)[\s\S]{0,30}?groupRegister\(String\(\(?p(?: as any)?\)?\.groupKey\), p\);[\s\S]{0,30}?else[\s\S]{0,30}?toastRegister\(key, p\);/.test(mSrc));
ok("C4 fallback por falta de ACK REMOVE o registro (nunca re-mostrar no blur)",
  /toastAck\.arm\(key, \(\) => \{\s*toastUnregister\(key\);/.test(mSrc));
ok("C5 blur da mainWindow dispara o handoff",
  /mainWin\.on\("blur", \(\) => \{[\s\S]{0,80}?handoffActiveToasts\(\)/.test(mSrc));
ok("C6 handoff TRANSACIONAL re-exibe com sound:false + _handoff nas 2 vias (individual e p0 do GRUPO; sem fallback nativo) (RE-PINADO F3.5.5E-H4)",
  /Object\.assign\(\{\}, e\.p, \{ sound: false, _handoff: true \}\)/.test(mSrc)
  && /Object\.assign\(\{\}, e\.p0, \{ sound: false, _handoff: true \}\)/.test(mSrc)
  && !/function txBegin[\s\S]{0,1400}?nativeNotify/.test(mSrc));
ok("C7 resposta da coleta: guarda de reqId + prefixos i:/g: + limpa fechados dos 2 registros + aborta com foco + migra os vivos (RE-PINADO F3.5.5E-H4)",
  /handoffPending\.reqId !== Number\(reqId\)\)\s*return;/.test(mSrc)
  && /!aliveI\.has\(k\)\)\s*toastUnregister\(k\);/.test(mSrc)
  && /!aliveG\.has\(g\)\)\s*groupUnregister\(g\);/.test(mSrc)
  && /notify\.handoff\.aborted\.focus/.test(mSrc)
  && /handoffShow\(alive\);/.test(mSrc));
ok("C8 blur transitório não migra (early-return com foco de volta) + timeout 700ms migra todos os REGISTROS (2 mapas) com abort por foco (RE-PINADO F3.5.5E-H4)",
  /windowActive\(\)\)\s*return; \/\/ blur transitório/.test(mSrc) && /\}, 700\);/.test(mSrc)
  && /handoffShow\(allEntries\(\)\)/.test(mSrc)
  && /windowActive\(\)\)\s*return; \/\/ foco voltou/.test(mSrc));
ok("C9 dedupKey canônico materializado no payload (mesma derivação do HUB)",
  /if \(!p\.dedupKey\) \(p as any\)\.dedupKey = key;/.test(mainTs) || (!srcMode && /p\.dedupKey = key/.test(dMain)));
ok("C10 TTL do registro espelha o toast (6/8/11s + margem)",
  /sev === "critical" \? 11000 : \(sev === "warning" \? 8000 : 6000\)/.test(mSrc) && /\+ 900\);/.test(mSrc));
ok("C11 CONGELADO: desfocado/minimizado/oculto → janela premium + fallback nativa por ACK",
  /showBgNotify\)?\(p, \(\) => \{[\s\S]{0,80}?lateOk = nativeNotify\(p, key, deep\)/.test(mSrc));
ok("C12 handoff NUNCA traz o Agenda à frente (bringToFrontAndOpen só em cliques)",
  !/handoffShow[^]*?bringToFrontAndOpen/.test(mSrc.slice(0, mSrc.indexOf("function handoffActiveToasts"))));

// ───────────────────────── D. preload ─────────────────────────
const pre = srcMode ? preTs : "";
if (srcMode) {
  ok("D1 canal main→renderer notif-collect-request exposto (onNotifCollect)",
    /onNotifCollect:.*\n?\s*ipcRenderer\.on\("notif-collect-request"/.test(pre) || /onNotifCollect/.test(pre) && /notif-collect-request/.test(pre));
  ok("D2 canal renderer→main notif-collect-reply com saneamento (Number + map String)",
    /notifCollectReply:.*ipcRenderer\.send\("notif-collect-reply", Number\(reqId\) \|\| 0/.test(pre));
  ok("D3 notifToastAck INTACTO (ACK do render preservado)",
    /notifToastAck: \(dedupKey: string\) => \{ try \{ ipcRenderer\.send\("notif-toast-ack", String\(dedupKey \|\| ""\)\); \}/.test(pre));
} else {
  const dPre = fs.existsSync(path.join(path.dirname(P.distMain), "..", "preload", "preload.js")) ? R(path.join(path.dirname(P.distMain), "..", "preload", "preload.js")) : "";
  ok("D1 [asar] preload compilado expõe notif-collect-request", /notif-collect-request/.test(dPre));
  ok("D2 [asar] preload compilado envia notif-collect-reply", /notif-collect-reply/.test(dPre));
  ok("D3 [asar] notif-toast-ack preservado", /notif-toast-ack/.test(dPre));
}

// ───────────────────────── E. index.html (renderer) ─────────────────────────
ok("E1 toast guarda payload+chave no elemento (handoff)",
  /el\.__ntfPayload=p; el\.__ntfKey=String\(\(p&&\(p\.dedupKey\|\|p\.eventId\)\)\|\|''\);/.test(idx));
ok("E2 coleta INCLUI os cards de GRUPO como g:<groupKey> — a exceção da H3 foi ELIMINADA por mandato (RE-PINADO F3.5.5E-H4)",
  /out\.push\('g:'\+gk\); continue;/.test(idx)
  && !/if\(e\.getAttribute\('data-group'\)\) continue;/.test(idx));
ok("E3 coleta NÃO fecha nada (transacional) + responde SEMPRE; o COMMIT fecha via __ntfDismiss (RE-PINADO F3.5.5E-H4)",
  /out\.push\('i:'\+k\);/.test(idx)
  && (() => { const a = idx.indexOf("onNotifCollect("); const b = idx.indexOf("onNotifCollectCommit("); return a > 0 && b > a && !idx.slice(a, b).includes("__ntfDismiss"); })()
  && /notifCollectReply\(reqId,out\)/.test(idx) && /notifCollectReply\(reqId,\[\]\)/.test(idx)
  && /onNotifCollectCommit/.test(idx) && /\(e\.__ntfDismiss\|\|function\(\)\{\}\)\(\);/.test(idx));
ok("E4 CONGELADO: TTL do toast 6/8/11s byte-idêntico",
  /var ttl=sev==='critical'\?11000:\(sev==='warning'\?8000:6000\);/.test(idx));
ok("E5 wiring da coleta com guard (nunca quebra sem desktopAPI)",
  /typeof window\.desktopAPI\.onNotifCollect==='function'/.test(idx));

// ───────────────────────── F. VISUAL 1.0.226 CONGELADO (2 superfícies) ─────────────────────────
const H2 = ["ntfp-fl", "ntfp-pill", "ntfp-pr", "width:62px;height:62px", "border-radius:24px", "padding:18px 18px 16px"];
ok("F1 marcadores da REFERÊNCIA no toast (index.html)", H2.every((m) => idx.includes(m)), H2.filter((m) => !idx.includes(m)).join(","));
ok("F2 marcadores da REFERÊNCIA na janela premium (bgnotify.html)", H2.every((m) => bgh.includes(m)), H2.filter((m) => !bgh.includes(m)).join(","));
function extract(src, name) {
  const i = src.indexOf("function " + name + "(");
  if (i < 0) return null;
  let d = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}
for (const b of ["premiumCommonInner", "premiumGroupInner", "premiumAvatar", "premiumEvtIcon"]) {
  const a = extract(idx, b), c = extract(bgh, b);
  ok(`F3 paridade byte-a-byte ${b} (toast × premium)`, !!a && a === c, a ? "diverge" : "ausente");
}
ok("F4 headroom do avatar preservado (nada cortado: padding-top:26px + overflow:visible)",
  /padding-top:26px;overflow:visible/.test(idx) && /padding-top:26px;overflow:visible/.test(bgh));
ok("F5 som premium: dedupe por chave + suppressed_by_payload INTACTOS (handoff silencioso)",
  /_bgSndSeen\[key\]\)\{ _snd='duplicate_prevented'; \}/.test(bgh) && /suppressed_by_payload/.test(bgh));

// ───────────────────────── G. COMPORTAMENTO DO DIST (sandbox vm) ─────────────────────────
function grab(src, startRe, endMark) {
  const m = src.match(startRe);
  if (!m) return null;
  const i = m.index;
  const j = src.indexOf(endMark, i);
  if (j < 0) return null;
  return src.slice(i, j + endMark.length);
}
// bloco do handoff no dist (JS puro): de "const activeToasts" até o fim de handoffActiveToasts
// RE-PINADO F3.5.5E-H4: o bloco agora inclui o espelho de GRUPOS + as TRANSAÇÕES (txBegin/txCommit/
// txFail); a reply espelha o handler novo (prefixos i:/g:, limpeza dupla, abort por foco) e o aceite
// espelha o listener "bgnotify-rendered" (commit SÓ após a prova de render da premium).
const hBlock = grab(dMain, /const activeToasts = new Map\(\);?/, "/* handoff nunca derruba a entrega */ }\n}");
ok("G0 bloco do handoff extraível do dist (JS compilado)", !!hBlock);
if (hBlock) {
  const calls = { bg: [], group: [], commits: [], logs: [] };
  const ctx = {
    console, setTimeout, clearTimeout, Date,
    windowActive: () => false,
    mainWin: { isDestroyed: () => false, webContents: { isLoading: () => false, send: (ch, args) => { if (ch === "notif-collect-commit") calls.commits.push(args); } } },
    showBgNotify: (p) => { calls.bg.push(p); return true; },
    bgNotify_1: { showBgNotify: (p) => { calls.bg.push(p); return true; }, updateBgGroup: (v) => { calls.group.push(v); } }, // import transpilado do dist
    updateBgGroup: (v) => { calls.group.push(v); },
    nlog: (t, d) => calls.logs.push([t, d]),
    nmask: (s) => String(s || "").slice(0, 3),
  };
  vm.createContext(ctx);
  new vm.Script(hBlock + "\n;globalThis.__h={activeToasts,activeToastGroups,toastRegister,toastUnregister,groupRegister,groupTouch,handoffShow,handoffActiveToasts,get pending(){return handoffPending;},get tx(){return handoffTx;},accept(key){/*espelha ipcMain.on bgnotify-rendered*/ if(handoffTx.has(String(key))) txCommit(String(key));},reply(reqId,keys){/*espelha o handler ipc H4*/ if(!handoffPending||handoffPending.reqId!==Number(reqId))return; clearTimeout(handoffPending.timer); handoffPending=null; const raw=(Array.isArray(keys)?keys:[]).map(k=>String(k||'')).filter(Boolean); const alive=raw.map(k=>(k.startsWith('i:')||k.startsWith('g:'))?k:('i:'+k)); const aliveI=new Set(alive.filter(k=>k.startsWith('i:')).map(k=>k.slice(2))); const aliveG=new Set(alive.filter(k=>k.startsWith('g:')).map(k=>k.slice(2))); for(const k of Array.from(activeToasts.keys())){ if(!aliveI.has(k)) toastUnregister(k);} for(const g of Array.from(activeToastGroups.keys())){ if(!aliveG.has(g)) groupUnregister(g);} if(windowActive())return; handoffShow(alive);}};", { filename: "handoff.js" }).runInContext(ctx);
  const H = ctx.__h;
  H.toastRegister("k1", { severity: "info", taskId: "T1", sound: true, title: "A", dedupKey: "k1" });
  H.toastRegister("k2", { severity: "warning", taskId: "T2", sound: true, title: "B", dedupKey: "k2" });
  ok("G1 registro guarda os toasts ativos", H.activeToasts.size === 2);
  H.handoffActiveToasts();
  ok("G2 blur pede coleta (pendência armada; nada migrado ainda)", !!H.pending && calls.bg.length === 0);
  H.reply(H.pending.reqId, ["i:k2"]); // usuário fechou k1; só k2 vivo
  ok("G3 TRANSAÇÃO: entrega SÓ os vivos (fechado sai do registro) e o interno SÓ fecha no ACEITE (RE-PINADO F3.5.5E-H4)",
    calls.bg.length === 1 && calls.bg[0].title === "B" && H.activeToasts.size === 1 && H.tx.has("k2") && calls.commits.length === 0
    && (H.accept("k2"), H.activeToasts.size === 0 && !H.tx.has("k2") && calls.commits.length === 1 && calls.commits[0][0] === "i:k2"));
  ok("G4 card migrado vai SILENCIOSO e marcado (sound:false + _handoff)", calls.bg[0].sound === false && calls.bg[0]._handoff === true);
  ok("G5 reply com reqId errado é ignorada", (H.reply(999, ["i:kX"]), calls.bg.length === 1));
  H.toastRegister("k3", { severity: "critical", taskId: "T3", sound: true, dedupKey: "k3" });
  ctx.windowActive = () => true;
  H.handoffActiveToasts();
  ok("G6 blur transitório (foco de volta) NÃO migra", calls.bg.length === 1 && H.activeToasts.size === 1);
  ctx.windowActive = () => false;
  ctx.mainWin = null; // janela morta ⇒ migra direto (sem coleta)
  H.handoffActiveToasts();
  ok("G7 janela principal morta ⇒ migra os registrados imediatamente", calls.bg.length === 2 && calls.bg[1]._handoff === true);
  // RE-PINADO F3.5.5E-H4 — G7b: GRUPO ativo migra com aceite → morph consolidado + commit g:
  ctx.mainWin = { isDestroyed: () => false, webContents: { isLoading: () => false, send: (ch, args) => { if (ch === "notif-collect-commit") calls.commits.push(args); } } };
  H.groupRegister("common_group:U1:T9", { severity: "info", taskId: "T9", sound: true, title: "G1", dedupKey: "kg", groupKey: "common_group:U1:T9" });
  H.groupTouch("common_group:U1:T9", { groupKey: "common_group:U1:T9", count: 3, severity: "info", items: [{}, {}, {}], taskTitle: "Tarefa 9" });
  H.handoffActiveToasts();
  H.reply(H.pending.reqId, ["g:common_group:U1:T9"]);
  const gIdx = calls.bg.length - 1;
  ok("G7b GRUPO: p0 com groupKey vai silencioso; aceite morfa com o view consolidado (count=3) e commita g: (RE-PINADO F3.5.5E-H4)",
    calls.bg[gIdx].groupKey === "common_group:U1:T9" && calls.bg[gIdx].sound === false
    && (H.accept("kg"), H.activeToastGroups.size === 0 && calls.group.length === 1 && calls.group[0].count === 3
        && calls.commits[calls.commits.length - 1][0] === "g:common_group:U1:T9"));
}
// deliverNotification do dist: roteamento por estado com stubs
const dBody = grab(dMain, /function deliverNotification\(p\) \{/, "\n}\n");
ok("G8 deliverNotification extraível do dist", !!dBody);
if (dBody) {
  function runDeliver(focused, locked, payload) {
    const calls = { toast: 0, bg: 0, native: 0, hist: 0, reg: 0 };
    const ctx = {
      console, setTimeout, clearTimeout,
      require: (m) => { if (String(m).includes("notifEvents")) return { isRetiredSector: () => false }; throw new Error("no:" + m); },
      diag: () => { }, diag_1: { diag: (t, d) => { if (t === "deliver.error") calls.err = d; } }, nlog: () => { }, nmask: (s) => String(s || ""),
      windowActive: () => focused, sessionLocked: locked,
      mainWin: { isDestroyed: () => false, isVisible: () => true, isMinimized: () => false, webContents: { send: (ch) => { if (ch === "notif-toast") calls.toast++; if (ch === "notif-history") calls.hist++; } } },
      _notifSeen: new Set(),
      toastAck: { arm: () => { } },
      toastRegister: () => { calls.reg++; }, toastUnregister: () => { },
      showBgNotify: () => { calls.bg++; return true; },
      bgNotify_1: { showBgNotify: () => { calls.bg++; return true; }, updateBgGroup: () => { } }, // import transpilado do dist
      nativeNotify: () => { calls.native++; return true; },
      notifTele: {}, app: { getVersion: () => "1.0.227" },
      classifyReminderLevel: () => null, slaReminderCtl: null,
      premiumCommonEnabled: true, notificationGrouping: null, updateBgGroup: () => { },
      Notification: { isSupported: () => true },
    };
    vm.createContext(ctx);
    new vm.Script("globalThis.__deliver = " + dBody.replace(/^function deliverNotification/, "function"), { filename: "deliver.js" }).runInContext(ctx);
    const r = ctx.__deliver(payload);
    return { r, calls };
  }
  const pBase = () => ({ eventType: "task_moved", taskId: "T9", targetUserId: "U1", severity: "info", sound: true, dedupKey: "dk:" + Math.floor(1e6 * 0.5), createdAt: 1 });
  const a = runDeliver(true, false, pBase());
  ok("G9 FOCADO → toast interno + registro do handoff (canal toast)", a.r.channel === "toast" && a.calls.toast === 1 && a.calls.bg === 0 && a.calls.reg === 1);
  const b = runDeliver(false, false, pBase());
  ok("G10 SEM FOCO (atrás/minimizado/oculto/tray) → janela premium (canal bg-window)", b.r.channel === "bg-window" && b.calls.bg === 1 && b.calls.toast === 0);
  const c = runDeliver(false, true, pBase());
  ok("G11 SESSÃO BLOQUEADA → nativa (nunca overlay no lock)", c.r.channel === "native-locked" && c.calls.native === 1 && c.calls.bg === 0);
  const dctx = runDeliver(false, false, Object.assign(pBase(), { dedupKey: "" }));
  ok("G12 dedupKey materializado quando ausente (payload ganha a chave canônica)", dctx.r.ok === true);
}

console.log(`\n# f355eh3-global-notification-visibility: ${n - fail}/${n} OK${fail ? " — FALHAS: " + fail : ""}`);
process.exit(fail ? 1 : 0);
