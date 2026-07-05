# F3.3.58-B — users read close: patch prep (PREVIEW, NÃO é fonte de deploy)

> **AVISO — este diretório é PREPARAÇÃO/PREVIEW. NÃO é fonte de deploy de Rules.**
> As Firestore Rules NÃO são publicadas a partir de nenhum arquivo deste diretório.
> A fonte-da-verdade do patch é o **live-download** do ruleset de PRODUÇÃO, baixado
> em tempo de execução pelo workflow de deploy (F3.3.58-D/E) e patchado pelo
> **patcher** abaixo. Nenhum arquivo local (baseline nem esta preview) é fonte primária.

## Deliverable autoritativo

- `scripts/worker-ops/patch-firestore-users-read-close-rules.mjs` — patcher idempotente e
  **cirúrgico**: recebe o `firestore.rules` LIVE e troca **somente**, dentro do bloco
  `match /users/{id}`, a linha `allow read: if true;` por `allow read: if false;`. Não toca
  create/update/delete de `/users`, não toca `usersPublic`, não toca nenhum outro `allow read`.
- `scripts/worker-ops/f33B-firestore-users-read-close-rules-patch.test.mjs` — teste
  (12 asserções, sem rede/Firestore/deploy). Roda com `node <arquivo>`.

## Fonte real do patch (F3.3.58-A)

- ruleset vivo: `e650e1b5-0625-42d0-8a4a-5a2a07758c38`
- updateTime: `2026-06-27T14:05:52.741065Z`
- tamanho: 159 linhas / 6185 bytes · sha256 `5c2674626e702306…`
- recapturado read-only pelo workflow `firestore-rules-live-audit.yml` (run #4, artifact `8092590054`).

O baseline local `ops/firestore-rules-baseline/live-firestore.rules` é o predecessor **`2ebfb400` (STALE)**
e diverge do live; por isso o patch **não** deve partir dele. O patcher deve receber o live-download.

## Preview (ilustrativo)

- `users-read-closed.preview.rules` — resultado de rodar o patcher sobre uma **reconstrução
  representativa** (baseline `2ebfb400` + bloco `usersPublic`). Essa reconstrução difere do live
  em **2 linhas em branco (whitespace)**, semanticamente idêntica. **É apenas ilustração do diff**;
  não é o que será publicado.
- `patch-report.preview.json` — relatório do patcher sobre a reconstrução (status=patched, 1 linha).

### Diff semântico (o único efeito do patch)

```diff
     match /users/{id} {
-      allow read: if true;
+      allow read: if false;
       allow create: if request.resource.data.size() < 60;
       allow update: if request.resource.data.size() < 60;
       allow delete: if false;
     }
```

`usersPublic`, `events`, `tasks`, `chats`, `passwordReset*`, `notifLog`, `notifPrefs` e o
catch-all permanecem **inalterados**. `create/update/delete` de `/users` são preservados
(Opção A: fecha só o READ nesta etapa).

## Próximo passo

**F3.3.58-C-USERS-READ-RULES-EMULATOR-DRYRUN** — validar o patch no emulator/dry-run
(users raw read → permission-denied; usersPublic read → OK; escrita cliente auditada) antes
de qualquer apply real. Sem deploy nesta fase (B).
