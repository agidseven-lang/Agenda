# LIGHT UI — I3G · F7 WIZARD — RELATÓRIO

**Fase:** I3G · F7 Wizard — Golden Frames 7A/7B V2/7C/7D V2 sobre o wizard REAL
**Base congelada:** `8e288c6b` (F1–F6 GOLDEN/CONGELADAS) · **Branch:** `impl/light-ui-f7-wizard-1.0.246`
**Golden:** `proposta-c-frame7{a,b,c,d}-novatarefa-*.html` + contrato `C1-FORMS-CONTROLS-CONTRACT.md`
**Versão:** 1.0.246 (inalterada) · **Status:** ENTREGUE — aguarda avaliação do owner. F8 NÃO iniciada.

---

## A · Reauditoria funcional literal (FASE 1 — antes de qualquer edição)

1. **Superfície real:** `renderForm()` — PÁGINA em `#content` (rota `state.form`), card central
   `.form-wrap` (desktop: `max-width:980px`, r18, scroll interno no `.scr`, `.footer-nav`
   sticky). NÃO é modal: **um único wizard compartilhado** para criação E edição (`f.id`).
2. **Entry points reais:** `.new-task-btn[data-fab]` (CTA da sidebar) · `.fab[data-fab]`
   (mobile) · `.kbv2-column-add[data-fab]` ("Adicionar tarefa" nas colunas kanban) — todos →
   `openNewTaskWizard()` (reset canônico F3.3.75A: sempre ETAPA 1/Setor, nunca reaproveita
   estado; solta o foco e zera o defer) · handler de navegação `a==='new'` → mesma função ·
   edição: Editar tarefa (`data-cardedit`, Edição de Cards) preenche `state.form` com `f.id`.
3. **Etapas REAIS: 4** — `STEPS=['Setor','Dados','Briefing','Revisão']` (stepper `.sc/.slab/
   .ln` com classes de estado `on/done`); navegação `data-form="close|back|next|save"` +
   atalhos da revisão `data-formgoto="1|2|resp"`.
