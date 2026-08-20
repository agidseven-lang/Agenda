# LIGHT UI — I5C.1 · RC ENVIRONMENTAL ACCEPTANCE CLOSURE

**RC SOURCE FROZEN:** `dcc019ca` · 1.0.246 · **ZERO SOURCE CHANGES nesta fase** (nenhum arquivo tocado; nenhum commit de produto). Sem tag/release/deploy/bump/distribuição. Bateria: 2026-08-20T23:51Z.

## RESULTADO EXECUTIVO
Esta sessão **não dispõe do ambiente que a I5C.1 exige**: continua sendo um **container Linux x86_64** (0 binários Windows; `uname: Linux 6.18.5-fc-v20`) e a política de rede da sessão **mantém 403 no host exato do app** (`www.gstatic.com` — re-provado às 23:51Z; o proxy é mandatório na sessão e não pode ser desabilitado). Pela regra da fase — QA sem nenhum contorno — o que era executável foi executado (preflight de source, reaudit literal do CI, re-probe de rede, security), e o restante fica registrado sem simulação:

- **RC-A01 = OPEN** — Windows real inexistente na sessão: Fases 2–15 (npm ci/build/dist no Windows, NSIS+MSI, install/first-boot/uninstall/reinstall reais, Win125 com scaling NATIVO) fisicamente inexecutáveis aqui. Nenhum resultado foi fabricado.
- **RC-A02 = OPEN** — re-probe real do CDN: `curl -I https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js` → **HTTP/1.1 403 Forbidden** (proxy da sessão). "Rede real sem o proxy" não existe nesta sessão. (Registro adicional: o CONNECT a `firestore.googleapis.com` abre túnel — o bloqueio é seletivo por host; o host hardcoded do app segue barrado, e mudar host = mudança de source, proibida.)
- **RC-A03 = OPEN (novo, exigido pelo mandato)** — **CI RELEASE PIPELINE REQUIRES OWNER-AUTHORIZED CHANGE.** Reaudit literal (Fase 1) abaixo.

## FASE 0 · PREFLIGHT (executado — lado source)
HEAD `dcc019ca` exato · worktree limpa · 1.0.246 · renderer SHA-256 `bd5001b1ec24…` e lockfile `901d8fe0…` **byte-idênticos ao baseline congelado** · 0 tags · 0 release/deploy · 0 mudanças automáticas. **Identificação do Windows: IMPOSSÍVEL — não há Windows nesta sessão** (registro exigido pela fase, respondido com o fato).

## FASE 1 · REAUDIT DO CI (executado — literais exatos, workflows NÃO editados)
- **`desktop-build.yml`** (canônico, `[manual] F3.4.6`): linha 66 — `[ "$APP_VERSION" = "1.0.183" ] || exit 1` — **pinado à versão 1.0.183**; `dcc019ca` (1.0.246) falha no gate de versão. Tem input `ref`, mas o gate mata qualquer outra versão.
- **`desktop-build-f356bh2.yml`** (linhagem 1.0.246): linha 42 — `[ "${GITHUB_REF_NAME}" = "desktop/f356bh2-workflow-notifications-premium-1.0.246" ] || exit 1` (**branch fixa**); linhas 115/162-168 — **gate de ISOLAMENTO**: "produção (src/) = SOMENTE os 2 renderers vs 1.0.245 (743dfa2)" — o RC altera `index.html` muito além do escopo do hotfix f356bh2 (Light UI + B1 + B2 + RC-D02) ⇒ **falha por construção** (por branch E por isolamento). Motivo documentado: cada workflow da casa é um invólucro de UMA fase/versão específica com invariância pinada à sua base.
- **Processo de RELEASE real (a peça decisiva):** o repo tem **25 pares `desktop-build-fX` + `desktop-release-fX`** — um por versão. O release gated (ex.: `desktop-release-f356bh2.yml`) **"NÃO RECOMPILA — TUDO PINADO: run id, digests, 5 hashes SHA-256, tag v1.0.246 no head EXATO; escritas só via GitHub App"**, e o seu Gate 2 exige que commits além do candidato toquem **apenas o próprio workflow de release**. ⇒ **Classificação B: o workflow É obrigatório para o processo real de release** — publicar a RC exigirá criar o novo par da linhagem (`desktop-build-<lightui-rc>` + `desktop-release-<lightui-rc>`, pinado ao head/hashes do RC), exatamente como as 25 versões anteriores fizeram. Isso é mudança versionada do repo, **fora do mandato desta fase** → **RC-A03 aberto, sem executar a alteração**. (Nota: para *produzir e aceitar tecnicamente* o artefato, o pipeline local npm `dist` é suficiente e já foi provado na I5B — a classificação A vale para o artefato técnico; a B, para a publicação.)

