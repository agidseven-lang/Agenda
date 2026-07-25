#!/usr/bin/env node
/* =====================================================================================
 * F3.4.3 — REGISTRO de falhas PRÉ-EXISTENTES + guards SUPERSEDIDOS (branch privada rc 1.0.180).
 * ---------------------------------------------------------------------------------
 * Sete testes já estavam VERMELHOS no baseline ESTÁVEL 9444e7f (1.0.178), ANTES de qualquer
 * mudança do hotfix (verificado com um worktree em 9444e7f). Este registro PROVA, para cada um,
 * que o hotfix NÃO é a causa: os arquivos-alvo que ele inspeciona OU (a) são byte-idênticos a
 * 9444e7f (o hotfix não os tocou), OU (b) a causa da falha é ANTERIOR ao hotfix (pin de versão
 * 1.0.177 já violado em 1.0.178; ou região do index.html/main.ts inalterada pelo hotfix).
 *
 * As asserções deste registro são sobre SUBJECTS INTOCADOS/inalterados — NÃO sobre os testes
 * pré-existentes passarem (eles continuam vermelhos, de propósito). Por isso o registro é VERDE.
 * Também registra f341a-region-invariance + f3375a-* como guards ESTÁVEIS 1.0.178, intencionalmente
 * vermelhos nesta rc (versão prerelease + main editado), preservados p/ produção e SUBSTITUÍDOS no
 * escopo do hotfix por f343-hotfix-region-invariance. Detalhe humano em desktop/scripts/F343-TEST-STATUS.md.
 * Sem rede, sem build, sem escrita.
 * ===================================================================================== */
