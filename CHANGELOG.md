# ID Seven — Nativo Beta · Changelog

Histórico das entregas do app nativo (`br.com.idseven.agenda.nativebeta`) e das
Cloud Functions de push imediato. Não cobre PWA, Worker nem schema do backend.

---

## 1.0.40-beta-password-reset-email-ready — reset por e-mail com provider real

**Bump de consolidacao.** As variaveis do Resend foram configuradas no GitLab
(RESEND_API_KEY, RESET_EMAIL_FROM, RESET_EMAIL_FROM_NAME, RESET_EMAIL_PROVIDER).
Este commit carrega os marcadores [setup-reset] (injeta secret real + re-deploy
das callables) e [build-apk] (gera o APK), consolidando o fluxo self-service.

- **Sem mudanca de codigo funcional** vs 1.0.39-self-service — apenas versao
  (versionName 1.0.40-beta-password-reset-email-ready / versionCode 45) e
  labels de build (LoginScreen + ProfileScreen).
- Backend: setup_password_reset_provider injeta o secret real e re-deploya
  SOMENTE requestPasswordReset / confirmPasswordReset. Sem chave em log;
  sem segredo no repo.
- Sem alteracao em chat, agenda, notificacoes, lembrete premium, PWA, Worker,
  Cloudflare, schema. Sem Firebase Auth. Sem envio falso. Sem reset por admin.

---

## 1.0.39-beta-password-reset-self-service — redefinicao AUTONOMA por codigo de e-mail

**Correcao de escopo.** O fluxo anterior ("reset por admin") nao atendia ao
requisito: o usuario deve resetar a propria senha sozinho. Esta versao
implementa redefinicao autonoma por codigo via Cloud Functions, sem migrar
para Firebase Auth e sem alterar o hash existente.

**Backend (Cloud Functions v2, Node 20 — admin SDK ignora rules):**
- `requestPasswordReset(email)`: valida, busca usuario por e-mail, gera codigo
  numerico de 6 digitos cripto-seguro, salva APENAS hash sha256 em
  `passwordResetCodes` (TTL 15min, status=pending, attempts=0), envia e-mail
  via **Resend**. Resposta SEMPRE generica (anti-enumeracao). Rate-limit 60s
  por e-mail. Logs sem codigo/senha.
- `confirmPasswordReset(email, code, newPassword)`: valida formato, busca
  codigo mais recente, verifica usedAt/expiresAt/attempts/hash. Se invalido,
  incrementa attempts e retorna HttpsError amigavel. Se valido: gera novo salt
  e `pass="s2:"+sha256(salt|pw)` (mesmo padrao do app), atualiza users/{uid},
  zera mustChangePassword, marca codigo como `used` com usedAt.

**Variaveis necessarias no projeto Functions** (sem segredo no repo):
- `RESEND_API_KEY` — SECRET (Firebase Secret Manager).
- `RESET_EMAIL_FROM` — env (ex.: `no-reply@dominio.com.br`).
- `RESET_EMAIL_FROM_NAME` — env (default: `ID Seven Agenda`).
- `RESET_EMAIL_PROVIDER` — env (default: `resend`).
Sem essas, a Function falha controlada: log `password-reset:config-missing`
+ resposta generica ao cliente — NUNCA inventa envio falso.

**App Android:**
- Nova dep: `com.google.firebase:firebase-functions` (via BOM, sem versao).
- `AuthRepo.requestPasswordReset(email)` agora chama Cloud Function
  (nao escreve mais direto em Firestore); `confirmPasswordReset(email, code,
  newPw, confirmPw)` novo.
- `LoginViewModel` adiciona estado `forgot` (Step1Email -> Step2Code -> Done).
- `LoginScreen`: "Esqueci minha senha" abre Step1 (e-mail -> Enviar codigo);
  Step2 (codigo de 6 digitos + nova senha + confirmar -> Criar nova senha);
  Done -> banner "Senha redefinida com sucesso. Entre com a nova senha." +
  volta para Login. Botao "Reenviar codigo" no Step2.
- Fluxo legado de admin (`pendingChange` apos login com `mustChangePassword`)
  preservado para nao quebrar contas que admin redefiniu antes da 1.0.39.

**Firestore Rules (auto-deploy via patch-firestore-password-reset-rules.mjs):**
- Bloco `passwordResetRequests` permanece (legado, instalacoes < 1.0.39).
- Novo bloco `passwordResetCodes`: `read, list, write: if false` —
  defesa em profundidade (so Admin SDK escreve; nada de cliente).

