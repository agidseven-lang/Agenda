# ID Seven — Nativo Beta · Changelog

Histórico das entregas do app nativo (`br.com.idseven.agenda.nativebeta`) e das
Cloud Functions de push imediato. Não cobre PWA, Worker nem schema do backend.

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
