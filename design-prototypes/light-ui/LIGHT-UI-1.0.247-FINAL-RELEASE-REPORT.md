# AGENDA ID SEVEN — 1.0.247 · FINAL RELEASE REPORT

**AGENDA ID SEVEN 1.0.247 = RELEASED** · **TAG = `v1.0.247`** → **`cd92ec1fb723146ead1bd3031898be77a577b135`** (FINAL SOURCE exato) · **LATEST = 1.0.247** (stable; prerelease=false; draft=false; published 2026-08-22T01:31:12Z) · publicada pelo workflow gated **run `32543641929`** com o GO explícito do owner (mandato FINAL RELEASE 2026-08-22).

## PRE-PUBLISH HARD GATE (FASE 0 — 15/15 PASS)
FINAL SOURCE `cd92ec1f` íntegro (version 1.0.247 + marcador `1.0.247-i5c5-unattended-update-bridge`); tag v1.0.247 inexistente; Latest anterior v1.0.246; run canônico `32542723701` SUCCESS; bundle não expirado (expira 2026-09-21); pins do release == manifest canônico; worktree limpa (`porcelain count=0`).

## RELEASE WORKFLOW (FASE 1/2)
Dispatch com os valores exatos do mandato (`build_run_id=32542723701` + `RELEASE-1.0.247-FINAL-AUTORIZADO` + GO do owner). Iterações honestas registradas:
- Run `32543385076`: **TODOS os gates de integridade verdes** (Gates 0–3; sha256 dos 6 assets OK; contrato sha512/size OK) — falha SÓ na criação da tag: `403 Resource not accessible by integration` (o GITHUB_TOKEN da org é read-only). Nada publicado parcialmente.
- Correção pelo padrão institucional: escritas via **GitHub App "Agenda ID Seven Release Bot"** (token temporário `create-github-app-token`, `permission-contents: write` + `permission-workflows: write` — o par literal do precedente f42f; o segundo escopo é exigido porque a ref da tag alcança commits de `.github/workflows`). Run `32543529810` provou a necessidade do segundo escopo; **run `32543641929` = SUCCESS**: gates 0–3 → Release Bot ativo/escopo só-Agenda → verificação criptográfica total do bundle do run pinado → tag → `gh release create --latest` → **pós-verificação** (flags false|false; 6 assets; tag==FINAL SOURCE; Latest==v1.0.247; v1.0.246/245/244 preservadas).
Gates e pins **nunca** foram editados; nenhum release manual; nenhum "latest run".

## TAG (FASE 3 — verificação independente via API pública)
`refs/tags/v1.0.247` → `cd92ec1fb723146ead1bd3031898be77a577b135` — **exatamente o FINAL SOURCE** (não é workflow commit, não é HEAD de branch).

## GITHUB RELEASE (FASE 4)
`v1.0.247` — published=SIM (2026-08-22T01:31:12Z) · draft=NÃO · prerelease=NÃO · **Latest=SIM** (`releases/latest` → v1.0.247). v1.0.246 permanece publicada (histórica, não-Latest); v1.0.245/244 preservadas.

## ASSETS PUBLICADOS (FASE 5 — 6/6, bytes exatos)
`Agenda-ID-Seven-Desktop-1.0.247-x64.exe` (82 493 537 B) · `…exe.blockmap` (86 466 B) · `…x64.msi` (92 565 504 B) · `latest.yml` (376 B) · `SHA256SUMS` (404 B) · `VERSAO-DESKTOP.txt` (8 B). O trio vital do auto-update (exe+blockmap+latest.yml) presente. Assets automáticos do GitHub (source zip/tar) coexistem como em toda release.

## POST-PUBLISH HASH VERIFICATION (FASE 6) · PUBLIC LATEST.YML CONTRACT (FASE 7)
**Run VERIFY `32543702368` (windows-latest, 15/15 SUCCESS).** Os 6 assets foram RE-BAIXADOS da release pública `v1.0.247` e os SHA-256 recalculados: **6/6 byte-idênticos aos pins canônicos** (exe `9ed5eee9…` · msi `ebae0188…` · blockmap `3bea99fe…` · latest.yml `701911b3…` · SHA256SUMS `55815fe2…` · VERSAO-DESKTOP.txt `404ac013…`) + `sha256sum -c SHA256SUMS` OK. **latest.yml público** (a fonte real do updater): `version: 1.0.247`; `url` = exe publicado; **sha512 recalculado do exe público == latest.yml**; `size` == bytes; `releaseDate` ISO válida — o feed resolve exatamente para os bytes publicados.

