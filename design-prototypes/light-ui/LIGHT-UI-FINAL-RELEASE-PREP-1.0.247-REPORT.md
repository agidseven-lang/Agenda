# AGENDA ID SEVEN — FINAL RELEASE PREPARATION · 1.0.247

**PARENT FUNCTIONAL CANDIDATE = `c75ccd20`** (dcc019ca + fix updater `b4ea7890` + `nsis.oneClick`; prova zero-touch run `32487165389`) → **FINAL SOURCE CANDIDATE = `cd92ec1f`** (`release: prepare Agenda ID Seven 1.0.247`). **Nada publicado: TAG NÃO · GITHUB RELEASE NÃO · LATEST NÃO · DEPLOY NÃO · DISTRIBUIÇÃO NÃO.** Release workflow INERTE.

## FASE 0 — PREFLIGHT (PASS)
Partida exata de `c75ccd20`: worktree limpa; renderer congelado `bd5001b1…`; `quitAndInstall(true, true)` presente; `oneClick: true` presente; diff de produto vs `dcc019ca` = exatamente `updaterService.ts` + `electron-builder.yml` (zero incidental); nenhuma release/tag nova no repositório (Latest ainda `v1.0.246` de 2026-08-11; `v1.0.247` inexistente).

## FASE 1/2 — VERSION BUMP DEFINITIVO + DIFF GATE (PASS)
Diff completo do bump (nada além):
- `desktop/package.json`: `version` 1.0.246→**1.0.247** + `description` — **marcador mecânico da linhagem** `1.0.247-i5c5-unattended-update-bridge` no padrão literal da casa (corpo curto descrevendo o release; marcador `1.0.246-f356bh2-workflow-notifications-premium` movido para `=== MARCADORES HERDADOS ===`; sem texto editorial desnecessário). Reauditoria: os gates históricos da casa validam `version + regex do marcador` (`Gate VERSAO X (package + lock x2 + description)`) — o gate correspondente da linhagem foi implementado no workflow final.
- `desktop/package-lock.json`: 2 ocorrências do pacote raiz 1.0.246→1.0.247.
Renderer/F1–F13/auth/Firestore/routing/reports/notifications/updater/oneClick/Light UI: **0 alterações** (incidental de EOF-newline detectado e eliminado antes do commit).

## FASE 3 — FINAL SOURCE CHECKPOINT (PASS)
Commit canônico **`cd92ec1fb723146ead1bd3031898be77a577b135`** — único source permitido para o build final. Hashes de proveniência: renderer `bd5001b1ec249ecc56bc1a8b71a11be05d468dc990695c6f80ef80af00aef32f` (inalterado) · lockfile **`39a329a90c8010dc9ede6d95f36d754c1ae550bae33c5dc1d3bc2e29c9b9e059`** (novo, pós-bump).

## FASE 4/5 — FINAL BUILD WORKFLOW + BUILD ÚNICO
Workflow novo **`desktop-build-1.0.247-final.yml`** (windows-latest): checkout EXPLÍCITO de `cd92ec1f` (`git rev-parse HEAD` verificado — nunca HEAD implícito); hard gates: version==1.0.247 + marcador de description (fonte E asar), renderer SHA esperado (objeto git + empacotado byte-idêntico), lockfile SHA, `quitAndInstall(true, true)` presente / `(false` ausente no asar, `oneClick: true`, RC-D02=0, flags do updater, diff-gates vs `c75ccd20` (só o bump) e vs `dcc019ca` (só os 4 arquivos da linhagem); `npm ci` + `npm run build` + `electron-builder --win nsis msi` — **NSIS x64 + exe.blockmap + latest.yml + MSI x64 + SHA256SUMS + VERSAO-DESKTOP.txt, todos DO MESMO BUILD**; immutability pós-build (`git status --porcelain` do source limpo). No MESMO run: a prova essencial da ponte (FASE 11) com os assets FINAIS.

## FASE 6 — ARTIFACT MANIFEST · RUN FINAL CANÔNICO **`32542723701`** (20/20 SUCCESS, 2026-08-22T01:12→01:16Z)
`PRODUCT_SOURCE_SHA: cd92ec1f…` · `VERSION: 1.0.247` · `RENDERER_SHA256: bd5001b1…` · `LOCKFILE_SHA256: 39a329a9…` · signing: **unsigned-by-design** · arch x64:

