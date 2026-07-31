/**
 * F3.5.4O — f354o-common-notification-grouping.test.mjs
 * =====================================================================================
 * PROVAS do AGRUPAMENTO INTELIGENTE das notificações COMUNS (Desktop 1.0.205).
 *
 * PARTE A — controlador PURO (dist/main/notificationGrouping.js) com relógio fake:
 *   allowlist/denylist, chave common_group:<uid>:<taskId>, janela fixa 5s, first/update/passthrough,
 *   contador, até 5 itens + "+N", taskId é a autoridade, flag OFF ⇒ 1.0.204, reset/close.
 * PARTE B — RAJADA: 10 eventos da MESMA tarefa+destinatário ⇒ 1 grupo, contador 10, 5 visíveis + "+5".
 * PARTE C — SEPARAÇÃO: tarefas A/B/A/C/B ⇒ 3 grupos distintos.
 * PARTE D — WIRING/superfícies (estático sobre o FONTE real): main.ts (após dedup, antes da superfície;
 *   _groupUpdate; notif-group-update; updateBgGroup; markSeen; reset login/logout; IPC; flag default ON),
 *   bgnotify.html + index.html (data-group, morfar, "N atualizações em", "+N", SEM som no update,
 *   compensação pula _groupUpdate, toggle Configurações), preloads (onNotifGroupUpdate/onGroupUpdate).
 *
 * Puro Node (sem Electron/Chromium). Rodar: /opt/node22/bin/node desktop/scripts/f354o-common-notification-grouping.test.mjs
 */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(__dirname, "..", "src");
const { createNotificationGrouping, isGroupableEventType } = require("../dist/main/notificationGrouping.js");

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

// Relógio fake controlado (a janela é medida por now()).
function mk(opts = {}) {
  let clock = 1_000_000;
  const ctl = createNotificationGrouping({
    now: () => clock,
    groupWindowMs: 5000,
    maxVisibleItems: 5,
    isEnabled: () => (opts.enabled !== false),
    onLog: () => {},
  });
  return { ctl, at: (t) => { clock = t; }, adv: (ms) => { clock += ms; }, now: () => clock };
}
function ev(o) {
  return Object.assign({
    eventType: "task_moved", severity: "info", taskId: "T1", targetUserId: "U1",
    taskTitle: "Tarefa X", actorName: "Ana", title: "Tarefa movimentada", body: "Ana moveu…",
    action: { type: "detail", deep: "detail/T1" },
  }, o || {});
}

/* ─────────── PARTE A — controlador puro ─────────── */

// 1-7 — allowlist: cada tipo comum auditado ABRE grupo (first)
{
  const types = ["task_moved", "task_updated", "task_assigned", "task_reassigned", "task_completed", "task_reopened", "designer_assigned"];
  let i = 0;
  for (const t of types) {
    const h = mk();
    const d = h.ctl.route(ev({ eventType: t, severity: t === "task_reopened" ? "warning" : "info", taskId: "TA" + i, targetUserId: "U1" }));
    ok((++i) + " allowlist " + t + " → first", d.action === "first" && !!d.groupKey);
  }
}
// 8 — isGroupableEventType exportado reconhece a allowlist e rejeita desconhecido
ok("8 isGroupableEventType(task_moved)=true / (foo)=false", isGroupableEventType("task_moved") === true && isGroupableEventType("foo") === false);

