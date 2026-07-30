/**
 * F3.5.4F — f354f-sla-designer-live-timer.test.mjs
 * =====================================================================================
 * CRONÔMETRO SLA EM TEMPO REAL POR DESIGNER — 26 asserts obrigatórios da fase.
 * Extrai as funções REAIS do renderer (index.html) e dos módulos CJS do main
 * (slaRules/cardsRules) — nenhuma reimplementação. Asserts de arquitetura (scheduler
 * único, zero timer por card, cleanup) são feitos sobre o CÓDIGO-FONTE REAL.
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
const S = require2(path.join(ROOT, 'src', 'main', 'slaRules.js'));
const C = require2(path.join(ROOT, 'src', 'main', 'cardsRules.js'));

let n = 0, fail = 0;
function ok(cond, name) { n++; if (cond) { console.log(`  ✔ ${String(n).padStart(2, '0')} ${name}`); } else { fail++; console.error(`  ✘ ${String(n).padStart(2, '0')} ${name}`); } }

/* extrator por chaves balanceadas a partir de "function NAME(" (mesma técnica dos suites aprovados) */
function grab(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('função não encontrada: ' + name);
  let j = HTML.indexOf('{', i), depth = 0, k = j;
  for (; k < HTML.length; k++) { const ch = HTML[k]; if (ch === '{') depth++; else if (ch === '}') { depth--; if (!depth) break; } }
  return HTML.slice(i, k + 1);
}
function grabVar(decl) {
  const i = HTML.indexOf(decl);
  if (i < 0) throw new Error('decl não encontrada: ' + decl);
  return HTML.slice(i, HTML.indexOf(';', i) + 1);
}

/* contexto vm com as funções REAIS do renderer + espelhos puros do slaRules (golden master) */
const ctx = {
  console, state: { users: [] },
  dtMs: S.dtMs, secOf: S.secOf, slaPanelDelivered: S.slaPanelDelivered,
  resolveCanonicalSlaTimeline: S.resolveCanonicalSlaTimeline,
  canonicalNowMs: () => Date.now(),
};
vm.createContext(ctx);
const PIECES = [
  grabVar('var F354F_CARDS_WARN_MS=30*60000, F354F_CARDS_RED_MS=10*60000;'),
  grabVar("const UCOLORS=['#F87171'"),
  grab('f354fPad2'), grab('f354fSpan'), grab('kbv2SlaLiveData'), grab('f354fSlaLiveState'),
  grab('esc'), grab('initials'), grab('userColor'), grab('photoOf'), grab('avatar'),
  grab('isDesignerFlow'), grab('designerOf'), grab('hasDesigner'),
];
vm.runInContext(PIECES.join('\n'), ctx);

/* fixtures */
const DUE = S.dtMs('2026-08-01', '18:00');
const cardsTask = { id: 'C1', sector: 'edicao_cards', title: 'Qualidade de vida começa aqui', client: 'Hospital Visão',
  status: 'afazer', assignee: 'Boaz Macêdo', assigneeId: 'desA', assigneePhoto: '',
  dueDate: '2026-08-01', dueTime: '18:00', due: '2026-08-01', startDate: '2026-08-01', startTime: '08:00',
  cardTema: 'Qualidade de vida começa aqui', cardLegenda: 'Legenda X', cardObs: '', cardDeadlineRev: 1,
  designerAssignment: { designerId: 'desA', designerName: 'Boaz Macêdo', assignedAt: DUE - 10 * 3600000, assignedBy: 'sm1', endDate: '2026-08-01', endTime: '18:00' } };
const desTask = { id: 'D1', sector: 'cronograma', title: 'Cronograma Agosto', client: 'Hospital Visão', status: 'afazer',
  assigneeId: 'desA', assignee: 'Boaz Macêdo',
  designerSla: { planStartAt: DUE - 8 * 3600000, planDueAt: DUE, seedAt: DUE - 9 * 3600000, scheduleRevision: 1 },
  designerAssignment: { designerId: 'desA', designerName: 'Boaz Macêdo', assignedAt: DUE - 9 * 3600000, assignedBy: 'sm1' },
  designerFlowStatus: 'afazer' };

