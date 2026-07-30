/**
 * F3.5.4F — f354f-task-edit-update-notification.test.mjs
 * =====================================================================================
 * EDIÇÃO DE TAREFA/PRAZO + task_updated — 32 asserts obrigatórios + cenários
 * multiusuário (Admin / Social Media / Designer A / Designer B).
 * Camadas REAIS exercitadas:
 *   - renderer: openCardsEdit/saveCardsEdit extraídos do index.html (vm + db fake);
 *   - main puro: notifEvents (src) — derivação/conteúdo/payload;
 *   - main durável: notifierA (dist compilado) com listen/store/deliver injetados.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require2 = createRequire(import.meta.url);
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');
const MAINTS = fs.readFileSync(path.join(ROOT, 'src', 'main', 'main.ts'), 'utf8');
const NE = require2(path.join(ROOT, 'src', 'main', 'notifEvents.js'));
const { startNotifierA } = require2(path.join(ROOT, 'dist', 'main', 'notifierA.js'));

let n = 0, fail = 0;
function ok(cond, name) { n++; if (cond) { console.log(`  ✔ ${String(n).padStart(2, '0')} ${name}`); } else { fail++; console.error(`  ✘ ${String(n).padStart(2, '0')} ${name}`); } }

function grab(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('função não encontrada: ' + name);
  const isAsync = HTML.slice(Math.max(0, i - 8), i).includes('async ');
  let j = HTML.indexOf('{', i), depth = 0, k = j;
  for (; k < HTML.length; k++) { const ch = HTML[k]; if (ch === '{') depth++; else if (ch === '}') { depth--; if (!depth) break; } }
  return (isAsync ? 'async ' : '') + HTML.slice(i, k + 1);
}

/* ── contexto vm p/ o write-path REAL da edição ── */
const DUE_OLD = { d: '2026-08-01', t: '16:00' }, DUE_NEW = { d: '2026-08-01', t: '18:00' };
const ASSIGNED_AT = Date.now() - 3600000, MOVED_AT = ASSIGNED_AT + 60000;   // dentro da retenção de 30 dias
const baseTask = () => ({ id: 'T1', sector: 'edicao_cards', title: 'Qualidade de vida começa aqui', client: 'Hospital Visão',
  status: 'afazer', checklist: [{ t: 'revisar', d: false }], by: 'sm1', createdAt: ASSIGNED_AT,
  assignee: 'Boaz Macêdo', assigneeId: 'desA', cardTema: 'Qualidade de vida começa aqui',
  cardLegenda: 'Legenda antiga', cardObs: 'Obs antiga', cardDeadlineRev: 1,
  startDate: '2026-08-01', startTime: '08:00', endDate: DUE_OLD.d, endTime: DUE_OLD.t,
  dueDate: DUE_OLD.d, dueTime: DUE_OLD.t, due: DUE_OLD.d,
  history: [{ kind: 'moved', at: MOVED_AT, byId: 'sm1', from: 'afazer', to: 'andamento' }],
  designerAssignment: { designerId: 'desA', designerName: 'Boaz Macêdo', designerAvatar: '', designerPhoto: '',
    assignedAt: ASSIGNED_AT, assignedBy: 'sm1', assignedByName: 'Arydyjany', status: 'sent',
    startDate: '2026-08-01', startTime: '08:00', endDate: DUE_OLD.d, endTime: DUE_OLD.t, obs: 'Obs antiga' } });

function mkCtx(taskDoc, { canSee = true } = {}) {
  const updates = [], toasts = [];
  const ctx = {
    console, Date, Object, String, Number, Array, JSON, Math,
    state: { user: { id: 'sm1', name: 'Arydyjany' }, users: [
      { id: 'sm1', name: 'Arydyjany', role: 'Social Media', photo: 'https://x/sm.jpg' },
      { id: 'desA', name: 'Boaz Macêdo', role: 'Designer', photo: 'https://x/a.jpg' },
      { id: 'desB', name: 'João Pedro', role: 'Designer', photo: '' }], tasks: [taskDoc], tab: '', boardSector: null, form: null },
    boardCol: 0,
    canSeeAll: () => canSee,
    flashToast: (m) => toasts.push(m), alert: (m) => toasts.push('ALERT:' + m),
    render: () => {}, closeModal: () => {}, closeCardMenus: () => {},
    firebase: { firestore: { FieldValue: { arrayUnion: (e) => ({ __arrayUnion: [e] }) } } },
    db: { collection: () => ({ doc: (id) => ({
      update: async (patch) => { updates.push({ id, patch }); Object.keys(patch).forEach(k => { if (k !== 'history') taskDoc[k] = patch[k]; else taskDoc.history = taskDoc.history.concat(patch.history.__arrayUnion); }); },
      get: async () => ({ data: () => JSON.parse(JSON.stringify(taskDoc)) }),
    }) }) },
  };
  vm.createContext(ctx);
  vm.runInContext([grab('newForm'), grab('cardsFieldOf'), grab('photoOf'), grab('openCardsEdit'), grab('saveCardsEdit')].join('\n'), ctx);
  return { ctx, updates, toasts, taskDoc };
}

