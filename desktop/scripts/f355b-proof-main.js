/* F3.5.5B — PROVAS REAIS (Electron 31.3.1; app EMPACOTADO em app.asar; xvfb).
 * Empacota o renderer REAL (src/renderer/index.html + priorityEngine.js) em app.asar com
 * @electron/asar, carrega DO ASAR numa BrowserWindow real com o preload de semente
 * (f355b-proof-preload.js) e exercita o CÓDIGO DE PRODUÇÃO da Agenda: renderHoje,
 * renderAgenda, eventCard, openEventDetail, menu ⋯, confirmação EXCLUIR, Esc/foco.
 * Cliques via MouseEvent bubbles (handler DELEGADO real). Para cada cena: medição do DOM
 * REAL + PNG (win.capturePage). Sem IA, sem mockup, sem HTML isolado.
 * P1 data visível em TODOS os cards   P2 agendado   P3 em andamento   P4 finalizado
 * P5 cancelado (+atrasado na lista)   P6 título longo (clamp 2 linhas)   P7 local longo
 * P8 sem término / sem responsável    P9 modal agendado premium (teclado/Esc/foco/trap)
 * P10 modal em andamento              P11 modal finalizado           P12 data completa pt-BR
 * P13 ações reorganizadas (menu ⋯)    P14 exclusão em posição segura (EXCLUIR)
 * P15 escala 125%   P16 escala 150%   P17 1366×768   P18 1920×1080
 * P19 vários compromissos             P20 dashboard sem regressão visual */
const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f355b-qa");
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }
// original-fs: o fs PATCHADO do Electron trata caminho .asar como diretório virtual — para
// hashear o ARQUIVO do asar é obrigatório o fs original (lição fixada no harness F3.5.5A-H1).
const ofs = require("original-fs");
const sha256 = (p) => crypto.createHash("sha256").update(ofs.readFileSync(p)).digest("hex");
process.on("uncaughtException", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=uncaught:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });
process.on("unhandledRejection", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=unhandled:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });

