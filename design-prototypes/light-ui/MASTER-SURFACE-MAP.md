> ## ★ ESTADO VIGENTE (R10 — consolidação final; substitui banners anteriores)
> **R1–R9.1 = ✔ GO do owner.** FRAMES A 1–13 = GOLDEN/CONGELADOS · **C1–C8 = FOUNDATIONS
> OFICIAIS** (C1 GOLDEN COMPLETA no escopo real `3c06c26` · C2 GOLDEN DOCUMENTAL `f9fe31a` ·
> C7 `2516426` · C3–C6 `7aba3fa`+R5.1 `5959ae0` · C8 `b2f6833`) · **B ×6 = SPECS APLICADAS
> APROVADAS** (R7 `4b72d08`) · **RESPONSIVIDADE VALIDADA: 1920×1080 · 1366×768 · Windows 125%**
> (R8 `1b7210c` — somente esse escopo; 200%/outras resoluções NÃO declarados) · **ACESSIBILIDADE
> AUDITADA (R9 `d927c01`) + TOKEN ERRATA CANÔNICA (R9.1 `363d221`)** — implementação futura segue
> contracts + errata (NUNCA extrair cores dos screenshots históricos). Contagem: **GOLDEN 13 ·
> A-futura gated 3 · B 6 · C transversais 7 · Trilha separada 1 = 30.** Dívidas: design =
> resolvidas (errata); implementação/funcionais = registers (a11y contract §28/§29 + manifest).
> ★ **DESIGN STATUS = COMPLETE / FROZEN** — declarado pelo owner no R11 (19/08/2026; Gates 1–11
> PASS). **IMPLEMENTAÇÃO LIGHT = NÃO INICIADA / NÃO AUTORIZADA** (novo mandato futuro).
> Declaração e freeze statement: `DESIGN-FREEZE-MANIFEST.md` (§16).

> ## ★ CHECKPOINT GLOBAL DO DESIGN (decisão do owner — HISTÓRICO R1; estado da época)
> **FRAMES A PRIORITÁRIOS 1–13 = GOLDEN / CONGELADOS.** Commits finais:
> F1 V10 `e7107e3` · F2 `45721bc` · F3 `b5842bc` · F4 `66d9a6a` · F5 `c0c83f4` · F6 `9644d94` ·
> F7 (7A `ea485c2` · 7B `c0cb413` · 7B V2 `5d2b10d` · 7C `7361f92` · 7D `e18d9f7` · 7D V2 `755eee6` ·
> checkpoint `f5d1909`) · F8 `96fd7d3` · F9 `8173940` · F10 `9de9a6b` · F11 `efb264a` ·
> F12 `6e52905` · F13 `32103bd`. Higiene auditada: 31 commits, todos exclusivamente em
> `design-prototypes/light-ui/`; zero produção; zero binário versionado; `_avatars.css` =
> ilustrações sintéticas licenciadas (DiceBear micah CC BY 4.0, sem fotos reais);
> `_team-photos.css` local-only (gitignored); zero segredo/credencial.
> **Isto NÃO é Design Completo**: C1 = GOLDEN PARCIAL; C2–C8 = nomeadas abaixo (§F) porém sem
> contrato dedicado; superfícies B = specs pendentes; responsividade validada SOMENTE em
> 1920×1080; A-futuras (F14a–c) gated. Sequência de fechamento: `DESIGN-CLOSURE-ROADMAP.md`.
> **Implementação Light UI = NÃO AUTORIZADA** (regra da seção 4 permanece).
> A contagem/estado abaixo neste banner substitui as células desatualizadas das matrizes
> históricas: **GOLDEN 13 · A-futura gated 3 · B 6 · C 7 · Trilha separada 1 = 30.**

> **ATUALIZAÇÃO (checkpoint formal, histórico):** FRAME 7 — Nova tarefa (wizard 4 passos Setor→Dados→Briefing→Revisão)
> = **GOLDEN / CONGELADO** (7A `ea485c2` · 7B V2 `5d2b10d` · 7C `7361f92` · 7D V2 `755eee6`). A classe A
> "Nova tarefa" passa de pendente a ENTREGUE (4 frames). Foundation **C1 = GOLDEN PARCIAL** — ver
> `C1-FORMS-CONTROLS-CONTRACT.md`. Golden agora = 6 (F1–F6) + Frame 7 (4 sub-frames).

# AGENDA ID SEVEN — LIGHT UI · MASTER SURFACE MAP

**Fase:** auditoria read-only + inventário + classificação + planejamento visual.
**Base funcional auditada:** Desktop **1.0.246** (renderer real `desktop/src/renderer/index.html`,
13.034 linhas, branch `desktop/f356bh2-workflow-notifications-premium-1.0.246`) + `desktop/src/main/`
+ janelas auxiliares (`bgnotify.html`, `slareminder.html`) + Worker (portal do cliente).
**Zero alteração de produção. Zero mockup gerado nesta fase. Golden Frames 1–5 congelados.**