// 9-15 — denylist: passthrough
{
  const deny = [
    ["sla_warning", "warning"], ["sla_critical", "critical"], ["operational_block", "critical"],
    ["event_new", "info"], ["flow_completed", "success"], ["app_update", "info"], ["algo_desconhecido", "info"],
  ];
  let i = 8;
  for (const [t, sev] of deny) {
    const h = mk();
    const d = h.ctl.route(ev({ eventType: t, severity: sev, taskId: "TD", targetUserId: "U1" }));
    ok((++i) + " denylist " + t + " → passthrough", d.action === "passthrough" && !d.groupKey);
  }
}
// 16 — severidade CRÍTICA nunca agrupa, mesmo em tipo da allowlist
{
  const h = mk();
  const d = h.ctl.route(ev({ eventType: "task_moved", severity: "critical", taskId: "TC", targetUserId: "U1" }));
  ok("16 task_moved severity=critical → passthrough (nunca agrupa crítico)", d.action === "passthrough");
}
// 17 — sem taskId ⇒ passthrough (sem chave estável)
ok("17 sem taskId → passthrough", mk().ctl.route(ev({ taskId: "" })).action === "passthrough");
// 18 — sem destinatário ⇒ passthrough
ok("18 sem targetUserId → passthrough", mk().ctl.route(ev({ targetUserId: "" })).action === "passthrough");
// 19 — flag OFF ⇒ passthrough sempre (1.0.204)
{
  const h = mk({ enabled: false });
  ok("19 flag OFF → passthrough (1.0.204)", h.ctl.route(ev({})).action === "passthrough");
}
// 20 — chave = common_group:<uid>:<taskId>
{
  const h = mk();
  ok("20 keyOf = common_group:U9:T9", h.ctl.keyOf(ev({ targetUserId: "U9", taskId: "T9" })) === "common_group:U9:T9");
}
// 21 — 1º evento = first; 2º do MESMO uid+task dentro da janela = update
{
  const h = mk();
  const d1 = h.ctl.route(ev({}));
  h.adv(1000);
  const d2 = h.ctl.route(ev({ title: "Tarefa movimentada 2", body: "moveu de novo" }));
  ok("21 1º=first, 2º(mesma tarefa/dest, <5s)=update", d1.action === "first" && d2.action === "update");
}
// 22 — o update carrega view com contador 2 e groupKey estável
{
  const h = mk();
  h.ctl.route(ev({}));
  const d2 = h.ctl.route(ev({}));
  ok("22 update.view.count=2 + groupKey estável", d2.view && d2.view.count === 2 && d2.view.groupKey === "common_group:U1:T1");
}
// 23 — 1º evento NÃO traz view (a superfície é criada normalmente)
{
  const h = mk();
  const d1 = h.ctl.route(ev({}));
  ok("23 first → view=null (superfície criada pelo fluxo normal)", d1.view === null);
}
// 24 — janela FIXA a partir do 1º: evento após 5s inicia NOVO grupo (first)
{
  const h = mk();
  h.ctl.route(ev({}));      // t=1_000_000
  h.adv(5000);              // exatamente no fim da janela
  const d = h.ctl.route(ev({}));
  ok("24 evento em firstAt+5000ms → NOVO grupo (first)", d.action === "first");
}
// 25 — dentro da janela (4999ms) ainda é update
{
  const h = mk();
  h.ctl.route(ev({}));
  h.adv(4999);
  const d = h.ctl.route(ev({}));
  ok("25 evento em firstAt+4999ms → update (dentro da janela)", d.action === "update");
}
// 26 — tarefa DIFERENTE, mesmo destinatário ⇒ grupo separado (first)
{
  const h = mk();
  h.ctl.route(ev({ taskId: "T1" }));
  const d = h.ctl.route(ev({ taskId: "T2" }));
  ok("26 taskId diferente → grupo separado (first)", d.action === "first" && h.ctl.activeCount() === 2);
}
// 27 — destinatário DIFERENTE, mesma tarefa ⇒ grupo separado (first)
{
  const h = mk();
  h.ctl.route(ev({ targetUserId: "U1" }));
  const d = h.ctl.route(ev({ targetUserId: "U2" }));
  ok("27 destinatário diferente → grupo separado (first)", d.action === "first" && h.ctl.activeCount() === 2);
}
// 28 — taskId é a AUTORIDADE: mesmo TÍTULO, taskId diferente ⇒ grupos distintos
{
  const h = mk();
  h.ctl.route(ev({ taskId: "TA", taskTitle: "Mesmo título" }));
  const d = h.ctl.route(ev({ taskId: "TB", taskTitle: "Mesmo título" }));
  ok("28 mesmo título + taskId diferente → grupos distintos", d.action === "first" && h.ctl.activeCount() === 2);
}
// 29 — taskId é a AUTORIDADE: TÍTULO diferente, mesmo taskId ⇒ MESMO grupo (update)
{
  const h = mk();
  h.ctl.route(ev({ taskId: "TA", taskTitle: "Título 1" }));
  const d = h.ctl.route(ev({ taskId: "TA", taskTitle: "Título 2" }));
  ok("29 mesmo taskId + título diferente → mesmo grupo (update)", d.action === "update" && h.ctl.activeCount() === 1);
}
// 30 — contador cresce a cada update
{
  const h = mk();
  h.ctl.route(ev({}));
  let last;
  for (let i = 0; i < 3; i++) last = h.ctl.route(ev({}));
  ok("30 contador acumula (1+3 = count 4)", last.view.count === 4);
}
// 31 — até 5 itens visíveis + extraCount para o restante
{
  const h = mk();
  h.ctl.route(ev({})); // count 1
  let last;
  for (let i = 0; i < 6; i++) last = h.ctl.route(ev({})); // total 7
  ok("31 7 eventos → count 7, 5 visíveis, extra 2", last.view.count === 7 && last.view.items.length === 5 && last.view.extraCount === 2);
}
// 32 — itens MAIS RECENTES primeiro
{
  const h = mk();
  h.ctl.route(ev({ body: "e1" }));
  h.ctl.route(ev({ body: "e2" }));
  const d = h.ctl.route(ev({ body: "e3" }));
  ok("32 itens mais recentes primeiro (e3 no topo)", d.view.items[0].body === "e3" && d.view.items[d.view.items.length - 1].body === "e1");
}
// 33 — view.deep = deep-link da tarefa (clique abre a tarefa)
{
  const h = mk();
  h.ctl.route(ev({}));
  const d = h.ctl.route(ev({}));
  ok("33 view.deep = detail/T1 (abre a tarefa)", d.view.deep === "detail/T1");
}
// 34 — view.taskTitle preservado
{
  const h = mk();
  h.ctl.route(ev({ taskTitle: "Campanha Junho" }));
  const d = h.ctl.route(ev({ taskTitle: "Campanha Junho" }));
  ok("34 view.taskTitle = 'Campanha Junho'", d.view.taskTitle === "Campanha Junho");
}
// 35 — reset() zera os grupos ativos
{
  const h = mk();
  h.ctl.route(ev({ taskId: "T1" })); h.ctl.route(ev({ taskId: "T2" }));
  h.ctl.reset();
  ok("35 reset() → activeCount 0", h.ctl.activeCount() === 0);
}
// 36 — close(groupKey) remove só aquele grupo
{
  const h = mk();
  h.ctl.route(ev({ taskId: "T1" })); h.ctl.route(ev({ taskId: "T2" }));
  h.ctl.close("common_group:U1:T1");
  ok("36 close(key) → activeCount 1", h.ctl.activeCount() === 1);
}
// 37 — snapshot SANITIZADO expõe enabled/windowMs/maxItems/active (sem conteúdo)
{
  const h = mk();
  h.ctl.route(ev({}));
  const s = h.ctl.snapshot();
  ok("37 snapshot {enabled,windowMs:5000,maxItems:5,active:1}", s.enabled === true && s.windowMs === 5000 && s.maxItems === 5 && s.active === 1);
}
// 38 — após a janela fechar + novo grupo, o antigo é substituído (não acumula infinitamente na mesma chave)
{
  const h = mk();
  h.ctl.route(ev({}));           // grupo 1 (count 1)
  h.adv(6000);                   // janela fechou
  const d = h.ctl.route(ev({})); // novo grupo, count reinicia
  ok("38 novo grupo após janela → count reinicia em 1 (first)", d.action === "first" && h.ctl.activeCount() === 1);
}
// 39 — update NÃO acontece com flag OFF (mesmo com grupo prévio hipotético): sempre passthrough
{
  const h = mk({ enabled: false });
  h.ctl.route(ev({}));
  const d = h.ctl.route(ev({}));
  ok("39 flag OFF → 2º evento também passthrough (nunca update)", d.action === "passthrough");
}
// 40 — isGroupable() reflete allowlist ∩ ¬denylist ∩ chave ∩ ¬crítico
{
  const h = mk();
  ok("40 isGroupable: task_moved sim; sla_warning não; sem taskId não",
    h.ctl.isGroupable(ev({})) === true
    && h.ctl.isGroupable(ev({ eventType: "sla_warning", severity: "warning" })) === false
    && h.ctl.isGroupable(ev({ taskId: "" })) === false);
}

