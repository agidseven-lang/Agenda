#!/usr/bin/env node
/* =====================================================================
 * F3.5.4I — SUÍTE: salvamento/envio de Cronograma ao cliente (40 itens do mandato
 * + cenários de erro Firestore + diferencial 1.0.198×1.0.199 + regressões congeladas).
 * Roda o saveTask() + saveCardsBatch() REAIS (index.html) contra um MOCK FIEL do
 * Firestore (rejeita undefined/NaN; doc/set/get; erros injetáveis). Sem rede, sem IA.
 * Rodar: node desktop/scripts/f354i-cronograma-save-send-client.test.mjs
 * ===================================================================== */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execSync } from 'node:child_process';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const DESK = path.resolve(HERE, '..'); const ROOT = path.resolve(DESK, '..');
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const V198 = '009f2c6ef2064dbdd18f5a2995669128df13a9ce', V199 = '891150fb88e2c7c0d5e5885b4f71ec3e206912c2';
let n = 0, fail = 0; const ok = (c, name) => { n++; if (c) console.log('  ✔ ' + String(n).padStart(2, '0') + ' ' + name); else { fail++; console.error('  ✘ ' + String(n).padStart(2, '0') + ' ' + name); } };
function grabFn(sig, src) { src = src || HTML; const a = src.indexOf(sig); if (a < 0) return ''; let d = 0, st = false; for (let j = src.indexOf('{', a); j < src.length; j++) { const c = src[j]; if (c === '{') { d++; st = true; } else if (c === '}') { d--; if (st && d === 0) return src.slice(a, j + 1); } } return ''; }
const gitShow = (sha) => { try { return execSync('git show ' + sha + ':desktop/src/renderer/index.html', { cwd: ROOT, maxBuffer: 128 * 1024 * 1024 }).toString(); } catch (_) { return null; } };
const gitDiff = (a, b, p) => { try { return execSync('git diff ' + a + ' ' + b + ' -- ' + p, { cwd: ROOT, maxBuffer: 128 * 1024 * 1024 }).toString(); } catch (_) { return null; } };
/* diff do commit `a` contra a ÁRVORE DE TRABALHO (robusto: funciona com mudanças ainda não commitadas E no CI onde worktree==HEAD) */
const gitDiffWt = (a, p) => { try { return execSync('git diff ' + a + ' -- ' + p, { cwd: ROOT, maxBuffer: 128 * 1024 * 1024 }).toString(); } catch (_) { return null; } };

/* ── MOCK Firestore fiel ── */
function fsValidate(v, fp) { if (v === undefined) { const e = new Error('Unsupported field value: undefined (found in field ' + fp + ')'); e.name = 'FirebaseError'; e.code = 'invalid-argument'; throw e; } if (v === null) return; if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) fsValidate(v[i], fp + '.' + i); return; } if (typeof v === 'object') { if (typeof v.getTime === 'function') return; for (const k of Object.keys(v)) fsValidate(v[k], fp ? fp + '.' + k : k); return; } if (typeof v === 'number' && Number.isNaN(v)) { const e = new Error('Unsupported field value: NaN'); e.name = 'FirebaseError'; e.code = 'invalid-argument'; throw e; } }
function makeStore(opts) { opts = opts || {}; const store = new Map(); let seq = 0; const col = () => ({ add: async (d) => { if (opts.setThrow) throw opts.setThrow; fsValidate(d, ''); const id = 'a_' + (++seq); store.set(id, JSON.parse(JSON.stringify(d))); return { id }; }, doc: (id) => { const _id = id || ('g_' + (++seq)); return { id: _id, set: async (d) => { if (opts.setThrow) throw opts.setThrow; fsValidate(d, ''); store.set(_id, JSON.parse(JSON.stringify(d))); }, get: async () => { if (opts.getThrow) throw opts.getThrow; const d = store.get(_id); return { exists: d !== undefined, data: () => d }; }, update: async (p) => { const d = store.get(_id) || {}; store.set(_id, Object.assign(d, p)); } }; } }); return { db: { collection: () => col() }, store }; }

