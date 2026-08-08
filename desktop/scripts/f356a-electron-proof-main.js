/* F3.5.6A — PROVAS REAIS (Electron 31.3.1; renderer EMPACOTADO em app.asar; xvfb).
 * MESMO padrão aprovado F3.5.5A-H1/W-H1: renderer REAL do asar + preload de semente
 * (f356a-proof-preload.js, stub firebase offline com RE-EMISSÃO ao vivo) — todo DOM/estado
 * medido é produzido pelo CÓDIGO DE PRODUÇÃO. As provas do lado MAIN usam os MÓDULOS REAIS
 * DO DIST (dist/main/workflowEvents.js + workflowNotifier.js — os MESMOS bytes que o
 * electron-builder empacota) com listener fake alimentado pelos mesmos docs. Sem IA, sem
 * mockup, sem HTML isolado.
 *
 * P01 ciclo de temas (fase persistida desde o nascimento; painel Fluxo da tarefa)
 * P02 aguardando cliente (chip Kanban: subtipo + não visualizado + tempo)
 * P03 não atrasada internamente (display waiting_client + Prioridades NORMAL + seção própria)
 * P04 cliente visualizou (INFORMATIVA sem som ao responsável; chip vira 'visualizado')
 * P05 temas aprovados (AÇÃO NECESSÁRIA imediata ao responsável)     P06 próxima ação no corpo
 * P07 atribuição: gate canônico na ESCRITA + fase design_production + itens 'pendente'
 * P08 Designer notificado (SÓ o designer do evento)                 P09 conclusões AGRUPADAS (4→1)
 * P10 produção concluída (canônico pelos ITENS; bola → Social; próxima ação legendas)
 * P11 legendas prontas (CAPTIONS_READY)                             P12 segunda aprovação (CAPTIONS)
 * P13 ajuste de legendas (PRIORITÁRIA)                              P14 aprovação via WhatsApp (server-side, auditável)
 * P15 follow-up = recomendação (COPIAR LEMBRETE; nunca wa.me/envio) P16 Central do Cliente (4 categorias)
 * P17 histórico por fases (phase runs preservados)                  P18 SLA interno × externo (gate POR TAREFA)
 * P19 infraestrutura 1.0.228 intacta no pacote (dist congelado)     P20 ciclo completo com histórico preservado */
const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f356a-qa");
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }
const ofs = require("original-fs");
const sha256 = (p) => crypto.createHash("sha256").update(ofs.readFileSync(p)).digest("hex");
process.on("uncaughtException", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=uncaught:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });
process.on("unhandledRejection", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=unhandled:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });

/* ---- SEMENTE ---- */
const NOW = Date.now();
const H = 3600 * 1000;
const ID = { ANA: "u-soc-ana", MARINA: "u-adm-marina", DIEGO: "u-des-diego" };
function run(phase, respType, respUid, startedAt, dueAt, done, outcome) {
  return { phase, responsibleType: respType, responsibleUid: respUid || "", startedAt, dueAt: dueAt || 0,
    completedAt: done ? (startedAt + H) : 0, status: done ? "done" : "active", outcome: outcome || "",
    delayMs: 0, elapsedMs: done ? H : 0, createdAt: startedAt, updatedAt: startedAt };
}
const seed = (() => {
  const self = { id: ID.ANA, name: "Ana Beatriz Social Media", role: "Social Media", admin: false, status: "ativo" };
  const users = [self,
    { id: ID.MARINA, name: "Marina Administradora", role: "Administrador", admin: true, status: "ativo" },
    { id: ID.DIEGO, name: "Diego Fernandes Designer", role: "Designer", status: "ativo" }];
  const base = (x) => Object.assign({ by: ID.ANA, socialOwnerId: ID.ANA, createdAt: NOW - 48 * H, dueDate: "2026-08-20", dueTime: "18:00", history: [], checklist: [] }, x);
  const tasks = [
    base({ id: "wfA", sector: "cronograma", status: "afazer", title: "Cronograma Setembro — Aurora", client: "Clínica Aurora Odontologia",
      cronContents: [{ tema: "Tema A" }, { tema: "Tema B" }, { tema: "Tema C" }],
      clientReviewToken: "TOKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      workflowPhase: "themes_preparation", workflowPhaseAt: NOW - 3 * H, workflowResponsibleType: "social", workflowResponsibleUid: ID.ANA,
      externalWait: false, externalWaitSince: 0,
      phaseRuns: { pr01_themes_preparation: run("themes_preparation", "social", ID.ANA, NOW - 3 * H, NOW + 5 * H) } }),
    base({ id: "wfB", sector: "cronograma", status: "andamento", title: "Cronograma Agosto — Visão", client: "Hospital Visão",
      cronContents: [{ tema: "T1" }, { tema: "T2" }],
      clientReviewToken: "TOKBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      cronStatus: "enviado_cliente", clientFlowStatus: "enviado", clientApprovalPhase: "themes",
      designerSla: { planDueAt: NOW - 2 * H, planStartAt: NOW - 30 * H },
      workflowPhase: "themes_waiting_client", workflowPhaseAt: NOW - 30 * H, workflowResponsibleType: "client", workflowResponsibleUid: "",
      externalWait: true, externalWaitSince: NOW - 30 * H,
      approvalRounds: { ar_themes_r1: { type: "themes", createdAt: NOW - 31 * H, sentAt: NOW - 30 * H, status: "sent", requestedBy: ID.ANA, link: "/share/cronograma/TOKB", firstViewedAt: 0, lastViewedAt: 0, viewCount: 0 } },
      phaseRuns: { pr01_themes_preparation: run("themes_preparation", "social", ID.ANA, NOW - 34 * H, NOW - 31 * H, true, "on_time"),
        pr02_themes_waiting_client: run("themes_waiting_client", "client", "", NOW - 30 * H, 0) } }),
    base({ id: "wfC", sector: "cronograma", status: "andamento", title: "Tarefa interna vencida", client: "Studio Vivo",
      assigneeId: ID.ANA, assignee: "Ana Beatriz Social Media",
      designerSla: { planDueAt: NOW - 1 * H, planStartAt: NOW - 10 * H } }),
  ];
  return { self, users, tasks, events: [] };
})();

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();