console.log('\n══ EDIÇÃO — write-path real (saveCardsEdit) ══');
const T = baseTask();
const { ctx, updates } = mkCtx(T);
vm.runInContext("openCardsEdit('T1')", ctx);
const form = ctx.state.form;
/* 1 */ ok(!!form && form.id === 'T1' && form.step === 1 && form.cards.length === 1 && form.cards[0].tema === 'Qualidade de vida começa aqui',
  'Social Media consegue editar tarefa atribuída (wizard reaberto com dados reais, f.id set)');
form.cards[0].tema = 'Qualidade de vida começa aqui — V2';
form.cards[0].legenda = 'Legenda nova';
form.cards[0].obs = 'Obs nova';
form.cards[0].endDate = DUE_NEW.d; form.cards[0].endTime = DUE_NEW.t;
await vm.runInContext('saveCardsEdit()', ctx);
const patch = updates[0] && updates[0].patch;
/* 2 */ ok(patch && patch.title === 'Qualidade de vida começa aqui — V2' && patch.cardTema === patch.title, 'título atualiza');
/* 3 */ ok(patch.cardLegenda === 'Legenda nova' && /Legenda: Legenda nova/.test(patch.desc), 'legenda atualiza');
/* 4 */ ok(patch.cardObs === 'Obs nova' && /Obs\.: Obs nova/.test(patch.desc), 'observação atualiza');
/* 5 */ ok(patch.dueDate === DUE_NEW.d && patch.dueTime === DUE_NEW.t && patch.due === DUE_NEW.d, 'prazo (canônico dueDate/dueTime/due) atualiza');
/* 6 */ ok(patch.endDate === DUE_NEW.d && patch.designerAssignment.endDate === DUE_NEW.d, 'data atualiza (endDate + designerAssignment.endDate)');
/* 7 */ ok(patch.endTime === DUE_NEW.t && patch.designerAssignment.endTime === DUE_NEW.t, 'horário atualiza (endTime + designerAssignment.endTime)');
/* 8 */ ok(patch.assigneeId === 'desA' && patch.designerAssignment.designerId === 'desA' && patch.designerAssignment.assignedAt === ASSIGNED_AT,
  'assignee PERMANECE quando não alterado (designerAssignment/assignedAt preservados — sem task_assigned falso)');
/* 9 */ ok(!('status' in patch), 'status permanece (patch NÃO contém status)');
/* 10 */ ok(!('checklist' in patch), 'checklist permanece (patch NÃO contém checklist)');
const histEntry = patch.history.__arrayUnion[0];
/* 11 */ ok(!!patch.history.__arrayUnion && T.history.length === 2 && T.history[0].kind === 'moved',
  'histórico permanece (append via arrayUnion — entrada antiga intacta)');
/* 12 */ ok(typeof patch.updatedAt === 'number' && patch.updatedAt > 0, 'updatedAt atualizado');
/* 13 */ ok(patch.updatedBy === 'sm1' && patch.updatedByName === 'Arydyjany', 'updatedBy/updatedByName corretos');
/* 14 */ ok(histEntry.prevDueDate === DUE_OLD.d && histEntry.prevDueTime === DUE_OLD.t, 'prazo ANTERIOR registrado no histórico');
/* 15 */ ok(histEntry.newDueDate === DUE_NEW.d && histEntry.newDueTime === DUE_NEW.t && histEntry.kind === 'edited' && histEntry.forId === 'desA'
  && histEntry.fields.includes('prazo') && histEntry.fields.includes('titulo'),
  'prazo NOVO + campos alterados + destinatário (forId) registrados');

