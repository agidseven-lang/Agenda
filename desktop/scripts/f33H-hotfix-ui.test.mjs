#!/usr/bin/env node
/* F3.3.14 — HOTFIX BUG1 (Dashboard limpo) + BUG2 (header do quadro alinhado) — CONTRATO ESTÁTICO.
 *
 * READ-ONLY sobre o FONTE real (index.html). Congela o contrato cirúrgico aprovado:
 *  BUG1: overlays operacionais (Monitor SLA / sino / avatar do quadro) só existem no contexto de
 *        QUADRO (state.tab==='tarefas'); fora dali são REMOVIDOS da árvore (não display:none);
 *        render() reavalia os overlays (senão lingeririam ao trocar de aba).
 *  BUG2: eixo vertical ÚNICO — sino + Monitor SLA centralizam no centro REAL do avatar (sem o
 *        fallback fixo 38 que causava ~4px); só posicionamento; sem flex/dropdown/lógica.
 * E PRESERVAÇÃO: Worker/OG, F3.3.13 (Editar prazo), cache-bust, notificações e SLA engine intactos.
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

// helper: corpo de uma função por nome (do 'function nome(' até o fechamento na coluna 0)
function fnBody(src, header) { const a = src.indexOf(header); if (a < 0) return ''; const b = src.indexOf('\n}', a); return b < 0 ? src.slice(a) : src.slice(a, b + 2); }

// ===== BUG1 — contexto de quadro =====
ok('B1.1 isBoardContext existe e é state.tab===tarefas', /function isBoardContext\(\)\{ return !!\(typeof state!=='undefined' && state && state\.tab==='tarefas'\); \}/.test(DH));
ok('B1.2 Monitor SLA gated por (!authed || !isBoardContext) e REMOVE', /function slaMonRender\(\)\{[\s\S]{0,260}?if\(!authed \|\| !isBoardContext\(\)\)\{ if\(w\)w\.remove\(\); return; \}/.test(DH));
ok('B1.3 sino gated por (!authed || !isBoardContext) e REMOVE', /function slaibRender\(\)\{[\s\S]{0,260}?if\(!authed \|\| !isBoardContext\(\)\)\{ if\(bell\)bell\.remove\(\);[\s\S]{0,120}?return; \}/.test(DH));
ok('B1.4 avatar do quadro gated por isDesktop() && isBoardContext()', /if\(isDesktop\(\) && isBoardContext\(\)\)\{/.test(DH));
ok('B1.5 render() reavalia overlays (slaibRefresh forçado)', /reavalia overlays do quadro a cada render[\s\S]{0,160}?try\{ if\(typeof slaibRefresh==='function'\) slaibRefresh\(\); \}catch\(_\)\{\}/.test(DH));
// NÃO resolver com display:none global: não pode ter surgido um hack de display:none nessas funções
ok('B1.6 sem hack display:none nos overlays (remoção real da árvore)', !/sla-monitor[\s\S]{0,40}style\.display\s*=\s*'none'/.test(DH) && !/slaib-bell[\s\S]{0,40}style\.display\s*=\s*'none'/.test(DH));
// renderHoje (Dashboard) segue limpo: não injeta chips do quadro nem SLA inline
{ const home = fnBody(DH, 'function renderHoje('); ok('B1.7 renderHoje sem chips do quadro / sino / monitor inline', !!home && !/taskChips\(|slaib-bell|sla-monitor|slamon/.test(home)); }

// ===== BUG2 — eixo vertical único =====
ok('B2.1 slaClusterAlign existe (centro Y único; mede altura real)', /function slaClusterAlign\(centerY, avr\)\{/.test(DH));
ok('B2.2 sino centralizado no centerY do avatar', /bell\.style\.top=Math\.round\(centerY-bh\/2\)\+'px'/.test(DH));
ok('B2.3 Monitor SLA centralizado no MESMO centerY', /w\.style\.top=Math\.round\(centerY-ch\/2\)\+'px'/.test(DH));
ok('B2.4 slaHeaderAlign calcula centro REAL do avatar e delega', /var c=av\.getBoundingClientRect\(\); slaClusterAlign\(c\.top\+c\.height\/2, c\);/.test(DH));
ok('B2.5 slaMonAlign delega para o eixo único (slaClusterAlign)', /function slaMonAlign\(\)\{[\s\S]{0,220}?slaClusterAlign\(r\.top\+r\.height\/2\)/.test(DH));
// o fallback fixo de 38 (causa do ~4px) NÃO existe mais no alinhamento do monitor
{ const cluster = fnBody(DH, 'function slaClusterAlign('); const mon = fnBody(DH, 'function slaMonAlign('); ok('B2.6 sem fallback fixo 38 no alinhamento do Monitor SLA', !/\)\|\|38;/.test(mon) && /ch=\(w\.getBoundingClientRect\(\)\.height\|\|46\)/.test(cluster)); }

// ===== PRESERVAÇÃO (intocado) =====
ok('P1 Worker/OG intacto (OG_IMG_PATH jpg + 1200x630)', /const OG_IMG_PATH = "\/og\/wa-card-v64-38\.jpg"/.test(WK) && /og:image:width" content="1200"/.test(WK));
ok('P2 F3.3.13 Editar prazo intacto (slaEditPrazoCommit + write designerSla.plan*)', /async function slaEditPrazoCommit\(taskId, ov\)\{/.test(DH) && /patch\['designerSla\.planStartAt'\]=startMs; patch\['designerSla\.planDueAt'\]=dueMs;/.test(DH) && /if\(hadPF\) patch\['designerSla\.plannedFinishAt'\]=dueMs;/.test(DH));
ok('P3 cache-bust WhatsApp intacto', /const url=withWhatsAppPreviewBust\(buildShareClientUrl\(ctx&&ctx\.token\)\)/.test(DH));
ok('P4 notificações background intactas (main.ts)', /const bgOk = showBgNotify\(p\);/.test(MAIN) && /channel = bgOk \? "bg-window"/.test(MAIN));
ok('P5 SLA engine read-only intacto (notifScanSla + slaPanelFinishMs)', /function notifScanSla\(\)/.test(DH) && /function slaPanelFinishMs\(t,dtMsFn\)\{/.test(DH));
ok('P6 colunas/fluxo do Kanban não tocados (status canônicos presentes)', /A Fazer|afazer/.test(DH) && /andamento/.test(DH) && /revisao/.test(DH) && /concluido|entregue/.test(DH));

console.log('\nF3.3.14 HOTFIX UI (BUG1+BUG2): ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: contrato da hotfix F3.3.14 divergiu'); process.exit(1); }
console.log('OK — Dashboard limpo (overlays só no quadro, removidos da árvore) + header alinhado por eixo único; Worker/F3.3.13/cache-bust/notif/SLA intactos.');
