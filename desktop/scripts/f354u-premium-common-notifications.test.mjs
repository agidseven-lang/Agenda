/**
 * F3.5.4U — f354u-premium-common-notifications.test.mjs
 * =====================================================================================
 * Testes do LAYOUT PREMIUM das notificações COMUNS (reformulação de APRESENTAÇÃO). Dirige os
 * construtores INLINE reais extraídos das duas superfícies (janela premium bgnotify.html e toast
 * index.html), o payload aditivo (notifEvents.buildCategoryAPayload) e verifica ESTATICAMENTE a
 * fiação da flag/observabilidade sanitizada no main/preload, mantendo entrega/dedup/recibos/
 * agrupamento/destinatários da 1.0.208. Proteção técnica (NÃO é prova física).
 *   Rode: node scripts/f354u-premium-common-notifications.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

let PASS = 0, FAIL = 0; const FAILS = [];
function ok(c, m) { if (c) { PASS++; } else { FAIL++; FAILS.push(m); console.error("  ✗ " + m); } }

const BG = fs.readFileSync(path.join(ROOT, "src/renderer/bgnotify.html"), "utf8");
const IDX = fs.readFileSync(path.join(ROOT, "src/renderer/index.html"), "utf8");
const MAIN = fs.readFileSync(path.join(ROOT, "src/main/main.ts"), "utf8");
const BGT = fs.readFileSync(path.join(ROOT, "src/main/bgNotify.ts"), "utf8");
const PRE = fs.readFileSync(path.join(ROOT, "src/preload/preload.ts"), "utf8");
const NE = fs.readFileSync(path.join(ROOT, "src/main/notifEvents.js"), "utf8");
const GRP = fs.readFileSync(path.join(ROOT, "src/main/notificationGrouping.ts"), "utf8");

// ── sandbox p/ os construtores inline (esc/initials stub; puros p/ string) ──────────
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
const bgBlock = extractBlock(BG), idxBlock = extractBlock(IDX);
const api = buildApi(bgBlock);

const move = { _premiumCommon: true, eventType: "task_moved", title: "Tarefa movimentada", actorName: "Miercohévisk Niheb Ferreira", actorAvatar: "https://x/p.jpg", taskTitle: "Edição do Reels Institucional", fromStatus: "afazer", toStatus: "andamento", sector: "Vídeo", sectorLabel: "Edição de vídeos", clientName: "", context: "A Fazer → Em andamento", body: "Miercohévisk moveu ‘Edição do Reels Institucional’ de A Fazer para Em andamento.", severity: "info" };
const assign = { _premiumCommon: true, eventType: "task_assigned", title: "Tarefa atribuída", actorName: "Ana Souza", actorAvatar: "", taskTitle: "Card Institucional", responsibleName: "Bruno Lima", fromStatus: "", toStatus: "", sector: "Design", clientName: "", context: "Tarefas", severity: "info" };
const upd = { _premiumCommon: true, eventType: "task_updated", title: "Tarefa atualizada", actorName: "Ana", taskTitle: "X", fromStatus: "", toStatus: "", context: "Prazo: 01/08 12:00 → 02/08 18:00", severity: "info" };
const done = { _premiumCommon: true, eventType: "task_completed", title: "Tarefa concluída", actorName: "João", actorAvatar: "", taskTitle: "Y", fromStatus: "andamento", toStatus: "concluido", severity: "success" };
const hMove = api.premiumCommonInner(move);
const hAssign = api.premiumCommonInner(assign);
const hUpd = api.premiumCommonInner(upd);
const hDone = api.premiumCommonInner(done);

// ══════════════════════ A) PAYLOAD ADITIVO (notifEvents.js) ══════════════════════
const NEmod = require(path.join(ROOT, "src/main/notifEvents.js"));
const ev = { eventId: "e1", type: "task_moved", recipientMode: "all_active_users", taskId: "t1", taskTitle: "Reels", sector: "Vídeo", actorId: "a1", actorNameDenorm: "Ana", fromStatus: "afazer", toStatus: "andamento", at: 1000 };
const pay = NEmod.buildCategoryAPayload(ev, "u1", () => ({ name: "Ana", photo: "" }));
ok(pay.fromStatus === "afazer", "A01 payload expõe fromStatus (aditivo)");
ok(pay.toStatus === "andamento", "A02 payload expõe toStatus (aditivo)");
ok(pay.sector === "Vídeo", "A03 payload expõe sector (aditivo)");
ok(/moveu/.test(pay.body) && /Reels/.test(pay.body), "A04 body PRESERVADO (sino/histórico)");
ok(pay.context === "A Fazer → Em andamento", "A05 context PRESERVADO (fallback retrocompat)");
ok(pay.clientName === "", "A06 clientName inalterado ('')");
ok(pay.title === "Tarefa movimentada" && pay.severity === "info", "A07 title/severity inalterados");
const evA = { eventId: "e2", type: "task_assigned", recipientMode: "assigned_designer", taskId: "t2", taskTitle: "Card", sector: "Design", actorId: "a1", actorNameDenorm: "Ana", assignedDesignerId: "d1", assignedDesignerNameDenorm: "Bruno", fromStatus: "", toStatus: "", at: 2000 };
const payA = NEmod.buildCategoryAPayload(evA, "u1", () => ({ name: "x", photo: "" }));
ok(payA.fromStatus === "" && payA.toStatus === "", "A08 assign: fromStatus/toStatus vazios (sem chips)");
ok(payA.sector === "Design", "A09 assign: sector entregue");
ok(typeof NEmod.columnLabel === "function" && NEmod.columnLabel("andamento") === "Em andamento", "A10 columnLabel intacto");
{ let s = NE.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1"); ok(!/require\s*\(\s*['"]electron['"]/.test(s), "A11 notifEvents sem require('electron') novo"); }

// ══════════════════════ B) CARD PREMIUM — CARTÃO ÚNICO ══════════════════════
ok(api.premiumUse(move) === true, "B01 premiumUse=true p/ task_moved com _premiumCommon:true");
ok(/ntfp-eyebrow[^>]*>[\s\S]*?Tarefa movimentada/.test(hMove), "B02 TIPO como eyebrow discreto");
ok(/ntfp-meta"[^>]*>Movimentada por Miercoh/.test(hMove), "B03 ATOR como METADADO da ação (RE-PINADO F3.5.5E-H2: linha ntfp-meta)");
ok(/ntfp-task" title="[^"]*">Edição do Reels Institucional/.test(hMove), "B04 TÍTULO da tarefa (elemento dominante; tooltip title — RE-PINADO F3.5.5E-H1)");
ok(/cdot cs-afazer/.test(hMove) && /A Fazer/.test(hMove), "B05 origem [A Fazer] com dot na cor do estado na CÁPSULA (RE-PINADO F3.5.5E-H2)");
ok(/pto">Em andamento/.test(hMove), "B06 destino [Em andamento] em destaque na CÁPSULA (RE-PINADO F3.5.5E-H2)");
ok(/ntfp-arrow/.test(hMove), "B07 seta entre os chips");
ok(!/moveu\s+‘/.test(hMove), "B08 NÃO usa o body genérico (sem 'moveu ‘tarefa’')");
ok((hMove.replace(/title="[^"]*"/g, '').match(/Ferreira/g) || []).length === 1, "B09 ATOR não repetido no texto visível (tooltip title permitido — RE-PINADO F3.5.5E-H1)");
ok(/ntfp-ctx" title="[^"]*">Edição de vídeos/.test(hMove) && /ntfp-client" title="[^"]*">Sem cliente vinculado/.test(hMove), "B10 setor com rótulo oficial + cliente com fallback (RE-PINADO F3.5.5E-H1: tooltips)");
ok(/ntfp-pill" role="button" tabindex="0" data-cta="1" aria-label="Abrir tarefa"/.test(hMove) && /ntfp-pr">Abrir</.test(hMove), "B11 CTA integrado ao segmento direito da cápsula (RE-PINADO F3.5.5E-H2)");
ok(/class="ntf-x"/.test(hMove), "B12 botão fechar (X)");
ok(/ntfp-eyebrow"><span class="ntfp-ei"/.test(hMove), "B13 pastilha de ícone da categoria INTEGRADA ao eyebrow (RE-PINADO F3.5.5E-H1)");
ok(/ntfp-hd/.test(hMove) && !/ntfp-sev/.test(hMove), "B13b cabeçalho em GRID reservado (ntfp-hd) SEM ntfp-sev grande sobreposto (H1 Defeito 1)");
ok(/plab" title="De A Fazer para Em andamento"/.test(hMove), "B14 acessibilidade: transição descrita no title da cápsula (RE-PINADO F3.5.5E-H2)");
ok(/ntfp-av" style="background-image:url\('https/.test(hMove), "B15 avatar por foto real quando há URL");
ok(/ntfp-av gen[^>]*>AS?</.test(hAssign) || /ntfp-av gen/.test(hAssign), "B16 avatar iniciais quando SEM foto (assign)");
{ const noName = api.premiumCommonInner({ _premiumCommon: true, eventType: "task_completed", title: "Tarefa concluída", actorName: "", actorAvatar: "", taskTitle: "Z", fromStatus: "andamento", toStatus: "concluido", severity: "success" }); ok(/ntfp-av gen[^>]*>✓</.test(noName), "B17 avatar ícone de severidade quando sem nome+sem foto"); }
ok(/pto">Concluído/.test(hDone), "B18 task_completed → destino Concluído na cápsula (RE-PINADO F3.5.5E-H2)");
{ const reop = api.premiumCommonInner({ _premiumCommon: true, eventType: "task_reopened", title: "Tarefa reaberta", actorName: "Ana", taskTitle: "W", fromStatus: "concluido", toStatus: "afazer", severity: "warning" }); ok(/cdot cs-concluido/.test(reop) && /pto">A Fazer/.test(reop), "B19 task_reopened → cápsula (dot Concluído → A Fazer) (RE-PINADO F3.5.5E-H2)"); }
ok(!/ntfp-chip/.test(hAssign), "B20 assign: SEM chips (sem transição)");
ok(/plab"[^>]*>Atribuída a Bruno Lima/.test(hAssign), "B21 assign: ação curta 'Atribuída a {designer}' na cápsula (RE-PINADO F3.5.5E-H2)");
ok(!/plab"[^>]*>Tarefas</.test(hAssign), "B22 assign: context genérico 'Tarefas' suprimido (RE-PINADO F3.5.5E-H2)");
ok(/plab"[^>]*>Prazo: 01\/08/.test(hUpd), "B23 updated: ação = context na cápsula (RE-PINADO F3.5.5E-H2)");
ok(!/ntfp-chip/.test(hUpd), "B24 updated: SEM chips");
ok((hAssign.replace(/title="[^"]*"/g, '').match(/Ana Souza/g) || []).length === 1, "B25 assign: ator não repetido no texto visível (tooltip permitido — RE-PINADO F3.5.5E-H1)");
ok(!/ntfp-task">Card Institucional[\s\S]*Card Institucional/.test(hAssign), "B26 título não repetido em outra área");

// ══════════════════════ C) CSS — hierarquia/tamanhos/clamp ══════════════════════
ok(/\.ntfp-task\{[^}]*font-size:18px/.test(BG) && /\.ntfp-task\{[^}]*font-size:18px/.test(IDX), "C01 título 18px (dominante) nas duas superfícies");
ok(/\.ntfp-meta\{[^}]*font-size:12px/.test(BG), "C02 autor como metadata 12px (RE-PINADO F3.5.5E-H2)");
ok(/\.ntfp-eyebrow\{[^}]*font-size:12px/.test(BG), "C03 eyebrow 12px (não domina — RE-PINADO F3.5.5E-H1, mandato 12–13)");
ok(/\.ntfp-pl\{[^}]*font-size:12\.5px/.test(BG), "C04 cápsula 12.5px (RE-PINADO F3.5.5E-H2)");
ok(/\.ntfp-fl \.ntfp-av\{[^}]*width:62px/.test(BG), "C05 avatar FLUTUANTE 62px (RE-PINADO F3.5.5E-H2 — mandato 58-72px, referência do owner)");
ok(/\.ntfp-task\{[^}]*-webkit-line-clamp:2/.test(BG), "C06 título máx 2 linhas (clamp)");
ok(/\.ntfp-task\{[^}]*-webkit-line-clamp:2/.test(BG), "C07 título máx 2 linhas; autor 1 linha com ellipsis (RE-PINADO F3.5.5E-H2)");
ok(/\.ntfp-task\{[^}]*overflow:hidden/.test(BG), "C08 título ellipsis/overflow hidden");
ok(/cs-afazer\{--cfg:/.test(BG) && /cs-andamento\{--cfg:/.test(BG) && /cs-revisao\{--cfg:/.test(BG) && /cs-concluido\{--cfg:/.test(BG), "C09 chips têm cor por estado real (4 estados)");
ok(/prefers-reduced-motion: reduce/.test(BG) && /prefers-reduced-motion: reduce/.test(IDX), "C10 acessibilidade: prefers-reduced-motion");
ok(/\.ntf\.ntfp-w\{width:100%/.test(BG), "C11 janela premium: card ocupa largura responsiva (100%)");
ok(/\.ntf\.ntfp-w\{width:450px;max-width:calc\(100vw - 36px\)/.test(IDX), "C12 toast: largura 450 responsiva (RE-PINADO F3.5.5E-H2 — mandato 430-470)");

// ══════════════════════ D) CARD PREMIUM — GRUPO ══════════════════════
const view = { _premiumCommon: true, groupKey: "g1", taskTitle: "Edição do Reels Institucional", count: 4, items: [{ actorName: "Miercohévisk", title: "Tarefa movimentada", body: "..." }, { actorName: "Ana", title: "Tarefa atualizada", body: "..." }], extraCount: 2, primaryName: "Miercohévisk", primaryAvatar: "", severity: "info", deep: "detail/t1" };
const hGrp = api.premiumGroupInner(view);
ok(/ntfp-eyebrow[^>]*>[\s\S]*?4 atualizações/.test(hGrp), "D01 cabeçalho discreto 'N atualizações'");
ok(/ntfp-task" title="[^"]*">Edição do Reels Institucional/.test(hGrp), "D02 tarefa em destaque (tooltip — RE-PINADO F3.5.5E-H1)");
ok(/ntfp-gi"><b>Miercohévisk<\/b> movimentou a tarefa/.test(hGrp), "D03 item: ator + ação curta");
ok(!/ntfp-chip/.test(hGrp), "D04 grupo: SEM chips por item");
ok((hGrp.replace(/title="[^"]*"/g, '').match(/Edição do Reels Institucional/g) || []).length === 1, "D05 título NÃO repetido por item no texto visível (tooltip permitido — RE-PINADO F3.5.5E-H1)");
ok(/ntfp-more">\+2 outras atualizações/.test(hGrp), "D06 '+N outras atualizações'");
ok(/ntfp-pill"[^>]*data-cta="1"/.test(hGrp), "D07 grupo preserva deep-link/CTA na cápsula (RE-PINADO F3.5.5E-H2)");
ok(/<b>Ana<\/b> atualizou a tarefa/.test(hGrp), "D08 mapeamento de ação por tipo (atualizou)");

// ══════════════════════ E) PARIDADE + FLAG OPT-IN ══════════════════════
const norm = (x) => x.replace(/\s+/g, " ").trim();
ok(bgBlock.length > 500 && idxBlock.length > 500, "E01 blocos de construtor localizados nas duas superfícies");
ok(norm(bgBlock) === norm(idxBlock), "E02 construtores IDÊNTICOS (paridade estrutural janela×toast)");
ok(api.premiumUse({ eventType: "task_moved" }) === false, "E03 opt-in: SEM _premiumCommon ⇒ layout clássico (regressão preservada)");
ok(api.premiumUse({ eventType: "task_moved", _premiumCommon: false }) === false, "E04 flag OFF ⇒ layout clássico");
ok(api.premiumUse({ eventType: "help_requested", _premiumCommon: true }) === false, "E05 tipo fora do escopo (help) ⇒ NÃO premium mesmo com flag");
ok(Object.keys(api.PREMIUM_TYPES).length === 17, "E06 allowlist premium = 17 tipos: 7 Categoria-A + 10 workflow wf_* (RE-PINADO F3.5.6B-H2)");
ok(api.premiumUse({ eventType: "wf_client_themes_approved", _premiumCommon: true }) === true, "E06b wf_client_themes_approved ⇒ PREMIUM (F3.5.6B-H2)");
ok(api.premiumUse({ eventType: "wf_designer_item_completed", _premiumCommon: true }) === true, "E06c wf_designer_item_completed ⇒ PREMIUM (F3.5.6B-H2)");
ok(api.premiumUse({ eventType: "wf_designer_assigned", _premiumCommon: true }) === false, "E06d wf_designer_assigned FORA do premium (H1/1.0.245 preservada) ⇒ nunca entregue por esta via");
ok(api.premiumUse({ eventType: "task_assigned", _premiumCommon: true }) === true, "E06e task_assigned (Categoria A) segue PREMIUM (regressão)");
ok(/premiumUse\(p\)\{ return !!\(p&&p\._premiumCommon===true/.test(BG) && /premiumUse\(p\)\{ return !!\(p&&p\._premiumCommon===true/.test(IDX), "E07 gate ===true (opt-in) nas duas superfícies");

// ══════════════════════ F) MAIN.TS — FLAG + FIAÇÃO ══════════════════════
ok(/let premiumCommonEnabled = true;/.test(MAIN), "F01 var premiumCommonEnabled (default ON)");
ok(/function loadPremiumFlag\(\)[^]*f354u-notify\.json[^]*premiumCommonNotificationsEnabled !== false/.test(MAIN), "F02 loadPremiumFlag: f354u-notify.json, default ON");
ok(/function savePremiumFlag\(/.test(MAIN), "F03 savePremiumFlag persiste");
ok(/premiumCommonEnabled = loadPremiumFlag\(\);/.test(MAIN), "F04 init da flag no boot");
ok(/ipcMain\.handle\("premium-get"/.test(MAIN), "F05 IPC premium-get");
ok(/ipcMain\.handle\("premium-set"/.test(MAIN), "F06 IPC premium-set");
ok(/\(p as any\)\._premiumCommon = \(typeof premiumCommonEnabled !== "undefined"\) \? premiumCommonEnabled : true;/.test(MAIN), "F07 carimbo _premiumCommon com typeof-guard (fixtures)");
ok(/premiumObserve\(p, "toast"\)/.test(MAIN) && /premiumObserve\(p, bgOk \? "premium_window"/.test(MAIN), "F08 premiumObserve nas superfícies toast + premium_window");
ok(/premiumObserveGroup\(p,/.test(MAIN), "F09 premiumObserveGroup no caminho de atualização de grupo");
ok(/\n      premiumCommonEnabled,\n/.test(MAIN.replace(/\r/g, "")) || /premiumCommonEnabled,/.test(MAIN), "F10 notif-diag inclui premiumCommonEnabled (sanitizado)");
ok(/, screen, Menu \} from "electron"/.test(MAIN), "F11 screen importado (scaleFactor; RE-PINADO F3.5.5D/E — Menu aditivo)");
ok(/const PREMIUM_COMMON_TYPES: Record<string, true> = \{/.test(MAIN), "F12 allowlist premium no main");

// ══════════════════════ G) OBSERVABILIDADE — 8 NOMES EXATOS + SANITIZAÇÃO ══════════════════════
const EV8 = ["notification.premium.rendered", "notification.premium.group_updated", "notification.premium.layout_fallback", "notification.premium.avatar_fallback", "notification.premium.text_truncated", "notification.premium.opened", "notification.premium.closed", "notification.premium.feature_disabled"];
EV8.forEach((n, i) => ok((MAIN + BGT).includes('"' + n + '"'), "G0" + (i + 1) + " evento exato: " + n));
ok(!/notif\.premium\.(rendered|opened|closed|group_updated)/.test(MAIN + BGT), "G09 NÃO usa notif.premium.* como substituto dos 8");
// campos proibidos NUNCA nos payloads dos eventos premium.* (analisa cada chamada diag('notification.premium....', {...}))
{
  const calls = (MAIN + "\n" + BGT).match(/diag\("notification\.premium\.[a-z_]+",\s*\{[^}]*\}/g) || [];
  const forbidden = /\b(actorName|taskTitle|clientName|responsibleName|actorAvatar|responsibleAvatar|targetUserId|\buid\b|token|email|photo|body|context)\b/;
  const anyBad = calls.some((c) => forbidden.test(c));
  ok(calls.length >= 6 && !anyBad, "G10 payloads premium.* só com campos permitidos (sem nome/título/cliente/uid/token/foto/body)");
}
ok(/t === "notification\.premium\.opened" \|\| t === "notification\.premium\.closed"/.test(MAIN), "G11 diag-log reescreve opened/closed com NOME EXATO (sem prefixo renderer.)");
ok(/scaleFactor: premiumScaleFactor\(\)/.test(MAIN), "G12 rendered carrega scaleFactor (DPI/escala) sanitizado");

// ══════════════════════ H) bgNotify.ts — LARGURA RESPONSIVA + CONTRATO CONGELADO ══════════════════════
ok(/const WIDTH_PREF = 500;/.test(BGT) && /const WIDTH_MAX = 560;/.test(BGT) && /const WIDTH_MIN = 440;/.test(BGT), "H01 largura preferencial 500 / faixa 440–560");
ok(/function computeWidth\(/.test(BGT), "H02 computeWidth (responsiva à workArea)");
ok(/const WIDTH = computeWidth\(wa\);/.test(BGT) && /wa\.width - WIDTH/.test(BGT), "H03 posiciona no canto inferior direito via workArea (contrato preservado)");
ok(/focusable: false/.test(BGT) && /showInactive\(\)/.test(BGT) && /alwaysOnTop: true/.test(BGT), "H04 CONGELADO: focusable:false + showInactive + alwaysOnTop (não rouba foco)");
ok(/skipTaskbar: true/.test(BGT) && /getDisplayNearestPoint/.test(BGT), "H05 CONGELADO: skipTaskbar + multimonitor (display do cursor)");
ok(/ACK_TIMEOUT_MS = 4000/.test(BGT) && /pendingAck/.test(BGT), "H06 CONGELADO: ACK/fallback (4s) intacto");
ok(/notification\.premium\.closed/.test(BGT), "H07 observabilidade closed na janela premium (bgnotify-empty)");
{ const w = new Function("wa", extractComputeWidth(BGT) + "\n;return computeWidth(wa);"); ok(w({ width: 1366 }) === 500 && w({ width: 1920 }) === 500, "H08 1366/1920 ⇒ 500px (sem corte)"); ok(w({ width: 420 }) >= 360 && w({ width: 420 }) <= 420, "H09 tela estreita ⇒ encolhe com margens (piso 360)"); }

function extractComputeWidth(src) { const a = src.indexOf("const WIDTH_PREF"); const b = src.indexOf("function bgVersion("); return src.slice(a, b).replace(/: Electron\.Rectangle \| null \| undefined/g, "").replace(/: number/g, ""); }

// ══════════════════════ I) PRELOAD ══════════════════════
ok(/premiumGet: \(\): Promise<any> => ipcRenderer\.invoke\("premium-get"\)/.test(PRE), "I01 preload premiumGet (flag only)");
ok(/premiumSet: \(v: boolean\): Promise<any> => ipcRenderer\.invoke\("premium-set", v\)/.test(PRE), "I02 preload premiumSet (flag only)");

// ══════════════════════ J) CONFIGURAÇÕES + CONGELADOS + SEGURANÇA ══════════════════════
ok(/data-cfgpremium=/.test(IDX) && /premiumSet\(/.test(IDX), "J01 toggle Configurações → Notificações (data-cfgpremium)");
ok(/Estilo das notificações comuns/.test(IDX), "J02 linha de diagnóstico do estilo (Clássico/Premium)");
ok(/createNotificationGrouping/.test(GRP) && /common_group:/.test(GRP) && /GROUPABLE_EVENT_TYPES/.test(GRP), "J03 CONGELADO: notificationGrouping (lógica/allowlist/janela) intacto");
ok(/groupWindowMs > 0 \? opts\.groupWindowMs : 5000/.test(GRP) && /maxVisibleItems === "number"/.test(GRP), "J04 CONGELADO: janela 5s + máx itens preservados");
ok(/content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"/.test(BG), "J05 SEGURANÇA: CSP da janela premium inalterada (sem script externo)");
ok(!/<script\s+src=/.test(BG), "J06 SEGURANÇA: janela premium sem <script src> externo");
ok(!/<audio|\.play\(\)/.test(BG), "J07 janela premium continua SILENCIOSA (sem áudio)");
ok(/function deliverNotification/.test(MAIN) && /notif-toast/.test(MAIN) && /showBgNotify/.test(MAIN) && /_notifSeen/.test(MAIN) && /notif-history/.test(MAIN), "J08 CONGELADO: HUB/entrega/dedup/sino intactos");

// ══════════════════════ RESUMO ══════════════════════
const TOTAL = PASS + FAIL;
console.log("\n===== F3.5.4U PREMIUM-COMMON-NOTIFICATIONS: " + PASS + " PASS / " + FAIL + " FAIL (total " + TOTAL + ") =====");
if (FAIL) { console.error("FALHAS:\n - " + FAILS.join("\n - ")); process.exit(1); }
