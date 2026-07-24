/* =====================================================================
 * F3.4.6 — QA VISUAL AUTOMATIZADO — Agenda/Mês: GRADE DIÁRIA restaurada.
 * Roda com Playwright + Chromium headless (CHROMIUM_BIN opcional). Carrega o
 * renderer REAL, injeta usuário/eventos (SEM login real, SEM Firestore) e:
 *   - prova por MEDIDA (computed styles/rects) o CONTRATO VISUAL: 42 células,
 *     7 colunas, TODAS com moldura (borda visível), dentro-do-mês com superfície,
 *     fora-do-mês discreto porém visível, hoje contornado, seleção em accent,
 *     alturas consistentes por linha, dots DENTRO da célula, painel do dia com
 *     os compromissos da data, sem overflow horizontal;
 *   - exercita FUNCIONAL: navegação mês anterior/próximo/Hoje, clique em data,
 *     filtros (Todos/Gravação/Fotografia/Reunião/Edição/Outro), busca,
 *     Mostrar cancelados, alternância Mês/Agenda(lista);
 *   - tira as 20 CAPTURAS do mandato (meses 5/6 linhas, início domingo/meio da
 *     semana, vazio, vários dias, mesmo dia, mês anterior/seguinte, hoje,
 *     cancelados, filtros, busca, 1366×768, 1920×1080, maximizada/restaurada,
 *     escala 100%/125%, tema escuro).
 * Qualquer assert falho => exit 1 (fail-closed). Saída: desktop/qa-out-f346/.
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Caminhos ANCORADOS NO PRÓPRIO SCRIPT (independentes do cwd — roda da raiz OU de desktop/).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = path.resolve(__dirname, '..', 'src', 'renderer');
const OUT = path.resolve(__dirname, '..', 'qa-out-f346');
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; flog.push(n); console.log('  FAIL — ' + n); } };

/* Stub compat do Firebase (harness-only): o QA roda SEM rede — os <script src> do gstatic são
 * removidos do HTML servido e substituídos por este stub inerte (nenhuma leitura/escrita real).
 * O produto NÃO é alterado; só a cópia servida ao Chromium do teste. */
const FB_STUB = '<script>(function(){var DOC={get:async function(){return{exists:false,data:function(){return null}}},set:async function(){},update:async function(){},delete:async function(){},onSnapshot:function(){return function(){}},collection:function(){return COL}};var COL={doc:function(){return DOC},where:function(){return COL},orderBy:function(){return COL},limit:function(){return COL},onSnapshot:function(){return function(){}},get:async function(){return{docs:[],empty:true,forEach:function(){}}},add:async function(){return{id:"stub"}}};var DB={collection:function(){return COL},doc:function(){return DOC},batch:function(){return{set:function(){},update:function(){},delete:function(){},commit:async function(){}}}};var fsFn=function(){return DB};fsFn.FieldValue={serverTimestamp:function(){return 0},delete:function(){return 0},arrayUnion:function(){return[]},arrayRemove:function(){return[]},increment:function(n){return n}};fsFn.Timestamp={now:function(){return{toMillis:function(){return Date.now()}}}};window.firebase={apps:[],initializeApp:function(){return{}},app:function(){return{}},firestore:fsFn};})();</'+'script>';
const server = http.createServer((req, res) => {
  let f = (req.url || '/').split('?')[0];
  if (f === '/' || f === '') f = '/index.html';
  fs.readFile(path.join(RENDER_DIR, f), (e, buf) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    const ext = path.extname(f);
    let out = buf;
    if (f === '/index.html') {
      let html = buf.toString('utf8');
      let injected = false;
      html = html.replace(/<script src="https:\/\/www\.gstatic\.com[^"]*"><\/script>/g, () => { if (injected) return ''; injected = true; return FB_STUB; });
      out = Buffer.from(html, 'utf8');
    }
    res.writeHead(200, { 'content-type': ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : 'application/octet-stream' });
    res.end(out);
  });
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined });

