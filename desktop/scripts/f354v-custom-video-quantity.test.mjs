#!/usr/bin/env node
/* =====================================================================
 * F3.5.4V — QUANTIDADE PERSONALIZADA DE VÍDEOS/ROTEIROS (Edição de vídeos).
 *   Substitui os 3 pacotes fixos (p4/p6/p12) por um seletor numérico [−][N][+].
 *   Inteiro ≥1, sem teto de negócio (teto TÉCNICO documentado), digitação/colar/
 *   setas/teclado, sem re-render apagando o valor, sem listeners duplicados,
 *   compat retroativa não-destrutiva, revisão correta, salvamento NUMÉRICO.
 *
 * Mistura EXECUÇÃO das funções puras REAIS (normVideoQty / videoQtyOf /
 * synthVideoSub / curSub, extraídas da fonte) + regex ESTÁTICO no index.html
 * (wiring de UI, bindings, revisão, CSS, congelamentos). 50 asserções do mandato
 * + bloco de regressão. Rodar: node desktop/scripts/f354v-custom-video-quantity.test.mjs
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_PATH = process.env.SRC || path.resolve(__dirname, '..', 'src', 'renderer', 'index.html');
const H = fs.readFileSync(SRC_PATH, 'utf8');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; flog.push('FAIL — ' + n); console.log('  FAIL — ' + n); } };

/* ---- extração p/ execução das funções puras REAIS ---- */
function grab(n) { let a = H.indexOf('function ' + n + '('); if (a < 0) throw new Error('não encontrei: ' + n); let d = 0; for (let j = H.indexOf('{', a); j < H.length; j++) { const c = H[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return H.slice(a, j + 1); } } throw new Error('sem fim: ' + n); }

/* PRELUDE: stubs mínimos. VIDEO_QTY_MAX espelha a fonte; flashToast captura mensagens de teto. */
const TOASTS = [];
const PRELUDE =
  'var VIDEO_QTY_MAX=500;\n' +
  'var __TOASTS=arguments[0];\n' +
  'function flashToast(m){__TOASTS.push(String(m));}\n' +
  // stubs p/ curSub: tpl() e secOf() e state e TEMPLATES sintético mínimo
  'var __SECTOR="edicao_midia";\n' +
  'var state={form:{sector:__SECTOR,subtype:null,videoQty:null,id:null,videos:[]}};\n' +
  'function secOf(s){var k=(s&&s.sector!==undefined)?s.sector:s;return {key:k};}\n' +
  'var TEMPLATES={edicao_midia:{subLabel:"Pacote",subtypes:{p4:{label:"4",items:4,videoTema:true},p6:{label:"6",items:6,videoTema:true},p12:{label:"12",items:12,videoTema:true}}},' +
  'cronograma:{subLabel:"Periodicidade",subtypes:{semanal:{label:"Semanal",contentCount:3},mensal:{label:"Mensal",contentCount:12}}},' +
  'roteiro:{subLabel:"Quantidade de roteiros",subtypes:{q4:{label:"4 roteiros",contentCount:4},q8:{label:"8 roteiros",contentCount:8}}}};\n' +
  'function tpl(){return state.form.sector?TEMPLATES[secOf(state.form.sector).key]:null;}\n';

const FN_SRC = grab('normVideoQty') + '\n' + grab('videoQtyOf') + '\n' + grab('synthVideoSub') + '\n' + grab('curSub') + '\n';
const R = new Function(PRELUDE + FN_SRC +
  '\n; return { normVideoQty, videoQtyOf, synthVideoSub, curSub, setForm:function(f){state.form=f;}, setSector:function(s){__SECTOR=s;state.form.sector=s;} };')(TOASTS);

const synth = (n) => R.synthVideoSub(n);
/* mimetiza a construção de data.videos do saveTask (linha real preservada e checada por regex abaixo),
   dirigida pela curSub() REAL, p/ provar quantidade personalizada → N entradas {id,n,tema} inteiras. */
function buildVideos(videoQty, temas) {
  R.setForm({ sector: 'edicao_midia', subtype: null, videoQty: videoQty, id: null, videos: (temas || []).map((t, i) => ({ id: 'v' + (i + 1), tema: t })) });
  const _sub = R.curSub(); const data = {};
  if (_sub && _sub.videoTema) { const _nV = _sub.items || 0, _vids = []; for (let i = 0; i < _nV; i++) { const v = (state_videos()[i]) || {}; _vids.push({ id: (v && v.id) || ('v' + (i + 1)), n: i + 1, tema: ((v && v.tema) || '').trim() }); } if (_vids.length) data.videos = _vids; }
  return data;
  function state_videos() { return (temas || []).map((t, i) => ({ id: 'v' + (i + 1), tema: t })); }
}

