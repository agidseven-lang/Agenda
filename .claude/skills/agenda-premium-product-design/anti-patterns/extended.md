# ANTI-PATTERNS ESTENDIDOS (específicos do Agenda)

Complementa os arquivos individuais (generic-ai-ui, white-canvas, badge-overload,
border-overload, weak-hierarchy, excessive-whitespace). **Qualquer ocorrência derruba o teto
do critério correspondente para 6 no scorecard** — impossível passar do gate 90 com um destes.

## 1. rainbow-status
4 estágios com 4 cores saturadas competindo + legenda de cores.
→ **Correção:** estágios por ÍCONE em cinza; cor semântica só no overdue. Estado é hierarquia, não arco-íris.

## 2. gratuitous-gradients
Gradiente em logo, botão, barra de progresso ou fundo "porque fica bonito".
→ **Correção:** sólidos. Gradiente só se comunicar algo (raríssimo). Premium é tom + hairline, não degradê.

## 3. over-rounded-cards
Radius 16–20px em tudo → cara de app de consumo/template.
→ **Correção:** escala 7/9/12px. Card 9, painel 12, chip 6–7. Coerência acima de "fofura".

## 4. dead-space (torre vazia)
Colunas de kanban com altura fixa gigante para 1–2 cards → 80%+ de área morta emoldurada.
→ **Correção:** board proporcional ao conteúdo; canvas inferior aberto sem moldura. Presença ≠ tamanho.

## 5. kpi-soup
KPIs soltos, cada um numa caixinha, sem hierarquia entre si.
→ **Correção:** KPI = número grande tabular + rótulo discreto, agrupados por seção no cockpit. Stripe-class.

## 6. independent-widgets
Painel lateral parecendo 3 dashboards empilhados sem relação.
→ **Correção:** UM cockpit (Visão → SLA → Equipe) com hairlines internas e rodapé único. Organismo, não pilha.

## 7. low-density
Muito respiro, pouca informação → sensação de app inacabado/demo.
→ **Correção:** densidade proporcional; ≥ ~26% de pixels úteis no palco; header ≤ 2 faixas.

## 8. no-art-direction
Tela sem direção declarada — mistura de estilos, sem eixo de leitura.
→ **Correção:** `process/direction-before-code.md` — UMA direção citada + eixo de leitura definido antes do CSS.

## 9. title-duplication
Título da página repetindo a tab ativa; chips redundantes (ex.: "CEO" + role + avatar).
→ **Correção:** contexto uma vez só. Header nomeia a seção; a tab marca a visão.

## 10. sla-duplication
Estado de SLA repetido (pill no header + painel no cockpit dizendo a mesma coisa).
→ **Correção:** indicador sóbrio no header; detalhe único no cockpit. Nunca a mesma informação duas vezes.