4. **Etapa Setor (step 0):** `SECTORS.filter(!descontinuado)` → **Edição de vídeos
   (`edicao_midia` #60A5FA) · Cronograma (#34D399) · Edição de Cards (#F472B6)**;
   copywriting/roteiro/programacao_posts DESCONTINUADOS nunca aparecem; 'Edição de Cards'
   gated por `canCreateCards()` (= `canSeeAll`: Social/Admin — Designer NÃO vê).
5. **Etapa Dados (step 1)** por setor: Identificação (Título com `titleLabel` do template —
   cronograma = "Nome do cronograma" — + Cliente/Empresa com `clientRequired`);
   Atribuição (`assigneeField` → modal `openAssignee` com `data-pickasg`; designer
   OBRIGATÓRIO p/ Edição de vídeos e Cards; opcional no cronograma com hint literal do SLA);
   Etapa (chips `STATUS` reais A Fazer/Em andamento/Revisão/Concluído, `data-fstatus`);
   Período do cronograma / Prazo do Designer (pares data+hora `.dt-field` com `showPicker`);
   Prazo final & prioridade (Data/Hora limite + switch `.sw` "Prioridade alta"). Cards:
   Cliente + Quantidade (1..`CARDS_MAX_BATCH`=50; TRAVADA em 1 na edição) + Designer.
6. **Etapa Briefing (step 2)** por setor: cronograma = quantidade personalizada de temas
   (`[−][N][+]` `data-cqminus/cqplus` + `#fCronQty`, teto técnico 500, erro literal em
   `#cqErr[role=alert]`) + subtipo sintético `synthCronSub` com **fields reais** ("Período
   de referência" + "Canais" choice Instagram/Facebook/YouTube/WhatsApp) + N blocos
   `content-card` com editor rico `rteField` (tema/legenda); vídeos = `#fVideoQty` + N temas
   `data-vtema`; cards = N seções com Tema obrigatório + Início/Término (data+hora)
   obrigatórios por card; não-cliente = Link/anexo + Observações livres + checklist.
7. **Etapa Revisão (step 3):** `rev-head/rev-card/rev-chips/rev-grid(revItem)/rev-resp` +
   contador real `N / M` + `rev-quick` (Editar dados/briefing) + **"Enviar para o cliente"**
   gated por `canSendToClient(f)` (cronograma + cliente + ≥1 conteúdo + canSeeAll) com hint
   literal "Gera mensagem para WhatsApp com link de preview interno do cronograma." + CTA
   final "Salvar tarefa" / "Salvar alterações" / **"Criar N tarefas"** (lote de Cards).
8. **Validações reais (`stepNext`):** step0 sem setor → `alert('Escolha o setor.')`; step1
   `clientRequired` → alert literal; título → `alert('Informe o título.')`; cards step1/2 →
   alerts por campo (cliente/designer/quantidade/tema/início/término/término>início);
   cronograma step2 sem quantidade → `_cqErr` + `#cqErr` visível + foco no campo. Próximo
   NUNCA desabilita (contrato real); sem validação inline de título/cliente (só alert).
9. **Submit real (`saveTask`):** trava `_saving` anti-duplo-clique; consumo seguro de
   `_sendAfterSave`; validação defensiva repetida; payload canônico (31 chaves na criação de
   cronograma: title/client/sector/desc composto/status/assignee/link/priority/datas/
   checklist/by/createdAt/src + semente F3.5.6A `workflowPhase:'themes_preparation'`+
   `phaseRuns.pr01`+`externalWait:false` + `cronStatus:'rascunho_social'` +
   `clientFlowStatus:'afazer'` — criação NUNCA marca envio); `cronValidateSend` →
   `cronSanitizeDeep` → **`_draftId` estável** (retry não duplica) → `set()` → **read-back**
   → classificação de erro real; pós-save: board do setor. Cards: `saveCardsBatch` em
   `db.batch` atômico (N docs, sem SLA/portal); edição: `saveCardsEdit`/update.
10. **Fechar/Esc/foco (REAL):** X (`data-form="close"`) fecha direto (`state.form=null`,
    sem modal de confirmação — não inventado); **Esc NÃO fecha** (é página, não dialog — o
    handler global de Escape só atinge `[data-detmodal]`/`[data-evdmodal]`); sem trap de
    foco (não é modal); não há retorno de foco definido. Deep-link direto ao wizard não
    existe (aberturas via entry points acima).
11. **Guard 1.0.102 (`_editingNow`):** com um campo do form em foco, o re-render por
    snapshot é ADIADO (proteção real de digitação) — o driver respeita esse contrato
    (blur antes do change de quantidade, como o usuário real).

## B · Hard gate Golden×Real (FASE 2 — matriz por zona)

12. **A (match real):** 4 etapas/labels do stepper; 3 option-cards de setor com cores/
    descrições reais e seleção tint+✓; todos os rótulos da etapa Dados (inclusive "Nome do
    cronograma" e a pill "obrigatório"); chips de Etapa; pares data+hora com ícones;
    switch Prioridade alta com sublabel real; quantidade `[−][N][+]` com sufixo; banner
    `formTitle`; **"Período de referência"/"Canais"** (fields reais do `synthCronSub`);
    acordeões Conteúdo N com dot de preenchimento; toolbar do editor rico (real);
    Revisão completa (badge/título/sub/chips/grid/responsável+Editar/contador N/M/
    Editar dados/briefing/Enviar para o cliente + hint/Salvar tarefa); Voltar/Próximo.
13. **B (adaptação visual):** stepper premium C1 (número 30px, kicker "ETAPA ATUAL/
    CONCLUÍDA" derivado das classes reais `on/done` via CSS ::before); layout da etapa
    Dados em 2 colunas de GRUPOS (grid `:has(> .fgroup)` dense — ordem/agrupamento reais
    preservados; demais etapas seguem coluna única); grupos FLAT (sem card de fundo);
    chevron decorativo no picker de responsável; dot nos chips via ::before
    (background:currentColor — cor real do estado); CTA primário no **gradiente do
    amendment** (`--lui-grad` — vence o roxo do protótipo, regra das fases anteriores);
    largura do card 920px (Golden) sobre o max 980 real.
14. **C (dado real reapresentado):** kickers do stepper (estado das classes reais); dots
    de chips (cor corrente real).
15. **D (pertence a outra superfície):** header de página do Golden (back circular +
    "Etapa N de 4" + MONITOR SLA + sino) = shell/topbar real `display:none` (decisão de
    produto 1.0.140) — NÃO fabricado; título/subtítulo reais vivem no card (`.scr-head`).
16. **E (conflito funcional):** nenhum — nenhuma zona do Golden exige função inexistente.

## C · Exceções F7-Exx

17. **F7-E01** — Subtítulo do header do card mantém o TEXTO REAL (setor · cliente /
    "Selecione o setor"); o contador "Etapa N de 4" do Golden não existe no real e não foi
    fabricado (o estado da etapa já é transmitido pelo stepper real).
18. **F7-E02** — Topbar de página do Golden (back/MONITOR SLA/sino) fora do wizard; não
    fabricada (mesma linha das fases F1–F6).
19. **F7-E03** — Validação real permanece `alert()` nativo p/ setor/título/cliente (o C1
    prevê contrato de erro "futuro"; nada inventado). A prova de validação usa o ERRO
    INLINE REAL existente (`#cqErr role=alert` da quantidade, F3.5.5D).
20. **F7-E04** — X fecha sem confirmação e Esc não fecha (comportamentos reais da página;
    nenhum modal de confirmação/atalho novo foi criado).
21. **F7-E05** — Golden 7C mostra toolbar rica só no Tema; o real usa `rteField` em Tema E
    Legenda — mantido o real (função vence).
22. **F7-E06** — Modais secundários do fluxo pós-save (Enviar ao cliente) e demais modais
    compartilhados ficam FORA do escopo F7; os DOIS modais exclusivos do wizard
    (Responsável `[data-pickasg]`; confirmação de corte `[data-sqshrinkok]`) receberam skin
    clara com guarda por conteúdo único.

## D · Escopo e implementação (FASES 3–4)

23. **Guarda mais estreita:** `body.light-ui.desktop #app > .content > .form-wrap` (o
    wizard inteiro) + `body.light-ui.desktop .modal-back:has([data-pickasg])` e
    `:has([data-sqshrinkok])` (modais exclusivos). **Verificação automática: 66 seletores
    novos, 100% escopados (64 form-wrap + 2 modais); 0 regra global; balanço de chaves do
    bloco `light-ui-foundation` = 0.** Nenhum seletor toca F1–F6/shell/board/Central.
24. **Paleta via override de custom properties no subtree** (receita aprovada da I3F) +
    regras C1 pontuais: stepper premium; inputs `h46 r12` hairline `#DFE3EB` com foco ring
    `#6E5EF3` + halo; labels sentence-case 12.5/600; pill "obrigatório" âmbar; option-cards
    48px tile; chips h32 pill com dot; switch 46×28 track `#CDD3DE`/on `#5B7CFA`;
    acordeões claros; vqty 38px; `sq-err` vermelho-ink claro; revisão clara com "Enviar
    para o cliente" em verde tint; rodapé com Voltar ghost + CTA gradiente do amendment.
25. **Zero mudança de função:** nenhuma etapa/campo/opção/validação/CTA/rota criada ou
    removida; textos 100% reais; RBAC intacto; nenhum código trazido do branch de
    protótipos.

## E · Acessibilidade (FASE 5)

26. **Correção de markup pixel-inerte (REPORTADA):** 9 rótulos da etapa Dados trocados de
    `<div class="lbl">` para **`<label class="lbl" style="display:block" for="…">`**
    (fTitle, fClient, fStart, fStartT, fEnd, fEndT, fDue, fDueT, fCardsQty) — associação
    label/input REAL; `display:block` explícito preserva o box do div (provado 0px no
    legado dark/light/hc e nas superfícies congeladas).
27. **Já existiam (não tocados):** `aria-label` nos controles de quantidade e nos botões
    ±; `#cqErr/#sqErr` com `role="alert"`; `focus-visible` (outline `--accent`).
28. **Reduced motion:** microtransições do wizard desligadas sob
    `prefers-reduced-motion` (escopado).
29. **Nome acessível do "dialog": N/A** — o wizard real é página (não dialog); aria-modal
    não se aplica; trap/Esc/retorno de foco não existem no real e não foram inventados
    (F7-E04). Ordem de tab natural do documento preservada.

## F · Harness e gates (FASES 6–7)

30. **Driver `f7_driver.js`** (harness-only; produção zero fixture): stub firestore RICO —
    captura payload de `set/add/batch`, serve o read-back real e conta TODAS as escritas;
    `window.alert` capturado; relógio congelado N=1787265000000; navegação por cliques
    reais.
31. **Smoke 35/35 PASS:** abertura pelo caminho real principal (CTA sidebar) e ALTERNATIVO
    (`.kbv2-column-add` na coluna do kanban); 3 setores reais do admin sem descontinuados;
    RBAC Designer sem 'Edição de Cards'; validação step0/cliente/título (alerts literais);
    seleção de setor; associação label/for; pill obrigatório; gate REAL da quantidade
    (`role=alert` + foco); 12 acordeões; fields reais; choice Canais grava
    `fields.canais`; disabled real do − em N=1; acordeão abre; revisão com contador 0/12 e
    SEM "Enviar para o cliente" sem conteúdo; roundtrip Voltar preserva estado; com 1
    conteúdo o envio aparece gated (1/12); atalhos formgoto; **Esc real não fecha**;
    **SUBMIT: exatamente 1 `set` com payload validado** (title/client/sector/by/status +
    `workflowPhase='themes_preparation'` + `cronStatus='rascunho_social'` +
    `clientFlowStatus='afazer'`; `cronContents` compactado) e **zero writes além do
    esperado**; pós-save no board do setor; fechar pelo X; modal Responsável exclusivo
    (`data-pickasg` N+1 opções; escolha grava `assigneeId`); "Salvar tarefa" literal.
32. **Responsivo:** 1920 (card 920, grid 2 col, CTAs visíveis) · 1366×768 (0 overflow,
    CTAs visíveis) · **win125 1093×614 css @1.25** (card encolhe a 749px, 0 overflow
    horizontal, CTAs visíveis, foco visível). Corpo `.scr` rola internamente (contrato
    real do form-wrap).

## G · Regressão congelada e legado (FASES 8–9)

33. **Base×cur (`8e288c6b` × implementação), mesmo driver/modo/relógio:** F1 board+painel ·
    F2 board+painel · F3 board(strip)+painel · F4 board(strip)+painel · F5
    board(strip)+painel · **F6 Details default** — resultado: **0px** em todas as
    superfícies, exceto flake do sino nas regiões já documentadas (política A–E cumprida:
    base×base diverge sozinho na MESMA região; **0px fora da região comprovada; máscara
    NÃO ampliada**). Detalhe: 21 pares; 18 = 0px puro; f5 board/painel light-ui e f5-board legado-light divergiram SÓ na região do sino (aberto 1443,29→1485,71 · fechado 1460,30→1500,70⊂72); base×base do legado-light divergiu sozinho (prova A); cur×cur idem (B); mascarada a região exata: 0px fora nas 3 (E).
34. **Legado (sem `body.light-ui`):** Central aberta (F1 diffdet) em dark/light/hc + board
    F5 em dark/light/hc + **WIZARD etapa Dados (com os `<label>` novos) em dark/light/hc**
    + wizard etapa Setor dark — **todos 0px puro** (lgw-dark/light/hc e lgw0-dark = 0px; os <label> novos são comprovadamente pixel-inertes; único diff do lote legado foi o flake do sino no board F5 tema light, coberto pela política A–E acima).

## H · Fidelidade e provas (FASE 10)

35. **Matriz ZERO ISSUE** (MATCH/ADAPTAÇÃO; exceções F7-E01..E06 documentadas).
36. **Medidas (light-ui, 1920):** wizard 920px · header do card (título 20/800 + sub 12) ·
    stepper: nó 30px, linha 2px, kicker 9px · gaps do grid 16×26 · inputs 46px r12 ·
    option-card tile 48 r13 · chips 32 pill · switch 46×28 · vqty 38 r10 · footer: CTA
    48px r13 gradiente/ghost 48px · card r18 ring #E8EBF1 · breakpoints: 1920/1366/1093
    sem overflow (o card encolhe fluido ≤920).
37. **Provas entregues no chat (política: nunca versionar):** F7-WIZARD-1920 (Setor) ·
    F7-WIZARD-ETAPA-INTERMEDIARIA-1920 (Dados 2-col) · F7-WIZARD-BRIEFING-1920 ·
    F7-WIZARD-REVISAO-1920 · F7-WIZARD-VALIDACAO-1920 (erro real role=alert + foco) ·
    F7-WIZARD-1366 · F7-WIZARD-win125 · F7-WIZARD-A11Y-FOCUS · F7-COMPARE-GOLDEN-vs-APP.

## I · Fechamento (FASE 11)

38. **Git:** checkpoint único em `impl/light-ui-f7-wizard-1.0.246` (de `8e288c6b`) + push;
    SEM PR/merge/build/tag/release; 1.0.246 inalterada; Light UI inativa (classe só via
    harness); screenshots fora do repo; sem identificador de modelo em artefatos.
39. **Docs:** roadmap atualizado (I3F = ✔ GO / F6 CONGELADO `8e288c6b`; I3G = ENTREGUE —
    aguarda owner; F8 NÃO iniciada) + este relatório.
40. **STOP.** F8 Agenda não foi iniciada. Aguarda GO explícito do owner.
