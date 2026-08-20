# LIGHT UI — I3A.3 · F1 V4 PORT REPORT

**Fase:** I3A.3 — porte integral do protótipo v4 aprovado (OWNER-APPROVED DESIGN AMENDMENT,
rev `0600303c`) para o app real. **Status:** ENTREGUE — aguarda avaliação do owner.
**Branch:** `impl/light-ui-f1-golden-cards-1.0.246` · **checkpoint ÚNICO `93ffc235`**
(base `18818337`; 1 arquivo, +211/−136 — seção CSS "REFERENCE ALIGNMENT v2" substituída
por "I3A.3 F1 V4 PORT" + poda do JS do filtro). Version **1.0.246 intacta** · zero
build/release · nenhum PR · Light UI segue INATIVA para usuário (classe só no harness).

## 1 · ORDEM DO OWNER CUMPRIDA (GO com 4 correções)
1. **Amendment registrado** no roadmap (v4 = referência visual integral e canônica; v4
   VENCE decisões visuais anteriores; código real vence só em função/dados/permissões/
   workflow) — commit `74a7342b` no design branch.
2. **Filtro por responsável reauditado** (base real `58847c85`): NÃO existe função/handler/
   state/efeito — seleção do board é fixa do dono (`assigneeId||by`), `boardQuery` é busca
   textual, `taskChips()` é navegação. **V4-FUNCTIONAL-CONFLICT-01 → item PARADO**; o JS
   gated da reconstrução foi **REMOVIDO** do runtime (state + chips + handler). A linha de
   chips do v4 NÃO renderiza até decisão do owner.
3. **KPIs auditados** (tabela no roadmap): ativas/conclusão %/atrasadas = deriváveis e
   calculados de `isTaskCompleted`/`taskDeadline` sobre a lista real do board; **SLA sem %
   real** → cartão mostra ESTADO real ("Em dia"/N alertas · rótulo honesto "SLA da visão");
   **deltas e sparklines NÃO renderizados** (sem base histórica determinística — tasks não
   carregam createdAt confiável e doneAt não cobre todas as formas de conclusão). **Nenhum
   número fictício em runtime.** Legenda = usuários/cores reais (`respOf`/`userColor`).
4. **Sidebar 266px = calibração COMPARTILHADA do Light Shell** sob `body.light-ui`
   (não exclusiva do F1): `--d-side:266px` + teal petróleo medido. Revalidada em
   1920×1080 / 1366×768 / win125 (1093×614 DIP @1.25) — sem blocker (provas abaixo).

## 2 · O QUE FOI PORTADO (medido do HTML aprovado)
| Zona | Implementação sobre o real |
|---|---|
| Sidebar | `.nav` real: gradiente `#0A4552→#053845→#03303B`, itens 41px `#A8C3C9`, ativo `rgba(255,255,255,.10)` + barra clara 4×20 `#D9EEF6` + texto branco; brand circle 46 (asset real, ring `rgba(255,255,255,.14)`), "ID Seven" (span legado; supersede copy I2.2), CTA 46 gradiente `#3B5CF9→#E604AE` (token `--lui-grad` v4 — supersede E4 no claro), badge translúcida, `sb-user`/`sb-footer` teal |
| Canvas | `--lui-canvas:#FDFEFE`; colunas/painel/KPIs = cartões brancos, borda `#EDF0F3`, sombra leve |
| Header | `d-board-head` real: back 38 circle, avatar 46, título 21/800; cluster: Monitor SLA cartão branco, sino branco 44, **cornerAvatar REAL revelado** (função real: navega ao Perfil; v4 vence a ocultação da I2.2) com anel |
| Toolbar | `#bSearch` real 574×48 radius 12 com lupa + `⌘K`; `tchip` 44 radius 12, ativa TINT `#E9F0FC`/`#2E5FD0` (não sólida) |
| Grid | `.kbv2-board` = grid `repeat(4,1fr)` gap 16; colunas cartões radius 14 pad 12; header dot 8 + título 13.5/800 + contagem em pill 22 com borda; **barra curta 76×5** na cor da coluna |
| Cores das colunas | paleta v4 por posição via `--kc2` (`#3D7BD1/#E97722/#9A54ED/#10B981`) com fallback `--kc` real (legado intacto) |
| Card (anatomia v4 congelada) | markup real do kbv2Card reordenado por CSS: título 13.5/800 clamp2 → chip categoria tint 8.5 uppercase → "Cliente" rótulo+nome → "Prazo dd/mm/aaaa às hh:mm" (dado real) → **barra contínua 4.5px + % real** (span `.kbv2-pct`) → avatares 24 com **anel na cor do responsável** (+autor `--kby`) + microstats reais (conteúdo/checklist; vazio não renderiza). Ocultos no card e vivos no detalhe: status pill, due pill, origem, ficha, Etapa/Próxima |
| Ações do card (função 100%) | **Detalhes** = botão real como cobertura invisível do card (todo o card clica/foca; anel de foco no card) · **Mover** = pill revelada em hover/foco · **menu ⋯ real** no slot superior direito (posição do bookmark do v4) · concluída: **selo verde** + prazo verde; Mover ausente por guarda real |
| Painel lateral | **MESMA Central de Detalhes real** (`openDetails`/`.det-sheet`, hook `data-detorigin="mine"`) **DOCADA como 5ª coluna** em ≥1760px via `:has()`: 392px, top 160 / right 26 / bottom 169 = **extensão exata das colunas (160..911)**; backdrop transparente; dados/handlers/foco/fechamento reais intactos; <1760px permanece o drawer overlay aprovado (I3A.1) |
| KPIs + legenda | grid `repeat(4,1fr) 392px` alinhado às colunas (alinhamento exato no estado canônico com painel aberto); cartões 96 radius 14, tiles 42 tint |
| R8 | ≤1500: busca cede espaço, KPIs compactam; ≤1240: board volta ao **scroll-x legado**, toolbar quebra em 2 linhas, KPIs 2 colunas + legenda span, superfície min-height 430 (página rola — comportamento real) |

