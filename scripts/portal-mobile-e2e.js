/* E2E MOBILE do portal REAL (HTML do renderClientHtml V64.51) — toque puro (touchscreen),
   viewports 390×844 e 412×915. Stubs: fetch (Worker), serviceWorker/PushManager/Notification.
   Valida: gate aparece → ativar/skip; cards abrem por TOQUE; aprovar item a item;
   rodapé 3 estados; ajuste → Enviar feedback; nada bloqueia os toques (elementFromPoint). */
const puppeteer=require('/tmp/browsershot/node_modules/puppeteer');
const CHROME='/root/.cache/puppeteer/chrome/linux-149.0.7827.22/chrome-linux64/chrome';
let PASS=0,FAIL=0;const out=[];
function check(n,ok,extra){const s=ok?'PASS':'FAIL';if(ok)PASS++;else FAIL++;const l=`${s} ${n}${extra?(' · '+extra):''}`;out.push(l);console.log(l);}
async function newPortalPage(b,{w,h,withSub}){
  const p=await b.newPage();
  await p.emulate({viewport:{width:w,height:h,isMobile:true,hasTouch:true,deviceScaleFactor:2},
    userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'});
  await p.evaluateOnNewDocument((withSub)=>{
    // stubs do ambiente do navegador (Push API + SW) — permissão SÓ via clique
    const sub={endpoint:'https://fcm.googleapis.com/fcm/send/FAKE_'+(withSub?'OLD':'NEW'),
      toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'p',auth:'a'}};}};
    const reg={scope:'https://aprovar.agendaidseven.com.br/cliente/',
      pushManager:{getSubscription:async()=>withSub?sub:null,subscribe:async()=>sub}};
    Object.defineProperty(navigator,'serviceWorker',{value:{
      register:async()=>reg,getRegistration:async()=>reg,ready:Promise.resolve(reg),
      controller:{},addEventListener(){},
    }});
    window.PushManager=function(){};
    window.Notification={permission:'default',requestPermission:async()=>{window.__permAsked=true;window.Notification.permission='granted';return 'granted';}};
    window.__posts=[];
    const realFetch=window.fetch;
    window.fetch=async(url,opts)=>{
      const u=String(url);window.__posts.push({u,body:opts&&opts.body});
      const j=(o)=>({ok:true,status:200,json:async()=>o,text:async()=>JSON.stringify(o)});
      if(u.includes('/push/subscribe'))return j({ok:true,taskId:'t-mobile',vapidConfigured:true});
      if(u.includes('/push/test'))return j({ok:true,sent:1,total:1,results:[{endpoint:'https://fcm.googleapis.com/…FAKE',ok:true,status:201}]});
      if(u.includes('/state'))return j({ok:false});
      if(u.includes('/api')||u.includes('cronograma'))return j({ok:true,phase:'themes'});
      return j({ok:true});
    };
    localStorage.clear();
    window.confirm=()=>true;
  },withSub);
  const errs=[];p.on('pageerror',e=>errs.push(String(e).split('\n')[0]));
  await p.goto('file:///tmp/audit/portal-mobile.html',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,500));
  p.__errs=errs;
  return p;
}
const tapSel=async(p,sel)=>{
  await p.evaluate(sel=>{const el=document.querySelector(sel);if(el)el.scrollIntoView({block:'center'});},sel);
  await new Promise(r=>setTimeout(r,180));
  const el=await p.$(sel);if(!el)throw new Error('tapSel: nao achei '+sel);
  const bb=await el.boundingBox();if(!bb)throw new Error('tapSel: invisivel '+sel);
  await p.touchscreen.tap(bb.x+bb.width/2,bb.y+Math.min(bb.height/2,24));
  await new Promise(r=>setTimeout(r,280));};