Versao: 1.0.39-beta-password-reset-self-service / versionCode 44.

---

## 1.0.39-beta-password-reset-final — build consolidada do reset (substituida pela versao acima)

**Apenas bump de versao.** As Firestore Rules do reset foram publicadas
pelo pipeline autonomo (commit `ffd61ee`); o backend agora aceita create
em `passwordResetRequests`. Esta versao consolida o estado para teste
final no aparelho — **sem alteracao funcional**.

- versionName: `1.0.39-beta-password-reset-final` / versionCode: 43.
- Sem mudanca em codigo Kotlin de auth, chat, notificacoes, lembrete
  premium, agenda ou cadastro. Sem alteracao em Firestore Rules,
  pipeline de rules, Functions, PWA, Worker, Cloudflare ou schema.
  Sem reintroducao de audio. Sem Firebase Auth. Sem envio de e-mail.
- Build label no rodape do login e em Profile atualizado.

---

## Infra: deploy autonomo das Firestore Rules (sem Console manual)

**Decisao operacional.** Acabou copiar/colar no Firebase Console e job manual.
Agora o GitLab CI faz tudo sozinho — em PUSH com marker [deploy-rules] na
mensagem do commit, o job:

  1. Baixa as regras de PRODUCAO via Firebase Rules REST (fonte da verdade).
  2. Salva backup como artifact firestore.rules.backup-pre-<sha>.
  3. Roda scripts/patch-firestore-password-reset-rules.mjs — idempotente,
     trabalha por LINHAS (preserva 100% do input), insere apenas o bloco
     passwordResetRequests antes de match /{document=**} (ou, no fallback,
     antes do fechamento de match /databases/{database}/documents).
  4. Diff -u from-prod -> generated; aborta se o patch alterou/removeu
     qualquer linha existente.
  5. Valida ausencia de crases / cercas markdown.
  6. Cria firebase.ci.json temporario apontando para firestore.rules.generated
     e publica via firebase deploy --only firestore:rules --config ...
  7. Confirma a nova release via REST.

**O que mudou no repo (cleanup):**
- Removido `firestore.rules` reconstruido (prod e a fonte da verdade).
- `firebase.json` reverteu para functions-only (evita deploy acidental do
  arquivo errado em ambiente local; o CI usa firebase.ci.json transitorio).
- Removidos os dois jobs manuais (`dump_firestore_rules`,
  `deploy_firestore_rules`) — substituidos pelo job autonomo.
- Novo: `scripts/patch-firestore-password-reset-rules.mjs` (Node ESM,
  testado em 5 cenarios: inserir, idempotente, fallback sem wildcard,
  rejeicao de input invalido, indentacao alternativa).

**IAM (one-time):** o job tenta `gcloud projects add-iam-policy-binding`
de `roles/firebaserules.admin` na SA do CI. Se a SA ja tiver, no-op
idempotente; se nao tiver setIamPolicy, prossegue e o deploy falha com
causa exata no log (nao mascara).

**APK 1.0.38:** sem mudancas (commit nao tem `[build-apk]`).

---

## Infra: deploy de Firestore Rules via GitLab CI (sem copia manual no Console)

**Causa raiz da dor.** O editor do Firebase Console rejeita texto com markdown
(crases / cercas `\`\`\``) com `token recognition error at: '\`'`. Pior: o
`firestore.rules` do repo era um snippet (so `passwordResetRequests`) — publica-lo
substituiria as regras de producao e derrubaria PWA + app.

**Solucao definitiva (infra apenas; APK 1.0.38 nao muda).** Dois jobs novos no
`.gitlab-ci.yml`, ambos **manuais** (sem efeito em push), usando a mesma
service account ja configurada (`GOOGLE_APPLICATION_CREDENTIALS` File var):

- **`dump_firestore_rules`** — baixa as regras de PRODUCAO via Firebase Rules
  REST API e salva como artifact `firestore.rules.from-prod`. Nao publica nada.
  Voce roda *antes* do primeiro deploy para conferir o que esta vivo.
