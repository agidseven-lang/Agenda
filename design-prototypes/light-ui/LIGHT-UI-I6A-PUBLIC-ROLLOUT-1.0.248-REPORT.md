# LIGHT UI — I6A · PUBLIC ROLLOUT 1.0.248 (DEFAULT ON) — RELATÓRIO DE ACEITAÇÃO

**I6A = ENTREGUE — AGUARDA DECISÃO DO OWNER.** A Light UI passa a ser o **padrão** do Agenda ID Seven Desktop em desktop elegível a partir da **1.0.248**, nascida de **cd92ec1f (1.0.247 RELEASED)**, chegando por **auto-update silencioso** — **sem qualquer ativação manual** (sem DevTools, sem localStorage, sem `luiPreview`, sem flag, sem reinstalação). **NADA foi publicado**: sem tag `v1.0.248`, sem release, sem Latest, release workflow INERTE (fail-closed).

- **ROLLOUT SOURCE CANDIDATE** = `eefa0259493e2342b05fbaa54fd2ba1a8d3bb8a4` (`feat(ui): enable Light UI by default`)
- **FINAL SOURCE 1.0.248** = `3639144f0ce5cccecbc0b88125f9588c985809f3` (`release: prepare Agenda ID Seven 1.0.248`; bump mecânico 4+/4−)
- **PRODUCTION BASE** = `cd92ec1fb723146ead1bd3031898be77a577b135` (tag `v1.0.247`, Latest, IMUTÁVEL)
- **Diff de produto vs 1.0.247 publicada** = **SOMENTE `desktop/src/renderer/index.html`** (+ bump package.json/lock no FINAL SOURCE)
- **QA CI do rollout (PUBLIC 1.0.247 → QA 1.0.248)** = run **`32545309146`** (windows-latest, SUCCESS, 1ª tentativa)
- **Build final canônico** = run **`32545607334`** (windows-latest) — ver seção FASE 23

## FASE 0 — PREFLIGHT (PASS)
Worktree limpa; linhagem `cd92ec1f` presente e version 1.0.247 + marcador `1.0.247-i5c5-unattended-update-bridge`; renderer da 1.0.247 = `bd5001b1…`; fix do updater (`quitAndInstall(true, true)`) + `nsis.oneClick: true` herdados; release pública `v1.0.247` = Latest com 6 assets pinados.

## FASE 1 — ACTIVATION MAP (código literal, sem suposição)
- `APPEAR_KEY='idseven.desktop.appearance'`; `appearLoad`/`appearSave`/`applyAppearance`/`appearSet` (linhas ~11919–11922) — único write path é `appearSave` (via `appearSet`); **whitelist de chaves no save** (chave fora da lista é descartada — por isso `luiPublicOff` precisou entrar no `appearSave`).
- Boot first-paint: `try{applyAppearance()}catch(_){}` **inline no parse** (linha ~11923) — a classe decide antes do primeiro frame; boot NÃO grava storage.
- Elegibilidade desktop: `DESKTOP_MQ` ≥1024px CSS via `applyDesktopClass()` no parse + listener de mudança da MQ (re-chama `applyAppearance`). `IS_ELECTRON_APP=!!window.api` é **false** no app real (preload expõe `desktopAPI`) → o guard efetivo é `body.desktop` (o app real desktop sempre satisfaz a MQ em janela elegível).
- Contrato ANTIGO (1.0.246/1.0.247): `toggle('light-ui', a.luiPreview===true && body.desktop)` — preview interno OFF por default.

## FASES 2–6 — NOVO CONTRATO (mudança cirúrgica; APENAS o bloco appearance do renderer)
```js
function applyAppearance(){ … toggle('light-ui', a.luiPublicOff!==true && document.body.classList.contains('desktop')) … }
```
- **DEFAULT ON** em desktop elegível: a classe liga **sem nenhum campo gravado** (default ausente → ON).
- **`luiPreview` deixa de governar** (lido/gravado apenas como legado inerte — nenhuma migração de dados necessária; nenhum perfil antigo vira opt-out).
- **Emergency kill switch tecnicamente SEPARADO**: campo **NOVO** `luiPublicOff` (nenhum usuário antigo o possui; default ausente). Desliga só via mecanismo técnico `appearSet({luiPublicOff:true})`; **reversível** com `false`/remoção. Voltar ao legado = UI legada INTEGRAL (dark), não um estado híbrido.
- First paint sem flash: mesma via inline de boot; nenhum caminho novo de write no boot.

