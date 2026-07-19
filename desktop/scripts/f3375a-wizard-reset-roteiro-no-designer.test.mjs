#!/usr/bin/env node
/* =====================================================================
   F3.3.75A — Desktop: (1) "+ Nova tarefa" recomeça na ETAPA 1 (Setor);
   (2) Roteiro SEM Designer (Social→Cliente→Concluído). Cronograma preservado.
   Teste READ-ONLY sobre o renderer (regex de invariantes + extract-run das
   funções puras hasDesigner/newForm). NÃO builda, NÃO roda rede/Firestore.
   Modos:
     (padrão)            GREEN: candidata 75A (fix presente; bug ausente)
     SRC=<b6b800c>       + EXPECT=red: reproduz os bugs no baseline pré-patch
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRCPATH = process.env.SRC || path.resolve(__dirname, '..', 'src', 'renderer', 'index.html');
const EXPECT = process.env.EXPECT || 'green';
const H = fs.readFileSync(SRCPATH, 'utf8');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

// extrai o corpo de uma função por chaves balanceadas
function fnSrc(src, sig) {
  const st = src.indexOf(sig); if (st < 0) throw new Error('no ' + sig);
  let d = 0; for (let j = src.indexOf('{', st); j < src.length; j++) {
    const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(st, j + 1); }
  } throw new Error('unbalanced ' + sig);
}
// stub de secOf: devolve objeto de setor com .key (e descontinuado=false)
const secOf = (k) => ({ key: (k && k.key) || k || 'cronograma', descontinuado: false });
const hasDesigner = new Function('secOf', fnSrc(H, 'function hasDesigner(t)') + '\nreturn hasDesigner;')(secOf);
const newForm = new Function(fnSrc(H, 'function newForm(sector)') + '\nreturn newForm;')();

console.log(`F3.3.75A — wizard reset + roteiro no-designer (${EXPECT}) sobre ${path.basename(path.dirname(path.dirname(SRCPATH)))}`);

if (EXPECT === 'red') {
  console.log('— RED: bugs presentes no baseline (pré-patch) —');
  ok('RED1 FAB abre com o setor do board (openTaskForm(state.boardSector)) — pode pular Setor',
    /data-fab\]'\)\)\{closeModal\(\);if\(state\.tab==='tarefas'\)openTaskForm\(state\.boardSector\)/.test(H));
  ok('RED2 não existe função canônica openNewTaskWizard', !/function openNewTaskWizard\(/.test(H));
  ok('RED3 hasDesigner NÃO exclui roteiro (extract-run: roteiro c/ designer => true)',
    hasDesigner({ sector: 'roteiro', designerAssignment: { designerId: 'd1' } }) === true);
  ok('RED4 operationalCol sem ramo roteiro (nenhum "key===\'roteiro\'" antes de aguardando_envio)',
    !/F3\.3\.75A[\s\S]{0,400}return 'concluido'[\s\S]{0,80}aguardando_envio/.test(H) && !/roteiro'\)\{\s*if\(cf==='aprovado'\|\|cf==='reenviado'\)return 'concluido'/.test(H));
  ok('RED5 detailState roteiro-aprovado cai em senddesigner (sem guarda de roteiro)',
    /\(cc==='aprovado'\|\|cc==='producao'\)&&clientApproved\(t\)&&!isSentToDesigner\(t\)\)return \{key:'temas_aprovados'/.test(H) && !/secOf\(t\.sector\)\.key==='roteiro'\)\{[\s\S]*?actions:\['clientview'\]\};[\s\S]*?cliente_ajuste/.test(H));
  console.log(`\nred: PASS=${pass} FAIL=${fail}`); process.exit(fail ? 1 : 0);
}

// ===================== GREEN =====================
console.log('— BUG 1: wizard recomeça na ETAPA 1 (Setor) —');
ok('W1 newForm(null): step=0 (Setor) e sector=null', newForm(null).step === 0 && newForm(null).sector === null);
ok('W2 newForm zera título/cliente/responsável/conteúdos/checklist',
  (f => f.title === '' && f.client === '' && f.assigneeId === null && f.contents.length === 0 && f.checklist.length === 0 && f.id === null)(newForm(null)));
ok('W3 função canônica openNewTaskWizard existe', /function openNewTaskWizard\(\)\{/.test(H));
const onw = fnSrc(H, 'function openNewTaskWizard()');
ok('W4 openNewTaskWizard reseta state.form=newForm(null) (step 0, sem setor)', /state\.form=newForm\(null\)/.test(onw));
ok('W5 openNewTaskWizard força o render (solta foco + zera defer, contornando _editingNow)',
  /activeElement/.test(onw) && /\.blur\(\)/.test(onw) && /_deferRender=false/.test(onw) && /render\(\)/.test(onw));
ok('W6 FAB global usa openNewTaskWizard (não reaproveita boardSector)',
  /data-fab\]'\)\)\{state\.tab='tarefas';openNewTaskWizard\(\);return;\}/.test(H));
ok('W7 botão data-board="new" usa openNewTaskWizard', /a==='new'\)\{openNewTaskWizard\(\);return;\}/.test(H));
ok('W8 openTaskForm(sector) NÃO é mais chamado pelos entry points de criação (só a definição resta)',
  (H.match(/openTaskForm\(/g) || []).length === 1);
ok('W9 edição de tarefa existente permanece (caminho data-edit intacto)', /'edit'/.test(H) && /renderForm\(\)/.test(H));
ok('W10 renderForm ainda distingue Nova tarefa × Editar (f.id) e step Setor=0',
  /f\.id\?'Editar tarefa':'Nova tarefa'/.test(H) && /if\(f\.step===0\)h\+=stepSector\(\)/.test(H));

console.log('— BUG 2: Roteiro SEM Designer —');
ok('R1 hasDesigner exclui roteiro (extract-run)',
  hasDesigner({ sector: 'roteiro', designerAssignment: { designerId: 'd1' } }) === false);
ok('R2 hasDesigner PRESERVA cronograma (extract-run)',
  hasDesigner({ sector: 'cronograma', designerAssignment: { designerId: 'd1' } }) === true);
ok('R3 operationalCol tem ramo roteiro → concluido/afazer/producao (nunca aguardando_envio/designer)',
  /secOf\(t\.sector\)\.key==='roteiro'\)\{\s*if\(cf==='aprovado'\|\|cf==='reenviado'\)return 'concluido'/.test(H));
ok('R4 deriveCanonicalTaskState: roteiro + temas aprovados => COMPLETED (não THEMES_APPROVED)',
  /secOf\(t\.sector\)\.key==='roteiro'&&flowThemesApprovedSignal\(t\)\)return \{phase:TASK_PHASE\.COMPLETED/.test(H));
ok('R5 detailState: ramo roteiro dedicado (concluido/cliente_ajuste/aguardando/preparacao) sem designer',
  /secOf\(t\.sector\)\.key==='roteiro'\)\{[\s\S]{0,900}?actions:\['clientview'\]\}[\s\S]{0,900}?actions:\['fix','teamfix','clientview'\]/.test(H));
ok('R6 detailState roteiro NÃO inclui senddesigner (no bloco roteiro)',
  (fnSrc(H, 'function detailState(t)').match(/secOf\(t\.sector\)\.key==='roteiro'\)\{[\s\S]*?\n  \}/) || [''])[0].indexOf('senddesigner') < 0);
ok('R7 detailSla ignora roteiro (SLA Designer não renderiza; designerSla legado ignorado)',
  /function detailSla\(t\)\{\s*if\(secOf\(t\.sector\)\.key==='roteiro'\)return null;/.test(H));
ok('R8 wizard de criação de Roteiro já não oferece Responsável/Designer (isRoteiro?\'\')',
  /\(isRoteiro\?''\:\(/.test(H) || /isRoteiro\?'':\(/.test(H));

console.log('— PRESERVAÇÃO do Cronograma (designer intacto) —');
ok('C1 operationalCol do cronograma ainda roteia designer (aguardando_envio presente)',
  /if\(cf==='aprovado'\)return 'aguardando_envio'/.test(H));
ok('C2 detailState do cronograma ainda oferece senddesigner (temas_aprovados)',
  /return \{key:'temas_aprovados'[\s\S]{0,400}actions:\['senddesigner','clientview'\]/.test(H));
ok('C3 deriveCanonicalTaskState do cronograma ainda tem THEMES_APPROVED',
  /if\(flowThemesApprovedSignal\(t\)\)return \{phase:TASK_PHASE\.THEMES_APPROVED/.test(H));
ok('C4 openDesignerModal / fluxo do designer preservado (cronograma)', /function openDesignerModal\(/.test(H) && /data-senddesigner=/.test(H));
ok('C5 Cronograma em duas etapas (Worker) não é tocado por este patch — sem cloudflare-worker no diff (Desktop-only)',
  !/cloudflare-worker/.test(H));

console.log('— IDENTIDADE (auto-adaptável QA×produção) —');
const PKG = fs.readFileSync(path.resolve(path.dirname(SRCPATH), '..', '..', 'package.json'), 'utf8');
// auto-adaptável a QUALQUER versão QA (x.y.z-QA) × produção (x.y.z), p/ não repinar a cada fase.
const isQA = /"version": "\d+\.\d+\.\d+-QA"/.test(PKG);
const hasBanner = /AMBIENTE QA — NÃO USAR COM CLIENTES/.test(H);
if (isQA) {
  ok('Q1 (QA) banner "AMBIENTE QA — NÃO USAR COM CLIENTES" presente', hasBanner);
  ok('Q2 (QA) versão x.y.z-QA no package.json', /"version": "\d+\.\d+\.\d+-QA"/.test(PKG));
} else {
  // candidata de PRODUÇÃO: banner QA AUSENTE, versão sem sufixo -QA (em lugar nenhum).
  ok('Q1 (produção) banner "AMBIENTE QA" AUSENTE do renderer', !hasBanner);
  ok('Q2 (produção) versão sem -QA (package.json) e NENHUM sufixo -QA no renderer',
    /"version": "\d+\.\d+\.\d+"/.test(PKG) && !/\d+\.\d+\.\d+-QA/.test(H));
}

console.log(`\n${EXPECT}: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