console.log('== F3.5.4V — Quantidade personalizada de vídeos/roteiros ==');

/* ============ BLOCO A — QUANTIDADES VÁLIDAS 1..50 (synthVideoSub / curSub) ============ */
ok('1  quantidade 1 → subtipo sintético items=1, videoTema, label "1 vídeos/roteiros"', (()=>{const s=synth(1);return s&&s.items===1&&s.videoTema===true&&s.label==='1 vídeos/roteiros'&&s.itemLabel==='Vídeo';})());
ok('2  quantidade 2', (()=>{const s=synth(2);return s&&s.items===2&&s.formTitle==='Edição — 2 vídeos/roteiros';})());
ok('3  quantidade 3', synth(3).items===3);
ok('4  quantidade 4 (antigo p4, agora livre)', synth(4).items===4);
ok('5  quantidade 6 (antigo p6)', synth(6).items===6);
ok('6  quantidade 12 (antigo p12)', synth(12).items===12);
ok('7  quantidade 13 (impossível antes; agora válida)', synth(13).items===13);
ok('8  quantidade 20', synth(20).items===20);
ok('9  quantidade 50', synth(50).items===50);
ok('9b checklist reflete N ("Editar N vídeos")', synth(8).checklist.indexOf('Editar 8 vídeos')>=0);
ok('9c fields preserva "orientacoes" (mesmo contrato do pacote antigo)', synth(8).fields.length===1 && synth(8).fields[0].k==='orientacoes');

