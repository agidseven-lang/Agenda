/* F3.5.5A-H1 — PROVAS REAIS (Electron 31.3.1; app EMPACOTADO em app.asar; xvfb).
 * Empacota o renderer REAL (src/renderer/index.html + priorityEngine.js) em app.asar com
 * @electron/asar, carrega DO ASAR numa BrowserWindow real com o preload de semente
 * (f355ah1-proof-preload.js — stub firebase offline no MESMO padrão aprovado da W-H1) e
 * exercita o CÓDIGO DE PRODUÇÃO: openDetails/detNoteOpen/detNoteSave/detNoteCancel/
 * openDesignerDeadline. Cliques via MouseEvent bubbles (handler DELEGADO real). Para cada
 * cena: medição do DOM REAL + PNG (win.capturePage). Sem IA, sem mockup, sem HTML isolado.
 * P1 lápis por tema (cron+roteiro; fora: mídia/cards)   P2 editor abre SEM expandir + 1 editor por vez
 * P3 salvar (dot-path + history sem texto + snapshot durante edição + foco no lápis)
 * P4 reabrir prefill   P5 editar   P6 vazio remove seção   P7 Admin edita   P8 Designer só visualiza
 * P9 cliente sem acesso (worker real byte a byte)        P10 editar TEXTO do tema preserva vínculo
 * P11 item ocultado não desloca notas                    P12 atribuição reutiliza as observações
 * P13 escala 125%   P14 escala 150%                      P15 falha mantém texto + retry salva */
const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f355a-h1-qa");
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }
// original-fs: o fs PATCHADO do Electron trata caminho .asar como diretório virtual — para
// hashear o ARQUIVO do asar é obrigatório o fs original (mesma lição do harness F3.5.5A).
const ofs = require("original-fs");
const sha256 = (p) => crypto.createHash("sha256").update(ofs.readFileSync(p)).digest("hex");
// Qualquer exceção não tratada encerra RUIDOSAMENTE (nunca um processo vivo e mudo no CI).
process.on("uncaughtException", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=uncaught:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });
process.on("unhandledRejection", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=unhandled:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });

/* ---- SEMENTE (estado real; formato aprovado da W-H1) ---- */
const NOW = Date.now();
const ID = { ANA: "u-soc-ana", MARINA: "u-adm-marina", DIEGO: "u-des-diego" };
const NOTE_ML = "Priorizar o feed 🎯\n\nCTA no 1º parágrafo — ação, coração, você. \"Aspas\" & <b>não-HTML</b>.";
const seed = (() => {
  const self = { id: ID.ANA, name: "Ana Beatriz Social Media", role: "Social Media", admin: false, status: "ativo" };
  const users = [self,
    { id: ID.MARINA, name: "Marina Administradora", role: "Administrador", admin: true, status: "ativo" },
    { id: ID.DIEGO, name: "Diego Fernandes Designer", role: "Designer", status: "ativo" }];
  const base = (x) => Object.assign({ by: ID.ANA, createdAt: NOW, dueDate: "2026-08-20", dueTime: "18:00", history: [], checklist: [] }, x);
  const tasks = [
    base({ id: "nh1-cron3", sector: "cronograma", status: "afazer", title: "Cronograma Agosto — notas internas", client: "Clínica Aurora Odontologia",
      cronContents: [{ tema: "Tema A — Feed", legenda: "Legenda A." }, { tema: "Tema B — Story", legenda: "" }, { tema: "Tema C — Reels", legenda: "Legenda C." }], designerItemNotes: {} }),
    base({ id: "nh1-rot2", sector: "roteiro", status: "afazer", title: "Roteiros — pauta institucional", client: "Marca Nova Digital",
      cronContents: [{ tema: "Roteiro 1 — abertura", legenda: "Leg 1." }, { tema: "Roteiro 2 — encerramento", legenda: "Leg 2." }] }),
    base({ id: "nh1-edm", sector: "edicao_midia", status: "andamento", title: "Edição — pacote de vídeos", client: "Studio Vivo",
      videos: [{ id: "v1", tema: "Vídeo 1" }, { id: "v2", tema: "Vídeo 2" }] }),
    base({ id: "nh1-cards", sector: "edicao_cards", status: "andamento", title: "Card avulso — Dia dos Pais", client: "Ótica Clara", cardLegenda: "Legenda do card.", cardObs: "Obs interna do card." })
  ];
  return { self, users, tasks, events: [] };
})();

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();

