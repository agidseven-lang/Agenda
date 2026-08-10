#!/usr/bin/env node
/* =====================================================================================
 * F3.5.6A-H15 — "PRÓXIMA AÇÃO" da caixa OPERAÇÃO após o ENVIO FINAL real.
 *
 * Defeito (1.0.240): nextActionText(t) case 'aguardando_final' retornava texto LEGADO
 *   "Tudo pronto. Próxima etapa: reenviar ao cliente e aguardar a aprovação final."
 * Isso é semanticamente incorreto: operationalCol(t)==='aguardando_final' SÓ ocorre DEPOIS
 * de flowSentToClientSignal(t)===true (o envio final JÁ aconteceu). A cópia induzia a Social
 * a "reenviar ao cliente" (risco de mensagem duplicada no WhatsApp). Os cards (nextActionShort),
 * o HERO dos Detalhes (detailState) e o quadro Cliente (clientFacingNextShort) JÁ estavam corretos.
 *
 * Correção 1.0.241 (RENDERER-only, index.html, TEXTUAL — 1 linha; SEM mudar condição/lógica):
 *   case 'aguardando_final': return 'Envio final confirmado. Próxima etapa: aguardar a aprovação final do cliente.';
 *
 * RED na base 1.0.240 (b40259a); GREEN na 1.0.241.
 * Rodar: node desktop/scripts/f356ah15-nextaction-final-text.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(process.env.F356AH15_SRC || path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(process.env.F356AH15_PKG || path.join(DESK, 'package.json'), 'utf8'));
const LOCK = JSON.parse(fs.readFileSync(path.join(DESK, 'package-lock.json'), 'utf8'));

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

function grabFn(SRC, name) {
  const a = SRC.indexOf('function ' + name + '(');
  if (a < 0) throw new Error('função não encontrada: ' + name);
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
    grabFn(HTML, 'secOf'), grabFn(HTML, 'isClientSector'), grabFn(HTML, 'stOf'), grabFn(HTML, 'opColOf'),
    grabFn(HTML, 'isTaskCompleted'), grabFn(HTML, 'isFullyComplete'), grabFn(HTML, 'hasDesigner'),
    grabFn(HTML, 'designerCol'), grabFn(HTML, 'designerDelivered'), grabFn(HTML, 'designerOf'), grabFn(HTML, 'socialOf'),
    grabFn(HTML, 'pendingLegend'), grabFn(HTML, 'pendingFeed'), grabFn(HTML, 'pendingStory'), grabFn(HTML, 'pendingProduction'),
    grabFn(HTML, 'clientApprovalPhaseOf'), grabFn(HTML, 'pendingClientItems'), grabFn(HTML, 'hasPendingItemRevision'),
    grabFn(HTML, 'allPhaseItemsApproved'), grabFn(HTML, 'clientApproved'),
    grabFn(HTML, 'flowCompletedSignal'), grabFn(HTML, 'flowSentToClientSignal'), grabFn(HTML, 'flowClientChangesSignal'),
    grabFn(HTML, 'flowThemesApprovedSignal'), grabFn(HTML, 'flowCanonicalSentSignal'), grabFn(HTML, 'flowThemesSentSignal'),
    grabFn(HTML, 'flowThemesReadySignal'),
    grabFn(HTML, 'clientCol'), grabFn(HTML, 'operationalCol'), grabFn(HTML, 'nextActionText'), grabFn(HTML, 'nextActionShort'),
  ].join('\n');
  const RET = 'return {operationalCol:operationalCol,nextActionText:nextActionText,nextActionShort:nextActionShort,flowSentToClientSignal:flowSentToClientSignal};';
  api = new Function('var state={users:[]};\n' + SRC + '\n' + RET)();
} catch (e) { bootErr = e; }

if (!api) { console.log('================= F3.5.6A-H15 — PRÓXIMA AÇÃO / ESPERA FINAL ================='); console.log('BOOT FALHOU: ' + (bootErr && bootErr.message)); console.log('PASS ' + pass + ' | FAIL ' + (fail + 1) + '  (versão sob teste: ' + PKG.version + ')'); process.exit(1); }

/* =========================== EXPECTATIVAS =========================== */
const NEW = 'Envio final confirmado. Próxima etapa: aguardar a aprovação final do cliente.';
const OLD = 'Tudo pronto. Próxima etapa: reenviar ao cliente e aguardar a aprovação final.';

