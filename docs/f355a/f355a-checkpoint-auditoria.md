# F3.5.5A — CHECKPOINT PRÉ-EDIÇÃO (auditoria read-only, 67 itens condensados)

## Arquitetura atual (provada no código da 1.0.216 @ e509f43)
- **Orquestrador embrionário JÁ EXISTE**: `slaReminder.ts` (`createSlaReminderController`) controla a
  ÚNICA BrowserWindow central (`slaReminderWindow.ts` + `slareminder.html`): fila SLA (`queue` +
  `LEVEL_RANK`), item `active`, ACK de render, timer pós-ACK, som via `soundFor(level)` (data-URI de
  WAV local), decisões (`onDecide`, F3.5.4P), "Registrando..." com bounds congelados (1.0.211) e uma
  TRILHA DE CHECK-IN separada (`checkinQueue`, `kind:"checkin"`, IPC `slareminder-checkin-*`) que SÓ
  aparece quando `!active && !queue.length` — "SLA tem PRIORIDADE absoluta sobre o check-in".
- **Check-in legado (tarefa parada)**: produtor `taskIdleScheduler.ts` (+`taskIdle.ts` elegibilidade
  status "andamento"/statusVersion/thresholdVersion; `taskIdleStore.ts` transação/recibos; flag
  `taskIdleDetectionEnabled` em `f354q-notify.json`; `reconcile()` em boot/snapshot/reconexão).
- **Thresholds SLA reais**: `slaRules.js` `slaCfgOf(setor)` — `warningMinutes` (default 30) e
  `overdueGraceMinutes` (default 10) POR SETOR. Nada de T-30/T-10 hardcoded no laranja:
  `earliestSlaAlertAt = finish − warningMinutes(setor)·60000`.
- **Campos canônicos de tempo** (renderer, 89 refs): `startAt`/`dueAt` (F3.5.2A), `finishMs` (SLA),
  `assignedAt`, `startedAt` (nunca preenchido na atribuição — E3/wh1). Início canônico da janela:
  `startAt` explícito → senão `assignedAt` (momento da atribuição) → nunca data inventada.
- **Jornada/dias úteis/feriados**: NÃO EXISTEM hoje (grep vazio) ⇒ criar configuração administrativa
  mínima; recurso permanece OFF até configurado.
- **Notificação comum premium** (Social Media): HUB `deliverNotification` → toast/bgnotify/nativa com
  som (wh2), agrupamento `notificationGrouping.ts`, dedup/recibos/deep-link — reutilizável com
  eventTypes NOVOS `execution_*` (nunca `sla_*`; `classifyReminderLevel` só intercepta `/^sla_/` e
  `operational_block` ⇒ `execution_*` flui para a comum sem tocar SLA).
- **Multidispositivo**: padrão provado da F3.5.4P/Q — claim/persist por TRANSAÇÃO Firestore no
  renderer (create-if-absent), recibos, invalidação cruzada; será reusado com lease expirável.

## Risco de duplicação e relação com taskIdleScheduler
- Regra: UMA autoridade por tarefa. Roteamento explícito no produtor: com flag ACTIVE/SHADOW e tarefa
  COBERTA (setor habilitado + elegível), o taskIdleScheduler NÃO emite o check-in legado para ela
  (supressão logada `suppressed_by_adaptive`); tarefas não cobertas/OFF ⇒ legado byte-idêntico 1.0.216.
- Nenhum scheduler novo: o planner roda DENTRO do ciclo reconcile existente (mesmos gatilhos
  boot/snapshot/reconexão) como módulo puro; a janela/fila/ACK/som/decisões são as existentes.

## Algoritmo proposto (determinístico, explicável, testável — sem IA)
- Módulo PURO `desktop/src/main/executionTracking.js` (CommonJS como slaRules/notifEvents):
  elegibilidade; matriz de duração (mandato; % de referência) com clamp na zona SLA
  (`finish − warn(setor) − margem cfg`); jornada (dias/horas/timezone; reposição p/ próxima janela se
  ainda relevante); sinais de atividade significativa (lista canônica do mandato) e supressão com
  motivo; risco por fatores documentados (soma determinística de pesos ⇒ low/medium/high);
  chave idempotente `taskId|designerId|deadlineVersion|checkpointIndex`; estados
  PLANNED/DUE/CLAIMED/DISPLAYED/RESPONDED/MISSED/SUPPRESSED/CANCELLED/SUPERSEDED;
  deadlineVersion++ em mudança de prazo (cancela pendentes, recalcula); troca de Designer cancela e
  replaneja preservando histórico.
