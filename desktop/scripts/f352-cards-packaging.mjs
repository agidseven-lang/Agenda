#!/usr/bin/env node
/* =====================================================================================
 * F3.5.2 — GATE 3 · PROVA DE EMPACOTAMENTO (app.asar) DO MÓDULO ISOLADO cardsRules.js
 * -------------------------------------------------------------------------------------
 * copy-renderer.js é CRÍTICO: o tsc só compila .ts; cardsRules.js (CommonJS, escrito à mão)
 * SÓ chega em dist/main — e portanto ao app.asar — porque copy-renderer.js o copia. Sem ele,
 * o produtor T-30/T-10 SUMIRIA da build empacotada e o slaScheduler falharia ao require("./cardsRules").
 *
 * Este gate PROVA, sobre um app.asar REAL (mesmo empacotador do electron-builder, @electron/asar):
 *   (1) cardsRules.js EXISTE na FONTE (src/main/cardsRules.js);
 *   (2) copy-renderer.js o COPIA para dist/main/cardsRules.js;
 *   (3) o módulo EXISTE dentro do app.asar (dist/main/cardsRules.js);
 *   (4) SHA-256 IDÊNTICO nas três camadas (fonte == dist == extraído do asar) — sem versão estagnada;
 *   (5) o slaScheduler EMPACOTADO o CARREGA em PRODUÇÃO (require RÍGIDO resolve o irmão do asar e o
 *       INVOCA de fato: um card na janela T-30 é entregue) — e, na AUSÊNCIA do módulo, o
 *       startSlaScheduler LANÇA (jamais no-op silencioso);
 *   (6) cardsEmissionsFor está EXPORTADO pelo módulo extraído do asar;
 *   (7) NÃO há versão antiga/duplicada (exatamente 1 cardsRules.js no asar, em dist/main; nenhum
 *       stray no repositório fora de node_modules).
 * Só então imprime "CARDS RULES PACKAGING: VERIFIED" e sai 0. QUALQUER falha ⇒ sai 1 ⇒ a build
 * NÃO deve gerar EXE/MSI.
 *
 * Rodar: node desktop/scripts/f352-cards-packaging.mjs   (exige dist/main/slaScheduler.js — tsc já rodado)
 * ===================================================================================== */
import fs from 'fs'; import os from 'os'; import path from 'path'; import crypto from 'crypto';
import { fileURLToPath } from 'url'; import { createRequire } from 'module'; import { execFileSync } from 'child_process';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const REPO = path.resolve(DESK, '..');
const asar = require('@electron/asar');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const SRC = path.join(DESK, 'src', 'main', 'cardsRules.js');
const DIST_MAIN = path.join(DESK, 'dist', 'main');

/* ── (1) FONTE existe ─────────────────────────────────────────────────────────────── */
ok('(1) cardsRules.js existe na FONTE (src/main)', fs.existsSync(SRC));

/* ── (2) copy-renderer.js copia p/ dist/main (exercita o arquivo CRÍTICO) ──────────── */
// Roda o MESMO script do npm "build:renderer": prova que copy-renderer.js entrega o módulo a dist/main.
execFileSync(process.execPath, [path.join(DESK, 'scripts', 'copy-renderer.js')], { cwd: DESK, stdio: 'pipe' });
const DIST = path.join(DIST_MAIN, 'cardsRules.js');
ok('(2) copy-renderer.js copiou cardsRules.js -> dist/main', fs.existsSync(DIST));
// pré-requisito da prova de carregamento: o slaScheduler COMPILADO precisa existir (tsc já rodou).
const SCHED = path.join(DIST_MAIN, 'slaScheduler.js');
ok('(2b) dist/main/slaScheduler.js existe (tsc já rodou)', fs.existsSync(SCHED));
if (!fs.existsSync(DIST) || !fs.existsSync(SCHED)) {
  console.log('\n::error:: pré-requisitos ausentes — rode `npm run build` (tsc + copy-renderer) antes deste gate.');
  console.log(flog.join('\n')); process.exit(1);
}

