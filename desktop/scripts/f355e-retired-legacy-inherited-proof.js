/* F3.5.5E — GATE HERDADO RE-ESCOPADO da F3.5.5C (provas reais; Electron 31.3.1; app.asar; xvfb).
 *
 * [RE-PINADO F3.5.5E] O harness original da F3.5.5C (f355c-proof-main.js, 32 cenas) prova o stepper
 * de quantidade e o editor rico DENTRO do formulário de criação do ROTEIRO — superfície que o owner
 * mandou RETIRAR nesta fase ("Roteiro não fará mais parte do Agenda ID Seven"; "nenhum registro novo
 * possível"). Todas as 29 cenas que interagem com essa superfície deixam de ser executáveis POR
 * DESENHO (o guard `descontinuado` de produção neutraliza o setor). O arquivo original permanece
 * BYTE-IDÊNTICO à 1.0.223 como artefato histórico (fora do delta desta fase).
 *
 * Este harness substitui aquele gate provando, no app REAL empacotado, a verdade herdada pós-retirada:
 *   R1 criação de Roteiro RETIRADA (guard neutraliza; sem stepper; sem editores)
 *   R2 aliases retirados idem (copywriting/copy; programacao_posts/postagem)
 *   R3 histórico de Roteiro PRESERVADO (fora do state; índice id→setor; 0 deletes/0 writes; semente intacta)
 *   R4 deep-link/Central do histórico BLOQUEADOS com mensagem oficial (nunca tela branca)
 *   R5 componente compartilhado VIVO: stepper de quantidade no Cronograma ([−][N][+])
 *   R6 componente compartilhado VIVO: editor rico no Cronograma (contenteditable + barra + botões)
 *   R7 sanitização VIVA: colagem MALICIOSA no editor do Cronograma é inerte (nada executa)
 *   R8 1366×768 sem overflow horizontal no Briefing vivo
 *   R9 escala 125% sem overflow horizontal
 * Cobertura remanescente dos componentes compartilhados segue nos gates vivos: f355c suite 128 +
 * validador RTE 97 + SMOKE RTE 91 + f355d C1–C9/U1–U16 + paridade cruzada do Worker. */
const { app, BrowserWindow, session, ipcMain, clipboard } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f355e-qa");
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }
const ofs = require("original-fs");
const sha256 = (p) => crypto.createHash("sha256").update(ofs.readFileSync(p)).digest("hex");
process.on("uncaughtException", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=uncaught:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });
process.on("unhandledRejection", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=unhandled:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });

/* ---- SEMENTE (mesma família do harness f355e: vivos + históricos retirados) ---- */
const NOW = Date.now();
const ID = { ANA: "u-soc-ana", MARINA: "u-adm-marina", DIEGO: "u-des-diego", FELIPE: "u-des-felipe" };
const mkC = (n) => new Array(n).fill(0).map((_, i) => ({ tema: "Tema " + (i + 1), legenda: "Legenda " + (i + 1) }));
const seed = (() => {
  const self = { id: ID.ANA, name: "Ana Beatriz Social Media", role: "Social Media", admin: false, status: "ativo" };
  const users = [self,
    { id: ID.MARINA, name: "Marina Administradora", role: "Administrador", admin: true, status: "ativo" },
    { id: ID.DIEGO, name: "Miercohévisk Niheb Ferreira", role: "Designer", status: "ativo" },
    { id: ID.FELIPE, name: "Felipe Teodozio", role: "Designer", status: "ativo" }];
  const tk = (x) => Object.assign({ by: ID.ANA, createdAt: NOW, history: [], checklist: [] }, x);
  const tasks = [
    tk({ id: "cronSem", sector: "cronograma", status: "andamento", title: "Cronograma da Ótica", client: "Ótica Clara", subtype: "semanal", cronContents: mkC(3) }),
    tk({ id: "cronQuin", sector: "cronograma", status: "andamento", title: "Cronograma da Clínica", client: "Clínica Norte", subtype: "quinzenal", cronContents: mkC(6) }),
    tk({ id: "cronMen", sector: "cronograma", status: "andamento", title: "TEMAS", client: "Hospital Visão", subtype: "mensal", cronContents: mkC(12) }),
    tk({ id: "cronCustom", sector: "cronograma", status: "andamento", title: "TEMAS", client: "Hospital Visão", cronQty: 7, cronContents: mkC(7) }),
    tk({ id: "vid1", sector: "edicao_midia", status: "afazer", title: "Reels institucional", client: "Studio Fit" }),
    tk({ id: "card1", sector: "edicao_cards", status: "afazer", title: "Card avulso de aniversário" }),
    /* históricos de módulos RETIRADOS (devem ser preservados e ocultados) */
    tk({ id: "rot1", sector: "roteiro", status: "andamento", title: "Roteiros de gravação — Junho", client: "Ótica Clara", cronContents: mkC(4) }),
    tk({ id: "copy1", sector: "copywriting", status: "afazer", title: "Pacote de legendas", client: "Clínica Norte" }),
    tk({ id: "post1", sector: "programacao_posts", status: "afazer", title: "Post lançamento — feed", client: "Studio Fit" }),
  ];
  return { self, users, tasks, events: [] };
})();

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();