## FASES 2–15 · WINDOWS — **NÃO EXECUTADAS (RC-A01; sem simulação)**
Nenhum resultado inventado; nenhuma extração substituiu gate de instalação. O estado técnico do produto segue o provado na I5B/I5C sobre o artefato real (íntegro por hash, boot/OFF/ON/kill/F1-F13/RC-D02/B2/Win125-harness todos PASS).

## FASE 16–17 · CDN — **NORMAL não executável (RC-A02); BLOCKED segue provado**
Probe real registrado (host/status/hora; zero token). O fallback honesto sob bloqueio foi re-provado na I5C (4/4) no app do artefato — permanece válido por identidade de bytes.

## FASE 18 · SECURITY (executado)
Sweep dos novos outputs/probes: **zero segredo** (nenhum token/senha/certificado; headers de proxy não registrados além do status).

## FASE 19 · EVIDÊNCIAS
As 10 imagens `I5C1-*` exigidas retratam instalação/execução em **Windows real** — **impossíveis nesta sessão (RC-A01)**. Não foram fabricadas. As evidências equivalentes do app do ARTEFATO (I5B/I5C) permanecem no chat.

## FASE 20 · BLOCKER CLOSURE MATRIX
| BLOCKER | SUBGATE | RESULT | EVIDENCE |
|---|---|---|---|
| RC-A01 | Windows environment | **OPEN** | sessão Linux; 0 binários Windows |
| RC-A01 | npm ci/build/dist (Windows) · NSIS/MSI generated · NSIS install/boot · **Win125 nativo** · uninstall/reinstall · MSI install/boot/uninstall · artifact consistency NSIS×MSI | **OPEN (não executados)** | requerem Windows real |
| RC-A02 | CDN direct normal | **OPEN** | `curl` 403 do proxy (23:51Z) |
| RC-A02 | app boot / login UI em CDN normal · network restored | **OPEN** | dependem do item acima |
| RC-A02 | CDN blocked fallback | **PASS (I5C 4/4, válido por bytes)** | guard honesto no app do artefato |
| RC-A03 | CI release pipeline | **OPEN** | par build+release da linhagem RC precisa ser criado — decisão do owner |

## POSTO DE CONTROLE
**PR = NÃO · MERGE = NÃO · TAG = NÃO · GITHUB RELEASE = NÃO · DEPLOY = NÃO · BUMP = NÃO · SOURCE = `dcc019ca` IMUTÁVEL · ZERO SOURCE CHANGES.**

## RECOMENDAÇÃO
O produto segue sem nenhum defeito identificado; os três bloqueios são de **ambiente e de processo de publicação**, e os três têm o MESMO dono da chave: (1) uma máquina **Windows x64 real** do owner executa em ~15 min o roteiro já escrito (checkout `dcc019ca` → `npm ci` → `npm run dist` → instalar NSIS → OFF/ON/kill → uninstall/reinstall → MSI → 1 boot em **rede aberta** para o CDN normal) — fecha RC-A01 e RC-A02; (2) o owner autoriza a criação do par de workflows da linhagem RC (padrão idêntico aos 25 pares existentes) — fecha RC-A03. Alternativa para RC-A01/RC-A03 num só passo: autorizar o workflow de build RC dedicado (runner `windows-latest`) que produz NSIS+MSI oficiais com artifacts privados.

**I5C.1 = NO-GO** · **RC-A01 = OPEN** · **RC-A02 = OPEN** · **RC-A03 = OPEN**

**"O RC 1.0.246 está tecnicamente aprovado para RELEASE FINAL?" — NÃO** (aprovação técnica do produto no artefato: completa e sem defeitos; aceitação AMBIENTAL Windows/CDN e pipeline de publicação: pendentes de ambiente/decisão do owner).
