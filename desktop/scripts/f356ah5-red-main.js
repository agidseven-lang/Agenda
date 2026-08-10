/* F3.5.6A-H5 — RED EMPACOTADO do BOTÃO "Confirmar envio ao cliente" (mandato: CLICAR o botão REAL).
 *
 * 1.0.233 REPROVADA no Cenário B: no modal "Enviar no grupo do cliente", o botão "Confirmar envio ao
 * cliente" está VISÍVEL mas INERTE — clique não faz nada (nasce disabled; só armado por "Abrir
 * WhatsApp"/"Copiar"; handler aborta em if(b.disabled)return). No fluxo do owner (criar→Enviar→Confirmar
 * direto) o botão nunca é armado.
 *
 * Este RED NÃO chama wfConfirmClientSend direto. Ele:
 *   1. cria a tarefa pelo CAMINHO REAL (saveTask, _sendAfterSave=true) — que ABRE o modal real;
 *   2. localiza o #btnConfirmSend REAL no DOM;
 *   3. dispara CLIQUE REAL de mouse (MouseEvent) e observa a cadeia (POST confirmClientSend, UI, toast).
 *
 * DUAS BUILDS no mesmo harness:
 *   • BASE (1.0.233) — reconstruída revertendo o único delta necessário (botão volta a nascer `disabled`),
 *     reversão VALIDADA. Contrato do BUG: clique → NENHUM POST confirmClientSend; botão inalterado.
 *   • FIX (1.0.238) — worktree. Clique → 1 POST confirmClientSend (com Authorization) → botão "Envio
 *     confirmado ao cliente" (is-done). Falha de servidor → botão REABILITA + rótulo restaurado + toast
 *     de erro visível (zero falso confirmado). Idempotência: duplo-clique → 1 POST. Sem overlay
 *     (elementFromPoint = o próprio botão) e pointer-events != none. Teclado: button nativo habilitado.
 *
 * SUCESSO = (baseRed>=2) && (fixViolations==0) && (invariantFailures==0). */
