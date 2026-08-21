# LIGHT UI — I5C.5 · ZERO-TOUCH LEGACY BRIDGE (1.0.246 → 1.0.247)

**BASE histórica `dcc019ca` · BASE updater candidate `b4ea7890` · NEW RELEASE CANDIDATE = `c75ccd20`** (`fix(updater): bridge legacy updates without installer interaction`). Diff de produto vs `dcc019ca` = **exatamente 2 arquivos**: `desktop/src/main/updaterService.ts` (A — fix silent, b4ea7890) + `desktop/electron-builder.yml` (B — `nsis.oneClick: true`, 1 linha + comentário). Zero incidental (gate mecânico no CI). Nada publicado; sem tag; release workflow inerte; bumps só efêmeros.

## CONTRATO NSIS ATUAL (FASE 0 — auditoria literal)
`electron-builder.yml` (valores em `dcc019ca`/`b4ea7890`): **`oneClick: false`** (assistido — a causa do wizard), `perMachine: false` (per-user, `%LOCALAPPDATA%\Programs`), `allowToChangeInstallationDirectory: false`, `createDesktopShortcut: true`, `createStartMenuShortcut: true`, `shortcutName`, `include: build/installer.nsh` (hooks da casa: `customInit` killRunningApp+Banner com `IfSilent`; `customUnInit`; `customHeader` DPI), `deleteApppDataOnUninstall: false`*, sem `runAfterFinish` explícito (**default true**), sem `allowElevation` explícito (default true; irrelevante em per-user), sem `license` (sem página de licença), `artifactName: Agenda-ID-Seven-Desktop-${version}-${arch}.${ext}`, sem differentialPackage explícito (blockmap gerado — differential ativo por default). *(grafia correta no yml: `deleteAppDataOnUninstall: false`.)*

## ONECLICK SEMANTICS (FASE 0 — implementação REAL instalada, `app-builder-lib/templates/nsis/`)
Auditoria dos templates do electron-builder usados pelo build (não documentação — código):
- `oneClick.nsh`: página ÚNICA = `MUI_PAGE_INSTFILES` (progresso). Página de licença só existiria com `licensePage` definida (produto não define) — e mesmo assim `skipPageIfUpdated` a pula no modo `--updated`.
- `installSection.nsh`: no GUI (`${IfNot} ${Silent}`) o one-click mostra **`SpiderBanner::Show /MODERN`** — janela de progresso **sem nenhum botão de decisão** — e a instalação começa imediatamente na seção install (não há welcome/dir/confirm).
- Pós-install: `ONE_CLICK` + `RUN_AFTER_FINISH` (default true) → `${ifNot} ${Silent} ${orIf} ${isForceRun}` → **`doStartApp`** (HideWindow + `StartApp` que relança o app com `--updated` via `ExecShellAsUser`) → **`quitSuccess`** — o instalador **fecha sozinho**. Não existe página Finish no one-click.
- Elevação: o bloco de auto-elevação silent está sob `!ifndef ONE_CLICK` (só assistido); one-click per-user **não eleva** (sem UAC).
- `customInit` da casa roda nos dois modos: no GUI aparece o Banner "Preparando o instalador..." ~1,2s (informativo, destruído em seguida) + taskkill do app antigo (lock do asar resolvido).

**Resposta empírica (one-click SEM `/S`): exige clique? NÃO. Mostra botão? NÃO (SpiderBanner de progresso). Instala ao iniciar? SIM. Requer Finish? NÃO (quitSuccess automático). Relança o app? SIM (`runAfterFinish` default true — e o updater antigo ainda passa `--force-run`). UAC? NÃO (per-user). SmartScreen? NÃO no fluxo do updater (arquivo gravado pelo próprio app, sem Mark-of-the-Web).**

## A PONTE (FASE 1 — mudança cirúrgica)
`nsis.oneClick: false → true` (**`c75ccd20`**). Efeito: o installer 1.0.247 torna-se **zero-touch por si mesmo** — instala sozinho MESMO quando lançado SEM `/S` pelo updater antigo da 1.0.246 (`quitAndInstall(false,true)` legado, que não retroage). Com `/S` (updater `b4ea7890` em diante) permanece 100% invisível. O PASS vem do comportamento do installer NOVO — a baseline não foi alterada. `allowToChangeInstallationDirectory: false` já era o valor exigido pelo one-click; nenhuma outra opção precisou mudar (FASE 13: se precisasse, era STOP — não precisou).

