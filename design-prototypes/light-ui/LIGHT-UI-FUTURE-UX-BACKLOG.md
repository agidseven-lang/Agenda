# Light UI — Backlog de UX futuro (NÃO implementar / NÃO mostrar no FRAME real)

Ideias que surgiram durante o redesign visual mas que **não existem hoje** no Agenda ID Seven
(ou não estão formalmente aprovadas). Foram **removidas do V4** (que representa o produto real
apenas redesenhado) e ficam registradas aqui como **proposta futura**. Nada aqui está autorizado,
implementado, nem aparece no FRAME principal. Avança só com GO explícito do owner, item a item.

Base da decisão: auditoria READ-ONLY do renderer real (`desktop/src/renderer/index.html`, candidata 1.0.246).
Matriz "existe no produto real? SIM/NÃO" abaixo.

| # | Ideia (estava no V3) | Existe hoje? (evidência no renderer) | Decisão V4 |
|---|---|---|---|
| 1 | **Modo Lista** (alternador no header) | Não há alternador Kanban/Lista/Calendário | Removido → backlog |
| 2 | **Modo Calendário** dentro do "Meu quadro" | "Calendário" aparece só como a função **Agenda** (sidebar), não como modo do quadro | Removido → backlog |
| 3 | **Densidade Compacto / Confortável** (toggle no board) | Sem toggle de densidade de board confirmado | Removido → backlog |
| 4 | **Ordenação** ("Ordenar: Prazo") | `Ordenar` = 0 ocorrências | Removido → backlog |
| 5 | **Lista de clientes fixa na sidebar** ("Quadros de clientes") | `Quadros de clientes` = 0; acesso a cliente é pela **aba Cliente** | Removido → backlog |
| 6 | **Clientes favoritos / "Ver todos os clientes"** | Não confirmado | Removido → backlog |
| 7 | **Workspace / "Espaço da Agência"** + seletor "ID Seven · Agência" | `Espaço da Agência` = 0; sem entidade de multi-workspace | Removido → marca vira "Agenda ID Seven / sincronizado" |
| 8 | **Plano / Billing** ("Plano Business 80%") na sidebar | frase `Plano Business` = 0; sem billing no app | Removido → backlog |

## O que FOI preservado no V4 por ser real (confirmado no renderer)
- Busca + atalho **⌘K / Ctrl+K** (placeholders reais "Buscar tarefa…").
- **SLA** ("Tudo em dia" — monitor de SLA existe).
- **Notificações** (sino, badge) · **Perfil** (avatar/menu) · **Nova tarefa**.
- **Filtros** + **filtro por Responsável** (Filtros e Responsável existem no código).
- Abas do quadro: **Meu quadro · Cliente · Designers · Social Medias · Setores** (chips reais; label correto é "Social Medias").
- Sidebar real: **Minhas Prioridades · Hoje · Agenda · Tarefas · Equipe · Perfil · Executivo · Relatórios · Notificações · Configurações**.
- Kanban 4 colunas (A Fazer/Em andamento/Revisão/Finalizado) + cores de status.
- Cards, drawer lateral direito, cores por responsável, sem barra de métricas inferior.

## Observação
Se o owner confirmar que algum item acima **já existe** (ou aprovar como novo), ele sai do backlog
e volta ao FRAME — com o mesmo cuidado de fidelidade. Até lá, o V4 = **produto atual, redesenhado**.
