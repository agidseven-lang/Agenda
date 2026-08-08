/* F3.5.6A-H3 — RED EMPACOTADO (P0): a tarefa NOVA "confirma envio" no card mas NÃO entra na Central.
 * Cadeia 100% REAL:
 *   • RENDERER real do asar (index.html 1.0.231/1.0.232) — card, Central e derivações canônicas.
 *   • WORKER real (cloudflare-worker.js) — wfApplyConfirmSend rodando em vm com captura do commit
 *     Firestore (fetch stub); o commit REAL é decodificado e aplicado ao doc → afterConfirm.
 *
 * PROVA DOS DOIS CENÁRIOS (mandato do owner):
 *   CENÁRIO A — SÓ GERAR O LINK (clientReviewToken setado; workflowPhase='themes_preparation';
 *     sem approvalRound; sem confirmar). Contrato correto: card NÃO pode dizer "Temas enviados ao
 *     cliente" nem "Responsável: Cliente"; deve ficar "pronto/ confirmar envio"; fora da Central.
 *   CENÁRIO B — CONFIRMAR ENVIO: roda o Worker REAL wfApplyConfirmSend → prova que persiste
 *     approvalRound(sent+sentAt), workflowPhase=themes_waiting_client, externalWait=true,
 *     responsibleType=client e espelhos legados; card+Central concordam (Não visualizadas).
 *
 * Contadores:
 *   redFindings        = nº de checagens de CONTRATO que falham (evidência do bug). 1.0.231 ⇒ ≥2.
 *   invariantFailures  = nº de INVARIANTES que falham (Worker/harness). Deve ser 0 nas duas rodadas.
 * RED confirmado = (redFindings>=2 && invariantFailures==0). GREEN = (redFindings==0 && invariantFailures==0). */