const SUBS = { semanal: { label: 'Semanal', formTitle: 'Cronograma semanal', contentCount: 11, fields: [] }, quinzenal: { label: 'Quinzenal', formTitle: 'Cronograma quinzenal', contentCount: 8, fields: [] }, mensal: { label: 'Mensal', formTitle: 'Cronograma mensal', contentCount: 12, fields: [] } };
const SAVE_SRC = ['function cronSanitizeDeep(', 'function cronMaskId(', 'function cronCode(', 'function cronDiag(', 'function cronClassifyError(', 'function cronValidateSend(', 'function composedDesc(', 'async function saveTask(', 'async function saveCardsBatch('].map(s => grabFn(s)).join('\n');
function makeRun(form, dbObj, userRole, sector, sub) {
  const captured = {}; const state = { user: { id: 'soc1', name: 'Arydyjany', role: userRole || 'social' }, users: [{ id: 'soc1', name: 'Arydyjany', role: userRole || 'social' }, { id: 'desA', name: 'Boaz', role: 'designer' }], form, tab: '', boardSector: '' };
  const ctx = {
    state, tpl: () => ({ clientRequired: true, fields: [], subtypes: SUBS }), curSub: () => SUBS[form.subtype] || SUBS.semanal,
    secOf: (s) => { const k = (typeof s === 'string' ? s : (s && s.sector)) || ''; return { key: k, label: k, clientRequired: (k === 'cronograma' || k === 'roteiro') }; },
    isClientSector: (k) => k === 'cronograma' || k === 'roteiro', isSocialUser: (u) => !!(u && u.role === 'social'), photoOf: () => '',
    dtMs: (d, t) => { if (!d) return 0; const p = String(d).split('-').map(Number), q = String(t || '00:00').split(':').map(Number); if (p.length !== 3 || p.some(isNaN)) return NaN; return new Date(p[0], p[1] - 1, p[2], q[0] || 0, q[1] || 0).getTime(); },
    db: dbObj, alert: (m) => { captured.alert = m; }, render: () => {}, openSendClientModal: (t) => { captured.modal = t; ctx.tokenAfter = true; },
    boardCol: 0, window: { desktopAPI: { diagLog: (topic, p) => { (captured.diag = captured.diag || []).push(topic); } }, __APP_VERSION: '1.0.200' }, navigator: { onLine: opts_online() },
    cardsQtyOf: () => 1, CARDS_MAX_BATCH: 50, curSubForCards: null,
  };
  const fn = new Function('state', 'tpl', 'curSub', 'secOf', 'isClientSector', 'isSocialUser', 'photoOf', 'dtMs', 'db', 'alert', 'render', 'openSendClientModal', 'boardCol', 'window', 'navigator',
    SAVE_SRC + '\n;return {saveTask:saveTask};')(ctx.state, ctx.tpl, ctx.curSub, ctx.secOf, ctx.isClientSector, ctx.isSocialUser, ctx.photoOf, ctx.dtMs, ctx.db, ctx.alert, ctx.render, ctx.openSendClientModal, ctx.boardCol, ctx.window, ctx.navigator);
  return { fn: fn.saveTask, captured, state };
}
let _online = true; function opts_online() { return _online; }
const mkForm = (o) => Object.assign({ id: null, step: 3, sector: 'cronograma', subtype: 'semanal', title: 'Cronograma Hospital Visão', client: 'Hospital Visão', assigneeId: null, assignee: '', status: 'afazer', startDate: '', startTime: '', endDate: '', endTime: '', dueDate: '', dueTime: '', priority: false, fields: {}, contents: [], items: [], videos: [], checklist: [], link: '', obs: '', _openContent: null, _sendAfterSave: true, _sending: true, _draftId: null, _saving: false }, o || {});
const temas = (k) => Array.from({ length: k }, (_, i) => ({ tema: 'Tema ' + (i + 1), legenda: 'Legenda ' + (i + 1) }));
const hasUndef = (v) => v === undefined ? true : v === null ? false : Array.isArray(v) ? v.some(hasUndef) : (typeof v === 'object' && typeof v.getTime !== 'function') ? Object.keys(v).some(k => hasUndef(v[k])) : (typeof v === 'number' && Number.isNaN(v));
async function save(form, opts, role) { const { db, store } = makeStore(opts); const r = makeRun(form, db, role); await r.fn(); return { r, store, saved: [...store.values()][0] }; }

