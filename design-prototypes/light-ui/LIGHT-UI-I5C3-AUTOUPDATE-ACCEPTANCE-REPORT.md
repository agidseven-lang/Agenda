# LIGHT UI — I5C.3 · IN-APP AUTO-UPDATE ACCEPTANCE

**PRODUCT SOURCE FROZEN:** `dcc019ca` · 1.0.246 · **ZERO mudanças de código de produto** (somente `.github/workflows/` + docs, como autorizado). Instalação manual **CANCELADA pelo owner**: a única entidade que inicia o instalador é o **updater de dentro do app**. Nenhuma tag, release, publicação, deploy ou bump executados. Release workflow permanece INERTE e não executado.

## VEREDITO — I5C.3 AUTO-UPDATE = GO
Cadeia in-app completa provada em CI Windows real (`windows-latest`), com a baseline **real de produção v1.0.246** instalada a partir da release pública e a transição para o build QA 1.0.247 feita **exclusivamente pelo updater do app** (`quitAndInstall`). Run oficial verde: **`32480199947`** (workflow `desktop-test-1.0.246-autoupdate.yml`, head de infra `773ec0c2`, produto `dcc019ca`, 2026-08-21T12:05→12:08Z, todos os steps SUCCESS; sessão A `fails: []`, sessão B `fails: []`). Evidências (au-sessionA.json + au-sessionB.json + screenshot AU-AFTER-1.0.247.png) no artifact privado `autoupdate-acceptance-evidence` (id 9445823562, retention 7 dias — não é publicação). Asar QA 1.0.247 instalado: SHA-256 `c09e653a4600fac3f4f76ccf25f74f4b9b91e0d0e4188a1c30161e839f6bf6c1`; exe QA 82 549 773 B.

- **RC-U01 (version semantics) = RESOLVED por recomendação:** 1.0.246→1.0.246 nunca atualiza (same-version → `up_to_date`, provado). Para atualizar a base instalada é obrigatório publicar versão superior: **FINAL VERSION RECOMENDADA = 1.0.247** (proposta — bump NÃO criado, aguarda autorização).
- **RC-U02 (signing) = NÃO SE APLICA:** zero config de assinatura no repo (sem `publisherName`/CSC); a integridade real do updater é o **sha512 do latest.yml — sempre validado** (provado por rejeição `ERR_CHECKSUM_MISMATCH` com artefato corrompido). O produto atualiza unsigned em produção há dezenas de versões — mesmo regime.
- **RC-U03 (release workflow ↔ assets do updater) = OPEN (registrado, esperado):** o release workflow da linhagem é INERTE por construção (publicação `exit 1`); a etapa que publica os assets que o updater consome (`latest.yml` + `.exe` + `.exe.blockmap`, + padrão da casa `MSI`/`SHA256SUMS`/`VERSAO-DESKTOP.txt`) será implementada **no mandato de RELEASE FINAL** — é passo de publicação, não defeito.

## UPDATER MAP (auditoria literal — `desktop/src/main/updaterService.ts`, 325 linhas, NÃO alterado)
- **Lib:** `electron-updater@6.8.9` no main; provider `github` (owner `agidseven-lang`, repo `Agenda`), channel `latest`.
- **Flags na ordem obrigatória:** `allowPrerelease=false → channel="latest" → allowDowngrade=false → autoDownload=false → autoInstallOnAppQuit=false → forceDevUpdateConfig=false → fullChangelog=false` (gate de flags também no build RC).
- **Máquina de estados:** `idle / checking / update_available / up_to_date / downloading / downloaded / installing / deferred / error`. Download e instalação **só por ação do usuário** (autoDownload=false; IPC explícito).
- **Instalação:** `installAndRestart()` → consulta `window.__updaterInstallGuard()` → `deps.beforeInstall()` → **`autoUpdater.quitAndInstall(false, true)`** — `isSilent=false` (instalador assistido VISÍVEL, contrato F3.4.1A) e `isForceRunAfter=true` (relança o app).
- **IPC/preload:** `desktopAPI.updater.{getState,check,download,installAndRestart,defer,onStateChanged}` (canais `updater-get-state/check/download/install/defer` + push `updater-state`).
- **Guardas:** `CHECK_MIN_INTERVAL_MS` = 6h para checks automáticos (check manual sempre passa); logs **redigidos** (nunca URL/token — `redact()`); UI real do updater no renderer (~linha 14524) + guard de instalação (~14572).

