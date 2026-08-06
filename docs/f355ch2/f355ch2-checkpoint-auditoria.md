# F3.5.5C-H2 — CHECKPOINT DA AUDITORIA (P0: alerta residual de tarefa terminal no boot)

Fase: hotfix P0 autorizado pelo owner — Desktop **1.0.222**.
Base: **v1.0.221** (`98caad68`). Baseline física: **v1.0.218** (`1a945159`). Rollbacks: técnico
v1.0.221; físico v1.0.218; adicional v1.0.216 (`e509f43a`).
Branch: `desktop/f355c-h2-stale-alert-terminal-task-hotfix-1.0.222`.

Método: auditoria **somente leitura antes de qualquer edição**. O fan-out paralelo de 9 agentes
falhou por um defeito transitório do harness de permissões (todas as chamadas de ferramenta dos
agentes tiveram o input reescrito/esvaziado; os agentes declararam honestamente "não executado" e
nada foi inventado — transcritos preservados). A auditoria foi então executada **diretamente, de
primeira mão**, com leitura integral dos módulos e greps dirigidos; cada afirmação abaixo tem
arquivo:linha.

---

## 1. Evidência do owner

Designer, no boot do Windows, recebeu NOVAMENTE o modal vermelho bloqueante "URGENTE"
("Conclua ou sinalize atraso antes de continuar outras tarefas" / "Bloqueio operacional", botões
Iniciar agora / Estou finalizando / Estou bloqueado / Preciso de ajuda / Apenas reconhecer) para
uma tarefa encerrada há dias; reaparece a cada boot/abertura/restauração. Máquina na 1.0.219.
A notificação do canto inferior ("TEMAS", Revisão→Concluído) é OUTRA superfície (notificação comum
não-bloqueante de conclusão) — não presumida como a mesma tarefa; a identidade do alerta é o
`taskId` gravado no registro pendente local (ver §4), não o título.

## 2. Produtor exato do modal

Evento **`operational_block`** — varredura POR-USUÁRIO em `desktop/src/main/slaRules.js:237-266`
(emitida pelo main via slaScheduler e pelo renderer em `index.html:4724-4730`):
`title:'Tarefa em atraso crítico'`, `body:'Conclua ou sinalize atraso antes de continuar outras
tarefas.'`, `context:'Bloqueio operacional'`, `dedupKey:'operational_block:<taskId>:<finishMs>'`.
`classifyReminderLevel` (`slaReminder.ts:229-235`): `operational_block` ⇒ **critical** ⇒ título
"URGENTE" na janela central (`buildView`, linha 296). Os 5 botões = decisões F3.5.4P
(`decisionsEnabled`).

## 3. NÃO é regressão de versão (provado por diff)

`git diff` v1.0.218→v1.0.219→v1.0.220→v1.0.221 LIMITADO a `slaReminder.ts`, `slaReminderStore.ts`,
`slaReminderWindow.ts`, `executionOrchestrator.ts`, `taskIdle*.ts`, `slaScheduler.ts`,
`slaRules.js`, `reminder.ts`, `notifStore.ts`, `notificationGrouping.ts`, `toastAck.ts`,
`main.ts`, `slareminder.html`: **vazio nas três janelas** — o caminho do alerta é byte-idêntico
nas 4 versões. O comportamento da 1.0.219 (máquina do Designer) é IGUAL ao da 1.0.221. Defeito
**LATENTE** (era F3.5.4L/P), não introduzido recentemente.

## 4. Causa-raiz (cadeia completa, com linhas)

Arquitetura real: o modal central persiste em `userData/idseven-sla-reminder-ack.json`
(`slaReminderStore.ts`): `pending{key→snapshot}` = "mostrado e AINDA não reconhecido (reexibir no
boot)" (linhas 10-16); o snapshot mínimo (`payload`) carrega `taskId` canônico (linha 28).

- **D1 — revalidação pré-exibição é um NO-OP em produção**: o controlador prevê o gate
  `taskValid` (`slaReminder.ts:205`, default `() => true` na linha 244; chamada em
  `showNext():341` e `showNextCheckin():532`), mas o wiring real (`main.ts:944-…`) **NUNCA passa
  `taskValid`** ⇒ o "valida antes de exibir" sempre responde true. Nenhuma consulta ao estado
  canônico acontece antes de mostrar o modal.
- **D2 — replay do boot exibe direto do cache local**: `reconcile("login")` (`main.ts:1342`,
  disparado na restauração de sessão) reenfileira TODOS os pendentes não reconhecidos do uid
  (`slaReminder.ts:758-776`) e chama `showNext()` — o modal abre em milissegundos, ANTES de o
  primeiro snapshot de `tasks` chegar (o listener é criado no mesmo login, `main.ts:796`, mas o
  dado vem da rede). Cache local antigo se sobrepõe ao estado canônico atual.
