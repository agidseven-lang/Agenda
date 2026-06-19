#!/usr/bin/env node
/* F3.3.2 — teste unitário do PAINEL OPERACIONAL SLA (derivação read-side, finish-based).
   Extrai o bloco PANEL-CORE REAL do renderer (entre os sentinelas) e exercita
   slaPanelRow/slaPanelDerive + a resolução de prazo final (slaPanelFinishMs).
   Um espião de fetch lança erro se QUALQUER provider for chamado → prova zero envio.
   100% offline/puro: não toca produção, não envia nada, não escreve, não faz deploy.
   Rodar: /opt/node22/bin/node desktop/scripts/f332-panel.test.mjs */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.resolve(__dirname, '..', 'src', 'renderer', 'index.html');
const src = fs.readFileSync(HTML, 'utf8');

// ── extrai o PANEL-CORE real do renderer ──
const B = '/* F3.3.2-PANEL-CORE BEGIN */', E = '/* F3.3.2-PANEL-CORE END */';
const i = src.indexOf(B), j = src.indexOf(E);
if (i < 0 || j < 0 || j < i) { console.error('::error:: PANEL-CORE não encontrado em index.html'); process.exit(1); }
const core = src.slice(i + B.length, j);

// ESPIÃO: qualquer chamada de rede explode o teste (prova providerCalled=false / zero envio).
globalThis.fetch = () => { throw new Error('PROVIDER-CALL-DETECTED (envio real proibido na F3.3.2)'); };
globalThis.XMLHttpRequest = function () { throw new Error('PROVIDER-CALL-DETECTED (XHR proibido)'); };

// dtMs stub: "YYYY-MM-DD"+"HH:mm" → epoch ms (UTC determinístico p/ o teste).
const dtMsStub = (d, t) => { if (!d) return 0; const [Y, Mo, Da] = String(d).split('-').map(Number); const [h, m] = String(t || '23:59').split(':').map(Number); return Date.UTC(Y, (Mo || 1) - 1, Da || 1, h || 0, m || 0); };

const api = new Function(core + '\n;return { SLA_PANEL_WARN_MS, slaPanelFinishMs, slaPanelDelivered, slaPanelRow, slaPanelDerive };')();
const { slaPanelFinishMs, slaPanelRow, slaPanelDerive, SLA_PANEL_WARN_MS } = api;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name); } };

const NOW = 1781800000000, MIN = 60000;
const task = (over = {}) => Object.assign({
  id: 'T1', title: 'Cronograma semanal', client: 'Boa Forma', status: 'andamento',
  designerFlowStatus: 'andamento', designerAssignment: { designerId: 'D1' },
  designerSla: { planStartAt: NOW - 120 * MIN, planDueAt: NOW + 60 * MIN },
}, over);
// helper p/ trocar campos do designerSla sem perder o objeto (gate de SLA-rastreada)
const withSla = (sla, over = {}) => task(Object.assign({ designerSla: sla }, over));
const derive = (tasks, now = NOW) => slaPanelDerive(tasks, now, dtMsStub);
const row = (t, now = NOW) => slaPanelRow(t, now, dtMsStub);

