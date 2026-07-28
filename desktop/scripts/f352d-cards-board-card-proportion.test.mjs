#!/usr/bin/env node
/* ============================================================================
 * F3.5.2D — Edição de Cards: PROPORÇÃO e ALINHAMENTO de QUADRO e CARD (Desktop 1.0.191)
 * ----------------------------------------------------------------------------
 * A 1.0.190 (F3.5.2B+F3.5.2C) deixara o quadro do setor com COLUNAS CURTAS e o CARD CURTO/solto no
 * topo (vão vazio abaixo). Causa exata: os overrides
 *   F3.5.2B  .kbv2-card--cards:only-child{ flex:0 0 auto } + margin-top:0   (card sem esticar)
 *   F3.5.2C  .kbv2-board--cards{ align-items:flex-start } + .kbv2-column-body{ flex:0 0 auto }  (coluna curta)
 * F3.5.2D REMOVE ambos e faz "Edição de Cards" REUTILIZAR o contrato canônico do Cronograma/Designer:
 *   coluna preenche a altura (PROD1.6) + card único ESTICA (flex:1 1 auto) + a caixa .kbv2-card-notes
 *   (Legenda/Observações) assume o MESMO papel elástico do .kbv2-card-themes (bloco central que absorve a
 *   sobra e entra no respiro via margin-top:auto). Rodapé/botões/"Adicionar tarefa" no local canônico.
 * cardsRules/slaRules/main/notifier/tray/bgNotify/updaterService/firebase/slaScheduler + Card Premium +
 * movimentação bidirecional (isDesignerAxisMove/designerMoveOpts/moveStatus) + cardsFieldOf: BYTE-IDÊNTICOS a 1.0.190.
 * Base: Desktop 1.0.190 · tag v1.0.190 · commit f8e0184. Uso: node scripts/f352d-…test.mjs
 * ==========================================================================*/
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..'); const REPO = resolve(ROOT, '..');
const BASE = 'f8e01846fbdeed9c66604fe152031fadae5152c0';          // 1.0.190
const gitShow = (rel) => execSync(`git show ${BASE}:${rel}`, { cwd: REPO, maxBuffer: 1 << 30 }).toString();
let PASS=0, FAIL=0; const fails=[];
const ok=(c,m)=>{ if(c) PASS++; else { FAIL++; fails.push(m); console.error('  ✗ '+m); } };
const eq=(a,b,m)=>ok(a===b,m);
const SRC=readFileSync(resolve(ROOT,'src/renderer/index.html'),'utf8');
const BASESRC=gitShow('desktop/src/renderer/index.html');
const grab=(src,name)=>{ const re=new RegExp('function\\s+'+name+'\\s*\\('); const m=re.exec(src); if(!m) return null;
  let i=src.indexOf('{',m.index),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(m.index,j); };
console.log('F3.5.2D — proporção/alinhamento de quadro e card (edicao_cards) — testes\n');

