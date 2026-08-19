# LIGHT UI — I2.1 CORE SHELL GOLDEN ALIGNMENT REPORT

**Fase:** I2.1 — correção cirúrgica da I2 (gate final do Core Shell) · **Status:** ENTREGUE —
aguarda owner. **Branch:** `impl/light-ui-core-shell-refine-1.0.246` (base EXATA `6a4ea142` =
I2). **Commit:** `c368a6c2` (único; código) · version **1.0.246 intacta** · zero build/release
· nenhum PR · checkpoints I1/I2 intactos (histórico preservado; a I2.1 é aditiva).

## 1 · BRAND AUDIT (A)
- **Markup real:** `.sb-brand` = `.logo.sm.brandlogo` + `.nm` "ID Seven" + `.sy` "sincronizado"
  (gerado por `nav.innerHTML`; nenhum código lê o texto do `.nm` — sem função operacional).
- **Asset real:** `--logo` = **data-URI PNG embutido** (`:root`, linha ~21) — mark circular
  oficial (anel gradiente roxo→magenta + glifo branco). `.logo.brandlogo` real aplica
  `background:var(--logo) contain !important; border-radius:0 !important; box-shadow:none
  !important` (por isso a sombra declarada na I2 era ANULADA — gap visto nas provas I2).
- **Golden asset encontrado? SIM — como asset real do produto.** O `.brand-mark` do Golden
  (caixa 46 gradiente + glifo `#i-logo` genérico) era **stand-in de protótipo**: o produto
  possui o mark oficial. Decisão (regra "REUTILIZAR; não inventar identidade"): **asset real
  em 46px** com o peso Golden (sombra `0 8px 20px rgba(94,110,243,.4)`) e `border-radius:50%`
  (o mark é circular), via `!important` espelhando o real. Nenhuma imagem nova/versionada.