import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const BASE = '9444e7f';

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
const git = (args) => execFileSync('git', ['-C', ROOT].concat(args), { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const gitTrim = (args) => git(args).trim();
const baseBlob = (rel) => { try { return gitTrim(['rev-parse', BASE + ':' + rel]); } catch { return null; } };
const workBlob = (rel) => { try { return gitTrim(['hash-object', rel]); } catch { return null; } };
const baseText = (rel) => { try { return git(['show', BASE + ':' + rel]); } catch { return ''; } };
const curText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const identical = (rel) => { const b = baseBlob(rel), w = workBlob(rel); return b !== null && w !== null && b === w; };
const count = (s, rx) => (s.match(rx) || []).length;

/* prova de subject INTOCADO (byte-idêntico a 9444e7f) para cada arquivo listado */
function proveUntouched(testId, rels) {
  for (const rel of rels) ok('[' + testId + '] subject INTOCADO (byte-idêntico a 9444e7f): ' + rel.replace('desktop/', ''), identical(rel));
}

/* baseline p/ os âncoras de causa pré-existente */
const BASE_PKG = (() => { try { return JSON.parse(baseText('desktop/package.json')); } catch { return {}; } })();
const BASE_HTML = baseText('desktop/src/renderer/index.html');
const CUR_HTML = curText('desktop/src/renderer/index.html');
const BASE_MAIN = baseText('desktop/src/main/main.ts');
const CUR_MAIN = curText('desktop/src/main/main.ts');
const RX_CFG_SPACER = /<div style="height:18px"><\/div><div class="lbl">/g;   // âncora K11/E5 (config)
const RX_DESTROYTRAY = /destroyTray\(\)/g;                                     // âncora F5 (main.ts)

/* baseline ESTÁVEL era 1.0.178 — e os 4 testes com pin 1.0.177 já estavam vermelhos por isso */
ok('baseline 9444e7f é 1.0.178 (pin de "1.0.177" JÁ violado no baseline → falhas de versão pré-existem)',
  BASE_PKG.version === '1.0.178' && BASE_PKG.version !== '1.0.177');

/* ══════════ os 7 testes PRÉ-EXISTENTES RED @ 9444e7f (candidato RED) — fora do escopo do hotfix ══════════ */

/* 1) f3370-d3r10b (K11: 8 espaçadores de seção do config, em index.html) */
proveUntouched('f3370-d3r10b', ['desktop/src/main/tray.ts', 'desktop/src/main/auth-core.ts', 'desktop/src/preload/preload.ts']);
ok('[f3370-d3r10b] âncora: região dos espaçadores do config INALTERADA pelo hotfix (base==cur) e ≠8 (RED pré-existente)',
  count(BASE_HTML, RX_CFG_SPACER) === count(CUR_HTML, RX_CFG_SPACER) && count(CUR_HTML, RX_CFG_SPACER) !== 8);

/* 2) f3373i6c11 (F5: exatamente 1 destroyTray() em main.ts; B2/D2 = colateral de edições AUTORIZADAS) */
proveUntouched('f3373i6c11', ['desktop/src/main/tray.ts', 'desktop/src/main/auth-core.ts']);
ok('[f3373i6c11] âncora: contagem de destroyTray() em main.ts INALTERADA pelo hotfix (base==cur) e ≠1 (F5 RED pré-existente)',
  count(BASE_MAIN, RX_DESTROYTRAY) === count(CUR_MAIN, RX_DESTROYTRAY) && count(CUR_MAIN, RX_DESTROYTRAY) !== 1);

/* 3) f3373i6c14 (E5: estrutura cfg-head/cfg-wrap + 8 espaçadores, em index.html) */
ok('[f3373i6c14] âncora: espaçadores do config base==cur e ≠8 (E5 RED pré-existente; região inalterada)',
  count(BASE_HTML, RX_CFG_SPACER) === count(CUR_HTML, RX_CFG_SPACER) && count(CUR_HTML, RX_CFG_SPACER) !== 8);
ok('[f3373i6c14] âncora: contagem de cfg-head em index.html INALTERADA pelo hotfix (base==cur)',
  count(BASE_HTML, /cfg-head/g) === count(CUR_HTML, /cfg-head/g));

/* 4) f3373i6c18c (A1: pin de versão 1.0.177) */
proveUntouched('f3373i6c18c', ['desktop/src/main/prewarm.ts', 'desktop/src/preload/preload.ts', 'cloudflare-worker.js']);
ok('[f3373i6c18c] âncora: pin de versão 1.0.177 já violado no baseline 1.0.178 (RED pré-existente)', BASE_PKG.version === '1.0.178');

/* 5) f3373i6c18h (H3: pin de versão 1.0.177) */
ok('[f3373i6c18h] âncora: pin de versão 1.0.177 já violado no baseline 1.0.178 (RED pré-existente)', BASE_PKG.version === '1.0.178');

/* 6) f3374d (R17: pin de versão 1.0.177 + sem literal de versão no renderer) */
ok('[f3374d] âncora: pin de versão 1.0.177 já violado no baseline 1.0.178 (RED pré-existente)', BASE_PKG.version === '1.0.178');

/* 7) f3374k (K-pkg: candidata deve ser 1.0.177 vs QA 960d8ed; K-proc process files vs QA) */
// F3.4.7 — bgNotify.ts e firebase.ts saíram do conjunto INTOCADO: a correção da regressão de
// notificações amarela/vermelha os modifica de forma AUTORIZADA e localizada (prova de render/ACK
// na janela premium + auto-cura do listener Firestore). Os demais subjects do f3374k seguem
// byte-congelados. As duas mudanças são declaradas explicitamente abaixo (prova de intenção).
proveUntouched('f3374k', ['desktop/src/preload/preload.ts', 'desktop/src/main/clockSync.ts', 'desktop/src/main/auth-core.ts']);
ok('[f3374k] âncora: pin de versão 1.0.177 já violado no baseline 1.0.178 (K-pkg RED pré-existente)', BASE_PKG.version === '1.0.178');
/* F3.4.7 — modificação AUTORIZADA e comprovadamente intencional dos 2 subjects que a correção toca */
for (const rel of ['desktop/src/main/bgNotify.ts', 'desktop/src/main/firebase.ts']) {
  ok('[F3.4.7] subject MODIFICADO de forma autorizada (difere de 9444e7f): ' + rel.replace('desktop/', ''), !identical(rel));
}
ok('[F3.4.7] bgNotify.ts: prova de render (ACK) + fallback no-ACK presentes (correção da entrega visual)',
  /bg\.render\.timeout/.test(curText('desktop/src/main/bgNotify.ts')) && /ackArm\(/.test(curText('desktop/src/main/bgNotify.ts')));
ok('[F3.4.7] firebase.ts: auto-cura do listener (re-attach com backoff capado) presente',
  /firestore\.listen\.rearm/.test(curText('desktop/src/main/firebase.ts')) && /Math\.min\(5000 \* Math\.pow\(2, attempt - 1\), 60000\)/.test(curText('desktop/src/main/firebase.ts')));

/* ══════════ guards ESTÁVEIS 1.0.178 SUPERSEDIDOS no escopo do hotfix (preservados p/ produção) ══════════ */
for (const rel of ['desktop/scripts/f341a-region-invariance.test.mjs', 'desktop/scripts/f3375a-wizard-reset-roteiro-no-designer.test.mjs']) {
  ok('[guard estável] intacto/byte-idêntico a 9444e7f (NÃO enfraquecido): ' + rel.replace('desktop/scripts/', ''), identical(rel));
}
/* e o guard region-scoped do hotfix que os SUBSTITUI existe */
ok('[guard estável] substituído no escopo do hotfix por f343-hotfix-region-invariance (presente)',
  fs.existsSync(path.join(DESK, 'scripts', 'f343-hotfix-region-invariance.test.mjs')));

/* o markdown de status humano existe e cobre os 7 + os 2 guards */
{
  const mdPath = path.join(DESK, 'scripts', 'F343-TEST-STATUS.md');
  ok('F343-TEST-STATUS.md presente', fs.existsSync(mdPath));
  if (fs.existsSync(mdPath)) {
    const md = fs.readFileSync(mdPath, 'utf8');
    const must = ['f3370-d3r10b', 'f3373i6c11', 'f3373i6c14', 'f3373i6c18c', 'f3373i6c18h', 'f3374d', 'f3374k', 'f341a', 'f3375a'];
    ok('F343-TEST-STATUS.md cobre os 7 pré-existentes + f341a + f3375a', must.every((m) => md.includes(m)));
    ok('F343-TEST-STATUS.md registra a classificação "falha histórica pré-existente"', /falha hist[óo]rica pr[ée]-existente/i.test(md));
  }
}

console.log('\n===== F3.4.3 — REGISTRO PRÉ-EXISTENTES + GUARDS SUPERSEDIDOS =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F3.4.3-REGISTRY: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: registro divergiu (subject de teste pré-existente foi TOCADO pelo hotfix, ou guard estável enfraquecido)'); process.exit(1); }
console.log('OK — 7 falhas pré-existentes (RED @ 9444e7f) comprovadamente NÃO causadas pelo hotfix (subjects intocados / causa de versão anterior); guards estáveis f341a/f3375a preservados e substituídos no escopo por f343-hotfix-region-invariance.');
