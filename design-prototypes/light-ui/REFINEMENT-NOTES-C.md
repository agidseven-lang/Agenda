# Proposta C — Refinamento Profissional · Light UI (1920×1080)

**Status:** **FRAME 1 · Meu quadro · V10 = LAYOUT APROVADO / GOLDEN VISUAL REFERENCE** (decisão do
owner). Isso congela o Design System (workspace light, sidebar petróleo, proporções, header, busca,
subnav, filtro, fotos reais, Kanban 4 colunas, cards brancos + faixa=responsável, ring=responsável,
coluna=status, tag=categoria, Inter/Inter Tight, grid/spacing, sombras, radius, iconografia, drawer,
timeline, componente de arquivo, CTA gradiente, SEM barra de métricas, SEM funções inventadas) —
e NÃO autoriza implementação: `desktop/src`, CSS/JS real, release, baseline, workflows, Worker e
Firestore seguem intocáveis. Toda nova superfície deve ser comparada à V10 antes de ser apresentada
("Parece pertencer exatamente ao mesmo produto?").

**Microcontratos registrados (decisão do owner):**
- **Foto do Miercohévisk**: o recorte de screenshot da maquete é exclusivamente temporário; a
  implementação real DEVE usar a foto original cadastrada, resolvida pelo runtime real
  (`photoOf` → `avatar()`); o recorte NUNCA vai a produção nem ao Git.
- **Responsável primário**: faixa lateral do card = responsável primário da tarefa; múltiplos
  participantes aparecem só nos avatares; nunca faixa multicolorida; categoria/status nunca usam
  essa cor.
- **Header**: whitespace preservado — não ocupar espaços livres com botões novos.
- **Títulos longos**: máximo visual controlado — line-height fixo (1.45) + line-clamp 2; nunca
  cards desproporcionais.

## FRAME 7A — NOVA TAREFA · ETAPA 1 SETOR (candidata) · `proposta-c-frame7a-novatarefa-setor.html`
**Status dos anteriores:** FRAME 6 · Detalhes completos = **LAYOUT APROVADO / GOLDEN** (com V10,
Cliente, Designers, Social Medias e Setores — 6 Golden). FRAME 7A abre o wizard real de Nova
tarefa (P0) e inicia a foundation **C1 — Forms & Controls**.

**Auditoria read-only (renderer real 1.0.246):**
- **Paradigma real**: `renderForm()` (11314) é SUPERFÍCIE DEDICADA — `render()` (5125) troca o
  conteúdo por `.form-wrap` (card max-width 980, centrado, radius 18, footer sticky) com
  sidebar/nav visíveis. NÃO é modal; preservado como card-superfície no canvas, sem overlay/blur.
- **Etapas reais**: `STEPS=['Setor','Dados','Briefing','Revisão']`. Título "Nova tarefa"
  ("Editar tarefa" em edição); subtítulo = label do setor (senão "Selecione o setor"); label real
  da etapa: **"Escolha o setor"**. Stepper real: círculos numerados, atual/concluída = accent,
  conector accent quando percorrido.