/* eventos-fixture (março/2026: 1º = domingo; ocupa 5 linhas da grade) */
const FIX = `
  state.user={id:'owner',name:'Owner Teste',role:'Admin',admin:true};
  state.users=[state.user];
  state.tasks=[];
  state.events=[
    {id:'e1',date:'2026-03-06',start:'09:00',title:'Gravação Clínica',client:'Cliente A',type:'gravacao'},
    {id:'e2',date:'2026-03-10',start:'10:00',title:'Ensaio Fotografia',client:'Cliente B',type:'foto'},
    {id:'e3',date:'2026-03-10',start:'11:00',title:'Reunião Pauta',client:'Cliente C',type:'reuniao'},
    {id:'e4',date:'2026-03-10',start:'13:00',title:'Edição Reels',client:'Cliente D',type:'edicao'},
    {id:'e5',date:'2026-03-10',start:'14:00',title:'Outro Item',client:'Cliente E',type:'outro'},
    {id:'e6',date:'2026-03-10',start:'15:00',title:'Gravação Extra',client:'Cliente F',type:'gravacao'},
    {id:'e7',date:'2026-03-18',start:'16:00',title:'Edição Pacote',client:'Cliente G',type:'edicao'},
    {id:'e8',date:'2026-03-12',start:'12:00',title:'Reunião Cancelada',client:'Cliente H',type:'reuniao',status:'cancelled'},
  ];
  document.body.classList.add('desktop','authed');
  const lg=document.getElementById('login'); if(lg) lg.classList.add('hidden');
  const app=document.getElementById('app'); if(app) app.style.display='flex';
  state.tab='agenda'; agView='month'; agFilter='all'; agQuery=''; agShowCancelled=false;
`;

async function boot(page, extra) {
  await page.goto(base, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => typeof window.render === 'function', null, { timeout: 25000 });
  } catch (e) {
    console.log('boot: render ausente; pageerrors até aqui:', (typeof perr !== 'undefined' ? perr : []).slice(0, 3));
    throw e;
  }
  await page.evaluate(FIX + (extra || '') + '\n;render();');
  await page.waitForSelector('.agcell', { timeout: 8000 });
  await page.waitForTimeout(150);
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const perr = []; page.on('pageerror', e => perr.push(String(e)));

