# ACCESSIBILITY TOKEN ERRATA — R9.1 (Light UI)

**Status:** ✔ **CANÔNICA — APROVADA PELO OWNER (R9.1 = GO, commit `363d221`; registrada na R10).**
Este documento é a fonte canônica dos tokens corrigidos. Prancha: `r9-1-accessibility-token-closure.html`
(imagem entregue no chat). **Golden Update Policy (§8 do mandato):** os Frames Golden aprovados
**não foram sobrescritos** — esta errata define o TOKEN ERRATA/ACCESSIBILITY OVERRIDE que, após
GO do owner, passa a ser o valor **canônico dos contracts e da implementação**; as imagens
históricas Golden permanecem como registro de aprovação. **Zero produção · zero função alterada
· zero nova foundation.** Método: recalculado do zero a partir dos valores atuais dos contracts
(não do relatório R9); MENOR ajuste possível por item; contraste WCAG (luminância relativa)
provado antes/depois; regressão visual em 9 cópias isoladas (`r9-1-regression/`).

## 1 · ERRATA (antes → depois → razão → contraste → impacto)

| # | Token/uso | Antes | Ratio antes | Depois | Ratio depois | Target | PASS |
|---|---|---|---|---|---|---|---|
| E1 | `--tx-3` (soft/placeholder/subtítulos) | `#767E8D` | 4.09 W · 3.78 CV | **`#697181`** | **4.91 W · 4.54 CV** | 4.5 | ✔ |
| E2 | `--tx-4` (th tabela, metas, timestamps) | `#A8AFBC` | 2.21 W · 2.04 CV | **`#6E7786`** + regra de superfície | **4.52 W** (canvas ⇒ usa tx-3′) | 4.5 | ✔ |
| E3 | `--brand-ink` **NOVO token global** — texto brand ≤18.66px e fundos sólidos brand c/ branco pequeno | brand cru `#5B7CFA` | 3.68 | **`#4353D8`** (promovido do “Abrir tarefa” real do F9) | **6.06 W · 5.60 CV** · branco sobre ele **6.06** | 4.5 | ✔ |
| E4 | `--grad` stop claro (CTA primário, dia selecionado) | `#9A6BF5` | branco 3.62 | **`#8356E6`** (stop 1 `#6E5EF3` intacto) | branco **4.73** (pior stop) | 4.5 | ✔ |
| E5 | `sla-k` (micro-label MONITOR SLA) | `#3E9C74` | 3.08 (s/ `#E8F8F0`) | **`var(--green-ink)` `#12784C`** (reuso) | **5.01** | 4.5 | ✔ |
| E6 | `--sb-faint` (apoio sidebar) | `#727990` | 3.74 sb-2 · 3.25 sb-1 | **`#828AA8`** + micro-labels do topo (nav-label, brand-sub) migram p/ `--sb-dim` | **4.74** (sb-2) · topo via sb-dim **4.94–5.68** | 4.5 | ✔ |
| E7 | **Regra global accent × ink (C8)** — formaliza prática já existente em F9 (`--ac/--cx`), F10/F11 (`sv-*i`) | cores cruas como texto | 2.15–3.76 | texto usa o **ink da família**: brand `#4353D8` · info `#2563EB` · success `#12784C` · warning `#B45309` · danger `#C4302B` · crítico `#B10E38` · sistema `#5B6472` | **5.02–7.02** | 4.5 | ✔ |
| E8 | Sólidos accent com **texto branco pequeno** (pill de visão ativa 3.68 · badge contagem/CRÍTICO 3.76) | `#3B82F6`/`#EF4444` bg | 3.68/3.76 | bg usa o **ink da família** (`#2563EB` / `#C4302B`) | **5.17 / 5.52** | 4.5 | ✔ |
| E9 | Borda de input `#DFE3EB` | 1.29 (UI) | — | **MANTIDA + justificativa técnica**: a borda não é o único identificador (label sempre visível + placeholder tx-3′ 4.91 + shape/radius consistentes + focus ring 4.26–4.61 ≥3) | — | 3 (UI)* | justificado |
| E10 | C6 toast X — hit target | 20×20 | < 24 (WCAG 2.2 2.5.8) | **hit/container 28×28** (glyph 13–15px e posição óptica INTACTOS; top/right −4px) | ≥ 24 | 24 | ✔ |
| E11 | F8 dots de tipo (color-only) | só cor (5px) | — | **cor + FORMA por tipo** (Gravação ● · Fotografia ■ · Reunião ▲ · Edição ◆ · Outro ○, 5–6px) + chips de filtro do F8 (cor+nome) = **legenda oficial**; nome acessível do dia = requirement de implementação (A11Y-D13 semântico) | — | não-cor | ✔ |