/* ─────────── PARTE B — RAJADA (10 eventos, mesma tarefa+destinatário) ─────────── */
{
  const h = mk();
  const decisions = [];
  for (let i = 0; i < 10; i++) { h.adv(100); decisions.push(h.ctl.route(ev({ body: "upd" + i }))); }
  const firsts = decisions.filter((d) => d.action === "first").length;
  const updates = decisions.filter((d) => d.action === "update").length;
  const lastView = decisions[decisions.length - 1].view;
  ok("41 rajada: 1 superfície aberta (exatamente 1 'first')", firsts === 1);
  ok("42 rajada: 9 atualizações ('update')", updates === 9);
  ok("43 rajada: 1 grupo ativo (activeCount 1)", h.ctl.activeCount() === 1);
  ok("44 rajada: contador final = 10", lastView.count === 10);
  ok("45 rajada: 5 itens visíveis + '+5' (extraCount 5)", lastView.items.length === 5 && lastView.extraCount === 5);
  ok("46 rajada: 1 deep-link constante (detail/T1)", lastView.deep === "detail/T1");
  // som (1×) e sino (10×) são contratos do main.ts/renderer (Parte D); aqui provamos a base: 1 first ⇒ 1 superfície/som.
}

/* ─────────── PARTE C — SEPARAÇÃO (A/B/A/C/B → 3 grupos) ─────────── */
{
  const h = mk();
  const seq = ["A", "B", "A", "C", "B"].map((t, i) => { h.adv(100); return h.ctl.route(ev({ taskId: t })); });
  ok("47 A → first", seq[0].action === "first");
  ok("48 B → first (tarefa diferente)", seq[1].action === "first");
  ok("49 A (de novo) → update do grupo A", seq[2].action === "update" && seq[2].view.groupKey === "common_group:U1:A");
  ok("50 C → first + total de 3 grupos distintos (A,B,C)", seq[3].action === "first" && h.ctl.activeCount() === 3);
  ok("51 B (de novo) → update do grupo B (não mistura tarefas)", seq[4].action === "update" && seq[4].view.groupKey === "common_group:U1:B");
}

