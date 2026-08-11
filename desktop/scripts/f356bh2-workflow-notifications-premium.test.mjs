/**
 * F3.5.6B-H2 — f356bh2-workflow-notifications-premium.test.mjs
 * =====================================================================================
 * As notificações de WORKFLOW (wf_*) passam a usar o MODELO PREMIUM nas DUAS superfícies do
 * renderer (index.html toast + bgnotify.html janela topmost), reusando o template existente
 * premiumCommonInner (avatar/card premium/CTA "Abrir →"). Correção de APRESENTAÇÃO em 2 arquivos:
 * adicionar ao PREMIUM_TYPES os 10 eventos wf_* que possuem WF_POLICY e realmente notificam.
 *
 * RED  (allowlist BASE de 7 tipos): premiumUse(wf_*) === false ⇒ cai no template COMPACTO ("Abrir tarefa").
 * GREEN(allowlist CANDIDATA de 17): premiumUse(wf_*) === true ⇒ .ntf-card.ntfp + premiumCommonInner ("Abrir →").
 *
 * H1/1.0.245 PRESERVADA: wf_designer_assigned NÃO entra no premium E o produtor (workflowEvents.js)
 * nem sequer o emite (DESIGNER_ASSIGNED fora de WF_POLICY ⇒ buildWorkflowPayload=null) ⇒ ZERO entrega.
 * PASSTHROUGH intacto: wf_* NÃO entra em GROUPABLE_EVENT_TYPES.
 *
 *   Rode: node scripts/f356bh2-workflow-notifications-premium.test.mjs
 * Env overrides (ASAR/CI): F356BH2_IDX, F356BH2_BG, F356BH2_WE, F356BH2_GRP, F356BH2_PKG, F356BH2_LOCK
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const D = (p) => path.resolve(here, "..", p);
const ENV = process.env;
const E = (v) => (v ? path.resolve(v) : null);
const IDX_PATH = E(ENV.F356BH2_IDX) || D("src/renderer/index.html");
const BG_PATH = E(ENV.F356BH2_BG) || D("src/renderer/bgnotify.html");
const WE_PATH = E(ENV.F356BH2_WE) || D("src/main/workflowEvents.js");
const GRP_PATH = E(ENV.F356BH2_GRP) || D("src/main/notificationGrouping.ts");
const PKG_PATH = E(ENV.F356BH2_PKG) || D("package.json");
const LOCK_PATH = E(ENV.F356BH2_LOCK) || D("package-lock.json");

let okc = 0, fail = 0; const fails = [];
function ok(name, cond, extra) {
  if (cond) { okc++; console.log("ok " + (okc + fail) + " - " + name); }
  else { fail++; fails.push(name); console.log("NOT OK " + (okc + fail) + " - " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const read = (p) => fs.readFileSync(p, "utf8");
const require2 = createRequire(import.meta.url);

const IDX = read(IDX_PATH);
const BG = read(BG_PATH);
const GRP = read(GRP_PATH);
const PKG = read(PKG_PATH);
const LOCK = read(LOCK_PATH);
const pkg = JSON.parse(PKG);
const WE = require2(WE_PATH);

/* ── sandbox p/ os construtores inline (esc/initials stub; puros p/ string) — mesmo harness da f354u ── */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function initials(n) { const p = String(n || "").trim().split(/\s+/).filter(Boolean); if (!p.length) return ""; return ((p[0][0] || "") + (p.length > 1 ? (p[p.length - 1][0] || "") : "")).toUpperCase(); }
function extractBlock(src) {
  const a = src.indexOf("var PREMIUM_TYPES=");
  const e = src.indexOf("function premiumGroupInner(view){", a);
  const c = src.indexOf("\n  }", e);
  return a >= 0 && c >= 0 ? src.slice(a, c + 4) : "";
}
function buildApi(block) {
  const fn = new Function("esc", "initials", "Date", "String", "Math",
    block + "\n;return {premiumUse:premiumUse,premiumCommonInner:premiumCommonInner,premiumGroupInner:premiumGroupInner,premiumChip:premiumChip,PREMIUM_TYPES:PREMIUM_TYPES};");
  return fn(esc, initials, Date, String, Math);
}
const idxBlock = extractBlock(IDX), bgBlock = extractBlock(BG);
const apiIDX = buildApi(idxBlock);
const apiBG = buildApi(bgBlock);
/* BASE (RED): mesma superfície, mas com o allowlist HISTÓRICO de 7 tipos (sem wf_*). */
const SEVEN = "var PREMIUM_TYPES={task_moved:1,task_assigned:1,task_reassigned:1,task_updated:1,task_completed:1,task_reopened:1,designer_assigned:1};";
const baseBlock = idxBlock.replace(/var PREMIUM_TYPES=\{[^}]*\};/, SEVEN);
const apiBASE = buildApi(baseBlock);

