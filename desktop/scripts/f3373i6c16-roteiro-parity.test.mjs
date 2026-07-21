#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C16 — Testes HERMÉTICOS (texto/fonte + micro-exec) da PARIDADE do
   ROTEIRO com o CRONOGRAMA (Card Premium) no Desktop 1.0.165:
     - Roteiro passa ao MESMO fluxo-cliente do Cronograma via helper único
       isClientSector(): quantidades 4/6/8/12, cliente OBRIGATÓRIO, blocos
       tema+legenda (contentCount), link premium e aprovação do cliente;
     - Roteiro NÃO é atribuído a designer; o formulário oculta Responsável,
       Etapa e Período (mantém Identificação + Prazo/Prioridade);
     - Mensagem de WhatsApp e a tarefa identificam "Roteiro de gravação de vídeos";
     - Campos genéricos antigos (tipo_roteiro/gancho/desenvolvimento/cta/obs_gravacao)
       SAÍRAM do template;
     - Cronograma PRESERVADO (subtypes semanal/quinzenal/mensal; board do designer
       EXCLUSIVO do cronograma) e Worker INTOCADO (título OG segue "Aprovar
       cronograma —" — limitação honesta, fase própria de servidor).
   Lê index.html/package.json/cloudflare-worker.js como TEXTO — NÃO abre Electron,
   NÃO rede, NÃO escreve.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const PJ = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
const WORKER = (() => { try { return fs.readFileSync(path.resolve(__dirname, '..', '..', 'cloudflare-worker.js'), 'utf8'); } catch (_) { return ''; } })();

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

console.log('F3.3.73I6C16 — Roteiro ↔ Card Premium parity (Desktop 1.0.165)');

/* ── A: versão ── */
ok('A1 versão 1.0.165+', PJ.version.startsWith('1.0.') && parseInt(PJ.version.split('.')[2], 10) >= 165);

/* ── B: helper único isClientSector (cronograma + roteiro) ── */
ok('B1 isClientSector DEFINIDO = cronograma||roteiro',
  /function isClientSector\(k\)\{return k==='cronograma'\|\|k==='roteiro';\}/.test(HTML));
// micro-exec: extrai o helper real e prova o comportamento (sem tocar produto)
(function () {
  const m = HTML.match(/function isClientSector\([^)]*\)\{[^}]*\}/);
  let ics = null; try { ics = new Function(m[0] + '\n;return isClientSector;')(); } catch (_) {}
  ok('B2 isClientSector(cronograma)=true, (roteiro)=true, outros=false',
    !!ics && ics('cronograma') === true && ics('roteiro') === true &&
    ics('edicao_midia') === false && ics('programacao_posts') === false);
})();

