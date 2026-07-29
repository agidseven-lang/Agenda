/**
 * F3.5.3 — Suíte 1: NOTIFICAÇÕES DURÁVEIS (Categoria A) + cursor/recibos/deviceId + ACK do toast.
 * Mapeia os TESTES OBRIGATÓRIOS da autorização: atribuição (1-15), movimentação (16-31),
 * T-30/T-10 preservadas (32-43, parte estática/comportamental), recuperação (44-60) e
 * estresse (76-88, parte determinística). Roda com `node scripts/f353-durable-notifications.test.mjs`.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

const require2 = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NE = require2(path.join(ROOT, 'src', 'main', 'notifEvents.js'));
const { createNotifStore } = require2(path.join(ROOT, 'dist', 'main', 'notifStore.js'));
const { createToastAckTracker } = require2(path.join(ROOT, 'dist', 'main', 'toastAck.js'));
const { startNotifierA } = require2(path.join(ROOT, 'dist', 'main', 'notifierA.js'));
const slaRules = require2(path.join(ROOT, 'src', 'main', 'slaRules.js'));
const cardsRules = require2(path.join(ROOT, 'src', 'main', 'cardsRules.js'));

let ok = 0, fail = 0; const fails = [];
function t(id, desc, fn) {
  try { fn(); ok++; console.log(`  ✓ ${id} ${desc}`); }
  catch (e) { fail++; fails.push(`${id} ${desc} :: ${e.message}`); console.log(`  ✗ ${id} ${desc}\n      ${e.message}`); }
}
function eq(a, b, m) { if (a !== b) throw new Error(`${m || 'eq'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
function ge(a, b, m) { if (!(a >= b)) throw new Error(`${m || 'ge'}: ${a} < ${b}`); }
function tmpFile() { return path.join(os.tmpdir(), `f353-store-${Date.now()}-${Math.random().toString(36).slice(2)}.json`); }

const NOW = 1_800_000_000_000; // relógio injetado (nunca Date.now real nas derivações)
const D = 24 * 60 * 60 * 1000;

/* ───────── fixtures sintéticas (NENHUM dado real) ───────── */
const T1 = { id: 'T1', title: 'Card Julho', sector: 'edicao_cards', assigneeId: 'U2', assignee: 'João Sintético', by: 'U1', createdAt: NOW - 3 * D,
  history: [
    { kind: 'moved', from: 'afazer', to: 'andamento', at: NOW - 2 * D, byId: 'U2' },
    { kind: 'designer_moved', axis: 'designerFlowStatus', from: 'andamento', to: 'revisao', at: NOW - 1 * D, byId: 'U2', byUid: 'U2' },
    { kind: 'moved', from: 'revisao', to: 'concluido', at: NOW - 12 * 60 * 60 * 1000, byId: 'U2' },
    { kind: 'moved', from: 'concluido', to: 'revisao', at: NOW - 6 * 60 * 60 * 1000, byId: 'U3' },
  ] };
const T2 = { id: 'T2', title: 'Cronograma Agosto', sector: 'cronograma', by: 'U1', createdAt: NOW - 5 * D,
  designerAssignment: { designerId: 'U2', designerName: 'João Sintético', assignedAt: NOW - 2 * D, assignedBy: 'U1', assignedByName: 'Maria Sintética' },
  history: [] };
const T_OLD = { id: 'T9', title: 'Velha', sector: 'edicao_cards', by: 'U1', createdAt: NOW - 90 * D,
  history: [{ kind: 'moved', from: 'afazer', to: 'andamento', at: NOW - 60 * D, byId: 'U1' }] };

