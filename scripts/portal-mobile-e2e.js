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
      if(u.includes('/state'))return j(window.__stateResp||{ok:false});
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
    // rodapé com 0/3: NÃO pode oferecer finalização. V64.53: orientação no #guide
    // (fluxo da página) e barra fixa SÓ com botões — nunca texto atrás de botão.
    const f0=await p.evaluate(()=>({guide:(document.getElementById('guide')||{}).textContent||'',
      inner:document.querySelector('.gactions .inner').textContent.trim(),
      temAprovar:!!document.querySelector('[data-act="approveAll"]'),temRevisar:!!document.querySelector('[data-act="reviewNext"]')}));
    check(`[${tag}] 0/3: rodapé SEM 'Aprovar temas' (orienta revisão no guia)`,!f0.temAprovar&&f0.temRevisar&&f0.guide.includes('cada conteúdo'));
    check(`[${tag}] barra fixa SÓ-botões (sem parágrafo na barra)`,f0.inner.length<46,JSON.stringify(f0.inner));
    // PROVA DE NÃO-SOBREPOSIÇÃO: --cta-h medido >= altura real da barra; o conteúdo
    // termina ACIMA dela mesmo rolado até o fim (nenhum texto sob os botões).
    const ov=await p.evaluate(()=>{const ga=document.querySelector('.gactions');const gh=ga.offsetHeight;
      const cta=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cta-h'))||0;
      window.scrollTo(0,document.documentElement.scrollHeight);
      const gr=ga.getBoundingClientRect();
      // probe no CENTRO do botão primário (a casca da barra é pointer-events:none de propósito)
      const btn=ga.querySelector('.btn.primary')||ga.querySelector('.btn');const br=btn.getBoundingClientRect();
      const probe=document.elementFromPoint(Math.round(br.left+br.width/2),Math.round(br.top+br.height/2));
      let lastBottom=0;document.querySelectorAll('.wrap > *').forEach(el=>{const r=el.getBoundingClientRect();if(r.height>0)lastBottom=Math.max(lastBottom,r.bottom);});
      return {gh,cta,probeNaBarra:btn.contains(probe)||probe===btn,lastBottom:Math.round(lastBottom),barTop:Math.round(gr.top)};});
    check(`[${tag}] --cta-h cobre a barra real (cta=${ov.cta} >= barra=${ov.gh})`,ov.cta>=ov.gh-1&&ov.gh<150);
    check(`[${tag}] conteúdo termina ACIMA da barra rolado até o fim (${ov.lastBottom} <= ${ov.barTop})`,ov.lastBottom<=ov.barTop+1&&ov.probeNaBarra);
    await p.evaluate(()=>window.scrollTo(0,0));
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
      guide:(document.getElementById('guide')||{}).textContent||'',
      temAprovar:!!document.querySelector('[data-act="approveAll"]')}));
    check(`[${tag}] ajuste pendente: rodapé 'Enviar feedback' (sem Aprovar temas; guia explica)`,fr.fb&&!fr.temAprovar&&fr.guide.includes('ajustes solicitados'));
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
    // clique final fecha a fase → tela PREMIUM 'Temas aprovados' (V64.53)
    await p.evaluate(()=>{document.querySelector('[data-act="approveAll"]').scrollIntoView({block:'center'});});
    await tapSel(p,'[data-act="approveAll"]');
    await new Promise(r=>setTimeout(r,400));
    const done=await p.evaluate(()=>({succ:!!document.querySelector('.succcard'),
      h1:(document.querySelector('.succcard h1')||{}).textContent||'',
      p:(document.querySelector('.succcard p')||{}).textContent||'',
      ga:!!document.querySelector('.gactions'),
      closeBtn:!!document.querySelector('[data-act="closePage"]'),
      note:document.body.textContent.includes('Você já pode fechar esta página')}));
    check(`[${tag}] 'Aprovar temas' → tela premium 'Temas aprovados' (copy exata da produção)`,
      done.succ&&done.h1==='Temas aprovados'&&done.p.includes('produção das artes, legendas e posts'));
    check(`[${tag}] sucesso SEM barra fixa antiga + fallback 'Fechar página' visível`,!done.ga&&done.closeBtn&&done.note);
    // PERSISTÊNCIA: o /state passa a devolver estado VÁLIDO e DIFERENTE (sem SUCCESS_MODE o
    // poller repintaria o cronograma) → espera 2 ciclos (13s) e a tela de sucesso FICA.
    await p.evaluate(()=>{window.__stateResp={ok:true,finalDone:false,pendingRevision:false,
      items:[{cs:'aprovado',tema:'X1',legenda:'L'},{cs:'aprovado',tema:'X2',legenda:'L'},{cs:'aprovado',tema:'X3',legenda:'L'}]};});
    await new Promise(r=>setTimeout(r,13000));
    const persist=await p.evaluate(()=>({succ:!!document.querySelector('.succcard'),
      cards:document.querySelectorAll('#contents [data-card]').length,
      h1:(document.querySelector('.succcard h1')||{}).textContent||''}));
    check(`[${tag}] sucesso PERSISTE após 2 ciclos do poller (sem voltar ao cronograma)`,
      persist.succ&&persist.h1==='Temas aprovados'&&persist.cards===0);
    if(tag==='390x844')await p.screenshot({path:'/tmp/audit/m8-sucesso-temas-390.png'});
    if(tag==='412x915')await p.screenshot({path:'/tmp/audit/m5-fase-fechada-412.png'});
    await p.close();
  }

  // V64.53 — ESTADO F: aprovação final → tela 'Cronograma finalizado com sucesso'
  // (o poller detecta finalDone e encerra; a tela PERSISTE — SUCCESS_MODE trava re-render).
  {
    const pf=await newPortalPage(b,{w:390,h:844,withSub:true});
    await pf.evaluate(()=>{window.__stateResp={ok:true,finalDone:true,items:[]};});
    await new Promise(r=>setTimeout(r,7000));
    const fin=await pf.evaluate(()=>({succ:!!document.querySelector('.succcard'),
      h1:(document.querySelector('.succcard h1')||{}).textContent||'',
      ga:!!document.querySelector('.gactions'),
      closeBtn:!!document.querySelector('[data-act="closePage"]'),
      note:document.body.textContent.includes('Você já pode fechar esta página')}));
    check("[finalDone] tela premium 'Cronograma finalizado com sucesso' + sem barra + 'Fechar página'",
      fin.succ&&fin.h1==='Cronograma finalizado com sucesso'&&!fin.ga&&fin.closeBtn&&fin.note);
    await new Promise(r=>setTimeout(r,7000));
    const fin2=await pf.evaluate(()=>({h1:(document.querySelector('.succcard h1')||{}).textContent||'',
      cards:document.querySelectorAll('#contents [data-card]').length}));
    check("[finalDone] tela final PERSISTE após novo ciclo do poller",fin2.h1==='Cronograma finalizado com sucesso'&&fin2.cards===0);
    await pf.screenshot({path:'/tmp/audit/m9-final-390.png'});
    await pf.close();
  }

  // V64.52 — produção SEM toast flutuante: livebar ausente; únicos fixed = gactions (+pgate qdo aberto)
  {
    const p3=await newPortalPage(b,{w:390,h:844,withSub:true});
    await new Promise(r=>setTimeout(r,6500));   // espera 1 ciclo do poller (6s)
    const float=await p3.evaluate(()=>{
      const fixed=[...document.querySelectorAll('body *')].filter(el=>getComputedStyle(el).position==='fixed'&&el.offsetParent!==null||getComputedStyle(el).position==='fixed');
      return {livebar:!!document.getElementById('livebar'),
        fixedIds:fixed.map(e=>e.id||e.className).filter(c=>c&&String(c).indexOf('gactions')<0&&String(c).indexOf('toast')<0&&String(c).indexOf('scrim')<0&&String(c).indexOf('inner')<0).slice(0,6),
        liveDiag:localStorage.getItem('wp_diag_liveTick_tok_mobile_e2e_123')};
    });
    check('[v64.52] produção SEM livebar flutuante (estado vai p/ o diag)',!float.livebar&&!!float.liveDiag,JSON.stringify(float.fixedIds));
    await p3.screenshot({path:'/tmp/audit/m7-sem-livebar-390.png'});
    await p3.close();
    // mesma prova em 412×915 (exigência da reprovação 1.0.137: 390 E 412)
    const p4=await newPortalPage(b,{w:412,h:915,withSub:true});
    await new Promise(r=>setTimeout(r,6500));
    const f4=await p4.evaluate(()=>({livebar:!!document.getElementById('livebar'),
      liveDiag:localStorage.getItem('wp_diag_liveTick_tok_mobile_e2e_123')}));
    check('[v64.52][412x915] produção SEM livebar flutuante',!f4.livebar&&!!f4.liveDiag);
    await p4.screenshot({path:'/tmp/audit/m7-sem-livebar-412.png'});
    await p4.close();
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