/* ═══ 0) PROVA MESTRA — remoção dos overrides F3.5.2B/C + isolamento do diff ═══ */
ok(!/\.kbv2-column-body>\.kbv2-card\.kbv2-card--cards:only-child\{\s*flex:0 0 auto;\s*\}/.test(SRC), '0a. override F3.5.2B (card--cards:only-child flex:0 0 auto) REMOVIDO');
ok(!/\.kbv2-board\.kbv2-board--cards\{\s*align-items:flex-start;\s*\}/.test(SRC), '0b. override F3.5.2C (.kbv2-board--cards align-items:flex-start) REMOVIDO');
ok(!/\.kbv2-board\.kbv2-board--cards \.kbv2-column-body\{\s*flex:0 0 auto;\s*\}/.test(SRC), '0c. override F3.5.2C (.kbv2-board--cards .kbv2-column-body flex:0 0 auto) REMOVIDO');
ok(!SRC.includes("'<div class=\"kbv2-board kbv2-board--cards\">'"), '0d. injeção .kbv2-board--cards em renderBoard REMOVIDA');
ok(!/class="kbv2-board[^"]*kbv2-board--cards/.test(SRC) && (SRC.match(/kbv2-board--cards/g)||[]).every(()=>true), '0e. classe .kbv2-board--cards não é mais aplicada (só citada em comentário)');
{ const nonComment = SRC.split('\n').filter(l=>!/^\s*\/\*|^\s*\*|\*\//.test(l)&&!/F3\.5\.2[BCD]/.test(l)).join('\n');
  ok(!nonComment.includes('kbv2-board--cards'), '0f. nenhuma referência FUNCIONAL a .kbv2-board--cards (apenas comentários)'); }
eq(execSync(`git diff --name-only ${BASE} -- . ':!desktop'`,{cwd:REPO}).toString().trim(),'','0g. NENHUM arquivo fora de desktop/ mudou (Android/Worker/Functions/Rules)');
{ const files=execSync(`git diff --name-only ${BASE} -- desktop ':!desktop/scripts'`,{cwd:REPO}).toString().trim().split('\n').sort();
  eq(JSON.stringify(files), JSON.stringify(['desktop/package-lock.json','desktop/package.json','desktop/src/renderer/index.html']), '0h. diff (fora de scripts) só toca index.html + versão'); }

/* ═══ 1) QUADRO — colunas preenchem a altura (contrato canônico do Designer) ═══ */
ok(SRC.includes('body.desktop .kbv2-column-body{ flex:1 1 auto;'), '1a. .kbv2-column-body canônico (flex:1 1 auto) preservado — coluna preenche a altura');
ok(SRC.includes('body.desktop .kbv2-column-body>.kbv2-card:only-child{ flex:1 1 auto; min-height:0; }'), '1b. PROD1.6 card único ESTICA (flex:1 1 auto) — vale p/ edicao_cards também');
eq(grab(SRC,'kbv2BoardHtml'), grab(BASESRC,'kbv2BoardHtml'), '1c. kbv2BoardHtml BYTE-IDÊNTICO a 1.0.190 (quadro canônico)');
ok(SRC.includes("h+=kbv2BoardHtml(STATUS.map((st,i)=>({label:st.label,color:st.color,key:st.key,tasks:byStatus[i]})));"), '1d. renderBoard emite o quadro CANÔNICO (sem classe especial de setor)');
ok(BASESRC.includes('kbv2-board kbv2-board--cards'), '1e. sanidade: a base 1.0.190 TINHA o quadro especial (removido agora)');

/* ═══ 2) CARD — .kbv2-card-notes = contrato elástico do .kbv2-card-themes ═══ */
ok(/body\.desktop \.kbv2-card>\.kbv2-card-notes\{[^}]*flex:0 1 auto[^}]*min-height:0/.test(SRC), '2a. .kbv2-card-notes é elástico (flex:0 1 auto; min-height:0) como .kbv2-card-themes');
ok(/\.kbv2-column-body>\.kbv2-card:only-child>\.kbv2-card-notes,/.test(SRC), '2b. .kbv2-card-notes entra no respiro (margin-top:auto) como themes/origin/footer');
ok(SRC.includes('body.desktop .kbv2-card>.kbv2-card-themes{ flex:0 1 auto; min-height:0;'), '2c. contrato do .kbv2-card-themes (Cronograma) PRESERVADO — modelo reutilizado');
{ const kb=grab(SRC,'kbv2Card');
  ok(kb.includes('<div class="kbv2-card-notes">'), '2d. kbv2Card envolve Legenda/Obs em .kbv2-card-notes');
  ok(kb.includes('if(_cl||_co){'), '2e. caixa .kbv2-card-notes só é criada quando há Legenda e/ou Observações');
  ok(kb.includes("cardsFieldOf(t,'legenda')") && kb.includes("cardsFieldOf(t,'obs')"), '2f. usa campos canônicos cardsFieldOf (sem duplicar Firestore)');
  // ordem preservada: chips → notes → rail/etapa
  ok(kb.indexOf('kbv2-card-chips') < kb.indexOf('kbv2-card-notes') && kb.indexOf('kbv2-card-notes') < kb.indexOf('kbv2-card-rail'),
     '2g. ordem preservada: setor → Legenda/Obs → progresso/etapa'); }
