/* F3.5.5E-H4 — HANDOFF COMPLETO DE NOTIFICAÇÕES AGRUPADAS (Desktop 1.0.228)
 * ============================================================================
 * Elimina a ÚNICA exceção declarada da F3.5.5E-H3: "grupo ativo não migra no blur".
 * Contratos + comportamento do handoff TRANSACIONAL: coleta (i:/g:) SEM fechar →
 * entrega à janela premium (showBgNotify/updateBgGroup — caminhos congelados F3.5.4O)
 * → ACEITE (prova de render "bgnotify-rendered") → COMMIT fecha o interno. Retry e
 * preservação sem perda; som 0×; dedupe/contagem/CTA/histórico preservados; visual
 * 1.0.226 CONGELADO. Roda no FONTE e no PACOTE (ASAR_MODE=1 valida dist/renderers
 * do app.asar — mesmas regexes TOLERANTES à forma compilada). */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const R = (p) => fs.readFileSync(p, "utf8");
/* No gate EMPACOTADO do CI (ASAR_MODE=1) os paths vêm por env e apontam para os BYTES extraídos do
 * app.asar — mesma convenção da suíte f355eh3; sem env, valida o checkout (modo fonte/local). */
const P = {
  pkg: process.env.PKG_SRC || path.join(ROOT, "package.json"),
  lock: path.join(ROOT, "package-lock.json"),
  mainTs: path.join(ROOT, "src", "main", "main.ts"),
  bgTs: path.join(ROOT, "src", "main", "bgNotify.ts"),
  groupTs: path.join(ROOT, "src", "main", "notificationGrouping.ts"),
  preTs: path.join(ROOT, "src", "preload", "preload.ts"),
  idx: process.env.SRC || path.join(ROOT, "src", "renderer", "index.html"),
  bgh: process.env.BG_SRC || path.join(ROOT, "src", "renderer", "bgnotify.html"),
  distMain: process.env.DIST_MAIN || path.join(ROOT, "dist", "main", "main.js"),
  distBg: process.env.DIST_BG || path.join(ROOT, "dist", "main", "bgNotify.js"),
  distPre: process.env.DIST_PRE || path.join(ROOT, "dist", "preload", "preload.js"),
};
let n = 0, fail = 0;
function ok(name, cond, info) {
  n++;
  const s = cond ? "ok" : "NOT OK";
  console.log(`${s} ${n} - ${name}${cond ? "" : (info !== undefined ? " :: " + JSON.stringify(info).slice(0, 200) : "")}`);
  if (!cond) fail++;
}
const pkg = JSON.parse(R(P.pkg));
const mainTs = fs.existsSync(P.mainTs) ? R(P.mainTs) : "";
const srcMode = process.env.ASAR_MODE === "1" ? false : !!mainTs;
const dMain = R(P.distMain);
const dBg = R(P.distBg);
const idx = R(P.idx);
const bgh = R(P.bgh);
const mSrc = srcMode ? mainTs : dMain;

/* ───────────── A. IDENTIDADE ───────────── */
ok("A1 versão 1.0.240 (RE-PINADO F3.5.6A-H2)", pkg.version === "1.0.240", pkg.version);
ok("A2 description: fase f355eh4 sobre a f355eh3 + baseline física 1.0.226 + cadeia",
  /1\.0\.228-f355eh4-grouped-notification-handoff/.test(pkg.description)
  && /1\.0\.227-f355eh3-global-notification-visibility/.test(pkg.description)
  && /1\.0\.226-f355eh2-reference-notification FISICAMENTE APROVADA/.test(pkg.description)
  && /1\.0\.223-f355d-custom-cronograma-quantity-universal-paste/.test(pkg.description));
if (fs.existsSync(P.lock)) {
  const lock = JSON.parse(R(P.lock));
  ok("A3 lock 1.0.240 ×2 (RE-PINADO F3.5.6A-H2)", lock.version === "1.0.240" && lock.packages[""].version === "1.0.240");
} else { ok("A3 lock (ausente no pacote — ok)", true); }

/* ───────────── B. main.ts — ESPELHO DE GRUPOS DO HANDOFF ───────────── */
ok("B1 teto do grupo espelhado do renderer (GROUP_MAX_MS = 15000)",
  /GROUP_MAX_MS = 15000/.test(mSrc));
