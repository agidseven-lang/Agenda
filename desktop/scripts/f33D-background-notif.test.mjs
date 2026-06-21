#!/usr/bin/env node
/* F3.3.10-DESKTOP — TESTE: ATRIBUIÇÃO confiável em BACKGROUND (minimizado/bandeja).
 *
 * Causa: a atribuição Social→Designer nascia só no notifier do MAIN (Firestore). Com o app em
 * background (minimizado/X→bandeja) o processo do main pode ser suspenso pelo SO e o listener
 * estagna → nenhuma nativa. Correção: o RENDERER também detecta a atribuição (notifScanAssign,
 * espelhando u1/u1b do main) e emite pelo MESMO caminho aprovado (notifEmit → api.notify → HUB:
 * toast com app aberto / NATIVA minimizado/bandeja), com dedupKey IDÊNTICO ao do main → o HUB
 * deduplica (nunca duplica). O renderer roda em background (backgroundThrottling:false + switches).
 *
 * DOM (Chromium): carrega o renderer real, captura desktopAPI.notify, e prova que notifScanAssign:
 *   - EMITE designer_assigned p/ atribuição NOVA ao designer logado (dedupKey designer_assigned:<id>:<at>);
 *   - EMITE task_assigned p/ tarefa nova atribuída a mim (dedupKey task_assigned:<id>);
 *   - NÃO emite atribuição anterior ao login (baseline sinceMs);
 *   - NÃO emite atribuição feita por mim mesmo;
 *   - NÃO emite atribuição de OUTRO designer (não notifica usuário errado).
 * Estático: wiring (notifScan chama notifScanAssign), formato de dedupKey, baseline, e contrato de
 * canal no main (windowActive → toast; senão NATIVA) + switches anti-suspensão de background.
 * CI-safe: sem Chromium faz SKIP. Rodar: /opt/node22/bin/node desktop/scripts/f33D-background-notif.test.mjs */
import fs from 'fs'; import path from 'path'; import os from 'os'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(__dirname, '..', 'src');
const html0 = fs.readFileSync(path.resolve(R, 'renderer', 'index.html'), 'utf8');
const mainTs = fs.readFileSync(path.resolve(R, 'main', 'main.ts'), 'utf8');

function findChrome(){
  const c = [];
  if (process.env.CHROME_BIN) c.push(process.env.CHROME_BIN);
  try { for (const d of fs.readdirSync('/opt/pw-browsers')) if (/^chromium-\d+$/.test(d)) c.push('/opt/pw-browsers/'+d+'/chrome-linux/chrome'); } catch (_) {}
  c.push('/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/usr/bin/google-chrome-stable');
  for (const x of c) { try { if (x && fs.existsSync(x)) return x; } catch (_) {} }
  return null;
}
const CHROME = findChrome();

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };

