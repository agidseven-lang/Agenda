# Proposta C — Refinamento Profissional · FRAME 1 ("Meu quadro" 1920×1080)

**Status:** direção C aprovada para refinamento; design final NÃO aprovado; implementação NÃO autorizada.
Somente pesquisa + design + simulação. Nada toca `desktop/`, o app, o tema, workflows ou release.
Fonte da verdade = `proposta-c-refinada-v2-frame1.html` (self-contained; fontes embutidas em `_fonts.css`).

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