## RUN OFICIAL — **`32487165389`** · 22/22 steps SUCCESS (windows-latest, 2026-08-21T13:30→13:34Z)
Cadeia REAL completa num único run: **release pública v1.0.246 → QA 1.0.247 (ponte one-click) → QA 1.0.248 (updater corrigido /S)**. Evidências no artifact privado `zero-touch-bridge-evidence` (id 9448414455, 8 arquivos: au-sessionA/B/C.json + bridge-transition.json + silent-transition.json + monitor1/2.jsonl + screenshot; retention 7d).

**SESSÃO A (baseline pública 1.0.246 instalada, SHA256SUMS conferido): 5/5.** App real 1.0.246 → seed userData → check → `update_available` **1.0.247** → download → `downloaded` → clique interno "Instalar e reiniciar" (IPC real) → app fechado pelo updater ANTIGO. `fails: []`.

**PONTE ZERO-TOUCH (246→247) — todos os gates fail-closed verdes:**
- Installer spawnado pelo updater antigo com cmdline **`--updated --force-run` (SEM `/S`)** — prova de que o zero-touch veio do one-click, não de silent flag.
- Instalação COMPLETA por SHA-256 exato (asar instalado == asar QA 1.0.247) em ~6s, **zero input**.
- **`SETUP_WINDOWS_VISIBLE = 11` amostras (~8s)** — as janelas registradas são INFORMATIVAS, sem nenhum botão de ação: `Agenda ID Seven Desktop Setup` (SpiderBanner de progresso do one-click) e `Preparando o instalador...` (Banner do `customInit` da casa). **`setupWindowsAtEnd = 0`** — sumiram SOZINHAS (gate fail-closed).
- `uacSamples = 0` · `smartscreenSamples = 0` · **`REQUIRED_USER_INSTALL_ACTIONS = 0`** (estrutural: harness sem input sintético + instalação completou sem nenhum input).
- Process-tree: installer (pid 3904) → filho `old-uninstaller.exe /S /KEEP_APP_DATA /currentuser --keep-shortcuts --updated` (pid 7480 — uninstall interno silencioso preservando dados) → app relançado `"Agenda ID Seven Desktop.exe" --updated` (pid 6932). **App 1.0.247 voltou sozinho.**

**SESSÃO B (1.0.247 via ponte): 10/10.** Versão/título 1.0.247 · login real (`input[type=password]`) · RC-D02=0 no DOM · userData seed preservado · **Light OFF** (`luiPreview≠true`) · ON pelo `appearSet` real (1280×800) · kill · FUTURE: feed→1.0.248 → `update_available` **1.0.248** → `downloaded` → `installAndRestart` (updater NOVO b4ea7890). `fails: []`.

**TRANSIÇÃO FUTURA (247→248) — /S: `28 amostras | setupWins=0 | smartscreen=0 | uac=0`.** Cmdline **`--updated /S --force-run`** → uninstall interno `/S /KEEP_APP_DATA` → app relançado. Asar == QA 1.0.248 por hash. ZERO janela (com `/S` nem o SpiderBanner aparece — guard `${IfNot} ${Silent}` do template).

**Gate mecânico:** `input-sintetico: 0 | msi-exec: 0 | exec direto dos installers 247/248: 0` (self-grep do harness).

**SESSÃO C (1.0.248): 5/5.** Versão/título 1.0.248 · **userData preservado ATRAVÉS DE 2 UPDATES consecutivos** · Light OFF · same-version (feed 1.0.248) → `up_to_date` · downgrade (latest.yml→1.0.247) → `up_to_date`. `fails: []`.

