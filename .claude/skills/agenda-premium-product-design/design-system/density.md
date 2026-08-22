# DENSITY — eficiência espacial em 1920×1080
Problema documentado da 1.0.248: cards de ~350×190px perdidos em colunas de ~380×640px
vazias; header de 3 andares; KPIs desconectados no rodapé; >55% de pixels sem função.
METAS:
- Colunas do kanban: 300–340px de largura útil; altura do board = altura disponível.
- Header + toolbar: 1 a 2 faixas (máx ~110px total), nunca 3.
- KPI: contextual e acoplado (rail lateral ou strip integrada), nunca 5 cartões soltos.
- Empty state de coluna: 1 linha discreta (~40px), jamais um bloco de 300px.
- Em 2 tarefas reais a tela AINDA deve parecer estruturada: as superfícies (board frame,
  wells) seguram a composição mesmo com poucos cards.
- Alvo: >= 70% dos pixels em superfícies com função (estrutura, dados, ação).