ok("B2 registro de grupos separado do individual (activeToastGroups Map)",
  /const activeToastGroups = new Map/.test(mSrc));
ok("B3 groupRegister guarda p0 + view null + firstAt (estado p/ recriar o card na premium)",
  /function groupRegister\(gk, ?p0\)|function groupRegister\(gk: string, p0: NotifPayload\)/.test(mSrc)
  && /\{ p0, view: null, firstAt, timer \}/.test(mSrc));
ok("B4 groupTouch atualiza o view consolidado + TTL refrescado com teto (espelho do renderer)",
  /function groupTouch/.test(mSrc) && /if \(view\)\s*e\.view = view;/.test(mSrc)
  && /GROUP_MAX_MS - \(Date\.now\(\) - firstAt\)/.test(mSrc)
  && /Math\.max\(1200, Math\.min\(toastTtlMs\(sev\), cap\)\) \+ 900/.test(mSrc));
ok("B5 groupUnregisterByDedup (fallback do ACK remove o grupo pelo dedupKey do p0)",
  /function groupUnregisterByDedup/.test(mSrc)
  && /groupUnregisterByDedup\(key\);/.test(mSrc));
ok("B6 ramo FOCADO registra por TIPO: groupKey → espelho de grupos; senão registro individual",
  /if \(\(?p(?: as any)?\)?\.groupKey\)[\s\S]{0,30}?groupRegister\(String\(\(?p(?: as any)?\)?\.groupKey\), p\);[\s\S]{0,30}?else[\s\S]{0,30}?toastRegister\(key, p\);/.test(mSrc));
ok("B7 ramo UPDATE mantém o espelho em dia (groupTouch com o view do route)",
  /groupTouch\(String\(__group\.groupKey\), __group\.view\);/.test(mSrc));
ok("B8 canais de grupo do fluxo normal INTACTOS (notif-group-update + updateBgGroup best-effort)",
  /send\("notif-group-update", __group\.view\)/.test(mSrc)
  && /updateBgGroup\)?\(__group\.view\)/.test(mSrc));

/* ───────────── C. main.ts — TRANSAÇÃO DO HANDOFF ───────────── */
ok("C1 transações em voo por dedupKey + prazo espelhado do ACK da premium (4s+margem)",
  /const handoffTx = new Map/.test(mSrc) && /HANDOFF_ACCEPT_MS = 4600/.test(mSrc));
ok("C2 txBegin GRUPO: p0 vai SILENCIOSO e marcado (sound:false + _handoff) — nunca re-toca som",
  /Object\.assign\(\{\}, e\.p0, \{ sound: false, _handoff: true \}\)/.test(mSrc));
ok("C3 txBegin INDIVIDUAL: payload registrado vai silencioso (sound:false + _handoff)",
  /Object\.assign\(\{\}, e\.p, \{ sound: false, _handoff: true \}\)/.test(mSrc));
ok("C4 ACEITE = prova de render da premium (listener bgnotify-rendered → txCommit SÓ com transação em voo)",
  /ipcMain\.on\("bgnotify-rendered",[\s\S]{0,200}?handoffTx\.has\(String\(k\)\)\)\s*txCommit\(String\(k\)\)/.test(mSrc));
ok("C5 txCommit GRUPO: morfa APÓS o aceite com o view MAIS NOVO do espelho (update durante o handoff vence)",
  /const live = activeToastGroups\.get\(tx\.gk\);/.test(mSrc)
  && /const v = \(live && live\.view\) \|\| tx\.view;/.test(mSrc)
  && /if \(v\)[\s\S]{0,60}?updateBgGroup\)?\(v\)/.test(mSrc));
ok("C6 txCommit envia o COMMIT ao renderer (notif-collect-commit com a entrada aceita)",
  /send\("notif-collect-commit", \[tx\.entry\]\)/.test(mSrc));
ok("C7 txCommit desregistra a origem (grupo OU individual) — nunca re-migra o já aceito",
  /groupUnregister\(tx\.gk\);[\s\S]{0,60}?else[\s\S]{0,30}?toastUnregister\(key\)/.test(mSrc));