/* ── PROVA PRINCIPAL (março/2026; seleção 18) ── */
await boot(page, "agCursor=new Date(2026,2,1); agSel='2026-03-18';");
const M = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.agcell')];
  const grid = cells[0].parentElement;
  const gcs = getComputedStyle(grid);
  const cs = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { bw: parseFloat(s.borderTopWidth), bc: s.borderTopColor, bg: s.backgroundColor, color: s.color, top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; };
  const alpha = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return c === 'transparent' ? 0 : 1; const p = m[1].split(','); return p.length === 4 ? parseFloat(p[3]) : 1; };
  const info = cells.map(c => ({ day: c.dataset.day, dim: c.classList.contains('agcell-dim'), today: c.classList.contains('agcell-today'), sel: c.classList.contains('agcell-sel'), st: cs(c), dots: c.querySelectorAll('div>span').length, rect: c.getBoundingClientRect().toJSON(), dotRects: [...c.querySelectorAll('div>span')].map(s => s.getBoundingClientRect().toJSON()) }));
  const rows = {}; info.forEach(c => { (rows[c.st.top] = rows[c.st.top] || []).push(c); });
  const panel = (document.querySelector('.scr') || document.body).textContent;
  return {
    n: cells.length,
    cols: gcs.gridTemplateColumns.split(' ').length,
    scrollOverflow: grid.scrollWidth > grid.clientWidth + 1,
    rows: Object.values(rows).map(r => ({ n: r.length, hs: [...new Set(r.map(c => c.st.h))] })),
    allFramed: info.every(c => c.sel || (c.st.bw >= 1 && alpha(c.st.bc) > 0)), // sel = moldura por PREENCHIMENTO accent (contrato aprovado)
    inMonthSurface: info.filter(c => !c.dim && !c.sel).every(c => alpha(c.st.bg) > 0),
    dimVisible: info.filter(c => c.dim).every(c => c.st.bw >= 1 && alpha(c.st.bc) > 0),
    dimDiffers: (() => { const a = info.find(c => !c.dim && !c.sel && !c.today), b = info.find(c => c.dim); return a && b && (a.st.bg !== b.st.bg) && (a.st.color !== b.st.color); })(),
    nDim: info.filter(c => c.dim).length,
    firstDim: info[0] && info[0].dim, lastDim: info[41] && info[41].dim,
    d06dots: (info.find(c => c.day === '2026-03-06') || {}).dots,
    d10dots: (info.find(c => c.day === '2026-03-10') || {}).dots,
    d12dots: (info.find(c => c.day === '2026-03-12') || {}).dots,
    selIs18: (() => { const c = info.find(c => c.day === '2026-03-18'); return c && c.sel && alpha(c.st.bg) > 0; })(),
    dotsInside: info.every(c => c.dotRects.every(d => d.top >= c.rect.top - 1 && d.bottom <= c.rect.bottom + 1 && d.left >= c.rect.left - 1 && d.right <= c.rect.right + 1)),
    panelHasEv: panel.includes('Edição Pacote'),
    bodyDark: (() => { const b = getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [255, 255, 255]; return (+b[0] + +b[1] + +b[2]) / 3 < 90; })(),
  };
});
ok('42 células presentes (nenhuma desaparece vazia)', M.n === 42);
ok('7 colunas fixas (grid-template-columns)', M.cols === 7);
ok('TODAS as células com MOLDURA (borda ≥1px visível — divisões h/v delimitadas)', M.allFramed);
ok('células dentro-do-mês com superfície própria (quadro visível)', M.inMonthSurface);
ok('fora-do-mês VISÍVEL porém discreto (moldura suave + aparência distinta)', M.dimVisible && M.dimDiffers);
ok('março começa no DOMINGO: zero dias do mês anterior; 11 do seguinte como dim (célula 42 dim)', M.firstDim === false && M.lastDim === true && M.nDim === 11);
ok('6 linhas × 7 células, alturas CONSISTENTES por linha', M.rows.length === 6 && M.rows.every(r => r.n === 7 && r.hs.length === 1));
ok('compromissos DENTRO da data: 06/03 = 1 dot · 10/03 = 4 dots (cap de vários no dia)', M.d06dots === 1 && M.d10dots === 4);
ok('dots contidos na própria célula (nenhuma sobreposição entre datas)', M.dotsInside);
ok('cancelado OCULTO por padrão (12/03 sem dot)', M.d12dots === 0);
ok('data selecionada (18/03) destacada em accent', M.selIs18);
ok('painel do dia lista o compromisso da data selecionada', M.panelHasEv);
ok('sem overflow horizontal na grade', !M.scrollOverflow);
ok('tema escuro ativo (fundo escuro)', M.bodyDark);
await shot(page, '01-marco-5linhas-varios-dias-mesmo-dia.png');

/* ── cancelados: Mostrar cancelados exibe o dot de 12/03 ── */
await page.click('[data-ag="togglecancel"]');
await page.waitForTimeout(120);
const canc = await page.evaluate(() => (document.querySelector('.agcell[data-day="2026-03-12"]') || {}).querySelectorAll?.('div>span').length ?? -1);
ok('Mostrar cancelados: 12/03 passa a exibir o compromisso (dot)', canc === 1);
await shot(page, '11-cancelados-visiveis.png');
await page.click('[data-ag="togglecancel"]'); await page.waitForTimeout(100);

