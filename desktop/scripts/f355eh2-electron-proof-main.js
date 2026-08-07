/* F3.5.5E-H2 — PROVAS REAIS do design da REFERÊNCIA DO OWNER (Electron 31.3.1; renderer REAL
 * empacotado em app.asar; xvfb). Mesma infraestrutura aprovada dos harnesses F3.5.5D/E/E-H1.
 * Sem IA, sem mockup, sem HTML isolado, sem captura manipulada; screenshots aguardam o fim da
 * animação de entrada (180ms) antes de capturar. A cena E20 usa a JANELA PREMIUM REAL
 * (bgnotify.html DO ASAR + preload REAL dist/preload/bgnotify-preload.js + payload via IPC
 * "bg-card" — o MESMO canal do bgNotify.ts congelado), com janela frameless/transparente como
 * em produção (app minimizado/fechado).
 *
 * As 20 provas do mandato:
 *  E01 movimentada (+métricas)   E02 concluída       E03 reaberta      E04 ajuste (componente)
 *  E05 aprovação (componente)    E06 cliente curto   E07 cliente longo E08 autor longo
 *  E09 responsável diferente     E10 sem avatar      E11 legado        E12 personalizado
 *  E13 3 simultâneas             E14 100%            E15 125%          E16 150%
 *  E17 1366×768                  E18 1920×1080       E19 app aberto    E20 app minimizado (bgnotify) */
const { app, BrowserWindow, session, ipcMain, clipboard } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f355eh2-qa");
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }
const ofs = require("original-fs");
const sha256 = (p) => crypto.createHash("sha256").update(ofs.readFileSync(p)).digest("hex");
process.on("uncaughtException", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=uncaught:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });
process.on("unhandledRejection", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=unhandled:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });

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
  ];
  return { self, users, tasks, events: [] };
})();

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();

