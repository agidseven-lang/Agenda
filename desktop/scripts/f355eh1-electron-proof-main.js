/* F3.5.5E-H1 — PROVAS REAIS do REDESIGN ULTRA PREMIUM (Electron 31.3.1; renderer REAL
 * empacotado em app.asar; xvfb). Mesma infraestrutura aprovada dos harnesses F3.5.5D/F3.5.5E:
 * empacota o renderer de produção em app.asar, carrega DO ASAR com o preload de semente
 * (f355d-proof-preload.js) e exercita o CÓDIGO DE PRODUÇÃO (notifShowToast + notifNormalize +
 * enriquecimento do doc). Sem IA, sem mockup, sem HTML isolado, sem captura manipulada, sem
 * dados inventados; cliente NUNCA vem do título; screenshots aguardam o fim da animação de
 * entrada (180ms) antes de capturar.
 *
 * As 17 provas do mandato:
 *  E01 movimentada            E02 concluída            E03 reaberta
 *  E04 cancelada              E05 aprovação            E06 cliente curto (ULTRA)
 *  E07 cliente longo          E08 autor longo          E09 sem avatar (iniciais)
 *  E10 responsável ≠ autor    E11 legado mensal        E12 personalizado 7 temas
 *  E13 três empilhadas        E14 escala 125%          E15 escala 150%
 *  E16 1366×768               E17 1920×1080
 * + E00 métricas ANTES(1.0.224 medida)×DEPOIS(agora) do card movimentada. */
const { app, BrowserWindow, session, ipcMain, clipboard } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f355eh1-qa");
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }
const ofs = require("original-fs");
const sha256 = (p) => crypto.createHash("sha256").update(ofs.readFileSync(p)).digest("hex");
process.on("uncaughtException", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=uncaught:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });
process.on("unhandledRejection", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=unhandled:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });

/* medição física do ANTES (1.0.224 real, capturada no Electron empacotado antes do redesign) */
const ANTES = { movimentada: { cardW: 480, cardH: 242, avatar: 36, chipH: 24, ctaH: 27, ctaW: 93, closeW: 22 },
  concluidaSemChips: { cardW: 480, cardH: 209 }, tresEmpilhadas: { stackH: 747 } };

/* ---- SEMENTE (mesmo padrão f355e + tarefa com cliente curto ULTRA) ---- */
const NOW = Date.now();
const ID = { ANA: "u-soc-ana", MARINA: "u-adm-marina", DIEGO: "u-des-diego", FELIPE: "u-des-felipe" };
const LONGO = "Miercohévisk Niheb Ferreira Nascimento Carlôto";
const mkC = (n) => new Array(n).fill(0).map((_, i) => ({ tema: "Tema " + (i + 1), legenda: "Legenda " + (i + 1) }));
const seed = (() => {
  const self = { id: ID.ANA, name: "Ana Beatriz Social Media", role: "Social Media", admin: false, status: "ativo" };
  const users = [self,
    { id: ID.MARINA, name: "Marina Administradora", role: "Administrador", admin: true, status: "ativo" },
    { id: ID.DIEGO, name: LONGO, role: "Designer", status: "ativo" },
    { id: ID.FELIPE, name: "Felipe Teodozio", role: "Designer", status: "ativo" }];
  const tk = (x) => Object.assign({ by: ID.ANA, createdAt: NOW, history: [], checklist: [] }, x);
  const tasks = [
    tk({ id: "cronMen", sector: "cronograma", status: "andamento", title: "TEMAS", client: "Hospital Visão", subtype: "mensal", cronContents: mkC(12) }),
    tk({ id: "cronCustom", sector: "cronograma", status: "andamento", title: "TEMAS", client: "Hospital Visão", cronQty: 7, cronContents: mkC(7) }),
    tk({ id: "vidUltra", sector: "edicao_midia", status: "andamento", title: "Reels institucional", client: "ULTRA" }),
    tk({ id: "vidLongo", sector: "edicao_midia", status: "andamento", title: "Vídeo de resultados", client: "Clínica Oftalmológica Visão Integrada de Alta Complexidade do Norte e Nordeste LTDA" }),
    tk({ id: "card1", sector: "edicao_cards", status: "afazer", title: "Card avulso de aniversário" }),
  ];
  return { self, users, tasks, events: [] };
})();

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();

