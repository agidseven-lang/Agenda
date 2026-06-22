#!/usr/bin/env node
/* =====================================================================
 * F3.3.17-R4 — PROVA do BUG (antigo) e da CORREÇÃO (novo) do baseline da notificação
 * de atribuição (Social → Designer), confinada ao renderer (index.html).
 *
 * Executa o CÓDIGO-FONTE REAL (sem reimplementar) em sequências de snapshots reais, com o
 * notifEmit + dedup PERSISTENTE (notifSeen/localStorage) REAIS:
 *   - ANTIGO  = notifScanAssign de `git show HEAD` (versão da build física 1.0.146/R3): gate por
 *     horário `at < _notifAssignSince` (relógio de quem lê) → SUPRIME atribuição nova sob clock-skew.
 *   - NOVO    = notifScanAssign da árvore de trabalho (R4): SEMEIA histórico na 1ª varredura e
 *     notifica só chaves NOVAS por dedup persistente → robusto a clock-skew.
 *
 * Prova (itens exigidos): bug antigo (skew suprime) · 1º snapshot semeia histórico · nova atribuição
 * dispara · clock-skew NÃO bloqueia · atribuição antiga não dispara · duplicidade não dispara ·
 * reatribuição dispara · anti-eco bloqueia o autor (Social) e libera o Designer · payload ator=Social/
 * responsável=Designer · o HUB do main INVOCA o canal desktop · path B (notifier.ts) é redundante.
 *
 * Read-only; não grava produto; não builda. Rodar:
 *   /opt/node22/bin/node desktop/scripts/f33N-assign-baseline-fix.test.mjs
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { execSync } from 'child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');           // NOVO (árvore)
const OLD_HTML = execSync('git show HEAD:desktop/src/renderer/index.html', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); // ANTIGO (R3 física)
const NOTIFIER = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'notifier.ts'), 'utf8');
const MAIN = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'main.ts'), 'utf8');

let pass = 0, fail = 0; const errs = [];
const ok = (n, c) => { if (c) pass++; else { fail++; errs.push('FAIL: ' + n); } };
function fnSrc(src, n) { const a = src.indexOf('function ' + n + '('); if (a < 0) throw new Error('fn ' + n); let d = 0; for (let j = src.indexOf('{', a); j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(a, j + 1); } } }

/* atores */
const SOCIAL = { id: 'sm_ary', name: 'Arydyjany Carlôto', photo: 'https://img/ary.jpg' };
const DESIGNER = { id: 'dz_mier', name: 'Miercohévisk Nascimento', photo: 'https://img/mier.jpg' };
const READER_NOW = 1_700_000_000_000;     // "agora" no relógio do Designer (quem lê)
const AT_LIVE = READER_NOW + 30_000;      // atribuição ao vivo, relógios coerentes
const AT_SKEW = READER_NOW - 200_000;     // MESMA atribuição ao vivo, mas relógio da Social atrasado ~3min

function taskNoAssign() { return { id: 't1', title: 'Carrossel Junho', client: 'Cliente X', sector: 'cronograma', by: SOCIAL.id }; }
function taskAssigned(at, by = SOCIAL.id, designerId = DESIGNER.id) {
  return {
    id: 't1', title: 'Carrossel Junho', client: 'Cliente X', sector: 'cronograma', by: SOCIAL.id, assigneeId: designerId, assignee: DESIGNER.name,
    designerAssignment: { designerId, designerName: DESIGNER.name, designerAvatar: DESIGNER.photo, assignedAt: at, assignedBy: by, assignedByName: (by === SOCIAL.id ? SOCIAL.name : ''), assignedByAvatar: (by === SOCIAL.id ? SOCIAL.photo : ''), status: 'sent' }
  };
}

