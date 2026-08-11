# Comparação — Proposta A × B × C (Light UI)

> MAQUETES DE DESIGN — NÃO É PRODUÇÃO. Não altera o app, o tema, nem entra no build.
> Objetivo: subsidiar a decisão do proprietário sobre a direção visual do “Meu quadro”.

---

## Visão rápida

| Critério | A — Pinterest Clean | B — Executive | C — Creative Studio (Híbrido A+C) |
|----------|---------------------|---------------|-----------------------------------|
| Sensação | Arejada, leve, amigável | Séria, corporativa, precisa | Refinada, “produto de estúdio” |
| Sidebar | Clara | Clara (densa) | **Escura de marca** (petróleo/teal) |
| Densidade | Média (muito ar) | **Alta** (mais dados/linha) | **Compacta** + variante Confortável |
| Sombras / cantos | Suaves, bem arredondados | Curtas, cantos discretos | Suaves e arredondados, com poços por coluna |
| Detalhe da tarefa | Drawer direito 460px | Drawer direito 436px com abas | **Drawer direito 480px** |
| Extras | Filtro por pessoa | Tira de KPIs, IDs de tarefa, WIP | **Barra de métricas** no rodapé, sparkline, sync |
| Acento | Índigo `#6366F1` | Azul corporativo `#2F6FED` | Teal `#12B0A0` (casado à sidebar) |
| Cor por usuário | Sim (anel+filete+chip) | Sim (+ tabela de tokens) | Sim (+ demo “mesma tarefa, 3 pessoas”) |

## Prós e contras

### A — Pinterest Clean
**Prós:** acolhedora e fácil de ler; ótima primeira impressão; cards grandes e escaneáveis; baixa curva de aprendizado.
**Contras:** menos itens por tela; “ar” pode parecer pouco produtivo para quem gere muitas tarefas; sidebar clara tem menos identidade de marca.
**Quando usar:** times pequenos, uso leve, quando simpatia e clareza importam mais que densidade.

### B — Executive
**Prós:** máxima informação por tela (prioridade, prazo, subtarefas, contagens, ID, WIP); tira de KPIs dá leitura gerencial imediata; visual sério e confiável.
**Contras:** pode parecer “pesada”/técnica; menos convidativa; densidade alta exige mais atenção visual.
**Quando usar:** operação madura, muitos clientes/tarefas simultâneas, perfil gestor/PMO que vive no board.

### C — Creative Studio (Híbrido A+C) — recomendada
**Prós:** equilíbrio entre a leveza da A e a densidade da B; **sidebar escura de marca** dá identidade forte mantendo o workspace claro (Light UI); **drawer direito** para detalhes sem cobrir o board; **barra de métricas discreta** entrega contexto de gestão sem poluir; **duas densidades** (Compacto padrão + Confortável) atendem gestão e leitura; acento teal amarra o sistema.
**Contras:** um pouco mais de esmero de implementação (sidebar escura + tema claro + drawer + métricas); exige disciplina de tokens.
**Quando usar:** produto que quer parecer premium e ser produtivo ao mesmo tempo — o caso da agência.

## Sistema de cor por usuário (comum às três)

Uma cor fixa por pessoa aplicada como **identidade, não como fundo**: anel do avatar, filete de acento na
borda esquerda, chip “responsável”, filtro por pessoa e indicador discreto. Escala de 10 (base) a 20+
(regra de ângulo áureo). A cor nunca é o único indicador — sempre acompanha iniciais + nome. Detalhes em
`TOKENS.md`. O status de coluna segue a mesma regra: **ponto + rótulo + ícone**.

## Recomendação

**Adotar a Proposta C — “Creative Studio / Híbrido A+C”.**

Motivos:
1. **Identidade + Light UI**: a sidebar escura de marca (petróleo/teal) dá personalidade sem abandonar o
   workspace claro pedido; é o melhor dos dois mundos.
2. **Produtividade sem poluição**: densidade Compacta como padrão + barra de métricas discreta entregam
   gestão real; a variante Confortável cobre leitura/apresentação.
3. **Detalhe correto**: drawer lateral direito de 480px em vez de modal gigante — o board permanece visível
   ao abrir uma tarefa, favorecendo o fluxo de arrastar/mover.
4. **Escalável e consistente**: mesma base de tokens, cores de status e sistema por usuário — fácil de
   manter e de crescer para mais clientes/pessoas.

Sugestão de caminho: fechar a **C** como direção; aproveitar a **tira de KPIs da B** (opcional) e a
**generosidade de leitura da A** já embutidas na densidade Confortável da C.
