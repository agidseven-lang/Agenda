# LIGHT UI — I3H · F8 AGENDA — RELATÓRIO

**Fase:** I3H · F8 Agenda — Golden Frame 8 sobre a Agenda REAL
**Base congelada:** `c4c114e9` (F1–F7 GOLDEN/CONGELADAS) · **Branch:** `impl/light-ui-f8-agenda-1.0.246`
**Golden:** `proposta-c-frame8-agenda.html` (Frame 8 aprovado, Design Freeze `96fd7d3`)
**Versão:** 1.0.246 (inalterada) · **Status:** ENTREGUE — aguarda avaliação do owner. F9+ NÃO iniciada.

---

## A · Reauditoria literal (FASE 2 — 26 itens, antes de editar)

1. **Entry point real:** item "Agenda" da navegação (`[data-tab="agenda"]`; `TABS` k:'agenda') →
   `render()` → `renderAgenda()` + `afterAgenda()` (busca com preservação de caret).
2. **Render principal:** `renderAgenda` — estado literal `agView('month'|'list')`,
   `agCursor:Date`, `agSel` (YYYY-MM-DD), `agFilter('all'|type)`, `agQuery`,
   `agShowCancelled:false`.
3. **Fonte real dos eventos:** `state.events` ← `db.collection('events').onSnapshot`
   (coleção própria da Agenda, contrato EventContract/Android; **eventos NÃO derivam de
   tasks** — não há task linkage no schema; o vínculo real é com pessoas:
   `ownerId`/`by`).
4. **Tipos reais (`TYPES`):** gravacao `#EF4444` Gravação · foto `#F59E0B` Fotografia ·
   reuniao `#60A5FA` Reunião · edicao `#A78BFA` Edição · outro `#9CA3AF` Outro — as cores
   dos dots/badges do Golden são EXATAMENTE estas.
5. **Status real do evento:** `evStatus` (cancelled por status/cancelledAt → done →
   startedAt → scheduled) + `evStatusMeta` (Cancelado `#F87171` / Finalizado `#34D399` /
   Em andamento `#F59E0B` / Agendado `#60A5FA`) — os badges "Agendado/Em andamento" do
   Golden são o estado REAL.
6. **Card real (`eventCard` → `.evc`):** `role="button"` + `tabindex="0"` +
   `aria-label` descritivo (JÁ reais); `.evc2-rail` (userColor do responsável; `#F87171`
   se `eventLate`); `.evc2-date` (DOW/dia/MÊS + ano quando ≠ atual); `.evc2-time`
   (start—end via `evTimeOk`); `.evc2-st` (status tint); `.evc2-ti`; `.evc2-meta`
   cliente/local; `.evc2-foot` avatar+nome do owner + `.evc2-ty` (tipo tint). Enter/Espaço
   abrem o detalhe (handler global real de `.evc[data-evdetail]`).
7. **Agrupamento por data:** month = `agSel` (painel do dia, ordenado por `start`);
   list = buckets reais **Atrasados** (`date<hoje && !done`, `#F87171`) · **Hoje**
   (`#F59E0B`) · **Próximos** (`#34D399`) com counts e ordenação `(date+start)`.
8. **Calendário mensal real (`calendarGrid`):** 42 células (6 semanas, início DOMINGO:
   `start=1-firstD.getDay()`); `data-day` por célula; classes `agcell` /
   `agcell-dim` (fora do mês) / `agcell-today` / `agcell-sel`; **dots ≤4/dia** na cor do
   tipo; célula selecionada oculta os dots (comportamento real); datas comparadas como
   strings locais YYYY-MM-DD (mesma fonte `todayStr()` — timezone local consistente).
9. **Navegação temporal real:** `data-ag="prev|next|today"` (setMonth ±1; today
   restaura cursor E seleção).
10. **Filtros/busca reais:** `data-agf` (all + 5 tipos, seleção tint na cor);
    `#agSearch` (título+cliente, case-insensitive); "Mostrar/Ocultar cancelados"
    (`data-ag="togglecancel"` — cancelados ficam FORA por padrão e entram com pill).
11. **Criar/editar reais:** "Novo compromisso" (`data-ag="new"`) → `openEventForm`
    (sheet `ev-sheet` 720px: Título/Cliente/Tipo/Data/Início/Término/Local/Responsável/
    Observações; erro inline `#evErr`; anti-duplo-clique `dataset.busy`) → `saveEvent`:
    criação = `add({...content, by, done:false, createdAt, src:'webpreview'})`; edição =
    `update({...content, updatedAt, updatedBy})`.
12. **Detalhe real (`openEventDetail` → `.evd-sheet` 560px):** `role="dialog"` +
    `aria-modal` + nome acessível; X com `aria-label="Fechar detalhes"`; foco inicial no
    X + trap de Tab (`evdSetupModalFocus`) + Esc em camadas (menu → confirmação → detalhe
    → fecha) + retorno de foco ao card (`_detReturnEl`) — TODOS reais. Conteúdo: chips
    tipo/status, título, cliente, `evd-when` (data por extenso + horário + duração
    calculável), grid (Cliente/Local/Responsável/Criado por/Tipo/Status), Observações,
    Linha do tempo (Iniciado/Finalizado/Cancelado com ator), erro `role="alert"`.