/* ---- runner que executa o notifScanAssign REAL (old/new) com notifEmit+dedup REAIS, por sequência ---- */
function makeRunner(host, scanFnSrc, readerNow) {
  const store = {};
  const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const captured = [];
  // conta SÓ o disparo REAL (api.notify → main → notificação desktop). __notifCapture é espião de QA
  // do próprio produto; deixá-lo null evita contar 2x o mesmo emit.
  const win = { __notifSuppress: false, __notifCapture: null, desktopAPI: { notify: (p) => { captured.push(p); } } };
  const state = { user: { id: null }, tasks: [] };
  let keyOf = ''; try { keyOf = fnSrc(host, 'notifAssignKeyOf'); } catch (_) { /* só existe no NOVO */ }
  const body =
    "var NOTIF_SEEN_KEY='idseven.notif.seen.v1';\n" +
    "var _notifAssignUid=null,_notifAssignSince=0;\n" +   // declarados FORA da fn no produto; persistem por runner
    "function ncDiag(){}\nfunction notifShowToast(){return null;}\nfunction notifHistoryAppend(){}\n" +
    fnSrc(host, 'notifLoadSeen') + '\n' + fnSrc(host, 'notifSaveSeen') + '\n' + fnSrc(host, 'notifSeenHas') + '\n' + fnSrc(host, 'notifSeenMark') + '\n' +
    fnSrc(host, 'notifBuildPayload') + '\n' + fnSrc(host, 'notifEmit') + '\n' + keyOf + '\n' + scanFnSrc + '\n' +
    "return { scan:function(){ notifScanAssign(); } };";
  const api = new Function('state', 'window', 'localStorage', 'Number', 'Date', body)(state, win, localStorage, Number, { now: () => readerNow });
  return { state, captured, scan: api.scan };
}
const NEW_SCAN = fnSrc(HTML, 'notifScanAssign');
const OLD_SCAN = fnSrc(OLD_HTML, 'notifScanAssign');
ok('setup: ANTIGO usa gate por horário (_notifAssignSince)', /_notifAssignSince/.test(OLD_SCAN));
ok('setup: NOVO removeu o gate por horário (_notifAssignSince)', !/_notifAssignSince/.test(NEW_SCAN));
ok('setup: NOVO semeia via notifSeenMark + chave estável', /notifSeenMark/.test(NEW_SCAN) && /notifAssignKeyOf/.test(NEW_SCAN));

/* ===== 1) BUG ANTIGO: atribuição AO VIVO com relógio da Social atrasado é SUPRIMIDA ===== */
{
  const r = makeRunner(OLD_HTML, OLD_SCAN, READER_NOW);
  r.state.user.id = DESIGNER.id;
  r.state.tasks = [taskNoAssign()]; r.scan();          // 1ª varredura (sem atribuição) → baseline=READER_NOW
  r.state.tasks = [taskAssigned(AT_SKEW)]; r.scan();   // atribuição AO VIVO, mas carimbo atrasado
  ok('[1] BUG: ANTIGO SUPRIME atribuição nova sob clock-skew (0 toast)', r.captured.length === 0);
}

/* ===== 2) CORREÇÃO: mesma sequência sob clock-skew DISPARA no NOVO ===== */
let liveSkewPayload = null;
{
  const r = makeRunner(HTML, NEW_SCAN, READER_NOW);
  r.state.user.id = DESIGNER.id;
  r.state.tasks = [taskNoAssign()]; r.scan();
  r.state.tasks = [taskAssigned(AT_SKEW)]; r.scan();
  ok('[2] FIX: NOVO DISPARA atribuição nova mesmo sob clock-skew (1 toast)', r.captured.length === 1);
  liveSkewPayload = r.captured[0] || null;
}

/* ===== 3) 1º snapshot SEMEIA histórico: atribuição já presente no 1º scan NÃO dispara ===== */
{
  const r = makeRunner(HTML, NEW_SCAN, READER_NOW);
  r.state.user.id = DESIGNER.id;
  r.state.tasks = [taskAssigned(AT_LIVE)]; r.scan();   // já existia no 1º snapshot → histórico
  ok('[3] SEED: atribuição presente no 1º snapshot é semeada (0 toast)', r.captured.length === 0);
}

/* ===== 4) Atribuição NOVA ao vivo (relógios coerentes) dispara 1x ===== */
{
  const r = makeRunner(HTML, NEW_SCAN, READER_NOW);
  r.state.user.id = DESIGNER.id;
  r.state.tasks = [taskNoAssign()]; r.scan();
  r.state.tasks = [taskAssigned(AT_LIVE)]; r.scan();
  ok('[4] NOVA: atribuição ao vivo dispara (1 toast)', r.captured.length === 1);
}

