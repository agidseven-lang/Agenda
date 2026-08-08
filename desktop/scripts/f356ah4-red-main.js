/* F3.5.6A-H4 — RED EMPACOTADO pelo CAMINHO REAL DE CRIAÇÃO (mandato do owner: NÃO seed artificial).
 *
 * O que a H3 NÃO fez: exercitar o PRODUTOR. Aqui o renderer REAL do asar executa o fluxo do owner —
 *   Nova tarefa → Cronograma → 1 tema → clicar "Enviar para o cliente" (handler index.html:12193:
 *   state.form._sendAfterSave=true; render(); await saveTask()) — e o PRELOAD intercepta os WRITES REAIS
 *   do Firestore (o doc que a criação de fato grava). As derivações canônicas (card + Central) rodam
 *   sobre ESSE doc real, não sobre um objeto semeado.
 *
 * DUAS BUILDS do MESMO fluxo, no MESMO harness:
 *   • BASE (1.0.232) — reconstruída em runtime revertendo os 2 deltas do H4 (writer + guard do reader),
 *     cada reversão VALIDADA (se o alvo não casar, INVARIANTE falha; base errada nunca passa em silêncio).
 *     Contrato do BUG (o que o owner viu FISICAMENTE): criar/Enviar SEM confirmar → clientFlowStatus='enviado'
 *     na criação → card "Temas enviados ao cliente" (Responsável: Cliente). ⇒ baseRed>=2 = RED reproduzido.
 *   • FIX (1.0.233) — worktree atual. Cenário A: criar/Enviar SEM confirmar → clientFlowStatus='afazer',
 *     cronStatus='pronto_cliente', workflowPhase='themes_preparation' → "Temas prontos — confirmar envio ao
 *     cliente" (dono Social; FORA da Central; sem sentAt/approvalRound). Cenário B (Worker REAL
 *     wfApplyConfirmSend): → themes_sent + Central "Não visualizadas". Cenário C (falha do servidor):
 *     zero write persistido, mensagem, form preservado. Cenário D: reabrir/persistir mantém themes_ready.
 *     Cenário E: 2ª tarefa independente. Compat legado: registro sem workflowPhase segue "enviado" + Central.
 *
 * SUCESSO = (baseRed>=2) && (fixViolations==0) && (invariantFailures==0). */