// 1 — 29 min restantes → Prazo próximo (warning/laranja)
{ const r = row(withSla({ planDueAt: NOW + 29 * MIN })); ok('1 29min => prazo próximo', !!r && r.bucket === 'warning' && r.sev === 'laranja' && r.remainingMin === 29); }
// 2 — 18 min restantes → Prazo próximo
{ const r = row(withSla({ planDueAt: NOW + 18 * MIN })); ok('2 18min => prazo próximo', !!r && r.bucket === 'warning' && r.remainingMin === 18); }
// 3 — vencida há 1 min → Atrasadas (overdue/vermelho)
{ const r = row(withSla({ planDueAt: NOW - 1 * MIN })); ok('3 +1min => atrasada', !!r && r.bucket === 'overdue' && r.sev === 'vermelho' && r.overdueMin === 1); }
// 4 — vencida há 7 min → Atrasadas
{ const r = row(withSla({ planDueAt: NOW - 7 * MIN })); ok('4 +7min => atrasada', !!r && r.bucket === 'overdue' && r.overdueMin === 7); }
// 5 — concluída (status=concluido) não aparece
ok('5 concluída => fora', row(withSla({ planDueAt: NOW - 7 * MIN }, { status: 'concluido' })) === null);
// 6 — entregue (designerFlowStatus=entregue) não aparece
ok('6 entregue => fora', row(withSla({ planDueAt: NOW - 7 * MIN }, { designerFlowStatus: 'entregue' })) === null);
// 7 — cancelada/removida não aparece
ok('7 cancelada => fora', row(withSla({ planDueAt: NOW - 7 * MIN }, { status: 'cancelado' })) === null);
ok('7b removida => fora', row(withSla({ planDueAt: NOW - 7 * MIN }, { status: 'removido' })) === null);
// 8 — sem designer responsável não aparece (designerSla presente, mas sem designerId/assignee)
ok('8 sem designer => fora', row(withSla({ planDueAt: NOW - 7 * MIN }, { designerAssignment: null, assigneeId: null })) === null);
// 9 — sem prazo final válido não aparece
ok('9 sem prazo => fora', row(withSla({ planStartAt: NOW - 10 * MIN })) === null);
// 10 — plannedFinishAt prevalece sobre planDueAt
ok('10 plannedFinishAt prevalece', slaPanelFinishMs(withSla({ plannedFinishAt: NOW + 5 * MIN, planDueAt: NOW + 999 * MIN }), dtMsStub) === NOW + 5 * MIN);
// 11 — planDueAt funciona como fallback (sem plannedFinishAt)
ok('11 planDueAt fallback', slaPanelFinishMs(withSla({ planDueAt: NOW + 42 * MIN }), dtMsStub) === NOW + 42 * MIN);
// 11b — due (dueDate/dueTime) como último fallback quando o seed não tem prazo
{ const t = withSla({ seedAt: NOW }, { dueDate: '2026-06-19', dueTime: '12:00' }); ok('11b due fallback', slaPanelFinishMs(t, dtMsStub) === dtMsStub('2026-06-19', '12:00')); }
// 12 — taskId correto no row (botão "Abrir tarefa" usa a tarefa certa)
{ const r = row(withSla({ planDueAt: NOW - 3 * MIN }, { id: 'T-XYZ' })); ok('12 taskId correto', !!r && r.taskId === 'T-XYZ'); }
// 13 — ordena vermelho ANTES de laranja
{ const d = derive([withSla({ planDueAt: NOW + 10 * MIN }, { id: 'A' }), withSla({ planDueAt: NOW - 5 * MIN }, { id: 'B' })]);
  ok('13 vermelho antes de laranja', d.rows.length === 2 && d.rows[0].sev === 'vermelho' && d.rows[0].taskId === 'B' && d.rows[1].sev === 'laranja'); }
// 13b — buckets separados corretos
{ const d = derive([withSla({ planDueAt: NOW + 10 * MIN }, { id: 'A' }), withSla({ planDueAt: NOW - 5 * MIN }, { id: 'B' })]);
  ok('13b buckets overdue/warning', d.overdue.length === 1 && d.warning.length === 1 && d.total === 2); }
// 14 — contador dinâmico muda com o tempo (mesma tarefa, now avançando)
{ const t = withSla({ planDueAt: NOW + 20 * MIN });
  const r1 = row(t, NOW), r2 = row(t, NOW + 5 * MIN);
  ok('14 contador dinâmico', r1.remainingMin === 20 && r2.remainingMin === 15); }
// 14b — transição laranja→vermelho ao cruzar o prazo
{ const t = withSla({ planDueAt: NOW + 2 * MIN });
  ok('14b laranja→vermelho', row(t, NOW).sev === 'laranja' && row(t, NOW + 3 * MIN).sev === 'vermelho'); }
// 15/16/17/18/19/20 — ZERO provider/escrita/deploy: o PANEL-CORE é puro.
//   (a) deriva sem disparar o espião de fetch/XHR; (b) o código-fonte do core não referencia provider/escrita/deploy.
{ let threw = false; try { derive([withSla({ planDueAt: NOW - 7 * MIN }), withSla({ planDueAt: NOW + 10 * MIN }, { id: 'C' })]); } catch (_) { threw = true; }
  ok('15 zero FCM (sem chamada de rede)', threw === false);
  ok('16 zero Web Push (sem chamada de rede)', threw === false);
  ok('17 zero WhatsApp (sem chamada de rede)', threw === false);
  const dirty = /\bfetch\b|sendToTokens|broadcastWebPush|whatsapp|messaging_product|firestore|setDoc|updateDoc|addDoc|XMLHttpRequest|wrangler|deploy/i.test(core);
  ok('18 zero Firestore write (core sem APIs de escrita)', dirty === false);
  ok('19 zero deploy (core sem wrangler/deploy)', dirty === false);
  ok('20 zero provider real chamado', threw === false && dirty === false); }

