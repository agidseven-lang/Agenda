#!/usr/bin/env node
/* F3.3.10-DESKTOP — TESTE DOM (regressão crítica): "Nova tarefa" deve aceitar digitação.
 *
 * Carrega o RENDERER REAL (src/renderer/index.html) num Chromium headless, com o Firebase STUBADO
 * (sem rede), força uma sessão desktop, abre o wizard "Nova tarefa" na etapa "Dados", digita nos
 * campos e dispara uma NOTIFICAÇÃO CAPTURADA (F3.3.10). Prova que a captura NÃO reconstrói a tela
 * ativa enquanto o usuário edita/digita (não rouba foco nem apaga o formulário) e, ao mesmo tempo,
 * que a Central CONTINUA atualizando ao vivo quando o usuário está ocioso na aba de notificações.
 *
 * Cenários:
 *   S1 form_on_notificacoes  — form aberto + aba 'notificacoes' + captura  => form sobrevive (REGRESSÃO)
 *   S2 form_on_tarefas (FAB) — form aberto + aba 'tarefas'      + captura  => form sobrevive
 *   S3 live_update_idle      — aba 'notificacoes', sem edição   + captura  => Central re-renderiza ao vivo
 *   S4 search_focus_kept     — aba 'notificacoes', foco na busca + captura => foco/valor da busca mantidos
 *
 * Puro local: sem rede, sem Firestore, sem build. Se não houver Chromium, faz SKIP (não quebra CI).
 * Rodar: /opt/node22/bin/node desktop/scripts/f33B-form-typing.test.mjs
 *        (CHROME_BIN=/caminho/chrome para apontar um navegador específico) */
import fs from 'fs'; import path from 'path'; import os from 'os'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src', 'renderer', 'index.html');

// ── localizar um Chromium ──────────────────────────────────────────────────────────────────────
function findChrome(){
  const cands = [];
  if (process.env.CHROME_BIN) cands.push(process.env.CHROME_BIN);
  try { for (const d of fs.readdirSync('/opt/pw-browsers')) if (/^chromium-\d+$/.test(d)) cands.push('/opt/pw-browsers/'+d+'/chrome-linux/chrome'); } catch (_) {}
  cands.push('/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/usr/bin/google-chrome-stable');
  for (const c of cands) { try { if (c && fs.existsSync(c)) return c; } catch (_) {} }
  return null;
}
const CHROME = findChrome();

let html = fs.readFileSync(SRC, 'utf8');
// invariante estática (vale mesmo sem navegador): a captura respeita a guarda de edição.
const bi = html.indexOf('F3.3.10-NOTIF-CENTRAL BEGIN'), ei = html.indexOf('F3.3.10-NOTIF-CENTRAL END');
const block = bi >= 0 && ei >= 0 ? html.slice(html.lastIndexOf('/*', bi), html.indexOf('*/', ei) + 2) : '';
let spass = 0, sfail = 0;
const sok = (n, c) => { if (c) spass++; else { sfail++; console.log('FAIL (estático):', n); } };
sok('ncCaptureBusy() existe no bloco NOTIF-CENTRAL', /function ncCaptureBusy\(\)/.test(block));
sok('ncCaptureBusy considera state.form (wizard/edição)', /ncCaptureBusy[\s\S]*?state\.form/.test(block));
sok('ncCaptureBusy reusa _editingNow (invariante do render)', /ncCaptureBusy[\s\S]*?_editingNow\(\)/.test(block));
sok('ncCaptureBusy detecta input/textarea/select em foco', /ncCaptureBusy[\s\S]*?(INPUT|TEXTAREA|SELECT)/.test(block));
sok('re-render da captura é guardado por !ncCaptureBusy()', /state\.tab==='notificacoes'&&!ncCaptureBusy\(\)/.test(html));
sok('notifBadgeRefresh continua sempre chamado (atualização mínima)', /\}\s*notifBadgeRefresh\(\);\s*\}catch/.test(html));

if (!CHROME) {
  console.log('\nF3.3.10 FORM-TYPING (estático): ' + spass + ' PASS / ' + sfail + ' FAIL');
  console.log('SKIP DOM: nenhum Chromium encontrado (defina CHROME_BIN para rodar a prova DOM real).');
  process.exit(sfail ? 1 : 0);
}

