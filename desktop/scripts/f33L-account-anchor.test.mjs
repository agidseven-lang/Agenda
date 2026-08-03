#!/usr/bin/env node
/* F3.3.17-R2 — CONTRATO da âncora global de conta/perfil/logout (.sb-user) no Desktop.
 * READ-ONLY sobre index.html: EXECUTA o construtor real do nav (branch isDesktop) com helpers
 * mockados e prova que o rodapé da sidebar emite .sb-user (foto+nome+papel, data-tab=perfil),
 * SEM reintroduzir overlays operacionais; e prova (estático) que a F3.3.15 (gate
 * isOperationalBoardContext do cornerAvatar/Monitor/sino), o logout e a R1 seguem intactos.
 * Rodar: /opt/node22/bin/node desktop/scripts/f33L-account-anchor.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
function fnSrc(n){ const a=HTML.indexOf('function '+n+'('); if(a<0)throw new Error('fn '+n); let d=0; for(let j=HTML.indexOf('{',a);j<HTML.length;j++){const c=HTML[j]; if(c==='{')d++; else if(c==='}'){d--; if(!d)return HTML.slice(a,j+1);}} }

let pass=0, fail=0;
const ok=(n,c)=>{ if(c)pass++; else {fail++; console.log('FAIL:',n);} };

/* ===== 1) Executa o construtor REAL do nav desktop e valida o .sb-user ===== */
const m = HTML.indexOf('nav.innerHTML=');
const elseIdx = HTML.indexOf('}else{', m);
const block = HTML.slice(m, elseIdx);   // "nav.innerHTML= ...';"
ok('nav: bloco isDesktop localizado', m>0 && elseIdx>m);
const build = new Function('TABS','sbItem','svg','avatar','esc','notifNavBadge','state','APP_VER',
  'var nav={};'+block+'return nav.innerHTML;');
const html = build(
  [],                                        // TABS (vazio p/ isolar o sb-user)
  ()=> '',                                    // sbItem
  ()=> '',                                    // svg
  (u,s)=>'«AV:'+((u&&u.name)||'')+':'+s+'»',  // avatar (marca foto+tamanho)
  (s)=> (s==null?'':String(s)),               // esc (identidade p/ teste)
  ()=> '',                                    // notifNavBadge
  { user:{ name:'Arydyjany Carlôto', role:'Social Media', admin:false, photo:'sm.png' } },
  { desktop:'0.0.0-teste', tag:'teste' }      // APP_VER stub (F3.3.72E: rodapé usa APP_VER desde G7)
);
ok('sb-user: classe presente', /class="sb-user"/.test(html));
ok('sb-user: abre Perfil (data-tab=perfil)', /class="sb-user"[^>]*data-tab="perfil"/.test(html));
ok('sb-user: nome do usuário', html.includes('Arydyjany Carlôto'));
ok('sb-user: papel do usuário', html.includes('Social Media'));
ok('sb-user: avatar do usuário (foto)', html.includes('«AV:Arydyjany Carlôto:34»'));
ok('sb-user: estrutura su-m/su-n/su-r', /su-m/.test(html)&&/su-n/.test(html)&&/su-r/.test(html));
// NÃO reintroduz overlays operacionais no nav (dashboard/quadros)
ok('nav: NÃO contém cornerAvatar', !/cornerAvatar/.test(html));
ok('nav: NÃO contém sla-monitor', !/sla-monitor/.test(html));
ok('nav: NÃO contém slaib-bell', !/slaib-bell/.test(html));

/* ===== 2) F3.3.15 preservada: cornerAvatar/Monitor/sino seguem gate Kanban-only ===== */
const slaib = fnSrc('slaibRefresh');
ok('F3.3.15: cornerAvatar gerido por isOperationalBoardContext()', /isOperationalBoardContext\(\)/.test(slaib));
ok('F3.3.15: cornerAvatar criado só no gate', /id='cornerAvatar'/.test(slaib));
ok('F3.3.15: cornerAvatar removido fora do gate', /else if\(_ca\)\{\s*_ca\.remove\(\)/.test(slaib));
const gate = fnSrc('isOperationalBoardContext');
ok('F3.3.15: gate exige board-mode', /board-mode/.test(gate));
ok('F3.3.15: gate exige superfície real do Kanban', /kbv2-board-surface|kcol/.test(gate));
ok('F3.3.15: gate barra fora de tarefas/form/clientView', /state\.tab!=='tarefas'/.test(gate));

/* ===== 3) Logout funcional: limpa sessão e volta ao login ===== */
const lo = fnSrc('logout');
ok('logout: clearSession()', /clearSession\(\)/.test(lo));
ok('logout: state.user=null', /state\.user=null/.test(lo));
ok('logout: mostra login', /getElementById\('login'\)\.classList\.remove\('hidden'\)/.test(lo));
ok('logout: remove overlays operacionais (cornerAvatar/monitor/sino)', /cornerAvatar/.test(lo)&&/sla-monitor/.test(lo)&&/slaib-bell/.test(lo));
ok('clearSession remove wp_uid', /function clearSession\([^)]*\)\{[^}]*wp_uid/.test(HTML.replace(/\n/g,' ')) || /removeItem\('wp_uid'\)/.test(HTML));

