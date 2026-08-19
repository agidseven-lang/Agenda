# ▶ R9 — ACESSIBILIDADE · AUDIT + SPEC TRANSVERSAL (aguarda owner)
Fase READ-ONLY (zero implementação/ARIA/tabindex/cor/modal alterados; zero imagem).
`ACCESSIBILITY-CONTRACT.md` criado (30 seções): matriz global 24 linhas; keyboard real (14
handlers; Enter/Espaço/Escape/Tab provados; ZERO arrows/Home/End); focus (regra global +
variante danger 1144 + return focus 12124); semântica (buttons reais na maioria; divs: priCard/
nc-row); ARIA inventário exato (42 aria-label; 4 aria-modal; 0 selected/current/pressed/invalid/
describedby); contraste WCAG CALCULADO (tx-1 17.8 PASS … tx-4 2.21 FAIL; focus ring 4.26+ PASS);
cor-não-única (dots calendário = gap); targets (ntf-x 20×20 FAIL 2.5.8; vqty 40 padrão-ouro);
tabelas (scope/caption ZERO); menus (evd role=menu ✓; arrows ZERO); toasts (stack live ✓;
flashToast sem aria); loading (aria-busy único 11578); motion (6 blocos reduced ✓; hover-lift
sem override); ícones-only (matriz); avatar/arte F13 (arte = conteúdo); upload = **A11Y-D01 P0
implementação** (input hidden sem teclado, 9217); RTE (toolbar ✓ labels; pressed ZERO);
forced-colors ZERO; zoom 200% fora de escopo (só 125% validado); axe-core 4.13.0 temporário
(7 arquétipos; F12 = 0). Debt register D01–D25 + guardrails §29 (inclui min-width:0 do R8).
Design P0 = NÃO · Implementation P0 = SIM (D01) · gap visual = NÃO · superfície nova = NÃO.
R8 GO registrado em todos os docs. R10 NÃO iniciada.

# ✔ R8 — RESPONSIVIDADE · VALIDAÇÃO 1366×768 + WINDOWS 125% (GO do owner)
Fase de VALIDAÇÃO (não redesign). Golden 1920 IMUTÁVEL — adaptações só em cópias
(`r8-responsive/`, um bloco `<style id="r8">` por cópia). Harness honesto: Playwright/CDP com
viewport CSS + deviceScaleFactor EXATOS (1366×768 @1× e 1093×614 @1.25× — o mesmo modelo
"viewport ~1092×614" que o renderer real documenta para 125%); a 1ª tentativa com
`--headless=new --window-size` foi DESCARTADA após sonda provar viewport real 1366×681.
- **18/18 PASS** (9 arquétipos × 2 viewports) + prova complementar F1 sem drawer; 19 capturas
  entregues só no chat (imagens fora do Git — política reconfirmada).
- Decisões de mecanismo: F1 col ≥264 + scroll-x kanban + drawer OVERLAY ≤1600 · F6 3→2 col +
  timeline scroll-x · F7C teto 100vh + scrolly flex · F8 painel 384 / empilha ≤1240 · F9/F10/F11
  min(width,100%) + wraps · F11 tabela C7 com scroll-x ARMADO no card (não necessário a 1366/125%)
  · F12 espelho da media real 660 · F13 sheet 88vh + pr-list ≤56vh flexível.
- Achados: P0 harness; P0 `min-width:auto` de grid inflava o shell a 125% (header cortado) —
  vira REQUISITO de implementação (`.main>*`/`.page>*{min-width:0}`); P1 F6 (.cols/OPERAÇÃO/
  timeline), P1 F10 toolbar; P2 chips F6 / CTA F8. Zero mudança funcional; zero token reduzido;
  sidebar colapsada NÃO existe no real — não inventada.
- C3 (menus nunca saem do viewport) e C6 (`.ntf max-width:94vw`; canal SLA 92vw) provados no
  CÓDIGO real (clamp + autocalibração de escala, renderer ~12402/10930/4464/3668) — sem imagem.
- R7 GO registrado (mapa/B-specs/roadmap). Doc: `R8-RESPONSIVE-VALIDATION.md` (13 seções).
  Recomendação PASS — decisão do owner pendente; R9 não iniciada.