## 3 · UI UX PRO MAX (auxiliar; v4 venceu onde conflitou)
SKILL.md relido antes do porte; checklist aplicado: foco visível preservado (cobertura do
Detalhes conserva anel de foco no card via :focus-within), alvos com espaçamento (⋯ 24px
isolado no topo; Mover 26px no rodapé oposto), navegação por teclado intacta (botões reais
no DOM; tab order preservada), reflow de texto (clamp 2 no título; sem alturas fixas de
texto), barra de progresso com % textual (não só cor). **Registro a11y (não bloqueante,
v4 vence):** cinzas de rótulo `#98A1AD` sobre branco ≈ 3.0:1 (<4.5:1 AA para texto
pequeno) — herdado da referência aprovada; candidato ao hardening I11 mediante GO.

## 4 · GATE DE FIDELIDADE POR ZONA (medição numérica protótipo × app @1920)
| Zona | Medidas (proto → app) | Veredito |
|---|---|---|
| Sidebar | 266→266 px; mesmo gradiente (`rgb(10,69,82)…`); CTA 46→46 com gradiente idêntico | **MATCH** |
| Header | título 21/800; Monitor/sino/avatar presentes; back circle 38 | **MATCH** (conteúdo = dados reais) |
| Toolbar | busca 574×48 r12 → 574×48 r12; tab ativa `rgb(233,240,252)`/`rgb(46,95,208)` idênticas; h44 | **MATCH** |
| Columns | 4 colunas; gap 16→16; radius 14→14; branco idêntico; barra curta 76×5; painel aberto: larguras iguais (≈288) | **MATCH** |
| Cards | radius 12→12; padding 13/13/11 idêntico; título 13.5/800 idêntico; borda `#EEF1F4` idêntica; avatar 24→24 | **MATCH** (conteúdo real: horário no prazo, microstats reais, chips por setor real) |
| Detail panel | 392 px; top/right/bottom = extensão das colunas; radius 14; foco no X | **MATCH** de moldura · **ADAPTAÇÃO JUSTIFICADA** no conteúdo (Central REAL: campos e ações reais em vez do mock; abre sob demanda) |
| KPIs | h 96→96; radius 14→14; grid `…392px` igual (célula ≈288→280, Δ<3% por paddings reais do `.scr`) | **MATCH** (valores reais; sem deltas/sparklines — auditoria §1.3) |
| Legend | avatares 26 com anéis reais + caption v4 | **MATCH** (usuários reais) |
| Filter row | — | **PARADO** (V4-FUNCTIONAL-CONFLICT-01; não renderiza) |
| **ISSUES** | — | **ZERO** |

## 5 · PROVAS (entregues no chat; não versionadas)
`F1-V4-PORT-1920.png` · `F1-V4-PORT-1920-PANEL.png` (composição canônica com a Central
docada) · `F1-V4-PORT-1366.png` · `F1-V4-PORT-win125.png` · comparação empilhada
`F1-V4-COMPARE-PROTO-vs-APP.png`.
**Validações:** legado **0px** (dark/light/hc, relógio congelado `1787265000000`, board
montado, fixture idêntico, base `18818337`) · smoke **8/8** (busca filtra; abas Cliente↔Meu
quadro; Detalhes abre/fecha; Mover; menu ⋯; scroll; concluída sem Mover) · lifecycle do
painel: **Esc/fechar/retorno de foco/clique-fora PASS** · 1920/1366/win125 **sem overflow
de página** · balanço de chaves do bloco CSS = 0.

## 6 · ROLLBACK
Reverter `93ffc235` (1 commit; seção CSS + 4 pontos de JS podados são o diff inteiro).

## 7 · PENDÊNCIAS PARA O OWNER
1. **V4-FUNCTIONAL-CONFLICT-01** — filtro por responsável: criar como FUNÇÃO nova (JS
   real, mandato próprio) ou omitir definitivamente?
2. KPIs sem deltas/sparklines (sem base histórica) — aceitar como está, ou mandato para
   persistir histórico real (função nova)?
3. Itens "ID Seven · Agência" e "Plano Business" do v4: inexistem como função — criar
   (mandato próprio) ou manter fora?
**Gate de saída: avaliação do owner.**