// ── instrumentar a página: stub do Firebase + driver de cenários ────────────────────────────────
const fbStub = `<script>
window.firebase={initializeApp:function(){},firestore:Object.assign(function(){return{collection:function(){return{doc:function(){return{get:function(){return Promise.resolve({exists:false});},onSnapshot:function(){return function(){};},set:function(){return Promise.resolve();},update:function(){return Promise.resolve();}};},onSnapshot:function(){return function(){};},where:function(){return this;},orderBy:function(){return this;},add:function(){return Promise.resolve({id:'x'});}};}};},{FieldValue:{arrayUnion:function(){return{};},arrayRemove:function(){return{};},serverTimestamp:function(){return 0;},increment:function(){return 0;}}})};
</script>`;
html = html.replace('<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>', fbStub);
html = html.replace('<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>', '');

const driver = `<pre id="RESULT" style="position:fixed;left:0;top:0;z-index:99999;color:#0f0;background:#000;white-space:pre-wrap">PENDING</pre>
<script>
window.desktopAPI={isDesktop:true,notify:function(){return Promise.resolve({ok:true,channel:'toast'});},onNotifToast:function(){},onNotifHistory:function(){},onNotifOpen:function(){},sessionLogin:function(){},sessionLogout:function(){},notifTest:function(){return Promise.resolve(true);},autostartGet:function(){return Promise.resolve(false);},autostartSet:function(){return Promise.resolve(true);},appQuit:function(){return Promise.resolve();},openExternal:function(){return Promise.resolve(true);}};
function typeInto(el,text){ el.focus(); var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; for(var i=0;i<text.length;i++){ setter.call(el, el.value+text[i]); el.dispatchEvent(new InputEvent('input',{bubbles:true,data:text[i],inputType:'insertText'})); } }
function authed(){ state.user={id:'u1',name:'Bruno Alves',role:'Social Media',admin:true}; state.users=[{id:'u1',name:'Bruno Alves',role:'Social Media'},{id:'u2',name:'Marina Dias',role:'Designer'}]; state.tasks=[]; state.events=[]; document.body.classList.add('authed'); var lg=document.getElementById('login'); if(lg) lg.classList.add('hidden'); var ap=document.getElementById('app'); if(ap) ap.style.display='flex'; applyDesktopClass(); }
function resetAll(){ try{localStorage.removeItem('idseven.notif.history.v1');}catch(_){} state.form=null; if(typeof notifDetailId!=='undefined') notifDetailId=null; try{document.activeElement&&document.activeElement.blur&&document.activeElement.blur();}catch(_){} }
function cap(extra){ notifHistoryAppend(Object.assign({dedupKey:'k:'+Math.random(),eventType:'sla_warning',severity:'warning',title:'prazo próximo',taskId:'t'+Math.random(),createdAt:Date.now(),action:{}}, extra||{})); }

// S1 + S2 — form aberto deve sobreviver à captura (foco/valor preservados)
function scenForm(tab){
  resetAll(); state.form=newForm('cronograma'); state.form.step=1; state.tab=tab; render();
  var t1=document.getElementById('fTitle'), c1=document.getElementById('fClient');
  var rendered=!!(t1&&c1);
  if(t1) typeInto(t1,'Cronograma teste'); if(c1) typeInto(c1,'Hospital Visão');
  cap();   // notificação capturada chega enquanto o usuário digita
  var t2=document.getElementById('fTitle'), c2=document.getElementById('fClient');
  return { rendered:rendered, survived:!!(t2&&c2), title:t2?t2.value:null, client:c2?c2.value:null,
           focusKept:!!(document.activeElement&&(document.activeElement.id==='fTitle'||document.activeElement.id==='fClient')) };
}
// S3 — ocioso na Central: a captura DEVE atualizar a lista ao vivo
function scenLiveIdle(){
  resetAll(); state.tab='notificacoes'; cap({title:'primeira'}); render();   // 1 item já no histórico
  try{document.activeElement&&document.activeElement.blur&&document.activeElement.blur();}catch(_){}
  cap({title:'CHEGOU AO VIVO'});                                              // nova captura, sem edição
  var c=document.getElementById('content'); var h=c?c.innerHTML:'';
  return { isCentral:/nc-wrap/.test(h), liveAppeared:/CHEGOU AO VIVO/.test(h) };
}
// S4 — foco na busca da Central: a captura NÃO pode roubar o foco
function scenSearchFocus(){
  resetAll(); state.tab='notificacoes'; cap({title:'um'}); cap({title:'dois'}); render();
  var s=document.getElementById('ncSearch'); var had=!!s;
  if(s){ typeInto(s,'um'); }
  cap({title:'novo durante busca'});
  var s2=document.getElementById('ncSearch');
  return { had:had, focusKept:!!(document.activeElement&&document.activeElement.id==='ncSearch'), value:s2?s2.value:null };
}
function run(){
  var R={};
  try{ authed(); R.isDesktop=isDesktop();
    R.S1=scenForm('notificacoes'); R.S2=scenForm('tarefas'); R.S3=scenLiveIdle(); R.S4=scenSearchFocus();
  }catch(e){ R.ERROR=String(e&&e.stack||e); }
  document.getElementById('RESULT').textContent='RESULT_JSON='+JSON.stringify(R);
}
if(document.readyState==='complete'||document.readyState==='interactive') setTimeout(run,250); else document.addEventListener('DOMContentLoaded',function(){setTimeout(run,250);});
</script>`;
html = html.replace('</body>', driver + '\n</body>');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f33b-'));
const appFile = path.join(tmp, 'app.html');
fs.writeFileSync(appFile, html);