## PRODUCTION UPDATE DISCOVERY (FASE 8) · CANARY (FASE 9) · POST-UPDATE (FASE 10) · SAME-VERSION (FASE 11)
No mesmo run VERIFY, ambiente QA isolado com a **PUBLIC v1.0.246** instalada e `app-update.yml` **INTOCADO** (provider **github de PRODUÇÃO**, confirmado por gate):
- **FASE 8 (HARD GATE):** `checkForUpdates` real → **`update_available` 1.0.247** — o app 1.0.246 dos usuários ENXERGA a release publicada.
- **FASE 9:** download REAL do provider de produção → `downloaded` (sha512 do latest.yml público validado pela lib) → "Instalar e reiniciar" (IPC) → updater ANTIGO lançou o installer publicado com `--updated --force-run` (SEM `/S`) → **one-click instalou SOZINHO**: asar instalado == **asar canônico publicado** (`1d21ad94…`, hash exato) → app relançou sozinho. Monitor: 38 amostras · SETUP_WINDOW_SAMPLES=10 (só progresso: `Agenda ID Seven Desktop Setup` + `Preparando o instalador...`; `setupAtEnd=0` — sumiu sozinha) · **UAC=0 · SMARTSCREEN=0 · REQUIRED_USER_INSTALL_ACTIONS=0**. Self-grep 0/0/0 (sem input sintético; sem exec direto; sem msiexec).
- **FASE 10:** `VERSION BEFORE=1.0.246 → AFTER=1.0.247` (título `ID Seven · Desktop 1.0.247 (Fluxo)`); login presente; **RC-D02 recovery=0**; **userData preservado**; **Light UI OFF por default**; controlled ON PASS; kill switch PASS; reopen PASS (sessão pós-update é boot limpo).
- **FASE 11:** novo `checkForUpdates` contra a produção → **`up_to_date`** — a 1.0.247 não é oferecida de novo.
Evidências: artifact `verify-1.0.247-release-evidence` (id 9467859420, retention 30d).

## WORKFLOW RELOCK (FASE 12)
O destravamento temporário do Gate 0 (input `owner_go`, usado porque a sessão não tem API para criar repository variables) foi **REMOVIDO** após a publicação e os gates pós-publicação (commits `e81517c9` rc / `f02bdedc` main): o Gate 0 volta a exigir exclusivamente `RC_RELEASE_GO=authorized-by-owner` (variável inexistente) — **RELEASE WORKFLOW = FAIL-CLOSED novamente**. Proteção dupla: a tag `v1.0.247` agora existe, e a etapa de publicação aborta por construção diante de tag pré-existente.

## SECURITY (FASE 13)
Logs dos runs de release e verify varridos: zero GitHub token (GH_TOKEN mascarado `***`; token do Release Bot temporário e **revogado no post-step** — "Token revoked" no log), zero senha/private key/segredo de certificado/credencial pessoal; o canary não usa credencial de login (superfície de login apenas verificada como presente).

## FINAL STATUS (FASE 14)
**AGENDA ID SEVEN 1.0.247 = RELEASED**
- **TAG = `v1.0.247`** → `cd92ec1fb723146ead1bd3031898be77a577b135`
- **LATEST = 1.0.247** (stable; v1.0.246/245/244 preservadas)
- **PRODUCT SOURCE = `cd92ec1fb723146ead1bd3031898be77a577b135`**
- **RELEASE WORKFLOW RUN = `32543641929`** · build canônico `32542723701` · verify `32543702368`
- **AUTO-UPDATE 1.0.246 → 1.0.247 = PASS** (produção real) · **REQUIRED_USER_INSTALL_ACTIONS = 0**
- Light UI permanece **OFF por default** na 1.0.247 (opt-in interno `luiPreview`); updates futuros a partir da 1.0.247 são 100% silenciosos (`/S`).
