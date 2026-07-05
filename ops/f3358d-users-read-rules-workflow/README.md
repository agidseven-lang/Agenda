# F3.3.58-D — Workflow gated de fechamento de `users read`

Workflow: `.github/workflows/firestore-rules-users-read-close-deploy.yml`
(**criado nesta fase; NÃO executado**).

## O que faz

Fecha o client READ de `/users` (`allow read: if true` → `if false`) nas Firestore Rules
LIVE, seguindo o padrão seguro já usado no projeto (modelo `firestore-rules-userspublic-read-deploy.yml`):

1. **Guard APPLY** — `dry_run=true` por padrão; `dry_run=false` exige `confirm_deploy == DEPLOY_RULES_USERS_READ_CLOSE`.
2. **Checkout `main`** (onde vive o patcher validado) + **pin do patcher** (`sha256 96005f45…`).
3. **Prechecks** — `node --check` + roda o teste `f33B` (12/12).
4. **Auth gcloud** (SA via secret; nunca impresso).
5. **Download live (GET read-only)** + backup + **pin do ruleset** (`e650e1b5`) + sanidade pré-patch
   (usersPublic e catch-all presentes; exatamente 1 bloco `/users`).
6. **Patch** (patcher cirúrgico sobre o live-download) + validação estrutural (diff de 1 linha;
   `/users` read `if false`; create/update/delete preservados; usersPublic/notifPrefs/catch-all
   intactos; contagem de match e chaves preservadas). Aborta se `status != patched`.
7. **Matriz emulator local** (Firebase Emulator + rules-unit-testing) contra o live-download
   patchado — **não cria ruleset de produção**.
8. **Notas de rollback** (ruleset anterior `e650e1b5` re-liberável por nome; backup em artifact).
9. **Deploy (só se `dry_run=false`)** — `firebase deploy --only firestore:rules` via `firebase.ci.json`
   efêmero, com **self-audit** que exige config `firestore:rules`-only (sem hosting/functions/storage/
   database/indexes/predeploy).
10. **Postcheck (só se `dry_run=false`)** — confirma `/users` read fechado no ruleset ativo; usersPublic/
    notifPrefs/catch-all preservados.
11. **Artifacts** — `release-before.json`, `firestore.rules.live`, `firestore.rules.generated`,
    `patch-report.json`, `rollback-notes.md`, backup.

## Segurança

- `workflow_dispatch` only (sem push/pull_request/schedule).
- `permissions: contents: read`.
- **dry_run=true por padrão** — dry-run **não** faz deploy, **não** cria ruleset, **não** faz release.
- Apply protegido por `if: dry_run == 'false'` **e** `confirm_deploy == DEPLOY_RULES_USERS_READ_CLOSE`.
- Deploy **exclusivamente** `firebase deploy --only firestore:rules` (config efêmera auditada).
- Pins: ruleset live `e650e1b5` (aborta se divergir → exige nova F3.3.58-A) e patcher `sha256`.

## Próximos passos

- **F3.3.58-D-REVIEW-MERGE** — revisar/mergear este workflow em `main` (sem executar).
- **F3.3.58-E-USERS-READ-RULES-DEPLOY-DRYRUN** — executar com `dry_run=true` (valida sem aplicar).
- **F3.3.58-…-APPLY** — `dry_run=false` + `confirm_deploy`, sob autorização explícita.
