# Proposta C — Refinamento Profissional · FRAME 1 ("Meu quadro" 1920×1080)

**Status:** direção C aprovada para refinamento; design final NÃO aprovado; implementação NÃO autorizada.
Somente pesquisa + design + simulação. Nada toca `desktop/`, o app, o tema, workflows ou release.
Fonte da verdade = `proposta-c-refinada-v2-frame1.html` (self-contained; fontes embutidas em `_fonts.css`).

## V4 — fidelidade ao produto real (owner aprovou a linguagem visual da V3)
Arquivo: `proposta-c-refinada-v4-frame1.html`. Mesma qualidade visual da V3, corrigindo tudo que era
**inventado / implicava funcionalidade inexistente** — matriz de auditoria READ-ONLY do renderer real em
`LIGHT-UI-FUTURE-UX-BACKLOG.md`. Removidos (→ backlog): alternador Kanban/Lista/Calendário, "Espaço da
Agência" + seletor de workspace, "Plano Business", lista de clientes na sidebar, densidade Compacto/Confortável,
"Ordenar". Corrigido: label real "Social Medias"; marca "Agenda ID Seven / sincronizado"; sidebar = nav real
(Minhas Prioridades/Hoje/Agenda/Tarefas/Equipe/Perfil/Executivo/Relatórios/Notificações/Configurações, Tarefas ativo).
Mantidos por serem reais: busca+⌘K, SLA, notificações, perfil, Nova tarefa, Filtros + filtro por Responsável,
abas (Meu quadro/Cliente/Designers/Social Medias/Setores). Cards com **1 tag principal** (progressive disclosure);
drawer com melhor rítmo vertical. Sem barra de métricas; 1920×1080 exatos.

## V3 — refinamento (evolução da V2, mesma arquitetura; owner aprovou a direção)
Arquivo: `proposta-c-refinada-v3-frame1.html` · comparação: `C_v2_v3_comparacao.png`.
- **Sem barra de métricas inferior** — o Kanban ocupa a maior parte da tela (métricas migram para Executivo/summary recolhível).
- **Header com menos ruído / 3 níveis**: (1) título "Meu quadro" dominante; (2) busca / Kanban·Lista·Calendário / SLA compacto ("Tudo em dia" + dot) / sino / avatar / Nova tarefa; (3) subnav de abas + filtros contextuais mais leves.
- **Abas como subnav** (pill sutil no ativo, sem underline/color em excesso).
- **Cards**: tags mais discretas (contorno, sem preenchimento), prioridade "Alta" suave (tint 8% + contorno), barra de progresso 4px refinada, **seleção sutil** (anel de marca 1px + tint 3% + microssombra, sem outline forte), cliente como metadata (menor/muted), contraste maior nos metadados.
- **Drawer**: header em camadas (status principal + linha secundária "Aprovada pelo cliente · Entregue · Concluída 07/08" no lugar de 3 badges), **linha do tempo** refinada (linha 1,5px, nós menores + avatar do ator), componente de arquivo e CTA em gradiente ajustados.
- **Sidebar**: "Clientes 12" compacta (4 recentes + "Ver todos os clientes"); **cartão do usuário integrado** (sem caixa, divisória superior + barra do Plano fina).
- **Contraste** dos textos secundários/terciários aumentado; **sombras** ainda mais sutis (cards quase flat; elevação progressiva em hover/selected/drawer).
- **Render**: exatamente 1920×1080, sem faixa cinza (o que parecia "vazio" na V2 era o cânvas do quadro sob a barra de métricas — resolvido preenchendo as colunas e removendo a barra).
- **Densidade** Compacta preservada; quadro com conteúdo realista (22 tarefas, 4 colunas).

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
