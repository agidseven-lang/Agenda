# LIGHT UI — I5B · RELEASE CANDIDATE BUILD

**Source baseline:** `dcc019ca` (RC-0 SOURCE FROZEN; branch `rc/light-ui-activation-hardening-1.0.246`) · **Versão:** 1.0.246 · **SHA-256 do renderer no preflight E no pós-build:** `bd5001b1ec249ecc56bc1a8b71a11be05d468dc990695c6f80ef80af00aef32f` (imutável) · Sem PR/merge/tag/GitHub Release/deploy/bump. **Light UI OFF por padrão no pacote (provado em perfil limpo).**

## ARTEFATO RC GERADO (pipeline npm oficial: `electron-builder --win nsis --publish never`)
| Artefato | SHA-256 | Tamanho | Target/Arch | Signing |
|---|---|---|---|---|
| `Agenda-ID-Seven-Desktop-1.0.246-x64.exe` (NSIS) | `82576b18209dcc420968506a5e2d53245f136eef04107ebec6f3e781ac493f35` | 82 618 621 B | nsis / x64 | **UNSIGNED TEST RC** (sem code-sign POR DESIGN do projeto — comentário literal do electron-builder.yml; SmartScreen avisará — esperado) |
| `…-x64.exe.blockmap` | `0f9200e1f61703e59a4743090a20583cb15681b17e643d5fb73f0aeb4152a61a` | 86 978 B | update meta | — |
| `latest.yml` | `0cd3826cbf1eedb76e21dc135eb27231a141681b6bcd36aa09b1d057bddb41ac` | 376 B | channel latest | sha512+size conferem com o exe (validado como no CI) |
| `win-unpacked/resources/app.asar` | `6d1099d1c776f47d508654f9c01556b9b65c079d074abb3b46b817ee430f9f75` | 33 696 866 B | payload | renderer interno **byte-idêntico à fonte `dcc019ca`** |

Timestamp de geração: 2026-08-20T23:06Z. Nenhum artefato versionado no repo (dist/dist-installer ignorados — política real). Nenhum artefato renomeado.

## BUILD MAP (auditoria FASE 1 — provado, não assumido)
`desktop/` · npm (package-lock.json, SHA-256 `901d8fe0917e679d5d9a0c81f801624cff6a8322432b135ca080b0aff40322f1`) · scripts reais: `build` = `tsc -p tsconfig.json` (main+preload TS→dist, strict) + `scripts/copy-renderer.js` (renderer = HTML único sem bundler + 6 módulos .js à mão → dist/main) · `dist` = build + `electron-builder --win nsis msi --publish never` · Electron **31.3.1** · electron-builder **24.13.3** · TS 5.5.4 · runtime deps: electron-updater 6.8.9 + firebase 10.12.2 · config `electron-builder.yml`: appId `br.com.idseven.agenda.desktop`, productName `Agenda ID Seven Desktop`, targets **win nsis x64 + msi x64**, artifactName `Agenda-ID-Seven-Desktop-${version}-${arch}.${ext}`, asar default ON, output `dist-installer`, extraResources icon.png (tray), nsis assistido + installer.nsh, `deleteAppDataOnUninstall:false`, publish github (metadata only; `--publish never`), **sem bloco de signing**. CI oficial (`.github/workflows/desktop-build*.yml`): runner **windows-latest**, mesmo comando, artifacts privados. Side effects: downloads de tooling em `~/.cache/electron-builder` (fora do repo).

## DEPENDENCIES (FASE 2)
Node v22.22.2 · npm 10.9.7 · Linux x86_64 · `npm ci --no-audit --no-fund` → **386 pacotes / 14 s / exit 0** · lockfile INTOCADO · worktree pós-install: **0 mudanças versionadas** · warnings: só deprecations transitivas (lodash.isequal, inflight, glob, tar, boolean) — nenhuma correção aplicada (mandato).