/* Os 10 eventos wf_* que possuem WF_POLICY e realmente notificam (ledger → 'wf_'+type.toLowerCase()). */
const PRODUCERS = [
  ["CLIENT_THEMES_FIRST_VIEWED", "wf_client_themes_first_viewed", "info", false],
  ["CLIENT_THEMES_APPROVED", "wf_client_themes_approved", "success", true],
  ["CLIENT_THEMES_ADJUSTMENT_REQUESTED", "wf_client_themes_adjustment_requested", "warning", true],
  ["CLIENT_CAPTIONS_FIRST_VIEWED", "wf_client_captions_first_viewed", "info", false],
  ["CLIENT_CAPTIONS_APPROVED", "wf_client_captions_approved", "success", true],
  ["CLIENT_CAPTIONS_ADJUSTMENT_REQUESTED", "wf_client_captions_adjustment_requested", "warning", true],
  ["DESIGN_PRODUCTION_COMPLETED", "wf_design_production_completed", "success", true],
  ["DESIGNER_ITEM_COMPLETED", "wf_designer_item_completed", "info", true],
  ["THEMES_READY", "wf_themes_ready", "info", true],
  ["CAPTIONS_READY", "wf_captions_ready", "info", true],
];
const WF10 = PRODUCERS.map((r) => r[1]);
const wfPay = (eventType, sev) => ({ _premiumCommon: true, eventType, severity: sev || "info", title: "Atualização do fluxo", taskTitle: "Cronograma Teste 7", clientName: "Cliente teste", actorName: "Arydyjany Carlôto", context: "Fluxo do cliente" });

/* ═══════════════ A — IDENTIDADE (candidata 1.0.246) ═══════════════ */
console.log("— A) identidade —");
ok("A1 package.json versão 1.0.246", pkg.version === "1.0.246", pkg.version);
try { const lk = JSON.parse(LOCK); ok("A2 package-lock 1.0.246 ×2", lk.version === "1.0.246" && lk.packages[""].version === "1.0.246"); }
catch (e) { ok("A2 package-lock 1.0.246 ×2", false, String(e.message)); }
ok("A3 description marca a fase f356bh2-workflow-notifications-premium", /f356bh2-workflow-notifications-premium/.test(pkg.description || ""));
ok("A4 description PRESERVA o marcador H1 (f356bh1-designer-assigned-dedupe)", /f356bh1-designer-assigned-dedupe/.test(pkg.description || ""));
ok("A5 description aponta a base 743dfa2 / rollback 1.0.228", /743dfa2/.test(pkg.description || "") && /1\.0\.228/.test(pkg.description || ""));

/* ═══════════════ B — RED → GREEN (allowlist) nas DUAS superfícies ═══════════════ */
console.log("— B) RED→GREEN allowlist —");
ok("B1 RED: BASE (7 tipos) ⇒ premiumUse(wf_client_themes_approved) === false", apiBASE.premiumUse(wfPay("wf_client_themes_approved", "success")) === false);
ok("B2 GREEN: CANDIDATA index.html ⇒ premiumUse(wf_client_themes_approved) === true", apiIDX.premiumUse(wfPay("wf_client_themes_approved", "success")) === true);
ok("B3 GREEN: CANDIDATA bgnotify.html ⇒ premiumUse(wf_client_themes_approved) === true", apiBG.premiumUse(wfPay("wf_client_themes_approved", "success")) === true);
ok("B4 allowlist candidata = 17 tipos (7 Categoria-A + 10 wf_*) em ambas superfícies",
  Object.keys(apiIDX.PREMIUM_TYPES).length === 17 && Object.keys(apiBG.PREMIUM_TYPES).length === 17,
  { idx: Object.keys(apiIDX.PREMIUM_TYPES).length, bg: Object.keys(apiBG.PREMIUM_TYPES).length });