/* ─────────── PARTE D — WIRING/superfícies (estático sobre o FONTE real) ─────────── */
const MAIN = fs.readFileSync(path.resolve(R, "main", "main.ts"), "utf8");
const BG = fs.readFileSync(path.resolve(R, "main", "bgNotify.ts"), "utf8");
const HTMLBG = fs.readFileSync(path.resolve(R, "renderer", "bgnotify.html"), "utf8");
const HTML = fs.readFileSync(path.resolve(R, "renderer", "index.html"), "utf8");
const PRE = fs.readFileSync(path.resolve(R, "preload", "preload.ts"), "utf8");
const PREBG = fs.readFileSync(path.resolve(R, "preload", "bgnotify-preload.ts"), "utf8");
const GRP = fs.readFileSync(path.resolve(R, "main", "notificationGrouping.ts"), "utf8");

// 52 — a decisão de grupo vem APÓS o dedup individual e ANTES da captura no sino (para marcar a superfície)
{
  const dedupIdx = MAIN.indexOf("_notifSeen.has(key)");
  const routeIdx = MAIN.indexOf("notificationGrouping.route(p)");
  const sinoIdx = MAIN.indexOf('send("notif-history", p)');
  ok("52 ordem: dedup < route < captura-sino", dedupIdx > 0 && routeIdx > dedupIdx && sinoIdx > routeIdx);
}
// 53 — main marca _groupUpdate e groupKey; typeof-guard preserva harnesses
ok("53 main: _groupUpdate + groupKey marcados", /_groupUpdate\s*=\s*true/.test(MAIN) && /\.groupKey\s*=\s*__group\.groupKey/.test(MAIN));
ok("54 main: typeof-guard do controlador (harness-safe)", /typeof notificationGrouping !== "undefined"/.test(MAIN));
// 55 — update: envia notif-group-update + updateBgGroup + markSeen, e retorna canal 'grouped'
ok("55 main: update → notif-group-update + updateBgGroup + markSeen + channel grouped",
  /send\("notif-group-update", __group\.view\)/.test(MAIN) && /updateBgGroup\(__group\.view\)/.test(MAIN)
  && /channel: "grouped"/.test(MAIN));