- **D3 — invalidação terminal é só em memória e só ao vivo**: a supressão usa
  `completedTasks = new Set()` **em memória** (`slaReminder.ts:249`) — zera a cada reinício; e
  `noteCompleted()` (`slaReminder.ts:795-804`) só roda quando a escuta viva (`main.ts:796-808`,
  `slaPanelDelivered`/removed) entrega a mudança COM O APP ABERTO. Conclusão feita por OUTRO
  usuário com a máquina do Designer DESLIGADA ⇒ nada remove o `pending` local ⇒ ele sobrevive
  para sempre (sem TTL) e reaparece a cada boot (D2) sem validação (D1).
- **D4 — modal aberto + tarefa concluída**: `noteCompleted` de item ATIVO apenas troca o corpo
  ("Esta tarefa foi concluída…") e MANTÉM a janela aberta com os 5 botões visíveis
  (`slaReminder.ts:799-803`; a view preserva `decisionsEnabled`) — não fecha automaticamente,
  não escreve recibo; se o usuário não clicar OK, o pendente continua e volta no próximo boot.
- Agravantes verificados: `dedupKey` não inclui status (hipótese 17 — irrelevante após as
  barreiras); ack é por CHAVE (novo `finishMs` ⇒ chave nova); `reconcile` sem uid logado não
  filtra destinatário (`slaReminder.ts:765` — `if (uid && …)`).

O que JÁ estava correto (preservar): os produtores excluem terminais NA EMISSÃO
(`slaOperationalBlocks`/`nextBoundary` usam `slaPanelDelivered` — `slaRules.js:53-59,277`;
idle: `taskIdle.ts:121-123` `concluido|cancelado|removido`); os botões são seguros contra
ressurreição — `persistDecision` é TRANSAÇÃO que relê a tarefa e retorna
`task_completed`/`task_deleted` (`slaReminder.ts:692-705`), nunca reabre/altera tarefa terminal
nem cria claim novo; check-ins não são persistidos entre boots (fila em memória; `taskIdleStore`
guarda só RESPOSTAS); notificações comuns duráveis são não-bloqueantes e deduplicadas por recibo.

## 5. Estados terminais REAIS (enums confirmados — nada inventado)

Predicado canônico existente **`slaPanelDelivered(t)`** (`slaRules.js:53-59`):
`designerSla.finishedAt>0` OU `doneAt>0` OU `designerFlowStatus ∈ {entregue, concluido,
cancelado}` OU `status ∈ {concluido, cancelado, removido}`. Exclusão de documento = change
`removed` do snapshot. "Arquivada" não existe no modelo. A H2 reutiliza EXATAMENTE este
predicado (autoridade única, sem novos nomes).
Responsável canônico: `(t.designerAssignment && t.designerAssignment.designerId) || t.assigneeId`
(`slaRules.js:252` — o mesmo da varredura do operational_block).

## 6. Servidor / claims / Rules

- Decisões de SLA e respostas de check-in são entradas em `tasks/{id}.history[]` gravadas por
  TRANSAÇÃO do renderer (F3.5.4P/Q) — resíduo inofensivo: a transação em tarefa terminal
  responde `task_completed`/`already_*` (nunca "renova" nada).
- Check-in de EXECUÇÃO (F3.5.5A): claim/lease vivem em `executionTracking` DO PRÓPRIO doc da
  tarefa, administrados server-side (`respondExecutionCheckpoint`); em tarefa
  terminal/deadline_changed o servidor responde `deny` e o cliente fecha
  (`slaReminder.ts:483-488`). Sem claim órfão server-side a invalidar por fora.
- **Nenhuma alteração de backend/Worker/Functions/Rules é necessária**: a invalidação terminal é
  observável por TODO cliente vivo via snapshot (conclusão por Admin/SM/portal/outro dispositivo
  chega pelo mesmo `onSnapshot`), e para máquinas desligadas as Barreiras 2/3 revalidam no boot.
  A limpeza reparadora atua SOMENTE nos stores locais (nunca no doc da tarefa).

## 7. Máquina do Designer na 1.0.219 (updater/autostart)

- `updaterService.ts`: `autoDownload=false` (linha 96), checagem periódica (301) + pós-login
  (`checkAuto("session-restore")`, `main.ts` UPDATER block) — o download/instalação exigem ação
  do usuário; adiar/nunca abrir a oferta mantém a versão antiga indefinidamente. Fluxo normal
  OFERECERÁ o Latest (1.0.222) à máquina 1.0.219 sem qualquer mudança — **não há causa provada
  para alterar o updater e ele NÃO será alterado**.
- `autostart.ts`: `app.setLoginItemSettings({openAtLogin, args:["--hidden"]})` — aponta ao exe da
  instalação per-user (NSIS `perMachine:false`; caminho independente de versão; o update
  substitui in-place) ⇒ autostart e atalho abrem a MESMA instalação por construção.
- O que NÃO é verificável daqui (declarado): se naquela máquina houve oferta/adiamento/erro, se
  existe instalação duplicada antiga ou atalho manual divergente — verificação FÍSICA (runbook no
  relatório final: conferir versão em Configurações, %LOCALAPPDATA%\Programs, registro Run e o
  log local `idseven-notif-diag.log`, que registra os eventos do updater).