console.log('\n══ notifEvents — derivação durável e conteúdo oficial ══');
t('E1', 'movimentação vira task_moved com from/to reais (teste 16-21: todas as transições)', () => {
  const evs = NE.deriveTaskEvents(T1, { nowMs: NOW });
  const mv = evs.filter((e) => e.type === 'task_moved');
  eq(mv.length, 2, 'afazer>andamento e andamento>revisao são moved puros');
  eq(mv[0].fromStatus, 'afazer'); eq(mv[0].toStatus, 'andamento');
  eq(mv[1].fromStatus, 'andamento'); eq(mv[1].toStatus, 'revisao');
});
t('E2', 'transição p/ concluido vira task_completed; concluido→X vira task_reopened (testes 18-19, 37-38 análogos)', () => {
  const evs = NE.deriveTaskEvents(T1, { nowMs: NOW });
  eq(evs.filter((e) => e.type === 'task_completed').length, 1);
  const ro = evs.filter((e) => e.type === 'task_reopened');
  eq(ro.length, 1); eq(ro[0].toStatus, 'revisao');
});
t('E3', 'designer_moved (eixo do designer) também produz evento (teste 20-21)', () => {
  const evs = NE.deriveTaskEvents(T1, { nowMs: NOW });
  eq(evs.some((e) => e.eventId.includes('andamento>revisao')), true);
});
t('E4', 'designerAssignment vira task_assigned com ator e designer denormalizados (teste 1-3)', () => {
  const evs = NE.deriveTaskEvents(T2, { nowMs: NOW });
  const a = evs.find((e) => e.type === 'task_assigned');
  eq(!!a, true); eq(a.assignedDesignerId, 'U2'); eq(a.actorId, 'U1'); eq(a.actorNameDenorm, 'Maria Sintética');
});
t('E5', 'assigneeId direto (sem designerAssignment) vira task_assigned ancorado em createdAt (teste 1)', () => {
  const evs = NE.deriveTaskEvents(T1, { nowMs: NOW });
  const a = evs.find((e) => e.type === 'task_assigned');
  eq(!!a, true); eq(a.assignedDesignerId, 'U2'); eq(a.at, T1.createdAt);
});
t('E6', 'eventId é DETERMINÍSTICO (mesma entrada ⇒ mesmos ids; nunca Date.now isolado)', () => {
  const a = NE.deriveTaskEvents(T1, { nowMs: NOW }).map((e) => e.eventId).join('|');
  const b = NE.deriveTaskEvents(T1, { nowMs: NOW }).map((e) => e.eventId).join('|');
  eq(a, b); eq(a.includes(String(NOW)), false, 'ids não derivam do relógio da máquina');
});
t('E7', 'ordenação ASC por at (recuperação entrega do mais antigo p/ o mais novo — teste 49)', () => {
  const evs = NE.deriveTaskEvents(T1, { nowMs: NOW });
  for (let i = 1; i < evs.length; i++) ge(evs[i].at, evs[i - 1].at, 'ordem');
});
t('E8', 'retenção 30 dias: eventos antigos ficam fora (contrato de retenção)', () => {
  eq(NE.deriveTaskEvents(T_OLD, { nowMs: NOW }).length, 0);
});
t('E9', 'recipientMode all_active_users em TODOS os eventos Categoria A (testes 2-6, 22)', () => {
  const evs = [...NE.deriveTaskEvents(T1, { nowMs: NOW }), ...NE.deriveTaskEvents(T2, { nowMs: NOW })];
  eq(evs.every((e) => e.recipientMode === 'all_active_users'), true);
});
t('E10', 'CONTEÚDO oficial — atribuição: "{ATOR} atribuiu ‘{TAREFA}’ para {DESIGNER}."', () => {
  const a = NE.deriveTaskEvents(T2, { nowMs: NOW }).find((e) => e.type === 'task_assigned');
  const p = NE.buildCategoryAPayload(a, 'UX', (id) => (id === 'U1' ? 'Maria Sintética' : id === 'U2' ? 'João Sintético' : ''));
  eq(p.title, 'Tarefa atribuída');
  eq(p.body, 'Maria Sintética atribuiu ‘Cronograma Agosto’ para João Sintético.');
});
t('E11', 'CONTEÚDO oficial — movimentação: "{ATOR} moveu ‘{TAREFA}’ de {ORIGEM} para {DESTINO}." (testes 23-25)', () => {
  const mv = NE.deriveTaskEvents(T1, { nowMs: NOW }).find((e) => e.type === 'task_moved');
  const p = NE.buildCategoryAPayload(mv, 'UX', (id) => (id === 'U2' ? 'João Sintético' : ''));
  eq(p.title, 'Tarefa movimentada');
  eq(p.body, 'João Sintético moveu ‘Card Julho’ de A Fazer para Em andamento.');
});
t('E12', 'CONTEÚDO oficial — conclusão e reabertura (com destino)', () => {
  const evs = NE.deriveTaskEvents(T1, { nowMs: NOW });
  const done = evs.find((e) => e.type === 'task_completed');
  const rop = evs.find((e) => e.type === 'task_reopened');
  const rn = (id) => (id === 'U2' ? 'João Sintético' : id === 'U3' ? 'Ana Sintética' : '');
  eq(NE.buildCategoryAPayload(done, 'UX', rn).body, 'João Sintético concluiu ‘Card Julho’.');
  eq(NE.buildCategoryAPayload(rop, 'UX', rn).body, 'Ana Sintética reabriu ‘Card Julho’ em Revisão.');
  eq(NE.buildCategoryAPayload(done, 'UX', rn).title, 'Tarefa concluída');
  eq(NE.buildCategoryAPayload(rop, 'UX', rn).title, 'Tarefa reaberta');
});
t('E13', 'acentos/caracteres especiais preservados no corpo (contrato de conteúdo)', () => {
  const tt = { ...T2, title: 'Ação & Emoção — çãõ 🎬' };
  const a = NE.deriveTaskEvents(tt, { nowMs: NOW }).find((e) => e.type === 'task_assigned');
  const p = NE.buildCategoryAPayload(a, 'UX', () => 'José');
  eq(p.body.includes('Ação & Emoção — çãõ 🎬'), true);
});
t('E14', 'clique abre a tarefa correta: action.deep = detail/<taskId> (testes 9, 26-27, 40)', () => {
  const mv = NE.deriveTaskEvents(T1, { nowMs: NOW }).find((e) => e.type === 'task_moved');
  const p = NE.buildCategoryAPayload(mv, 'UX', () => '');
  eq(p.action.deep, 'detail/T1'); eq(p.taskId, 'T1');
});
t('E15', 'dedupKey == eventId (identidade única p/ dedup real — testes 10, 28, 50)', () => {
  const mv = NE.deriveTaskEvents(T1, { nowMs: NOW }).find((e) => e.type === 'task_moved');
  const p = NE.buildCategoryAPayload(mv, 'UX', () => '');
  eq(p.dedupKey, mv.eventId); eq(p.eventId, mv.eventId);
});
t('E16', 'fallback de nome: diretório > denormalizado > "Equipe"', () => {
  const a = NE.deriveTaskEvents(T2, { nowMs: NOW }).find((e) => e.type === 'task_assigned');
  eq(NE.buildCategoryAPayload(a, 'U9', () => '').body.startsWith('Maria Sintética '), true, 'denorm');
  const semNome = { ...a, actorNameDenorm: '' };
  eq(NE.buildCategoryAPayload(semNome, 'U9', () => '').body.startsWith('Equipe '), true, 'último recurso');
});