| Asset | Bytes | SHA-256 | Target |
|---|---|---|---|
| `Agenda-ID-Seven-Desktop-1.0.247-x64.exe` | 82 493 537 | `9ed5eee9042f04d4e1533a1558ad48c49ed4be33933d9f7d10d69ffa6bf09a50` | nsis (one-click) |
| `Agenda-ID-Seven-Desktop-1.0.247-x64.msi` | 92 565 504 | `ebae01888be4433fd649f4c2f68e1853ff5cdde3d267312834875ef1e8566909` | msi |
| `…exe.blockmap` | 86 466 | `3bea99feff7276b13e045c5b240ef0a2fec9abcc8ee7b7e0bef296b7382cd994` | blockmap |
| `latest.yml` | 376 | `701911b3a7b608bf4835a8d4988a8f3d7f2000ad79f0050d3d4a03a1a4350987` | update-feed |
| `SHA256SUMS` | 404 | `55815fe26ce6069a8f1095ae20f384b42e48a1e61c303ee5c1a06ffc5ad7b4dd` | meta |
| `VERSAO-DESKTOP.txt` | 8 | `404ac013f1e59ec07098b5a35b7e2f9c695fb70c8e784d0585a9c8fca3a2bd4f` | meta |

app.asar FINAL: `1d21ad948c784337c4ce325c53d550fba861582da09b7b0bcc15d96c07c0ba4c`. Bundle: artifact `agenda-id-seven-desktop-1.0.247-final-bundle` (id 9467586681, 174 248 724 B, retention 30d) + evidence (id 9467586938). Artifacts privados — não são publicação.

## FASE 7 — UPDATER CONTRACT (gates no run)
`latest.yml` final validado no próprio run: `version: 1.0.247`; `url` referencia o exe DESTE build; **sha512 recalculado do exe == latest.yml**; **size == bytes do exe**. Qualquer mistura de builds = FAIL (gate).

## FASE 8/9/10 — RELEASE WORKFLOW RC-U03 (pins) + IDENTIDADE + FAIL-CLOSED
`desktop-release-1.0.246-rc.yml` foi **sucedido** por **`desktop-release-1.0.247-final.yml`** (git mv; padrão de pares por fase da casa). Pins fixados: `PRODUCT_SOURCE_SHA=cd92ec1f`, `EXPECTED_VERSION=1.0.247`, renderer + lockfile SHAs, `BUNDLE_ARTIFACT_NAME=agenda-id-seven-desktop-1.0.247-final-bundle`, e os **pins do RUN FINAL CANÔNICO** (`EXPECTED_BUILD_RUN_ID` + SHA-256 de exe/msi/blockmap/latest.yml/SHA256SUMS/VERSAO-DESKTOP.txt) — completados com os valores do run verde (2º commit de CI). Nenhum "latest run", nenhum hash dinâmico: o input `build_run_id` é validado contra o run pinado. Identidade: **tag `v1.0.247`** (preparada, NÃO criada; `v1.0.246` jamais reutilizada — gate de tag-inexistente), release **stable/Latest, NÃO prerelease** (channel latest + allowPrerelease=false dos usuários). Fail-closed em camadas: Gate 0 (`RC_RELEASE_GO` inexistente) → Gate 1 (frase `RELEASE-1.0.247-FINAL-AUTORIZADO`) → Gate 2 (proveniência) → Gate 3 (pins + run id) → verificação criptográfica total (sha256 dos 6 assets + sha512/size do contrato + `sha256sum -c SHA256SUMS`) antes de tag+release. **Sem a autorização do owner, o publication step não executa.**