/* ── C: TEMPLATES.roteiro reescrito em paridade ── */
const roteiroTpl = (() => { const i = HTML.indexOf('roteiro:{titleLabel'); if (i < 0) return ''; return HTML.slice(i, i + 900); })();
ok('C1 roteiro: clientRequired + subLabel "Quantidade de roteiros"',
  /roteiro:\{titleLabel:[^}]*subLabel:'Quantidade de roteiros',clientRequired:true,subtypes:\{/.test(roteiroTpl));
ok('C2 subtypes q4/q6/q8/q12 com contentCount 4/6/8/12',
  /q4:\{label:'4 roteiros',formTitle:'[^']*',contentCount:4,/.test(roteiroTpl) &&
  /q6:\{label:'6 roteiros',formTitle:'[^']*',contentCount:6,/.test(roteiroTpl) &&
  /q8:\{label:'8 roteiros',formTitle:'[^']*',contentCount:8,/.test(roteiroTpl) &&
  /q12:\{label:'12 roteiros',formTitle:'[^']*',contentCount:12,/.test(roteiroTpl));
ok('C3 formTitle identifica "Roteiro de gravação de vídeos — N roteiros"',
  /formTitle:'Roteiro de gravação de vídeos — 4 roteiros'/.test(roteiroTpl) &&
  /formTitle:'Roteiro de gravação de vídeos — 12 roteiros'/.test(roteiroTpl));
ok('C4 campos genéricos ANTIGOS removidos do roteiro (tipo_roteiro/gancho/desenvolvimento/obs_gravacao)',
  !/tipo_roteiro/.test(HTML) && !/Primeiros 3 segundos/.test(HTML) &&
  !/Estrutura do conteúdo/.test(HTML) && !/obs_gravacao/.test(HTML) && !/Locação, enquadramento/.test(HTML));
ok('C5 SECTORS roteiro desc atualizado (não mais "Gancho, desenvolvimento e CTA")',
  /\{key:'roteiro',label:'Roteiro',color:'#F59E0B',desc:'Roteiros de gravação de vídeos',icon:'description'\}/.test(HTML) &&
  !/Gancho, desenvolvimento e CTA/.test(HTML));

/* ── D: gates generalizados (fluxo-cliente = cronograma + roteiro) ── */
ok('D1 NENHUM gate literal secOf(t/f.sector).key===/!==cronograma restou',
  !/secOf\((?:t|f)\.sector\)\.key==='cronograma'/.test(HTML) &&
  !/secOf\((?:t|f)\.sector\)\.key!=='cronograma'/.test(HTML) &&
  !/f\.sector!=='cronograma'/.test(HTML));
ok('D2 board do DESIGNER continua EXCLUSIVO do cronograma (não recebe roteiro)',
  /const cronList=list\.filter\(t=>\{const _sk=secOf\(t\.sector\)\.key;return _sk==='cronograma';\}\);/.test(HTML));
ok('D3 isClientFlow usa isClientSector',
  /function isClientFlow\(t\)\{return !!t&&isClientSector\(secOf\(t\.sector\)\.key\);\}/.test(HTML));
ok('D4 canSendToClient libera roteiro via isClientSector (cliente + >=1 tema + papel)',
  /if\(!isClientSector\(secOf\(f\.sector\)\.key\)\)return false;/.test(HTML));
// F3.4.3E — o valor gravado é IDÊNTICO; a leitura da flag foi hasteada para a cópia local `sendAfter`
// (const sendAfter=f._sendAfterSave===true, capturada e LIMPA no topo de saveTask — consumo seguro).
// `f._sendAfterSave?` ≡ `sendAfter?` para todos os valores reais da flag (só true/false/undefined).
ok('D5 save grava cronStatus/clientFlowStatus para o fluxo-cliente (cronograma+roteiro)',
  /if\(isClientSector\(secOf\(f\.sector\)\.key\)\)\{data\.cronStatus=sendAfter\?'pronto_cliente':'rascunho_social';if\(f\.subtype\)data\.cronSub=f\.subtype;/.test(HTML));

/* ── E: stepDados — Roteiro sem Responsável/Etapa/Período ── */
ok('E1 isRoteiro derivado no stepDados', /const isRoteiro=\(typeof secOf==='function'\)&&secOf\(f\.sector\)\.key==='roteiro';/.test(HTML));
ok('E2 Atribuição (Responsável+Etapa) + Período OCULTOS p/ roteiro (wrap por isRoteiro)',
  /'<\/div>'\+\s*\(isRoteiro\?'':\(\s*'<div class="fgroup"><div class="fgroup-h">Atribuição<\/div>'\+/.test(HTML) &&
  /'<\/div>'\)\)\+[\s\S]{0,320}'<div class="fgroup"><div class="fgroup-h">'\+\(isMedia\?'Prioridade':'Prazo final &amp; prioridade'\)\+'<\/div>'\+/.test(HTML));
ok('E3 Identificação e Cliente OBRIGATÓRIO permanecem (clientRequired marca "obrigatório")',
  /Cliente \/ Empresa'\+\(\(t&&t\.clientRequired\)\?' <span class="req">obrigatório<\/span>':''\)/.test(HTML));

/* ── F: mensagem de WhatsApp + identidade da tarefa ── */
ok('F1 buildClientMessage: ramo ROTEIRO diz "Roteiro de gravação de vídeos"',
  /if\(ctx&&ctx\.sector==='roteiro'\)\{[\s\S]{0,120}Seu Roteiro de gravação de vídeos já está pronto para avaliação\./.test(HTML) &&
  /revisar os roteiros, aprovar ou solicitar ajustes/.test(HTML));
ok('F2 buildClientMessage: ramo CRONOGRAMA preservado ("Seu cronograma já está pronto para avaliação.")',
  /'Seu cronograma já está pronto para avaliação\.\\n\\n'\+/.test(HTML) &&
  /'Acesse o link abaixo para revisar os temas, aprovar ou solicitar ajustes:/.test(HTML));
ok('F3 tarefa identifica "Roteiro de gravação de vídeos" (formTitle → composedDesc)',
  /Roteiro de gravação de vídeos —/.test(roteiroTpl));

/* ── G: contexto de envio carrega o setor + rótulos de tipo ── */
ok('G1 cronCtx carrega sector (default cronograma)', /sector:\(o\.sector\?secOf\(o\.sector\)\.key:'cronograma'\),/.test(HTML));
ok('G2 fallbackTaskFromCtx usa ctx.sector (não fixa cronograma)', /sector:\(ctx\.sector\|\|'cronograma'\),/.test(HTML) && !/sector:'cronograma',cronStatus:/.test(HTML));
ok('G3 cronTypeLabel cobre q4/q6/q8/q12', /q4:'4 roteiros',q6:'6 roteiros',q8:'8 roteiros',q12:'12 roteiros'/.test(HTML));
ok('G4 openSendClientModal (pós-save) passa sector:data.sector', /openSendClientModal\(\{id:ref\.id,client:data\.client,title:data\.title,sector:data\.sector,/.test(HTML));

/* ── H: preview do card no modal + honestidade da limitação do Worker ── */
ok('H1 preview do card é sector-aware (Aprovar roteiro / Roteiro de gravação de vídeos)',
  /\(ctx\.sector==='roteiro'\?'Aprovar roteiro':'Aprovar cronograma'\)/.test(HTML) &&
  /\(ctx\.sector==='roteiro'\?'Seu Roteiro de gravação de vídeos está pronto para avaliação\.':'Seu cronograma está pronto para avaliação\.'\)/.test(HTML));
ok('H2 caveat HONESTO no roteiro (arte do card ainda usa layout "cronograma"; título atualizado na etapa do servidor)',
  /Transparência: a arte do card de compartilhamento ainda usa o layout de “cronograma”/.test(HTML) &&
  /A mensagem e a tarefa já identificam “Roteiro de gravação de vídeos”/.test(HTML));

/* ── I: Cronograma PRESERVADO + Worker INTOCADO + sem regressões ── */
ok('I1 Cronograma intacto (clientRequired + subtypes semanal/quinzenal/mensal 3/6/12)',
  /cronograma:\{titleLabel:'Nome do cronograma'[^}]*clientRequired:true,subtypes:\{/.test(HTML) &&
  /semanal:\{label:'Semanal',formTitle:'Cronograma semanal — 3 conteúdos',contentCount:3,/.test(HTML) &&
  /quinzenal:\{[^}]*contentCount:6,/.test(HTML) && /mensal:\{[^}]*contentCount:12,/.test(HTML));
ok('I2 Worker INTOCADO nesta fase — título OG segue "Aprovar cronograma — " (limitação honesta; fase própria de servidor)',
  WORKER === '' || /"Aprovar cronograma — "/.test(WORKER));
ok('I3 Copywriting descontinuado + Chat FORA (sem reintrodução)',
  /\{key:'copywriting',[^}]*descontinuado:true\}/.test(HTML) && /SECTORS\.filter\(s=>!s\.descontinuado\)/.test(HTML) && !/TABS=\[[^\]]*\{k:'chat'/.test(HTML));
ok('I4 roteiro segue setor ATIVO (não descontinuado)',
  /\{key:'roteiro',label:'Roteiro'/.test(HTML) && !/\{key:'roteiro'[^}]*descontinuado:true\}/.test(HTML));

/* ── J: rótulos de conteúdo sector-aware (Roteiros vs Conteúdos do cronograma) ── */
ok('J1 briefing: rótulo "Roteiros (N)" p/ roteiro', /\(secOf\(f\.sector\)\.key==='roteiro'\?'Roteiros':'Conteúdos do cronograma'\)\+' \('\+sub\.contentCount\+'\)/.test(HTML));
ok('J2 revisão: rótulo sector-aware', /<span>'\+\(secOf\(f\.sector\)\.key==='roteiro'\?'Roteiros':'Conteúdos do cronograma'\)\+'<\/span>/.test(HTML));
ok('J3 detalhe: rótulo sector-aware', /<div class="det-sec">'\+\(secOf\(t\.sector\)\.key==='roteiro'\?'Roteiros':\(secOf\(t\.sector\)\.key==='edicao_midia'\?'Vídeos':'Conteúdos do cronograma'\)\)\+' <span/.test(HTML));

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
