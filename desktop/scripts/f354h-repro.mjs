#!/usr/bin/env node
/* =====================================================================
 * F3.5.4H — REPRODUÇÃO DETERMINÍSTICA do disparo da VERMELHA T-10 (auditoria).
 * Roda o slaScheduler REAL (dist/main) com relógio FAKE 100% controlado
 * (now/listen/setTimer/seen/deliver injetados — zero rede, zero espera real).
 *
 * A) TIMELINE canônica (mesmo fuso): T-40 → T+15 — captura CADA entrega.
 * B) RETRO: boot DEPOOIS do dueAt — a vermelha T-10 dispara retroativamente?
 * C) MULTIMÁQUINA (fuso): mesmo doc {dueDate,dueTime}, mesmo INSTANTE ABSOLUTO,
 *    máquina TZ=America/Recife × TZ=UTC (subprocesso) — os marcos divergem?
 *    (o app NÃO persiste dueAt em ms; cada máquina re-parseia dueDate/dueTime)
 * Saída: log sanitizado por cenário + veredito RED/GREEN por regra da fase.
 * Rodar: node desktop/scripts/f354h-repro.mjs        (cenários A/B + spawn C)
 *        TZ=UTC node desktop/scripts/f354h-repro.mjs --marks-only   (usado por C)
 * ===================================================================== */
import path from 'node:path';
import url from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require2 = createRequire(import.meta.url);
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const S = require2(path.join(ROOT, 'dist', 'main', 'slaRules.js'));
const C = require2(path.join(ROOT, 'dist', 'main', 'cardsRules.js'));
const { startSlaScheduler } = require2(path.join(ROOT, 'dist', 'main', 'slaScheduler.js'));

const MIN = 60000;
const task = (dd, tt, extra) => Object.assign({
  id: 'T1', sector: 'edicao_cards', title: 'Card — prazo de teste', client: 'Hospital Visão',
  status: 'andamento', assigneeId: 'desA', assignee: 'Boaz Macêdo',
  dueDate: dd, dueTime: tt, due: dd, cardDeadlineRev: 1,
  designerAssignment: { designerId: 'desA', designerName: 'Boaz Macêdo', status: 'sent' },
}, extra || {});

/* ── harness: scheduler REAL com relógio/timers/snapshots fakes ── */
function makeHarness(t0) {
  let NOW = t0;
  const timers = [];                             // {fn, at}
  const delivered = [];                          // {atMs, eventType, severity, dedupKey, body}
  const seenMem = new Set();
  let pushSnap = null;
  const h = {
    delivered,
    setNow(ms) { NOW = ms; },
    advanceTo(ms) {                              // executa timers vencidos em ordem até ms
      for (;;) {
        const due = timers.filter(x => x && !x.done && x.at <= ms).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        NOW = Math.max(NOW, due.at); due.done = true; due.fn();
      }
      NOW = ms;
    },
    snapshot(docs, types) {
      pushSnap({ docChanges: () => docs.map((d, i) => ({ type: (types && types[i]) || 'added', doc: { id: d.id, data: () => d } })) });
    },
    sched: null,
  };
  h.sched = startSlaScheduler(() => 'desA', (p) => {
    delivered.push({ atMs: NOW, eventType: p.eventType, severity: p.severity, dedupKey: p.dedupKey, body: p.body });
    return { ok: true, channel: 'test' };
  }, {
    now: () => NOW,
    listen: (_n, cb) => { pushSnap = cb; return () => {}; },
    seen: { has: k => seenMem.has(k), add: k => seenMem.add(k) },
    setTimer: (fn, ms) => { const rec = { fn, at: NOW + ms, done: false }; timers.push(rec); return rec; },
    clearTimer: (rec) => { if (rec) rec.done = true; },
    onLog: () => {},
    authUser: () => ({ id: 'desA', role: 'Designer', admin: false }),
  });
  return h;
}
const fmt = (ms, due) => { const d = Math.round((ms - due) / 1000); const s = Math.abs(d); const mm = Math.floor(s / 60), ss = s % 60; return (d < 0 ? 'T-' : 'T+') + mm + ':' + String(ss).padStart(2, '0'); };

/* ── modo auxiliar (cenário C): imprime SÓ os marcos desta máquina/TZ ── */
if (process.argv.includes('--marks-only')) {
  const tLegacy = task('2026-08-01', '16:00');                       // doc ANTIGO (sem dueAt)
  const tCanon = task('2026-08-01', '16:00', { dueAt: 1785610800000 }); // doc NOVO (dueAt canônico)
  const dL = C.cardFinishMs(tLegacy, S.dtMs), dC = C.cardFinishMs(tCanon, S.dtMs);
  console.log(JSON.stringify({ tz: process.env.TZ || 'local', legacyRedAtMs: dL - C.CARDS_RED_MS, canonRedAtMs: dC - C.CARDS_RED_MS }));
  process.exit(0);
}