## FASE 11 — FINAL AUTO-UPDATE SANITY (no MESMO run do build)
Bridge essencial com os **assets do build final** (nunca um QA diferente): PUBLIC v1.0.246 (release real, SHA256SUMS conferido; updater ANTIGO) → `update_available` 1.0.247 → download (sha512 do latest.yml validado pela lib) → `downloaded` → "Instalar e reiniciar" (IPC real) → installer FINAL lançado SEM `/S` pelo updater antigo → one-click instala SOZINHO → `REQUIRED_USER_INSTALL_ACTIONS=0` (monitor: SETUP/UAC/SmartScreen; self-grep) → `version_after=1.0.247` → **asar instalado == asar do build FINAL (SHA-256)** → userData preservado → Light UI OFF.
**RESULTADO (run 32542723701): PASS integral.** Sessão A 4/4 `fails: []` (baseline pública 1.0.246; `update_available` 1.0.247; `downloaded` com sha512 validado; install disparado). PONTE: installer FINAL lançado pelo updater ANTIGO com `--updated --force-run` (SEM `/S`, pid 9060) → uninstall interno `/S /KEEP_APP_DATA /currentuser` → **asar instalado == asar FINAL `1d21ad94…` (hash exato), zero input** → app relançado sozinho (`--updated`). Monitor: 36 amostras · `SETUP_WINDOW_SAMPLES=9` (só progresso informativo: `Agenda ID Seven Desktop Setup` + `Preparando o instalador...`) · `setupAtEnd=0` (sumiu sozinha) · `UAC=0` · `SMARTSCREEN=0` · **`REQUIRED_USER_INSTALL_ACTIONS=0`**. Self-grep 0/0/0. Sessão B 7/7 `fails: []`: título `ID Seven · Desktop 1.0.247 (Fluxo)`, login real, RC-D02=0, userData preservado, Light OFF, ON controlado, kill.

## FASE 12 — FUTURE UPDATE CONTRACT (PASS)
Confirmado no FINAL SOURCE (gates no PIN + asar): `quitAndInstall(true, true)` + `oneClick: true`. A prova I5C.5 (run `32487165389`) permanece válida: updates futuros a partir do 1.0.247 rodam com `/S`, zero interação (247→248 provado com o mesmo par de mudanças de produto).

## FASE 13 — SECURITY (sweep)
Workflows/logs/manifests/artifacts/screenshots varridos: **zero** password/token/private key/certificate password/credencial pessoal. GITHUB_TOKEN nunca ecoado; logs do updater redigidos por design; artifacts privados; assinatura: unsigned-by-design (regime de produção vigente; integridade = sha512 do latest.yml + SHA-256 pinados).

## FASE 14 — SOURCE IMMUTABILITY (gate no run)
`git status --porcelain` do source limpo pós-build (gate fail-closed no workflow); renderer byte-idêntico ao congelado (3 verificações no run). Nenhum build script altera source.

## POSTO DE CONTROLE (FASE 16)
**TAG = NÃO · GITHUB RELEASE = NÃO · LATEST PUBLICATION = NÃO · DEPLOY = NÃO · DISTRIBUTION = NÃO** · FINAL SOURCE PREPARED = **SIM** (`cd92ec1f`) · FINAL BUILD GENERATED = **SIM** (run canônico `32542723701`) · RELEASE WORKFLOW PREPARED = **SIM** (inerte, fail-closed).

## READINESS MATRIX (FASE 15 — tudo PASS)
Functional parent c75ccd20 ✓ · Version bump ✓ · Final source `cd92ec1f` ✓ · Renderer immutable `bd5001b1…` ✓ · Lockfile `39a329a9…` ✓ · Updater silent (`quitAndInstall(true,true)`) ✓ · oneClick ✓ · npm ci ✓ · Build ✓ · NSIS ✓ · MSI ✓ · latest.yml ✓ · blockmap ✓ · SHA256SUMS ✓ · Artifact hashes (manifest) ✓ · Provenance ✓ · Public 246 → Final 247 ✓ · Zero user install actions ✓ · UserData ✓ · Light UI default OFF ✓ · RC-D02 ✓ · F13 B2 (renderer identity) ✓ · Release workflow pins (run 32542723701) ✓ · Release workflow inert ✓ · Tag identity (v1.0.247 preparada, não criada) ✓ · Security ✓.

## VEREDITO
**FINAL RELEASE PREPARATION = GO.** FINAL SOURCE `cd92ec1f` preparado; build final canônico gerado e provado (run `32542723701`: manifest completo, contrato do updater verificado, ponte PUBLIC 246→FINAL 247 com zero ação humana, userData preservado, Light UI OFF); release workflow `desktop-release-1.0.247-final.yml` totalmente pinado no run canônico e **INERTE** (Gate 0 do owner + frase + proveniência + pins + tag-inexistente + verificação criptográfica total). **O build final 1.0.247 está pronto para o owner autorizar a publicação da Release Latest: SIM** — a publicação em si permanece bloqueada até o GO explícito (criar `RC_RELEASE_GO=authorized-by-owner` e disparar com a frase + run id pinado). Nota operacional (30 dias): o bundle do run canônico expira em ~2026-09-21; se o GO vier depois, re-rodar o build final e re-pinar.