console.log('══ SALVAMENTO (1-6, 10-12, 32) ══');
{ const s = await save(mkForm({ contents: temas(1) })); ok(!s.r.captured.alert && !!s.saved, '(01) Cronograma mínimo (1 tema) salva'); }
{ const s = await save(mkForm({ contents: temas(3) })); ok(!!s.saved && s.saved.cronContents.length === 3, '(02) 3 temas salva'); }
{ const s = await save(mkForm({ contents: temas(11) })); ok(!!s.saved && s.saved.cronContents.length === 11, '(03) 11 temas salva'); }
{ const s = await save(mkForm({ subtype: 'semanal', contents: temas(4) })); ok(!!s.saved, '(04) Cronograma semanal salva'); }
{ const s = await save(mkForm({ subtype: 'quinzenal', contents: temas(4) })); ok(!!s.saved, '(05) Cronograma quinzenal salva'); }
{ const s = await save(mkForm({ subtype: 'mensal', contents: temas(4) })); ok(!!s.saved, '(06) Cronograma mensal salva'); }
{ const s = await save(mkForm({ contents: temas(11) })); ok(!!s.saved && !hasUndef(s.saved), '(07) Payload NÃO contém undefined'); }
{ const s = await save(mkForm({ contents: temas(3) })); ok(!!s.saved && !hasUndef(s.saved), '(08) Payload NÃO contém NaN'); }
{ const s = await save(mkForm({ contents: temas(3), endDate: '2026-08-10', endTime: '18:00' })); ok(!!s.saved && !hasUndef(s.saved), '(09) Payload NÃO contém Invalid Date'); }
{ const s = await save(mkForm({ contents: temas(2), startDate: '2026-08-01', startTime: '08:00' })); ok(!!s.saved && s.saved.startDate === '2026-08-01', '(10) início (startDate) válido preservado'); }
{ const s = await save(mkForm({ contents: temas(2), dueDate: '2026-08-10', dueTime: '18:00' })); ok(!!s.saved && s.saved.dueDate === '2026-08-10', '(11) prazo (dueDate) válido preservado'); }
{ const s = await save(mkForm({ contents: temas(2) })); ok(!!s.saved && s.saved.dueDate === '' && !('dueAt' in s.saved), '(12) sem prazo opcional NÃO envia valor inválido (nem dueAt)'); }
{ const sp = []; sp[0] = { tema: 'T1', legenda: 'L1' }; sp[5] = { tema: 'T6' }; sp[10] = { tema: 'T11', legenda: 'L11' }; const s = await save(mkForm({ contents: sp })); ok(!!s.saved && s.saved.cronContents.length === 3, '(32) TODOS os temas preenchidos persistem (esparso compactado: 3)'); }

console.log('\n══ WRITE + READ-BACK + TOKEN/MENSAGEM depois do save (13-16) ══');
{ const s = await save(mkForm({ contents: temas(3) })); ok((s.r.captured.diag || []).includes('cron.firestore.write.success'), '(13) Firestore write confirmado (evento)'); }
{ const s = await save(mkForm({ contents: temas(3) })); ok((s.r.captured.diag || []).includes('cron.readback.success'), '(14) Read-back confirmado (evento)'); }
{ const s = await save(mkForm({ contents: temas(3) })); ok(!!s.r.captured.modal, '(15) Token/link garantido só DEPOIS do save (modal abre pós-write)'); }
{ const s = await save(mkForm({ contents: temas(3) })); const di = s.r.captured.diag || []; ok(di.indexOf('cron.readback.success') >= 0 && !!s.r.captured.modal, '(16) Mensagem/modal montada DEPOIS do save+readback'); }

