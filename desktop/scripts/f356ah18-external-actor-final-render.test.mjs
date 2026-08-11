#!/usr/bin/env node
/* =====================================================================================
 * F3.5.6A-H18 — RENDERIZAÇÃO DO ATOR EXTERNO NO MARCO FINAL (renderer REAL)
 *
 * Falha física da 1.0.243 (Cronograma Teste 6, DETALHES, tarefa CONCLUÍDA): o marco final
 * mostrava "…15:43 · há X" mas NÃO "por Cliente". CAUSA (auditoria H18): o RESOLVER
 * (taskTimeline) já produzia by="Cliente" desde a 1.0.242, mas o RENDERER (opPanelBlock)
 * resolvia m.by SÓ como UID de equipe (state.users.find) — "Cliente" é NOME literal externo,
 * não UID → a busca falhava e "por Cliente" era descartado. Os testes da H17 só checavam a
 * SAÍDA do resolver (by==='Cliente') e NUNCA renderizavam opPanelBlock — por isso ficaram
 * verdes com o físico vermelho. ESTA suíte RENDERIZA opPanelBlock(t) DE VERDADE.
 *
 * Correção 1.0.246 (RENDERER-only, index.html):
 *   C1 — taskTimeline marco 'concluido' emite byLabel SOMENTE p/ ator LITERAL externo
 *        (recordedBy vazio + clientFinalApprovedBy, ou clientReview.byName casado ao MESMO
 *        instante final); 'by' permanece IDÊNTICO à 1.0.243; NÃO infere label de UID.
 *   C2 — opPanelBlock: who = m.byLabel ? m.byLabel : (m.by ? nome-em-state.users : '');
 *        byLabel tem PRECEDÊNCIA; by segue como UID interno; UID desconhecido e SEM byLabel
 *        ⇒ vazio (NUNCA UID cru); byLabel escapado via esc(meta) (não entra cru no HTML).
 *
 * RED na 1.0.243 (F356AH18_SRC apontando p/ a base) → GREEN na 1.0.244.
 * Rodar: node desktop/scripts/f356ah18-external-actor-final-render.test.mjs
 *   RED base: F356AH18_SRC=<base>/index.html F356AH18_PKG=<base>/package.json node ...
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(process.env.F356AH18_SRC || path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(process.env.F356AH18_PKG || path.join(DESK, 'package.json'), 'utf8'));

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

function grabFn(SRC, name) {
  let a = SRC.indexOf('function ' + name + '(');
  if (a < 0) throw new Error('função não encontrada: ' + name);
  if (SRC.slice(Math.max(0, a - 6), a) === 'async ') a -= 6;
  let d = 0;
  for (let j = SRC.indexOf('{', a); j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(a, j + 1); } }
  throw new Error('sem fim: ' + name);
}
function grabDecl(SRC, marker) {
  const a = SRC.indexOf(marker);
  if (a < 0) throw new Error('decl não encontrada: ' + marker);
  let round = 0, sq = 0, cur = 0;
  for (let j = a + marker.length; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '(') round++; else if (c === ')') round--;
    else if (c === '[') sq++; else if (c === ']') sq--;
    else if (c === '{') cur++; else if (c === '}') cur--;
    else if (c === ';' && round === 0 && sq === 0 && cur === 0) return SRC.slice(a, j + 1);
  }
  throw new Error('decl sem ; : ' + marker);
}

let api = null, bootErr = null;
try {
  const SRC = [
    grabDecl(HTML, 'const SECTORS='), grabDecl(HTML, 'const SECTOR_ALIAS='), grabDecl(HTML, 'const STATUS='),
    grabDecl(HTML, 'const CLIENT_COLS='), grabDecl(HTML, 'const OPERATIONAL_COLS='), grabDecl(HTML, 'const TL_EVENT_LABELS='),
    grabDecl(HTML, 'const TASK_PHASE='), grabDecl(HTML, 'const FLOW_LABELS='),
    grabFn(HTML, 'esc'),                       // esc REAL (escaping) — NÃO stubbado
    grabFn(HTML, 'secOf'), grabFn(HTML, 'isClientSector'), grabFn(HTML, 'stOf'), grabFn(HTML, 'opColOf'), grabFn(HTML, 'clientStatusView'),
    grabFn(HTML, 'isTaskCompleted'), grabFn(HTML, 'isFullyComplete'), grabFn(HTML, 'hasDesigner'),
    grabFn(HTML, 'designerCol'), grabFn(HTML, 'designerDelivered'), grabFn(HTML, 'designerOf'), grabFn(HTML, 'socialOf'),
    grabFn(HTML, 'pendingLegend'), grabFn(HTML, 'pendingFeed'), grabFn(HTML, 'pendingStory'), grabFn(HTML, 'pendingProduction'),
    grabFn(HTML, 'clientApprovalPhaseOf'), grabFn(HTML, 'pendingClientItems'), grabFn(HTML, 'hasPendingItemRevision'),
    grabFn(HTML, 'allPhaseItemsApproved'), grabFn(HTML, 'clientApproved'), grabFn(HTML, 'hasTeamAdjustedAwaiting'),
    grabFn(HTML, 'isSentToDesigner'), grabFn(HTML, 'fmtDateTimeBR'),
    grabFn(HTML, 'flowCompletedSignal'), grabFn(HTML, 'flowSentToClientSignal'), grabFn(HTML, 'flowClientChangesSignal'),
    grabFn(HTML, 'flowThemesApprovedSignal'), grabFn(HTML, 'flowCanonicalSentSignal'), grabFn(HTML, 'flowThemesSentSignal'),
    grabFn(HTML, 'flowThemesReadySignal'),
    grabFn(HTML, 'wfRoundsOf'), grabFn(HTML, 'wfLatestRound'), grabFn(HTML, '_tlEventAt'), grabFn(HTML, '_tlRelAgo'), grabFn(HTML, '_tlHumanLabel'),
    grabFn(HTML, 'clientCol'), grabFn(HTML, 'operationalCol'), grabFn(HTML, 'nextActionText'), grabFn(HTML, 'nextActionShort'),
    grabFn(HTML, 'taskTimeline'), grabFn(HTML, 'detailState'),
    grabFn(HTML, 'opPanelBlock'),              // RENDERER REAL sob teste
  ].join('\n');
  // Preâmbulo: só ambiente. svg/withAlpha stubbados (saída não é asserida). esc é REAL (grabbed).
  const PRE = [
    'var __state={users:[],tasks:[],user:null,designerBoard:false};',
    'var state=__state;',
    'function svg(n,cls){return "";} ',
    'function withAlpha(c,a){return String(c||"");} ',
  ].join('\n');
  const RET = 'return {opPanelBlock:opPanelBlock,taskTimeline:taskTimeline,esc:esc,state:__state,'
    + 'setUsers:function(a){__state.users=a||[];}};';
  api = new Function(PRE + '\n' + SRC + '\n' + RET)();
} catch (e) { bootErr = e; }

if (!api) { console.log('================= F3.5.6A-H18 — ATOR EXTERNO (RENDERER REAL) ================='); console.log('BOOT FALHOU: ' + (bootErr && bootErr.message)); console.log('PASS ' + pass + ' | FAIL ' + (fail + 1) + '  (versão sob teste: ' + PKG.version + ')'); process.exit(1); }

const { opPanelBlock, taskTimeline, esc, setUsers } = api;

/* =========================== TEMPOS =========================== */
const FINAL_AT  = 1754847780000; // aprovação FINAL (o "15:43" do Teste 6)
const THEMES_AT = 1754818980000; // aprovação de TEMAS antiga/stale (o "09:33")
const T0        = 1754800000000; // createdAt