let dom = '';
try {
  dom = execFileSync(CHROME, ['--headless=new','--no-sandbox','--disable-gpu','--window-size=1320,900','--virtual-time-budget=4000','--run-all-compositor-stages-before-draw','--dump-dom','file://'+appFile], { encoding: 'utf8', maxBuffer: 96*1024*1024, stdio: ['ignore','pipe','ignore'] });
} catch (e) { console.error('::error:: falha ao rodar o Chromium headless:', e.message); process.exit(1); }
const m = dom.match(/RESULT_JSON=(\{[\s\S]*?\})<\/pre>/) || dom.match(/RESULT_JSON=(\{[\s\S]*\})/);
if (!m) { console.error('::error:: o driver DOM não produziu RESULT_JSON'); console.error(dom.slice(0, 900)); process.exit(1); }
let R; try { R = JSON.parse(m[1]); } catch (e) { console.error('::error:: RESULT_JSON inválido:', m[1].slice(0,300)); process.exit(1); }
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}

let pass = spass, fail = sfail;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL (DOM):', n); } };
if (R.ERROR) { console.error('::error:: erro no driver DOM:', R.ERROR); process.exit(1); }
ok('ambiente desktop ativo (isDesktop)', R.isDesktop === true);
// S1 — a REGRESSÃO: "Nova tarefa" sobre a aba de notificações deve aceitar digitação
ok('S1 form (notificacoes): wizard "Dados" renderizou', R.S1 && R.S1.rendered === true);
ok('S1 form (notificacoes): formulário SOBREVIVE à captura', R.S1 && R.S1.survived === true);
ok('S1 form (notificacoes): "Cronograma teste" preservado', R.S1 && R.S1.title === 'Cronograma teste');
ok('S1 form (notificacoes): "Hospital Visão" preservado', R.S1 && R.S1.client === 'Hospital Visão');
ok('S1 form (notificacoes): foco mantido no campo', R.S1 && R.S1.focusKept === true);
// S2 — caminho do FAB (aba tarefas) permanece intacto
ok('S2 form (tarefas/FAB): formulário SOBREVIVE à captura', R.S2 && R.S2.survived === true);
ok('S2 form (tarefas/FAB): valores e foco preservados', R.S2 && R.S2.title === 'Cronograma teste' && R.S2.client === 'Hospital Visão' && R.S2.focusKept === true);
// S3 — a Central continua ao vivo quando ocioso (fix não matou o recurso)
ok('S3 live: Central segue renderizada após captura', R.S3 && R.S3.isCentral === true);
ok('S3 live: nova notificação aparece ao vivo (ocioso)', R.S3 && R.S3.liveAppeared === true);
// S4 — captura não rouba o foco da busca
ok('S4 busca: campo de busca existe', R.S4 && R.S4.had === true);
ok('S4 busca: foco mantido na busca após captura', R.S4 && R.S4.focusKept === true);

console.log('\nF3.3.10 FORM-TYPING (estático+DOM): ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: regressão de digitação no formulário / captura roubando foco'); process.exit(1); }
console.log('OK — "Nova tarefa" aceita digitação mesmo com a aba de notificações ativa; a captura é PASSIVA durante edição/foco (não apaga o formulário nem rouba o foco); a Central continua atualizando ao vivo quando ocioso; FAB intacto.');