/* ── filtros: grade íntegra + dots por tipo no dia 10/03 ── */
const FILTER_EXPECT = { gravacao: 1, foto: 1, reuniao: 1, edicao: 1, outro: 1, all: 4 };
for (const k of ['gravacao', 'foto', 'reuniao', 'edicao', 'outro']) {
  await page.click(`[data-agf="${k}"]`); await page.waitForTimeout(120);
  const r = await page.evaluate(() => ({ n: document.querySelectorAll('.agcell').length, d10: document.querySelector('.agcell[data-day="2026-03-10"]').querySelectorAll('div>span').length }));
  ok(`filtro ${k}: grade 42 células íntegra + 10/03 com ${FILTER_EXPECT[k]} dot`, r.n === 42 && r.d10 === FILTER_EXPECT[k]);
  if (k === 'gravacao') await shot(page, '12-filtro-gravacao.png');
}
await page.click('[data-agf="all"]'); await page.waitForTimeout(120);

/* ── busca ativa ── */
await page.evaluate(() => { agQuery = 'Ensaio'; render(); });
await page.waitForTimeout(120);
const busca = await page.evaluate(() => ({ n: document.querySelectorAll('.agcell').length, d10: document.querySelector('.agcell[data-day="2026-03-10"]').querySelectorAll('div>span').length, d06: document.querySelector('.agcell[data-day="2026-03-06"]').querySelectorAll('div>span').length }));
ok('busca "Ensaio": grade íntegra; 10/03 só 1 dot; 06/03 sem dot', busca.n === 42 && busca.d10 === 1 && busca.d06 === 0);
await shot(page, '13-busca-ativa.png');
await page.evaluate(() => { agQuery = ''; render(); }); await page.waitForTimeout(100);

/* ── navegação: próximo/anterior/Hoje + clique em data (funcional) ── */
const t0 = await page.evaluate(() => document.querySelector('.h-title').textContent);
await page.click('[data-ag="next"]'); await page.waitForTimeout(120);
const t1 = await page.evaluate(() => document.querySelector('.h-title').textContent);
await page.click('[data-ag="prev"]'); await page.waitForTimeout(120);
const t2 = await page.evaluate(() => document.querySelector('.h-title').textContent);
ok('navegação mês próximo/anterior muda e restaura o título', t1 !== t0 && t2 === t0);
await page.click('.agcell[data-day="2026-03-06"]'); await page.waitForTimeout(120);
const selNew = await page.evaluate(() => document.querySelector('.agcell[data-day="2026-03-06"]').classList.contains('agcell-sel'));
ok('clique em uma data seleciona a célula (accent)', selNew);
await page.click('[data-ag="today"]'); await page.waitForTimeout(120);
const hoje = await page.evaluate(() => ({ t: !!document.querySelector('.agcell-today'), n: document.querySelectorAll('.agcell').length }));
ok('botão Hoje: mês atual com a DATA ATUAL contornada', hoje.t && hoje.n === 42);
await shot(page, '10-data-atual-hoje.png');

/* ── Agenda/lista e volta ── */
await page.click('[data-ag="vlist"]'); await page.waitForTimeout(150);
const lista = await page.evaluate(() => document.querySelectorAll('.agcell').length === 0);
ok('alternância para Agenda (lista) funciona', lista);
await page.click('[data-ag="vmonth"]'); await page.waitForTimeout(150);
ok('volta para Mês re-renderiza a grade', await page.evaluate(() => document.querySelectorAll('.agcell').length === 42));