/* ---- SEMENTE (datas relativas ao dia REAL para os filtros de Hoje/Próximos) ---- */
const NOW = Date.now();
const ID = { ANA: "u-soc-ana", MARINA: "u-adm-marina", DIEGO: "u-des-diego" };
const T0 = new Date();
const dstr = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const plus = (n) => dstr(new Date(T0.getFullYear(), T0.getMonth(), T0.getDate() + n));
const TODAY = plus(0), YEST = plus(-1);
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOWFULL = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
function expFull(date) { const [y, m, d] = date.split("-").map(Number); return d + " de " + MONTHS[m - 1].toLowerCase() + " de " + y; }
function expDow(date) { const [y, m, d] = date.split("-").map(Number); return DOWFULL[new Date(y, m - 1, d).getDay()]; }
const LONG_TITLE = "Alinhamento estratégico do cronograma mensal de conteúdo com revisão completa de pauta e prioridades do trimestre — revisão executiva com todas as áreas de criação, tráfego e atendimento, incluindo o alinhamento fino do calendário de campanhas";
const LONG_LOC = "Av. Paulista, 1578 — Bela Vista, São Paulo/SP — Torre Norte, 14º andar, sala 1402 (entrada pela recepção B) — próximo à estação Trianon-Masp, estacionamento conveniado no subsolo com acesso direto aos elevadores";
const seed = (() => {
  const self = { id: ID.ANA, name: "Ana Beatriz Social Media", role: "Social Media", admin: false, status: "ativo" };
  const users = [self,
    { id: ID.MARINA, name: "Marina Administradora", role: "Administrador", admin: true, status: "ativo" },
    { id: ID.DIEGO, name: "Diego Fernandes Designer", role: "Designer", status: "ativo" }];
  const ev = (x) => Object.assign({ by: ID.ANA, done: false, createdAt: NOW, src: "webpreview", client: "", location: "", notes: "", owner: "", ownerId: null, start: "", end: "" }, x);
  const events = [
    ev({ id: "evb-sched", type: "gravacao", date: TODAY, start: "14:00", end: "16:00", title: "Gravação de conteúdo",
      client: "Dra. Daniella Félix", location: "Estúdio ID Seven — Sala 2", owner: "Ana Beatriz Social Media", ownerId: ID.ANA, by: ID.MARINA,
      notes: "Trazer figurino branco.\n\nCheck-list de equipamentos revisado com a equipe." }),
    ev({ id: "evb-prog", type: "edicao", date: TODAY, start: "09:00", end: "18:30", title: LONG_TITLE,
      client: "Miercohévisk Niheb Ferreira Nascimento Carlôto", owner: "Diego Fernandes Designer", ownerId: ID.DIEGO, startedAt: NOW - 3600000, startedBy: ID.DIEGO }),
    ev({ id: "evb-noend", type: "foto", date: plus(3), start: "10:00", end: "", title: "Ensaio fotográfico institucional",
      client: "Hospital Visão", location: LONG_LOC, owner: "Marina Administradora", ownerId: ID.MARINA }),
    ev({ id: "evb-noowner", type: "reuniao", date: plus(10), start: "15:30", end: "16:00", title: "Reunião de pauta" }),
    ev({ id: "evb-done", type: "reuniao", date: TODAY, start: "08:00", end: "08:45", title: "Daily da equipe",
      owner: "Ana Beatriz Social Media", ownerId: ID.ANA, done: true, doneAt: NOW - 7200000, doneBy: ID.ANA }),
    ev({ id: "evb-canc", type: "outro", date: TODAY, start: "11:00", end: "12:00", title: "Visita cancelada ao cliente",
      client: "Ótica Clara", owner: "Ana Beatriz Social Media", ownerId: ID.ANA, status: "cancelled", cancelledAt: NOW - 1800000, cancelledBy: ID.MARINA }),
    ev({ id: "evb-late", type: "reuniao", date: YEST, start: "10:00", end: "11:00", title: "Alinhamento atrasado",
      owner: "Diego Fernandes Designer", ownerId: ID.DIEGO }),
    ev({ id: "evb-nextyear", type: "outro", date: plus(400), start: "08:00", end: "09:15", title: "Planejamento anual",
      owner: "Ana Beatriz Social Media", ownerId: ID.ANA }),
    ev({ id: "evb-f1", type: "reuniao", date: plus(4), start: "09:30", end: "10:00", title: "Reunião com cliente A", client: "Cliente A", owner: "Ana Beatriz Social Media", ownerId: ID.ANA }),
    ev({ id: "evb-f2", type: "gravacao", date: plus(5), start: "13:00", end: "17:00", title: "Gravação campanha B", client: "Cliente B", owner: "Diego Fernandes Designer", ownerId: ID.DIEGO }),
    ev({ id: "evb-f3", type: "edicao", date: plus(6), start: "10:00", end: "12:00", title: "Edição pacote C", owner: "Diego Fernandes Designer", ownerId: ID.DIEGO }),
    ev({ id: "evb-f4", type: "foto", date: plus(7), start: "16:00", end: "18:00", title: "Ensaio D", client: "Cliente D", owner: "Marina Administradora", ownerId: ID.MARINA }),
  ];
  const tk = (x) => Object.assign({ by: ID.ANA, createdAt: NOW, history: [], checklist: [] }, x);
  const tasks = [
    tk({ id: "tk1", sector: "cronograma", status: "afazer", title: "Cronograma Agosto", client: "Clínica Aurora", dueDate: plus(1), dueTime: "18:00", cronContents: [{ tema: "Tema A", legenda: "x" }] }),
    tk({ id: "tk2", sector: "roteiro", status: "andamento", title: "Roteiros institucionais", client: "Marca Nova", dueDate: TODAY, dueTime: "23:59", cronContents: [{ tema: "R1", legenda: "y" }] }),
  ];
  return { self, users, tasks, events };
})();

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();