/* ── empacota um app.asar REAL (package.json + dist/) com @electron/asar ────────────── */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'f352pkg-'));
const STAGE = path.join(TMP, 'app');
fs.mkdirSync(STAGE, { recursive: true });
fs.copyFileSync(path.join(DESK, 'package.json'), path.join(STAGE, 'package.json'));
fs.cpSync(path.join(DESK, 'dist'), path.join(STAGE, 'dist'), { recursive: true });
const ASAR = path.join(TMP, 'app.asar');
await asar.createPackage(STAGE, ASAR);
ok('app.asar REAL criado (@electron/asar, mesmo empacotador do electron-builder)', fs.existsSync(ASAR));

/* ── (3) módulo EXISTE dentro do app.asar ──────────────────────────────────────────── */
const listing = asar.listPackage(ASAR).map((p) => p.replace(/\\/g, '/').replace(/^\//, ''));
ok('(3) app.asar contém dist/main/cardsRules.js', listing.includes('dist/main/cardsRules.js'));
ok('(3b) app.asar contém dist/main/slaScheduler.js', listing.includes('dist/main/slaScheduler.js'));
ok('(3c) app.asar contém dist/main/slaRules.js', listing.includes('dist/main/slaRules.js'));

/* ── (4) SHA-256 idêntico: fonte == dist == extraído do asar ───────────────────────── */
const shaSrc = sha(fs.readFileSync(SRC));
const shaDist = sha(fs.readFileSync(DIST));
const asarBuf = asar.extractFile(ASAR, 'dist/main/cardsRules.js');
const shaAsar = sha(asarBuf);
ok('(4) SHA-256 fonte == dist (sem cópia estagnada em dist)', shaSrc === shaDist);
ok('(4b) SHA-256 dist == asar (bytes empacotados idênticos)', shaDist === shaAsar);
ok('(4c) SHA-256 fonte == asar (cadeia íntegra fonte→asar)', shaSrc === shaAsar);
console.log('  cardsRules.js SHA-256 (fonte==dist==asar): ' + shaSrc);

/* ── (5) o slaScheduler EMPACOTADO carrega e INVOCA cardsRules (produção) + prova de
 *       AUSÊNCIA = ERRO ALTO (nunca no-op silencioso) ─────────────────────────────── */
// (5a) POSITIVO — extrai o TRIO do asar, roda o slaScheduler em MODO PRODUÇÃO (sem opts.cardsRules ⇒
//      require("./cardsRules") RÍGIDO resolve o irmão empacotado) e prova ENTREGA de um card em T-30.
function extractTrio(dir, withCards) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'slaScheduler.js'), asar.extractFile(ASAR, 'dist/main/slaScheduler.js'));
  fs.writeFileSync(path.join(dir, 'slaRules.js'), asar.extractFile(ASAR, 'dist/main/slaRules.js'));
  fs.writeFileSync(path.join(dir, 'firebase.js'), 'exports.listen=function(){return function(){};};');
  fs.writeFileSync(path.join(dir, 'diag.js'), 'exports.diag=function(){};');
  if (withCards) fs.writeFileSync(path.join(dir, 'cardsRules.js'), asar.extractFile(ASAR, 'dist/main/cardsRules.js'));
}
const DIR_OK = path.join(TMP, 'run-ok');
extractTrio(DIR_OK, true);
const rulesOk = require(path.join(DIR_OK, 'slaRules.js'));
const D = rulesOk.dtMs('2026-08-01', '15:00');       // prazo do card
const MIN = 60000, UID = 'designerA';
const CARD = {
  id: 't1', sector: 'edicao_cards', title: 'Card X', client: 'Cliente Y', status: 'afazer',
  dueDate: '2026-08-01', dueTime: '15:00', due: '2026-08-01',
  designerAssignment: { designerId: UID, designerName: 'Des A' },
};
let loadThrew = false, delivered = [], snapCb = null;
try {
  const { startSlaScheduler } = require(path.join(DIR_OK, 'slaScheduler.js'));
  const st = { now: D - 30 * MIN };                  // exatamente T-30 (amarela)
  const h = startSlaScheduler(() => UID, (p) => { delivered.push(p); return { ok: true, channel: 'test' }; }, {
    // MODO PRODUÇÃO: NÃO injetamos cardsRules ⇒ o scheduler faz require("./cardsRules") do asar.
    now: () => st.now,
    listen: (_n, cb) => { snapCb = cb; return () => {}; },
    seen: { has: () => false, add: () => {} },
    setTimer: () => ({}), clearTimer: () => {}, onLog: () => {},
  });
  // injeta o card via snapshot (docChanges) ⇒ reconcile("snapshot") ⇒ emitDue em T-30.
  snapCb({ docChanges: () => [{ type: 'added', doc: { id: 't1', data: () => CARD } }] });
  h.stop();
} catch (e) { loadThrew = true; flog.push('FAIL(5a) startSlaScheduler produção lançou: ' + (e && e.message || e)); }
ok('(5a) slaScheduler EMPACOTADO carrega cardsRules em PRODUÇÃO (sem throw)', !loadThrew);
const warn = delivered.filter((p) => p && p.eventType === 'sla_cards_warning');
ok('(5b) card em T-30 ENTREGUE pelo canal oficial (cardsRules invocado de fato)', warn.length === 1);
ok('(5c) entrega roteada ao designer responsável (targetUserId)', warn[0] && warn[0].targetUserId === UID);