/* ===== 4) Boot/login gate intacto (sem sessão → Login; persistida → entra) ===== */
/* [ATUALIZADA F3.3.72E] O contrato antigo (boot lê wp_uid do localStorage) morreu na
   F3.3.56-G2: a sessão é restaurada SERVER-SIDE (token confinado ao main; boot chama
   desktopAPI.authSelf). O renderer NUNCA mais lê wp_uid — é isso que se trava agora. */
ok('boot: sessão restaurada server-side via desktopAPI.authSelf; renderer NÃO lê wp_uid', !/localStorage\.getItem\('wp_uid'\)/.test(HTML) && /api\.authSelf\(\)/.test(HTML));
/* [ATUALIZADA F3.5.4V-H1] O contrato antigo (boot ABRIA com renderLogin() incondicional)
   ERA a causa do bug de sessão no autostart do Windows: o login estático aparecia ANTES
   de o authSelf() confirmar a sessão. A correção mantém o mesmo ancoramento server-side
   (authSelf; nunca lê wp_uid), mas NÃO pinta login no arranque — mostra SPLASH neutro e só
   revela o login em NEGATIVA REAL (no_session/expired) via _revealLogin(). */
ok('boot: NÃO abre com renderLogin() incondicional (splash-first; login só em negativa real)',
  !/async function boot\(\)\{\s*renderLogin\(\)/.test(HTML) && /_revealLogin\(/.test(HTML) && /api\.authSelf\(\)/.test(HTML));
ok('render: barra app sem usuário (if(!state.user)return)', /function render\(\)\{[\s\S]{0,80}if\(!state\.user\)return/.test(HTML));

/* ===== 5) R1 preservada: assignment com ator denormalizado ===== */
ok('R1: assignedByName no assignment', /assignedByName:u\.name/.test(HTML));
ok('R1: assignedByAvatar no assignment', /assignedByAvatar:u\.photo\|\|u\.avatar/.test(HTML));

/* ===== 6) F3.3.17-R3 — contrato VISUAL do .sb-user (CSS premium + posição) ===== */
function ruleOf(sel){ const a=HTML.indexOf(sel+'{'); if(a<0)return ''; return HTML.slice(a, HTML.indexOf('}', a)); }
const suRule = ruleOf('body.desktop .nav .sb-user');
const footRule = ruleOf('body.desktop .nav .sb-footer');
const suM = ruleOf('body.desktop .nav .sb-user .su-m');
const suN = ruleOf('body.desktop .nav .sb-user .su-n');
const suR = ruleOf('body.desktop .nav .sb-user .su-r');
const avRule = ruleOf('body.desktop .nav .sb-user .av');
ok('R3: .sb-user min-height (2 linhas confortáveis)', /min-height:\s*5[4-9]px|min-height:\s*6\dpx/.test(suRule));
ok('R3: .sb-user mantém margin-top:auto (ÚNICA âncora inferior)', /margin-top:\s*auto/.test(suRule));
ok('R3: .sb-user margin-bottom (respiro até o card de versão)', /margin-bottom:\s*1[0-6]px/.test(suRule));
ok('R3: .sb-user padding confortável (9px 11px, não 7px 9px)', /padding:\s*9px 11px/.test(suRule) && !/padding:\s*7px 9px/.test(suRule));
ok('R3: .sb-user acabamento premium (borda + glass)', /border:1px solid/.test(suRule) && /background:linear-gradient/.test(suRule));
ok('R3: .sb-footer SEM margin-top:auto duplicado (corrige flutuar alto)', !/margin-top:\s*auto/.test(footRule));
ok('R3: .su-m flex:1 + min-width:0 (texto usa o espaço)', /flex:1/.test(suM) && /min-width:0/.test(suM));
ok('R3: .su-n legível 13px + ellipsis (trunca só se inevitável)', /font-size:13px/.test(suN) && /text-overflow:ellipsis/.test(suN));
ok('R3: .su-r legível 11px + ellipsis (cargo não some)', /font-size:11px/.test(suR) && /text-overflow:ellipsis/.test(suR));
ok('R3: avatar flex:0 0 auto (não esmaga)', /flex:0 0 auto/.test(avRule));

console.log('\nF3.3.17-R2/R3 ACCOUNT ANCHOR: '+pass+' PASS / '+fail+' FAIL');
if(fail){ console.error('::error:: contrato da âncora de conta divergiu'); process.exit(1); }
console.log('OK — .sb-user (conta/perfil/logout) Desktop + acabamento premium R3 (posição/respiro/legibilidade); F3.3.15/logout/boot/R1 preservados.');