/* ── meses do mandato ── */
async function month(y, m, sel, file, expectDim) {
  await page.evaluate(({ y, m, sel }) => { agCursor = new Date(y, m, 1); agSel = sel; agShowCancelled = false; agFilter = 'all'; agQuery = ''; render(); }, { y, m, sel });
  await page.waitForTimeout(140);
  const r = await page.evaluate(() => { const c = [...document.querySelectorAll('.agcell')]; return { n: c.length, dim: c.filter(x => x.classList.contains('agcell-dim')).length, firstDim: c[0].classList.contains('agcell-dim'), framed: c.every(x => x.classList.contains('agcell-sel') || parseFloat(getComputedStyle(x).borderTopWidth) >= 1) }; });
  ok(`mês ${m + 1}/${y}: 42 células emolduradas (${r.dim} dim)`, r.n === 42 && r.framed && (expectDim === undefined || r.dim === expectDim));
  return r;
  await shot(page, file);
}
await month(2026, 1, '2026-02-10', '03-fevereiro-comeca-domingo.png', 14);   // fev/2026 começa no DOMINGO
const jul = await month(2026, 6, '2026-07-10', '04-julho-comeca-meio-semana.png'); // jul/2026 começa na QUARTA
ok('julho começa no meio da semana: primeiras células = mês ANTERIOR como dim', jul.firstDim === true);
await month(2026, 7, '2026-08-10', '02-agosto-6-linhas.png', 11);            // ago/2026 ocupa 6 linhas
await month(2026, 8, '2026-09-10', '05-setembro-vazio.png');                 // sem eventos → células vazias visíveis
const vazio = await page.evaluate(() => [...document.querySelectorAll('.agcell')].every(c => parseFloat(getComputedStyle(c).borderTopWidth) >= 1));
ok('mês vazio: nenhuma célula desaparece; todas seguem emolduradas', vazio);
await shot(page, '08-09-mes-anterior-seguinte-dim.png');

/* ── viewports/escalas do mandato (contextos dedicados) ── */
async function variant(vp, dsf, file) {
  const p = await browser.newPage({ viewport: vp, deviceScaleFactor: dsf });
  await p.goto(base, { waitUntil: 'load' });
  await p.waitForFunction(() => typeof window.render === 'function', { timeout: 25000 });
  await p.evaluate(FIX + "agCursor=new Date(2026,2,1); agSel='2026-03-18';\n;render();");
  await p.waitForSelector('.agcell', { timeout: 8000 });
  await p.waitForTimeout(150);
  const r = await p.evaluate(() => { const c = [...document.querySelectorAll('.agcell')]; const g = c[0].parentElement; return { n: c.length, cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, framed: c.every(x => parseFloat(getComputedStyle(x).borderTopWidth) >= 1), ovf: g.scrollWidth > g.clientWidth + 1 }; });
  ok(`${file}: 42 células · 7 colunas · emolduradas · sem overflow`, r.n === 42 && r.cols === 7 && r.framed && !r.ovf);
  await p.screenshot({ path: path.join(OUT, file) });
  await p.close();
}
await variant({ width: 1366, height: 768 }, 1, '16-1366x768-escala100.png');
await variant({ width: 1920, height: 1080 }, 1, '14-17-1920x1080-maximizada.png');
await variant({ width: 1280, height: 800 }, 1, '15-restaurada-1280x800.png');
await variant({ width: 1440, height: 900 }, 1.25, '19-escala125.png');
await shot(page, '20-tema-escuro.png');
await shot(page, '18-escala100-vista-principal.png');

ok('nenhum erro de página (pageerror) durante o QA', perr.length === 0);
if (perr.length) console.log('pageerrors:', perr.slice(0, 3));

await browser.close(); server.close();

const files = fs.readdirSync(OUT).filter(f => f.endsWith('.png'));
console.log('\n===== F3.4.6 — QA VISUAL DA GRADE DIÁRIA (Agenda/Mês) =====');
console.log('capturas: ' + files.length + ' → ' + OUT);
console.log('F3.4.6-VISUAL: ' + pass + ' OK, ' + fail + ' FAIL');
if (flog.length) console.log('\nFAIL:\n- ' + flog.join('\n- ') + '\n');
if (fail) { console.error('::error:: contrato visual da grade diária violado'); process.exit(1); }
console.log('OK — grade completa: 7 colunas, cada dia na sua própria célula emoldurada, divisões visíveis, compromissos na data, fora-do-mês discreto, hoje/seleção corretos, sem regressão de layout.');
