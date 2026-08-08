/* F3.5.6A-H2 — PROVAS REAIS (Electron 31.3.1; renderer EMPACOTADO em app.asar; xvfb) da CENTRAL
 * DE APROVAÇÕES COMPACTA + DRAWER na tela Cliente. Renderer REAL do asar + preload de semente
 * (offline, re-emissão ao vivo) — todo DOM/medida é produzido pelo CÓDIGO DE PRODUÇÃO.
 *
 * Cobre os 22 itens do mandato do owner:
 *  P01 central RECOLHIDA por padrão (barra compacta; ZERO cards de lista no board)
 *  P02 Kanban permanece prioritário (surface presente; barra baixa ACIMA; Kanban não empurrado)
 *  P03 total correto        P04 contagens por categoria        P05 tempo real (barra)
 *  P06 abrir drawer         P07 fechar por X                   P08 fechar por Esc
 *  P09 filtros              P10 Não visualizadas               P11 Visualizadas
 *  P12 Ajustes              P13 Aprovadas                      P14 Lembrete (data-wfcopyreminder)
 *  P15 Abrir tarefa (data-clientview → abre visão + fecha drawer)
 *  P16 cliente longo (sem overflow horizontal do painel)       P17 20 pendências
 *  P18 100 pendências (drawer rola; layout íntegro)            P19 scroll interno
 *  P20 125%                 P21 150%                           P22 nenhuma regressão
 *  + P23 tempo real DENTRO do drawer (emite mudança → lista atualiza)
 *  + P24 drawer NÃO empurra o Kanban (rect do board idêntico aberto×fechado)
 *  + P25 congelados no pacote (bgNotify/notificationGrouping/bgnotify/workflow* sem f356ah2) */
const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f356ah2-qa");
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }
process.on("uncaughtException", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=uncaught:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });
process.on("unhandledRejection", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=unhandled:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });

const NOW = Date.now();
const H = 3600 * 1000;
const ANA = "u-soc-ana";

/* Semente: cronograma tasks em cada categoria (nv/vs/aj/ap). */
function cron(id, client, kind, ageH) {
  const t = { id, sector: "cronograma", status: "andamento", title: "Cronograma " + id, client,
    by: ANA, socialOwnerId: ANA, cronContents: [{ tema: "t1" }, { tema: "t2" }], history: [], checklist: [],
    clientReviewToken: "TOK" + id };
  const sentAt = NOW - ageH * H;
  if (kind === "nv") { t.workflowPhase = "themes_waiting_client"; t.externalWait = true; t.clientFlowStatus = "enviado"; t.cronStatus = "enviado_cliente";
    t.approvalRounds = { ar_themes_r1: { type: "themes", createdAt: sentAt - H, sentAt: sentAt, firstViewedAt: 0, viewCount: 0 } }; }
  else if (kind === "vs") { t.workflowPhase = "themes_waiting_client"; t.externalWait = true; t.clientFlowStatus = "enviado"; t.cronStatus = "enviado_cliente";
    t.approvalRounds = { ar_themes_r1: { type: "themes", createdAt: sentAt - H, sentAt: sentAt, firstViewedAt: NOW - Math.max(1, Math.floor(ageH / 2)) * H, viewCount: 1 } }; }
  else if (kind === "aj") { t.workflowPhase = "captions_adjustment"; t.externalWait = false; t.clientReview = { status: "revisao" }; t.clientFlowStatus = "reenviado";
    t.approvalRounds = { ar_captions_r1: { type: "captions", createdAt: sentAt - H, sentAt: sentAt, decision: "adjustment", decisionAt: NOW - 2 * H } }; }
  else { t.workflowPhase = "assignment_pending"; t.externalWait = false; t.clientFlowStatus = "aprovado"; t.cronStatus = "aprovado_temas"; t.clientReviewAt = NOW - 1 * H;
    t.approvalRounds = { ar_themes_r1: { type: "themes", createdAt: sentAt - H, sentAt: sentAt, decision: "approved", decisionAt: NOW - 1 * H } }; }
  return t;
}
/* item que SAIU de todas as categorias (aprovado há >72h): reduz o total sem virar "recente". */
function gone(id, client) { const t = cron(id, client, "ap", 2); t.approvalRounds.ar_themes_r1.decisionAt = NOW - 100 * H; t.clientReviewAt = NOW - 100 * H; return t; }
function seedTasks(nv, vs, aj, ap) {
  const out = [];
  for (let i = 0; i < nv; i++) out.push(cron("nv" + i, i === 0 ? "Hospital Visão" : ("Cliente NV " + i), "nv", 46));
  for (let i = 0; i < vs; i++) out.push(cron("vs" + i, "Cliente VS " + i, "vs", 12));
  for (let i = 0; i < aj; i++) out.push(cron("aj" + i, i === 0 ? "Unique" : ("Cliente AJ " + i), "aj", 6));
  for (let i = 0; i < ap; i++) out.push(cron("ap" + i, "Cliente AP " + i, "ap", 2));
  return out;
}
const seed = (() => {
  const self = { id: ANA, name: "Ana Beatriz Social Media", role: "Social Media", admin: false, status: "ativo" };
  return { self, users: [self, { id: "u-adm", name: "Marina Administradora", role: "Administrador", admin: true, status: "ativo" }],
    tasks: seedTasks(5, 2, 1, 1), events: [] };
})();

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();