## 8. Outros usuários — evidência e limites (declaração expressa)

A observabilidade de alertas é 100% LOCAL (diag.ts; provado na F3.5.5C-H1) e este ambiente não
tem credenciais Firestore ⇒ **não existe evidência central suficiente** para a tabela
[usuário × alertas residuais], e nada será inventado. Qualquer máquina com um `pending` local de
tarefa hoje terminal está potencialmente afetada (mesmo mecanismo; código idêntico
218/219/220/221). Evidência REAL disponível após a 1.0.222: a limpeza reparadora loga contagem e
motivo por máquina (`sla.stale.cleanup.*` no log local, sem conteúdo de tarefa) — coletável na
validação física; o `taskId` exato do caso do Designer está no `idseven-sla-reminder-ack.json`
(campo `taskId` do pending) e no log local daquela máquina.

## 9. Correção (3 barreiras + limpeza; arquivos: `slaReminder.ts` + `main.ts` apenas)

- **Barreira 2 — revalidação ANTES de exibir**: novo `taskGate(taskId, recipientUid)` →
  `valid | terminal | missing | assignee_changed | unknown`, implementado no main sobre um mapa
  canônico vivo alimentado pelo MESMO `fbListen("tasks")` (snap.docs) + flag `ready`.
  `showNext`/`showNextCheckin`/`enqueue` consultam o gate: `terminal/missing/assignee_changed` ⇒
  NÃO exibe, remove pendente, grava recibo-lápide com motivo (`stale_terminal_task`,
  `stale_missing_task`, `stale_assignee_changed`), preserva histórico; `unknown` (snapshot ainda
  não chegou) ⇒ NÃO exibe e DIFERE (nada bloqueante sai só do cache). Sem `taskGate` injetado, o
  controlador se comporta byte-igual ao aprovado (suítes f354l/p/q intactas).
- **Barreira 3 — revalidação no boot**: `reconcile` continua reconstruindo a fila, mas a
  exibição espera `onTaskGateReady()` (1º snapshot) — cada taskId é revalidado antes de
  apresentar. Boot OFFLINE: gate permanece `unknown` ⇒ nenhum bloqueio por cache e NENHUM
  pendente apagado; ao reconectar, revalida e apresenta somente o que continuar legítimo.
- **Barreira 1 — invalidação na transição terminal**: `invalidateTerminal(taskId, reason)`
  (chamado pela escuta existente em `main.ts:796-808` para `slaPanelDelivered`/removed — cobre
  conclusão por Admin/SM/Designer/portal/outro dispositivo): remove fila+pendentes do taskId,
  invalida check-ins locais da tarefa, suprime vermelho futuro e — modal ABERTO da tarefa —
  troca para o estado informativo **"Esta tarefa já foi encerrada."** (sem os 5 botões), grava o
  recibo imediatamente e FECHA automaticamente (auto-close ~7s), sem permitir resposta obsoleta.
  Idempotente; motivo técnico registrado.
- **Limpeza reparadora**: `cleanupStale()` no gate-ready — modo contagem primeiro
  (`sla.stale.cleanup.scan` {pendentes, terminais, inexistentes}) e remoção SÓ dos
  comprovadamente residuais, com recibo+motivo por chave; idempotente; por taskId; NUNCA altera a
  tarefa/status/histórico; NUNCA apaga notificações comuns nem alertas legítimos.

## 10. Congelados × alterados

Alterados: `desktop/src/main/slaReminder.ts`, `desktop/src/main/main.ts` (wiring da sessão),
versão (package/lock), suítes/provas/docs/workflows da fase + re-pins herdados de versão.
CONGELADOS (diff-vazio vs v1.0.221): `auth-core.ts` (H1!), `index.html`, `slareminder.html`,
`slaReminderStore.ts`, `slaReminderWindow.ts`, `slaRules.js`, `slaScheduler.ts`, `taskIdle*`,
`executionOrchestrator.ts`, preload, bgnotify, sons, priorityEngine, electron-builder.yml,
Worker, Functions, Rules, Android.

## 11. Riscos e mitigações

- Alerta legítimo não pode atrasar: o gate responde `valid` no 1º snapshot (segundos); o
  produtor ao vivo continua emitindo normalmente (fluxo atual preservado quando o mapa está
  pronto). Teste explícito de tarefa atrasada real.
- `assignee_changed`: aplicado SÓ com resolvedor canônico presente e divergência positiva —
  incerteza nunca derruba alerta (conservador).
- Recibo-lápide usa o MESMO mecanismo aprovado de ack (histórico preservado; caps do store).
- Auto-close do estado "já encerrada": timer no main (configurável em teste); OK manual também
  fecha; nenhum botão de decisão disponível ⇒ zero resposta obsoleta.

## 12. Rollback

v1.0.221 permanece publicada (rollback técnico imediato); física v1.0.218; adicional v1.0.216;
Latest só muda com release explícita. Stores locais são retrocompatíveis (nenhum campo novo
obrigatório; lápides são acks normais).