## FASE 7 — MIGRAÇÃO DE FLAGS (perfis A–E, harness local com boot real; 5/5 `fails: []`)
| Perfil | storage semeado | Resultado 1.0.248 |
|---|---|---|
| A clean (novo) | vazio | **ON** |
| B `luiPreview:true` (preview interno) | appearance com true | **ON** (contínuo) |
| C `luiPreview:false` **stale** (adversarial) | appearance com false | **ON** (stale NÃO vira opt-out) |
| D legado sem flag | appearance antigo sem campo | **ON** |
| E storage corrompido | JSON inválido | **ON** (fallback seguro do parse) |
Em todos: `luiPublicOff` **ausente** por default (gate `emergencyKeyAbsentByDefault`); tema/fonte/HC preservados.

## FASES 8 + 11–17 — PROVAS LOCAIS GLOBAIS (driver `i6a_driver.js`, chromium sobre o renderer com boot real até `authed`)
**Modo full: 29/29 gates PASS** — default ON; first paint (classe no frame 1 via rAF e no DCL); zero write de appearance no boot; **F1–F13 navegando o app real** (tabs `hoje/tarefas/prioridades/agenda/notificacoes/exec/relatorios/equipe`, F6 `openClientView`, F13 `openProductionModal` com `.pr-sheet` + `.pr-drop` focável + input file) todas com `light-ui` ON e **zero overflow de página**; hard gates funcionais re-provados no novo default: **F9-D01**, **copy verdadeira** (Detalhes → `[data-detcopytheme]` → clipboard `'Post 1'`), **F11** thead **7 headers** + **exports honestos** (CSV/JSON reais interceptados em `execDownload`, conteúdo com `geradoEm`), **F10** KPI branco `rgb(255,255,255)`, **F12 recovery=0** + input password, **F13 upload keyboard/B2**; **legacy leakage zero** (fundo claro `rgb(253,254,254)` vs radial navy do legado — nunca híbrido); **emergency** off→legacy integral→persist→restore ON; `appearSet({luiPreview:false})` **inerte**; logout→login ON; reload persiste; par MQ 900↔1920 liga/desliga junto com `desktop`; reopen ON.
**Responsivo:** `resp-1366` PASS e `resp-win125` (~1093×614 CSS @ DPR 1.25) PASS — guardrails `min-width:0`, sem overflow de página, kanban com x-scroll próprio.
**Screenshots I6A (14)**: F1/F6/F8/F9/F10/F11/F12/F13 @1920 · F1/F13 @1366 · F1/F10/F11/F13 @Win125 — **entregues no chat** (política da trilha: nunca versionadas).

## FASE 20 — CHECKPOINT
`eefa0259` `feat(ui): enable Light UI by default` (PRODUCTION BASE registrada no corpo; diff de produto = só o renderer). Workflow QA versionado em `eb614927`.

