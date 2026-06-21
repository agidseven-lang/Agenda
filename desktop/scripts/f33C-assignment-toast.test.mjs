#!/usr/bin/env node
/* F3.3.10-DESKTOP — TESTE DOM: TOAST DE ATRIBUIÇÃO (Social Media → Designer).
 *
 * Carrega o RENDERER REAL no Chromium headless (Firebase stubado), captura os callbacks reais
 * onNotifToast/onNotifHistory e SIMULA a ordem de entrega do main (notif-history → notif-toast).
 * Prova que a compensação cirúrgica exibe o toast premium de atribuição no canto inferior direito,
 * UMA vez por dedupKey (sem duplicar), só com a janela visível (minimizado = nativa), e SEM afetar
 * as demais notificações (SLA/fluxo permanecem como antes — capture-only no histórico).
 *
 * Cenários:
 *   A nativeOnly_visible   — atribuição só por notif-history (main foi p/ nativa) + janela visível => 1 toast (FIX)
 *   B bothChannels_visible — atribuição por history E toast (ordem do main) => exatamente 1 (sem duplicar)
 *   C nativeOnly_hidden    — atribuição só por history + janela OCULTA => 0 (nativa cuida; aprovado)
 *   D sla_bothChannels     — sla_warning por history+toast => 1 (comportamento inalterado)
 *   E sla_historyOnly      — sla_warning só por history => 0 (captura é só histórico p/ não-atribuição)
 *
 * Estático: invariantes da compensação (helper, escopo, dedup, gating por visibilidade).
 * CI-safe: sem Chromium faz SKIP (não quebra). Rodar: /opt/node22/bin/node desktop/scripts/f33C-assignment-toast.test.mjs */
import fs from 'fs'; import path from 'path'; import os from 'os'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src', 'renderer', 'index.html');

function findChrome(){
  const c = [];
  if (process.env.CHROME_BIN) c.push(process.env.CHROME_BIN);
  try { for (const d of fs.readdirSync('/opt/pw-browsers')) if (/^chromium-\d+$/.test(d)) c.push('/opt/pw-browsers/'+d+'/chrome-linux/chrome'); } catch (_) {}
  c.push('/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/usr/bin/google-chrome-stable');
  for (const x of c) { try { if (x && fs.existsSync(x)) return x; } catch (_) {} }
  return null;
}
const CHROME = findChrome();
let html = fs.readFileSync(SRC, 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };

