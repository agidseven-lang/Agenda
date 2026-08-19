# LIGHT UI — I3A · F1 MEU QUADRO REPORT

**Fase:** I3A — primeira surface Golden (F1 · Meu Quadro) · **Status:** ENTREGUE — aguarda
owner. **Branch:** `impl/light-ui-f1-meu-quadro-1.0.246` (base EXATA `0d107dea` = Core Shell
GO/congelado; Gate 0 ✓). **Commit:** `7eb93bb1` · version **1.0.246 intacta** · zero
build/release · nenhum PR · Core Shell NÃO alterado (regressão provada §6).

## 1 · F1 REAL — REAUDIT COMPLETO (Regra P1)
| Peça | Fonte real auditada |
|---|---|
| Render | `renderPersonBoard()` (~6428; isMe ⇒ "Meu quadro"): head [back · avatar(p,44) · título+cargo] + `boardToolbar()` + `kbv2BoardHtml(COLS, kbv2Card)` |
| Colunas | `SOCIAL_COLS4` reais: A Fazer #9BA0AB · Em andamento #F59E0B · Revisão #60A5FA · Finalizado #34D399 (designer-view usa DESIGNER_COLS4 — lógica intacta) |
| Tabs | `taskChips()` reais: Meu quadro · Cliente · Designers · Social Medias (gate `canSeeAll`) · Setores — handlers `data-myboard/flowclient/flowdesigners/flowsocials/board=hub` |
| Busca | `#bSearch` + `afterBoard()` (oninput re-render preservando caret) + `⌘K` kbd |
| Card | `kbv2Card` = KanbanTaskCardUnified (11 slots: status/SLA/prazo · perfil · origem · cliente+título · chips · conteúdo · checklist · trilho · etapa/próxima · data · ações) |
| Interação | delegação global `[data-tab]`/`[data-detail]`/`[data-move]`/`[data-cardmenu]`/`[data-del]`; **Detalhes → `openDetails()` → MODAL Central de Detalhes** (`.modal-back[data-detmodal] > .sheet.det-sheet`, role=dialog) |
| Estados | `taskDeadline` (Hoje/Atrasada/Faltam/Concluída) · `kbv2SlaLocal` (severidades; pausado=neutro) · `isTaskCompleted` (operationalStatus etc.) ⇒ concluída SEM "Mover" (guarda F3.5.6A-H17) |
| Drag | inexistente no produto (mover = botão "Mover" + seletor) — nada inventado |

**Decisões auditadas (Regra P0):**
- **Drawer:** o F1 real NÃO tem drawer lateral; o painel de detalhe REAL é a **Central de
  Detalhes** (modal det-sheet) → é ela o "drawer do F1" e foi re-skinada (o drawer 416px do
  protótipo era projeção; a superfície Detalhes F6 página segue para a I4).
- **Filtro "Filtrar por responsável":** NÃO existe como função no Meu quadro real (que já é o
  quadro da pessoa). P0 proíbe adicionar função do mockup → NÃO implementado; análogos reais
  (hub Quadros por responsável/admin; strips de Designers) pertencem às suas fases. Owner pode
  encomendar o filtro como FUNÇÃO nova em mandato próprio.

## 2 · GOLDEN SOURCE
Frame 1 · V10 (`proposta-c-v10-premium-frame1.html`, congelado) + contracts pós-errata.
V5–V9 não usados. Tokens SEMPRE errata (E2 tx sobre surface; E7 accent×ink; E8 sólidos).

## 3 · IMPLEMENTAÇÃO (CSS na seção F1 do bloco `light-ui-foundation` + 2 literais de template)
- **Header da surface** (na banda do shell — contrato I2.1): back 42 r12 hairline, avatar
  contextual REAL 46 (runtime `avatar()`/fallback iniciais; nunca imagem versionada), título
  26/700 −.024em tx-1, cargo 13.5 tx-3; board-mode alinhado ao eixo 34px.