Golden congelados (fonte visual da verdade) — ATUALIZADO no checkpoint global:
F1 Meu quadro V10 · F2 Cliente · F3 Designers · F4 Social Medias · F5 Setores · F6 Detalhes ·
F7 Nova tarefa (7A/7B V2/7C/7D V2) · F8 Agenda · F9 Central de Notificações · F10 Executivo ·
F11 Relatórios · F12 Login (standalone) · F13 Modal Legendas e artes.

---

## A. INVENTÁRIO COMPLETO (com prova no código real)

### Navegação principal (provada)
`const TABS` (linha 3323): **Minhas Prioridades** (`prioridades`, gated `priIsEnabled` —
preferência em Configurações→Produtividade, não cargo) · **Hoje** · **Agenda** · **Tarefas** ·
**Equipe** · **Perfil** · **Executivo** (`exec`) · **Relatórios** · **Notificações** — mais
**Configurações** (`state.tab==='config'`, item Sistema) e **Login** (pré-auth, `renderLogin`).
Dispatcher real: `render()` (5088–5150). A sidebar dos Golden bate 1:1 com a navegação real.

### Superfícies por área (função real · linha)
| # | Superfície | Prova real | Conteúdo auditado |
|---|---|---|---|
| 1 | Login / autenticação | `renderLogin` 3151; `loginMode`; "Esqueci" 3164; auth splash (F3.5.4V-H1) | login, recuperação, splash de boot, estados de erro |
| 2 | Team session (renovação) | F3.5.6A-H9/H10 (recuperação contextual + retomada) | banner/estado dentro do fluxo de confirmação; não é tela própria |
| 3 | Minhas Prioridades | `renderPrioridades` 5287 (F3.5.4R) | resumo (críticos/atenção/ajuda/bloqueio), filtros, minimizar, ocorrências, estado desativado, offline |
| 4 | Hoje | `renderHoje` 5821 | saudação, stat-tiles clicáveis (Hoje/Tarefas/…), 4 urgentes por prazo, 5 próximos eventos |
| 5 | Agenda | `renderAgenda` 6084 | **calendário MENSAL real** (cursor prev/next/Hoje, grade F3.4.6), filtro por tipo (`TYPES`: Gravação/Fotografia/Reunião/Edição/Outro), busca, "Mostrar cancelados", sheet de evento (criar/editar/detalhe/excluir) |
| 6 | Tarefas · Hub | `renderHub` 6135, `renderRoleBoards` 6175, `renderPersonBoard` 6190 | entrada da aba; quadros por pessoa (Meu quadro = personBoard do próprio) |
| 7 | Tarefas · Meu quadro | `renderPersonBoard` | **GOLDEN F1** |
| 8 | Tarefas · Cliente | `renderClientFlowBoard` 6364 + `wfApprovalsBarHtml`/drawer 7740+ | **GOLDEN F2** (inclui Central "Aprovações pendentes" + drawer real de aprovações) |
| 9 | Tarefas · Designers | `renderDesignersHub` 6376 / `renderDesignerBoard` 6393 | **GOLDEN F3** |
| 10 | Tarefas · Social Medias | `renderSocialsHub` 7055 / `renderSocialBoard` 7074 | **GOLDEN F4** |
| 11 | Tarefas · Setores | `renderBoard` 7093 (+hub de setores) | **GOLDEN F5** (busca + "Minhas tarefas" reais) |
| 12 | Nova tarefa / Editar | `renderForm` 11314 | wizard REAL 4 passos: **Setor → Dados → Briefing → Revisão**; stepper; lote Edição de Cards ("Criar N tarefas"); quantidade personalizada (F3.5.5C/D); Início/Término (F3.5.2A); Designer+prazo (77A-R2); validações; edição |
| 13 | Detalhes completos | `renderClientView` 9913 (rota `state.clientView`) | HERO status, meta grid, resumo editorial por conteúdo, caixa OPERAÇÃO (próxima ação), marcos canônicos, aprovações, confirmar envio (+diagnóstico durável H8), copiar tema/legenda (W-H1), observações internas (F3.5.5A-H1), fallback "não encontrado" |
| 14 | Modal Legendas e artes | `renderProductionModal` 9221 | RTE de legenda por conteúdo + upload artes Feed 1080×1440 / Story 1080×1920 + reenvio |
| 15 | Equipe | `renderEquipe` 10260 | grid `d-team` de cards: foto 42, nome, (você), cargo, admin, pill Ativo/Pendente — read-only |
| 16 | Perfil | `renderPerfil` 10282 | pcard (foto 92, nome, cargo, pill Admin/Membro), linhas Conta/Segurança/Sobre, Sair |
| 17 | Executivo | `renderExecPanel` 5523 | REAL: "SLA & Produtividade · tempo real · read-only"; períodos Hoje/7d/30d/Tudo; filtros Designer/Cliente/Tipo/Status SLA; agregados `slaExecAggregate`; tabelas |
| 18 | Relatórios | `renderReports` 5600 | filtros + Conclusão + períodos + **exportação (download)** + tabelas (`<table>` presente) |
| 19 | Central de Notificações | `renderNotifCentral` 5734 | badge não lidas, Marcar todas, Limpar histórico, busca, filtros Tipo (Atribuição/Fluxo/SLA/Sistema) e Severidade (Crítico/Atenção/Sucesso/Info) + designer/cliente, lista, vazio |
| 20 | Configurações | `renderConfig` 10334 | página única com SEÇÕES reais: Gerenciamento de Conta (Conta, Alterar e-mail) · Privacidade e Segurança · Preferências de Notificação (Testar notificação; Diagnóstico) · Produtividade (toggle Assistente) · Bandeja (Recriar ícone) · **Inicialização com o Windows** (toggle F3.5.4N) · **Acompanhamento de execução** (Check-ins Designer F3.5.4Q) · Acessibilidade e Aparência · Desempenho e Dados · Idioma e Região · Administração · **Atualizações** · Sessão · Sobre; placeholders "Em breve" |
| 21 | Atualizador | Config "Atualizações" + `updMaybeToast` 12970 (electron-updater F3.4.1) | verificar/disponível/baixando/instalar/erro/atualizado — linhas de config + toast |
| 22 | Toasts internos | `notifShowToast` 4690 (toast premium interno), `flashToast` 10049, `updMaybeToast` | feedback in-app; SEPARADO das notificações externas |
| 23 | Notificação externa premium | `bgnotify.html` + `bgNotify.ts`/`notificationGrouping.ts` | janela Electron TOPMOST (F3.5.5E-H2/H3/H4) — **contrato funcional congelado** |
| 24 | Lembrete central SLA | `slareminder.html` + `slaReminder*.ts` | modal central amarelo/vermelho + decisões do responsável (F3.5.4L/P) — **congelado** |
| 25 | Check-in de execução | fluxo F3.5.4Q (janela de check-in idle) | decisões de check-in — **congelado** |
| 26 | Modais/diálogos (conjunto) | **inventário INTEGRAL (R3): 20 modais/sheets** — ver `C2-MODALS-SHEETS-CONTRACT.md` §3 (a lista parcial anterior de linhas foi superada) | 5 famílias reais + 2 containers próprios (ts-auth/slaedit); del-sheet, evento (form+detail), designer/prazo, mover, responsável, produção (F13), envio ao cliente, credenciais, shrink, Conta/Segurança/Sobre |
| 27 | Menus contextuais | `closeCardMenus`, dropdowns `exec-fl`, `editContextMenu.ts` (menu NATIVO Electron de edição/colagem) | menus de card, selects/filtros, popovers; o menu nativo não é CSS |
| 28 | Empty states | `emptyState(ic,t,s)` 6080 (padrão único) | coluna vazia, sem notificações, sem resultados, cronograma não encontrado |
| 29 | Loading | auth splash (V-H1), "Carregando…" (Config), prewarm | sem skeleton sistemático hoje |
| 30 | Client Portal (público) | Worker `cloudflare-worker.js` (renderClientHtml, aprovação temas/final, Aprovar tudo, viewed, ajuste, token inválido) | **fora do renderer Desktop** |