ok("B5 opt-in preservado: sem _premiumCommon ⇒ NÃO premium (mesmo tipo wf_)", apiBG.premiumUse({ eventType: "wf_client_themes_approved" }) === false);

/* ═══════════════ C — POR EVENTO (todos os 10 wf_* → premium; task_assigned preservado; wf_designer_assigned FORA) ═══════════════ */
console.log("— C) por evento —");
for (const et of WF10) {
  ok("C:" + et + " ⇒ premium em AMBAS superfícies",
    apiIDX.premiumUse(wfPay(et, "info")) === true && apiBG.premiumUse(wfPay(et, "info")) === true);
}
ok("C-assign task_assigned (Categoria A) segue PREMIUM (regressão)", apiIDX.premiumUse({ _premiumCommon: true, eventType: "task_assigned" }) === true && apiBG.premiumUse({ _premiumCommon: true, eventType: "task_assigned" }) === true);
ok("C-legacy designer_assigned (task_assigned legado) segue PREMIUM", apiIDX.premiumUse({ _premiumCommon: true, eventType: "designer_assigned" }) === true && apiBG.premiumUse({ _premiumCommon: true, eventType: "designer_assigned" }) === true);
ok("C-H1 wf_designer_assigned NÃO é premium (H1/1.0.245 preservada)", apiIDX.premiumUse({ _premiumCommon: true, eventType: "wf_designer_assigned" }) === false && apiBG.premiumUse({ _premiumCommon: true, eventType: "wf_designer_assigned" }) === false);
ok("C-scope help_requested (fora do escopo) continua NÃO premium", apiBG.premiumUse({ _premiumCommon: true, eventType: "help_requested" }) === false);