const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const vm = require("vm");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f356ah4-qa");
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }
process.on("uncaughtException", (e) => { try { process.stdout.write("PROOF_DONE baseRed=? fixViolations=? invariantFailures=999 FATAL=uncaught:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });
process.on("unhandledRejection", (e) => { try { process.stdout.write("PROOF_DONE baseRed=? fixViolations=? invariantFailures=999 FATAL=unhandled:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();

/* ───────────────────────── WORKER REAL (vm) — wfApplyConfirmSend (idêntico ao usado na H3) ───────────────────────── */
function extractFn(src, header) {
  const i = src.indexOf(header);
  if (i < 0) throw new Error("header não encontrado: " + header);
  let j = src.indexOf("{", i); let depth = 0;
  for (let k = j; k < src.length; k++) {
    const c = src[k];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(i, k + 1); }
  }
  throw new Error("chaves desbalanceadas: " + header);
}
function dec(v) {
  if (v == null || typeof v !== "object") return v;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if (v.mapValue) { const o = {}; const f = v.mapValue.fields || {}; for (const k in f) o[k] = dec(f[k]); return o; }
  if (v.arrayValue) { return (v.arrayValue.values || []).map(dec); }
  return v;
}
function applyCommit(doc, fields, mask) {
  const out = JSON.parse(JSON.stringify(doc));
  for (const fp of mask) {
    const parts = fp.split(".");
    let srcV = fields[parts[0]];
    for (let i = 1; i < parts.length && srcV; i++) srcV = (srcV.mapValue && srcV.mapValue.fields) ? srcV.mapValue.fields[parts[i]] : undefined;
    if (srcV === undefined) continue;
    let tgt = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!tgt[parts[i]] || typeof tgt[parts[i]] !== "object") tgt[parts[i]] = {};
      tgt = tgt[parts[i]];
    }
    tgt[parts[parts.length - 1]] = dec(srcV);
  }
  return out;
}
async function runWorkerConfirmSend(taskDoc, atMs, uid, byName, token) {
  const wsrc = fs.readFileSync(path.join(__dirname, "..", "..", "cloudflare-worker.js"), "utf8");
  const captured = [];
  const ctx = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Math, JSON, Object, Array, Number, String, Date, parseInt, RegExp, encodeURIComponent, decodeURIComponent,
    fetch: async (url, opts) => {
      let body = {}; try { body = JSON.parse((opts && opts.body) || "{}"); } catch (_) {}
      captured.push({ url: String(url || ""), body });
      return { ok: true, status: 200, text: async () => "{}", json: async () => ({}) };
    },
    FIRESTORE_BASE: "https://firestore.googleapis.com/v1",
  };
  vm.createContext(ctx);
  const fns = [
    "function maskUid(", "function wfRoundType(", "function wfWaitPhase(", "function wfAdjustPhase(",
    "function wfRounds(", "function wfRuns(", "function wfRoundSeq(", "function wfLatestRoundKey(",
    "function wfNextRoundKey(", "function wfNextRunKey(", "function wfActiveRunKeys(", "function wfSocialUid(",
    "function wfS(", "function wfI(", "function wfB(", "function wfMap(", "function wfFieldsSet(",
    "function wfLedger(", "function wfMirrors(", "function wfCloseActiveRuns(", "function wfOpenRun(",
    "async function wfApplyConfirmSend(",
  ];
  let code = extractFn(wsrc, "const WF_PHASE = {") + ";\n";
  for (const m of fns) code += extractFn(wsrc, m) + "\n";
  code += "globalThis.__confirm = wfApplyConfirmSend;\n";
  vm.runInContext(code, ctx);
  const env = { FCM_PROJECT_ID: "id-seven-proj" };
  const ret = await ctx.__confirm(env, "access-token", JSON.parse(JSON.stringify(taskDoc)), { at: atMs, phase: "themes", byName, uid, token });
  let afterConfirm = JSON.parse(JSON.stringify(taskDoc));
  let writeMask = [];
  if (captured.length === 1 && captured[0].body && Array.isArray(captured[0].body.writes) && captured[0].body.writes[0]) {
    const w = captured[0].body.writes[0];
    writeMask = (w.updateMask && w.updateMask.fieldPaths) || [];
    afterConfirm = applyCommit(afterConfirm, (w.update && w.update.fields) || {}, writeMask);
  }
  return { ret, commits: captured.length, writeMask, afterConfirm };
}

/* ───────────────────────── RECONSTRUÇÃO DETERMINÍSTICA DA BASE (1.0.232) ───────────────────────── */
function countOcc(s, sub) { let n = 0, i = 0; while ((i = s.indexOf(sub, i)) >= 0) { n++; i += sub.length; } return n; }
const GUARD_RE = /\n[ \t]*if\(wp\)return false; \/\/ F3\.5\.6A-H4:[^\n]*/;
const FIX_WRITER = "data.clientFlowStatus='afazer';data.clientWorkflowStage='afazer';}";
const BASE_WRITER = "data.clientFlowStatus=sendAfter?'enviado':'afazer';data.clientWorkflowStage=data.clientFlowStatus;}";
function buildBaseHtml(fixHtml) {
  const errs = [];
  if (!GUARD_RE.test(fixHtml)) errs.push("guard-line-ausente");
  if (countOcc(fixHtml, FIX_WRITER) !== 1) errs.push("writer-fix-nao-unico(" + countOcc(fixHtml, FIX_WRITER) + ")");
  if (errs.length) return { html: null, errs };
  let s = fixHtml.replace(GUARD_RE, "");           // (1) reader: remove o guard do H4
  s = s.replace(FIX_WRITER, BASE_WRITER);          // (2) writer: volta a gravar 'enviado' na criação
  if (/if\(wp\)return false; \/\/ F3\.5\.6A-H4:/.test(s)) errs.push("guard-persistiu");
  if (s.indexOf(BASE_WRITER) < 0) errs.push("base-writer-nao-aplicado");
  if (s.indexOf(FIX_WRITER) >= 0) errs.push("fix-writer-persistiu");
  return { html: errs.length ? null : s, errs };
}

async function packAsar(htmlContent, tag) {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f356ah4-" + tag + "-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  fs.writeFileSync(path.join(rdir, "index.html"), htmlContent);
  for (const f of ["priorityEngine.js"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  const out = path.join(os.tmpdir(), "f356ah4-" + tag + "-" + Date.now() + ".asar");
  await asar.createPackage(stage, out);
  return out;
}

/* ───────────────────────── contadores/registro ───────────────────────── */
const results = [];
let baseRed = 0, fixViolations = 0, invariantFailures = 0;
function recRed(name, bugPresent, info) { results.push({ name, kind: "RED", bugPresent: !!bugPresent, info: info || {} }); if (bugPresent) baseRed++; line({ proof: name, kind: "RED", bugPresent: !!bugPresent, info: info || {} }); }
function recFix(name, ok, info) { results.push({ name, kind: "GREEN", ok: !!ok, info: info || {} }); if (!ok) fixViolations++; line({ proof: name, kind: "GREEN", ok: !!ok, info: info || {} }); }
function recInv(name, ok, info) { results.push({ name, kind: "INV", ok: !!ok, info: info || {} }); if (!ok) invariantFailures++; line({ proof: name, kind: "INV", ok: !!ok, info: info || {} }); }

/* boota um asar e devolve helpers */
async function bootAsar(asarPath, label) {
  const win = new BrowserWindow({ width: 1280, height: 860, show: false, webPreferences: {
    preload: path.join(__dirname, "f356ah4-red-preload.js"),
    contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  const wcp = win.webContents;
  wcp.on("console-message", (_e, lvl, msg, ln, src) => { if (lvl >= 2) line({ console: String(msg).slice(0, 200), src: String(src || "").split("/").pop(), ln, win: label }); });
  const J = (code) => wcp.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));
  await win.loadURL("file://" + asarPath.replace(/\\/g, "/") + "/src/renderer/index.html");
  let boot = null;
  for (let i = 0; i < 40; i++) {
    boot = await J(`(function(){ var st=(typeof state!=='undefined')?state:null; return { user:!!(st&&st.user), fns:(typeof deriveCanonicalTaskState==='function'&&typeof saveTask==='function'&&typeof newForm==='function'&&typeof externalWaitOf==='function'&&typeof wfApprovalsCats==='function'&&typeof deriveSocialPerspective==='function'&&typeof render==='function'), ver:(window.desktopAPI&&window.desktopAPI.version)||'' }; })()`);
    if (boot && boot.user && boot.fns) break;
    await sleep(400);
  }
  return { win, J, boot };
}

/* dirige o FLUXO REAL: Nova tarefa → Cronograma → 1 tema → "Enviar para o cliente"; captura o WRITE real. */
async function driveCreation(J, opts) {
  opts = opts || {};
  const code = `(async function(){
    window.__DB_FAIL = ${opts.fail ? "true" : "false"};
    try{ window.__resetWrites(); }catch(e){}
    try{ (window.__DIAG||[]).length=0; }catch(e){}
    state.tab='tarefas';
    state.form = newForm('cronograma');
    state.form.title = ${JSON.stringify(opts.title || "Cronograma Teste 3")};
    state.form.client = ${JSON.stringify(opts.client || "CLIENTE TESTE")};
    state.form.contents = [{tema:${JSON.stringify(opts.tema || "Tema 1")}}];
    state.form.status='afazer';
    /* handler REAL de [data-sendclient] (index.html:12193-12197) — sem atalho: */
    state.form._sendAfterSave=true; state.form._sending=true;
    try{ render(); }catch(e){}
    var saveErr=null;
    try{ await saveTask(); }catch(e){ saveErr=String(e&&e.message||e); }
    var w=(window.__WRITES||[]).filter(function(x){return x.coll==='tasks';});
    var setW=w.filter(function(x){return x.op==='set'||x.op==='add';});
    var creation=setW.length?setW[0]:null;
    var id=creation?creation.id:null;
    var finalDoc=id?((window.__STORE&&window.__STORE.tasks&&window.__STORE.tasks[id])||null):null;
    /* NENHUM write do fluxo REAL de "Enviar" (criação + geração do link) pode marcar envio confirmado. */
    var anyEnviado=setW.some(function(x){return x.payload&&(x.payload.clientFlowStatus==='enviado'||x.payload.clientFlowStatus==='reenviado');});
    return { writes:w.length, setWrites:setW.length, creationId:id,
      creationDoc:creation?creation.payload:null, finalDoc:finalDoc, anyEnviado:anyEnviado,
      formNulled:(state.form===null), saveErr:saveErr,
      diagAlert:(window.__DIAG||[]).some(function(d){return d.ev==='alert';}) };
  })()`;
  return await J(code);
}

/* roda as derivações canônicas (card + Central) sobre um doc REAL */
async function deriveOn(J, doc) {
  const DJSON = JSON.stringify(doc);
  return await J(`(function(){ var t=${DJSON};
    var cs=deriveCanonicalTaskState(t); var sp=deriveSocialPerspective(t);
    var ew=externalWaitOf(t); var cats=wfApprovalsCats([t]); var xi=wfExternalInfo(t);
    return { phase:cs.phase, owner:cs.owner, label:sp.label, next:sp.next, col:sp.col,
      externalWait:ew, catsTotal:cats.total, nv:cats.nv.length, vs:cats.vs.length, aj:cats.aj.length, ap:cats.ap.length,
      sig:flowThemesSentSignal(t), rdy:flowThemesReadySignal(t), canon:flowCanonicalSentSignal(t),
      sentTo:flowSentToClientSignal(t), roundKey:xi.roundKey, sentAt:xi.sentAt,
      clientFlowStatus:t.clientFlowStatus, cronStatus:t.cronStatus, workflowPhase:t.workflowPhase }; })()`);
}

app.whenReady().then(async () => {
  const WATCHDOG = setTimeout(() => { try { process.stdout.write("PROOF_DONE baseRed=" + baseRed + " fixViolations=" + fixViolations + " invariantFailures=999 FATAL=watchdog\n"); } catch (_) {} app.exit(1); }, 8 * 60 * 1000);
  try { session.defaultSession.webRequest.onBeforeRequest((d, cb) => { cb({ cancel: /^https?:/i.test(d.url) }); }); } catch (_) {}

  const VERSION = process.env.H4_VERSION || "1.0.233";
  const ANA = "uid-ana-social";
  const NOW = Date.now();

  /* semente comum: Social logada (canSeeAll), sem tarefas pré-existentes (a criação é o único produtor). */
  const seed = {
    self: { id: ANA, name: "Ana Beatriz Social Media", role: "Social Media", admin: false, status: "ativo" },
    users: [{ id: ANA, name: "Ana Beatriz Social Media", role: "Social Media", status: "ativo" }],
    tasks: [], events: [], version: VERSION,
  };
  fs.writeFileSync(path.join(os.tmpdir(), "f356ah4-seed.json"), JSON.stringify(seed));

  /* fontes dos dois renderers */
  const SRC = path.join(__dirname, "..", "src", "renderer", "index.html");
  const fixHtml = fs.readFileSync(SRC, "utf8");
  const base = buildBaseHtml(fixHtml);
  recInv("B00 reconstrução da BASE (1.0.232) — writer+guard revertidos e validados (base errada ⇒ falha, nunca passa mudo)",
    base.html !== null, { errs: base.errs });

  const fixAsar = await packAsar(fixHtml, "fix");
  const baseAsar = base.html ? await packAsar(base.html, "base") : null;

  /* ══════════════════════════ FIX (1.0.233) — CAMINHO REAL ══════════════════════════ */
  const F = await bootAsar(fixAsar, "fix");
  recInv("R00 renderer FIX (1.0.233) bootado (Social logada, saveTask/newForm/derivações vivos)",
    !!(F.boot && F.boot.user && F.boot.fns), F.boot);

  /* ── Cenário A — criar/Enviar SEM confirmar (fluxo real do owner) ── */
  const fA = await driveCreation(F.J, { title: "Cronograma Teste 3", tema: "Tema 1" });
  recFix("A0 [WRITER] a criação REAL executou o write real em tasks (saveTask gravou o doc)",
    !!(fA && fA.setWrites >= 1 && fA.creationDoc), { writes: fA && fA.writes, setWrites: fA && fA.setWrites, saveErr: fA && fA.saveErr });
  const fixDoc = fA && fA.creationDoc;          // doc EXATO da criação (o write real do saveTask)
  const fixFinal = (fA && fA.finalDoc) || fixDoc; // doc persistido após "Enviar" (criação + link) = fonte do card
  recFix("A1 [WRITER] NENHUM write do fluxo real marca envio — doc da criação nasce clientFlowStatus='afazer' (nunca 'enviado')",
    !!(fixDoc && fixDoc.clientFlowStatus === "afazer" && fixDoc.clientWorkflowStage === "afazer" && fA.anyEnviado === false),
    { clientFlowStatus: fixDoc && fixDoc.clientFlowStatus, anyEnviado: fA && fA.anyEnviado, setWrites: fA && fA.setWrites });
  recFix("A2 [WRITER] \"Enviar\" só deixa PRONTO — cronStatus='pronto_cliente' + workflowPhase='themes_preparation'; sem sentAt/approvalRounds/externalWait",
    !!(fixDoc && fixDoc.cronStatus === "pronto_cliente" && fixDoc.workflowPhase === "themes_preparation" && !fixDoc.sentAt && !fixDoc.approvalRounds && fixDoc.externalWait === false),
    { cronStatus: fixDoc && fixDoc.cronStatus, workflowPhase: fixDoc && fixDoc.workflowPhase, sentAt: fixDoc && fixDoc.sentAt, externalWait: fixDoc && fixDoc.externalWait, approvalRounds: !!(fixDoc && fixDoc.approvalRounds) });
  const dA = fixFinal ? await deriveOn(F.J, fixFinal) : null;  // card = doc REAL persistido (com link gerado)
  recFix("A3 [READER] card do doc REAL persistido (com link): 'Temas prontos — confirmar envio ao cliente' (dono Social; NÃO 'enviado')",
    !!(dA && dA.phase === "themes_ready" && dA.owner === "social" && /pronto.*confirmar envio/i.test(String(dA.label || ""))),
    { phase: dA && dA.phase, owner: dA && dA.owner, label: dA && dA.label, hasToken: !!(fixFinal && fixFinal.clientReviewToken) });
  recFix("A4 [READER] sinais canônicos: flowThemesSentSignal=false, flowCanonicalSentSignal=false, flowThemesReadySignal=true",
    !!(dA && dA.sig === false && dA.canon === false && dA.rdy === true),
    { sig: dA && dA.sig, canon: dA && dA.canon, rdy: dA && dA.rdy });
  recFix("A5 [CENTRAL] FORA da Central — externalWaitOf=false, zero categorias, sem sentAt/roundKey",
    !!(dA && dA.externalWait === false && dA.catsTotal === 0 && dA.nv === 0 && dA.sentAt === 0 && dA.roundKey === ""),
    { externalWait: dA && dA.externalWait, catsTotal: dA && dA.catsTotal, nv: dA && dA.nv, sentAt: dA && dA.sentAt, roundKey: dA && dA.roundKey });

  /* ── Cenário B — CONFIRMAR ENVIO (Worker REAL sobre o doc REAL da criação) ── */
  let wc = null;
  if (fixDoc) { try { wc = await runWorkerConfirmSend(fixDoc, NOW, ANA, "Ana Beatriz", fixDoc.clientReviewToken || "tok_h4"); } catch (e) { recInv("W00 Worker wfApplyConfirmSend executável em vm", false, { err: String((e && e.message) || e) }); } }
  const afterConfirm = wc ? wc.afterConfirm : null;
  if (wc) {
    recInv("W01 Worker: ok + 1 commit + roundKey ar_themes_r1 + phaseTo themes_waiting_client",
      !!(wc.ret && wc.ret.ok === true && wc.commits === 1 && wc.ret.roundKey === "ar_themes_r1" && wc.ret.phaseTo === "themes_waiting_client"),
      { ret: wc.ret, commits: wc.commits });
    const ar = afterConfirm && afterConfirm.approvalRounds && afterConfirm.approvalRounds.ar_themes_r1;
    recInv("W02 [PROVA-WORKER] approvalRound THEMES criada (status='sent' + sentAt>0 + type='themes') — só o Worker cria",
      !!(ar && ar.status === "sent" && Number(ar.sentAt) > 0 && ar.type === "themes"), { round: ar || null });
    recInv("W03 [PROVA-WORKER] workflowPhase='themes_waiting_client' + externalWait=true + responsável='client'",
      !!(afterConfirm && afterConfirm.workflowPhase === "themes_waiting_client" && afterConfirm.externalWait === true && afterConfirm.workflowResponsibleType === "client"),
      { workflowPhase: afterConfirm && afterConfirm.workflowPhase, externalWait: afterConfirm && afterConfirm.externalWait, respType: afterConfirm && afterConfirm.workflowResponsibleType });
    recInv("W04 [PROVA-WORKER] espelhos legados escritos SÓ no confirm: clientFlowStatus='enviado' + cronStatus='enviado_cliente' + clientSentAt>0",
      !!(afterConfirm && afterConfirm.clientFlowStatus === "enviado" && afterConfirm.cronStatus === "enviado_cliente" && Number(afterConfirm.clientSentAt) > 0),
      { clientFlowStatus: afterConfirm && afterConfirm.clientFlowStatus, cronStatus: afterConfirm && afterConfirm.cronStatus, clientSentAt: afterConfirm && afterConfirm.clientSentAt });
  }
  const dB = afterConfirm ? await deriveOn(F.J, afterConfirm) : null;
  recFix("B1 [READER] após CONFIRMAR (doc REAL do Worker): card 'Temas enviados ao cliente' (phase themes_sent, dono client)",
    !!(dB && dB.phase === "themes_sent" && dB.owner === "client" && dB.label === "Temas enviados ao cliente"),
    { phase: dB && dB.phase, owner: dB && dB.owner, label: dB && dB.label });
  recFix("B2 [CENTRAL] após CONFIRMAR: entra em 'Não visualizadas' (externalWait=true, nv=1, total=1, sentAt>0)",
    !!(dB && dB.externalWait === true && dB.nv === 1 && dB.catsTotal === 1 && dB.sentAt > 0),
    { externalWait: dB && dB.externalWait, nv: dB && dB.nv, total: dB && dB.catsTotal, sentAt: dB && dB.sentAt });

  /* I6 — wiring do botão "Confirmar envio" do renderer → Worker (confirmClientSend com Authorization).
     Usa o doc REAL persistido após "Enviar" (fixFinal) — que já tem o clientReviewToken exigido por wfTeamAction. */
  await F.J(`window.__emitTasks(${JSON.stringify([Object.assign({ id: "task-fix-a" }, fixFinal || {})])})`);
  await sleep(200);
  await F.J(`(async function(){ try{ await wfConfirmClientSend('task-fix-a'); }catch(e){} return 1; })()`);
  await sleep(400);
  const posts = await F.J(`(function(){ return (window.__TEAM_POSTS||[]).map(function(p){ return { action:(p.body&&p.body.action)||'', auth:!!(p.headers&&(p.headers.Authorization||p.headers.authorization)), url:String(p.url||'').indexOf('/team-action')>=0 }; }); })()`);
  const confirmPost = Array.isArray(posts) ? posts.find((p) => p.action === "confirmClientSend") : null;
  recInv("I6 [WIRING] 'Confirmar envio' do renderer chama wfTeamAction('confirmClientSend') com Authorization",
    !!(confirmPost && confirmPost.auth && confirmPost.url), { posts, confirmPost });

  /* ── Cenário C — FALHA DO SERVIDOR: criação rejeita → zero write persistido, mensagem, form preservado ── */
  const fC = await driveCreation(F.J, { fail: true, title: "Cronograma Falha", tema: "Tema X" });
  recFix("C1 [FALHA] set rejeitado ⇒ ZERO doc persistido em tasks (nenhum falso envio criado)",
    !!(fC && fC.setWrites === 0), { setWrites: fC && fC.setWrites, writes: fC && fC.writes });
  recFix("C2 [FALHA] mensagem de erro exibida + form preservado para retry (não nula)",
    !!(fC && fC.diagAlert === true && fC.formNulled === false), { diagAlert: fC && fC.diagAlert, formNulled: fC && fC.formNulled });

  /* ── Cenário D — REABRIR/PERSISTIR: o doc real (persistido) re-emitido como snapshot mantém themes_ready ── */
  let dD = null;
  if (fixFinal) {
    const reopened = await F.J(`(function(){ window.__emitTasks(${JSON.stringify([Object.assign({ id: "task-fix-d" }, fixFinal)])}); var t=(state.tasks||[]).find(function(x){return x.id==='task-fix-d';})||null; if(!t)return null; var cs=deriveCanonicalTaskState(t); var sp=deriveSocialPerspective(t); return { phase:cs.phase, owner:cs.owner, label:sp.label, ew:externalWaitOf(t) }; })()`);
    dD = reopened;
  }
  recFix("D1 [PERSISTÊNCIA] doc real recarregado (snapshot) permanece 'Temas prontos' (themes_ready, Social, fora da Central)",
    !!(dD && dD.phase === "themes_ready" && dD.owner === "social" && dD.ew === false),
    { phase: dD && dD.phase, owner: dD && dD.owner, ew: dD && dD.ew });

  /* ── Cenário E — SEGUNDA tarefa independente: confirmar a 1ª não afeta a 2ª ── */
  const fE = await driveCreation(F.J, { title: "Cronograma Teste 4", tema: "Tema Z" });
  const fixDoc2 = (fE && fE.finalDoc) || (fE && fE.creationDoc);
  const dE2 = fixDoc2 ? await deriveOn(F.J, fixDoc2) : null;
  recFix("E1 [INDEPENDÊNCIA] 2ª criação também nasce themes_ready (dono Social) — e confirmar a 1ª (themes_sent) não a contamina",
    !!(dE2 && dE2.phase === "themes_ready" && dE2.owner === "social" && dB && dB.phase === "themes_sent"),
    { task2: dE2 && dE2.phase, task1: dB && dB.phase });

  /* ── COMPAT LEGADO — registro genuinamente antigo (sem workflowPhase) segue "enviado" + Central ── */
  const legacyDoc = { id: "task-legacy", sector: "cronograma", status: "andamento", title: "Cronograma Antigo", client: "CLIENTE ANTIGO", by: ANA, socialOwnerId: ANA, cronContents: [{ tema: "Tema A" }], cronStatus: "enviado_cliente", clientFlowStatus: "enviado", clientReviewToken: "tok_legacy", clientSentAt: NOW - 3 * 24 * 3600 * 1000, createdAt: NOW - 3 * 24 * 3600 * 1000 };
  const dL = await deriveOn(F.J, legacyDoc);
  recFix("L1 [COMPAT] registro LEGADO (sem workflowPhase, cronStatus='enviado_cliente') continua 'enviado' e ENTRA na Central",
    !!(dL && dL.phase === "themes_sent" && dL.label === "Temas enviados ao cliente" && dL.externalWait === true && dL.catsTotal === 1),
    { phase: dL && dL.phase, label: dL && dL.label, externalWait: dL && dL.externalWait, total: dL && dL.catsTotal });

  try { F.win.destroy(); } catch (_) {}

  /* ══════════════════════════ BASE (1.0.232) — RED pelo MESMO caminho real ══════════════════════════ */
  let bDoc = null, dRed = null;
  if (baseAsar) {
    const B = await bootAsar(baseAsar, "base");
    recInv("R10 renderer BASE (1.0.232 reconstruída) bootado",
      !!(B.boot && B.boot.user && B.boot.fns), B.boot);
    const bA = await driveCreation(B.J, { title: "Cronograma Teste 3", tema: "Tema 1" });
    bDoc = bA && bA.creationDoc;
    dRed = bDoc ? await deriveOn(B.J, bDoc) : null;
    /* RED #1 — o WRITER antigo grava 'enviado' na criação (o produtor do bug) */
    recRed("RED1 [WRITER 1.0.232] criação/Enviar SEM confirmar já grava clientFlowStatus='enviado' (falso envio na criação)",
      !!(bDoc && bDoc.clientFlowStatus === "enviado"), { clientFlowStatus: bDoc && bDoc.clientFlowStatus, cronStatus: bDoc && bDoc.cronStatus, workflowPhase: bDoc && bDoc.workflowPhase });
    /* RED #2 — o READER antigo (sem guard) transforma isso em card "Temas enviados ao cliente" (Responsável: Cliente) */
    recRed("RED2 [READER 1.0.232] doc REAL da criação → card 'Temas enviados ao cliente' (phase themes_sent, dono client) — EXATAMENTE o defeito físico",
      !!(dRed && dRed.phase === "themes_sent" && dRed.owner === "client" && dRed.label === "Temas enviados ao cliente"),
      { phase: dRed && dRed.phase, owner: dRed && dRed.owner, label: dRed && dRed.label });
    try { B.win.destroy(); } catch (_) {}
  }

  clearTimeout(WATCHDOG);
  const ok = (baseRed >= 2 && fixViolations === 0 && invariantFailures === 0);
  fs.writeFileSync(path.join(OUT, "f356ah4-red-results.json"), JSON.stringify({
    version: VERSION, generatedAt: NOW, baseRed, fixViolations, invariantFailures,
    fix: { creationDoc: fixDoc, scenarioA: dA, scenarioB: dB, legacy: dL }, base: { creationDoc: bDoc, red: dRed },
    worker: wc ? { ret: wc.ret, commits: wc.commits, writeMask: wc.writeMask } : null, results,
  }, null, 2));
  process.stdout.write("PROOF_DONE baseRed=" + baseRed + " fixViolations=" + fixViolations + " invariantFailures=" + invariantFailures + " OK=" + ok + "\n");
  app.exit(ok ? 0 : 1);
});
