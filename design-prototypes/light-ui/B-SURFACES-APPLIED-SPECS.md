# SUPERFÍCIES B — APPLIED SPECS (Light UI)

**Status:** ENTREGUE (R7) — aguarda owner; NÃO concluída. Fonte: Desktop **1.0.246** (auditoria
integral por superfície). Zero produção; **zero imagem nova**. Classe B = superfícies reais 100%
especificáveis com Shell Golden + foundations C1–C8 (todas OFICIAIS) — **nenhuma vira Frame A**.

## 0 · MATRIZ GERAL
| Superfície | Função real (linha) | Complexidade | Foundations | Golden anchors | Gap? |
|---|---|---|---|---|---|
| Prioridades | `renderPrioridades` 5287 | média | C1 C4 C5 C6 C8 Shell | F1 cards/severity · R2 chips/estados | NÃO |
| Hoje | `renderHoje` 5821 | baixa | C1 C4 C8 Shell | **R2 stat-tile** · F8 eventCard | NÃO |
| Hub / quadros por pessoa | `renderHub` 6135 · `renderRoleBoards` 6175 · `renderPersonBoard` 6190 | baixa | C1 C8 Shell | **F5 (bcard)** · F1/F3/F4 (boards destino) | NÃO |
| Equipe | `renderEquipe` 10260 | trivial | C1 C8 Shell | avatares/cards/pills Golden | NÃO |
| Perfil | `renderPerfil` 10282 | baixa | C1 C2 C8 Shell | F12 (identidade) · C2 sheets | NÃO |
| Configurações | `renderConfig` 10334 | média | C1 C2 C5 C6 C8 Shell | **R2 (seção Check-ins)** | NÃO |

---

## 1 · PRIORIDADES (`renderPrioridades` 5287 · tab `prioridades`)
**Função real:** painel read-only "o que merece sua atenção primeiro" (PriorityEngine sobre
state.tasks do usuário). **Gate:** `priIsEnabled()` = PREFERÊNCIA (Config→Produtividade), não
cargo; desativado ⇒ card literal "Assistente desativado / Reative em Configurações →
Produtividade… Nenhuma tarefa é alterada por este painel."; engine ausente ⇒ "Assistente
indisponível nesta versão."
**Estrutura:** header (ícone gauge + "Minhas Prioridades" + sub "Bom trabalho, {nome}. O que
merece sua atenção primeiro · tempo real · somente leitura" + chip **Minimizar/Expandir**) →
banner OFFLINE âmbar (C8 §15, `navigator.onLine`) → **resumo em pills** (Críticas · Atenção ·
Para hoje · Em andamento · Ocorrências, cores reais) → **8 filtros chip** (`PRI_FILTERS`: Todas/
Críticas/Para hoje/Pedidos de ajuda/Bloqueadas/Aguardando cliente/Em andamento/A Fazer;
selecionado = accent sólido) → lista `priCard` → seção **"Aguardando cliente"** (espera externa,
sem culpa interna) → ocorrências (help/blocked, dismissíveis).
**priCard (componente aplicado, não nova família):** card Golden com **rail 5px** na cor do
nível (1 Crítico/2 Atenção/3 Normal), pill "Nª · {Nível}", setor, live-alert à direita, título
15 + "· cliente", razões em lista; clique = abre Detalhes (`data-pri-task`). Minimizado ⇒ só
resumo + "Painel minimizado — clique em Expandir…".
**Empty real:** "Tudo certo por aqui / Nenhuma tarefa exige sua atenção imediata neste momento."
(card centrado — variante da escala C4) · "Nenhuma tarefa aguardando decisão do cliente."
**Foundations:** C1 (chips/pills) · C4 (empties) · C5 (—; deriva de snapshot) · C6 (—) ·
C8 (selected chip, rail de nível, offline grammar, hover desktop) · Shell.
**R8:** lista 1-col já empilha; pills/filtros com wrap — validar 1366/125%. **R9:** chips
selecionados sem aria-pressed (dívida C8); cards clicáveis são div+data (teclado = requirement).
**Dívidas:** painel usa `priObs` (telemetria) — sem UI; nomes de nível só por cor+texto ✓.

## 2 · HOJE (`renderHoje` 5821 · tab `hoje`)
**Função real:** resumo operacional do dia. **Estrutura:** saudação "Olá, {primeiro} 👋" + sub
"Resumo de hoje · {dia}" → **STAT-TILES (C8 §14, owner)**: "Hoje" (eventos de hoje, `.accent`) ·
"Tarefas" (abertas) · "Equipe" (ativos) — clicáveis `data-tab` p/ Agenda/Tarefas/Equipe; hover
lift real; → 3 colunas desktop (`d-home`): "Compromissos de hoje" (eventCard F8) · "Tarefas
urgentes" (4 por prazo — `urgentRow`: avatar 38 + título 14.5/800 + dot setor + cliente + pill
de prazo `taskDeadline`) · "Próximos compromissos" (5, eventCard).
**Empties reais (escala linha C4):** "Nada agendado para hoje." · "Nenhuma tarefa pendente. 🎉"
· "Nenhum compromisso futuro agendado."
**Foundations:** C8 (stat-tile ≠ KPI — Hoje NÃO vira dashboard executivo) · C4 (emptyline) ·
C1 (pills/avatar) · Shell. **Anchors:** R2 `3c06c26` (stat-tile) + F8 (eventCard).
**R8:** d-home 3-col → empilhar; tiles flex 1. **R9:** tiles são `<button>` ✓ (teclado nativo);
valor/label sem aria (dívida C8). **Dívidas:** emoji reais preservados (👋/🎉 — literais).