// (5d) NEGATIVO — MESMO scheduler empacotado SEM o irmão cardsRules.js ⇒ startSlaScheduler DEVE LANÇAR.
const DIR_NO = path.join(TMP, 'run-no');
extractTrio(DIR_NO, false);                          // withCards=false ⇒ cardsRules.js AUSENTE
let absentThrew = false;
try {
  const { startSlaScheduler } = require(path.join(DIR_NO, 'slaScheduler.js'));
  startSlaScheduler(() => UID, () => ({ ok: true }), {
    now: () => D, listen: () => () => {}, seen: { has: () => false, add: () => {} },
    setTimer: () => ({}), clearTimer: () => {}, onLog: () => {},
  });
} catch (e) { absentThrew = /cardsRules|Cannot find module/i.test(String(e && e.message || e)); }
ok('(5d) AUSÊNCIA de cardsRules.js ⇒ startSlaScheduler LANÇA (nunca no-op silencioso)', absentThrew);

/* ── (6) cardsEmissionsFor exportado pelo módulo EXTRAÍDO do asar ───────────────────── */
const cardsFromAsar = require(path.join(DIR_OK, 'cardsRules.js'));
ok('(6) cardsEmissionsFor exportado (módulo do asar)', typeof cardsFromAsar.cardsEmissionsFor === 'function');
ok('(6b) cardsNextBoundaryMs exportado (módulo do asar)', typeof cardsFromAsar.cardsNextBoundaryMs === 'function');
ok('(6c) isCardsSector exportado (módulo do asar)', typeof cardsFromAsar.isCardsSector === 'function');

/* ── (7) sem versão antiga/duplicada ──────────────────────────────────────────────── */
const cardsEntries = listing.filter((p) => /(^|\/)cardsRules\.js$/.test(p));
ok('(7) exatamente 1 cardsRules.js no app.asar', cardsEntries.length === 1);
ok('(7b) a única cópia está em dist/main (path canônico)', cardsEntries[0] === 'dist/main/cardsRules.js');
// nenhum stray no repositório fora de node_modules (só src/main + dist/main).
let strays = [];
try {
  strays = execFileSync('git', ['ls-files', '--', '**/cardsRules.js', 'desktop/**/cardsRules.js'], { cwd: REPO }).toString().split('\n').filter(Boolean);
} catch (_) { strays = []; }
// git ls-files não lista dist/ (gitignored) — só a FONTE deve aparecer, e só uma.
ok('(7c) no repositório (git-tracked) só existe a FONTE src/main/cardsRules.js', strays.length === 1 && strays[0] === 'desktop/src/main/cardsRules.js');

/* ── limpeza + veredito ───────────────────────────────────────────────────────────── */
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
console.log('\nF3.5.2 cards-packaging: ' + pass + ' passaram, ' + fail + ' falharam (total ' + (pass + fail) + ')');
if (fail) { console.log(flog.join('\n')); console.log('\n::error:: PACKAGING GATE FALHOU — NÃO gerar EXE/MSI.'); process.exit(1); }
console.log('\nCARDS RULES PACKAGING: VERIFIED');
process.exit(0);
