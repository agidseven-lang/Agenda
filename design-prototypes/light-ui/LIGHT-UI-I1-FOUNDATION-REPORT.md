# LIGHT UI — I1 FOUNDATION REPORT

**Fase:** I1 — Foundation & Theme Infrastructure · **Status:** ENTREGUE — aguarda owner.
**Branch:** `impl/light-ui-foundation-1.0.246` (base `a4312c57` = Desktop 1.0.246 = tip atual;
tag `v1.0.246` = commit de build `0fa34335`, diff tag→tip = só workflow de release,
`desktop/src` idêntico). **Commit:** `0dc87ccb` · version **1.0.246 intacta** · zero
build/release/deploy · nenhum PR.

## 1 · ARCHITECTURE
Um único bloco `<style id="light-ui-foundation">` inserido no FIM do `<head>` do renderer
(depois do 6º bloco de estilo; hunk único @2669). Namespace técnico **`body.light-ui`** —
**nenhum código de produção aplica a classe** (zero JS alterado; sem localStorage/flag/
auto-detecção): ativação só pelo harness de validação. Sem a classe: efeito ZERO.
**Rollback = remover um bloco (+55/−0).**

## 2 · TOKEN MAPPING (fontes: contracts C1–C8 + ERRATA canônica; nunca screenshots)
`--lui-*`: surfaces (canvas #F5F6F9 · surface #FFFFFF · soft #FAFBFD · sunk #F1F4F8) · texto
(#14181F · #4B5364 · **#697181 E1** · **#6E7786 E2**) · brand #5B7CFA + **brand-ink #4353D8 E3**
· semantic accent×ink E7 (green #22A06B/#12784C · warning #F59E0B/#B45309 · danger #EF4444/
#C4302B · info #60A5FA/#2563EB · crit #E11D48/#B10E38 · sys #9CA3AF/#5B6472) · borders (#E8EBF1
· #EFF1F6 · control #DFE3EB, justificativa E9) · focus #6E5EF3 + halo rgba(110,94,243,.11) ·
radius 12/16/18/999 · shadows Golden (card/elevated/drawer/modal) · **grad E4
135° #6E5EF3→#8356E6** + shadow · sidebar (#252B3D/#1B2031/#D0D5E1/#9299AC/**#828AA8 E6**).
**Base canvas (Gate 12):** re-declara SÓ as vars que o app consome (--bg/--surface/--surface2/
--line/--line-soft/--ink/--soft/--faint) — o mesmo padrão do `body.light` real; `--accent`/
`--grad` reais NÃO mapeados (I2+). `color-scheme:light` (paridade com body.light).
**Não criado:** `brand-hover` (sem valor canônico — hover Golden é mecânica C8, não hex).

## 3 · PRECEDENCE (auditada e testada)
`:root` dark → `body.light` → `body.hc` → **`body.light-ui`** (bloco no fim do head) →
**`body.light-ui.hc`** (re-aplica os valores do `body.light.hc` REAL: ink #000000 · soft
#232936 · faint #3E4657 · line #8890A2 · line-soft #A8AFC0) — **HC continua soberano**.
Guardrail R8 P0 (fonte: R8 §12.1) restrito ao namespace, em seletores estruturais REAIS
auditados: `body.light-ui.desktop.authed #app>*` e `body.light-ui .topbar>*` (no-op hoje; os
contêineres Golden da I2+ nascem com o guardrail).

## 4 · VALIDATION (harness scratchpad; sem Electron/Firestore; nada versionado)
- **Computed tokens (Gate 20): PASS** — ~30 tokens lidos via getComputedStyle == valores
  literais da errata/contracts; `--bg` resolvido rgb(245,246,249).
- **Isolamento: PASS** — sem classe, `--lui-*` vazios; `--bg` #0A0B10 (dark original).
- **HC precedence: PASS** — light-ui+hc ⇒ ink #000000/line #8890A2 (HC vence), fundo claro.
- **Legacy regression (Gate 21): PASS com prova dupla** — original×modificado SEM a classe em
  dark/light/hc/light+hc @1920: artefato de ~370px identificado como SPINNER animado (provado
  por base×base no mesmo bbox); com animações congeladas nos dois lados: **0 pixels, bbox=None
  nos 4 cenários**.
- **Light-ui smokes (Gates 22–24): PASS** — 1920/1366/win125 (viewport+DSF exatos) + hc +
  zoom 1.1/1.25: canvas claro, texto canônico, `scrollWidth == viewport` (sem overflow),
  estrutura íntegra; superfície representativa = tela real de conexão/boot ("Aguardando
  conexão"). Accents legados (logo/spinner/pills azul #5B6CFF) inalterados — ESPERADO
  (--accent não mapeado; fidelidade de componente começa na I2/I3).

## 5 · VALIDATION MATRIX
| Teste | Dark | Light legado | HC | Light+HC | Light UI | LUI+HC | LUI 110% | LUI 125% |
|---|---|---|---|---|---|---|---|---|
| Pixel-idêntico ao original (sem classe) | PASS (0px) | PASS (0px) | PASS (0px) | PASS (0px) | n/a | n/a | n/a | n/a |
| Tokens resolvem/estrutura íntegra | n/a | n/a | n/a | n/a | PASS | PASS | PASS | PASS |
| Overflow estrutural | — | — | — | — | PASS (1920/1366/win125) | PASS | PASS | PASS |

## 6 · DIFF
1 arquivo (`desktop/src/renderer/index.html`) · **+55/−0** · 1 hunk (head) · zero handlers/
strings funcionais/versão/workflows/Firebase no diff (grep = 0) · fluxo funcional = ZERO
mudança. Desvios vs rascunho I0 (registrados): flashToast aria-live e toast X hit 28 ADIADOS
para as fases de componente (Gate 25 do mandato I1 proíbe tocar componentes específicos).

## 7 · ROLLBACK
Remover o bloco `<style id="light-ui-foundation">` (um diff pequeno; nenhuma outra referência
existe no app). **A11Y-D01 (upload P0) segue rastreada como GLOBAL IMPLEMENTATION BLOCKER**
(fase I9 + gate I11). Próxima fase proposta: **I2 — Core Shell** (sidebar/header/canvas), após
GO do owner.
