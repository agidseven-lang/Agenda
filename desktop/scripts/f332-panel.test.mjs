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

// formatadores de contador (fora do PANEL-CORE) — extrai p/ testar precisão ceil/floor.
const fmtBlock = (src.match(/function slaMMSSfmt\([\s\S]*?function _slaMs\([^}]*\}/) || [''])[0];
const api = new Function(core + '\n' + fmtBlock + '\n;return { SLA_PANEL_WARN_MS, SLA_PANEL_GRACE_MS, slaPanelFinishMs, slaPanelDelivered, resolveTaskDisplayState, resolveCanonicalDeadline, slaPanelRow, slaPanelDerive, slaCount, slaElapsed, slaMMSS };')();
const { slaPanelFinishMs, resolveTaskDisplayState, resolveCanonicalDeadline, slaPanelRow, slaPanelDerive, SLA_PANEL_WARN_MS, SLA_PANEL_GRACE_MS, slaCount, slaElapsed } = api;

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

// === FONTE ÚNICA DE VERDADE (resolveTaskDisplayState) — exigência do owner ===
// C1 — estado canônico atrasado (vermelho/overdue) por prazo final
{ const d = resolveTaskDisplayState(withSla({ planDueAt: NOW - 7 * MIN }), NOW, dtMsStub);
  ok('C1 resolve => overdue/vermelho', d.state === 'overdue' && d.sev === 'vermelho' && d.overdueMin === 7 && d.inPanel === true); }
// C2 — estado canônico prazo próximo (laranja/warning)
{ const d = resolveTaskDisplayState(withSla({ planDueAt: NOW + 18 * MIN }), NOW, dtMsStub);
  ok('C2 resolve => warning/laranja', d.state === 'warning' && d.sev === 'laranja' && d.remainingMin === 18 && d.inPanel === true); }
// C3 — dentro do prazo (>30min): azul/running, FORA do painel (mas é estado válido p/ o card)
{ const d = resolveTaskDisplayState(withSla({ planDueAt: NOW + 120 * MIN }), NOW, dtMsStub);
  ok('C3 resolve => running/azul fora do painel', d.state === 'running' && d.sev === 'azul' && d.inPanel === false); }
// C4 — entregue/concluída => completed/verde
{ const d = resolveTaskDisplayState(withSla({ planDueAt: NOW - 7 * MIN }, { status: 'concluido' }), NOW, dtMsStub);
  ok('C4 resolve => completed/verde', d.state === 'completed' && d.sev === 'verde' && d.inPanel === false); }
// C5 — sem designerSla => none/neutro (sem chip, fora do painel)
{ const d = resolveTaskDisplayState({ id: 'X', designerAssignment: { designerId: 'D1' }, dueDate: '2026-06-18', dueTime: '12:00' }, NOW, dtMsStub);
  ok('C5 resolve => none/neutro', d.state === 'none' && d.sev === 'neutro' && d.inPanel === false); }
// C6 — o painel/widget (slaPanelRow) é DERIVADO de resolveTaskDisplayState: mesma severidade
{ const t = withSla({ planDueAt: NOW + 18 * MIN }); const d = resolveTaskDisplayState(t, NOW, dtMsStub); const r = row(t);
  ok('C6 slaPanelRow deriva da fonte única', !!r && r.sev === d.sev && r.finishMs === d.finishMs && r.remainingMin === d.remainingMin); }

