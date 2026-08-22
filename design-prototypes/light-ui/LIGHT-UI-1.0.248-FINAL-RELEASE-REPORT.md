# AGENDA ID SEVEN — 1.0.248 · FINAL RELEASE REPORT (PUBLIC LIGHT UI ROLLOUT)

**AGENDA ID SEVEN 1.0.248 = RELEASED** · **TAG = `v1.0.248`** → **`3639144f0ce5cccecbc0b88125f9588c985809f3`** (FINAL SOURCE exato) · **LATEST = 1.0.248** (stable; prerelease=false; draft=false; published 2026-08-22T02:26:16Z) · publicada pelo workflow gated **run `32546209896`** com o GO explícito do owner (mandato FINAL RELEASE 1.0.248, 2026-08-22). **LIGHT UI PUBLIC DEFAULT = ON** em desktop elegível — provado em produção real.

## PRE-PUBLISH HARD GATE (FASE 0 — 20/20 PASS)
FINAL SOURCE `3639144f` íntegro (version 1.0.248 + marcador `1.0.248-i6a-light-ui-default-on`; renderer `ed7a4ad2…`; contrato I6A presente; contrato antigo AUSENTE — `luiPreview` não governa; `luiPublicOff` default ausente; fix `/S` + `oneClick: true`); tag v1.0.248 inexistente; Latest anterior v1.0.247; `v1.0.247` → `cd92ec1f` intocada; build canônico `32545607334` SUCCESS; release workflow pinado nesse source/run; 6/6 hashes do manifest == pins; contrato latest.yml + `sha256sum -c` provados por hard gates do próprio run canônico.

## RELEASE WORKFLOW (FASES 1–3)
Gate 0 destravado pelo mecanismo institucional da 1.0.247 (input `owner_go` citando o GO literal; mudança SÓ no gate; commits `39797333` rc / `73b0cfcd` main). Dispatch com os valores exatos do mandato (`build_run_id=32545607334` + `RELEASE-1.0.248-FINAL-AUTORIZADO`). **Run `32546209896` = SUCCESS na 1ª tentativa (10/10 steps)**: Gates 0–3 → Release Bot ativo/escopo só-Agenda (contents+workflows write, padrão f42f) → bundle do run pinado → **verificação criptográfica total** (6 SHA-256 == pins; latest.yml do MESMO build: version/sha512/size; `sha256sum -c` OK) → tag via API → `gh release create --latest` → pós-verificação (flags `false|false`; 6 assets; tag==FINAL SOURCE; Latest==v1.0.248; históricas v1.0.247/246/245 preservadas). Gates e pins **nunca** editados; nenhum release manual; nenhum "latest run".

## TAG (FASE 4 — verificação independente via API pública)
`refs/tags/v1.0.248` → `3639144f0ce5cccecbc0b88125f9588c985809f3` — **exatamente o FINAL SOURCE**.

## GITHUB RELEASE (FASE 5)
`v1.0.248` — published=SIM (2026-08-22T02:26:16Z) · draft=NÃO · prerelease=NÃO · **Latest=SIM** (`releases/latest` → v1.0.248). **v1.0.247 permanece publicada** (histórica, não-Latest, 6 assets, tag → `cd92ec1f`); v1.0.246/245 preservadas.

## ASSETS PÚBLICOS (FASE 6 — 6/6, nomes literais do build, bytes exatos)
`Agenda-ID-Seven-Desktop-1.0.248-x64.exe` (82 495 283 B) · `…exe.blockmap` (86 473 B) · `…x64.msi` (92 565 504 B) · `latest.yml` (376 B) · `SHA256SUMS` (404 B) · `VERSAO-DESKTOP.txt` (8 B).

## PUBLIC HASH VERIFICATION (FASE 7) · PUBLIC LATEST.YML (FASE 8)
**Run VERIFY `32546360558` (windows-latest, 13/13 SUCCESS).** Os 6 assets foram RE-BAIXADOS da release pública e os SHA-256 recalculados: **6/6 byte-idênticos aos pins canônicos** (exe `be5f9b0c…` · msi `b5a8b916…` · blockmap `af08c467…` · latest.yml `7565b514…` · SHA256SUMS `8ef75e0c…` · VERSAO-DESKTOP.txt `fcda9371…`) + `sha256sum -c SHA256SUMS` OK. **latest.yml público** (fonte real do updater): `version: 1.0.248`; url = exe publicado; **sha512 recalculado do exe público == latest.yml**; `size: 82495283` == bytes; `releaseDate` ISO válida. Verificação independente adicional feita da própria sessão (mesmo canal público dos usuários): latest.yml/SHA256SUMS/VERSAO-DESKTOP.txt == pins.

