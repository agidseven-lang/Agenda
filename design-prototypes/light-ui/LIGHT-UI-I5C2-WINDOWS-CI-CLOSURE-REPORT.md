# LIGHT UI — I5C.2 · WINDOWS CI & ENVIRONMENTAL CLOSURE

**PRODUCT SOURCE (imutável):** `dcc019ca` · 1.0.246 · **ZERO mudanças de código de produto** (só `.github/workflows/` + docs, como autorizado). **Run oficial verde: `32431962343`** (windows-latest, 2026-08-21T00:15→00:20Z, **20/20 steps SUCCESS**) — https://github.com/agidseven-lang/Agenda/actions/runs/32431962343. Sem tag, sem GitHub Release, sem deploy, sem publicação, sem bump; release workflow **não executado**.

## VEREDITO
**RC-A02 = RESOLVED · RC-A03 = RESOLVED · RC-A01 = OPEN (residual mínimo interativo — 2 itens em OWNER-WINDOWS-CHECKS).** Nenhum defeito de produto; nenhum RC-A04.

## O QUE FOI CRIADO (infra CI, padrão dos 25 pares do repo)
- **`desktop-build-1.0.246-rc.yml`** — dispatch-only, `windows-latest`. Gates fail-closed: `core.autocrlf=false` → checkout + **`git checkout --detach dcc019ca` verificado por `git rev-parse`** → **PROVENANCE** (SHA-256 do renderer `bd5001b1…` e do lockfile `901d8fe0…` a partir dos BYTES DO OBJETO git + working tree) → `npm ci`/`npm run build` reais → `electron-builder --win nsis msi --publish never` → immutability pós-build → **HASH MANIFEST** → **GATE ASAR** (versão 1.0.246 empacotada; renderer==fonte `dcc019ca` byte-idêntico; **RC-D02=0**; flags do updater na ordem) → **CDN NORMAL fail-closed** (HTTP 200 + tamanho nos 2 scripts EXATOS `www.gstatic.com/firebasejs/10.12.2/…`) → **NSIS INSTALL real** (`/S`, exit 0; payload instalado byte-idêntico) → **SANITY no APP INSTALADO** (Playwright/_electron sobre o exe instalado: título 1.0.246; **SDK do CDN REAL carregado — `firebase.initializeApp` presente sem stub**; sem falso "Aguardando conexão…"; **default OFF absoluto**; RC-D02+tab order no login real; **ON pelo mecanismo real + reload persistente; kill**; screenshots) → **CDN BLOCKED** (hosts temporário → fallback honesto → **hosts RESTAURADO**) → **NSIS UNINSTALL (exit 0; `deleteAppDataOnUninstall:false` — userData PRESERVADO, registrado) → REINSTALL (exit 0)** → **MSI INSTALL (`msiexec /qn`, exit 0) → ARTIFACT CONSISTENCY: asar NSIS == MSI == build → MSI UNINSTALL (exit 0)** → artifacts PRIVADOS (retention 7).
- **`desktop-release-1.0.246-rc.yml`** — INERTE por construção: dispatch-only + frase de confirmação + **GATE 0 fail-closed pela variável de repositório `RC_RELEASE_GO='authorized-by-owner'` (inexistente até o owner criá-la)** + gates de proveniência (source/versão/renderer pinados; `build_run_id` obrigatório) + **step de publicação bloqueado com `exit 1` até mandato futuro**. Nunca disparado.
- Registro no default branch (exigência técnica do GitHub para dispatch; **precedente literal da casa**: "F3.5.5E: registrar desktop-release-f355e.yml (copia identica da branch da fase)"). Commits de infra: `e2b41928`/`f940e4e0`/`d3b2fcd4` (branch rc) espelhados em `994ad386`/`995366ea`/`3f4c53b8` (main). **CI INFRA COMMITs ≠ PRODUCT SOURCE** — o produto compilado vem do checkout verificado de `dcc019ca` (provado no log).
- Iterações honestas registradas: run 1 falhou no MEU provenance gate (CRLF do git Windows — corrigido com autocrlf=false + hash do objeto git); run 2 falhou no harness do sanity (resolução ESM do playwright — script movido para `desktop/`); esses dois runs **provaram no caminho**: NSIS+MSI gerados, bundle 174MB uploaded, NSIS install real PASS. **Run 3 = 20/20 verde.**

## RC-MANIFEST OFICIAL (windows-latest · PRODUCT_SOURCE=dcc019ca · unsigned por design)
| Artefato | Bytes | SHA-256 |
|---|---|---|
| `Agenda-ID-Seven-Desktop-1.0.246-x64.exe` (NSIS) | 82 549 920 | `ca94a337a9baf52647efd2173cc7508642108486df2bad337cbc60df32e5580d` |
| `Agenda-ID-Seven-Desktop-1.0.246-x64.msi` (**MSI — RC-B01 fechado**) | 92 561 408 | `91517b1ca27f585c1a83360ecb04c866e1653e796ead6d739d085ecdadb12e1b` |
| `…exe.blockmap` | 86 449 | `9902860b9128d6227e55a7694f154a052621a1dfdba77dc2a285828324d55105` |
| `latest.yml` | 376 | `5f6c39aeecba64a32b1f166032654330f556fdaad66ca31fd549ffbcf5119c51` |
| `app.asar` | 33 696 758 | `e1e2be5a2fc713695acee2d430db00ba5c254e39a219a4e679e32a5cafb0d221` |

