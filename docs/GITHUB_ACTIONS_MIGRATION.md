# Migração GitLab CI → GitHub Actions (preparação, sem executar)

> **GitLab continua sendo o repositório principal.** Estes workflows são uma
> PREPARAÇÃO: todos são `workflow_dispatch` (execução manual), os que fazem
> deploy exigem `confirm_deploy=DEPLOY`, e **nenhum** roda em push/PR/schedule.
> Nada foi executado, nenhum deploy/APK/release foi feito.

## Mapa GitLab → GitHub Actions

| Job GitLab (`.gitlab-ci.yml`) | Workflow GitHub (`.github/workflows/`) | Tipo |
|---|---|---|
| `build_android_beta` | `android-beta-build.yml` | manual · gera APK · sem deploy |
| `deploy_firebase_functions` | `firebase-functions-deploy.yml` | manual · **DEPLOY guard** |
| `setup_password_reset_provider` | `password-reset-provider-setup.yml` | manual · **DEPLOY guard** |
| `resolve_password_reset_urls` | (embutido em `android-beta-build.yml` e `password-reset-backend-test.yml`) | manual · read-only |
| `test_password_reset_backend` | `password-reset-backend-test.yml` | manual · read-only |
| `deploy_password_reset_firestore_rules_autonomous` | `firestore-rules-deploy.yml` | manual · **DEPLOY guard** · backup |

> `cleanupPasswordResetCodes` é uma Cloud Function **agendada** (server-side),
> publicada pelo deploy de Functions — não precisa de workflow próprio.

## Secrets necessários (GitHub → Settings → Secrets and variables → Actions)

| Secret | Conteúdo | Usado por |
|---|---|---|
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | **conteúdo JSON** da service account do CI | functions-deploy, provider-setup, backend-test, rules-deploy, android-build (resolve URLs) |
| `GOOGLE_SERVICES_JSON_BETA` | conteúdo do `google-services.json` (texto puro) | android-build |
| `RESEND_API_KEY` | API key do painel Resend | provider-setup |
| `RESET_EMAIL_FROM` | `no-reply@agendaidseven.com.br` (default no workflow) | functions-deploy, provider-setup |
| `RESET_EMAIL_FROM_NAME` | `ID Seven Agenda` (default) | idem |
| `RESET_EMAIL_PROVIDER` | `resend` (default) | idem |
| `PASSWORD_RESET_TEST_EMAIL` | e-mail cadastrado p/ provar `delivered:true` (opcional) | backend-test |

### Como criar cada secret
1. GitHub → repositório → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. **`GOOGLE_APPLICATION_CREDENTIALS_JSON`**: cole o **conteúdo inteiro** do JSON da service account (não o caminho). No GitLab era *File variable*; aqui o workflow grava em `$RUNNER_TEMP/gcp-sa.json` em runtime e aponta `GOOGLE_APPLICATION_CREDENTIALS` para ele, apagando ao final.
3. **`GOOGLE_SERVICES_JSON_BETA`**: cole o conteúdo do `google-services.json`. O workflow grava em `android-native-beta/app/google-services.json`.
4. **`RESEND_API_KEY`**: cole a key `re_...` (nunca aparece em log).
5. Os `RESET_EMAIL_*` são opcionais (têm default verificado no workflow); crie só se quiser sobrescrever.

> **Diferença GitLab × GitHub:** GitLab tem *File variables* (caminho pronto);
> GitHub Actions só tem secrets de texto. Por isso os JSON (SA e google-services)
> são **gravados em arquivo no runtime** e **apagados ao final** (`if: always()`).

## Ordem de execução manual (quando for migrar de fato)
1. **`firebase-functions-deploy.yml`** (`confirm_deploy=DEPLOY`) — publica todas as Functions (push + reset + cleanup).
2. **`password-reset-provider-setup.yml`** (`confirm_deploy=DEPLOY`) — injeta `RESEND_API_KEY` real + env + re-deploy das 4 Functions de reset.
3. **`password-reset-backend-test.yml`** — curl real; espere `HTTP=200 ok:true` (idealmente `delivered=true` com `PASSWORD_RESET_TEST_EMAIL` cadastrado).
4. **`firestore-rules-deploy.yml`** (`confirm_deploy=DEPLOY`) — só se precisar republicar as rules (já estão em prod via GitLab).
5. **`android-beta-build.yml`** — gera o APK com as URLs reais via `-PPASSWORD_RESET_*_URL`.

## Riscos
- **Org policy `iam.allowedPolicyMemberDomains`** pode bloquear `allUsers` invoker — o teste detecta via HTTP 403.
- **SA sem `roles/secretmanager.admin`** — o preflight tenta auto-conceder; se não puder, falha com instrução.
- **Duplicidade de deploy** se rodar GitHub e GitLab no mesmo período — por isso GitHub é manual e GitLab segue principal; **não** rode os dois deploys simultaneamente.
- **Secrets ausentes** → workflows falham cedo, sem efeito colateral.

## Rollback
- Workflows são `workflow_dispatch`: não disparam sozinhos; "rollback" é só não executar.
- Deploy de Functions: re-deploy a partir de `mirror/gitlab-1.0.46` (estado aprovado) ou `firebase functions:delete <fn>`.
- Rules: o `firestore-rules-deploy.yml` salva `firestore.rules.backup-pre-<sha>` como artifact — republicar o backup reverte.
- Remover esta preparação: apagar `.github/workflows/*.yml` novos (não afeta GitLab).

## Status
- **GitLab = principal e funcional** (build, deploy, reset testado `delivered:true`).
- **GitHub = espelho** (`mirror/gitlab-1.0.46`) + workflows **preparados, não executados**.
- Migrar só após rodar a ordem acima manualmente no GitHub e validar APK no aparelho.
