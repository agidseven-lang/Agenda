# Firebase Hosting PREVIEW — users-read-hardening (PR #120)

Workflow manual `.github/workflows/firebase-hosting-preview-users-read-hardening.yml`.

## 1. Para que serve
Publicar a branch do **PR #120** (`app/f3328-users-read-hardening-onsnapshot-gate`) num
**canal preview efêmero** do Firebase Hosting, para validar `users_read_hardening=ON` com
**backend real** (login/getUserSelf/usersPublic/getUserContact/fcm_token_server) **sem
afetar a população geral** e **sem tocar produção**.

## 2. Como é fail-closed
Aborta antes de publicar se qualquer condição falhar:
- `confirm_preview_only` ≠ `DEPLOY_PREVIEW_ONLY`;
- `target_branch` = `main`/`app/main` ou ≠ `app/f3328-users-read-hardening-onsnapshot-gate`;
- `HEAD` ≠ `expected_head`;
- diff vs `app/main` ≠ **somente `index.html`** (bloqueia Card/Desktop/Worker/Rules/functions);
- `preview_channel` contendo `live/prod/production/main/appmain`;
- `.staging-public` não construído a partir da branch, ou `index.html` do pacote ≠ da branch;
- comando ≠ `firebase hosting:channel:deploy` (recusa `firebase deploy`, `--only hosting`
  live, `functions`, `firestore`, `hosting:live`, `channels/live`);
- config de deploy que contenha `functions`/`firestore`/`rules`/`predeploy`.

## 3. NÃO executar sem fase própria
Esta fase (F3.3.33-A1) **apenas adiciona** o workflow. **Não rode aqui.** `dry_run=true` é o
padrão (valida sem publicar). A execução real (`dry_run=false`) é uma **fase própria, gated**,
idealmente conduzida/observada pelo owner (que controla a service account de produção).

## 4. Publica apenas canal preview
Usa exclusivamente `firebase hosting:channel:deploy <preview_channel> --project
agenda-id-seven --config .firebase-preview.json --expires 1d`. Canal preview = URL isolada,
separada do canal `live`.

## 5. Não publica produção
Nunca usa `firebase deploy` / `firebase deploy --only hosting` (canal live) / `--only
functions` / `--only firestore`. Guards recusam esses termos.

## 6. Não altera Firestore Rules
Nenhum passo toca `firestore.rules`/índices. Config de hosting dedicada e hosting-only.

## 7. Não toca Card/Desktop/Worker
Diff da branch é validado como **somente `index.html`**; `.staging-public` é uma allowlist
fixa de 6 arquivos (index.html, manifest.json, sw.js, firebase-messaging-sw.js, icon-192.png,
icon-512.png). Nenhum `cloudflare-worker.js`, Worker `/send`, `/share`, OG ou `desktop/*`.

## 8. Como deletar o canal preview depois
O canal expira sozinho (`--expires 1d`). Para remover na hora:
`firebase hosting:channel:delete <preview_channel> --project agenda-id-seven`.

## 9. Critérios para a próxima fase de execução
- Autorização explícita para executar (`dry_run=false`), preferencialmente com o owner
  observando/controlando a service account de produção;
- `users_read_hardening` permanece OFF por padrão no produto (flag só no browser canário);
- validar: login server-side, getUserSelf, roster usersPublic, getUserContact,
  fcm_token_server no browser, `usersOnSnapshot=0`, sem PII, console/page errors;
- ao final, deletar o canal preview;
- **não** mergear o PR #120 nem fechar `users` read até a validação e as fases de resíduos
  server-side concluírem.

> Observação: este workflow **não altera nenhum produto** (Card Premium, Desktop, Worker,
> Rules). É infraestrutura de validação preview, dormente e fail-closed.