Artifacts privados do run: `…-RC-bundle` (174 302 047 B) e `…-RC-sanity-screens` (screenshots do app instalado) — expiram 2026-08-28; **não são publicação**. Nota de proveniência: os bytes diferem dos do build Linux/wine da I5B (timestamps/ambiente de empacotamento) — a identidade de CONTEÚDO é garantida pelos gates (renderer do asar byte-idêntico à fonte `dcc019ca` nos DOIS builds; consistency NSIS==MSI==build no run). **O artefato canônico do RC passa a ser o do run oficial `32431962343`.**

## BLOCKER CLOSURE MATRIX (fase 19/20 do mandato)
| BLOCKER | SUBGATE | RESULT | EVIDENCE (run 32431962343) |
|---|---|---|---|
| — | Windows runner · checkout dcc019ca · renderer hash · lockfile hash · npm ci · build | **PASS** | steps 2-8 |
| RC-A01 | NSIS gerado · MSI gerado · artifact hashes | **PASS** | step 9+11, manifest |
| RC-A01 | NSIS install · NSIS uninstall · NSIS reinstall | **PASS** | steps 14/17, exit 0, payload byte-idêntico, userData preservado |
| RC-A01 | MSI install · MSI uninstall · artifact consistency | **PASS** | step 18, exit 0, asar NSIS==MSI==build |
| RC-A01 | default OFF · controlled ON · kill (app INSTALADO) | **PASS** | step 15 fail-closed |
| RC-A01 | **GUI do instalador NSIS (interface visível)** | **BLOCKED (interativo)** | instalação real provada em modo silencioso; a interface visível requer desktop interativo |
| RC-A01 | **Win125 NATIVO (display scaling 125% do Windows)** | **BLOCKED (interativo)** | runner sem controle de scaling de display; equivalente de harness (dpr 1.25 real) já provado na I5B/I5C |
| RC-A02 | CDN direct normal · app boot CDN normal · login UI CDN normal · CDN blocked fallback · network restored | **PASS (RESOLVED)** | steps 13/15/16 — HTTP 200 nos hosts exatos; SDK real carregado no app instalado; fallback honesto; hosts restaurado |
| RC-A03 | build workflow existe+verde · source pinado · provenance · NSIS/MSI corretos · release workflow existe · hard-gated · zero publicação · padrão do repo | **PASS (RESOLVED)** | este relatório + run verde + YAMLs |

## OWNER-WINDOWS-CHECKS (lista mínima para fechar RC-A01 — regra da fase: não declarar RESOLVED com residual interativo)
1. **Instalador NSIS com interface visível** (~2 min): executar `Agenda-ID-Seven-Desktop-1.0.246-x64.exe` do bundle do run numa máquina Windows interativa e concluir o assistente (a instalação silenciosa, o payload, o uninstall e o reinstall JÁ estão provados).
2. **Windows Display Scaling 125% nativo** (~3 min): com o app instalado, conferir visualmente ausência de overflow horizontal nas telas principais (o equivalente exato dpr 1.25 / CSS ~1093 já está provado por harness na I5B/I5C).

## SECURITY (fase 21)
Logs/summaries/manifest/YAMLs varridos: **zero segredo** (sem tokens impressos, sem credenciais; GITHUB_TOKEN nunca ecoado; app-update.yml sem segredo; sanity usa perfil limpo do runner sem credencial). Screenshots contêm apenas UI do app.

## SOURCE IMMUTABILITY (fase 22)
**APPLICATION SOURCE = `dcc019ca`** (gate de checkout + provenance no run; renderer do artefato byte-idêntico à fonte). **CI INFRA COMMITs** (main): `994ad386`→`995366ea`→`3f4c53b8`; (branch rc): `e2b41928`→`f940e4e0`→`d3b2fcd4` — nenhum toca produto (`git diff` = só `.github/workflows/`).

## RECOMENDAÇÃO
Pipeline oficial da linhagem RC existe, roda verde em Windows real e está pronto para o release gated futuro; CDN normal e bloqueado provados no app instalado; NSIS e MSI reais instalam/desinstalam/reinstalam com consistência criptográfica. Restam **5 minutos de verificação visual do owner** (2 itens acima) para o fechamento formal do RC-A01 — e o GO de RELEASE FINAL continua exclusivamente com o owner (workflow de release inerte até `RC_RELEASE_GO`).

**I5C.2 = GO** · **RC-A01 = OPEN (residual: 2 checks interativos)** · **RC-A02 = RESOLVED** · **RC-A03 = RESOLVED**

**"O RC 1.0.246 está tecnicamente aprovado para RELEASE FINAL?" — NÃO** (ainda não: pendentes os 2 OWNER-WINDOWS-CHECKS interativos do RC-A01; tudo o mais está verde e o release permanece bloqueado aguardando o GO explícito do owner).
