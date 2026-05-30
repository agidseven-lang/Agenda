# ID Seven — Nativo Beta · Changelog

Histórico das entregas do app nativo (`br.com.idseven.agenda.nativebeta`) e das
Cloud Functions de push imediato. Não cobre PWA, Worker nem schema do backend.

---

## 1.0.29-beta-reminder-fullscreen-v2-channel — canal v2 + builder reforçado (em desenvolvimento)

**Causa raiz refinada (1.0.28):** o alarme dispara e a notificação aparece, mas a
Activity full-screen não abre. Isso aponta para o par canal/full-screen: (a) canais
Android **não atualizam** importância/comportamento após criados — o `reminder_call`
antigo podia não honrar o full-screen; (b) em Android 14, `canUseFullScreenIntent()`
provavelmente = false → rebaixa para heads-up.

- **Novo canal `reminder_fullscreen_v2`** (não reutiliza `reminder_call`):
  IMPORTANCE_HIGH, `lockscreenVisibility = PUBLIC`, vibração, **som de ALARME**
  (USAGE_ALARM), bypass DnD, descrição "Alertas em tela cheia para lembretes importantes".
- **Lembrete usa exclusivamente o v2.** Builder reforçado: `PRIORITY_MAX`,
  `CATEGORY_ALARM`, `VISIBILITY_PUBLIC`, `setFullScreenIntent(pi, true)`,
  `setContentIntent(pi)`, `setOngoing(true)` quando vai abrir tela cheia.
- **PendingIntent** para **Activity** (`ReminderAlarmActivity`), `FLAG_IMMUTABLE |
  FLAG_UPDATE_CURRENT`, **requestCode único por lembrete**.
- **Activity:** theme próprio, `excludeFromRecents`, `showWhenLocked`, `turnScreenOn`,
  `setShowWhenLocked/ setTurnScreenOn`, `requestDismissKeyguard`, log `[REMINDER_ACTIVITY_OPENED]` no onCreate.
- **FSI true** → também `startActivity(ReminderAlarmActivity, NEW_TASK)` (caminho ativo);
  se falhar, `[REMINDER_ACTIVITY_START_FAILED]`, mantendo o fullScreenIntent. **FSI false**
  → não promete tela cheia; diagnóstico "Bloqueado pelo Android"; botão de permissão.
- **Diagnóstico:** ID do canal, importância real, canal bloqueado?, `canUseFullScreenIntent` true/false.
- **Logs:** `[REMINDER_CHANNEL_ID]`, `[REMINDER_CHANNEL_IMPORTANCE]`, `[REMINDER_CAN_USE_FSI_TRUE/FALSE]`,
  `[REMINDER_ACTIVITY_START_ATTEMPT]`, `[REMINDER_ACTIVITY_START_FAILED]`, `[REMINDER_NOTIFY_POSTED]`.
- Não mexe em push imediato/Functions/PWA/Worker/Cloudflare/Rules/schema.

Status: aguardando build do APK + teste em aparelho real.

---

## 1.0.28-beta-reminder-fullscreen-diagnostics — diagnóstico + correção do lembrete (substituída pela 1.0.29)

**Causa raiz (1.0.27 não abriu a tela premium):** (1) Android 14+ bloqueia
`USE_FULL_SCREEN_INTENT` por padrão → `canUseFullScreenIntent()` = false → o
sistema rebaixava para heads-up, e não havia botão para o usuário conceder;
(2) a antecedência efetiva estava em 30 min (não 1h); (3) full-screen só dispara
com a tela bloqueada.

- **Antecedência corrigida para 60 min** (`sync(leadMinutes = 60)`; default 60).
- **Diagnóstico na tela Notificações:** Notificações (permitido/bloqueado),
  Alarmes exatos, **Tela cheia (chamada)** (permitido/bloqueado), Otimização de
  bateria, canal do lembrete.
- **Botão "Permitir alerta em tela cheia":** abre `ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT`
  (Android 14+), com explicação. `canUseFullScreen()`/`fullScreenLabel()`.
- **Botão "Testar alerta premium agora":** agenda em 12s usando EXATAMENTE o fluxo
  real (AlarmManager → ReminderReceiver → ReminderAlarmActivity full-screen).
- **Logs:** `[REMINDER_SCHEDULED]`, `[REMINDER_RECEIVED]`,
  `[REMINDER_FULLSCREEN_ALLOWED]`, `[REMINDER_FULLSCREEN_BLOCKED]`,
  `[REMINDER_ACTIVITY_OPENED]`, `[REMINDER_FALLBACK_HEADSUP]` (tag `ReminderDiag`).
- **Comportamento:** full-screen permitido → abre `ReminderAlarmActivity` (também
  via `startActivity`, cobrindo OEMs); bloqueado → heads-up premium e o toque abre
  a tela. Notificações imediatas aprovadas **intactas**.

Status: aguardando build do APK + teste em aparelho real.

---

## 1.0.27-beta-reminder-fullscreen-notification — lembrete 1h em tela cheia (substituída pela 1.0.28)

**Correção conceitual:** a experiência premium é do **lembrete de 1h antes**, não do
push imediato. Imediatos voltam a ser notificação normal (heads-up), mais rica.

- **Imediato (agenda/tarefa/chat):** notificação normal de alta prioridade no novo
  canal `immediate`, com subText por tipo (Compromisso/Tarefa/Mensagem); toque
  **navega direto** ao destino — sem modal. (Reverte o modal-no-toque da 1.0.26.)