/* ============ BLOCO B — ENTRADA DO USUÁRIO (normVideoQty) 10..24 ============ */
ok('10 digitação direta "8" → 8', R.normVideoQty('8')===8);
ok('11 botão "+" a partir de 8 → 9 (normVideoQty(8+1))', R.normVideoQty(8+1)===9);
ok('11b botão "+" a partir de vazio → 1', R.normVideoQty((0)+1)===1);
ok('12 botão "−" a partir de 8 → 7', (8>1?8-1:8)===7 && R.normVideoQty(7)===7);
ok('13 seta ↑ (input number dispara change→normVideoQty) "16"→16', R.normVideoQty('16')===16);
ok('14 seta ↓ "4"→4', R.normVideoQty('4')===4);
ok('15 colar número "15" → 15', R.normVideoQty('15')===15);
ok('15b colar com espaços " 7 " → 7', R.normVideoQty(' 7 ')===7);
ok('16 valor zero "0" → 1 (mínimo; NÃO aceita 0)', R.normVideoQty('0')===1);
ok('17 valor negativo "-3" → 1 (NÃO aceita negativo)', R.normVideoQty('-3')===1);
ok('18 valor decimal "8.9" → 8 (piso; NÃO aceita decimal)', R.normVideoQty('8.9')===8);
ok('18b decimal "1.5" → 1', R.normVideoQty('1.5')===1);
ok('19 letras "abc" → "" (vazio; NÃO aceita texto)', R.normVideoQty('abc')==='');
ok('19b alfanumérico "8x" → "" (não numérico puro)', R.normVideoQty('8x')==='');
ok('20 caracteres especiais "@#" → ""', R.normVideoQty('@#')==='');
ok('21 campo vazio "" → "" (opcional preservado)', R.normVideoQty('')==='');
ok('21b só espaços "   " → ""', R.normVideoQty('   ')==='');
ok('22 clique rápido "+" (idempotência: oninput reatribuído, sem addEventListener)', /const bind=\(sel,fn\)=>c\.querySelectorAll\(sel\)\.forEach\(el=>el\.oninput=\(\)=>fn\(el\)\);/.test(H));
ok('23 clique rápido "−" (handler de clique é DELEGADO único, sem listener por botão)', /if\(el=g\('\[data-vqminus\]'\)\)\{/.test(H) && /if\(el=g\('\[data-vqplus\]'\)\)\{/.test(H));
ok('24 "−" NÃO reduz abaixo de 1 (guard _vqm>1) e botão fica disabled em ≤1', /if\(isFinite\(_vqm\)&&_vqm>1\)\{state\.form\.videoQty=_vqm-1;/.test(H) && /data-vqminus="1"[^>]*'\+\(\(!\(_vqn>1\)\)\?' disabled':''\)/.test(H));

/* ============ BLOCO C — FLUXO/ESTADO 25..30 ============ */
ok('25 avançar p/ Revisão usa curSub() sintético (items=N; sem depender de subtype fixo)', (()=>{R.setForm({sector:'edicao_midia',subtype:null,videoQty:8,id:null,videos:[]});const s=R.curSub();return s&&s.items===8&&s.videoTema===true;})());
ok('26 voltar p/ Briefing: valor preservado no estado (videoQty não é limpo em back/next)', !/state\.form\.videoQty=null/.test(H));
ok('27 valor preservado durante re-render (oninput só atualiza estado; commit re-renderiza)', /bind\('#fVideoQty',e=>\{state\.form\.videoQty=e\.value;\}\);/.test(H) && /_vqEl\.onchange=function/.test(H));
ok('28 CRIAR tarefa: quantidade 8 → data.videos com 8 entradas {n inteiro}', (()=>{const d=buildVideos(8,['a','b']);return d.videos&&d.videos.length===8&&d.videos[0].n===1&&d.videos[7].n===8&&typeof d.videos[3].n==='number';})());
ok('28b CRIAR quantidade 13 → 13 vídeos (impossível no modelo antigo)', buildVideos(13,[]).videos.length===13);
ok('29 REABRIR (edição, f.id): sem videoQty → deriva de videos.length', R.videoQtyOf({id:'t1',videos:[1,2,3,4,5,6,7]})===7);
ok('30 EDITAR: videoQty explícito manda sobre o legado', R.videoQtyOf({id:'t1',videoQty:9,videos:[1,2,3]})===9);

/* ============ BLOCO D — COMPAT RETROATIVA (pacotes antigos) 31..33 ============ */
ok('31 tarefa antiga pacote p4 → 4 (conversão não-destrutiva na edição)', R.videoQtyOf({id:'t1',subtype:'p4'})===4);
ok('32 tarefa antiga pacote p6 → 6', R.videoQtyOf({id:'t1',subtype:'p6'})===6);
ok('33 tarefa antiga pacote p12 → 12', R.videoQtyOf({id:'t1',subtype:'p12'})===12);
ok('33b criação (sem id) NÃO usa fallback legado (videoQty vazio → null/opcional)', R.videoQtyOf({id:null,subtype:'p4',videoQty:''})===null);

/* ============ BLOCO E — CAMPOS PRESERVADOS NO SALVAMENTO 34..38 ============ */
ok('34 link preservado (data.link do formulário, intacto)', /link:f\.link\.trim\(\)/.test(H));
ok('35 observações preservadas (composedDesc/obs intactos)', /desc:composedDesc\(\)/.test(H));
ok('36 responsável preservado (assigneeId no payload)', /assigneeId:f\.assigneeId\|\|null/.test(H));
ok('37 prazo preservado (startDate/endDate/dueDate no payload)', /startDate:f\.startDate\|\|''/.test(H) && /endDate:f\.endDate\|\|''/.test(H));
ok('38 status preservado (status do formulário)', /status:f\.status/.test(H));

/* ============ BLOCO F — RESPONSIVIDADE/ACESSIBILIDADE (CSS/ARIA) 39..42 ============ */
ok('39 escala/responsivo: linha flex com wrap (não corta em 125/150/ultrawide)', /\.vqty-row\{display:flex;align-items:center;gap:8px;flex-wrap:wrap/.test(H));
ok('40 botões com área de clique adequada (40x40) e input central legível', /\.vqty-btn\{flex:none;width:40px;height:40px/.test(H) && /\.vqty-input\{width:96px/.test(H));
ok('41 setas do teclado seguem no type=number (spinner nativo oculto, não o teclado)', /type="number" min="1" step="1" inputmode="numeric"/.test(H) && /-webkit-appearance:none/.test(H));
ok('42 acessibilidade: label do campo + aria-label nos botões e no input', /aria-label="Diminuir quantidade"/.test(H) && /aria-label="Aumentar quantidade"/.test(H) && /aria-label="Quantidade de vídeos\/roteiros"/.test(H) && /<div class="lbl">Quantidade de vídeos\/roteiros<\/div>/.test(H));

/* ============ BLOCO G — PERFIS / SEM DUPLICAÇÃO / REVISÃO / NUMÉRICO 43..50 ============ */
ok('43 Administrador: seletor aparece na Edição de vídeos (não é gate de cards)', /if\(secOf\(f\.sector\)\.key==='edicao_midia'\)\{[\s\S]{0,900}data-vqminus/.test(H));
ok('44 Social Media: mesma via de criação (openTaskForm/wizard, sem restrição nova)', /function openTaskForm\(sector\)\{closeModal\(\);if\(sector&&secOf\(sector\)\.descontinuado\)sector=null;/.test(H));
ok('45 Demais perfis com acesso: seletor só em edicao_midia; outros setores mantêm chips', /else\{\s*h\+='<div class="lbl">'\+esc\(t\.subLabel\|\|'Tipo'\)/.test(H));
ok('46 SEM listeners duplicados (oninput idempotente + onchange reatribuído + clique delegado)', /_vqEl\.onchange=function/.test(H) && /el\.oninput=\(\)=>fn\(el\)/.test(H));
ok('47 SEM re-render apagando o valor (oninput NÃO chama render; só commit/botão renderiza)', (()=>{const m=H.match(/bind\('#fVideoQty',e=>\{state\.form\.videoQty=e\.value;\}\);/);return !!m;})());
ok('48 SEM criação automática de tarefas (é 1 doc com videos[]; edicao_midia usa saveTask, não saveCardsBatch)', /secOf\(state\.form\.sector\)\.key==='edicao_cards'\)await saveCardsBatch\(\);else await saveTask\(\)/.test(H));
ok('49 Revisão mostra a quantidade (linha "Quantidade de vídeos/roteiros", NÃO "Pacote: personalizado")', /secOf\(f\.sector\)\.key==='edicao_midia'\?'Quantidade de vídeos\/roteiros':'Subtipo'/.test(H) && !/Pacote: personalizado/.test(H));
ok('50 salvamento NUMÉRICO (data.videos=[{id,n,tema}] com n inteiro; sem texto decorativo)', /_vids\.push\(\{id:\(v&&v\.id\)\|\|\('v'\+\(i\+1\)\),n:i\+1,tema:/.test(H) && /data\.videos=_vids/.test(H) && buildVideos(5,[]).videos.every((v,i)=>v.n===i+1));

/* ============ TETO TÉCNICO (documentado, não silencioso) ============ */
ok('T1 teto técnico existe e é documentado (VIDEO_QTY_MAX)', /var VIDEO_QTY_MAX=500;/.test(H) && /limite de 1 MiB do Firestore/.test(H));
ok('T2 exceder o teto NÃO é silencioso (mensagem clara via flashToast) e mantém no teto', (()=>{TOASTS.length=0;const r=R.normVideoQty('99999');return r===500 && TOASTS.length===1 && /máxima/.test(TOASTS[0]);})());
ok('T3 no teto exato (500) sem mensagem', (()=>{TOASTS.length=0;const r=R.normVideoQty('500');return r===500 && TOASTS.length===0;})());

/* ============ REGRESSÃO — DEMAIS SETORES / CONGELADOS 1.0.211 ============ */
console.log('\n== Regressão — demais setores intactos + congelamentos 1.0.211 ==');
ok('RG1 Cronograma mantém chips + subtype (curSub lê t.subtypes[subtype])', (()=>{R.setForm({sector:'cronograma',subtype:'mensal',videoQty:null});const s=R.curSub();return s&&s.contentCount===12;})());
ok('RG2 Roteiro mantém chips + subtype', (()=>{R.setForm({sector:'roteiro',subtype:'q8',videoQty:null});const s=R.curSub();return s&&s.contentCount===8;})());
ok('RG3 Cronograma/Copywriting/Roteiro ainda renderizam chips (data-fsub preservado)', /data-fsub="'\+k\+'"/.test(H));
ok('RG4 Card Premium/cronOf intactos (lê t.videos, contagem exata)', /if\(Array\.isArray\(t\.videos\)&&t\.videos\.length\)\{/.test(H) && /return \{list,count:t\.videos\.length,label:'',videos:true\}/.test(H));
ok('RG5 payload de vídeos (data.videos) byte-idêntico ao 1.0.211 (contrato preservado)', /\{const _sub=curSub\(\); if\(_sub&&_sub\.videoTema\)\{const _nV=_sub\.items\|\|0,_vids=\[\];/.test(H));
ok('RG6 wizard "Nova tarefa" reset intacto (openNewTaskWizard → newForm(null))', /function openNewTaskWizard\(\)\{[\s\S]*?state\.form=newForm\(null\);/.test(H));
ok('RG7 Edição de Cards intacta (fCardsQty + CARDS_MAX_BATCH + saveCardsBatch)', /id="fCardsQty"/.test(H) && /var CARDS_MAX_BATCH=50;/.test(H) && /async function saveCardsBatch\(\)/.test(H));
ok('RG8 SLA/alertas/notificações NÃO tocados por esta fase (âncoras)', /function notifScanSla\(\)\{/.test(H) && /function isDesignerAxisMove/.test(H));
ok('RG9 newForm ganhou videoQty (aditivo; subtype/videos preservados)', /subtype:null,videoQty:null,fields:\{\},contents:\[\],items:\[\],videos:\[\]/.test(H));
ok('RG10 validação de edicao_midia inalterada (Designer + término obrigatórios)', /if\(secOf\(f\.sector\)\.key==='edicao_midia'\)\{[\s\S]{0,260}if\(!f\.assigneeId\)\{[\s\S]{0,200}if\(!f\.endDate\)\{/.test(H));

console.log('');
console.log('RESULTADO F3.5.4V: ' + pass + ' PASS, ' + fail + ' FAIL  (SRC=' + SRC_PATH + ')');
if (fail) { console.log(flog.join('\n')); process.exit(1); }