let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f356a-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f356a-app.asar");
  try { fs.rmSync(asarPath, { force: true }); } catch (_) {}
  await asar.createPackage(stage, asarPath);
  return { stageIndexSha: sha256(path.join(rdir, "index.html")) };
}

const results = [];
function rec(name, ok, info) { results.push({ name, ok: !!ok, info: info || {} }); line({ proof: name, ok: !!ok, info: info || {} }); }

/* ---- LADO MAIN: módulos REAIS do dist (mesmos bytes empacotados pelo electron-builder) ---- */
const DIST = path.join(__dirname, "..", "dist", "main");
const WE = require(path.join(DIST, "workflowEvents.js"));
const WN = require(path.join(DIST, "workflowNotifier.js"));
function memStore() {
  const rec2 = new Set(); let cursor = 0;
  return { deviceId: () => "dev1", cursorGet: () => cursor, cursorSet: (u, at) => { if (at > cursor) cursor = at; },
    receiptHas: (u, id) => rec2.has(id), receiptAdd: (u, id) => rec2.add(id) };
}
function distNotifier(uid, user) {
  const cbs = {}; const delivered = []; const timers = [];
  const h = WN.startWorkflowNotifier(uid, (p) => { delivered.push(p); return { ok: true, channel: "toast" }; }, {
    listen: (name, cb) => { cbs[name] = cb; return () => {}; },
    store: memStore(), now: () => Date.now(), authUser: () => user, onLog: () => {},
    setTimer: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t; }, clearTimer: () => {}, aggWindowMs: 15000,
  });
  return { push: (docs) => cbs.tasks && cbs.tasks({ docChanges: () => docs.map((d) => ({ type: "added", doc: { id: d.id, data: () => d } })) }),
    delivered, timers, stop: () => h.stop() };
}