RBAC visual (passo 26): diferenças reais são pontuais — Prioridades por preferência; setor
"Edição de Cards" no wizard só Social/Admin; pill admin; seção Administração; `visibleTasks`
filtra DADOS por papel (não muda composição). Nenhum frame extra por cargo.

---

## B. MATRIZ MESTRE A/B/C/D
> **Nota do checkpoint global:** esta matriz é o plano HISTÓRICO pré-F6. As linhas classe **A**
> (Detalhes…Modal) foram TODAS entregues e aprovadas — estado vigente na "Matriz fechada" (§1
> do Checkpoint de Consistência, atualizada) e no banner do topo. Mantida para rastreabilidade.

Classes: **A** mockup próprio obrigatório · **B** reutiliza Golden · **C** component spec
transversal · **D** apenas tokens.

| Superfície | Rota/Função | Tipo | Cargos | Complex. | Golden reutilizável | Classe | Mockup? | Frames | Prior. | Dependência | Risco regressão | Obs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Meu quadro | renderPersonBoard | board | todos | alta | — | **GOLDEN** | feito | F1 | — | — | — | aprovado |
| Cliente | renderClientFlowBoard | board | todos | alta | — | **GOLDEN** | feito | F2 | — | — | — | aprovado |
| Designers | renderDesigner* | board | todos | alta | — | **GOLDEN** | feito | F3 | — | — | — | aprovado |
| Social Medias | renderSocial* | board | todos | alta | — | **GOLDEN** | feito | F4 | — | — | — | aprovado |
| Setores | renderBoard | board | todos | alta | — | **GOLDEN** | feito | F5 | — | — | — | aprovado |
| **Detalhes completos** | renderClientView | página | todos | **muito alta** | header/timeline/chips | **A** | SIM | 1 | **P0** | C1/C2 | alto (superfície nº1 pós-board) | HERO+OPERAÇÃO+conteúdos+marcos |
| **Nova tarefa (wizard)** | renderForm | wizard | todos | alta | stepper/inputs | **A** | SIM | 1 (passo Briefing como hero; demais via C1) | **P0** | C1 | alto | 4 passos reais; lote Cards |
| **Agenda** | renderAgenda | calendário | todos | alta | header/chips | **A** | SIM | 1 | **P0** | C2 (sheet evento) | médio | paradigma próprio (grade mensal) |
| **Central de Notificações** | renderNotifCentral | lista | todos | média | header/chips | **A** | SIM | 1 | P1 | C6 | médio | lista com severidade/read-unread |
| **Executivo** | renderExecPanel | métricas | todos (dados por papel) | alta | header | **A** | SIM | 1 | P1 | C7 | médio | KPIs+filtros reais; read-only |
| **Relatórios** | renderReports | tabela+export | todos | alta | header | **A** | SIM | 1 | P1 | C7 | médio | tabela é paradigma próprio |
| **Login** | renderLogin | auth | público | baixa | tokens/brand | **A** | SIM | 1 | P1 | foundations | baixo | porta de entrada do Light |
| **Modal Legendas e artes** | renderProductionModal | modal denso | Social/Admin | alta | file/RTE | **A** | SIM | 1 | P1 | C1/C2 | alto | RTE+uploads Feed/Story |
| Janelas premium (bgnotify/SLA/check-in) | bgnotify/slareminder | janelas Electron | todos | alta | — | **A (futura)** | SIM (futuro) | 1–2 | P2 | GO específico | **contrato congelado** | só skin Light, sem tocar contrato |
| Minhas Prioridades | renderPrioridades | lista | pref. | média | cards/chips | **B** | não | — | P1 | C4 | baixo | lista de cards no DS |
| Hoje | renderHoje | resumo | todos | média | cards/stat-tiles | **B** | não | — | P1 | — | baixo | stat-tile entra na C8 |
| Hub Tarefas / roleBoards | renderHub/renderRoleBoards | seleção | todos | baixa | chips/cards | **B** | não | — | P1 | — | baixo | padrão de faixa dos Golden |
| Equipe | renderEquipe | grid cards | todos | baixa | avatar/cards | **B** | não | — | P1 | — | baixo | fotos reais já no DS |
| Perfil | renderPerfil | página | todos | baixa | avatar/rows | **B** | não | — | P2 | C1 | baixo | |
| Configurações | renderConfig | página seções | todos (+admin) | média | rows/toggles | **B** | não | — | P1 | C1 | médio | settrow/toggle na C1 |
| Team session (renovação) | H9/H10 | estado inline | todos | baixa | banner/chips | **C** | spec | — | P1 | C6 | médio | estados no Detalhes |
| Atualizador | Config+updMaybeToast | transversal | todos | baixa | rows/toast | **C** | spec | — | P2 | C6 | baixo | |
| Modais/sheets (conjunto) | modalRoot ×8 | transversal | todos | média | drawer-anatomy | **C** | spec | — | **P0** | — | alto | C2 |
| Menus/dropdowns/popovers | selects, card menus | transversal | todos | média | chips | **C** | spec | — | P1 | — | médio | menu nativo Electron fica fora do CSS |
| Formulários (todos os controles) | inputs/select/date/toggle/stepper/RTE/upload | transversal | todos | alta | — | **C** | spec | — | **P0** | — | alto | C1 (fundação obrigatória) |
| Empty states | emptyState() | transversal | todos | baixa | — | **C** | spec | — | P1 | — | baixo | C4 |
| Loading/skeleton/splash | authsplash etc. | transversal | todos | baixa | — | **C** | spec | — | P1 | — | baixo | C5; skeleton a definir |
| Toasts/erros inline | notifShowToast/flashToast | transversal | todos | média | — | **C** | spec | — | P1 | — | médio | C6; separado do premium |
| Tabela | Exec/Reports | transversal | todos | média | — | **C** | spec | — | P1 | — | médio | C7 |
| Sobre/versão/rodapés | Perfil/Config/sidebar footer | simples | todos | trivial | — | **D** | não | — | P2 | tokens | baixo | |
| Pills/badges/contadores | transversal | simples | todos | trivial | — | **D** | não | — | P2 | tokens | baixo | já definidos nos Golden |
| Tray/tooltips nativos | main/tray | nativo SO | todos | trivial | — | **D** | não | — | P2 | — | baixo | fora do CSS |
| **Client Portal** | Worker renderClientHtml | web pública | clientes | alta | — | **TRILHA SEPARADA** | não agora | — | — | decisão própria | alto (produção viva) | NÃO aplicar Light Desktop direto |

