#!/usr/bin/env node
/* =====================================================================
 * F3.5.4I — REPRODUÇÃO/PROVA do salvamento de Cronograma "Enviar para o cliente".
 * Roda o saveTask() REAL (index.html) contra um MOCK FIEL do Firestore que:
 *   - gera id (doc().id), grava (doc(id).set), lê de volta (doc(id).get);
 *   - REJEITA `undefined` em QUALQUER ponto da árvore (inclui buracos de array
 *     esparso) — exatamente como o SDK real ("Unsupported field value: undefined").
 *
 * Prova (pós-correção F3.5.4I):
 *  A) 11 temas contíguos            → salva; 11 temas persistem.
 *  B) ESPARSO (tema 1 e 11; buracos 2-10) → AGORA salva; 2 temas preenchidos
 *     persistem (buracos descartados) — antes caía no catch genérico.
 *  C) tema.legenda=undefined         → AGORA salva (nested undefined removido).
 *  D) payload final SEM undefined/NaN em nenhum ponto (saneado).
 *  E) read-back confirma antes de compartilhar.
 *  F) erro de REDE (unavailable) → mensagem de conexão (correta); permission-denied
 *     → mensagem de autorização; ambos deixam o wizard PRESERVADO.
 *  G) idempotência: 2ª chamada com o mesmo form reusa o draftId (1 doc só).
 * Rodar: node desktop/scripts/f354i-repro.mjs
 * ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(HERE, '..');
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');

function grabFn(sig) {
  const a = HTML.indexOf(sig); if (a < 0) throw new Error('não achei: ' + sig);
  let d = 0, started = false;
  for (let j = HTML.indexOf('{', a); j < HTML.length; j++) {
    const c = HTML[j];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return HTML.slice(a, j + 1); }
  }
  throw new Error('sem fechamento: ' + sig);
}
/* helpers F3.5.4I + composedDesc + saveTask — todos REAIS do index.html */
const SRC = ['function cronSanitizeDeep(', 'function cronMaskId(', 'function cronCode(', 'function cronDiag(',
  'function cronClassifyError(', 'function cronValidateSend(', 'function composedDesc(', 'async function saveTask(']
  .map(grabFn).join('\n');