app.whenReady().then(async () => {
  const WATCHDOG = setTimeout(() => { try { process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=999 FATAL=watchdog_timeout_10min\n"); } catch (_) {} app.exit(1); }, 10 * 60 * 1000);
  try { session.defaultSession.webRequest.onBeforeRequest((d, cb) => { cb({ cancel: /^https?:/i.test(d.url) }); }); } catch (_) {}
  const meta = await packAsar();
  fs.writeFileSync(path.join(os.tmpdir(), "f356a-seed.json"), JSON.stringify(seed));

  const win = new BrowserWindow({ width: 1440, height: 940, show: true, webPreferences: {
    preload: path.join(__dirname, "f356a-proof-preload.js"),
    contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  const wc = win.webContents;
  const J = (code) => wc.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));
  async function shot(nm) { try {
    const img = await Promise.race([win.capturePage(), new Promise((_, rej) => setTimeout(() => rej(new Error("capture_timeout")), 8000))]);
    const p = path.join(OUT, nm + ".png"); fs.writeFileSync(p, img.toPNG()); return path.basename(p);
  } catch (e) { return "pngErr:" + String((e && e.message) || e); } }

  let fatal = null;
  try {
    await win.loadFile(path.join(asarPath, "src", "renderer", "index.html"));
    let boot = null;
    for (let i = 0; i < 60; i++) { await sleep(200);
      boot = await J(`({authed:document.body.classList.contains('authed'),tasks:(typeof state!=='undefined'&&state.tasks||[]).length,users:(typeof state!=='undefined'&&state.users||[]).length})`);
      if (boot && boot.authed && boot.tasks >= 3 && boot.users >= 3) break; }
    if (!(boot && boot.authed && boot.tasks >= 3)) throw new Error("boot-failed: " + JSON.stringify(boot));

    /* P01 — fase persistida desde o nascimento + painel Fluxo da tarefa */
    {
      const r = await J(`(function(){ openClientView('wfA'); render();
        var html=document.body.innerHTML;
        var t=state.tasks.find(function(x){return x.id==='wfA';});
        return { panel: html.indexOf('Fluxo da tarefa')>=0, fase: html.indexOf('Preparação dos temas')>=0,
          due: html.indexOf('Prazo da fase')>=0, resp: html.indexOf('Responsável')>=0,
          phase: t.workflowPhase, btnConfirm: html.indexOf('Confirmar envio ao cliente')>=0 }; })()`);
      const png = await shot("p01-fluxo-fase-inicial");
      rec("P01 ciclo de temas: fase persistida + painel FASE/RESPONSÁVEL/INÍCIO/PRAZO/STATUS", r && r.panel && r.fase && r.due && r.resp && r.phase === "themes_preparation" && r.btnConfirm, { r, png });
    }

    /* P02 — chip Kanban 'Aguardando cliente · Temas · não visualizado · tempo' */
    {
      const r = await J(`(function(){ var t=state.tasks.find(function(x){return x.id==='wfB';});
        var p=deriveOperationalCardPresentation(t,'social');
        return { label:p.statusLabel, next:p.nextAction }; })()`);
      const okChip = r && /^Aguardando cliente · Temas · não visualizado · \d+/.test(String(r.label || ""));
      rec("P02 Kanban honesto: AGUARDANDO CLIENTE + subtipo + visualização + tempo", okChip && /lembrete|Aguardar/.test(String(r.next || "")), { r });
    }

    /* P03 — espera externa NÃO é atraso interno (display + Prioridades) */
    {
      const r = await J(`(function(){ var t=state.tasks.find(function(x){return x.id==='wfB';});
        var d=resolveTaskDisplayState(t, canonicalNowMs(), dtMs);
        var items=priBuildItems([t], state.user.id);
        var lvl=items.length?PriorityEngine.resolvePriorityLevel(items[0]):-1;
        var occ=PriorityEngine.buildOccurrences(items,{});
        var aw=occ.filter(function(o){return o.kind==='awaiting_client';});
        var html=renderPrioridades ? '' : '';
        return { state:d.state, inPanel:d.inPanel, lvl:lvl, NORMAL:PriorityEngine.LEVEL.NORMAL, awn:aw.length,
          awText:aw.length?aw[0].text:'' }; })()`);
      rec("P03 espera externa: waiting_client fora do painel + Prioridades NORMAL + seção própria",
        r && r.state === "waiting_client" && r.inPanel === false && r.lvl === r.NORMAL && r.awn === 1 && /não visualizado/.test(r.awText), { r });
    }

    /* P03b — screenshot do painel Minhas Prioridades com a seção Aguardando cliente */
    {
      const r = await J(`(function(){ closeClientView&&closeClientView(); var c=document.querySelector('.scr'); var host=c?c.parentNode:document.body;
        try{ host.innerHTML=renderPrioridades(); }catch(e){ return {err:String(e&&e.message||e)}; }
        var h=host.innerHTML; return { sec: h.indexOf('Aguardando cliente')>=0, lembrete: h.indexOf('Copiar lembrete')>=0 }; })()`);
      const png = await shot("p03-prioridades-aguardando-cliente");
      rec("P03b Minhas Prioridades: seção AGUARDANDO CLIENTE com Copiar lembrete (sem culpa interna)", r && r.sec && r.lembrete, { r, png });
    }

    /* P04..P06 + P08..P13 — LADO MAIN com os módulos REAIS do dist */
    const tB = JSON.parse(JSON.stringify(seed.tasks[1]));
    {
      const nAna = distNotifier(ID.ANA, { id: ID.ANA, role: "Social Media", admin: false });
      const t1 = JSON.parse(JSON.stringify(tB));
      t1.approvalRounds.ar_themes_r1.firstViewedAt = NOW - 1 * H;
      t1.workflowEvents = { ev_view_ar_themes_r1: { t: "CLIENT_THEMES_FIRST_VIEWED", ph: "themes_waiting_client", rd: "ar_themes_r1", at: NOW - 1 * H, src: "portal", by: "client", v: 1 } };
      nAna.push([t1]);
      const d1 = nAna.delivered.filter((p) => /first_viewed/.test(p.eventType));
      rec("P04 cliente visualizou: INFORMATIVA (info, SEM som) ao responsável — 1 única vez",
        d1.length === 1 && d1[0].severity === "info" && d1[0].sound === false && d1[0].targetUserId === ID.ANA, { got: d1.length, sev: d1[0] && d1[0].severity });

      const t2 = JSON.parse(JSON.stringify(t1));
      t2.workflowPhase = "assignment_pending"; t2.externalWait = false;
      t2.approvalRounds.ar_themes_r1.decision = "approved"; t2.approvalRounds.ar_themes_r1.decisionAt = NOW - 30 * 60000;
      t2.workflowEvents.ev_dec_ar_themes_r1 = { t: "CLIENT_THEMES_APPROVED", ph: "assignment_pending", rd: "ar_themes_r1", at: NOW - 30 * 60000, src: "portal", by: "client", v: 1 };
      nAna.push([t2]);
      const d2 = nAna.delivered.filter((p) => /themes_approved/.test(p.eventType));
      rec("P05 temas aprovados: AÇÃO NECESSÁRIA imediata ao responsável Social",
        d2.length === 1 && d2[0].severity === "success" && d2[0].sound === true && d2[0].targetUserId === ID.ANA && d2[0].title === "Temas aprovados", { title: d2[0] && d2[0].title });
      rec("P06 próxima ação no corpo (o que aconteceu + o que fazer agora)",
        d2.length === 1 && /Próxima ação: atribuir aos Designers\./.test(d2[0].body) && /2 temas aprovados/.test(d2[0].body), { body: d2[0] && d2[0].body });
      nAna.stop();
    }

    /* P07 — gate canônico da atribuição na ESCRITA + fase design_production + itens pendentes */
    {
      const r = await J(`(async function(){
        window.__PATCHES.length=0;
        var t=state.tasks.find(function(x){return x.id==='wfA';});
        await sendToDesigner('wfA','${ID.DIEGO}',{endDate:'2026-08-21',endTime:'15:00'});
        var blocked=(window.__PATCHES.length===0);
        // aprovação de temas chega (Worker) → re-emissão ao vivo → atribuição liberada
        var t2=JSON.parse(JSON.stringify(t)); t2.id='wfA';
        t2.cronStatus='aprovado_cliente'; t2.clientReview={status:'aprovado'};
        t2.workflowPhase='assignment_pending';
        var all=state.tasks.map(function(x){return x.id==='wfA'?t2:x;});
        window.__emitTasks(all); await new Promise(function(r2){setTimeout(r2,300);});
        window.__PATCHES.length=0;
        await sendToDesigner('wfA','${ID.DIEGO}',{endDate:'2026-08-21',endTime:'15:00'});
        var p=window.__PATCHES[0]&&window.__PATCHES[0].patch||{};
        var itemsInit=p.designerItemStatus&&p.designerItemStatus.i0&&p.designerItemStatus.i0.st==='pendente'&&p.designerItemStatus.i2&&p.designerItemStatus.i2.st==='pendente';
        var evk=Object.keys(p).filter(function(k){return k.indexOf('workflowEvents.ev_dassign_')===0;});
        return { blocked:blocked, phase:p.workflowPhase, resp:p.workflowResponsibleUid, itemsInit:!!itemsInit,
          evKey:evk[0]||'', runOpen:Object.keys(p).some(function(k){return /^phaseRuns\\.pr\\d+_design_production$/.test(k);}) }; })()`);
      rec("P07 atribuição: BLOQUEADA sem temas aprovados; liberada grava fase+run+ledger+itens",
        r && r.blocked === true && r.phase === "design_production" && r.resp === ID.DIEGO && r.itemsInit && /ev_dassign_u-des-diego_c\d+/.test(r.evKey) && r.runOpen, { r });
    }

    /* P08 — DESIGNER_ASSIGNED: SÓ o designer indicado recebe (dist real) */
    {
      const tA2 = JSON.parse(JSON.stringify(seed.tasks[0]));
      tA2.workflowPhase = "design_production";
      tA2.workflowEvents = { ev_dassign_diego_c1: { t: "DESIGNER_ASSIGNED", ph: "design_production", at: NOW - 10 * 60000, src: "team", by: ID.ANA, ru: ID.DIEGO, n: 3, tot: 3, v: 1 } };
      const nDiego = distNotifier(ID.DIEGO, { id: ID.DIEGO, role: "Designer", admin: false });
      const nMarina = distNotifier(ID.MARINA, { id: ID.MARINA, role: "Administrador", admin: true });
      nDiego.push([tA2]); nMarina.push([tA2]);
      const gotD = nDiego.delivered.filter((p) => /wf_designer_assigned/.test(p.eventType));
      const gotM = nMarina.delivered.filter((p) => /wf_designer_assigned/.test(p.eventType));
      rec("P08 atribuição notifica SOMENTE o Designer do evento (imediata, com próxima ação)",
        gotD.length === 1 && gotM.length === 0 && /iniciar a produção/.test(gotD[0].body) && gotD[0].severity === "success", { d: gotD.length, m: gotM.length });
      nDiego.stop(); nMarina.stop();
    }

    /* P09 — 4 conclusões em rajada ⇒ 1 notificação agregada */
    {
      const tA3 = JSON.parse(JSON.stringify(seed.tasks[0]));
      tA3.designerAssignment = { designerId: ID.DIEGO, designerName: "Diego Fernandes Designer" };
      tA3.cronContents = new Array(12).fill(0).map((_, i) => ({ tema: "T" + i }));
      tA3.workflowEvents = {};
      for (let i = 0; i < 4; i++) tA3.workflowEvents["ev_ditem_" + i + "_c1"] = { t: "DESIGNER_ITEM_COMPLETED", ph: "design_production", at: NOW - 5 * 60000 + i, src: "team", by: ID.DIEGO, ii: i, n: i + 1, tot: 12, v: 1 };
      const nAna2 = distNotifier(ID.ANA, { id: ID.ANA, role: "Social Media", admin: false });
      nAna2.push([tA3]);
      const before = nAna2.delivered.length;
      const aggT = nAna2.timers.find((t) => t.ms === 15000);
      if (aggT) aggT.fn();
      const aggd = nAna2.delivered.filter((p) => /item_completed/.test(p.eventType));
      rec("P09 rajada agregada: nada antes da janela; depois 1 única ('4 cards concluídos — Diego… 4 de 12')",
        before === 0 && aggd.length === 1 && aggd[0].title === "4 cards concluídos" && /concluiu 4 de 12/.test(aggd[0].body), { before, title: aggd[0] && aggd[0].title });
      nAna2.stop();
    }

    /* P10 — produção concluída CANÔNICA pelos itens (último item → entrega + fase legendas) */
    {
      const r = await J(`(async function(){
        var t=state.tasks.find(function(x){return x.id==='wfA';});
        var t2=JSON.parse(JSON.stringify(t));
        t2.designerAssignment={designerId:'${ID.DIEGO}',designerName:'Diego'};
        t2.designerFlowStatus='andamento';
        t2.workflowPhase='design_production';
        t2.designerItemStatus={i0:{st:'concluido',at:1},i1:{st:'concluido',at:2},i2:{st:'pendente',at:3}};
        // wfC (da ana) está em atraso CRÍTICO — o bloqueio operacional REAL impediria mover
        // OUTRAS tarefas (comportamento aprovado). Nesta cena a wfC é entregue primeiro.
        var tC=JSON.parse(JSON.stringify(state.tasks.find(function(x){return x.id==='wfC';})));
        tC.designerFlowStatus='concluido'; tC.doneAt=Date.now();
        state.designerBoard='${ID.DIEGO}';   // Social acompanhando o quadro do Designer (eixo real)
        var all=state.tasks.map(function(x){return x.id==='wfA'?t2:(x.id==='wfC'?tC:x);});
        window.__emitTasks(all); await new Promise(function(r2){setTimeout(r2,300);});
        window.__PATCHES.length=0;
        await wfToggleItemDone('wfA|2');
        await new Promise(function(r2){setTimeout(r2,200);});
        var ps=window.__PATCHES.map(function(p){return p.patch;});
        var itemP=ps.find(function(p){return p['designerItemStatus.i2']&&p['designerItemStatus.i2'].st==='concluido';});
        var moveP=ps.find(function(p){return p.designerFlowStatus==='concluido'||p.designerFlowStatus==='entregue';});
        var dpc=ps.some(function(p){return Object.keys(p).some(function(k){return k.indexOf('workflowEvents.ev_dpc_c')===0;});});
        var capPrep=ps.some(function(p){return p.workflowPhase==='captions_preparation';});
        var evItem=ps.some(function(p){return Object.keys(p).some(function(k){return /^workflowEvents\\.ev_ditem_2_c\\d+$/.test(k);});});
        state.designerBoard=null;
        // restaura a wfC VENCIDA (a P18 prova que a interna vencida segue alertando)
        var back=state.tasks.map(function(x){ if(x.id!=='wfC') return x;
          var r=JSON.parse(JSON.stringify(x)); delete r.doneAt; r.designerFlowStatus=''; return r; });
        window.__emitTasks(back); await new Promise(function(r3){setTimeout(r3,250);});
        return { itemP:!!itemP, moveP:!!moveP, dpc:dpc, capPrep:capPrep, evItem:evItem }; })()`);
      rec("P10 produção concluída pelos DADOS: último item → entrega canônica + ev_dpc + fase captions_preparation",
        r && r.itemP && r.moveP && r.dpc && r.capPrep && r.evItem, { r });
      const nAna3 = distNotifier(ID.ANA, { id: ID.ANA, role: "Social Media", admin: false });
      const tDone = JSON.parse(JSON.stringify(seed.tasks[0]));
      tDone.workflowEvents = { ev_dpc_c1: { t: "DESIGN_PRODUCTION_COMPLETED", ph: "captions_preparation", at: NOW - 60000, src: "team", by: ID.DIEGO, n: 3, tot: 3, v: 1 } };
      nAna3.push([tDone]);
      const dd = nAna3.delivered.filter((p) => /production_completed/.test(p.eventType));
      rec("P10b notificação de produção concluída: AÇÃO NECESSÁRIA + próxima ação (legendas)",
        dd.length === 1 && dd[0].severity === "success" && /preparar e enviar as legendas/.test(dd[0].body), { body: dd[0] && dd[0].body });
      nAna3.stop();
    }

    /* P11..P13 — legendas: prontas / aprovadas / ajuste (dist real) */
    {
      const mk = (evKey, ev) => { const t = JSON.parse(JSON.stringify(seed.tasks[0])); t.workflowEvents = {}; t.workflowEvents[evKey] = ev; return t; };
      const n1 = distNotifier(ID.ANA, { id: ID.ANA, role: "Social Media", admin: false });
      n1.push([mk("ev_cready_r1", { t: "CAPTIONS_READY", ph: "captions_preparation", at: NOW - 50000, src: "team", by: ID.MARINA, v: 1 })]);
      const p11 = n1.delivered.filter((p) => /captions_ready/.test(p.eventType));
      rec("P11 legendas prontas: próxima ação = enviar para aprovação", p11.length === 1 && /enviar para aprovação/.test(p11[0].body), { body: p11[0] && p11[0].body });
      n1.push([mk("ev_dec_ar_captions_r1", { t: "CLIENT_CAPTIONS_APPROVED", ph: "completed", rd: "ar_captions_r1", at: NOW - 40000, src: "portal", by: "client", v: 1 })]);
      const p12 = n1.delivered.filter((p) => /captions_approved/.test(p.eventType));
      rec("P12 segunda aprovação (CAPTIONS) conduz ao fechamento — rodadas nunca confundidas",
        p12.length === 1 && /fluxo concluído/.test(p12[0].title) && p12[0].severity === "success", { title: p12[0] && p12[0].title });
      n1.push([mk("ev_dec_ar_captions_r2", { t: "CLIENT_CAPTIONS_ADJUSTMENT_REQUESTED", ph: "captions_adjustment", rd: "ar_captions_r2", at: NOW - 30000, src: "whatsapp_group", by: ID.MARINA, v: 1 })]);
      const p13 = n1.delivered.filter((p) => /captions_adjustment/.test(p.eventType));
      rec("P13 ajuste de legendas: PRIORITÁRIA (warning+som) + próxima ação revisar/reenviar",
        p13.length === 1 && p13[0].severity === "warning" && p13[0].sound === true && /revisar as legendas/.test(p13[0].body), { sev: p13[0] && p13[0].severity });
      n1.stop();
    }

    /* P14 — aprovação recebida pelo WhatsApp: registro SERVER-SIDE auditável (renderer real) */
    {
      const r = await J(`(async function(){
        window.confirm=function(){return true;};
        window.__TEAM_POSTS.length=0;
        openClientView('wfB'); render();
        var btn=document.querySelector('[data-wfext="approved"]');
        if(!btn) return { noBtn:true, html:(document.body.innerHTML.indexOf('Registrar APROVAÇÃO')>=0) };
        btn.dispatchEvent(new MouseEvent('click',{bubbles:true}));
        await new Promise(function(r2){setTimeout(r2,400);});
        var post=window.__TEAM_POSTS[0]||null;
        return { posts:window.__TEAM_POSTS.length,
          action:post&&post.body.action, decision:post&&post.body.decision, roundType:post&&post.body.roundType,
          hasAuth:!!(post&&post.headers&&post.headers.Authorization), hasIdem:!!(post&&post.headers&&post.headers['Idempotency-Key']),
          url:(post&&post.url||'').indexOf('/team-action')>=0 }; })()`);
      const png = await shot("p14-registro-whatsapp");
      rec("P14 aprovação via WhatsApp: POST server-side (registerExternalDecision, rodada correta, JWT+Idempotency) — renderer NUNCA grava a decisão",
        r && r.posts === 1 && r.action === "registerExternalDecision" && r.decision === "approved" && r.roundType === "themes" && r.hasAuth && r.hasIdem && r.url, { r, png });
    }

    /* P15 — follow-up é RECOMENDAÇÃO: LONG_WAIT + COPIAR LEMBRETE manual (sem wa.me/envio) */
    {
      const r = await J(`(async function(){
        var t=state.tasks.find(function(x){return x.id==='wfB';});
        var ew=wfExternalInfo(t, wfNow());
        window.__CLIP.length=0;
        wfCopyReminder('wfB');
        var msg=window.__CLIP[0]||'';
        var html=document.body.innerHTML;
        return { followUp:ew.followUp, waitingH:Math.round(ew.waitingMs/3600000),
          copied:!!msg, hasLink:msg.indexOf('/share/cronograma/TOKB')>=0, noWa:msg.indexOf('wa.me')<0,
          uiLong: html.indexOf('Espera longa')>=0 }; })()`);
      rec("P15 follow-up: LONG_WAIT (30h) recomendado + lembrete COPIADO manualmente (nunca wa.me/envio automático)",
        r && r.followUp === "LONG_WAIT" && r.waitingH >= 29 && r.copied && r.hasLink && r.noWa, { r });
    }

    /* P16 — Central do Cliente [RE-PINADO F3.5.6A-H2]: BARRA COMPACTA por padrão (sem lista) +
       DRAWER lateral sob demanda com categorias/tarefa/lembrete/abrir. */
    {
      const r = await J(`(function(){ closeClientView&&closeClientView();
        try{ var _r=document.getElementById('wfapRoot'); if(_r)_r.innerHTML=''; }catch(_){}
        var h=renderClientFlowBoard();
        var c=document.querySelector('.scr'); var host=c?c.parentNode:document.body; host.innerHTML=h;
        // BARRA COMPACTA: título + total + "Ver aprovações"; SEM linhas/cliente; SEM títulos de categoria capitalizados.
        var bar={ has: h.indexOf('Aprovações pendentes')>=0, ver: h.indexOf('Ver aprovações')>=0,
          semCliente: h.indexOf('Hospital Visão')<0, semLembrete: h.indexOf('Lembrete')<0,
          resumo: h.indexOf('não visualizadas')>=0 };
        // DRAWER sob demanda:
        wfApprovalsOpen();
        var root=document.getElementById('wfapRoot'); var d=root?root.innerHTML:'';
        var drawer={ tt: d.indexOf('APROVAÇÕES PENDENTES')>=0, nv: d.indexOf('Não visualizadas')>=0,
          filtros: d.indexOf('data-wfapprovalsfilter="all"')>=0 && d.indexOf('data-wfapprovalsfilter="nv"')>=0,
          rowB: d.indexOf('Hospital Visão')>=0, lembrete: d.indexOf('Lembrete')>=0, abrir: d.indexOf('data-clientview')>=0,
          panel: !!(root&&root.querySelector('.wfap-panel')) };
        return { bar:bar, drawer:drawer }; })()`);
      const png = await shot("p16-central-cliente-barra-compacta-drawer");
      const ok = r && r.bar && r.bar.has && r.bar.ver && r.bar.semCliente && r.bar.semLembrete && r.bar.resumo
        && r.drawer && r.drawer.tt && r.drawer.nv && r.drawer.filtros && r.drawer.rowB && r.drawer.lembrete && r.drawer.abrir && r.drawer.panel;
      rec("P16 Central do Cliente: BARRA COMPACTA por padrão (sem lista) + DRAWER sob demanda (categorias/tarefa/lembrete/abrir/filtros)", ok, { r, png });
      await J(`(function(){ try{ wfApprovalsClose(); }catch(_){} return 1; })()`);
    }

    /* P17 — histórico de SLA por fase (phase runs preservados; espera não fabrica atraso interno) */
    {
      const r = await J(`(function(){ var t=state.tasks.find(function(x){return x.id==='wfB';});
        var runs=t.phaseRuns||{}; var keys=Object.keys(runs).sort();
        var r1=runs['pr01_themes_preparation']||{}; var r2=runs['pr02_themes_waiting_client']||{};
        return { n:keys.length, r1done:r1.status==='done'&&r1.outcome==='on_time', r1resp:r1.responsibleType==='social',
          r2active:r2.status==='active'&&r2.responsibleType==='client', ar:wfActiveRun(t)&&wfActiveRun(t).key }; })()`);
      rec("P17 histórico por fases: run interno fechado NO PRAZO + run externo ativo do CLIENTE (quem/quando preservados)",
        r && r.n === 2 && r.r1done && r.r1resp && r.r2active && r.ar === "pr02_themes_waiting_client", { r });
    }

    /* P18 — SLA interno × externo: gate POR TAREFA (a interna vencida CONTINUA alertando) */
    {
      const r = await J(`(function(){
        var tB=state.tasks.find(function(x){return x.id==='wfB';});
        var tC=state.tasks.find(function(x){return x.id==='wfC';});
        var now=canonicalNowMs();
        var dB=resolveTaskDisplayState(tB, now, dtMs);
        var dC=resolveTaskDisplayState(tC, now, dtMs);
        var iB=priBuildItems([tB], state.user.id)[0];
        var iC=priBuildItems([tC], state.user.id)[0];
        return { b:dB.state, bPanel:dB.inPanel, c:dC.state, cPanel:dC.inPanel, cCrit:dC.critical,
          lB:PriorityEngine.resolvePriorityLevel(iB), lC:PriorityEngine.resolvePriorityLevel(iC),
          CRIT:PriorityEngine.LEVEL.CRITICAL, NORM:PriorityEngine.LEVEL.NORMAL }; })()`);
      rec("P18 tempo da equipe ≠ tempo do cliente: wfB em espera (sem alerta) E wfC interna vencida SEGUE crítica",
        r && r.b === "waiting_client" && r.bPanel === false && r.c === "overdue" && r.cPanel === true && r.lB === r.NORM && r.lC === r.CRIT, { r });
    }

    /* P19 — infraestrutura 1.0.228 intacta no PACOTE (dist congelado + handoff + ingresso) */
    {
      const bg = fs.readFileSync(path.join(DIST, "bgNotify.js"), "utf8");
      const gr = fs.readFileSync(path.join(DIST, "notificationGrouping.js"), "utf8");
      const mainJs = fs.readFileSync(path.join(DIST, "main.js"), "utf8");
      const bgHtml = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "bgnotify.html"), "utf8");
      rec("P19 congelados intactos no pacote: bgNotify/notificationGrouping/bgnotify sem f356a; handoff + ingresso + produtor novo plugado NELE",
        bg.indexOf("f356a") < 0 && gr.indexOf("f356a") < 0 && bgHtml.indexOf("f356a") < 0
        && /handoffTx = new Map/.test(mainJs) && /HANDOFF_ACCEPT_MS = 4600/.test(mainJs)
        && /function deliverNotification\(/.test(mainJs) && /startWorkflowNotifier\)\(uid, deliverNotification/.test(mainJs.replace(/\s+/g, " ")) || /startWorkflowNotifier\(uid, deliverNotification/.test(mainJs),
        { bgLen: bg.length, grLen: gr.length });
    }

    /* P20 — CICLO COMPLETO: temas→cliente→designers→legendas→cliente→concluída (histórico intacto) */
    {
      const r = await J(`(async function(){
        var t=state.tasks.find(function(x){return x.id==='wfA';});
        var fin=JSON.parse(JSON.stringify(t));
        fin.workflowPhase='completed'; fin.externalWait=false;
        fin.cronStatus='aprovado_final'; fin.clientFlowStatus='concluido'; fin.finalApprovalCompleted=true; fin.operationalStatus='concluido';
        fin.designerAssignment={designerId:'${ID.DIEGO}',designerName:'Diego'}; fin.designerFlowStatus='concluido';
        fin.clientReview={status:'aprovado',at:12,byName:'Cliente'};
        fin.cronContents=[{tema:'Tema A',legenda:'L1',feedImageUrl:'x://f1'},{tema:'Tema B',legenda:'L2',feedImageUrl:'x://f2'},{tema:'Tema C',legenda:'L3',feedImageUrl:'x://f3'}];
        fin.approvalRounds={
          ar_themes_r1:{type:'themes',createdAt:1,sentAt:2,firstViewedAt:3,decision:'approved',decisionAt:4,source:'portal',status:'decided'},
          ar_captions_r1:{type:'captions',createdAt:5,sentAt:6,firstViewedAt:7,decision:'adjustment',decisionAt:8,source:'whatsapp_group',recordedBy:'${ID.ANA}',status:'decided'},
          ar_captions_r2:{type:'captions',createdAt:9,sentAt:10,firstViewedAt:11,decision:'approved',decisionAt:12,source:'portal',status:'decided'}};
        fin.phaseRuns={
          pr01_themes_preparation:{phase:'themes_preparation',responsibleType:'social',status:'done',outcome:'on_time',startedAt:1,completedAt:2},
          pr02_themes_waiting_client:{phase:'themes_waiting_client',responsibleType:'client',status:'done',outcome:'approved',startedAt:2,completedAt:4},
          pr03_assignment_pending:{phase:'assignment_pending',responsibleType:'social',status:'done',outcome:'done',startedAt:4,completedAt:5},
          pr04_design_production:{phase:'design_production',responsibleType:'designer',responsibleUid:'${ID.DIEGO}',status:'done',outcome:'on_time',startedAt:5,completedAt:6},
          pr05_captions_preparation:{phase:'captions_preparation',responsibleType:'social',status:'done',outcome:'done',startedAt:6,completedAt:7},
          pr06_captions_waiting_client:{phase:'captions_waiting_client',responsibleType:'client',status:'done',outcome:'approved',startedAt:10,completedAt:12}};
        var all=state.tasks.map(function(x){return x.id==='wfA'?fin:x;});
        window.__emitTasks(all); await new Promise(function(r2){setTimeout(r2,300);});
        var t2=state.tasks.find(function(x){return x.id==='wfA';});
        var rounds=Object.keys(t2.approvalRounds||{}).length;
        var themesKept=t2.approvalRounds.ar_themes_r1.decision==='approved';
        var adjKept=t2.approvalRounds.ar_captions_r1.decision==='adjustment'&&t2.approvalRounds.ar_captions_r1.source==='whatsapp_group';
        var runs=Object.keys(t2.phaseRuns||{}).length;
        var done=isTaskCompleted(t2)&&isFullyComplete(t2);
        var ew=externalWaitOf(t2);
        openClientView('wfA'); render();
        var html=document.body.innerHTML;
        return { phase:t2.workflowPhase, rounds:rounds, themesKept:themesKept, adjKept:adjKept, runs:runs,
          done:done, ew:ew, faseUi: html.indexOf('Concluída')>=0 }; })()`);
      const png = await shot("p20-ciclo-completo-concluido");
      rec("P20 ciclo completo concluído: 3 rodadas preservadas (incl. ajuste via WhatsApp), 6 phase runs, conclusão canônica, espera encerrada",
        r && r.phase === "completed" && r.rounds === 3 && r.themesKept && r.adjKept && r.runs === 6 && r.done === true && r.ew === false, { r, png });
    }

  } catch (e) { fatal = String((e && e.stack) || e).slice(0, 400); }

  clearTimeout(WATCHDOG);
  const failures = results.filter((r) => !r.ok).length + (fatal ? 999 : 0);
  fs.writeFileSync(path.join(OUT, "f356a-proof-results.json"), JSON.stringify({ meta: { stageIndexSha: (typeof meta === "object" && meta.stageIndexSha) || "" }, results, fatal }, null, 2));
  process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=" + failures + (fatal ? " FATAL=" + fatal : "") + "\n");
  app.exit(failures ? 1 : 0);
});
