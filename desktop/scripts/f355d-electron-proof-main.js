/* F3.5.5D — PROVAS REAIS (Electron 31.3.1; app EMPACOTADO em app.asar; xvfb).
 * Empacota o renderer REAL em app.asar, carrega DO ASAR numa BrowserWindow real com o preload
 * de semente (f355d-proof-preload.js) e exercita o CÓDIGO DE PRODUÇÃO. O main DESTE harness
 * registra os MESMOS IPCs de clipboard do main.ts (clipboard-read-text/clipboard-read-html)
 * e liga o MÓDULO DE PRODUÇÃO dist/main/editContextMenu.js ao webContents (Menu injetado em
 * modo captura — o template/gating provados são os de produção; popup visual não é medível
 * em xvfb). Colagens usam o CLIPBOARD REAL do Electron (clipboard.writeText/write) e os
 * atalhos reais interceptados pelo pipeline universal (KeyboardEvent em captura).
 * Sem IA, sem mockup, sem HTML isolado.
 *
 * C1 stepper 'Quantidade de temas' sem chips   C2 digitar 7 → 7 conteúdos     C3 [+][+] preserva
 * C4 reduzir c/ conteúdo → confirmação          C5 cancelar mantém             C6 confirmar corta só excedentes
 * C7 zero/letras/decimal/vazio-ao-avançar       C8 compat legado+fallback      C9 COLAR número (válido/ inválido)
 * U1 Ctrl+V título (campo simples)              U2 Shift+Insert observações    U3 substitui seleção no meio
 * U4 Ctrl+V rte Word sanitizado                 U5 Ctrl+V rte Google Docs      U6 malicioso REAL bloqueado
 * U7 menu de contexto NATIVO (produção)         U8 colar por setor (5)         U9 Revisão preserva
 * U10 tarefa antiga preservada + reabertura     U11 fixture payload portal     U12 125%  U13 150%  U14 1366×768
 * U15 readOnly/disabled intocados               U16 Ctrl+V fora de campo = nada */
const { app, BrowserWindow, session, clipboard, ipcMain, Menu } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f355d-qa");
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
const seed = (() => {
  const self = { id: ID.ANA, name: "Ana Beatriz Social Media", role: "Social Media", admin: false, status: "ativo" };
  const users = [self,
    { id: ID.MARINA, name: "Marina Administradora", role: "Administrador", admin: true, status: "ativo" },
    { id: ID.DIEGO, name: "Diego Fernandes Designer", role: "Designer", status: "ativo" }];
  const tk = (x) => Object.assign({ by: ID.ANA, createdAt: NOW, history: [], checklist: [] }, x);
  const tasks = [
    tk({ id: "tkOldSem", sector: "cronograma", status: "afazer", title: "Cronograma legado semanal", client: "Ótica Clara",
      subtype: "semanal", cronSub: "semanal",
      cronContents: [{ tema: "Tema antigo 1", legenda: "Legenda antiga 1" }, { tema: "Tema antigo 2", legenda: "Legenda antiga 2" }, { tema: "Tema antigo 3", legenda: "Legenda antiga 3" }] }),
  ];
  return { self, users, tasks, events: [] };
})();

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();

let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f355d-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f355d-app.asar");
  try { fs.rmSync(asarPath, { force: true }); } catch (_) {}
  await asar.createPackage(stage, asarPath);
  return { stageIndexSha: sha256(path.join(rdir, "index.html")) };
}

const results = [];
function rec(name, ok, info) { results.push({ name, ok: !!ok, info: info || {} }); line({ proof: name, ok: !!ok, info: info || {} }); }

