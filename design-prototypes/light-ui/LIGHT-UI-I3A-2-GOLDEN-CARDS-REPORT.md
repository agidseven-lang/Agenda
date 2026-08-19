# LIGHT UI — I3A.2 · GOLDEN TASK CARD RESTORATION REPORT

**Fase:** I3A.2 — restauração do modelo de card aprovado (prints 5/6) · **Status:** ENTREGUE
— aguarda owner. **Branch:** `impl/light-ui-f1-golden-cards-1.0.246` (base EXATA `58847c85` =
I3A.1 — contém F1 + drawer aprovado; árvore auditada). **Commits:** `6744090a` + `116723a7` (refino ao PRINT DE REFERÊNCIA canônico fornecido pelo owner: título→categoria UPPERCASE→Cliente label+nome→Prazo=data real colorida por estado→barra; pill relativa removida; urgência só com SLA ativo; temas/notas→drawer; colunas com barra --kc e add colorido) · version
**1.0.246 intacta** · zero build/release · nenhum PR.

## 1 · CARD MODEL CORRECTION (registro formal)
> **"Os cards densos da I3A eram regressão para o modelo legado. A fonte visual correta são
> os cards dos Frames Golden aprovados."**

A I3A re-skinou o KanbanTaskCardUnified mantendo TODOS os 11 slots visíveis ⇒ o card virou
MINI DETAIL PANEL (ficha de responsável, origem, caixa CONTEÚDO, Etapa atual/Próxima ação,
data, 3 botões grandes — ~460px). O contrato canônico dos Frames aprovados (print 6 = F1
Meu Quadro; print 5 = F2 Cliente, mesma filosofia): **CARD = RESUMO OPERACIONAL · DRAWER =
DETALHE COMPLETO** — regra registrada como compartilhada para F1–F5.

## 2 · AUDITORIAS
- **Card legado (fonte de dados):** kbv2Card real — slots: top(status/SLA/due) · profile ·
  origem · tier+título · chips · content-slot (`.kbv2-card-summary` rótulo+contagem) ·
  checklist · rail dots+stage2 · data · footer 3 botões.
- **Card Golden (fonte visual — markup do Frame congelado):** `.card-top` TÍTULO (+check
  se done) → `.crow` "Cliente"+nome+tag categoria → `.prazo` (quando aplicável) →
  `.prog` barra 5px → `.card-foot` avatares 32 + metas (comment/clip).
- **Diferenças:** card real expunha no corpo tudo o que o Golden delega ao drawer.

## 3 · IMPLEMENTAÇÃO (100% apresentação — CSS order/display; zero markup/JS)
| Golden | Realização sobre o markup real |
|---|---|
| Título primeiro | `.kbv2-card-main` order:1; título 15.5/640 clamp2; tier reordenado abaixo |
| "Cliente" + nome | `.kbv2-tier` sem uppercase, 12.5/600 tx-1 + rótulo `::before` "Cliente " tx-3 (decorativo; dado real = nome) |
| Categoria chip tint | `.kbv2-card-chips` order:2 (cores reais do setor; nada fabricado) |
| Prazo compacto | pill real de urgência (Faltam/Hoje/Atrasada/Concluída) à esquerda; **status pill oculta** (coluna já comunica); data absoluta → drawer |
| Progress barra 5px | **dots reais do trilho re-apresentados como barra segmentada** (i flex:1 h5; .ln ocultos; done/atual/alerta = mesma semântica) |
| Microstats footer | caixa "Conteúdo" → microstat 1 linha (ícone+contagem real; **vazio não renderiza**); checklist microstat |
| Avatares compactos | participante avatar 24 (+presence); ficha nome/cargo oculta (drawer tem) |
| Rail responsável | **INALTERADO** (congelado: --kresp userColor) |
| Ações | 28px: Detalhes (primary grad E4, não-esticado) · Mover (secondary) · ⋯ (contextual à direita) — **função 100% preservada** |
| Ocultos no card (DOM/drawer intactos) | ficha responsável (.kbv2-pm) · origem · stage2 (Etapa/Próxima) · data absoluta · hint de fluxo · status pill |

## 4 · NÚMEROS (mesmo fixture da I3A — comparação justa)
| Métrica | I3A | I3A.2 |
|---|---|---|
| Altura média do card @1920 | **460px** (435–480) | **246px** (máx 256) — **−46%** |
| Cards COMPLETOS visíveis por coluna @1080 | 1 | **2** |
| Overflow de página (3 perfis) | 0 | 0 |