Cores cruas (`--brand/--blue/--green/--orange/--red/--crit`) **permanecem** legítimas e intactas
em dots/barras/ícones/fundos-tint (≥3:1 quando essenciais — green 3.33 ✓ · red 3.76 ✓) e em
números-KPI **grandes** quando ≥3:1 (red ✓; orange NÃO ⇒ KPI laranja já usa `#B45309` no Golden
F10/F11 — **auditado: nenhum KPI Golden usa laranja cru**).

## 2 · HIERARQUIA PRESERVADA (não virou preto)
`tx-1 17.79 › tx-2 7.72 › tx-3′ 4.91 › tx-4′ 4.52` — quatro degraus perceptíveis, reforçados
pelos contrastes de corpo/peso/tracking já Golden (tx-4 = 10.5–12px b700 uppercase vs tx-3 =
13–13.5px regular). Sidebar: `sb-tx 11.0 › sb-dim 4.9–5.7 › sb-faint′ 4.74`. **Disabled (R2)
reconfirmado:** continua componente esmaecido (`opacity:.6` + pointer-events:none — isento WCAG
por inativo) e claramente distinto do texto pleno; **OFF ≠ disabled** intacto (trilho `#CDD3DE`).
**Focus (C1/C8) reconfirmado sem redesign:** `#6E5EF3` + halo — 4.61 W · 4.26 CV ≥3 ✓; variante
danger contextual real mantida.

## 3 · REGRESSÃO VISUAL (cópias isoladas `r9-1-regression/`, Golden intocado)

| Critério | F1 | F7B | F8 | F9 | F10 | F11 | F12 | F13 | R5.1 |
|---|---|---|---|---|---|---|---|---|---|
| Hierarquia profissional | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Tela não ficou pesada | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Warning continua âmbar (não virou vermelho) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ |
| Green continua green | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ |
| Brand continua ID Seven | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Disabled distinto | — | ✔ (toggle OFF/`−` stepper) | — | — | — | — | — | — | ✔ |
| CTA continua Golden | ✔ | ✔ | ✔ | — | — | — | ✔ | ✔ | ✔ |
| Calendário limpo | — | — | ✔ | — | — | — | — | — | — |
| Toast compacto | — | — | — | — | — | — | — | — | ✔ |

## 4 · AXE BEFORE/AFTER (comparável: axe-core 4.13.0 · wcag2a/aa/21aa · 1920×1080 · mesmas páginas)

| Frame | color-contrast antes → depois | button-name/label (fora do escopo R9.1) |
|---|---|---|
| F1 | 25 → **1** | 10 → 10 |
| F7B | 15 → **2** | 2 · label 8 (mockup) |
| F8 | 37 → **2** | 3 |
| F9 | 23 → **8** | — |
| F10 | 32 → **5** | 1 |
| F11 | 46 → **6** | 1 |
| F12 | **0 → 0** | — |
| F13 | 4 → **3** | 4 |
| R5.1 | 31 → **7** | — |
| **Total** | **213 → 34 (−84%)** | requirements de implementação já registrados (R9 §20) |

**Resíduos (34) — todos classificados, nenhum silencioso:** (a) usos hardcoded/elemento-a-elemento
dos mockups que a REGRA já cobre no contrato mas que só seriam repintados numa V2 de frames —
**proibida pelo mandato** (ex.: rodapés sobre canvas em tx-4 ⇒ regra de superfície manda tx-3′;
labels de dia HOJE/ONTEM idem; botões Exportar verdes ⇒ regra ink); (b) timestamps de linhas
**read** no F9 (opacidade de estado lido sobre tx-4′ — implementação: read não aplica opacity
extra sobre texto-meta); (c) segmentos inativos sobre `--sunk` (4.4×, marginal — implementação:
texto de controle sobre sunk usa tx-2 ou sunk clareia 1 passo). Axe não substitui o cálculo
manual — os números canônicos são os da tabela §1.

## 5 · DÍVIDAS DE DESIGN RESOLVIDAS POR ESTA ERRATA (GO dado — efetivas)
A11Y-**D05** (tx-4) · **D06** (orange como texto — auditado: KPIs já usam ink; regra formalizada)
· **D07** (brand como texto) · **D08** (tx-3) · **D09** (gradiente CTA) · **D10** (sla-k ·
sb-faint · input border justificada) · **D11** (toast X hit) · **D13 visual** (dots + forma +
legenda; semântico permanece implementação). **NÃO resolvidas aqui (implementation guardrails
intactos):** D01 (upload P0) · D02–D04 · D12 · D14–D25 — nenhuma tocada.

## 6 · APLICAÇÃO (EM VIGOR — sem gerar V2 de 13 frames)
Os contracts citam os valores desta errata como canônicos (C1 §tokens · C6 §toast ·
C8 §inks/estados · F8 §dots). Implementação usa SEMPRE a errata; imagens Golden históricas não
são regeradas. Qualquer novo componente nasce já com tx-3′/tx-4′/inks/grad′.