## BASELINE DE PRODUÇÃO (feed contract)
Release **Latest** pública `v1.0.246` (2026-08-11, `prerelease=false`): `Agenda-ID-Seven-Desktop-1.0.246-x64.exe` (SHA-256 `65224c19…`, conferido no CI contra `SHA256SUMS` da própria release) + `.exe.blockmap` + `.msi` + **`latest.yml`** + `SHA256SUMS` + `VERSAO-DESKTOP.txt`. O `latest.yml` é o contrato do canal: `version`, `files[url,sha512,size]`, `path`, `sha512`, `releaseDate` — o updater resolve o asset por nome exato e valida o **sha512** no download.

## HARNESS DE ACEITAÇÃO (windows-latest — `desktop-test-1.0.246-autoupdate.yml`)
Princípios: **NO MANUAL INSTALLATION** (o CI instala a baseline `/S` como setup do cenário — permitido; a transição 246→247 é disparada só pelo updater); **staging fail-closed** (o `app-update.yml` da INSTÂNCIA instalada aponta para feed local `generic http://127.0.0.1:8879`; produção github/latest INTOCADA); **bump QA efêmero** 1.0.247 só no workspace do runner (nunca comitado/publicado); Playwright `_electron` sobre o exe INSTALADO; IPCs fire-and-forget + poll de estado (padrão da UI real); evidência JSON gravada antes de close; `Promise.race([close, 4s]) + process.exit`.

**Run oficial `32480199947` — SESSÃO A (baseline 1.0.246): 10/10**
| Gate | Resultado provado |
|---|---|
| a1/a2 baseline | app instalado 1.0.246 abre; `desktopAPI.updater` presente |
| seed | userData semeado (appearance+notif) para o teste de preservação |
| n1 feed indisponível | `check` → **`error` honesto** (sem crash, sem falso update) |
| b1 check | **`update_available` 1.0.247** contra o feed |
| n2 corrupto | download com artefato adulterado → **`ERR_CHECKSUM_MISMATCH`** (sha512 barrou; estado `error`) |
| b2/b3 retry | feed íntegro restaurado → download real → **`downloaded`** |
| b4 progresso | registro honesto: `progressSeen=false` + `downloaded` — o feed local 127.0.0.1 completa os 82MB entre polls (instantâneo); o evento `download-progress` é da lib/UI real em rede real, gate = progresso OU conclusão |
| c1 install | `installAndRestart()` → guard → **`quitAndInstall`** → app fecha e o instalador 1.0.247 é lançado **pelo updater** |

**WIZARD (contrato F3.4.1A — instalador assistido visível):** o NSIS aberto pelo updater foi concluído via SendKeys (AppActivate). Critério de sucesso **criptográfico**: `SHA-256(app.asar instalado) == SHA-256(app.asar do build QA 1.0.247)` — byte-idêntico. **PASS.**

**SESSÃO B (app pós-update): 7/7**
| Gate | Resultado provado |
|---|---|
| d1 versão | título/versão **1.0.247** no app relançado |
| d2 userData | seed (appearance+notif) **preservado** através do update |
| d3 Light OFF | `light-ui` **ausente** e `luiPreview≠true` pós-update (default OFF sobrevive ao update) |
| d4 ON controlado | janela dimensionada como desktop real (1280×800) → `appearSet({luiPreview:true})` aplica `body.desktop.light-ui` (mecanismo interno oficial) |
| d5 kill | `appearSet({luiPreview:false})` → legacy imediato |
| e1 same-version | check 1.0.247 vs feed 1.0.247 → **`up_to_date`** (sem loop de reinstalação) |
| e2 downgrade | feed reescrito para 1.0.246 → **`up_to_date`** (allowDowngrade=false barra) |