console.log('\n══ FROZEN — cache-bust / Card Premium / link portal (17-18, 33, 40) ══');
{ const base = gitShow(V199); const grab = (re) => { const a = HTML.match(re), b = base && base.match(re); return a && b && a[0] === b[0]; };
  ok(grab(/function buildShareClientUrl\([^]*?\n\}/), '(17) cache-bust/URL aprovada — buildShareClientUrl byte-idêntica à 1.0.199');
  ok(grab(/function buildClientMessage\([^]*?\n\}/), '(18) Card Premium/mensagem — buildClientMessage byte-idêntica à 1.0.199');
  ok(grab(/function ensureStableClientReviewToken\([^]*?\n\}/), '(33) Link portal — ensureStableClientReviewToken byte-idêntica à 1.0.199');
  ok(grab(/function openSendClientModal\([^]*?\n\}/), '(40) Card Premium — openSendClientModal byte-idêntica à 1.0.199'); }

console.log('\n══ IDEMPOTÊNCIA / CLIQUE DUPLO (19-21) ══');
{ const s = await save(mkForm({ contents: temas(2) })); ok(s.store.size === 1, '(19) clique único cria UMA tarefa'); }
{ const { db, store } = makeStore(); const form = mkForm({ contents: temas(2) }); const r = makeRun(form, db); await r.fn(); await r.fn(); ok(store.size === 1, '(20) clique duplo (2ª chamada com form já limpo) NÃO cria 2ª tarefa'); }
{ const { db, store } = makeStore(); const draft = 'fixed_draft_1'; const f1 = mkForm({ contents: temas(2), _draftId: draft }); const f2 = mkForm({ contents: temas(2), _draftId: draft }); const r1 = makeRun(f1, db); await r1.fn(); const r2 = makeRun(f2, db); await r2.fn(); ok(store.size === 1, '(21) retry com mesmo draftId NÃO duplica (1 doc)'); }

console.log('\n══ FALHA preserva wizard / não abre WhatsApp / sem doc parcial (22-24) ══');
{ const err = Object.assign(new Error('unavailable'), { name: 'FirebaseError', code: 'unavailable' }); const s = await save(mkForm({ contents: temas(3) }), { setThrow: err }); ok(s.r.state.form && s.r.state.form._saving === false, '(22) falha PRESERVA o formulário (state.form intacto)'); }
{ const err = Object.assign(new Error('unavailable'), { name: 'FirebaseError', code: 'unavailable' }); const s = await save(mkForm({ contents: temas(3) }), { setThrow: err }); ok(!s.r.captured.modal, '(23) falha NÃO abre WhatsApp/modal'); }
{ const err = Object.assign(new Error('unavailable'), { name: 'FirebaseError', code: 'unavailable' }); const s = await save(mkForm({ contents: temas(3) }), { setThrow: err }); ok(s.store.size === 0, '(24) falha NÃO cria documento parcial (coleção vazia)'); }