const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f356ah5-qa");
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }
process.on("uncaughtException", (e) => { try { process.stdout.write("PROOF_DONE baseRed=? fixViolations=? invariantFailures=999 FATAL=uncaught:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });
process.on("unhandledRejection", (e) => { try { process.stdout.write("PROOF_DONE baseRed=? fixViolations=? invariantFailures=999 FATAL=unhandled:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();

/* ───────────── reconstrução determinística da BASE (1.0.233): botão volta a nascer `disabled` ───────────── */
const FIX_BTN = "'<button class=\"btn\" id=\"btnConfirmSend\" title=\"Só confirme DEPOIS de enviar a mensagem no grupo do cliente.\">'";
const BASE_BTN = "'<button class=\"btn\" id=\"btnConfirmSend\" disabled title=\"Habilita após copiar/abrir o WhatsApp. Só confirme DEPOIS de enviar no grupo.\">'";
function countOcc(s, sub) { let n = 0, i = 0; while ((i = s.indexOf(sub, i)) >= 0) { n++; i += sub.length; } return n; }
function buildBaseHtml(fixHtml) {
  const errs = [];
  if (countOcc(fixHtml, FIX_BTN) !== 1) errs.push("btn-fix-nao-unico(" + countOcc(fixHtml, FIX_BTN) + ")");
  if (errs.length) return { html: null, errs };
  let s = fixHtml.replace(FIX_BTN, BASE_BTN);
  if (s.indexOf("id=\"btnConfirmSend\" disabled") < 0) errs.push("base-disabled-nao-aplicado");
  if (s.indexOf(FIX_BTN) >= 0) errs.push("btn-fix-persistiu");
  return { html: errs.length ? null : s, errs };
}

async function packAsar(htmlContent, tag) {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f356ah5-" + tag + "-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  fs.writeFileSync(path.join(rdir, "index.html"), htmlContent);
  for (const f of ["priorityEngine.js"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  const out = path.join(os.tmpdir(), "f356ah5-" + tag + "-" + Date.now() + ".asar");
  await asar.createPackage(stage, out);
  return out;
}

const results = [];
let baseRed = 0, fixViolations = 0, invariantFailures = 0;
function recRed(name, bugPresent, info) { results.push({ name, kind: "RED", bugPresent: !!bugPresent, info: info || {} }); if (bugPresent) baseRed++; line({ proof: name, kind: "RED", bugPresent: !!bugPresent, info: info || {} }); }
function recFix(name, ok, info) { results.push({ name, kind: "GREEN", ok: !!ok, info: info || {} }); if (!ok) fixViolations++; line({ proof: name, kind: "GREEN", ok: !!ok, info: info || {} }); }
function recInv(name, ok, info) { results.push({ name, kind: "INV", ok: !!ok, info: info || {} }); if (!ok) invariantFailures++; line({ proof: name, kind: "INV", ok: !!ok, info: info || {} }); }

async function bootAsar(asarPath, label) {
  const win = new BrowserWindow({ width: 1280, height: 900, show: true, webPreferences: {
    preload: path.join(__dirname, "f356ah5-red-preload.js"),
    contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  const wcp = win.webContents;
  wcp.on("console-message", (_e, lvl, msg, ln, src) => { if (lvl >= 2) line({ console: String(msg).slice(0, 200), src: String(src || "").split("/").pop(), ln, win: label }); });
  const J = (code) => wcp.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));
  await win.loadURL("file://" + asarPath.replace(/\\/g, "/") + "/src/renderer/index.html");
  let boot = null;
  for (let i = 0; i < 40; i++) {
    boot = await J(`(function(){ var st=(typeof state!=='undefined')?state:null; return { user:!!(st&&st.user), fns:(typeof saveTask==='function'&&typeof newForm==='function'&&typeof openSendClientModal==='function'&&typeof wfConfirmClientSend==='function'&&typeof render==='function'), ver:(window.desktopAPI&&window.desktopAPI.version)||'' }; })()`);
    if (boot && boot.user && boot.fns) break;
    await sleep(400);
  }
  return { win, J, boot };
}

/* cria a tarefa pelo CAMINHO REAL e ABRE o modal (saveTask com _sendAfterSave chama openSendClientModal);
   depois garante que o #btnConfirmSend está no DOM. Instala captura de flashToast (window.__TOASTS). */
async function createAndOpenModal(J, title) {
  const code = `(async function(){
    window.__TOASTS=window.__TOASTS||[];
    if(!window.__ftpatched && typeof flashToast==='function'){ var _ft=flashToast; window.flashToast=function(m,d){ try{ window.__TOASTS.push(String(m)); }catch(_){ } return _ft&&_ft.apply(this,arguments); }; try{ flashToast=window.flashToast; }catch(_){ } window.__ftpatched=true; }
    window.__DB_FAIL=false; window.__TEAMFAIL=false;
    try{ window.__resetWrites(); }catch(e){}
    state.tab='tarefas';
    state.form=newForm('cronograma');
    state.form.title=${JSON.stringify(title || "Cronograma Teste 3")};
    state.form.client='CLIENTE TESTE';
    state.form.contents=[{tema:'Tema 1'}];
    state.form.status='afazer';
    state.form._sendAfterSave=true; state.form._sending=true;
    try{ render(); }catch(e){}
    var saveErr=null; try{ await saveTask(); }catch(e){ saveErr=String(e&&e.message||e); }
    // aguarda o openSendClientModal (fire-and-forget do saveTask) gerar o token (ensureReviewToken → STORE)
    await new Promise(function(r){ setTimeout(r,700); });
    var w=(window.__WRITES||[]).filter(function(x){ return x.coll==='tasks'; });
    var setW=w.filter(function(x){ return x.op==='set'||x.op==='add'; });
    var id=setW.length?setW[0].id:null;
    var doc=id?((window.__STORE&&window.__STORE.tasks&&window.__STORE.tasks[id])||null):null;
    var hasToken=!!(doc&&doc.clientReviewToken);
    // CAMINHO REAL: a tarefa entra em state.tasks (como o onSnapshot faria) COM o token; e reabrimos o
    // modal de forma determinística com esse doc (openSendClientModal pula ensureReviewToken pois já há token).
    if(doc){ try{ window.__emitTasks([Object.assign({id:id},doc)]); }catch(e){} try{ await openSendClientModal(Object.assign({id:id},doc)); }catch(e){} }
    return { saveErr:saveErr, id:id, hasToken:hasToken };
  })()`;
  const r = await J(code);
  // espera o botão do modal
  let seen = null;
  for (let i = 0; i < 12; i++) {
    seen = await J(`(function(){ var b=document.getElementById('btnConfirmSend'); return b?{present:true,tag:b.tagName,disabled:!!b.disabled}:{present:false}; })()`);
    if (seen && seen.present) break;
    await sleep(300);
  }
  return { save: r, btn: seen };
}

/* dispara o CLIQUE REAL de mouse no #btnConfirmSend e observa a cadeia */
async function clickConfirm(J, opts) {
  opts = opts || {};
  const code = `(async function(){
    window.__TEAMFAIL=${opts.fail ? "true" : "false"};
    var b=document.getElementById('btnConfirmSend'); if(!b) return {err:'no_button'};
    try{ b.scrollIntoView({block:'center',inline:'center'}); }catch(_){}
    await new Promise(function(r){ setTimeout(r,120); });
    var rect=b.getBoundingClientRect();
    var cx=Math.round(rect.left+rect.width/2), cy=Math.round(rect.top+rect.height/2);
    var midEl=null; try{ midEl=document.elementFromPoint(cx,cy); }catch(_){}
    var pe=''; try{ pe=getComputedStyle(b).pointerEvents; }catch(_){}
    var beforeDisabled=!!b.disabled;
    try{ window.__TEAM_POSTS.length=0; }catch(_){}
    try{ window.__TOASTS.length=0; }catch(_){}
    var rounds=${opts.doubleClick ? "2" : "1"};
    for(var k=0;k<rounds;k++){ b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window})); }
    await new Promise(function(r){ setTimeout(r,700); });
    var posts=(window.__TEAM_POSTS||[]).map(function(p){ return {action:(p.body&&p.body.action)||'',auth:!!(p.headers&&(p.headers.Authorization||p.headers.authorization))}; });
    var confirmPosts=posts.filter(function(p){ return p.action==='confirmClientSend'; });
    var bAfter=document.getElementById('btnConfirmSend');
    var txt=(bAfter?(bAfter.textContent||bAfter.innerText||''):'').replace(/\\s+/g,' ').trim();
    return {
      beforeDisabled:beforeDisabled, pointerEvents:pe,
      overlap:(midEl===b?'self':(midEl?((midEl.id||midEl.tagName)+''):'null')),
      confirmPosts:confirmPosts.length, firstAuth:(confirmPosts[0]&&confirmPosts[0].auth)||false,
      afterDisabled:bAfter?!!bAfter.disabled:null, isDone:bAfter?bAfter.classList.contains('is-done'):null,
      text:txt.slice(0,80), toasts:(window.__TOASTS||[]).slice(0,6)
    };
  })()`;
  return await J(code);
}

app.whenReady().then(async () => {
  const WATCHDOG = setTimeout(() => { try { process.stdout.write("PROOF_DONE baseRed=" + baseRed + " fixViolations=" + fixViolations + " invariantFailures=999 FATAL=watchdog\n"); } catch (_) {} app.exit(1); }, 8 * 60 * 1000);
  try { session.defaultSession.webRequest.onBeforeRequest((d, cb) => { cb({ cancel: /^https?:/i.test(d.url) }); }); } catch (_) {}

  const VERSION = process.env.H5_VERSION || "1.0.238";
  const ANA = "uid-ana-social";
  const seed = {
    self: { id: ANA, name: "Ana Beatriz Social Media", role: "Social Media", admin: false, status: "ativo" },
    users: [{ id: ANA, name: "Ana Beatriz Social Media", role: "Social Media", status: "ativo" }],
    tasks: [], events: [], version: VERSION,
  };
  fs.writeFileSync(path.join(os.tmpdir(), "f356ah4-seed.json"), JSON.stringify(seed)); // preload H5 lê a MESMA semente da base H4
  fs.writeFileSync(path.join(os.tmpdir(), "f356ah5-seed.json"), JSON.stringify(seed));

  const SRC = path.join(__dirname, "..", "src", "renderer", "index.html");
  const fixHtml = fs.readFileSync(SRC, "utf8");
  const base = buildBaseHtml(fixHtml);
  recInv("B00 reconstrução da BASE (1.0.233) — botão volta a nascer `disabled` (reversão validada; base errada ⇒ falha)",
    base.html !== null, { errs: base.errs });

  const fixAsar = await packAsar(fixHtml, "fix");
  const baseAsar = base.html ? await packAsar(base.html, "base") : null;

  /* ══════════════════════ FIX (1.0.238) — CLIQUE REAL no botão ══════════════════════ */
  const F = await bootAsar(fixAsar, "fix");
  recInv("R00 renderer FIX (1.0.238) bootado (Social logada; saveTask/openSendClientModal/wfConfirmClientSend vivos)",
    !!(F.boot && F.boot.user && F.boot.fns), F.boot);

  /* ---- GREEN: sucesso ---- */
  const g1 = await createAndOpenModal(F.J, "Cronograma Teste 3");
  recFix("R01 modal REAL aberto pelo caminho de criação (Enviar) — #btnConfirmSend presente e é <button>",
    !!(g1 && g1.btn && g1.btn.present && g1.btn.tag === "BUTTON"), { btn: g1 && g1.btn, saveErr: g1 && g1.save && g1.save.saveErr });
  recFix("A0 [WRITER-GUARD] o botão NASCE habilitado (disabled=false na abertura) — não depende de copiar/abrir WhatsApp",
    !!(g1 && g1.btn && g1.btn.disabled === false), { disabled: g1 && g1.btn && g1.btn.disabled });
  const gc = await clickConfirm(F.J, {});
  recFix("A1 [SEM OVERLAY] elementFromPoint no centro = o próprio botão; pointer-events != none",
    !!(gc && gc.overlap === "self" && gc.pointerEvents !== "none"), { overlap: gc && gc.overlap, pointerEvents: gc && gc.pointerEvents });
  recFix("A2 [CLIQUE→CADEIA] clique REAL dispara 1 POST confirmClientSend COM Authorization (handler→wfConfirmClientSend→wfTeamAction→HTTP)",
    !!(gc && gc.confirmPosts === 1 && gc.firstAuth === true), { confirmPosts: gc && gc.confirmPosts, firstAuth: gc && gc.firstAuth });
  recFix("A3 [SUCESSO] botão vira 'Envio confirmado ao cliente' (is-done) após resposta de sucesso",
    !!(gc && /Envio confirmado ao cliente/i.test(String(gc.text || "")) && gc.isDone === true), { text: gc && gc.text, isDone: gc && gc.isDone });

  /* ---- FAILURE: falha de servidor → reabilita + rótulo restaurado + toast de erro ---- */
  const f1 = await createAndOpenModal(F.J, "Cronograma Falha");
  const fc = await clickConfirm(F.J, { fail: true });
  recFix("C1 [FALHA] servidor falha ⇒ botão REABILITA (disabled=false) e NÃO fica 'confirmado' (is-done=false)",
    !!(fc && fc.afterDisabled === false && fc.isDone === false), { afterDisabled: fc && fc.afterDisabled, isDone: fc && fc.isDone });
  recFix("C2 [FALHA] rótulo restaurado para 'Confirmar envio ao cliente' (nunca falso 'confirmado')",
    !!(fc && /Confirmar envio ao cliente/i.test(String(fc.text || ""))), { text: fc && fc.text });
  recFix("C3 [FALHA] toast de erro VISÍVEL — 'Não foi possível confirmar o envio ao cliente' (erro nunca silenciado)",
    !!(fc && (fc.toasts || []).some(function (t) { return /Não foi possível confirmar o envio ao cliente/i.test(String(t)); })), { toasts: fc && fc.toasts });

  /* ---- IDEMPOTÊNCIA: duplo-clique rápido → 1 POST ---- */
  const i1 = await createAndOpenModal(F.J, "Cronograma Idem");
  const ic = await clickConfirm(F.J, { doubleClick: true });
  recFix("D1 [IDEMPOTÊNCIA] duplo-clique rápido ⇒ 1 único POST confirmClientSend (trava durante request)",
    !!(ic && ic.confirmPosts === 1), { confirmPosts: ic && ic.confirmPosts });

  try { F.win.destroy(); } catch (_) {}

  /* ══════════════════════ BASE (1.0.233) — RED: botão inerte ══════════════════════ */
  if (baseAsar) {
    const B = await bootAsar(baseAsar, "base");
    recInv("R10 renderer BASE (1.0.233 reconstruída) bootado", !!(B.boot && B.boot.user && B.boot.fns), B.boot);
    const b1 = await createAndOpenModal(B.J, "Cronograma Teste 3");
    recRed("RED1 [1.0.233] botão 'Confirmar envio ao cliente' NASCE disabled no modal (só armado por copiar/abrir)",
      !!(b1 && b1.btn && b1.btn.present && b1.btn.disabled === true), { btn: b1 && b1.btn });
    const bc = await clickConfirm(B.J, {});
    recRed("RED2 [1.0.233] clique REAL no botão → NENHUM POST confirmClientSend e botão inalterado (INERTE — defeito físico)",
      !!(bc && bc.confirmPosts === 0 && bc.isDone === false), { confirmPosts: bc && bc.confirmPosts, isDone: bc && bc.isDone, beforeDisabled: bc && bc.beforeDisabled });
    try { B.win.destroy(); } catch (_) {}
  }

  clearTimeout(WATCHDOG);
  const ok = (baseRed >= 2 && fixViolations === 0 && invariantFailures === 0);
  fs.writeFileSync(path.join(OUT, "f356ah5-red-results.json"), JSON.stringify({ version: VERSION, baseRed, fixViolations, invariantFailures, results }, null, 2));
  process.stdout.write("PROOF_DONE baseRed=" + baseRed + " fixViolations=" + fixViolations + " invariantFailures=" + invariantFailures + " OK=" + ok + "\n");
  app.exit(ok ? 0 : 1);
});