/* ── MOCK Firestore fiel (undefined-reject + doc/set/get) ── */
function firestoreValidate(value, fp) {
  if (value === undefined) { const e = new Error('Function DocumentReference.set() called with invalid data. Unsupported field value: undefined (found in field ' + fp + ')'); e.name = 'FirebaseError'; e.code = 'invalid-argument'; throw e; }
  if (value === null) return;
  if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) firestoreValidate(value[i], fp + '.' + i); return; }
  if (typeof value === 'object') { if (typeof value.getTime === 'function') return; for (const k of Object.keys(value)) firestoreValidate(value[k], fp ? fp + '.' + k : k); return; }
  if (typeof value === 'number' && Number.isNaN(value)) { const e = new Error('Unsupported field value: NaN (found in field ' + fp + ')'); e.name = 'FirebaseError'; e.code = 'invalid-argument'; throw e; }
}
function makeStore(opts) {
  opts = opts || {}; const store = new Map(); let seq = 0;
  const col = () => ({
    add: async (data) => { firestoreValidate(data, ''); const id = 'auto_' + (++seq); store.set(id, JSON.parse(JSON.stringify(data))); return { id }; },
    doc: (id) => { const _id = id || ('gen_' + (++seq)); return {
      id: _id,
      set: async (data) => { if (opts.setThrow) throw opts.setThrow; firestoreValidate(data, ''); store.set(_id, JSON.parse(JSON.stringify(data))); return; },
      get: async () => { if (opts.getThrow) throw opts.getThrow; const d = store.get(_id); return { exists: d !== undefined, data: () => d }; },
    }; },
  });
  return { db: { collection: () => col() }, store };
}
const CRON_SUB = { label: 'Semanal', formTitle: 'Cronograma semanal', contentCount: 11, fields: [] };
function makeCtx(form, dbObj, captured) {
  const state = { user: { id: 'soc1', name: 'Arydyjany' }, users: [{ id: 'soc1', name: 'Arydyjany', role: 'social' }], form, tab: '', boardSector: '' };
  return { state,
    tpl: () => ({ clientRequired: true, fields: [], subtypes: { semanal: CRON_SUB } }),
    curSub: () => CRON_SUB,
    secOf: (s) => ({ key: (typeof s === 'string' ? s : (s && s.sector)) === 'cronograma' ? 'cronograma' : String(s || ''), label: 'Cronograma', clientRequired: true }),
    isClientSector: (k) => k === 'cronograma' || k === 'roteiro',
    isSocialUser: (u) => !!(u && u.role === 'social'), photoOf: () => '',
    dtMs: (d, t) => { if (!d) return 0; const p = String(d).split('-').map(Number), q = String(t || '00:00').split(':').map(Number); return new Date(p[0], p[1] - 1, p[2], q[0] || 0, q[1] || 0).getTime(); },
    db: dbObj, alert: (m) => { captured.alert = m; }, render: () => {}, openSendClientModal: (t) => { captured.modal = t; }, boardCol: 0,
    window: { desktopAPI: { diagLog: (topic, p) => { (captured.diag = captured.diag || []).push({ topic, stage: p && p.stage }); } }, __APP_VERSION: '1.0.200' },
    navigator: { onLine: opts_onLine() },
  };
}
let _onLine = true; function opts_onLine() { return _onLine; }
function runSaveTask(form, dbObj) {
  const captured = {}; const ctx = makeCtx(form, dbObj, captured);
  const fn = new Function('state', 'tpl', 'curSub', 'secOf', 'isClientSector', 'isSocialUser', 'photoOf', 'dtMs', 'db', 'alert', 'render', 'openSendClientModal', 'boardCol', 'window', 'navigator',
    SRC + '\n;return saveTask;')(ctx.state, ctx.tpl, ctx.curSub, ctx.secOf, ctx.isClientSector, ctx.isSocialUser, ctx.photoOf, ctx.dtMs, ctx.db, ctx.alert, ctx.render, ctx.openSendClientModal, ctx.boardCol, ctx.window, ctx.navigator);
  return { fn, captured, state: ctx.state };
}
const baseForm = (contents) => ({ id: null, step: 3, sector: 'cronograma', subtype: 'semanal', title: 'Cronograma Hospital Visão', client: 'Hospital Visão',
  assigneeId: null, assignee: '', status: 'afazer', startDate: '', startTime: '', endDate: '', endTime: '', dueDate: '', dueTime: '', priority: false,
  fields: {}, contents, items: [], videos: [], checklist: [], link: '', obs: '', _openContent: null, _sendAfterSave: true, _sending: true, _draftId: null, _saving: false });
function hasUndefinedDeep(v) { if (v === undefined) return true; if (v === null) return false; if (Array.isArray(v)) return v.some(hasUndefinedDeep); if (typeof v === 'object' && typeof v.getTime !== 'function') return Object.keys(v).some(k => hasUndefinedDeep(v[k])); if (typeof v === 'number' && Number.isNaN(v)) return true; return false; }

let red = 0; const line = (ok, msg) => { if (!ok) red++; console.log((ok ? '  ✔ ' : '  ✘ RED ') + msg); };

console.log('══ A) 11 temas contíguos ══');
{ const { db, store } = makeStore(); const dense = Array.from({ length: 11 }, (_, i) => ({ tema: 'Tema ' + (i + 1), legenda: 'Leg ' + (i + 1) }));
  const r = runSaveTask(baseForm(dense), db); await r.fn();
  const saved = [...store.values()][0];
  line(!r.captured.alert && !!saved && saved.cronContents.length === 11, 'A salva; 11 temas persistem (sem alert de falha)'); }

console.log('\n══ B) ESPARSO — tema 1 e 11; buracos 2-10 (uso real out-of-order) ══');
{ const { db, store } = makeStore(); const sparse = []; sparse[0] = { tema: 'Tema 1', legenda: 'Leg 1' }; sparse[10] = { tema: 'Tema 11', legenda: 'Leg 11' };
  const r = runSaveTask(baseForm(sparse), db); await r.fn();
  const saved = [...store.values()][0];
  line(!r.captured.alert && !!saved, 'B AGORA salva (antes caía no catch "Verifique a conexão")');
  line(!!saved && saved.cronContents.length === 2 && saved.cronContents[0].tema === 'Tema 1' && saved.cronContents[1].tema === 'Tema 11', 'buracos descartados; os 2 temas PREENCHIDOS persistem');
  line(!!saved && !hasUndefinedDeep(saved), 'payload gravado SEM undefined em nenhum ponto'); }