let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f355ah1-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f355ah1-app.asar");
  try { fs.rmSync(asarPath, { force: true }); } catch (_) {}
  await asar.createPackage(stage, asarPath);
  return { stageIndexSha: sha256(path.join(rdir, "index.html")) };
}

const results = [];
function rec(name, ok, info) { results.push({ name, ok: !!ok, info: info || {} }); line({ proof: name, ok: !!ok, info: info || {} }); }

app.whenReady().then(async () => {
  // Watchdog: o harness NUNCA segura o job de CI — se algo travar, encerra com FATAL explícito.
  const WATCHDOG = setTimeout(() => { try { process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=999 FATAL=watchdog_timeout_10min\n"); } catch (_) {} app.exit(1); }, 10 * 60 * 1000);
  try { session.defaultSession.webRequest.onBeforeRequest((d, cb) => { cb({ cancel: /^https?:/i.test(d.url) }); }); } catch (_) {}
  const meta = await packAsar();
  fs.writeFileSync(path.join(os.tmpdir(), "f355ah1-seed.json"), JSON.stringify(seed));

  const win = new BrowserWindow({ width: 1440, height: 940, show: true, webPreferences: {
    preload: path.join(__dirname, "f355ah1-proof-preload.js"),
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
      if (boot && boot.authed && boot.tasks >= 4) break; }
    line({ boot });
    if (!boot || !boot.authed || boot.tasks < 4) fatal = "boot-failed: " + JSON.stringify(boot);

    if (!fatal) {
      await J(`window.__H1=(function(){
        function q(s,r){return (r||document).querySelector(s);} function qa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
        function click(el){ if(!el) return false; el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true; }
        function T(id){ return state.tasks.find(function(x){return x.id===id;}); }
        function setUser(id){ state.user = state.users.find(function(u){return u.id===id;}); }
        function open(id){ try{ closeModal(); }catch(_){} openDetails(id); }
        function pen(i){ return q('[data-detnoteedit="'+i+'"]'); }
        function box(i){ return q('[data-detnotebox="'+i+'"]'); }
        function ta(i){ return q('[data-detnoteta="'+i+'"]'); }
        function noteOf(i){ var it=q('[data-detnoteitem="'+i+'"]'); return it? it.querySelector('.det-acc-note') : null; }
        function msgTxt(i){ var m=q('[data-detnotemsg="'+i+'"]'); return m?m.textContent:''; }
        return { q:q, qa:qa, click:click, T:T, setUser:setUser, open:open, pen:pen, box:box, ta:ta, noteOf:noteOf, msgTxt:msgTxt };
      })(); true`);

      /* P1 — lápis por tema (Social) + escopo por setor */
      let m = await J(`(function(){ var H=window.__H1; H.setUser('${ID.ANA}');
        H.open('nh1-cron3');
        var r={pencils:H.qa('[data-detnoteedit]').length, boxes:H.qa('[data-detnotebox]').length, notes:H.qa('.det-acc-note').length,
          aria:(H.pen(0)&&H.pen(0).getAttribute('aria-label'))||'', title:(H.pen(0)&&H.pen(0).getAttribute('title'))||''};
        var sum=H.q('.det-acc-sum'); var iC=sum?sum.innerHTML.indexOf('data-detcopytheme'):-1, iE=sum?sum.innerHTML.indexOf('data-detnoteedit'):-1, iV=sum?sum.innerHTML.indexOf('det-acc-chev'):-1;
        r.order = iC>=0 && iE>iC && iV>iE;
        H.open('nh1-rot2'); r.rotPencils=H.qa('[data-detnoteedit]').length;
        H.open('nh1-edm');  r.edmPencils=H.qa('[data-detnoteedit]').length;
        H.open('nh1-cards'); r.cardsPencils=H.qa('[data-detnoteedit]').length;
        H.open('nh1-cron3'); return r; })()`);
      await sleep(120); const p1png = await shot("f355ah1-P01-lapis");
      rec("P1 lápis por tema: 3 no cron, 2 no roteiro, 0 em mídia/cards; ordem Copiar→Editar→Expandir; aria/título",
        m && !m.err && m.pencils === 3 && m.rotPencils === 2 && m.edmPencils === 0 && m.cardsPencils === 0 && m.order === true && m.aria === "Editar observação interna" && m.title === "Editar observação interna" && m.notes === 0, Object.assign(m || {}, { png: p1png }));

      /* P2 — editor abre SEM expandir/recolher; label literal; 1 editor por vez; descarte em 2 cliques */
      m = await J(`(async function(){ var H=window.__H1;
        H.open('nh1-cron3');
        var d0=H.qa('details.det-acc')[0]; var openBefore=d0.open;
        H.click(H.pen(0)); await new Promise(function(r){setTimeout(r,60);});
        var r={openAfter:d0.open===openBefore, editorVisible:!!(H.box(0)&&!H.box(0).hidden),
          label:(H.box(0)&&H.box(0).textContent.indexOf('OBSERVAÇÃO INTERNA PARA O DESIGNER — OPCIONAL')>=0),
          sub:(H.box(0)&&H.box(0).textContent.indexOf('Nunca aparece para o cliente.')>=0),
          taEmpty:(H.ta(0)&&H.ta(0).value==='')};
        H.ta(0).value='rascunho em andamento';
        H.click(H.pen(1)); await new Promise(function(r2){setTimeout(r2,60);});
        r.blockMsg=H.msgTxt(0).indexOf('Salve ou cancele esta observação antes de editar outro tema.')>=0;
        r.stillItem0=!!(H.box(0)&&!H.box(0).hidden); r.notOpened1=!(H.box(1)&&!H.box(1).hidden);
        var cb=H.q('[data-detnotecancel="0"]'); H.click(cb); await new Promise(function(r3){setTimeout(r3,60);});
        r.discardArmed=(H.q('[data-detnotecancel="0"]')||{}).textContent==='Descartar alterações?';
        r.stillOpenAfter1stCancel=!!(H.box(0)&&!H.box(0).hidden);
        H.click(H.q('[data-detnotecancel="0"]')); await new Promise(function(r4){setTimeout(r4,60);});
        r.closedAfter2nd=!!(H.box(0)&&H.box(0).hidden);
        r.focusOnPencil=document.activeElement===H.pen(0);
        return r; })()`);
      const p2png = await shot("f355ah1-P02-editor");
      rec("P2 editor sem expandir acordeão; label/sub literais; UM editor por vez; descarte em 2 cliques; foco volta ao lápis",
        m && !m.err && m.openAfter && m.editorVisible && m.label && m.sub && m.taEmpty && m.blockMsg && m.stillItem0 && m.notOpened1 && m.discardArmed && m.stillOpenAfter1stCancel && m.closedAfter2nd && m.focusOnPencil, Object.assign(m || {}, { png: p2png }));

      /* P3 — salvar: snapshot durante edição preserva; dot-path; history sem texto; foco no lápis */
      m = await J(`(async function(){ var H=window.__H1; window.__PATCHES.length=0; window.__DIAG.length=0;
        H.open('nh1-cron3');
        H.pen(0).focus(); H.click(H.pen(0)); await new Promise(function(r){setTimeout(r,60);});
        H.ta(0).value=${JSON.stringify(NOTE_ML)};
        render(); // snapshot real durante a edição (renderFromSnapshot→render) — modal fora de #app
        var r={taAliveAfterRender:!!H.ta(0)&&H.ta(0).value.length>10};
        H.click(H.q('[data-detnotesave="0"]')); await new Promise(function(r2){setTimeout(r2,200);});
        var p=window.__PATCHES[0]||{}; var keys=Object.keys(p.patch||{});
        r.patchId=p.id; r.keys=keys;
        r.dotPathOnly=keys.length===2&&keys.indexOf('designerItemNotes.i0')>=0&&keys.indexOf('history')>=0;
        r.value=(p.patch||{})['designerItemNotes.i0'];
        var h=((p.patch||{}).history||{}).__au&&p.patch.history.__au[0]||{};
        r.histType=h.type; r.histLabel=h.label; r.histLen=h.contentLength;
        r.histNoText=!(JSON.stringify(h).indexOf('Priorizar o feed')>=0);
        r.editorClosed=!!(H.box(0)&&H.box(0).hidden);
        r.noteShown=!!H.noteOf(0)&&H.noteOf(0).textContent.indexOf('Priorizar o feed 🎯')>=0;
        r.noteLabel=!!H.noteOf(0)&&H.noteOf(0).textContent.indexOf('Observação interna da Social Media')>=0;
        r.focusOnPencil=document.activeElement===H.pen(0);
        r.diagOk=window.__DIAG.some(function(d){return d.ev==='details.note.save_succeeded'&&d.p.contentLength>0&&JSON.stringify(d.p).indexOf('Priorizar')<0;});
        r.localMap=(H.T('nh1-cron3').designerItemNotes||{}).i0===${JSON.stringify(NOTE_ML.trim())};
        return r; })()`);
      const p3png = await shot("f355ah1-P03-salva");
      rec("P3 salvar: texto sobrevive a snapshot; patch SÓ dot-path+history; history sem texto; exibição+foco+obs sanitizada",
        m && !m.err && m.taAliveAfterRender && m.patchId === "nh1-cron3" && m.dotPathOnly && m.value === NOTE_ML.trim() && m.histType === "obs_interna_tema" && String(m.histLabel).indexOf("Observação interna do Tema 01 atualizada.") === 0 && m.histLen === NOTE_ML.trim().length && m.histNoText && m.editorClosed && m.noteShown && m.noteLabel && m.focusOnPencil && m.diagOk && m.localMap, Object.assign(m || {}, { png: p3png }));

      /* P4 — reabrir prefill */
      m = await J(`(async function(){ var H=window.__H1;
        H.click(H.pen(0)); await new Promise(function(r){setTimeout(r,60);});
        var r={prefill:H.ta(0)&&H.ta(0).value===${JSON.stringify(NOTE_ML.trim())}};
        return r; })()`);
      const p4png = await shot("f355ah1-P04-prefill");
      rec("P4 reabrir: textarea prefilled com o texto persistido (parágrafos/emoji/acentos)", m && !m.err && m.prefill, Object.assign(m || {}, { png: p4png }));

      /* P5 — editar e salvar de novo */
      m = await J(`(async function(){ var H=window.__H1; window.__PATCHES.length=0;
        H.ta(0).value='Texto EDITADO ✔ segunda versão';
        H.click(H.q('[data-detnotesave="0"]')); await new Promise(function(r){setTimeout(r,200);});
        var p=window.__PATCHES[0]||{};
        return {v:(p.patch||{})['designerItemNotes.i0'], shown:!!H.noteOf(0)&&H.noteOf(0).textContent.indexOf('Texto EDITADO ✔ segunda versão')>=0}; })()`);
      rec("P5 editar: novo valor gravado por dot-path e exibição atualizada in place", m && !m.err && m.v === "Texto EDITADO ✔ segunda versão" && m.shown, m || {});

      /* P6 — vazio remove chave e seção */
      m = await J(`(async function(){ var H=window.__H1; window.__PATCHES.length=0;
        H.click(H.pen(0)); await new Promise(function(r){setTimeout(r,60);});
        H.ta(0).value='   ';
        H.click(H.q('[data-detnotesave="0"]')); await new Promise(function(r2){setTimeout(r2,200);});
        var p=window.__PATCHES[0]||{};
        return {del:!!((p.patch||{})['designerItemNotes.i0']||{}).__del, noSection:!H.noteOf(0), noKey:!('i0' in (H.T('nh1-cron3').designerItemNotes||{}))}; })()`);
      const p6png = await shot("f355ah1-P06-vazio");
      rec("P6 vazio: FieldValue.delete() na chave; NENHUMA seção vazia; mapa local sem a chave", m && !m.err && m.del && m.noSection && m.noKey, Object.assign(m || {}, { png: p6png }));

      /* P7 — Admin também edita (roleCat ADMIN) */
      m = await J(`(async function(){ var H=window.__H1; H.setUser('${ID.MARINA}');
        H.open('nh1-cron3'); return {pencils:H.qa('[data-detnoteedit]').length}; })()`);
      rec("P7 Administrador: lápis presente (3 itens)", m && !m.err && m.pencils === 3, m || {});

      /* P8 — Designer: SÓ visualiza (sem lápis/caixa; nota visível) */
      m = await J(`(async function(){ var H=window.__H1;
        H.T('nh1-cron3').designerItemNotes={i2:'usar referência X'};
        H.setUser('${ID.DIEGO}'); H.open('nh1-cron3');
        return {pencils:H.qa('[data-detnoteedit]').length, boxes:H.qa('[data-detnotebox]').length,
          noteOn3:!!H.noteOf(2)&&H.noteOf(2).textContent.indexOf('usar referência X')>=0,
          othersClean:!H.noteOf(0)&&!H.noteOf(1)}; })()`);
      const p8png = await shot("f355ah1-P08-designer");
      rec("P8 Designer: zero lápis/caixa; observação visível no item correto; itens sem nota limpos", m && !m.err && m.pencils === 0 && m.boxes === 0 && m.noteOn3 && m.othersClean, Object.assign(m || {}, { png: p8png }));

      /* P9 — cliente NUNCA: worker real byte a byte (arquivo do repo empacotado nesta branch) */
      const workerSrc = fs.readFileSync(path.join(__dirname, "..", "..", "cloudflare-worker.js"), "utf8");
      rec("P9 cliente sem acesso: cloudflare-worker.js REAL sem NENHUMA referência a designerItemNotes/obs_interna_tema",
        !workerSrc.includes("designerItemNotes") && !workerSrc.includes("obs_interna_tema"), { workerSha256: sha256(path.join(__dirname, "..", "..", "cloudflare-worker.js")).slice(0, 16) });

      /* P10 — editar o TEXTO do tema preserva o vínculo (índice estável) */
      m = await J(`(async function(){ var H=window.__H1; H.setUser('${ID.ANA}');
        var t=H.T('nh1-cron3'); t.designerItemNotes={i1:'nota do B'};
        t.cronContents[1]={tema:'Tema B EDITADO — novo título',legenda:''}; // mesma semântica index-preserving de saveContentEdits/saveItemFix
        H.open('nh1-cron3');
        var it1=H.q('[data-detnoteitem="1"]');
        return {noteOn2:!!H.noteOf(1)&&H.noteOf(1).textContent.indexOf('nota do B')>=0,
          titleEdited:!!it1&&it1.textContent.indexOf('Tema B EDITADO')>=0,
          othersClean:!H.noteOf(0)&&!H.noteOf(2)}; })()`);
      const p10png = await shot("f355ah1-P10-tema-editado");
      rec("P10 texto do tema editado no MESMO índice: a observação permanece no item correto", m && !m.err && m.noteOn2 && m.titleEdited && m.othersClean, Object.assign(m || {}, { png: p10png }));

      /* P11 — item esvaziado é OCULTADO sem deslocar notas (cronOf filtra; _i preservado) */
      m = await J(`(async function(){ var H=window.__H1;
        var t=H.T('nh1-cron3');
        t.cronContents=[{tema:'Tema A — Feed',legenda:'Legenda A.'},{tema:'',legenda:''},{tema:'Tema C — Reels',legenda:'Legenda C.'}];
        t.designerItemNotes={i1:'nota do item ocultado',i2:'nota do C'};
        H.open('nh1-cron3');
        var items=H.qa('[data-detnoteitem]').map(function(e){return e.getAttribute('data-detnoteitem');});
        return {items:items, twoShown:items.length===2&&items[0]==='0'&&items[1]==='2',
          cNoteRight:!!H.noteOf(2)&&H.noteOf(2).textContent.indexOf('nota do C')>=0,
          hiddenNoteNowhere:document.body.textContent.indexOf('nota do item ocultado')<0,
          aClean:!H.noteOf(0)}; })()`);
      rec("P11 item esvaziado some da lista e NENHUMA nota desloca (i2 segue no C; i1 não vaza)", m && !m.err && m.twoShown && m.cNoteRight && m.hiddenNoteNowhere && m.aClean, m || {});

      /* P12 — atribuição reutiliza as observações (mesma fonte) */
      m = await J(`(async function(){ var H=window.__H1;
        var t=H.T('nh1-cron3');
        t.cronContents=[{tema:'Tema A — Feed',legenda:'Legenda A.'},{tema:'Tema B — Story',legenda:''},{tema:'Tema C — Reels',legenda:'Legenda C.'}];
        t.designerItemNotes={i0:'Priorizar o feed — CTA'};
        try{ closeModal(); }catch(_){}
        openDesignerDeadline('nh1-cron3','${ID.DIEGO}');
        var tas=H.qa('textarea[data-itemnote]');
        return {count:tas.length, v0:(H.q('textarea[data-itemnote="0"]')||{}).value, v1:(H.q('textarea[data-itemnote="1"]')||{}).value, v2:(H.q('textarea[data-itemnote="2"]')||{}).value}; })()`);
      const p12png = await shot("f355ah1-P12-atribuicao");
      rec("P12 modal de atribuição PREFILL da mesma fonte (i0 preenchido; demais vazios; 3 textareas)", m && !m.err && m.count === 3 && m.v0 === "Priorizar o feed — CTA" && m.v1 === "" && m.v2 === "", Object.assign(m || {}, { png: p12png }));

      /* P13/P14 — escalas 125% e 150% */
      for (const [nm, zf] of [["P13", 1.25], ["P14", 1.5]]) {
        wc.setZoomFactor(zf);
        m = await J(`(async function(){ var H=window.__H1;
          try{ closeModal(); }catch(_){}
          H.open('nh1-cron3');
          H.click(H.pen(0)); await new Promise(function(r){setTimeout(r,80);});
          var pr=H.pen(0).getBoundingClientRect(); var tb=H.ta(0)?H.ta(0).getBoundingClientRect():{width:0,height:0};
          return {penW:Math.round(pr.width), penH:Math.round(pr.height), editorOpen:!!(H.box(0)&&!H.box(0).hidden), taW:Math.round(tb.width), taH:Math.round(tb.height), noHScroll:document.documentElement.scrollWidth<=document.documentElement.clientWidth+2};
        })()`);
        const png = await shot("f355ah1-" + nm + "-escala" + String(zf * 100));
        rec(nm + " escala " + zf * 100 + "%: lápis clicável (área adequada), editor abre, textarea visível, sem corte",
          m && !m.err && m.penW >= 24 && m.penH >= 24 && m.editorOpen && m.taW > 200 && m.taH > 40, Object.assign(m || {}, { png }));
        wc.setZoomFactor(1);
      }

      /* P15 — falha de rede mantém o texto; retry salva */
      m = await J(`(async function(){ var H=window.__H1; window.__PATCHES.length=0; window.__DIAG.length=0;
        try{ closeModal(); }catch(_){}
        H.open('nh1-cron3');
        H.click(H.pen(1)); await new Promise(function(r){setTimeout(r,60);});
        H.ta(1).value='texto persistente ✍️ que NÃO pode se perder';
        window.__DB_FAIL=true;
        H.click(H.q('[data-detnotesave="1"]')); await new Promise(function(r2){setTimeout(r2,200);});
        var r={failMsg:H.msgTxt(1).indexOf('Não foi possível salvar. Verifique a conexão e tente novamente.')>=0,
          editorStillOpen:!!(H.box(1)&&!H.box(1).hidden),
          textKept:H.ta(1)&&H.ta(1).value==='texto persistente ✍️ que NÃO pode se perder',
          noFalseSuccess:!H.noteOf(1),
          diagFail:window.__DIAG.some(function(d){return d.ev==='details.note.save_failed';})};
        window.__DB_FAIL=false;
        H.click(H.q('[data-detnotesave="1"]')); await new Promise(function(r3){setTimeout(r3,200);});
        r.retrySaved=window.__PATCHES.length===2&&(window.__PATCHES[1].patch||{})['designerItemNotes.i1']==='texto persistente ✍️ que NÃO pode se perder';
        r.noteShown=!!H.noteOf(1)&&H.noteOf(1).textContent.indexOf('texto persistente')>=0;
        r.editorClosed=!!(H.box(1)&&H.box(1).hidden);
        return r; })()`);
      const p15png = await shot("f355ah1-P15-falha-retry");
      rec("P15 falha: editor aberto + texto intacto + mensagem clara + sem sucesso falso; retry grava e fecha",
        m && !m.err && m.failMsg && m.editorStillOpen && m.textKept && m.noFalseSuccess && m.diagFail && m.retrySaved && m.noteShown && m.editorClosed, Object.assign(m || {}, { png: p15png }));
    }
  } catch (e) { fatal = String((e && e.stack) || e); }

  const failures = fatal ? 999 : results.filter((r) => !r.ok).length;
  const manifest = {
    feature: "F3.5.5A-H1", asarSha256: asarPath ? sha256(asarPath) : null, packagedIndexSha256: meta.stageIndexSha,
    electron: process.versions.electron, proofs: results.length, failures, fatal, results
  };
  try { fs.writeFileSync(path.join(OUT, "f355ah1-proof-manifest.json"), JSON.stringify(manifest, null, 2)); } catch (_) {}
  process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=" + failures + (fatal ? " FATAL=" + String(fatal).slice(0, 400) : "") + "\n");
  clearTimeout(WATCHDOG);
  try { win.destroy(); } catch (_) {}
  app.exit(failures === 0 ? 0 : 1);
});
