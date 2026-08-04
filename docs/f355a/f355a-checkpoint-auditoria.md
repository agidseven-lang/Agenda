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

## ADENDO — COMPLEMENTO OBRIGATÓRIO (aprovado pelo owner; vinculante)
1) CLAIM: renderer só SOLICITA; autoridade final = transação Firestore protegida por Rules
   (estado atual + lease + chave determinística); dois dispositivos NUNCA com claim válido
   simultâneo; TODOS os tempos persistidos (plannedAt/claimedAt/leaseExpiresAt/respondedAt/
   missedAt/expiração) via tempo de SERVIDOR — nunca relógio local como autoridade.
2) SHADOW 100% silencioso: sem janela/som/fila/notificação comum/SM/sino/timeline visível/
   risco real/interferência no taskIdleScheduler/resposta fictícia; só plano + decisões
   "exibiria/suprimiria/adiaria/cancelaria" + observabilidade sanitizada + métricas agregadas.
3) Autoridade única: OFF⇒legado 1.0.216; SHADOW⇒legado é a autoridade REAL (adaptativo observa);
   ACTIVE+elegível⇒adaptativo único (legado suprime a tarefa); ACTIVE+inelegível⇒legado.
   Prova obrigatória: nenhum cenário com dois check-ins (etAuthority + testes H).
4) Zona SLA: PLANNED⇒CANCELLED; DUE não exibido⇒SUPERSEDED; fila⇒SUPERSEDED; sem som/promoção/
   reapresentação pós-reconexão; laranja ativo recolhe preservando texto digitado e cede ao
   crítico (depois normalmente SUPERSEDED). Vermelho/amarelo NUNCA esperam (etSlaZoneTransition).
5) Prazos curtos: <30min sem laranja; 30–60min sem laranja quando a zona amarela ocupa parte
   relevante (só com distância operacional segura provada); nunca criar check-in por quantidade.
6) Config incompleta (dias/horários/timezone/intervalo/limite) ⇒ ACTIVE BLOQUEADO com a mensagem
   literal "Conclua a configuração da jornada antes de ativar os check-ins." (etActiveAllowed).
7) Prova multidispositivo REAL: claims simultâneos (1 CLAIMED, 2º leased), vencedor único com
   janela+som, resposta invalida os demais, lease expirada permite takeover, app fechado pré-ACK
   libera, zero duplicidade de janela/som/histórico.
8) Publicação (OFF) só após provar: OFF equivalente à 1.0.216; SHADOW silencioso; ACTIVE com
   autoridade única; claim transacional; amarelo/vermelho sem atraso; sem duplicação do idle;
   jornada incompleta bloqueia ACTIVE; zero vazamento ao cliente; gates verdes.

## ADENDO 2 — CORREÇÃO ARQUITETURAL OBRIGATÓRIA (claim/lease SERVER-SIDE; vinculante)
- etClaimDecision/etRespondDecision permanecem funções PURAS de domínio/teste — FONTE ÚNICA da
  lógica, consumidas pelo SERVIDOR. O renderer NUNCA decide lease/expiração/takeover/concorrência,
  nunca calcula claimedAt/leaseExpiresAt, nunca escreve claim offline.
- Operações server-side autenticadas em functions/ (padrão issueFirebaseAuthToken/loginUser):
  claimExecutionCheckpoint — valida auth + Designer atribuído + ids; transação atômica com relógio
  do SERVIDOR; concede só se {inexistente | lease expirada | mesmo dispositivo idempotente};
  nega {lease vigente de outro=LEASED_BY_OTHER | RESPONDED | SUPERSEDED | CANCELLED | inelegível |
  prazo/Designer mudado | zona SLA}; persiste state/claimedAt/leaseExpiresAt(server)/
  claimedBySessionHash/claimedByDeviceHash/claimVersion/updatedAt(server).
  respondExecutionCheckpoint — valida claim vigente + mesmo Designer + aberto + deadlineVersion
  atual + sem resposta anterior + transição válida; RESPONDED invalida os demais dispositivos
  (fecham superfícies; sem som/reapresentação; histórico ÚNICO).
- Offline ⇒ OFFLINE/RETRY_ON_RECONNECT (sem alerta/som/fila/histórico/claim local pendente);
  reavaliação integral na reconexão. Desktop só apresenta o laranja APÓS claim confirmado →
  ainda elegível → fila central → ativo → ACK do renderer → só então o som.