## 3 · HUB / QUADROS POR PESSOA (`renderHub` 6135 · `renderRoleBoards` 6175 · `personBoard`)
**Função real:** índice de navegação da aba Tarefas. **Estrutura:** header "Quadros / Gestão por
setor da agência" + badge "N tarefas" → grade de **`bcard`** (componente Golden do F5: icb tint
46 + título + descrição + pills de contagem + seta): **"Meu quadro"** (todos; "N abertas") →
**"Quadros por responsável"** (**GATE roleCat===ADMIN**; pill "admin") → **"Cliente"** +
**"Designers"** (**GATE canSeeAll**; contagens reais + pill vermelha "N em atraso" condicional)
→ um bcard por **SETOR ATIVO** (`SECTORS !descontinuado`; ícone/cor do setor; "N tarefas" +
"N em atraso" condicional). Desktop = grid `d-hub`.
**renderRoleBoards (admin):** header com voltar + título "Quadros por responsável / Cada pessoa
em um quadro isolado — sem misturar" + lista de pessoas ativas → `personBoard` (F1 Golden).
**Foundations:** C1 (pills) · C8 (hover bcard REAL lift/border — linha 1320) · Shell. **Anchors:**
F5 (bcard) · F1/F3/F4 (destinos). **Sem empty próprio** (setores sempre listados).
**R8:** grid → 1-col. **R9:** bcards são `<button>` ✓. **Dívidas:** nenhuma nova.

## 4 · EQUIPE (`renderEquipe` 10260 · tab `equipe`) — RECONFIRMADA ~10 linhas
**SPEC B SUFICIENTE / ZERO FRAME PRÓPRIO (reconfirmado).** Filtra removido/excluído (PENDENTE
aparece), ordena por nome. Header "Equipe / N integrantes". **Card de pessoa:** avatar 42
(foto real→iniciais) + nome 15/800 + "(você)" faint p/ o próprio + "cargo · admin" 12.5 soft +
pill de status à direita (**"Ativo"** verde tint / **"Pendente"** âmbar tint). Grid `d-team`
desktop. **NÃO existem** (reconfirmado): ações, edição, convite, detalhe, filtros, busca, empty
dedicado. **Foundations:** C1 (avatar/pills) · C8 · Shell. **Nota de código:** `renderChat` é
CÓDIGO INATIVO (sem rota/menu; mantido byte-idêntico por contrato K8) — não é superfície.
**R8:** grid → empilha. **R9:** cards não-interativos (sem requisitos de foco).

## 5 · PERFIL (`renderPerfil` 10282 · tab `perfil`) — READ-ONLY + sheets
**Função real:** identidade + acesso às ações de conta. **Estrutura:** `pcard` centrado (avatar
**92** + nome 21/800 + cargo + pill **"Administrador"** índigo / **"Membro da equipe"** verde) →
seção "Configurações" com **3 settRow → sheets C2** (`openSheet`): **Conta** ("Seus dados" —
infoline Nome/Função/E-mail/WhatsApp/Status/Permissão/ID + ação "Alterar e-mail de login") ·
**Segurança** ("Sessão protegida por autenticação server-side" — infoline + "Trocar senha" +
**"Sair da conta"** tint vermelho) · **Sobre o aplicativo** ("Versão {BUILD}" — infoline
App/Build/Versão real/Ambiente/Tecnologia) → botão **"Sair da conta"** (ghost vermelho,
`data-logout`) → rodapé "ID Seven · Desktop {ver} · produção".
**IMPORTANTE (auditado):** o Perfil NÃO tem inputs/edição inline nem upload de foto — toda
edição vive nos modais C2 de credenciais (chpw/chemail). Não criar form no Perfil.
**Foundations:** C1 (pills/settrow) · **C2** (openSheet/credenciais) · C8 · Shell. **Anchors:**
F12 (identidade/auth) + C2 contract. **R8:** coluna única ✓. **R9:** settrows são botões ✓;
logout com confirmação? — logout é direto (sem confirm; registro). **Dívidas:** rodapé
técnico "produção" (UX-writing, já consolidada).

