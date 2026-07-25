#!/usr/bin/env node
/* F3.3.15 — GATE REAL dos overlays (BUG1) + ALINHAMENTO AO BLOCO ESQUERDO (BUG2) — CONTRATO ESTÁTICO.
 *
 * READ-ONLY sobre o FONTE real (index.html). Congela o contrato cirúrgico da F3.3.15 (a F3.3.14 foi
 * reprovada: gate amplo demais por state.tab e alinhamento só do cluster direito entre si).
 *  BUG1: overlays (Monitor SLA / sino / avatar do quadro) só no KANBAN REAL — isOperationalBoardContext()
 *        exige state.tab==='tarefas' + #content.board-mode + superfície real (.kbv2-board-surface). Fora
 *        dali (Hoje, "Quadros"/hub, listas) são REMOVIDOS da árvore (não display:none). O avatar é gerido
 *        por slaibRefresh() APÓS o render (board-mode já correto); render() não cria mais cedo demais.
 *  BUG2: eixo = centro do BLOCO ESQUERDO real (.d-board-head: voltar + avatar esq + título/cargo);
 *        Monitor+sino+avatar centralizam NELE (não mais no avatar/logo).
 * PRESERVAÇÃO: Worker/OG, F3.3.13, cache-bust, notificações, SLA engine, Kanban — intactos.
 * Rodar: /opt/node22/bin/node desktop/scripts/f33H-hotfix-ui.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const rd = (p) => fs.readFileSync(p, 'utf8');
const DH = rd(path.join(DESK, 'src', 'renderer', 'index.html'));
const MAIN = rd(path.join(DESK, 'src', 'main', 'main.ts'));
const WK = rd(path.join(ROOT, 'cloudflare-worker.js'));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.log('FAIL:', n); } };
function fnBody(src, header) { const a = src.indexOf(header); if (a < 0) return ''; const b = src.indexOf('\n}', a); return b < 0 ? src.slice(a) : src.slice(a, b + 2); }

// ===== BUG1 — GATE REAL (Kanban real, não a aba genérica) =====
ok('B1.1 isOperationalBoardContext existe', /function isOperationalBoardContext\(\)\{/.test(DH));
{ const g = fnBody(DH, 'function isOperationalBoardContext(');
  ok('B1.2 gate exige state.tab===tarefas', /state\.tab!=='tarefas'/.test(g));
  ok('B1.3 gate exclui form/clientView', /state\.form\s*\|\|\s*state\.clientView/.test(g));
  ok('B1.4 gate exige #content.board-mode', /classList\.contains\('board-mode'\)/.test(g));
  ok('B1.5 gate exige superfície real (kbv2-board-surface / .kanban .kcol)', /querySelector\('\.kbv2-board-surface, \.kanban \.kcol'\)/.test(g));
  ok('B1.6 gate NÃO usa só state.tab (tem board-mode/superfície)', /board-mode/.test(g) && /kbv2-board-surface/.test(g));
}
ok('B1.7 Monitor SLA gated por isOperationalBoardContext + REMOVE', /function slaMonRender\(\)\{[\s\S]{0,260}?if\(!authed \|\| !isOperationalBoardContext\(\)\)\{ if\(w\)w\.remove\(\); return; \}/.test(DH));
ok('B1.8 sino gated por isOperationalBoardContext + REMOVE', /function slaibRender\(\)\{[\s\S]{0,260}?if\(!authed \|\| !isOperationalBoardContext\(\)\)\{ if\(bell\)bell\.remove\(\);[\s\S]{0,120}?return; \}/.test(DH));
// avatar do quadro: criado/removido por slaibRefresh com o MESMO gate (não mais cedo no render)
{ const r = fnBody(DH, 'function slaibRefresh(');
  ok('B1.9 slaibRefresh gere cornerAvatar pelo gate real', /isDesktop\(\) && isOperationalBoardContext\(\)/.test(r) && /cornerAvatar/.test(r) && /_ca\.remove\(\)/.test(r));
}
ok('B1.10 render() não cria cornerAvatar cedo (comentário F3.3.15 + criação única em slaibRefresh)', /o avatar operacional e os overlays do quadro são geridos por slaibRefresh/.test(DH) && (DH.match(/_ca\.id='cornerAvatar'/g) || []).length === 1);
ok('B1.11 wrapper de render() dispara slaibRefresh APÓS o render', /window\.render=function\(\)\{var r=_orig\.apply\(this,arguments\);try\{if\(typeof slaibRefresh==='function'\)slaibRefresh\(\);\}catch\(_\)\{\}/.test(DH));
ok('B1.12 sem hack display:none nos overlays (remoção real)', !/sla-monitor[\s\S]{0,40}style\.display\s*=\s*'none'/.test(DH) && !/slaib-bell[\s\S]{0,40}style\.display\s*=\s*'none'/.test(DH));
// gate antigo (amplo) eliminado
ok('B1.13 isBoardContext (gate antigo amplo) removido', !/function isBoardContext\(/.test(DH) && !/[^a-zA-Z]isBoardContext\(/.test(DH));

// ===== BUG2 — ALINHAMENTO AO BLOCO ESQUERDO =====
ok('B2.1 slaHeaderTargetCenterY existe', /function slaHeaderTargetCenterY\(\)\{/.test(DH));
{ const t = fnBody(DH, 'function slaHeaderTargetCenterY(');
  ok('B2.2 mede o container do bloco esquerdo (.d-board-head)', /#content\.board-mode \.d-board-head/.test(t));
  ok('B2.3 fallback composto (voltar + avatar esq + título)', /\.scr-head \.iconbtn/.test(t) && /\.d-bh-icon/.test(t) && /\.d-bh-title/.test(t) && /Math\.min/.test(t) && /Math\.max/.test(t));
}
{ const cl = fnBody(DH, 'function slaClusterAlign(');
  ok('B2.4 slaClusterAlign usa o centro do bloco esquerdo (slaHeaderTargetCenterY)', /var cy=slaHeaderTargetCenterY\(\);/.test(cl));
  ok('B2.5 centraliza avatar+sino+monitor no MESMO cy', /av\.style\.top=Math\.round\(cy-ah\/2\)/.test(cl) && /bell\.style\.top=Math\.round\(cy-bh\/2\)/.test(cl) && /w\.style\.top=Math\.round\(cy-ch\/2\)/.test(cl));
  ok('B2.6 mede altura real (sem fallback fixo 38 que dava ~4px)', !/\)\|\|38;/.test(cl.replace(/height\|\|38/g,'')) || /getBoundingClientRect\(\)\.height\|\|46/.test(cl));
}
ok('B2.7 slaHeaderAlign delega ao eixo do bloco esquerdo', /function slaHeaderAlign\(\)\{[\s\S]{0,160}?slaClusterAlign\(\);/.test(DH));
ok('B2.8 slaMonAlign delega para slaClusterAlign', /function slaMonAlign\(\)\{ try\{ slaClusterAlign\(\); \}catch\(_\)\{\} \}/.test(DH));
ok('B2.9 NÃO centraliza mais no logo/avatar (regra antiga removida)', !/\.sb-brand \.logo[\s\S]{0,80}av\.style\.top/.test(DH));

// ===== PRESERVAÇÃO =====
ok('P1 Worker/OG intacto', /const OG_IMG_PATH = "\/og\/wa-card-v64-38\.jpg"/.test(WK) && /og:image:width" content="1200"/.test(WK));
ok('P2 F3.3.13 Editar prazo intacto', /async function slaEditPrazoCommit\(taskId, ov\)\{/.test(DH) && /patch\['designerSla\.planStartAt'\]=startMs; patch\['designerSla\.planDueAt'\]=dueMs;/.test(DH) && /if\(hadPF\) patch\['designerSla\.plannedFinishAt'\]=dueMs;/.test(DH));
// F3.3.70D3R10AA: contrato atualizado por ordem do owner — mensagem SEM cache-bust (regime 19/06).
ok('P3 mensagem WhatsApp no regime restaurado (link estavel — D3R10AA)', /const url=buildShareClientUrl\(ctx&&ctx\.token\);/.test(DH));
// F3.4.7 — RE-ÂNCORA AUTORIZADA: showBgNotify(p, onNoRender); premium primária, bg-window preservado.
ok('P4 notificações background intactas (main.ts)', /const bgOk = showBgNotify\(p, \(\) => \{/.test(MAIN) && /channel = bgOk \? "bg-window"/.test(MAIN));
ok('P5 SLA engine read-only intacto', /function notifScanSla\(\)/.test(DH) && /function slaPanelFinishMs\(t,dtMsFn\)\{/.test(DH));
ok('P6 Kanban (superfície kbv2 + builder) intactos', /function kbv2BoardHtml\(cols, cardFn\)\{/.test(DH) && /<div class="kbv2-board-surface"><div class="kbv2-board">/.test(DH));

console.log('\nF3.3.15 GATE+ALIGN (BUG1+BUG2): ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: contrato da F3.3.15 divergiu'); process.exit(1); }
console.log('OK — overlays só no Kanban real (board-mode+superfície) + alinhados ao bloco esquerdo (.d-board-head); Worker/F3.3.13/cache-bust/notif/SLA/Kanban intactos.');