---

## C. PRIORIDADES
- **P0 VISUAL** (bloqueiam migração): Detalhes completos · Nova tarefa · Agenda · C1 Forms · C2 Modais.
- **P1 VISUAL**: Central de Notificações · Executivo · Relatórios · Login · Modal Legendas e artes · specs C3–C7 · páginas B (Prioridades/Hoje/Equipe/Config/Hub).
- **P2 VISUAL**: Perfil · Atualizador · rodapés D · janelas premium Light (gated por GO próprio).

## D. JÁ COBERTO PELOS 5 GOLDEN
Sidebar/branding/header/busca/subnav/monitor SLA/sino · Kanban canvas + colunas + contadores +
scroll-peek · card canônico completo (faixa=responsável, tag, eyeline, trilho, próxima ação,
avatares/fotos reais, metas) · faixas de seleção (pessoas/setores) · Central de aprovações
(barra) · drawer lateral completo (7 níveis, seções, arquivo/conteúdo, timeline com attention,
CTA) · linguagem de espera externa/SLA · empty implícito de coluna coerente.

## E. AINDA DESCOBERTO (resumo)
8 superfícies classe A (acima) + 8 component specs + foundations formais. Nenhuma outra
superfície encontrada além das listadas; varredura por `render*`, `modalRoot`, `data-tab`,
`data-sector`, janelas em `desktop/src/renderer/` e `main/`.

