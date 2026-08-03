#!/usr/bin/env node
/* =====================================================================
 * F3.5.4W — CARDS COMPACTOS · CENTRAL DE DETALHES · AVATARES · SOCIAL MEDIAS
 * ---------------------------------------------------------------------
 * Contrato ESTÁTICO das QUATRO entregas inseparáveis, verificado no renderer
 * (src/renderer/index.html). O comportamento visual REAL é provado pelo harness
 * Electron f354w-electron-proof.mjs (app.asar empacotado, sem IA/mockup).
 *
 *   D1 — Cards compactos: o card usa um RESUMO (kbv2ContentSlot), NUNCA renderiza
 *        a lista completa de temas/legendas; altura controlada; sem esconder por CSS.
 *   D2 — Central de Detalhes: superfície grande, blocos numerados TEMA/ROTEIRO/VÍDEO/
 *        CARD NN, acordeões nativos <details>, Expandir/Recolher todos, Esc/foco/retorno,
 *        parágrafos preservados (pre-wrap), esc() (sem innerHTML cru / [object Object]).
 *   D3 — Avatares: correção pelo CONTAINER (.f354-dstrip) — altura/overflow/padding —,
 *        NÃO encolhendo o avatar nem por margens negativas.
 *   D4 — Social Medias: quadro aparece automaticamente (auto-pick por estado; sem .click()),
 *        colunas renderizadas mesmo com 0 tarefas; rótulo "Social Medias".
 *
 * Rodar: node scripts/f354w-compact-cards-details.test.mjs
 *   (SRC=<arquivo> para apontar ao index.html EMPACOTADO no gate do asar)
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const H = fs.readFileSync(process.env.SRC || path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; flog.push(n); console.log('  FAIL — ' + n); } };

console.log('== F3.5.4W — cards compactos · central de detalhes · avatares · social (contrato de código) ==');

/* ======================= D1 — CARDS COMPACTOS ======================= */
console.log('\n-- D1: cards compactos --');
ok('D1.1  função kbv2ContentSlot(t, cron, s, clientView, isCron) definida', /function kbv2ContentSlot\(t, cron, s, clientView, isCron\)\{/.test(H));
ok('D1.2  kbv2Card usa o RESUMO (h+=kbv2ContentSlot(...))', /h\+=kbv2ContentSlot\(t, cron, s, clientView, isCron\);/.test(H));
ok('D1.3  card NÃO renderiza a lista completa de temas (cron.list.map(...kbv2-theme) REMOVIDO)', !/cron\.list\.map\(c=>'<div class="kbv2-theme">/.test(H));
ok('D1.4  resumo de vídeos/roteiros ("N vídeo(s)/roteiro(s)")', /vídeo'\+\(n===1\?'':'s'\)\+'\/roteiro'/.test(H));
ok('D1.5  resumo temas/roteiros + "· N legenda(s)" (legN conta legendas não-vazias)', /legN=cron\.list\.filter\(function\(c\)\{return c&&c\.legenda&&String\(c\.legenda\)\.trim\(\);\}\)\.length/.test(H) && /legN>0\?\(legN\+' legenda'/.test(H));
ok('D1.6  Edição de Cards no resumo via cardsFieldOf (Legenda · Observações)', /s\.key==='edicao_cards'/.test(H) && /cardsFieldOf\(t,'legenda'\)/.test(H) && /cardsFieldOf\(t,'obs'\)/.test(H) && /parts\.join\(' · '\)/.test(H));
ok('D1.7  cron vazio → "A definir" + hint (gated !clientView&&isCron)', /if\(!clientView&&isCron\)\{[\s\S]{0,40}return box\('A definir'/.test(H));
ok('D1.8  fallback → "Sem itens vinculados · detalhes na tarefa"', /return box\('Sem itens vinculados','detalhes na tarefa','kbv2-sum-empty'\);/.test(H));
ok('D1.9  checklist do card GATED por t.checklist.length (esconde "0 de 0")', /Array\.isArray\(t\.checklist\)&&t\.checklist\.length\)\{/.test(H));
ok('D1.10 CSS .kbv2-card-summary com flex:0 0 auto (altura controlada, não cresce)', /\.kbv2-card-summary\{[^}]*flex:0 0 auto/.test(H));
ok('D1.11 CSS .kbv2-sum-main / .kbv2-sum-sub / .kbv2-sum-empty definidos', /\.kbv2-sum-main\{/.test(H) && /\.kbv2-sum-sub\{/.test(H) && /\.kbv2-sum-empty\{/.test(H));
ok('D1.12 resumo escapa o conteúdo (esc(v) no box) — sem HTML/JSON cru no card', /function box\(v, sub, extraCls\)\{[\s\S]{0,220}esc\(v\)/.test(H));
ok('D1.13 card NÃO emite nós de tema no DOM (sem class="kbv2-theme"/"kbv2-themes-list" no HTML; textos não ficam ocultos)', !/class="kbv2-theme"/.test(H) && !/class="kbv2-themes-list"/.test(H));

/* ==================== D2 — CENTRAL DE DETALHES ==================== */
console.log('\n-- D2: central de detalhes --');
ok('D2.1  .det-sheet GRANDE — width:min(1240px,92vw) + height:88vh', /\.det-sheet\{width:min\(1240px,92vw\);max-width:92vw;text-align:left;height:88vh;max-height:90vh/.test(H));
ok('D2.2  detItemWord(t) → ROTEIRO/VÍDEO/CARD/TEMA', /function detItemWord\(t\)\{/.test(H) && /return 'ROTEIRO';/.test(H) && /return 'VÍDEO';/.test(H) && /return 'CARD';/.test(H) && /return 'TEMA';/.test(H));
ok('D2.3  acordeão nativo <details class="det-acc"> por bloco', /<details class="det-acc"'\+\(_openAll\?' open':''\)\+'>/.test(H));
ok('D2.4  rótulo numerado det-acc-k com PALAVRA + NN (zero à esquerda)', /num=\(c\._i\+1<10\?'0':''\)\+\(c\._i\+1\)/.test(H) && /<span class="det-acc-k">'\+_word\+' '\+num\+'/.test(H));
ok('D2.5  barra "Expandir todos" / "Recolher todos" (data-detexpand/collapse)', /data-detexpand="1">Expandir todos<\/button>/.test(H) && /data-detcollapse="1">Recolher todos<\/button>/.test(H));
ok('D2.6  handler Expandir/Recolher aplica open a TODOS os .det-acc', /\[data-detexpand\]'\)\)\{[^}]*\.det-acc'\)\.forEach\(function\(d\)\{d\.open=true;\}\)/.test(H) && /\[data-detcollapse\]'\)\)\{[^}]*\.det-acc'\)\.forEach\(function\(d\)\{d\.open=false;\}\)/.test(H));
ok('D2.7  corpo do bloco preserva parágrafos/quebras (.det-acc-l white-space:pre-wrap)', /\.det-acc-l\{[^}]*white-space:pre-wrap/.test(H));
ok('D2.8  legenda do bloco escapada (esc(leg)) — sem innerHTML cru', /det-acc-l">'\+esc\(leg\)/.test(H));
ok('D2.9  tema do bloco escapado (esc(c.tema||...))', /<span class="det-acc-t">'\+esc\(c\.tema\|\|'\(sem tema\)'\)/.test(H));
ok('D2.10 modal-back marcado com data-detmodal (escopo do Esc/trap)', /class="modal-back" data-modalbg="1" data-detmodal="1"/.test(H));
ok('D2.11 acessibilidade: role="dialog" aria-modal="true" no sheet', /class="sheet det-sheet" role="dialog" aria-modal="true"/.test(H));
ok('D2.12 detSetupModalFocus definido e chamado ao abrir', /function detSetupModalFocus\(\)\{/.test(H) && /detSetupModalFocus\(\);\s*\/\/ F3\.5\.4W/.test(H));
ok('D2.13 trap de Tab (Shift+Tab cicla) na Central', /if\(ev\.key!=='Tab'\)return;/.test(H) && /ev\.shiftKey/.test(H));
ok('D2.14 Esc fecha SÓ a Central (querySelector data-detmodal → closeModal)', /if\(e\.key==='Escape'\)\{closeCardMenus\(\);[\s\S]{0,220}\.modal-back\[data-detmodal\]'\)\)\{closeModal\(\);\}/.test(H));
ok('D2.15 retorno de foco: closeModal restaura _detReturnEl', /function closeModal\(\)\{[\s\S]{0,200}_detReturnEl;[\s\S]{0,80}\.focus\(\)/.test(H));
ok('D2.16 foco de origem capturado só quando a Central ainda não está aberta', /if\(!document\.querySelector\('\.modal-back\[data-detmodal\]'\)\)\{_detReturnEl=/.test(H));
ok('D2.17 Edição de Cards: blocos rotulados CARD · LEGENDA e CARD · OBSERVAÇÕES', /CARD · LEGENDA/.test(H) && /CARD · OBSERVAÇÕES/.test(H));
ok('D2.18 Edição de Cards: legenda/obs via cardsFieldOf na Central', /_leg=cardsFieldOf\(t,'legenda'\),_obs=cardsFieldOf\(t,'obs'\)/.test(H));
ok('D2.19 chevron gira quando aberto (.det-acc[open]>summary .det-acc-chev rotate)', /\.det-acc\[open\]>summary \.det-acc-chev\{transform:rotate\(90deg\)\}/.test(H));
ok('D2.20 default aberto só p/ listas curtas (<=5); longas colapsadas', /_openAll=cron\.list\.length<=5/.test(H));
ok('D2.21 summary sem marcador nativo (list-style:none + ::-webkit-details-marker)', /\.det-acc>summary\{[^}]*list-style:none/.test(H) && /::-webkit-details-marker\{display:none\}/.test(H));
ok('D2.22 briefing/desc da Central escapado (esc(t.desc)) — sem HTML/JSON cru de objeto', /det-desc">'\+esc\(t\.desc\)/.test(H));

/* ==================== D3 — AVATARES (container) ==================== */
console.log('\n-- D3: avatares (correção pelo container) --');
ok('D3.1  .f354-dstrip com align-items:center (não corta verticalmente)', /body\.desktop \.f354-dstrip\{[^}]*align-items:center/.test(H));
ok('D3.2  .f354-dstrip overflow-y:hidden (barra horizontal não recorta o anel)', /body\.desktop \.f354-dstrip\{[^}]*overflow-y:hidden/.test(H));
ok('D3.3  .f354-dstrip min-height:58px (espaço garantido p/ o avatar+anel)', /body\.desktop \.f354-dstrip\{[^}]*min-height:58px/.test(H));
ok('D3.4  .f354-dstrip scrollbar-gutter:stable (não empurra/corta no scroll)', /body\.desktop \.f354-dstrip\{[^}]*scrollbar-gutter:stable/.test(H));
ok('D3.5  .f354-dstrip padding vertical corrigido (11px…13px)', /body\.desktop \.f354-dstrip\{[^}]*padding:11px 4px 13px/.test(H));
ok('D3.6  correção NÃO encolhe o avatar (avatar(d.u,22) preservado nos chips)', /avatar\(d\.u,22\)/.test(H));
ok('D3.7  correção NÃO usa margin negativo no strip', !/\.f354-dstrip[^}]*margin:-/.test(H) && !/\.f354-dchip[^}]*margin-top:-/.test(H));

/* ==================== D4 — SOCIAL MEDIAS (auto) ==================== */
console.log('\n-- D4: social medias (auto-render) --');
ok('D4.1  SOCIAL_SEL_KEY (persistência da última seleção por usuário)', /var SOCIAL_SEL_KEY='idseven\.socialSel\.v1';/.test(H));
ok('D4.2  f354SocialSelLoad / f354SocialSelSave definidos', /function f354SocialSelLoad\(uid\)\{/.test(H) && /function f354SocialSelSave\(uid,id\)\{/.test(H));
ok('D4.3  f354SocialAutoPick com ordem: salva → própria → 1ª (A→Z, determinística)', /function f354SocialAutoPick\(\)\{/.test(H) && /if\(saved&&sz\.some/.test(H) && /if\(me&&sz\.some/.test(H) && /return sz\[0\]\.u\.id;/.test(H));
ok('D4.4  f354SocialStrip(activeId) — faixa reutiliza .f354-dstrip (container corrigido)', /function f354SocialStrip\(activeId\)\{/.test(H) && /<div class="f354-dstrip">'/.test(H));
ok('D4.5  entrada [data-flowsocials] auto-renderiza (socialBoard=f354SocialAutoPick())', /\[data-flowsocials\]'\)\)\{[^}]*state\.socialBoard=f354SocialAutoPick\(\);/.test(H));
ok('D4.6  clique [data-socialboard] salva a seleção (f354SocialSelSave)', /\[data-socialboard\]'\)\)\{[^}]*f354SocialSelSave\(state\.user&&state\.user\.id,state\.socialBoard\);/.test(H));
ok('D4.7  ação "flowsocials" também usa auto-pick', /a==='flowsocials'\)\{state\.socialBoard=f354SocialAutoPick\(\);/.test(H));
ok('D4.8  auto-seleção é por ESTADO — sem element.click() sintético no auto-pick', !/f354SocialAutoPick[\s\S]{0,400}\.click\(\)/.test(H));
ok('D4.9  renderSocialBoard renderiza a faixa (f354SocialStrip(id))', /f354SocialStrip\(id\)\+boardToolbar\(\)/.test(H));
ok('D4.10 rótulo da aba é "Social Medias" (não "Social Midias")', /l:'Social Medias'/.test(H) && !/l:'Social Midias'/.test(H));
ok('D4.11 colunas renderizadas mesmo com 0 tarefas (kbv2BoardHtml sobre SOCIAL_COLS4)', /SOCIAL_COLS4/.test(H) && /function kbv2BoardHtml\(/.test(H));

/* ============================ RESULTADO ============================ */
console.log('\nRESULTADO F3.5.4W: ' + pass + ' PASS, ' + fail + ' FAIL');
if (fail) { console.log('::error:: F3.5.4W contrato vermelho: ' + flog.join(' | ')); process.exit(1); }