let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f355b-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f355b-app.asar");
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
  fs.writeFileSync(path.join(os.tmpdir(), "f355b-seed.json"), JSON.stringify(seed));

  const win = new BrowserWindow({ width: 1440, height: 940, show: true, webPreferences: {
    preload: path.join(__dirname, "f355b-proof-preload.js"),
    contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  const wc = win.webContents;
  const J = (code) => wc.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));
  async function shot(nm) { try {
    await sleep(150); // garante o repaint do frame após innerHTML (captura fiel à cena medida)
    const img = await Promise.race([win.capturePage(), new Promise((_, rej) => setTimeout(() => rej(new Error("capture_timeout")), 8000))]);
    const p = path.join(OUT, nm + ".png"); fs.writeFileSync(p, img.toPNG()); return path.basename(p);
  } catch (e) { return "pngErr:" + String((e && e.message) || e); } }

  let fatal = null;
  try {
    await win.loadFile(path.join(asarPath, "src", "renderer", "index.html"));
    let boot = null;
    for (let i = 0; i < 60; i++) { await sleep(200);
      boot = await J(`({authed:document.body.classList.contains('authed'),events:(typeof state!=='undefined'&&state.events||[]).length,users:(typeof state!=='undefined'&&state.users||[]).length})`);
      if (boot && boot.authed && boot.events >= 12) break; }
    line({ boot });
    if (!boot || !boot.authed || boot.events < 12) fatal = "boot-failed: " + JSON.stringify(boot);

    if (!fatal) {
      await J(`window.__B=(function(){
        function q(s,r){return (r||document).querySelector(s);} function qa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
        function click(el){ if(!el) return false; el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true; }
        function setUser(id){ state.user = state.users.find(function(u){return u.id===id;}); }
        function hoje(){ try{closeModal();}catch(_){} state.tab='hoje'; render(); }
        function agMonth(sel){ try{closeModal();}catch(_){} state.tab='agenda'; agView='month'; agSel=sel; render(); }
        function agList(){ try{closeModal();}catch(_){} state.tab='agenda'; agView='list'; render(); }
        function card(id){ return q('.evc[data-evdetail="'+id+'"]'); }
        function open(id){ try{closeModal();}catch(_){} openEventDetail(id); }
        function modal(){ return q('.modal-back[data-evdmodal]'); }
        function mtxt(){ var b=modal(); return b?(b.innerText||b.textContent||''):''; }
        function btn(s){ return q('.modal-back[data-evdmodal] '+s); }
        function kesc(){ document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); }
        function kkey(el,k){ (el||document).dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true})); }
        function noH(){ return document.documentElement.scrollWidth<=document.documentElement.clientWidth+2; }
        function cardInfo(el){ if(!el) return null; var d=q('.evc2-date',el);
          return { hasDate:!!d, dd:d?(q('.evc2-dd',el)||{}).textContent:'', dw:d?(q('.evc2-dw',el)||{}).textContent:'', dm:d?(q('.evc2-dm',el)||{}).textContent:'',
            dy:(q('.evc2-dy',el)||{}).textContent||'', st:(q('.evc2-st',el)||{}).textContent||'', time:(q('.evc2-time',el)||{}).textContent||'',
            name:(q('.evc2-name',el)||{}).textContent||'', ty:(q('.evc2-ty',el)||{}).textContent||'', rail:(q('.evc2-rail',el)||{getAttribute:function(){return ''}}).getAttribute('style')||'',
            ow:el.scrollWidth<=el.clientWidth+2 }; }
        return { q:q, qa:qa, click:click, setUser:setUser, hoje:hoje, agMonth:agMonth, agList:agList, card:card, open:open, modal:modal, mtxt:mtxt, btn:btn, kesc:kesc, kkey:kkey, noH:noH, cardInfo:cardInfo };
      })(); true`);

      /* P1 — HOJE: data visível em TODOS os cards (bloco DOM/dia/mês) */
      let m = await J(`(function(){ var B=window.__B; B.hoje();
        var cards=B.qa('.evc'); var infos=cards.map(B.cardInfo);
        var today=${JSON.stringify(TODAY)}.split('-');
        return { count:cards.length, allDate:infos.every(function(i){return i.hasDate&&i.dd&&i.dw&&i.dm;}),
          todayDd:infos.length?infos[0].dd:'', expDd:String(Number(today[2])),
          firstTime:(infos[0]||{}).time, sched:!!B.card('evb-sched'), prog:!!B.card('evb-prog'),
          futureCount:B.qa('.col-future .evc').length, noH:B.noH() }; })()`);
      await sleep(150); let png = await shot("f355b-P01-hoje-datas");
      rec("P1 data SEMPRE visível: todo card do Hoje tem bloco DOM/dia/mês; sem rolagem horizontal",
        m && !m.err && m.count >= 2 && m.allDate && m.todayDd === m.expDd && m.sched && m.prog && m.noH, Object.assign(m || {}, { png }));

      /* P2 — card AGENDADO: chip Agendado + horário 14:00 — 16:00 + cliente/local/responsável/tipo */
      m = await J(`(function(){ var B=window.__B; var c=B.card('evb-sched'); var i=B.cardInfo(c);
        var metas=B.qa('.evc2-meta span',c).map(function(s){return s.textContent;});
        return Object.assign(i,{metas:metas, hasClient:metas.indexOf('Dra. Daniella Félix')>=0,
          hasLoc:metas.some(function(t){return t.indexOf('Estúdio ID Seven')>=0;}),
          roleBtn:c.getAttribute('role')==='button'&&c.getAttribute('tabindex')==='0',
          aria:(c.getAttribute('aria-label')||'').indexOf('Gravação de conteúdo')>=0}); })()`);
      png = await shot("f355b-P02-agendado");
      rec("P2 agendado: chip 'Agendado', 14:00 — 16:00, cliente, local, responsável 1×, tipo, role/aria",
        m && !m.err && m.st.indexOf("Agendado") >= 0 && /14:00/.test(m.time) && /16:00/.test(m.time) && m.hasClient && m.hasLoc && m.name === "Ana Beatriz Social Media" && m.ty.indexOf("Gravação") >= 0 && m.roleBtn && m.aria, Object.assign(m || {}, { png }));

      /* P3 — card EM ANDAMENTO */
      m = await J(`(function(){ var B=window.__B; var i=B.cardInfo(B.card('evb-prog')); return i; })()`);
      png = await shot("f355b-P03-andamento");
      rec("P3 em andamento: chip 'Em andamento' no card de hoje", m && !m.err && m.st.indexOf("Em andamento") >= 0 && /09:00/.test(m.time), Object.assign(m || {}, { png }));

      /* P4 — card FINALIZADO (Agenda → dia de hoje; Hoje oculta concluídos por regra preservada) */
      m = await J(`(function(){ var B=window.__B; B.agMonth(${JSON.stringify(TODAY)});
        var c=B.card('evb-done'); var i=B.cardInfo(c);
        return Object.assign(i||{},{found:!!c, notInHojeRule:true}); })()`);
      png = await shot("f355b-P04-finalizado");
      rec("P4 finalizado: chip 'Finalizado' na Agenda (dia atual)", m && !m.err && m.found && m.st.indexOf("Finalizado") >= 0, Object.assign(m || {}, { png }));

      /* P5 — card CANCELADO (toggle Mostrar cancelados) + ATRASADO com trilho vermelho (lista) */
      m = await J(`(function(){ var B=window.__B; agShowCancelled=true; B.agList();
        var c=B.card('evb-canc'); var i=B.cardInfo(c);
        var late=B.cardInfo(B.card('evb-late'));
        var r={found:!!c, st:(i||{}).st||'', lateRail:(late||{}).rail||'', lateFound:!!late};
        agShowCancelled=false; return r; })()`);
      png = await shot("f355b-P05-cancelado-atrasado");
      rec("P5 cancelado: chip 'Cancelado' visível via toggle; atrasado com trilho vermelho (#F87171)",
        m && !m.err && m.found && m.st.indexOf("Cancelado") >= 0 && m.lateFound && /F87171/i.test(m.lateRail), Object.assign(m || {}, { png }));

      /* P6 — TÍTULO LONGO: clamp de 2 linhas sem estourar o card. Medição robusta: levanta o
         clamp temporariamente para medir a altura NECESSÁRIA do texto completo (o -webkit-box
         clampado pode reportar scrollHeight igual ao clientHeight) e restaura. */
      m = await J(`(function(){ var B=window.__B; B.hoje();
        var c=B.card('evb-prog'); if(!c) return {miss:'card',tab:state.tab};
        var ti=B.q('.evc2-ti',c); var cs=getComputedStyle(ti);
        var lh=parseFloat(cs.lineHeight)||18;
        var clampedH=ti.clientHeight;
        var prev=ti.getAttribute('style')||'';
        ti.style.webkitLineClamp='999'; ti.style.maxHeight='none';
        var fullH=ti.scrollHeight;
        if(prev)ti.setAttribute('style',prev); else ti.removeAttribute('style');
        return { tab:state.tab, cw:ti.clientWidth, clampCss:cs.webkitLineClamp, clampedH:clampedH, fullH:fullH, lh:lh,
          needsClamp:fullH>clampedH+2, maxTwo:clampedH<=lh*2+4,
          cardNoOverflow:c.scrollWidth<=c.clientWidth+2, noH:B.noH() }; })()`);
      png = await shot("f355b-P06-titulo-longo");
      rec("P6 título longo: CSS clampa em 2 linhas (texto completo exigiria mais) e nada sai do card",
        m && !m.err && !m.miss && m.tab === "hoje" && m.clampCss === "2" && m.needsClamp && m.maxTwo && m.cardNoOverflow && m.noH, Object.assign(m || {}, { png }));

      /* P7 — LOCAL LONGO: 1 linha com ellipsis na meta (rects===1 prova a linha única) */
      m = await J(`(function(){ var B=window.__B;
        var c=B.card('evb-noend'); if(!c){ return {miss:'card',tab:state.tab}; }
        var spans=B.qa('.evc2-meta span',c); var loc=spans.filter(function(s){return s.textContent.indexOf('Av. Paulista')>=0;})[0];
        if(!loc) return {miss:'loc'};
        var cs=getComputedStyle(loc);
        return { tab:state.tab, disp:cs.display, cw:loc.clientWidth, sw:loc.scrollWidth, rects:loc.getClientRects().length,
          ell:cs.textOverflow==='ellipsis'&&cs.whiteSpace==='nowrap', truncated:loc.scrollWidth>loc.clientWidth+1,
          oneLine:loc.getClientRects().length===1, cardNoOverflow:c.scrollWidth<=c.clientWidth+2 }; })()`);
      png = await shot("f355b-P07-local-longo");
      rec("P7 local longo: 1 linha (rects=1) com ellipsis ativo e texto truncado; card íntegro",
        m && !m.err && !m.miss && m.ell && m.truncated && m.oneLine && m.cardNoOverflow, Object.assign(m || {}, { png }));

      /* P8 — SEM TÉRMINO (só início, sem 00:00) e SEM RESPONSÁVEL (trilho neutro, rodapé limpo).
         O card sem responsável (+10d) fica fora do top-5 do Hoje — inspecionado na LISTA da Agenda. */
      m = await J(`(function(){ var B=window.__B;
        var a=B.cardInfo(B.card('evb-noend'));
        B.agList();
        var b=B.cardInfo(B.card('evb-noowner'));
        var r={ aTime:(a||{}).time, aNoDash:((a||{}).time||'').indexOf('—')<0, bFound:!!b, bName:(b||{}).name||'', bRail:(b||{}).rail||'' };
        B.hoje(); return r; })()`);
      png = await shot("f355b-P08-sem-termino-sem-resp");
      rec("P8 sem término: só '10:00' (sem — e sem 00:00 inventado); sem responsável: rodapé sem nome e trilho neutro",
        m && !m.err && /10:00/.test(m.aTime) && m.aNoDash && m.aTime.indexOf("00:00") < 0 && m.bFound && m.bName === "" && /var\(--line\)/.test(m.bRail), Object.assign(m || {}, { png }));

      /* P9 — MODAL AGENDADO premium: abrir por TECLADO, data por extenso, duração, X, Esc, foco, trap */
      m = await J(`(async function(){ var B=window.__B; B.hoje();
        var c=B.card('evb-sched'); c.focus(); B.kkey(c,'Enter'); await new Promise(function(r){setTimeout(r,120);});
        var r={opened:!!B.modal()};
        r.xFocused=document.activeElement===B.btn('.evd-x');
        r.dow=(B.btn('.evd-dow')||{}).textContent||''; r.dfull=(B.btn('.evd-dfull')||{}).textContent||'';
        r.time=(B.btn('.evd-time')||{}).textContent||''; r.dur=(B.btn('.evd-dur')||{}).textContent||'';
        r.noRaw=B.mtxt().indexOf(${JSON.stringify(TODAY)})<0;
        r.client=B.mtxt().indexOf('Dra. Daniella Félix')>=0;
        r.notesPre=!!B.btn('.evd-notes')&&getComputedStyle(B.btn('.evd-notes')).whiteSpace==='pre-wrap';
        r.cells=B.qa('.evd-cell').length;
        var f=B.qa('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])',B.modal()).filter(function(el){return el.offsetParent!==null;});
        if(f.length){ f[f.length-1].focus(); B.kkey(document.activeElement,'Tab'); }
        r.trapWrapped=document.activeElement===f[0];
        B.kesc(); await new Promise(function(r2){setTimeout(r2,80);});
        r.closedByEsc=!B.modal();
        r.focusBackOnCard=document.activeElement===B.card('evb-sched');
        return r; })()`);
      png = await shot("f355b-P09-modal-agendado");
      rec("P9 modal agendado: Enter abre; foco no X; DOW+data por extenso; 14:00—16:00; 'Duração: 2 horas'; sem data bruta; observações pre-wrap; trap de Tab; Esc fecha; foco volta ao card",
        m && !m.err && m.opened && m.xFocused && m.dow === expDow(TODAY) && m.dfull === expFull(TODAY) && /14:00/.test(m.time) && /16:00/.test(m.time) && m.dur === "Duração: 2 horas" && m.noRaw && m.client && m.notesPre && m.cells >= 4 && m.trapWrapped && m.closedByEsc && m.focusBackOnCard, Object.assign(m || {}, { png }));

      /* P10 — MODAL EM ANDAMENTO: primária = Finalizar */
      m = await J(`(function(){ var B=window.__B; B.open('evb-prog');
        var pri=B.btn('.evd-btn.pri');
        return { opened:!!B.modal(), priTxt:pri?pri.textContent.trim():'', priAttr:pri?pri.getAttribute('data-evfinish'):null,
          hasCancel:!!B.btn('[data-evcancel]'), hasEdit:!!B.btn('[data-evedit]'), noStart:!B.btn('[data-evstart]'),
          tl:B.mtxt().indexOf('Iniciado ·')>=0 }; })()`);
      png = await shot("f355b-P10-modal-andamento");
      rec("P10 modal em andamento: Finalizar primária (data-evfinish), Cancelar/Editar presentes, sem Iniciar, linha do tempo",
        m && !m.err && m.opened && m.priTxt === "Finalizar" && m.priAttr === "evb-prog" && m.hasCancel && m.hasEdit && m.noStart && m.tl, Object.assign(m || {}, { png }));

      /* P11 — MODAL FINALIZADO: sem primária; Fechar discreto; Editar preservado */
      m = await J(`(function(){ var B=window.__B; B.open('evb-done');
        return { opened:!!B.modal(), noPri:!B.btn('.evd-btn.pri'), hasClose:!!B.btn('.evd-btn.sec.push[data-modalclose]'),
          hasEdit:!!B.btn('[data-evedit]'), noCancel:!B.btn('[data-evcancel]'), noStart:!B.btn('[data-evstart]'),
          tlDone:B.mtxt().indexOf('Finalizado ·')>=0, stChip:B.mtxt().indexOf('Finalizado')>=0 }; })()`);
      png = await shot("f355b-P11-modal-finalizado");
      rec("P11 modal finalizado: sem ação primária; Fechar discreto; Editar sim; Cancelar/Iniciar não; linha do tempo",
        m && !m.err && m.opened && m.noPri && m.hasClose && m.hasEdit && m.noCancel && m.noStart && m.tlDone, Object.assign(m || {}, { png }));

      /* P12 — DATA COMPLETA pt-BR (data futura fixa: dia da semana + '10 de agosto de 2026'-style) */
      m = await J(`(function(){ var B=window.__B; B.open('evb-noowner');
        return { dow:(B.btn('.evd-dow')||{}).textContent||'', dfull:(B.btn('.evd-dfull')||{}).textContent||'',
          time:(B.btn('.evd-time')||{}).textContent||'', dur:(B.btn('.evd-dur')||{}).textContent||'',
          noRaw:B.mtxt().indexOf(${JSON.stringify(plus(10))})<0 }; })()`);
      png = await shot("f355b-P12-data-extenso");
      rec("P12 data completa pt-BR no modal: '" + expDow(plus(10)) + "' + '" + expFull(plus(10)) + "'; 15:30—16:00; 'Duração: 30 minutos'; nunca " + plus(10),
        m && !m.err && m.dow === expDow(plus(10)) && m.dfull === expFull(plus(10)) && /15:30/.test(m.time) && /16:00/.test(m.time) && m.dur === "Duração: 30 minutos" && m.noRaw, Object.assign(m || {}, { png }));

      /* P13 — AÇÕES REORGANIZADAS (Admin): 1 primária; menu ⋯ com Finalizar+Excluir; Esc fecha o menu */
      m = await J(`(async function(){ var B=window.__B; B.setUser('${ID.MARINA}'); B.open('evb-sched');
        var r={priCount:B.qa('.evd-btn.pri',B.modal()).length};
        var pri=B.btn('.evd-btn.pri'); r.priIsStart=pri&&pri.getAttribute('data-evstart')==='evb-sched';
        r.delOutsideMenu=!!B.q('.modal-back[data-evdmodal] .evd-actions > [data-evdelete]');
        var more=B.btn('[data-evmore]'); r.hasMore=!!more;
        B.click(more); await new Promise(function(r2){setTimeout(r2,60);});
        var menu=B.btn('[data-evmenu]');
        r.menuOpen=!!(menu&&menu.classList.contains('open'));
        r.ariaExp=more.getAttribute('aria-expanded')==='true';
        r.menuFinish=!!B.q('[data-evmenu] [data-evfinish]');
        r.menuDelete=!!B.q('[data-evmenu] [data-evdelete].danger, [data-evmenu] .evd-mi.danger[data-evdelete]');
        B.kesc(); await new Promise(function(r3){setTimeout(r3,60);});
        r.menuClosedByEsc=!(menu&&menu.classList.contains('open'));
        r.modalStillOpen=!!B.modal();
        return r; })()`);
      png = await shot("f355b-P13-acoes-menu");
      rec("P13 ações reorganizadas: 1 primária (Iniciar); Excluir SÓ dentro do menu ⋯ (com Finalizar); aria-expanded; Esc fecha o menu sem fechar o modal",
        m && !m.err && m.priCount === 1 && m.priIsStart && !m.delOutsideMenu && m.hasMore && m.menuOpen && m.ariaExp && m.menuFinish && m.menuDelete && m.menuClosedByEsc && m.modalStillOpen, Object.assign(m || {}, { png }));

      /* P14 — EXCLUSÃO EM POSIÇÃO SEGURA: confirmação EXCLUIR; texto errado NÃO executa; Esc volta */
      m = await J(`(async function(){ var B=window.__B; window.__PATCHES.length=0; window.__DELETES.length=0;
        B.setUser('${ID.MARINA}'); B.open('evb-canc');
        B.click(B.btn('[data-evmore]')); await new Promise(function(r0){setTimeout(r0,60);});
        B.click(B.q('[data-evmenu] [data-evdelete]')); await new Promise(function(r1){setTimeout(r1,100);});
        var r={confirmShown:!!B.btn('.evd-confirm'), input:!!B.q('#evDelConfirm')};
        B.kesc(); await new Promise(function(r2){setTimeout(r2,80);});
        r.escBackToDetail=!!B.modal()&&!B.btn('.evd-confirm');
        B.click(B.btn('[data-evmore]')); await new Promise(function(r2b){setTimeout(r2b,60);});
        B.click(B.q('[data-evmenu] [data-evdelete]')); await new Promise(function(r3){setTimeout(r3,100);});
        B.click(B.q('[data-evdeleteyes]')); await new Promise(function(r4){setTimeout(r4,120);});
        r.blockedEmpty=window.__PATCHES.length===0&&window.__DELETES.length===0;
        r.errShown=(B.q('#evDelErr')||{}).style&&B.q('#evDelErr').style.display!=='none'&&(B.q('#evDelErr').textContent||'').indexOf('Digite EXCLUIR')>=0;
        B.q('#evDelConfirm').value='excluir';
        B.click(B.q('[data-evdeleteyes]')); await new Promise(function(r5){setTimeout(r5,120);});
        r.blockedLower=window.__PATCHES.length===0&&window.__DELETES.length===0;
        B.q('#evDelConfirm').value='EXCLUIR';
        B.click(B.q('[data-evdeleteyes]')); await new Promise(function(r6){setTimeout(r6,200);});
        var p=window.__PATCHES[0]||{};
        r.deleteRan=window.__DELETES.length===1&&window.__DELETES[0].id==='evb-canc'&&window.__DELETES[0].coll==='events';
        r.actorRecorded=p.coll==='events'&&p.id==='evb-canc'&&!!(p.patch||{}).deletedBy&&!!(p.patch||{}).deletedAt;
        r.modalClosed=!B.modal();
        return r; })()`);
      png = await shot("f355b-P14-exclusao-segura");
      rec("P14 exclusão segura: só no menu ⋯ + confirmação; vazio/minúsculas BLOQUEADOS com erro; Esc volta ao detalhe; EXCLUIR grava ator e executa delete",
        m && !m.err && m.confirmShown && m.input && m.escBackToDetail && m.blockedEmpty && m.errShown && m.blockedLower && m.deleteRan && m.actorRecorded && m.modalClosed, Object.assign(m || {}, { png }));

      /* P15/P16 — ESCALAS 125% e 150% */
      for (const [nm, zf] of [["P15", 1.25], ["P16", 1.5]]) {
        wc.setZoomFactor(zf);
        m = await J(`(async function(){ var B=window.__B; B.setUser('${ID.ANA}'); B.hoje();
          await new Promise(function(r){setTimeout(r,120);});
          var c=B.card('evb-sched'); var i=B.cardInfo(c);
          var r={dateVisible:!!(i&&i.hasDate&&i.dd), noH:B.noH(), cardOk:c.scrollWidth<=c.clientWidth+2};
          B.open('evb-sched'); await new Promise(function(r2){setTimeout(r2,120);});
          var sheet=B.q('.sheet.evd-sheet'); var rc=sheet.getBoundingClientRect();
          r.modalFits=rc.width<=window.innerWidth+2&&rc.height<=window.innerHeight+2;
          var pri=B.btn('.evd-btn.pri'); var pr=pri?pri.getBoundingClientRect():{height:0,bottom:9e9};
          r.priClickable=pr.height>=34&&pr.bottom<=window.innerHeight+2;
          r.dfull=(B.btn('.evd-dfull')||{}).textContent||'';
          return r; })()`);
        png = await shot("f355b-" + nm + "-escala" + String(zf * 100));
        await J(`try{closeModal();}catch(_){ } true`);
        rec(nm + " escala " + zf * 100 + "%: data visível no card; sem corte horizontal; modal cabe na janela; primária clicável",
          m && !m.err && m.dateVisible && m.noH && m.cardOk && m.modalFits && m.priClickable && m.dfull.length > 8, Object.assign(m || {}, { png }));
        wc.setZoomFactor(1);
      }

      /* P17/P18 — RESOLUÇÕES 1366×768 e 1920×1080 */
      for (const [nm, W, H] of [["P17", 1366, 768], ["P18", 1920, 1080]]) {
        win.setContentSize(W, H); await sleep(350);
        m = await J(`(async function(){ var B=window.__B; B.hoje();
          await new Promise(function(r){setTimeout(r,150);});
          var cards=B.qa('.evc'); var infos=cards.map(B.cardInfo);
          var r={count:cards.length, allDate:infos.every(function(i){return i.hasDate&&i.dd;}),
            allNoOverflow:cards.every(function(c){return c.scrollWidth<=c.clientWidth+2;}), noH:B.noH()};
          B.open('evb-prog'); await new Promise(function(r2){setTimeout(r2,120);});
          var rc=B.q('.sheet.evd-sheet').getBoundingClientRect();
          r.modalFits=rc.width<=window.innerWidth+2&&rc.height<=window.innerHeight+2;
          r.actionsVisible=!!B.btn('.evd-btn.pri')&&B.btn('.evd-btn.pri').getBoundingClientRect().bottom<=window.innerHeight+2;
          return r; })()`);
        png = await shot("f355b-" + nm + "-" + W + "x" + H);
        await J(`try{closeModal();}catch(_){ } true`);
        rec(nm + " " + W + "×" + H + ": datas visíveis, zero corte nos cards, modal dentro da workArea, ações visíveis",
          m && !m.err && m.count >= 2 && m.allDate && m.allNoOverflow && m.noH && m.modalFits && m.actionsVisible, Object.assign(m || {}, { png }));
      }
      win.setContentSize(1440, 940); await sleep(250);

      /* P19 — VÁRIOS COMPROMISSOS: Hoje limita futuros a 5; Agenda lista todos; ano futuro visível */
      m = await J(`(function(){ var B=window.__B; B.hoje();
        var futN=B.qa('.col-future .evc').length;
        B.agList();
        var listN=B.qa('.evc').length;
        var ny=B.cardInfo(B.card('evb-nextyear'));
        return { futN:futN, listN:listN, nyYear:(ny||{}).dy||'', noH:B.noH() }; })()`);
      png = await shot("f355b-P19-varios");
      rec("P19 vários compromissos: 'Próximos' limita a 5; lista da Agenda mostra todos (≥10); ano exibido quando ≠ atual",
        m && !m.err && m.futN === 5 && m.listN >= 10 && /^\d{4}$/.test(m.nyYear) && m.noH, Object.assign(m || {}, { png }));

      /* P20 — DASHBOARD SEM REGRESSÃO: stats, Tarefas urgentes, seções e navegação intactas */
      m = await J(`(function(){ var B=window.__B; B.hoje();
        var sects=B.qa('.sect').map(function(s){return s.textContent;});
        return { stats:B.qa('.stat').length, urgent:B.qa('.col-tasks .card').length,
          hasHojeSect:sects.indexOf('Compromissos de hoje')>=0, hasTkSect:sects.indexOf('Tarefas urgentes')>=0,
          hasFuSect:sects.indexOf('Próximos compromissos')>=0, nav:!!B.q('.nav'), noH:B.noH() }; })()`);
      png = await shot("f355b-P20-dashboard");
      rec("P20 dashboard sem regressão: 3 stats, Tarefas urgentes renderizadas, 3 seções, navegação presente",
        m && !m.err && m.stats === 3 && m.urgent >= 1 && m.hasHojeSect && m.hasTkSect && m.hasFuSect && m.nav && m.noH, Object.assign(m || {}, { png }));
    }
  } catch (e) { fatal = String((e && e.stack) || e); }

  const failures = fatal ? 999 : results.filter((r) => !r.ok).length;
  const manifest = {
    feature: "F3.5.5B", asarSha256: asarPath ? sha256(asarPath) : null, packagedIndexSha256: meta.stageIndexSha,
    electron: process.versions.electron, proofs: results.length, failures, fatal, results
  };
  try { fs.writeFileSync(path.join(OUT, "f355b-proof-manifest.json"), JSON.stringify(manifest, null, 2)); } catch (_) {}
  process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=" + failures + (fatal ? " FATAL=" + String(fatal).slice(0, 400) : "") + "\n");
  clearTimeout(WATCHDOG);
  try { win.destroy(); } catch (_) {}
  app.exit(failures === 0 ? 0 : 1);
});