- **`deploy_firestore_rules`** — valida o `firestore.rules` do repo (sem crases,
  sem cercas markdown, com `rules_version`, `service`, `match` e bloco
  `passwordResetRequests`; chaves balanceadas), faz BACKUP automatico das regras
  de prod (artifact `firestore.rules.backup-pre-<sha>`), e publica via
  `firebase deploy --only firestore:rules`. Idempotente. Confirma a release
  no final via REST API.

**`firebase.json`:** acrescentado bloco `firestore.rules` mantendo `functions` intactas.

**`firestore.rules`:** agora COMPLETO (preserva users/events/tasks/chats/messages/briefs
no comportamento conhecido + bloco restrito `passwordResetRequests` + default-deny
em `match /{document=**}`). Limite de 1 MiB por doc. Cabecalho documentado.

**Pre-requisito IAM (uma vez, no Console GCP):** a service account do CI precisa
ter `roles/firebaserules.admin` no projeto `agenda-id-seven` (provavelmente ja
tem; se o deploy falhar com `PERMISSION_DENIED` no IAM, conceder e tentar de novo).

**APK:** nao houve mudanca de codigo Android. O artifact 1.0.38 existente
(`idseven-nativebeta-1.0.38-beta-password-reset-rules-fix.apk`) ja contem a
mensagem amigavel e o fluxo correto. So o deploy das regras destrava o
PERMISSION_DENIED no app real.

---

## 1.0.38-beta-password-reset-rules-fix — corrige PERMISSION_DENIED do reset (em desenvolvimento)

**Causa raiz.** Na 1.0.37 a coleção aditiva `passwordResetRequests` foi criada
sem regra no Firestore. Como o app **não** usa Firebase Auth (sem `request.auth`),
a regra default nega `create` → Firestore retorna
`PERMISSION_DENIED: Missing or insufficient permissions.`, e o app exibia o
erro técnico bruto.

- **Snippet de Rules (novo `firestore.rules` no repo, OUT-OF-BAND deploy).**
  O snippet permite apenas `create` (cliente), nega `read/list/update/delete`,
  exige schema EXATO (`hasOnly` + `hasAll`), `status=="pending"`,
  `source=="nativebeta"`, `handledBy==null`, `handledAt==null`, `kind∈{email,phone}`,
  `identifier` string 3-120, `phoneDigits` ≤20 e ≥8 quando `kind=="phone"`,
  `createdAt` numérico > 0. **Atenção:** o arquivo do repo é SNIPPET — deve ser
  MESCLADO nas regras existentes do Console (não substituir). Triagem das
  solicitações fica no Console Firebase (não há admin auth real para o app
  nesta fase).
- **App:** `AuthRepo.requestPasswordReset` deixa de propagar `ex.message`;
  qualquer falha (rede, regras) mostra agora *"Não foi possível enviar sua
  solicitação agora. Tente novamente em instantes."* (mensagem amigável fixa).
- **Mantido:** sucesso continua com mensagem genérica (anti-enumeração);
  fluxo de "Criar nova senha" intacto; login normal intacto; chat, notificações,
  Functions, PWA, Worker e Cloudflare **não tocados**.
- Versão 1.0.38 (versionCode 42).

---

## 1.0.37-beta-password-reset-admin — redefinição de senha por administrador (em desenvolvimento)

**Esqueci minha senha sem e-mail (decisão de produto).** Reset solicitado no app,
tratado por admin (que define senha temporária); o usuário entra e o app obriga
trocar antes de criar sessão. **Auditoria:** o app usa auth própria via Firestore
(sem Firebase Auth) e o projeto NÃO tem provedor de e-mail — então nada de
`sendPasswordResetEmail`, nada de token+e-mail, nada de migrar para Firebase Auth.

- **Tela de login:** link "Esqueci minha senha" abre o formulário de redefinição
  (e-mail ou WhatsApp). Mensagem genérica de retorno; sem revelar existência.
- **Solicitação:** `AuthRepo.requestPasswordReset` cria doc em **`passwordResetRequests`**
  (aditivo) com `identifier`, `kind`, `phoneDigits`, `createdAt`, `status="pending"`,
  `source="nativebeta"`, `handledBy=null`, `handledAt=null` — sem consultar `users/*`
  (anti-enumeração) e sem expor schema no erro.
- **Fluxo do admin (fora do app):** ver pendências em `passwordResetRequests`;
  marcar usuário com `mustChangePassword=true` e nova senha temporária (`pass`/`salt`
  no padrão do app: `s2:sha256(salt+"|"+temp)`); atualizar request para
  `status="done"` com `handledBy`/`handledAt`.