console.log('\n══ notifStore — deviceId, cursor por usuário e recibos (testes 51-56) ══');
t('S1', 'deviceId persistente e estável entre instâncias (mesmo arquivo)', () => {
  const f = tmpFile();
  const s1 = createNotifStore({ file: f }); const d1 = s1.deviceId();
  const s2 = createNotifStore({ file: f }); const d2 = s2.deviceId();
  ge(d1.length, 8); eq(d1, d2);
});
t('S2', 'cursor por usuário: avança, nunca retrocede (teste 51: só avança após entrega)', () => {
  const s = createNotifStore({ file: tmpFile() });
  eq(s.cursorGet('u1'), 0);
  s.cursorSet('u1', 100); eq(s.cursorGet('u1'), 100);
  s.cursorSet('u1', 50); eq(s.cursorGet('u1'), 100, 'não retrocede');
  s.cursorSet('u1', 200); eq(s.cursorGet('u1'), 200);
});
t('S3', 'dois usuários no MESMO computador não se misturam nem se apagam (testes 54-55)', () => {
  const f = tmpFile(); const s = createNotifStore({ file: f });
  s.cursorSet('u1', 111); s.receiptAdd('u1', 'ev-a');
  s.cursorSet('u2', 222); s.receiptAdd('u2', 'ev-b');
  eq(s.cursorGet('u1'), 111); eq(s.cursorGet('u2'), 222);
  eq(s.receiptHas('u1', 'ev-a'), true); eq(s.receiptHas('u1', 'ev-b'), false);
  eq(s.receiptHas('u2', 'ev-b'), true); eq(s.receiptHas('u2', 'ev-a'), false);
});
t('S4', 'logout preserva cursor/recibos do usuário (teste 53: logout/login do mesmo usuário)', () => {
  const f = tmpFile();
  { const s = createNotifStore({ file: f }); s.cursorSet('u1', 999); s.receiptAdd('u1', 'ev-x'); }
  const s2 = createNotifStore({ file: f }); // novo processo/nova sessão
  eq(s2.cursorGet('u1'), 999); eq(s2.receiptHas('u1', 'ev-x'), true);
});
t('S5', 'recibos capados (evict mais antigos; nunca cresce sem limite)', () => {
  const s = createNotifStore({ file: tmpFile() });
  for (let i = 0; i < 5100; i++) s.receiptAdd('u1', 'ev-' + i);
  const mem = s._peek();
  ge(5000, Object.keys(mem.users['u1'].receipts).length, 'cap');
  eq(s.receiptHas('u1', 'ev-5099'), true, 'mais recentes preservados');
});