/* ===== 5) DUPLICIDADE: re-scan do MESMO estado não dispara de novo ===== */
{
  const r = makeRunner(HTML, NEW_SCAN, READER_NOW);
  r.state.user.id = DESIGNER.id;
  r.state.tasks = [taskNoAssign()]; r.scan();
  r.state.tasks = [taskAssigned(AT_LIVE)]; r.scan();   // dispara
  r.scan(); r.scan();                                  // re-scans idênticos
  ok('[5] DEDUP: re-varredura do mesmo estado não duplica (total 1)', r.captured.length === 1);
}

/* ===== 6) REATRIBUIÇÃO (novo assignedAt) dispara; mesma chave antiga não ===== */
{
  const r = makeRunner(HTML, NEW_SCAN, READER_NOW);
  r.state.user.id = DESIGNER.id;
  r.state.tasks = [taskNoAssign()]; r.scan();
  r.state.tasks = [taskAssigned(AT_LIVE)]; r.scan();          // 1ª atribuição → dispara
  r.state.tasks = [taskAssigned(AT_LIVE + 90_000)]; r.scan(); // reatribuição (novo at) → dispara
  r.state.tasks = [taskAssigned(AT_LIVE)]; r.scan();          // volta à chave antiga → não dispara
  ok('[6] REATRIBUIÇÃO: novo assignedAt dispara; chave antiga não (total 2)', r.captured.length === 2);
}

/* ===== 7) ANTI-ECO: o AUTOR (Social) não recebe; auto-atribuição não dispara ===== */
{
  const r = makeRunner(HTML, NEW_SCAN, READER_NOW);
  r.state.user.id = SOCIAL.id;                          // observando como a SOCIAL (autora)
  r.state.tasks = [taskNoAssign()]; r.scan();
  r.state.tasks = [taskAssigned(AT_LIVE)]; r.scan();    // designerId=Designer ≠ Social
  ok('[7a] ANTI-ECO: a SOCIAL (autora) NÃO recebe (0 toast)', r.captured.length === 0);

  const r2 = makeRunner(HTML, NEW_SCAN, READER_NOW);
  r2.state.user.id = DESIGNER.id;
  r2.state.tasks = [taskNoAssign()]; r2.scan();
  r2.state.tasks = [taskAssigned(AT_LIVE, DESIGNER.id)]; r2.scan(); // assignedBy=designer (auto)
  ok('[7b] ANTI-ECO: auto-atribuição (assignedBy===me) não dispara', r2.captured.length === 0);
}

/* ===== 8) PAYLOAD: ator = Social, responsável = Designer ===== */
{
  const p = liveSkewPayload || {};
  ok('[8] payload eventType=designer_assigned', p.eventType === 'designer_assigned');
  ok('[8] payload actorName = Social', p.actorName === SOCIAL.name);
  ok('[8] payload actorAvatar = Social', p.actorAvatar === SOCIAL.photo);
  ok('[8] payload actorId = Social', p.actorId === SOCIAL.id);
  ok('[8] payload responsibleName = Designer', p.responsibleName === DESIGNER.name);
  ok('[8] payload responsibleAvatar = Designer', p.responsibleAvatar === DESIGNER.photo);
  ok('[8] payload responsibleId = Designer', p.responsibleId === DESIGNER.id);
  ok('[8] payload targetUserId = Designer', p.targetUserId === DESIGNER.id);
  ok('[8] payload dedupKey designer_assigned:t1:' + AT_SKEW, p.dedupKey === 'designer_assigned:t1:' + AT_SKEW);
  ok('[8] payload título "Arydyjany ... atribuiu uma tarefa"', /atribuiu uma tarefa/.test(p.title || '') && (p.title || '').indexOf(SOCIAL.name) === 0);
}

