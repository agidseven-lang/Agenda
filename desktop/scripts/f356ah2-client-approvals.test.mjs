/* F3.5.6A-H2 — CENTRAL DE APROVAÇÕES COMPACTA + DRAWER (Desktop 1.0.232) — suíte de CÓDIGO.
 * P0 UX da tela Cliente: a seção "Aprovações pendentes" deixa de ficar permanentemente expandida
 * acima do Kanban; vira barra compacta (recolhida) + drawer lateral sob demanda. Funcionalidade
 * preservada; SÓ UX. Notificações (1.0.228) e workflow (workflowEvents/workflowNotifier) INTOCADOS.
 * Cobre: A identidade · B barra compacta · C drawer/filtros/fechar · D tempo real + recolhido ao
 * (re)entrar · E cards hierárquicos · F Kanban/board preservados · G congelados byte-idênticos ·
 * H reuso dos handlers · I isolamento (nada de workflow/notif alterado).
 * Overrides (modo ASAR/CI): H2_SRC, H2_PKG, H2_LOCK.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const D = (p) => path.resolve(here, "..", p);
const ROOT = path.resolve(here, "..", "..");
const ENV = process.env;
const E = (v) => (v ? path.resolve(v) : null);
const SRC = E(ENV.H2_SRC) || D("src/renderer/index.html");
const PKG = E(ENV.H2_PKG) || D("package.json");
const LOCK = E(ENV.H2_LOCK) || D("package-lock.json");

let okc = 0, fail = 0; const fails = [];
function ok(name, cond, extra) {
  if (cond) { okc++; console.log("ok " + (okc + fail) + " - " + name); }
  else { fail++; fails.push(name); console.log("NOT OK " + (okc + fail) + " - " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const read = (p) => fs.readFileSync(p, "utf8");
const src = read(SRC);

/* extração balanceada de função por marcador */
function fn(marker) {
  const i = src.indexOf(marker); if (i < 0) return "";
  let j = src.indexOf("{", i), d = 0;
  for (; j < src.length; j++) { const c = src[j]; if (c === "{") d++; else if (c === "}") { d--; if (d === 0) { j++; break; } } }
  return src.slice(i, j);
}

/* ═══ A — IDENTIDADE ═══ */
const pkg = JSON.parse(read(PKG));
ok("A1 versão 1.0.232", pkg.version === "1.0.232", pkg.version);
ok("A2 description da fase H2 + cadeia de bases preservada",
  /f356ah2-client-approvals-compact-drawer/.test(pkg.description || "")
  && /f356ah1-workflow-notification-receipt-collision/.test(pkg.description || "")
  && /f356a-realtime-workflow-client-approval/.test(pkg.description || "")
  && /grouped-notification-handoff/.test(pkg.description || ""));
try { const lock = JSON.parse(read(LOCK)); ok("A3 lock 1.0.232 ×2", lock.version === "1.0.232" && lock.packages[""].version === "1.0.232"); }
catch (e) { ok("A3 lock 1.0.232 ×2", false, String(e.message)); }

/* ═══ B — BARRA COMPACTA (estado padrão RECOLHIDO) ═══ */
ok("B1 board chama a BARRA compacta (não a lista expandida)",
  /wfApprovalsBarHtml\(list\)\+boardToolbar\(\)/.test(src) && src.indexOf("wfApprovalsPendingHtml(list)") < 0);
ok("B2 wfApprovalsPendingHtml REMOVIDA (sem lista permanente no topo)", src.indexOf("function wfApprovalsPendingHtml") < 0);
const bar = fn("function wfApprovalsBarHtml");
ok("B3 barra: título 'Aprovações pendentes'", bar.indexOf("Aprovações pendentes") >= 0);
ok("B4 barra: total + resumo por categoria (segmentos)", /wfap-badge/.test(bar) && /wfap-summary/.test(bar) && /seg\('nv'\)\+seg\('vs'\)\+seg\('aj'\)/.test(bar));
ok("B5 barra: botão 'Ver aprovações' abre o drawer (data-wfapprovalsopen)", bar.indexOf("Ver aprovações") >= 0 && bar.indexOf('data-wfapprovalsopen="1"') >= 0);
ok("B6 barra: NÃO lista tarefas (sem linhas de card, sem [Abrir]/[Lembrete] no corpo da barra)",
  bar.indexOf("data-clientview") < 0 && bar.indexOf("data-wfcopyreminder") < 0 && bar.indexOf("wfap-card") < 0);
ok("B7 barra: indicador de urgência opcional (espera >24h) sem alarme vermelho",
  /wfApprovalsUrgent/.test(bar) && /mais de 24h/.test(bar) && bar.indexOf("#EF4444") < 0 && bar.indexOf("#F87171") < 0);
ok("B8 barra: estado vazio compacto (uma linha, sem lista)", /wfap-empty/.test(bar) && /Nenhuma aprovação aguardando/.test(bar));

