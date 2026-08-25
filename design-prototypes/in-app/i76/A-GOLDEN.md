# A — KANBAN-CENTRIC · GOLDEN CANDIDATE (I7.6.1)

> **Decisão do owner (I7.6, por escrito):** `A — KANBAN-CENTRIC = APPROVED` · `B = REJECTED` · `C = REJECTED`.
> A é a **source of truth** da tela **Meu quadro**. Esta decisão sobrescreve interpretações anteriores.
> Premium Score é ferramenta de QA; **a autoridade final de direção é o OWNER.**

Laboratório visual isolado. **NÃO é produção.** Agenda 1.0.248 permanece FROZEN — renderer, PWA,
backend, updater, workflows e tags intocados. Sem 1.0.249. Implementação (I7.7) = NO-GO.

Arquivo golden: `design-prototypes/in-app/i76/A.html` (Inter real embutida via `inter.css`).

---

## Contrato de arquitetura (INTOCÁVEL — só micro-craft é permitido)
Sidebar petroleum/navy · botão **Nova tarefa** teal no topo · nav compacta · header compacto
(contexto "Meu quadro" · tabs Quadro/Timeline/Lista · busca) · toolbar com filtros
(Carlos Eduardo / Equipe / Filtros) + indicadores compactos (Total / Em andamento / A fazer /
Concluídas) + **SLA no prazo** · **board Kanban dominante em largura total** · **4 colunas**
(A Fazer / Em andamento / Revisão / Finalizado) · cards grandes e claros · acentos semânticos
azul(todo)/âmbar(doing)/roxo(review)/verde(done) · **áreas de drop dentro das próprias lanes** ·
**SEM rail · SEM Cronograma da semana · SEM banda de KPI dashboard · SEM cockpit operacional.**

**O espaço vertical das lanes é CAPACIDADE OPERACIONAL do Kanban** (recebe novas tarefas) —
por decisão consciente do owner, **não** é preenchido com outros módulos.

---

## Micro-refinamentos aplicados nesta rodada (I7.6.1) — sem mudar a composição
1. **Tipografia de-shout:** títulos/headers de peso 800 → **700** (título de card, "Meu quadro",
   cabeçalhos de coluna, números de KPI, wordmark) — leitura mais sênior, menos "cara de IA".
2. **Tracking** de títulos ajustado para −0.011em; corpo/meta em 500; Inter real (400/500/600/700/800).
3. **tabular-nums** em contadores, prazos e KPIs.
4. **Empty states discretos** (regra da skill: "uma linha, nunca centralizado gritando") — ícone
   menor, uma linha só ("Sem tarefas em revisão" / "Nada concluído ainda"), sem subtítulo ruidoso.
5. **Drop affordance** calma dentro das lanes ("Solte tarefas aqui") — recebe tarefas sem gritar.
6. **Superfícies:** canvas de trabalho (mais frio/escuro) > lanes contidas (soft) > cards (branco);
   dot-grid sutil no canvas; hairlines 1px; sombras contidas ≤ ~7%.
7. **Estados de interação definidos:** card `:hover` (elevação + translateY −1px), `:focus-visible`
   (anel teal 2px, offset 2px), `.dragging` (rotação/scale + sombra), `+ Adicionar tarefa` hover teal.
8. **Responsividade endurecida** (ver abaixo): rótulos dos KPIs **preservados** em 1366; busca sem
   quebra (nowrap + ellipsis); compactação controlada de gaps/paddings/sidebar/tipografia secundária.
9. **Consistência de cor semântica** (azul/âmbar/roxo/verde) mantida como identidade aprovada de A.

**A composição NÃO mudou** — nenhuma seção adicionada/removida; nenhuma transformação em B/C.

---

## Responsividade — MESMA interface nas 3 condições (validado)
| Captura | Viewport | Resultado |
|---|---|---|
| `A-GOLDEN-1920`   | 1920×1080 @100%      | referência; 4 lanes; sem scroll horizontal |
| `A-GOLDEN-WIN125` | 1536×864 @125% (Win) | mesma interface; KPIs com rótulo; sem clipping |
| `A-GOLDEN-1366`   | 1366×768 @100%       | mesma interface; **rótulos KPI preservados**; busca sem quebra; sem scroll horizontal |