console.log('\n══ MENSAGENS DE ERRO classificadas (25-28) ══');
{ const err = Object.assign(new Error('Missing or insufficient permissions.'), { name: 'FirebaseError', code: 'permission-denied' }); const s = await save(mkForm({ contents: temas(3) }), { setThrow: err }); ok(/autoriza|sess/i.test(s.r.captured.alert || '') && !/conexão/i.test(s.r.captured.alert || ''), '(25) permission-denied → mensagem de autorização (não "conexão")'); }
{ _online = false; const err = Object.assign(new Error('The service is currently unavailable.'), { name: 'FirebaseError', code: 'unavailable' }); const s = await save(mkForm({ contents: temas(3) }), { setThrow: err }); _online = true; ok(/conexão/i.test(s.r.captured.alert || ''), '(26) offline/unavailable → mensagem de conexão (correta)'); }
{ const s = await save(mkForm({ contents: [{ tema: '', legenda: '' }] })); ok(/tema/i.test(s.r.captured.alert || '') && s.store.size === 0, '(27) validação (0 temas preenchidos) → mensagem de campo; nada gravado'); }
{ const err = Object.assign(new Error('boom weird'), { name: 'TypeError' }); const s = await save(mkForm({ contents: temas(3) }), { setThrow: err }); ok(/CRON-[0-9A-F]{4}/.test(s.r.captured.alert || ''), '(28) erro inesperado → código de diagnóstico CRON-XXXX'); }

console.log('\n══ WIZARD limpa só no final / permissões (29-31) ══');
{ const s = await save(mkForm({ contents: temas(2) })); ok(s.r.state.form === null, '(29) sucesso limpa o wizard (state.form=null) SOMENTE no final'); }
{ const s = await save(mkForm({ contents: temas(2) }), null, 'social'); ok(!!s.saved, '(30) Social Media autorizada salva'); }
{ const err = Object.assign(new Error('Missing or insufficient permissions.'), { name: 'FirebaseError', code: 'permission-denied' }); const s = await save(mkForm({ contents: temas(2) }), { setThrow: err }); ok(s.store.size === 0 && /autoriza|sess/i.test(s.r.captured.alert || ''), '(31) usuário sem permissão NÃO salva + mensagem correta'); }