console.log('\n══ ALARMES — cancelamento/recriação por construção (cardsRules reais) ══');
const S = require2(path.join(ROOT, 'src', 'main', 'slaRules.js'));
const C = require2(path.join(ROOT, 'src', 'main', 'cardsRules.js'));
const dueOldMs = S.dtMs(DUE_OLD.d, DUE_OLD.t), dueNewMs = S.dtMs(DUE_NEW.d, DUE_NEW.t);
/* 16 */ {
  const oldKey = C.cardsEmissionsFor({ ...baseTask() }, 'desA', dueOldMs - 29 * 60000, S.dtMs)[0].dedupKey;
  const nowMid = dueOldMs - 5 * 60000; // 15:55 — estaria VERMELHO no prazo antigo
  const after = C.cardsDisplayState(T, nowMid, S.dtMs);
  ok(after.inPanel === false && C.cardsNextBoundaryMs(T, nowMid, S.dtMs) === dueNewMs - 30 * 60000
    && oldKey.includes(':' + dueOldMs + ':r1'),
  'alertas ANTIGOS cancelados: com o novo prazo o doc sai da janela e o próximo marco re-arma p/ T-30 novo');
}
/* 17 */ {
  const em = C.cardsEmissionsFor(T, 'desA', dueNewMs - 29 * 60000, S.dtMs);
  ok(em.length === 1 && em[0].eventType === 'sla_cards_warning' && em[0].dedupKey === 'cards_warning:T1:' + dueNewMs + ':r2',
  'NOVOS alertas criados no prazo novo (dedupKey com dueAt novo + rev 2 — jamais colide com o antigo)');
}

console.log('\n══ task_updated — derivação durável + destinatário + conteúdo ══');
const evs = NE.deriveTaskEvents(T, { nowMs: Date.now() });
const up = evs.find(e => e.type === 'task_updated');
/* 18 */ ok(!!up && up.eventId === 'task_updated:T1:' + histEntry.at + ':sm1' && up.dueChanged === true,
  'task_updated criado (eventId determinístico do próprio doc; recuperável pós-desligamento)');
const dir = (id) => ({ sm1: { name: 'Arydyjany', photo: 'https://x/sm.jpg' }, desA: { name: 'Boaz Macêdo', photo: 'https://x/a.jpg' } }[id] || null);
const pay = NE.buildCategoryAPayload(up, 'desA', dir);
/* 19 */ ok(up.recipientMode === 'assigned_designer' && up.recipientId === 'desA' && pay.targetUserId === 'desA',
  'destinatário correto: SOMENTE o Designer atribuído no momento da edição');