- Flag `adaptiveExecutionCheckinsEnabled`: OFF (padrão pós-update) | SHADOW (calcula+loga, zero UI/som/
  notificação) | ACTIVE. Config em `f355a-execution.json` (main) + UI Configurações → Acompanhamento
  de execução (admin: modo, setores, designers, dias, horários, timezone, máx/dia, máx/tarefa,
  intervalo mín, tempo de resposta, snooze on/off, escalonamento, observação obrigatória, pausa em
  bloqueio). Social Media não reduz configuração global (gate por papel admin já existente).

## Entrega na UI
- Laranja = NOVA variante da trilha checkin existente (`kind:"checkin"`, `checkinKind:"execution"`),
  mesma janela/fila/ACK/"Registrando..."; título "CHECK-IN DE EXECUÇÃO"; cor laranja distinta; som
  PRÓPRIO novo `execution-checkin.wav` (local, gerado e commitado; mais discreto que o vermelho) via
  hook aditivo `soundForCheckin` — WAVs aprovados intocados. Timer só pós-ACK; perdeu prioridade
  antes do ACK ⇒ cancela sem som (semântica existente da trilha).
- Respostas: SIM (obs opcional) | NÃO {ainda_nao_iniciei, bloqueado, aguardando_material (origem +
  pausaUntil), conclui_minha_parte (confirmação → fluxo de Revisão auditado), outro} | snooze 10min
  (1×/checkpoint); timeout reaproveita o fluxo Q (ocultar sem perder, 1 reapresentação, depois MISSED
  + notificação SM + risco↑).
- Social Media: notifEmit comum com eventTypes `execution_checkin_note|not_started|blocked|
  waiting_dependency|checkin_missed|part_completed` (dedup/agrupar por taskId; prévia truncada;
  detalhe completo só nos Detalhes; cliente NUNCA).
- Detalhes: seção "ACOMPANHAMENTO DA EXECUÇÃO" (timeline; invisível ao cliente — mesma prova de
  serialização da E5/wh1).

## Backend
- Firestore ADITIVO apenas: resumo `executionTracking{...}` na tarefa + coleção `executionCheckins/
  {taskId_designerId_dlv_idx}` imutável (transação create-if-absent = claim multidispositivo; lease
  `claimExpiresAt`); Rules aditivas se a matriz atual não cobrir a coleção nova (auditar na etapa de
  Rules; deploy retrocompatível ANTES da Desktop se necessário). Sem migração; sem campos canônicos
  alterados; Worker/portal intocados.

## Arquivos planejados
`main/executionTracking.js` (novo, puro) · `main/taskIdleScheduler.ts` (roteamento/cobertura aditivos)
· `main/slaReminder.ts` (checkinKind execution + som/obs aditivos) · `main/slaReminderWindow.ts` +
`renderer/slareminder.html` (variante laranja + respostas) · `main/main.ts` (flag/config/wiring/IPC)
· `preload` (IPC aditivo se preciso) · `renderer/index.html` (transações claim/resposta, Detalhes,
Configurações, notifEmit SM, SHADOW log) · `assets/execution-checkin.wav` (novo) · testes f355a ·
provas · workflows build/release · versão 1.0.217. Congelados: notificationGrouping, bgNotify,
notifier(A), updaterService, sons SLA, portal/functions/rules(exceto aditivo auditado)/android.

## Riscos e mitigação
Duplicidade legado×novo (roteamento por cobertura + testes 1..20 supressão); atraso de amarelo/vermelho
(trilha checkin já é subordinada; testes de prioridade 1..15); multidispositivo (claim transacional +
lease; testes 1..16); offline (reavaliação de relevância no reconcile; sem fila histórica); jornada
ausente (OFF até configurar); privacidade (observabilidade só com hashes/buckets; provas V*).
