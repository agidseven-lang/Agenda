#!/usr/bin/env node
/* F3.3.13 — EDITAR PRAZO COM GRAVAÇÃO REAL (write-path mínimo, OPÇÃO A: espelhamento condicional).
 *
 * Teste EXECUTÁVEL: extrai do FONTE real (index.html) as funções `slaEditPrazoCommit` e
 * `slaPanelFinishMs` e as roda num sandbox com Firestore/DOM MOCKADOS. Prova, de fato:
 *   1) tarefa SEM plannedFinishAt -> patch grava SÓ planStartAt + planDueAt (não cria plannedFinishAt);
 *   2) tarefa COM plannedFinishAt>0 -> ESPELHA plannedFinishAt para o novo prazo (mesmo ms do due);
 *   3) NUNCA cria plannedFinishAt onde não existia;
 *   4) patch SÓ contém campos designerSla.plan* (status/responsável/cliente/etapa/demais intactos);
 *   5) read-back: só declara sucesso se o servidor confirmar e slaPanelFinishMs()==prazo editado;
 *   6) read-back que NÃO confirma -> sem sucesso, erro claro, estado recarregado, sem otimismo falso;
 *   7) validação (due<=start / data inválida) -> não grava nada.
 * Plus blindagem ESTÁTICA: notificações/card premium/cache-bust/Worker intocados; espelhamento guardado
 * por hadPF; nenhuma escrita extra de plannedFinishAt fora de slaEditPrazoCommit.
 * Puro Node (sem Chromium/electron). Rodar: /opt/node22/bin/node desktop/scripts/f33G-editprazo-write.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const rd = (p) => fs.readFileSync(p, 'utf8');
const DH   = rd(path.join(DESK, 'src', 'renderer', 'index.html'));
const MAIN = rd(path.join(DESK, 'src', 'main', 'main.ts'));
const WK   = rd(path.join(ROOT, 'cloudflare-worker.js'));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.log('FAIL:', n); } };

// ───────────────────────── extrair as funções reais do index.html ─────────────────────────
function slice(src, startMark, endMark) {
  const a = src.indexOf(startMark); if (a < 0) throw new Error('marca inicial não achada: ' + startMark);
  const b = src.indexOf(endMark, a); if (b < 0) throw new Error('marca final não achada: ' + endMark);
  return src.slice(a, b);
}
const commitSrc = slice(DH, 'async function slaEditPrazoCommit(taskId, ov){', "\nif(typeof window!=='undefined' && !window.__slaEditBound)");
const finishSrc = (() => { const m = 'function slaPanelFinishMs(t,dtMsFn){'; const a = DH.indexOf(m); const e = '\n  return 0;\n}'; const b = DH.indexOf(e, a); return DH.slice(a, b + e.length); })();

// dtMs idêntico ao do app (index.html:2281) — mesma semântica de fuso (horário local)
const dtMs = (date, time) => { if (!date) return null; const [y, m, d] = date.split('-').map(Number); const [hh, mm] = ((time || '00:00').split(':')).map(Number); return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0).getTime(); };

// fábrica do sandbox: injeta dependências e devolve as duas funções reais
function buildFns(deps) {
  const factory = new Function('db', 'document', 'dtMs', 'state', 'flashToast', 'render', 'console',
    finishSrc + '\n' + commitSrc + '\n; return { slaEditPrazoCommit, slaPanelFinishMs };');
  return factory(deps.db, deps.document, dtMs, deps.state, deps.flashToast, deps.render, console);
}

// ───────────────────────── mocks ─────────────────────────
function makeDb(stored, opts) {
  opts = opts || {}; let updated = null;
  const docApi = {
    update: async (patch) => {
      updated = patch;
      if (!opts.skipApply) { for (const k in patch) { const mm = /^designerSla\.(.+)$/.exec(k); if (mm) { stored.designerSla = stored.designerSla || {}; stored.designerSla[mm[1]] = patch[k]; } else { stored[k] = patch[k]; } } }
      if (opts.failUpdate) throw new Error('update-failed');
    },
    get: async () => ({ data: () => (opts.tamper ? opts.tamper(stored) : stored) }),
  };
  return { _updated: () => updated, collection: () => ({ doc: () => docApi }) };
}
function makeDocDOM(startStr, dueStr) {
  const els = { 'slaedit-start': { value: startStr }, 'slaedit-due': { value: dueStr }, 'slaedit-save': { disabled: false } };
  return { getElementById: (id) => els[id] || null, _els: els };
}
const makeOv = () => ({ removed: false, remove() { this.removed = true; } });
const baseTask = () => ({
  id: 'task1', status: 'afazer', assigneeId: 'd1', assignee: 'Desert', assigneeName: 'Desert',
  client: 'ACME', sector: 'cronograma', priority: 'alta', designerFlowStatus: 'afazer',
  designerAssignment: { designerId: 'd1', designerName: 'Desert', endDate: '2026-01-01', endTime: '10:00' },
});

// ═════════════════════ CENÁRIO 1 — tarefa SEM plannedFinishAt ═════════════════════
{
  const t = baseTask(); t.designerSla = { planStartAt: dtMs('2026-01-01', '08:00'), planDueAt: dtMs('2026-01-05', '17:00'), seedAt: 111, seedBy: 'u1' };
  const before = JSON.parse(JSON.stringify(t));
  const stored = JSON.parse(JSON.stringify(t));
  const db = makeDb(stored); const toasts = []; let renders = 0; const ov = makeOv();
  const fns = buildFns({ db, document: makeDocDOM('2026-07-01T09:00', '2026-07-10T18:00'), state: { tasks: [t] }, flashToast: (m) => toasts.push(m), render: () => { renders++; } });
  await fns.slaEditPrazoCommit('task1', ov);
  const patch = db._updated();
  const wantStart = dtMs('2026-07-01', '09:00'), wantDue = dtMs('2026-07-10', '18:00');
  ok('C1.1 patch tem SÓ planStartAt + planDueAt (sem plannedFinishAt)', JSON.stringify(Object.keys(patch).sort()) === JSON.stringify(['designerSla.planDueAt', 'designerSla.planStartAt']));
  ok('C1.2 patch grava os ms corretos (start/due)', patch['designerSla.planStartAt'] === wantStart && patch['designerSla.planDueAt'] === wantDue);
  ok('C1.3 NÃO cria plannedFinishAt no patch', !('designerSla.plannedFinishAt' in patch));
  ok('C1.4 servidor NÃO passa a ter plannedFinishAt', stored.designerSla.plannedFinishAt === undefined);
  ok('C1.5 preserva seedAt/seedBy (subcampos de designerSla)', stored.designerSla.seedAt === 111 && stored.designerSla.seedBy === 'u1');
  ok('C1.6 patch SÓ toca designerSla.plan* (nada de status/responsável/cliente/etapa)', Object.keys(patch).every((k) => /^designerSla\.plan(Start|Due)At$/.test(k)));
  ok('C1.7 status/responsável/cliente/etapa/prioridade INALTERADOS', t.status === before.status && t.assigneeId === before.assigneeId && t.assignee === before.assignee && t.client === before.client && t.sector === before.sector && t.priority === before.priority && t.designerFlowStatus === before.designerFlowStatus);
  ok('C1.8 designerAssignment INALTERADO', JSON.stringify(t.designerAssignment) === JSON.stringify(before.designerAssignment));
  ok('C1.9 read-back confirmou -> toast de sucesso', toasts.some((m) => /confirmad/i.test(m)));
  ok('C1.10 modal fechado no sucesso (ov.remove)', ov.removed === true);
  ok('C1.11 estado local reflete o REAL do servidor (designerSla.planDueAt)', t.designerSla.planDueAt === wantDue && t.designerSla.planStartAt === wantStart);
}

// ═════════════════════ CENÁRIO 2 — tarefa COM plannedFinishAt>0 (espelha) ═════════════════════
{
  const t = baseTask(); t.designerSla = { planStartAt: dtMs('2026-01-01', '08:00'), planDueAt: dtMs('2026-01-05', '17:00'), plannedFinishAt: dtMs('2026-01-09', '12:00'), seedAt: 222, seedBy: 'u2' };
  const stored = JSON.parse(JSON.stringify(t));
  const db = makeDb(stored); const toasts = []; const ov = makeOv();
  const fns = buildFns({ db, document: makeDocDOM('2026-08-02T10:30', '2026-08-12T19:00'), state: { tasks: [t] }, flashToast: (m) => toasts.push(m), render: () => {} });
  await fns.slaEditPrazoCommit('task1', ov);
  const patch = db._updated();
  const wantStart = dtMs('2026-08-02', '10:30'), wantDue = dtMs('2026-08-12', '19:00');
  ok('C2.1 patch tem os 3 campos (espelhamento)', JSON.stringify(Object.keys(patch).sort()) === JSON.stringify(['designerSla.planDueAt', 'designerSla.planStartAt', 'designerSla.plannedFinishAt']));
  ok('C2.2 plannedFinishAt ESPELHADO p/ o novo prazo (==due)', patch['designerSla.plannedFinishAt'] === wantDue);
  ok('C2.3 planStartAt/planDueAt corretos', patch['designerSla.planStartAt'] === wantStart && patch['designerSla.planDueAt'] === wantDue);
  ok('C2.4 servidor: plannedFinishAt agora == novo prazo', stored.designerSla.plannedFinishAt === wantDue);
  ok('C2.5 canônico (slaPanelFinishMs) == prazo editado', fns.slaPanelFinishMs(stored, dtMs) === wantDue);
  ok('C2.6 preserva seedAt/seedBy', stored.designerSla.seedAt === 222 && stored.designerSla.seedBy === 'u2');
  ok('C2.7 toast de sucesso', toasts.some((m) => /confirmad/i.test(m)));
}

// ═════════════════════ CENÁRIO 3 — read-back NÃO confirma (servidor não persistiu) ═════════════════════
{
  const t = baseTask(); t.designerSla = { planStartAt: dtMs('2026-01-01', '08:00'), planDueAt: dtMs('2026-01-05', '17:00'), seedAt: 333, seedBy: 'u3' };
  const stored = JSON.parse(JSON.stringify(t));
  const db = makeDb(stored, { skipApply: true }); // simula: update "ok" mas servidor não gravou o valor
  const toasts = []; const ov = makeOv();
  const dom = makeDocDOM('2026-09-01T09:00', '2026-09-09T18:00');
  const fns = buildFns({ db, document: dom, state: { tasks: [t] }, flashToast: (m) => toasts.push(m), render: () => {} });
  await fns.slaEditPrazoCommit('task1', ov);
  ok('C3.1 NÃO mostra sucesso quando read-back falha', !toasts.some((m) => /Prazo atualizado e confirmado/i.test(m)));
  ok('C3.2 mostra erro claro', toasts.some((m) => /não foi possível confirmar/i.test(m)));
  ok('C3.3 modal NÃO é fechado em falha (sem UI otimista falsa)', ov.removed === false);
  ok('C3.4 botão reabilitado p/ nova tentativa', dom._els['slaedit-save'].disabled === false);
}

// ═════════════════════ CENÁRIO 4 — validação (due<=start e data inválida) ═════════════════════
{
  const t = baseTask(); t.designerSla = { planStartAt: 1, planDueAt: 2 };
  const db = makeDb(JSON.parse(JSON.stringify(t))); const toasts = [];
  const fns = buildFns({ db, document: makeDocDOM('2026-07-10T18:00', '2026-07-01T09:00'), state: { tasks: [t] }, flashToast: (m) => toasts.push(m), render: () => {} });
  await fns.slaEditPrazoCommit('task1', makeOv());
  ok('C4.1 due<=start -> NÃO grava (update não chamado)', db._updated() === null);
  ok('C4.2 due<=start -> erro de validação', toasts.some((m) => /maior que o início/i.test(m)));

  const t2 = baseTask(); t2.designerSla = {};
  const db2 = makeDb(JSON.parse(JSON.stringify(t2))); const toasts2 = [];
  const fns2 = buildFns({ db: db2, document: makeDocDOM('', ''), state: { tasks: [t2] }, flashToast: (m) => toasts2.push(m), render: () => {} });
  await fns2.slaEditPrazoCommit('task1', makeOv());
  ok('C4.3 data inválida -> NÃO grava', db2._updated() === null);
  ok('C4.4 data inválida -> erro', toasts2.some((m) => /inválid/i.test(m)));
}

// ───────────────────────── blindagem ESTÁTICA (contrato F3.3.13 + features intocadas) ─────────────────────────
ok('S1 espelhamento de plannedFinishAt é GUARDADO por hadPF', /var hadPF=Number\(t\.designerSla&&t\.designerSla\.plannedFinishAt\)>0;/.test(DH) && /if\(hadPF\) patch\['designerSla\.plannedFinishAt'\]=dueMs;/.test(DH));
ok('S2 patch só monta designerSla.plan* (sem editedAt/editedBy/history/extra)', /patch\['designerSla\.planStartAt'\]=startMs; patch\['designerSla\.planDueAt'\]=dueMs;/.test(DH) && !/designerSla\.editedAt|designerSla\.editedBy/.test(DH));
ok('S3 nenhuma escrita de plannedFinishAt fora do espelhamento guardado', (DH.match(/plannedFinishAt'\]=/g) || []).length === 1);
ok('S4 read-back presente (get + slaPanelFinishMs + gate AND)', /await db\.collection\('tasks'\)\.doc\(taskId\)\.get\(\)/.test(DH) && /okCanon=fresh\?\(Number\(slaPanelFinishMs\(fresh,f\)\)===dueMs\):false;/.test(DH) && /if\(fresh&&okStart&&okDue&&okPF&&okCanon\)\{/.test(DH));
ok('S5 handler do "Salvar prazo" chama slaEditPrazoCommit (não é mais no-op)', /if\(e\.target\.id==='slaedit-save'\)\{ slaEditPrazoCommit\(taskId, ov\); return; \}/.test(DH));
// F3.3.70D3R10AA: contrato atualizado por ordem do owner — mensagem SEM cache-bust (regime 19/06).
ok('S6 mensagem WhatsApp no regime restaurado (link estavel, sem ?v= — D3R10AA)', /const url=buildShareClientUrl\(ctx&&ctx\.token\);/.test(DH));
ok('S7 notificações background INTOCADAS (showBgNotify primário, canal bg-window)', /const bgOk = showBgNotify\(p\);/.test(MAIN) && /channel = bgOk \? "bg-window"/.test(MAIN));
ok('S8 Worker/OG INTOCADO (OG_IMG_PATH + dimensões 1200x630)', /const OG_IMG_PATH = "\/og\/wa-card-v64-38\.jpg"/.test(WK) && /og:image:width" content="1200"/.test(WK));
ok('S9 SLA Monitor lê pelo MESMO canônico (slaPanelFinishMs em slaMonNextBoundary)', /var fin=slaPanelFinishMs\(t,f\); if\(!fin\) continue;/.test(DH));

console.log('\nF3.3.13 EDITAR-PRAZO WRITE: ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: write-path do "Editar prazo" divergiu do contrato autorizado (Opção A)'); process.exit(1); }
console.log('OK — grava SÓ planStartAt+planDueAt; espelha plannedFinishAt apenas se já existia; read-back confirma; sem campo novo; demais campos/Worker/notif/card/cache-bust intactos.');