## FASES 9–10 + 21 — QA CI REAL DO UPGRADE (windows-latest; run `32545309146`, SUCCESS)
`desktop-test-1.0.248-rollout.yml` — o caminho EXATO dos usuários:
1. **PIN + provenance**: candidato `eefa0259` por hash; descende de `cd92ec1f`; renderer `ed7a4ad2…`; diff de produto = só renderer; contrato I6A presente; contrato antigo AUSENTE; fix `/S` + oneClick preservados.
2. **BASELINE DE PRODUÇÃO**: `Agenda-ID-Seven-Desktop-1.0.247-x64.exe` baixado da release pública `v1.0.247` e verificado contra **SHA256SUMS da release E o pin canônico** `9ed5eee9…` → instalado (setup de QA `/S`; o UPDATE em si nunca é manual).
3. **BUILD QA EFÊMERO 1.0.248** do candidato (bump só no workspace) + **GATE ASAR I6A**: version 1.0.248; renderer empacotado byte-idêntico à fonte; contrato I6A + first-paint inline no asar; RC-D02=0; flags do updater; fix presente; chamada assistida ausente.
4. **SESSÃO A (PUBLIC 1.0.247 real)**: `a1` versão/título 1.0.247 · `a2` updater API · `a3` desktop elegível (1280×800) · **`a4` Light UI OFF antes do update** (a mudança visível vem DO update) · seed de userData do usuário real (tema dark + histórico de notificações + **`luiPreview:false` stale** — perfil adversarial C) · `b1` `update_available` **1.0.248** · `b2` `downloaded` (sha512 do feed validado pela lib) · `c1` install disparado pela **única ação do contrato** (clique interno "Instalar e reiniciar", via IPC real).
5. **TRANSIÇÃO SILENCIOSA 247→248**: asar instalado == asar QA por SHA-256; monitor armado ANTES: **setupWindowSamples=0 · UAC=0 · SmartScreen=0**; cmdline do installer com `--updated` **e `/S`**; app **relançou sozinho**; **REQUIRED_USER_INSTALL_ACTIONS=0**; `app-update.yml` re-apontado após o install (o installer recria para github).
6. **Self-grep** V1/V2/V3 = 0/0/0 (sem input sintético; sem msiexec; sem exec direto do installer 248).
7. **SESSÃO B (1.0.248) — 12/12**: `d1` versão+título `ID Seven · Desktop 1.0.248 (Fluxo)` · `d2` **userData preservado** (tema + seed) · **`d3` LIGHT_UI_DEFAULT_ON=true (HARD GATE PRINCIPAL: desktop+light-ui no boot, sem nenhuma ação)** · `d4` **stale não vira opt-out** (storage ainda com `luiPreview:false` E Light ON) · `d5` `luiPublicOff` **ausente** por default · `d0` login presente + **RC-D02 recovery=0** · `e1/e2` emergency off→**legacy integral**→restore ON · `e3` `luiPreview` inerte · `f1` **reload abre ON** · `f2` same-version → **`up_to_date`** (sem loop).
Evidência honesta do guard: no boot cru a janela default do app tem ~1008px CSS → modo compacto (sem `desktop`, sem Light) — em janela elegível (≥1024, ex. 1280×800) a Light liga sozinha. É exatamente o contrato "desktop elegível" aprovado (mesma MQ do legado).
Artifact: `rollout-1.0.248-evidence` (id 9468342312).

## FASE 19 — BUMP DEFINITIVO
`3639144f` `release: prepare Agenda ID Seven 1.0.248` — version + marcador `1.0.248-i6a-light-ui-default-on` (herda todos os marcadores) + lock ×2; **nenhuma mudança funcional**; diff vs `eefa0259` = exatamente package.json + package-lock.json.

## FASE 23 — FINAL RELEASE PREPARATION (padrão criptográfico da 1.0.247; NADA publicado)
- **Build final canônico**: `desktop-build-1.0.248-final.yml` — run **`32545607334`** (windows-latest, SUCCESS): pin do FINAL SOURCE `3639144f` + provenance (renderer `ed7a4ad2…`, lockfile `047711f1…`, version+marcador, diff vs `eefa0259` = só bump, diff de produto vs `cd92ec1f` = renderer+bump, contrato I6A, fix+oneClick); baseline pública v1.0.247 (pin `9ed5eee9…`); **BUILD ÚNICO** NSIS x64 + MSI x64 + GATE ASAR + immutability; `SHA256SUMS` + `VERSAO-DESKTOP.txt` + **MANIFEST** + **contrato latest.yml** (version/url/sha512/size == NSIS do MESMO run); e **no MESMO run** a prova do rollout com os **assets FINAIS**: PUBLIC 1.0.247 → FINAL 1.0.248 `/S` (zero janela/UAC/SmartScreen; asar==FINAL; `LIGHT_UI_DEFAULT_ON=true`; userData; stale inerte; emergency; reload; same-version). Bundle privado `agenda-id-seven-desktop-1.0.248-final-bundle` (30d) + evidências.
- **ASSETS FINAIS (pins canônicos do run `32545607334`)**:
  - exe `be5f9b0cfeb7c6a1e3ad818309138a1b4dfc0c817676e523807975cf58a7a8b2` (82 495 283 B)
  - msi `b5a8b916c178b38392d12f52763d1037a66c7c27ca00d38b4bdc7dca97f144d0` (92 565 504 B)
  - blockmap `af08c467564578efbea2895ea5c44f7cfb8fde2d2bd22534a4e1b8822bb60a2b` (86 473 B)
  - latest.yml `7565b5145cc4468ddf7d159ed8c66fe5da78f46c8018fb7a43f2db77cb23eaa6` (376 B)
  - SHA256SUMS `8ef75e0c8d8455e752e86ff49bdb2325c53d1ba61d711d2cd21fd7678af9936c` · VERSAO-DESKTOP.txt `fcda9371214884ff37f92af6608cd15542a90e7a92e3f836f10224550fd3b5cb`
  - asar FINAL `299ea1d2e6cc7c6a398e90d72e51ebdeffc72f985e0b2faddd650ef31bec66c6`
  - Artifacts do run: bundle `agenda-id-seven-desktop-1.0.248-final-bundle` (id 9468450460) + evidence (id 9468450618), retention 30d; evidências de sessão no run: `d3_LIGHT_UI_DEFAULT_ON: true`, transição `setupWins=0 | smartscreen=0 | uac=0`, self-grep 0/0/0.
  - Workflows versionados: build `21416f9d` (rc) / espelho `fd3576fc` (main) · release inerte `0470b058` (rc) / espelho `0cfaab1b` (main).