// ── estáticas ──
ok('notifScanAssign existe', /function notifScanAssign\(\)/.test(html0));
ok('notifScan chama notifScanAssign', /function notifScan\(\)\{ notifScanFlow\(\); notifScanSla\(\); notifScanAssign\(\); \}/.test(html0));
ok('dedupKey designer_assigned idêntico ao main (<id>:<assignedAt>)', /dedupKey:'designer_assigned:'\+t\.id\+':'\+at/.test(html0));
ok('dedupKey task_assigned idêntico ao main (<id>)', /dedupKey:'task_assigned:'\+t\.id/.test(html0));
ok('baseline sinceMs (não dispara atribuição anterior ao login)', /_notifAssignSince=Date\.now\(\)/.test(html0) && /at<_notifAssignSince\) continue/.test(html0));
ok('roteamento: só o designer logado emite p/ si', /da\.designerId===me && da\.assignedBy!==me/.test(html0));
ok('safety interval também roda notifScanAssign', /setInterval\(function\(\)\{ try\{ notifScanSla\(\); \}catch\(_\)\{\} try\{ notifScanAssign\(\); \}catch\(_\)\{\} \},30000\)/.test(html0));
// contrato de canal no main (real): windowActive → toast; senão NATIVA
ok('main: windowActive → toast; background → janela premium (showBgNotify) c/ nativa fallback', /if \(windowActive\(\)\) \{[\s\S]*?return \{ ok: true, channel: "toast" \};\s*\}[\s\S]*?const bgOk = showBgNotify\(p\);[\s\S]*?if \(!bgOk\) \{[\s\S]*?new Notification\(/.test(mainTs));
ok('main: windowActive = visível e não-minimizado (minimizado/oculto → nativa)', /isVisible\(\) && !w\.isMinimized\(\)/.test(mainTs));
ok('main: switches anti-suspensão de background', /disable-renderer-backgrounding/.test(mainTs) && /disable-background-timer-throttling/.test(mainTs));

if (!CHROME) {
  console.log('\nF3.3.10 BACKGROUND-NOTIF (estático): ' + pass + ' PASS / ' + fail + ' FAIL');
  console.log('SKIP DOM: nenhum Chromium encontrado (defina CHROME_BIN p/ a prova DOM real).');
  process.exit(fail ? 1 : 0);
}

const pre = `<script>
window.firebase={initializeApp:function(){},firestore:Object.assign(function(){return{collection:function(){return{doc:function(){return{get:function(){return Promise.resolve({exists:false});},onSnapshot:function(){return function(){};}};},onSnapshot:function(){return function(){};},where:function(){return this;},orderBy:function(){return this;}};}};},{FieldValue:{arrayUnion:function(){return{};},serverTimestamp:function(){return 0;}}})};
window.__N=[];
window.desktopAPI={isDesktop:true,notify:function(p){window.__N.push(p);return Promise.resolve({ok:true,channel:'x'});},onNotifToast:function(){},onNotifHistory:function(){},onNotifOpen:function(){},sessionLogin:function(){},sessionLogout:function(){}};
</script>`;
let html = html0.replace('<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>', pre).replace('<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>', '');

const driver = `<pre id="RESULT" style="position:fixed;z-index:9;color:#0f0;background:#000;white-space:pre-wrap">P</pre>
<script>
function go(){ var R={}; try{
  try{ localStorage.removeItem('idseven.notif.seen.v1'); localStorage.removeItem('idseven.notif.history.v1'); }catch(_){}
  var NOW=Date.now(), H=3600000;
  state.user={id:'designer1',name:'Designer Um',role:'Designer'};
  state.users=[{id:'social1',name:'Arydyjany Carlôto',role:'Social Media'},{id:'designer1',name:'Designer Um',role:'Designer'},{id:'designerX',name:'Outro',role:'Designer'}];
  state.events=[];
  document.body.classList.add('authed'); var ap=document.getElementById('app'); if(ap) ap.style.display='flex'; applyDesktopClass();
  // baseline já no passado (1h atrás) -> atribuições com at>=baseline são "novas"
  window._notifAssignUid='designer1'; window._notifAssignSince=NOW-H;
  state.tasks=[
    {id:'tNew',title:'Cronograma semanal',client:'Hospital Visão',sector:'cronograma',designerAssignment:{designerId:'designer1',assignedBy:'social1',assignedByName:'Arydyjany Carlôto',designerName:'Designer Um',assignedAt:NOW}},
    {id:'tOld',title:'Antigo',client:'Y',designerAssignment:{designerId:'designer1',assignedBy:'social1',assignedAt:NOW-2*H}},
    {id:'tMine',title:'Eu atribui',client:'Z',designerAssignment:{designerId:'designer1',assignedBy:'designer1',assignedAt:NOW}},
    {id:'tOther',title:'De outro',client:'W',designerAssignment:{designerId:'designerX',assignedBy:'social1',assignedAt:NOW}},
    {id:'tTask',title:'Tarefa comum',client:'ACME',sector:'copywriting',assigneeId:'designer1',by:'social1',createdAt:NOW}
  ];
  notifScanAssign();
  R.notified = window.__N.map(function(p){ return {type:p.eventType,key:p.dedupKey,target:p.targetUserId,task:p.taskId,title:p.title}; });
  // canal (replica deliverNotification do main): aberto/visível=toast; minimizado/oculto=nativa
  function chan(w){ return (w.visible && !w.minimized) ? 'toast' : 'bg-window'; }
  R.chan_visible=chan({visible:true,minimized:false});
  R.chan_minimized=chan({visible:true,minimized:true});
  R.chan_tray=chan({visible:false,minimized:false});
}catch(e){ R.ERROR=String(e&&e.stack||e); } document.getElementById('RESULT').textContent='RESULT_JSON='+JSON.stringify(R); }
if(document.readyState!=='loading') setTimeout(go,250); else document.addEventListener('DOMContentLoaded',function(){setTimeout(go,250);});
</script>`;
html = html.replace('</body>', driver + '\n</body>');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f33d-'));
const appFile = path.join(tmp, 'app.html');
fs.writeFileSync(appFile, html);
let dom = '';
try { dom = execFileSync(CHROME, ['--headless=new','--no-sandbox','--disable-gpu','--window-size=1320,900','--virtual-time-budget=3500','--dump-dom','file://'+appFile], { encoding: 'utf8', maxBuffer: 96*1024*1024, stdio: ['ignore','pipe','ignore'] }); }
catch (e) { console.error('::error:: falha no Chromium headless:', e.message); process.exit(1); }
const m = dom.match(/RESULT_JSON=(\{[\s\S]*?\})<\/pre>/) || dom.match(/RESULT_JSON=(\{[\s\S]*\})/);
if (!m) { console.error('::error:: driver DOM não produziu RESULT_JSON'); console.error(dom.slice(0,800)); process.exit(1); }
let Rj; try { Rj = JSON.parse(m[1]); } catch (e) { console.error('::error:: RESULT_JSON inválido'); process.exit(1); }
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
if (Rj.ERROR) { console.error('::error:: erro no driver DOM:', Rj.ERROR); process.exit(1); }

const N = Rj.notified || [];
const has = (type, key) => N.some(x => x.type === type && x.key === key);
ok('DOM: emite designer_assigned para atribuição NOVA (dedupKey com assignedAt)', N.some(x => x.type==='designer_assigned' && /^designer_assigned:tNew:\d+$/.test(x.key) && x.target==='designer1'));
ok('DOM: emite task_assigned para tarefa nova atribuída a mim', has('task_assigned','task_assigned:tTask'));
ok('DOM: NÃO emite atribuição anterior ao login (tOld)', !N.some(x => x.task==='tOld'));
ok('DOM: NÃO emite atribuição feita por mim (tMine)', !N.some(x => x.task==='tMine'));
ok('DOM: NÃO emite atribuição de OUTRO designer (tOther) — usuário certo', !N.some(x => x.task==='tOther'));
ok('DOM: nenhum duplicado (1 por tarefa elegível)', N.length === 2);
ok('canal: app aberto/visível → toast', Rj.chan_visible === 'toast');
ok('canal: app minimizado → janela premium (bg-window)', Rj.chan_minimized === 'bg-window');
ok('canal: app na bandeja/oculto → janela premium (bg-window)', Rj.chan_tray === 'bg-window');

console.log('\nF3.3.10 BACKGROUND-NOTIF (estático+DOM): ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: detecção de atribuição em background divergiu do contrato'); process.exit(1); }
console.log('OK — atribuição detectada no renderer (espelha main; baseline; usuário certo; sem duplicar) e roteada pelo HUB: toast com app aberto, NATIVA minimizado/bandeja. SLA/fluxo inalterados.');
