/* =====================================================================================
 * F3.4.3 — CORPUS DE FIXTURES de SLA (compartilhado pelo Golden Master + testes do scheduler).
 * Task docs REALISTAS cobrindo: cronograma warning/overdue/overdue-critical/running/none/
 * completed/cancelled; edicao_midia warning/overdue (SEM crítico); roteiro (sem SLA);
 * reatribuição (designerId muda); alteração de prazo (scheduleRevision bump); não-elegível
 * (responsável ≠ uid); múltiplas tasks; denormalizado (designerName/Avatar) presente e ausente.
 * ===================================================================================== */
const MIN = 60000, HOUR = 3600000;

/** Constrói o corpus ancorado em NOW (ms). Cada fixture: { name, task, uid, now }. */
export function buildCorpus(NOW) {
  NOW = NOW || 1700000000000;
  const dz1 = "dz1", dz2 = "dz2", soc1 = "soc1";
  // Base cronograma com designerAssignment denormalizado (nome/foto presentes).
  const cron = (o) => Object.assign({
    id: "t_cron", title: "Cronograma semanal", client: "Hospital Visão", sector: "cronograma",
    designerAssignment: { designerId: dz1, designerName: "Marina Dias", designerAvatar: "https://img/marina.jpg", assignedBy: soc1, assignedAt: NOW - HOUR },
    designerFlowStatus: "afazer",
    designerSla: { planDueAt: NOW + 2 * HOUR },
  }, o || {});
  const setSla = (base, planDueAt, extraSla) => { const t = JSON.parse(JSON.stringify(base)); t.designerSla = Object.assign({ planDueAt }, extraSla || {}); return t; };
  const edm = (o) => Object.assign({
    id: "t_edm", title: "Edição pacote 6", client: "Clínica Alfa", sector: "edicao_midia",
    designerAssignment: { designerId: dz1, designerName: "Bruno Alves", designerAvatar: "https://img/bruno.jpg", assignedBy: soc1, assignedAt: NOW - HOUR },
    designerFlowStatus: "afazer",
    designerSla: { planDueAt: NOW + 2 * HOUR, scheduleRevision: 2 },
  }, o || {});
  const setSlaEdm = (planDueAt, rev) => { const t = edm(); t.designerSla = { planDueAt, scheduleRevision: rev }; return t; };

  const F = [];
  const add = (name, task, uid) => F.push({ name, task, uid, now: NOW });

  // ── cronograma: todos os estados ──
  add("cron-running", setSla(cron(), NOW + 2 * HOUR), dz1);                 // running → sem emissão
  add("cron-warning-20", setSla(cron(), NOW + 20 * MIN), dz1);             // amarelo (janela 30)
  add("cron-warning-edge30", setSla(cron(), NOW + 30 * MIN), dz1);         // amarelo exato -30
  add("cron-overdue-red", setSla(cron(), NOW - 5 * MIN), dz1);            // vermelho (grace 10) → sla_overdue
  add("cron-overdue-critical", setSla(cron(), NOW - 15 * MIN), dz1);      // crítico (>10) → sla_critical
  add("cron-none-nosla", (() => { const t = cron(); delete t.designerSla; return t; })(), dz1); // sem SLA → nada
  add("cron-completed", (() => { const t = setSla(cron(), NOW - 5 * MIN); t.designerFlowStatus = "concluido"; return t; })(), dz1); // entregue → nada
  add("cron-cancelled", (() => { const t = setSla(cron(), NOW - 5 * MIN); t.status = "cancelado"; return t; })(), dz1); // cancelada → nada

  // ── edicao_midia: 40/20, dedupByDesigner + scheduleRevision, SEM crítico ──
  add("edm-warning-35", setSlaEdm(NOW + 35 * MIN, 2), dz1);               // amarelo (janela 40)
  add("edm-overdue-5", setSlaEdm(NOW - 5 * MIN, 2), dz1);                 // vermelho (grace 20) → media_overdue_20
  add("edm-critical-window-none", setSlaEdm(NOW - 25 * MIN, 2), dz1);     // estado crítico MAS critical:false → nada
  add("edm-deadline-changed-rev5", setSlaEdm(NOW + 35 * MIN, 5), dz1);    // bump de scheduleRevision → dedup NOVO

  // ── roteiro: jamais SLA de designer ──
  add("roteiro-warn-window", (() => { const t = setSla(cron(), NOW + 20 * MIN); t.id = "t_rot"; t.sector = "roteiro"; return t; })(), dz1);

  // ── não-elegível + reatribuição ──
  add("non-eligible-other-uid", setSla(cron(), NOW + 20 * MIN), dz2);     // dz2 não é o responsável → nada
  add("reassigned-to-dz2", (() => { const t = setSla(cron(), NOW + 20 * MIN); t.designerAssignment.designerId = dz2; t.designerAssignment.designerName = "Carla Nunes"; t.designerAssignment.designerAvatar = "https://img/carla.jpg"; return t; })(), dz2); // dz2 recebe
  add("reassigned-old-dz1-excluded", (() => { const t = setSla(cron(), NOW + 20 * MIN); t.designerAssignment.designerId = dz2; return t; })(), dz1); // dz1 não recebe mais

  // ── denormalizado ausente (só assigneeId/assignee) ──
  add("denorm-absent-assignee", (() => {
    const t = { id: "t_asg", title: "Tarefa direta", client: "Cliente Z", sector: "cronograma", assigneeId: dz1, assignee: "João Silva", assigneePhoto: "https://img/joao.jpg", designerFlowStatus: "afazer", designerSla: { planDueAt: NOW + 20 * MIN } };
    return t;
  })(), dz1); // notifResponsibleDenorm → ramo assignee

  // ── denormalizado presente mas sem avatar (só nome) ──
  add("denorm-name-only", (() => { const t = setSla(cron(), NOW + 20 * MIN); delete t.designerAssignment.designerAvatar; return t; })(), dz1);

  // ── sem cliente (contexto/subtítulo mudam) ──
  add("cron-warning-noclient", (() => { const t = setSla(cron(), NOW + 20 * MIN); delete t.client; return t; })(), dz1);

  return F;
}

/** Conjunto multi-task (para o scheduler): retorna as tasks de vários fixtures de um mesmo uid. */
export function multiTaskSet(NOW, uid) {
  return buildCorpus(NOW).filter((f) => f.uid === uid).map((f) => f.task);
}

export default buildCorpus;