// ── invariantes estáticas (valem mesmo sem navegador) ──
ok('helper notifIsAttrEvent escopa designer_assigned/task_assigned', /function notifIsAttrEvent\(p\)\{ var e=p&&p\.eventType; return e==='designer_assigned'\|\|e==='task_assigned'; \}/.test(html));
ok('notifAttrToastOnce dedup por dedupKey e chama notifShowToast', /function notifAttrToastOnce\(p\)\{[\s\S]*?notifAttrToastSeen\[k\][\s\S]*?notifShowToast\(p\)/.test(html));
ok('onNotifToast: atribuição via once-guard, demais via notifShowToast', /onNotifToast\(function\(p\)\{ if\(notifIsAttrEvent\(p\)\)\{ notifAttrToastOnce\(p\); \} else \{ notifShowToast\(p\); \}/.test(html));
ok('onNotifHistory compensa atribuição só com janela visível', /onNotifHistory\(function\(p\)\{[\s\S]*?if\(notifIsAttrEvent\(p\) && \(typeof document==='undefined'\|\|document\.visibilityState!=='hidden'\)\) notifAttrToastOnce\(p\)/.test(html));
ok('toast de atribuição tem layout em linhas próprio (isAttr)', /if\(isAttr\)\{[\s\S]*?ntf-ti">atribuiu uma tarefa<\/div>[\s\S]*?ntf-attr-task[\s\S]*?ntf-attr-cli/.test(html));
ok('layout de atribuição não afeta demais toasts (else mantém estrutura)', /\} else \{\s*el\.innerHTML='<div class="ntf-card">'\+av/.test(html));

if (!CHROME) {
  console.log('\nF3.3.10 ASSIGNMENT-TOAST (estático): ' + pass + ' PASS / ' + fail + ' FAIL');
  console.log('SKIP DOM: nenhum Chromium encontrado (defina CHROME_BIN p/ a prova DOM real).');
  process.exit(fail ? 1 : 0);
}

const pre = `<script>
window.firebase={initializeApp:function(){},firestore:Object.assign(function(){return{collection:function(){return{doc:function(){return{get:function(){return Promise.resolve({exists:false});},onSnapshot:function(){return function(){};}};},onSnapshot:function(){return function(){};},where:function(){return this;},orderBy:function(){return this;}};}};},{FieldValue:{arrayUnion:function(){return{};},serverTimestamp:function(){return 0;}}})};
window.__cbs={toast:null,hist:null};
window.desktopAPI={isDesktop:true,notify:function(){return Promise.resolve({ok:true,channel:'toast'});},onNotifToast:function(cb){window.__cbs.toast=cb;},onNotifHistory:function(cb){window.__cbs.hist=cb;},onNotifOpen:function(){},sessionLogin:function(){},sessionLogout:function(){}};
</script>`;
html = html.replace('<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>', pre).replace('<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>', '');

const driver = `<pre id="RESULT" style="position:fixed;z-index:99999;color:#0f0;background:#000;white-space:pre-wrap">PENDING</pre>
<script>
function vis(v){ try{ Object.defineProperty(document,'visibilityState',{get:function(){return v;},configurable:true}); }catch(_){} }
function nNtf(){ return document.querySelectorAll('.ntf').length; }
function clearNtf(){ document.querySelectorAll('.ntf').forEach(function(e){e.remove();}); }
function go(){
  var R={};
  try{
    state.user={id:'designer1',name:'Miercohévisk Niheb',role:'Designer'};
    state.users=[{id:'social1',name:'Arydyjany Carlôto',role:'Social Media'},{id:'designer1',name:'Miercohévisk Niheb',role:'Designer'}];
    state.tasks=[{id:'t1',title:'Cronograma semanal',client:'Hospital Visão',designerAssignment:{designerId:'designer1',assignedBy:'social1',designerName:'Miercohévisk Niheb',assignedAt:Date.now()}}];
    document.body.classList.add('authed'); var ap=document.getElementById('app'); if(ap) ap.style.display='flex'; applyDesktopClass();
    R.cbsWired = !!(window.__cbs.toast && window.__cbs.hist);
    var mk=function(k){ return {eventType:'designer_assigned',source:'notifier',taskId:'t1',taskTitle:'Cronograma semanal',clientName:'Hospital Visão',actorId:'social1',responsibleId:'designer1',responsibleName:'Miercohévisk Niheb',title:'Arydyjany Carlôto atribuiu uma tarefa',body:'x',context:'Etapa: Aguardando produção',severity:'info',sound:false,action:{type:'board',deep:'board/cronograma'},dedupKey:k}; };
    vis('visible'); clearNtf(); var b=nNtf(); window.__cbs.hist(mk('designer_assigned:t1:A')); R.A_nativeOnly_visible=nNtf()-b;
    vis('visible'); clearNtf(); b=nNtf(); var pB=mk('designer_assigned:t1:B'); window.__cbs.hist(pB); window.__cbs.toast(pB); R.B_bothChannels_visible=nNtf()-b;
    vis('hidden'); clearNtf(); b=nNtf(); window.__cbs.hist(mk('designer_assigned:t1:C')); R.C_nativeOnly_hidden=nNtf()-b;
    vis('visible'); clearNtf(); b=nNtf(); var pD={eventType:'sla_warning',taskId:'t9',taskTitle:'Arte',clientName:'X',severity:'warning',title:'prazo próximo',responsibleName:'Miercohévisk Niheb',sound:false,action:{type:'detail',deep:'detail/t9'},dedupKey:'sla_warning:t9'}; window.__cbs.hist(pD); window.__cbs.toast(pD); R.D_sla_bothChannels=nNtf()-b;
    vis('visible'); clearNtf(); b=nNtf(); window.__cbs.hist({eventType:'sla_warning',taskId:'t8',title:'x',severity:'warning',sound:false,dedupKey:'sla_warning:t8'}); R.E_sla_historyOnly=nNtf()-b;
    // F — estrutura em linhas do toast de atribuição (Problema 2): nome / "atribuiu uma tarefa" / tarefa / cliente / responsável / etapa
    vis('visible'); clearNtf(); window.__cbs.hist(mk('designer_assigned:t1:F'));
    var nf=document.querySelector('.ntf');
    R.struct = nf ? { who:(nf.querySelector('.ntf-hd b')||{}).textContent||'', line2:(nf.querySelector('.ntf-ti')||{}).textContent||'', task:(nf.querySelector('.ntf-attr-task')||{}).textContent||'', cli:(nf.querySelector('.ntf-attr-cli')||{}).textContent||'', resp:(nf.querySelector('.ntf-resp')||{}).textContent||'', etapa:(nf.querySelector('.ntf-ctx')||{}).textContent||'' } : null;
    // controle: SLA NÃO usa o layout de atribuição
    clearNtf(); window.__cbs.toast({eventType:'sla_warning',taskId:'t7',taskTitle:'Arte',clientName:'X',severity:'warning',title:'prazo próximo',sound:false,dedupKey:'sla_warning:t7'});
    var ns=document.querySelector('.ntf'); R.sla_hasAttrLayout = !!(ns && ns.querySelector('.ntf-attr-task'));
  }catch(e){ R.ERROR=String(e&&e.stack||e); }
  document.getElementById('RESULT').textContent='RESULT_JSON='+JSON.stringify(R);
}
if(document.readyState!=='loading') setTimeout(go,250); else document.addEventListener('DOMContentLoaded',function(){setTimeout(go,250);});
</script>`;
html = html.replace('</body>', driver + '\n</body>');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f33c-'));
const appFile = path.join(tmp, 'app.html');
fs.writeFileSync(appFile, html);
let dom = '';
try { dom = execFileSync(CHROME, ['--headless=new','--no-sandbox','--disable-gpu','--window-size=1320,900','--virtual-time-budget=3500','--dump-dom','file://'+appFile], { encoding: 'utf8', maxBuffer: 96*1024*1024, stdio: ['ignore','pipe','ignore'] }); }
catch (e) { console.error('::error:: falha no Chromium headless:', e.message); process.exit(1); }
const m = dom.match(/RESULT_JSON=(\{[\s\S]*?\})<\/pre>/) || dom.match(/RESULT_JSON=(\{[\s\S]*\})/);
if (!m) { console.error('::error:: driver DOM não produziu RESULT_JSON'); console.error(dom.slice(0,800)); process.exit(1); }
let R; try { R = JSON.parse(m[1]); } catch (e) { console.error('::error:: RESULT_JSON inválido'); process.exit(1); }
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
if (R.ERROR) { console.error('::error:: erro no driver DOM:', R.ERROR); process.exit(1); }

ok('callbacks reais onNotifToast/onNotifHistory registrados', R.cbsWired === true);
ok('A — atribuição (nativa-only) + visível: toast premium aparece (FIX)', R.A_nativeOnly_visible === 1);
ok('B — atribuição (history+toast): exatamente 1 toast (sem duplicar)', R.B_bothChannels_visible === 1);
ok('C — atribuição + janela oculta: 0 toast in-app (nativa cuida)', R.C_nativeOnly_hidden === 0);
ok('D — sla (history+toast): 1 toast (inalterado)', R.D_sla_bothChannels === 1);
ok('E — sla só por captura: 0 toast (captura é só histórico p/ não-atribuição)', R.E_sla_historyOnly === 0);
// F — estrutura em linhas (Problema 2): sem cortar/espremer informação
ok('F — linha 1 = nome de quem atribuiu', R.struct && R.struct.who === 'Arydyjany Carlôto');
ok('F — linha 2 = "atribuiu uma tarefa"', R.struct && R.struct.line2 === 'atribuiu uma tarefa');
ok('F — linha 3 = tarefa (Cronograma semanal)', R.struct && R.struct.task === 'Cronograma semanal');
ok('F — linha 4 = cliente (Hospital Visão)', R.struct && R.struct.cli === 'Hospital Visão');
ok('F — Responsável (designer) presente', R.struct && /Respons[áa]vel:\s*Miercohévisk Niheb/.test(R.struct.resp));
ok('F — Etapa presente', R.struct && /Etapa:/.test(R.struct.etapa));
ok('F — SLA NÃO usa o layout de atribuição (não afeta outros toasts)', R.sla_hasAttrLayout === false);

console.log('\nF3.3.10 ASSIGNMENT-TOAST (estático+DOM): ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: toast de atribuição divergiu do contrato'); process.exit(1); }
console.log('OK — toast premium de atribuição (Social → Designer) aparece no canto inferior direito quando a janela está visível, uma vez por dedupKey (sem duplicar); minimizado usa nativa; SLA/fluxo inalterados.');
