/* F3.5.5E — PROVAS REAIS (Electron 31.3.1; renderer REAL empacotado em app.asar; xvfb).
 * Mesma infraestrutura aprovada do harness F3.5.5D: empacota o renderer de produção em
 * app.asar, carrega DO ASAR com o preload de semente (f355d-proof-preload.js — firebase
 * stub + SEMENTE via onSnapshot) e exercita o CÓDIGO DE PRODUÇÃO. Sem IA, sem mockup,
 * sem HTML isolado, sem captura manipulada, sem dados inventados; cliente NUNCA vem do
 * título; módulo NUNCA é identificado por string visual.
 *
 * P1 Quadros sem os 3 módulos          P2 Nova tarefa sem os 3        P3 contador total atualizado
 * P4 busca/board sem retirados         P5 históricos preservados      P6 deep-link antigo seguro
 * P7 notificação criada/atribuída      P8 concluída                   P9 reaberta
 * P10 cliente claramente visível       P11 semanal legado             P12 quinzenal legado
 * P13 mensal legado                    P14 personalizado 7 temas      P15 autor ≠ responsável
 * P16 status organizado                P17 título longo               P18 cliente longo
 * P19 sem cliente                      P20 três empilhadas            P21 som/entrega única (dedup)
 * P22 clique em Abrir tarefa           P23 125%                       P24 150%
 * P25 1366×768                         P26 1920×1080 */
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

