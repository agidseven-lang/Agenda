# F4.3C3 — Inventário de Coleções + Campos + Matriz de Permissões

> Reconstruído do código REAL (Desktop `desktop/f352d`, backend `origin/app/main:functions/index.js`,
> Android `android/f43c1-local-security-hardening`, Worker `cloudflare-worker.js`). Itens não
> prováveis marcados **NÃO COMPROVADO**. Nada aqui é suposição.

## Modelo de identidade (fato)
- Auth própria (sem Firebase Auth email/senha). Login = `"s2:"+SHA256(salt|senha)` (fallback djb2 legado).
- **Desktop 1.0.191 = SEM `request.auth`** (rules abertas hoje). Não lê `users`; lê `usersPublic`+`events`+`tasks`.
- **Android (f43c1) = COM `request.auth`** via Firebase **Custom Token** (uid == uid da sessão, cunhado server-side; cliente não escolhe uid). Lê/escreve `tasks/events/chats/users` direto. Escrita em `users` DESABILITADA; FCM via endpoint.
- **Backend + Worker = Admin SDK / service account** (bypassa Rules).
- Sistema é **SINGLE-TENANT / EQUIPE** (sem tenantId). `events`/`tasks` são compartilhados (listeners de coleção inteira, sem filtro por usuário).
- **`sessionVersion` NÃO existe** no backend canônico (`origin/app/main`); é campo da FASE F4.3C2 (não implantada). Rules não enxergam claims de token.

## Inventário por coleção (campos / quem / imutabilidade)

| Coleção | Campos sensíveis 🔒 | Cria | Lê | Atualiza | Exclui | Imutáveis | Queries reais |
|---|---|---|---|---|---|---|---|
| **users** | pass, salt, fcmTokens, fcmTokenMeta, admin, role, status, email, phone | backend (adminCreateUser) | Android (cru) + backend + Worker | backend (self/admin endpoints) | backend | id(uid), createdAt, createdBy | backend `where email==`, `where admin==true`, full `.get()`; Android full listener; Worker doc-by-uid |
| **usersPublic** | — (projeção segura) | trigger `syncUsersPublic` | Desktop/PWA (roster) | trigger | trigger | doc read-only ao cliente | full collection |
| **events** | — | Desktop/Android (cliente) | Desktop/Android (equipe) | Desktop/Android | Desktop/Android | id, createdAt, by, src | Worker `where date>=`; clientes full listener |
| **tasks** | tokens (clientReviewToken/shareToken) | Desktop/Android + Worker(SA) | Desktop/Android (equipe) | Desktop/Android + Worker(SA) | Desktop/Android | id, createdAt, by, src, cardsBatchId | Worker `where clientReviewToken==`/`shareToken==`, `orderBy createdAt`; clientes full listener |
| **chats** | — | Android/PWA | participantes | participantes | (ninguém) | id, participants, createdAt | Android `where participants array-contains uid` |
| **chats/{}/messages** | — | Android/PWA | participantes | (imutável) | (imutável) | by(sender), at, text | Android `orderBy at` |
| **notifLog** | to | backend (Admin, DORMANT) | ninguém (NÃO COMPROVADO) | — | — | append-only | — |
| **notifPrefs** | — | backend (Admin/HMAC, DORMANT) | backend | backend | — | updatedAt server | doc-by-uid |
| **passwordResetCodes** | codeHash | backend (Admin) | backend `where email==` | backend | backend | email/userId/codeHash/expiresAt | `where email==`, `limit 500` |
| **passwordResetRequests** | — | LEGACY (sem caminho ativo — NÃO COMPROVADO) | — | — | — | — | — |
| **waPreviewDiagnostics** | — | Worker(SA) NÃO COMPROVADO | Worker(SA) | — | — | ts | `orderBy ts desc limit 50` |

### Campos de users (união auditada)
`name, role🔒, admin🔒, status🔒, photo, color, email(PII), phone(PII), pass🔒, salt🔒, mustChangePassword, passwordChangedAt, fcmTokens🔒, fcmTokenMeta🔒, reminderMinutes, lastSeen, createdAt, createdBy, disabled🔒, disabledAt, disabledBy, deletedAt`. usersPublic projeta APENAS `{id,name,role,admin,status,photo,color}` (allowlist set-complete; nunca pass/salt/fcm/email/phone).

### Transições de status de tasks (Edição de Cards, do código real)
Dois eixos: `status` genérico e `designerFlowStatus` (+ mirror). Valores canônicos: `{afazer, andamento, revisao, concluido}`. Edges (`designerMoveOpts`): `afazer→andamento`; `revisao→{andamento,concluido}`; `concluido→andamento` (não-cards) ou `concluido→{revisao,andamento}` (edicao_cards, bidirecional); `andamento→{concluido,revisao,afazer}`. **As Rules-alvo validam o VALOR canônico (os 4)**; o enforcement de EDGE fica na app (complexo/multi-eixo) — documentado como limitação.

## Matriz de permissões das RULES-ALVO (comportamento PROPOSTO)
Papéis reais: não há autorização por papel na camada de Rules (single-tenant; membro ATIVO = igual). `role/admin` é authz de app/backend. `isActiveUser()` = `request.auth != null` + doc users existe + status ∉ {inativo,pendente,removido,excluido} + disabled != true.

| Coleção | get | list | create | update | delete |
|---|---|---|---|---|---|
| users | ❌ | ❌ | ❌ | ❌ | ❌ |
| usersPublic | ativo | ativo | ❌ | ❌ | ❌ |
| events | ativo | ativo | ativo & by==uid | ativo & (by/ownerId/createdAt/src imutáveis) | ativo & (by\|ownerId==uid) |
| tasks | ativo | ativo | ativo & by==uid & statusOk | ativo & (by/createdAt/src/cardsBatchId imutáveis) & statusOk | ativo & (by\|assigneeId==uid) |
| chats | ativo & participante | ativo & participante | ativo & uid∈participants | ativo & participante & participants imutável | ❌ |
| messages | ativo & participante-do-chat | idem | ativo & participante & by==uid | ❌ | ❌ |
| notifLog/notifPrefs/passwordReset*/waPreviewDiagnostics | ❌ | ❌ | ❌ | ❌ | ❌ |
| (qualquer outra) | ❌ | ❌ | ❌ | ❌ | ❌ |

Legenda: ❌ = negado ao cliente (Admin SDK/trigger/Worker bypassa). "ativo" = `isActiveUser()`.

## Divergências REGISTRADAS (comprovado × suposto)
1. **events/tasks são de EQUIPE** (leitura por qualquer membro ativo), não escopo-por-dono. A suposição "ler só a própria tarefa / não-participante nega evento / query ampla nega" **não existe** no código (Desktop/Android usam `onSnapshot` da coleção inteira). Estreitar para escopo-por-usuário quebraria o quadro/agenda compartilhados (função da Desktop) → seria "às custas da Desktop". Mantido o modelo real; endurecimento recai na ESCRITA.
2. **events NÃO têm `participants[]`** (single-owner `ownerId`+`by`). O modelo "participante × não-participante" para events **não existe** (só para chats).
3. **`sessionVersion` inexistente** no canônico (F4.3C2 não implantado); revogação fina é server-side. Rules bloqueiam por STATUS/disabled.
4. **Android lê `users` cru hoje** (roster com fcmTokens/PII). A Rules-alvo fecha `users` → Android deve MIGRAR o roster para `usersPublic` (item de migração; a Rules-alvo não deploya até essa migração).
5. **enforcement de EDGE de status** fica na app; Rules validam só o valor canônico.