## F. COMPONENTES TRANSVERSAIS (ordem proposta)
**C1 — Forms & Controles** (input, textarea, select, date/time, search, toggle, checkbox/radio,
stepper [−][N][+], RTE do Tema/Legenda, upload/artBox, validação, disabled/focus/error) →
**C2 — Modais & Sheets** (anatomia, confirmação destrutiva del-sheet, sheet de evento,
picker de designer/prazo) → **C3 — Menus/Dropdowns/Popovers** → **C4 — Empty States** →
**C5 — Loading/Skeleton/Splash** → **C6 — Toasts & Erros inline (+banner update/team session)** →
**C7 — Tabela** → **C8 — Estados de interação & stat-tile** (hover/selected/focus/scrollbar).

### F.1 · ESTADO REAL DAS FOUNDATIONS (checkpoint global — auditado, sem inventar)
Esta seção §F é a **fonte formal da taxonomia C1–C8** (nomes acima, definidos na fase de
inventário). Estado após F1–F13:
| Cn | Nome formal (fonte: este §F) | Estado | Evidência visual Golden | Falta |
|---|---|---|---|---|
| C1 | Forms & Controles | **GOLDEN / COMPLETA no escopo real** (R2 aprovada `3c06c26`) | F7 + §10–16 do contrato (prancha R2 = prova dos estados) | — (exclusões formais: radio/multi-select/paginação/skeleton/validation-summary NÃO existem) |
| C2 | Modais & Sheets | **FOUNDATION OFICIAL / GOLDEN DOCUMENTAL (R3 aprovada `f9fe31a`)**: `C2-MODALS-SHEETS-CONTRACT.md` | F13 `32103bd` + del-sheet (R2 `3c06c26`) | gaps visuais do §17 ficam a critério do owner (fase curta opcional) |
| C3 | Menus/Dropdowns/Popovers | **FOUNDATION OFICIAL / GOLDEN (R5 GO)**: `C3-MENUS-POPOVERS-CONTRACT.md` | R5.1 `5959ae0` (menus ABERTOS) | — |
| C4 | Empty States | **FOUNDATION OFICIAL / GOLDEN (R5 GO)**: `C4-EMPTY-STATES-CONTRACT.md` | R2 "Dia livre" `3c06c26` | — |
| C5 | Loading/Skeleton/Splash | **FOUNDATION OFICIAL / GOLDEN (R5 GO)**: `C5-LOADING-SPLASH-CONTRACT.md` (skeleton/progress = INEXISTENTES) | R2 `3c06c26` + splash F12 | — |
| C6 | Toasts & Erros inline | **FOUNDATION OFICIAL / GOLDEN (R5 GO)**: `C6-TOASTS-ERRORS-CONTRACT.md` (7 canais; nativos = dívida) | R5.1 `5959ae0` (toast premium) + R2/F12/F13 | — |
| C7 | Tabela | **FOUNDATION OFICIAL / GOLDEN (R4 aprovada `2516426`)**: `C7-TABLE-CONTRACT.md` | F10 `9de9a6b` + F11 `efb264a` — sem gap visual | — |
| C8 | Estados de interação & stat-tile | **FOUNDATION OFICIAL / GOLDEN (R6 GO `b2f6833`)**: `C8-INTERACTION-STATES-CONTRACT.md` | R2 + F7/F8/F9/F12/R5.1 — sem gap | — |
Nenhuma outra foundation nomeada existe nos documentos; **não criar códigos novos** sem decisão
do owner. O modal do F13 pertence à **C2** (corrigida a nota do F13 que dizia "sem foundation
nomeada" — o nome já existia neste §F).

## G. FUNDAÇÃO LIGHT (congelar antes de implementar)
Tokens de cor (canvas/surface/surface-2/sunk/hairlines/tx-1..4/sb-*/brand/grad/status/eixos
cliente-designer-social-operacional já provados nos Golden) · tipografia Inter + Inter Tight
(escala 26/23/18/16/15/14/13.5/13/12.5/12/11/10 + pesos) · spacing 4/8 · radius 6/8/12/13/14/16/999 ·
sombras sh-1/sh-2/sh-drawer · iconografia stroke 1.7 (~40 símbolos usados nos Golden) · avatar
photo-ready + ring por identidade · form controls (C1) · focus/hover/selected/disabled ·
scrollbars · skeleton · transições (drawer/scrim 0.18–0.2s; reduced-motion).

## H. RESPONSIVIDADE (riscos e revalidações)
> **R8 ✔ GO DO OWNER (commit `1b7210c`):** validação real 1366×768 @1× e Windows 125% (1093×614 DIP @
> DSF 1.25 — Playwright/CDP, sem transform:scale) — 9 arquétipos × 2 viewports = 18/18 PASS após
> 8 achados corrigidos em cópias isoladas (`r8-responsive/`). Golden 1920 intocado. Prova, matriz
> e achados: `R8-RESPONSIVE-VALIDATION.md`. **Responsividade oficial: 1920 Golden · 1366 = VALIDADO · Windows 125% = VALIDADO.**

| Categoria | 1366×768 | 1440×900 | 1920×1080 | 2560×1440 | 125–150% | Revalidar? |
|---|---|---|---|---|---|---|
| Boards Golden (F1–F5) | **VALIDADO R8** (col ≥264 + scroll-x kanban; drawer overlay ≤1600) | médio | ok | ok (max-width do canvas?) | **VALIDADO R8 (125%)** | ✔ GO R8 |
| Detalhes completos | **VALIDADO R8** (3→2 col; timeline scroll-x) | médio | ok | ok | **VALIDADO R8 (125%)** | ✔ GO R8 |
| Agenda | **VALIDADO R8** (painel 384; ≤1240 empilha) | baixo | ok | ok | **VALIDADO R8 (125%)** | ✔ GO R8 |
| Executivo/Relatórios | **VALIDADO R8** (min(1360,100%); tabela C7 scroll-x armado) | médio | ok | ok | **VALIDADO R8 (125%)** | ✔ GO R8 |
| Wizard/modais | **VALIDADO R8** (scroll interno já projetado; sheet 88vh) | baixo | ok | ok | **VALIDADO R8 (125%)** | ✔ GO R8 |
| Config/Perfil/Equipe | baixo (coberto por arquétipo — R8 §10) | baixo | ok | ok | baixo (idem) | não |

## H.2 ACESSIBILIDADE (status R9)
> **R9 ✔ GO DO OWNER (`d927c01`):** `ACCESSIBILITY-CONTRACT.md` = spec transversal OFICIAL
> (comprovado × requirement × dívida). Comprovados no real: focus-visible global ·
> traps evd/det · 4 dialogs aria-modal · toast stack role=status/aria-live · Enter/Espaço em
> .evc e toasts · `<details>` nativos · `<button>` em sidebar/stats/calendário/ações · lang
> pt-BR · reduced-motion ×6. Debt register A11Y-D01–D25 (P0 único = upload sem teclado —
> IMPLEMENTAÇÃO). Contraste Golden: núcleo PASS; tx-3/tx-4/brand-texto/orange = design debts.
> **R9.1 ✔ GO DO OWNER (`363d221`):** dívidas de DESIGN fechadas — `ACCESSIBILITY-TOKEN-ERRATA.md`
> = **CANÔNICA** (E1–E11; axe −84%; regressão 9/9; Golden intocado).
> Zero superfície nova; 30/30 mantido.

## I. ORDEM DOS FRAMES A — ✔ CONCLUÍDA (checkpoint global)
**F6 → F13 = todos entregues e GOLDEN** (commits no banner do topo). Restante desta trilha:
(**F14a–c** janelas premium Light — P2, somente com GO específico do owner; contrato funcional
congelado; FORA do caminho crítico do fechamento do design salvo decisão contrária).

## J. ORDEM DOS COMPONENT SPECS
C1 → C2 (antes de F7/F13) → C3 → C4 → C5 → C6 → C7 (antes de F10/F11) → C8.

## K. CRITÉRIOS PARA "DESIGN COMPLETO"
1) F1–F13 aprovados (F14 opcional/gated); 2) C1–C8 aprovadas; 3) foundations congeladas em
documento único; 4) revalidação 1366×768 + 125% dos frames marcados; 5) matriz sem célula
"pendente"; 6) portal do cliente formalmente mantido em trilha separada; 7) declaração
explícita do owner: DESIGN COMPLETO.