## BUILD (FASE 3)
`npm run build` **exit 0 (~2,8 s)** — tsc strict sem erros a partir de `dcc019ca`; dist/main+preload completos. **O projeto COMPILA do baseline congelado.** Informativo: contratos da linhagem tocados pelo RC re-testados — `f3356-auth-core` **16/0 PASS** (RC-D02 não quebrou auth); `f354i-cronograma-save-send-client` crasha `wfNow is not defined` **byte-idêntico na base congelada `899862a2`** (pré-B2) ⇒ estado pré-existente do harness da fase antiga (não está nos gates do workflow atual), **não é regressão do RC**.

## PACKAGE (FASE 4) + ambiente
Ambiente Linux exigiu tooling wine para o cross-compile do target Windows (mudanças de AMBIENTE, zero mudanças no repo): wine64 + wine32:i386 instalados via apt; 1 ajuste temporário no cache de ferramenta (`~/.cache/electron-builder/.../rcedit-ia32.exe` ↔ x64) usado num run intermediário e **revertido** — o build final usou o `rcedit-ia32.exe` ORIGINAL via wine32. Resultado: **NSIS x64 gerado com sucesso (47 s)** com uninstaller embutido + blockmap + latest.yml. **RC-B01 (ambiental, não é defeito do produto):** target **MSI** não gerável neste ambiente — WiX exige .NET Framework/Windows (falha `exit 255` sob wine) — **coberto pelo pipeline oficial de CI (`windows-latest`), onde o mesmo comando o produz**; menor correção: nenhuma no repo (rodar o job oficial de CI para obter o MSI).