console.log('\n══ toastAck — prova de render do toast (app ABERTO não perde mais em silêncio) ══');
function fakeTimers() {
  const q = []; let now = 0;
  return {
    setTimer: (fn, ms) => { const h = { at: now + ms, fn, dead: false }; q.push(h); return h; },
    clearTimer: (h) => { if (h) h.dead = true; },
    advance: (ms) => { now += ms; q.filter((h) => !h.dead && h.at <= now && !h.fired).forEach((h) => { h.fired = true; h.fn(); }); },
  };
}
t('A1', 'ACK dentro do prazo cancela o fallback (toast provado)', () => {
  const ft = fakeTimers(); let fb = 0;
  const tr = createToastAckTracker({ timeoutMs: 4000, setTimer: ft.setTimer, clearTimer: ft.clearTimer });
  tr.arm('k1', () => fb++);
  eq(tr.ack('k1'), true);
  ft.advance(5000);
  eq(fb, 0); eq(tr.pending(), 0);
});
t('A2', 'sem ACK ⇒ fallback dispara UMA única vez (testes 11-14: app aberto com renderer falho)', () => {
  const ft = fakeTimers(); let fb = 0;
  const tr = createToastAckTracker({ timeoutMs: 4000, setTimer: ft.setTimer, clearTimer: ft.clearTimer });
  tr.arm('k2', () => fb++);
  ft.advance(4001); ft.advance(4001);
  eq(fb, 1); eq(tr.ack('k2'), false, 'ack tardio não encontra pendência');
});
t('A3', 'rearmar substitui o prazo; clear() cancela tudo (teardown de logout/troca)', () => {
  const ft = fakeTimers(); let fb = 0;
  const tr = createToastAckTracker({ timeoutMs: 4000, setTimer: ft.setTimer, clearTimer: ft.clearTimer });
  tr.arm('k3', () => fb++); tr.arm('k3', () => fb++);
  eq(tr.pending(), 1);
  tr.clear(); ft.advance(9000);
  eq(fb, 0); eq(tr.pending(), 0);
});