- **Próximo login do usuário:** ao logar com a temporária, o app detecta
  `mustChangePassword=true` e **NÃO cria sessão**; mostra "Criar nova senha"
  (mín. 6 chars, ≠ atual, confirmação igual). `AuthRepo.changePassword`
  re-autentica com a temporária, grava novo `pass`/`salt`, zera `mustChangePassword`
  e marca `passwordChangedAt`. Só então a sessão é criada.
- **Segurança:** sem senha em texto puro; sem token de reset (fluxo não usa); sem
  segredo no código; logs sem expor senha; nenhuma enumeração de usuário; nenhuma
  alteração em Functions/PWA/Worker/Cloudflare/Rules.
- Esta versão **não** envia e-mails.

Status: aguardando build do APK + teste em aparelho real + um admin para a 1ª aprovação.

---

## 1.0.36-beta-chat-thread-polish — refinamento visual da conversa (em desenvolvimento)

**Fase 3E do chat (UI-only no `ChatThreadScreen`).** Sem mexer em lógica/Functions/notificações.

- **Separador de data:** chip "Hoje" / "Ontem" / "dia de mês" / "dd/mm/aaaa"
  (anos passados), inserido só quando muda o dia entre mensagens consecutivas.
- **Agrupamento por dia + remetente:** mensagens consecutivas do mesmo remetente
  no mesmo dia ficam coladas (sem "rabinho" repetido); só a última do grupo tem
  o canto curto (estilo premium).
- **Estado vazio premium:** ícone circular accent + "Nenhuma mensagem ainda" +
  "Envie uma mensagem para iniciar a conversa." (campo de envio segue disponível).
- **Bubble polish sutil:** padding 13×9 (era 12×8); horário/ticks intactos
  (1.0.32 — ✓/✓✓ por `readBy`, recebidas sem ticks).
- **`DateUtil`:** adicionado `sameDay(a,b)` e `dayHeader(ms)` (aditivo, públicos).
- Lista de conversas, ChatRepo, schema, Functions, push, ✓/✓✓, contador,
  respostas rápidas e notificações 1.0.31 **não tocados**. Sem áudio.

Status: aguardando build do APK + teste em aparelho real.

---

## 1.0.35-beta-chat-list-polish — refinamento da lista de conversas (em desenvolvimento)

**Fase 3D do chat (UI-only).** Lista do Marketing mais próxima do WhatsApp Business.

- **Cards arredondados** (16 dp) com superfície/borda distintas; itens com **não
  lidas** ganham destaque sutil (fundo `Surface2` + borda accent translúcida,
  nome em bold, prévia em `Ink`/SemiBold, horário accent).
- **Header premium:** título + subtítulo dinâmico ("N não lidas · equipe ID Seven"
  ou "Conversas da equipe ID Seven").
- **Ticks na prévia (consistente com 1.0.32):** só nas minhas últimas mensagens —
  **✓** quando o destinatário ainda não leu, **✓✓** accent quando leu (derivado de
  `unreadFor(otherId) == 0`). Recebidas sem ticks.
- **Estados vazios profissionais:**
  - busca sem resultado: "Nada encontrado para "<termo>"";
  - sem nenhuma conversa iniciada: "Nenhuma conversa ainda — toque em alguém da
    equipe para iniciar o atendimento por aqui." (sem inventar botão "nova
    conversa" — já basta tocar num contato).
- **Badge** de não lidas até 99+; ordenação `lastAt desc` preservada; busca por
  nome + última mensagem preservada.
- Não toca ChatRepo/schema/Functions/notificações; nada de áudio.

Status: aguardando build do APK + teste em aparelho real.

---

## 1.0.34-beta-chat-quick-replies — respostas rápidas no chat (em desenvolvimento)

**Fase 3C do chat (leve, sem schema/backend).** Textos prontos estilo WhatsApp Business.

- **Botão "Respostas"** (ícone `ListAlt`, discreto, acima da barra de envio) abre um
  bottom sheet "Respostas rápidas" com os textos organizados por categoria
  (Saudação, Confirmação, Solicitação, Encaminhamento, Retorno).
- **Inserção no campo, NÃO envia:** ao tocar numa resposta, o texto entra no input
  (se já houver texto, acrescenta ao final com espaço); o usuário edita e envia com
  o botão Enviar normal. Sem auto-envio.