# ✔ R7 — SUPERFÍCIES B · APPLIED SPECS (GO do owner)
Fase read-only, ZERO imagem. `B-SURFACES-APPLIED-SPECS.md` criado — 6 B auditadas na 1.0.246 e
especificadas 100% com Shell + C1–C8 oficiais (matriz foundation×superfície completa; nenhuma B
vira Frame A; zero gap visual):
- **Prioridades** (5287): gate por PREFERÊNCIA (estado desativado literal), resumo em pills,
  Minimizar/Expandir, offline banner, 8 filtros chip, priCard (rail 5px por nível + pill "Nª ·
  Nível" + razões), empty "Tudo certo por aqui", seção "Aguardando cliente" + ocorrências.
- **Hoje** (5821): saudação + STAT-TILES C8 (accent no primeiro; nunca dashboard/KPI) + 3
  colunas (compromissos/urgentes/próximos) + emptylines reais (incl. "🎉" literal).
- **Hub** (6135/6175): bcards F5 — Meu quadro · Quadros por responsável (GATE ADMIN) · Cliente/
  Designers (canSeeAll, pills de atraso) · setores ativos; RoleBoards → personBoard F1.
- **Equipe** (10260): RECONFIRMADA ~10 linhas — card avatar 42 + (você) + cargo·admin + pill
  Ativo/Pendente; sem ações/filtros ⇒ SPEC SUFICIENTE. `renderChat` = código INATIVO (K8).
- **Perfil** (10282): pcard 92 + pill Admin/Membro + 3 settRow→sheets C2 (Conta/Segurança/Sobre)
  + "Sair da conta"; READ-ONLY — sem inputs/upload inline (edições = modais C2).
- **Configurações** (10334): página única, 15 seções literais mapeadas (toggles reais de
  diagnóstico, tray com 5 estados, Iniciar com o Windows, Check-ins [amostra Golden R2],
  Atualizações, "Em breve" reais); Sobre/versão = D reconfirmado.
R6 GO registrado (C8 = FOUNDATION OFICIAL ⇒ **C1–C8 oficiais**). Dívidas novas: literais
técnicos de Config, chips sem aria-pressed, priCard teclado, logout sem confirmação.
**R7 aguarda owner; R8 não iniciado.**

---

# ▶ R6 — C8 ESTADOS DE INTERAÇÃO & STAT-TILE · CONSOLIDAÇÃO DOCUMENTAL (aguarda owner)
Fase read-only, ZERO imagem. `C8-INTERACTION-STATES-CONTRACT.md` criado (nome formal do mapa §F
confirmado). Inventário integral: 95 `:hover` · 21 `:focus-visible` · 11 `:active` · 62
transitions · **0 `aria-selected/current/pressed`** (requirement p/ R9). Ownership matrix
formal (C8 referencia C1–C7; não duplica). Consolidados: **SELECTED ≠ ACTIVE ≠ ACCENT** (dia do
calendário roxo sólido = exceção local que NÃO generaliza); gramática current/completed/future
(stepper≠timeline); read/unread (unread≠disabled); severity = sistema de cor semântica (fora da
interação); **REGRA GLOBAL REAL de focus-visible desktop** (outline 2px accent, linha 1324) com
tokens-base C1 e variações contextuais reais; HOVER (4 mecânicas: surface shift/tint/brightness+
lift/border accent — desktop-only) e PRESSED (3: brightness .94/translateY 1px/scale .97-.995)
= owner C8; temporal (today/dim/selected F8 + literais taskDeadline); sync (dot shell + banner
offline âmbar de Prioridades + splash C5). **STAT-TILE completo** (owner C8): anatomia real,
variantes default/accent (accent = destaque, não seleção), clicável data-tab, **hover-lift REAL
(translateY −2px + border accent + sombra, linha 1320)**, focus global, **≠ KPI CARD (regra
formal)**; sem trend/delta/sparkline/tooltip. Motion: sem foundation formal — C8 referencia
timings reais (.1–.2s). Anchors R2/F7/F8/F9/F12/R5.1 → **sem gap visual**. Docs da R5
atualizados para GO (C3–C6 = FOUNDATIONS OFICIAIS). **C8 aguarda owner; R7 não iniciado.**

---

# ▶ R5.1 — TRANSVERSAL ANATOMY BOARD · C3 + C6 (gate visual da R5; aguarda owner)
`r5-1-transversal-anatomy-board.html` — prancha única 1920×1080 fechando os DOIS gaps da R5.
- **C3 provado ABERTO**: menu "Mais opções" do detalhe de evento (ancorado ACIMA do trigger;
  itens reais Finalizar + Excluir definitivamente danger; role=menu/menuitem + aria-haspopup/
  expanded comprovados; Escape/setas = requirement) e card menu ⋯ (PORTAL → body, fixed z-80;
  itens reais "Reenviar notificação" + "Excluir tarefa" com :focus-visible por tipo; fecha por
  scroll/resize/ESCAPE/re-render/ação). Mesma família visual, mecânica distinta. SELECT=C1 e
  Electron nativo registrados fora.
- **C6 provado**: stack premium real (role=status + aria-live=polite COMPROVADOS) com 3 amostras
  — crítico/SLA (rail vermelho, avatar iniciais, Responsável, sev-chip, X), atribuição info
  (variante real; X em :focus-visible) e AGRUPADO premium (eyebrow "3 atualizações", linhas
  Ator·ação, "+1 outras", **CTA pill real "Abrir →"**). TTLs 11/8/6s; teclado Enter/Espaço REAL;
  flashToast como amostra separada. Upgrades requirement→comprovado registrados no C6.
- Zero função inventada; dados demonstrativos; tradução dark→Light Golden. **C3/C6 aguardam
  owner; R5 NÃO concluída; R6 não iniciado.**

---

# ▶ R5 — C3/C4/C5/C6 · CONSOLIDAÇÃO DOCUMENTAL (aguarda owner)
Fase read-only, ZERO imagem. 4 foundation contracts criados a partir da auditoria integral:
- **C3 Menus/Popovers**: evd-menu real (role=menu, ancorado ACIMA do trigger, min-w 220, item
  danger) + card menus ⋯ (`.tcv4-menu`/`.kbv2-menu` = PORTAL no body; fecham por scroll/resize/
  Escape/re-render/ação). SELECT C1 ≠ MENU; Electron nativo fora do CSS. **GAP visual** (nenhum
  menu aberto provado) → Anatomy Board opcional.
- **C4 Empty States**: 10 empties reais inventariados; 1 linguagem/3 escalas (padrão emptyState ·
  grande nc-empty/exec-empty · linha emptyline/mini); **ZERO CTA em todo o produto**; initial ≠
  no-results REAL na Central; anchor R2 "Dia livre"; sem gap.
- **C5 Loading/Splash**: 4 famílias (processing button [anchor R2] · full splash F12 · inline
  status/settrow "Carregando…" · toast de progresso→C6); **skeleton e progress bar INEXISTENTES**;
  único `aria-busy` real = "Salvando cronograma…"; sem gap.
- **C6 Toasts/Errors**: **7 canais reais** (flashToast singleton 2.6s sem stack · toast premium
  interno COM stack/severidade/avatar/X focus-visible/CTA deep/agrupamento · inline error C1 ·
  banner form-level · status line · alert() ×34 · confirm() ×2); **C6 USA C1**; nativos =
  dívida registrada (não redesenhar como toast). **GAP parcial** (toast premium) → mesma board.
C7 marcada FOUNDATION OFICIAL (GO do owner à R4). **C3–C6 aguardam avaliação; R6 não iniciado.**

---

# ▶ R4 — C7 TABELA · CONSOLIDAÇÃO DOCUMENTAL (aguarda owner)
Fase read-only, ZERO imagem. `C7-TABLE-CONTRACT.md` criado. Auditoria integral: **exatamente 3
`<table>` reais** no renderer (Ranking de designers F10 · Atrasos por designer F11 · Histórico
resumido F11), todas `.exec-tbl` — âncoras Golden F10/F11 cobrem 100% (sem gap visual).
Taxonomia: 1 família (dense data table) com 2 composições (métrica/ranking · histórico).
Consolidados: anatomia (card contêiner; th 10.5/700 uppercase; td 13.5 hairline; densidade
única), alinhamento numérico (.c centro + tabular-nums; % na pct cell; "min"/"—"), pct cell
(track+fill+número SEMPRE; faixas ≥90/≥75/≥60), severity pill (valor sempre visível), person
cell (avatar 24 + primeiro nome), timeline = componente F11 HOSPEDADO. Inexistências formais:
sorting · paginação (reconfirmada) · row selection · row action/click · hover/zebra/sticky.
Empty real = row colspan com literais ("Sem designers no período." etc.), sem emptyState().
Regra formal **LIST ≠ TABLE** (mini-list/ncRow/infoline/settrow são listas). Dívida F11 thead
5×7 re-provada (empty colspan=5 idem) — funcional, fora do redesign. C2 marcada GOLDEN
documental (GO do owner à R3). **C7 aguarda avaliação; R5 não iniciado.**

---

# ▶ R3 — C2 MODAIS & SHEETS · CONSOLIDAÇÃO DOCUMENTAL (aguarda owner)
Fase read-only, ZERO imagem. `C2-MODALS-SHEETS-CONTRACT.md` criado: inventário integral do
renderer (20 modais/sheets em `#modalRoot` + `ts-auth-back` e `slaedit-ov` próprios), taxonomia
real (Confirmation · Form · Selection · Detail · Production/Workflow), tokens (larguras 420–1240,
88vh, blur 3px, z-60/90), **C2 CONSOME C1**, hierarquia PRIMARY/SECONDARY/CONTEXTUAL/DESTRUCTIVE,
close comprovado×ausente (SEM Esc/backdrop-close no modalRoot — atributos órfãos registrados),
a11y: **trap de Tab + role=dialog + retorno de foco REAIS em evd/det** (corrige registro do R1),
dívidas e gaps visuais (§17). C1 marcada GOLDEN/COMPLETA no escopo real (GO do owner ao R2).
Nenhuma superfície nova; A-futuras intocadas. **C2 aguarda avaliação; R4 não iniciado.**

---

# ▶ R2 — C1 COMPLETION · ESTADOS REAIS (prancha entregue; aguarda owner)
`r2-c1-completion-estados.html` — **prancha de contratos** (spec board 1920×1080; não é tela do
produto, não é Frame A). Fecha visualmente as pendências do C1 §3 com estados 100% reais da
1.0.246; matriz de auditoria completa no header do arquivo e candidatos no **C1 §16**.
- **Representados (com origem real):** primary/secondary default·disabled·loading (`.btn[disabled]`
  opacity .6; Login `loading(btn,on)` spinner); "Salvando cronograma…" (rev-send `aria-busy`);
  contrato **OFF ≠ DISABLED**; inline error real `sq-err`/`cqErr` (literal "Informe uma
  quantidade inteira igual ou superior a 1.", `role=alert`, `−` no mínimo disabled);
  form-level banner reutilizado do F12; **del-sheet** destrutivo completo (literais
  "Remover tarefa?"/"Não é possível desfazer."/btn-danger); checkbox (semântica nativa de
  Config·Check-ins → representação DS: checked/unchecked/focus); **checklist = editor** (não
  checkbox — `checklistHtml`); amostra aplicada de Configurações (settrow + chips de modo +
  checkboxes + "Salvar configuração" + gate admin); empty state real ("Dia livre", SEM CTA);
  stat-tile real (amostra → C8).
- **Exclusões formais auditadas (não existem — nunca inventar):** validation summary (global =
  `alert()` nativo) · radio · multi-select · paginação · skeleton.
- Nenhum contrato Golden redesenhado; nenhuma função inventada. **C1 NÃO declarada completa** —
  aguarda avaliação do owner; R3 não iniciado.

---

# ★ CHECKPOINT GLOBAL DO DESIGN — FRAMES A 1–13 = GOLDEN / CONGELADOS
Decisão do owner. Commits finais: F1 `e7107e3` · F2 `45721bc` · F3 `b5842bc` · F4 `66d9a6a` ·
F5 `c0c83f4` · F6 `9644d94` · F7 `ea485c2`/`c0cb413`/`5d2b10d`/`7361f92`/`e18d9f7`/`755eee6`
(+checkpoint `f5d1909`) · F8 `96fd7d3` · F9 `8173940` · F10 `9de9a6b` · F11 `efb264a` ·
F12 `6e52905` · F13 `32103bd`. **NÃO é Design Completo; implementação segue NÃO AUTORIZADA.**
Fechamento: `DESIGN-CLOSURE-ROADMAP.md`. Taxonomia de foundations = `MASTER-SURFACE-MAP.md` §F/F.1
(C1 Forms · C2 Modais & Sheets · C3 Menus · C4 Empty · C5 Loading · C6 Toasts/Erros · C7 Tabela ·
C8 Interação/stat-tile — nomes formais; nenhuma nova sem decisão do owner).

## Contratos GLOBAIS congelados neste checkpoint
- **SHELL GOLDEN**: sidebar petróleo 284px (brand + Nova tarefa gradiente + nav com badge +
  cartão do usuário) · header global 92px (título/subtítulo, Monitor SLA verde, sino) · canvas
  #F5F6F9 · Inter/InterTight · ícones stroke 1.7 · grid 4/8 · raios/sombras Golden.
  **Exceção formal: LOGIN É STANDALONE (F12) — sem shell na implementação futura.**
- **FOTO/AVATAR**: com foto cadastrada → foto real do runtime (`photoOf → avatar()`); sem foto →
  fallback de iniciais. Mocks podem materializar localmente; **NUNCA versionar foto pessoal**
  (`_team-photos.css` gitignored; `_avatars.css` versionado = ilustrações sintéticas DiceBear
  micah CC BY 4.0, sem fotos reais — auditado neste checkpoint).
- **CÓDIGO = FONTE DA VERDADE**: "não inventar" = não criar função inexistente; **não** autoriza
  esconder função real. Divergência ⇒ AUDITAR → PARAR → REPORTAR → OWNER DECIDE → DESENHAR.
  Precedentes: "Enviar para o cliente" (7D) · export CSV/JSON (F11) · modal real (F13).
- **SALVAR ≠ ENVIAR AO CLIENTE** (microcontrato crítico do F13, válido em todo o produto):
  preparar/salvar nunca afirma envio; envio só na confirmação real (Worker).

## DÍVIDAS FUNCIONAIS CONSOLIDADAS (registradas nos frames; NÃO corrigir no design)
| Frame | Dívida (fonte real) | Registro |
|---|---|---|
| F7 (7D) | Rótulo legado "Subtipo" = "12 conteúdos" (`stepReview`) | C1 §8 |
| F9 | Rodapé da Central em linguagem técnica (localStorage/retenção literal) — fiel ao real; melhoria de UX-writing fica para fase funcional | registrado NESTE checkpoint (antes só "rodapé literal") |
| F10 | Bases de contagem divergentes: `ativas` (hasSla&&!done) × distribuição (`d.state`); hint "% do total" mistura bases | notas F10 |
| F10/F11 | `criticasRecentes` inclui overdue NÃO-crítico (nome enganoso; "Tarefas críticas" lista itens <10min) | notas F10/F11 |
| F11 | `<thead>` 5 colunas × `execDesRow` 7 células — desalinhamento header×linha em produção | notas F11 |
| F12 | Recovery = STUB nesta build (telas existem; endpoints de reset não são chamados — banners "não tocado nesta prévia") | notas F12 |
| F12 | Enter NÃO submete o login (#loginForm é div, sem form/keydown) | notas F12 |
| F12 | `wp_team_jwt` (JWT de equipe escopado TTL 12h) em localStorage — deliberado/documentado; NÃO é o token de sessão (esse fica no main) | notas F12 (registro de arquitetura) |
| F13 | Dimensões Feed/Story apenas editoriais (sem validação funcional); sem limite de tamanho/formato além de `image/*` | notas F13 |
| F13 | Upload sem progress (só toasts); botões de salvar sem disabled/loading (double-submit possível); `.pr-url` sem validação | notas F13 |
Nenhuma dívida é bloqueio do design; todas pertencem a fase FUNCIONAL futura decidida pelo owner.

## RESPONSIVIDADE / ACESSIBILIDADE — estado honesto
- **Validado visualmente**: SOMENTE 1920×1080 (todos os F1–F13). 1366×768 e Windows 125% =
  requisitos documentados (C1 §5; media query real do login registrada no F12) — **NÃO validados**.
  Matriz de revalidação: `MASTER-SURFACE-MAP.md` §H (boards/detalhes/agenda/exec-relatórios = SIM).
- **Acessibilidade**: requisitos congelados como SPEC (C1 §6: contraste, foco visível, cor nunca
  único indicador, targets, labels, keyboard, disabled ≠ OFF). **Nada implementado/validado** —
  estamos em design. Focus trap de modal: NÃO comprovado no código real — não é contrato; decisão
  fica para a spec C2/implementação.

---

# ▶ CHECKPOINT FORMAL — FRAME 7 (Nova tarefa) = GOLDEN / CONGELADO
Decisão do owner: o wizard completo **Setor → Dados → Briefing → Revisão** é a referência Golden
oficial da superfície NOVA TAREFA. Nenhum Frame 7 pode ser redesenhado sem autorização explícita.
- 7A Setor `ea485c2` · 7B V2 Dados `5d2b10d` · 7C Briefing `7361f92` · 7D V2 Revisão `755eee6`.
- **C1 — Forms & Controls = GOLDEN PARCIAL / FOUNDATION OFICIAL** (29 componentes congelados; estados
  disabled/error/saving/upload/checkbox/radio/multi-select/table ainda pendentes). Contrato completo:
  `C1-FORMS-CONTROLS-CONTRACT.md`.
- Precedente de fidelidade: "Enviar para o cliente" (real, `canSendToClient`) incluído por decisão do
  owner. Dívida semântica registrada: rótulo "Subtipo" = "12 conteúdos" (legado real, não corrigir no mockup).

---

## FRAME 13 — MODAL "LEGENDAS E ARTES" (candidata) · `proposta-c-frame13-modal-legendas-artes.html`
**Status:** Frames 1–12 GOLDEN. FRAME 13 = último Frame A prioritário do Master Surface Map —
modal REAL de produção (`renderProductionModal` 9221) no DS Golden, sobreposto ao **Frame 6 Golden
intacto** (mesma tarefa Sunset Wear no estágio 'Aguardando legendas e posts', de onde o CTA real
"Legendas e artes" abre o modal). **Não declarado Golden; Frames A NÃO declarados completos.**

**Reauditoria read-only (1.0.246):** openProductionModal 9204 / artBox 9210 / renderProductionModal
9221 / prodCollect+saveProduction 9252–9286 / ikUpload 9192 / handlers 9239–9251 + 12449–12450 /
CSS real 383–389, 1230–1231, 1714–1750, 1952–1971 / gates 6630–6674 (pendências) + 8642 (hero).

**Abertura/gate real:** CTA "Legendas e artes" (`data-prodopen`) no hero do Detalhes, estágio
`designer_entregou` (owner social; único estado com a action `prod`). `openProductionModal`:
**isTaskCompleted ⇒ BLOQUEADO** com toast "Esta tarefa já foi concluída e não pode ser reenviada."
(F3.5.6A-H16, zero write; fail-safe mesmo com botão oculto). Sem gate de papel no handler —
disponibilidade é por FASE. `state._prod` = cópia temporária de `cronContents` (nada grava até Salvar).

**Estrutura real do modal:** `#modalRoot` → `.modal-back` (desktop centrado, rgba(6,7,11,.62) +
**blur 3px REAL**) → `.sheet.pr-sheet` (max-width 680, radius 18, max-height 88vh) com **X**, ícone
âmbar film (`.pr-ic`), título **"Legendas e artes"**, sub literal "Preencha a legenda e anexe as
artes de cada conteúdo. Feed **1080×1440** e Story **1080×1920**. Depois reenvie ao cliente pelo
mesmo link." → `.pr-list` (**todos os conteúdos EMPILHADOS; scroll real 56vh**, scrollTop preservado
1.0.110; SEM tabs/accordion/prev-próximo/contador) → footer `.sp-actions`.

**Card por conteúdo:** nº (`.pr-n`) + **TEMA READ-ONLY** no header (`.pr-tema` via rteInlineDisplay;
"(sem tema)" se vazio) → label "Legenda" + **RTE Golden real** (`rteField 'prod|i|legenda'`,
placeholder "Escreva a legenda deste conteúdo…"; toolbar só no foco — contrato F7C) → `.pr-arts`
(grid 2 col) com `artBox` Feed e Story: label "Feed · 1080 × 1440"/"Story · 1080 × 1920";
vazio = `.pr-drop` tracejado "Anexar Feed/Story" (label + input file oculto `accept="image/*"` —
**só clique; SEM drag-and-drop/clipboard/progress**); anexado = `.pr-thumb` (img cover,
**aspect-ratio CSS real 1080/1440 e 1080/1920**) + **X remover** (`data-prodclear`); SEMPRE input
`.pr-url` "ou cole a URL da arte…" (**alternativa real por URL**). Upload real = **ImageKit**
(`ikUpload`, folder `/cronogramas/{taskId}`, useUniqueFileName); loading/erro por **toast**:
"Enviando arte…" / "Arte anexada." / "Falha no upload. Cole a URL da arte como alternativa.".

**Footer real (3 ações literais):** "Cancelar" (ghost) · "**Salvar**" (ghost + check, contextual) ·
"**Salvar e reenviar ao cliente**" (primária `.sp-go`). **SALVAR ≠ ENVIAR (provado):** Salvar grava
`cronContents` + pendências recalculadas (`pendingLegend/Feed/Story`) + `pendingSocialReview` +
history `social_producao`, fecha o modal e toast "Produção salva. Reflete no link do cliente.";
"Salvar e reenviar" TAMBÉM só **prepara** (`cronStatus:'ready_for_final_client_review'`,
`finalApprovalRequired`, `clientApprovalPhase:'final'` — **sem afirmar envio**, H13: o evento de
envio só é gravado na confirmação real via Worker) e **abre openSendClientModal**. Fecha otimista e
grava async (sem loading/disabled nos botões). Salvar NUNCA conclui: pendências bloqueiam
`isFullyComplete` (entrega do designer ≠ conclusão). Modal é **interno** (zero ações de cliente).

**Estado demonstrado (1, rico):** conteúdo 1 parcialmente preenchido — tema read-only, legenda
preenchida (RTE sem foco), **Feed anexado** (arte sintética CSS + X + URL fictícia
`https://exemplo.cdn/...`) e **Story vazio** (drop tracejado + URL placeholder); scrollbar da lista
indica o conteúdo 2 abaixo (estrutura de pilha real; card 2 existe no DOM, clipado pelo scroll).

**DÍVIDAS/REGISTROS (não corrigir):** dimensões 1080×1440/1080×1920 são **orientação editorial**
(aspect-ratio visual; **nenhuma validação funcional** de dimensão/tamanho — só `accept="image/*"`);
upload sem progress (toasts); botões de salvar **sem disabled/loading** (double-submit possível —
fecha antes do await); `.pr-url` aceita qualquer texto (sem validação de host); sem estado por
conteúdo (completo/incompleto) DENTRO do modal — as pendências vivem na tarefa (F6 mostra).

**Adaptações de apresentação (documentadas):** backdrop real .62 → véu 46% + blur 3px (real)
calibrado ao tema claro; gradiente de envio do `.sp-go` (azul→teal→verde real) → **CTA primário
Golden** (`--grad`) conforme contrato PRIMARY do DS; sombras/raio pelo DS. Estrutura, ordem e
literais 100% reais; arte demo 100% sintética (nenhuma foto/material de cliente/URL real).

**C1 reutilizados:** RTE Golden (F7C), labels uppercase de micro-seção, hairlines, surface-2 card,
CTA primário gradiente, ghost buttons, radius/sombras/tipografia. **Novos candidatos (§15):**
modal/dialog + backdrop, sticky-footer de modal (adaptação visual), file drop tracejado, image
thumbnail com aspect-ratio real, remove-file chip, URL fallback input, scrollbar de lista interna.

## FRAME 12 — LOGIN (candidata) · `proposta-c-frame12-login.html`
**Status:** Frames 1–11 GOLDEN. FRAME 12 aplica o DS Golden à superfície REAL de autenticação —
NÃO é landing/marketing/onboarding; NÃO cria novo sistema de auth. **Não declarado Golden.**

**Auditoria read-only (1.0.246): renderer (renderLogin 3151, doLogin 2929, logout 3035, boot
F3.5.4V-H1 12695, static #login 2686, CSS 70–128) + main (auth.ts, auth-core.ts, preload.ts,
main.ts 661–688).**

**Arquitetura real (P0, pertence ao relatório — não à UI):**
- Login **SERVER-SIDE via processo main**: renderer chama `desktopAPI.authLogin(identifier,password)`
  (contextBridge) → IPC `auth-login` → auth-core → **POST `loginUser`** (Cloud Run,
  `{identifier,password}`). Servidor faz match **e-mail OU telefone**, valida senha, barra
  pendente/removido/excluído (`user_inactive`) e aplica **rate-limit**. Renderer **não** lê a coleção
  `users`, **não** vê pass/salt/hash, **não** verifica senha; recebe SÓ `{ok,user público,error}`.
- **Token confinado ao main**: memória + `userData/session.json` (mode 0600, escrita atômica
  tmp+rename). NUNCA vai a renderer/localStorage/log. `contextIsolation:true`, `nodeIntegration:false`.
- **Boot** = máquina de estados com **SPLASH "Restaurando sessão…"** como padrão; `authSelf`
  (POST `getUserSelf` Bearer) restaura; login SÓ em negativa real (`no_session`/`expired`,
  401 JSON **confirmado 2×**) ou escape manual ("Entrar manualmente" após 3 tentativas). Erro de
  rede mantém splash + retry backoff 3s→60s (offline ≠ logout). Auto-login legítimo = essa restauração.
- **Logout** = `authLogout` (main **apaga session.json**, provado por diag `wipe`) + limpa
  `wp_uid`/`wp_name`/`wp_team_jwt` + unsubscribe snapshots → reabrir pede login. **Fechar no X =
  bandeja** (`window.close→hide(tray)`), ≠ logout. Pós-login: `startApp` → tab inicial **'hoje'**,
  `subscribeData` (roster via **usersPublic** allowlist), render, `sessionLogin` (presença).

**Estrutura visual real (literais exatos):** standalone **sem shell** (sem sidebar/topbar/SLA/sino);
brand (logo oficial PNG + h1 "ID Seven" + sub "Desktop · Paridade APK") → título "Entrar" →
subtítulo "Acesse sua agenda e tarefas da equipe" → `#loginBanner` (vazio no default) → form:
label+placeholder **"E-mail ou WhatsApp"** (`inputmode=email`) · **"Senha"** (`type=password`,
toggle TEXTUAL **"Mostrar"/"Ocultar"** dentro do campo — não é ícone) · CTA **"Entrar"** ·
txtbtn **"Esqueci minha senha"** · nota **"Cadastro interno desativado. Solicite acesso ao
administrador."** → vfooter (pill "Desktop" + "ID Seven", **sem número de versão**). Sem
"Lembrar-me"/social/biometria/QR/PIN/SSO/captcha/2FA/criar conta (não existem). **Erro real =
banner form-level** (`.banner.err`) em `#loginBanner`; literais: "E-mail/WhatsApp ou senha
incorretos." / "Conta inativa ou aguardando aprovação." / "Muitas tentativas. Aguarde alguns
minutos e tente de novo." / "Preencha e-mail/WhatsApp e senha." / "Sem conexão com o servidor de
login...". **Loading real**: botão disabled + spinner substitui o texto. Responsivo real:
`@media(max-height:660px)` compacta p/ 1366×768 @125% sem scroll.

**Estado demonstrado:** pronto para entrada — identifier preenchido com conta FICTÍCIA
`teste@idseven.com.br` + **foco Golden C1** (ring #6E5EF3 + halo 11% + caret); senha mascarada
(glifos "•" — nenhuma senha real/documentada); toggle "Mostrar"; sem banner (default).

**DÍVIDAS FUNCIONAIS registradas (precedente Subtipo; NÃO corrigir):**
1. **RECOVERY = STUB nesta build**: o link "Esqueci minha senha" e as telas forgot (e-mail →
   código 6 dígitos + nova senha) EXISTEM, mas "Enviar código"/"Criar nova senha" **não chamam
   endpoint** — banners literais dizem que o backend de reset (Cloud Functions de produção) "não é
   tocado nesta prévia/homologação. Use sua senha atual para entrar." Link real; fluxo além dele =
   placeholder deliberado.
2. **Enter NÃO submete o login**: `#loginForm` é `<div>` (sem `<form>`/keydown no login principal;
   só o modal de team-session tem Enter). Dívida de teclado/a11y.
3. **`wp_team_jwt` em localStorage**: JWT de EQUIPE escopado (Worker `/team/session`, TTL 12h,
   emitido pós-login com a senha usada SÓ nessa chamada HTTPS) — deliberado/documentado; NÃO é o
   token de sessão do auth. Registro de arquitetura, não bug.

**Adaptações de apresentação (documentadas):** campos reais ficam soltos no fundo escuro → no
Light UI a coluna vira **card Golden** branco (sh-2, 464px) sobre canvas com véu radial ≤4%
(precedente F8/F10/F11). Marca: real usa o PNG oficial (base64 `--logo`); mockup usa o
**brand-mark Golden** dos Frames 1–11 (asset binário não copiado). h1 real é accent → DS usa tx-1;
labels reais uppercase 11px → C1 Golden 13/600 sentence-case (literais preservados).

**C1 reutilizados:** text input h46/r12/ring #DFE3EB, label 13/600, focus #6E5EF3+halo, primary
CTA gradiente h48/r13 (único por tela), link/txt action, radius/sombras/tipografia Golden.
**Novos candidatos (§14):** password input + reveal textual, form-level error banner (err/ok),
auth card standalone, brand block, version footer pill, splash de restauração (documentado).
**Status:** Frames 1–10 GOLDEN. FRAME 11 aplica o DS Golden à superfície RELATÓRIOS real
(`renderReports` 5600) — NÃO é BI/dashboard novo. **Não declarado Golden** (decisão do owner).

**Auditoria read-only dupla (leitura direta + auditor paralelo, 1.0.246):**
- Rota `state.tab==='relatorios'` → `renderReports` em #content (shell global). **GATE = igual ao
  Executivo:** `priTabVisible` só oculta 'prioridades'; 'relatorios' está SEMPRE na nav — sem gate de
  admin. Escopo por `visibleTasks(u)` (canSeeAll → tudo). Arydyjany CEO·admin ⇒ total. READ-ONLY **e
  EXPORTÁVEL** (download LOCAL; não grava Firestore).
- **Diferença Executivo × Relatórios (provada):** Executivo = snapshot AO VIVO (o que precisa de ação
  agora). Relatórios = ANÁLISE DE ATRASO no período + EXPORTAÇÃO. Fonte = `slaExecReports` (5567) que
  REUSA `slaExecAggregate` + deriva `execPeriodBuckets`/reincidentes/histórico/taskRows.
- **Pipeline real:** `reportsFilter` (execApplyFilters + soAtrasados + concluidas) → `slaExecAggregate`
  → KPIs (`atrasoMedio` = média overdueMin; `pctNoPrazo` = conclNoPrazo/concl; `reincidentes` = tasks
  lc≥2; `criticas` = totais.critico).
- **Toolbar:** período segmentado (Hoje/7 dias/30 dias/Tudo) + 5 selects (Designer/Cliente/Tipo/Status
  SLA + **Conclusão** Todas/Só concluídas/Não concluídas) + toggle **"Só atrasados"** (`rep-tg`, OFF por
  padrão) + **Exportar CSV / Exportar JSON** (`rep-exp`). Export real = `execDownload` (Blob/browser):
  `relatorio-atraso-AAAA-MM-DD.csv` (`;` UTF-8 de `R.taskRows`) e `.json` (objeto completo). SEM
  IPC/Electron/Firestore/PDF/XLSX/imprimir/e-mail/agendar.
- **Componentes reais:** 4 KPIs (execKpi) · **"Atrasos por período" = GRÁFICO DE BARRAS** (`rep-pbars`;
  `execPeriodBuckets` conta OVERDUE por dia do PRAZO final; cor ≥4 vermelho / ≥2 laranja / senão azul;
  label MM-DD via `day.slice(5)`) · "Atrasos por designer" (tabela `execDesRow`) · laterais
  cliente/tipo (mini-list) · "Tarefas críticas" + "Reincidentes em atraso" (mini-list) · **"Histórico
  resumido por tarefa"** (tabela + **linha do tempo de SLA** `rep-tl`, passos coloridos por
  `repStepColor`). Empty real "Sem dados no período" (não é o caso).

**DÍVIDA FUNCIONAL registrada (precedente "Subtipo", NÃO corrigir no mockup):**
1. **NOVA (do próprio renderReports):** a tabela "Atrasos por designer" tem `<thead>` de **5 colunas**
   (Designer/Atrasadas/Críticas/Atraso méd./% no prazo) mas reusa `execDesRow`, que emite **7 células**
   (Designer/Carga/%noPrazo/Lar/Atr/Crít/Atraso méd) → **desalinhamento header×linha em produção.** O
   mockup mostra as **7 colunas REAIS** que as linhas contêm (contrato Golden do F10) e registra o
   header de 5 como dívida.
2. **Herdadas do F10:** `criticasRecentes` inclui overdue NÃO-crítico (por isso o card "Tarefas
   críticas", com sub real "atraso > 10 min", lista itens de 9 e 7 min — dívida fielmente exposta);
   bases de contagem `ativas` × `d.state`.

**Coerência matemática do cenário (fictício; estrutura/fórmulas reais; totais FECHAM):**
- Designers: Felipe (carga 15, lar 1, atr 2, crít 1, méd 9, %82 azul) + Boaz (12, 2, 1, 1, méd 16, %69
  laranja) + Marina (8, 0, 1, 0, méd 5, %93 verde). Somas: laranja 3, atras 4, crít 2 ⇒ **overdue 6**.
- `atrasoMedio` = round((24+15+9+7+5+4)/6) = round(64/6) = **11 min**. Por designer: Felipe
  (15+9+4)/3=9; Boaz (24+7)/2=15,5→16; Marina 5. `pctNoPrazo` global = round(42/52)=**81%**.
- Cliente (soma atras = overdue 6, crít = 2): Sunset(3;2crít)+GreenLife(2)+Bold(1). Tipo (soma 6):
  Cronograma3+Ed.vídeos2+Ed.Cards1. **Barras** (overdue por dia do prazo) somam **6** = overdue.
  Reincidentes 3 (lc≥2), Críticas 2 (>10 min). Tudo fecha.

**Composição (adaptação de apresentação — precedente F8/F10):** o `renderReports` real é 1 coluna com
scroll; para caber em **1920×1080 sem scroll inventado** os cards são reagrupados em **masonry
widescreen** (esquerda 1.52fr = gráfico + tabela de designer + histórico; direita 1fr = cliente + tipo
+ críticas + reincidentes). Conteúdo dos cards é 100% fiel; só o arranjo se adapta. "Tarefas críticas"
mostra **4 de 6** overdue por espaço (decisão de mockup, não rótulo de UI). Cabe no viewport; rodapé
disclaimer visível.

**C1 / novos candidatos (§13):** bar chart time-series (`rep-pbars`), SLA timeline row (`rep-tl` +
`repStepColor`), toggle chip (`rep-tg`, OFF/ON), export contextual action (`rep-exp` — verde,
secundária, NÃO compete com CTA), grid de KPI 4-col. Reutiliza (F10) KPI card, dense data table, pct
cell, sev pill, mini-list, select, período segmentado. Fotos: fallback real de iniciais (FT/BM/MA).

## FRAME 10 — EXECUTIVO (candidata) · `proposta-c-frame10-executivo.html`
**Status:** Frames 1–9 GOLDEN. FRAME 10 aplica o DS Golden ao Painel Executivo REAL
(renderExecPanel 5523) — NÃO é dashboard inventado.

**Auditoria read-only dupla (leitura direta + auditor paralelo, 1.0.246):**
- Rota `state.tab==='exec'` → renderExecPanel em #content (shell global). **GATE:** priTabVisible só
  oculta 'prioridades'; 'exec' está SEMPRE na nav — **sem gate de admin/CEO na aba**. O acesso real
  é por ESCOPO de dados: `visibleTasks(u)` (canSeeAll = ADMIN/MANAGER → lista inteira; operacional →
  só suas tarefas). Arydyjany CEO·admin ⇒ agregado total. Tela READ-ONLY.
- Título "Painel Executivo" + "SLA & Produtividade · tempo real · read-only". Período segmentado
  (Hoje/7 dias/30 dias/Tudo) + 4 selects (Designer/Cliente/Tipo/Status SLA). Fonte = state.tasks
  via slaExecAggregate (resolveTaskDisplayState/isTaskCompleted/designerSla). Só tasks — nada de
  receita/NPS/health/metas/forecast.
- KPIs reais (execKpi): Ativas · No prazo (+%) · Alerta laranja · Atrasadas · Críticas. Distribuição
  (execDistBar). Ranking de designers (tabela execDesRow: Designer/Carga/%noPrazo[execPctCell]/Lar./
  Atr./Crít.[pills]/Atraso méd.; ordem por execRiskScore=crít*3+atr*2+lar). Clientes críticos /
  Tipos com mais atraso / Próximos vencimentos / Tarefas críticas recentes (execMiniList). Alert
  real se critico>0. Empty real "Sem dados no período" (não é o caso). Ações = só período+filtros
  (re-render); sem exportar (isso é F11 Relatórios).
- Setores ATIVOS reais (Cronograma, Edição de vídeos); designers reais (Felipe, Boaz). Cores por
  severidade (execSevHex) remapeadas ao Light UI (azul/laranja/vermelho/crítico distintos).

**DÍVIDA FUNCIONAL registrada (precedente "Subtipo", não corrigir no mockup):** no código real
`ativas` conta `hasSla && !done`, enquanto `prazo/laranja/atras/critico` contam por `d.state` sobre
TODA a lista — bases de contagem diferentes; o hint "% do total" (prazo/ativas) mistura as bases e
pode não fechar/passar de 100%. Também: `criticasRecentes` inclui overdue NÃO-crítico (nome
enganoso). O cenário do mockup é um snapshot VÁLIDO onde as bases coincidem (24 = 16+3+3+2), sem
contradizer o código.

**Coerência matemática do cenário (fictício; estrutura/fórmulas reais):** ativas 24 = 16+3+3+2;
%noPrazo = round(16/24)=67%. Designers somam: carga 14+10=24, laranja 1+2=3, atras 2+1=3, crít
1+1=2. Overdue total 5 = Sunset(3,1crít)+GreenLife(2,1crít) = Cronograma3+Ed.vídeos2. Críticas =
atraso >10min (22/14); atrasadas ≤10min (8/5). Todos os totais fecham.

**Composição:** shell + header globais Golden (título "Painel Executivo" + subtítulo live; SLA +
sino). Coluna centrada (real exec-wrap 1340). Toolbar (período segmentado + 4 selects) + alerta +
5 KPIs + distribuição + grid(ranking 1fr | laterais 400px) + grid2(vencimentos | críticas critbox)
+ rodapé disclaimer. Cabe no viewport sem scroll. Cor = accent (bar/pill/dot), nunca card pintado.

**C1 / novos contratos REAIS validados aqui:** KPI/metric card (accent bar + valor editorial +
hint), distribution bar + legend, **data table** (numeric alignment, header, pills), pct progress
cell, sev pill, ranking row, mini-list k/v, executive alert banner, period segmented (reforça F8).
Reutiliza select, avatares, tipografia, ícones. Fotos: fallback real de iniciais.

## FRAME 9 — NOTIFICAÇÕES · CENTRAL (candidata) · `proposta-c-frame9-notificacoes.html`
**Status:** Frames 1–8 GOLDEN. FRAME 9 aplica o DS Golden à Central de Notificações REAL
(renderNotifCentral 5734) — próxima superfície do Master Surface Map.

**Auditoria read-only dupla (leitura direta + auditor paralelo p/ CSS, 1.0.246):**
- Rota `state.tab==='notificacoes'` → renderNotifCentral em #content (shell global). Tela ADITIVA,
  100% LOCAL/READ-SIDE. **FONTE = localStorage 'idseven.notif.history.v1'** (NÃO Firestore, NÃO
  web push, NÃO o modal SLA, NÃO o toast) — HISTÓRICO deduplicado (dedupKey) de tudo que
  notificou, "mesmo depois que o toast some"; retenção 300 itens/30 dias. Rodapé literal.
- Campos: eventId, eventType, taskId, taskTitle, clientName, actor/responsible Name+Avatar,
  etapa, status, title, subtitle, body, context, severity, createdAt, deep (='detail/'+taskId),
  read (booleano).
- Header real: sino + "Notificações" + "Central e histórico · local" + badge "N não lidas" +
  "Marcar todas" (check) + "Limpar histórico" (trash danger, confirm() local). Toolbar (só com
  itens): busca "Buscar por título, tarefa ou cliente…" + 4 SELECTS (Tipo Atribuição/Fluxo/SLA/
  Sistema · Severidade Crítico/Atenção/Sucesso/Info · Designer · Cliente). Agrupamento por dia
  (ncDayLabel: Hoje/Ontem/DD-MM-AAAA).
- TIPOS (notifTypeLabel): SLA (sla_*/operational_block) · Fluxo (flow_*) · Atribuição (assign) ·
  Sistema (resto). SEVERIDADES (ncSev, faixa lateral): critical/warning/success/info/default.
  Selo CRÍTICO só em critical+sla_critical|operational_block. ncRow: faixa severidade + avatar 40
  (responsável ou ator) + [badge tipo + título + CRÍTICO] + subtítulo (subtitle | cliente·tarefa)
  + contexto (cor da severidade) + [hora HH:MM + dot não-lida + "Abrir tarefa →" se deep].
- UNREAD = !read (booleano); contagem notifHistoryUnread. Clique na linha = marca lida + abre
  DETALHE INLINE (notifDetailId) + atualiza badge; "Abrir tarefa" (deep) → Detalhes da tarefa
  (F6). Sino do header + badge da nav "Notificações" = mesma contagem (o sino é shell Golden, não
  redesenhado). EMPTY real ("Nenhuma notificação por aqui" / "Nada encontrado") documentado, não
  é o cenário. Sem loading/skeleton/erro observáveis (captura passiva).

**Composição:** shell + header globais Golden (título "Notificações" + "Central e histórico ·
local"; SLA + sino do shell; badge do sino e da nav = 4). Coluna focada tipo "inbox" (~1200
centrada — o real é nc-wrap max-width 1040 centrado; mantida a coluna legível, laterais = canvas
limpo). Linha de ações (4 não lidas · Marcar todas · Limpar histórico) + toolbar (busca + 4
selects) + lista agrupada Hoje (6: 4 não lidas + 2 lidas) / Ontem (4 lidas) + rodapé disclaimer.
Cor = accent (faixa de severidade + badge de tipo + dot), nunca card inteiro pintado; não-lida =
surface branca + sombra + título 700 + dot; lida = surface-2 + 600 tx-2 (legível, ≠ disabled).

**C1 / novos contratos REAIS validados aqui:** SELECT nativo estilizado (nc-fl: h44, chevron,
hairline) · notification list row (faixa+avatar+tipo+título+sub+contexto+hora+dot+deep) ·
unread/read · bulk actions (Marcar todas / Limpar histórico) · destructive action (Limpar) ·
agrupamento por dia · empty state (documentado). Reutiliza busca/ícones/avatares/tipografia.
Decisões de formatação: nenhuma alteração de função; dados fictícios, tipos/comportamento reais.
Fotos: fallback real de iniciais.

## FRAME 8 — AGENDA (candidata) · `proposta-c-frame8-agenda.html`
**Status:** Frames 1–7 GOLDEN. FRAME 8 aplica o DS Golden à superfície AGENDA REAL (renderAgenda
6084) — próxima superfície do Master Surface Map (P0).

**Auditoria read-only (renderAgenda + eventCard + calendarGrid + openEventDetail, 1.0.246; +
auditor paralelo p/ CSS/detalhe):**
- Rota `state.tab==='agenda'` → renderAgenda em #content (shell global, sem subnav própria,
  board-mode removido). Dados = state.events (Firestore 'events', tempo real). Campos: type,
  title, client, location, date, start/end, ownerId, by, notes, status, done/startedAt/cancelledAt.
- Duas vistas reais: **Mês** (calendarGrid 6×7 + lista do dia selecionado) e **Agenda/lista**
  (buckets Atrasados/Hoje/Próximos). Frame retrata a vista MÊS (padrão agView='month').
- Toolbar real: toggle Mês/Agenda · busca "Buscar compromisso…" (filtra title+client) · "Novo
  compromisso" (primária real) · "Mostrar cancelados" (toggle) · chips de TIPO Todos+TYPES
  (Gravação #EF4444 · Fotografia #F59E0B · Reunião #60A5FA · Edição #A78BFA · Outro #9CA3AF) ·
  nav de mês (Hoje/‹/›).
- calendarGrid: 42 células (semana começa DOMINGO), até 4 dots por dia na cor do TIPO; estados
  agcell dim/today/sel. Ago/2026 (dia 1 = sábado; dia 17 = segunda = hoje = selecionado — real:
  agSel nasce = hoje). eventCard: faixa = cor do RESPONSÁVEL (identity; vermelho se atrasado) +
  data (DOW/dd/MÊS) + hora start—end + status pill (Agendado #60A5FA / Em andamento #F59E0B /
  Finalizado #34D399 / Cancelado #F87171 com dot) + título line-clamp 2 + cliente (person) +
  local (place) + rodapé avatar+nome+TAG do tipo.
- Interação real: clicar no card → openEventDetail (MODAL centrado, não drawer — tipo/status/
  quando/grid Cliente-Local-Responsável-Criado por-Tipo-Status/Observações/Linha do tempo/ações
  Iniciar·Finalizar·Cancelar·Editar·Excluir-admin). Clicar em dia → agSel. ‹/› → mês. O modal
  NÃO é renderizado (superfície limpa; contrato próprio = C2 Modais). Empty state real:
  emptyState('calendar','Dia livre','…') — não é o caso.

**Composição:** shell + header globais Golden (título "Agenda" + "Compromissos da equipe · em
tempo real"; SLA + sino do shell congelado). Toolbar (segmented Mês/Agenda · busca · Novo
compromisso primário) + linha de filtros de tipo + Mostrar cancelados. Corpo **widescreen** = os
DOIS componentes reais lado a lado: calendário (1fr, mês Agosto/2026 com nav Hoje/‹/›, DOW, grid
6×7 com dots, hoje/selecionado) | painel do dia (424px, "Segunda, 17 de agosto · 3 compromissos"
+ 3 eventCards reais). O real é coluna única empilhada — arranjo lado a lado é decisão de
apresentação p/ widescreen (mesma lógica/dados/ordenação; já aprovada nos F6/7B).

**C1 / novos candidatos a foundation validados pela Agenda REAL:** segmented view switcher
(Mês/Agenda), calendar grid cell (default/dim/today/selected + dots), event/list card (rail=
responsável, data, hora, status pill, tipo tag), busca com ícone leading, chips de tipo com dot,
empty state (documentado, não renderizado). Reutiliza input/chips/primário/avatares/ícones Golden.

**Decisões de formatação (registradas, sem alterar função):** header do dia usa o dia da semana
por extenso ("Segunda, 17 de agosto") por legibilidade editorial — o real `.sect` usa dayShort
abreviado ("seg, 17 de agosto"); mesmo dado, escolha de formatação. Fotos: fallback real de
iniciais.

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

## FRAME 7D — NOVA TAREFA · ETAPA 4 REVISÃO (candidata) · `proposta-c-frame7d-novatarefa-revisao.html`
**Status dos anteriores:** 7A, 7B V2 e 7C = **GOLDEN / CONGELADOS**. 7D fecha o wizard com a etapa
Revisão REAL do Cronograma (checkpoint da C1 vem depois, com o owner).

**Auditoria read-only (stepReview 11503 + saveTask 11841, 1.0.246):**
- rev-head: badge do setor + "Revisão da tarefa" + "Confira os dados abaixo antes de criar a
  tarefa." (literais). rev-card: nome + cliente (svg place) + chips [status stOf('afazer')="A
  Fazer" #9BA0AB **dotc — formato REAL do review, não o check-chip do 7B** · priority false →
  "Prioridade normal" soft (não disabled) · sub.label "12 conteúdos" soft] + rev-grid revItem
  (Início · Término · Prazo final · Setor · "Subtipo"="12 conteúdos" — rótulo legado REAL) +
  rev-resp (avatar + "Responsável" + Tatiana Gomes + Social media + botão REAL "Editar",
  data-formgoto=resp).
- CONTEÚDOS: rev-sec-h + rev-count = filled.length+" / "+contentCount = "2 / 12" (SÓ preenchidos,
  filter tema||legenda); rev-content = número + tema (rteInlineDisplay, negrito real) + legenda.
  Vazios não aparecem; nenhum preenchido → emptyline. rev-quick "Editar dados"/"Editar briefing"
  (data-formgoto 1/2).
- NÃO aparecem na revisão (e não inventados): Período de referência, Canais (só no Briefing —
  f.fields não é lido em stepReview); Link/Observações/checklist (cronograma não tem).
- **"Enviar para o cliente" — REAL** (canSendToClient TRUE aqui: cronograma + cliente + ≥1
  conteúdo + canSeeAll/admin): bloco rev-send no CORPO (abaixo do quick-edit), botão full-width
  com gradiente próprio real (#5B6CFF→#22D3EE→#10B981, semântica WhatsApp) + hint literal.
  **Divergência vs a lista "NÃO INVENTAR" reportada ao owner e resolvida: INCLUIR fiel** — a regra
  proíbe FABRICAR função inexistente, não autoriza esconder função real; não é o CTA principal.
- BOTÃO FINAL (footer-nav): step 3 ⇒ "Salvar tarefa" (_saveLbl). Footer = "Voltar" (ghost) +
  "Salvar tarefa" (primário, gradiente Golden). SAVE real (saveTask): anti-duplo-clique f._saving,
  validações finais por alert, read-back, sucesso → volta ao quadro do setor SEM toast/detalhe
  automático; erro por alert mantém o form aberto. Estado saving do rev-send existe mas não
  renderizado (frame = estado ANTES do clique, conforme mandato).

**Composição:** estrutura 7A/7B/7C congelada (âncora, card 920, stepper com 3 CONCLUÍDAS +
Revisão ATUAL, footer). Continuidade: Cronograma de Setembro · Sunset Wear · A Fazer · Prioridade
normal · 12 conteúdos · início/término/prazo · Tatiana Gomes · 2/12 conteúdos (Conteúdo 1 com
texto demonstrado no 7C; Conteúdo 2 tema). C1 checkpoint: read-only summary card, summary rows,
chips com dotc, ação Editar secundária, action block distinto (send). Cabe no viewport sem scroll
(overflow-y:auto real só rola quando excede — aqui não excede).

**V2 (correção cirúrgica de hierarquia — layout/estrutura preservados 100%):** único ajuste =
peso visual das ações. "Enviar para o cliente" rebaixado de CTA-forte (full-width, gradiente
#5B6CFF→#22D3EE→#10B981 + glow) para **SECONDARY CONTEXTUAL ACTION**: surface clara (tint
azul-ciano/verde ~7-8%), microborder #12B39A, ícone/texto em accent verde (#1E7A66/#12A08A), sem
glow, largura contida à esquerda — função/texto/ícone/hint/posição/gate canSendToClient
intactos. "Salvar tarefa" permanece o CTA primário Golden (gradiente roxo) no rodapé, sem
aumento. Hairline (rev-actions-sep) separa a zona de ações contextuais do rodapé. Microcontrato
C1 novo: PRIMARY ACTION (conclui a jornada, gradiente Golden) × SECONDARY CONTEXTUAL ACTION
(ação real no corpo, refinada, sem competir). Tudo o mais do 7D inalterado.

**Fixes de render:** símbolos i-place/i-grid/i-edit/i-send adicionados ao sprite; card alto
empurrava o rodapé p/ fora → espaçamentos compactados (stepper/body/footer/rev-*) até Voltar +
Salvar tarefa ficarem visíveis, sem scroll inventado. Fotos: fallback real de iniciais.

## FRAME 7C — NOVA TAREFA · ETAPA 3 BRIEFING (candidata) · `proposta-c-frame7c-novatarefa-briefing.html`
**Status dos anteriores:** 7A e 7B V2 = **GOLDEN / CONGELADOS**. 7C avança o mesmo wizard para o
Briefing REAL do Cronograma e expande a C1.

**Auditoria read-only dupla (leitura direta + 4 auditores paralelos, 1.0.246):**
- Ramo real do cronograma (stepBriefing 11443–11458): label "Quantidade de temas" + [−][N][+]
  real (vqty; − disabled quando ≤1; input number central, placeholder "Ex.: 10"); cronQtyOf:
  inteiro ≥1, teto CRON_QTY_MAX=500 (toast literal ao exceder); erro INLINE REAL cqErr
  ("Informe uma quantidade inteira igual ou superior a 1.", role=alert, hidden por padrão —
  aparece no commit inválido ou no Próximo sem quantidade, com foco de volta ao campo);
  REDUZIR quantidade com conteúdos preenchidos abre modal real de confirmação de corte
  (openCronShrinkConfirm).
- curSub p/ cronograma = synthCronSub (subtipo SINTÉTICO, F3.5.5D): banner formTitle
  "Cronograma — 12 conteúdos" + fields sintéticos "Período de referência" (text, ph "Ex.:
  Junho/2026") e "Canais" (choice ÚNICA Instagram/Facebook/YouTube/WhatsApp) + contentCount=N.
- "Conteúdos do cronograma (12)" + N content-cards accordion REAIS: dot cinza/verde (fill =
  tema||legenda), "Conteúdo N", ▲/▼, UM aberto por vez (toggle data-content; default todos
  fechados e vazios); corpo com Tema/Legenda em rteField (EDITOR RICO real F3.5.5C) —
  TOOLBAR REAL reproduzida botão a botão (undo/redo · ¶▾ · A▾ · N/I/S/tachado/X₂/X² ·
  cor/marca-texto · listas · alinhamentos · recuos · link/hr/limpar) e VISÍVEL SÓ COM FOCO
  (.rte:focus-within — Tema focado com toolbar + ring C1; Legenda em repouso sem toolbar).
- Cronograma no Briefing NÃO tem: checklist (Reprovação 1.0.137), Link/anexo, Observações
  (gate !isClientSector), subtipo/Periodicidade, upload, select, checkbox, radio, maxlength,
  botão adicionar/remover conteúdo. Temas/legendas NÃO são obrigatórios ao avançar.
- Navegação: Voltar = apenas step−1 (estado preservado); Próximo com único gate = quantidade;
  scroll interno REAL (.scr overflow-y:auto) — peek honesto do Conteúdo 3 + scrollbar fina.

**Composição:** estrutura 7A/7B congelada (âncora, card 920, stepper com Setor+Dados CONCLUÍDAS
e Briefing ATUAL, footer Voltar/Próximo); cenário contínuo: 12 temas · Setembro/2026 ·
Instagram · Conteúdos 1–2 preenchidos, 1 aberto no editor. C1 ampliada: quantity stepper,
banner sintético, chips choice única, accordion com estado de preenchimento, editor rico
focado/repouso; contrato de erro inline sq-err documentado (não simulado — quantidade válida).

## FRAME 7B — NOVA TAREFA · ETAPA 2 DADOS (candidata) · `proposta-c-frame7b-novatarefa-dados.html`
**Status dos anteriores:** FRAME 7A · Setor = **APROVADO / GOLDEN** — estrutura do wizard
CONGELADA (container 920/radius 18/sh-2, stepper, header global, footer, âncora vertical,
sidebar, canvas). 7B troca apenas o miolo pela etapa Dados real e define a foundation
**C1 — Forms & Controls**.

**Auditoria read-only (stepDados 11342+, Cronograma/isCron):**
- Grupos e labels LITERAIS: Identificação ("Nome do cronograma" + placeholder real "Ex.:
  Cronograma de junho"; "Cliente / Empresa" + pill real "obrigatório" — clientRequired:true) ·
  Atribuição ("Responsável (opcional)" com assigneeField = botão-picker avatar+nome que abre o
  sheet "Responsável"; helper REAL: "Opcional nesta etapa. O designer final é definido depois,
  em 'Enviar ao designer' — é aí que começa o SLA do designer."; "Etapa" = chips STATUS reais
  A Fazer #9BA0AB · Em andamento #F59E0B · Revisão #60A5FA · Concluído #34D399) · Período do
  cronograma (Data/Hora de início, Data/Hora de término — pares reais) · Prazo final &
  prioridade (Data/Hora limite + switchrow real "Prioridade alta"/"Destaca a tarefa nos
  quadros").
- SEM subtipo na Dados (subtypes só no Briefing e NÃO p/ Cronograma — F3.5.5D usa quantidade);
  SEM select nativo; SEM quantidade nesta etapa (Briefing). Defaults reais do newForm:
  status:'afazer' (chip default), priority:false, datas vazias, assignee null.
- Validação REAL (stepNext f.step===1): "Para Cronograma o cliente é obrigatório." + "Informe o
  título." — alerts no clique; Próximo nunca desabilita e não há erro inline no real ⇒ nenhum
  erro inline inventado. Footer real da etapa 2: Voltar (ghost) + Próximo.

**Composição:** stepper com 3 estados (Setor CONCLUÍDA = check verde tint + kicker; Dados ATUAL
= gradiente; futuras hairline; conector percorrido verde) — check+label+peso, nunca só cor.
Corpo em 2 colunas de GRUPOS (esq 1–2, dir 3–4) preservando ordem/agrupamento reais (o real é
coluna única com scroll interno — decisão de apresentação p/ mostrar todos os controles; a
implementação pode manter coluna única). Preenchimento realista: "Cronograma de Setembro" ·
Sunset Wear · Tatiana Gomes · A Fazer · 01/09→30/09/2026 · limite 25/08 18:00 · Prioridade ON.
C1 definida: field label 13/600 tx-2 sentence-case; section 11/700 uppercase; input h46 r12
hairline #DFE3EB, valor 14/520; FOCUS demonstrado no "Nome do cronograma" (ring brand 1.5 +
halo 16%); data/hora com ícone leading 16 tx-3; picker de pessoa com avatar+chevron; chips com
dot na cor (acessível); toggle 46×28 ON=brand sólido (gradiente é só CTA); pill "obrigatório"
âmbar (padrão real); contratos error/disabled/transições documentados no cabeçalho.

**V2 (refinamento cirúrgico, layout preservado 100%):** (1) datas demonstrativas coerentes —
Data limite 30/09/2026 (= término; limite ≥ início); (2) chip selecionado afirmativo — check no
lugar do dot + ring 62% + tint 12% + microssombra (indicador de forma além da cor; "A Fazer" com
ink #3F4756); (3) default real `priority:false` — toggle OFF com trilho #CDD3DE + hairline
interna e knob branco sombreado (disponível, não disabled); (4) "(opcional)" em tx-3/12.5px;
(5) focus C1 refinado — border 1.5px #6E5EF3 (roxo Golden) + halo 2.5px 11%, sem neon;
(6) surface da Prioridade na família dos inputs (fundo branco + hairline #E4E8EF). Auditoria de
reconfirmação (12 pontos) OK sem divergência antes da edição.

**Fixes de render:** símbolo i-clock ausente no sprite herdado do 7A (horas sem ícone) →
adicionado; chips de Etapa quebravam em 2 linhas → compactados (h32/font 12/gaps) para 1 linha.
Fotos reais locais indisponíveis nesta sessão (recortes temporários perdidos com o container;
nunca versionados) — avatares com fallback REAL de iniciais do app.

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