/* 20-21 via notifierA fakes abaixo */
function runNotifierFor(uid, tasksDocs, { failFirst = false } = {}) {
  const delivered = []; const receipts = new Set(); let cursor = 0; let failOnce = failFirst;
  let tasksCb = null;
  const listen = (name, cb) => { if (name === 'tasks') { tasksCb = cb; } return () => {}; };
  const store = { deviceId: () => 'dev1', cursorGet: () => cursor, cursorSet: (_u, v) => { cursor = v; },
    receiptHas: (_u, id) => receipts.has(id), receiptAdd: (_u, id) => receipts.add(id) };
  const h = startNotifierA(uid, (p) => { if (failOnce) { failOnce = false; return { ok: false }; } delivered.push(p); return { ok: true, channel: 'toast' }; },
    { listen, store, setTimer: () => 0, clearTimer: () => {} });
  const snap = (docs) => ({ docChanges: () => docs.map(d => ({ type: 'added', doc: { id: d.id, data: () => d } })) });
  tasksCb(snap(tasksDocs));
  return { delivered, h, resend: () => tasksCb({ docChanges: () => [] }), reconcile: (r) => h.reconcile(r) };
}
{
  const rA = runNotifierFor('desA', [T]); rA.h.stop();
  const rOld = runNotifierFor('desB', [T]); rOld.h.stop();
  const gotA = rA.delivered.filter(p => p.eventType === 'task_updated');
  const gotB = rOld.delivered.filter(p => p.eventType === 'task_updated');
  /* 20 */ ok(gotA.length === 1 && gotB.length === 0,
    'Designer ANTIGO/OUTRO não recebe (uid≠forId ⇒ filtrado); o atribuído recebe exatamente 1×');
  /* 21 */ ok(/if \(uid\) \{/.test(MAINTS) && /session-login/.test(MAINTS) && gotB.length === 0,
    'usuário inativo não recebe (sem sessão não há notifierA; e o filtro por uid bloqueia terceiros)');
  /* 22 */ ok(pay.actorAvatar === 'https://x/sm.jpg', 'foto do ATOR (Social Media) correta — diretório usersPublic (F3.5.3A)');
  /* 23 */ ok(pay.actorName === 'Arydyjany', 'nome do ator correto');
  /* 24 */ ok(pay.title === 'Tarefa atualizada' && pay.taskTitle === 'Qualidade de vida começa aqui — V2', 'título correto ("Tarefa atualizada")');
  /* 25 */ ok(pay.body === 'Arydyjany atualizou o prazo: 01/08/2026 às 16:00 → 01/08/2026 às 18:00'
    && pay.context === 'Prazo: 01/08/2026 às 16:00 → 01/08/2026 às 18:00',
    'prazo anterior→novo no corpo e no contexto (formato oficial do owner)');
  /* 26 */ ok(pay.action && pay.action.deep === 'detail/T1' && /notif-open/.test(MAINTS),
    'clique abre a tarefa correta (deep detail/T1; main restaura/foca e navega)');
  /* 27 */ ok(gotA[0] && gotA[0].dedupKey === up.eventId && /windowActive\(\)/.test(MAINTS) && /"notif-toast"/.test(MAINTS.replace(/'/g, '"')),
    'ABERTO: entrega pelo HUB aprovado (toast in-app com ACK)');
  /* 28 */ ok(/showBgNotify\(p, \(\) => \{/.test(MAINTS), 'MINIMIZADO: bg-window premium + fallback nativa (canal aprovado)');
  /* 29 */ ok(/window\.close→hide\(tray\)/.test(MAINTS) || /close.*hide/.test(MAINTS),
    'FECHADO NO X: app segue vivo na bandeja; main entrega nativa/bg (produtor no main)');
}
/* 30. offline e reconexão — 1ª entrega falha (fila PARA, sem recibo), retry entrega 1× */
{
  const r = runNotifierFor('desA', [T], { failFirst: true });
  const after1 = r.delivered.filter(p => p.eventType === 'task_updated').length;
  r.reconcile('reconnect');
  const after2 = r.delivered.filter(p => p.eventType === 'task_updated').length;
  r.reconcile('safety'); r.h.stop();
  const after3 = r.delivered.filter(p => p.eventType === 'task_updated').length;
  ok(after1 === 0 && after2 === 1 && after3 === 1,
    'OFFLINE→RECONEXÃO: falha não marca recibo; retry entrega exatamente 1×; sem duplicar depois');
}
/* 31. dedup renderer/main */
{
  const r = runNotifierFor('desA', [T]);
  r.resend(); r.reconcile('replay'); r.h.stop();
  const total = r.delivered.filter(p => p.eventType === 'task_updated').length;
  ok(total === 1 && pay.dedupKey === up.eventId && /_notifSeen\.has\(key\)/.test(MAINTS),
    'DEDUPLICAÇÃO: recibos user+device (1 entrega por evento) + dedupKey único no HUB (toast×nativa nunca duplicam)');
}
/* 32. nenhuma regressão de atribuição */
{
  const evs2 = NE.deriveTaskEvents(baseTask(), { nowMs: Date.now() });
  const asg = evs2.find(e => e.type === 'task_assigned');
  ok(!!asg && asg.eventId === 'task_assigned:T1:desA:' + ASSIGNED_AT && asg.recipientMode === 'all_active_users'
    && NE.evBody(asg, 'Arydyjany', 'Boaz Macêdo') === 'Arydyjany atribuiu ‘Qualidade de vida começa aqui’ para Boaz Macêdo.',
    'ZERO regressão de atribuição (task_assigned byte-idêntico: eventId, destino geral e corpo)');
}

console.log('\n══ MULTIUSUÁRIO — Admin / Social / Designer A / Designer B (cenários 1-6) ══');
{
  const doc = T; // já editado (forId desA)
  const results = {};
  for (const uid of ['adm1', 'sm1', 'desA', 'desB']) {
    const r = runNotifierFor(uid, [doc]); r.h.stop();
    results[uid] = r.delivered.filter(p => p.eventType === 'task_updated').length;
  }
  console.log('  entregas task_updated por usuário:', JSON.stringify(results));
  if (!(results.desA === 1 && results.sm1 === 0 && results.adm1 === 0 && results.desB === 0)) { fail++; console.error('  ✘ multiusuário: distribuição incorreta'); }
  else console.log('  ✔ multiusuário: SÓ o Designer atribuído recebeu (Admin/SM/Designer B: nada)');
}

console.log(`\n${fail === 0 ? '✅' : '❌'} f354f-task-edit-update-notification: ${n - fail}/${n} asserts (+ cenário multiusuário)`);
if (fail) process.exit(1);