## 6 · CONFIGURAÇÕES (`renderConfig` 10334 · tab `config`) — página única, seções empilhadas
**RECONFIRMADO: B (shell) + C1 — sem sub-rotas; nenhum upgrade de classe.** Seções REAIS (títulos
literais, ordem): **Gerenciamento de Conta** (Conta; Alterar e-mail) · **Privacidade e
Segurança** · **Preferências de Notificação** (Testar notificação) · **Produtividade** (toggle
"Mostrar o Assistente de Prioridades" — gate do Prioridades) · **Notificações · Diagnóstico**
(toggles reais: "Autocorreção de notificações" · "Agrupar atualizações comuns da mesma tarefa" ·
"Estilo premium das notificações comuns" · "Mostrar opções de ação nos alertas de prazo" ·
"Verificar tarefas paradas em "Em andamento"" + "Atualizar diagnóstico" + linha "Carregando
diagnóstico…" C5) · **Bandeja do sistema (tray)** (linha de status REAL com 5 estados:
Criada·ícone OK verde / VAZIO âmbar / Não encontrada vermelho / Recriada agora azul / Erro âmbar
/ Indisponível cinza — pill com dot + detalhe técnico; ação Recriar) · **Inicialização com o
Windows** (toggle "Iniciar com o sistema/Windows") · **Acompanhamento de execução**
(**Check-ins do Designer — AMOSTRA VISUAL GOLDEN NA R2**: settrow + chips de modo + dias +
inputs + checkboxes + "Salvar configuração" + gate admin + erro `#etMsg` + "Carregando…") ·
**Acessibilidade e Aparência** · **Desempenho e Dados** · **Idioma e Região** · **Administração**
(gate admin) · **Atualizações** (fluxo electron-updater: verificar/disponível/baixando/instalar/
erro/atualizado + toast C6) · **Sessão** · **Sobre** — placeholders **"Em breve"** reais em
seções não implementadas (literal preservado).
**Foundations:** C1 (settrow/toggle/chips/inputs/checkbox) · C2 (modais de credenciais) · C5
(linhas Carregando) · C6 (toasts/erros de seção) · C8 (estados) · Shell. **Anchor:** R2
`3c06c26` (seção real renderizada). **"Sobre/versão" = D reconfirmado** (linhas de token/texto;
sem superfície própria — posição correta mantida no mapa).
**R8:** página longa = scroll vertical real; settrows full-width. **R9:** toggles/checkboxes
nativos ou C1; gates com texto ("Somente administradores…") ✓; pills de status com texto ✓.
**Dívidas:** literais técnicos nas linhas de diagnóstico/tray (iconEmpty/origem/log local) —
dívida UX-writing registrada; "Em breve" como placeholder real.

---

## 7 · FOUNDATION × SUPERFÍCIE
| Superfície | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | Shell |
|---|---|---|---|---|---|---|---|---|---|
| Prioridades | ✓ | — | — | ✓ | cond.(offline) | — | — | ✓ | ✓ |
| Hoje | ✓ | — | — | ✓ | — | — | — | ✓ | ✓ |
| Hub | ✓ | — | — | — | — | — | — | ✓ | ✓ |
| Equipe | ✓ | — | — | — | — | — | — | ✓ | ✓ |
| Perfil | ✓ | ✓ | — | — | — | cond.(toasts) | — | ✓ | ✓ |
| Configurações | ✓ | ✓ | — | — | ✓ | ✓ | — | ✓ | ✓ |
**Prova de cobertura: 100% das B compostas por foundations OFICIAIS — zero componente novo.**

## 8 · RESPONSIVIDADE (VALIDAR EM R8) · A11Y (CONSOLIDAR EM R9)
Pontos por superfície registrados nas seções acima (reflow de grids d-home/d-hub/d-team;
pills com wrap; página Config longa; stat-tile em 125%). A11y comprovado × requirement idem
(botões nativos ✓; aria de seleção/valores = dívida C8 p/ R9). Nada declarado pronto.

## 9 · DÍVIDAS CONSOLIDADAS DA R7 (não corrigir)
Literais técnicos de Config (tray/diagnóstico) · rodapés "produção"/build · chips de filtro sem
aria-pressed · cards de prioridade clicáveis por div+data (teclado) · logout sem confirmação ·
placeholders "Em breve" (conteúdo futuro do produto, não do design).

## 10 · GUARDRAILS DE IMPLEMENTAÇÃO
Nenhuma B vira Frame A · Hoje nunca vira dashboard (stat-tile ≠ KPI) · Prioridades permanece
read-only ("Nenhuma tarefa é alterada por este painel") · Equipe permanece sem ações · Perfil
permanece read-only + sheets (sem form inline/upload de foto) · Config permanece página única
(sem sub-rotas) · literais/gates/emoji preservados · `renderChat` permanece inativo.

## 11 · CLOSURE CRITERIA
R7 fecha quando o owner aprovar estas specs; as 6 B passam a "SPEC APLICADA — APROVADA" no mapa;
pendências restantes das B ficam SOMENTE em R8 (responsividade) e R9 (a11y).