## ARTIFACT INTEGRITY (FASE 5) — gates espelhados do CI, todos PASS
(a) `package.json` EMPACOTADO = **1.0.246** · (b) renderer EMPACOTADO **byte-idêntico** à fonte `dcc019ca` · (c) flags do updater no asar: `allowPrerelease=false` (L56) → `channel="latest"` (L57) → `allowDowngrade=false` (L58) + autoDownload/autoInstallOnAppQuit/forceDevUpdateConfig=false — **ordem exigida OK** · (d) **RC-D02 no asar: 0 ocorrências** de recovery · (e) `app-update.yml` github/agidseven-lang/Agenda/latest **sem segredo** · latest.yml: version/path/url/**sha512/size conferem com o exe** · tray `resources/icon.png` presente · **payload DE DENTRO do instalador NSIS extraído (7z): app.asar byte-idêntico ao do build** (cadeia fonte→asar→instalador fechada).

## SOURCE IMMUTABILITY (FASE 6)
Pós build+package: `git status` = **0 modificações versionadas**; SHA-256 do renderer **idêntico ao preflight**. Artefatos gerados (dist/, dist-installer/) claramente separados do source (ignorados pela política real do repo).

## PACKAGED BOOT (FASE 7) — app REAL executado
Execução do **app.asar DO ARTEFATO** com o runtime Electron **31.3.1** desta plataforma (mesmo binário do lockfile), userData ISOLADO, sob Xvfb (o `.exe` Windows não é executável de forma confiável sob wine — ver Fase 15; a execução do exe em Windows real fica para a I5C). Resultados: processo inicia, janela aparece, **título `ID Seven · Desktop 1.0.246 (Fluxo)`**, **versão 1.0.246 entregue pelo preload/main REAIS via IPC** (`desktopAPI.version`), splash real → **login real alcançado pelo escape manual do produto** (ambiente sem rota ao backend: splash honesto com retry + "Entrar manualmente" — mecanismo real de F3.5.5C-H1/boot), **zero pageerror/console-error PRÓPRIOS**, assets essenciais presentes. Nota de arquitetura registrada: o preload real expõe SOMENTE `desktopAPI` (não `window.api`) ⇒ `IS_ELECTRON_APP=false` e `body.desktop` vem da media query ≥1024px — comportamento do produto desde sempre (não é regressão; janela real de desktop sempre satisfaz).

## DEFAULT OFF / CONTROLLED ON / KILL SWITCH (FASES 8-10) — no pacote
**OFF (condição absoluta): PASS** — perfil/userData LIMPO: `body` SEM `light-ui`, UI legacy, `idseven.desktop.appearance` NEM EXISTE (nenhuma persistência automática), login correto. **ON: PASS** — `luiPreview:true` gravado pelo MECANISMO REAL (localStorage do pacote) + reload → **`body.desktop.light-ui` completo e persistente**; navegação 8 superfícies (F1 Tarefas · F8 Agenda · F9 Notificações · F10 Executivo · F11 Relatórios · F13 modal + hoje/equipe/perfil) sem ativação parcial, **sem overflow horizontal**, sem erro próprio — em 1440×900 e **Win125 EXATO: dpr=1.25, viewport CSS 1094×640 (≈1093), sem H-scroll** (flag `--force-device-scale-factor=1.25` + contentSize, medidos no runtime). **KILL: PASS** — `appearSet({luiPreview:false})` remove a classe imediatamente, persiste `false`, reload continua legacy, nenhuma classe parcial/config órfã (pós-kill ≡ nunca-ON, salvo o campo `luiPreview:false` na chave de aparência — metadata inevitável do padrão).

## RC-D02 + F13 B2 (FASES 11-12) — no pacote
Login do pacote: **recovery target = 0** (sem `[data-mode]`/"Esqueci"), tab order **liId → liPw → toggle → Entrar** (4 focáveis exatos). Contratos de Enter/double/busy/erro/retry/sessão: provados no MESMO renderer byte-idêntico pela bateria I5A.1 (29/29) — válidos por identidade de bytes. F13 no pacote: modal abre, **B2 vivo — guard de reentrância presente, 1 write lógico awaited (stub), modal fecha SÓ pós-confirmação** — **teste com write interceptado (CDN abortada + SDK stub na sessão de teste): NENHUM write real em backend de produção**.

## CDN / M1 (FASE 13)
**M1 = RISCO FORMALMENTE ACEITO PELO OWNER PARA 1.0.246** (vendorization = dívida pós-1.0.246; SDK intocado). No pacote: cenário BLOQUEADO provado — guard F3.5.5C-H1 real: splash "Aguardando conexão…" + hint literal "Sem conexão com o servidor — reconectando automaticamente. Sua sessão está preservada." + **login jamais revelado falsamente** + reload automático (observado como loop honesto no ambiente sem rota ao CDN). Cenário NORMAL (SDK carrega da rede): não reproduzível NESTE ambiente (proxy bloqueia gstatic — limitação do harness, não do produto; produto em produção carrega há 246 versões); funcionalidade com SDK presente provada com stub equivalente em todas as superfícies.

## STORAGE / USERDATA (FASE 14)
Perfil isolado auditado: localStorage final = `idseven.desktop.appearance` + `idseven.notif.history.v1` (semeada pelo teste) — **login/session keys ausentes sem login real; NENHUMA chave nova introduzida pela I5B**; testes OFF/ON em userData descartável (instalação do operador intocada).

## INSTALL / UNINSTALL (FASE 15)
**N/A NESTE AMBIENTE (justificativa literal):** o instalador NSIS assistido é um executável Windows GUI; sob wine+xvfb o modo silencioso `/S` pendura sem extrair (fragilidade conhecida de instaladores GUI sob wine) — instalação/desinstalação REAIS exigem Windows (I5C). Mitigação executada: **payload do instalador extraído e verificado — app.asar interno byte-idêntico ao do build**; `Uninstall Agenda ID Seven Desktop.exe` presente e embutido; `deleteAppDataOnUninstall:false` (userData preservado por config — comportamento registrado); atalhos/diretório definidos pela config NSIS real.

## PERFORMANCE / STARTUP SANITY (FASE 16)
Janela: ~1-2 s; conteúdo utilizável: segundos (login via escape ~10 s no pior caso do ambiente por backoff de rede — honesto); sem travamento perceptível, sem CPU/memory runaway (todas as sessões concluíram e fecharam limpo), sem console storm próprio; loop de reload SÓ no cenário CDN-bloqueada (comportamento correto do guard).

## SECURITY / SECRETS (FASE 17)
Sweep em artefatos/logs/metadata: **nenhum password/token/signing secret/credencial**. `app-update.yml` sem segredo (gate). A `FIREBASE_CONFIG.apiKey` no renderer é a chave PÚBLICA client-side padrão do Firebase (por design, presente em produção desde sempre) — não é segredo. Nenhum certificado usado (unsigned por design).

## RC QA MATRIX (FASE 18)
| GATE | RESULT | EVIDENCE |
|---|---|---|
| Preflight | PASS | HEAD `dcc019ca` exato · worktree limpa · 1.0.246 · 0 tags · SHA renderer registrado |
| Dependency install | PASS | npm ci 386 pkgs · lockfile intocado · 0 mudanças |
| Build | PASS | tsc+copy exit 0 |
| Package (NSIS) | PASS | exe 82,6 MB + blockmap + latest.yml |
| Package (MSI) | FAIL-AMBIENTAL (RC-B01) | WiX/.NET requer Windows; coberto pelo CI oficial windows-latest |
| Installer integrity | PASS | payload==build (asar byte-idêntico); uninstaller embutido |
| Source immutability | PASS | 0 mudanças · SHA idêntico pré/pós |
| Artifact hashes | PASS | tabela acima; sha512 latest.yml==exe |
| Packaged boot | PASS | janela+título+IPC+splash/login reais; 0 erros próprios |
| Version | PASS | 1.0.246 no título/preload/package empacotado |
| Default OFF | PASS | perfil limpo: sem classe, sem persistência automática |
| Controlled ON | PASS | mecanismo real + reload persiste; par completo |
| Kill switch | PASS | imediato + persistente + sem resíduo |
| F1 Tarefas / F8 Agenda / F9 Notif / F10 Exec / F11 Rel / F13 | PASS | navegação no pacote sem erro/overflow; screenshots |
| F12 Login | PASS | recovery=0 · tab order 4 focáveis |
| Win125 | PASS | dpr 1.25 · CSS ~1093 · sem H-scroll (no pacote) |
| CDN normal | N/A (justificado) | proxy do ambiente bloqueia gstatic; produto real em produção; superfícies provadas com SDK stub |
| CDN blocked | PASS | guard honesto no pacote |
| Storage | PASS | zero chave nova; userData isolado |
| Install | N/A (justificado) | NSIS GUI não executa sob wine; payload verificado por extração |
| Reopen | PASS (parcial) | múltiplas sessões do pacote abertas/fechadas limpo; reopen do exe instalado = I5C/Windows |
| Uninstall | N/A (justificado) | requer Windows; uninstaller presente no instalador |
| Logs | PASS | sem erro próprio não tratado |
| Secrets | PASS | sweep limpo |

## SCREENSHOTS (FASE 19) — do APP EMPACOTADO (chat; não versionadas)
I5B-RC-LEGACY-OFF · I5B-RC-LIGHT-ON (1440) · I5B-RC-WIN125-1093x614-dsf125 · I5B-RC-LOGIN · I5B-RC-F9-NOTIFICACOES · I5B-RC-F10-EXEC · I5B-RC-F11-RELATORIOS · I5B-RC-F13-PRODUCTION. (1366 dedicado coberto pelo Win125 físico 1366×768.)

## GIT / RELEASE SAFETY (FASE 20)
**PR = NÃO · MERGE = NÃO · TAG = NÃO · GITHUB RELEASE = NÃO · DEPLOY = NÃO · VERSION BUMP = NÃO.** Build/package local de RC = SIM (gates acima). Nenhum commit no branch de produto nesta fase (zero mudança de source; binários não versionados por política real).

## RECOMENDAÇÃO
O RC executa a partir do artefato real, com versão correta, Light UI OFF por padrão, ativação controlada e kill switch funcionais no pacote, F1-F13 preservados, RC-D02/B2 vivos no asar, integridade criptográfica fechada de ponta a ponta. Pendências para a I5C: **exe/instalador em Windows REAL** (install/uninstall/reopen + MSI via CI oficial `windows-latest`) e **CDN cenário normal em rede aberta** — nenhuma bloqueia o QA de RC; são o próprio conteúdo da I5C.

**I5B = GO.**

**"O Release Candidate gerado está tecnicamente apto a seguir para I5C / RC Acceptance & Final QA?" — SIM.**