**Registro valioso do run 6 (iteração honesta):** a janela pós-update abriu <1024px CSS e o **guard desktop-only NEGOU a classe light-ui — comportamento correto do produto observado em CI** (a correção foi no harness: dimensionar a janela como desktop real antes do gate; nenhum código de produto tocado).

## CHANNEL SAFETY (FASE 20)
- Produção (`github/agidseven-lang/Agenda`, channel `latest`) **intocada** — nenhum asset, release ou feed alterado.
- O redirecionamento de feed vive **só no `app-update.yml` da instância instalada no runner efêmero** (destruído com o runner).
- `allowPrerelease=false` → um eventual `v1.0.247-rc` (prerelease) é **invisível** ao canal estável.
- Nenhuma flag/configuração QA entra no pacote: o bump 1.0.247 do teste é efêmero (workspace do runner), o repositório permanece 1.0.246.

## RECOMENDAÇÃO DE VERSÃO (FASE 23 — proposta, NÃO executada)
**FINAL VERSION = 1.0.247.** Arquivos do bump (as únicas alterações de produto do futuro mandato):
1. `desktop/package.json` — `"version": "1.0.246"` → `"1.0.247"` (linha 3);
2. `desktop/package-lock.json` — 2 ocorrências do pacote raiz (linhas 3 e 9);
3. `desktop/package.json` `description` — o marcador da casa (`1.0.246-f356bh2-…` + "=== MARCADORES HERDADOS ===") é convenção editorial do protocolo de versões; os gates mecânicos da linhagem RC validam apenas `version` + renderer hash. A redação do marcador `1.0.247-…-light-ui-…` é decisão do owner no mandato de release.
Semântica provada: publicar 1.0.247 como release **Latest** estável faz TODA base 1.0.246 receber `update_available`; mesma versão jamais reinstala; downgrade jamais ocorre.

## RC-U03 — o que falta para o updater de produção enxergar a 1.0.247 (mandato futuro)
O release workflow inerte precisa ganhar (quando autorizado) a etapa de publicação com o set completo que o updater consome: tag `v1.0.247` + GitHub Release **Latest** com `Agenda-ID-Seven-Desktop-1.0.247-x64.exe` + `.exe.blockmap` + **`latest.yml`** (gerados juntos pelo electron-builder do MESMO build) + padrão da casa (`.msi`, `SHA256SUMS`, `VERSAO-DESKTOP.txt`). Regra de ouro provada aqui: exe+blockmap+latest.yml devem sair do MESMO build (sha512 casado — qualquer mistura reproduz o `ERR_CHECKSUM_MISMATCH` do teste negativo).

## SECURITY
Logs e artifacts varridos: zero segredo (GITHUB_TOKEN nunca ecoado; logs do updater redigidos por design; feed local sem credencial; screenshots só com UI do app). Artifacts do run são privados (retention 7 dias) — não são publicação.

## POSTO DE CONTROLE
**SOURCE `dcc019ca` intocado · bump NÃO criado · tag NÃO · GitHub Release NÃO · publicação NÃO · deploy NÃO · distribuição NÃO · release workflow INERTE/NÃO executado · Light UI default OFF (provado pós-update).**

## RESPOSTA À PERGUNTA DO MANDATO
**"O Agenda ID Seven está tecnicamente pronto para atualizar automaticamente os usuários atuais para a nova Light UI, sem instalação manual?" — SIM**, publicando a versão **1.0.247** (bump 1.0.246→1.0.247 nos arquivos listados acima + release Latest com exe+blockmap+latest.yml do mesmo build). A cadeia completa — check → download validado por sha512 → instalação disparada só pelo updater → restart → 1.0.247 com userData preservado e Light UI OFF por default (ON somente pelo opt-in interno) — está provada de ponta a ponta em Windows real. A publicação em si permanece bloqueada aguardando o GO explícito do owner.
