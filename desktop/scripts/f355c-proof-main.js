/* F3.5.5C — PROVAS REAIS (Electron 31.3.1; app EMPACOTADO em app.asar; xvfb).
 * Empacota o renderer REAL em app.asar, carrega DO ASAR numa BrowserWindow real com o preload
 * de semente (f355c-proof-preload.js) e exercita o CÓDIGO DE PRODUÇÃO: wizard do Roteiro
 * (stepper de quantidade), editor rico (gestos execCommand reais, colagem via ClipboardEvent,
 * sanitização, paridade), Revisão, Central de Detalhes (exibição + cópia), desempenho 50
 * roteiros. Cliques via MouseEvent bubbles (handlers DELEGADOS reais). PNG por cena.
 * Sem IA, sem mockup, sem HTML isolado.
 *
 * Q1 stepper no lugar dos chips        Q2 digitar 3 → 3 blocos      Q3 [+] preserva conteúdo
 * Q4 zero → mensagem visível           Q5 letras → mensagem         Q6 reduzir c/ conteúdo → confirmação
 * Q7 cancelar mantém tudo              Q8 confirmar remove só excedentes
 * Q9 compat q4/q6/q8/q12 + array real  E1 editor renderizado        E2 texto simples sem campo rico
 * E3 negrito → canônico + paridade     E4 cor data-cl               E5 lista na legenda + projeção
 * E6 colagem MALICIOSA inerte          E7 colagem Word limpa        E8 limpar formatação remove rico
 * E9 alinhamento/recuo canônicos       E10 accordion preserva       E11 Revisão exibe formatação
 * E12 Central exibe rico + espelho     E13 cópia text/plain EXATA   E14 tarefa antiga texto simples
 * E15 paridade quebrada → texto        E16 fixtures p/ paridade Worker (JSON)
 * P1 50 roteiros: render+heap          P2 digitação fluida (média)  P3 1366×768 sem overflow-X
 * P4 125% sem overflow-X               P5 Editar conteúdos 12 itens ricos */
const { app, BrowserWindow, session, clipboard } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f355c-qa");
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }
const ofs = require("original-fs");
const sha256 = (p) => crypto.createHash("sha256").update(ofs.readFileSync(p)).digest("hex");
process.on("uncaughtException", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=uncaught:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });
process.on("unhandledRejection", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=unhandled:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });

/* ---- SEMENTE ---- */
const NOW = Date.now();
const ID = { ANA: "u-soc-ana", MARINA: "u-adm-marina", DIEGO: "u-des-diego" };
const RICH_OK = '<p><strong>Legenda</strong> com <em>destaques</em></p><ul><li>item um</li><li>item dois</li></ul>';
const PLAIN_OK = 'Legenda com destaques\n• item um\n• item dois';
const RICH_T = '<p><span data-cl="4">Tema verde</span> oficial</p>';
const PLAIN_T = 'Tema verde oficial';
const seed = (() => {
  const self = { id: ID.ANA, name: "Ana Beatriz Social Media", role: "Social Media", admin: false, status: "ativo" };
  const users = [self,
    { id: ID.MARINA, name: "Marina Administradora", role: "Administrador", admin: true, status: "ativo" },
    { id: ID.DIEGO, name: "Diego Fernandes Designer", role: "Designer", status: "ativo" }];
  const tk = (x) => Object.assign({ by: ID.ANA, createdAt: NOW, history: [], checklist: [] }, x);
  const tasks = [
    tk({ id: "tkRich", sector: "roteiro", status: "afazer", title: "Roteiros com formatação", client: "Clínica Aurora",
      cronContents: [
        { tema: PLAIN_T, temaRich: RICH_T, legenda: PLAIN_OK, legendaRich: RICH_OK },
        { tema: "Tema simples da era do texto puro", legenda: "Linha um\nLinha dois" },
        { tema: "Tema com rico DIVERGENTE", temaRich: "<p><strong>outro texto</strong></p>", legenda: "ok" },
      ] }),
    tk({ id: "tkOld", sector: "cronograma", status: "afazer", title: "Cronograma legado", client: "Ótica Clara",
      cronContents: [{ tema: "Tema antigo", legenda: "Legenda antiga" }] }),
  ];
  return { self, users, tasks, events: [] };
})();

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();