- **Release workflow INERTE**: `desktop-release-1.0.248-final.yml` — mesmo padrão gated da 1.0.247: Gate 0 `vars.RC_RELEASE_GO=='authorized-by-owner'` (variável INEXISTENTE → fail-closed), Gate 1 frase `RELEASE-1.0.248-FINAL-AUTORIZADO`, Gate 2 proveniência, Gate 3 pins (`EXPECTED_BUILD_RUN_ID=32545607334` + 6 SHA-256), escritas via **Release Bot** (App da casa; `permission-contents+workflows: write`), publicação exige tag `v1.0.248` INEXISTENTE, verificação criptográfica total antes de tag+Release Latest, pós-verificação (flags/6 assets/tag==FINAL SOURCE/Latest/históricas v1.0.247/246/245 preservadas). **NUNCA EXECUTADO.**

## FASE 22 — ROLLOUT ACCEPTANCE MATRIX
| Item | Resultado | Evidência |
|---|---|---|
| UPGRADE 1.0.247→1.0.248 abre com Light UI SEM ação manual | **PASS** | run 32545309146 sessão B `d3` (+ run 32545607334 com assets finais) |
| REQUIRED_USER_INSTALL_ACTIONS | **0** | monitor + self-grep 0/0/0 (ambos os runs) |
| Update silencioso (`/S`; zero janela/UAC/SmartScreen) | **PASS** | transition JSON: setup=0, uac=0, sc=0, cmd `--updated /S` |
| userData preservado (tema/notificações) | **PASS** | sessão B `d2` |
| Migração de flags A–E → todas ON | **PASS** | driver local 5/5; perfil C (stale false) também no CI `d4` |
| `luiPreview` stale NÃO vira opt-out | **PASS** | CI `d4` (storage com false E Light ON) |
| Emergency `luiPublicOff` (novo; default ausente; reversível; legacy integral) | **PASS** | driver + CI `d5/e1/e2` |
| `luiPreview` inerte na 1.0.248 | **PASS** | driver + CI `e3` |
| First paint sem flash legacy | **PASS** | driver frame1/DCL; boot inline no asar (gate) |
| Perfil limpo (instalação nova) → ON | **PASS** | driver perfil A |
| F1–F13 sanity global na Light default | **PASS 29/29** | driver full (navegação real) |
| Hard gates funcionais (F9-D01/F10/F11 7+exports/F12 recovery=0/F13 upload) | **PASS** | driver full |
| Responsivo 1920 / 1366 / Win125 (~1093×614 DPR1.25) | **PASS** | driver resp-* + screenshots |
| Legacy leakage (estado híbrido) | **ZERO** | driver (fundos distintos; emergency = legado integral) |
| Logout/login/reload/reopen mantêm ON | **PASS** | driver + CI `f1` |
| Same-version loop | **NONE** (`up_to_date`) | CI `f2` |
| RC-D02 recovery no pacote | **0** | GATE ASAR + sessão B |
| 1.0.247 publicada intocada / nada publicado da 1.0.248 | **CONFIRMADO** | tag v1.0.247→cd92ec1f; sem tag v1.0.248; release workflow fail-closed |

## SEGURANÇA
Logs dos runs varridos: zero token (GH mascarado), zero senha/credencial; canary sem credencial de login; screenshots só no chat.

## CONSEQUÊNCIA PARA O USUÁRIO FINAL
Nada a fazer. Quem está na **1.0.247**: update silencioso → abre em **1.0.248 com Light UI**. Quem está na **1.0.246**: ponte one-click 246→247 (provada na release da 1.0.247) e depois 247→248 silencioso. Em janela <1024px CSS o app segue no modo compacto legado (mesmo guard de sempre); em desktop elegível a Light UI é o padrão. Rollback operacional: emergency `luiPublicOff` (técnico, reversível) sem tocar na release.