let red = 0;
const bad = (cond, msg) => { if (cond) { red++; console.log('  ✘ RED  ' + msg); } else console.log('  ✔ ok   ' + msg); };

console.log('══ A) TIMELINE canônica (mesmo fuso) — prazo 16:00; janela amarela 15:30; vermelha 15:50 ══');
{
  const t = task('2026-08-01', '16:00');
  const DUE = C.cardFinishMs(t, S.dtMs);
  const h = makeHarness(DUE - 40 * MIN);          // boot em T-40 (fora de qualquer janela)
  h.snapshot([t]);
  for (const [label, ms] of [['T-40', DUE - 40 * MIN], ['T-31', DUE - 31 * MIN], ['T-30', DUE - 30 * MIN], ['T-29', DUE - 29 * MIN], ['T-11', DUE - 11 * MIN], ['T-10:01', DUE - 10 * MIN - 1000], ['T-10', DUE - 10 * MIN], ['T-9:59', DUE - 10 * MIN + 1000], ['T-5', DUE - 5 * MIN], ['T-0:01', DUE - 1000], ['T0', DUE], ['T+1', DUE + MIN], ['T+15', DUE + 15 * MIN]]) {
    h.advanceTo(ms);
    void label;
  }
  for (const d of h.delivered) console.log('   deliver @', fmt(d.atMs, DUE), d.eventType, 'sev=' + d.severity, d.dedupKey);
  const yellow = h.delivered.filter(d => d.eventType === 'sla_cards_warning');
  const reds = h.delivered.filter(d => d.eventType === 'sla_cards_overdue');
  bad(!(yellow.length === 1 && yellow[0].atMs >= DUE - 30 * MIN && yellow[0].atMs < DUE - 29 * MIN), 'amarela exatamente 1× ao cruzar T-30 (@' + (yellow[0] ? fmt(yellow[0].atMs, DUE) : 'nunca') + ')');
  bad(reds.some(d => d.atMs < DUE - 10 * MIN), 'NENHUMA vermelha antes de T-10');
  bad(!(reds.length === 1 && reds[0].atMs >= DUE - 10 * MIN && reds[0].atMs < DUE - 10 * MIN + 61000), 'vermelha exatamente 1× ao cruzar T-10 (@' + (reds[0] ? fmt(reds[0].atMs, DUE) : 'nunca') + '; total=' + reds.length + ')');
}

console.log('\n══ B) BOOT/RECONEXÃO retroativa — app abre DEPOIS do prazo (T+30) ══');
{
  const t = task('2026-08-01', '16:00');
  const DUE = C.cardFinishMs(t, S.dtMs);
  const h = makeHarness(DUE + 30 * MIN);           // boot 30min APÓS o prazo
  h.snapshot([t]);
  h.advanceTo(DUE + 31 * MIN);
  for (const d of h.delivered) console.log('   deliver @', fmt(d.atMs, DUE), d.eventType, 'sev=' + d.severity, '"' + d.body + '"');
  const reds = h.delivered.filter(d => d.eventType === 'sla_cards_overdue');
  bad(reds.length > 0, 'vermelha T-10 NÃO dispara retroativamente após dueAt (gate now < dueAt)');
}

console.log('\n══ C) MULTIMÁQUINA — mesmo doc {dueDate:"2026-08-01",dueTime:"16:00"}, fusos diferentes ══');
{
  const self = url.fileURLToPath(import.meta.url);
  const run = (tz) => JSON.parse(execFileSync(process.execPath, [self, '--marks-only'], { env: Object.assign({}, process.env, { TZ: tz }) }).toString().trim());
  const A = run('America/Recife');                 // máquina do owner/SM
  const B = run('UTC');                            // máquina do Designer com fuso errado
  const skewMin = Math.round((A.legacyRedAtMs - B.legacyRedAtMs) / MIN);
  console.log('   LEGADO (doc sem dueAt — 1.0.198): divergência de redAt entre máquinas = ' + skewMin + 'min (era a causa-raiz do disparo antecipado)');
  console.log('   CANÔNICO (doc com dueAt — 1.0.199): Recife=' + new Date(A.canonRedAtMs).toISOString() + ' UTC-machine=' + new Date(B.canonRedAtMs).toISOString());
  bad(A.canonRedAtMs !== B.canonRedAtMs, 'com dueAt canônico persistido, redAt é IDÊNTICO em todas as máquinas/fusos');
}

console.log('\n' + (red ? ('❌ ' + red + ' violação(ões) da regra T-10') : '✅ REGRA T-10 íntegra: timeline exata, zero retro, marcos idênticos entre máquinas (canônico)'));
process.exit(red ? 1 : 0);