- **Setores na criação** = `SECTORS.filter(!descontinuado)`, ordem real: Edição de vídeos
  (#60A5FA, movie, "Cortes, legendas e exportação"; key interna edicao_midia) · Cronograma
  (#34D399, calendar, "Planejamento de publicações") · Edição de Cards (#F472B6, image, "Criação
  de cards avulsos" — gated `canCreateCards()` p/ Social/Admin; usuário CEO·admin ⇒ visível).
  Descontinuados (71C7/F3.5.5E) fora da criação: Copywriting, Roteiro, Programação de posts.
- **Seleção real**: `data-fsector` seta o setor (reset subtype/contents/checklist) e re-renderiza;
  seleção única; não avança sozinho. Selecionado real = fundo withAlpha(.12) + borda na cor +
  pastilha withAlpha(.18) + ✓ na cor. **Validação real**: `stepNext()` → alert('Escolha o
  setor.') — o Próximo NÃO fica disabled (nenhum disabled inventado; frame retrata pós-seleção).
- **Botões reais**: só "Próximo" na etapa 1 (Voltar nasce na etapa 2, `f.step>0`); fechar = X
  (data-form="close"). Subtipo não aparece nesta etapa.

**Composição:** sidebar + header globais Golden (header "Nova tarefa · Etapa 1 de 4 · Cronograma",
pastilha + índigo brand — o subtítulo real do form elevado ao header global, sem duplicação);
card do wizard 920px centro óptico com sh-2: stepper premium (atual = círculo gradiente + kicker
"ETAPA ATUAL" + label 700; futuras = círculo hairline numerado + label tx-3; conectores hairline;
X no canto) → "ESCOLHA O SETOR" (label C1 11/700/uppercase) → 3 option cards C1 (ícone 24 em
pastilha 52 tintada, título 16/650, descrição 13, radius 14, hairline; Cronograma SELECIONADO:
tint 7% + ring 1.5 na cor + ✓ disco verde) → footer hairline com "Próximo →" gradiente Golden
(primário único). Contratos C1 iniciados e documentados no cabeçalho (labels, option card,
primário, focus ring, disabled futuro, transições 140ms).

**Fixes de render:** centro óptico (stage padding-top 96→168); kicker "A SEGUIR" repetido 3×
removido (futuros = número+label, menos ruído); nota de rodapé "Setor selecionado · Cronograma"
removida (duplicava o subtítulo real do header). Fotos: wizard não requer fotos; rodapé da
sidebar usa fallback de iniciais (fotos locais NUNCA versionadas — _team-photos.css local-only).

## FRAME 6 — DETALHES COMPLETOS DA TAREFA (candidata) · `proposta-c-frame6-detalhes.html`
**Status dos anteriores:** FRAME 5 · Setores = **LAYOUT APROVADO / GOLDEN** (com V10, Cliente,
Designers e Social Medias). FRAME 6 é a primeira superfície de página inteira (P0 do Master
Surface Map): a tela aberta por "Ver detalhes completos".

**Auditoria read-only (renderer real 1.0.246):**
- **Superfície real**: `renderClientView` (9913, rota `state.clientView`) + `opPanelBlock` (8848,
  painel "Próxima ação" + "Linha do tempo operacional" det-tl) + blocos do detalhe: "Resposta do
  cliente" (`det-cresp`, labels reais `clientReviewLabel` = Aprovado pelo cliente `#34D399` /
  Revisão solicitada `#F59E0B` / Edição solicitada `#A78BFA`, nota entre aspas + carimbo + autor),
  "Designer" (avatar + cargo + chip Recebido/Em produção/Concluído), resumo editorial por conteúdo
  (`cvw-ed-*`: tema, legenda ou "ainda não preenchida", media Feed 1080×1440 / Story 1080×1920
  presente ou pendente — `pendingLegend`/`pendingFeed`/`pendingStory`), checklist, ações
  `data-clientact`.
- **Estágio simulado**: `aguardando_legenda` — Cronograma APÓS a entrega do designer ("Aguardando
  legendas e posts" `#5B6CFF`; `nextActionShort` = "Adicionar legendas e posts"). NÃO é conclusão.
- **Contratos F3.5.6A preservados**: rodada de temas aprovada ≠ aprovação final (FLUXO DO CLIENTE
  mostra "Temas aprovados · Rodada de temas" done + "Rodada final ainda não enviada" pendente);
  designer entregou ≠ tarefa concluída (timeline segue em aberto); espera externa ≠ SLA da equipe
  (bola está COM A EQUIPE aqui, logo "SLA interno ativo · Em prazo" é legítimo); marcos honestos
  H13 (só nó done tem carimbo; atual sem data; pendentes vazios; "Cliente pediu ajuste" tracejado
  âmbar marcado `condicional`).
- **Pós-conclusão (H16/H17) documentado no cabeçalho do HTML**: neste estado H16/H17 esconderia
  "Legendas e artes", "Enviar ao cliente", "Editar prazo" e "Mover status"; "Remover" permanece
  (administrativa). O frame retrata o estágio ATIVO, então todas aparecem.

**Composição (detail view editorial, não modal técnico):** sidebar + header globais Golden (header
"Detalhes da tarefa · Cronograma · Sunset Wear" + voltar + monitor SLA + sino). HERO: chips (Em
andamento · Aguardando legendas e posts · Em prazo · Cronograma) → título 29px Inter Tight →
"Cliente · Sunset Wear · Enviado por Miercohévisk em 11/08/2026" → bloco PRÓXIMA AÇÃO (tint
índigo, sem banner gritante); à direita RESPONSÁVEL AGORA (Tatiana 46px rose) + CTA gradiente
"Legendas e artes" (ação primária real da fase) + menu "⋯". Corpo em 3 colunas (1fr/354/332):
**ESQ** painel OPERAÇÃO (3 células: FLUXO DO CLIENTE com rodada aprovada + rodada final pendente ·
FLUXO DO DESIGNER entregue com carimbo · RESPONSABILIDADE "Com a equipe · Social Media") + painel
CONTEÚDOS (12 temas · 7 legendas · 5 pendentes; 4 itens com estados reais distintos — Completo /
Produção parcial / Aguardando legenda ×2, media ok vs pendente por item + "+ 8 conteúdos");
**MEIO** EQUIPE DA TAREFA (Tatiana AGORA · Felipe ENTREGUE · Miercohévisk enviou os temas) +
PRAZOS E SLA (prazo final em destaque + "Em prazo · faltam 4 dias", início, criado, atualizado) +
RESPOSTA DO CLIENTE ("Aprovado pelo cliente" + nota + 12/08 · 10:26 · Sunset Wear) + ações
administrativas discretas ancoradas (Editar prazo · Mover status · Remover danger); **DIR** LINHA
DO TEMPO OPERACIONAL completa (10 nós: 6 done com mini-avatar do ator + carimbo, atual índigo
"Etapa atual — com a Social Media" SEM data, 2 pendentes vazios, condicional âmbar tracejado).

**Fixes de render:** lateral única de 400px não comportava a timeline completa (cortava no 4º nó)
→ corpo passou a 3 colunas com a timeline em coluna própria; "faltam 4d" quebrando → sublinha
própria "Em prazo · faltam 4 dias"; botões administrativos quebrando em 2 linhas → padding/fonte
compactos + nowrap; header da timeline em 2 linhas → fonte 10.5 + nowrap; símbolo inexistente
`#i-img` no item 04 → `#i-image`. Responsividade preparada (arquitetura tolera 1366×768/125%:
colunas colapsáveis, hero flex, timeline independente) — só 1920×1080 renderizado, por mandato.

## FRAME 5 — SETORES (candidata) · `proposta-c-frame5-setores.html`
**Status dos anteriores:** FRAME 4 · Social Medias = **LAYOUT APROVADO / GOLDEN** (com V10, Cliente
e Designers). FRAME 5 aplica o DS congelado à tela Setores REAL — redesign VISUAL apenas.

**Auditoria read-only (renderer real 1.0.246):**
- **Superfície real**: a aba "Setores" abre o HUB de setores (`data-board="hub"`); escolher um
  setor abre `renderBoard()` — header real "Quadro de <Setor>" + descrição do setor + toolbar com
  busca e chip **"Minhas tarefas"** (filtro real `boardMine`).
- **Setores ATIVOS reais** (`SECTORS`, excluindo `descontinuado:true` / retirados F3.5.5E —
  Copywriting, Roteiro e Programação de posts permanecem só para histórico e o quadro retirado
  nunca abre): **Cronograma** `#34D399` "Planejamento de publicações" (calendar) · **Edição de
  vídeos** `#60A5FA` "Cortes, legendas e exportação" (movie) · **Edição de Cards** `#F472B6`
  "Criação de cards avulsos" (image).
- **Colunas REAIS = `STATUS`**: A Fazer `#9BA0AB` · Em andamento `#F59E0B` · Revisão `#60A5FA` ·
  Concluído `#34D399` — bucket do EIXO OPERACIONAL (`flowBoardCol('social')`), ordenação por
  prazo, contadores por coluna.
- **Ajuste do cliente real**: `pendingClientItems` (contagem de conteúdos marcados p/ correção na
  FASE atual) + marco `ajuste` da `taskTimeline` em estado ATTENTION (nó âmbar, carimbo real do
  pedido). Demais dados reais herdados dos frames Golden: estágios `OPERATIONAL_COLS` no chip,
  `nextActionShort`, espera externa pausando SLA (`externalWaitOf`), `taskDeadline`,
  trilho "Fluxo N de 9", conteúdo `kbv2ContentSlot`.
- **Quadro de setor é MULTI-RESPONSÁVEL**: faixa lateral varia por tarefa (responsável primário).

**Composição:** sidebar/header/busca/subnav idênticos (Setores ativo); header com contexto real do
quadro aberto ("Quadro de Cronograma · Planejamento de publicações", ícone calendar verde do
setor); linha 3 = hub real como chips de setor (ícone tintado + label + contagem: Cronograma 13
ativo · Edição de vídeos 7 · Edição de Cards 5) + chip real "Minhas tarefas" à direita; Kanban 4
colunas reais (2/6/2/3; scroll-peek onde contador > visíveis); faixas multi-responsável
(rose/indigo/violet/cyan/teal); estados diversos (preparação, aprovação dos temas com espera
externa, handoff, legendas, designer em produção no peek, ajuste ×2, concluído final ×3).
Card selecionado em REVISÃO ("Cronograma Institucional Agosto" · GreenLife · ajuste do cliente)
abre o drawer congelado: status Revisão → título → cliente → chips ("Ajuste do cliente" +
"2 itens em correção") → RESPONSÁVEL (Boaz 48px, Editor, cyan) → AJUSTE DO CLIENTE (solicitado
há 5h · 2 conteúdos nesta fase) → PRAZO E SLA ("Em prazo — faltam 4 dias para o reenvio") →
CONTEÚDO (10 temas · 10 legendas) → LINHA DO TEMPO (marco de ajuste em ATTENTION âmbar com
carimbo real + envio + criação) → CTA. SEM dashboard/ranking/KPI. Zero fotos versionadas.

## FRAME 4 — SOCIAL MEDIAS (candidata) · `proposta-c-frame4-socialmedias.html`
**Status dos anteriores:** FRAME 3 · Designers = **LAYOUT APROVADO / GOLDEN** (junto com V10 e
Cliente). FRAME 4 aplica o DS congelado à tela Social Medias REAL — redesign VISUAL apenas.

**Auditoria read-only (renderer real 1.0.246):**
- **Superfície real**: hub "Social Medias — cada Social Media em um quadro próprio — sem misturar";
  seleção automática determinística (`f354SocialAutoPick`, espelho dos Designers) + faixa
  `f354SocialStrip` (foto + 1º nome + contagem). Dona da tarefa = `socialOf`
  (socialOwnerId → criador social → responsável social). Sub real: "Fluxo operacional · N tarefas".
- **Colunas REAIS** (`SOCIAL_COLS4`): **A Fazer** `#9BA0AB` · **Em andamento** `#F59E0B` ·
  **Revisão** `#60A5FA` · **Finalizado** `#34D399` — bucket do EIXO OPERACIONAL
  (`flowBoardCol('social')`): "a Social vê o estágio REAL; aprovação parcial do cliente NÃO vira
  Concluído". Ordenação real por prazo.
- **Estágios operacionais reais** (`OPERATIONAL_COLS`) no chip do card (recortes fiéis):
  A Fazer · Aprovação dos temas `#22D3EE` · Envio ao designer `#22D3EE` · Designer em produção
  `#A78BFA` · Legendas e posts `#5B6CFF` · Ajuste do cliente `#F59E0B` · Concluído final `#10B981`
  (+ Aguardando aprovação final `#34D399` e Designer em revisão `#60A5FA` existentes no eixo).
- **Próxima ação real** (`nextActionShort`): "Criar e enviar ao cliente" / "Aguardar feedback do
  cliente" / "Enviar ao designer" / "Aguardar entrega do designer" / "Adicionar legendas e posts" /
  "Corrigir e reenviar ao cliente" / "Aguardar aprovação final" / "Tarefa encerrada".
- **SLA interno × espera externa (regra crítica preservada)**: `externalWaitOf`
  (themes_waiting_client/captions_waiting_client) faz `resolveTaskDisplayState` retornar
  `waiting_client` NEUTRO com SLA interno PAUSADO (`inPanel:false` — zero alerta/culpa interna).
  Nos cards aguardando cliente, a eyeline mostra a espera externa (visualizado/não + tempo,
  `wfExternalInfo`) sem alarme; "Atrasada" (`taskDeadline`) só com bola interna. THEMES ≠
  FINAL/CAPTIONS (rodadas separadas; envio final só com `flowSentToClientSignal`).
- **Progresso real**: trilho dos marcos canônicos (9 principais de `taskTimeline`) → componente
  aprovado como "Fluxo N de 9". Conteúdo (`kbv2ContentSlot`): "N temas (· N legendas preenchidas)"
  / "N vídeos/roteiros" / "Legenda · Observações".

**Composição:** sidebar/header/busca/subnav idênticos (Social Medias ativo); faixa real de quadros
(Tatiana ativa · 14 — única Social Media do elenco real) + contexto "Fluxo operacional · 14 tarefas
· 1 em atraso"; Kanban 4 colunas reais (2/8/2/2; scroll-peek onde contador > visíveis); faixa de
TODOS os cards = rosa da Tatiana (responsável primário do quadro); estados visíveis: preparação
(A Fazer), aprovação dos temas com espera externa honesta, retorno do designer + legendas
(SELECIONADO), handoff "Enviar ao designer" identificável no peek, designer em produção (contador),
ajuste do cliente, atrasada interna, concluído final. Drawer congelado no eixo Social: status →
título → cliente → chips ("Legendas e posts" + "Designer entregou") → RESPONSÁVEL ATUAL (Tatiana
48px — a bola voltou à Social; nunca falsifica owner) → ENTREGA DO DESIGNER (13/08 · por Felipe) →
PRAZO E SLA ("Em prazo — faltam 5 dias para o envio final") → CONTEÚDO (12 temas · 7 legendas
preenchidas) → LINHA DO TEMPO (marco atual "Aguardando legenda / posts" sem carimbo + entregas
carimbadas) → CTA. SEM dashboard/ranking/KPI (não existem). Zero fotos versionadas.

## FRAME 3 — DESIGNERS (candidata) · `proposta-c-frame3-designers.html`
**Status dos anteriores:** FRAME 2 · Cliente = **LAYOUT APROVADO / GOLDEN VISUAL REFERENCE** (junto
com a V10). FRAME 3 aplica o mesmo DS congelado à tela Designers REAL — redesign VISUAL, nunca
funcional (sem dashboard, ranking, KPI, score, leaderboard ou barra de métricas: não existem no
produto e não foram criados).

**Auditoria read-only (renderer real 1.0.246):**
- **Superfície real**: hub "Designers — cada designer em um quadro Kanban próprio" com AUTOLOAD
  (F3.5.4-B: a tela nunca abre vazia) + faixa compacta de seleção `f354DesignerStrip` (foto +
  1º nome + contagem por designer). Tarefas entram pela atribuição (`designerOf`/`isDesignerFlow`).
- **Colunas REAIS** (`DESIGNER_COLS4`): **A Fazer** `#9BA0AB` · **Em andamento** `#F59E0B` ·
  **Revisão/Ajuste** `#60A5FA` · **Entregue** `#34D399` (nomes e cores canônicos; "Recebido" não
  existe — o estado recém-atribuído é A Fazer). Badge do card em andamento = "Designer em produção"
  (`designerStatusView`). Ordenação real por prazo (`dtMs` asc — atrasado primeiro).
- **SLA REAL** (`kbv2SlaLocal`, fonte única `resolveTaskDisplayState`, por PRAZO FINAL):
  "Em prazo" (azul) · "Prazo próximo" (laranja) · "Prazo encerrado" (vermelho) ·
  "Entregue"/"Concluído" (verde) · neutro sem chip. Nenhuma regra reescrita/inferida.
- **Prazo** (`taskDeadline`): data + "Faltam Xh/Xd" / "Hoje" / "Atrasada" / "Concluída".
- **Progresso real**: trilho de 3 etapas do designer (A Fazer → produção → entrega) → componente
  aprovado como "Etapa N de 3" (sem percentual inventado). **Próxima ação** (`designerNextShort`):
  "Iniciar a produção" / "Finalizar e entregar" / "Corrigir o ajuste e reenviar" /
  "Entregue — aguardando a Social". **Conteúdo** (`kbv2ContentSlot`): "N temas" ·
  "N vídeos/roteiros" · "Legenda · Observações" (Edição de Cards).
- **Timeline** = marcos canônicos (`taskTimeline`), honestidade H13 (atual sem carimbo).

**Composição:** sidebar/header/busca/subnav idênticos (Designers ativo); linha 3 = faixa real de
quadros (Felipe ativo · 12, Boaz · 5) + contexto real "Designer e Editor · 12 tarefas · 1 em
atraso"; Kanban 4 colunas reais (3/4/2/3, scroll-peek onde contador > visíveis); **faixa de TODOS
os cards = teal do Felipe** (responsável primário do quadro — contrato); tag = categoria/setor
(Cronograma/Vídeos/Cards); estados simulados: recém-atribuída, não iniciada, em produção, em prazo,
perto do prazo, atrasada, revisão/ajuste, entregue — todos reais. Card selecionado (Em andamento,
"Prazo próximo") abre o drawer congelado adaptado: status → título → cliente → chips → DESIGNER
RESPONSÁVEL (Felipe 48px) → PRAZO E SLA (editorial: data+hora + estado + "faltam 26h") → CONTEÚDO
(8 vídeos/roteiros) → LINHA DO TEMPO (atual sem carimbo + "Designer em produção" + "Enviado ao
designer") → CTA "Ver detalhes completos". Zero fotos versionadas (`_team-photos.css` local-only).

## FRAME 2 — CLIENTE (candidata) · `proposta-c-frame2-cliente.html`
DS congelado da V10 aplicado à tela **Cliente REAL** — sidebar/header/busca/subnav/tokens/cards/
drawer idênticos; muda apenas o conteúdo da superfície. **Auditoria read-only primeiro**, no
renderer real do Desktop 1.0.246 (branch `desktop/f356bh2-...-1.0.246`, extraído para leitura):
- **Colunas reais** (`CLIENT_COLS4`): Enviado `#5B6CFF` · Em análise `#22D3EE` · Revisão
  solicitada `#F59E0B` · Aprovado `#34D399` (mapeamento `clientCol4`: visualizado-sem-resposta
  fica em ENVIADO; produção/legendas/reenviado ficam em EM ANÁLISE; Aprovado = só conclusão real).
- **Central "Aprovações pendentes"** (`wfApprovalsBarHtml`, F3.5.6A-H2 — recolhida por padrão):
  badge = nv+vs+aj; categorias reais com cores próprias (Não visualizadas `#F2A93B`,
  Visualizadas sem resposta `#22D3EE`, Ajustes solicitados `#EF4444`, Aprovadas recentemente
  secundária); aviso ">24h"; botão "Ver aprovações →". Reproduzida como faixa premium de 64px
  no slot da 3ª linha (a tela Cliente real NÃO tem filtro por responsável — nada foi inventado).
- **Linguagem do card sem jargão** (`clientFacingStatusView`/`clientFacingNextShort`): chips
  derivados ("Aguarda análise", "Em produção", "Legendas e posts", "Versão final", "Em correção",
  "Concluído") + próxima ação real ("Aguardar a análise dos temas", "Equipe corrige e reenvia"...).
- **Visualização/espera reais** (`wfExternalInfo`): "Visualizado às HH:MM · há Nh",
  "Não visualizado · enviado há Nh", "Ajuste solicitado · há Nh" — par esquerda/direita no mesmo
  padrão do prog-top da V10. Conteúdo = contagem real (N temas · N legendas · N roteiros/vídeos).
- **Prioridades de informação do mandato**: 1 cliente (nome em destaque no topo do card — o rótulo
  "Cliente" sai do card porque o quadro inteiro é Cliente; fica no drawer) → 2 tarefa → 3 fase
  (tint+dot+label; nunca card pintado) → 4 visualizado → 5 tempo aguardando → 6 responsável
  (faixa+ring+avatar) → 7 próxima ação (linha "→ ..."). Trilho de % omitido no card (não está nas
  7 prioridades; o fluxo completo vive no drawer).
- **Drawer = anatomia V10 EXATA** adaptada ao fluxo: status da coluna → título → Cliente · X →
  chips de fase ("Temas enviados" + "Visualizado às 14:32") → RESPONSÁVEL (foto 48) → ENVIO AO
  CLIENTE (data · por autor) → VISUALIZAÇÃO E RESPOSTA (visto às + aguardando há · nenhuma decisão)
  → CONTEÚDO (bloco no shape do file-card: "Temas do cronograma · 12 temas · 8 legendas · 1ª rodada")
  → LINHA DO TEMPO com marcos canônicos reais (`taskTimeline`; honestidade H13: marco ATUAL sem
  carimbo — círculo tonal com relógio; só concluídos têm data/autor) → CTA seguro "Ver detalhes
  completos" (gradiente ID Seven).
- **Números coerentes**: 5+6+3+9 = 23 tarefas (header); Central 8 = 2 nv + 3 vs + 3 aj; urgência
  ">24h" = 2 (MovOn 26h nv + Café do Centro 26h vs — o card selecionado); scroll-peek presente
  onde contador > cards visíveis (Enviado/Em análise/Aprovado) e ausente em Revisão (3=3).
- **Fotos reais** reutilizadas read-only via `_team-photos.css` LOCAL-ONLY (gitignored) — zero
  fotos versionadas; fallback iniciais só para quem não tem foto.

## V10 — lapidação final sobre a arquitetura aprovada da V9 (candidata final)
Arquitetura **congelada** (mandato V10): mesma estrutura da V9 — sidebar escura, header, busca+subnav,
filtro por responsável, Kanban 4 colunas, drawer à direita, fotos reais, cor por RESPONSÁVEL.
V10 é lapidação de presença/refino, não redesenho. Arquivo: `proposta-c-v10-premium-frame1.html`.

**O que mudou V9 → V10 (resumo por área):**
- **Presença/hierarquia (~+10%)**: título do header 26px (Inter Tight 700), sidebar 284px, brand 18px,
  "Nova tarefa" 48px, nav-item 42px, header 92px / toolbar 72px / filtro 64px.
- **Cards (+~10% conforto interno)**: padding 22/22/18/25, título 16px/640/1.45, cliente maior
  (rótulo 12.5 + nome 13.5/600 em texto — **sem logos fictícios**), tag de categoria discreta
  (23px, microdot + tint 6%), prazo 13px, progresso 5px, avatares 32px, meta 13px.
- **Faixa do responsável mais suave**: `.card::before` 3px com `color-mix(... 62%, #fff)`.
- **Toolbar/filtro**: busca 520×48 r14, aba ativa pílula azul 44px, chips de responsável 44px r12
  com foto 30px.
- **Canvas**: board 30/32px, gap 24, col-header 15px/650 + contador 23px; **scroll-peek** (4º card
  cortado na base) coerente com os contadores (8/6/4/12 > cards visíveis).
- **DRAWER (prioridade máxima)**: 7 níveis — status → título 23px → cliente → chips 27px →
  RESPONSÁVEL (foto 48px + nome 15/620 + dot de identidade) → CONCLUÍDA EM → CONTEÚDO (arquivo
  PDF com ícone 44×46, nome 14, "PDF · 12.4 MB", botão download 36) → LINHA DO TEMPO (fotos 30px,
  evento 14/600, autor 12.5, data 12) → CTA gradiente 52px r14. Ajuste final de respiro
  (head 24/18 gap 15; body pt22 gap 20; rótulos mb12; tl pb16) para a última entrada da
  timeline fechar completa acima do rodapé.
- **Renderer determinístico**: `--virtual-time-budget=8000` no Chromium headless (elimina corrida
  com `font-display:block` das fontes embutidas).

**REGISTRO OBRIGATÓRIO (item 8 do mandato V10) — foto do Miercohévisk:**
Nesta maquete, a foto do Miercohévisk vem de um **recorte temporário e local** da captura de tela
da página Equipe fornecida pelo owner no chat (uso exclusivo de simulação; nunca versionado).
**A IMPLEMENTAÇÃO REAL NÃO PODE usar esse recorte.** No produto, o avatar dele deve vir da
**foto original cadastrada no Agenda**, resolvida pelo MESMO fluxo runtime já auditado:
`photoOf(u)` → `avatar()` (renderer), alimentado por `usersPublic` — exatamente como as demais fotos.
O recorte existe só porque o host da foto é bloqueado pelo egress deste ambiente de design.

**Higiene (mandato V10 itens 33–35, revalidada):** `_team-photos.css` (data-URIs das 5 fotos reais)
é LOCAL-ONLY e está no `.gitignore`; nenhum HTML/CSS/JPG/data-URI de foto real versionado;
zero toque em `desktop/`, produção, tema, workflows, release ou Firestore (zero writes).
Proibições mantidas: sem barra de métricas, sem Plano/workspace, sem Lista/Calendário, sem favoritos.

## V9 · esgotamento das rotas para a foto do Miercohévisk (mandato "assuma a parte técnica")
Todas as rotas legítimas do ambiente foram tentadas, na ordem do mandato:
1. **Fluxo real do app** (`photoOf`→`avatar()`): resolve apenas a URL; o download é do stack de rede do
   Chromium — que neste contêiner sai pelo MESMO gateway de política de egress. Sem helper que entregue bytes.
2. **Cache Electron/Chromium**: 6 userData de provas auditados — harness offline; 0 entradas imagekit, 0 JPEGs.
3. **Runtime autenticado**: inexistente nesta sessão (sem credenciais/app instalado); mesmo autenticado, o
   fetch da foto iria ao mesmo host bloqueado.
4. **Mesmo stack do app**: todo processo do contêiner (curl, Chromium, WebFetch) egressa pelo gateway;
   prova: CONNECT a `ik.imagekit.io` = 403 policy denial; **WebFetch** (ferramenta sancionada do ambiente)
   = `EGRESS_BLOCKED: ik.imagekit.io`. Bypass direto = burla (proibido pelo owner e pelo ambiente).
5. **Worker do produto**: só assina uploads (`/imagekit-auth`); NÃO proxeia/serve bytes de imagem.
6. **Ferramenta própria para autorizar domínio**: não existe no meu toolset — o allowlist de egress é
   configuração humana do ambiente (Claude Code on the web); o proxy só expõe status read-only.
Higiene revalidada: 0 fotos versionadas, 0 `data:image` de usuários, 0 JPG/PNG de equipe no branch.
**V9 segue NÃO renderizada** (regra: nunca com "MC"). Única ação humana inevitável: anexar a foto no chat
OU marcar `ik.imagekit.io` como domínio permitido nas configurações de rede do ambiente (claude.ai/code →
Environments → este ambiente → Network allowlist) e pedir "retomar".

## V9 — preparada; RENDER BLOQUEADO pelo gate da foto do Miercohévisk + higiene do Git
- **Higiene do Git (V9 item 3):** o commit da V8 versionava `_team-photos.css` (fotos reais em data-URI).
  Histórico do branch **reescrito** (soft-reset + re-commit sem o arquivo + push --force-with-lease):
  as fotos **não existem mais em nenhum commit**. `_team-photos.css` agora é **local-only** (.gitignore),
  gerado na hora do render a partir de `usersPublic` (read-only). O HTML referencia o slot; o Git não
  carrega fotos pessoais.
- **Gate Miercohévisk (V9 item 2):** re-auditoria da sessão: userData/caches Electron das provas antigas
  (6 diretórios) = harness offline, **zero** imagem de usuário; repo inteiro (todas as pastas) = mockups/
  ícones/banners, **zero** foto de equipe; denormalizados em `tasks` copiam a **URL** (photoOf → string),
  não bytes. Conclusão: os bytes da foto dele só existem em `ik.imagekit.io` — host **bloqueado pela
  política de egress deste ambiente**. Sem rota legítima → **V9 NÃO renderizada** (gate do owner).
  Desbloqueios possíveis: (a) anexar a foto dele no chat (uso local, nunca commitada); (b) liberar
  `ik.imagekit.io` na política de rede do ambiente (Claude Code on the web) e pedir para retomar.
- **V9 pronta** (`proposta-c-v9-premium-frame1.html`, todos os 41 itens): cards +10–15% de respiro
  (padding 20/23, gaps 16/22, board 28/30), título 15.5/1.42 dominante, **cliente sem logo fictício**
  (texto "Cliente · Nome"), tag terciária (tint 7%), **faixa dessaturada** (72% do hue do responsável),
  progresso refinado, metadata 12.5 legível, header 88 composição única, busca 500×46, subnav com ativa
  em pílula e inativas texto, filtro 42px raio 12 com foto 28, sidebar 284 (labels .14em, item 41px,
  ativo tint+accent+hairline), **colunas com scroll-peek** (4º card corta na base → contadores coerentes),
  **drawer editorial 408** (status→título 22→"Cliente · Bold Brands"→chips; seções empilhadas sem grid de
  formulário; responsável 44 + dot de identidade; arquivo 40px + download; timeline com foto 28 do ator,
  evento→ator→data), CTA 50. Slot `.p-mie` pronto — o render acontece assim que a foto materializar.

## V8 — FOTOS REAIS (fluxo do próprio produto) + anti-miniaturização
Arquivo: `proposta-c-v8-premium-frame1.html` + `_team-photos.css`. O owner corrigiu a rota: as fotos JÁ
estão no Agenda; reutilizar read-only pelo MESMO fluxo do produto. Auditoria do runtime real:
`state.users = db.collection('usersPublic').onSnapshot(...)` (renderer linha 3047) — a linhagem viva lê
o Firestore SEM Firebase Auth (F4.2F revertida na 1.0.186), ou seja, `usersPublic` é legível pelo fluxo
público do app (API key pública do próprio renderer). Reproduzi esse fluxo com uma leitura REST read-only:
- **Equipe real (5 ativos):** Arydyjany Carlôto (Ceo) · Miercohévisk N. F. N. Carlôto (CEO) ·
  Felipe Teodozio (Designer e Editor) · Tatiana Gomes (Social media) · Boaz Macêdo (Editor).
- **4 fotos materializadas**: o campo `photo` desses docs já é `data:` URI (≈240×240 JPEG) — exatamente o
  que o app exibe. Embutidas em `_team-photos.css` (`.av.p-ary/.p-fel/.p-tat/.p-boa`).
- **Miercohévisk**: foto EXISTE (URL `ik.imagekit.io`), mas o host é bloqueado pela política de egress
  deste ambiente → **único** com fallback monograma (permitido pelo item 45 do briefing). `users/<id>`
  direto = PERMISSION_DENIED (Rules protegem a coleção privada — correto).
- **Elenco do frame trocado para a equipe REAL** (cards, filtro, drawer, timeline) com cores de identidade:
  Arydyjany=índigo, Miercohévisk=violeta, Felipe=teal, Tatiana=rosa, Boaz=ciano.
- **Anti-miniaturização:** sidebar 280px, header 84px, toolbar 68, filtro 60, drawer 400px; título do card
  15px/1.4, cliente 13px, tag 22px, avatares 30 (card) / 26 (filtro/timeline) / 44 (header/sidebar) / 40
  (drawer); busca 480×46; abas 42px; gaps e paddings ampliados (board 26/28, gap 20, card 18/21).
- Nenhum write em produção. Sem métricas inferiores. Sem Plano/workspace. 1920×1080 exatos.
- Bug corrigido no primeiro render: regra `[class*=" p-"]{background-image:none}` anulava as fotos por
  vir depois na cascata com mesma especificidade — removida.

## V8 (histórico) — STOP pré-render (item 46 do mandato): fotos reais não materializáveis neste ambiente
Auditoria READ-ONLY do produto real (renderer 1.0.246, `wt-f356bh2/desktop/src/renderer/index.html`):
- **Como o produto obtém a foto:** `photoOf(u)` (linha 2846) lê, na ordem, os campos
  `photo, photoUrl, avatar, avatarUrl, image, imageUrl, picture, foto` do doc do usuário (Firestore `users`,
  projeto `agenda-id-seven`). `resolveUserIdentity` (4406–4417) devolve `{avatarUrl, initials, hasRealAvatar}`.
- **Como renderiza:** `avatar()` (linha 2860) — se o valor casa `^https?:` **ou** `^data:` → `background-image`
  com a foto; senão → **iniciais coloridas** (fallback). Ou seja: o contrato "foto se existir, monograma só
  sem foto" é o do próprio produto, e ele **aceita `data:` URI** (caminho limpo p/ mockup com foto embutida).
- **Onde moram os VALORES das fotos:** por usuário, nos docs do Firestore de produção — **não no repositório**.
  Repo (desktop/): 8 imagens versionadas = ícones do app, prints de referência e banners OG; **0 fotos de usuário**.
  Únicos `data:image` no renderer = logo + Card Premium WhatsApp; **0 fotos de usuário**. Sem cache local aqui
  (ambiente de protótipo não tem app instalado/userData).
- **Tentativas de materialização a partir deste ambiente:**
  · Firestore (`users`): **sem credencial/sessão** neste ambiente (env vazio) — e não extraio/contorno auth.
  · `firebasestorage.googleapis.com`: **alcançável** (HTTP 404 na raiz), mas inútil sem as URLs/tokens por
    usuário que estão no Firestore.
  · `lh3.googleusercontent.com` (fotos Google): **bloqueado** pela política de egress (000).
  · `ik.imagekit.io` / `upload.imagekit.io` (host de imagens que o próprio app usa): **bloqueados** (000).
  · Hosts genéricos de fotos: **403 policy denial** (testado nesta sessão).
- **Decisão (conforme item 46):** NÃO renderizei a V8 com iniciais. STOP e pedido ao owner das fotos dos
  usuários do frame (ou das URLs firebasestorage), para embutir como `data:` URI com crop/ring premium.
- Melhorias visuais da V8 (anti-miniaturização: cards/tipografia/avatares/header/sidebar/drawer maiores,
  proporção do Kanban) ficam prontas para aplicar assim que as fotos chegarem.

## V7 — refinamento premium (V6 reprovada; exigido salto + fotos reais)
Arquivo: `proposta-c-v7-premium-frame1.html`. Passe de acabamento + requisitos duros do owner:
- **AVATAR photo-ready, sem ilustração/cartoon/DiceBear/sintético.** O componente `.av` mostra a
  **foto real do usuário do Agenda** quando existir (classe `.av.photo` + `background-image`); aqui é
  exibido o **fallback premium em monograma** (iniciais + anel de identidade + fundo tingido), pois o
  ambiente **bloqueia hosts de foto** e não fabrico fotos reais. Mesmo crop/ring/tamanho nos dois estados.
  → Trocar por fotos reais = preencher o `background-image` de cada `.av` (owner envia as fotos).
- **Contrato de cor** explícito: coluna = STATUS; **barra do card = RESPONSÁVEL** (`own-*`); **ring do
  avatar = RESPONSÁVEL**; **chip do filtro = RESPONSÁVEL**; **tag = CATEGORIA**. Sem misturar.
- **Fidelidade:** removidos **"Plano Business"** e **seletor de workspace "ID Seven · Agência"** (auditoria
  read-only: `Plano Business`=0, `Espaço da Agência`=0 no renderer real — não existem). Perfil da sidebar
  agora **integrado** (sem caixa), só avatar+nome+cargo+status.
- **Sistema de espaçamento 4/8** e **raios 8/12/16** aplicados de forma consistente; grid alinhado.
- **Card**: cliente primeiro (logo+nome), categoria como **tag discreta** à direita, prazo/progresso,
  rodapé com pilha de avatares + metadados; barra lateral 3px integrada ao raio (overflow); seleção sutil
  (tint + inset ring, sem outline). Compacto e respirado.
- **Header/abas**: título + perfil no header, SLA, sino; **abas como subnav** (ativa em pílula, inativas
  em texto — sem "botões soltos"); busca premium com ⌘K.
- **Drawer editorial** (não formulário): título forte → chips → cliente → grid Responsável/Concluída →
  arquivo PDF com download → **linha do tempo com avatar do ator + nome + timestamp**.
- **Sem barra de métricas inferior.** 1920×1080 exatos. Inter/Inter Tight.
- *Pinterest:* sem navegador do Pinterest neste ambiente; apliquei os princípios de acabamento dos
  benchmarks (Linear/Stripe/Notion/Vercel/Attio) — declarado com honestidade, sem forjar "pesquisa".

## V6 — refinamento premium (versão atual reprovada; salto de qualidade exigido)
Arquivo: `proposta-c-v6-premium-frame1.html`. Nova proposta seguindo a crítica do owner, com 3 reversões
explícitas em relação à V5 e um passe geral de sofisticação:
- **Avatares = pessoas** (não mais iniciais). Ilustrações premium por pessoa, embutidas em `_avatars.css`
  (DiceBear "micah", sorriso, sintéticas — **não são fotos de pessoas reais**). Cada pessoa tem um look
  consistente + **anel de identidade colorido**; avatar virou elemento importante do card (28px, empilhado),
  do header (40px), da sidebar, do filtro e do drawer. *Por que ilustração e não foto:* o proxy do ambiente
  bloqueia hosts de foto (403) e eu não fabrico fotos de pessoas reais; os slots são **substituíveis por
  fotos reais** trocando o data-URI de cada `.av.u-*`.
- **Barra lateral do card = COR DO RESPONSÁVEL** (classe `own-*` = 1º avatar da pilha). Categoria virou
  **tag discreta** (contorno + dot). Status continua na **coluna** (dot + nome + cor da barra de progresso).
- **Sem barra de métricas inferior** — grid principal `76/64/60/1fr` (4 linhas). O Kanban ocupa o espaço.
- Passe premium: sidebar 260px, drawer 380px, paddings/gaps maiores (board 22/24/16, gap 18, card 15/18),
  tipografia com mais respiro (título 14px 1.34, InterTight nos H), sombras em camadas mais suaves,
  filete 1px, chips e cliente-logo por card, cabeçalho/busca/abas/drawer recompostos.
- 1920×1080 exatos, sem faixa cinza (rodapé = UI real). Base tipográfica Inter/Inter Tight.

## V5 · ajuste — barra de acento lateral no card (feedback do owner)
O owner apontou que, na referência, cada card tem **cor na lateral** e a minha versão não tinha.
Adicionada uma **barra vertical de 4px na borda esquerda** de cada card, colorida pela **categoria**
(Marketing=azul, Vídeo=violeta, Tráfego=âmbar, Social=rosa, CRM=teal, Design=índigo, Dados=azul-céu,
Relatório=ardósia) — mesma paleta dos badges. Implementado em CSS (`.card::before` + seletor `:has(.b-*)`),
`overflow:hidden` para respeitar o raio do card e `padding-left` ajustado; **zero alteração** no corpo
HTML de cada card. Frame revalidado em 3840×2160 (=1920×1080 @DSF2), sem defeito de faixa.

## V5 — reprodução fiel da referência do owner ("100% idêntico")
Arquivo: `proposta-c-v5-fiel-referencia-frame1.html`. O owner definiu a referência anexada como o alvo
exato do layout. Reproduzido: sidebar navy (ID Seven + Nova tarefa no topo + nav Workspace/Sistema +
cartão do usuário + "ID Seven · Agência" + Plano Business 80%); header (voltar + avatar + "Meu quadro/CEO"
+ MONITOR SLA AO VIVO + sino + avatar); busca ⌘K + abas em pílula (Meu quadro/Cliente/Designers/Social
Mídias/Setores); linha "Filtrar por responsável" (Ardyjany/Sunset/MovOn/TechOne/GreenLife/Todos); 4 colunas
(A Fazer 8 / Em andamento 6 / Revisão 4 / Finalizado 12) com badges de categoria, cliente, prazo, progresso%,
pilha de avatares + contagens, marcador/checks; drawer (Finalizado, chips, estrela+título, cliente, responsável,
conteúdo PDF, linha do tempo, CTA); barra de métricas inferior (32/78%/5/98% + deltas + legenda). 1920×1080.
**Única substituição:** avatares = iniciais coloridas (mesmo sistema de cor por responsável), pois não reproduzo
fotos de pessoas reais. Base tipográfica Inter/Inter Tight.

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