// Bônus — WARN window = 30min; exatamente -30min é laranja; -31min fica fora
ok('B1 janela = 30min', SLA_PANEL_WARN_MS === 30 * 60000);
ok('B2 -30min exato => laranja', row(withSla({ planDueAt: NOW + 30 * MIN })) && row(withSla({ planDueAt: NOW + 30 * MIN })).sev === 'laranja');
ok('B3 -31min => fora do painel', row(withSla({ planDueAt: NOW + 31 * MIN })) === null);
// B4 — painel HTML aparece SEMPRE: o renderer não retorna '' quando vazio (regressão do reteste).
// === REPROVAÇÃO #4 — WIDGET flutuante top-right + Kanban RESTAURADO (asserções de fonte) ===
// B4 — SLA Monitor é WIDGET FLUTUANTE (position:fixed), FORA do board; NÃO há painel inline no board.
ok('B4 widget flutuante (fixed) fora do board', /function slaMonRender\(/.test(src) && /\.slamon\{position:fixed/.test(src) && !/slaOpPanelHtml\(pid\)\+boardToolbar|slaOpPanelHtml\(id\)\+boardToolbar/.test(src) && !/function slaOpPanelHtml/.test(src));
// B5 — widget: chip premium (verde/laranja/vermelho) + dropdown ancorado (Monitor de prazos)
ok('B5 widget chip + dropdown', /slamon-chip/.test(src) && /slamon-pop/.test(src) && /Monitor de prazos/.test(src) && /data-slamon-toggle/.test(src));
// B5b — vermelho traz a JANELA de 10 min (tolerância) + estado crítico após esgotar
ok('B5b laranja 30min + vermelho 10min (msg + grace + crítico)', /Você tem 30 minutos para concluir esta tarefa/.test(src) && /Você tem 10 minutos para concluir esta tarefa/.test(src) && /para concluir ou sinalizar atraso/.test(src) && /Atraso cr[ií]tico — sinalize atraso imediatamente/.test(src));
// B10 — guarda de bloqueio operacional (FASE 5) existe e respeita escopo (Admin/Social via canSeeAll não bloqueia)
ok('B10 bloqueio operacional (FASE 5)', /function slaCriticalFor\(/.test(src) && /function slaGuardBlocked\(/.test(src) && /canSeeAll\(u\)\) return null/.test(src) && /function moveStatus[\s\S]{0,120}slaGuardBlocked/.test(src));
// B11 — notificação desktop (main) com SOM: HUB usa silent:p.sound===false (som ligado por
// padrão) e os payloads do notifier carregam sound:true (F3.3.3 — roteado pelo hub).
{ let mn='', nt=''; try{ mn=fs.readFileSync(path.resolve(__dirname,'..','src','main','main.ts'),'utf8'); }catch(_){} try{ nt=fs.readFileSync(path.resolve(__dirname,'..','src','main','notifier.ts'),'utf8'); }catch(_){}
  ok('B11 notificação desktop com som (hub silent:p.sound===false + payload sound:true)', /silent:\s*p\.sound\s*===\s*false/.test(mn) && /sound:\s*true/.test(nt)); }
// B12 — toast in-app de notificação (preview/mock FASE 7) com avatar/nome/descrição
ok('B12 preview de notificação in-app (avatar/nome/desc)', /function slaNotifPreview\(/.test(src) && /snf-av/.test(src) && /snf-ds/.test(src));
// B13 — anti-flicker: render por assinatura + toggle só por classe (sem rebuild do dropdown)
ok('B13 dropdown sem flicker (assinatura + classList.toggle)', /data-sig/.test(src) && /function slaMonUpdateCounters\(/.test(src) && /classList\.toggle\('open'/.test(src));
// C7 — grace window: atraso < 10 min ⇒ graceRemainingMin>0, não crítico
{ const d = resolveTaskDisplayState(withSla({ planDueAt: NOW - 3 * MIN }), NOW, dtMsStub);
  ok('C7 grace dentro de 10 min', d.state === 'overdue' && d.graceRemainingMin === 7 && d.critical === false); }
// C8 — grace esgotada: atraso > 10 min ⇒ graceRemainingMin=0, crítico
{ const d = resolveTaskDisplayState(withSla({ planDueAt: NOW - 15 * MIN }), NOW, dtMsStub);
  ok('C8 grace esgotada => crítico', d.state === 'overdue' && d.graceRemainingMin === 0 && d.critical === true); }
// C9 — slaPanelRow propaga grace/critical (fonte única alimenta o painel)
{ const r = row(withSla({ planDueAt: NOW - 3 * MIN })); ok('C9 row propaga grace', !!r && r.graceRemainingMin === 7 && r.critical === false); }
// B6 — Kanban/card RESTAURADO ao aprovado: card sem flex-shrink:0; only-child volta a flex:1 1 auto.
ok('B6 card NÃO comprime (flex:0 0 auto) + only-child preenche E encolhe p/ caber (flex:1 1 auto + min-height:0)', /\.kbv2-card\{[\s\S]{0,400}flex:0 0 auto;/.test(src) && /kbv2-card:only-child\{ flex:1 1 auto; min-height:0; \}/.test(src));
// B6b — chip SLA do card é por PRAZO FINAL (delega à fonte única; sem "Início atrasado")
ok('B6b chip SLA do card finish-based', /function kbv2SlaLocal[\s\S]{0,400}resolveTaskDisplayState\(/.test(src) && !/label:'Início atrasado'/.test(src));
// B6c — FONTE ÚNICA: card (kbv2SlaLocal), widget/sino (slaPanelRow) e detalhe (detailSla) TODOS
// derivam de resolveTaskDisplayState (status/prazo coerentes entre telas — exigência do owner).
ok('B6c fonte única de status/prazo', /function resolveTaskDisplayState\(/.test(src)
  && /function kbv2SlaLocal[\s\S]{0,600}resolveTaskDisplayState\(/.test(src)
  && /function slaPanelRow[\s\S]{0,600}resolveTaskDisplayState\(/.test(src)
  && /function detailSla\([\s\S]{0,600}resolveTaskDisplayState\(/.test(src));
// B7 — "Sua etapa / Próxima ação" redesenhada premium (ícones + pill)
ok('B7 etapa redesenhada (kbv2-stage2 + pill + ícones)', /kbv2-stage2/.test(src) && /kbv2-st2-pill/.test(src) && /kbv2-st2-ic/.test(src));
// B8 — "Editar prazo" gated por canSeeAll (Social/Admin); designer comum não vê
ok('B8 Editar prazo RBAC (canSeeAll)', /canSeeAll\(state\.user\)[\s\S]{0,80}data-sla-editprazo/.test(src) && /function slaEditPrazoOpen/.test(src));
// B9 — F3.3.13: "Editar prazo" agora GRAVA, mas SÓ os campos de prazo autorizados (Opção A):
//   dotted-path planStartAt+planDueAt; espelha plannedFinishAt só se já existia; read-back canônico;
//   sem editedAt/editedBy/history/campo novo. (Detalhe completo em f33G-editprazo-write.test.mjs.)
{ const i3 = src.indexOf('async function slaEditPrazoCommit'); const i4 = src.indexOf('__slaEditBound', i3 > 0 ? i3 : 0); const seg2 = i3 > 0 ? src.slice(i3, i4) : '';
  ok('B9 editar prazo grava SÓ campos de prazo (Opção A) + read-back', i3 > 0
    && /patch\['designerSla\.planStartAt'\]=startMs; patch\['designerSla\.planDueAt'\]=dueMs;/.test(seg2)
    && /if\(hadPF\) patch\['designerSla\.plannedFinishAt'\]=dueMs;/.test(seg2)
    && /\.doc\(taskId\)\.get\(\)/.test(seg2)
    && /okCanon=fresh\?\(Number\(slaPanelFinishMs\(fresh,f\)\)===dueMs\):false;/.test(seg2)
    && !/designerSla\.editedAt|designerSla\.editedBy|history/.test(seg2)); }

// ===================== PRECISÃO TEMPORAL DO ALERTA LARANJA (relógio simulado) =====================
// Prazo final FIXO; varia-se o "agora". Fonte = designerSla.planDueAt (ms). dtMsStub não interfere.
const FIN = NOW;                                   // prazo final = NOW (epoch ms)
const at = (deltaMs) => resolveTaskDisplayState(withSla({ planDueAt: FIN }), FIN + deltaMs, dtMsStub);
// 1) T-30min-1s → ainda NÃO é laranja (running/azul)
{ const d = at(-30 * MIN - 1000); ok('P1 T-30min-1s => NÃO laranja', d.state === 'running' && d.sev === 'azul' && d.inPanel === false); }
// 2) T-30min exato → laranja, remainingMs = 30min, contador "30:00"
{ const d = at(-30 * MIN); ok('P2 T-30min => laranja + 30:00', d.state === 'warning' && d.sev === 'laranja' && d.remainingMs === 30 * MIN && slaCount(d.remainingMs) === '30:00'); }
// 3) T-30min+1s → contador "29:59" (ceil: não adianta)
{ const d = at(-30 * MIN + 1000); ok('P3 T-30min+1s => 29:59', d.state === 'warning' && slaCount(d.remainingMs) === '29:59'); }
// 3b) +120ms (atraso real do boundary timer) ainda mostra 30:00 (ceil)
{ const d = at(-30 * MIN + 120); ok('P3b T-30min+120ms => 30:00 (ceil)', slaCount(d.remainingMs) === '30:00'); }
// 4) T-1s → laranja, contador "00:01"
{ const d = at(-1000); ok('P4 T-1s => 0:01', d.state === 'warning' && slaCount(d.remainingMs) === '0:01'); }
// 5) T exato → vermelho (overdue), laranja encerra
{ const d = at(0); ok('P5 T => vermelho/overdue (laranja off)', d.state === 'overdue' && d.sev === 'vermelho' && d.critical === false); }
// 6) T+10min → atraso crítico
{ const d = at(10 * MIN); ok('P6 T+10min => crítico', d.state === 'overdue' && d.critical === true); }
// 6b) T+10min-1s → ainda vermelho não-crítico
{ const d = at(10 * MIN - 1000); ok('P6b T+10min-1s => vermelho não-crítico', d.state === 'overdue' && d.critical === false); }
// 7) elapsed "atrasada há" arredonda p/ baixo (floor): em T+1s => 0:01; em T+0.4s => 0:00
ok('P7 elapsed floor (T+1s=0:01)', slaElapsed(1000) === '0:01' && slaElapsed(400) === '0:00');
// 7b) grace countdown ceil: 10:00 no instante do prazo
{ const d = at(0); ok('P7b grace 10:00 no prazo (ceil)', slaCount(d.graceRemainingMs) === '10:00'); }
// 8) prazo canônico IGUAL entre card/monitor/toast: todos derivam de resolveCanonicalDeadline/finishMs
{ const t = withSla({ planDueAt: FIN }); const cd = resolveCanonicalDeadline(t, dtMsStub); const ds = resolveTaskDisplayState(t, FIN - MIN, dtMsStub); const r = row(t);
  ok('P8 prazo canônico único (card=monitor=toast)', cd.plannedFinishAtMs === FIN && ds.finishMs === FIN && r.finishMs === FIN && cd.isValid === true && cd.sourceField === 'designerSla.planDueAt'); }
// 9) fonte canônica: plannedFinishAt > planDueAt > assignment.end > due (ordem)
{ const t = { designerSla: { plannedFinishAt: FIN + 5 * MIN, planDueAt: FIN }, designerAssignment: { designerId: 'D1', endDate: '2026-06-18', endTime: '10:00' }, dueDate: '2026-06-19', dueTime: '09:00' };
  ok('P9 ordem da fonte (plannedFinishAt vence)', resolveCanonicalDeadline(t, dtMsStub).plannedFinishAtMs === FIN + 5 * MIN && resolveCanonicalDeadline(t, dtMsStub).sourceField === 'designerSla.plannedFinishAt'); }

// ===================== VALIDAÇÃO DO FLUXO (comportamento atual == matriz ideal) =====================
// F1 — SLA do designer só nasce APÓS envio (designerSla presente). Sem designerSla ⇒ fora do painel.
{ const semSla = { id: 'NS', sector: 'cronograma', designerAssignment: { designerId: 'D1' }, dueDate: '2026-06-19', dueTime: '09:00' };
  ok('F1 sem designerSla => fora do painel (SLA não nasceu)', resolveTaskDisplayState(semSla, NOW, dtMsStub).inPanel === false && row(semSla) === null); }
// F2 — tarefa SEM designer não entra no painel mesmo com designerSla (exclusão por responsável).
{ const semDes = { id: 'ND', sector: 'cronograma', designerSla: { planDueAt: NOW + 10 * MIN } };
  ok('F2 sem designer => sem linha no painel', row(semDes) === null); }
// F3 — criação inicial (planning, sem designer) não tem SLA.
ok('F3 planning sem SLA', resolveTaskDisplayState({ id: 'PL', sector: 'cronograma' }, NOW, dtMsStub).inPanel === false);

// ===================== MONITOR CALMO ANTES DOS 30min (regressão "33 min") =====================
// slaPanelDerive alimenta o SLA Monitor: antes de T-30min NÃO há warning ⇒ chip verde/calmo.
const deriveAt = (deltaMs) => slaPanelDerive([withSla({ planDueAt: FIN })], FIN + deltaMs, dtMsStub);
{ const d = deriveAt(-33 * MIN); ok('M1 T-33min => monitor calmo (0 warning/overdue)', d.total === 0 && d.warning.length === 0 && d.overdue.length === 0); }
{ const d = deriveAt(-31 * MIN); ok('M2 T-31min => ainda calmo', d.total === 0 && d.warning.length === 0); }
{ const d = deriveAt(-30 * MIN); ok('M3 T-30min => ENTRA em warning (1)', d.total === 1 && d.warning.length === 1 && d.overdue.length === 0); }
{ const d = deriveAt(0); ok('M4 T => overdue (1)', d.total === 1 && d.overdue.length === 1); }

console.log('\nF3.3.2 PANEL RESULT: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