console.log('\n══ DIFERENCIAL 1.0.198 × 1.0.199 (a falha NÃO veio da 1.0.199) ══');
{ const b198 = gitShow(V198), b199 = gitShow(V199); const st198 = grabFn('async function saveTask(', b198), st199 = grabFn('async function saveTask(', b199);
  ok(!!st198 && st198 === st199, '(D1) saveTask BYTE-IDÊNTICO 1.0.198→1.0.199 (prova: a regressão não foi introduzida na 1.0.199)'); }
{ const d = gitDiff(V198, V199, 'desktop/src/renderer/index.html'); const only = d && !/^\+/m.test(d.split('\n').filter(l => /^[+-]/.test(l) && !/^[+-][+-]/.test(l)).filter(l => !/startAt|dueAt|dueDate\|\|/.test(l) && /^[+-]\s*\S/.test(l)).join('\n')) ;
  ok(d !== null && /startAt:\(Number\(dtMs/.test(d) && /kbv2SlaLiveData/.test(d) && !/saveTask/.test(d), '(D2) diff 1.0.198→1.0.199 confinado a edicao_cards (startAt/dueAt/kbv2SlaLiveData); NÃO toca saveTask'); }

console.log('\n══ REGRESSÕES CONGELADAS (34-40) — diff 1.0.199→HEAD confinado ══');
{ /* F3.5.4K toca APENAS main.ts (roteamento por foco/lock/deep-link/observabilidade) e bgNotify.ts
     (multimonitor+bgStatus); o núcleo durável de SLA/notif/scheduler/regras permanece byte-idêntico.
     F3.5.4N — firebase.ts SAIU dos byte-congelados: recebe DIFF CONTROLADO (observador de saúde aditivo). */
  const frozenMain = ['slaScheduler.ts','slaRules.js','cardsRules.js','notifier.ts','notifierA.ts','notifStore.ts','toastAck.ts','reminder.ts','tray.ts','updaterService.ts','actorProfile.js','clockSync.ts']; // F3.5.4P: notifEvents.js saiu dos byte-congelados (DIFF CONTROLADO abaixo: help/blocked aditivos)
  let dfrozen = ''; for (const f of frozenMain) dfrozen += gitDiffWt(V199, 'desktop/src/main/' + f);
  ok(dfrozen === '', '(34-38 base) SLA/notif/scheduler/regras/núcleo durável intactos (F3.5.4K só toca main.ts+bgNotify.ts)');
  // F3.5.4N — firebase.ts: diff CONTROLADO = observador de saúde ADITIVO; entrega (cb) + re-attach intactos.
  const fbd = gitDiffWt(V199, 'desktop/src/main/firebase.ts') || '';
  const fbRm = fbd.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---'));
  const fbAdditive = /setListenHealthObserver/.test(fbd) && /_emitHealth/.test(fbd) && /const generation = \+\+_genCounter/.test(fbd);
  const fbOnlyDiag = fbRm.every((l) => l.trim() === '-' || /diag\("firestore\.(snapshot|error)"/.test(l));
  const fbNoLogicRm = !fbRm.some((l) => /onSnapshot|attempt\+\+|delayMs|rearmTimer|Math\.pow|unsub/.test(l));
  ok(fbAdditive && fbOnlyDiag && fbNoLogicRm, '(34-38 base) firebase.ts — DIFF CONTROLADO F3.5.4N: observador de saúde aditivo (entrega/re-attach intactos)'); }
{ const dSch = gitDiffWt(V199, 'desktop/src/main/slaScheduler.ts') || '';
  const dNe = gitDiffWt(V199, 'desktop/src/main/notifEvents.js') || '';
  const add = new Set(dNe.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1).trim()));
  const netRem = dNe.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---')).map(l => l.slice(1).trim()).filter(l => l && !add.has(l));
  const A = [...add]; const neAdditive = netRem.length === 0 && A.some(l => /help_requested/.test(l)) && A.some(l => /\bblocked\b/.test(l)) && A.some(l => /assigned_designer/.test(l));
  ok(dSch === '' && neAdditive, '(37) notificações — slaScheduler byte-idêntico; notifEvents DIFF CONTROLADO F3.5.4P (help/blocked aditivos, ZERO remoção)'); }
{ const dSla = gitDiffWt(V199, 'desktop/src/main/slaRules.js') + gitDiffWt(V199, 'desktop/src/main/cardsRules.js'); ok(dSla === '', '(38-39) SLA/sino — slaRules/cardsRules byte-idênticos'); }
{ const scb199 = grabFn('async function saveCardsBatch(', gitShow(V199)), scbNow = grabFn('async function saveCardsBatch(', HTML); ok(!!scb199 && scb199 === scbNow, '(35) Edição de Cards — saveCardsBatch byte-idêntico à 1.0.199'); }
{ const dHtml = gitDiffWt(V199, 'desktop/src/renderer/index.html') || ''; const bad = dHtml.split('\n').filter(l => /^[+-]/.test(l) && !/^[+-][+-]/.test(l)).filter(l => /(slaib|f354gMon|sla-monitor|kbv2-card|notif-toast|bgnotify|whatsapp|buildClientMessage|buildShareClientUrl|cloudflare|og:image|\?v=)/i.test(l));
  ok(bad.length === 0, '(36,40) diff do renderer NÃO toca sino/Monitor/card/notif/Card Premium/cache-bust (' + bad.length + ' linhas suspeitas)'); }
{ const dHtml = gitDiffWt(V199, 'desktop/src/renderer/index.html') || ''; ok(/cronSanitizeDeep/.test(dHtml) && /cronValidateSend/.test(dHtml) && /Salvando cronograma/.test(dHtml), '(34) Roteiro/Cronograma — correção presente no diff (fluxo-cliente compartilhado, sem regressão)'); }

console.log('\n' + (fail === 0 ? '✅ f354i-cronograma-save-send-client: ' + n + '/' + n + ' verdes' : '❌ ' + fail + '/' + n + ' falharam'));
if (fail) process.exit(1);