ok("C8 txFail: 1 RETRY e depois PRESERVA o interno (sem commit; zero perda; log preserved)",
  /if \(!tx\.retried\) \{/.test(mSrc) && /tx\.retried = true;/.test(mSrc)
  && /notify\.handoff\.retry/.test(mSrc) && /notify\.handoff\.preserved/.test(mSrc));
ok("C9 handoffShow delega a transações isoladas por card (txBegin; falha de um não afeta os demais)",
  /function handoffShow\(entries\)|function handoffShow\(entries: string\[\]\)/.test(mSrc)
  && /txBegin\(String\(en \|\| ""\)\);/.test(mSrc));
ok("C10 blur considera os 2 registros (individuais + grupos) e monta i:/g:",
  /activeToasts\.size && !activeToastGroups\.size/.test(mSrc)
  && /"i:" \+ k/.test(mSrc) && /"g:" \+ g/.test(mSrc));
ok("C11 reply: prefixos + compat com chave crua (= individual) + limpeza dupla + abort por foco",
  /\("i:" \+ k\)/.test(mSrc)
  && /!aliveI\.has\(k\)\)\s*toastUnregister\(k\);/.test(mSrc)
  && /!aliveG\.has\(g\)\)\s*groupUnregister\(g\);/.test(mSrc)
  && /notify\.handoff\.aborted\.focus/.test(mSrc));
ok("C12 timeout da coleta (700ms) migra TODOS os registros com abort se o foco voltou",
  /\}, 700\);/.test(mSrc) && /handoffShow\(allEntries\(\)\)/.test(mSrc)
  && /windowActive\(\)\)\s*return; \/\/ foco voltou/.test(mSrc));
ok("C13 handoff NUNCA dispara fallback nativo (evento já entregue; sino/recibos já têm tudo)",
  !/function txBegin[\s\S]{0,1500}?nativeNotify/.test(mSrc)
  && !/function txFail[\s\S]{0,900}?nativeNotify/.test(mSrc));
ok("C14 transação não duplica (handoffTx.has ⇒ txBegin é no-op p/ o mesmo dedupKey)",
  /handoffTx\.has\(key\)\)[\s\S]{0,20}?return/.test(mSrc) && /handoffTx\.has\(id\)\)[\s\S]{0,20}?return/.test(mSrc));

/* ───────────── D. preload ───────────── */
if (srcMode) {
  const pre = R(P.preTs);
  ok("D1 canal do COMMIT exposto (onNotifCollectCommit ← notif-collect-commit)",
    /onNotifCollectCommit/.test(pre) && /notif-collect-commit/.test(pre));
  ok("D2 saneamento do commit (Array.isArray + map String)",
    /ipcRenderer\.on\("notif-collect-commit", \(_e, entries: unknown\) => cb\(\(Array\.isArray\(entries\) \? entries : \[\]\)\.map\(\(k\) => String\(k \|\| ""\)\)\)\)/.test(pre));
  ok("D3 canais da coleta H3 INTACTOS (request/reply + notifToastAck)",
    /notif-collect-request/.test(pre) && /notif-collect-reply/.test(pre) && /notif-toast-ack/.test(pre));
} else {
  const dPre = fs.existsSync(P.distPre) ? R(P.distPre) : "";
  ok("D1 [asar] preload compilado expõe notif-collect-commit", /notif-collect-commit/.test(dPre));
  ok("D2 [asar] preload compilado saneia entries (Array.isArray + String)", /Array\.isArray\(entries\)/.test(dPre));
  ok("D3 [asar] canais da coleta preservados", /notif-collect-request/.test(dPre) && /notif-collect-reply/.test(dPre));
}

/* ───────────── E. index.html (renderer) ───────────── */
ok("E1 coleta devolve TODOS os vivos: grupos como g:<groupKey> e individuais como i:<dedupKey>",
  /out\.push\('g:'\+gk\); continue;/.test(idx) && /out\.push\('i:'\+k\);/.test(idx));
ok("E2 coleta NÃO fecha nada (o fechamento é só no COMMIT) e responde SEMPRE (catch → [])",
  (() => { const a = idx.indexOf("onNotifCollect("); const b = idx.indexOf("onNotifCollectCommit("); return a > 0 && b > a && !idx.slice(a, b).includes("__ntfDismiss"); })()
  && /notifCollectReply\(reqId,\[\]\)/.test(idx));