console.log('\n══ notifierA — backlog sem lacuna, retry, dedupe, todos os usuários (testes 44-60, 76-88) ══');
function fakeFirestore() {
  const listeners = {}; // name -> cb
  return {
    listen: (name, cb) => { listeners[name] = cb; return () => { delete listeners[name]; }; },
    push(name, docs) {  // docs: [{id, data, type?}]
      const cb = listeners[name]; if (!cb) return;
      cb({ docChanges: () => docs.map((d) => ({ type: d.type || 'added', doc: { id: d.id, data: () => d.data } })) });
    },
    has: (name) => !!listeners[name],
  };
}
function run(uid, opts) {
  const fs2 = fakeFirestore();
  const delivered = []; let failNext = 0;
  const deliver = (p) => { if (failNext > 0) { failNext--; return { ok: false, channel: 'none' }; } delivered.push(p); return { ok: true, channel: 'toast' }; };
  const ft = fakeTimers();
  const store = createNotifStore({ file: (opts && opts.file) || tmpFile() });
  const n = startNotifierA(uid, deliver, { listen: fs2.listen, store, now: () => NOW, setTimer: ft.setTimer, clearTimer: ft.clearTimer, onLog: () => {} });
  return { fs: fs2, delivered, setFail: (n2) => { failNext = n2; }, store, n, ft };
}
t('N1', 'BACKLOG: 1º snapshot (estado completo) entrega os eventos perdidos em ordem (testes 44-49)', () => {
  const r = run('U7');
  r.fs.push('tasks', [{ id: 'T1', data: T1 }, { id: 'T2', data: T2 }]);
  ge(r.delivered.length, 5, 'todos os eventos das 2 tarefas');
  for (let i = 1; i < r.delivered.length; i++) ge(r.delivered[i].createdAt, r.delivered[i - 1].createdAt, 'ordem asc');
  r.n.stop();
});
t('N2', 'TODOS recebem — inclusive o ATOR e usuários fora da equipe (testes 2-6, 22; filtro team_flow REMOVIDO)', () => {
  const rAtor = run('U2');       // U2 é o ator de várias transições
  rAtor.fs.push('tasks', [{ id: 'T1', data: T1 }]);
  ge(rAtor.delivered.length, 4, 'ator recebe');
  const rFora = run('U99');      // U99 não é equipe, não é supervisor
  rFora.fs.push('tasks', [{ id: 'T1', data: T1 }]);
  ge(rFora.delivered.length, 4, 'fora da equipe recebe');
  eq(rFora.delivered.every((p) => p.targetUserId === 'U99'), true);
  rAtor.n.stop(); rFora.n.stop();
});
t('N3', 'SEM duplicação: replay do snapshot e RESTART com o mesmo store não reentregam (testes 10, 28, 50, 57, 84)', () => {
  const f = tmpFile();
  const r1 = run('U7', { file: f });
  r1.fs.push('tasks', [{ id: 'T1', data: T1 }]);
  const n1 = r1.delivered.length;
  r1.fs.push('tasks', [{ id: 'T1', data: T1 }]);      // replay
  eq(r1.delivered.length, n1, 'replay não duplica');
  r1.n.stop();
  const r2 = run('U7', { file: f });                   // reinício abrupto (novo processo, mesmo store)
  r2.fs.push('tasks', [{ id: 'T1', data: T1 }]);
  eq(r2.delivered.length, 0, 'restart não duplica');
  r2.n.stop();
});
t('N4', 'FALHA de entrega NÃO avança cursor e re-tenta depois (testes 51-52; retry sem loop)', () => {
  const r = run('U7');
  r.setFail(1);                                        // 1ª entrega falha
  r.fs.push('tasks', [{ id: 'T1', data: T1 }]);
  const after1 = r.delivered.length;
  eq(r.store.cursorGet('U7') <= T1.history[0].at, true, 'cursor não passou do evento falho');
  r.ft.advance(60001);                                 // re-eval de segurança (≤60s)
  ge(r.delivered.length, after1 + 1, 'retry entregou');
  r.n.stop();
});
t('N5', 'TEMPO REAL sem lacuna: evento novo após o backlog entra pelo MESMO stream (testes 15, 59-60)', () => {
  const r = run('U7');
  r.fs.push('tasks', [{ id: 'T1', data: T1 }]);
  const base = r.delivered.length;
  const T1b = { ...T1, history: [...T1.history, { kind: 'moved', from: 'revisao', to: 'andamento', at: NOW - 1000, byId: 'U3' }] };
  r.fs.push('tasks', [{ id: 'T1', data: T1b, type: 'modified' }]);
  eq(r.delivered.length, base + 1, 'exatamente 1 novo');
  eq(r.delivered[r.delivered.length - 1].body.includes('de Revisão para Em andamento'), true);
  r.n.stop();
});
t('N6', 'nomes REAIS via diretório usersPublic no corpo (conteúdo oficial)', () => {
  const r = run('U7');
  r.fs.push('usersPublic', [{ id: 'U2', data: { name: 'João Sintético' } }, { id: 'U1', data: { name: 'Maria Sintética' } }]);
  r.fs.push('tasks', [{ id: 'T1', data: { ...T1, history: [T1.history[0]] } }]);
  const mv = r.delivered.find((p) => p.eventType === 'task_moved');
  eq(mv.body, 'João Sintético moveu ‘Card Julho’ de A Fazer para Em andamento.');
  r.n.stop();
});
t('N7', 'stop() encerra listeners e nada mais entrega (logout/troca de usuário — testes 53-54)', () => {
  const r = run('U7');
  r.fs.push('tasks', [{ id: 'T1', data: { ...T1, history: [T1.history[0]] } }]);
  const n1 = r.delivered.length;
  r.n.stop();
  eq(r.fs.has('tasks'), false, 'unsubscribe');
  r.fs.push('tasks', [{ id: 'T1', data: T1 }]);
  eq(r.delivered.length, n1);
});
t('N8', 'ESTRESSE: 20 movimentações sequenciais — ordem preservada, zero perda, zero duplicação (testes 76-77, 83-85, 88)', () => {
  const r = run('U7');
  const hist = []; const cols = ['afazer', 'andamento', 'revisao'];
  for (let i = 0; i < 20; i++) hist.push({ kind: 'moved', from: cols[i % 3], to: cols[(i + 1) % 3], at: NOW - (30 - i) * 60000, byId: 'U' + (i % 3 + 1) });
  const TT = { id: 'TS', title: 'Estresse', sector: 'edicao_cards', history: hist };
  r.fs.push('tasks', [{ id: 'TS', data: TT }]);
  eq(r.delivered.length, 20, 'todas entregues');
  const ids = new Set(r.delivered.map((p) => p.eventId));
  eq(ids.size, 20, 'sem duplicação');
  for (let i = 1; i < r.delivered.length; i++) ge(r.delivered[i].createdAt, r.delivered[i - 1].createdAt);
  r.fs.push('tasks', [{ id: 'TS', data: TT, type: 'modified' }]);
  eq(r.delivered.length, 20, 'replay = 0 novos');
  r.n.stop();
});
t('N9', 'janela de tolerância: doc atrasado (at < cursor, dentro de 48h) ainda entrega UMA vez', () => {
  const r = run('U7');
  r.fs.push('tasks', [{ id: 'T1', data: { ...T1, history: [T1.history[3]] } }]); // só o evento mais novo → cursor avança
  const c = r.store.cursorGet('U7'); ge(c, T1.history[3].at);
  r.fs.push('tasks', [{ id: 'TL', data: { id: 'TL', title: 'Atrasada', sector: 'cronograma', history: [{ kind: 'moved', from: 'afazer', to: 'andamento', at: c - 60 * 60 * 1000, byId: 'U1' }] } }]);
  eq(r.delivered.some((p) => p.taskId === 'TL'), true, 'entregue apesar de at < cursor');
  const n1 = r.delivered.length;
  r.fs.push('tasks', [{ id: 'TL', data: { id: 'TL', title: 'Atrasada', sector: 'cronograma', history: [{ kind: 'moved', from: 'afazer', to: 'andamento', at: c - 60 * 60 * 1000, byId: 'U1' }] }, type: 'modified' }]);
  eq(r.delivered.length, n1, 'sem duplicação');
  r.n.stop();
});