- **Toolbar:** moldura surface+hairline; **busca clara** (sunk + hairline interna — o dark
  pinta `rgba(4,7,16,.8) !important` na linha ~2222; vencido com token + !important espelhado);
  placeholder/caret/handler intactos; kbd ⌘K re-inked; **aba ativa = `--lui-info-ink` #2563EB
  (E8)**; hover borda brand; focus-visible do board com token de focus (C1/C8).
- **Kanban Golden:** board-surface transparente (sem moldura escura); colunas limpas (dot 9 +
  título 15/650 + count pill hairline); "Adicionar tarefa" real re-skinado (dashed
  control-border; hover brand-ink); empty-state claro. **R8:** `min-width:260px`/coluna +
  `overflow-x:auto` SÓ na `.kbv2-board` (página nunca rola horizontal).
- **Card:** surface r16 `--lui-sh-card`; **faixa lateral esquerda 3px = RESPONSÁVEL PRIMÁRIO**
  (`--kresp` = `userColor(asg.id)` real; mix 62% branco = receita Golden; multi-participante
  mantém primário na faixa e demais nos avatares — nunca multicolor); pills status/prazo e
  chip do setor com **ink derivado por `color-mix` das cores REAIS** (`--ktone/--kdue/--ksec`;
  E7: texto <18.66px nunca cru); chip Prioridade → `var(--kbv2-pri)` = danger-ink (fallback
  dark byte-idêntico); SLA por severidade em inks canônicos; título 16/640 lh 1.45 **clamp 2
  linhas** (real, preservado); tier cliente em brand-ink; trilho/etapa/próxima/origem/
  checklist/data re-inked; presence ring = surface. **Footer na hierarquia de CTA:** Detalhes
  = PRIMARY (grad E4 + sombra), Mover = SECONDARY (surface+hairline), ⋯ = CONTEXTUAL, menu
  claro com Excluir em danger-ink.
- **Central de Detalhes:** herda a foundation via vars reais (`--surface/--ink/--line…`);
  correções pontuais dos hardcoded dark (hover do X/summary, ícones, mensagens, teamfix) +
  backdrop C2 `rgba(15,19,32,.46)`. Traps/menus/ações intactos.
- **Mapeamentos declarados:** `--accent → --lui-brand`, `--grad → --lui-grad` (pendência
  aberta na I1 para "I2+"; primeira fase que consome), `--kbv2-pri` (E8).
- **Template (2 literais, zero lógica):** vars aditivas no style do card + fallback do chip
  Prioridade — **inertes no dark (provado 0px com board montado)**.

## 4 · CARD STATES (fixture; funções reais decidem)
normal (Faltam Xd) · **Hoje** (âmbar-ink) · **Atrasada** (danger-ink) · cronograma pré-envio
= **neutro** (sem alarme; SLA pausado é regra real `kbv2SlaLocal`) · **Concluída** (verde;
footer SEM "Mover" — guarda real). "Selected" não existe no card real (N/A honesto; hover é
o feedback). Estado "aguardando cliente" com carimbos completos exige o fluxo persistido de
envio real — coberto pela regra neutra; demonstração plena fica para I3B (fluxo Cliente).

## 5 · VALIDAÇÃO FUNCIONAL (smoke com `render()` REAL; Firebase/desktopAPI stubados — ZERO escrita)
| Ação | Resultado |
|---|---|
| Abrir Meu quadro (`render()` real) | title "Meu quadro"; board-mode; 4 colunas reais 2/2/0/1 |
| Buscar "Reels" | filtra p/ 1 card (caret preservado) |
| Aba Cliente → voltar Meu quadro | `state.flowView='client'` ✓ → retorno ✓ |
| Detalhes (card real) | Central de Detalhes ABRE (`data-detmodal`) e FECHA ✓ |
| Mover | seletor real abre ✓ (nenhuma gravação) |
| Menu ⋯ | `.kbv2-menu.open` ✓ |
| Scroll kanban | scroll-x interno ✓ |