const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const vm = require("vm");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f356ah3-qa");
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }
process.on("uncaughtException", (e) => { try { process.stdout.write("PROOF_DONE proofs=? redFindings=? invariantFailures=999 FATAL=uncaught:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });
process.on("unhandledRejection", (e) => { try { process.stdout.write("PROOF_DONE proofs=? redFindings=? invariantFailures=999 FATAL=unhandled:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();

/* ───────────────────────── WORKER REAL (vm) — wfApplyConfirmSend ───────────────────────── */
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

/* ───────────────────────── RENDERER REAL (asar) ───────────────────────── */
let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f356ah3-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f356ah3-app-" + Date.now() + ".asar");
  await asar.createPackage(stage, asarPath);
}

const results = [];
let redFindings = 0, invariantFailures = 0;
/* kind: 'CONTRATO' (falha ⇒ redFindings), 'INVARIANTE' (falha ⇒ invariantFailures), 'OBSERVADO' (só registro) */
function rec(name, kind, ok, info) {
  results.push({ name, kind, ok: !!ok, info: info || {} });
  if (!ok && kind === "CONTRATO") redFindings++;
  if (!ok && kind === "INVARIANTE") invariantFailures++;
  line({ proof: name, kind, ok: !!ok, info: info || {} });
}

app.whenReady().then(async () => {
  const WATCHDOG = setTimeout(() => { try { process.stdout.write("PROOF_DONE proofs=" + results.length + " redFindings=" + redFindings + " invariantFailures=999 FATAL=watchdog\n"); } catch (_) {} app.exit(1); }, 6 * 60 * 1000);
  try { session.defaultSession.webRequest.onBeforeRequest((d, cb) => { cb({ cancel: /^https?:/i.test(d.url) }); }); } catch (_) {}

  const VERSION = process.env.H3_VERSION || "1.0.232";
  const ANA = "uid-ana-social";
  const NOW = Date.now();
  const T0 = NOW - 6 * 60000;

  /* CENÁRIO A — tarefa NOVA: "Enviar ao cliente" gerou o LINK (clientReviewToken via index.html:9289),
     nascimento workflowPhase='themes_preparation' (index.html:11612); NADA confirmado. */
  const taskA = {
    id: "task-h3-a", sector: "cronograma", status: "andamento",
    title: "Cronograma Teste", client: "CLIENTE TESTE",
    by: ANA, socialOwnerId: ANA,
    cronContents: [{ tema: "Tema 1" }],
    clientReviewToken: "tok_h3_aaaaaaaa",
    clientReviewUrl: "https://portal/share/cronograma/tok_h3_aaaaaaaa",
    workflowPhase: "themes_preparation", workflowPhaseAt: T0,
    workflowResponsibleType: "social", workflowResponsibleUid: ANA,
    phaseRuns: { pr01_themes_preparation: { phase: "themes_preparation", responsibleType: "social", responsibleUid: ANA, startedAt: T0, dueAt: 0, completedAt: 0, status: "active", outcome: "" } },
    createdAt: T0,
  };
  /* REGRESSÃO — registro LEGADO (as "5 tarefas antigas" que aparecem na Central): SEM workflowPhase,
     espelho legado cronStatus='enviado_cliente'. Deve continuar entrando na Central após a correção. */
  const legacyTask = {
    id: "task-h3-legacy", sector: "cronograma", status: "andamento",
    title: "Cronograma Antigo", client: "CLIENTE ANTIGO",
    by: ANA, socialOwnerId: ANA,
    cronContents: [{ tema: "Tema A" }, { tema: "Tema B" }],
    cronStatus: "enviado_cliente", clientFlowStatus: "enviado",
    clientReviewToken: "tok_h3_legacy1", clientSentAt: T0,
    createdAt: T0 - 3 * 24 * 3600 * 1000,
  };

  /* CENÁRIO B — roda o WORKER REAL wfApplyConfirmSend sobre a MESMA taskA (após confirmar envio). */
  let wc = null;
  try { wc = await runWorkerConfirmSend(taskA, NOW, ANA, "Ana Beatriz", taskA.clientReviewToken); }
  catch (e) { rec("W00 Worker wfApplyConfirmSend executável em vm", "INVARIANTE", false, { err: String((e && e.message) || e) }); }
  const afterConfirm = wc ? wc.afterConfirm : null;

  if (wc) {
    rec("W01 Worker wfApplyConfirmSend: ok + 1 commit + roundKey ar_themes_r1 + phaseTo themes_waiting_client",
      "INVARIANTE",
      !!(wc.ret && wc.ret.ok === true && wc.commits === 1 && wc.ret.roundKey === "ar_themes_r1" && wc.ret.phaseTo === "themes_waiting_client"),
      { ret: wc.ret, commits: wc.commits });
    const ar = afterConfirm && afterConfirm.approvalRounds && afterConfirm.approvalRounds.ar_themes_r1;
    rec("W02 [PROVA-WORKER] approvalRound THEMES criada: status='sent' + sentAt>0 + type='themes'",
      "INVARIANTE",
      !!(ar && ar.status === "sent" && Number(ar.sentAt) > 0 && ar.type === "themes"),
      { round: ar || null });
    rec("W03 [PROVA-WORKER] workflowPhase='themes_waiting_client' persistido",
      "INVARIANTE", !!(afterConfirm && afterConfirm.workflowPhase === "themes_waiting_client"),
      { workflowPhase: afterConfirm && afterConfirm.workflowPhase });
    rec("W04 [PROVA-WORKER] externalWait=true + workflowResponsibleType='client'",
      "INVARIANTE", !!(afterConfirm && afterConfirm.externalWait === true && afterConfirm.workflowResponsibleType === "client"),
      { externalWait: afterConfirm && afterConfirm.externalWait, respType: afterConfirm && afterConfirm.workflowResponsibleType });
    rec("W05 [PROVA-WORKER] espelhos legados: clientFlowStatus='enviado' + cronStatus='enviado_cliente' + clientSentAt>0",
      "INVARIANTE",
      !!(afterConfirm && afterConfirm.clientFlowStatus === "enviado" && afterConfirm.cronStatus === "enviado_cliente" && Number(afterConfirm.clientSentAt) > 0),
      { clientFlowStatus: afterConfirm && afterConfirm.clientFlowStatus, cronStatus: afterConfirm && afterConfirm.cronStatus, clientSentAt: afterConfirm && afterConfirm.clientSentAt });
  }

  /* semente do renderer real */
  const seed = {
    self: { id: ANA, name: "Ana Beatriz Social Media", role: "Social Media", admin: false, status: "ativo" },
    users: [{ id: ANA, name: "Ana Beatriz Social Media", role: "Social Media", status: "ativo" }],
    tasks: [taskA], events: [], version: VERSION,
  };
  fs.writeFileSync(path.join(os.tmpdir(), "f356ah3-seed.json"), JSON.stringify(seed));

  await packAsar();
  const win = new BrowserWindow({ width: 1280, height: 860, show: false, webPreferences: {
    preload: path.join(__dirname, "f356ah3-red-preload.js"),
    contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  const wcp = win.webContents;
  wcp.on("console-message", (_e, lvl, msg, ln, src) => { if (lvl >= 2) line({ console: String(msg).slice(0, 200), src: String(src || "").split("/").pop(), ln }); });
  const J = (code) => wcp.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));

  await win.loadURL("file://" + asarPath.replace(/\\/g, "/") + "/src/renderer/index.html");
  let boot = null;
  for (let i = 0; i < 40; i++) {
    boot = await J(`(function(){ var st=(typeof state!=='undefined')?state:null; return { user:!!(st&&st.user), tasks:((st&&st.tasks)||[]).length, fns:(typeof deriveCanonicalTaskState==='function'&&typeof externalWaitOf==='function'&&typeof wfApprovalsCats==='function'&&typeof deriveSocialPerspective==='function'&&typeof flowThemesSentSignal==='function'&&typeof wfConfirmClientSend==='function'), ver:(window.desktopAPI&&window.desktopAPI.version)||'' }; })()`);
    if (boot && boot.user && boot.fns) break;
    await sleep(400);
  }
  rec("R01 renderer REAL do asar bootado (Social logada, derivações canônicas vivas)",
    "INVARIANTE", !!(boot && boot.user && boot.fns), boot);

  /* entra em Tarefas → Cliente (contexto físico do owner) */
  await J(`(function(){ try{ state.tab='tarefas'; state.flowView='client'; render(); }catch(e){} return 1; })()`);
  await sleep(300);

  const AJSON = JSON.stringify(taskA);

  /* ── CENÁRIO A — SÓ GERAR O LINK ── */
  const a = await J(`(function(){ var t=${AJSON};
    var cs=deriveCanonicalTaskState(t); var sp=deriveSocialPerspective(t);
    var sig=flowThemesSentSignal(t);
    var t2=JSON.parse(JSON.stringify(t)); delete t2.clientReviewToken; delete t2.shareToken; delete t2.clientSentBy;
    var sig2=flowThemesSentSignal(t2); var cs2=deriveCanonicalTaskState(t2);
    var ew=externalWaitOf(t); var cats=wfApprovalsCats([t]); var xi=wfExternalInfo(t); var lr=wfLatestRound(t,'themes');
    return { phase:cs.phase, owner:cs.owner, label:sp.label, next:sp.next, col:sp.col,
      signalWithToken:sig, signalNoToken:sig2, phaseNoToken:cs2.phase,
      externalWait:ew, catsTotal:cats.total, nv:cats.nv.length, vs:cats.vs.length, aj:cats.aj.length, ap:cats.ap.length,
      roundKey:xi.roundKey, sentAt:xi.sentAt, latestRoundNull:(lr===null) };
  })()`);
  rec("C1 [CONTRATO] Cenário A: card NÃO mostra 'Temas enviados ao cliente' nem Responsável Cliente (link ≠ envio)",
    "CONTRATO",
    !!(a && a.phase !== "themes_sent" && a.owner !== "client" && a.label !== "Temas enviados ao cliente"),
    { phase: a && a.phase, owner: a && a.owner, label: a && a.label, next: a && a.next, signalWithToken: a && a.signalWithToken });
  rec("C2 [CONTRATO] Cenário A: card mostra estado 'pronto/confirmar envio' (não enviado)",
    "CONTRATO",
    !!(a && /pronto para envio|confirmar envio/i.test(String(a.label || ""))),
    { label: a && a.label, next: a && a.next });
  rec("I1 [INVARIANTE] Cenário A: fora da Central — externalWaitOf=false e nenhuma categoria",
    "INVARIANTE",
    !!(a && a.externalWait === false && a.catsTotal === 0 && a.nv === 0 && a.vs === 0 && a.aj === 0),
    { externalWait: a && a.externalWait, catsTotal: a && a.catsTotal, nv: a && a.nv, vs: a && a.vs, aj: a && a.aj, ap: a && a.ap });
  rec("I2 [INVARIANTE] Cenário A: sem approvalRound e sem sentAt (portal não tem o que carimbar → sem 'visualizou')",
    "INVARIANTE",
    !!(a && a.latestRoundNull === true && a.roundKey === "" && a.sentAt === 0),
    { latestRoundNull: a && a.latestRoundNull, roundKey: a && a.roundKey, sentAt: a && a.sentAt });
  rec("PIN sub-causa: flowThemesSentSignal = true SÓ por causa do token; sem token → false e fase 'planning'",
    "OBSERVADO", true,
    { signalWithToken: a && a.signalWithToken, signalNoToken: a && a.signalNoToken, phaseNoToken: a && a.phaseNoToken });

  /* ── CENÁRIO B — CONFIRMAR ENVIO (doc REAL produzido pelo Worker) ── */
  if (afterConfirm) {
    const BJSON = JSON.stringify(afterConfirm);
    const b = await J(`(function(){ var t=${BJSON};
      var cs=deriveCanonicalTaskState(t); var sp=deriveSocialPerspective(t);
      var ew=externalWaitOf(t); var cats=wfApprovalsCats([t]); var xi=wfExternalInfo(t);
      return { phase:cs.phase, owner:cs.owner, label:sp.label, externalWait:ew,
        catsTotal:cats.total, nv:cats.nv.length, vs:cats.vs.length, sentAt:xi.sentAt, roundKey:xi.roundKey };
    })()`);
    rec("I4 [INVARIANTE] Cenário B: entra na Central em 'Não visualizadas' (externalWait + nv=1 + total=1)",
      "INVARIANTE",
      !!(b && b.externalWait === true && b.nv === 1 && b.catsTotal === 1 && b.sentAt > 0),
      { externalWait: b && b.externalWait, nv: b && b.nv, total: b && b.catsTotal, sentAt: b && b.sentAt, roundKey: b && b.roundKey });
    rec("I5 [INVARIANTE] Cenário B: card mostra 'Temas enviados ao cliente' (agora CORRETO — houve envio canônico)",
      "INVARIANTE",
      !!(b && b.label === "Temas enviados ao cliente" && b.phase === "themes_sent" && b.owner === "client"),
      { label: b && b.label, phase: b && b.phase, owner: b && b.owner });
  }

  /* I6 — o botão "Confirmar envio" do renderer POSTa confirmClientSend ao Worker (wiring real) */
  await J(`window.__emitTasks(${JSON.stringify([taskA])})`);
  await sleep(200);
  await J(`(async function(){ try{ await wfConfirmClientSend('task-h3-a'); }catch(e){} return 1; })()`);
  await sleep(400);
  const posts = await J(`(function(){ return (window.__TEAM_POSTS||[]).map(function(p){ return { action:(p.body&&p.body.action)||'', auth:!!(p.headers&&(p.headers.Authorization||p.headers.authorization)), url:String(p.url||'').indexOf('/team-action')>=0 }; }); })()`);
  const confirmPost = Array.isArray(posts) ? posts.find((p) => p.action === "confirmClientSend") : null;
  rec("I6 [INVARIANTE] wiring renderer→Worker: 'Confirmar envio' chama wfTeamAction('confirmClientSend') com Authorization",
    "INVARIANTE", !!(confirmPost && confirmPost.auth && confirmPost.url), { posts, confirmPost });

  /* ── REGRESSÃO — tarefa LEGADA (sem workflowPhase) deve continuar na Central e "enviada" ── */
  const LJSON = JSON.stringify(legacyTask);
  const lg = await J(`(function(){ var t=${LJSON};
    var cs=deriveCanonicalTaskState(t); var sp=deriveSocialPerspective(t);
    var ew=externalWaitOf(t); var cats=wfApprovalsCats([t]);
    return { phase:cs.phase, label:sp.label, externalWait:ew, total:cats.total, nv:cats.nv.length, vs:cats.vs.length };
  })()`);
  rec("I7 [INVARIANTE] Regressão: tarefa LEGADA (sem workflowPhase, cronStatus=enviado_cliente) segue 'enviada' e na Central",
    "INVARIANTE",
    !!(lg && lg.phase === "themes_sent" && lg.label === "Temas enviados ao cliente" && lg.externalWait === true && lg.total === 1),
    { phase: lg && lg.phase, label: lg && lg.label, externalWait: lg && lg.externalWait, total: lg && lg.total });

  clearTimeout(WATCHDOG);
  fs.writeFileSync(path.join(OUT, "f356ah3-red-results.json"), JSON.stringify({ version: VERSION, generatedAt: NOW, redFindings, invariantFailures, worker: wc ? { ret: wc.ret, commits: wc.commits, writeMask: wc.writeMask } : null, results }, null, 2));
  process.stdout.write("PROOF_DONE proofs=" + results.length + " redFindings=" + redFindings + " invariantFailures=" + invariantFailures + "\n");
  app.exit((redFindings >= 2 && invariantFailures === 0) || (redFindings === 0 && invariantFailures === 0) ? 0 : 1);
});