## L. QUANDO COMEÇAR A IMPLEMENTAÇÃO (recomendação)
Somente após: P0 visual fechado (F6–F8 + C1/C2) e foundations congeladas. Sequência de
implementação sugerida (futura, gated, fora deste mandato): fundação de tokens → superfícies
B (menor risco) → superfícies A na ordem de aprovação → janelas premium por último (contrato
congelado). Nenhuma implementação foi iniciada nesta fase.

---
*Levantamento 100% read-only sobre 1.0.246; nenhuma linha de produção alterada; nenhum mockup
novo gerado; Golden Frames intocados.*


---

# CHECKPOINT DE CONSISTÊNCIA (executado por ordem do owner)

## 1) Matriz fechada — 30 superfícies, cada uma EXATAMENTE uma vez
| # | Superfície | Função real | Golden? | Golden | Classe | Prior. | Mockup? | Frames | Obs |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Meu quadro | renderPersonBoard(self) | SIM | F1 | GOLDEN | — | feito | 1 | aprovado |
| 2 | Cliente | renderClientFlowBoard | SIM | F2 | GOLDEN | — | feito | 1 | aprovado |
| 3 | Designers | renderDesigner* | SIM | F3 | GOLDEN | — | feito | 1 | aprovado |
| 4 | Social Medias | renderSocial* | SIM | F4 | GOLDEN | — | feito | 1 | aprovado |
| 5 | Setores | renderBoard | SIM | F5 | GOLDEN | — | feito | 1 | aprovado |
| 6 | Detalhes completos | renderClientView + opPanelBlock | SIM | F6 | **GOLDEN** | — | feito | 1 | `9644d94` |
| 7 | Nova tarefa (wizard) | renderForm | SIM | F7 (7A–7D) | **GOLDEN** | — | feito | 4 | `ea485c2`/`5d2b10d`/`7361f92`/`755eee6` + `f5d1909` |
| 8 | Agenda | renderAgenda | SIM | F8 | **GOLDEN** | — | feito | 1 | `96fd7d3` |
| 9 | Central de Notificações | renderNotifCentral | SIM | F9 | **GOLDEN** | — | feito | 1 | `8173940` |
| 10 | Executivo | renderExecPanel | SIM | F10 | **GOLDEN** | — | feito | 1 | `9de9a6b` |
| 11 | Relatórios | renderReports | SIM | F11 | **GOLDEN** | — | feito | 1 | `efb264a` |
| 12 | Login | renderLogin | SIM | F12 | **GOLDEN** | — | feito | 1 | `6e52905` · standalone SEM shell |
| 13 | Modal Legendas e artes | renderProductionModal | SIM | F13 | **GOLDEN** | — | feito | 1 | `32103bd` · âncora C2 |
| 14 | Notificação externa premium | bgnotify.html | NÃO | — | **A futura** | P2 | futuro | 1 (F14a) | contrato congelado; GO próprio |
| 15 | Lembrete central SLA | slareminder.html | NÃO | — | **A futura** | P2 | futuro | 1 (F14b) | contrato congelado |
| 16 | Check-in de execução | janela F3.5.4Q | NÃO | — | **A futura** | P2 | futuro | 1 (F14c) | contrato congelado |
| 17 | Minhas Prioridades | renderPrioridades | — | — | **B — SPEC APROVADA (R7 ✔ GO do owner)** | — | spec | — | `B-SURFACES-APPLIED-SPECS.md` §1 |
| 18 | Hoje | renderHoje | — | — | **B — SPEC APROVADA (R7 ✔ GO do owner)** | — | spec | — | specs §2 · stat-tile C8 |
| 19 | Hub Tarefas / quadros por pessoa | renderHub/renderRoleBoards/personBoard | parcial | F1/F5 | **B — SPEC APROVADA (R7 ✔ GO do owner)** | — | spec | — | specs §3 · bcard F5 |
| 20 | Equipe | renderEquipe | — | — | **B — SPEC APROVADA (R7 ✔ GO do owner)** | — | spec | — | specs §4 · reconfirmada ~10 linhas |
| 21 | Perfil | renderPerfil | — | — | **B — SPEC APROVADA (R7 ✔ GO do owner)** | — | spec | — | specs §5 · read-only + sheets C2 |
| 22 | Configurações | renderConfig | — | — | **B — SPEC APROVADA (R7 ✔ GO do owner)** | — | spec | — | specs §6 · amostra Golden R2 |
| 23 | Team session (renovação) | F3.5.6A-H9/H10 (estados inline) | NÃO | — | **C** | P1 | spec | — | entra na C6 |
| 24 | Atualizador | Config Atualizações + updMaybeToast | NÃO | — | **C** | P2 | spec | — | C6 |
| 25 | Toasts internos | notifShowToast/flashToast | NÃO | — | **C** | P1 | spec | — | C6 |
| 26 | Modais/diálogos (conjunto core) | modalRoot ×8 (del-sheet, evento, designer/prazo, confirmações) | NÃO | — | **C** | P0 | spec | — | C2 |
| 27 | Menus contextuais/dropdowns | card menus, selects exec-fl (menu nativo Electron fora do CSS) | NÃO | — | **C** | P1 | spec | — | C3 |
| 28 | Empty states | emptyState() | NÃO | — | **C** | P1 | spec | — | C4 |
| 29 | Loading/splash | auth splash/prewarm/"Carregando…" | NÃO | — | **C** | P1 | spec | — | C5 |
| 30 | Client Portal | Worker renderClientHtml | NÃO | — | **TRILHA SEPARADA** | — | não agora | — | decisão visual própria |