- deadlineVersion muda SOMENTE na operação autoritativa de prazo (nunca pelo planner local).
- Admin SDK: endpoint protegido por autenticação/autorização própria + IAM mínimo; Rules não são
  a única proteção. Provas obrigatórias incluem relógio local ±10min sem efeito na decisão.

---

## ADENDO 3 — EXECUÇÃO DA ARQUITETURA (registro do que foi implantado)

**Backend (produção, ANTES da Desktop — conforme mandato):**
- Branch `backend/f355a-execution-checkpoint-claims` @ 4a624a1, fast-forward de `app/main`
  (fonte deployada; precedente F4.2C-INT). `functions/index.js` blob 5dba32b5.
- Endpoints aditivos session-gated (authVerifySessionToken; POST-only; no-store; rate-limit
  namespaced; logs mascarados): `claimExecutionCheckpoint` e `respondExecutionCheckpoint` —
  transação Firestore atômica (Admin SDK) lendo `tasks/<id>` + `executionCheckins/<chave>`,
  decidindo com o domínio puro BYTE-IDÊNTICO ao Desktop (sha256 5e849c60…) e relógio DO SERVIDOR;
  persistência com tempos numéricos do servidor (claimedAt/leaseExpiresAt/respondedAt/missedAt/
  updatedAt) + claimedBySessionHash/claimedByDeviceHash/claimVersion.
- Harness offline 45/45 + suítes herdadas f33R..f42c todas verdes.
- Deploy gated `f355a-execution-endpoints-deploy.yml` (main @ 76a72c4; pin commit+blob; alvo FIXO
  --only 2 functions): dry-run run 30934574821 VERDE; deploy REAL run 30934894269 VERDE com
  pós-verificação (functions:list + sondas SEM credencial GET=405 / POST-sem-Bearer=401 nos
  run.app oficiais). Endpoints DORMENTES até a 1.0.217 (e a 1.0.217 sai com flag OFF).

**Modelo de dados (decisão executada):**
- `executionCheckins/<taskId|designerId|dl<v>|cp<idx>>`: histórico imutável SERVER-ONLY
  (catch-all das Rules bloqueia clientes; Admin SDK bypassa) — ZERO mudança de Rules.
- Projeção `tasks/<id>.executionTracking` {v, lastCheckin, timeline(cap 40; observação cap 2000),
  updatedAt} escrita NA MESMA transação do respond — invalidação multi-device e notificação SM
  viajam pelo snapshot realtime de `tasks` que todos os devices já assinam (sem canal novo).
- `deadlineVersion` top-level: incrementado SOMENTE pela operação autoritativa de mudança de
  prazo (saveCardsEdit, irmão do cardDeadlineRev); momento da atribuição lido de
  `designerAssignment.assignedAt` (nunca inventado).

**Desktop 1.0.217 (branch desktop/f355a-adaptive-execution-checkins-1.0.217):**
- Orquestrador ACOPLADO ao taskIdleScheduler por 4 hooks opcionais (mesmo listener/timer/fila;
  no-op ausentes ⇒ 1.0.216). Autoridade única etAuthority; SHADOW 100% silencioso; ACTIVE só
  exibe após claim servidor→reelegível→fila→ativo→ACK→som; offline RETRY_ON_RECONNECT; sem backlog.
- Check-in LARANJA na janela central aprovada (subordinado ao SLA; rascunho preservado na
  preempção; timer de resposta só pós-ACK; snooze 1x; timeout⇒1 reapresentação⇒MISSED server-side).
- SM em tempo real (6 eventTypes execution_*; "Sim" sem observação não notifica); Detalhes com
  "ACOMPANHAMENTO DA EXECUÇÃO" (cliente nunca vê — Worker não seleciona executionTracking);
  Configurações admin-only com a mensagem literal da jornada; som laranja próprio empacotado
  (WAVs de SLA byte-intactos).
- Suítes: 98+38+33+25 novas; regressão canônica 37+74+53+40; provas reais Electron 25/25
  (manifesto docs/f355a-qa/). Pins de versão wh2/vh1 → 1.0.217 (precedente b12fde2).