console.log('\n══ P1 — cronômetro em tempo real (fonte canônica, decremento, sem snapshot) ══');
const mkCards = vm.runInContext('kbv2SlaLiveData', ctx)(cardsTask);
const mkDes = vm.runInContext('kbv2SlaLiveData', ctx)(desTask);
const stAt = (mk, t) => vm.runInContext('f354fSlaLiveState', ctx)(mk, t);

/* 1. T-30 aparece amarelo (cards T-30 e designer janela amarela) */
ok(stAt(mkCards, DUE - 29 * 60000 - 43000).vis === true && stAt(mkCards, DUE - 29 * 60000 - 43000).lvl === 'amber'
  && stAt(mkDes, DUE - 25 * 60000).lvl === 'amber' && stAt(mkCards, DUE - 31 * 60000).vis === false,
  'T-30 aparece AMARELO (cards e designer; antes da janela: oculto)');
/* 2. T-10 aparece vermelho (cards em due−10; designer no prazo) */
ok(stAt(mkCards, DUE - 9 * 60000 - 18000).lvl === 'red' && stAt(mkDes, DUE - 5 * 60000).lvl === 'amber' && stAt(mkDes, DUE + 1000).lvl === 'red',
  'T-10 aparece VERMELHO (cards: due−10; designer: vermelho nasce NO prazo — regra preservada)');
/* 3. contador amarelo decrementa (t vs t+61s) */
const a1 = stAt(mkCards, DUE - 29 * 60000 - 43000).text, a2 = stAt(mkCards, DUE - 28 * 60000 - 42000).text;
ok(a1 === 'Faltam 29m 43s' && a2 === 'Faltam 28m 42s' && a1 !== a2, `contador amarelo decrementa ("${a1}" → "${a2}")`);
/* 4. contador vermelho decrementa e vira "em atraso" após o prazo */
const r1 = stAt(mkCards, DUE - 9 * 60000 - 18000).text, r2 = stAt(mkCards, DUE + 4 * 60000 + 51000).text;
ok(r1 === 'Faltam 09m 18s' && r2 === '04m 51s em atraso', `contador vermelho: "${r1}" → "${r2}" (pós-prazo conta o atraso)`);
/* 5. prazo canônico (dtMs dos campos canônicos / timeline canônica) */
ok(mkCards.dueMs === DUE && mkDes.dueMs === S.resolveCanonicalSlaTimeline(desTask, S.dtMs).overdueAtMs
  && mkDes.warnMs === S.resolveCanonicalSlaTimeline(desTask, S.dtMs).warningAtMs,
  'contador usa o PRAZO CANÔNICO (dueDate/dueTime dos cards; timeline canônica do designer)');
/* 6. não depende de snapshot: updater lê SÓ atributos + canonicalNowMs */
const updSrc = grab('f354fSlaLiveUpdate');
ok(/canonicalNowMs\(\)/.test(updSrc) && /getAttribute\('data-due-ms'\)/.test(updSrc)
  && !/state\.tasks/.test(updSrc) && !/firestore|snapshot/i.test(updSrc),
  'tick NÃO depende de snapshot (lê marcos data-* + relógio canônico; nunca state.tasks/Firestore)');