/* =========================== FIXTURES (Cronograma Teste 6) =========================== */
const T0838 = 1754818680000; // envio inicial THEMES ~08:38
const T1135 = 1754829300000; // ação da 2ª rodada ~11:35
const T1331 = 1754836860000; // envio FINAL real ~13:31

// Estado antes do envio final (captions_preparation): designer entregou; pendingProduction=TRUE (2º item vazio).
function prep() {
  return {
    id: 'CT6', sector: 'cronograma', client: 'CLIENTE TESTE', createdAt: 1754800000000,
    workflowPhase: 'captions_preparation',
    clientFlowStatus: 'producao', clientWorkflowStage: 'producao',
    cronStatus: 'ready_for_final_client_review', clientApprovalPhase: 'final', finalApprovalRequired: true,
    designerAssignment: { designerId: 'd1' }, designerFlowStatus: 'concluido',
    cronContents: [{ tema: 'T1', legenda: 'Legenda teste 1', feedImageUrl: '' }, { tema: 'T2', legenda: '', feedImageUrl: '' }],
    clientSentAt: T0838,
    approvalRounds: { ar_themes_r1: { sentAt: T0838, by: 'Social', decision: 'approved' } },
    history: [
      { type: 'cronograma_enviado_cliente', label: 'Cronograma enviado ao cliente (aprovação de TEMAS)', at: T0838, by: 'Arydyjany', channel: 'whatsapp_fallback', phase: 'themes' },
      { type: 'social_producao', label: 'Social atualizou legendas/artes', at: T1135 - 1000, by: 'Arydyjany', channel: 'production' }
    ]
  };
}
// Envio final REAL confirmado — via EIXO DO DESIGNER (dc==='concluido' && flowSentToClientSignal). cf='producao'.
function sentReal() {
  const t = prep();
  t.workflowPhase = 'captions_waiting_client';
  t.approvalRounds.ar_captions_r1 = { sentAt: T1331, by: 'Arydyjany' };
  t.history.push({ type: 'reenviado_cliente', label: 'Reenviado ao cliente (versão FINAL)', at: T1331, by: 'Arydyjany', channel: 'final_review', phase: 'final' });
  return t;
}
// Envio final REAL confirmado — via EIXO DO CLIENTE (cf==='reenviado' && flowSentToClientSignal).
// Espelha o físico do Teste 6: "Fluxo do cliente = Reenviado ao cliente".
function sentRealReenviado() {
  const t = sentReal();
  t.clientFlowStatus = 'reenviado';
  return t;
}

/* =========================== PRECONDIÇÕES (estado alcançado) =========================== */
ok('P0 boot OK', !!api);
ok('P1 operationalCol(sentReal)==="aguardando_final" (eixo designer 6684; flowSentToClientSignal=true)', api.operationalCol(sentReal()) === 'aguardando_final');
ok('P2 operationalCol(sentRealReenviado)==="aguardando_final" (eixo cliente 6679; cf=reenviado)', api.operationalCol(sentRealReenviado()) === 'aguardando_final');
ok('P3 flowSentToClientSignal(sentReal)===true (envio final já aconteceu)', api.flowSentToClientSignal(sentReal()) === true);

/* =========================== MAIN — nextActionText corrigido (RED na 240 → GREEN na 241) =========================== */
const nA = api.nextActionText(sentReal());
const nB = api.nextActionText(sentRealReenviado());
ok('MAIN1 nextActionText(sentReal) === texto NOVO exato', nA === NEW);
ok('MAIN2 nextActionText(sentRealReenviado) === texto NOVO exato (mesmo texto nos 2 eixos)', nB === NEW);
ok('MAIN3 nextActionText(sentReal) NÃO contém "reenviar ao cliente"', !/reenviar ao cliente/.test(nA));
ok('MAIN4 nextActionText(sentReal) NÃO contém "Tudo pronto" (prefixo legado)', !/Tudo pronto/.test(nA));
ok('MAIN5 nextActionText(sentReal) deixa claro que o envio já ocorreu ("Envio final confirmado")', /Envio final confirmado/.test(nA));
ok('MAIN6 nextActionText(sentReal) orienta esperar o cliente ("aguardar a aprovação final do cliente")', /aguardar a aprovação final do cliente/.test(nA));

/* =========================== INVARIANTES — superfícies que JÁ estavam corretas =========================== */
ok('UNCH1 nextActionShort(sentReal) continua "Aguardar aprovação final"', api.nextActionShort(sentReal()) === 'Aguardar aprovação final');
ok('UNCH2 nextActionShort(sentRealReenviado) continua "Aguardar aprovação final"', api.nextActionShort(sentRealReenviado()) === 'Aguardar aprovação final');