(async()=>{
  const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox']});

  for(const [w,h,tag] of [[390,844,'390x844'],[412,915,'412x915']]){
    const p=await newPortalPage(b,{w,h,withSub:false});
    check(`[${tag}] sem erro JS no load`,p.__errs.length===0,p.__errs.join('|'));
    // A4 — gate de ativação assistida APARECE no 1º acesso
    const gate=await p.evaluate(()=>{const g=document.getElementById('pgate');if(!g)return null;
      const r=g.querySelector('.pg-card').getBoundingClientRect();
      return {visivel:r.width>200&&r.height>100,titulo:g.textContent.includes('Receba avisos deste cronograma em tempo real'),
        diag:localStorage.getItem('wp_diag_gateRendered_tok_mobile_e2e_123')};});
    check(`[${tag}] gate renderizado e VISÍVEL (título + diag gateRendered)`,!!gate&&gate.visivel&&gate.titulo&&!!gate.diag);
    if(tag==='390x844')await p.screenshot({path:'/tmp/audit/m1-gate-390.png'});
    // ativar avisos REAL (requestPermission só agora) → confirmação só com ok:true
    await tapSel(p,'#pgOn');
    await new Promise(r=>setTimeout(r,400));
    const act=await p.evaluate(()=>({perm:window.Notification.permission,asked:!!window.__permAsked,
      gate:!!document.getElementById('pgate'),
      cta:(document.getElementById('pushcta')||{}).textContent||'',
      sub:localStorage.getItem('wp_diag_lastSubscribeStatus_tok_mobile_e2e_123')}));
    check(`[${tag}] ativar → permissão pedida SÓ no clique, gate fecha, 'Avisos ativados ✓' com ok confirmado`,
      act.asked&&act.perm==='granted'&&!act.gate&&act.cta.includes('Avisos ativados ✓')&&String(act.sub).startsWith('ok'));
    // D — cards abrem por TOQUE (3 temas) e NADA bloqueia (elementFromPoint pertence ao card)
    const block=await p.evaluate(()=>{const c=document.querySelector('[data-card="0"] .chead');const r=c.getBoundingClientRect();
      const el=document.elementFromPoint(r.left+r.width/2,r.top+20);return c.contains(el)?'ok':('BLOQUEADO por '+(el&&el.tagName)+'.'+(el&&el.className));});
    check(`[${tag}] toque no card 1 não é bloqueado por overlay`,block==='ok',block);
    for(const i of [0,1,2]){
      const was=await p.evaluate(i=>document.querySelector(`[data-card="${i}"]`).classList.contains('is-open'),i);
      await tapSel(p,`[data-card="${i}"] .chead`);
      const now=await p.evaluate(i=>document.querySelector(`[data-card="${i}"]`).classList.contains('is-open'),i);
      check(`[${tag}] toque alterna o Conteúdo ${i+1} (era ${was} → ${now})`,now!==was);
      if(!now)await tapSel(p,`[data-card="${i}"] .chead`);   // garante aberto p/ o resto
    }
    if(tag==='390x844')await p.screenshot({path:'/tmp/audit/m2-cards-abertos-390.png'});
    // rodapé com 0/3: NÃO pode oferecer finalização
    const f0=await p.evaluate(()=>({txt:document.querySelector('.gactions .inner').textContent,
      temAprovar:!!document.querySelector('[data-act="approveAll"]'),temRevisar:!!document.querySelector('[data-act="reviewNext"]')}));
    check(`[${tag}] 0/3: rodapé SEM 'Aprovar temas' (orienta revisão)`,!f0.temAprovar&&f0.temRevisar&&f0.txt.includes('cada conteúdo'));
    // aprovar 1 e 2 por toque
    for(const i of [0,1]){
      await p.evaluate(i=>{const c=document.querySelector(`[data-card="${i}"]`);c.classList.add('is-open');c.scrollIntoView({block:'center'});},i);
      await tapSel(p,`[data-card="${i}"] [data-act="approveItem"]`);
    }
    const f2=await p.evaluate(()=>({state:localStorage.getItem('wp_diag_footerState_tok_mobile_e2e_123'),
      temAprovar:!!document.querySelector('[data-act="approveAll"]')}));
    check(`[${tag}] 2/3 aprovados: ainda SEM finalização (footerState review)`,!f2.temAprovar&&String(f2.state).startsWith('review'));
    // pedir AJUSTE no 3 → rodapé vira Enviar feedback
    await p.evaluate(()=>{const c=document.querySelector('[data-card="2"]');c.classList.add('is-open');c.scrollIntoView({block:'center'});});
    await tapSel(p,'[data-card="2"] [data-act="reviseItem"]');
    await p.evaluate(()=>{document.getElementById('sIn').value='trocar a foto de capa';});
    await tapSel(p,'[data-x="send"]');
    const fr=await p.evaluate(()=>({fb:!!document.querySelector('[data-act="ackFeedback"]'),
      txt:document.querySelector('.gactions .inner').textContent}));
    check(`[${tag}] ajuste pendente: rodapé 'Enviar feedback' (sem Aprovar temas)`,fr.fb&&fr.txt.includes('ajustes solicitados'));
    if(tag==='390x844')await p.screenshot({path:'/tmp/audit/m3-feedback-390.png'});
    // aprovar o 3 (corrigido) → 3/3 → AGORA aparece 'Aprovar temas'; item NÃO fechou a fase
    await p.evaluate(()=>{const c=document.querySelector('[data-card="2"]');c.classList.add('is-open');c.scrollIntoView({block:'center'});});
    await tapSel(p,'[data-card="2"] [data-act="approveItem"]');
    const f3=await p.evaluate(()=>({temAprovar:!!document.querySelector('[data-act="approveAll"]'),
      cta:(document.querySelector('[data-act="approveAll"]')||{}).textContent||'',
      midcard:!!document.querySelector('.midcard')}));
    check(`[${tag}] 3/3: botão final 'Aprovar temas' aparece e a fase NÃO fechou sozinha`,
      f3.temAprovar&&f3.cta.includes('Aprovar temas')&&!f3.midcard);
    if(tag==='390x844')await p.screenshot({path:'/tmp/audit/m4-aprovar-390.png'});
    // clique final fecha a fase (tela 'Temas aprovados e enviados!')
    await p.evaluate(()=>{document.querySelector('[data-act="approveAll"]').scrollIntoView({block:'center'});});
    await tapSel(p,'[data-act="approveAll"]');
    await new Promise(r=>setTimeout(r,400));
    const done=await p.evaluate(()=>document.body.textContent.includes('Temas aprovados e enviados!'));
    check(`[${tag}] clique em 'Aprovar temas' fecha a fase (tela de confirmação)`,done);
    if(tag==='412x915')await p.screenshot({path:'/tmp/audit/m5-fase-fechada-412.png'});
    await p.close();
  }

  // cenário: inscrição EXISTENTE confirmada → SEM gate, indicador discreto
  const p2=await newPortalPage(b,{w:390,h:844,withSub:true});
  const noGate=await p2.evaluate(()=>({gate:!!document.getElementById('pgate'),
    cta:(document.getElementById('pushcta')||{}).textContent||''}));
  check('[inscrito] sem gate + indicador "Avisos ativados ✓" (re-save confirmado)',!noGate.gate&&noGate.cta.includes('Avisos ativados ✓'));
  // painel debug=1 (mesma página via query)
  await p2.evaluate(()=>{history.replaceState(null,'','?debug=1');});
  await p2.evaluate(()=>{try{pushDebugPanel();}catch(e){}});
  const dbg=await p2.evaluate(()=>{const d=document.getElementById('pdbg');return d?d.textContent:'';});
  check('[debug] painel com footerState/gateRendered/cardClickBound/lastPushEvent',
    dbg.includes('footerState')&&dbg.includes('gateRendered')&&dbg.includes('cardClickBound')&&dbg.includes('lastPushEvent'));
  await p2.screenshot({path:'/tmp/audit/m6-debug-390.png'});
  await p2.close();

  await b.close();
  out.forEach(l=>console.log(l));
  console.log(`\nPORTAL MOBILE E2E: ${PASS} PASS / ${FAIL} FAIL`);
  process.exit(FAIL?1:0);
})();