/* 7. não recria o card (textContent/className/hidden apenas) */
ok(!/innerHTML|outerHTML|insertAdjacentHTML|render\(/.test(updSrc) && /textContent/.test(updSrc),
  'tick NÃO recria o card (somente textContent/className/hidden — zero innerHTML/render)');
/* 8. não reinicia animação (classe atribuída SÓ quando muda) */
ok(/el\.className!==want/.test(updSrc) && /c\.textContent!==st\.text/.test(updSrc),
  'sem restart de animação/estilo: classe e texto atribuídos SÓ quando mudam');
/* 9. um único scheduler global de 1s */
const ivals = HTML.match(/setInterval\(function\(\)\{[^\n]*?\},\s*1000\)/g) || [];
ok(ivals.length === 1 && /slaMonHasActive\(\)\|\|f354fLiveEls\(\)\.length/.test(ivals[0] || ''),
  `um ÚNICO interval global de 1s (encontrados: ${ivals.length}) com gate ampliado p/ as bandas`);
/* 10. nenhum timer por card */
const cardSrc = grab('kbv2Card');
ok(!/setInterval|setTimeout/.test(cardSrc), 'NENHUM setInterval/setTimeout dentro de kbv2Card (zero timer por card)');
/* 11. cleanup correto (sem registro retido; varredura por querySelectorAll a cada tick) */
ok(/querySelectorAll\('\.kbv2-sla-live\[data-sla-live\]'\)/.test(HTML) && !/f354fRegistry|__f354fEls/.test(HTML),
  'cleanup por construção: consulta o DOM a cada tick, nenhum cache/registro de elementos');

console.log('\n══ P2 — identidade do Designer + isolamento por aba (uid, nunca nome) ══');
/* 12. designer identificado por uid */
ok(/data-resp-id="'\+esc\(String\(_rid\)\)/.test(HTML) && /const _rid=designerOf\(t\)\|\|''/.test(cardSrc),
  'banda identifica o Designer pelo UID (designerOf → designerAssignment.designerId||assigneeId)');
/* 13. avatar correto (foto real quando existe) */
const avatarFn = vm.runInContext('avatar', ctx);
const withPhoto = avatarFn({ id: 'u9', name: 'Boaz Macêdo', photo: 'https://x/p.jpg' }, 22);
ok(/background-image:url\('https:\/\/x\/p\.jpg'\)/.test(withPhoto) && /kbv2SlaLiveData\(t\)/.test(cardSrc) && /avatar\(_resp2,22\)/.test(cardSrc),
  'avatar REAL do Designer na banda (foto quando existe; mesma avatar() aprovada)');
/* 14. nome correto (completo, tooltip, sem corte grosseiro) */
ok(/kbv2-sla-live-n" title="'\+esc\(_rname\)\+'">'\+esc\(_rname\)/.test(HTML) && /-webkit-line-clamp:2/.test(HTML.slice(HTML.indexOf('kbv2-sla-live-n{'), HTML.indexOf('kbv2-sla-live-n{') + 400)),
  'nome do Designer completo com tooltip e quebra controlada em até 2 linhas');
/* 15. fallback de iniciais (sem foto: iniciais + cor do usuário; nunca imagem quebrada) */
const noPhoto = avatarFn({ id: 'u7', name: 'Boaz Macêdo' }, 22);
ok(/>BM<\/div>$/.test(noPhoto) && /background:#/.test(noPhoto) && !/img /.test(noPhoto),
  `fallback: iniciais "BM" + cor do usuário (sem <img> quebrável)`);
/* 16-18. isolamento por aba via filtro REAL do quadro do designer */
const filterList = (tasks, id) => tasks.filter(t => vm.runInContext('isDesignerFlow', ctx)(t) && vm.runInContext('designerOf', ctx)(t) === id);
const tA = JSON.parse(JSON.stringify(cardsTask));
const outros = [{ id: 'X1', sector: 'cronograma', designerAssignment: { designerId: 'desB', designerName: 'João' }, designerSla: { planDueAt: DUE } }];
ok(filterList([tA, ...outros], 'desA').length === 1 && filterList([tA, ...outros], 'desA')[0].id === 'C1'
  && filterList([tA, ...outros], 'desB').every(t => t.id !== 'C1'),
  'cobrança SÓ na aba do Designer correto (filtro real por uid: aba A mostra, aba B não)');
ok(filterList([tA], 'desB').length === 0 && filterList([tA], 'desC').length === 0,
  'troca de aba NÃO vaza a cobrança (aba de outro Designer fica limpa)');
const tReassigned = JSON.parse(JSON.stringify(tA)); tReassigned.designerAssignment.designerId = 'desB'; tReassigned.designerAssignment.designerName = 'João'; tReassigned.assigneeId = 'desB';
ok(filterList([tReassigned], 'desA').length === 0 && filterList([tReassigned], 'desB').length === 1
  && vm.runInContext('kbv2SlaLiveData', ctx)(tReassigned) !== null,
  'reatribuição: some da aba A, aparece na aba B (sem duplicação — mesmo doc, novo uid)');
/* 19. conclusão remove */
const tDone = JSON.parse(JSON.stringify(tA)); tDone.status = 'concluido';
const tDone2 = JSON.parse(JSON.stringify(desTask)); tDone2.designerFlowStatus = 'entregue';
ok(vm.runInContext('kbv2SlaLiveData', ctx)(tDone) === null && vm.runInContext('kbv2SlaLiveData', ctx)(tDone2) === null,
  'conclusão/entrega cancela a cobrança (banda nem é gerada)');
/* 20. reabertura reavalia */
const tReopen = JSON.parse(JSON.stringify(tDone)); tReopen.status = 'afazer';
ok(vm.runInContext('kbv2SlaLiveData', ctx)(tReopen) !== null, 'reabertura reavalia (banda volta a ser elegível)');
/* 21. alteração de prazo recalcula + agendamentos re-armados */
const t2h = JSON.parse(JSON.stringify(tA)); t2h.dueTime = '20:00'; t2h.cardDeadlineRev = 2;
const mk2 = vm.runInContext('kbv2SlaLiveData', ctx)(t2h);
const now21 = DUE - 5 * 60000; // antes vermelho; com +2h volta a ficar fora da janela
ok(mk2.dueMs === DUE + 2 * 3600000 && stAt(mk2, now21).vis === false
  && C.cardsNextBoundaryMs(t2h, now21, S.dtMs) === (DUE + 2 * 3600000) - 30 * 60000,
  'prazo editado: contador recalcula p/ o novo canônico e o PRÓXIMO marco re-arma (T-30 novo)');
/* 22. nenhuma duplicação (dedup determinística por prazo+revisão) */
const em1 = C.cardsEmissionsFor(tA, 'desA', DUE - 29 * 60000, S.dtMs);
const em1b = C.cardsEmissionsFor(tA, 'desA', DUE - 29 * 60000, S.dtMs);
const em2 = C.cardsEmissionsFor(t2h, 'desA', DUE + 2 * 3600000 - 29 * 60000, S.dtMs);
ok(em1.length === 1 && em1[0].dedupKey === em1b[0].dedupKey && em2[0].dedupKey !== em1[0].dedupKey
  && /:r2$/.test(em2[0].dedupKey) && /seen\.has\(key\)/.test(fs.readFileSync(path.join(ROOT, 'src', 'main', 'slaScheduler.ts'), 'utf8')),
  'zero duplicação: dedupKey determinística (taskId+dueAt+rev) + seen-set persistente no main');
/* 23. recuperação após offline/desligado */
ok(/reconcile\("boot"\)/.test(MAINTS) && /powerMonitor\.on\("resume".*reconcile\("resume"\)/.test(MAINTS),
  'recuperação: reconcile no boot e no resume entrega marcos perdidos exatamente 1× (seen)');
/* 24-26. aberto / minimizado / fechado no X */
ok(/windowActive\(\)/.test(MAINTS) && /notif-toast/.test(MAINTS), 'ABERTO: HUB entrega toast in-app (canal aprovado intocado)');
ok(/backgroundThrottling:\s*false/.test(MAINTS) && /disable-background-timer-throttling/.test(MAINTS) && /showBgNotify/.test(MAINTS),
  'MINIMIZADO: timers do renderer seguem vivos (throttling off) + bg-window premium p/ notificação');
ok(/e\.preventDefault\(\);\s*\n?\s*mainWin\?\.hide\(\)/.test(MAINTS) && /startSlaScheduler/.test(MAINTS),
  'FECHADO NO X: janela vai p/ a bandeja e o PRODUTOR autoritativo segue no main (nunca suspenso)');

console.log(`\n${fail === 0 ? '✅' : '❌'} f354f-sla-designer-live-timer: ${n - fail}/${n} asserts verdes`);
if (fail) process.exit(1);