/* =========================== ESTÁTICOS — isolamento cirúrgico (só a string do case mudou) =========================== */
const S_NAT = grabFn(HTML, 'nextActionText');
const S_NAS = grabFn(HTML, 'nextActionShort');
const S_OP = grabFn(HTML, 'operationalCol');
const S_FS = grabFn(HTML, 'flowSentToClientSignal');
ok('S1 HTML contém a string NOVA (nextActionText)', HTML.includes(NEW));
ok('S2 HTML NÃO contém mais a string LEGADA', !HTML.includes(OLD));
ok('S3 nextActionText mantém o case canônico (condição intocada)', S_NAT.includes("case 'aguardando_final':") && S_NAT.includes(NEW) && !S_NAT.includes(OLD));
// Demais cases de nextActionText byte-idênticos (nenhum outro texto alterado):
ok('S4 case producao intacto', S_NAT.includes("case 'producao':            return 'Enviado ao cliente. Próxima etapa: aguardar o feedback do cliente sobre os temas.';"));
ok('S5 case aguardando_legenda intacto', S_NAT.includes("case 'aguardando_legenda':  return 'Designer entregou. Próxima etapa: revisar, adicionar legenda e posts (Feed/Story).';"));
ok('S6 case aguardando_revisao intacto (contém "reenviar pelo mesmo link", NÃO tocado)', S_NAT.includes("case 'aguardando_revisao':  return 'Cliente pediu ajuste. Próxima etapa: corrigir o conteúdo e reenviar pelo mesmo link.';"));
ok('S7 case concluido intacto', S_NAT.includes("case 'concluido':           return 'Aprovação final concluída. Tarefa encerrada operacionalmente.';"));
ok('S8 nextActionShort case aguardando_final intacto', S_NAS.includes("case 'aguardando_final':            return 'Aguardar aprovação final';"));
// operationalCol: condições que geram 'aguardando_final' inalteradas (lógica NÃO tocada):
ok('S9 operationalCol eixo cliente inalterado', S_OP.includes("if(cf==='reenviado'&&flowSentToClientSignal(t))return 'aguardando_final';"));
ok('S10 operationalCol eixo designer inalterado', S_OP.includes("if(dc==='concluido')return flowSentToClientSignal(t)?'aguardando_final':'aguardando_legenda';"));
// flowSentToClientSignal: gatilho canônico inalterado:
ok('S11 flowSentToClientSignal ainda reconhece captions_waiting_client', S_FS.includes('captions_waiting_client'));
// detailState (HERO) e clientFacingNextShort (quadro cliente) — textos corretos preservados byte a byte:
ok('S12 detailState HERO preservado ("Aguardar o cliente aprovar a versão final no portal.")', HTML.includes("next:'Aguardar o cliente aprovar a versão final no portal.'"));
ok('S13 clientFacingNextShort preservado ("Aguardar a aprovação final do cliente")', HTML.includes("case 'final':     return 'Aguardar a aprovação final do cliente';"));
// H14 (timeline) preservada byte a byte:
ok('S14 H14 step7 preservado (done:!!(prodOk||resent))', HTML.includes("key:'aguardando_legenda',label:'Aguardando legenda / posts',    done:!!(prodOk||resent),"));
ok('S15 H14 rótulo contextual do marco final preservado', HTML.includes("if(m.key==='concluido'&&state==='current') dispLabel='Aguardando aprovação final';"));

/* =========================== IDENTIDADE =========================== */
ok('ID1 package.json = 1.0.241 + marcador H15', PKG.version === '1.0.241' && /nextaction-final-wait-text/.test(PKG.description || ''));
ok('ID2 package-lock 1.0.241 (raiz + packages[""])', LOCK.version === '1.0.241' && LOCK.packages[''].version === '1.0.241');
ok('ID3 marcadores herdados H14/H13/H12 preservados', /timeline-step7-final-wait/.test(PKG.description || '') && /timeline-honest-preenvio/.test(PKG.description || '') && /final-state-premature-fix/.test(PKG.description || ''));

console.log('================= F3.5.6A-H15 — PRÓXIMA AÇÃO / ESPERA FINAL =================');
flog.forEach(l => console.log(l));
console.log('PASS ' + pass + ' | FAIL ' + fail + '  (versão sob teste: ' + PKG.version + ')');
process.exit(fail ? 1 : 0);