/* Fábrica de tarefa CONCLUÍDA (setor cliente) parametrizável pela FONTE do ator final. */
function mkConcluida(opts){
  opts = opts || {};
  const round = Object.assign({ type:'captions', decision:'approved', decisionAt:FINAL_AT }, opts.round || {});
  const t = {
    id:'T6', sector:'cronograma', status:'concluido',
    createdAt:T0,
    finalApprovalCompleted:true,
    clientFlowStatus:'concluido', clientWorkflowStage:'concluido',
    cronStatus:'aprovado_cliente',
    approvalRounds:{ ar_captions_r1: round },
  };
  if('clientFinalApprovedAt' in opts) t.clientFinalApprovedAt = opts.clientFinalApprovedAt; else t.clientFinalApprovedAt = FINAL_AT;
  if('clientFinalApprovedBy' in opts) { if(opts.clientFinalApprovedBy!==null) t.clientFinalApprovedBy = opts.clientFinalApprovedBy; } else t.clientFinalApprovedBy = 'Cliente';
  if(opts.clientReview) t.clientReview = opts.clientReview;
  return t;
}
function concluido(t){ const tl = taskTimeline(t); return tl.milestones.find(m=>m.key==='concluido'); }

/* =========================== PRECONDIÇÕES / IDENTIDADE =========================== */
ok('ID1 package.json = 1.0.246 + marcador H18', PKG.version === '1.0.246' && /f356ah18-external-actor-final-milestone-render/.test(PKG.description || ''));
ok('ID2 marcador H17 herdado preservado (postcompletion-write-guards)', /postcompletion-write-guards/.test(PKG.description || ''));
ok('ID3 marcadores herdados H16/H14/H12 + 1.0.228 preservados',
  /final-completed-precedence/.test(PKG.description||'') && /timeline-step7-final-wait/.test(PKG.description||'') &&
  /final-state-premature-fix/.test(PKG.description||'') && /1\.0\.228/.test(PKG.description||''));