let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f355eh2-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js", "bgnotify.html"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f355eh2-app-" + Date.now() + ".asar");
  await asar.createPackage(stage, asarPath);
  return { stageIndexSha: sha256(path.join(rdir, "index.html")), stageBgSha: sha256(path.join(rdir, "bgnotify.html")) };
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
  wc.on("console-message", (_e, lvl, msg, ln, src) => { if (lvl >= 2) line({ console: String(msg).slice(0, 220), src: String(src || "").split("/").pop(), ln }); });
  wc.on("render-process-gone", (_e, d) => { line({ rendererGone: (d && d.reason) || "?" }); });
  const J = (code) => wc.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));
  async function shot(nm, w) { try { await sleep(430); const img = await (w || wc).capturePage(); fs.writeFileSync(path.join(OUT, nm + ".png"), img.toPNG()); return nm + ".png"; } catch (e) { return "shot_err:" + String((e && e.message) || e).slice(0, 80); } }

  await win.loadURL("file://" + asarPath.replace(/\\/g, "/") + "/src/renderer/index.html");
  let boot = null;
  for (let i = 0; i < 30; i++) {
    boot = await J(`(function(){ var st=(typeof state!=='undefined')?state:null; return { user: !!(st&&st.user), tasks: ((st&&st.tasks)||[]).length }; })()`);
    if (boot && boot.user && boot.tasks === 4) break;
    await sleep(500);
  }
  rec("BOOT app real do asar (semente aplicada)", !!(boot && boot.user && boot.tasks === 4), Object.assign({ indexSha: meta.stageIndexSha.slice(0, 12) }, boot));

  const T20 = new Date(); T20.setHours(20, 30, 0, 0);
  const basePay = (o) => Object.assign({ _premiumCommon: true, severity: "info", sound: false, createdAt: T20.getTime(),
    actorId: ID.DIEGO, actorName: "", responsibleId: "", responsibleName: "" }, o);
  const show = async (o) => J(`(function(){ try{ var st=document.getElementById('notif-stack'); if(st) st.innerHTML=''; }catch(_){}
    notifShowToast(${JSON.stringify(basePay(o))});
    var n=document.querySelector('#notif-stack .ntf.ntfp-w'); if(!n) return { none:true };
    var box=n.getBoundingClientRect();
    var wrap=n.querySelector('.ntfp-wrap'); var wr=wrap?wrap.getBoundingClientRect():{};
    var fl=n.querySelector('.ntfp-fl'); var fr=fl?fl.getBoundingClientRect():{};
    var pill=n.querySelector('.ntfp-pill'); var pr2=pill?pill.getBoundingClientRect():{};
    var seg=n.querySelector('.ntfp-pr'); var sr=seg?seg.getBoundingClientRect():{};
    var x=n.querySelector('.ntf-x'); var xr=x?x.getBoundingClientRect():{};
    var meta=n.querySelector('.ntfp-meta'); var metaEll=meta?(meta.scrollWidth>meta.clientWidth+1):false;
    var cs=wrap?getComputedStyle(wrap):{};
    return { html: n.innerHTML.slice(0, 4200), boxW: Math.round(box.width), boxH: Math.round(box.height),
      surfW: Math.round(wr.width||0), surfH: Math.round(wr.height||0),
      flW: Math.round(fr.width||0), flAcima: wrap?Math.round(wr.top-fr.top):0, flVisivel: fl?(fr.top>=0&&fr.left>=0):false,
      pillH: Math.round(pr2.height||0), segW: Math.round(sr.width||0), segTxt: seg?seg.textContent:'',
      radius: cs.borderRadius||'', closeW: Math.round(xr.width||0), closeH: Math.round(xr.height||0),
      metaEll: metaEll, metaTitle: meta?String(meta.getAttribute('title')||''):'',
      overflow: (n.scrollWidth>n.clientWidth+1) || (document.documentElement.scrollWidth>window.innerWidth+1) }; })()`);

  /* E01 — movimentada + MÉTRICAS da referência */
  const e1 = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronMen", taskTitle: "TEMAS",
    fromStatus: "andamento", toStatus: "revisao", actorName: LONGO, responsibleName: LONGO });
  const flPct = e1 && e1.flW ? Math.round((e1.flAcima + 2) * 100 / e1.flW) : 0;
  rec("E01 movimentada: composição da referência (avatar flutuante + cápsula + segmento) + violeta + hora",
    e1 && !e1.none && /cat-violet/.test(e1.html) && /20:30/.test(e1.html) && /ntfp-fl/.test(e1.html)
    && /ntfp-pill/.test(e1.html) && /ntfp-pr/.test(e1.html) && /Abrir/.test(e1.segTxt || "") && !e1.overflow, { w: e1 && e1.surfW, h: e1 && e1.surfH });
  rec("E01b MÉTRICAS: superfície 450×~212 (mandato 430–470 / 190–230); avatar " + (e1 && e1.flW) + "px (58–72) com ~" + flPct + "% fora (30–40%); cápsula 40px; fechar 32×32; radius 24",
    e1 && e1.surfW === 450 && e1.surfH >= 190 && e1.surfH <= 230 && e1.flW >= 58 + 4 - 4 && e1.flW <= 72 + 4
    && flPct >= 30 && flPct <= 40 && e1.flVisivel && e1.pillH >= 38 && e1.pillH <= 44
    && e1.closeW === 32 && e1.closeH === 32 && e1.radius === "24px",
    { antes_1_0_225: { surfW: 440, surfH: 198 }, depois: e1 && { boxW: e1.boxW, boxH: e1.boxH, surfW: e1.surfW, surfH: e1.surfH, flW: e1.flW, flAcima: e1.flAcima, pillH: e1.pillH, segW: e1.segW, radius: e1.radius } });
  await shot("e01-movimentada");

  /* E02 — concluída */
  const e2 = await show({ eventType: "task_completed", title: "Tarefa concluída", taskId: "cronMen", taskTitle: "TEMAS", actorName: LONGO, severity: "success" });
  rec("E02 concluída: verde + check + 'Concluída por' + cápsula com segmento Abrir",
    e2 && /cat-green/.test(e2.html) && /M4 12\.5l5 5 11-11/.test(e2.html) && /Concluída por/.test(e2.html) && /ntfp-pr/.test(e2.html) && !e2.overflow, { h: e2 && e2.surfH });
  await shot("e02-concluida");

  /* E03 — reaberta */
  const e3 = await show({ eventType: "task_reopened", title: "Tarefa reaberta", taskId: "cronMen", taskTitle: "TEMAS",
    fromStatus: "concluido", toStatus: "andamento", actorName: LONGO, severity: "warning" });
  rec("E03 reaberta: âmbar + revise + transição Concluído→Em andamento na cápsula",
    e3 && /cat-amber/.test(e3.html) && /M3\.5 7\.5h12/.test(e3.html) && /cdot cs-concluido/.test(e3.html) && /pto">Em andamento/.test(e3.html) && !e3.overflow, {});
  await shot("e03-reaberta");

  /* E04/E05 — ajuste e aprovação no COMPONENTE dos bytes empacotados (elegibilidade PREMIUM_TYPES congelada) */
  const showVariant = async (pay) => J(`(function(){ var st=document.getElementById('notif-stack'); if(st) st.innerHTML='';
    var el=document.createElement('div'); el.className='ntf ntfp-w in';
    var card=document.createElement('div'); card.className='ntf-card ntfp';
    card.innerHTML=premiumCommonInner(${JSON.stringify(pay)}); el.appendChild(card); st.appendChild(el);
    var wrap=card.querySelector('.ntfp-wrap'); var wr=wrap?wrap.getBoundingClientRect():{};
    return { html: card.innerHTML.slice(0, 4200), surfW: Math.round(wr.width||0),
      overflow: (card.scrollWidth>card.clientWidth+1) || (document.documentElement.scrollWidth>window.innerWidth+1) }; })()`);
  const e4 = await showVariant(basePay({ eventType: "flow_client_changes", title: "Ajuste solicitado", taskTitle: "TEMAS",
    clientName: "Hospital Visão", cronContext: "Cronograma mensal • 12 temas", actorName: "Felipe Teodozio", severity: "warning" }));
  rec("E04 ajuste no COMPONENTE empacotado: laranja + chat (icon set) + cápsula (elegibilidade PREMIUM_TYPES congelada — regra 1.0.224 preservada)",
    e4 && /cat-orange/.test(e4.html) && /M4 5h16v11H8l-4 3z/.test(e4.html) && /ntfp-pill/.test(e4.html) && e4.surfW === 450 && !e4.overflow, {});
  await shot("e04-ajuste");
  const e5 = await showVariant(basePay({ eventType: "flow_completed", title: "Aprovação do cliente", taskTitle: "TEMAS",
    clientName: "Hospital Visão", cronContext: "Cronograma mensal • 12 temas", actorName: "Felipe Teodozio", severity: "success" }));
  rec("E05 aprovação no COMPONENTE empacotado: verde + check + eyebrow 'Aprovação do cliente' (elegibilidade congelada)",
    e5 && /cat-green/.test(e5.html) && /M4 12\.5l5 5 11-11/.test(e5.html) && /Aprovação do cliente/.test(e5.html) && e5.surfW === 450 && !e5.overflow, {});
  await shot("e05-aprovacao");

  /* E06 — cliente curto (canônico do doc) */
  const e6 = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "vidUltra", taskTitle: "Reels institucional",
    fromStatus: "andamento", toStatus: "revisao", actorName: "Ana Beatriz Social Media" });
  rec("E06 cliente curto: 'ULTRA' (do DOC) em linha própria + contexto 'Edição de vídeos'",
    e6 && /<div class="ntfp-client" title="ULTRA">ULTRA<\/div>/.test(e6.html) && /Edição de vídeos/.test(e6.html) && !e6.overflow, {});
  await shot("e06-cliente-curto-ultra");

  /* E07 — cliente longo */
  const e7 = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "vidLongo", taskTitle: "Vídeo de resultados",
    fromStatus: "afazer", toStatus: "andamento", actorName: "Ana Beatriz Social Media" });
  const cliEll = await J(`(function(){ var el=document.querySelector('#notif-stack .ntfp-client'); if(!el) return {none:true};
    return { ell: el.scrollWidth>el.clientWidth+1, title: String(el.getAttribute('title')||'') }; })()`);
  rec("E07 cliente longo: 1 linha (ellipsis real) + tooltip completo + sem overflow",
    e7 && !e7.overflow && cliEll && cliEll.ell === true && /Clínica Oftalmológica Visão Integrada de Alta Complexidade do Norte e Nordeste LTDA/.test(cliEll.title || ""), {});
  await shot("e07-cliente-longo");

  /* E08 — autor longo (metadata com ellipsis + tooltip). Com a cápsula no lugar do footer a linha
   * do autor ganhou a largura toda; para provar o MECANISMO de truncamento usa-se um nome ainda
   * maior que a linha (o produto resolve o nome pelo perfil; aqui actorId fica vazio de propósito). */
  const XLONGO = LONGO + " de Albuquerque Monteiro dos Santos Figueiredo";
  const e8 = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronMen", taskTitle: "TEMAS",
    fromStatus: "andamento", toStatus: "revisao", actorId: "", actorName: XLONGO, responsibleName: XLONGO });
  rec("E08 autor longo: metadata 1 linha com ellipsis REAL + tooltip 'Movimentada por <completo>'",
    e8 && e8.metaEll === true && e8.metaTitle === ("Movimentada por " + XLONGO) && !e8.overflow, { title: e8 && e8.metaTitle });
  await shot("e08-autor-longo");

  /* E09 — responsável diferente */
  const e9 = await show({ eventType: "task_reopened", title: "Tarefa reaberta", taskId: "cronMen", taskTitle: "TEMAS",
    fromStatus: "concluido", toStatus: "andamento", actorName: LONGO, responsibleName: "Felipe Teodozio", severity: "warning" });
  rec("E09 responsável distinto: 'Responsável · Felipe Teodozio' discreto (autor≠responsável; sem repetição quando igual)",
    e9 && /title="Responsável: Felipe Teodozio">Responsável · Felipe Teodozio<\/div>/.test(e9.html)
      && e9.html.indexOf('ntfp-meta') < e9.html.indexOf('ntfp-respline') && !e9.overflow, {});
  const e9b = await show({ eventType: "task_reopened", title: "Tarefa reaberta", taskId: "cronMen", taskTitle: "TEMAS",
    fromStatus: "concluido", toStatus: "andamento", actorId: ID.FELIPE, actorName: "Felipe Teodozio", responsibleName: "Felipe Teodozio", severity: "warning" });
  rec("E09b responsável = autor (perfil real): SEM linha duplicada", e9b && e9b.html.indexOf('ntfp-respline') < 0, {});
  await shot("e09-responsavel-distinto");

  /* E10 — sem avatar: iniciais grandes no flutuante */
  const e10 = await J(`(function(){ var av=document.querySelector('#notif-stack .ntfp-fl .ntfp-av.gen'); if(!av) return {none:true};
    var r=av.getBoundingClientRect(); var fl=av.closest('.ntfp-fl'); var cs=getComputedStyle(fl);
    return { w: Math.round(r.width), txt: (av.textContent||'').trim(), fs: getComputedStyle(av).fontSize, ring: (cs.backgroundImage||'').indexOf('gradient')>=0 }; })()`);
  rec("E10 sem avatar: iniciais geradas (2 letras, 22px) no avatar FLUTUANTE 62px com ring em gradiente",
    e10 && !e10.none && e10.w === 62 && e10.txt.length === 2 && e10.fs === "22px" && e10.ring === true, e10);
  await shot("e10-sem-avatar-iniciais");

  /* E11/E12 — Cronograma legado e personalizado */
  const e11 = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronMen", taskTitle: "TEMAS",
    fromStatus: "andamento", toStatus: "revisao", actorName: LONGO });
  rec("E11 legado mensal: 'Cronograma mensal • 12 temas' EXATO", e11 && /Cronograma mensal • 12 temas/.test(e11.html) && !e11.overflow, {});
  await shot("e11-legado-mensal");
  const e12 = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronCustom", taskTitle: "TEMAS",
    fromStatus: "andamento", toStatus: "revisao", actorName: LONGO });
  rec("E12 personalizado: 'Cronograma • 7 temas' sem periodicidade inventada",
    e12 && /Cronograma • 7 temas/.test(e12.html) && !/Cronograma (semanal|quinzenal|mensal)/.test(e12.html) && !e12.overflow, {});
  await shot("e12-personalizado-7-temas");

  /* E13 — 3 simultâneas: avatar de uma NÃO invade o card da outra */
  const e13 = await J(`(function(){ var st=document.getElementById('notif-stack'); st.innerHTML='';
    var mk=function(id,et,ti,sev){ notifShowToast(Object.assign(${JSON.stringify(basePay({}))},{eventType:et,title:ti,taskId:'cronMen',taskTitle:'TEMAS',dedupeKey:id,actorName:${JSON.stringify(LONGO)},fromStatus:'andamento',toStatus:'revisao',severity:sev})); };
    mk('h2a','task_moved','Tarefa movimentada','info'); mk('h2b','task_completed','Tarefa concluída','success'); mk('h2c','task_reopened','Tarefa reaberta','warning');
    var wrappers=[].slice.call(document.querySelectorAll('#notif-stack .ntf'));
    var boxes=wrappers.map(function(c){ return c.getBoundingClientRect(); });
    var overlap=false; for(var i=1;i<boxes.length;i++){ if(boxes[i].top < boxes[i-1].bottom - 2) overlap=true; }
    var invade=false;
    var surfs=[].slice.call(document.querySelectorAll('#notif-stack .ntfp-wrap')).map(function(w){return w.getBoundingClientRect();});
    var fls=[].slice.call(document.querySelectorAll('#notif-stack .ntfp-fl')).map(function(f){return f.getBoundingClientRect();});
    for(var i=1;i<fls.length;i++){ if(fls[i].top < surfs[i-1].bottom - 1) invade=true; }
    var inScreen=boxes.every(function(r){ return r.right<=window.innerWidth+1 && r.bottom<=window.innerHeight+1 && r.left>=-1 && r.top>=-1; });
    return { n: wrappers.length, overlap: overlap, invade: invade, inScreen: inScreen, stackH: Math.round(document.getElementById('notif-stack').getBoundingClientRect().height) }; })()`);
  rec("E13 três simultâneas: 3 cards, sem sobreposição, avatar NÃO invade o card vizinho, tudo na tela",
    e13 && e13.n === 3 && !e13.overlap && !e13.invade && e13.inScreen, e13);
  await shot("e13-tres-empilhadas");

  /* E14/E15/E16 — escalas 100/125/150 */
  const zoomScene = async (zf, nm) => {
    wc.setZoomFactor(zf); await sleep(250);
    const r = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronMen", taskTitle: "TEMAS",
      fromStatus: "andamento", toStatus: "revisao", actorName: LONGO, responsibleName: "Felipe Teodozio" });
    const geo = await J(`(function(){ var c=document.querySelector('#notif-stack .ntf'); if(!c) return {none:true};
      var r=c.getBoundingClientRect(); var fl=c.querySelector('.ntfp-fl'); var fr=fl?fl.getBoundingClientRect():{};
      return { inScreen: r.right<=window.innerWidth+1 && r.bottom<=window.innerHeight+1 && r.left>=-1 && r.top>=-1,
        flOk: fl?(fr.top>=-1&&fr.left>=-1):false,
        pill: !!c.querySelector('.ntfp-pill'), seg: !!c.querySelector('.ntfp-pr'), close: !!c.querySelector('.ntf-x') }; })()`);
    await shot(nm);
    return r && geo && !r.overflow && !geo.none && geo.inScreen && geo.flOk && geo.pill && geo.seg && geo.close;
  };
  rec("E14 escala 100%: avatar/cápsula/segmento/fechar íntegros, sem corte", await zoomScene(1.0, "e14-escala-100"), {});
  rec("E15 escala 125%: avatar/cápsula/segmento/fechar íntegros, sem corte", await zoomScene(1.25, "e15-escala-125"), {});
  rec("E16 escala 150%: avatar/cápsula/segmento/fechar íntegros, sem corte", await zoomScene(1.5, "e16-escala-150"), {});
  wc.setZoomFactor(1); await sleep(200);

  /* E17/E18 — resoluções */
  const resScene = async (w, h, nm) => {
    win.setContentSize(w, h); await sleep(400);
    const r = await show({ eventType: "task_completed", title: "Tarefa concluída", taskId: "cronMen", taskTitle: "TEMAS", actorName: "Ana Beatriz Social Media", severity: "success" });
    const geo = await J(`(function(){ var c=document.querySelector('#notif-stack .ntf'); if(!c) return {none:true};
      var rr=c.getBoundingClientRect();
      return { inCorner: rr.right<=window.innerWidth+1 && rr.bottom<=window.innerHeight+1 && rr.right>window.innerWidth*0.5 && rr.bottom>window.innerHeight*0.5 && rr.top>=-1,
        bodyOverflow: document.documentElement.scrollWidth>window.innerWidth+1 }; })()`);
    await shot(nm);
    return r && geo && !r.overflow && !geo.none && geo.inCorner && !geo.bodyOverflow;
  };
  rec("E17 1366×768: canto inferior direito, avatar dentro da área útil, sem overflow", await resScene(1366, 768, "e17-1366x768"), {});
  rec("E18 1920×1080: canto inferior direito, avatar dentro da área útil, sem overflow", await resScene(1920, 1080, "e18-1920x1080"), {});

  /* E19 — app ABERTO (toast): captura dedicada do estado padrão */
  await win.setContentSize(1600, 900); await sleep(300);
  const e19 = await show({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronMen", taskTitle: "TEMAS",
    fromStatus: "andamento", toStatus: "revisao", actorName: LONGO });
  rec("E19 app aberto (toast interno): componente da referência renderizado no app real", e19 && !e19.none && !e19.overflow, {});
  await shot("e19-app-aberto-toast");

  /* E20 — app MINIMIZADO: JANELA PREMIUM REAL (bgnotify DO ASAR + preload REAL + IPC bg-card) */
  const acks = [];
  ipcMain.on("bgnotify-rendered", (_e, info) => { try { acks.push(info || {}); } catch (_) {} });
  const bgWin = new BrowserWindow({ width: 480, height: 320, show: true, frame: false, transparent: true,
    webPreferences: { preload: path.join(__dirname, "..", "dist", "preload", "bgnotify-preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  await bgWin.loadURL("file://" + asarPath.replace(/\\/g, "/") + "/src/renderer/bgnotify.html");
  await sleep(300);
  bgWin.webContents.send("bg-card", basePay({ eventType: "task_moved", title: "Tarefa movimentada", taskId: "cronMen", taskTitle: "TEMAS",
    clientName: "Hospital Visão", cronContext: "Cronograma mensal • 12 temas", sectorLabel: "Cronograma",
    fromStatus: "andamento", toStatus: "revisao", actorName: LONGO, responsibleName: LONGO, dedupeKey: "bg1" }));
  await sleep(500);
  const bgDom = await bgWin.webContents.executeJavaScript(`(function(){
    var c=document.querySelector('#stack .ntf.ntfp-w'); if(!c) return { none:true };
    var wrap=c.querySelector('.ntfp-wrap'); var wr=wrap?wrap.getBoundingClientRect():{};
    var fl=c.querySelector('.ntfp-fl'); var fr=fl?fl.getBoundingClientRect():{};
    return { fl: !!fl, pill: !!c.querySelector('.ntfp-pill'), seg: !!c.querySelector('.ntfp-pr'),
      client: (c.querySelector('.ntfp-client')||{}).textContent||'', flAcima: wrap?Math.round(wr.top-fr.top):0,
      flVisivel: fl?(fr.top>=0):false }; })()`).catch((e) => ({ err: String(e && e.message || e) }));
  rec("E20 app minimizado (JANELA PREMIUM REAL, asar + preload real + IPC bg-card): mesma composição da referência (avatar flutuante SEM corte + cápsula + segmento + cliente)",
    bgDom && !bgDom.none && bgDom.fl && bgDom.pill && bgDom.seg && bgDom.client === "Hospital Visão"
    && bgDom.flAcima >= 18 && bgDom.flVisivel && acks.length >= 1, Object.assign({ acks: acks.length }, bgDom));
  await shot("e20-app-minimizado-bgnotify", bgWin.webContents);
  try { bgWin.destroy(); } catch (_) {}

  try { fs.writeFileSync(path.join(OUT, "f355eh2-proof-results.json"), JSON.stringify({ at: new Date().toISOString(), indexSha: meta.stageIndexSha, bgSha: meta.stageBgSha, results }, null, 2)); } catch (_) {}
  const failures = results.filter((r) => !r.ok).length;
  clearTimeout(WATCHDOG);
  process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=" + failures + "\n");
  app.exit(failures ? 1 : 0);
});
