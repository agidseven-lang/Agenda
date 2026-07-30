/**
 * F3.5.4H — f354h-red-notification-boundary.test.mjs
 * =====================================================================================
 * MOMENTO DE DISPARO DA NOTIFICAÇÃO VERMELHA T-10 — 41 asserts obrigatórios da fase.
 * RELÓGIO CONTROLADO (fake timers): o slaScheduler REAL (dist/main) roda com now/listen/
 * setTimer/seen/deliver INJETADOS — nenhuma dependência do relógio do CI, zero espera real.
 * Inclui: LINHA DO TEMPO T-31→T+1 (log sanitizado), PRAZO EDITADO 16:00→18:00 e
 * MULTIMÁQUINA (offsets de relógio ± decididos pelo canônico).
 * Pré-requisito: npm run build (dist/main compilado) — o CI builda antes das suítes.
 */
import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require2 = createRequire(import.meta.url);
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const S = require2(path.join(ROOT, 'dist', 'main', 'slaRules.js'));
const C = require2(path.join(ROOT, 'dist', 'main', 'cardsRules.js'));
const { startSlaScheduler } = require2(path.join(ROOT, 'dist', 'main', 'slaScheduler.js'));
const HTML = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');
const MAINTS = fs.readFileSync(path.join(ROOT, 'src', 'main', 'main.ts'), 'utf8');

let n = 0, fail = 0;
const ok = (cond, name) => { n++; if (cond) console.log(`  ✔ ${String(n).padStart(2, '0')} ${name}`); else { fail++; console.error(`  ✘ ${String(n).padStart(2, '0')} ${name}`); } };

const MIN = 60000;
const DUE = 1785610800000; // instante canônico fixo (fake clock — independente do CI)
const RED_AT = DUE - 10 * MIN, YEL_AT = DUE - 30 * MIN;
const task = (extra) => Object.assign({
  id: 'T1', sector: 'edicao_cards', title: 'Card — prazo de teste', client: 'Hospital Visão',
  status: 'andamento', assigneeId: 'desA', assignee: 'Boaz Macêdo',
  dueDate: '2026-08-01', dueTime: '16:00', due: '2026-08-01', cardDeadlineRev: 1, dueAt: DUE,
  designerAssignment: { designerId: 'desA', designerName: 'Boaz Macêdo', status: 'sent' },
}, extra || {});