let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f355c-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f355c-app.asar");
  try { fs.rmSync(asarPath, { force: true }); } catch (_) {}
  await asar.createPackage(stage, asarPath);
  return { stageIndexSha: sha256(path.join(rdir, "index.html")) };
}

const results = [];
function rec(name, ok, info) { results.push({ name, ok: !!ok, info: info || {} }); line({ proof: name, ok: !!ok, info: info || {} }); }

app.whenReady().then(async () => {
  const WATCHDOG = setTimeout(() => { try { process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=999 FATAL=watchdog_timeout_10min\n"); } catch (_) {} app.exit(1); }, 10 * 60 * 1000);
  try { session.defaultSession.webRequest.onBeforeRequest((d, cb) => { cb({ cancel: /^https?:/i.test(d.url) }); }); } catch (_) {}
  const meta = await packAsar();
  fs.writeFileSync(path.join(os.tmpdir(), "f355c-seed.json"), JSON.stringify(seed));

  const win = new BrowserWindow({ width: 1440, height: 940, show: true, webPreferences: {
    preload: path.join(__dirname, "f355c-proof-preload.js"),
    contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  const wc = win.webContents;
  wc.on("console-message", (_e, lvl, msg) => { if (lvl >= 2) line({ console: String(msg).slice(0, 260) }); });
  wc.on("render-process-gone", (_e, d) => { line({ rendererGone: (d && d.reason) || "?" }); });
  const J = (code) => wc.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));
  const SHOTS = process.env.PROOF_SHOTS !== '0';   // PROOF_SHOTS=0: só lógica (container local lento); CI captura os PNGs oficiais
  async function shot(nm) { try {
    if (!SHOTS) return 'skipped';
    await sleep(150);
    const img = await Promise.race([win.capturePage(), new Promise((_, rej) => setTimeout(() => rej(new Error("capture_timeout")), 8000))]);
    const p = path.join(OUT, nm + ".png"); fs.writeFileSync(p, img.toPNG()); return path.basename(p);
  } catch (e) { return "pngErr:" + String((e && e.message) || e); } }

  let fatal = null;
  try {
    await win.loadFile(path.join(asarPath, "src", "renderer", "index.html"));
    let boot = null;
    for (let i = 0; i < 120; i++) { await sleep(500);
      boot = await J(`({app: !!document.getElementById('app'), user: !!(window.state&&state.user), tasks: (window.state&&state.tasks&&state.tasks.length)||0})`);
      if (boot && boot.tasks === 2) break; }
    rec("BOOT app.asar carregado + semente entregue (snapshot real; user informativo no container sem rede)", boot && boot.app && boot.tasks === 2, Object.assign({ asarSha: sha256(asarPath).slice(0, 16), srcSha: meta.stageIndexSha.slice(0, 16) }, boot));

    /* helpers de página (produção intocada; só ATALHOS de teste) */
    await J(`window.__click=function(sel){var el=document.querySelector(sel);if(!el)return 'no:'+sel;el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return 'ok';};
      window.__type=function(key,txt){var ed=document.querySelector('[data-rteed="'+key+'"]');if(!ed)return 'no-ed';ed.focus();var r=document.createRange();r.selectNodeContents(ed);r.collapse(false);var s=getSelection();s.removeAllRanges();s.addRange(r);document.execCommand('insertText',false,txt);return 'ok';};
      window.__selAll=function(key){var ed=document.querySelector('[data-rteed="'+key+'"]');if(!ed)return 'no-ed';ed.focus();var r=document.createRange();r.selectNodeContents(ed);var s=getSelection();s.removeAllRanges();s.addRange(r);return 'ok';};
      window.__blur=function(){try{if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();}catch(_){}return 'ok';};
      window.__qty=function(v){var el=document.getElementById('fScriptQty');if(!el)return 'no-qty';el.focus();el.value=v;el.blur();el.dispatchEvent(new Event('change',{bubbles:true}));return 'ok';};
      window.__bar=function(key,sel){var wrap=document.querySelector('.rte[data-rte="'+key+'"]');if(!wrap)return 'no-wrap';var b=wrap.querySelector(sel);if(!b)return 'no-btn:'+sel;b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return 'ok';};
      window.__paste=function(key,html,txt){var ed=document.querySelector('[data-rteed="'+key+'"]');if(!ed)return 'no-ed';ed.focus();var r=document.createRange();r.selectNodeContents(ed);r.collapse(false);var s=getSelection();s.removeAllRanges();s.addRange(r);var dt=new DataTransfer();if(html)dt.setData('text/html',html);if(txt)dt.setData('text/plain',txt);ed.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));return 'ok';};true;`);

    /* ───────────── Q — QUANTIDADE ───────────── */
    await J(`openTaskForm('roteiro'); state.form.title='Roteiros institucionais'; state.form.client='Cliente Prova'; state.form.step=2; render(); true;`);
    await sleep(250);
    const q1 = await J(`({stepper: !!document.getElementById('fScriptQty'), minus: !!document.querySelector('[data-sqminus]'), plus: !!document.querySelector('[data-sqplus]'), chips: document.querySelectorAll('[data-fsub]').length, msgOculta: (function(){var e=document.getElementById('sqErr');return !!(e&&e.hidden);})(), blocos: document.querySelectorAll('.content-card').length})`);
    rec("Q1 Briefing do Roteiro: stepper [−][N][+] presente; SEM chips fixos; sem erro inicial; 0 blocos antes de definir", q1 && q1.stepper && q1.minus && q1.plus && q1.chips === 0 && q1.msgOculta && q1.blocos === 0, Object.assign({ png: await shot("q1-stepper") }, q1));

    const q2 = await J(`(function(){__qty('3');return {q:state.form.scriptQty, blocos:document.querySelectorAll('.content-card').length, rotulo:(document.querySelector('.content-card .ct')||{}).textContent||''};})()`);
    rec("Q2 digitar 3 + change → scriptQty=3 e 3 blocos 'Roteiro N'", q2 && q2.q === 3 && q2.blocos === 3 && /Roteiro 1/.test(q2.rotulo), q2);

    await J(`state.form._openContent=0; render(); true;`); await sleep(200);
    await J(`__type('form|0|tema','Tema do primeiro roteiro'); true;`);
    const q3 = await J(`(function(){__blur();__click('[data-sqplus]');__click('[data-sqplus]');return {q:state.form.scriptQty, blocos:document.querySelectorAll('.content-card').length, t0:(state.form.contents[0]||{}).tema||'', vazio4:!(state.form.contents[3]&&state.form.contents[3].tema)};})()`);
    rec("Q3 [+][+] 3→5 preserva o conteúdo do Roteiro 1 e cria vazios", q3 && q3.q === 5 && q3.blocos === 5 && q3.t0 === 'Tema do primeiro roteiro' && q3.vazio4, Object.assign({ png: await shot("q3-aumentar") }, q3));

    const q4 = await J(`(function(){__qty('0');var e=document.getElementById('sqErr');return {msgVisivel:!!(e&&!e.hidden), texto:(e&&e.textContent)||'', q:state.form.scriptQty};})()`);
    rec("Q4 zero → mensagem literal visível + normaliza p/ 1 (nunca silencioso)", q4 && q4.msgVisivel && q4.texto === 'Informe uma quantidade inteira igual ou superior a 1.' && q4.q === 1, Object.assign({ png: await shot("q4-zero") }, q4));

    const q5 = await J(`(function(){__qty('2.5');var e=document.getElementById('sqErr');var dec={msg:!!(e&&!e.hidden), q:state.form.scriptQty};__qty('-3');e=document.getElementById('sqErr');var neg={msg:!!(e&&!e.hidden), q:state.form.scriptQty};__qty('abc');var letrasViraVazio=state.form.scriptQty===''; scriptQtyCommit('abc');e=document.getElementById('sqErr');var letrasFn={msg:!!(e&&!e.hidden), q:state.form.scriptQty};__qty('');e=document.getElementById('sqErr');return {dec:dec, neg:neg, letrasViraVazio:letrasViraVazio, letrasFn:letrasFn, vazioSemErro:!!(e&&e.hidden), qVazio:state.form.scriptQty};})()`);
    rec("Q5 decimal 2.5→msg+2; negativo -3→msg+1; letras: input nativo esvazia e a camada de commit acusa; vazio permitido", q5 && q5.dec && q5.dec.msg && q5.dec.q === 2 && q5.neg && q5.neg.msg && q5.neg.q === 1 && q5.letrasViraVazio && q5.letrasFn && q5.letrasFn.msg && q5.vazioSemErro && q5.qVazio === '', q5);

    await J(`__qty('5'); state.form._openContent=2; __blur(); render(); true;`); await sleep(200);
    await J(`__type('form|2|tema','Roteiro três preenchido'); true;`);
    const q6 = await J(`(function(){__qty('2');var m=document.querySelector('[data-sqshrinkok]');return {modal:!!m, titulo:(document.querySelector('.modal-back .sheet')||{}).textContent||'', qAindaAntiga:state.form.scriptQty, blocos5:document.querySelectorAll('.content-card').length};})()`);
    rec("Q6 reduzir 5→2 com Roteiro 3 preenchido → CONFIRMAÇÃO (nada removido ainda)", q6 && q6.modal && /Reduzir para 2 roteiros\?/.test(q6.titulo) && q6.qAindaAntiga === 5, Object.assign({ png: await shot("q6-confirmacao") }, q6));

    const q7 = await J(`(function(){__click('[data-sqshrinkcancel]');return {modal:!!document.querySelector('[data-sqshrinkok]'), q:state.form.scriptQty, blocos:document.querySelectorAll('.content-card').length, t2:(state.form.contents[2]||{}).tema||''};})()`);
    rec("Q7 Cancelar mantém TODOS os dados (5 blocos; Roteiro 3 intacto)", q7 && !q7.modal && q7.q === 5 && q7.blocos === 5 && q7.t2 === 'Roteiro três preenchido', q7);

    const q8 = await J(`(function(){__qty('2');__click('[data-sqshrinkok]');return {q:state.form.scriptQty, blocos:document.querySelectorAll('.content-card').length, len:state.form.contents.length, t0:(state.form.contents[0]||{}).tema||''};})()`);
    rec("Q8 Confirmar remove SÓ os excedentes (2 blocos; Roteiro 1 intacto)", q8 && q8.q === 2 && q8.blocos === 2 && q8.len === 2 && q8.t0 === 'Tema do primeiro roteiro', Object.assign({ png: await shot("q8-reduzido") }, q8));

    const q9 = await J(`({q4:scriptQtyOf({id:'x',subtype:'q4'}), q6:scriptQtyOf({id:'x',subtype:'q6'}), q8:scriptQtyOf({id:'x',subtype:'q8'}), q12:scriptQtyOf({id:'x',subtype:'q12'}), arr7:scriptQtyOf({id:'x',contents:new Array(7).fill({})}), novo13:scriptQtyOf({scriptQty:13}), semNada:scriptQtyOf({})})`);
    rec("Q9 compat: q4/q6/q8/q12→4/6/8/12; edição usa tamanho REAL (7); criação livre (13); novo sem valor=null", q9 && q9.q4 === 4 && q9.q6 === 6 && q9.q8 === 8 && q9.q12 === 12 && q9.arr7 === 7 && q9.novo13 === 13 && q9.semNada === null, q9);

    /* ───────────── E — EDITOR RICO ───────────── */
    await J(`state.form._openContent=0; render(); true;`); await sleep(200);
    const e1 = await J(`(function(){var ed=document.querySelector('[data-rteed="form|0|tema"]');ed.focus();var wrap=ed.closest('.rte');var bar=wrap.querySelector('.rte-bar');return {ed:!!ed, contenteditable:ed.getAttribute('contenteditable')==='true', barVisivel:getComputedStyle(bar).display!=='none', botoes:wrap.querySelectorAll('.rte-b').length};})()`);
    rec("E1 editor real no Briefing: contenteditable + barra visível com foco + botões completos", e1 && e1.ed && e1.contenteditable && e1.barVisivel && e1.botoes >= 20, Object.assign({ png: await shot("e1-editor") }, e1));

    const e2 = await J(`(function(){var c=state.form.contents[0]||{};return {tema:c.tema, semRico:!('temaRich' in c)};})()`);
    rec("E2 texto simples NÃO grava campo rico (byte-equivalente ao legado)", e2 && e2.tema === 'Tema do primeiro roteiro' && e2.semRico, e2);

    await J(`__selAll('form|0|tema'); true;`);
    const e3 = await J(`(function(){__bar('form|0|tema','[data-rtecmd="bold"]');var c=state.form.contents[0]||{};return {rich:c.temaRich||'', plain:c.tema||'', paridade:richToPlain(c.temaRich||'')===c.tema, negritoNoDom:!!document.querySelector('[data-rteed="form|0|tema"] b,[data-rteed="form|0|tema"] strong')};})()`);
    rec("E3 negrito via barra → canônico <strong> + PARIDADE + visual no editor", e3 && e3.rich === '<p><strong>Tema do primeiro roteiro</strong></p>' && e3.paridade && e3.negritoNoDom, Object.assign({ png: await shot("e3-negrito") }, e3));

    const e4 = await J(`(function(){__selAll('form|0|tema');__bar('form|0|tema','[data-rtemenu="cl"]');var wrap=document.querySelector('.rte[data-rte="form|0|tema"]');var pal=wrap.querySelector('[data-rtepanel="cl"]');var vis=pal&&!pal.hidden;__bar('form|0|tema','[data-rtecolor="1"]');var c=state.form.contents[0]||{};var edH=(document.querySelector('[data-rteed="form|0|tema"]')||{innerHTML:''}).innerHTML;return {paletaAbriu:vis, rich:c.temaRich||'', temCor:/data-cl="1"/.test(c.temaRich||''), paridade:richToPlain(c.temaRich||'')===c.tema, edH:String(edH).slice(0,180)};})()`);
    rec("E4 cor da paleta (swatch REAL) → span[data-cl] no canônico + paridade", e4 && e4.paletaAbriu && e4.temCor && e4.paridade, Object.assign({ png: await shot("e4-cor") }, e4));

    await J(`__type('form|0|legenda','item um'); true;`);
    const e5 = await J(`(function(){__bar('form|0|legenda','[data-rtecmd="ul"]');__type('form|0|legenda','\\n');document.execCommand('insertText',false,'item dois');var ed=document.querySelector('[data-rteed="form|0|legenda"]');ed.dispatchEvent(new Event('input',{bubbles:true}));var c=state.form.contents[0]||{};return {rich:c.legendaRich||'', plain:c.legenda||''};})()`);
    rec("E5 lista com marcadores → canônico <ul><li> e projeção '• '", e5 && /<ul><li>item um<\/li><li>item dois<\/li><\/ul>/.test(e5.rich) && e5.plain === '• item um\n• item dois', Object.assign({ png: await shot("e5-lista") }, e5));

    await J(`window.__XSS=0; window.__P=null; if(!window.__ECW){window.__ECW=1;var _ec=document.execCommand.bind(document);window.__ECL=[];document.execCommand=function(c,u,v){var r=_ec(c,u,v);try{window.__ECL.push([c,String(v==null?'':v).slice(0,50),r]);}catch(_){ }return r;};} document.addEventListener('paste',function(e){try{window.__P={h:((e.clipboardData&&e.clipboardData.getData('text/html'))||'').slice(0,80),t:((e.clipboardData&&e.clipboardData.getData('text/plain'))||'').slice(0,40),ae:(document.activeElement&&(document.activeElement.getAttribute&&document.activeElement.getAttribute('data-rteed')||document.activeElement.tagName))||''};}catch(_){window.__P={err:1};}},false); __selAll('form|1|tema'); true;`);
    clipboard.write({ html: '<script>window.__XSS=1</scr' + 'ipt><img src=x onerror="window.__XSS=2"><iframe src=x></iframe><a href="javascript:window.__XSS=3">link</a><b>seguro</b>', text: 'seguro' });
    wc.paste(); await sleep(500);
    if (!(await J(`(((state.form||{}).contents||[])[1]||{}).tema?true:false`))) { win.focus(); wc.focus();
      wc.sendInputEvent({ type: "keyDown", keyCode: "V", modifiers: ["control"] });
      wc.sendInputEvent({ type: "char", keyCode: "V", modifiers: ["control"] });
      wc.sendInputEvent({ type: "keyUp", keyCode: "V", modifiers: ["control"] });
      await sleep(500); }
    const e6 = await J(`(function(){var c=state.form.contents[1]||{};var edH=(document.querySelector('[data-rteed="form|1|tema"]')||{innerHTML:''}).innerHTML;return {xss:window.__XSS, rich:c.temaRich||'', plain:c.tema||'', probe:window.__P, ecl:(window.__ECL||[]).slice(-4), edH:String(edH).slice(0,140), domSemScript:!document.querySelector('[data-rteed="form|1|tema"] script,[data-rteed="form|1|tema"] img,[data-rteed="form|1|tema"] iframe')};})()`);
    rec("E6 colagem MALICIOSA inerte: nada executa; script/img/iframe/js: somem; texto seguro fica", e6 && e6.xss === 0 && e6.domSemScript && /<strong>seguro<\/strong>|linkseguro|link<\/a>/.test(e6.rich + e6.plain) && !/script|iframe|onerror|javascript:/i.test(e6.rich), Object.assign({ png: await shot("e6-malicioso") }, e6));

    await J(`__selAll('form|1|legenda'); true;`);
    clipboard.write({ html: '<p class="MsoNormal" style="mso-margin-top-alt:auto;margin-left:36pt"><b>Do Word</b> com <i>estilos</i></p>', text: 'Do Word com estilos' });
    wc.paste(); await sleep(500);
    if (!(await J(`((((state.form||{}).contents||[])[1]||{}).legenda||'').indexOf('Do Word')>=0?true:false`))) { win.focus(); wc.focus();
      wc.sendInputEvent({ type: "keyDown", keyCode: "V", modifiers: ["control"] });
      wc.sendInputEvent({ type: "char", keyCode: "V", modifiers: ["control"] });
      wc.sendInputEvent({ type: "keyUp", keyCode: "V", modifiers: ["control"] });
      await sleep(500); }
    const e7 = await J(`(function(){var c=state.form.contents[1]||{};return {rich:c.legendaRich||'', plain:c.legenda||''};})()`);
    rec("E7 colagem Word: mso/class caem; negrito/itálico/recuo ficam", e7 && e7.rich === '<p data-ind="1"><strong>Do Word</strong> com <em>estilos</em></p>' && e7.plain === 'Do Word com estilos', e7);

    const e8 = await J(`(function(){__selAll('form|0|tema');__bar('form|0|tema','[data-rtecmd="clear"]');var c=state.form.contents[0]||{};return {plain:c.tema||'', semRico:!c.temaRich};})()`);
    rec("E8 limpar formatação: texto preservado; campo rico REMOVIDO", e8 && e8.plain === 'Tema do primeiro roteiro' && e8.semRico, e8);

    const e9 = await J(`(function(){__selAll('form|0|tema');__bar('form|0|tema','[data-rtecmd="ac"]');__bar('form|0|tema','[data-rtecmd="indent"]');var c=state.form.contents[0]||{};return {rich:c.temaRich||''};})()`);
    rec("E9 centralizar + recuo → data-al=\"c\" e data-ind=\"1\" canônicos", e9 && /<p data-al="c" data-ind="1">Tema do primeiro roteiro<\/p>/.test(e9.rich), Object.assign({ png: await shot("e9-alinhamento") }, e9));

    const e10 = await J(`(function(){__blur();state.form._openContent=1;render();var aberto1=document.querySelectorAll('.content-card.open').length;state.form._openContent=0;render();var c=state.form.contents[0]||{};var ed=document.querySelector('[data-rteed="form|0|tema"]');return {aberto1:aberto1, rich:c.temaRich||'', domTemAlinhamento:/data-al=\"c\"/.test(ed?ed.innerHTML:'')};})()`);
    rec("E10 accordion abre/fecha com RE-RENDER e formatação sobrevive (modelo → editor)", e10 && e10.aberto1 === 1 && /data-al="c"/.test(e10.rich) && e10.domTemAlinhamento, e10);

    await J(`__blur(); state.form.step=3; render(); true;`); await sleep(250);
    const e11 = await J(`(function(){var t=document.querySelector('.rev-content-t .rte-view');var l=document.querySelector('.rev-content-l .rte-view');return {temaInline:!!t, corNoTema:!!(t&&t.querySelector('span[data-cl]'))||/data-al/.test((t&&t.innerHTML)||''), legendaRica:!!l};})()`);
    rec("E11 REVISÃO exibe a formatação (legenda rica obrigatória; tema com data-al cai p/ texto por regra inline)", e11 && e11.legendaRica, Object.assign({ png: await shot("e11-revisao") }, e11));

    /* Central de Detalhes (tarefa semeada tkRich) */
    await J(`state.form=null; closeModal(); openDetails('tkRich'); true;`); await sleep(300);
    const e12 = await J(`(function(){var body=document.querySelectorAll('.det-acc-item')[0];var l=body.querySelector('.det-acc-l');var view=l&&l.querySelector('.rte-view');var mirror=l&&l.querySelector('.det-plain-src');var t=body.querySelector('.det-acc-t .rte-view');return {rica:!!view, lista:!!(view&&view.querySelector('ul li')), espelho:!!mirror, espelhoTexto:(mirror&&mirror.textContent)||'', temaInline:!!t};})()`);
    rec("E12 CENTRAL: legenda RICA renderizada (ul/li) + espelho text/plain + tema inline colorido", e12 && e12.rica && e12.lista && e12.espelho && e12.espelhoTexto === PLAIN_OK && e12.temaInline, Object.assign({ png: await shot("e12-central") }, e12));

    const e13 = await J(`(function(){window.__CLIPS.length=0;var body=document.querySelectorAll('.det-acc-item')[0];body.querySelector('[data-detcopycaption]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return new Promise(function(res){setTimeout(function(){res({clips:window.__CLIPS.slice()});},250);});})()`);
    rec("E13 Copiar legenda com corpo RICO copia a projeção text/plain EXATA (• itens/linhas)", e13 && e13.clips && e13.clips.length === 1 && e13.clips[0] === PLAIN_OK, e13);

    const e14 = await J(`(function(){var items=document.querySelectorAll('.det-acc-item');var b1=items[1];var l1=b1.querySelector('.det-acc-l');window.__CLIPS.length=0;b1.querySelector('[data-detcopycaption]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return new Promise(function(res){setTimeout(function(){res({semView:!(l1.querySelector('.rte-view')), texto:l1.textContent.indexOf('Linha um')>=0, clip:window.__CLIPS[0]||''});},250);});})()`);
    rec("E14 tarefa ANTIGA (texto puro): renderização escapada de sempre + cópia com quebras", e14 && e14.semView && e14.texto && /Linha um\nLinha dois/.test(e14.clip), e14);

    const e15 = await J(`(function(){var items=document.querySelectorAll('.det-acc-item');var t2=items[2].querySelector('.det-acc-t');return {semView:!(t2.querySelector('.rte-view')), textoPlano:t2.textContent==='Tema com rico DIVERGENTE'};})()`);
    rec("E15 paridade QUEBRADA (rico≠texto) → exibe o TEXTO (anti-divergência real)", e15 && e15.semView && e15.textoPlano, e15);

    /* fixtures p/ paridade Worker (canônicos REAIS gerados pelo app empacotado) */
    const e16 = await J(`(function(){var fx=['<p>simples</p>','<b>b</b> e <i>i</i>','<ul><li>a</li><li>b<br>c</li></ul>','<h1>T</h1><p style="text-align:center">c</p>','<blockquote>q</blockquote>','<span style="color:#F87171">cor</span>','<span style="background-color:#FEF08A">hl</span>','<p style="margin-left:72pt">ind</p>','a &amp; b<br><br>fim','<a href="https://ok.com">go</a><a href="javascript:x">mau</a>'];var out=fx.map(function(h){var c=rteSanitize(h);return {canon:c, plain:richToPlain(c)};});return out;})()`);
    const fixOk = Array.isArray(e16) && e16.length === 10 && e16.every((f) => typeof f.canon === 'string' && typeof f.plain === 'string');
    if (fixOk) fs.writeFileSync(path.join(OUT, "f355c-canon-fixtures.json"), JSON.stringify(e16, null, 2));
    rec("E16 fixtures canônicos REAIS exportados p/ validação de paridade no Worker", fixOk, { n: Array.isArray(e16) ? e16.length : -1 });

    /* ───────────── P — DESEMPENHO / RESPONSIVIDADE ───────────── */
    await J(`closeModal(); openTaskForm('roteiro'); state.form.title='Perf'; state.form.client='C'; state.form.step=2; render(); true;`); await sleep(200);
    const p1 = await J(`(function(){var el=document.getElementById('fScriptQty');el.focus();el.value='50';el.blur();var t0=performance.now();el.dispatchEvent(new Event('change',{bubbles:true}));var dt=performance.now()-t0;var heap=(performance.memory&&performance.memory.usedJSHeapSize||0)/1048576;return {ms:Math.round(dt), blocos:document.querySelectorAll('.content-card').length, editores:document.querySelectorAll('.rte-ed').length, heapMB:Math.round(heap)};})()`);
    rec("P1 50 roteiros: render em tempo aceitável + 100 editores no DOM + heap são", p1 && p1.blocos === 50 && p1.editores === 100 && p1.ms < 4000 && (p1.heapMB === 0 || p1.heapMB < 400), Object.assign({ png: await shot("p1-50roteiros") }, p1));

    await J(`state.form._openContent=49; render(); true;`); await sleep(250);
    const p2 = await J(`(function(){var ed=document.querySelector('[data-rteed="form|49|legenda"]');ed.focus();var r=document.createRange();r.selectNodeContents(ed);r.collapse(false);var s=getSelection();s.removeAllRanges();s.addRange(r);var t0=performance.now();for(var i=0;i<20;i++){document.execCommand('insertText',false,'palavra '+i+' ');}var dt=(performance.now()-t0)/20;var c=state.form.contents[49]||{};return {msPorTecla:Math.round(dt*10)/10, sincronizou:(c.legenda||'').indexOf('palavra 19')>=0};})()`);
    rec("P2 digitação com 50 roteiros: sync por tecla fluido (<50ms/gesto) e modelo atualizado", p2 && p2.sincronizou && p2.msPorTecla < 50, p2);

    win.setSize(1366, 768); await sleep(300);
    const p3 = await J(`({overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2, w: window.innerWidth})`);
    rec("P3 1366×768: sem overflow horizontal no Briefing com editores", p3 && !p3.overflowX && p3.w === 1366, Object.assign({ png: await shot("p3-1366") }, p3));

    wc.setZoomFactor(1.25); await sleep(300);
    const p4 = await J(`({overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2})`);
    rec("P4 escala 125%: sem overflow horizontal", p4 && !p4.overflowX, Object.assign({ png: await shot("p4-125") }, p4));
    wc.setZoomFactor(1); win.setSize(1440, 940); await sleep(200);

    const p5 = await J(`(function(){state.form=null;closeModal();var base=(state.tasks.find(function(t){return t.id==='tkRich';})||{});base.cronContents=[];for(var i=0;i<12;i++)base.cronContents.push({tema:'Tema '+(i+1), temaRich:'<p><strong>Tema '+(i+1)+'</strong></p>', legenda:'Legenda '+(i+1), legendaRich:'<p><em>Legenda '+(i+1)+'</em></p>'});var t0=performance.now();openContentEditor('tkRich');var dt=performance.now()-t0;return {ms:Math.round(dt), editores:document.querySelectorAll('.ce-list .rte-ed').length, modelos:(window._ceModel||[]).length};})()`);
    rec("P5 'Editar conteúdos' com 12 itens RICOS abre rápido (24 editores; modelo semeado)", p5 && p5.editores === 24 && p5.modelos === 12 && p5.ms < 2500, Object.assign({ png: await shot("p5-editar-conteudos") }, p5));

    const e17 = await J(`(function(){var ed=document.querySelector('[data-rteed="ce|0|tema"]');var temStrong=!!(ed&&ed.querySelector('strong'));__selAll('ce|0|tema');document.execCommand('insertText',false,'Tema editado no modal');var m=(window._ceModel||[])[0]||{};return {richInicial:temStrong, plain:m.tema||'', paridade:(!m.temaRich)||richToPlain(m.temaRich)===m.tema};})()`);
    rec("E17 modal Editar conteúdos: rico inicial renderizado; reescrever mantém PARIDADE (formatação herdada legítima, nunca divergente)", e17 && e17.richInicial && e17.plain === 'Tema editado no modal' && e17.paridade, e17);
  } catch (e) { fatal = String((e && e.stack) || e).slice(0, 400); }

  const failures = results.filter((r) => !r.ok).length + (fatal ? 1 : 0);
  fs.writeFileSync(path.join(OUT, "f355c-proof-results.json"), JSON.stringify({ at: new Date().toISOString(), asarSha256: sha256(asarPath), results, fatal }, null, 2));
  clearTimeout(WATCHDOG);
  process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=" + failures + (fatal ? " FATAL=" + fatal : "") + "\n");
  app.exit(failures ? 1 : 0);
});