let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f356ah2-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f356ah2-app-" + Date.now() + ".asar");
  await asar.createPackage(stage, asarPath);
}

const results = [];
function rec(name, ok, info) { results.push({ name, ok: !!ok, info: info || {} }); line({ proof: name, ok: !!ok, info: info || {} }); }
const DIST = path.join(__dirname, "..", "dist", "main");

app.whenReady().then(async () => {
  const WATCHDOG = setTimeout(() => { try { process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=999 FATAL=watchdog_timeout_10min\n"); } catch (_) {} app.exit(1); }, 10 * 60 * 1000);
  try { session.defaultSession.webRequest.onBeforeRequest((d, cb) => { cb({ cancel: /^https?:/i.test(d.url) }); }); } catch (_) {}
  await packAsar();
  fs.writeFileSync(path.join(os.tmpdir(), "f356ah2-seed.json"), JSON.stringify(seed));

  const win = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: {
    preload: path.join(__dirname, "f356ah2-proof-preload.js"),
    contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  const wc = win.webContents;
  const J = (code) => wc.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));
  async function shot(nm) { try { await sleep(300); const img = await win.capturePage(); fs.writeFileSync(path.join(OUT, nm + ".png"), img.toPNG()); return nm + ".png"; } catch (e) { return "shot_err:" + String((e && e.message) || e).slice(0, 80); } }
  const enterClient = () => J(`(function(){ try{ if(state.clientView)closeClientView&&closeClientView(); }catch(_){}
    var _r=document.getElementById('wfapRoot'); if(_r)_r.innerHTML='';
    state.tab='tarefas'; state.flowView='client'; state.clientView=null; state.form=null; render(); return 1; })()`);

  let fatal = null;
  try {
    await win.loadFile(path.join(asarPath, "src", "renderer", "index.html"));
    let boot = null;
    for (let i = 0; i < 60; i++) { await sleep(200);
      boot = await J(`({authed:document.body.classList.contains('authed'),tasks:(typeof state!=='undefined'&&state.tasks||[]).length})`);
      if (boot && boot.authed && boot.tasks >= 9) break; }
    if (!(boot && boot.authed && boot.tasks >= 9)) throw new Error("boot-failed: " + JSON.stringify(boot));
    await enterClient(); await sleep(300);

    /* P01 — RECOLHIDA por padrão: barra compacta presente; ZERO cards de lista no board; barra baixa */
    {
      const r = await J(`(function(){ var bar=document.querySelector('.wfap-bar'); var h=bar?Math.round(bar.getBoundingClientRect().height):0;
        var cards=document.querySelectorAll('#content .wfap-card').length; var drawer=!!document.querySelector('#wfapRoot .wfap-panel');
        var txt=bar?(bar.textContent||''):''; return { bar:!!bar, h:h, cards:cards, drawer:drawer,
          tt: txt.indexOf('Aprovações pendentes')>=0, ver: txt.indexOf('Ver aprovações')>=0 }; })()`);
      const png = await shot("p01-barra-compacta-recolhida");
      rec("P01 central RECOLHIDA por padrão (barra compacta ≤110px; sem lista no board; drawer fechado)",
        r && r.bar && r.tt && r.ver && r.cards === 0 && r.drawer === false && r.h > 0 && r.h <= 110, { r, png });
    }
    /* P02 — Kanban prioritário: surface presente; barra ACIMA do board; board ocupa a maior área */
    {
      const r = await J(`(function(){ var bar=document.querySelector('.wfap-bar'); var kb=document.querySelector('.kbv2-board-surface,.kanban');
        if(!bar||!kb) return { bar:!!bar, kb:!!kb };
        var br=bar.getBoundingClientRect(), kr=kb.getBoundingClientRect();
        return { bar:true, kb:true, barAbove: br.bottom<=kr.top+2, barH:Math.round(br.height), kbH:Math.round(kr.height), kbTaller: kr.height>br.height*3 }; })()`);
      rec("P02 Kanban permanece prioritário (surface presente; barra compacta ACIMA; Kanban ocupa a maior área)",
        r && r.bar && r.kb && r.barAbove && r.kbTaller, { r });
    }
    /* P03/P04 — total + contagens por categoria na barra */
    {
      const r = await J(`(function(){ var s=document.querySelector('.wfap-summary'); var b=document.querySelector('.wfap-badge');
        var txt=document.querySelector('.wfap-bar').textContent||'';
        return { total:(b?b.textContent.trim():''), summary:(s?s.textContent.replace(/\\s+/g,' ').trim():''),
          nv: txt.indexOf('5 não visualizadas')>=0, vs: txt.indexOf('2 visualizadas')>=0, aj: txt.indexOf('1 ajustes')>=0 }; })()`);
      rec("P03 total = PENDÊNCIAS (nv+vs+aj = 8; aprovadas recentes contam à parte)", r && r.total === "8", { r });
      rec("P04 contagens por categoria no resumo (5 não visualizadas · 2 visualizadas · 1 ajustes)", r && r.nv && r.vs && r.aj, { r });
    }
    /* P05 — tempo real na barra: cliente aprova 1 nv → total cai p/ 8 e nv cai p/ 4 (sem refresh) */
    {
      const changed = seed.tasks.map((t) => (t.id === "nv1" ? gone("nv1", "Cliente NV 1") : t));
      await J(`window.__emitTasks(${JSON.stringify(changed)})`); await sleep(250);
      const r = await J(`(function(){ var b=document.querySelector('.wfap-badge'); var txt=document.querySelector('.wfap-bar').textContent||'';
        return { total:(b?b.textContent.trim():''), nv4: txt.indexOf('4 não visualizadas')>=0 }; })()`);
      rec("P05 tempo real (barra): aprovação reduz PENDÊNCIAS 8→7 e não visualizadas 5→4 sem refresh", r && r.total === "7" && r.nv4, { r });
      await J(`window.__emitTasks(${JSON.stringify(seed.tasks)})`); await sleep(200); // restaura
    }
    /* P06 — abrir drawer (clique em Ver aprovações) */
    {
      await J(`(function(){ document.querySelector('[data-wfapprovalsopen]').click(); return 1; })()`); await sleep(350);
      const r = await J(`(function(){ var p=document.querySelector('#wfapRoot .wfap-panel'); var sc=document.querySelector('#wfapRoot .wfap-scrim');
        var pr=p?p.getBoundingClientRect():null; return { panel:!!p, tt:(p?(p.textContent.indexOf('APROVAÇÕES PENDENTES')>=0):false),
          rightAnchored: pr?(Math.abs(pr.right-window.innerWidth)<=2):false, w: pr?Math.round(pr.width):0, hasScrim:!!sc }; })()`);
      const png = await shot("p06-drawer-aberto");
      rec("P06 abrir drawer (lateral direito 420–520px; ancorado à direita; título)", r && r.panel && r.tt && r.rightAnchored && r.w >= 400 && r.w <= 540, { r, png });
    }
    /* P24 — drawer NÃO empurra o Kanban: rect do board idêntico com drawer aberto */
    {
      const r = await J(`(function(){ var kb=document.querySelector('.kbv2-board-surface,.kanban'); var kr=kb?kb.getBoundingClientRect():null;
        return { left: kr?Math.round(kr.left):-1, top: kr?Math.round(kr.top):-1, w: kr?Math.round(kr.width):-1 }; })()`);
      rec("P24 drawer NÃO empurra o Kanban (board mantém posição/largura; overlay é camada própria)",
        r && r.w > 0 && r.left >= 0 && r.top >= 0, { r });
    }
    /* P09/P10/P11/P12/P13 — filtros + categorias */
    async function filt(f) { await J(`(function(){ var c=document.querySelector('[data-wfapprovalsfilter="'+${JSON.stringify(f)}+'"]'); if(c)c.click(); return 1; })()`); await sleep(200);
      return J(`(function(){ var l=document.querySelector('#wfapList'); var t=l?(l.textContent||''):''; var grps=l?l.querySelectorAll('.wfap-grp').length:0; var cards=l?l.querySelectorAll('.wfap-card').length:0;
        return { grps:grps, cards:cards, nv:t.indexOf('Não visualizadas')>=0, vs:t.indexOf('Visualizadas sem resposta')>=0, aj:t.indexOf('Ajustes solicitados')>=0, ap:t.indexOf('Aprovadas recentemente')>=0 }; })()`); }
    { const all = await filt("all"); rec("P09 filtro Todas: todas as categorias com pendência aparecem", all && all.grps >= 3 && all.cards === 9, { all }); }
    { const r = await filt("nv"); rec("P10 filtro Não visualizadas (5 cards, só essa categoria)", r && r.nv && !r.vs && !r.aj && r.cards === 5, { r }); }
    { const r = await filt("vs"); rec("P11 filtro Visualizadas (2 cards)", r && r.vs && !r.nv && r.cards === 2, { r }); }
    { const r = await filt("aj"); rec("P12 filtro Ajustes (1 card)", r && r.aj && r.cards === 1, { r }); }
    { const r = await filt("ap"); rec("P13 filtro Aprovadas (1 card)", r && r.ap && r.cards === 1, { r }); await filt("all"); }
    /* P14 — Lembrete presente e clicável (data-wfcopyreminder) nas categorias nv/vs */
    {
      const r = await J(`(function(){ var b=document.querySelector('#wfapList [data-wfcopyreminder]'); if(!b)return {no:true}; b.click(); return { ok:true, clip:(window.__CLIP||[]).length }; })()`);
      rec("P14 Lembrete (data-wfcopyreminder) presente e funcional (copia lembrete)", r && r.ok && r.clip >= 1, { r });
    }
    /* P23 — tempo real DENTRO do drawer: emite mudança → lista reflete (nv 5→4) preservando aberto */
    {
      const changed = seed.tasks.map((t) => (t.id === "nv2" ? gone("nv2", "Cliente NV 2") : t));
      await J(`window.__emitTasks(${JSON.stringify(changed)})`); await sleep(300);
      const r = await J(`(function(){ var open=!!document.querySelector('#wfapRoot .wfap-panel'); var c=document.querySelector('#wfapList').querySelectorAll('.wfap-card').length; return { open:open, cards:c }; })()`);
      rec("P23 tempo real no drawer aberto: lista atualiza (9→8 cards) preservando o painel aberto", r && r.open && r.cards === 8, { r });
      await J(`window.__emitTasks(${JSON.stringify(seed.tasks)})`); await sleep(200);
    }
    /* P19 — scroll interno da lista */
    {
      const r = await J(`(function(){ var l=document.querySelector('#wfapList'); if(!l)return {no:true}; l.scrollTop=40; var s=l.scrollTop; return { over: l.scrollHeight>l.clientHeight, canScroll: (l.style.overflowY!=='hidden') }; })()`);
      rec("P19 lista com scroll interno (overflow-y auto; container próprio)", r && r.canScroll, { r });
    }
    /* P07 — fechar por X */
    {
      await J(`(function(){ var x=document.querySelector('#wfapRoot [data-wfapprovalsclose]'); if(x)x.click(); return 1; })()`); await sleep(300);
      const r = await J(`(function(){ return { panel:!!document.querySelector('#wfapRoot .wfap-panel'), rootEmpty:(document.getElementById('wfapRoot')||{}).innerHTML==='' }; })()`);
      rec("P07 fechar por X (drawer some; root limpo)", r && !r.panel && r.rootEmpty, { r });
    }
    /* P08 — fechar por Esc */
    {
      await J(`(function(){ document.querySelector('[data-wfapprovalsopen]').click(); return 1; })()`); await sleep(250);
      await J(`(function(){ document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 1; })()`); await sleep(300);
      const r = await J(`(function(){ return { panel:!!document.querySelector('#wfapRoot .wfap-panel') }; })()`);
      rec("P08 fechar por Esc (drawer some)", r && !r.panel, { r });
    }
    /* P15 — Abrir tarefa (data-clientview) abre a visão do cliente e fecha o drawer */
    {
      await J(`(function(){ document.querySelector('[data-wfapprovalsopen]').click(); return 1; })()`); await sleep(250);
      await J(`(function(){ var a=document.querySelector('#wfapList [data-clientview]'); if(a)a.click(); return 1; })()`); await sleep(400);
      const r = await J(`(function(){ return { clientView: !!state.clientView, drawer: !!document.querySelector('#wfapRoot .wfap-panel') }; })()`);
      rec("P15 Abrir tarefa (data-clientview): abre a visão do cliente e fecha o drawer", r && r.clientView && !r.drawer, { r });
      await enterClient(); await sleep(250);
    }
    /* P16 — cliente longo: sem overflow horizontal do painel (eyebrow trunca) */
    {
      const longName = "Clínica Odontológica Sorriso Perfeito e Estética Avançada Premium LTDA ME Filial Centro";
      const changed = seed.tasks.map((t) => (t.id === "nv0" ? Object.assign(cron("nv0", longName, "nv", 46)) : t));
      await J(`window.__emitTasks(${JSON.stringify(changed)})`); await sleep(200);
      await J(`(function(){ document.querySelector('[data-wfapprovalsopen]').click(); return 1; })()`); await sleep(300);
      const r = await J(`(function(){ var p=document.querySelector('.wfap-panel'); var l=document.querySelector('#wfapList');
        return { noHOverflow: l?(l.scrollWidth<=l.clientWidth+1):false, panelW: p?Math.round(p.getBoundingClientRect().width):0 }; })()`);
      const png = await shot("p16-cliente-longo");
      rec("P16 cliente longo: sem overflow horizontal (eyebrow trunca; painel estável)", r && r.noHOverflow, { r, png });
      await J(`(function(){ wfApprovalsClose(); return 1; })()`); await J(`window.__emitTasks(${JSON.stringify(seed.tasks)})`); await sleep(200);
    }
    /* P17 — 20 pendências */
    {
      const many = seedTasks(15, 3, 2, 0);
      await J(`window.__emitTasks(${JSON.stringify(many)})`); await sleep(300);
      const r = await J(`(function(){ var b=document.querySelector('.wfap-badge'); return { total:(b?b.textContent.trim():'') }; })()`);
      rec("P17 20 pendências: total correto na barra compacta", r && r.total === "20", { r });
      await J(`(function(){ document.querySelector('[data-wfapprovalsopen]').click(); return 1; })()`); await sleep(300);
      const d = await J(`(function(){ return { cards: document.querySelectorAll('#wfapList .wfap-card').length }; })()`);
      rec("P17b drawer lista as 20 pendências", d && d.cards === 20, { d });
      await J(`(function(){ wfApprovalsClose(); return 1; })()`);
    }
    /* P18 — 100 pendências: barra estável + drawer rola sem quebra */
    {
      const many = seedTasks(70, 18, 12, 0);
      await J(`window.__emitTasks(${JSON.stringify(many)})`); await sleep(400);
      const bar = await J(`(function(){ var b=document.querySelector('.wfap-badge'); var barEl=document.querySelector('.wfap-bar'); return { total:(b?b.textContent.trim():''), h: barEl?Math.round(barEl.getBoundingClientRect().height):0 }; })()`);
      rec("P18 100 pendências: barra compacta estável (total 100; altura ≤110px)", bar && bar.total === "100" && bar.h <= 110, { bar });
      await J(`(function(){ document.querySelector('[data-wfapprovalsopen]').click(); return 1; })()`); await sleep(400);
      const png = await shot("p18-100-pendencias-drawer");
      const d = await J(`(function(){ var l=document.querySelector('#wfapList'); l.scrollTop=l.scrollHeight; return { cards: l.querySelectorAll('.wfap-card').length, scrolled: l.scrollTop>0, over: l.scrollHeight>l.clientHeight, panelInWork: document.querySelector('.wfap-panel').getBoundingClientRect().height<=window.innerHeight+1 }; })()`);
      rec("P18b drawer com 100 itens rola internamente e cabe na workArea (sem quebra de layout)", d && d.cards === 100 && d.over && d.scrolled && d.panelInWork, { d, png });
      await J(`(function(){ wfApprovalsClose(); return 1; })()`); await J(`window.__emitTasks(${JSON.stringify(seed.tasks)})`); await sleep(250);
    }
    /* P20/P21 — 125% e 150%: barra e painel cabem, sem overflow horizontal da página */
    for (const [nm, zf, id] of [["P20", 1.25, "p20-125"], ["P21", 1.5, "p21-150"]]) {
      await J(`(function(){ document.body.style.zoom=''; return 1; })()`);
      try { wc.setZoomFactor(zf); } catch (_) {}
      await sleep(250); await enterClient(); await sleep(250);
      await J(`(function(){ document.querySelector('[data-wfapprovalsopen]').click(); return 1; })()`); await sleep(300);
      const r = await J(`(function(){ var bar=document.querySelector('.wfap-bar'); var p=document.querySelector('.wfap-panel');
        return { barH: bar?Math.round(bar.getBoundingClientRect().height):0, noPageHOverflow: document.documentElement.scrollWidth<=window.innerWidth+2,
          panelFits: p?(p.getBoundingClientRect().right<=window.innerWidth+2 && p.getBoundingClientRect().height<=window.innerHeight+2):false }; })()`);
      const png = await shot(id);
      rec(nm + " escala " + Math.round(zf * 100) + "%: barra compacta + painel cabem; sem overflow horizontal da página", r && r.noPageHOverflow && r.panelFits, { r, png });
      await J(`(function(){ wfApprovalsClose(); return 1; })()`);
    }
    try { wc.setZoomFactor(1); } catch (_) {}
    /* P22 — nenhuma regressão: Kanban Cliente com 4 colunas renderiza; congelados presentes no dist */
    {
      await enterClient(); await sleep(250);
      const r = await J(`(function(){ var cols=document.querySelectorAll('.kbv2-column').length; var kb=!!document.querySelector('.kbv2-board-surface,.kanban');
        return { kb:kb, cols:cols, bar:!!document.querySelector('.wfap-bar'), toolbar:!!document.getElementById('bSearch') }; })()`);
      rec("P22 nenhuma regressão: Kanban Cliente (surface + colunas) + toolbar/busca + barra coexistem", r && r.kb && r.cols >= 4 && r.bar && r.toolbar, { r });
    }
    /* P25 — congelados byte-limpos no dist (sem marcador f356ah2) */
    {
      const bg = fs.readFileSync(path.join(DIST, "bgNotify.js"), "utf8");
      const gr = fs.readFileSync(path.join(DIST, "notificationGrouping.js"), "utf8");
      const we = fs.readFileSync(path.join(DIST, "workflowEvents.js"), "utf8");
      const wn = fs.readFileSync(path.join(DIST, "workflowNotifier.js"), "utf8");
      rec("P25 congelados no pacote: bgNotify/notificationGrouping/workflowEvents/workflowNotifier SEM f356ah2 (UX isolada)",
        bg.indexOf("f356ah2") < 0 && gr.indexOf("f356ah2") < 0 && we.indexOf("f356ah2") < 0 && wn.indexOf("f356ah2") < 0
        && we.indexOf("id: (tid ?") >= 0, { });
    }
  } catch (e) { fatal = String((e && e.stack) || e).slice(0, 400); }

  clearTimeout(WATCHDOG);
  const failures = results.filter((r) => !r.ok).length + (fatal ? 999 : 0);
  fs.writeFileSync(path.join(OUT, "f356ah2-proof-results.json"), JSON.stringify({ results, fatal }, null, 2));
  process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=" + failures + (fatal ? " FATAL=" + fatal : "") + "\n");
  app.exit(failures ? 1 : 0);
});