eq(grab(SRC,'cardsFieldOf'), grab(BASESRC,'cardsFieldOf'), '2h. cardsFieldOf BYTE-IDÊNTICO a 1.0.190 (Tema/Legenda/Obs + fallback)');
ok(SRC.includes('<div class="det-sec">Briefing</div><div class="det-desc">'+"'+esc(t.desc)+'"), '2i. conteúdo completo (Legenda/Obs via desc) em Detalhes — inalterado');
ok(/\.kbv2-card-note \.kbv2-note-v\{[^}]*-webkit-line-clamp:2/.test(SRC), '2j. prévia de Legenda/Obs 2 linhas preservada (clamp)');
ok(/\.kbv2-card\.kbv2-card--cards \.kbv2-title\{[^}]*-webkit-line-clamp:2/.test(SRC), '2k. Tema (título) 2 linhas preservado (clamp)');

/* ═══ 3) OUTROS SETORES — contrato de themes/colunas intocado ═══ */
ok(SRC.includes('body.desktop .kbv2-column-body>.kbv2-card:only-child>.kbv2-card-origin,') &&
   SRC.includes('body.desktop .kbv2-column-body>.kbv2-card:only-child>.kbv2-card-themes,'), '3a. respiro PROD1.6 (origin/themes/footer) preservado p/ todos os setores');
ok(SRC.includes('body.desktop .kbv2-card>*{ flex:0 0 auto; }'), '3b. CARD-FIT-NOTEBOOK base preservado');
ok(SRC.includes('body.desktop .kbv2-card-themes>.kbv2-themes-list{ flex:1 1 auto; min-height:0; overflow-y:auto;'), '3c. lista de temas (Cronograma) elástica preservada');
{ const kbCardBlock=s=>{const i=s.indexOf('body.desktop .kbv2-card{'); return s.slice(i,s.indexOf('}',i)+1);};
  eq(kbCardBlock(SRC), kbCardBlock(BASESRC), '3d. bloco base .kbv2-card{…} BYTE-IDÊNTICO a 1.0.190'); }

/* ═══ 4) MOVIMENTAÇÃO — preservação byte a byte (1.0.190) ═══ */
for(const fn of ['isDesignerAxisMove','designerMoveOpts','moveStatus','designerCol','isDesignerFlow'])
  eq(grab(SRC,fn), grab(BASESRC,fn), '4. movimentação '+fn+' BYTE-IDÊNTICA a 1.0.190');

/* ═══ 5) NOTIFICAÇÕES — módulos byte-idênticos ═══ */
for(const f of ['cardsRules.js','slaRules.js','main.ts','notifier.ts','tray.ts','bgNotify.ts','slaScheduler.ts','firebase.ts','updaterService.ts'])
  ok((()=>{try{return readFileSync(resolve(ROOT,'src/main/'+f),'utf8')===gitShow('desktop/src/main/'+f);}catch(_){return false;}})(), '5. congelado '+f+' BYTE-IDÊNTICO a 1.0.190');
{ const cardsRules=require(resolve(ROOT,'src/main/cardsRules.js'));
  eq(cardsRules.CARDS_WARN_MS,30*60000,'5x. T-30 preservado'); eq(cardsRules.CARDS_RED_MS,10*60000,'5y. T-10 preservado'); }

/* ═══ 6) CARD PREMIUM + PRESERVAÇÃO ═══ */
for(const fn of ['isClientSector','ensureReviewToken','ensureStableClientReviewToken','buildShareClientUrl','buildClientMessage','canSendToClient','openSendClientModal'])
  eq(grab(SRC,fn), grab(BASESRC,fn), '6. Card Premium '+fn+' BYTE-IDÊNTICO a 1.0.190');
eq(JSON.parse(readFileSync(resolve(ROOT,'package.json'),'utf8')).version,'1.0.191','6v. package.json version == 1.0.191');
eq(JSON.parse(readFileSync(resolve(ROOT,'package-lock.json'),'utf8')).version,'1.0.191','6w. package-lock version == 1.0.191');

console.log('\nF3.5.2D — PASS='+PASS+' FAIL='+FAIL);
if(FAIL){ console.log('\nFALHAS:'); for(const f of fails) console.log(' - '+f); process.exit(1); }
console.log('F3.5.2D — TODOS OS TESTES VERDES ✓');
