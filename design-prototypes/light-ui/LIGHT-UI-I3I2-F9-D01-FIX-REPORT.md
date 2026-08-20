# LIGHT UI — I3I.2 · F9-D01 — FIX REPORT

**Bug:** F9-D01 — dupla ativação por TECLADO no controle interno "Abrir tarefa" (nested interactive)
**Base defeituosa:** `d74b7fcf` · **Branch:** `fix/light-ui-f9-d01-keyboard-1.0.246` · **Checkpoint do fix:** `ad8dd9d3`
**Versão:** 1.0.246 (inalterada) · **Resultado:** **I3I.2 = PASS · F9-D01 = RESOLVIDO · F9 = PRONTO PARA CONGELAMENTO DO OWNER · CHECKPOINT CANDIDATO = `ad8dd9d3`.** F10 NÃO iniciado.

---

## FASE 1 — Reauditoria e reprodução ANTES (evidência)
Estrutura defeituosa literal: `div.nc-row[data-nc-open][role=button][tabindex=0][aria-label]`
(onclick + onkeydown) contendo `div.nc-open[data-nc-deep][role=button][tabindex=0]` (onclick
com stopPropagation; onkeydown SEM stopPropagation). Bubbling: keydown do controle interno →
nc-right → nc-row (onkeydown dispara segunda ativação). **Reproduzido antes do fix:**
Enter/Espaço no "Abrir tarefa" ⇒ `{modal: 1, panelAlso: TRUE}` (deep abre E o nc-detail da
row abre atrás).

## FASE 2 — Decisão a11y (estrutura, não máscara)
Nested-interactive CONFIRMADO e ELIMINADO estruturalmente: a row `nc-row` voltou a ser
**container puro** (mouse via onclick; sem role/tabindex/aria) e a ação acessível "abrir
detalhe" passou ao **filho REAL `.nc-body`** (área principal de conteúdo — IRMÃO do controle
"Abrir tarefa"; reutilizado elemento existente, sem wrapper novo, sem CTA novo, deep-link
continua acessível ao teclado). Handler de teclado religado nos ALVOS FOLHA
(`.nc-row .nc-body[role="button"]` + controles) com `preventDefault` + **`stopPropagation`**;
o `click()` do nc-body bubbla até a row e aciona o onclick real exatamente 1×.

## FASE 3 — Invariantes (medidos no harness, não inspeção)
**A. Row/detalhe:** mouse na área da row = 1 nc-detail, 0 deep ✓ · Enter no nc-body = 1
abertura, 0 deep ✓ · Espaço no nc-body = preventDefault, 0 scroll, 1 abertura, 0 deep ✓.
**B. "Abrir tarefa":** mouse = 1 route, 0 nc-detail ✓ · Enter = 1 route, 0 nc-detail
(`{modal:1, panelAlso:FALSE}`) ✓ · Espaço = 1 route, 0 nc-detail, preventDefault, 0 scroll ✓.
**C. Propagação:** nenhum click/keydown duplo; nenhum bubbling aciona ação secundária;
nenhum listener 2× (contadores de efeito no harness).

## FASE 4 — Write invariance
Deep em unread: markRead conforme código real (1 setItem, ANTES do route), navbadge 1×,
route 1× ✓. Deep em read: 0 write (idempotência literal `ch`), route 1× ✓. Abrir só o
detalhe: markRead exatamente como o real determina ✓. **Nenhum write novo.**

## FASE 5 — Focus
Tab order real: nc-body (detalhe) → "Abrir tarefa" — duas ações distinguíveis; tabindex sem
duplicação (row perdeu o dela); nomes coerentes (aria-label descritivo no nc-body; texto
"Abrir tarefa" no controle); foco visível (outline #4353D8 no novo alvo, CSS F9-gated);
pós-fechar detail a F9 segue utilizável; pós-deep o retorno mantém a Central operável ✓.

## FASE 6 — Screen reader semantics
Nó anunciado como detalhe = `.nc-body` (role=button + aria-label "Notificação [não lida]:
…"); nó "Abrir tarefa" = `.nc-open` (role=button, nome pelo texto). **Prova estrutural no
DOM da Central: NENHUM `[role=button]`/link/button/`[tabindex=0]` descendente de
`[role=button]` → nested interactive = NÃO** (gate g10e). RESULTADO OBRIGATÓRIO atendido.

## FASE 7 — Visual (before `d74b7fcf` × after)
**4/4 = 0px:** F9 1920 · 1366 · win125 · DETAIL-1920. CSS tocado = 1 seletor F9-only gated
(focus-visible movido de `.nc-row` para `.nc-row .nc-body`). Cores/spacing/tipografia/link/
dots/badges/rows/painel/largura/responsivo intactos.

## FASE 8 — Re-run completo do hardening
**54/54 PASS** — os 49 da I3I.1 (G3–G14 todos reprovados: write map, markRead 8/8, markAll
5/5, clear 2/2, storage failures 7/7, routing/order 5/5, row keyboard 4/4, read-side 8/8,
source of truth 4/4, filtros 4/4) **+ 5 invariantes novos exigidos pela I3I.2** (Espaço no
controle interno; mouse na área da row; prova estrutural de não-aninhamento; nomes
distintos; usabilidade pós-fechar) — mudança de contagem 49→54 explicada. G10 (o gate que
falhava) agora PASS. Smoke funcional da I3I: **28/28**.

## FASE 9 — Legacy
**7/7 = 0px puro SEM máscara** (dark/light/hc × {populada, filtered-empty} + Central de
Detalhes dark aberta). Sem sino nessas capturas — A–E não necessária.

## FASE 10 — Regressão F1–F8 (novo checkpoint obriga)
23 pares base `d74b7fcf` × fix: **17/17 não-flaky = 0px puro** (F1 board+painel · F2
board+painel · F6 default · F7 Setor+Dados · F8 month/list/detail · legacy 7). Os 6 pares
F3/F4/F5 board+painel divergiram SÓ na zona do sino: **política A–E aplicada
per-superfície** — em CADA par, o próprio base×base (A) ou cur×cur (B) divergiu SOZINHO na
MESMA bbox exata do diff (f3b: 1458,26→1500,68 = o sino do board F3 provado por A sem
código no meio; demais: 1443,29→1485,71), e o par base×cur mascarado APENAS pela bbox
provada por A/B = **0px fora em todos**. Máscara não ampliada. F8 congelado @ `1cf13637`.

## FASE 11 — Escopo do diff
**1 arquivo (`desktop/src/renderer/index.html`), +11/−5, 4 alterações:** (1) atributos
a11y saem da row; (2) entram no `.nc-body`; (3) keyables = alvos folha +
`stopPropagation`; (4) 1 seletor CSS de focus-visible. Funções tocadas: `ncRow`,
`afterNotifCentral`. Zero alteração incidental; zero mutation/routing/filtro/source-of-truth.

---

**I3I.2 = PASS · F9-D01 = RESOLVIDO · CHECKPOINT CANDIDATO = `ad8dd9d3` · F10 NÃO INICIADO.**
