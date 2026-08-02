/* F3.5.4V — MAIN de prova do APP EMPACOTADO (Electron REAL 31.3.1). Carrega o renderer REAL
 * (src/renderer/index.html) a partir do app.asar, injeta uma sessão (bypass do login/rede — a
 * lógica de produto NÃO é alterada), abre o wizard "Nova tarefa → Edição de vídeos → Briefing" e
 * exercita o seletor de QUANTIDADE personalizada com o CÓDIGO REAL (render/curSub/handlers).
 * Para cada cena: mede o DOM REAL e captura PNG REAL (win.capturePage). Sem IA/mockup/HTML isolado.
 */
const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT = process.env.PROOF_OUT || "/tmp/f354v-qa";
const SCALE = process.env.PROOF_SCALE || "1x";
const SCENES = (process.env.PROOF_SCENES || "qty1,qty5,qty8,qty13,qty20,buttons,typed,review,legacy_p4,editreopen").split(",").map(s => s.trim()).filter(Boolean);
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}

const EXPECT = { qty1: 1, qty5: 5, qty8: 8, qty13: 13, qty20: 20, buttons: 2, typed: 7, review: 8, legacy_p4: 4, editreopen: 7 };

function log(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  // corta QUALQUER rede externa (firebase CDN etc.) — prova 100% offline/determinística
  try { session.defaultSession.webRequest.onBeforeRequest((d, cb) => { cb({ cancel: /^https?:/i.test(d.url) }); }); } catch (_) {}

  const win = new BrowserWindow({
    width: 1366, height: 768, show: false,
    webPreferences: {
      preload: path.join(__dirname, "proof-preload.js"),
      contextIsolation: false, nodeIntegration: false, sandbox: false,
      backgroundThrottling: false
    }
  });

  const results = [];
  let fatal = null;
  try {
    await win.loadFile(path.join(app.getAppPath(), "src", "renderer", "index.html"));
    await new Promise(r => setTimeout(r, 600)); // deixa o boot() do renderer assentar

    const setup = await win.webContents.executeJavaScript(`(function(){try{
      state.user={id:'u1',name:'Social Teste',role:'Social Media',admin:true};
      state.users=[{id:'dz1',name:'Designer Alfa',role:'Designer'},state.user];
      state.tasks=[];
      document.body.classList.add('authed');
      var lg=document.getElementById('login'); if(lg)lg.classList.add('hidden');
      var ap=document.getElementById('app'); if(ap)ap.style.display='flex';
      return {ok:true,hasCurSub:typeof curSub==='function',hasRender:typeof render==='function',hasOpen:typeof openTaskForm==='function',hasSynth:typeof synthVideoSub==='function'};
    }catch(e){return {ok:false,err:String(e&&e.stack||e)};}})()`);
    log({ setup });
    if (!setup || !setup.ok || !setup.hasCurSub || !setup.hasRender) { fatal = "setup-failed: " + JSON.stringify(setup); }

    if (!fatal) {
      const sceneFn = `function __proofScene(name){try{
        openTaskForm('edicao_midia');
        var f=state.form; f.title='Reels institucional — prova'; f.assigneeId='dz1'; f.endDate='2026-08-20'; f.endTime='18:00';
        f.videoQty=null; f.videos=[]; f.id=null; f.subtype=null; f.step=2;
        if(name==='qty1'){f.videoQty=1;}
        else if(name==='qty5'){f.videoQty=5;}
        else if(name==='qty8'){f.videoQty=8;}
        else if(name==='qty13'){f.videoQty=13;}
        else if(name==='qty20'){f.videoQty=20;}
        else if(name==='legacy_p4'){f.id='t1';f.subtype='p4';f.videoQty=null;}
        else if(name==='editreopen'){f.id='t2';f.videos=[1,2,3,4,5,6,7].map(function(n){return {id:'v'+n,tema:'Tema '+n};});f.videoQty=null;}
        render();
        if(name==='buttons'){ f.videoQty=null; render();
          for(var i=0;i<3;i++){var p=document.querySelector('[data-vqplus]'); if(p)p.click();}
          var mm=document.querySelector('[data-vqminus]'); if(mm)mm.click();
        } else if(name==='typed'){ f.videoQty=null; render();
          var inp=document.querySelector('#fVideoQty'); if(inp){inp.value='7'; inp.dispatchEvent(new Event('change',{bubbles:true}));}
        } else if(name==='review'){ f.videoQty=8; f.videos=[1,2,3,4,5,6,7,8].map(function(n){return {id:'v'+n,tema:'Tema do vídeo '+n};}); f.step=3; render(); }
        var inp2=document.querySelector('#fVideoQty');
        var bodyTxt=(document.body.textContent||'');
        // textContent (NÃO innerText) p/ não sofrer text-transform:uppercase do .lbl
        function anyText(sel,re){return Array.prototype.some.call(document.querySelectorAll(sel),function(e){return re.test(e.textContent||'');});}
        var res={name:name,
          fVideoQtyCount:document.querySelectorAll('#fVideoQty').length,
          vqtyRowCount:document.querySelectorAll('.vqty-row').length,
          inputValue:inp2?inp2.value:null,
          vtemaCount:document.querySelectorAll('[data-vtema]').length,
          chipCount:document.querySelectorAll('[data-fsub]').length,
          labelPresent:anyText('.lbl,.rev-it-l',/quantidade de v[ií]deos\\/roteiros/i),
          minusDisabled:!!(document.querySelector('[data-vqminus]')&&document.querySelector('[data-vqminus]').disabled),
          videoQtyState:state.form.videoQty};
        if(name==='review'){
          res.reviewHasQty=anyText('.rev-it-l,.rev-chip',/quantidade de v[ií]deos\\/roteiros|\\bv[ií]deos\\/roteiros\\b/i);
          var counts=Array.prototype.map.call(document.querySelectorAll('.rev-count'),function(e){return (e.textContent||'').replace(/\\s+/g,' ').trim();});
          res.reviewCounts=counts; res.reviewCount=counts.join(' | ');
          res.reviewNoPacotePersonalizado=!/pacote:\\s*personalizado/i.test(bodyTxt);
        }
        return res;
      }catch(e){return {name:name,err:String(e&&e.stack||e)};}}`;
      await win.webContents.executeJavaScript(sceneFn + "; true");

      for (const name of SCENES) {
        const m = await win.webContents.executeJavaScript(`__proofScene(${JSON.stringify(name)})`);
        await new Promise(r => setTimeout(r, 120));
        const png = path.join(OUT, "f354v-" + name + "-" + SCALE.replace(/[^0-9a-zx.]/gi, "") + ".png");
        try { const img = await win.capturePage(); fs.writeFileSync(png, img.toPNG()); m.png = path.basename(png); } catch (e) { m.pngErr = String(e); }
        // avaliação
        const exp = EXPECT[name];
        let okScene;
        if (name === "review") {
          okScene = !!(m && !m.err && m.reviewHasQty === true && (m.reviewCounts || []).some(c => /\b8\s*\/\s*8\b/.test(c)) && m.reviewNoPacotePersonalizado === true);
        } else {
          okScene = !!(m && !m.err && m.fVideoQtyCount === 1 && m.vqtyRowCount === 1 && m.chipCount === 0 && m.labelPresent === true && m.vtemaCount === exp && String(m.inputValue) === String(exp));
        }
        m.ok = okScene; m.expected = exp;
        results.push(m);
        log({ scene: m.name, scale: SCALE, ok: m.ok, input: m.inputValue, vtema: m.vtemaCount, rows: m.vqtyRowCount, chips: m.chipCount, expect: exp, err: m.err || null });
      }
    }
  } catch (e) { fatal = String(e && e.stack || e); }

  const failures = fatal ? 999 : results.filter(r => !r.ok).length;
  const summary = { feature: "F3.5.4V", scale: SCALE, scenes: results.length, failures, fatal, results };
  try { fs.writeFileSync(path.join(OUT, "f354v-scenes-" + SCALE.replace(/[^0-9a-zx.]/gi, "") + ".json"), JSON.stringify(summary, null, 2)); } catch (_) {}
  process.stdout.write("PROOF_DONE scale=" + SCALE + " scenes=" + results.length + " failures=" + failures + (fatal ? (" FATAL=" + fatal.slice(0, 300)) : "") + "\n");
  try { win.destroy(); } catch (_) {}
  app.quit();
  setTimeout(() => process.exit(failures === 0 && !fatal ? 0 : 1), 150);
});