## 6 · REGRESSÕES
- **Página (Parte 17):** `scrollWidth == viewport` em 1920/1366/**1093@1.25** (scroll-x só
  dentro do kanban: sw 1112 > cw 727 no win125 — colunas legíveis).
- **Shell (Parte 18):** crops I2.2×I3A sob light-ui — **cluster Monitor+sino 0px · banda/
  hairline 0px · sidebar**: únicos deltas = badge "9+" (forçada pelo harness da I2.2 vs render
  real sem notifs) e sb-footer (conteúdo dinâmico real) = **zero delta não justificado**.
- **Legado (Parte 19):** SEM a classe, I2.2×I3A @1920, animações congeladas: **0px** em
  dark/light/hc no boot screen **e no board montado com cards** (relógio congelado —
  prova de que as vars de template são inertes).
- **HC:** smoke ok (finalização HC = I11). **A11y (Parte 15):** focus-visible token no board;
  nenhuma dívida nova (CTA azul do det-sheet é padrão herdado idêntico ao dark; fases I5/I9).

## 7 · GOLDEN COMPARISON MATRIX (Parte 23)
| Elemento | Golden V10 | Implementação I3A | Status |
|---|---|---|---|
| Header surface | back+av-46+título 26 | reais na banda (back 42/av 46/26/700+cargo) | **MATCH** |
| Search | 520px sunk+⌘K | busca real re-skinada (sunk+hairline+⌘K) | **MATCH** |
| Tabs | tabs à direita; ativa azul | abas reais; ativa **info-ink E8** | **MATCH (errata vence hex)** |
| Responsible filter | fr row com pessoas | função inexistente no F1 real (P0) | **FUNCTIONALLY ADAPTED** |
| Columns | 4 col limpas dot+count | 4 col reais limpas dot+count pill | **MATCH** |
| Card | surface r16 sh-1 faixa esq. | idem com TODOS os slots reais | **MATCH** |
| Primary rail | faixa = responsável | `--kresp` userColor real, mix 62% | **MATCH** |
| Avatars | av por pessoa | runtime real (foto/iniciais+cor) | **MATCH** |
| Deadline/SLA | prazo texto+ícone | pills reais c/ inks derivados (E7) | **FUNCTIONALLY ADAPTED (real tem + info)** |
| Progress | barra 5px | trilho de dots REAL re-inked | **FUNCTIONALLY ADAPTED (estrutura real)** |
| Drawer | painel 416 lateral | Central de Detalhes real (modal) re-skinada | **FUNCTIONALLY ADAPTED (real ≠ lateral)** |
| Timeline | tl rail no drawer | Detalhes do fluxo/datas reais na Central | **FUNCTIONALLY ADAPTED** |
| File | card de arquivo | sem arquivo no F1 real (componente = fases de detalhe) | **N/A no F1** |
| CTA | grad no primário | Detalhes grad E4; Mover secondary; ⋯ contextual | **MATCH** |
| Spacing | 30/32-34 · gaps 18-24 | eixo 34; gaps 18/24 | **MATCH** |
| Typography | 26/16/15/13.5/11 | idem (tx-* errata) | **MATCH** |
| Responsive | — (R8) | min 260/col + scroll-x interno; 3 perfis | **MATCH (R8)** |

## 8 · DIFF · SELECTORS · ROLLBACK
1 arquivo · **+121/−2** · 3 hunks (CSS 114; template style-var; template chip) · greps
firestore/firebase/localStorage/addEventListener/workflow/auth no diff = 0 · zero `function`
novo. **Seletores novos** atingem apenas: board compartilhado (`d-board-head/tbar/tchip/
bsearch/kbv2-*`), Central de Detalhes (`det-*` pontuais) e mapeamentos de vars — **nenhum**
seletor de Agenda/Notificações/Exec/Reports/Wizard/Login/F13. **Rollback:** remover a seção
F1 do bloco + reverter os 2 literais (commit único).

## 9 · GATE
Screenshots I3A-F1-{1920,1366,win125,drawer-1920} entregues no chat (não versionados).
**Recomendação: GO.** Próxima fase sugerida: **I3B — F2 · Cliente** (fluxo/aprovações) ou
ordem que o owner preferir. **Gate de saída: GO do owner.**
