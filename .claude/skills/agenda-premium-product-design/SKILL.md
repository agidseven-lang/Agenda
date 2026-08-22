---
name: agenda-premium-product-design
description: Autoridade visual do Agenda ID Seven. Use SEMPRE que for desenhar, criticar, mockar ou revisar QUALQUER superfície do Agenda (F1-F13, shell, kanban, cards, KPIs, modais). Define o padrão premium obrigatório (Premium Score >= 85/100), a hierarquia de superfícies anti-white-canvas, densidade, tipografia, profundidade, brand DNA (navy/petroleum/teal) e os anti-patterns proibidos. Nenhum redesign pode ser apresentado ao owner abaixo do gate. Decisões finais de direção pertencem ao owner (ver owner-approved/).
---

# AGENDA PREMIUM PRODUCT DESIGN

Autoridade visual específica do **Agenda ID Seven** (desktop 1920×1080-first, SaaS de
operações criativas: agência, kanban de produção, SLA, cronogramas).

## Como usar esta skill
1. Antes de desenhar: ler `design-system/*` (superfícies, densidade, tipografia) e
   `anti-patterns/*` (proibições). Consultar `references/*` para padrões.
2. Toda proposta passa por `evaluation/premium-scorecard.md` → **PREMIUM SCORE 0–100**.
   **Gate: < 85/100 NÃO apresenta ao owner. Refazer.**
3. Decisões de direção (referências aprovadas, sistema de superfícies, card system,
   densidade) vivem em `owner-approved/` — **se estiver vazio, a decisão é do OWNER,
   nunca do Claude**. Propor, mostrar, aguardar.
4. Fontes de conhecimento na cadeia: plugin **Design** (design-critique/design-system/
   accessibility-review), skill **UI/UX Pro Max** (styles/palettes/typography/ux por
   busca: `python3 /root/.claude/skills/ui-ux-pro-max/scripts/search.py "<q>" -d <dom>`),
   e esta skill (decisões específicas do Agenda). Em conflito, esta skill vence para o
   Agenda; owner vence sempre.

## MANIFESTO (resumo executivo — íntegra em cada arquivo)
1. Função antes de decoração.
2. Hierarquia antes de cor.
3. Superfícies têm NÍVEIS — branco puro nunca é o fundo dominante de todos os níveis.
4. Espaço em branco é intencional; espaço morto é defeito.
5. Denso ≠ poluído: densidade é eficiência espacial com legibilidade.
6. Todo card ganha o espaço que ocupa; nenhum card flutua num vazio.
7. Cor comunica estado e identidade (setor/responsável/estágio) — nunca enfeite.
8. Empty states ficam quietos (uma linha discreta, nunca protagonistas).
9. Navegação óbvia; contexto sempre visível (shell → contexto → board → estágio → task → metadado).
10. Premium ≠ excesso de efeitos: profundidade por tons + hairlines + sombra CONTIDA.
11. PROIBIDA a estética "AI admin template genérico" (ver anti-patterns/generic-ai-ui.md).
12. Dados reais comandam a composição (2 tarefas reais > 30 inventadas).
13. A sidebar petróleo é âncora de marca; o workspace precisa do MESMO acabamento.
14. 1920×1080 é a tela de referência; nada de layout que só funciona vazio.
15. Acessibilidade não regride: contraste 4.5:1+, foco visível, alvos 24px+.