ok("E3 COMMIT fecha o aceito: grupo por data-group; individual por chave (sem data-group)",
  /en\.indexOf\('g:'\)===0\)\{ hit=\(!!gk&&gk===en\.slice\(2\)\); \}/.test(idx)
  && /en\.indexOf\('i:'\)===0\)\{ hit=\(!gk&&\(e\.__ntfKey\|\|''\)===en\.slice\(2\)\); \}/.test(idx)
  && /if\(hit\)\{ try\{ \(e\.__ntfDismiss\|\|function\(\)\{\}\)\(\); \}/.test(idx));
ok("E4 wiring do commit com guard (nunca quebra sem desktopAPI)",
  /typeof window\.desktopAPI\.onNotifCollectCommit==='function'/.test(idx));
ok("E5 CONGELADO: morph do grupo no toast (data-group + teto 15s) byte-idêntico à 1.0.226/227",
  /var el=null, kids=stack\.querySelectorAll\('\.ntf\[data-group\]'\);/.test(idx)
  && /var firstAt=el\.__ntfFirstAt\|\|Date\.now\(\); var cap=15000-\(Date\.now\(\)-firstAt\); if\(cap<1200\)cap=1200;/.test(idx));
ok("E6 CONGELADO: card nasce com data-group quando o payload traz groupKey (1º evento do grupo)",
  /if\(p\.groupKey\) el\.setAttribute\('data-group',String\(p\.groupKey\)\);/.test(idx));

/* ───────────── F. VISUAL 1.0.226 CONGELADO + premium intocada ───────────── */
const H2M = ["ntfp-fl", "ntfp-pill", "ntfp-pr", "width:62px;height:62px", "border-radius:24px"];
ok("F1 marcadores da REFERÊNCIA do owner nas 2 superfícies (design congelado)",
  H2M.every((m) => idx.includes(m)) && H2M.every((m) => bgh.includes(m)));
ok("F2 bgnotify.html: contrato de grupo da premium INTOCADO (data-group + GROUP_MAX_MS=15000)",
  /data-group/.test(bgh) && /GROUP_MAX_MS=15000/.test(bgh));
ok("F3 bgNotify (main da premium) INTOCADO nesta fase: reassert/ack/updateBgGroup preservados",
  /function reassert/.test(srcMode ? R(P.bgTs) : dBg)
  && /bgnotify-rendered/.test(srcMode ? R(P.bgTs) : dBg)
  && /function updateBgGroup/.test(srcMode ? R(P.bgTs) : dBg));
ok("F4 controlador puro do agrupamento (F3.5.4O) INTOCADO — fonte canônica preservada",
  (() => { const g = srcMode ? R(P.groupTs) : ""; return srcMode
    ? (/common_group:/.test(g) && /groupWindowMs > 0 \? opts\.groupWindowMs : 5000/.test(g) && !/handoff/i.test(g))
    : /common_group:/.test(R(process.env.DIST_GROUP || path.join(ROOT, "dist", "main", "notificationGrouping.js"))); })());

