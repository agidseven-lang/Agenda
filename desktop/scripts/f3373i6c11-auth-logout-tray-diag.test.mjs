#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C11 — Testes HERMÉTICOS (texto/fonte) do build DIAGNÓSTICO 1.0.163:
     - instrumentação BEHAVIOR-PRESERVING no caminho logout/authLogout/boot/
       authSelf/session (auth-core + auth.ts + renderer), para localizar o
       auto-login pós-logout relatado — SEM alterar a lógica de auth;
     - fix CONFIRMADO e seguro: destroyTray() no realQuit ("Sair do app"
       remove o ícone da bandeja) + watchdog do tray guardado por !quitting;
     - NUNCA loga token/segredo (só booleans/uid/expiresAt);
     - lógica de logout/boot PRESERVADA (mesmo authLogout + clearSession;
       mesmo authSelf→startApp/login).
   Lê os .ts/index.html/package.json como TEXTO — NÃO compila, NÃO abre app,
   NÃO rede, NÃO escreve.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const S = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const PJ = JSON.parse(S('package.json'));
const CORE = S('src/main/auth-core.ts');
const AUTH = S('src/main/auth.ts');
const TRAY = S('src/main/tray.ts');
const MAIN = S('src/main/main.ts');
const HTML = S('src/renderer/index.html');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

console.log('F3.3.73I6C11 — Desktop 1.0.163 diagnóstico auth/logout + tray fix (hermético)');

/* ── A: versão ── */
ok('A1 versão 1.0.163', PJ.version === '1.0.163');

/* ── B: fix confirmado do tray no QUIT ── */
ok('B1 tray.ts exporta destroyTray() que destrói o tray atual',
  /export function destroyTray\(\): void \{[\s\S]{0,200}currentTray && !currentTray\.isDestroyed\(\)[\s\S]{0,40}currentTray\.destroy\(\)[\s\S]{0,80}currentTray = null;[\s\S]{0,60}trayState\.created = false;/.test(TRAY));
ok('B2 main.ts importa destroyTray e o chama no realQuit (Sair do app remove o tray)',
  /import \{ ensureTray, recreateTray, getTrayState, destroyTray \} from "\.\/tray";/.test(MAIN) &&
  /function realQuit\(\) \{[\s\S]{0,400}destroyTray\(\);[\s\S]{0,160}app\.quit\(\);/.test(MAIN));
ok('B3 watchdog do tray NÃO recria durante o quit (guardado por !quitting)',
  /if \(!quitting && !ts\.created\) \{ try \{ ensureTray\(trayWin, trayOpts\); \}/.test(MAIN));

/* ── C: diagnóstico behavior-preserving no auth-core ── */
ok('C1 auth-core aceita log OPCIONAL (default no-op)',
  /export function createAuthCore\(opts: \{ storeDir: string; urls\?: Partial<Urls>; log\?: \(tag: string, data\?: unknown\) => void \}\)/.test(CORE) &&
  /const log = opts\.log \|\| \(\(_t: string, _d\?: unknown\) => \{[^}]*\}\)/.test(CORE));
ok('C2 wipe() loga se session.json existia e foi removido (prova do logout limpar)',
  /function wipe\(\): void \{[\s\S]{0,320}fs\.rmSync\(storeFile, \{ force: true \}\)[\s\S]{0,160}log\("wipe", \{ existed, removed \}\)/.test(CORE));
ok('C3 load() loga o estado da sessão no startup (prova do auto-login)',
  /log\("load", \{ hasMem: !!mem, uid: mem \? mem\.uid : "", expiresAt: mem \? mem\.expiresAt : 0 \}\)/.test(CORE));
ok('C4 self() loga o estado (valid/hasMem) na entrada',
  /log\("self\.enter", \{ valid: valid\(\), hasMem: !!mem \}\)/.test(CORE));
ok('C5 NENHUM log de token/segredo (só booleans/uid/expiresAt)',
  !/log\([^)]*token/i.test(CORE) && !/diag\([^)]*token/i.test(AUTH));

/* ── D: wiring do diagnóstico no auth.ts (main) ── */
ok('D1 auth.ts injeta log→diag no auth-core (nunca token)',
  /import \{ diag \} from "\.\/diag";/.test(AUTH) &&
  /log: \(tag: string, data\?: unknown\) => diag\("authcore\." \+ tag, data\)/.test(AUTH));
ok('D2 IPC auth-logout e auth-self diagnosticados (sem expor token)',
  /ipcMain\.handle\("auth-logout", \(\) => \{ diag\("ipc\.auth-logout"\); return core\.logout\(\); \}\)/.test(AUTH) &&
  /ipcMain\.handle\("auth-self", async \(\) => \{ const r = await core\.self\(\); diag\("ipc\.auth-self", \{ ok: r\.ok, error: r\.error, hasSelf: !!r\.self \}\); return r; \}\)/.test(AUTH));

/* ── E: diagnóstico no renderer (logout + boot) ── */
ok('E1 renderer loga logout.begin e logout.afterAuthLogout',
  /diagLog\('logout\.begin'\)/.test(HTML) && /diagLog\('logout\.afterAuthLogout'\)/.test(HTML));
ok('E2 renderer loga o resultado do authSelf no boot',
  /diagLog\('boot\.authSelf',\{ok:!!\(r&&r\.ok\),error:r&&r\.error,hasSelf:!!\(r&&r\.self\)\}\)/.test(HTML));

/* ── F: LÓGICA de auth PRESERVADA (behavior-preserving; nada de "fix cego") ── */
ok('F1 logout ainda chama authLogout + clearSession + state.user=null (inalterado)',
  /window\.desktopAPI\.authLogout\(\)/.test(HTML) && /clearSession\(\);state\.user=null;/.test(HTML));
ok('F2 auth-core.logout ainda chama wipe (apaga session.json)',
  /logout\(\): AuthResult \{ wipe\(\); return \{ ok: true \}; \}/.test(CORE));
ok('F3 boot ainda decide login via authSelf (startApp se ok; login se no_session)',
  /const r=await api\.authSelf\(\);[\s\S]{0,200}if\(r&&r\.ok&&r\.self&&r\.self\.id\)\{startApp\(Object\.assign\(\{\},r\.self\)\);return;\}/.test(HTML) &&
  /if\(r&&\(r\.error==='expired'\|\|r\.error==='no_session'\)\)clearSession\(\)/.test(HTML));
ok('F4 wipe ainda usa fs.rmSync(force) — mesma remoção física de session.json',
  /fs\.rmSync\(storeFile, \{ force: true \}\)/.test(CORE));
ok('F5 tray de fechar/minimizar PRESERVADO (X→hide; só realQuit destrói)',
  /mainWin\.on\("close", \(e\) => \{[\s\S]{0,120}mainWin\?\.hide\(\)/.test(MAIN) &&
  (MAIN.match(/destroyTray\(\)/g) || []).length === 1);

/* ── G: regressões — Agenda/permanent-delete preservados (não tocados) ── */
ok('G1 exclusão definitiva preservada (evDeletePermanent + único delete físico)',
  /async function evDeletePermanent\(id\)\{/.test(HTML) && (HTML.match(/collection\('events'\)\.doc\(id\)\.delete\(\)/g) || []).length === 1);
ok('G2 Agenda realtime + Board/Chat/Copywriting preservados',
  /collection\('events'\)\.onSnapshot\(/.test(HTML) && /const STATUS=\[[\s\S]{0,400}key:'afazer'/.test(HTML) && !/TABS=\[[^\]]*\{k:'chat'/.test(HTML));

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