## 5 · VALIDAÇÃO
- **Smoke funcional 8/8 intacto:** busca filtra · abas Cliente↔Meu quadro · **Detalhes→drawer
  abre/fecha** · Mover abre · menu ⋯ abre · scroll-x kanban (nenhuma função perdida com as
  ações compactas).
- **Drawer (I3A.1): NÃO ALTERADO** — 416px right:0 full-height, foco no X, conteúdo completo
  (o motivo pelo qual o card pode ser resumo).
- **Shell: NÃO ALTERADO** (sidebar/header/brand/Monitor/bell/busca/tabs/canvas — zero seletor).
- **Estados:** normal (Faltam) · Hoje · Atrasada · pré-envio neutro · Concluída (check/verde,
  sem Mover — guarda real); todos compactos.
- **Legado: 0px** (I3A×I3A.2 sem a classe; dark/light/hc; board montado; relógio congelado).
- **Responsive:** 1366 avg 270px; win125 avg 270px; página sem overflow; colunas/scroll-x/
  counts/empty/add intactos.

## 6 · GOLDEN COMPARISON (Ref 5/6 × I3A × I3A.2)
| Critério | Ref 5/6 | I3A | I3A.2 |
|---|---|---|---|
| Card height | ~170–200 | ~460 | **~246 (MATCH de densidade; delta = SLA/ações reais extras)** |
| Information density | resumo | mini detail panel | **resumo operacional** |
| Title hierarchy | título 1º | ficha respons. 1º | **título 1º ✔** |
| Client | "Cliente"+nome | eyebrow uppercase | **"Cliente · nome" ✔** |
| Category | chip tint | chip | **chip tint ✔** |
| Deadline | linha/estado | pill+data (dup.) | **pill de estado única ✔** |
| Progress | barra 5px | trilho+etapa+próxima | **barra segmentada 5px ✔** |
| Avatars | foot 32 | ficha 34+nome+cargo | **avatar 24 compacto ✔** |
| Microstats | foot metas | caixa CONTEÚDO | **microstat 1 linha ✔** |
| Responsible | rail/avatars | rail+ficha | **rail (congelado)+avatar ✔** |
| Actions | limpo | 3 botões grandes | **28px compactas (função real) — FUNCTIONALLY ADAPTED** |
| Column density | 2–4/col | 1/col | **2 completos/col ✔** |

## 7 · DIFF · ESCOPO · ROLLBACK
1 arquivo · **+64/−0 · 1 hunk CSS-ONLY** (seção I3A.2 no bloco light-ui) · zero markup ·
zero JS · zero lógica/helpers/dados removidos · seletores só `.kbv2-*` sob
`body.light-ui.desktop` (F2 não implementado — print 5 usado apenas como referência de
filosofia). **Rollback:** remover a seção I3A.2 (= reverter `6744090a`).

## 8 · REFERÊNCIA CANÔNICA (correção do owner) — commit `3fc30fbb`
O owner reenviou a REFERÊNCIA CANÔNICA (frame completo do Meu Quadro light), corrigindo a
leitura anterior. Card ajustado: **SEM rail lateral** — identificação do responsável =
**ANEL COLORIDO no avatar** (cor real `--kresp`; contrato rail→ring ATUALIZADO pela
referência) + legenda; radius 12; título 14/700; colunas SEM barra sob o header; altura
média ~199px. **Deltas de FUNÇÃO/SHELL presentes na referência que exigem DECISÃO DO OWNER
(não implementados nesta fase — conflitam com gates formais anteriores/P0):**
sidebar clara · "ID Seven" no brand (I2.2 fixou "Agenda ID Seven") · corner-avatar no
cluster (removido no gate I2.2) · workspace selector + Plano Business (funções novas —
proibidas no Gate 4 da I2) · filtro por responsável (F1-E01) · KPI footer (função nova) ·
badge no sino · gradientes rosa/azul-magenta (errata E4 vigente) · painel de detalhe
inline com pin/kebab (drawer 416 foi APROVADO na I3A.1). Owner decide caso a caso.

## 9 · GATE
Provas I3A.2-F1-{1920, DRAWER-1920, 1366, win125} no chat (não versionadas).
**Recomendação: GO** — anatomia = prints 5/6, card compacto, drawer concentra o detalhe,
zero função perdida, rail congelada, board responsivo, shell congelado, legado intacto.