/* =========================== GRUPO A — RED→GREEN PRINCIPAL (RENDERER REAL) =========================== */
setUsers([]); // state.users SEM usuário id='Cliente'
const tMain = mkConcluida({ round:{ recordedBy:'' }, clientReview:{ status:'aprovado', at:FINAL_AT, byName:'Cliente' } });
const hMain = opPanelBlock(tMain);
ok('A0 opPanelBlock retornou HTML não-vazio p/ setor cliente', typeof hMain === 'string' && hMain.length > 0);
// >>> A ASSERÇÃO QUE FALTAVA NA H17: o HTML RENDERIZADO contém "por Cliente" <<<
ok('A1 (RED 1.0.243 → GREEN 1.0.244) HTML de opPanelBlock CONTÉM "por Cliente"', hMain.includes('por Cliente'));
ok('A2 marco final tem byLabel="Cliente" (novo contrato do resolver)', concluido(tMain).byLabel === 'Cliente');
ok('A3 marco final PRESERVA by="Cliente" (idêntico à 1.0.243)', concluido(tMain).by === 'Cliente');
ok('A4 marco final PRESERVA at=FINAL_AT (timestamp intacto)', concluido(tMain).at === FINAL_AT);
ok('A5 marco final continua done', concluido(tMain).state === 'done' && concluido(tMain).done === true);

/* =========================== GRUPO B — REGRESSÕES DO ATOR (mandato do owner) =========================== */
// 1) ATOR EXTERNO via clientFinalApprovedBy (recordedBy vazio) → "por Cliente"
setUsers([]);
const tExt = mkConcluida({ round:{ recordedBy:'' } });
ok('B1 ator EXTERNO (clientFinalApprovedBy) → HTML tem "por Cliente"', opPanelBlock(tExt).includes('por Cliente'));
ok('B1b ator EXTERNO → byLabel="Cliente"', concluido(tExt).byLabel === 'Cliente');

// 2) ATOR INTERNO: recordedBy = UID resolvível em state.users → "por Arydyjany" (1º nome); byLabel=null
setUsers([{ id:'uid-ary', name:'Arydyjany Carlôto' }]);
const tInt = mkConcluida({ round:{ recordedBy:'uid-ary' } });
ok('B2 ator INTERNO (recordedBy UID) → byLabel=null (não é ator literal externo)', concluido(tInt).byLabel === null);
ok('B2b ator INTERNO → by=UID preservado', concluido(tInt).by === 'uid-ary');
ok('B2c ator INTERNO → HTML resolve nome da equipe "por Arydyjany"', opPanelBlock(tInt).includes('por Arydyjany'));
ok('B2d ator INTERNO → HTML NÃO imprime o UID cru', !opPanelBlock(tInt).includes('uid-ary'));

// 3) UID INTERNO DESCONHECIDO (não está em state.users) e SEM byLabel → ator VAZIO, NUNCA UID cru
setUsers([]); // vazio: uid-ghost não existe
const tGhost = mkConcluida({ round:{ recordedBy:'uid-ghost' } });
const hGhost = opPanelBlock(tGhost);
ok('B3 UID desconhecido → byLabel=null', concluido(tGhost).byLabel === null);
ok('B3b UID desconhecido → HTML NÃO contém "por " (ator vazio)', !hGhost.includes('por '));
ok('B3c UID desconhecido → HTML NUNCA imprime o UID cru', !hGhost.includes('uid-ghost'));

// 4a) THEMES NÃO VAZA (realista): FINAL via clientFinalApprovedBy@15:43 + clientReview STALE dos TEMAS@09:33
setUsers([]);
const tThemesA = mkConcluida({ round:{ recordedBy:'' }, clientReview:{ status:'aprovado', at:THEMES_AT, byName:'ClienteThemes' } });
ok('B4a THEMES stale NÃO vira ator final → byLabel="Cliente" (da aprovação FINAL)', concluido(tThemesA).byLabel === 'Cliente');
ok('B4a2 THEMES stale → at é o FINAL (15:43), não 09:33', concluido(tThemesA).at === FINAL_AT);
ok('B4a3 THEMES stale → HTML NÃO contém "ClienteThemes"', !opPanelBlock(tThemesA).includes('ClienteThemes'));