// === REGRA DE FLUXO (reteste #3): SLA só começa no ENVIO ao designer (semente designerSla) ===
// 21 — tarefa SEM designerSla (criação inicial do cronograma), mesmo com designer + dueDate vencido → NÃO entra no painel
{ const t = { id: 'R1', title: 'Tarefa real', client: 'Cliente', status: 'andamento',
    designerAssignment: { designerId: 'D1' }, dueDate: '2026-06-18', dueTime: '12:00' }; // sem designerSla
  ok('21 sem designerSla (não enviada) => fora do painel', slaPanelRow(t, NOW, dtMsStub) === null); }
// 22 — a MESMA tarefa, agora COM designerSla (enviada ao designer) → entra
{ const t = { id: 'R1', title: 'Tarefa real', client: 'Cliente', status: 'andamento',
    designerAssignment: { designerId: 'D1' }, designerSla: { planStartAt: NOW - 60 * MIN, planDueAt: NOW - 5 * MIN } };
  const r = slaPanelRow(t, NOW, dtMsStub);
  ok('22 com designerSla (enviada) => aparece (overdue)', !!r && r.bucket === 'overdue'); }
// 23 — board calmo (nenhuma elegível) => derive total 0 (dispara o estado vazio "Tudo em dia")
{ const d = derive([withSla({ planDueAt: NOW + 240 * MIN }), withSla({ planDueAt: NOW - 7 * MIN }, { status: 'concluido' })]);
  ok('23 calmo => total 0 (estado vazio)', d.total === 0 && d.overdue.length === 0 && d.warning.length === 0); }

// Bônus — WARN window = 30min; exatamente -30min é laranja; -31min fica fora
ok('B1 janela = 30min', SLA_PANEL_WARN_MS === 30 * 60000);
ok('B2 -30min exato => laranja', row(withSla({ planDueAt: NOW + 30 * MIN })) && row(withSla({ planDueAt: NOW + 30 * MIN })).sev === 'laranja');
ok('B3 -31min => fora do painel', row(withSla({ planDueAt: NOW + 31 * MIN })) === null);
// B4 — painel HTML aparece SEMPRE: o renderer não retorna '' quando vazio (regressão do reteste).
{ const html = src; const i2 = html.indexOf('function slaOpPanelHtml');
  const seg = html.slice(i2, i2 + 1400);
  ok('B4 slaOpPanelHtml não tem "return \'\'" (aparece sempre)', i2 > 0 && !/if\(!d\.total\)\s*return\s*'';/.test(seg) && /Tudo em dia/.test(seg)); }
// === REPROVAÇÃO PÓS-RETESTE 2 — compactação + Kanban preservado + RBAC (asserções de fonte) ===
// B5 — painel = BARRA fina + POPOVER flutuante (overlay; não consome altura do Kanban)
ok('B5 painel barra+popover (overlay)', /slaop-green/.test(src) && /class="slaop-pop"/.test(src) && /\.slaop-pop\{position:absolute/.test(src) && /data-sla-toggle/.test(src));
// B5b — alerta vermelho traz a regra operacional dos 10 minutos
ok('B5b vermelho regra 10 min', /Conclua a tarefa atrasada em até 10 min ou sinalize atraso\./.test(src));
// B6 — card NUNCA encolhe: base flex:0 0 auto + only-child flex:1 0 auto (corrige corte topo/rodapé)
ok('B6 card não encolhe (flex-shrink:0)', /\.kbv2-card\{[\s\S]*?flex:0 0 auto;/.test(src) && /kbv2-card:only-child\{ flex:1 0 auto; \}/.test(src));
// B7 — "Sua etapa / Próxima ação" redesenhada premium (ícones + pill)
ok('B7 etapa redesenhada (kbv2-stage2 + pill + ícones)', /kbv2-stage2/.test(src) && /kbv2-st2-pill/.test(src) && /kbv2-st2-ic/.test(src));
// B8 — "Editar prazo" gated por canSeeAll (Social/Admin); designer comum não vê
ok('B8 Editar prazo RBAC (canSeeAll)', /canSeeAll\(state\.user\)[\s\S]{0,80}data-sla-editprazo/.test(src) && /function slaEditPrazoOpen/.test(src));
// B9 — modal de editar prazo NÃO grava (sem fetch/setDoc; save bloqueado "pendente de autorização")
{ const i3 = src.indexOf('function slaEditPrazoOpen'); const seg2 = src.slice(i3, i3 + 2600);
  ok('B9 editar prazo não escreve (zero write)', i3 > 0 && !/\bfetch\b|setDoc|updateDoc|addDoc/.test(seg2) && /(aguardando autoriza|nada é gravado)/i.test(seg2)); }

console.log('\nF3.3.2 PANEL RESULT: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