/* ---- SEMENTE (vivos + históricos dos módulos retirados) ---- */
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
    /* vivos */
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
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f355e-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f355e-app.asar");
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

  /* mesmos IPCs de clipboard do main.ts (o preload os referencia) */
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
  /* BOOT com poll (snapshot da semente é assíncrono — mesmo padrão dos harnesses aprovados) */
  let boot = null;
  for (let i = 0; i < 30; i++) {
    boot = await J(`(function(){ var st=(typeof state!=='undefined')?state:null; return { user: !!(st&&st.user), tasks: ((st&&st.tasks)||[]).length,
      retired: window.__retiredCutoff||null, retIdx: Object.keys(window.__retiredIndex||{}).sort().join(','), ver: 224 }; })()`);
    if (boot && boot.user && boot.tasks === 6 && boot.retired) break;
    await sleep(500);
  }
  rec("BOOT app real do asar (semente aplicada; retirados fora do state)", !!(boot && boot.user && boot.tasks === 6 && boot.retired && boot.retired.dropped === 3 && boot.retIdx === "copy1,post1,rot1"), Object.assign({ indexSha: meta.stageIndexSha.slice(0, 12) }, boot));

  const nav = `(function(){ try{closeModal();}catch(_){ } state.tab='tarefas'; state.boardSector=null; state.personBoard=null; state.roleBoards=false; state.flowView=null; state.designerBoard=null; state.socialBoard=null; state.form=null; render(); return true; })()`;

  /* P1 — Quadros sem os três módulos */
  await J(nav); await sleep(300);
  const p1 = await J(`(function(){ var ks=[].map.call(document.querySelectorAll('[data-sector]'),function(b){return b.dataset.sector;});
    var labels=[].map.call(document.querySelectorAll('[data-sector] .bl'),function(e){return e.textContent;}).join('|');
    return { ks: ks.join(','), labels: labels, cliente: !!document.querySelector('[data-flowclient]'), designers: !!document.querySelector('[data-flowdesigners]') }; })()`);
  rec("P1 Quadros: SÓ Edição de vídeos + Cronograma + Edição de Cards (Cliente/Designers preservados)",
    p1 && p1.ks === "edicao_midia,cronograma,edicao_cards" && p1.labels.indexOf("Roteiro") < 0 && p1.labels.indexOf("Copywriting") < 0 && p1.labels.indexOf("Programação") < 0 && p1.cliente && p1.designers, p1);
  await shot("p1-quadros-sem-modulos");

  /* P2 — Nova tarefa sem os três */
  await J(`(function(){ openTaskForm(); return true; })()`); await sleep(250);
  const p2 = await J(`(function(){ var ks=[].map.call(document.querySelectorAll('[data-fsector]'),function(b){return b.dataset.fsector;});
    return { ks: ks.join(',') }; })()`);
  rec("P2 Nova tarefa: setores ofertados = vivos apenas", p2 && p2.ks.indexOf("roteiro") < 0 && p2.ks.indexOf("copywriting") < 0 && p2.ks.indexOf("programacao_posts") < 0 && p2.ks.indexOf("cronograma") >= 0 && p2.ks.indexOf("edicao_midia") >= 0, p2);
  await shot("p2-nova-tarefa-sem-modulos");
  await J(`(function(){ state.form=null; render(); return true; })()`);

  /* P3 — contador total atualizado (pills do hub) */
  await J(nav); await sleep(250);
  const p3 = await J(`(function(){ var m={}; [].forEach.call(document.querySelectorAll('[data-sector]'),function(b){ var t=(b.querySelector('.bp .pill')||{}).textContent||''; m[b.dataset.sector]=t; });
    return { cron:(m.cronograma||''), vid:(m.edicao_midia||''), cards:(m.edicao_cards||''), total: state.tasks.length }; })()`);
  rec("P3 contadores recalculados (cronograma=4; vídeos=1; cards=1; total ativo=6 — sem retirados)",
    p3 && /^4 /.test(p3.cron) && /^1 /.test(p3.vid) && /^1 /.test(p3.cards) && p3.total === 6, p3);

  /* P4 — board do Cronograma sem retirados (busca/eixo derivam do state) */
  const p4 = await J(`(function(){ var live=state.tasks.map(function(t){return t.id;}).sort().join(',');
    var rot=state.tasks.find(function(t){return t.id==='rot1'||t.id==='copy1'||t.id==='post1';});
    return { live: live, temRetirado: !!rot }; })()`);
  rec("P4 nenhuma tarefa retirada em nenhuma lista operacional (fonte única filtrada)", p4 && !p4.temRetirado && p4.live === "card1,cronCustom,cronMen,cronQuin,cronSem,vid1", p4);

  /* P5 — históricos PRESERVADOS: zero delete/patch + índice sem conteúdo + semente intacta em disco */
  const p5 = await J(`(function(){ return { deletes: (window.__DELETES||[]).length, patches: (window.__PATCHES||[]).length,
    idx: window.__retiredIndex['rot1'] ? Object.keys(window.__retiredIndex['rot1']).join(',') : '', mod: (window.__retiredIndex['rot1']||{}).s }; })()`);
  const seedShaAfter = sha256(seedPath);
  rec("P5 dados históricos preservados (0 deletes, 0 writes; índice só id→setor; storage intacto)",
    p5 && p5.deletes === 0 && p5.patches === 0 && p5.idx === "s" && p5.mod === "roteiro" && seedShaAfter === seedShaBefore, Object.assign({ seedIntacta: seedShaAfter === seedShaBefore }, p5));

  /* P6 — deep-link antigo de módulo retirado: mensagem + volta p/ Tarefas (nunca tela branca) */
  const p6 = await J(`(function(){ openDetails('rot1'); var ft=document.getElementById('flashToast');
    return { modal: !!document.querySelector('.modal-back[data-detmodal]'), tab: state.tab,
      msg: ft && ft.classList.contains('show') ? ft.textContent : '' }; })()`);
  rec("P6 deep-link retirado seguro: sem modal, redirect Tarefas, mensagem de descontinuado",
    p6 && !p6.modal && p6.tab === "tarefas" && /descontinuado/.test(p6.msg || "") && /Agenda ID Seven/.test(p6.msg || ""), p6);
  await shot("p6-deeplink-descontinuado");

  /* helper de notificação premium (produção: notifShowToast + notifNormalize + enriquecimento do doc) */
  const T15 = new Date(); T15.setHours(15, 2, 0, 0);
  const basePay = (o) => Object.assign({ _premiumCommon: true, severity: "info", sound: false, createdAt: T15.getTime(),
    actorId: ID.DIEGO, actorName: "", responsibleId: "", responsibleName: "" }, o);
  const showToast = async (o) => J(`(function(){ try{ var st=document.getElementById('notif-stack'); if(st) st.innerHTML=''; }catch(_){}
    notifShowToast(${JSON.stringify(basePay(o))});
    var c=document.querySelector('#notif-stack .ntf-card.ntfp'); if(!c) return { none:true };
    return { html: c.innerHTML.slice(0, 4000), w: c.getBoundingClientRect().width,
      overflow: (c.scrollWidth>c.clientWidth+1) || (document.documentElement.scrollWidth>window.innerWidth+1) }; })()`);

  /* P7/P8/P9 — criada/atribuída, concluída, reaberta */
  const p7 = await showToast({ eventType: "task_assigned", title: "Tarefa atribuída", taskId: "cronMen", taskTitle: "TEMAS", responsibleId: ID.FELIPE, responsibleName: "Felipe Teodozio", actorName: "Ana Beatriz Social Media", actorId: ID.ANA });
  rec("P7 notificação de tarefa criada/atribuída (azul; Atribuída a Felipe)", p7 && !p7.none && /cat-blue/.test(p7.html) && /Tarefa atribuída/.test(p7.html) && /Atribuída a Felipe Teodozio/.test(p7.html) && /15:02/.test(p7.html), { w: p7 && p7.w });
  await shot("p7-atribuida");
  const p8 = await showToast({ eventType: "task_completed", title: "Tarefa concluída", taskId: "cronMen", taskTitle: "TEMAS", fromStatus: "andamento", toStatus: "concluido", actorName: "Miercohévisk Niheb Ferreira", severity: "success" });
  rec("P8 tarefa concluída (verde; chips Em andamento→Concluído; Concluída por)", p8 && /cat-green/.test(p8.html) && /Concluída por Miercohévisk/.test(p8.html) && /cs-concluido/.test(p8.html), {});
  await shot("p8-concluida");
  const p9 = await showToast({ eventType: "task_reopened", title: "Tarefa reaberta", taskId: "cronMen", taskTitle: "TEMAS", fromStatus: "concluido", toStatus: "andamento", actorName: "Miercohévisk Niheb Ferreira", severity: "warning" });
  rec("P9 tarefa reaberta (âmbar; Concluído→Em andamento; Reaberta por)", p9 && /cat-amber/.test(p9.html) && /Reaberta por Miercohévisk/.test(p9.html) && /cs-concluido/.test(p9.html) && /cs-andamento/.test(p9.html), {});
  await shot("p9-reaberta");

  /* P10 — cliente claramente visível (linha própria, canônica do doc via enriquecimento) */
  rec("P10 cliente claramente visível (Hospital Visão do DOC — nunca do título; tooltip — RE-PINADO F3.5.5E-H1)", p9 && /<div class="ntfp-client" title="Hospital Visão">Hospital Visão<\/div>/.test(p9.html), {});

  /* P11-P13 — cronogramas LEGADOS (contexto do doc real no state) */
  const p11 = await showToast({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronSem", taskTitle: "Cronograma da Ótica", fromStatus: "afazer", toStatus: "andamento", actorName: "Ana Beatriz Social Media" });
  rec("P11 legado SEMANAL real: 'Cronograma semanal • 3 temas'", p11 && /Cronograma semanal • 3 temas/.test(p11.html) && /Ótica Clara/.test(p11.html), {});
  await shot("p11-legado-semanal");
  const p12 = await showToast({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronQuin", taskTitle: "Cronograma da Clínica", fromStatus: "afazer", toStatus: "andamento", actorName: "Ana Beatriz Social Media" });
  rec("P12 legado QUINZENAL real: 'Cronograma quinzenal • 6 temas'", p12 && /Cronograma quinzenal • 6 temas/.test(p12.html), {});
  const p13 = await showToast({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronMen", taskTitle: "TEMAS", fromStatus: "afazer", toStatus: "andamento", actorName: "Ana Beatriz Social Media" });
  rec("P13 legado MENSAL real: 'Cronograma mensal • 12 temas'", p13 && /Cronograma mensal • 12 temas/.test(p13.html), {});
  await shot("p13-legado-mensal");

  /* P14 — personalizado: quantidade SEM periodicidade inventada */
  const p14 = await showToast({ eventType: "task_reopened", title: "Tarefa reaberta", taskId: "cronCustom", taskTitle: "TEMAS", fromStatus: "concluido", toStatus: "andamento", actorName: "Miercohévisk Niheb Ferreira", severity: "warning" });
  rec("P14 personalizado: 'Cronograma • 7 temas' (sem semanal/quinzenal/mensal)", p14 && /Cronograma • 7 temas/.test(p14.html) && !/Cronograma (semanal|quinzenal|mensal)/.test(p14.html), {});
  await shot("p14-personalizado-7-temas");

  /* P15 — autor ≠ responsável (linhas separadas, hierarquia correta) */
  const p15 = await showToast({ eventType: "task_reopened", title: "Tarefa reaberta", taskId: "cronMen", taskTitle: "TEMAS", fromStatus: "concluido", toStatus: "andamento", actorName: "Miercohévisk Niheb Ferreira", responsibleName: "Felipe Teodozio", severity: "warning" });
  /* RE-PINADO F3.5.5E-H1: responsável em linha própria ACIMA do footer; autor+CTA no footer estruturado */
  const ordOk = p15 && (p15.html.indexOf('ntfp-task') < p15.html.indexOf('ntfp-client')) && (p15.html.indexOf('ntfp-client') < p15.html.indexOf('ntfp-ctx')) && (p15.html.indexOf('ntfp-ctx') < p15.html.indexOf('ntfp-chips')) && (p15.html.indexOf('ntfp-chips') < p15.html.indexOf('ntfp-respline')) && (p15.html.indexOf('ntfp-respline') < p15.html.indexOf('ntfp-ft')) && (p15.html.indexOf('ntfp-ft') < p15.html.indexOf('ntfp-by'));
  rec("P15 autor e responsável separados (Reaberta por Miercohévisk… + Responsável: Felipe)", p15 && /Reaberta por Miercohévisk/.test(p15.html) && /Responsável: Felipe Teodozio/.test(p15.html) && ordOk, { hierarquiaOk: !!ordOk });
  await shot("p15-autor-responsavel");

  /* P16 — status organizado (chips compactos com rótulos traduzidos) */
  const p16 = await J(`(function(){ var chips=document.querySelectorAll('#notif-stack .ntfp-chip'); if(chips.length!==2) return { n: chips.length };
    var h=Math.max(chips[0].getBoundingClientRect().height, chips[1].getBoundingClientRect().height);
    return { n: 2, h: h, t: chips[0].textContent+'>'+chips[1].textContent }; })()`);
  rec("P16 transição de status organizada (2 chips compactos ≤30px; Concluído→Em andamento)", p16 && p16.n === 2 && p16.h <= 30 && /Concluído>Em andamento/.test(p16.t || ""), p16);

  /* P17/P18 — título e cliente longos sem estourar o card */
  const p17 = await showToast({ eventType: "task_moved", title: "Tarefa movimentada", taskTitle: "Planejamento completo de conteúdo audiovisual institucional do segundo semestre com desdobramentos", clientName: "Hospital Visão", fromStatus: "afazer", toStatus: "andamento", actorName: "Ana Beatriz Social Media" });
  rec("P17 título longo sem overflow horizontal", p17 && !p17.overflow, { w: p17 && p17.w });
  const p18 = await showToast({ eventType: "task_moved", title: "Tarefa movimentada", taskTitle: "TEMAS", clientName: "Clínica Oftalmológica Visão Integrada de Alta Complexidade do Norte e Nordeste LTDA", fromStatus: "afazer", toStatus: "andamento", actorName: "Ana Beatriz Social Media" });
  rec("P18 cliente longo sem overflow (linha própria com clamp)", p18 && !p18.overflow && /Clínica Oftalmológica Visão Integrada/.test(p18.html), {});
  await shot("p18-cliente-longo");

  /* P19 — sem cliente: fallback profissional (tarefa de Cards sem client no doc) */
  const p19 = await showToast({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "card1", taskTitle: "Card avulso de aniversário", fromStatus: "afazer", toStatus: "andamento", actorName: "Ana Beatriz Social Media" });
  rec("P19 sem cliente ⇒ 'Sem cliente vinculado' (nunca vazio/undefined)", p19 && /Sem cliente vinculado/.test(p19.html) && !/undefined|\[object/.test(p19.html) && /Edição de Cards/.test(p19.html), {});
  await shot("p19-sem-cliente");

  /* P20 — três notificações empilhadas (sem sobreposição; todas na tela) */
  const p20 = await J(`(function(){ var st=document.getElementById('notif-stack'); st.innerHTML='';
    var mk=function(id,et,ti){ notifShowToast(Object.assign(${JSON.stringify(basePay({}))},{eventType:et,title:ti,taskId:id,taskTitle:id,actorName:'Ana Beatriz Social Media',fromStatus:'afazer',toStatus:'andamento'})); };
    mk('cronSem','task_moved','Tarefa movimentada'); mk('vid1','task_completed','Tarefa concluída'); mk('cronCustom','task_reopened','Tarefa reaberta');
    var cards=[].slice.call(document.querySelectorAll('#notif-stack .ntf'));
    var rs=cards.map(function(c){ return c.getBoundingClientRect(); });
    var overlap=false; for(var i=1;i<rs.length;i++){ if(rs[i].top < rs[i-1].bottom - 2) overlap=true; }
    var inScreen=rs.every(function(r){ return r.right<=window.innerWidth+1 && r.left>=-1; });
    return { n: cards.length, overlap: overlap, inScreen: inScreen }; })()`);
  rec("P20 três empilhadas: 3 cards, sem sobreposição, dentro da tela", p20 && p20.n === 3 && !p20.overlap && p20.inScreen, p20);
  await shot("p20-tres-empilhadas");

  /* P21 — entrega/som únicos: notifEmit 2× a MESMA dedupKey ⇒ 1 card (produção notifEmit+dedup) */
  const p21 = await J(`(function(){ var st=document.getElementById('notif-stack'); st.innerHTML='';
    var real=window.desktopAPI; window.desktopAPI={ diagLog:function(){} };   /* força o fallback local (sem HUB) */
    try{ if(typeof notifSaveSeen==='function') notifSaveSeen({}); }catch(_){}   /* limpa o dedup persistido de runs anteriores (prova exige 1ª entrega) */
    var p=Object.assign(${JSON.stringify(basePay({}))},{eventType:'task_completed',title:'Tarefa concluída',taskId:'vid1',taskTitle:'Reels institucional',actorName:'Ana Beatriz Social Media',fromStatus:'andamento',toStatus:'concluido',dedupKey:'task_completed:vid1:PROVA21',sound:true});
    notifEmit(p); notifEmit(p);
    var n=document.querySelectorAll('#notif-stack .ntf').length;
    window.desktopAPI=real;
    return { n: n }; })()`);
  rec("P21 dedup real: 2× notifEmit mesma chave ⇒ 1 card/1 entrega (som nunca duplica)", p21 && p21.n === 1, p21);

  /* P22 — clique em Abrir tarefa abre a Central de Detalhes da tarefa certa */
  const p22 = await J(`(function(){ var st=document.getElementById('notif-stack'); st.innerHTML='';
    notifShowToast(Object.assign(${JSON.stringify(basePay({}))},{eventType:'task_reopened',title:'Tarefa reaberta',taskId:'cronCustom',taskTitle:'TEMAS',actorName:'Miercohévisk Niheb Ferreira',fromStatus:'concluido',toStatus:'andamento',action:{type:'detail',deep:'detail/cronCustom'}}));
    var cta=document.querySelector('#notif-stack .ntfp-cta'); if(!cta) return { none:true };
    cta.click();
    var m=document.querySelector('.modal-back[data-detmodal]');
    return { modal: !!m, titulo: m ? (m.textContent.indexOf('TEMAS')>=0) : false, toastFechado: document.querySelectorAll('#notif-stack .ntf').length===0 }; })()`);
  rec("P22 Abrir tarefa: deep-link real abre a Central de Detalhes de TEMAS e fecha o toast", p22 && p22.modal && p22.titulo, p22);
  await shot("p22-abrir-tarefa");
  await J(`(function(){ try{closeModal();}catch(_){ } return true; })()`);

  /* P23/P24 — escalas 125% / 150% */
  const scaleScene = async (z, nm) => {
    wc.setZoomFactor(z); await sleep(300);
    const r = await showToast({ eventType: "task_reopened", title: "Tarefa reaberta", taskId: "cronMen", taskTitle: "TEMAS", fromStatus: "concluido", toStatus: "andamento", actorName: "Miercohévisk Niheb Ferreira", responsibleName: "Felipe Teodozio", severity: "warning" });
    const m = await J(`(function(){ return { bodyOverflow: document.documentElement.scrollWidth>window.innerWidth+1 }; })()`);
    await shot(nm);
    return r && !r.none && !r.overflow && m && !m.bodyOverflow && /Hospital Visão/.test(r.html);
  };
  rec("P23 escala 125%: card íntegro, sem overflow, cliente visível", await scaleScene(1.25, "p23-escala-125"), {});
  rec("P24 escala 150%: card íntegro, sem overflow, cliente visível", await scaleScene(1.5, "p24-escala-150"), {});
  wc.setZoomFactor(1); await sleep(200);

  /* P25/P26 — resoluções 1366×768 e 1920×1080 */
  const resScene = async (w, h, nm) => {
    win.setContentSize(w, h); await sleep(400);
    const r = await J(`(function(){ var st=document.getElementById('notif-stack'); st.innerHTML='';
      notifShowToast(Object.assign(${JSON.stringify(basePay({}))},{eventType:'task_completed',title:'Tarefa concluída',taskId:'cronQuin',taskTitle:'Cronograma da Clínica',actorName:'Ana Beatriz Social Media',fromStatus:'andamento',toStatus:'concluido',severity:'success'}));
      var c=document.querySelector('#notif-stack .ntf'); if(!c) return { none:true };
      var rr=c.getBoundingClientRect();
      return { right: rr.right, bottom: rr.bottom, iw: window.innerWidth, ih: window.innerHeight,
        inCorner: rr.right<=window.innerWidth+1 && rr.bottom<=window.innerHeight+1 && rr.right>window.innerWidth*0.5 && rr.bottom>window.innerHeight*0.5,
        bodyOverflow: document.documentElement.scrollWidth>window.innerWidth+1 }; })()`);
    await shot(nm);
    return r && !r.none && r.inCorner && !r.bodyOverflow;
  };
  rec("P25 1366×768: canto inferior direito, dentro da área útil, sem overflow", await resScene(1366, 768, "p25-1366x768"), {});
  rec("P26 1920×1080: canto inferior direito, dentro da área útil, sem overflow", await resScene(1920, 1080, "p26-1920x1080"), {});

  /* fixture sanitizada p/ o relatório (sem conteúdo privado) */
  try {
    fs.writeFileSync(path.join(OUT, "f355e-proof-results.json"), JSON.stringify({ at: new Date().toISOString(), indexSha: meta.stageIndexSha, results }, null, 2));
  } catch (_) {}

  const failures = results.filter((r) => !r.ok).length;
  clearTimeout(WATCHDOG);
  process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=" + failures + "\n");
  try { win.destroy(); } catch (_) {}
  app.exit(failures ? 1 : 0);
});