- **Lembrete 1h antes:** agora dispara experiência **premium full-screen**
  (`ReminderAlarmActivity`) via `setFullScreenIntent`, canal próprio `reminder_call`
  (IMPORTANCE_HIGH, categoria REMINDER, bypass DnD). Aparece sobre o lockscreen e
  liga a tela (showWhenLocked/turnScreenOn), sem depender de toque. **Fallback**
  automático para heads-up quando full-screen não é permitido (Android 14+
  `canUseFullScreenIntent`). Permissão `USE_FULL_SCREEN_INTENT` no Manifest.
- **Tela premium do lembrete:** fundo escuro, ícone circular, título forte, card
  (compromisso/tarefa, responsável, data, horário, status), botão "Abrir detalhe"
  (deep link) e "Dispensar".
- **Plumbing:** `ReminderScheduler` carrega campos estruturados (type/date/time/
  responsável/status/deeplink) no alarme e na persistência de reboot (tolerante a
  payloads antigos); `ReminderReceiver` chama o caminho full-screen.
- Não altera PWA/Worker/Cloudflare/Rules/schema nem as Functions aprovadas.

Status: aguardando build do APK + teste em aparelho real.

---

## 1.0.26-beta-notification-detail-modal — modal premium pós-clique (substituída pela 1.0.27)

**Objetivo:** ao tocar na notificação, abrir uma tela/modal nativa premium com
o detalhe (compromisso/tarefa/chat), sem alterar o push em tempo real aprovado.

- **Novo `NotificationDetailModal`** (Compose, `features/notif`): fundo escuro,
  ícone circular no topo, título, card de informações rotuladas, botão de ação
  (pílula) e botão fechar; layout responsivo (scroll).
  - Compromisso: título, responsável, data, horário, status → "Abrir compromisso".
  - Tarefa: título, responsável, prazo, status → "Abrir tarefa".
  - Chat: remetente, prévia, horário → "Abrir conversa".
- **Dados:** instantâneos do payload do push + autoritativos do estado em memória
  (eventos/tarefas já carregados); **fallback amigável** quando ainda carregando
  ou quando o item foi removido/indisponível.
- **Plumbing:** `DeepLink` carrega `NotifPayload` (type/id/title/body/scheduledAt/sentAt);
  `Notifications.notify` leva esses extras na intent; `MainScaffold` roteia o toque
  para o modal e, no botão de ação, abre o detalhe real (`event/{id}`,`task/{id}`,
  `chatThread/{otherId}`). Compatível com `onEventCreated`/`onTaskCreated`/`onChatMessageCreated`.
- **Function (mínimo):** payload do chat ganhou `sentAt` (aditivo) p/ exibir o horário
  no modal — sem mudar dedup/comportamento aprovado.

Status: aguardando build do APK + teste em aparelho real.

---

## 1.0.25-beta-chat-immediate-push — push imediato do CHAT (em desenvolvimento)

**Objetivo:** quando um usuário envia mensagem no chat do app nativo, o
destinatário recebe push mesmo com o app fechado — mesma garantia já validada
para compromisso/tarefa.

- **Cloud Function `onChatMessageCreated`** (gatilho `chats/{chatId}/messages/{messageId}`):
  dispara só para mensagens novas do app nativo (`src=="nativebeta"`), identifica
  o destinatário (`participants − by`), ignora auto-envio, busca `fcmTokens`,
  envia FCM `priority high` + `ttl 600s`, grava `immediateNotifiedAt` /
  `immediateNotifyResult` na mensagem e loga `[TRIGGER] chat/<id> -> <dest>: sent N/M`.
- **App nativo:** mensagens passam a gravar `src="nativebeta"` (dedupe com o push
  próprio do PWA); deep link `chat:<senderId>` abre a conversa correta
  (`chatThread/{otherId}`); notificação com nome do remetente + prévia da mensagem.
- **Áudio:** schema atual é texto; detecção defensiva ("🎤 Enviou um áudio")
  preparada para quando o recurso existir — sem transcrição.

Status: aguardando deploy via pipeline GitLab + teste em aparelho real.

---

## 1.0.24-beta-firestore-trigger-immediate-push — APROVADA EM APARELHO REAL ✅

Push imediato de **compromisso/tarefa** ao responsável, definitivo (server-side).

- **Cloud Functions `onEventCreated` / `onTaskCreated`** (gatilho Firestore v2):
  push em ~1–2 s ao criar evento/tarefa atribuído a outro usuário, com app
  fechado e tela bloqueada. Escopo `src=="nativebeta"`; dedupe `immediateNotifiedAt`;
  FCM `priority high` + `ttl 600s`. Worker (CRON + `/notify-assignee`) mantido como fallback.
- **Deploy automatizado via GitLab CI/CD** (`deploy_firebase_functions`): preflight
  gcloud autossuficiente — autentica via service account (variável File), habilita
  APIs, aplica IAM (incl. Eventarc Service Agent) de forma idempotente, e
  `firebase deploy --only functions --force`.

**Validação em aparelho real (aprovada):**
- APK instalado; Functions publicadas (`✔ onEventCreated`, `✔ onTaskCreated` — `Deploy complete!`).
- Usuário A criou compromisso/tarefa para Usuário B → B recebeu push com o app fechado.
- Pipeline GitLab funcionando; ambas as Functions ativas.

**Melhoria registrada (posterior, não bloqueante):** Functions em `us-central1`
e Firestore em `southamerica-east1` (gatilho cross-region). Funciona; mover as
Functions para `southamerica-east1` reduziria latência/egress — exige recriar as
funções (sem migração in-place em 2nd Gen).