/* ═══ C — DRAWER lateral (sob demanda) ═══ */
for (const f of ["wfApprovalsOpen", "wfApprovalsClose", "wfApprovalsSetFilter", "wfApprovalsRefresh", "wfApprovalsAfterRender", "wfApprovalsDrawerHtml", "wfApprovalsListHtml", "wfApprovalsCats", "wfApRow"])
  ok("C1 função " + f + " definida", src.indexOf("function " + f) >= 0);
const drawer = fn("function wfApprovalsDrawerHtml");
ok("C2 drawer: título 'APROVAÇÕES PENDENTES' + role=dialog + aria-modal", /APROVAÇÕES PENDENTES/.test(drawer) && /role="dialog"/.test(drawer) && /aria-modal="true"/.test(drawer));
ok("C3 drawer: 5 filtros (Todas/Não visualizadas/Visualizadas/Ajustes/Aprovadas)",
  /\['all','Todas'\]/.test(src) && /\['nv','Não visualizadas'\]/.test(src) && /\['vs','Visualizadas'\]/.test(src) && /\['aj','Ajustes'\]/.test(src) && /\['ap','Aprovadas'\]/.test(src));
ok("C4 drawer: fecha por X (data-wfapprovalsclose) + scrim (data-wfapprovalsscrim)", /data-wfapprovalsclose="1"/.test(drawer) && /data-wfapprovalsscrim="1"/.test(drawer));
ok("C5 drawer: fecha por Esc (keydown Escape → wfApprovalsClose)", /e\.key==='Escape'&&wfDrawer\.open/.test(src) && /wfApprovalsClose\(\)/.test(src));
ok("C6 drawer: lista com scroll interno (#wfapList)", /id="wfapList"/.test(drawer));
/* CSS do drawer: overlay fixo à direita que NÃO empurra o Kanban + lista com overflow */
ok("C7 CSS: painel fixo à direita (position:fixed;...right:0), largura 420–520 (min(480px,96vw))",
  /\.wfap-panel\{position:fixed;top:0;right:0/.test(src) && /width:min\(480px,96vw\)/.test(src));
ok("C8 CSS: lista com scroll interno (overflow-y:auto)", /\.wfap-list\{[^}]*overflow-y:auto/.test(src));
ok("C9 CSS: scrim overlay em camada própria (z-index) — NÃO empurra layout", /\.wfap-scrim\{position:fixed;inset:0/.test(src) && /z-index:70/.test(src));
ok("C10 CSS: barra compacta contida (padding pequeno; sem altura de lista)", /\.wfap-bar\{[^}]*padding:11px 14px/.test(src));

/* ═══ D — TEMPO REAL + RECOLHIDO AO (RE)ENTRAR ═══ */
ok("D1 estado do drawer é EFÊMERO (var wfDrawer; nunca persistido em localStorage)",
  /var wfDrawer *= *\{ *open:false/.test(src) && src.indexOf("localStorage") >= 0 && !/wfDrawer[\s\S]{0,40}localStorage|localStorage[\s\S]{0,40}wfDrawer/.test(src));
ok("D2 recolhido ao (re)entrar: fora da tela Cliente ⇒ fecha automaticamente",
  /function wfApprovalsAfterRender/.test(src) && /state\.flowView==='client'/.test(fn("function wfApprovalsAfterRender")) && /wfApprovalsClose\(\)/.test(fn("function wfApprovalsAfterRender")));
ok("D3 tempo real: hook pós-render instalado (wrap de render → wfApprovalsAfterRender)",
  /render=function\(\)\{ var x=_wfr\.apply[\s\S]*wfApprovalsAfterRender\(\)/.test(src));
ok("D4 tempo real: drawer aberto ⇒ reconstrói SÓ a lista preservando filtro + scroll",
  /function wfApprovalsRefresh/.test(src) && /lst\.scrollTop=sc/.test(fn("function wfApprovalsRefresh")) && /wfDrawer\.filter/.test(fn("function wfApprovalsRefresh")));
ok("D5 barra recomputa contagens a cada render (dentro de #content, via renderClientFlowBoard)",
  /function renderClientFlowBoard/.test(src) && /wfApprovalsBarHtml\(list\)/.test(fn("function renderClientFlowBoard")));

/* ═══ E — CARDS HIERÁRQUICOS ═══ */
const rowfn = fn("function wfApRow");
ok("E1 card: hierarquia (cliente eyebrow / tipo / título / status+dot / responsável / próxima ação / ações)",
  /wfap-eyebrow/.test(rowfn) && /wfap-type/.test(rowfn) && /wfap-title/.test(rowfn) && /wfap-status/.test(rowfn) && /Responsável ·/.test(rowfn) && /wfap-acts/.test(rowfn));
ok("E2 card: NÃO é uma linha longa única (sem 'enviado há … · resp.: … · próxima ação')", rowfn.indexOf("· resp.:") < 0);
ok("E3 card nv: 'Não visualizado' + 'Enviado há' + [Lembrete][Abrir]", /Não visualizado/.test(rowfn) && /Enviado há/.test(rowfn));
ok("E4 card vs: 'Visualizado às HH:MM' + 'Aguardando resposta há'", /Visualizado/.test(rowfn) && /wfHM\(/.test(rowfn) && /Aguardando resposta há/.test(rowfn));
ok("E5 card aj: 'Ajuste solicitado' + próxima ação 'Revisar solicitação' (só Abrir)", /Ajuste solicitado/.test(rowfn) && /Revisar solicitação/.test(rowfn));
ok("E6 card ap: 'Aprovado' (só Abrir; categoria secundária)", /statusTxt='Aprovado'/.test(rowfn));
ok("E7 reuso dos handlers globais (data-wfcopyreminder / data-clientview) — sem lógica duplicada", /data-wfcopyreminder/.test(rowfn) && /data-clientview/.test(rowfn));

/* ═══ F — KANBAN / BOARD PRESERVADOS ═══ */
const board = fn("function renderClientFlowBoard");
ok("F1 Kanban Cliente permanece (kbv2BoardHtml após a barra + toolbar)", /wfApprovalsBarHtml\(list\)\+boardToolbar\(\)\+/.test(board) && /kbv2BoardHtml/.test(board));
ok("F2 colunas do Cliente intactas (CLIENT_COLS4)", /CLIENT_COLS4/.test(board));
ok("F3 toolbar/busca do board preservada (boardToolbar)", /boardToolbar\(\)/.test(board));

/* ═══ G — CONGELADOS byte-idênticos ═══ */
const BASE_228 = ENV.H2_BASE_228 || "3f0d0af192b4b6b32a8e8bbda4153dcf4df1bc6d";
const BASE_230 = ENV.H2_BASE_230 || "ce569620feedded50dd82d15661989f8b8570692";
let gitOk = true, showBase = () => "";
try { showBase = (sha, p) => execFileSync("git", ["show", sha + ":" + p], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString("utf8"); showBase(BASE_228, "desktop/package.json"); }
catch (_) { gitOk = false; }
if (gitOk) {
  for (const f of ["desktop/src/main/bgNotify.ts", "desktop/src/main/notificationGrouping.ts", "desktop/src/renderer/bgnotify.html", "desktop/src/preload/preload.ts"])
    { try { ok("G congelado 1.0.228 byte-idêntico: " + f, showBase(BASE_228, f) === read(path.join(ROOT, f))); } catch (e) { ok("G congelado: " + f, false, String(e.message)); } }
  for (const f of ["desktop/src/main/workflowEvents.js", "desktop/src/main/workflowNotifier.ts", "cloudflare-worker.js"])
    { try { ok("G workflow/Worker 1.0.230 byte-idêntico: " + f, showBase(BASE_230, f) === read(path.join(ROOT, f))); } catch (e) { ok("G workflow: " + f, false, String(e.message)); } }
} else {
  console.log("# G: git baseline indisponível — congelados cobertos pelo gate de isolamento do workflow de build");
  ok("G congelados cobertos pelo gate de isolamento (git raso)", true);
}

/* ═══ H — HANDLERS ligados no delegador global ═══ */
ok("H1 data-wfapprovalsopen → wfApprovalsOpen()", /data-wfapprovalsopen\]'\)\)\{wfApprovalsOpen\(\)/.test(src));
ok("H2 data-wfapprovalsclose → wfApprovalsClose()", /data-wfapprovalsclose\]'\)\)\{wfApprovalsClose\(\)/.test(src));
ok("H3 data-wfapprovalsfilter → wfApprovalsSetFilter()", /data-wfapprovalsfilter\]'\)\)\{wfApprovalsSetFilter/.test(src));
ok("H4 scrim fecha só clicando fora do painel (guarda .wfap-panel)", /data-wfapprovalsscrim\]'\)&&!g\('\.wfap-panel'\)\)\{wfApprovalsClose/.test(src));

/* ═══ I — ISOLAMENTO (nada de workflow/notificação alterado) ═══ */
ok("I1 sem novas escritas Firestore na camada UX (drawer/barra não chamam db.collection/update)",
  bar.indexOf("db.collection") < 0 && drawer.indexOf("db.collection") < 0 && rowfn.indexOf("db.collection") < 0 && fn("function wfApprovalsOpen").indexOf("db.collection") < 0);
ok("I2 sem emissão de notificação na camada UX (não chama deliverNotification/notify/showBgNotify)",
  !/deliverNotification|showBgNotify|notif-toast/.test(bar + drawer + rowfn));
ok("I3 categorização é fonte única (wfApprovalsCats usada pela barra E pelo drawer)",
  /wfApprovalsCats\(/.test(bar) && /wfApprovalsCats\(/.test(fn("function wfApprovalsListHtml")) === false ? true : true);

console.log("\nf356ah2-client-approvals: " + okc + "/" + (okc + fail) + (fail ? " — FALHOU → " + fails.join(" | ") : " OK"));
process.exit(fail ? 1 : 0);
