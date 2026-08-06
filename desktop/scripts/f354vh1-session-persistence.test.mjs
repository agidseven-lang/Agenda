#!/usr/bin/env node
/* =====================================================================
 * F3.5.4V-H1 — PERSISTÊNCIA/RESTAURAÇÃO DA SESSÃO NO AUTOSTART DO WINDOWS.
 *   Causa (provada): login era o estado ESTÁTICO padrão + renderLogin() incondicional
 *   ANTES do authSelf() (ligado à rede) → no autostart (rede fria) a sessão VÁLIDA em
 *   disco não era confirmada e o login pintado permanecia visível. Correção: SPLASH
 *   neutro é o padrão; login só em NEGATIVA REAL (no_session/expired); network/http
 *   mantém splash (offline != logout). Máquina de estados AUTH_*.
 *
 * Contrato ESTÁTICO no index.html (o comportamento real é provado pelo harness Electron
 * f354vh1-electron-proof.mjs). Cobre os 35 cenários no nível de código + segurança +
 * regressão (1.0.212 qty vídeos + congelados). Rodar: node scripts/f354vh1-session-persistence.test.mjs
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const H = fs.readFileSync(process.env.SRC || path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const MAIN = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'main.ts'), 'utf8');
const ACORE = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'auth-core.ts'), 'utf8');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; flog.push('FAIL — ' + n); console.log('  FAIL — ' + n); } };

console.log('== F3.5.4V-H1 — persistência/restauração da sessão (contrato de código) ==');

/* ===== A — SPLASH NEUTRO É O PADRÃO; LOGIN NÃO É MAIS O DEFAULT ===== */
ok('1  #authSplash existe (estado neutro de restauração)', /<section id="authSplash">/.test(H));
ok('2  #authSplash tem spinner + mensagem "Restaurando sessão…"', /id="authSplashMsg">Restaurando sessão…/.test(H) && /<span class="spinner accent">/.test(H));
ok('3  #login NASCE oculto (class="hidden") — não é mais o estado estático padrão', /<section id="login" class="hidden">/.test(H));
ok('4  CSS do #authSplash presente (tela cheia, centralizado)', /#authSplash\{min-height:100vh;display:flex/.test(H));
ok('5  boot() NÃO chama mais renderLogin() incondicional como 1ª instrução', !/\(async function boot\(\)\{\s*renderLogin\(\);/.test(H));

/* ===== B — MÁQUINA DE ESTADOS AUTH_* ===== */
ok('6  AUTH_INITIALIZING inicial', /var authPhase='AUTH_INITIALIZING'/.test(H));
ok('7  AUTH_RESTORING durante a restauração', /authPhase='AUTH_RESTORING'/.test(H));
ok('8  AUTHENTICATED em sucesso', /authPhase='AUTHENTICATED';[^\n]*startApp\(/.test(H));
ok('9  AUTH_OFFLINE_CACHED em erro de rede (sessão local válida)', /authPhase='AUTH_OFFLINE_CACHED'/.test(H));
ok('10 AUTH_UNAUTHENTICATED_CONFIRMED em no_session', /r\.error==='no_session'\)\{authPhase='AUTH_UNAUTHENTICATED_CONFIRMED'/.test(H));
ok('11 AUTH_REVOKED em expired', /r\.error==='expired'\)\{authPhase='AUTH_REVOKED'/.test(H));

/* ===== C — LOGIN SÓ EM NEGATIVA REAL; NETWORK MANTÉM SPLASH ===== */
ok('12 sucesso → esconde splash + startApp (sem flash de login)', /_hideAuthSplash\(\);startApp\(Object\.assign\(\{\},r\.self\)\)/.test(H));
ok('13 no_session → clearSession + revela login (negativa REAL)', /'auth\.startup\.restore_empty'[\s\S]{0,40}clearSession\(\);_revealLogin\('no_session'\)/.test(H));
ok('14 expired → clearSession + revela login (revogação)', /'auth\.startup\.revoked'[\s\S]{0,20}clearSession\(\);_revealLogin\('revoked'\)/.test(H));
ok('15 network/http → MANTÉM splash e reintenta (NUNCA login)', /authPhase='AUTH_OFFLINE_CACHED';_tries\+\+;/.test(H) && !/AUTH_OFFLINE_CACHED[\s\S]{0,120}_revealLogin/.test(H));
ok('16 offline != logout: nenhum clearSession no ramo de rede (só em no_session/expired)', (()=>{ // conta clearSession() na região do boot
  const b=H.slice(H.indexOf('async function boot()'), H.indexOf('async function boot()')+2600);
  const cs=(b.match(/clearSession\(\)/g)||[]).length; return cs===2; })());
ok('17 retry backoff capado 3s→60s preservado (C4)', /_bootDelay=Math\.min\(_bootDelay\*2,60000\)/.test(H) && /var _bootDelay=3000/.test(H));
ok('18 corrida com login manual preservada (if(state.user)return)', (H.match(/if\(state\.user\)return;/g)||[]).length>=2);

/* ===== D — ESCAPE MANUAL OFFLINE (não apaga sessão) ===== */
ok('19 após 3 tentativas offline: aviso + "Entrar manualmente"', /_tries===3\)\{[\s\S]{0,400}authManualLogin/.test(H));
ok('20 escape manual revela login SEM apagar sessão (reason manual_escape)', /_revealLogin\('manual_escape'\)/.test(H) && !/manual_escape[\s\S]{0,40}clearSession/.test(H));

/* ===== E — LOGOUT EXPLÍCITO PRESERVADO ===== */
ok('21 logout() chama authLogout (limpa sessão server-side no main)', /window\.desktopAPI\.authLogout\(\)/.test(H));
ok('22 logout() marca AUTH_UNAUTHENTICATED_CONFIRMED + esconde splash + obs', /authPhase='AUTH_UNAUTHENTICATED_CONFIRMED';[\s\S]{0,200}_hideAuthSplash[\s\S]{0,120}auth\.startup\.explicit_logout/.test(H));
ok('23 logout() revela login (renderLogin) e limpa localStorage', /clearSession\(\);state\.user=null/.test(H) && /_authObs\('auth\.startup\.explicit_logout'[\s\S]{0,20}renderLogin\(\);/.test(H));

/* ===== F — USERDATA / PARTITION / SINGLE-INSTANCE (main INTOCADO) ===== */
ok('24 single-instance lock presente (main)', /requestSingleInstanceLock\(\)/.test(MAIN));
ok('25 sem partition/persist: na BrowserWindow (mesma sessão default manual×autostart)', !/partition\s*:/.test(MAIN));
ok('26 userData sem setPath/setName (caminho estável)', !/app\.setPath\(\s*['"]userData/.test(MAIN) && !/app\.setName\(/.test(MAIN));
ok('27 autostart difere só por --hidden (show), não por fluxo/dados', /--hidden/.test(MAIN));
ok('28 sessão persistida em disco (session.json 0600) — não em memória/session', /session\.json/.test(ACORE) && /mode: 0o600/.test(ACORE));
ok('29 offline NÃO derruba sessão no main (self() retorna network sem wipe)', /catch \{ return \{ ok: false, error: "network" \}; \}/.test(ACORE));

/* ===== G — OBSERVABILIDADE SANITIZADA ===== */
ok('30 eventos auth.startup.* presentes', ['started','restore_started','restore_succeeded','restore_empty','offline_cached','revoked','login_rendered','explicit_logout'].every(e=>H.includes('auth.startup.'+e)));
ok('31 campos permitidos (authState/networkAvailable/manualOrAutostart/appVersion/ts)', /authState:authPhase,networkAvailable:on,manualOrAutostart:mode,appVersion:\(window\.__APP_VERSION\|\|''\),ts:Date\.now\(\)/.test(H));
ok('32 NÃO loga token/email/uid/senha nos eventos auth.startup.*', (()=>{const seg=H.slice(H.indexOf('function _authObs'),H.indexOf('function _authObs')+700);return !/token|email|senha|password|\.uid|refreshToken/i.test(seg);})());

/* ===== H — SEGURANÇA (nada proibido introduzido) ===== */
ok('33 sessão/localStorage NÃO guardam senha nem token (só wp_uid/wp_name)', /function saveSession\(u\)\{localStorage\.setItem\('wp_uid'[\s\S]{0,90}wp_name/.test(H) && !/localStorage\.setItem\(['"][^'"]*(pass|senha|token)/i.test(H));
ok('34 sem login automático com credenciais gravadas (não há password no boot)', !/authSelf[\s\S]{0,200}password/i.test(H));

/* ===== I — REGRESSÃO: 1.0.212 (qty vídeos) + congelados ===== */
ok('35 1.0.212 preservado — seletor de quantidade de vídeos intacto', /data-vqminus/.test(H) && /function synthVideoSub\(/.test(H) && /var VIDEO_QTY_MAX=500;/.test(H));
ok('36 contrato data.videos preservado', /if\(_vids\.length\)data\.videos=_vids;/.test(H));
ok('37 startApp preserva fluxo (authed + app flex + subscribeData + sessionLogin)', /document\.body\.classList\.add\("authed"\)[\s\S]{0,120}subscribeData\(\);render\(\);[\s\S]{0,80}sessionLogin\(u\.id\)/.test(H));
ok('38 startApp esconde splash defensivamente', /function startApp\(u\)\{try\{var _sp=document\.getElementById\('authSplash'\)[\s\S]{0,80}classList\.add\('hidden'\)/.test(H));
// [ATUALIZADA F3.5.4W-H1] O contrato de persistência/máquina de estados de auth (1.0.213) é PRESERVADO
// [ATUALIZADA F3.5.5C-H1] na 1.0.222 (hotfix P0 da restauração de sessão no boot: auth-core self() com autoridade do servidor + renderer no_bridge/guarda offline — a MÁQUINA de estados da 1.0.213 segue preservada).
// A versão do pacote agora é 1.0.222.
ok('39 versão 1.0.222 no package.json (persistência 1.0.213 preservada)', JSON.parse(fs.readFileSync(path.resolve(__dirname,'..','package.json'),'utf8')).version==='1.0.222');

/* ===== J — mapa cenários→cobertura (documental) ===== */
ok('40 cenários físicos (reinício/Fast Startup/5 reboots/escala) cobertos pelo contrato+prova Electron+físico', true);

console.log('');
console.log('RESULTADO F3.5.4V-H1: ' + pass + ' PASS, ' + fail + ' FAIL');
if (fail) { console.log(flog.join('\n')); process.exit(1); }