let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f355e-leg-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f355e-leg-app.asar");
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
  const seedPath = path.join(os.tmpdir(), "f355d-seed.json");
  fs.writeFileSync(seedPath, JSON.stringify(seed));
  const seedShaBefore = sha256(seedPath);

  ipcMain.handle("clipboard-read-text", () => { try { return String(clipboard.readText() || ""); } catch { return ""; } });
  ipcMain.handle("clipboard-read-html", () => { try { return String(clipboard.readHTML() || ""); } catch { return ""; } });

  const win = new BrowserWindow({ width: 1600, height: 900, show: true, webPreferences: {
    preload: path.join(__dirname, "f355d-proof-preload.js"),
    contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  const wc = win.webContents;
  wc.on("console-message", (_e, lvl, msg) => { if (lvl >= 2) line({ console: String(msg).slice(0, 260) }); });
  wc.on("render-process-gone", (_e, d) => { line({ rendererGone: (d && d.reason) || "?" }); });
  const J = (code) => wc.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));
  const SHOTS = process.env.PROOF_SHOTS !== "0";
  async function shot(nm) { try { if (!SHOTS) return "skipped"; const img = await wc.capturePage(); fs.writeFileSync(path.join(OUT, nm + ".png"), img.toPNG()); return nm + ".png"; } catch (e) { return "shot_err:" + String((e && e.message) || e).slice(0, 80); } }

  await win.loadURL("file://" + asarPath.replace(/\\/g, "/") + "/src/renderer/index.html");
  /* BOOT com poll (snapshot assíncrono — padrão dos harnesses aprovados) */
  let boot = null;
  for (let i = 0; i < 30; i++) {
    boot = await J(`(function(){ var st=(typeof state!=='undefined')?state:null; return { user: !!(st&&st.user), tasks: ((st&&st.tasks)||[]).length,
      retired: window.__retiredCutoff||null, retIdx: Object.keys(window.__retiredIndex||{}).sort().join(',') }; })()`);
    if (boot && boot.user && boot.tasks === 6 && boot.retired) break;
    await sleep(500);
  }
  rec("BOOT app real do asar (semente aplicada; retirados fora do state)", !!(boot && boot.user && boot.tasks === 6 && boot.retired && boot.retired.dropped === 3 && boot.retIdx === "copy1,post1,rot1"), Object.assign({ indexSha: meta.stageIndexSha.slice(0, 12) }, boot));

  /* helpers de teclado/blur (mesmos do harness f355d) */
  await J(`(function(){
    window.__kv=function(sel,opts){var el=(typeof sel==='string')?document.querySelector(sel):sel;if(!el)return 'no:'+sel;el.focus();var o=opts||{};var ev=new KeyboardEvent('keydown',{key:o.key||'v',keyCode:o.keyCode||86,ctrlKey:o.ctrl!==false&&!o.ins,shiftKey:!!o.ins,bubbles:true,cancelable:true});if(o.ins){ev=new KeyboardEvent('keydown',{key:'Insert',keyCode:45,shiftKey:true,bubbles:true,cancelable:true});}el.dispatchEvent(ev);return 'ok';};
    window.__blur=function(){try{if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();}catch(_){}try{if(typeof _deferRender!=='undefined'&&_deferRender){_deferRender=false;_deferRenderAt=0;render();}}catch(_){}return 'ok';};
    return true; })()`);

  /* R1 — criação de Roteiro RETIRADA (guard de produção neutraliza o setor) */
  const r1 = await J(`(function(){ window.__blur(); state.form=null; try{closeModal();}catch(_){ } openTaskForm('roteiro');
    var f=state.form||{}; var qty=document.getElementById('fScriptQty'); var ed=document.querySelector('[data-rteed="form|0|tema"]');
    return { semSetor: !f.sector, etapaSelecao: (f.step===0), semCampoQty: !qty, semEditor: !ed }; })()`);
  rec("R1 criação de Roteiro RETIRADA: setor neutralizado, etapa de seleção, sem stepper, sem editores",
    r1 && r1.semSetor && r1.etapaSelecao && r1.semCampoQty && r1.semEditor, r1);
  await shot("r1-roteiro-retirado");

  /* R2 — aliases retirados idem (canônicos e legados) */
  const r2 = await J(`(function(){ var out={}; ['copywriting','copy','programacao_posts','postagem'].forEach(function(k){
    window.__blur(); state.form=null; try{closeModal();}catch(_){ } openTaskForm(k); var f=state.form||{};
    out[k]={ semSetor: !f.sector, etapaSelecao: (f.step===0) }; });
    state.form=null; try{closeModal();}catch(_){ } render(); return out; })()`);
  rec("R2 aliases retirados neutralizados (copywriting/copy/programacao_posts/postagem)",
    r2 && ['copywriting','copy','programacao_posts','postagem'].every((k) => r2[k] && r2[k].semSetor && r2[k].etapaSelecao), r2);

  /* R3 — histórico de Roteiro PRESERVADO: fora do state; índice id→setor; 0 deletes/0 writes; semente intacta */
  const r3 = await J(`(function(){ var inState=!!state.tasks.find(function(t){return t.id==='rot1'||t.id==='copy1'||t.id==='post1';});
    return { inState: inState, dropped: (window.__retiredCutoff||{}).dropped, deletes: (window.__DELETES||[]).length,
      patches: (window.__PATCHES||[]).length, idxKeys: window.__retiredIndex['rot1']?Object.keys(window.__retiredIndex['rot1']).join(','):'', mod: (window.__retiredIndex['rot1']||{}).s }; })()`);
  const seedShaAfter = sha256(seedPath);
  rec("R3 histórico preservado: fora do state, índice só id→setor, 0 deletes/0 writes, semente intacta",
    r3 && !r3.inState && r3.dropped === 3 && r3.deletes === 0 && r3.patches === 0 && r3.idxKeys === "s" && r3.mod === "roteiro" && seedShaAfter === seedShaBefore,
    Object.assign({ seedIntacta: seedShaAfter === seedShaBefore }, r3));

  /* R4 — deep-link/Central do histórico BLOQUEADOS com a mensagem oficial */
  const r4 = await J(`(function(){ openDetails('rot1'); var ft=document.getElementById('flashToast');
    return { modal: !!document.querySelector('.modal-back[data-detmodal]'), tab: state.tab,
      msg: ft && ft.classList.contains('show') ? ft.textContent : '' }; })()`);
  rec("R4 deep-link do histórico bloqueado: sem modal, redirect Tarefas, mensagem de descontinuado",
    r4 && !r4.modal && r4.tab === "tarefas" && /descontinuado/.test(r4.msg || "") && /Agenda ID Seven/.test(r4.msg || ""), r4);
  await shot("r4-deeplink-bloqueado");

  /* R5 — componente compartilhado VIVO: stepper de quantidade no Cronograma */
  await J(`(function(){ window.__blur(); state.form=null; try{closeModal();}catch(_){ } openTaskForm('cronograma');
    state.form.title='Cronograma institucional'; state.form.client='Cliente Prova'; state.form.step=2; render(); return true; })()`);
  await sleep(250);
  const r5 = await J(`({ stepper: !!document.getElementById('fCronQty'), minus: !!document.querySelector('[data-cqminus]'),
    plus: !!document.querySelector('[data-cqplus]'), label: (function(){var ls=[].slice.call(document.querySelectorAll('.lbl')).map(function(e){return e.textContent;});return ls.indexOf('Quantidade de temas')>=0;})() })`);
  rec("R5 stepper de quantidade VIVO no Cronograma ([−][N][+] + rótulo)", r5 && r5.stepper && r5.minus && r5.plus && r5.label, Object.assign({ png: await shot("r5-stepper-vivo") }, r5));

  /* R6 — componente compartilhado VIVO: editor rico no Cronograma */
  await J(`(function(){ var el=document.getElementById('fCronQty'); el.focus(); el.value='1'; el.blur();
    el.dispatchEvent(new Event('change',{bubbles:true})); state.form._openContent=0; render(); return true; })()`);
  await sleep(250);
  const r6 = await J(`(function(){ var ed=document.querySelector('[data-rteed="form|0|tema"]'); if(!ed) return { ed:false };
    ed.focus(); var wrap=ed.closest('.rte'); var bar=wrap&&wrap.querySelector('.rte-bar');
    return { ed:true, contenteditable: ed.getAttribute('contenteditable')==='true',
      barVisivel: bar?getComputedStyle(bar).display!=='none':false, botoes: wrap?wrap.querySelectorAll('.rte-b').length:0 }; })()`);
  rec("R6 editor rico VIVO no Cronograma (contenteditable + barra + botões)", r6 && r6.ed && r6.contenteditable && r6.barVisivel && r6.botoes >= 20, Object.assign({ png: await shot("r6-editor-vivo") }, r6));

  /* R7 — sanitização VIVA: colagem MALICIOSA inerte no editor do Cronograma */
  clipboard.write({ text: "seguro", html: '<script>window.__XSS=1</scr' + 'ipt><img src=x onerror="window.__XSS=2"><iframe src=x></iframe><a href="javascript:window.__XSS=3">link</a><b>seguro</b>' });
  const r7 = await J(`(function(){ window.__XSS=0; var ed=document.querySelector('[data-rteed="form|0|tema"]');
    ed.focus(); var r=document.createRange(); r.selectNodeContents(ed); var s=getSelection(); s.removeAllRanges(); s.addRange(r); window.__kv(ed);
    return new Promise(function(res){ setTimeout(function(){ var c=state.form.contents[0]||{};
      res({ xss: window.__XSS, rich: (c.temaRich||'').slice(0,200), plain: c.tema||'',
        domLimpo: !ed.querySelector('script,img,iframe'), semPerigo: !/script|iframe|onerror|javascript:/i.test(c.temaRich||'') }); }, 600); }); })()`);
  rec("R7 sanitização VIVA: colagem maliciosa inerte (nada executa; texto seguro fica)",
    r7 && r7.xss === 0 && r7.domLimpo && r7.semPerigo && /seguro/.test((r7.rich || "") + (r7.plain || "")), Object.assign({ png: await shot("r7-sanitizacao-viva") }, r7));

  /* R8 — 1366×768 sem overflow horizontal no Briefing vivo */
  win.setContentSize(1366, 768); await sleep(400);
  const r8 = await J(`({ overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, w: window.innerWidth })`);
  rec("R8 1366×768: sem overflow horizontal no Briefing vivo", r8 && !r8.overflowX && r8.w === 1366, Object.assign({ png: await shot("r8-1366") }, r8));

  /* R9 — escala 125% sem overflow horizontal */
  wc.setZoomFactor(1.25); await sleep(400);
  const r9 = await J(`({ overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 })`);
  rec("R9 escala 125%: sem overflow horizontal", r9 && !r9.overflowX, Object.assign({ png: await shot("r9-125") }, r9));
  wc.setZoomFactor(1); win.setContentSize(1600, 900);

  const failures = results.filter((r) => !r.ok).length;
  try { fs.writeFileSync(path.join(OUT, "f355e-retired-legacy-inherited-results.json"), JSON.stringify(results, null, 2)); } catch (_) {}
  clearTimeout(WATCHDOG);
  process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=" + failures + "\n");
  app.exit(failures ? 1 : 0);
});