13. **Ações reais gated por status/permissão (1.0.218):** Iniciar (scheduled) ·
    Finalizar (scheduled|in_progress) · Cancelar (scheduled|in_progress) · Editar
    (≠cancelled) · menu ⋯ com **Excluir definitivamente SÓ admin** (confirmação forte
    digitando EXCLUIR); writes: `evStart/evFinish/evCancel` (update de lifecycle) e
    `evDeletePermanent` (update deletedBy + delete físico).
14. **Empty states reais:** "Dia livre — Nenhum compromisso para esta data." (month) e
    "Sem compromissos" (list), via `emptyState`.
15. **Responsivo atual:** coluna única com scroll (`.scr`); sheets com max-width/height.
16. **RBAC:** admin = `state.user.admin` (delete); demais ações para todos os usuários
    autenticados (contrato real).

## B · Auditoria de dados / matriz Golden×Real (FASES 3–4)

17. **A (match real):** toggle Mês/Agenda; busca; "+ Novo compromisso"; filtros por tipo
    com as MESMAS cores; "Mostrar cancelados"; título "Mês Ano" + Hoje/‹/›; weekdays;
    grade com dim/hoje/selecionado; dots por tipo; painel do dia com data real
    (`dayShort`); cards de evento COMPLETOS (todos os campos reais — item 6); buckets da
    lista; empty states; detalhe premium e form reais.
18. **B (adaptação visual):** layout 2 colunas (calendário 1fr | painel do dia 416px)
    via wrappers ADITIVOS neutros (`.ag-tools`/`.ag-body`/`.ag-day` — divs sem estilo no
    legado, fluxo block idêntico, **provado 0px**); toolbar reordenada por CSS `order`
    (DOM real intacto); células retangulares min-height 92 com número ao topo (base
    real: aspect-ratio 1 centrado); hoje/selecionado no **gradiente do amendment**
    (`--lui-grad` — vence o roxo do protótipo, regra das fases); CTA "Novo compromisso"
    no gradiente (o markup real usa style inline → `!important` pontual, registrado: 9
    ocorrências na seção, todas contra inline styles reais).
19. **C (dado real derivável):** count do painel do dia ("N compromissos") =
    `dayEvs.length` real — span `.ag-count` **gated por `body.light-ui`** (legado gera
    HTML byte-idêntico).
20. **D (visual reference / function not available):** header de página do Golden
    (tile+“Agenda”+subtítulo+MONITOR SLA+sino) = shell/topbar (padrão D das fases
    F1–F7; o real usa o `.scr-head` com o título do MÊS + controles — mesma informação).
21. **E (conflito funcional):** NENHUM. Nenhum evento/cliente/responsável/horário/
    contador/tipo fabricado; calendário e comparações de data 100% do código real
    (nenhuma lógica de data alterada).

## C · Implementação (FASE 6 — escopo e guardas)

22. **Guardas estritas:** página = `body.light-ui.desktop #content:has([data-ag="vmonth"])`
    (o par de chips de visão só existe na Agenda — cobre month E list); form =
    `.sheet.ev-sheet` (classe exclusiva); detalhe = `.modal-back[data-evdmodal]`.
    **Verificação automática: 39 seletores novos, 100% escopados (26 página + 13
    modais); 0 regra global; balanço de chaves do bloco = 0.** Nenhuma superfície F1–F7
    é atingida; shell congelado intacto.
23. **Paleta pela receita aprovada** (override de custom properties no subtree) + skins
    pontuais: toolbar Golden (busca 44px flex-1; CTA gradiente; cancelados à direita;
    chips 34px com dot `currentColor` nos filtros); card do calendário branco r16;
    células claras com hover; hoje ring índigo; selecionado gradiente; painel do dia
    (`.sect` + `.ag-count`); cards `.evc` com sombra/hover suaves (o resto clareia via
    vars — evc2-* já consome tokens); form e detalhe claros com CTA/pri no gradiente;
    menu ⋯ claro; erro claro.
24. **Markup aditivo total:** 3 wrappers neutros + 1 span gated + `const _lui` — nada
    além; nenhuma função/handler/write alterado.

## D · Acessibilidade (FASE 10)

25. **Já reais (não tocados):** cards com `role="button"`/`tabindex=0`/`aria-label`
    descritivo + Enter/Espaço; detalhe `role="dialog"`/`aria-modal`/nome acessível; X
    com `aria-label`; trap de Tab; Esc em camadas; retorno de foco ao card; erro do
    detalhe com `role="alert"`; `.evc` já respeita `prefers-reduced-motion` no base.
26. **Adicionado (escopado):** reduced-motion nas microtransições da skin (células/
    chips/botões do detalhe). Nenhuma div virou button (os alvos reais já são
    button/role=button). "Hoje"/‹/› são `<button>` reais com hit target ≥38px na skin.