console.log('\n══ Categoria B (T-30/T-10) — PRESERVADA: pessoal, somente o Designer (testes 32-36, 39) ══');
t('B1', 'sla_warning continua sla_personal: SOMENTE o designer responsável (teste 32-33)', () => {
  const task = { id: 'TB', sector: 'cronograma', designerAssignment: { designerId: 'U2' } };
  const tgDesigner = slaRules.resolveNotificationTargets({ eventType: 'sla_warning', task, currentUser: { id: 'U2' } });
  const tgAdmin = slaRules.resolveNotificationTargets({ eventType: 'sla_warning', task, currentUser: { id: 'U1' }, currentUserCanSeeAll: true });
  eq(tgDesigner.shouldNotifyCurrentUser, true);
  eq(tgAdmin.shouldNotifyCurrentUser, false, 'Admin NÃO recebe T-30/T-10 (mesmo vê-tudo)');
  eq(tgAdmin.notificationType, 'sla_personal');
});
t('B2', 'Social/outro Designer NÃO recebem T-30/T-10 (testes 34-36)', () => {
  const task = { id: 'TB', sector: 'cronograma', designerAssignment: { designerId: 'U2' } };
  eq(slaRules.resolveNotificationTargets({ eventType: 'sla_overdue', task, currentUser: { id: 'U3' } }).shouldNotifyCurrentUser, false);
  eq(slaRules.resolveNotificationTargets({ eventType: 'sla_warning', task, currentUser: { id: 'U5' } }).shouldNotifyCurrentUser, false);
});
t('B3', 'Edição de Cards: T-30 amarela / T-10 vermelha com dedup própria INALTERADA (testes 37-39)', () => {
  const due = NOW + 20 * 60000; // faltam 20min ⇒ banda VERMELHA (due-10 já passou? não: red em due-10 ⇒ now >= due-30 → warning; ajustar)
  const d = new Date(NOW + 25 * 60000);
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const task = { id: 'TC', sector: 'edicao_cards', title: 'Card', designerAssignment: { designerId: 'U2' },
    dueDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, dueTime: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  const evs = cardsRules.cardsEmissionsFor(task, 'U2', NOW);
  eq(evs.length, 1); eq(evs[0].eventType, 'sla_cards_warning', 'amarela em due−30');
  eq(evs[0].dedupKey.startsWith('cards_warning:TC:'), true, 'chave própria preservada');
  eq(cardsRules.cardsEmissionsFor(task, 'U1', NOW).length, 0, 'não-designer não recebe');
  void due;
});
t('B4', 'conclusão SUPRIME T-30/T-10 (concluir cancela — teste 37)', () => {
  const d = new Date(NOW + 25 * 60000); const pad = (n) => (n < 10 ? '0' : '') + n;
  const task = { id: 'TC2', sector: 'edicao_cards', doneAt: NOW - 1000, designerAssignment: { designerId: 'U2' },
    dueDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, dueTime: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  eq(cardsRules.cardsEmissionsFor(task, 'U2', NOW).length, 0);
});

const total = ok + fail;
console.log(`\nF3.5.3 SUÍTE 1 (duráveis): ${ok} OK, ${fail} FALHOU (de ${total})`);
if (fail) { fails.forEach((f) => console.log('  FALHA: ' + f)); process.exit(1); }