## MANUAL INSTALL CONSEQUENCE (FASE 12 — documentado, sem reprovação)
Com `oneClick: true`, o exe baixado MANUALMENTE do site/release também muda de comportamento: ao abrir, **instala imediatamente** (SpiderBanner de progresso; sem escolha de diretório — já era `false` no assistido; sem confirmação; sem Finish; relança o app ao final). Per-user → **sem UAC**. **SmartScreen continua aparecendo no download manual** (Mark-of-the-Web do navegador; unsigned — mesmo aviso de hoje, "Executar assim mesmo"). Ou seja: o duplo-clique manual vira "abrir = instalar". Consequência registrada para decisão do owner; o fluxo de UPDATE (o objeto deste mandato) não é afetado por MotW.

## RC-U03 (FASE 15)
Release workflow permanece **PREPARED e INERTE** (gates 0–3 + pins `PENDING-RELEASE-FINAL-MANDATE` + tag pré-existente barram tudo). Nada executado, nada publicado, nenhuma tag, nenhum Latest.

## VERSION PLAN (FASE 16 — nada executado)
**FINAL VERSION recomendada continua = 1.0.247**, agora sobre o NEW RELEASE CANDIDATE `c75ccd20`. Diff definitivo do bump (aguarda GO do owner): `desktop/package.json` linha 3 (`"version": "1.0.246"` → `"1.0.247"`) + `desktop/package-lock.json` linhas 3 e 9 (2 ocorrências do pacote raiz) + marcador de `description` conforme o contrato mecânico do par de workflows da fase de release (padrão literal da casa: `Gate VERSAO X (package + lock x2 + description)`), a definir no mandato final.

## POSTO DE CONTROLE
**`dcc019ca` congelada · candidatos `b4ea7890` → `c75ccd20` (NÃO congelados — aguardam GO) · bump definitivo NÃO · tag NÃO · GitHub Release NÃO · publicação NÃO · deploy NÃO · release workflow INERTE · Light UI default OFF (provado pós-ponte).**

## REGRESSION (FASE 14)
Renderer **byte-idêntico** ao congelado `bd5001b1…` (gate no PIN + gate asar nos dois builds) — F9-D01/F10/F11/F13 permanecem por identidade da fonte. Revalidados no app instalado pós-ponte: default OFF (d3/g3), controlled ON (d4, janela desktop real), kill (d5), RC-D02=0 (asar + DOM), login real (d0). Máquina de estados do updater re-exercitada nas 3 sessões.

## VEREDITO
**I5C.5 = GO** — HARD PASS RULE cumprida: a transição REAL **PUBLIC v1.0.246 → QA 1.0.247** passou com **`REQUIRED_USER_INSTALL_ACTIONS = 0`**, sem teclas sintéticas, sem automação de UI/cliques, sem execução direta de installer, sem msiexec (self-grep 0/0/0 + monitor de runtime). A janela existente é somente progresso informativo e **desaparece sozinha** (11 amostras; `setupAtEnd=0`).

- **RC-U04 = RESOLVED:** o instalador 1.0.247 (one-click) nunca exige interação — nem quando lançado SEM `/S` pelo updater antigo da 1.0.246; e o updater do 1.0.247 em diante instala com `/S` (zero janela). Provado nos dois modos no mesmo run.
- **RC-U06 = RESOLVED:** a herança assistida da baseline foi neutralizada pela ponte one-click — a transição 246→247 é zero-touch.
- **RC-U05 = NONE:** UAC/SmartScreen/publisher = 0 amostras nas DUAS transições (per-user, sem elevação; sem MotW no fluxo do updater).
- **RC-U03 = PREPARED** (release workflow inerte, gates 0–3 + pins PENDING; nunca executado).

**Resposta literal — "O usuário atualmente na 1.0.246 consegue chegar à 1.0.247 sem interagir com qualquer instalador?" = SIM.** O único ato do usuário é o clique interno "Instalar e reiniciar" dentro do app (contrato vigente, com guard de trabalho não salvo); depois disso o updater antigo lança o installer 1.0.247, que instala sozinho, fecha sozinho e reabre o app atualizado — nenhum Next/Install/Finish, nenhum wizard utilizável, nenhum prompt. E de 1.0.247 em diante os updates são totalmente silenciosos (`/S`, zero janela — provado 247→248 no mesmo run).