**Contagem fechada (soma = 30, sem dupla contagem) — ATUALIZADA no checkpoint global:**
GOLDEN **13** (F1–F13) · A **0** pendentes · A-futura gated **3** (F14a–c) · B **6** · C **7** · Trilha separada **1**.
Nota: C1 (Forms), C7 (Tabela) e C8 (Estados de interação) são SPECS de fundação extraídas de
superfícies A/B — não são superfícies próprias e por isso não somam na matriz; C2–C6 correspondem
às superfícies classe C acima.

## 2) Decisão EQUIPE (provada pelo código)
`renderEquipe` (linhas 10260–10270) tem ~11 linhas: lista ordenada de cards com avatar 42 + nome +
"(você)" + cargo + "· admin" + pill Ativo/Pendente, em grid `d-team`. **Não existem** no código:
ações por usuário, edição, convite/criação, detalhe de usuário, filtros ou permissões editáveis.
→ **Decisão: B confirmada** (grid de cards 100% composto por componentes Golden: avatar
photo-ready + ring, pills, cards). Nenhum Component Spec adicional além dos já planejados.

## 3) Decisão CONFIGURAÇÕES (provada pelo código)
`renderConfig` (10334+) é **uma única página** com seções empilhadas (não há sub-rotas/subpáginas):
Gerenciamento de Conta · Privacidade e Segurança · Preferências de Notificação (+Diagnóstico) ·
Produtividade (toggle) · Bandeja · Inicialização com o Windows (toggle) · Acompanhamento de
execução (Check-ins) · Acessibilidade e Aparência · Desempenho e Dados · Idioma e Região ·
Administração · Atualizações · Sessão · Sobre — todas compostas de `settrow`/toggle/pill/ação.
→ **Decisão: B (shell da página) + C1 obrigatória** (settrow, toggle, select, linhas de
diagnóstico entram na spec C1/C6; a spec C1 incluirá uma seção de Configurações renderizada como
amostra aplicada). Subáreas triviais (Sobre/versão) = D. **Não** precisa de frame A próprio: zero
composição nova além de rows — mas a página NÃO será migrada antes da C1 aprovada.

## 4) REGRA DE IMPLEMENTAÇÃO (corrigida por ordem do owner)
**NENHUM Light UI entra em produção até o DESIGN estar COMPLETO.** Implementação só poderá
começar quando: todos os Frames classe A prioritários aprovados; C1–C8 aprovados; foundations
congeladas; responsividade mínima validada (1366×768 + 125% nos frames marcados); Master Surface
Map sem pendências; e o owner declarar explicitamente **DESIGN COMPLETO**. A recomendação
anterior (começar após F6–F8 + C1/C2) está **revogada**.
