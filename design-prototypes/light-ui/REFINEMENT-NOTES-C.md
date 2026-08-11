# Proposta C — Refinamento Profissional · FRAME 1 ("Meu quadro" 1920×1080)

**Status:** direção C aprovada para refinamento; design final NÃO aprovado; implementação NÃO autorizada.
Somente pesquisa + design + simulação. Nada toca `desktop/`, o app, o tema, workflows ou release.
Fonte da verdade = `proposta-c-refinada-v2-frame1.html` (self-contained; fontes embutidas em `_fonts.css`).

## Pesquisa aplicada (benchmark real)
Pesquisa de padrões de dashboards SaaS premium (design systems públicos: Atlassian, Primer/GitHub,
Carbon/IBM, Tailwind, Radix; e extrações de tokens de Linear, Stripe, Notion, Vercel, Cal, Superhuman).
Regras de maior alavancagem incorporadas:

- **Tipografia real (Inter), não fonte de sistema** — a razão nº1 de "amador × profissional". Escala
  contida (~7 tamanhos: 11 label / 12–13 meta / 13.5 título de card / 16 H2 / 19–20 H1), pesos 400/550/650
  (nunca "tudo negrito"), *tracking* negativo nos títulos grandes, **numerais tabulares** em contagens/datas/métricas.
- **Canvas off-white + cards brancos** (nunca #FFF em tudo) — profundidade em dois tons: workspace `#F4F6F8`, card `#FFF`.
- **Filete de 1px `#E9ECF1`** em vez de bordas pesadas; sombras **premium em camadas, alpha 3–6%** (nada de sombra escura).
- **Escala única de raios** (5/7/10/13/16) e de espaçamento (grid 4/8) — nada "no olho".
- **Status por cor SEM inundar o card**: filete de acento à esquerda (3px) + *dot* + chip com tint ~12% + ícone — nunca bloco chapado.
- **Ícones de uma só família** (traço 1.7), sem emoji.

## O que era amador antes → o que ficou profissional agora
| Antes (C original) | Agora (C refinada) |
|---|---|
| Fonte de sistema genérica | **Inter/Inter Tight** embutida; hierarquia e tracking calibrados |
| Bordas/superfícies pesadas | filete 1px + off-white + microssombra |
| Cores de status mais "chapadas" | tint 12% + dot + acento lateral + ícone |
| Espaçamentos irregulares | grid 4/8 consistente; raios e sombras unificados |
| Densidade e alinhamento imprecisos | densidade **Compacta** real, tudo alinhado ao grid |

## Sistema de cor por usuário (identidade, não preenchimento)
Paleta curada de 16 matizes profissionais (saturação/luz controladas, distinguíveis, seguras p/ inicial branca).
Cada pessoa = 1 cor consistente em **anel do avatar + chip do responsável + filtro** (nunca fundo do card).
Consistência verificada no frame: Ana Beatriz=rosa, Felipe=teal, Diego=esmeralda, Gabriela=âmbar, Boaz=ciano, Ardyjany=índigo… — mesma cor em todos os lugares (cards, filtro "Responsável", legenda inferior).

## Estrutura do FRAME 1 (simulação real do app)
Sidebar petróleo (Workspace/Equipe/Gestão/Sistema + Quadros de clientes + cartão do usuário + Plano) ·
header (Meu quadro, busca ⌘K, alternador Kanban/Lista/Calendário, SLA ao vivo, sino, avatar, Nova tarefa) ·
abas + filtro por responsável + Compacto/Confortável · Kanban 4 colunas (A Fazer/Em andamento/Revisão/Finalizado,
canvas aberto, cards independentes) · drawer lateral direito (status, chips, título, cliente, responsável, prazo,
conteúdo/arquivo, linha do tempo, CTA em gradiente) · barra de métricas discreta (KPIs + sparkline/donut + legenda).

**Densidade:** principal = Compacta (várias tarefas simultâneas). Confortável (documentada): +2px de padding no card,
gaps maiores (12→16), avatares 22px, título 14px — para telas maiores / leitura relaxada.

## Próximo passo
Apenas FRAME 1 para avaliação. Sem FRAME 2, sem implementação, sem produção. Avança só com "LAYOUT APROVADO".
