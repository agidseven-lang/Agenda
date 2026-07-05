# F3.3.58-C — Emulator dry-run: matriz de permissões (RESULTADO)

Validação do patch de fechamento de `users read` no **Firebase Firestore Emulator**
(`cloud-firestore-emulator-v1.21.0.jar`) com **`@firebase/rules-unit-testing`**, cliente
**NÃO-autenticado** (`request.auth == null`, idêntico ao app sem Firebase Auth). Sem deploy,
sem tocar Rules vivas, sem Firestore real.

- Harness: `emulator-matrix.mjs` (deste diretório).
- Rules testadas: `pre` = baseline aberto (`/users read: if true`); `post` = patched (`/users read: if false`).
- Como rodar: `firebase emulators:exec --only firestore --project demo-users-read-close "node emulator-matrix.mjs"`
  com `PRE_RULES`/`POST_RULES` apontando para as rules pré/pós.

## Resultado: **13 PASS / 0 FAIL**

| Caso | Operação (cliente unauth) | Esperado | Emulator |
|------|---------------------------|----------|----------|
| PRE  | `get /users/{id}` (baseline `if true`) | ALLOWED | ✅ ALLOWED (prova o risco pré-patch) |
| A    | `get /users/{id}` (patched)            | permission-denied | ✅ DENIED |
| B    | `list /users`                          | permission-denied | ✅ DENIED |
| C    | `get /usersPublic/{uid}`               | allowed | ✅ ALLOWED |
| D    | `list /usersPublic`                    | allowed | ✅ ALLOWED |
| E    | `create /usersPublic/{uid}`            | permission-denied | ✅ DENIED |
| F    | `update /usersPublic/{uid}`            | permission-denied | ✅ DENIED |
| G    | `delete /usersPublic/{uid}`            | permission-denied | ✅ DENIED |
| H    | `create /users/{id}` (payload<60)      | allowed (Opção A) | ✅ ALLOWED |
| I    | `update /users/{id}` (payload<60)      | allowed (Opção A) | ✅ ALLOWED |
| J    | `delete /users/{id}`                   | permission-denied | ✅ DENIED |
| K1   | `get /notifPrefs/{uid}`                | permission-denied | ✅ DENIED |
| K2   | `get /randomColl/x` (catch-all)        | permission-denied | ✅ DENIED |

O objetivo-mestre (**fechar a leitura raw de `users`**) fica provado: pós-patch, `/users`
get e list retornam **permission-denied** para cliente, enquanto `usersPublic` continua
legível (roster PII-free) e `usersPublic` writes seguem negados.

## Auditoria de escrita em /users (obrigatória — Opção A)

| Pergunta | Resposta (emulator) |
|----------|---------------------|
| `create` em /users continua permitido? | **SIM** (`if request.resource.data.size() < 60`) — caso H ALLOWED |
| `update` em /users continua permitido? | **SIM** (idem) — caso I ALLOWED |
| `delete` em /users continua negado?     | **SIM** (`allow delete: if false`) — caso J DENIED |
| Isso bloqueia o fechamento do READ?     | **NÃO** — Opção A preserva writes de propósito; o fechamento do read é independente e está provado |
| Fase futura para chegar à Opção C?      | Migrar a **criação/edição de usuário do admin** para endpoint server-side (Admin SDK), depois apertar `/users` create/update para `if false`. **Fora do escopo desta série**; registrado como **risco residual conhecido** |

**Risco residual (não-bloqueante):** com read fechado, um cliente ainda pode `create`/`update`
documentos `/users` com <60 campos (não vaza PII na leitura, mas é privilégio de escrita
excessivo). Alvo de hardening futuro (Opção C), após migrar as escritas para endpoint.
**Não alterar create/update nesta fase.**