// 4b) GUARDA TEMPORAL do fallback H17: sem clientFinalApprovedBy/recordedBy, só clientReview STALE (at≠FINAL)
setUsers([]);
const tThemesB = mkConcluida({ round:{ recordedBy:'' }, clientFinalApprovedBy:null, clientReview:{ status:'aprovado', at:THEMES_AT, byName:'ClienteThemes' } });
ok('B4b fallback bloqueado por at≠FINAL → byLabel=null (não adota o clientReview dos TEMAS)', concluido(tThemesB).byLabel === null);
ok('B4b2 fallback bloqueado → HTML NÃO contém "ClienteThemes"', !opPanelBlock(tThemesB).includes('ClienteThemes'));

// 5) TIMESTAMP preservado exatamente (todas as fontes = mesmo FINAL_AT)
setUsers([]);
ok('B5 timestamp do marco final == FINAL_AT (não alterado pela correção do ator)', concluido(mkConcluida({round:{recordedBy:''}})).at === FINAL_AT);

// 6) ESCAPING: byLabel com caracteres HTML especiais deve sair ESCAPADO, nunca como markup
setUsers([]);
const XSS = "<script>alert(1)</script>"; // sem espaços: sobrevive a who.split(' ')[0]
const tXss = mkConcluida({ round:{ recordedBy:'' }, clientFinalApprovedBy: XSS });
const hXss = opPanelBlock(tXss);
ok('B6 escaping → byLabel="'+XSS+'" propagado ao marco (byLabel bruto no objeto)', concluido(tXss).byLabel === XSS);
ok('B6b escaping → HTML contém a forma ESCAPADA (&lt;script&gt;)', hXss.includes('&lt;script&gt;'));
ok('B6c escaping → HTML NÃO contém o markup CRU (<script>alert(1))', !hXss.includes('<script>alert(1)'));
ok('B6d escaping → esc() real está no boot (não é passthrough)', esc('<x>') === '&lt;x&gt;');

/* =========================== GRUPO C — ESTÁTICOS (contrato p/ o gate app.asar) =========================== */
ok('S1 taskTimeline: bloco concluido classifica proveniência (_fext)', /_fext/.test(HTML) && /var _cr=wfLatestRound\(t,'captions'\)/.test(HTML));
ok('S2 taskTimeline: só ator LITERAL externo vira byLabel (recordedBy interno NÃO)',
  /if\(_crr\.recordedBy\)\{ _fby=_crr\.recordedBy; _fext=false; \}/.test(HTML) &&
  /else if\(t\.clientFinalApprovedBy\)\{ _fby=t\.clientFinalApprovedBy; _fext=true; \}/.test(HTML));
ok('S3 taskTimeline: byLabel setado só quando _fext&&_fby', /if\(_fext&&_fby\) byLabel=_fby;/.test(HTML));
ok('S4 taskTimeline: marco retorna byLabel', /by:by,byLabel:byLabel\}/.test(HTML));
ok('S5 renderer: byLabel tem PRECEDÊNCIA e by segue como UID', /const who=m\.byLabel\?m\.byLabel:\(m\.by\?\(\(state\.users\.find\(u=>u\.id===m\.by\)\|\|\{\}\)\.name\|\|''\):''\);/.test(HTML));
ok('S6 renderer: byLabel escapado via esc(meta) (não entra cru no HTML)', /<div class="det-tl-meta">'\+esc\(meta\)\+'<\/div>/.test(HTML));
ok('S7 fallback H17 (identidade temporal do clientReview) PRESERVADO', /Number\(t\.clientReview\.at\)===Number\(_fat\)/.test(HTML));
// Congelados: a correção é renderer-only e NÃO toca guardas/predicados H16/H17
ok('S8 isTaskCompleted/isFullyComplete presentes (não removidos)', /function isTaskCompleted\(/.test(HTML) && /function isFullyComplete\(/.test(HTML));
ok('S9 slaRules.js não é tema desta fase (marcador 1.0.228 herdado na descrição)', /1\.0\.228/.test(PKG.description||''));

/* =========================== RESULTADO =========================== */
console.log('================= F3.5.6A-H18 — ATOR EXTERNO (RENDERER REAL) =================');
if (flog.length) console.log(flog.join('\n'));
console.log('PASS ' + pass + ' | FAIL ' + fail + '  (versão sob teste: ' + PKG.version + ')');
process.exit(fail ? 1 : 0);