- **Local/estático:** `QUICK_REPLIES` no app (sem coleção nova, sem sync remoto, sem
  painel admin). Arquitetura preparada p/ futuramente virar editável por setor
  (basta trocar a fonte mantendo categoria → textos).
- Não reintroduz áudio. Não toca Storage/ImageKit/Worker/PWA/Rules/schema/Functions/
  notificações. Texto, push do chat, ✓/✓✓ e contador intactos.

Status: aguardando build do APK + teste em aparelho real.

---

## 1.0.33-beta-chat-audio-removed — áudio do chat cancelado (em desenvolvimento)

**Decisão de produto:** a Fase 3B (envio de áudio no chat) foi **CANCELADA**.
Não haverá gravação/upload/player de áudio. A próxima evolução do chat **não**
será áudio (candidatas: lista de conversas, UX das mensagens, respostas rápidas,
filtros do Marketing, busca).

- **Removido da UI do chat:** ícone de microfone e o toast "Gravação de áudio em
  breve" no botão de envio (`ChatThreadScreen`). O botão agora é só **Enviar**
  (texto), desabilitado quando não há texto. Sem `RECORD_AUDIO`, sem player.
- **Mantido (justificado):** o ramo defensivo `🎤 Enviou um áudio` em
  `functions/index.js` (`chatPreview`) é **código morto** — o app só grava texto,
  então nunca é alcançado e não gera UX errada. Removê-lo exigiria **re-deploy das
  Functions aprovadas** sem ganho funcional; por isso fica intacto.
- Não adiciona Firebase Storage; não usa ImageKit; não toca Worker/PWA/Rules/
  schema/Functions/notificações. Texto, push do chat, ✓/✓✓ e contador intactos.

Status: aguardando build do APK + teste em aparelho real.

---

## 1.0.32-beta-chat-read-receipts — status visual de leitura no chat (em desenvolvimento)

**Fase 3A do chat (baixo risco, só UI + readBy existente).** Não toca notificações 1.0.31.

- **Ticks de leitura** (estilo WhatsApp) **só nas minhas mensagens**:
  - enviada (destinatário ainda não leu): **✓** simples, neutro (`Done`);
  - lida (`readBy` contém o uid do destinatário): **✓✓** em destaque sutil (`DoneAll`, ciano).
  - mensagens recebidas não exibem ticks. Horário preservado.
- **`markRead` agora grava `readBy.<meuUid>`** nas mensagens RECEBIDAS ao abrir a
  conversa (mesmo padrão do PWA; campo `readBy` já existia). Filtro client-side +
  idempotente (só escreve nas que faltam) → sem writes duplicados; não toca minhas
  mensagens. Continua zerando `unreadCount.<meuUid>` (contador não regride).
- Sem alterar PWA/Worker/Cloudflare/Rules/Functions/schema (campo `readBy` aditivo
  já existente). Sem áudio/anexos nesta fase.

Status: aguardando build do APK + teste em aparelho real.

---

## 1.0.31-beta-reminder-responsible-fix — ✅ APROVADA EM APARELHO REAL

**Baseline estável de notificações.** Tag interna: `v1.0.31-beta-notifications-approved`.

Registro técnico:
- **Branch:** `feat/android-native-saas` · **commit:** `80d62a8` (GitLab) / árvore `42ada4f`.
- **APK aprovado:** `idseven-nativebeta-1.0.31-beta-reminder-responsible-fix.apk` (versionCode 35).
- **Functions ativas:** `onEventCreated`, `onTaskCreated`, `onChatMessageCreated`.
- **Canais:** `immediate` (push imediato) e `reminder_fullscreen_v2` (lembrete em chamada) — distintos.

Comportamento aprovado (teste real):
- Notificação imediata normal/sininho ✓
- Push imediato de agenda/tarefa ✓ · Push imediato do chat ✓
- Tela premium estilo chamada/alarme ✓ · Lembrete premium de 1h antes ✓
- Lembrete aparece no aparelho do **responsável** correto ✓
- A cria item p/ B → A **não** recebe; B recebe ✓ · A cria p/ si → A recebe ✓

**Congelado:** não alterar onEventCreated/onTaskCreated/onChatMessageCreated,
ReminderAlarmActivity, ReminderScheduler, canais, FullScreenIntent — salvo bug comprovado.

### 1.0.31-beta-reminder-responsible-fix — fix da elegibilidade