/* ═══════════════ D — RENDER REAL (dispatch fiel ao render(): premiumUse ? .ntf-card.ntfp+premiumCommonInner : compacto) ═══════════════ */
console.log("— D) render real (dispatch) —");
// Réplica FIEL da decisão de bgnotify.html render() / index.html notifShowToast: o ramo premium usa
// '<div class="ntf-card ntfp">'+premiumCommonInner(p) e o ramo compacto usa '<div class="ntf-cta" ...>Abrir tarefa</div>'.
function renderCard(api, p) {
  if (api.premiumUse(p)) return '<div class="ntf-card ntfp">' + api.premiumCommonInner(p) + "</div>";
  // ramo compacto (marcador do elemento CTA compacto — presente APENAS no fallback)
  return '<div class="ntf-card"><div class="ntf-bd"><div class="ntf-cta" data-cta="1">Abrir tarefa</div></div></div>';
}
const wfApproved = wfPay("wf_client_themes_approved", "success");
const hGreenBG = renderCard(apiBG, wfApproved);
const hGreenIDX = renderCard(apiIDX, wfApproved);
const hRedBASE = renderCard(apiBASE, wfApproved);
ok("D1 GREEN bg: card premium (.ntf-card.ntfp + .ntfp-wrap)", /class="ntf-card ntfp"/.test(hGreenBG) && /ntfp-wrap/.test(hGreenBG));
ok("D2 GREEN bg: CTA premium 'Abrir →' (pílula ntfp-pr/car)", /ntfp-pr">Abrir<span class="car"[^>]*>→<\/span>/.test(hGreenBG));
ok("D3 GREEN bg: SEM elemento do template compacto (class=\"ntf-cta\" ausente)", hGreenBG.indexOf('class="ntf-cta"') < 0);
ok("D4 GREEN index: card premium idêntico (paridade de dispatch)", /class="ntf-card ntfp"/.test(hGreenIDX) && /ntfp-pr">Abrir<span class="car"/.test(hGreenIDX) && hGreenIDX.indexOf('class="ntf-cta"') < 0);
ok("D5 paridade premiumCommonInner(wf) byte-idêntica (janela × toast)", apiBG.premiumCommonInner(wfApproved) === apiIDX.premiumCommonInner(wfApproved));
ok("D6 RED base: MESMO payload cai no compacto (class=\"ntf-cta\">Abrir tarefa) e NÃO é premium", /class="ntf-cta" data-cta="1">Abrir tarefa/.test(hRedBASE) && hRedBASE.indexOf('class="ntf-card ntfp"') < 0);
// os 10 wf_* renderizam premium (sem cair no compacto) nas duas superfícies
let allGreen = true;
for (const et of WF10) { const h = renderCard(apiBG, wfPay(et, "info")); if (!/class="ntf-card ntfp"/.test(h) || h.indexOf('class="ntf-cta"') >= 0) allGreen = false; }
ok("D7 os 10 wf_* renderizam PREMIUM (nenhum cai no compacto) — bgnotify", allGreen);

/* ═══════════════ E — PRODUTOR (workflowEvents.js): strings reais + wf_designer_assigned ZERO entrega + severidades ═══════════════ */
console.log("— E) produtor / H1 —");
const NOW = 1750000000000;
const EXEC = "exec_arydyjany", DES = "des_miercohevisk";
const baseTask = () => ({ id: "T_A3", title: "Cronograma Teste 7", client: "Cliente teste", socialOwnerId: EXEC, cronContents: [{}, {}] });
const ctx = { uid: EXEC, user: { id: EXEC, role: "social", admin: false }, resolveProfile: () => ({ name: "Arydyjany", photo: "" }) };
const desCtx = { uid: DES, user: { id: DES, role: "designer", admin: false }, resolveProfile: () => null };
// H1: DESIGNER_ASSIGNED fora de WF_POLICY ⇒ nunca produzido ⇒ zero entrega por esta via
const dassignEv = { id: "T_A3:ev_dassign", type: "DESIGNER_ASSIGNED", at: NOW, phase: "design_production", src: "team", by: EXEC, ru: DES, n: 2, tot: 2, taskId: "T_A3" };
ok("E1 H1: buildWorkflowPayload(DESIGNER_ASSIGNED) === null (não emite wf_designer_assigned)", WE.buildWorkflowPayload(dassignEv, baseTask(), desCtx) === null);
ok("E2 H1: wfRecipientOk(DESIGNER_ASSIGNED) === false (consumidor descarta antes do ingresso)", WE.wfRecipientOk(dassignEv, baseTask(), desCtx) === false);
ok("E3 H1: WF_POLICY NÃO contém DESIGNER_ASSIGNED", !Object.prototype.hasOwnProperty.call(WE.WF_POLICY, "DESIGNER_ASSIGNED"));
ok("E4 WF_POLICY contém exatamente os 10 tipos notificáveis", Object.keys(WE.WF_POLICY).length === 10, Object.keys(WE.WF_POLICY));
// cada tipo notificável: produtor emite eventType wf_<lower> REAL, presente no allowlist candidato, e renderiza premium
let prodOk = true, sevOk = true;
for (const [type, expected, sev, sound] of PRODUCERS) {
  const ev = { id: "T_A3:ev_" + type, type, at: NOW, phase: "client_flow", src: "team", by: EXEC, ru: "", n: 1, tot: 1, taskId: "T_A3" };
  const payload = WE.buildWorkflowPayload(ev, baseTask(), ctx);
  if (!payload || payload.eventType !== expected) { prodOk = false; ok("E:prod " + type + " ⇒ eventType " + expected, false, payload && payload.eventType); continue; }
  const inAllow = !!apiBG.PREMIUM_TYPES[expected] && !!apiIDX.PREMIUM_TYPES[expected];
  const premium = apiBG.premiumUse(Object.assign({ _premiumCommon: true }, payload)) === true;
  ok("E:prod " + type + " ⇒ '" + expected + "' (produtor→allowlist→premium)", payload.eventType === expected && inAllow && premium);
  const pol = WE.WF_POLICY[type];
  if (!pol || pol.sev !== sev || pol.sound !== sound) { sevOk = false; }
}
ok("E5 severidade/som por evento conforme WF_POLICY (info-sem-som/success-som/warning-som)", sevOk);
ok("E6 todos os 10 produtores emitem wf_<lower> real (nenhum inventado)", prodOk);

/* ═══════════════ F — ISOLAMENTO / CONGELADO (só o allowlist mudou) ═══════════════ */
console.log("— F) isolamento —");
// premiumUse function byte-idêntica entre as superfícies (só a TABELA mudou, não o gate)
const exFn = (s, name) => { const a = s.indexOf("function " + name + "("); if (a < 0) return ""; const e = s.indexOf("\n  ", a + 1); return e < 0 ? "" : s.slice(a, e); };
ok("F1 gate premiumUse byte-idêntico (janela × toast)", exFn(BG, "premiumUse") && exFn(BG, "premiumUse") === exFn(IDX, "premiumUse"));
ok("F2 premiumCommonInner byte-idêntico (paridade estrutural)", (() => { const a = extractBlock(BG), b = extractBlock(IDX); const g = (blk) => { const i = blk.indexOf("function premiumCommonInner"); const j = blk.indexOf("function premiumGroupAction"); return i >= 0 && j >= 0 ? blk.slice(i, j) : ""; }; return g(a) && g(a) === g(b); })());
// PASSTHROUGH: GROUPABLE_EVENT_TYPES NÃO contém wf_ (sem coalescência/dedupe/grupo/Central)
const grpBlock = (() => { const a = GRP.indexOf("GROUPABLE_EVENT_TYPES"); const b = GRP.indexOf("}", a); return a >= 0 && b >= 0 ? GRP.slice(a, b + 1) : ""; })();
ok("F3 GROUPABLE_EVENT_TYPES SEM wf_ (passthrough preservado; sem agrupamento)", grpBlock.length > 20 && grpBlock.indexOf("wf_") < 0);
// timeout por severidade INALTERADO nas duas superfícies (11000/8000/6000)
ok("F4 timeout por severidade inalterado (11000/8000/6000) — bgnotify", BG.indexOf("sev==='critical'?11000:(sev==='warning'?8000:6000)") >= 0);
ok("F5 timeout por severidade inalterado (11000/8000/6000) — index", IDX.indexOf("sev==='critical'?11000:(sev==='warning'?8000:6000)") >= 0 || IDX.indexOf("==='critical'?11000") >= 0);
// CTA inalterada: premium = pílula 'Abrir →'; compacto = 'Abrir tarefa'
ok("F6 CTA premium 'Abrir →' presente (pílula ntfp-pr/car) nas duas superfícies", BG.indexOf('ntfp-pr">Abrir<span class="car"') >= 0 && IDX.indexOf('ntfp-pr">Abrir<span class="car"') >= 0);
ok("F7 CTA compacto 'Abrir tarefa' preservado (fallback): bgnotify=div.ntf-cta, index=button", BG.indexOf('class="ntf-cta" data-cta="1">Abrir tarefa</div>') >= 0 && IDX.indexOf('>Abrir tarefa</button>') >= 0);
// wf_designer_assigned ausente dos DOIS allowlists (renderer)
ok("F8 wf_designer_assigned AUSENTE dos dois PREMIUM_TYPES (renderer)", !apiBG.PREMIUM_TYPES["wf_designer_assigned"] && !apiIDX.PREMIUM_TYPES["wf_designer_assigned"]);
// somente o allowlist ganhou wf_ (o comentário menciona wf_designer_assigned só para documentar a EXCLUSÃO)
ok("F9 allowlist do renderer contém os 10 wf_* notificáveis", WF10.every((t) => apiBG.PREMIUM_TYPES[t] && apiIDX.PREMIUM_TYPES[t]));

console.log("\n=====================================================");
console.log("F3.5.6B-H2 workflow-notifications-premium: " + okc + " ok / " + fail + " fail");
if (fail) { console.error("FALHAS:\n - " + fails.join("\n - ")); process.exit(1); }
console.log("TODOS OS TESTES PASSARAM ✓");