let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f355eh1-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f355eh1-app-" + Date.now() + ".asar");
  try { fs.rmSync(asarPath, { force: true }); } catch (_) {}
  await asar.createPackage(stage, asarPath);
  return { stageIndexSha: sha256(path.join(rdir, "index.html")) };
}

const results = [];
function rec(name, ok, info) { results.push({ name, ok: !!ok, info: info || {} }); line({ proof: name, ok: !!ok, info: info || {} }); }

app.whenReady().then(async () => {
  const WATCHDOG = setTimeout(() => { try { process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=999 FATAL=watchdog_timeout_9min\n"); } catch (_) {} app.exit(1); }, 9 * 60 * 1000);
  try { session.defaultSession.webRequest.onBeforeRequest((d, cb) => { cb({ cancel: /^https?:/i.test(d.url) }); }); } catch (_) {}
  const meta = await packAsar();
  fs.writeFileSync(path.join(os.tmpdir(), "f355d-seed.json"), JSON.stringify(seed));
  ipcMain.handle("clipboard-read-text", () => { try { return String(clipboard.readText() || ""); } catch { return ""; } });
  ipcMain.handle("clipboard-read-html", () => { try { return String(clipboard.readHTML() || ""); } catch { return ""; } });

  const win = new BrowserWindow({ width: 1600, height: 900, show: true, webPreferences: {
    preload: path.join(__dirname, "f355d-proof-preload.js"),
    contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  const wc = win.webContents;
  wc.on("console-message", (_e, lvl, msg) => { if (lvl >= 2) line({ console: String(msg).slice(0, 260) }); });
  wc.on("render-process-gone", (_e, d) => { line({ rendererGone: (d && d.reason) || "?" }); });
  const J = (code) => wc.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));
  async function shot(nm) { try { await sleep(420); const img = await wc.capturePage(); fs.writeFileSync(path.join(OUT, nm + ".png"), img.toPNG()); return nm + ".png"; } catch (e) { return "shot_err:" + String((e && e.message) || e).slice(0, 80); } }

  await win.loadURL("file://" + asarPath.replace(/\\/g, "/") + "/src/renderer/index.html");
  let boot = null;
  for (let i = 0; i < 30; i++) {
    boot = await J(`(function(){ var st=(typeof state!=='undefined')?state:null; return { user: !!(st&&st.user), tasks: ((st&&st.tasks)||[]).length }; })()`);
    if (boot && boot.user && boot.tasks === 5) break;
    await sleep(500);
  }
  rec("BOOT app real do asar (semente aplicada)", !!(boot && boot.user && boot.tasks === 5), Object.assign({ indexSha: meta.stageIndexSha.slice(0, 12) }, boot));

  const T20 = new Date(); T20.setHours(20, 30, 0, 0);
  const basePay = (o) => Object.assign({ _premiumCommon: true, severity: "info", sound: false, createdAt: T20.getTime(),
    actorId: ID.DIEGO, actorName: "", responsibleId: "", responsibleName: "" }, o);
  /* mostra 1 toast e devolve DOM+geometria (limpa a fila antes — fila/caps de produção intactos) */
  const show = async (o) => J(`(function(){ try{ var st=document.getElementById('notif-stack'); if(st) st.innerHTML=''; }catch(_){}
    notifShowToast(${JSON.stringify(basePay(o))});
    var c=document.querySelector('#notif-stack .ntf-card.ntfp'); if(!c) return { none:true };
    var r=c.getBoundingClientRect();
    var av=c.querySelector('.ntfp-by .ntfp-av'); var ar=av?av.getBoundingClientRect():{};
    var chip=c.querySelector('.ntfp-chip'); var cr=chip?chip.getBoundingClientRect():{};
    var cta=c.querySelector('.ntfp-cta'); var tr=cta?cta.getBoundingClientRect():{};
    var x=c.querySelector('.ntf-x'); var xr=x?x.getBoundingClientRect():{};
    var byt=c.querySelector('.ntfp-byt'); var bytEll=byt?(byt.scrollWidth>byt.clientWidth+1):false;
    return { html: c.innerHTML.slice(0, 4200), cardW: Math.round(r.width), cardH: Math.round(r.height),
      avatar: Math.round(ar.width||0), chipH: Math.round(cr.height||0), ctaH: Math.round(tr.height||0), ctaW: Math.round(tr.width||0),
      closeW: Math.round(xr.width||0), closeH: Math.round(xr.height||0), bytEll: bytEll, bytTitle: byt?String(byt.getAttribute('title')||''):'',
      overflow: (c.scrollWidth>c.clientWidth+1) || (document.documentElement.scrollWidth>window.innerWidth+1) }; })()`);

  /* E01 + E00 — movimentada (payload da captura do owner) + métricas ANTES×DEPOIS */
  const e1 = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronMen", taskTitle: "TEMAS",
    fromStatus: "andamento", toStatus: "revisao", actorName: LONGO, responsibleName: LONGO });
  rec("E01 movimentada: violeta + swap + chips Em andamento→Revisão + hora 20:30",
    e1 && !e1.none && /cat-violet/.test(e1.html) && /M7 7h11l-3-3/.test(e1.html) && /cs-andamento/.test(e1.html) && /cs-revisao/.test(e1.html) && /20:30/.test(e1.html) && !e1.overflow, { w: e1 && e1.cardW, h: e1 && e1.cardH });
  await shot("e01-movimentada");
  const mOk = e1 && e1.cardW === 440 && e1.cardH <= 215 && e1.cardH >= 150 && e1.avatar === 28 && e1.chipH === 26 && e1.ctaH === 30 && e1.closeW === 32 && e1.closeH === 32;
  rec("E00 métricas DEPOIS dentro dos alvos (440px; altura ≤215; avatar 28; chip 26; CTA 30; fechar 32×32) vs ANTES medido (480×242; 36; 24; 27; 22)",
    mOk, { antes: ANTES.movimentada, depois: e1 && { cardW: e1.cardW, cardH: e1.cardH, avatar: e1.avatar, chipH: e1.chipH, ctaH: e1.ctaH, ctaW: e1.ctaW, closeW: e1.closeW, closeH: e1.closeH } });

  /* E02 — concluída (sem chips ⇒ card ainda menor que o ANTES 209) */
  const e2 = await show({ eventType: "task_completed", title: "Tarefa concluída", taskId: "cronMen", taskTitle: "TEMAS", actorName: LONGO, severity: "success" });
  rec("E02 concluída: verde + check + 'Concluída por' + altura < ANTES sem chips (209px)",
    e2 && /cat-green/.test(e2.html) && /M4 12\.5l5 5 11-11/.test(e2.html) && /Concluída por/.test(e2.html) && e2.cardH < ANTES.concluidaSemChips.cardH && !e2.overflow, { h: e2 && e2.cardH, antes: ANTES.concluidaSemChips.cardH });
  await shot("e02-concluida");

  /* E03 — reaberta */
  const e3 = await show({ eventType: "task_reopened", title: "Tarefa reaberta", taskId: "cronMen", taskTitle: "TEMAS",
    fromStatus: "concluido", toStatus: "andamento", actorName: LONGO, severity: "warning" });
  rec("E03 reaberta: âmbar + revise + chips Concluído→Em andamento",
    e3 && /cat-amber/.test(e3.html) && /M3\.5 7\.5h12/.test(e3.html) && /cs-concluido/.test(e3.html) && /cs-andamento/.test(e3.html) && !e3.overflow, {});
  await shot("e03-reaberta");

  /* E04/E05 — variantes cancelada e aprovação NO COMPONENTE dos bytes empacotados.
   * HONESTIDADE: a elegibilidade do pipeline premium é CONGELADA da 1.0.224
   * (PREMIUM_TYPES = moved/assigned/reassigned/updated/completed/reopened/designer_assigned);
   * task_canceled e flow_* seguem no toast comum POR REGRA FUNCIONAL preservada. A variante
   * visual existe no builder COMPARTILHADO (paridade) — aqui renderizamos premiumCommonInner
   * REAL (função dos bytes do asar) na moldura REAL do stack para prova visual/medida. */
  const showVariant = async (pay, nm) => J(`(function(){ var st=document.getElementById('notif-stack'); if(st) st.innerHTML='';
    var el=document.createElement('div'); el.className='ntf ntfp-w in';
    var card=document.createElement('div'); card.className='ntf-card ntfp';
    card.innerHTML=premiumCommonInner(${JSON.stringify(pay)}); el.appendChild(card); st.appendChild(el);
    var r=card.getBoundingClientRect();
    return { html: card.innerHTML.slice(0, 4200), cardW: Math.round(r.width), cardH: Math.round(r.height),
      overflow: (card.scrollWidth>card.clientWidth+1) || (document.documentElement.scrollWidth>window.innerWidth+1) }; })()`);
  const e4 = await showVariant(basePay({ eventType: "task_canceled", title: "Tarefa cancelada", taskTitle: "TEMAS",
    clientName: "Hospital Visão", cronContext: "Cronograma mensal • 12 temas", actorName: LONGO, severity: "error" }), "e04");
  rec("E04 variante cancelada no COMPONENTE empacotado: vermelha + ban (x-circle do set) + autor no footer (elegibilidade PREMIUM_TYPES congelada: segue no toast comum — regra 1.0.224 preservada)",
    e4 && !e4.none && /cat-red/.test(e4.html) && /cx="12" cy="12" r="8\.5"/.test(e4.html) && /Por /.test(e4.html) && e4.cardW === 440 && !e4.overflow, { w: e4 && e4.cardW, h: e4 && e4.cardH });
  await shot("e04-cancelada");
  const e5 = await showVariant(basePay({ eventType: "flow_completed", title: "Aprovação do cliente", taskTitle: "TEMAS",
    clientName: "Hospital Visão", cronContext: "Cronograma mensal • 12 temas", actorName: "Felipe Teodozio", severity: "success" }), "e05");
  rec("E05 variante aprovação no COMPONENTE empacotado: verde + check + eyebrow 'Aprovação do cliente' (elegibilidade PREMIUM_TYPES congelada — regra 1.0.224 preservada)",
    e5 && !e5.none && /cat-green/.test(e5.html) && /M4 12\.5l5 5 11-11/.test(e5.html) && /Aprovação do cliente/.test(e5.html) && e5.cardW === 440 && !e5.overflow, { w: e5 && e5.cardW, h: e5 && e5.cardH });
  await shot("e05-aprovacao");

  /* E06 — cliente CURTO (ULTRA, canônico do doc via enriquecimento) */
  const e6 = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "vidUltra", taskTitle: "Reels institucional",
    fromStatus: "andamento", toStatus: "revisao", actorName: "Ana Beatriz Social Media" });
  rec("E06 cliente curto: linha própria 'ULTRA' (do DOC) + contexto 'Edição de vídeos'",
    e6 && /<div class="ntfp-client" title="ULTRA">ULTRA<\/div>/.test(e6.html) && /Edição de vídeos/.test(e6.html) && !e6.overflow, {});
  await shot("e06-cliente-curto-ultra");

  /* E07 — cliente LONGO (1 linha + ellipsis + tooltip completo) */
  const e7 = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "vidLongo", taskTitle: "Vídeo de resultados",
    fromStatus: "afazer", toStatus: "andamento", actorName: "Ana Beatriz Social Media" });
  const cliEll = await J(`(function(){ var el=document.querySelector('#notif-stack .ntfp-client'); if(!el) return {none:true};
    return { ell: el.scrollWidth>el.clientWidth+1, title: String(el.getAttribute('title')||'') }; })()`);
  rec("E07 cliente longo: truncado em 1 linha (ellipsis real) + tooltip com nome completo + sem overflow",
    e7 && !e7.overflow && cliEll && cliEll.ell === true && /Clínica Oftalmológica Visão Integrada de Alta Complexidade do Norte e Nordeste LTDA/.test(cliEll.title || ""), cliEll);
  await shot("e07-cliente-longo");

  /* E08 — autor LONGO no footer (ellipsis + tooltip) */
  const e8 = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronMen", taskTitle: "TEMAS",
    fromStatus: "andamento", toStatus: "revisao", actorName: LONGO, responsibleName: LONGO });
  rec("E08 autor longo: 1 linha com ellipsis REAL + tooltip 'Movimentada por <nome completo>'",
    e8 && e8.bytEll === true && e8.bytTitle === ("Movimentada por " + LONGO) && !e8.overflow, { title: e8 && e8.bytTitle });
  await shot("e08-autor-longo");

  /* E09 — sem avatar ⇒ iniciais geradas 28px (ring 1px) */
  const e9 = await J(`(function(){ var av=document.querySelector('#notif-stack .ntfp-by .ntfp-av.gen'); if(!av) return {none:true};
    var r=av.getBoundingClientRect(); var cs=getComputedStyle(av);
    return { w: Math.round(r.width), txt: (av.textContent||'').trim(), ring: cs.boxShadow.indexOf('1px')>=0, fs: cs.fontSize }; })()`);
  rec("E09 sem avatar: iniciais geradas (2 letras) em 28px com ring 1px + fonte 11px",
    e9 && !e9.none && e9.w === 28 && e9.txt.length === 2 && e9.ring && e9.fs === "11px", e9);
  await shot("e09-sem-avatar-iniciais");

  /* E10 — responsável ≠ autor ⇒ 'Responsável · Nome' acima do footer */
  const e10 = await show({ eventType: "task_reopened", title: "Tarefa reaberta", taskId: "cronMen", taskTitle: "TEMAS",
    fromStatus: "concluido", toStatus: "andamento", actorName: LONGO, responsibleName: "Felipe Teodozio", severity: "warning" });
  rec("E10 responsável distinto: 'Responsável · Felipe Teodozio' (linha própria, antes do footer; tooltip)",
    e10 && /title="Responsável: Felipe Teodozio">Responsável · Felipe Teodozio<\/div>/.test(e10.html)
      && e10.html.indexOf('ntfp-respline') < e10.html.indexOf('ntfp-ft') && !e10.overflow, {});
  await shot("e10-responsavel-distinto");
  /* actorId COERENTE com o nome (o produto resolve o autor pelo perfil do actorId — F3.5.3A congelada) */
  const e10b = await show({ eventType: "task_reopened", title: "Tarefa reaberta", taskId: "cronMen", taskTitle: "TEMAS",
    fromStatus: "concluido", toStatus: "andamento", actorId: ID.FELIPE, actorName: "Felipe Teodozio", responsibleName: "Felipe Teodozio", severity: "warning" });
  rec("E10b responsável = autor (perfil real do actorId): SEM linha duplicada",
    e10b && /Reaberta por Felipe Teodozio/.test(e10b.html) && e10b.html.indexOf('ntfp-respline') < 0, {});

  /* E11 — Cronograma LEGADO mensal (contexto EXATO do doc) */
  const e11 = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronMen", taskTitle: "TEMAS",
    fromStatus: "andamento", toStatus: "revisao", actorName: LONGO });
  rec("E11 legado mensal: 'Cronograma mensal • 12 temas' EXATO (tooltip incluso)",
    e11 && /Cronograma mensal • 12 temas/.test(e11.html) && !e11.overflow, {});
  await shot("e11-legado-mensal");

  /* E12 — Cronograma PERSONALIZADO (quantidade real, sem periodicidade inventada) */
  const e12 = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronCustom", taskTitle: "TEMAS",
    fromStatus: "andamento", toStatus: "revisao", actorName: LONGO });
  rec("E12 personalizado: 'Cronograma • 7 temas' sem semanal/quinzenal/mensal",
    e12 && /Cronograma • 7 temas/.test(e12.html) && !/Cronograma (semanal|quinzenal|mensal)/.test(e12.html) && !e12.overflow, {});
  await shot("e12-personalizado-7-temas");

  /* E13 — TRÊS empilhadas (fila de produção; coluna menor que o ANTES 747px) */
  const e13 = await J(`(function(){ var st=document.getElementById('notif-stack'); st.innerHTML='';
    var mk=function(id,et,ti,sev){ notifShowToast(Object.assign(${JSON.stringify(basePay({}))},{eventType:et,title:ti,taskId:'cronMen',taskTitle:'TEMAS',dedupeKey:id,actorName:${JSON.stringify(LONGO)},fromStatus:'andamento',toStatus:'revisao',severity:sev})); };
    mk('e13a','task_moved','Tarefa movimentada','info'); mk('e13b','task_completed','Tarefa concluída','success'); mk('e13c','task_reopened','Tarefa reaberta','warning');
    var cards=[].slice.call(document.querySelectorAll('#notif-stack .ntf'));
    var rs=cards.map(function(c){ return c.getBoundingClientRect(); });
    var overlap=false; for(var i=1;i<rs.length;i++){ if(rs[i].top < rs[i-1].bottom - 2) overlap=true; }
    var st2=document.getElementById('notif-stack').getBoundingClientRect();
    var inScreen=rs.every(function(r){ return r.right<=window.innerWidth+1 && r.left>=-1 && r.bottom<=window.innerHeight+1; });
    return { n: cards.length, overlap: overlap, inScreen: inScreen, stackH: Math.round(st2.height) }; })()`);
  rec("E13 três empilhadas: 3 cards, sem sobreposição, na tela, coluna " + (e13 && e13.stackH) + "px < ANTES 747px",
    e13 && e13.n === 3 && !e13.overlap && e13.inScreen && e13.stackH < ANTES.tresEmpilhadas.stackH, Object.assign({ antesStackH: ANTES.tresEmpilhadas.stackH }, e13));
  await shot("e13-tres-empilhadas");

  /* E14/E15 — escala Windows 125% / 150% (zoomFactor real do Chromium) */
  const zoomScene = async (zf, nm) => {
    wc.setZoomFactor(zf); await sleep(250);
    const r = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronMen", taskTitle: "TEMAS",
      fromStatus: "andamento", toStatus: "revisao", actorName: LONGO, responsibleName: "Felipe Teodozio" });
    const geo = await J(`(function(){ var c=document.querySelector('#notif-stack .ntf'); if(!c) return {none:true};
      var r=c.getBoundingClientRect(); return { right: r.right, bottom: r.bottom, iw: window.innerWidth, ih: window.innerHeight,
        inScreen: r.right<=window.innerWidth+1 && r.bottom<=window.innerHeight+1 && r.left>=-1,
        chips: !!c.querySelector('.ntfp-chip'), cta: !!c.querySelector('.ntfp-cta'), close: !!c.querySelector('.ntf-x') }; })()`);
    await shot(nm);
    return r && geo && !r.overflow && !geo.none && geo.inScreen && geo.chips && geo.cta && geo.close;
  };
  rec("E14 escala 125%: sem corte de conteúdo, sem overflow, chips/CTA/fechar visíveis", await zoomScene(1.25, "e14-escala-125"), {});
  rec("E15 escala 150%: sem corte de conteúdo, sem overflow, chips/CTA/fechar visíveis", await zoomScene(1.5, "e15-escala-150"), {});
  wc.setZoomFactor(1); await sleep(200);

  /* E16/E17 — resoluções 1366×768 e 1920×1080 (canto inferior direito, sem overflow) */
  const resScene = async (w, h, nm) => {
    win.setContentSize(w, h); await sleep(400);
    const r = await show({ eventType: "task_completed", title: "Tarefa concluída", taskId: "cronMen", taskTitle: "TEMAS", actorName: "Ana Beatriz Social Media", severity: "success" });
    const geo = await J(`(function(){ var c=document.querySelector('#notif-stack .ntf'); if(!c) return {none:true};
      var rr=c.getBoundingClientRect();
      return { iw: window.innerWidth, ih: window.innerHeight,
        inCorner: rr.right<=window.innerWidth+1 && rr.bottom<=window.innerHeight+1 && rr.right>window.innerWidth*0.5 && rr.bottom>window.innerHeight*0.5,
        bodyOverflow: document.documentElement.scrollWidth>window.innerWidth+1 }; })()`);
    await shot(nm);
    return r && geo && !r.overflow && !geo.none && geo.inCorner && !geo.bodyOverflow;
  };
  rec("E16 1366×768: canto inferior direito, sem overflow", await resScene(1366, 768, "e16-1366x768"), {});
  rec("E17 1920×1080: canto inferior direito, sem overflow", await resScene(1920, 1080, "e17-1920x1080"), {});

  /* fixture sanitizada p/ o relatório (sem conteúdo privado) */
  try { fs.writeFileSync(path.join(OUT, "f355eh1-proof-results.json"), JSON.stringify({ at: new Date().toISOString(), indexSha: meta.stageIndexSha, antes: ANTES, results }, null, 2)); } catch (_) {}

  const failures = results.filter((r) => !r.ok).length;
  clearTimeout(WATCHDOG);
  process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=" + failures + "\n");
  app.exit(failures ? 1 : 0);
});