/* harness: scheduler REAL + relógio/timers/snapshots fake (opcional: seen compartilhado e offset) */
function makeHarness(t0, opts) {
  opts = opts || {};
  let LOCAL = t0 - (opts.clockOffsetMs || 0);      // relógio LOCAL da máquina (pode estar errado)
  const canonical = () => LOCAL + (opts.clockOffsetMs || 0); // canônico = local + offset (UMA vez)
  const timers = []; const delivered = []; const seenMem = opts.seen || new Set();
  let pushSnap = null;
  const h = {
    delivered, seen: seenMem,
    advanceTo(msCanonical) {
      for (;;) {
        const due = timers.filter(x => x && !x.done && x.at <= msCanonical).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        LOCAL = Math.max(LOCAL, due.at - (opts.clockOffsetMs || 0)); due.done = true; due.fn();
      }
      LOCAL = msCanonical - (opts.clockOffsetMs || 0);
    },
    snapshot(docs, types) { pushSnap({ docChanges: () => docs.map((d, i) => ({ type: (types && types[i]) || 'added', doc: { id: d.id, data: () => d } })) }); },
    stop() { try { h.sched.stop(); } catch (_) { } },
    reconcile(r) { h.sched.reconcile(r); },
  };
  h.sched = startSlaScheduler(() => (opts.uid || 'desA'), (p) => {
    delivered.push({ atMs: canonical(), eventType: p.eventType, severity: p.severity, dedupKey: p.dedupKey, body: p.body, targetUserId: p.targetUserId });
    return { ok: true, channel: 'test' };
  }, {
    now: canonical,
    listen: (_n2, cb) => { pushSnap = cb; return () => {}; },
    seen: { has: k => seenMem.has(k), add: k => seenMem.add(k) },
    setTimer: (fn, ms) => { const rec = { fn, at: canonical() + ms, done: false }; timers.push(rec); return rec; },
    clearTimer: (rec) => { if (rec) rec.done = true; },
    onLog: () => {}, authUser: () => ({ id: (opts.uid || 'desA'), role: 'Designer', admin: false }),
  });
  return h;
}
const reds = h => h.delivered.filter(d => d.eventType === 'sla_cards_overdue');
const yels = h => h.delivered.filter(d => d.eventType === 'sla_cards_warning');
const fmt = ms => { const d = Math.round((ms - DUE) / 1000), s = Math.abs(d); return (d < 0 ? 'T-' : 'T+') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

console.log('\n══ GATE PURO shouldFireRedNotification (sem timers) ══');
const G = C.shouldFireRedNotification;
const base = { dueAtMs: DUE, completed: false, recipientUid: 'desA', currentAssigneeUid: 'desA', alreadyConsumed: false };
/* 1 */ ok(G({ ...base, nowMs: RED_AT + 1000, dueAtMs: 0 }) === false && G({ ...base, nowMs: RED_AT, dueAtMs: NaN }) === false, 'dueAt inválido → NÃO dispara');
/* 2 */ ok(G({ ...base, nowMs: DUE - 31 * MIN }) === false, '31 minutos antes → não dispara');
/* 3 */ ok(G({ ...base, nowMs: DUE - 30 * MIN }) === false, '30 minutos antes → vermelho NÃO dispara (é território da amarela)');
/* 4 */ ok(G({ ...base, nowMs: DUE - 29 * MIN }) === false, '29 minutos antes → vermelho não dispara');
/* 5 */ ok(G({ ...base, nowMs: DUE - 11 * MIN }) === false, '11 minutos antes → não dispara');
/* 6 */ ok(G({ ...base, nowMs: RED_AT - 1000 }) === false, '10 minutos e 1 segundo antes → não dispara');
const gateAtRed = G({ ...base, nowMs: RED_AT });
/* 7(parte gate) */ ok(gateAtRed === true && G({ ...base, nowMs: RED_AT, alreadyConsumed: true }) === false, 'exatamente 10 minutos antes → autorizado; consumida → não repete');
/* 11 */ ok(G({ ...base, nowMs: DUE }) === false, 'exatamente no prazo → NÃO dispara T-10 (now < dueAt exigido)');
/* 12 */ ok(G({ ...base, nowMs: DUE + 1000 }) === false && G({ ...base, nowMs: DUE + 3600000 }) === false, 'depois do prazo → não dispara T-10');
/* 23 */ ok(G({ ...base, nowMs: RED_AT + 1000, completed: true }) === false, 'concluída → não dispara');
/* 38 */ ok(G({ ...base, nowMs: RED_AT + 1000, recipientUid: 'desB' }) === false && G({ ...base, nowMs: RED_AT + 1000, currentAssigneeUid: 'desB' }) === false, 'uid incorreto (destinatário ≠ designer atual) → não recebe');

console.log('\n══ LINHA DO TEMPO OBRIGATÓRIA (scheduler REAL, fake clock) — T-31 → T+1 ══');
{
  const h = makeHarness(DUE - 31 * MIN);
  h.snapshot([task()]);
  const marks = [['T-31', DUE - 31 * MIN], ['T-30', YEL_AT], ['T-11', DUE - 11 * MIN], ['T-10', RED_AT], ['T-9:59', RED_AT + 1000], ['T-1', DUE - MIN], ['T0', DUE], ['T+1', DUE + MIN]];
  const timeline = [];
  for (const [label, ms] of marks) {
    const before = h.delivered.length;
    h.advanceTo(ms); h.reconcile('tick@' + label);
    const newly = h.delivered.slice(before).map(d => d.eventType + '(' + d.severity + ')').join(',') || 'nenhum';
    timeline.push('   ' + label.padEnd(7) + ' → ' + newly);
  }
  console.log(timeline.join('\n'));
  const Y = yels(h), R = reds(h);
  /* 7 */ ok(R.length === 1 && R[0].atMs === RED_AT, 'vermelha exatamente 1× ao cruzar T-10 (@' + (R[0] ? fmt(R[0].atMs) : 'nunca') + ')');
  /* 8 */ ok(!R.some(d => d.atMs === RED_AT + 1000), '9 minutos e 59 segundos antes → não repete');
  /* 9-10 */ ok(R.length === 1, '5 minutos antes / 1 segundo antes → não repete (total=1 na janela inteira)');
  /* 34 */ ok(Y.length === 1 && Y[0].atMs === YEL_AT && Y[0].eventType !== R[0].eventType && Y[0].dedupKey !== R[0].dedupKey, 'amarelo e vermelho usam EVENTOS e CHAVES distintos (amarela 1× em T-30)');
  /* 33 */ ok(R[0].dedupKey === 'cards_overdue:T1:desA:' + DUE + ':r1', 'dedupKey inclui taskId+uid+dueAt+revisão (task:uid:dueAtMs:rev)');
  h.stop();
}

console.log('\n══ INICIALIZAÇÃO / RECONEXÃO (catch-up limitado à janela) ══');
{
  const h = makeHarness(DUE - 20 * MIN); h.snapshot([task()]); h.advanceTo(DUE - 19 * MIN);
  /* 13 */ ok(reds(h).length === 0 && yels(h).length === 1, 'inicialização 20 minutos antes → vermelho NÃO dispara (só amarela de catch-up)');
  h.stop();
}
{
  const h = makeHarness(DUE - 9 * MIN); h.snapshot([task()]); h.advanceTo(DUE - 8 * MIN); h.snapshot([task()]);
  /* 14 */ ok(reds(h).length === 1 && reds(h)[0].atMs >= RED_AT && reds(h)[0].atMs < DUE, 'inicialização 9 minutos antes → catch-up ÚNICO dentro da janela');
  h.stop();
}
{
  const h = makeHarness(DUE + 5 * MIN); h.snapshot([task()]); h.advanceTo(DUE + 6 * MIN); h.reconcile('safety');
  /* 15 */ ok(reds(h).length === 0, 'inicialização depois do prazo → NÃO dispara retroativamente');
  h.stop();
}
{
  const h = makeHarness(DUE - 40 * MIN); h.snapshot([task()]); h.advanceTo(DUE - 21 * MIN);
  h.snapshot([task()], ['modified']);   // reconexão: novo snapshot do MESMO doc antes da janela
  /* 16 */ ok(reds(h).length === 0, 'reconexão 20 minutos antes → não dispara');
  h.advanceTo(DUE - 9 * MIN); h.snapshot([task()], ['modified']);
  /* 17 */ ok(reds(h).length === 1, 'reconexão 9 minutos antes → catch-up único');
  h.advanceTo(DUE + 2 * MIN); h.snapshot([task()], ['modified']);
  /* 18 */ ok(reds(h).length === 1, 'reconexão depois do prazo → nenhuma NOVA entrega (retro bloqueado)');
  /* 26 */ h.snapshot([task()], ['modified']); h.snapshot([task()], ['modified']);
  ok(reds(h).length === 1 && yels(h).length <= 1, 'snapshot repetido → não duplica (dedup determinística)');
  h.stop();
}

console.log('\n══ TESTE DE PRAZO EDITADO — 16:00 → 18:00 antes de 15:50 ══');
{
  const DUE2 = DUE + 2 * 3600000;                    // 18:00
  const h = makeHarness(DUE - 40 * MIN); h.snapshot([task()]);
  h.advanceTo(DUE - 25 * MIN);                       // já recebeu a amarela do prazo antigo
  h.snapshot([task({ dueTime: '18:00', dueAt: DUE2, cardDeadlineRev: 2 })], ['modified']); // edição ANTES de 15:50
  const afterEdit = reds(h).length;
  /* 20 */ ok(afterEdit === 0, 'novo prazo fora de T-10 → NÃO dispara imediatamente na edição');
  h.advanceTo(DUE - 9 * MIN);                        // 15:51 — dentro da antiga janela vermelha
  /* 19 */ ok(reds(h).length === 0, 'prazo alterado p/ mais tarde → agendamento vermelho ANTIGO cancelado (nada às 15:50)');
  h.advanceTo(DUE2 - 9 * MIN);                       // 17:51 — dentro da NOVA janela
  const R2 = reds(h);
  /* 21+33b */ ok(R2.length === 1 && R2[0].atMs === DUE2 - 10 * MIN && /:r2$/.test(R2[0].dedupKey) && R2[0].dedupKey.indexOf(String(DUE2)) > 0,
    'vermelha aparece SOMENTE às 17:50, uma única vez, com chave do NOVO prazo/revisão (prazo antigo não sobrevive)');
  console.log('   log: edição @T-25 → vermelha única @' + fmt(R2[0] ? R2[0].atMs : 0) + ' do prazo NOVO (18:00); zero às 15:50');
  h.stop();
}
{
  const DUE3 = DUE + 2 * 3600000;
  const h = makeHarness(DUE - 25 * MIN); h.snapshot([task()]);
  h.advanceTo(DUE3 - 9 * MIN - MIN);
  h.snapshot([task({ dueTime: '18:00', dueAt: DUE3, cardDeadlineRev: 2 })], ['modified']); // edita já DENTRO da nova T-10? não: 17:50 é DUE3-10min; estamos em 17:50? DUE3-10MIN = 17:50; estamos em 17:51-1min=17:50? ajuste abaixo
  h.advanceTo(DUE3 - 9 * MIN);
  /* 25(regra 21-doc) */ ok(reds(h).filter(d => d.dedupKey.indexOf(':r2') > 0).length === 1,
    'novo prazo já DENTRO de T-10 → UMA notificação única após o salvamento (regra documentada; nunca antes da janela)');
  h.stop();
}

console.log('\n══ REATRIBUIÇÃO / CONCLUSÃO / REABERTURA ══');
{
  const h = makeHarness(DUE - 40 * MIN); h.snapshot([task()]);
  h.advanceTo(DUE - 25 * MIN);
  h.snapshot([task({ assigneeId: 'desB', designerAssignment: { designerId: 'desB', designerName: 'João', status: 'sent' } })], ['modified']);
  h.advanceTo(DUE - 5 * MIN);
  /* 22 */ ok(reds(h).length === 0 && C.cardsEmissionsFor(task({ assigneeId: 'desB', designerAssignment: { designerId: 'desB', status: 'sent' } }), 'desA', RED_AT + 1000, S.dtMs).length === 0,
    'reatribuição → Designer ANTIGO (desA) não recebe a vermelha (roteia só ao uid atual)');
  h.stop();
}
{
  const h = makeHarness(DUE - 40 * MIN); h.snapshot([task({ status: 'concluido' })]);
  h.advanceTo(DUE - 5 * MIN); h.reconcile('x');
  /* 23(sched) */ ok(reds(h).length === 0 && yels(h).length === 0, 'conclusão antes de T-10 → não dispara (nem amarela)');
  h.snapshot([task({ status: 'andamento' })], ['modified']);   // REABERTURA antes de T-10? estamos em T-5 (dentro)
  h.stop();
}
{
  const h = makeHarness(DUE - 25 * MIN); h.snapshot([task({ status: 'concluido' })]);
  h.advanceTo(DUE - 20 * MIN);
  h.snapshot([task({ status: 'andamento' })], ['modified']);   // reabre ANTES de T-10
  h.advanceTo(DUE - 15 * MIN);
  /* 24 */ ok(reds(h).length === 0, 'reabertura antes de T-10 → vermelho não dispara (reavalia; só amarela)');
  h.advanceTo(DUE - 9 * MIN);
  /* 25 */ ok(reds(h).length === 1, 'reabertura + janela T-10 → regra ÚNICA documentada: 1 vermelha por prazo/revisão (chave dueAt:rev; reabrir NÃO cria chave nova)');
  h.stop();
}

console.log('\n══ SEM DUPLICAÇÃO — janela/processo/sessão ══');
/* 27 */ ok(/function notifScan\(\)\{\}/.test(HTML) && !/notifScanSla\(\)\s*;/.test(HTML.replace(/window\.notifScanSla=notifScanSla/, '')),
  'renderer + main → produtor ÚNICO no main (notifScan(){} vazio; notifScanSla sem chamador)');
{
  const h = makeHarness(DUE - 11 * MIN); h.snapshot([task()]);
  h.advanceTo(DUE - 9 * MIN);
  h.reconcile('resume'); h.reconcile('unlock'); h.reconcile('focus');
  /* 28 */ ok(reds(h).length === 1, 'minimizar/restaurar (reconcile resume/unlock) → não duplica');
  h.stop();
}
{
  const sharedSeen = new Set();
  const h1 = makeHarness(DUE - 11 * MIN, { seen: sharedSeen }); h1.snapshot([task()]); h1.advanceTo(DUE - 9 * MIN); h1.stop();
  const h2 = makeHarness(DUE - 8 * MIN, { seen: sharedSeen }); h2.snapshot([task()]); h2.advanceTo(DUE - 7 * MIN); h2.stop();
  /* 29 */ ok(reds(h1).length === 1 && reds(h2).length === 0, 'fechar no X/reabrir (seen PERSISTENTE compartilhado) → não duplica na nova sessão');
}

console.log('\n══ MULTIMÁQUINA — offsets de relógio ± decididos pelo CANÔNICO ══');
{
  const hP = makeHarness(DUE - 11 * MIN, { clockOffsetMs: +15 * MIN });  // relógio local ATRASADO 15min; canônico corrige
  hP.snapshot([task()]); hP.advanceTo(DUE - 9 * MIN);
  /* 30 */ ok(reds(hP).length === 1 && reds(hP)[0].atMs >= RED_AT && reds(hP)[0].atMs < DUE, 'clock offset POSITIVO → dispara no horário canônico correto (não no local)');
  hP.stop();
  const hN = makeHarness(DUE - 11 * MIN, { clockOffsetMs: -15 * MIN });  // relógio local ADIANTADO 15min
  hN.snapshot([task()]); hN.advanceTo(DUE - 10 * MIN - 1000);
  const early = reds(hN).length;
  hN.advanceTo(DUE - 9 * MIN);
  /* 31 */ ok(early === 0 && reds(hN).length === 1, 'clock offset NEGATIVO (máquina adiantada) → NÃO antecipa; dispara só no canônico');
  hN.stop();
}
/* 32 */ {
  const noParse = () => { throw new Error('dtMs não deve ser consultado quando dueAt canônico existe'); };
  let sameMark = false; try { sameMark = C.cardFinishMs(task(), noParse) === DUE && C.cardFinishMs({ ...task(), dueAt: undefined }, S.dtMs) > 0; } catch (_) { sameMark = false; }
  ok(sameMark, 'timezone UTC/local → MESMO marco (dueAt canônico dispensa parse por máquina; fallback compat p/ docs antigos)');
}

console.log('\n══ ORIGENS PROIBIDAS + CANAIS (fonte real) ══');
/* 35 */ ok(!/f354gMon\w*[\s\S]{0,400}?api\.notify/.test(HTML) && !/slaMonRender[\s\S]{0,800}?notifEmit\(/.test(HTML), 'Monitor SLA NÃO dispara notificação nativa (só visual)');
/* 36 */ ok(!/slaib\w*[\s\S]{0,300}?api\.notify/.test(HTML) && !/slaibToggle[\s\S]{0,600}?notifEmit\(/.test(HTML), 'sino NÃO dispara notificação vermelha (read-only)');
/* 37 */ ok(C.cardsEmissionsFor(task({ assigneeId: null, designerAssignment: null }), 'desA', RED_AT + 1000, S.dtMs).length === 0
  && C.cardsEmissionsFor(task(), 'userX', RED_AT + 1000, S.dtMs).length === 0, 'usuário inativo/não-atribuído não recebe');
/* 39 */ ok(/windowActive\(\)/.test(MAINTS) && /notif-toast/.test(MAINTS), 'APP ABERTO: entrega via toast premium (HUB main, canal aprovado)');
/* 40 */ ok(/backgroundThrottling:\s*false/.test(MAINTS) && /showBgNotify/.test(MAINTS), 'APP MINIMIZADO: bg-window premium/nativa; timers nunca estrangulados');
/* 41 */ ok(/e\.preventDefault\(\);\s*\n?\s*mainWin\?\.hide\(\)/.test(MAINTS) && /startSlaScheduler/.test(MAINTS) && /reconcile\("boot"\)/.test(fs.readFileSync(path.join(ROOT, 'src', 'main', 'slaScheduler.ts'), 'utf8')),
  'APP FECHADO NO X: produtor autoritativo segue vivo no main (tray) + reconcile no boot');

console.log('\n══ MIGRAÇÃO DE CHAVE (1.0.198 → uid) — legacyDedupKeys vivo até o emitList ══');
/* 44 */ {
  const emW = C.cardsEmissionsFor(task(), 'desA', DUE - 29 * MIN, S.dtMs);
  const emR = C.cardsEmissionsFor(task(), 'desA', RED_AT + 1000, S.dtMs);
  ok(!!emW[0] && Array.isArray(emW[0].legacyDedupKeys) && emW[0].legacyDedupKeys[0] === 'cards_warning:T1:' + DUE + ':r1'
    && !!emR[0] && Array.isArray(emR[0].legacyDedupKeys) && emR[0].legacyDedupKeys[0] === 'cards_overdue:T1:' + DUE + ':r1',
  'payloads REAIS carregam a chave 1.0.198 (notifBuildPayload não a descarta — anexada pós-build)');
}
/* 45 */ {
  const pre = new Set(['cards_overdue:T1:' + DUE + ':r1']);   // usuário JÁ recebeu a vermelha na 1.0.198
  const h = makeHarness(DUE - 11 * MIN, { seen: pre }); h.snapshot([task()]); h.advanceTo(DUE - 9 * MIN);
  ok(reds(h).length === 0 && pre.has('cards_overdue:T1:desA:' + DUE + ':r1'),
  'upgrade sem duplicata: chave legada vista ⇒ scheduler NÃO reentrega e marca a chave nova');
  h.stop();
}

console.log(`\n${fail === 0 ? '✅' : '❌'} f354h-red-notification-boundary: ${n - fail}/${n} asserts verdes`);
if (fail) process.exit(1);
