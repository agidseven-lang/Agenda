/**
 * F3.5.3A — Suíte: CONSISTÊNCIA DA FOTO DO ATOR nas notificações imediatas gerais.
 * Mapeia os testes obrigatórios da autorização (atribuição 1-17, movimentação 18-32,
 * perfis 33-48, durabilidade 49-60, segurança da imagem 61-70) na parte determinística.
 * Fixtures 100% sintéticas. Roda com `node scripts/f353a-actor-photo.test.mjs`.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

const require2 = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const AP = require2(path.join(ROOT, 'src', 'main', 'actorProfile.js'));
const NE = require2(path.join(ROOT, 'src', 'main', 'notifEvents.js'));
const { createNotifStore } = require2(path.join(ROOT, 'dist', 'main', 'notifStore.js'));
const { startNotifierA } = require2(path.join(ROOT, 'dist', 'main', 'notifierA.js'));

let ok = 0, fail = 0; const fails = [];
function t(id, desc, fn) {
  try { fn(); ok++; console.log(`  ✓ ${id} ${desc}`); }
  catch (e) { fail++; fails.push(`${id} ${desc} :: ${e.message}`); console.log(`  ✗ ${id} ${desc}\n      ${e.message}`); }
}
function eq(a, b, m) { if (a !== b) throw new Error(`${m || 'eq'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
const NOW = 1_800_000_000_000; const D = 86_400_000;
const FOTO_M = 'https://storage.sintetico.example/fotos/maria.jpg';
const FOTO_J = 'data:image/png;base64,aGVsbG8=';
const FOTO_D = 'https://storage.sintetico.example/fotos/joao-designer.jpg';
const DIR = { U1: { name: 'Maria Sintética', photo: FOTO_M }, U2: { name: 'João Sintético', photo: FOTO_J }, U3: { name: 'Sem Foto Sintético', photo: '' }, U4: { name: 'Foto Má Sintética', photo: 'javascript:alert(1)' } };
const look = (id) => DIR[id] || null;

console.log('\n══ Segurança da imagem — sanitizePhotoUrl (testes 61-70) ══');
t('S1', 'https:// aceita; data:image/*;base64 aceita', () => {
  eq(AP.sanitizePhotoUrl(FOTO_M), FOTO_M);
  eq(AP.sanitizePhotoUrl(FOTO_J), FOTO_J);
});
t('S2', 'javascript:/file:/http:/blob:/relativa REJEITADAS (testes 62-63, 66; 57 caminho local)', () => {
  for (const bad of ['javascript:alert(1)', 'file:///C:/Users/x/foto.png', 'http://inseguro.example/a.png', 'blob:https://x/y', 'C:\\fotos\\a.png', './rel.png', 'fotos/a.png']) {
    eq(AP.sanitizePhotoUrl(bad), '', 'deveria rejeitar: ' + bad);
  }
});
t('S3', 'HTML/aspas/controle rejeitados — nunca executa nem quebra atributo (teste 61)', () => {
  eq(AP.sanitizePhotoUrl('https://x/"onerror="alert(1)'), '');
  eq(AP.sanitizePhotoUrl("https://x/'><img src=x>"), '');
  eq(AP.sanitizePhotoUrl('https://x/a\u0000b.png'), '');
});
t('S4', 'conteúdo não-imagem e data gigante rejeitados (testes 64-65)', () => {
  eq(AP.sanitizePhotoUrl('data:text/html;base64,PGI+'), '');
  eq(AP.sanitizePhotoUrl('data:image/png;base64,' + 'A'.repeat(AP.DATA_IMAGE_MAX + 10)), '');
});
t('S5', 'entrada malformada não causa crash (teste 70)', () => {
  for (const v of [null, undefined, 123, {}, [], '   ']) eq(AP.sanitizePhotoUrl(v), '');
});

console.log('\n══ Resolvedor canônico (testes 33-48) ══');
t('R1', 'ator com foto canônica no diretório → ResolvedWithPhoto/usersPublic (teste 33)', () => {
  const r = AP.resolveNotificationActorProfile({ actorId: 'U1', nameDenorm: '', photoDenorm: '' }, look);
  eq(r.state, 'ResolvedWithPhoto'); eq(r.reason, 'usersPublic'); eq(r.photo, FOTO_M); eq(r.name, 'Maria Sintética');
});
t('R2', 'denorm VÁLIDA do evento tem prioridade (fonte 1) e é a MESMA p/ todos', () => {
  const r = AP.resolveNotificationActorProfile({ actorId: 'U1', nameDenorm: 'Maria S.', photoDenorm: FOTO_D }, look);
  eq(r.state, 'ResolvedWithPhoto'); eq(r.reason, 'event_denorm'); eq(r.photo, FOTO_D);
});
t('R3', 'sem foto cadastrada → INICIAIS com razão PhotoMissing; nunca logo (testes 34, 47)', () => {
  const r = AP.resolveNotificationActorProfile({ actorId: 'U3', nameDenorm: '', photoDenorm: '' }, look);
  eq(r.state, 'ResolvedWithInitials'); eq(r.reason, 'PhotoMissing'); eq(r.photo, ''); eq(r.initials, 'SS');
});
t('R4', 'URL inválida (diretório ou denorm) → INICIAIS com razão PhotoInvalid (testes 35-36)', () => {
  const a = AP.resolveNotificationActorProfile({ actorId: 'U4', nameDenorm: '', photoDenorm: '' }, look);
  eq(a.state, 'ResolvedWithInitials'); eq(a.reason, 'PhotoInvalid'); eq(a.photo, '');
  const b = AP.resolveNotificationActorProfile({ actorId: 'U3', nameDenorm: '', photoDenorm: 'file:///x.png' }, look);
  eq(b.reason, 'PhotoInvalid'); eq(b.photo, '');
});
t('R5', 'actorId inexistente → ActorNotFound + iniciais do denorm se houver (teste 39)', () => {
  const r = AP.resolveNotificationActorProfile({ actorId: 'U99', nameDenorm: '', photoDenorm: '' }, look);
  eq(r.state, 'ResolvedWithInitials'); eq(r.reason, 'ActorNotFound'); eq(r.photo, '');
  const r2 = AP.resolveNotificationActorProfile({ actorId: 'U99', nameDenorm: 'Zé Denorm', photoDenorm: '' }, look);
  eq(r2.initials, 'ZD');
});
t('R6', 'lookup é POR actorId — nomes iguais com ids diferentes não misturam foto (testes 41, 46, 48)', () => {
  const dir2 = { A1: { name: 'Ana Silva', photo: 'https://x.example/a1.png' }, A2: { name: 'Ana Silva', photo: 'https://x.example/a2.png' } };
  const l2 = (id) => dir2[id] || null;
  eq(AP.resolveNotificationActorProfile({ actorId: 'A1' }, l2).photo, 'https://x.example/a1.png');
  eq(AP.resolveNotificationActorProfile({ actorId: 'A2' }, l2).photo, 'https://x.example/a2.png');
});
t('R7', 'iniciais preservam acentos (teste 40); lookup que lança não derruba (timeout→iniciais, testes 58-59)', () => {
  eq(AP.initialsOf('Édipo Ávila'), 'ÉÁ');
  const r = AP.resolveNotificationActorProfile({ actorId: 'U1', nameDenorm: 'Édipo Ávila' }, () => { throw new Error('boom'); });
  eq(r.state, 'ResolvedWithInitials'); eq(r.initials, 'ÉÁ');
});
t('R8', 'foto ATUALIZADA no diretório reflete quando não há denorm (teste 37-38: cache antigo não prende)', () => {
  const dyn = { U1: { name: 'Maria Sintética', photo: 'https://x.example/nova.png' } };
  const r = AP.resolveNotificationActorProfile({ actorId: 'U1' }, (id) => dyn[id]);
  eq(r.photo, 'https://x.example/nova.png');
});

console.log('\n══ Payload Categoria A — ator com FOTO consistente (testes 1-32, 49-50) ══');
const T2 = { id: 'T2', title: 'Cronograma Agosto', sector: 'cronograma', by: 'U1', createdAt: NOW - 5 * D,
  designerAssignment: { designerId: 'U2', designerName: 'João Sintético', assignedAt: NOW - 2 * D, assignedBy: 'U1', assignedByName: 'Maria Sintética', assignedByAvatar: FOTO_M, designerAvatar: FOTO_D } };
const T1 = { id: 'T1', title: 'Card Julho', sector: 'edicao_cards', by: 'U1', createdAt: NOW - 3 * D,
  history: [ { kind: 'moved', from: 'afazer', to: 'andamento', at: NOW - 2 * D, byId: 'U2' },
             { kind: 'moved', from: 'revisao', to: 'concluido', at: NOW - D, byId: 'U2' },
             { kind: 'moved', from: 'concluido', to: 'revisao', at: NOW - D / 2, byId: 'U1' } ] };
t('P1', 'ATRIBUIÇÃO: actorAvatar = foto de QUEM ATRIBUIU (denorm do doc); responsável separado (testes 1-8)', () => {
  const ev = NE.deriveTaskEvents(T2, { nowMs: NOW }).find((e) => e.type === 'task_assigned');
  const p = NE.buildCategoryAPayload(ev, 'UX', look);
  eq(p.actorAvatar, FOTO_M, 'foto da Social que atribuiu');
  eq(p.responsibleAvatar, FOTO_D, 'foto do designer NO CAMPO responsável (nunca como ator)');
  eq(p.actorId, 'U1'); eq(p.actorName, 'Maria Sintética');
  eq(p.body, 'Maria Sintética atribuiu ‘Cronograma Agosto’ para João Sintético.', 'conteúdo F3.5.3 INALTERADO');
});
t('P2', 'MOVIMENTAÇÃO/CONCLUSÃO/REABERTURA: foto do ator REAL de cada transição via usersPublic (testes 18-27)', () => {
  const evs = NE.deriveTaskEvents(T1, { nowMs: NOW });
  const mv = evs.find((e) => e.type === 'task_moved');
  const done = evs.find((e) => e.type === 'task_completed');
  const rop = evs.find((e) => e.type === 'task_reopened');
  eq(NE.buildCategoryAPayload(mv, 'UX', look).actorAvatar, FOTO_J, 'João moveu → foto do João');
  eq(NE.buildCategoryAPayload(done, 'UX', look).actorAvatar, FOTO_J, 'João concluiu → foto do João');
  eq(NE.buildCategoryAPayload(rop, 'UX', look).actorAvatar, FOTO_M, 'Maria reabriu → foto da Maria');
});
t('P3', 'CONSISTÊNCIA: mesmo eventId ⇒ MESMA foto p/ QUALQUER destinatário (incl. o ator) — testes 2-6, 43-44', () => {
  const ev = NE.deriveTaskEvents(T2, { nowMs: NOW }).find((e) => e.type === 'task_assigned');
  const uids = ['U1', 'U2', 'U3', 'ADMIN', 'OUTRO'];
  const fotos = new Set(uids.map((u) => NE.buildCategoryAPayload(ev, u, look).actorAvatar));
  eq(fotos.size, 1); eq([...fotos][0], FOTO_M);
});
t('P4', 'BACKLOG/evento antigo SEM denorm: resolve pelo actorId no usersPublic; sem foto ⇒ "" (iniciais na superfície) — testes 49-52', () => {
  const antigo = { id: 'TA', title: 'Antiga', sector: 'cronograma', history: [{ kind: 'moved', from: 'afazer', to: 'andamento', at: NOW - D, byId: 'U3' }] };
  const ev = NE.deriveTaskEvents(antigo, { nowMs: NOW })[0];
  const p = NE.buildCategoryAPayload(ev, 'UX', look);
  eq(p.actorAvatar, '', 'U3 não tem foto ⇒ vazio (iniciais, nunca logo)');
  eq(p.actorName, 'Sem Foto Sintético');
  const ev2 = { ...ev, actorId: 'U2' };
  eq(NE.buildCategoryAPayload(ev2, 'UX', look).actorAvatar, FOTO_J, 'com foto no diretório ⇒ resolve');
});
t('P5', 'foto INVÁLIDA no denorm não vaza: cai p/ usersPublic ou iniciais; jamais outra pessoa (testes 8, 35, 46, 48)', () => {
  const suja = { ...T2, designerAssignment: { ...T2.designerAssignment, assignedByAvatar: 'javascript:x', designerAvatar: 'file:///d.png' } };
  const ev = NE.deriveTaskEvents(suja, { nowMs: NOW }).find((e) => e.type === 'task_assigned');
  const p = NE.buildCategoryAPayload(ev, 'UX', look);
  eq(p.actorAvatar, FOTO_M, 'denorm inválida ⇒ usersPublic do MESMO actorId');
  eq(p.responsibleAvatar, FOTO_J, 'designer idem (fonte própria, nunca a do ator)');
});
t('P6', 'retro-compat: resolveProfile como função-de-nome (string) segue funcionando (regressão F3.5.3)', () => {
  const ev = NE.deriveTaskEvents(T1, { nowMs: NOW }).find((e) => e.type === 'task_moved');
  const p = NE.buildCategoryAPayload(ev, 'UX', (id) => (id === 'U2' ? 'João Sintético' : ''));
  eq(p.actorName, 'João Sintético'); eq(p.actorAvatar, '', 'string ⇒ sem foto (iniciais)');
  eq(p.body, 'João Sintético moveu ‘Card Julho’ de A Fazer para Em andamento.');
});

console.log('\n══ notifierA — diretório usersPublic {name,photo} de ponta a ponta (testes 12-16, 28-32) ══');
function fakeFs() { const L = {}; return { listen: (n, cb) => { L[n] = cb; return () => { delete L[n]; }; }, push: (n, docs) => L[n] && L[n]({ docChanges: () => docs.map((d) => ({ type: d.type || 'added', doc: { id: d.id, data: () => d.data } })) }) }; }
function fakeTimers() { return { setTimer: () => ({}), clearTimer: () => {} }; }
t('N1', 'payload entregue carrega a foto do ator vinda do usersPublic (todas as superfícies recebem o MESMO payload)', () => {
  const fsx = fakeFs(); const out = [];
  const st = createNotifStore({ file: path.join(os.tmpdir(), `f353a-${Date.now()}.json`) });
  const n = startNotifierA('U7', (p) => { out.push(p); return { ok: true, channel: 'toast' }; },
    { listen: fsx.listen, store: st, now: () => NOW, ...fakeTimers(), onLog: () => {} });
  fsx.push('usersPublic', [{ id: 'U1', data: { name: 'Maria Sintética', photo: FOTO_M } }, { id: 'U2', data: { name: 'João Sintético', photo: FOTO_J } }]);
  fsx.push('tasks', [{ id: 'T1', data: T1 }]);
  const mv = out.find((p) => p.eventType === 'task_moved');
  eq(mv.actorAvatar, FOTO_J); eq(mv.actorName, 'João Sintético');
  const rop = out.find((p) => p.eventType === 'task_reopened');
  eq(rop.actorAvatar, FOTO_M, 'atores diferentes não misturam foto na mesma sequência (teste 45-46)');
  n.stop();
});
t('N2', 'usersPublic SEM foto ⇒ payload sem foto (iniciais na superfície); nunca ícone como avatar', () => {
  const fsx = fakeFs(); const out = [];
  const st = createNotifStore({ file: path.join(os.tmpdir(), `f353a2-${Date.now()}.json`) });
  const n = startNotifierA('U7', (p) => { out.push(p); return { ok: true, channel: 'toast' }; },
    { listen: fsx.listen, store: st, now: () => NOW, ...fakeTimers(), onLog: () => {} });
  fsx.push('usersPublic', [{ id: 'U2', data: { name: 'João Sintético' } }]);
  fsx.push('tasks', [{ id: 'T1', data: { ...T1, history: [T1.history[0]] } }]);
  eq(out[0].actorAvatar, ''); eq(out[0].actorName, 'João Sintético');
  n.stop();
});

console.log('\n══ Superfícies + Categoria B intocada (contratos estáticos) ══');
const html = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');
const bg = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'bgnotify.html'), 'utf8');
t('V1', 'bg-window: prioriza actorAvatar do payload e cai p/ INICIAIS — nunca logomarca (testes 7, 27)', () => {
  eq(bg.includes("(p.actorAvatar||p.responsibleAvatar||'')"), true, 'ator primeiro fora de SLA');
  eq(bg.includes('ntf-av gen'), true, 'fallback de iniciais presente');
  eq(/icon\.png|logo|app\.ico/i.test(bg), false, 'nenhum ícone de app como avatar');
});
t('V2', 'toast: resolve diretório e usa o denorm do payload como fallback (race pós-login coberta)', () => {
  eq(html.includes('var actor=resolveUserIdentity(p.actorId,{name:p.actorName,avatar:p.actorAvatar});'), true);
  eq(html.includes('if(!photo){ var c=fb.avatar||fb.photo||'), true, 'denorm real aceito como fallback');
});
t('V3', 'SLA (T-30/T-10) na bg-window segue usando o RESPONSÁVEL (contrato preservado)', () => {
  eq(bg.includes("isSla?(p.responsibleAvatar||'')"), true);
});
t('V4', 'Categoria B byte-idêntica à 1.0.192 (8 arquivos, git diff vazio)', () => {
  const { execSync } = require2('child_process');
  const files = ['slaRules.js', 'cardsRules.js', 'slaScheduler.ts', 'bgNotify.ts', 'tray.ts', 'updaterService.ts', 'firebase.ts', 'reminder.ts'];
  for (const f of files) {
    const d = execSync(`git diff fdd684261f59f7d288c6d4197d7ecd0050ce0bb5 -- src/main/${f}`, { cwd: ROOT }).toString();
    eq(d, '', `src/main/${f} deve ser byte-idêntico`);
  }
});

const total = ok + fail;
console.log(`\nF3.5.3A SUÍTE (foto do ator): ${ok} OK, ${fail} FALHOU (de ${total})`);
if (fail) { fails.forEach((f) => console.log('  FALHA: ' + f)); process.exit(1); }