app.whenReady().then(async () => {
  const WATCHDOG = setTimeout(() => { try { process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=999 FATAL=watchdog_timeout_12min\n"); } catch (_) {} app.exit(1); }, 12 * 60 * 1000);
  try { session.defaultSession.webRequest.onBeforeRequest((d, cb) => { cb({ cancel: /^https?:/i.test(d.url) }); }); } catch (_) {}
  const meta = await packAsar();
  fs.writeFileSync(path.join(os.tmpdir(), "f355d-seed.json"), JSON.stringify(seed));

  /* ── MESMOS IPCs de clipboard do main.ts (produção) ── */
  ipcMain.handle("clipboard-read-text", () => { try { return String(clipboard.readText() || ""); } catch { return ""; } });
  ipcMain.handle("clipboard-read-html", () => { try { return String(clipboard.readHTML() || ""); } catch { return ""; } });

  const win = new BrowserWindow({ width: 1440, height: 940, show: true, webPreferences: {
    preload: path.join(__dirname, "f355d-proof-preload.js"),
    contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  const wc = win.webContents;
  wc.on("console-message", (_e, lvl, msg) => { if (lvl >= 2) line({ console: String(msg).slice(0, 260) }); });
  wc.on("render-process-gone", (_e, d) => { line({ rendererGone: (d && d.reason) || "?" }); });
  const J = (code) => wc.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));
  const SHOTS = process.env.PROOF_SHOTS !== '0';
  async function shot(nm) { try {
    if (!SHOTS) return 'skipped';
    await sleep(150);
    const img = await Promise.race([win.capturePage(), new Promise((_, rej) => setTimeout(() => rej(new Error("capture_timeout")), 8000))]);
    const p = path.join(OUT, nm + ".png"); fs.writeFileSync(p, img.toPNG()); return path.basename(p);
  } catch (e) { return "pngErr:" + String((e && e.message) || e); } }

  /* ── MÓDULO DE PRODUÇÃO do menu de contexto (dist), Menu em modo CAPTURA ── */
  const ecm = require(path.join(__dirname, "..", "dist", "main", "editContextMenu.js"));
  let lastMenu = null; let menuShownCount = 0;
  ecm.attachEditContextMenu(wc, { Menu: { buildFromTemplate: (t) => ({ popup: () => { lastMenu = t; menuShownCount++; } }) },
    onLog: (evt, p) => line({ ctxlog: evt, p: p || {} }) });

  let fatal = null;
  try {
    await win.loadFile(path.join(asarPath, "src", "renderer", "index.html"));
    let boot = null;
    for (let i = 0; i < 300; i++) { await sleep(500);
      boot = await J(`({app: !!document.getElementById('app'), user: !!(window.state&&state.user), tasks: (window.state&&state.tasks&&state.tasks.length)||0})`);
      if (boot && boot.tasks === 1) break; }
    rec("BOOT app.asar carregado (semente consumida nas provas U9/U10)", boot && boot.app, Object.assign({ asarSha: sha256(asarPath).slice(0, 16), srcSha: meta.stageIndexSha.slice(0, 16) }, boot));

    /* helpers (produção intocada; só ATALHOS de teste) */
    await J(`window.__click=function(sel){var el=document.querySelector(sel);if(!el)return 'no:'+sel;el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return 'ok';};
      window.__type=function(key,txt){var ed=document.querySelector('[data-rteed="'+key+'"]');if(!ed)return 'no-ed';ed.focus();var r=document.createRange();r.selectNodeContents(ed);r.collapse(false);var s=getSelection();s.removeAllRanges();s.addRange(r);document.execCommand('insertText',false,txt);return 'ok';};
      window.__cqty=function(v){var el=document.getElementById('fCronQty');if(!el)return 'no-qty';el.focus();el.value=v;el.blur();el.dispatchEvent(new Event('change',{bubbles:true}));return 'ok';};
      window.__kv=function(sel,opts){var el=(typeof sel==='string')?document.querySelector(sel):sel;if(!el)return 'no:'+sel;el.focus();var o=opts||{};var ev=new KeyboardEvent('keydown',{key:o.key||'v',keyCode:o.keyCode||86,ctrlKey:o.ctrl!==false&&!o.ins,shiftKey:!!o.ins,bubbles:true,cancelable:true});if(o.ins){ev=new KeyboardEvent('keydown',{key:'Insert',keyCode:45,shiftKey:true,bubbles:true,cancelable:true});}el.dispatchEvent(ev);return 'ok';};
      /* mesmo contrato do app: campo focado ADIA o render (_editingNow); o blur libera o flush */
      window.__blur=function(){try{if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();}catch(_){}try{if(typeof _deferRender!=='undefined'&&_deferRender){_deferRender=false;_deferRenderAt=0;render();}}catch(_){}return 'ok';};
      true;`);

    /* ───────────── C — CRONOGRAMA: QUANTIDADE DE TEMAS ───────────── */
    await J(`openTaskForm('cronograma'); state.form.title='Cronograma institucional'; state.form.client='Cliente Prova'; state.form.step=2; render(); true;`);
    await sleep(250);
    const c1 = await J(`({stepper: !!document.getElementById('fCronQty'), minus: !!document.querySelector('[data-cqminus]'), plus: !!document.querySelector('[data-cqplus]'), chips: document.querySelectorAll('[data-fsub]').length, label: (function(){var ls=[].slice.call(document.querySelectorAll('.lbl')).map(function(e){return e.textContent;});return ls.indexOf('Quantidade de temas')>=0;})(), semPeriodicidade: (function(){var w=document.querySelector('.form-wrap');var t=(w&&w.textContent)||'';return t.indexOf('Periodicidade')<0 && t.indexOf('Semanal')<0 && t.indexOf('Quinzenal')<0 && t.indexOf('Mensal')<0;})(), msgOculta: (function(){var e=document.getElementById('cqErr');return !!(e&&e.hidden);})(), blocos: document.querySelectorAll('.content-card').length})`);
    rec("C1 Briefing do Cronograma: 'Quantidade de temas' [−][N][+] presente; SEM chips e SEM Semanal/Quinzenal/Mensal; 0 blocos", c1 && c1.stepper && c1.minus && c1.plus && c1.chips === 0 && c1.label && c1.semPeriodicidade && c1.msgOculta && c1.blocos === 0, Object.assign({ png: await shot("f355d-c1-stepper") }, c1));

    const c2 = await J(`(function(){__cqty('7');return {q:state.form.cronQty, blocos:document.querySelectorAll('.content-card').length, rotulo:(document.querySelector('.content-card .ct')||{}).textContent||'', banner:(function(){var b=[].slice.call(document.querySelectorAll('div')).map(function(e){return e.textContent;});return b.some(function(t){return /Cronograma — 7 conteúdos/.test(t);});})()};})()`);
    rec("C2 digitar 7 + change → cronQty=7, 7 blocos 'Conteúdo N' e formTitle 'Cronograma — 7 conteúdos'", c2 && c2.q === 7 && c2.blocos === 7 && /Conteúdo 1/.test(c2.rotulo) && c2.banner, Object.assign({ png: await shot("f355d-c2-sete") }, c2));

    await J(`state.form._openContent=0; render(); true;`); await sleep(200);
    await J(`__type('form|0|tema','Tema do primeiro conteúdo'); true;`);
    const c3 = await J(`(function(){try{if(document.activeElement)document.activeElement.blur();}catch(_){ } __click('[data-cqplus]');__click('[data-cqplus]');return {q:state.form.cronQty, blocos:document.querySelectorAll('.content-card').length, t0:(state.form.contents[0]||{}).tema||'', vazio8:!(state.form.contents[7]&&state.form.contents[7].tema)};})()`);
    rec("C3 [+][+] 7→9 preserva o Conteúdo 1 e cria vazios (sem reordenar/perder)", c3 && c3.q === 9 && c3.blocos === 9 && c3.t0 === 'Tema do primeiro conteúdo' && c3.vazio8, Object.assign({ png: await shot("f355d-c3-aumentar") }, c3));

    await J(`__blur(); state.form._openContent=2; render(); true;`); await sleep(200);
    await J(`__type('form|2|tema','Conteúdo três preenchido'); true;`);
    const c4 = await J(`(function(){__blur();__cqty('2');var m=document.querySelector('[data-cqshrinkok]');return {modal:!!m, titulo:(document.querySelector('.modal-back .sheet')||{}).textContent||'', qAindaAntiga:state.form.cronQty, blocos9:document.querySelectorAll('.content-card').length};})()`);
    rec("C4 reduzir 9→2 com conteúdo preenchido → CONFIRMAÇÃO explícita (nada removido ainda)", c4 && c4.modal && /Reduzir para 2 conteúdos\?/.test(c4.titulo) && /1 conteúdo preenchido/.test(c4.titulo) && c4.qAindaAntiga === 9, Object.assign({ png: await shot("f355d-c4-confirmacao") }, c4));

    const c5 = await J(`(function(){__click('[data-cqshrinkcancel]');return {modal:!!document.querySelector('[data-cqshrinkok]'), q:state.form.cronQty, blocos:document.querySelectorAll('.content-card').length, t0:(state.form.contents[0]||{}).tema||'', t2:(state.form.contents[2]||{}).tema||''};})()`);
    rec("C5 Cancelar mantém TODOS os dados (9 blocos; Conteúdos 1 e 3 intactos)", c5 && !c5.modal && c5.q === 9 && c5.blocos === 9 && c5.t0 === 'Tema do primeiro conteúdo' && c5.t2 === 'Conteúdo três preenchido', c5);

    const c6 = await J(`(function(){__blur();__cqty('2');__click('[data-cqshrinkok]');return {q:state.form.cronQty, blocos:document.querySelectorAll('.content-card').length, len:state.form.contents.length, t0:(state.form.contents[0]||{}).tema||''};})()`);
    rec("C6 Confirmar remove SÓ os excedentes (2 blocos; Conteúdo 1 intacto)", c6 && c6.q === 2 && c6.blocos === 2 && c6.len === 2 && c6.t0 === 'Tema do primeiro conteúdo', Object.assign({ png: await shot("f355d-c6-reduzido") }, c6));

    const c7 = await J(`(function(){__cqty('0');var e=document.getElementById('cqErr');var zero={msg:!!(e&&!e.hidden), texto:(e&&e.textContent)||'', q:state.form.cronQty};cronQtyCommit('abc');e=document.getElementById('cqErr');var letras={msg:!!(e&&!e.hidden), q:state.form.cronQty};__cqty('3.5');e=document.getElementById('cqErr');var dec={msg:!!(e&&!e.hidden), q:state.form.cronQty};__cqty('');var stepAntes=state.form.step;stepNext();e=document.getElementById('cqErr');return {zero:zero, letras:letras, dec:dec, vazioAvancarBloqueado:(state.form.step===stepAntes), msgVazio:!!(e&&!e.hidden)};})()`);
    rec("C7 zero→msg+1; letras→msg; decimal→msg+piso; VAZIO ao avançar → bloqueia com a mensagem literal", c7 && c7.zero && c7.zero.msg && c7.zero.texto === 'Informe uma quantidade inteira igual ou superior a 1.' && c7.zero.q === 1 && c7.letras && c7.letras.msg && c7.dec && c7.dec.msg && c7.dec.q === 3 && c7.vazioAvancarBloqueado && c7.msgVazio, Object.assign({ png: await shot("f355d-c7-validacao") }, c7));

    const c8 = await J(`({sem:cronQtyOf({id:'x',subtype:'semanal'}), qui:cronQtyOf({id:'x',subtype:'quinzenal'}), men:cronQtyOf({id:'x',subtype:'mensal'}), arrReal:cronQtyOf({id:'x',subtype:'semanal',contents:new Array(7).fill({})}), novo13:cronQtyOf({cronQty:13}), semNada:cronQtyOf({}), legFields:(function(){var s=synthCronSub(3,{id:'x',subtype:'semanal'});return s&&s.fields&&s.fields.some(function(f){return f.k==='semana_ref';});})(), novoFields:(function(){var s=synthCronSub(3,{});return s&&s.fields&&s.fields.some(function(f){return f.k==='periodo';})&&s.fields.some(function(f){return f.k==='canais';});})(), legTitle:(synthCronSub(5,{id:'x',subtype:'semanal'})||{}).formTitle||''})`);
    rec("C8 compat legado: semanal/quinzenal/mensal→3/6/12; edição usa tamanho REAL (7); criação livre (13); campos legados preservados na edição; novos campos neutros", c8 && c8.sem === 3 && c8.qui === 6 && c8.men === 12 && c8.arrReal === 7 && c8.novo13 === 13 && c8.semNada === null && c8.legFields && c8.novoFields && /Cronograma semanal — 5 conteúdos/.test(c8.legTitle), c8);

    clipboard.writeText("7");
    await J(`__kv('#fCronQty'); true;`); await sleep(400);
    /* mesmo contrato da DIGITAÇÃO: o valor entra na hora; os blocos materializam no blur/Tab
       (o guard aprovado _editingNow adia o re-render enquanto o campo está focado) */
    const c9a = await J(`(function(){var v=(document.getElementById('fCronQty')||{}).value;__blur();return {vNoCampo:v, q:state.form.cronQty, blocos:document.querySelectorAll('.content-card').length};})()`);
    clipboard.writeText("abc");
    await J(`__kv('#fCronQty'); true;`); await sleep(400);
    const c9b = await J(`(function(){__blur();var e=document.getElementById('cqErr');return {msg:!!(e&&!e.hidden), q:state.form.cronQty};})()`);
    rec("C9 COLAR no campo numérico: '7' via Ctrl+V (clipboard REAL) → valor no campo + 7 blocos no blur (contrato da digitação); 'abc' → mensagem visível, sem correção silenciosa", c9a && c9a.vNoCampo === '7' && c9a.q === 7 && c9a.blocos === 7 && c9b && c9b.msg, Object.assign({ png: await shot("f355d-c9-colar-numero") }, { a: c9a, b: c9b }));

    /* ───────────── U — COLAGEM UNIVERSAL ───────────── */
    await J(`__blur(); state.form.step=1; render(); true;`); await sleep(200);
    clipboard.writeText("Título colado ✓ çãé 😀");
    const u1 = await J(`(function(){var el=document.getElementById('fTitle');el.focus();el.value='';el.setSelectionRange(0,0);__kv(el);return new Promise(function(res){setTimeout(function(){res({v:el.value, model:state.form.title});},400);});})()`);
    rec("U1 Ctrl+V em campo simples (título): texto REAL do clipboard no campo + modelo atualizado (bind input)", u1 && u1.v === "Título colado ✓ çãé 😀" && u1.model === u1.v, Object.assign({ png: await shot("f355d-u1-titulo") }, u1));

    /* Observações livres NÃO existem no Cronograma (decisão aprovada 1.0.137 — isClientSector);
       o textarea fObs é provado no setor Edição de Vídeos, onde ele existe de verdade. */
    await J(`(function(){__blur();state.form=null;closeModal();openTaskForm('edicao_midia');state.form.title='Obs';state.form.client='C';state.form.step=2;render();return true;})()`); await sleep(250);
    clipboard.writeText("Linha um\nLinha dois com ç e 🚀");
    const u2 = await J(`(function(){var el=document.getElementById('fObs');if(!el)return {noObs:1};el.focus();el.value='';__kv(el,{ins:true});return new Promise(function(res){setTimeout(function(){res({v:el.value, model:state.form.obs, quebras:(el.value.match(/\\n/g)||[]).length});},400);});})()`);
    rec("U2 Shift+Insert em textarea (observações): quebras/acentos/emojis preservados + modelo atualizado", u2 && u2.v === "Linha um\nLinha dois com ç e 🚀" && u2.model === u2.v && u2.quebras === 1, Object.assign({ png: await shot("f355d-u2-obs") }, u2));

    clipboard.writeText("colado");
    const u3 = await J(`(function(){var el=document.getElementById('fObs');if(!el)return {noObs:1};el.focus();el.value='Hello mundo';el.dispatchEvent(new Event('input',{bubbles:true}));el.setSelectionRange(6,11);__kv(el);return new Promise(function(res){setTimeout(function(){res({v:el.value, cursor:el.selectionStart});},400);});})()`);
    rec("U3 colagem SUBSTITUI a seleção no meio da frase e posiciona o cursor após o texto", u3 && u3.v === 'Hello colado' && u3.cursor === 12, u3);

    await J(`(function(){__blur();state.form=null;closeModal();openTaskForm('cronograma');state.form.title='Cron RTE';state.form.client='C';state.form.step=2;render();return true;})()`); await sleep(250);
    await J(`__cqty('2'); state.form._openContent=0; render(); true;`); await sleep(200);
    clipboard.write({ text: "Do Word com estilos", html: '<p class="MsoNormal" style="mso-margin-top-alt:auto;margin-left:36pt"><b>Do Word</b> com <i>estilos</i></p>' });
    const u4 = await J(`(function(){var ed=document.querySelector('[data-rteed="form|0|legenda"]');ed.focus();var r=document.createRange();r.selectNodeContents(ed);var s=getSelection();s.removeAllRanges();s.addRange(r);__kv(ed);return new Promise(function(res){setTimeout(function(){var c=state.form.contents[0]||{};res({rich:c.legendaRich||'', plain:c.legenda||''});},600);});})()`);
    rec("U4 Ctrl+V no EDITOR RICO com HTML do Word (clipboard REAL): mso/class caem; negrito/itálico/recuo ficam; projeção texto", u4 && u4.rich === '<p data-ind="1"><strong>Do Word</strong> com <em>estilos</em></p>' && u4.plain === 'Do Word com estilos', Object.assign({ png: await shot("f355d-u4-word") }, u4));

    clipboard.write({ text: "Do Docs em negrito", html: '<b id="docs-internal-guid-abc123" style="font-weight:normal"><p dir="ltr" style="line-height:1.38"><span style="font-size:11pt;font-family:Arial;font-weight:700;font-style:normal">Do Docs em negrito</span></p></b>' });
    const u5 = await J(`(function(){var ed=document.querySelector('[data-rteed="form|1|legenda"]');state.form._openContent=1;render();ed=document.querySelector('[data-rteed="form|1|legenda"]');ed.focus();var r=document.createRange();r.selectNodeContents(ed);var s=getSelection();s.removeAllRanges();s.addRange(r);__kv(ed);return new Promise(function(res){setTimeout(function(){var c=state.form.contents[1]||{};res({rich:c.legendaRich||'', plain:c.legenda||'', semGuid:!/docs-internal-guid|font-family|font-size/.test(c.legendaRich||''), negrito:/<strong>/.test(c.legendaRich||'')});},600);});})()`);
    rec("U5 Ctrl+V do Google Docs: lixo técnico (guid/font-family/font-size) cai; semântica de negrito preservada; texto correto", u5 && u5.plain === 'Do Docs em negrito' && u5.semGuid && u5.negrito, Object.assign({ png: await shot("f355d-u5-docs") }, u5));

    clipboard.write({ text: "seguro", html: '<script>window.__XSS=1</scr' + 'ipt><img src=x onerror="window.__XSS=2"><iframe src=x></iframe><a href="javascript:window.__XSS=3">link</a><b>seguro</b>' });
    const u6 = await J(`(function(){window.__XSS=0;var ed=document.querySelector('[data-rteed="form|0|tema"]');state.form._openContent=0;render();ed=document.querySelector('[data-rteed="form|0|tema"]');ed.focus();var r=document.createRange();r.selectNodeContents(ed);var s=getSelection();s.removeAllRanges();s.addRange(r);__kv(ed);return new Promise(function(res){setTimeout(function(){var c=state.form.contents[0]||{};res({xss:window.__XSS, rich:c.temaRich||'', plain:c.tema||'', domLimpo:!ed.querySelector('script,img,iframe'), semPerigo:!/script|iframe|onerror|javascript:/i.test(c.temaRich||'')});},600);});})()`);
    rec("U6 HTML MALICIOSO no clipboard REAL: nada executa; script/img/iframe/javascript: somem; texto seguro fica", u6 && u6.xss === 0 && u6.domLimpo && u6.semPerigo && /seguro/.test(u6.rich + u6.plain), Object.assign({ png: await shot("f355d-u6-malicioso") }, u6));

    /* U7 — menu de contexto NATIVO: right-click REAL no campo editável (params reais do Chromium) */
    clipboard.writeText("algo no clipboard");
    await J(`__blur(); state.form.step=1; render(); true;`); await sleep(200);
    /* insertText nativo ARMA o undo-stack real do Chromium (a colagem determinística via
       setRangeText não entra no undo nativo — herdado da F3.5.3 aprovada; Desfazer no menu
       reflete SEMPRE os editFlags reais) */
    const u7pos = await J(`(function(){var el=document.getElementById('fTitle');if(!el)return {no:1};el.focus();document.execCommand('insertText',false,'X');el.select();var r=el.getBoundingClientRect();return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)};})()`);
    lastMenu = null;
    if (u7pos && typeof u7pos.x === "number" && typeof u7pos.y === "number") {
      wc.sendInputEvent({ type: "mouseDown", x: u7pos.x, y: u7pos.y, button: "right", clickCount: 1 });
      wc.sendInputEvent({ type: "mouseUp", x: u7pos.x, y: u7pos.y, button: "right", clickCount: 1 });
    }
    await sleep(700);
    const m = lastMenu;
    const labels = (m || []).filter((i) => i.label).map((i) => i.label);
    const item = (lb) => (m || []).find((i) => i.label === lb) || {};
    const u7ok = !!m && labels.join("|") === "Desfazer|Refazer|Recortar|Copiar|Colar|Selecionar tudo" && item("Colar").enabled === true && item("Colar").role === "paste" && item("Copiar").enabled === true && item("Desfazer").enabled === true;
    rec("U7 MENU NATIVO (módulo de produção + right-click real): Desfazer/Refazer/Recortar/Copiar/Colar/Selecionar tudo; Colar habilitado (clipboard com texto); Copiar habilitado (seleção); Desfazer habilitado (undo REAL após colagens)", u7ok, Object.assign({ png: await shot("f355d-u7-menu") }, { labels, colar: item("Colar"), copiar: item("Copiar"), desfazer: item("Desfazer") }));

    lastMenu = null;
    const u7b = await J(`(function(){var b=document.querySelector('.footer-nav .btn');if(!b)return {no:1};var r=b.getBoundingClientRect();return {x:Math.round(r.left+8), y:Math.round(r.top+8)};})()`);
    if (u7b && typeof u7b.x === "number") {
      wc.sendInputEvent({ type: "mouseDown", x: u7b.x, y: u7b.y, button: "right", clickCount: 1 });
      wc.sendInputEvent({ type: "mouseUp", x: u7b.x, y: u7b.y, button: "right", clickCount: 1 });
    }
    await sleep(500);
    const u7NoBtn = lastMenu === null;
    lastMenu = null;
    await J(`(function(){var el=document.getElementById('fTitle');if(el)el.readOnly=true;return true;})()`);
    if (u7pos && typeof u7pos.x === "number" && typeof u7pos.y === "number") {
      wc.sendInputEvent({ type: "mouseDown", x: u7pos.x, y: u7pos.y, button: "right", clickCount: 1 });
      wc.sendInputEvent({ type: "mouseUp", x: u7pos.x, y: u7pos.y, button: "right", clickCount: 1 });
    }
    await sleep(500);
    const u7NoRO = lastMenu === null;
    await J(`(function(){var el=document.getElementById('fTitle');if(el)el.readOnly=false;return true;})()`);
    rec("U7b botão direito em BOTÃO e em campo READONLY: NENHUM menu de edição aparece", u7NoBtn && u7NoRO, { botao: u7NoBtn, readonly: u7NoRO });

    /* U15 — colagem em readOnly/disabled NÃO altera nada */
    clipboard.writeText("NAO-DEVE-ENTRAR");
    const u15 = await J(`(function(){var el=document.getElementById('fTitle');var antes=el.value;el.readOnly=true;el.focus();__kv(el);return new Promise(function(res){setTimeout(function(){var meio=el.value;el.readOnly=false;el.disabled=true;__kv(el);setTimeout(function(){var fim=el.value;el.disabled=false;res({antes:antes, meio:meio, fim:fim});},350);},350);});})()`);
    rec("U15 campo readOnly/disabled: Ctrl+V NÃO altera o valor", u15 && u15.meio === u15.antes && u15.fim === u15.antes, u15);

    /* U16 — Ctrl+V fora de campo editável: nenhuma ação indevida */
    const u16 = await J(`(function(){try{if(document.activeElement)document.activeElement.blur();}catch(_){ }var t=state.form.title;var o=state.form.obs;document.body.focus();var ev=new KeyboardEvent('keydown',{key:'v',keyCode:86,ctrlKey:true,bubbles:true,cancelable:true});document.body.dispatchEvent(ev);return new Promise(function(res){setTimeout(function(){res({tituloIgual:state.form.title===t, obsIgual:state.form.obs===o});},350);});})()`);
    rec("U16 Ctrl+V fora de campo editável: NADA muda (sem ação indevida)", u16 && u16.tituloIgual && u16.obsIgual, u16);

    /* U8 — colagem POR SETOR (uma prova por formulário) */
    clipboard.writeText("Roteiro colado por setor");
    const s1 = await J(`(function(){__blur();state.form=null;closeModal();openTaskForm('roteiro');state.form.title='R';state.form.client='C';state.form.step=2;render();var el=document.getElementById('fScriptQty');el.focus();el.value='1';el.blur();el.dispatchEvent(new Event('change',{bubbles:true}));state.form._openContent=0;render();var ed=document.querySelector('[data-rteed="form|0|tema"]');ed.focus();var r=document.createRange();r.selectNodeContents(ed);var s=getSelection();s.removeAllRanges();s.addRange(r);var ev=new KeyboardEvent('keydown',{key:'v',keyCode:86,ctrlKey:true,bubbles:true,cancelable:true});ed.dispatchEvent(ev);return new Promise(function(res){setTimeout(function(){res({tema:(state.form.contents[0]||{}).tema||''});},500);});})()`);
    clipboard.writeText("Período colado no cronograma");
    const s2 = await J(`(function(){__blur();state.form=null;closeModal();openTaskForm('cronograma');state.form.title='CR';state.form.client='C';state.form.step=2;render();var el=document.getElementById('fCronQty');el.focus();el.value='1';el.blur();el.dispatchEvent(new Event('change',{bubbles:true}));var f=document.querySelector('[data-ffield="periodo"]');f.focus();var ev=new KeyboardEvent('keydown',{key:'v',keyCode:86,ctrlKey:true,bubbles:true,cancelable:true});f.dispatchEvent(ev);return new Promise(function(res){setTimeout(function(){res({v:f.value, model:state.form.fields.periodo||''});},500);});})()`);
    clipboard.writeText("Tema de card colado");
    const s3 = await J(`(function(){__blur();state.form=null;closeModal();openTaskForm('edicao_cards');state.form.client='C';state.form.cardsQty=1;state.form.step=2;render();var f=document.querySelector('[data-cardtema]');if(!f)return {no:1};f.focus();var ev=new KeyboardEvent('keydown',{key:'v',keyCode:86,ctrlKey:true,bubbles:true,cancelable:true});f.dispatchEvent(ev);return new Promise(function(res){setTimeout(function(){res({v:f.value, model:((state.form.cards[0]||{}).tema)||''});},500);});})()`);
    clipboard.writeText("Tema de vídeo colado");
    const s4 = await J(`(function(){__blur();state.form=null;closeModal();openTaskForm('edicao_midia');state.form.title='V';state.form.client='C';state.form.step=2;render();var el=document.getElementById('fVideoQty');el.focus();el.value='1';el.blur();el.dispatchEvent(new Event('change',{bubbles:true}));var f=document.querySelector('[data-vtema="0"]');if(!f)return {no:1};f.focus();var ev=new KeyboardEvent('keydown',{key:'v',keyCode:86,ctrlKey:true,bubbles:true,cancelable:true});f.dispatchEvent(ev);return new Promise(function(res){setTimeout(function(){res({v:f.value, model:((state.form.videos[0]||{}).tema)||''});},500);});})()`);
    clipboard.writeText("Reunião colada na Agenda");
    const s5 = await J(`(function(){__blur();state.form=null;closeModal();openEventForm();var f=document.getElementById('evTitle');if(!f)return {no:1};f.focus();var ev=new KeyboardEvent('keydown',{key:'v',keyCode:86,ctrlKey:true,bubbles:true,cancelable:true});f.dispatchEvent(ev);return new Promise(function(res){setTimeout(function(){res({v:f.value});},500);});})()`);
    rec("U8 colagem por SETOR: Roteiro (tema rico), Cronograma (período), Programação de Posts/Cards (tema), Edição de Vídeos (tema) e Agenda (título) — todas recebem o clipboard REAL",
      s1 && s1.tema === 'Roteiro colado por setor' && s2 && s2.v === 'Período colado no cronograma' && s2.model === s2.v && s3 && s3.v === 'Tema de card colado' && s3.model === s3.v && s4 && s4.v === 'Tema de vídeo colado' && s4.model === s4.v && s5 && s5.v === 'Reunião colada na Agenda',
      Object.assign({ png: await shot("f355d-u8-setores") }, { s1, s2, s3, s4, s5 }));

    /* U9 — Revisão preserva o conteúdo colado */
    clipboard.writeText("Tema colado para a Revisão");
    const u9 = await J(`(function(){__blur();state.form=null;closeModal();openTaskForm('cronograma');state.form.title='Rev';state.form.client='C';state.form.step=2;render();__cqty('2');state.form._openContent=0;render();var ed=document.querySelector('[data-rteed="form|0|tema"]');ed.focus();var r=document.createRange();r.selectNodeContents(ed);var s=getSelection();s.removeAllRanges();s.addRange(r);var ev=new KeyboardEvent('keydown',{key:'v',keyCode:86,ctrlKey:true,bubbles:true,cancelable:true});ed.dispatchEvent(ev);return new Promise(function(res){setTimeout(function(){try{if(document.activeElement)document.activeElement.blur();}catch(_){ }state.form.step=3;render();setTimeout(function(){var txt=document.body.textContent;res({contagem:/1 \\/ 2/.test(txt), tema:txt.indexOf('Tema colado para a Revisão')>=0});},250);},500);});})()`);
    rec("U9 REVISÃO: conteúdo colado aparece (contagem 1/2 + texto)", u9 && u9.contagem && u9.tema, Object.assign({ png: await shot("f355d-u9-revisao") }, u9));

    /* U10 — tarefa ANTIGA preservada + reabertura pela contagem real */
    const u10 = await J(`(function(){__blur();state.form=null;closeModal();var t=state.tasks.find(function(x){return x.id==='tkOldSem';});var antes=JSON.stringify(t);openDetails('tkOldSem');var det=document.body.textContent.indexOf('Tema antigo 1')>=0;closeModal();openContentEditor('tkOldSem');var itens=document.querySelectorAll('.ce-list .rte-ed').length/2;var depois=JSON.stringify(state.tasks.find(function(x){return x.id==='tkOldSem';}));closeModal();return {det:det, itens:itens, intacta:antes===depois, cronQtyReal:cronQtyOf({id:'tkOldSem',subtype:'semanal',contents:[{},{},{}]})};})()`);
    rec("U10 tarefa ANTIGA (semanal): Detalhes exibem; reabertura usa a contagem REAL (3); documento NÃO reescrito ao abrir", u10 && u10.det && u10.itens === 3 && u10.intacta && u10.cronQtyReal === 3, Object.assign({ png: await shot("f355d-u10-legado") }, u10));

    /* U11 — fixture do payload p/ o portal (funções reais do app empacotado) */
    const u11 = await J(`(function(){__blur();state.form=null;closeModal();openTaskForm('cronograma');state.form.title='Fixture';state.form.client='C';state.form.step=2;render();__cqty('4');state.form.contents=[{tema:'T1',legenda:'L1'},{tema:'T2',legenda:'L2'},{tema:'T3'},{}];var sub=curSub();return {formTitle:sub.formTitle, contentCount:sub.contentCount, desc:composedDesc().slice(0,120), preenchidos:state.form.contents.filter(function(c){return c&&(c.tema||c.legenda);}).length, semCronSub:!state.form.subtype};})()`);
    const fixOk = u11 && u11.contentCount === 4 && /Cronograma — 4 conteúdos/.test(u11.formTitle) && u11.preenchidos === 3 && u11.semCronSub;
    if (fixOk) fs.writeFileSync(path.join(OUT, "f355d-cron-payload-fixture.json"), JSON.stringify(u11, null, 2));
    rec("U11 payload custom (funções reais): contentCount=4; desc 'Cronograma — 4 conteúdos'; SEM cronSub ⇒ portal usa fallback 'Cronograma' (fixture exportada)", fixOk, u11);

    /* U12/U13/U14 — responsividade/escala com o formulário cheio */
    await J(`__blur();state.form=null;closeModal();openTaskForm('cronograma');state.form.title='Resp';state.form.client='C';state.form.step=2;render();__cqty('10'); true;`); await sleep(300);
    wc.setZoomFactor(1.25); await sleep(300);
    const u12 = await J(`({overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2, blocos: document.querySelectorAll('.content-card').length})`);
    rec("U12 escala 125% com 10 conteúdos: sem overflow horizontal", u12 && !u12.overflowX && u12.blocos === 10, Object.assign({ png: await shot("f355d-u12-125") }, u12));
    wc.setZoomFactor(1.5); await sleep(300);
    const u13 = await J(`({overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2})`);
    rec("U13 escala 150%: sem overflow horizontal", u13 && !u13.overflowX, Object.assign({ png: await shot("f355d-u13-150") }, u13));
    wc.setZoomFactor(1); win.setSize(1366, 768); await sleep(300);
    const u14 = await J(`({overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2, w: window.innerWidth})`);
    rec("U14 1366×768: sem overflow horizontal", u14 && !u14.overflowX && u14.w === 1366, Object.assign({ png: await shot("f355d-u14-1366") }, u14));
    win.setSize(1440, 940); await sleep(200);
  } catch (e) { fatal = String((e && e.stack) || e).slice(0, 400); }

  const failures = results.filter((r) => !r.ok).length + (fatal ? 1 : 0);
  fs.writeFileSync(path.join(OUT, "f355d-proof-results.json"), JSON.stringify({ at: new Date().toISOString(), asarSha256: sha256(asarPath), results, fatal }, null, 2));
  clearTimeout(WATCHDOG);
  process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=" + failures + (fatal ? " FATAL=" + fatal : "") + "\n");
  app.exit(failures ? 1 : 0);
});
