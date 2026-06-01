# Recuperação de senha — checkpoint técnico (1.0.45)

> Base estável pós-aprovação. **Não alterar** sem causa real comprovada.
> Reset autônomo por código de e-mail, sem Firebase Auth, sem reset por admin,
> sem Callable. Aprovado em teste real (`delivered:true`).

## 1. Checkpoint aprovado
| Item | Valor |
|---|---|
| versionName | `1.0.45-beta-password-reset-email-live` |
| versionCode | `50` |
| Commit aprovado | `d348cb8` (branch `feat/android-native-saas`) |
| APK aprovado | `idseven-nativebeta-1.0.45-beta-password-reset-email-live.apk` |
| Provedor de e-mail | Resend |
| Domínio verificado | `agendaidseven.com.br` (DNS/SPF/DKIM Verified, Enable Sending) |
| Remetente | `no-reply@agendaidseven.com.br` (nome: `ID Seven Agenda`) |
| Evidência | curl real → `HTTP=200 { "ok":true, "delivered":true }` |

## 2. Endpoints HTTP usados (Cloud Functions v2 onRequest, us-central1)
- `requestPasswordResetHttp` — `POST {email}` → `200 {ok:true, delivered:true|false}`
- `confirmPasswordResetHttp` — `POST {email,code,newPassword}` → `200 {ok:true}` ou `{ok:false,code,message}`

URLs reais (Gen2 sobre Cloud Run) são resolvidas no CI via
`gcloud functions describe ... --format='value(serviceConfig.uri)'` e injetadas
no app por `buildConfigField` (`PASSWORD_RESET_REQUEST_URL` / `PASSWORD_RESET_CONFIRM_URL`).
O app **não** usa URL presumida nem Callable; chama via `HttpURLConnection`.

As callables `requestPasswordReset` / `confirmPasswordReset` permanecem no código
(legado, não usadas pelo app) — não remover sem motivo.

## 3. Segurança (não regredir)
- Código numérico de 6 dígitos, cripto-seguro (rejection sampling).
- Persistido **apenas como hash** sha256 em `passwordResetCodes`.
- TTL 15 min; máx. 5 tentativas; rate-limit 60s por e-mail.
- Resposta sempre genérica (anti-enumeração).
- Senha gravada como `s2:` + `sha256Hex(salt + "|" + senha)` (mesmo padrão do PWA).
- `RESEND_API_KEY` só no Secret Manager; nunca em log, nunca no repo.

## 4. Variáveis necessárias
**Secret Manager (GCP):** `RESEND_API_KEY` (versão ENABLED, ≠ placeholder).
**CI/CD GitLab (Settings → Variables; defaults no `.gitlab-ci.yml`):**
- `RESEND_API_KEY` (Protected/Masked) — obrigatória.
- `RESET_EMAIL_FROM` = `no-reply@agendaidseven.com.br` (default no pipeline).
- `RESET_EMAIL_FROM_NAME` = `ID Seven Agenda` (default).
- `RESET_EMAIL_PROVIDER` = `resend` (default).
- `GOOGLE_APPLICATION_CREDENTIALS` (File) — SA do CI.
- `PASSWORD_RESET_TEST_EMAIL` (opcional) — e-mail cadastrado p/ provar `delivered:true` no CI.

A SA do CI precisa de `roles/secretmanager.admin` (gerência) e a runtime SA das
Functions de `roles/secretmanager.secretAccessor` (preflight do pipeline garante).

## 5. Pipeline (ordem e gating)
`build → deploy → verify → package`
- **deploy**: `setup_password_reset_provider` ([setup-reset]) + `deploy_firebase_functions` (todo push) + `deploy_password_reset_firestore_rules_autonomous` ([deploy-rules]).
- **verify**: `resolve_password_reset_urls` (todo push, resolve URIs reais → dotenv) → `test_password_reset_backend` ([test-reset], curl real).
- **package**: `build_android_beta` ([build-apk] ou web) — `needs` resolve (obrigatório) + test (opcional).

**Aprovação do teste:** `HTTP=200` + `ok:true` + `delivered:true` → passa (veredito pelo response body; Cloud Logging é complementar e nunca bloqueia).
**Bloqueia (erro real):** HTTP≠200, 401/403 (invoker), secret ausente/placeholder/sem-versão, `RESET_EMAIL_FROM` ausente, URL real vazia, Function não publicada/não-ACTIVE, `resend-rejected`, `config-missing`, `function-error`.

## 6. Regras de rollback
- **Reverter app:** reinstalar o APK 1.0.45 (`d348cb8`). Para reverter código,
  `git revert` do commit problemático mantendo `d348cb8` como âncora estável.
- **Reverter Functions:** `firebase deploy --only functions` a partir de `d348cb8`.
- **Reverter rules:** o job de rules guarda backup `firestore.rules.backup-pre-<sha>`
  (artifact); republicar o backup se necessário.
- **Secret:** versões antigas do `RESEND_API_KEY` ficam no histórico do Secret
  Manager (rollback por `gcloud secrets versions`).

## 7. Checklist de deploy (reset)
1. Vars no GitLab presentes (Protected, Environment = All, sem bloqueio de branch).
2. `RESEND_API_KEY` real no Secret Manager (não placeholder).
3. Domínio `agendaidseven.com.br` Verified no Resend.
4. Push com `[setup-reset] [test-reset] [build-apk]`.
5. `test_password_reset_backend` → `delivered:true` (ou `not-found` se e-mail de teste não cadastrado — infra OK).
6. Baixar APK no `build_android_beta` (stage package) → Artifacts.
7. Validação no aparelho: e-mail cadastrado → código → nova senha → login.