- **Label:** Golden congelado define **"Agenda ID Seven"** (`.brand-name`). Implementado como
  **VISUAL/BRAND COPY, não funcional**, SOMENTE sob a classe: `.nm{font-size:0}` +
  `.nm::before{content:'Agenda ID Seven'}` (18/700, −.014em, #F5F7FB, lh 1.14). **Markup/JS
  intocados** ⇒ Gate J (legado 0px) preservado — mudar o literal alteraria o tema dark de
  produção e quebraria o 0px exigido. Dívida cosmética registrada: leitores de tela podem
  anunciar o par ("Agenda ID Seven" + "ID Seven") no bloco decorativo; resolve-se trocando o
  literal (1 palavra) quando o owner oficializar o tema (I12) — ou antes, se o owner preferir
  aceitar diff visual no legado. Nome de pacote/app/versão inalterados.
- **Dimensões Golden:** mark 46 · nome 18/700 · sub 12 sb-faint + dot 6px #33D6A6 halo (gap 6)
  · sidebar segue 284 (inalterada).

## 2 · HEADER OWNERSHIP (B) + GEOMETRIA (C)
- **Topbar legado continuou oculto** (`display:none !important`, decisão de produto 1.0.140).
  Nenhum título global falso foi criado.
- **Distinção aplicada:** SURFACE HEADER CONTENT (ícone/título/subtitle/actions) → I3+;
  CORE SHELL TOP GEOMETRY → I2.1: **banda de `--lui-hd-h:92px`** — valor reconfirmado no
  Golden V10 congelado (`.main{grid-template-rows:92px 72px 64px 1fr}`; 72/64 = toolbar/filtro
  de SURFACE) — pintada como **camadas de background do scroller real `.content`** (surface +
  hairline @92px sobre o canvas; `background-attachment` padrão = fixa no topo do scroller).
  Lê como SHELL/HEADER BAND contínua, não como card isolado; canvas Light abaixo.
- **Reserva do título:** a posição (esquerda da banda, eixo 34px) fica reservada; no screenshot
  o marcador tracejado "ÁREA DO TÍTULO DA SURFACE (I3+)" é **harness-only** (nenhum placeholder
  textual no renderer). **Contrato de encaixe I3+:** cada surface assenta seu head dentro da
  banda (o alinhador real `slaClusterAlign` já centra o cluster no head do quadro — em produção
  os dois mecanismos convergem).
- Em `board-mode` o padding do content legado vem de seletor com ID (`#content.board-mode`,
  força maior) — inalterado; ajustes por surface pertencem à I3.

## 3 · MONITOR SLA (D) + SINO (E) — ELEMENTOS REAIS
- **Mecanismo real auditado:** `slaibRefresh()` (produção) cria/remove `#cornerAvatar`,
  `#slaib-bell` (`slaibRender`: `svg('bell')` + `.slaib-count` + click `slaibToggle`) e
  `#sla-monitor` (`slaMonRender`: `.slamon-chip` com orb + kicker "Monitor SLA" + selo
  "ao vivo" + status real `slaMonStatusText` — **"Tudo em dia"** no estado calmo, o MESMO
  texto do Golden) sob o gate real `isOperationalBoardContext()` (Kanban real). Estilos do
  componente são INJETADOS por JS (`slaibEnsureStyle`); alinhamento por estilos inline
  idempotentes (`slaClusterAlign`: top = centro do head do quadro; right encadeado a +10px).
- **Skin CSS-only (zero função):** chip 50 r14; **verde Golden literal** (tint
  `linear-gradient(180deg,#F1FBF7,#E8F8F0)` + ring `#CBEEDD` + orb 34 branco r10 c/ sombra
  Golden + ícone `--lui-green` + kicker 9.5/800 `--lui-green-ink` **(errata E5)** + "ao vivo"
  green-ink + status 14/650 `#115E3D`); **amber/red** re-tintados com os **inks canônicos E7**
  (texto pequeno nunca cru) e **badges/segs em ink (E8)**; estado B (cobrança f354g) re-inked
  (nome tx-1, "+N" sunk/hair). **Sino:** 46 squircle r14, surface + hairline interna, ícone
  20px tx-2, badge count `--lui-danger-ink` c/ ring branco. **Avatar** 46 (Golden av-46).
- **Geometria do cluster:** top na banda via CSS (`21/23px !important` — o runtime continua
  escrevendo inline sem briga visual) e **right fallback = EXATAMENTE os px do runtime**
  (avatar 34 · bell 90 = 34+46+10 · monitor 146 = 90+46+10; `slaClusterAlign` produz os
  mesmos valores quando roda com head real ⇒ convergência CSS×JS). Gap real 10px mantido
  (Golden 14 — delta consciente: o valor vem do runtime intocado).
- **Preservado 100%:** cálculo, polling (30s/1s/boundary), severidade, textos dinâmicos,
  contadores, handlers, unread/click/state do sino. Dívida de accessible-name do sino segue
  alocada ao hardening (I11), como mandado.
- **Dropdowns/painéis** (`slamon-pop`, `slaib-panel`, `sla-block`) permanecem **dark
  auto-contidos** (legíveis; Golden não os define) → re-skin nas fases de componente.
- **Harness:** cluster criado pelo `slaibRefresh()` REAL com **dados mínimos** (state.user
  real de teste; `state.tasks=[]` ⇒ estado calmo verde) + contexto mínimo p/ o gate real
  (`content.board-mode` + stub `.kanban>.kcol` oculto — o gate é querySelector). **Nenhum
  HTML manual imitando o Monitor/sino** (o fake da I2 foi substituído pelo pipeline real).

## 4 · VALIDAÇÃO
| Perfil | navw | overflow | monitor (right·top·h) | bell | avatar | P0 cluster |
|---|---|---|---|---|---|---|
| 1920×1080 @1 | 284 | 0 | `.slamon.green` · 146·21·50 · "Tudo em dia" | 46² r14 surface @90 | 46² @34 | PASS |
| 1366×768 @1 | 284 | 0 | idem (left 1005 > 284) | idem | idem | PASS |
| **1093×614 @1.25 (win125)** | 284 | 0 | idem (left 732 > 284) | idem | idem | **PASS (P0)** |
- Tokens computados: banda 92px; chip bg `linear-gradient(rgb(241,251,247), rgb(232,248,240))`;
  kicker `rgb(18,120,76)` = #12784C (E5); status `rgb(17,94,61)` = #115E3D; orb 34 branco r10;
  brand `::before "Agenda ID Seven"`; logo 46 r50%.
- **Nav smoke: 11/11 OK** (handlers reais; todas as abas + sb-user→perfil).
- **HC smoke:** monitor real renderizado, sem overflow (finalização HC = I11).
- **Font zoom 125:** sem overflow.
- **Legado (Gate J): 0px** — I2 (`6a4ea142`) × I2.1 (working) SEM a classe, animações
  congeladas, @1920: **bbox=None em dark, light legado e hc**.

## 5 · COMPARAÇÃO OBRIGATÓRIA — Golden × I2 × I2.1
| Item | Golden | I2 | I2.1 |
|---|---|---|---|
| Brand mark | mark 46 c/ peso (stand-in gradiente) | logo real 46 SEM sombra/radius (anulados por !important do real) | **asset real 46 + sombra Golden + r50% = GOLDEN (identidade real)** |
| Brand name | "Agenda ID Seven" 18/700 | "ID Seven" | **"Agenda ID Seven" 18/700 (sob a classe) = GOLDEN** |
| Sidebar width | 284 | 284 ✓ | **284 ✓** |
| Active nav | pill+ring+barra gradiente | ✓ | **✓ (inalterado)** |
| Header geometry | faixa 92px surface + hairline | ausente (só canvas) | **banda 92px + hairline + reserva do título = GOLDEN** |
| Monitor SLA | chip verde tint "MONITOR SLA • AO VIVO / Tudo em dia" | não demonstrado | **REAL, verde Golden (tint/ring/orb/E5) "Tudo em dia" na banda = GOLDEN** |
| Bell | 48 squircle surface+hairline | fake skin flutuando no canvas | **REAL 46 squircle surface+hairline+badge ink na banda ≈ GOLDEN (46 vs 48: runtime)** |
| Canvas | #F5F6F9 abaixo do header | ✓ (full) | **✓ abaixo da banda = GOLDEN** |

Deltas conscientes registrados: bell 46 vs 48 e gap 10 vs 14 (valores do RUNTIME real
preservado — forçá-los exigiria brigar com `slaClusterAlign`); mark real circular no lugar do
stand-in gradiente do protótipo (identidade oficial).

## 6 · SELECTOR AUDIT (I) + DIFF
Todos os novos seletores sob `body.light-ui`; alvos: `.sb-brand` (shell), `.content`
(contêiner shell — só padding/background), `.corner-avatar`/`.slaib-*`/`.slamon*` (cluster
compartilhado). **Nenhum seletor atinge** `.kcol`/cards/calendar/wizard/tabelas/reports/
notificações/modais (grep no diff = 0). **Diff:** 1 arquivo · **+95/−0** · **1 hunk**
(`@@ -2802,0 +2803,95 @@`, inserção pura no fim do bloco) · greps
firestore/firebase/localStorage/addEventListener/version/workflow no diff = **0** ·
**functional/JS diff = ZERO** (nenhuma linha de JS/markup alterada).

## 7 · ROLLBACK & PRÓXIMO
Rollback: remover a seção `I2.1` do bloco (ou o bloco inteiro = I1+I2+I2.1). Light UI segue
INATIVA para usuário (classe só por harness; sem localStorage/flag/Firebase/auto-enable).
**Gate de saída: GO do owner (fecha I2 + I2.1).** Próxima fase proposta após GO: **I3 —
Boards F1–F5** (o head do quadro assenta na banda; primeiro consumidor do contrato de encaixe).