/* ===== 9) HUB do main (main.ts INALTERADO) INVOCA o canal desktop p/ o payload emitido ===== */
{
  const realWA = fnSrc(MAIN, 'windowActive').replace('function windowActive(): boolean {', 'function windowActive() {');
  const start = MAIN.indexOf('function deliverNotification(');
  const retClose = MAIN.indexOf('channel: string }', start) + 'channel: string }'.length;
  const bodyBrace = MAIN.indexOf('{', retClose);
  let d = 0, end = -1; for (let j = bodyBrace; j < MAIN.length; j++) { const c = MAIN[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = j; break; } } }
  const realDeliver = 'function deliverNotification(p) ' + MAIN.slice(bodyBrace, end + 1).replace(/ as any/g, '');
  function deliver(winState, payload) {
    const sent = [], bg = [];
    const mkWin = () => ({ isDestroyed: () => false, isVisible: () => winState !== 'hidden', isMinimized: () => winState === 'minimized', webContents: { send: (ch) => sent.push(ch) } });
    const res = new Function('mainWin', '_notifSeen', 'diag', '_appIcon', 'showBgNotify', 'Notification', 'String',
      realWA + '\n' + realDeliver + '\n return deliverNotification(' + JSON.stringify(payload) + ');')(
      mkWin(), new Set(), () => {}, () => undefined, (p) => { bg.push(p); return true; }, function () { return { on() {}, show() {} }; }, String);
    return { res, sent, bg };
  }
  const vis = deliver('visible', liveSkewPayload);
  const hid = deliver('hidden', liveSkewPayload);
  ok('[9] HUB: janela visível → canal toast (renderer invocado)', vis.res.channel === 'toast' && vis.sent.includes('notif-toast'));
  ok('[9] HUB: janela oculta → janela premium bg invocada', hid.res.channel === 'bg-window' && hid.bg.length === 1);
}

/* ===== 10) PATH B (notifier.ts INALTERADO) — redundante: detecta p/ Designer, mas segue skew-gated ===== */
{
  const a = NOTIFIER.indexOf('const u1b = listen'); const argStart = NOTIFIER.indexOf('(snap)', a); const bodyStart = NOTIFIER.indexOf('{', argStart);
  let d = 0, end = -1; for (let j = bodyStart; j < NOTIFIER.length; j++) { const c = NOTIFIER[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = j; break; } } }
  const u1b = 'function(snap){' + NOTIFIER.slice(bodyStart, end + 1).replace(/ as any/g, '').replace(/ as Task/g, '').replace(/<Task>/g, '') + '}';
  function notifierDeliver(uid, sinceMs, task) {
    const out = []; const snap = { docChanges: () => [{ type: 'modified', doc: { id: task.id, data: () => task } }] };
    new Function('state', 'deliver', 'diag', 'Number', 'return (' + u1b + ');')({ uid, sinceMs }, (p) => out.push(p), () => {}, Number)(snap);
    return out;
  }
  const live = notifierDeliver(DESIGNER.id, READER_NOW - 60_000, taskAssigned(AT_LIVE));
  ok('[10] PATH B: notifier entrega p/ Designer com relógios coerentes', live.length === 1 && live[0].actorName === SOCIAL.name);
  const skew = notifierDeliver(DESIGNER.id, READER_NOW, taskAssigned(AT_SKEW));
  ok('[10] PATH B: notifier (protegido) AINDA suprime sob skew — path A (renderer) cobre via dedup/HUB', skew.length === 0);
}

/* ===== resumo ===== */
console.log('\n==== F3.3.17-R4 — BUG (antigo) × CORREÇÃO (novo) do baseline da notificação ====');
if (errs.length) console.log('\n' + errs.join('\n') + '\n');
console.log('[1] ANTIGO sob clock-skew         : SUPRIME (bug físico reproduzido)');
console.log('[2] NOVO sob clock-skew           : DISPARA  (corrigido)');
console.log('[3] 1º snapshot (histórico)        : semeia, não dispara');
console.log('[4] nova atribuição ao vivo        : dispara 1x');
console.log('[5] duplicidade                    : deduplicada');
console.log('[6] reatribuição                   : dispara (chave nova)');
console.log('[7] anti-eco                       : Social não recebe; auto-atribuição não dispara');
console.log('[8] payload                        : ator=Social, responsável=Designer');
console.log('[9] HUB main (inalterado)          : visível→toast, oculta→bg-window');
console.log('[10] path B notifier (protegido)   : redundante; segue skew-gated, path A cobre');
console.log('\n' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: prova do bug/correção falhou'); process.exit(1); }
console.log('OK — bug do clock-skew reproduzido no código ANTIGO e corrigido no NOVO (confinado ao index.html):');
console.log('     histórico semeado, nova atribuição dispara mesmo sob skew, sem duplicar, anti-eco e autoria intactos.');
