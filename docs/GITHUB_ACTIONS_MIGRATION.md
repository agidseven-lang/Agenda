# Migração GitLab CI → GitHub Actions (preparação, sem executar)

> **GitLab continua sendo o repositório principal.** Estes workflows são uma
> PREPARAÇÃO: todos são `workflow_dispatch` (execução manual), os que fazem
> deploy exigem `confirm_deploy=DEPLOY`, e **nenhum** roda em push/PR/schedule.
> Nada foi executado, nenhum deploy/APK/release foi feito.

---

## ✅ STATUS: GitHub Actions validado operacionalmente (2026-06-01)

> **GitHub está PRONTO tecnicamente, mas NÃO é o principal ainda** — em
> observação por 1 ciclo. **GitLab segue principal por decisão de segurança.**
> Validação feita executando os workflows manuais (`workflow_dispatch`) no
> branch `main`, com checkout do código aprovado em `mirror/gitlab-1.0.46`.

### Workflows validados (execução manual real)
| Workflow | Resultado | Observação |
|---|---|---|
| `firebase-functions-deploy.yml` | ✅ success | deploy de todas as Functions (idempotente) |
| `password-reset-provider-setup.yml` | ✅ success | secret `RESEND_API_KEY` real + re-deploy das 4 functions de reset |
| `password-reset-backend-test.yml` | ✅ success | curl real read-only; veredito `delivered=true` |
| `android-beta-build.yml` | ✅ success | resolve URLs reais Gen2 + build + artifact APK |
| `firestore-rules-deploy.yml` | ⏭️ **não executado** | desnecessário — as rules (passwordResetRequests/Codes) já estão em produção via GitLab; sem mudança a publicar |

### Evidência real (reset de senha pelo backend, via GitHub Actions)
```
URL real: https://requestpasswordresethttp-de36pi7vza-uc.a.run.app
HTTP=200
Body:   { "ok": true, "delivered": true }
Veredito: email-sent confirmado pelo response body (delivered=true)
```

### Artifact (APK gerado pelo GitHub Actions)
- **Nome:** `idseven-nativebeta-a1f5185e1d54e4bbd77b49412d2516cbd38a4f02`
- **SHA-256:** `727071b8f4a108158b60d45cc1325c5ee9a3ab3b66989f486e05c2c313ebb89c`
- **Origem:** workflow `[manual] Android Beta Build`, código de `mirror/gitlab-1.0.46` (1.0.46-beta-chat-thread-final-polish, vc 51).
- **Local:** GitHub → Actions → run do `android-beta-build.yml` → Artifacts.

### Decisão de governança
- **GitLab = principal** (fonte funcional comprovada). **GitHub = CI espelho validado.**
- Promoção do GitHub a principal só após cumprir os "Critérios para promover" abaixo.

---

## Critérios para promover GitHub como principal
Promover **somente** quando TODOS forem verdadeiros:
1. ☐ 1 ciclo de observação concluído sem regressão (GitLab e GitHub coexistindo, GitLab fazendo os deploys reais).
2. ☐ Pelo menos 1 build de APK do GitHub **instalado e testado em aparelho** (login + reset `delivered=true` + chat).
3. ☐ Confirmado que os secrets do GitHub são a fonte canônica (rotacionar/retirar do GitLab só depois).
4. ☐ Decisão sobre o branch default: alinhar `main` (ou branch SaaS dedicada) com a árvore aprovada (`mirror/gitlab-1.0.46`) via PR revisado.
5. ☐ Plano de desligamento do GitLab CI definido (congelar pipeline do GitLab para evitar deploy duplo).
6. ☐ Aprovação explícita do responsável (não automática).

## Plano de rollback
- **Workflows GitHub:** são `workflow_dispatch` — "rollback" é simplesmente não disparar. Para remover, apagar os 5 arquivos `.github/workflows/*` novos (não afeta GitLab).
- **Functions:** re-deploy a partir de `mirror/gitlab-1.0.46` (estado aprovado) — `firebase deploy --only functions`. Reverter função específica: `firebase functions:delete <fn>`.
- **Firestore Rules:** o `firestore-rules-deploy.yml` salva `firestore.rules.backup-pre-<sha>` como artifact antes de publicar; republicar o backup reverte.
- **Secret Manager:** versões antigas do `RESEND_API_KEY` ficam no histórico (`gcloud secrets versions`); reverter por desativar a versão nova.
- **APK:** o aprovado (GitLab, 1.0.46 / `d348cb8`) permanece válido; reinstalar se preciso.
- **Fonte da verdade:** enquanto GitLab for principal, qualquer divergência se resolve re-sincronizando do GitLab.

## Cuidados para evitar deploy concorrente GitLab × GitHub
- **NÃO** rodar deploy de Functions/rules nos dois ao mesmo tempo — o último a publicar vence e pode mascarar estado.
- Enquanto em observação: **deploys reais só pelo GitLab**; GitHub só para validação pontual e build de APK.
- Os workflows GitHub são **manuais** (sem push/schedule), então não disparam sozinhos — o risco de concorrência só existe se alguém disparar manualmente durante um deploy do GitLab. Combinar uma "janela" antes de qualquer disparo manual no GitHub.
- `RESEND_API_KEY`/SA são compartilhados (mesmo projeto `agenda-id-seven`); ambos os CIs agem sobre o MESMO backend — por isso a regra de não concorrência é crítica.
- Quando promover o GitHub: **congelar** o `.gitlab-ci.yml` (jobs de deploy em `when: manual` ou removidos) para o GitLab parar de deployar.

## Próxima etapa recomendada
1. **Observação (1 ciclo):** manter GitLab principal; usar o APK do GitHub Actions (artifact acima) para 1 teste real em aparelho.
2. Se o teste passar, abrir **PR `mirror/gitlab-1.0.46 → main`** (revisado) para alinhar o código do app no branch default do GitHub — **sem** promover ainda.
3. Só então avaliar a promoção do GitHub a principal seguindo os "Critérios" acima.

## Prévia visual do estado final da migração
```
        ┌──────────────────────────── AGENDA ID SEVEN ────────────────────────────┐
        │                                                                          │
        │   GitLab  (PRINCIPAL)                 GitHub  (CI ESPELHO — VALIDADO)     │
        │   idseven/Agenda                      agidseven-lang/Agenda              │
        │   feat/android-native-saas            main + mirror/gitlab-1.0.46         │
        │   1.0.46 · reset OK · APK OK          5 workflows [manual] dispatch-only  │
        │        │                                   │                             │
        │        │  espelho 1.0.46 (4e317f5)         │  workflow_dispatch:          │
        │        └──────────────────────────────────▶│   ✅ functions-deploy        │
        │                                            │   ✅ provider-setup          │
        │   deploys REAIS continuam aqui  ◀───┐      │   ✅ backend-test            │
        │   (decisão de segurança)            │      │   ✅ android-build → APK     │
        │                                     │      │   ⏭️ rules-deploy (n/a)      │
        │                                     │      │                             │
        │   Reset backend (mesmo projeto):    └──────┤  HTTP=200 {ok:true,          │
        │   agenda-id-seven / Resend verificado      │            delivered:true}   │
        │   no-reply@agendaidseven.com.br            │  APK sha256 727071b8…        │
        └──────────────────────────────────────────────────────────────────────────┘
           Status: GitHub PRONTO (tecnicamente) · em observação 1 ciclo · GitLab principal
```

---

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