// 56 — o sino (notif-history) continua sendo enviado POR EVENTO (não é suprimido pelo grupo)
ok("56 main: notif-history enviado por evento (sino individual preservado)", /webContents\.send\("notif-history", p\)/.test(MAIN));
// 57 — flag default ON (undefined ⇒ true) + persistência local dedicada
ok("57 main: flag default ON (!== false) em f354o-notify.json", /notificationCommonGroupingEnabled !== false/.test(MAIN) && /f354o-notify\.json/.test(MAIN));
// 58 — IPC grouping-get/grouping-set
ok("58 main: IPC grouping-get/grouping-set", /ipcMain\.handle\("grouping-get"/.test(MAIN) && /ipcMain\.handle\("grouping-set"/.test(MAIN));
// 59 — reset do agrupamento em login e logout (grupos por sessão de usuário)
ok("59 main: notificationGrouping.reset() em login e logout", (MAIN.match(/notificationGrouping\.reset\(\)/g) || []).length >= 2);
// 60 — SLA central e locked continuam ANTES (denylist/nativa) — não tocados pelo grupo
ok("60 main: SLA central e sessionLocked preservados", /classifyReminderLevel\(p\)/.test(MAIN) && /if \(sessionLocked\)/.test(MAIN));
// 61 — controlador é PURO (sem Electron/Firestore/rede); o relógio é INJETADO (opts.now), com o
// fallback padrão () => Date.now() idêntico aos demais controladores (slaReminder). Purо = injetável.
ok("61 controlador puro (sem electron/firestore/rede) + relógio injetável", !/from "electron"|require\("electron"\)|onSnapshot|collection\(|initializeApp|fetch\(|new BrowserWindow/.test(GRP) && /const now = opts\.now \|\| \(\(\) => Date\.now\(\)\)/.test(GRP));
// 62 — janela documentada 5000ms + até 5 itens
ok("62 main: janela 5000ms + maxVisibleItems 5 na criação do controlador", /groupWindowMs: 5000/.test(MAIN) && /maxVisibleItems: 5/.test(MAIN));

// bgNotify.ts + bgnotify.html
ok("63 bgNotify.ts: exporta updateBgGroup (envia bg-group-update)", /export function updateBgGroup/.test(BG) && /send\("bg-group-update", view\)/.test(BG));
ok("64 bgnotify.html: card marcado com data-group + canal onGroupUpdate", /setAttribute\('data-group'/.test(HTMLBG) && /onGroupUpdate/.test(HTMLBG));
ok("65 bgnotify.html: card agrupado 'atualizações em' + '+N outras atualizações'", /atualizações em/.test(HTMLBG) && /outras atualizações/.test(HTMLBG));
ok("66 bgnotify.html: TETO de permanência (GROUP_MAX_MS) no refresh do TTL", /GROUP_MAX_MS/.test(HTMLBG));
ok("67 bgnotify.html: premium continua SEM som (sem <audio>/play no update)", !/<audio|\.play\(\)/.test(HTMLBG));

// index.html (toast)
ok("68 index.html: toast marcado com data-group + notifGroupUpdate", /setAttribute\('data-group',String\(p\.groupKey\)\)/.test(HTML) && /function notifGroupUpdate\(/.test(HTML));
ok("69 index.html: notifGroupUpdate NÃO toca som (nunca chama notifSound)", (function () { const a = HTML.indexOf("function notifGroupUpdate("); const b = HTML.indexOf("\n}", a); const body = HTML.slice(a, b > a ? b : a + 2000); return a > 0 && body.indexOf("notifSound") < 0; })());
ok("70 index.html: card agrupado 'atualizações em' + '+N outras atualizações'", /atualizações em/.test(HTML) && /outras atualizações/.test(HTML));
ok("71 index.html: compensação do sino PULA _groupUpdate (não levanta 2º toast)", /!\(p&&p\._groupUpdate\)/.test(HTML));
ok("72 index.html: registra onNotifGroupUpdate → notifGroupUpdate", /onNotifGroupUpdate\(function\(v\)\{ try\{ if\(typeof notifGroupUpdate/.test(HTML));
ok("73 index.html: toggle Configurações 'Agrupar atualizações comuns da mesma tarefa' + data-cfggrouping", /Agrupar atualizações comuns da mesma tarefa/.test(HTML) && /data-cfggrouping/.test(HTML));

// preloads
ok("74 preload.ts: onNotifGroupUpdate + groupingGet/groupingSet", /onNotifGroupUpdate:/.test(PRE) && /groupingGet:/.test(PRE) && /groupingSet:/.test(PRE));
ok("75 bgnotify-preload.ts: bgAPI.onGroupUpdate", /onGroupUpdate:/.test(PREBG));

console.log("\nF3.5.4O COMMON-NOTIFICATION-GROUPING: " + pass + " PASS / " + fail + " FAIL");
if (flog.length) console.log(flog.join("\n"));
if (fail) { console.error("::error:: agrupamento de notificações comuns divergiu do contrato F3.5.4O"); process.exit(1); }
if (pass < 50) { console.error("::error:: cobertura F3.5.4O abaixo do mínimo (50)"); process.exit(1); }
console.log("OK — 1ª em tempo real; subsequentes agrupadas (5s, mesma tarefa+dest); sino individual; som 1×; deep-link único; allowlist/denylist; taskId autoridade; flag ON default; superfícies morfam sem 2ª janela/som/foco.");
