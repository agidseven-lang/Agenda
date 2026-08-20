# LIGHT UI — I3A.4 · F1 V4 FUNCTIONAL CLOSURE REPORT

**Fase:** I3A.4 — fechamento funcional do F1 (filtro por responsável real). **Status:**
GATES PASS → **F1 V4 = IMPLEMENTADO / GOLDEN / CONGELADO** (autorização condicional do
owner cumprida). **Branch:** `impl/light-ui-f1-v4-final-1.0.246` de `93ffc235` (porte v4
APROVADO) · **checkpoint único `f10aabe0`** · 1 arquivo, +43/−19 · version 1.0.246 ·
zero build/release/deploy · nenhum PR · Light UI inativa para usuário.

## 1 · AMENDMENT
**V4-FUNCTIONAL-CONFLICT-01 = RESOLVIDO PELO OWNER (2026-08-20).**
Resolution: **IMPLEMENT RESPONSIBLE FILTER.** Registrado no roadmap.

## 2 · A FUNÇÃO (Decisão 1)
- **Escopo:** somente Meu Quadro/F1 (`renderPersonBoard`), gated por `body.light-ui`.
- **Semântica:** `respOf(t)` REAL — a mesma definição de responsável primário do produto
  (assigneeId → designerAssignment.designerId → by, resolvida em `state.users` com os
  fallbacks reais). Nenhuma semântica nova.
- **Client-side/in-memory:** filtra a coleção apresentada; task object/status/coluna/SLA/
  prazo/workflow intocados; **zero escrita** (Firestore/Functions/Worker/API/localStorage).
- **Controles (v4):** "Filtrar por responsável:" + chips (avatar real, primeiro nome real,
  anel/cor `userColor` real, `.on` + `aria-pressed`, `:focus-visible` ring, alvo 42px,
  wrap) + "Todos" (remove o filtro). Seleção única. Chips derivados das PRÓPRIAS tasks do
  board → lista respeita a visibilidade real (não vaza equipe).
- **Busca + filtro:** interseção (`resultado = responsável ∧ busca`); nenhum controle
  anula o outro; limpar a busca preserva o filtro e vice-versa.
- **Counts/KPIs:** refletem a visão filtrada (ex.: 9→3 cards; counts 3/2/2/2 → 1/1/1/0;
  KPIs 7→3 ativas). Legenda estável = pessoas do board.
- **Coluna vazia:** empty state REAL (`kbv2-empty2`); nenhum card fake.
- **Persistência:** estado vive só na surface — `boardRespFilter` reseta junto aos resets
  reais de `boardQuery` (navegação/logout); guard remove filtro de pessoa fora da visão.
- **Moldura:** painel docado realinhado à nova extensão das colunas (230..911) — a única
  mudança de layout decorrente da linha nova.

## 3 · DECISÕES 2 E 3 (cumpridas)
KPIs inalterados = **somente dados reais** (ativas/conclusão/atrasadas derivados;
SLA como estado real "Em dia"/N alertas; **sem** 78%/98%/+12%/−2%/+5%/sparklines/série).
Sidebar auxiliar ("ID Seven · Agência", "Plano Business 80%") = **VISUAL REFERENCE —
FUNCTION NOT AVAILABLE**: nenhuma função/assinatura/percentual/switcher fictício criado.

## 4 · TESTE FUNCIONAL OBRIGATÓRIO — 14/14 PASS
Todos→Beatriz→Caio→Todos (cards 9→3→3→9; counts por coluna corretos; seleção única com
`aria-pressed`); busca "Reels" (1) ∧ Beatriz (1) ∧ Caio (0 + 4 empty states reais);
limpar busca mantém filtro; painel abre com filtro ativo (392px docado, foco no X) e
lifecycle completo (Esc/fechar/retorno de foco/clique-fora) PASS.

## 5 · REGRESSÃO — ZERO
Zone metrics vs `93ffc235`: sidebar 266, busca 574×48, tab tint `#E9F0FC`, colunas r14
brancas, card r12/pad 13-13-11/título 13.5-800, KPIs 96/`repeat(4,1fr) 392px`, canvas
`#FDFEFE` — **14/14 PASS, zero desvio**. Smoke 8/8. 1920/1366/win125 sem overflow.
**Legado sem a classe: 0px** (dark/light/hc, relógio congelado, board montado).
UI UX Pro Max aplicada nos chips (button real + estado exposto; foco visível; alvo ≥24px;
wrap da coleção) — v4 venceu nas decisões visuais.

## 6 · GATE FINAL DO F1 — TODAS AS CONDIÇÕES DO OWNER: PASS
v4 MATCH ✓ · filtro funciona ✓ · counts ✓ · search+filter ✓ · KPIs reais ✓ · painel
intacto ✓ · responsive ✓ · legado 0px ✓ · zero backend write ✓ →
**F1 V4 = IMPLEMENTADO / GOLDEN / CONGELADO** (registrado no roadmap).

## 7 · PRÓXIMO
**I3B — F2 Cliente: NÃO iniciada** — aguarda GO explícito do owner.
**Rollback:** reverter `f10aabe0`.