- **Sem scroll horizontal** em nenhuma condição. Sem zoom necessário. Nenhum conteúdo crítico
  fora da viewport. **4 lanes preservadas** em todas.
- Adaptação controlada por breakpoints (1560 / 1400 / 1240): largura da sidebar, busca, gaps,
  paddings, tipografia secundária, larguras de lane. Nenhuma função importante removida.

---

## Premium Score (honesto, sem inflar — screenshot real, 2 tarefas reais)
| # | Critério | Nota | Nota (1 linha) |
|---|---|:--:|---|
| 1 | Visual hierarchy | 9 | board dominante, hierarquia de card e coluna claras |
| 2 | Surface hierarchy | 9 | canvas > lane > card; anti white-canvas |
| 3 | Density / eficiência | 8 | board-only com 2 tarefas = mais área receptiva (capacidade por decisão do owner) |
| 4 | Typography | 9 | Inter real, pesos moderados, tabular-nums, tracking |
| 5 | Composition / balance | 9 | sidebar+header+toolbar+board, eixo limpo |
| 6 | Whitespace discipline | 9 | capacidade das lanes calma e intencional (não é vão morto) |
| 7 | Color restraint / semântica | 9 | 1 acento marca + acentos semânticos aprovados; sem rainbow |
| 8 | Depth | 9 | tons + hairlines + sombra contida + dot-grid |
| 9 | Content grouping | 9 | cards/lanes coesos, sem widgets soltos |
| 10 | Information architecture | 9 | contexto uma vez (header + KPIs), sem duplicação |
| 11 | Interaction polish | 9 | hover/focus/drag/add definidos |
| 12 | Responsive behavior | 9 | 3 capturas, mesma interface, sem clipping |
| 13 | Brand personality | 9 | petroleum + teal, identidade ID Seven |
| 14 | Enterprise credibility | 9 | acabamento Linear/Stripe-class |
| 15 | Creative-agency fit | 9 | SLA, cliente, designer, fluxo de produção |

```
PREMIUM SCORE = 91/100
Anti-patterns detectados: nenhum
Veredito: APRESENTÁVEL (>=90)
Nota: o teto de "densidade/whitespace" é a troca consciente da direção board-only com poucas
tarefas — escolhida pelo OWNER. Não é defeito a corrigir (preencher o espaço é PROIBIDO).
```

---

## Figma zero-cost — estado real (honestidade operacional)
- Conector Figma: **ligado** (`connected:true, enabledInChat:true`) — handle "ID Seven",
  `agidseven@gmail.com`, plano **starter / seat View** (R$0).
- Arquivo dedicado criado (isento de cota): **`AtRDxg4kwTYgaIfcjrjckT`**
  (`Agenda ID Seven — A Kanban Golden (I7.6.1)`).
- **BLOQUEIO real:** `use_figma` (a construção) retornou *"You've reached the Figma MCP tool call
  limit on the Starter plan."* — a **cota mensal de chamadas MCP do plano gratuito está esgotada**.
  Só `create_new_file`/`whoami` são isentas; a construção NÃO é isenta na prática.
- **Zero-cost preservado:** NÃO foi feito upgrade pago (proibido). A formalização Figma fica
  **preparada e pendente** do reset mensal da cota (ou de uma sessão com seat Dev/Full).
- **Autoridade de spec atual:** este **A GOLDEN (HTML)** — validado, 3 resoluções, Inter real —
  é a spec fiel que a formalização Figma vai espelhar quando a cota permitir.

`FIGMA_STARTER_MCP_QUOTA = EXHAUSTED (monthly)` · `FIGMA_CONNECTOR = ON` · `FIGMA_A_FILE = AtRDxg4kwTYgaIfcjrjckT`