**Causa raiz da regressão da 1.0.30:** o filtro exigia `ownerId`/`assigneeId`
preenchido. Mas no `EventFormScreen`/`TaskFormScreen` esses campos começam `null`
e, quando o usuário cria um item **para si** sem escolher responsável no dropdown,
o doc é salvo **sem** `ownerId`/`assigneeId`. O filtro 1.0.30 então pulava o item
(`isNullOrBlank` → skip) e o lembrete premium **não disparava nem para o criador**.

- **`resolveReminderResponsibleUid(type, ownerOrAssigneeId, createdBy)`:** usa o
  campo real (`ownerId` p/ evento, `assigneeId` p/ tarefa) e, se vazio, faz
  **fallback para o criador `by`** (item sem responsável explícito = de quem criou).
  Regra: A cria p/ B → só B; A cria p/ si (sem responsável) → A; item de B → B.
- **Logs de auditoria:** `[REMINDER_ELIGIBILITY_DEBUG]` (currentUid, ownerId/
  assigneeId, by, responsible, eligible), `[REMINDER_RESPONSIBLE_FIELD_RESOLVED]`,
  `[REMINDER_NO_RESPONSIBLE_UID_FOUND]`, `[REMINDER_SKIPPED_NOT_RESPONSIBLE]`,
  `[REMINDER_SCHEDULED_FOR_RESPONSIBLE]`.
- **Botão "Testar alerta premium como responsável"** (Perfil > Notificações):
  fluxo LOCAL (sem Firestore/FCM) passando pelo resolver — isola o filtro e prova
  que a tela cheia 1.0.29 continua funcionando.
- Preserva ReminderAlarmActivity + canal `reminder_fullscreen_v2` +
  USE_FULL_SCREEN_INTENT + fullScreenIntent + teste premium local.
- Campos reais confirmados: evento `ownerId` (UID) + `owner` (nome) + `by` (criador);
  tarefa `assigneeId` (UID) + `assignee` (nome) + `by`. session.uid = users/{doc.id}.
- Não mexe em push imediato/chat/PWA/Worker/Cloudflare/Rules/schema.

Status: aguardando build do APK + teste em aparelho real.

---

## 1.0.30-beta-reminder-responsible-only — lembrete só no responsável (substituída pela 1.0.31)

**Causa raiz:** `ReminderScheduler.sync` agendava o lembrete local para **todo**
item visível, **sem filtrar pelo usuário logado** (e o campo `resp` usava o nome,
não o UID). Como o criador A vê o item que criou, o aparelho de A agendava e
disparava a tela premium — em vez do responsável B.

- **Elegibilidade por UID:** o lembrete local só é agendado quando
  `currentUid == ownerId` (compromisso) ou `currentUid == assigneeId` (tarefa).
  `sync(... currentUid ...)`; `MainScaffold` passa `session.uid`.
- **Cancelamento:** itens que deixaram de ser elegíveis (A criou p/ B, ou o
  responsável mudou) têm o alarme local cancelado no próximo sync.
- **B agenda mesmo sem abrir o app:** ao chegar o push imediato (a Function só
  envia ao responsável), `AppFirebaseMessagingService` chama
  `ReminderScheduler.scheduleFromFcm(...)` → agenda o premium em T‑60min;
  idempotente com o sync (mesmo id), persiste p/ reboot.
- **Function (ajuste mínimo aditivo):** payload de evento/tarefa ganhou
  `scheduledDate` e `scheduledTime` (sem alterar entrega/dedup do push aprovado).
- **Logs:** `[REMINDER_ELIGIBLE]`, `[REMINDER_SKIPPED_NOT_RESPONSIBLE]`,
  `[REMINDER_CANCELLED_NOT_RESPONSIBLE]`, `[REMINDER_SCHEDULED_FOR_RESPONSIBLE]`,
  `[REMINDER_SCHEDULED_FROM_FCM]`, `[REMINDER_SCHEDULED_FROM_SYNC]`.
- Mantém ReminderAlarmActivity + canal `reminder_fullscreen_v2` + full-screen +
  diagnóstico aprovados. Não mexe em push imediato/chat/PWA/Worker/Cloudflare/Rules/schema.

Status: aguardando build do APK + teste em aparelho real.

---

## 1.0.29-beta-reminder-fullscreen-v2-channel — canal v2 + builder reforçado (substituída pela 1.0.30)

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