## PRODUCTION CANARY (FASES 9–18, mesmo run VERIFY — provider GitHub REAL, app-update.yml INTOCADO)
Ambiente QA isolado com a **PUBLIC v1.0.247** instalada (exe == pin `9ed5eee9…`), gate `provider: github` de produção:
- **FASE 9 (discovery):** `checkForUpdates` real → **`update_available` 1.0.248** (size 82 495 283) — o app 1.0.247 dos usuários ENXERGA a release publicada.
- **Antes do update:** `a3_desktopEligible=true` · **`a4_luiOffBefore=true`** (na 1.0.247 a Light está OFF — a mudança visível vem DO update) · perfil semeado com **`luiPreview:false` stale** + histórico de notificações.
- **FASE 10 (canary):** download REAL do provider (sha512 do latest.yml público validado pela lib) → `downloaded` → "Instalar e reiniciar" (IPC interno; única ação do contrato) → **instalação `/S`**: monitor 33 amostras · **setup=0 · UAC=0 · SmartScreen=0** · cmdline com `--updated /S` · **asar instalado == asar canônico publicado `299ea1d2…` (hash exato)** · app relançou sozinho. Self-grep 0/0/0. **REQUIRED_USER_INSTALL_ACTIONS = 0**.
- **FASE 11 (HARD GATE CENTRAL):** boot público 1.0.248 (`ID Seven · Desktop 1.0.248 (Fluxo)`): **`p5_LIGHT_UI_DEFAULT_ON = true`** (body.desktop + body.light-ui, sem appearSet, sem localStorage manual).
- **FASE 12:** **`p6_STALE_PREVIEW_FALSE_DOES_NOT_OPTOUT = true`** — storage ainda contém `luiPreview:false` E a Light está ON; `p7` `luiPublicOff` ausente por default.
- **FASE 13 (clean profile):** `localStorage.clear()` + reload → **`{lui:true, desktop:true, appear:null}` já no DOMContentLoaded** — ON nasce do DEFAULT (sem storage), first paint sem flash legacy; estável após 2,5s.
- **FASE 14 (sanity):** F1–F13 + hard debts provados sobre o renderer **byte-idêntico** ao publicado (asar hash exato `299ea1d2…`; driver local 29/29 + QA CI); na superfície pública pré-auth: login presente, **RC-D02 recovery=0**.
- **FASE 15 (userData):** tema + histórico de notificações preservados após o update (`p4` e `c2`).
- **FASE 16 (emergency):** `appearSet({luiPublicOff:true})` → **legado integral** (`e1`) → revertido → **Light volta a ser o default** (`e2`); `luiPreview` inerte (`e3`); nenhuma UI híbrida. Teste técnico em QA — nenhum usuário de produção configurado.
- **FASE 17:** reload ON (`f1`) · **reopen** (nova instância) ON com userData (`c1/c2`).
- **FASE 18:** novo `checkForUpdates` contra a produção → **`up_to_date`** — a 1.0.248 não é oferecida de novo.
Evidências: artifact `verify-1.0.248-release-evidence` (id 9468673447, retention 30d; inclui CANARY-248-LIGHT-ON.png e CANARY-248-CLEAN-PROFILE.png).

## WORKFLOW RELOCK (FASE 19)
O destravamento temporário do Gate 0 foi **REMOVIDO** após a publicação e os gates pós-publicação (commits `865ee654` rc / `7b134194` main): o Gate 0 volta a exigir exclusivamente `RC_RELEASE_GO=authorized-by-owner` (variável inexistente) — **RELEASE WORKFLOW = FAIL-CLOSED**. Proteção dupla: a tag `v1.0.248` existe, e a etapa de publicação aborta por construção diante de tag pré-existente.

## SECURITY (FASE 20)
Logs dos runs de release/build/verify varridos: zero token (BOT_TOKEN/GH_TOKEN sempre `***`; **"Token revoked"** no post-step do Release Bot), zero senha/private key/credencial (matches inspecionados: apenas config padrão do checkout, seletor CSS do harness e strings do gate RC-D02); o canary não usa credencial de login.

## FINAL STATUS
**AGENDA ID SEVEN 1.0.248 = RELEASED**
- **TAG = `v1.0.248`** → `3639144f0ce5cccecbc0b88125f9588c985809f3`
- **LATEST = 1.0.248** (stable; v1.0.247/246/245 preservadas)
- **RELEASE WORKFLOW RUN = `32546209896`** · build canônico `32545607334` · verify/canary `32546360558` · QA do rollout `32545309146`
- **PUBLIC AUTO-UPDATE 1.0.247 → 1.0.248 = PASS** (provider real) · **REQUIRED_USER_INSTALL_ACTIONS = 0**
- **LIGHT_UI_DEFAULT_ON = true** · **STALE_PREVIEW_FALSE_DOES_NOT_OPTOUT = true** · emergency `luiPublicOff` reversível provado
- Cadeia dos usuários: 1.0.247 → 1.0.248 silencioso (`/S`); 1.0.246 → ponte one-click 246→247 → 247→248 silencioso.
