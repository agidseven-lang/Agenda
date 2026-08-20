# LIGHT UI — I5C · RC ACCEPTANCE & FINAL QA

**RC SOURCE FROZEN:** `dcc019ca` (verificado: HEAD exato, worktree limpa, 1.0.246, renderer SHA-256 `bd5001b1ec24…` e lockfile `901d8fe0…` idênticos à I5B, 0 tags, 0 commits novos de produto). **ZERO modificações de source nesta fase** (regra central cumprida). Sem PR/merge/tag/GitHub Release/deploy/bump. Bateria executada em 2026-08-20T23:23Z–23:4xZ.

## VEREDITO ANTECIPADO
**I5C = NO-GO** — não por defeito do produto (o QA executável passou integralmente: **68/68 gates efetivos**), mas porque **três gates obrigatórios da FASE 25 são inexecutáveis neste ambiente** e a regra central manda blocker + STOP, sem contornos:

- **RC-A01 · AMBIENTE WINDOWS REAL INDISPONÍVEL (blocker de ambiente/infra).** Esta sessão é um container Linux x86_64 (registro exigido de "Windows edition/build/scaling": **N/A — Windows inexistente aqui**). Afeta: Fase 2 (pipeline `windows-latest` oficial), Fases 5-6 (NSIS install REAL + first boot do app INSTALADO — "extração manual não substitui o gate"), Fases 17-19 (uninstall/reinstall/**MSI**, que já era RC-B01). O caminho GitHub Actions foi auditado a fundo e NÃO é utilizável para o RC sem alterar/criar workflow (**vedado**): `desktop-build.yml` canônico tem gate hard-coded de versão 1.0.183; `desktop-build-f356bh2.yml` (linhagem 1.0.246) tem gate de branch fixo (`GITHUB_REF_NAME == desktop/f356bh2-…`) e gate de ISOLAMENTO "produção = SOMENTE os 2 renderers vs 1.0.245" — o RC (Light UI + B1 + B2 + RC-D02) diverge legitimamente ⇒ falha por construção. **Resolução (decisão do owner):** (a) rodar os comandos oficiais do repo (`npm ci` → `npm run dist`) numa máquina Windows x64 real, ou (b) autorizar fase corretiva mínima criando um workflow RC dedicado (dispatch por ref), ou (c) runner Windows avulso com checkout de `dcc019ca`.
- **RC-A02 · REDE ABERTA AO CDN INDISPONÍVEL (blocker de ambiente).** Probe real: `curl -I https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js` → **403 Forbidden do proxy da sessão**. Fase 13 "CDN NORMAL" não executável aqui. Resolução: 1 boot do app em rede aberta (máquina do owner) — expectativa fortíssima de PASS (produto em produção carrega estes CDNs há 246 versões).
- **RC-B01 (MSI)** permanece aberto — é subcaso do RC-A01 (WiX/.NET requer Windows).

**Tudo o que era executável foi executado e está verde**, sobre o MESMO binário da I5B re-verificado por hash. Nenhum blocker de CÓDIGO novo. M1 segue dívida aceita (não vendorizado; SDK intocado).

## FASE 1 · ARTEFATO I5B — MESMO BINÁRIO (não regenerado)
`Agenda-ID-Seven-Desktop-1.0.246-x64.exe` · 82 618 621 B · SHA-256 **`82576b18209dcc420968506a5e2d53245f136eef04107ebec6f3e781ac493f35`** ✚ `app.asar` **`6d1099d1c776f47d508654f9c01556b9b65c079d074abb3b46b817ee430f9f75`** — **idênticos ao LIGHT-UI-I5B-RC-BUILD-REPORT.md**. NSIS x64, unsigned (por design). Fases 2-3 (rebuild Windows + reproducibility no Windows): bloqueadas por RC-A01; a imutabilidade do source NESTA sessão re-provada (SHAs acima; worktree limpa ao final).

## QA EXECUTADO — APP DO ARTEFATO (asar re-verificado + Electron 31.3.1 do lockfile, userData isolado por cenário, Xvfb) — **68/68 efetivos**
- **Boot (7/8+1 nota = 8/8 efetivo):** janela, título `ID Seven · Desktop 1.0.246 (Fluxo)`, versão via preload/IPC reais, splash→login pelo escape real, zero erro próprio. (Gate `b3` do harness exigia `window.api`, que NUNCA existiu no produto — preload expõe só `desktopAPI`; IPC provado pela versão entregue. Nota mantida da I5B.)
- **Default OFF (condição absoluta): PASS** — perfil limpo: sem classe, chave de aparência nem criada, login legacy.
- **Controlled ON: PASS** — `luiPreview` SOMENTE pelo mecanismo real (localStorage do pacote; NUNCA classe manual) + reload → `body.desktop.light-ui`, sem híbridos.
- **Global flow (acc 1920×1080 **21/21** e 1366×768 **21/21**):** 2 voltas × 8 tabs, contexto preservado, par sempre presente, **nested interactive = 0**, sem H-scroll; **F6 Details** abre/fecha com contexto; **F7 Wizard** caminho real completo (openTaskForm → grade de setores → seleção `cronograma` → next → step 1 com campos); **H16** bloqueia produção concluída; **badge=1 fonte única + deep-link F9→F6**; **zero writes** (SDK stub; CDN abortada na sessão de teste — nenhum write de produção).
- **RC-D02 / Login dinâmico (mecanismos 100% reais do pacote):** recovery target = **0**; tab order `liId→liPw→toggle→Entrar` (4 focáveis); blank → validação local "Preencha e-mail/WhatsApp e senha."; credenciais FICTÍCIAS de teste → `desktopAPI.authLogin` REAL → **banner honesto de rede** "Sem conexão com o servidor de login…"; **busy real capturado deterministicamente** (disabled+spinner no handler síncrono); Enter repetido durante busy = inerte; retry re-habilitado; nunca `authed` falso. Sucesso/logout com backend real: adiado ao ambiente com auth seguro (I5C-Windows) — contratos provados na cadeia sobre o MESMO renderer byte-idêntico.
- **F13 B2: PASS** — modal, busy+`aria-busy`, 1 write em voo, fecha SÓ pós-confirmação; **falha mantém modal + toast honesto + conteúdo digitado preservado; retry grava a edição** (2ª tentativa, payload conferido). Upload por teclado (mouse/Enter/Space 1/1/1) provado na C1 sobre o mesmo renderer.
- **Responsive:** 1920 e 1366 sem overflow; **Win125 congelado no pacote: dpr 1.25 medido + viewport CSS ~1093 + sem H-scroll** (flag de escala do runtime + contentSize — mecanismo de teste já validado na I5B; o scaling nativo do Windows fica para a I5C-Windows).
- **CDN BLOCKED: PASS (4/4)** — guard honesto, sem fake login, sem crash, recovery continua inexistente. **CDN NORMAL: RC-A02.**
- **Storage: PASS** — antes `[appearance]` → depois `[appearance, notif.history(semeada), wp_uid, wp_name(startApp)]`; **nenhuma chave nova criada pela I5C**; OFF/ON/reload/kill auditados.
- **Kill switch: PASS** — remoção imediata, `luiPreview:false` persistido, reload legacy, sem híbrido/órfão.
- **Reopen/persistence (3/3):** A clean→OFF→ON · B relaunch→**ON persistido**→kill · C relaunch→**OFF persistido** (par/desktop coerente). D (pós-logout): logout preserva aparência — provado na cadeia (I5A/I5A.1) sobre o mesmo renderer; sem sessão real no ambiente.
- **Performance sanity:** janela ~1-2 s; login utilizável em segundos; sem runaway de CPU/RAM, sem reload-loop (fora do cenário CDN-blocked, onde é o comportamento correto), sem console storm. 
- **Security: PASS** — sweep em logs/reports/screenshots: zero segredo; únicas "credenciais" são fictícias de teste (`qa-rc@invalid.test`); nenhum certificado envolvido.

## ACCEPTANCE MATRIX (FASE 24)
PASS: Source baseline · Clean worktree · Artefato I5B (hash) · Source immutability (sessão) · Packaged boot · Version · Default OFF · Controlled ON · F1 · F6 · F7 · F8 · F9 · F10 · F11 · **F12 RC-D02** · **F13 B2** · 1920 · 1366 · Win125(pacote) · CDN blocked · Storage · Kill switch · Reopen · Secrets · Logs · Performance sanity.
**BLOQUEADOS (ambiente, com blocker formal):** npm ci/Build/NSIS/MSI no **Windows oficial** · NSIS hash/MSI hash (Windows) · **NSIS install/boot instalado** · NSIS uninstall/reinstall · **MSI install/uninstall** (todos **RC-A01**; MSI também RC-B01) · **CDN normal (RC-A02)**. — A cláusula do mandato ("não podem continuar N/A **se o ambiente estiver disponível**") aplica-se pela negativa: o ambiente NÃO está disponível nesta sessão; os itens ficam BLOQUEADOS com blocker, não "N/A silencioso".

## FASE 20 · ARTIFACT CONSISTENCY (executável)
NSIS: payload interno ≡ asar ≡ renderer ≡ fonte `dcc019ca` (cadeia byte-idêntica, I5B re-verificada nesta fase). MSI: inexistente (RC-A01/B01) — comparação NSIS×MSI adiada.

## FASE 26 · GIT / RELEASE SAFETY
**PR = NÃO · MERGE = NÃO · TAG = NÃO · GITHUB RELEASE = NÃO · DEPLOY = NÃO · VERSION BUMP = NÃO · commit de source novo = NÃO (nenhum necessário).**

## SCREENSHOTS (FASE 23 — chat, não versionadas)
I5C-RC-LEGACY-OFF · I5C-RC-LIGHT-ON-1920x1080 · I5C-RC-LIGHT-ON-1366x768 · I5C-RC-WIN125-1093x614-dsf125 · I5C-RC-LOGIN · I5C-RC-NOTIFICACOES (F9) · I5C-RC-EXEC (F10) · I5C-RC-RELATORIOS (F11) · I5C-RC-F13-PRODUCTION · I5C-RC-KILL-OFF. **NSIS-INSTALLED / MSI-INSTALLED: impossíveis sem Windows (RC-A01).**

## RECOMENDAÇÃO
O RC 1.0.246 não apresentou NENHUM defeito novo em toda a aceitação executável — o produto está pronto no que depende de código. O que falta é **exclusivamente ambiente**: uma passada em Windows real (build oficial + NSIS install/uninstall/reinstall + MSI + reopen) e um boot em rede aberta (CDN normal). Sugestão objetiva ao owner: executar na sua máquina Windows o roteiro curto — `git checkout dcc019ca && cd desktop && npm ci && npm run dist` → instalar o NSIS → conferir versão/OFF/ON/kill → desinstalar/reinstalar → instalar o MSI — ou autorizar a fase corretiva mínima de um workflow RC dedicado. Com esses gates verdes, a aceitação completa.

**I5C = NO-GO** (blockers ambientais RC-A01 e RC-A02; zero blocker de código).

**"O RC 1.0.246 está tecnicamente aprovado para a fase de RELEASE FINAL?" — NÃO** (ainda não: os gates Windows/CDN-normal da FASE 25 permanecem abertos por indisponibilidade de ambiente nesta sessão; nenhuma reprovação de produto).