/* ───────────── G. COMPORTAMENTO DO DIST (sandbox vm) ───────────── */
function grab(src, startRe, endMark) {
  const m = src.match(startRe);
  if (!m) return null;
  const i = m.index;
  const j = src.indexOf(endMark, i);
  if (j < 0) return null;
  return src.slice(i, j + endMark.length);
}
const hBlock = grab(dMain, /const activeToasts = new Map\(\);?/, "/* handoff nunca derruba a entrega */ }\n}");
ok("G0 bloco do handoff H4 extraível do dist (JS compilado)", !!hBlock && /txBegin/.test(hBlock) && /txCommit/.test(hBlock));
if (hBlock) {
  const calls = { bg: [], group: [], commits: [], logs: [] };
  const mkWin = () => ({ isDestroyed: () => false, webContents: { isLoading: () => false, send: (ch, args) => { if (ch === "notif-collect-commit") calls.commits.push(args); } } });
  const ctx = {
    console, setTimeout, clearTimeout, Date,
    windowActive: () => false,
    mainWin: mkWin(),
    showBgNotify: (p) => { calls.bg.push(p); return true; },
    bgNotify_1: { showBgNotify: (p) => { calls.bg.push(p); return true; }, updateBgGroup: (v) => { calls.group.push(v); } },
    updateBgGroup: (v) => { calls.group.push(v); },
    nlog: (t, d) => calls.logs.push([t, d]),
    nmask: (s) => String(s || "").slice(0, 3),
  };
  vm.createContext(ctx);
  new vm.Script(hBlock + "\n;globalThis.__h={activeToasts,activeToastGroups,handoffTx,toastRegister,toastUnregister,groupRegister,groupTouch,groupUnregisterByDedup,handoffShow,handoffActiveToasts,txFail,get pending(){return handoffPending;},accept(key){ if(handoffTx.has(String(key))) txCommit(String(key)); },reply(reqId,keys){ if(!handoffPending||handoffPending.reqId!==Number(reqId))return; clearTimeout(handoffPending.timer); handoffPending=null; const raw=(Array.isArray(keys)?keys:[]).map(k=>String(k||'')).filter(Boolean); const alive=raw.map(k=>(k.startsWith('i:')||k.startsWith('g:'))?k:('i:'+k)); const aliveI=new Set(alive.filter(k=>k.startsWith('i:')).map(k=>k.slice(2))); const aliveG=new Set(alive.filter(k=>k.startsWith('g:')).map(k=>k.slice(2))); for(const k of Array.from(activeToasts.keys())){ if(!aliveI.has(k)) toastUnregister(k);} for(const g of Array.from(activeToastGroups.keys())){ if(!aliveG.has(g)) groupUnregister(g);} if(windowActive())return; handoffShow(alive);}};", { filename: "handoff-h4.js" }).runInContext(ctx);
  const H = ctx.__h;
  const GK = "common_group:U1:T1";

  /* G1 — INDIVIDUAL transacional completo */
  H.toastRegister("ki", { severity: "info", title: "Solo", sound: true, dedupKey: "ki" });
  H.handoffActiveToasts();
  H.reply(H.pending.reqId, ["i:ki"]);
  ok("G1 individual: entrega → tx em voo (interno AINDA vivo) → aceite → commit i: + registro limpo",
    calls.bg.length === 1 && calls.bg[0].sound === false && H.activeToasts.size === 1 && H.handoffTx.has("ki") && calls.commits.length === 0
    && (H.accept("ki"), H.activeToasts.size === 0 && calls.commits.length === 1 && calls.commits[0][0] === "i:ki"));

  /* G2 — GRUPO 2 eventos: p0 recria data-group; aceite morfa count=2; commit g: */
  H.groupRegister(GK, { severity: "info", title: "G", sound: true, dedupKey: "kg", groupKey: GK, taskId: "T1" });
  H.groupTouch(GK, { groupKey: GK, count: 2, severity: "info", items: [{}, {}], taskTitle: "T" });
  H.handoffActiveToasts();
  H.reply(H.pending.reqId, ["g:" + GK]);
  ok("G2 grupo 2: p0 silencioso com groupKey → aceite → morph count=2 → commit g: → espelho limpo",
    calls.bg[1].groupKey === GK && calls.bg[1].sound === false && H.activeToastGroups.size === 1 && calls.group.length === 0
    && (H.accept("kg"), H.activeToastGroups.size === 0 && calls.group.length === 1 && calls.group[0].count === 2
        && calls.commits[1][0] === "g:" + GK));

  /* G3/G4 — GRUPO 3 e 4 eventos (contagem preservada no morph) */
  for (const cnt of [3, 4]) {
    const gk = "common_group:U1:T" + cnt;
    H.groupRegister(gk, { severity: "info", sound: true, dedupKey: "kg" + cnt, groupKey: gk });
    H.groupTouch(gk, { groupKey: gk, count: cnt, severity: "info", items: [{}], taskTitle: "T" + cnt });
    H.handoffActiveToasts();
    H.reply(H.pending.reqId, ["g:" + gk]);
    H.accept("kg" + cnt);
  }
  ok("G3 grupo 3 eventos migra com count=3", calls.group[1] && calls.group[1].count === 3);
  ok("G4 grupo 4 eventos migra com count=4", calls.group[2] && calls.group[2].count === 4);

  /* G5 — RAJADA mista (3 individuais + 1 grupo) numa só coleta */
  const bgBefore5 = calls.bg.length;
  H.toastRegister("r1", { severity: "info", sound: true, dedupKey: "r1" });
  H.toastRegister("r2", { severity: "warning", sound: true, dedupKey: "r2" });
  H.toastRegister("r3", { severity: "critical", sound: true, dedupKey: "r3" });
  H.groupRegister("common_group:U1:TR", { severity: "info", sound: true, dedupKey: "rg", groupKey: "common_group:U1:TR" });
  H.handoffActiveToasts();
  H.reply(H.pending.reqId, ["i:r1", "i:r2", "i:r3", "g:common_group:U1:TR"]);
  ["r1", "r2", "r3", "rg"].forEach((k) => H.accept(k));
  ok("G5 rajada mista: 4 transações isoladas, 4 shows silenciosos, 4 commits, registros zerados",
    calls.bg.length - bgBefore5 === 4 && H.activeToasts.size === 0 && H.activeToastGroups.size === 0
    && calls.bg.slice(-4).every((p) => p.sound === false && p._handoff === true));

  /* G6 — UPDATE DURANTE O HANDOFF: groupTouch entre a entrega e o aceite ⇒ morph usa o view NOVO */
  const gk6 = "common_group:U1:T6";
  H.groupRegister(gk6, { severity: "info", sound: true, dedupKey: "kg6", groupKey: gk6 });
  H.groupTouch(gk6, { groupKey: gk6, count: 2, severity: "info", items: [{}], taskTitle: "T6" });
  H.handoffActiveToasts();
  H.reply(H.pending.reqId, ["g:" + gk6]);
  H.groupTouch(gk6, { groupKey: gk6, count: 3, severity: "info", items: [{}], taskTitle: "T6" }); // evento chegou no meio
  H.accept("kg6");
  ok("G6 grupo alterado DURANTE o handoff: o aceite morfa com a contagem MAIS NOVA (3, não 2)",
    calls.group[calls.group.length - 1].count === 3);

  /* G7 — FALHA DO ACEITE: 1 retry; 2ª falha PRESERVA (sem commit; interno continua registrado) */
  const bgBefore7 = calls.bg.length, cmBefore7 = calls.commits.length;
  H.toastRegister("kf", { severity: "critical", sound: true, dedupKey: "kf" });
  H.handoffActiveToasts();
  H.reply(H.pending.reqId, ["i:kf"]);
  H.txFail("kf"); // simula prazo estourado (espelho do timer HANDOFF_ACCEPT_MS)
  const retried = calls.bg.length - bgBefore7 === 2; // entrega original + retry
  H.txFail("kf"); // 2ª falha
  ok("G7 falha de aceite: retry re-entrega 1×; 2ª falha PRESERVA o interno (sem commit; registro vivo; log preserved)",
    retried && !H.handoffTx.has("kf") && H.activeToasts.has("kf") && calls.commits.length === cmBefore7
    && calls.logs.some((l) => l[0] === "notify.handoff.preserved"),
    { retried, reg: H.activeToasts.has("kf") });
  H.toastUnregister("kf");

  /* G8 — BLUR/FOCUS RÁPIDO: foco de volta antes da reply ⇒ aborta SEM mostrar nada */
  const bgBefore8 = calls.bg.length;
  H.toastRegister("kq", { severity: "info", sound: true, dedupKey: "kq" });
  H.handoffActiveToasts();
  ctx.windowActive = () => true; // foco voltou antes de o renderer responder
  H.reply(H.pending.reqId, ["i:kq"]);
  ok("G8 foco de volta antes da reply: aborta (nada mostrado; interno segue registrado e visível)",
    calls.bg.length === bgBefore8 && H.activeToasts.has("kq") && !H.handoffTx.has("kq"));
  ctx.windowActive = () => false;

  /* G9 — dedupe da transação: reentrada do mesmo card não duplica o show */
  const bgBefore9 = calls.bg.length;
  H.handoffActiveToasts();
  H.reply(H.pending.reqId, ["i:kq"]);
  H.handoffShow(["i:kq"]); // reentrada com transação em voo
  ok("G9 transação única por dedupKey (reentrada é no-op; 1 show)",
    calls.bg.length === bgBefore9 + 1 && H.handoffTx.has("kq"));
  H.accept("kq");
}