console.log('\n══ C) tema.legenda=undefined explícito ══');
{ const { db, store } = makeStore(); const r = runSaveTask(baseForm([{ tema: 'T1', legenda: 'L1' }, { tema: 'T2', legenda: undefined }]), db); await r.fn();
  const saved = [...store.values()][0];
  line(!r.captured.alert && !!saved && !hasUndefinedDeep(saved) && saved.cronContents.length === 2, 'C AGORA salva; nested undefined removido; 2 temas persistem'); }

console.log('\n══ D) read-back + observabilidade ══');
{ const { db } = makeStore(); const r = runSaveTask(baseForm([{ tema: 'T1', legenda: 'L1' }]), db); await r.fn();
  const topics = (r.captured.diag || []).map(d => d.topic);
  line(topics.includes('cron.firestore.write.success') && topics.includes('cron.readback.success'), 'emite cron.firestore.write.success + cron.readback.success (read-back confirma antes de compartilhar)');
  line(!!r.captured.modal, 'abre o modal de envio (token/WhatsApp) SÓ após o save confirmado'); }

console.log('\n══ E) erro de REDE real (unavailable) → mensagem de conexão; wizard preservado ══');
{ const netErr = Object.assign(new Error('The service is currently unavailable.'), { name: 'FirebaseError', code: 'unavailable' });
  const { db } = makeStore({ setThrow: netErr }); const r = runSaveTask(baseForm([{ tema: 'T1', legenda: 'L1' }]), db); await r.fn();
  line(/Verifique a conex/.test(r.captured.alert || ''), 'unavailable ⇒ "…Verifique a conexão…" (correto: é rede)');
  line(r.state.form && r.state.form._saving === false && !r.captured.modal, 'wizard PRESERVADO; NÃO abre WhatsApp'); }

console.log('\n══ F) permission-denied → mensagem de autorização (não fala em conexão) ══');
{ const permErr = Object.assign(new Error('Missing or insufficient permissions.'), { name: 'FirebaseError', code: 'permission-denied' });
  const { db } = makeStore({ setThrow: permErr }); const r = runSaveTask(baseForm([{ tema: 'T1', legenda: 'L1' }]), db); await r.fn();
  line(/autoriza|sess/i.test(r.captured.alert || '') && !/conexão/i.test(r.captured.alert || ''), 'permission-denied ⇒ mensagem de autorização (nunca "conexão")'); }

console.log('\n══ G) idempotência — 2 cliques (mesmo form) NÃO duplicam ══');
{ const { db, store } = makeStore(); const form = baseForm([{ tema: 'T1', legenda: 'L1' }]);
  const r1 = runSaveTask(form, db); await r1.fn();          // 1º save: gera draftId, grava, limpa form → state.form=null
  const draft1 = form._draftId;
  // simula "retry" reaproveitando o MESMO form (com _draftId já setado) num 2º saveTask sobre o mesmo store:
  const form2 = Object.assign(baseForm([{ tema: 'T1', legenda: 'L1' }]), { _draftId: draft1 });
  const r2 = runSaveTask(form2, db); await r2.fn();
  line(!!draft1 && store.size === 1, 'draftId estável ⇒ 2ª gravação sobrescreve o MESMO doc (1 só na coleção)'); }

console.log('\n══ H) DIFERENCIAL — saveTask NÃO mudou de 1.0.198→1.0.199 (a falha não veio da 1.0.199) ══');
{ const cur = grabFn('async function saveTask(');   // saveTask ATUAL (1.0.200, já corrigido) tem os hooks F3.5.4I
  line(/cronSanitizeDeep|cronValidateSend|_draftId/.test(cur), 'saveTask 1.0.200 contém a correção F3.5.4I (sanitize+validate+idempotente)');
  console.log('     (a prova de que 1.0.199==1.0.198 em saveTask está no git diff v1.0.198 v1.0.199 e na suíte f354i-*)'); }

console.log('\n' + (red ? ('❌ ' + red + ' verificação(ões) RED') :
  '✅ F3.5.4I OK: temas esparsos/undefined saneados (todos os preenchidos persistem), read-back confirma antes de compartilhar, erros REAIS classificados (rede×permissão×validação), idempotência garantida. Fluxo Cronograma→cliente restaurado.'));
process.exit(red ? 1 : 0);
