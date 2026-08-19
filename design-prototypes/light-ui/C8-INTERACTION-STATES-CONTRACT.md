# C8 — ESTADOS DE INTERAÇÃO & STAT-TILE · FOUNDATION CONTRACT (Light UI)

**Status:** CONSOLIDADA DOCUMENTALMENTE (R6) — aguarda owner; NÃO concluída. Nome formal
confirmado no `MASTER-SURFACE-MAP.md` §F. Fonte: Desktop **1.0.246** (inventário integral:
95 `:hover` · 21 `:focus-visible` · 11 `:active` · 62 `transition:` · 4 `aria-expanded` ·
1 `aria-busy` · **0 `aria-selected/current/pressed`**). Zero produção; **zero imagem nova**
(anchors existentes cobrem tudo — sem gap material).

## 1 · OBJETIVO / ESCOPO
Consolidar a GRAMÁTICA TRANSVERSAL de estados (como o produto comunica seleção, atualidade,
conclusão, atenção, indisponibilidade, leitura, contexto temporal e destaque) + o componente
próprio **stat-tile**. **C8 NÃO redesenha estados já Golden nem rouba ownership de C1–C7** —
referencia e organiza.

## 2 · OWNERSHIP MATRIX (auditada)
| Estado | Owner principal | C8 |
|---|---|---|
| Focus (tokens) | **C1** (#6E5EF3 + halo) | referencia + registra a REGRA GLOBAL real (§10) |
| Selected/checked (chips, option card, choice, checkbox, segmented) | **C1** | gramática (§4) |
| Menu open/focus contextual | **C3** | referencia |
| Modal open/trap | **C2** | referencia |
| Toast severity/dismiss | **C6** | referencia |
| Células/pills de tabela | **C7** | referencia |
| Disabled/OFF | **C1/R2** | princípio (§8) |
| Expanded/collapsed | **C1 accordion · C3 menus · C2 det-acc/dz-notes (summary)** | princípio (§11) |
| Current/completed/future (stepper) · done/atual/pendente/condicional (timeline) | **F7 (C1) · F6** | gramática comum (§5) |
| Read/unread | **F9 notification row** | princípios (§6) |
| Warning/critical | **sistema de COR SEMÂNTICA** (execSevHex/ncSev/SLA) — é STATUS/SEVERITY, não interação | apenas referencia (§7) |
| Temporal (today/dim/overdue/upcoming) | **F8 calendário · taskDeadline/SLA** | gramática (§13) |
| Sync/conectividade | **Shell** (dot "sincronizado") · **C5** (splash offline) · **Prioridades/B** (banner offline) | gramática (§15) |
| Hover · Active/pressed | **C8** (transversais reais) | owner (§9) |
| **Stat-tile** | **C8** | owner (§14) |

## 3 · PRINCÍPIO GLOBAL (formalizado)
**COR NUNCA É O ÚNICO INDICADOR.** Combinação REAL por componente: check/ícone + peso + tint +
ring/borda + dot + texto (ex.: chip selecionado = check+tint+ring+700; unread = dot+peso+surface;
step concluído = check+kicker; pct cell = número sempre). A combinação certa é a do componente
real — não obrigar todas as marcas em tudo.

## 4 · SELECTED ≠ ACTIVE ≠ ACCENT (auditado)
- **SELECTED** (escolha do usuário, persistente no contexto): setor F7A (tint 7% + ring + ✓) ·
  status F7B / canal F7C (chip: check + tint 12% + ring + 700) · segmented F8/F10/F11 (item
  surface + sh-1) · chips de modo Config/R2 (accent sólido + check) · **dia do calendário F8
  (gradiente Golden + branco — EXCEÇÃO local: fundo sólido NÃO generaliza para outros selected)**.
- **ACTIVE** (localização atual de navegação): nav da sidebar `.active` (tint + filete lateral +
  ícone claro) — shell; aba/tab atual.
- **ACCENT** (destaque de conteúdo, não escolha): `.stat.accent` do Hoje (primeiro tile em
  destaque) · card crítico F10. Registro formal: accent ≠ selected — não recebe check.

## 5 · CURRENT / COMPLETED / FUTURE (gramática comum, componentes distintos)
Stepper F7 (C1 §0): futuro = hairline+número · atual = gradiente+kicker "ETAPA ATUAL" ·
concluída = tint verde+check+kicker. Timeline F6: done = carimbo real · ATUAL = sem carimbo
(honestidade H13) · pendente = sem data · condicional = attention. **Gramática compartilhada:**
posição no tempo comunicada por preenchimento+ícone+rotulagem, nunca só cor. Stepper ≠ timeline
(não fundir componentes).

## 6 · READ / UNREAD (F9 — princípios confirmados nos Golden/docs)
Unread = surface branca + sombra + título 700 + **dot**; read = surface-2 + 600 tx-2.
**Unread ≠ disabled; read permanece LEGÍVEL** (nunca opacity de indisponível). Contagem em
badge (sino/nav). Owner do componente = F9; C8 registra o princípio.

## 7 · WARNING / CRITICAL = SEVERITY (fora da interação)
`execSevHex`/`ncSev`/SLA/`taskDeadline` são o **sistema de cor semântica** (status), já
tokenizado nos Golden (F6/F8–F11, C6/C7). C8 NÃO os absorve — apenas referencia: severidade
qualifica conteúdo; interação (hover/focus/pressed) nunca muda a severidade.

## 8 · DISABLED / OFF (referência — owner C1/R2)
OFF = escolha ativa do usuário (trilho cinza + knob pleno; legível). Disabled = indisponível
(opacity .6/.4; texto legível; pointer-events none). Congelados na R2 — C8 só cita.

## 9 · HOVER · ACTIVE/PRESSED (owner C8 — gramática transversal REAL)
- **HOVER (95 usos; majoritariamente `body.desktop` — touch não recebe hover; hover nunca é o
  único caminho):** 4 mecânicas reais: (a) surface shift (`surface2`); (b) tint semântica
  (danger 8–12%/brand 10–14%); (c) brightness(1.07) + lift (translateY -1/-2px) em CTAs;
  (d) border accent. Ex.: evc/settrow (a) · menu itens (b) · rev-send/btn (c) ·
  **stat-tile (d + lift −2px + sombra — linha 1320 REAL)**.
- **ACTIVE/PRESSED (11 usos):** 3 mecânicas reais: brightness(.94) (`.btn`) ·
  translateY(1px) (btn desktop) · scale(.97/.995) (tcv4-btn/settrow/moveopt). Imprensa tátil
  sutil; sem estados inventados.

## 10 · FOCUS (transversal; tokens de C1)
**REGRA GLOBAL REAL (1324):** `body.desktop button:focus-visible, .inp:focus-visible{outline:
2px solid var(--accent); outline-offset:2px}` + input focus = border accent + halo 3px.
Light Golden: token único **C1 (#6E5EF3 + halo 11%)** — não criar segunda cor-base.
Especializações CONTEXTUAIS reais (mantidas, não multiplicadas): menu item danger = outline
vermelho · menu item act = azul (C3) · toast X/pill = #8FA2FF (C6) · 21 pontos inventariados
(nav, evd/det, drawer wf, notas, accordion summaries).

## 11 · EXPANDED / COLLAPSED (referência)
Owners: accordion C1 (dot+▲/▼, UM aberto), menus C3 (`.open` + aria-expanded — 4 usos reais),
`<summary>` reais (det-acc/dz-notes, com focus-visible). Princípio C8: mudança perceptível por
chevron/rotação/conteúdo + aria-expanded QUANDO real — nunca só cor.

## 12 · CHECKED (referência — owner C1)
Checkbox (box brand + check) e choice chips (check + tint + ring + 700) — R2/C1. Sem duplicação.

## 13 · ESTADOS TEMPORAIS (gramática; owners locais)
Calendário F8: **today** = ring/borda accent (`.agcell-today` real; desktop Golden = ring
brand) · **selected** = gradiente sólido (exceção local §4) · **dim** (fora do mês) =
transparente + tx-4. Prazo (`taskDeadline` literais REAIS): "Concluída" verde · "Atrasada"
vermelho · "Hoje" âmbar · "Faltam X" verde — texto SEMPRE presente (cor qualifica). Buckets
reais overdue/today/tomorrow/future (5194). Owners: F8/SLA; C8 registra a gramática.

## 14 · STAT-TILE (owner C8 — contrato completo)
**Origem única:** Hoje (`renderHoje` 5827; CSS 167–174 + 1320). **Anchor Golden: R2 `3c06c26`.**
- **Anatomia:** `.stats` flex gap 10 · `button.stat` flex:1, surface + borda (hairline Light),
  radius 16, padding 14 (13–14 Light), text-align left; ícone 20 accent → valor
  24/800 (InterTight 23–24/700 Light, margin-top 7–8) → label 11.5 soft.
- **Variantes:** default (surface) · **`.accent`** (fundo accent sólido/gradiente brand Light;
  ícone/valor/label brancos) — DESTAQUE do primeiro tile ("Hoje"), não seleção (§4).
- **Interação REAL:** clicável (`data-tab` → navega p/ Agenda/Tarefas/Equipe) · **hover
  desktop: translateY(−2px) + border accent + sombra 0 10 26 −16** (1320) · focus-visible =
  regra global (outline accent) · é `<button>` (teclado nativo). SEM trend/delta/sparkline/
  tooltip (não existem — nunca inventar).
- **STAT-TILE ≠ KPI CARD (regra formal):** stat-tile = resumo operacional CLICÁVEL de navegação
  (Hoje); KPI card F10/F11 = métrica executiva READ-ONLY (accent bar lateral + valor colorido +
  hint, sem clique). Nunca fundir por ambos exibirem número.

## 15 · SYNC / CONECTIVIDADE (gramática; owners citados)
Estados REAIS: dot verde + "sincronizado" no brand (SHELL — estático) · banner offline de
Prioridades (`navigator.onLine`): card âmbar "**Sem conexão.** As informações podem estar
desatualizadas — atualizam sozinhas ao reconectar." · splash offline (C5: "Sem conexão com o
servidor — reconectando automaticamente. Sua sessão está preservada." + "Aguardando conexão…")
· erro de rede do login (C6/C1 banner). **Gramática C8:** conectividade = indicador
textual+dot/tint âmbar, nunca bloqueio ilegível nem cor sozinha. Owners mantidos (Shell/C5/B);
C8 não vira dono do Monitor SLA (shell próprio).

## 16 · TOKENS (referenciados — sem duplicar constantes)
Focus: C1 (#6E5EF3+halo) + outline global 2px/offset 2 · selected tints/rings: C1 · disabled
.6/.4: C1 · hover: surface2 shift · tint 8–14% · brightness 1.07 · lift −1/−2px · border accent
· pressed: brightness .94 · translateY 1px · scale .97/.995 · stat-tile: r16, pad 13–14, ícone
20, valor 23–24/700, label 11.5, hover-lift/sombra (acima) · dots 6–8px (sync/unread/steps).

## 17 · MOTION (referência — SEM foundation formal de motion no produto)
Timings REAIS inventariados (62 transitions): .1s transform (btn) · .12s filter/shadow/menus ·
.14s dpop/menu-in · .15s toggle/border · .18s toast/drawer/scrim · .2s saída de toast —
gramática 100–200ms ease; `prefers-reduced-motion` respeitado (spinner/toast). C8 REFERENCIA os
timings existentes; não cria sistema novo.

## 18 · ACESSIBILIDADE — comprovado × requirement (consolidação final = R9)
**Comprovado:** regra global focus-visible desktop (1324) + 21 pontos específicos ·
aria-expanded (menus/evd) · aria-busy (rev-send) · estados nunca só-cor nos Golden · unread
legível · targets dos Golden. **Requirement (NÃO existe; não declarar):**
`aria-selected`/`aria-current`/`aria-pressed` = **ZERO no produto** (seleção é visual+classe) ·
aria do stat-tile (valor/label associados) · hover como único caminho JAMAIS (já atendido).

## 19 · RESPONSIVIDADE (requirement — R8)
Stat-tile e estados a revalidar em 1366×768 + 125% (targets/lift/valor legível). Nada validado
além de 1920×1080.

## 20 · GOLDEN ANCHORS (ownership respeitado)
Stat-tile + OFF/disabled + checkbox + inline error: **R2 `3c06c26`** · selected: F7A/F7B/F7C ·
segmented/calendar today-selected-dim: F8 `96fd7d3` · read/unread: F9 `8173940` · accent card:
F10 `9de9a6b` · current/completed/future: F7 + F6 · open/focus de menus e toast: R5.1 `5959ae0`
· focus de input: F12 `6e52905`. **GAP VISUAL C8 = NÃO** (hover/pressed são micro-interações
documentadas por tokens; sem prancha nova).

## 21 · EXCLUSÕES / DÍVIDAS / GUARDRAILS
**Exclusões:** severity system (cor semântica), Monitor SLA (shell), KPI card (F10/C-própria),
trend/delta/sparkline/tooltip (inexistentes), motion foundation (inexistente), hover em touch.
**Dívidas (não corrigir):** ausência total de aria-selected/current/pressed (R9 decide);
hover ausente em alguns alvos clicáveis (fora dos 95 reais); focus contextual multicolor
(variações reais — unificação é decisão futura do owner).
**Guardrails:** não generalizar o roxo sólido do dia selecionado; accent ≠ selected (sem check
no accent); stat-tile nunca vira KPI (nem o inverso); não adicionar ARIA de seleção "por
padrão" sem fase própria; pressed/hover sempre sutis (tokens §16); estados novos só com prova.