/* deliver do dist: roteamento com o agrupamento REAL primeiro-evento/update */
function grabBalanced(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) return null;
  const j = src.indexOf("{", i);
  let d = 0;
  for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}
const dBody = grabBalanced(dMain, "function deliverNotification(p) {");
ok("G10 deliverNotification extraível do dist", !!dBody);
if (dBody) {
  function runDeliver(focused, route, payload, seen) {
    const calls = { toast: 0, bg: 0, native: 0, hist: 0, regI: 0, regG: 0, touch: 0, groupSend: 0, bgGroup: 0 };
    const ctx = {
      console, setTimeout, clearTimeout, Date,
      require: (m) => { if (String(m).includes("notifEvents")) return { isRetiredSector: () => false }; throw new Error("no:" + m); },
      diag: () => { }, diag_1: { diag: () => { } }, nlog: () => { }, nmask: (s) => String(s || ""),
      windowActive: () => focused, sessionLocked: false,
      mainWin: { isDestroyed: () => false, isVisible: () => true, isMinimized: () => false, webContents: { send: (ch) => { if (ch === "notif-toast") calls.toast++; if (ch === "notif-history") calls.hist++; if (ch === "notif-group-update") calls.groupSend++; } } },
      _notifSeen: seen || new Set(),
      toastAck: { arm: () => { } },
      toastRegister: () => { calls.regI++; }, toastUnregister: () => { },
      groupRegister: () => { calls.regG++; }, groupTouch: () => { calls.touch++; }, groupUnregisterByDedup: () => { },
      showBgNotify: () => { calls.bg++; return true; },
      bgNotify_1: { showBgNotify: () => { calls.bg++; return true; }, updateBgGroup: () => { calls.bgGroup++; } },
      updateBgGroup: () => { calls.bgGroup++; },
      nativeNotify: () => { calls.native++; return true; },
      notifTele: {}, groupTele: { updates: 0, opens: 0 }, app: { getVersion: () => "1.0.228" },
      classifyReminderLevel: () => null, slaReminderCtl: null,
      premiumCommonEnabled: true, notificationGrouping: route ? { route } : null,
      premiumObserve: () => { }, premiumObserveGroup: () => { },
      Notification: { isSupported: () => true },
    };
    vm.createContext(ctx);
    new vm.Script("globalThis.__deliver = " + dBody.replace(/^function deliverNotification/, "function"), { filename: "deliver-h4.js" }).runInContext(ctx);
    const r = ctx.__deliver(payload);
    return { r, calls };
  }
  const base = () => ({ eventType: "task_moved", taskId: "T1", targetUserId: "U1", severity: "info", sound: true, dedupKey: "dh4:a", createdAt: 1 });
  const g11 = runDeliver(true, () => ({ action: "first", groupKey: "common_group:U1:T1", view: null }), base());
  ok("G11 FOCADO + 1º evento agrupável → toast + registro no ESPELHO DE GRUPOS (não no individual)",
    g11.r.channel === "toast" && g11.calls.toast === 1 && g11.calls.regG === 1 && g11.calls.regI === 0);
  const g12 = runDeliver(true, () => ({ action: "update", groupKey: "common_group:U1:T1", view: { groupKey: "common_group:U1:T1", count: 2, severity: "info", items: [{}] } }), Object.assign(base(), { dedupKey: "dh4:b" }));
  ok("G12 UPDATE de grupo → morph nas 2 superfícies + groupTouch no espelho + canal grouped (som suprimido)",
    g12.r.channel === "grouped" && g12.calls.groupSend === 1 && g12.calls.bgGroup === 1 && g12.calls.touch === 1 && g12.calls.toast === 0);
  const g13 = runDeliver(true, null, Object.assign(base(), { dedupKey: "dh4:c" }));
  ok("G13 sem controlador (fixtures/flag OFF) → comportamento 1.0.204: registro individual",
    g13.r.channel === "toast" && g13.calls.regI === 1 && g13.calls.regG === 0);
  const g14 = runDeliver(false, () => ({ action: "first", groupKey: "common_group:U1:T1", view: null }), Object.assign(base(), { dedupKey: "dh4:d" }));
  ok("G14 SEM FOCO + 1º evento agrupável → premium direto (grupo NASCE na premium; nada no toast)",
    g14.r.channel === "bg-window" && g14.calls.bg === 1 && g14.calls.toast === 0);
}

console.log(`\n# f355eh4-grouped-notification-handoff: ${n - fail}/${n} OK${fail ? " — FALHAS: " + fail : ""}`);
process.exit(fail ? 1 : 0);