27. **Calendário sem depender só de cor:** hoje = ring + gradiente/segmentação
    posicional; selecionado = bloco sólido + número branco; dots acompanham painel
    textual do dia (data por extenso + cards com tipo em TEXTO).

## E · Harness e gates (FASE 12 — smoke 32/32 PASS)

28. Entry real pela navegação; mês inicial correto; **prev/next/Hoje** reais (título e
    seleção restaurados); 42 células; dots em dias reais (2 eventos = 2 dots);
    selecionado oculta dots (real); painel do dia com **4 cards reais ordenados por
    horário** (08:30|09:30|14:00|18:00) e count real "4 compromissos"; troca de dia por
    clique (2 eventos no mesmo dia); campos reais no card (cliente/local/responsável/
    tipo/status); empty "Dia livre"; **cancelado oculto por padrão e visível com pill
    após o toggle real**; filtro por tipo real (dots filtrados); busca real; lista com
    buckets Atrasados/Hoje/Próximos e 8 cards (9 − 1 cancelado); detalhe correto
    (`data-evdmodal` do evento clicado, campos, **primário por status real** — "Em
    andamento" → Finalizar); admin vê Excluir no ⋯ e **não-admin NÃO vê** (RBAC);
    fechar pelo X; **teclado: Enter abre com foco no X; Esc fecha; foco RETORNA ao
    card**; **zero mutation por navegar** (0 writes em toda a navegação);
    **writes stubados**: Iniciar = exatamente 1 `update` `{startedAt, startedBy:'t1'}`;
    criação pelo form real = exatamente 1 `add` com payload completo validado
    (`title/client/date/start/ownerId+owner/by/done:false/src:'webpreview'`); zero
    writes reais (file://, sem rede).

## F · Responsivo (FASE 11)

29. 1920: grid 2 colunas real `1140px + 416px` (gap 20) — 0 overflow. 1366: empilha
    (`1fr`, adaptação funcional justificada ≤1500px) — 0 overflow. **win125 1093×614
    css @1.25** — 0 overflow; toolbar reflui; CTAs visíveis; detalhe 560px e form 720px
    respeitam viewport (max-width/height reais).

## G · Comparação quantitativa (FASE 14 — ZERO ISSUE)

30. Medidas (1920, light-ui): largura útil do miolo 1576px (1140+416+20); h-title 27px/800;
    controles temporais 38px r11; célula min-height 92 r10 (gap 4); card do calendário
    r16 pad 18/14; evc r14 pad 12/14 (rail 3px; date-block 54px; título 14.5/700; time
    14.5 tabular); badges status/tipo tints reais; count pill 24px; busca 44px; CTA 44px
    r12 gradiente; detalhe 560px r18; form 720px; ritmo vertical da coluna direita
    10px entre cards. Zonas: MATCH (toolbar/filtros/grade/dots/hoje/painel/cards/
    detalhe) · ADAPTAÇÃO JUSTIFICADA (2 colunas por wrappers; células retangulares;
    gradiente do amendment; header de página → scr-head do mês) · **ISSUE: 0**.

## H · Regressão congelada e legado (FASE 15)

31. Base `c4c114e9` × atual, mesmo driver/modo/relógio: **F1 board+painel · F2
    board+painel · F3 board+painel · F4 board+painel · F5 board+painel · F6 Details
    default · F7 wizard (Setor + Dados)** = **0px em 12 dos 13 pares light-ui**; único diff = F5 painel na região EXATA do flake do sino (1443,29→1485,71) — política A–E cumprida DE NOVO: base×base divergiu sozinho na mesma região (A), cur×cur idem (B), 0px fora da região comprovada com máscara exata NÃO ampliada (E). *Known async bell flake.*
32. **Legado (sem body.light-ui):** Central aberta (F1 diffdet) dark/light/hc + board F5
    dark + **AGENDA dark/light/hc (com os wrappers novos)** = **0px puro em TODOS os 7 pares** — em especial a Agenda legada dark/light/hc com os wrappers novos (pixel-inertes comprovados) e a Central aberta nos 3 temas

## I · Fechamento (FASE 16)

33. Provas no chat (política: não versionar): F8-AGENDA-1920 (=MONTH) ·
    F8-AGENDA-LIST-1920 · F8-AGENDA-EVENT-DETAIL-1920 · F8-AGENDA-1366 ·
    F8-AGENDA-win125 · F8-AGENDA-A11Y-FOCUS · F8-COMPARE-GOLDEN-vs-APP.
34. **Git:** checkpoint único `1cf13637` (`feat(light-ui): port F8 agenda golden`) em
    `impl/light-ui-f8-agenda-1.0.246` + push; SEM PR/merge/build/tag/release; 1.0.246
    inalterada; Light UI inativa. Roadmap: I3G = ✔ GO · F7 = CONGELADO @ `c4c114e9` ·
    I3H = ENTREGUE — AGUARDA OWNER · F9+ = NÃO INICIADA. **F8 não é marcado congelado —
    quem congela é o owner.**

**HARD STOP.** F9+ não iniciadas. Aguarda GO explícito do owner.
