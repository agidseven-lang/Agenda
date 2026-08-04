# F3.5.5A-H1 — CHECKPOINT DA AUDITORIA READ-ONLY (antes de qualquer edição)

Base auditada: Desktop 1.0.217 (tip `311ed81`, código = release v1.0.217). Todos os
apontamentos abaixo citam linhas REAIS de `desktop/src/renderer/index.html` @311ed81.

## A. Os 34 itens da auditoria

1. **Central de Detalhes**: `openDetails(taskId)` (index.html:7290) monta o HTML inteiro
   e escreve UMA vez em `#modalRoot` (7406) + `detSetupModalFocus()`.
2. **Render de cada tema**: bloco `if(cron)` (7334–7365): `cron.list.map(...)` devolve um
   `<details class="det-acc">` por item com `<summary>` (número, `TEMA NN`, texto,
   botões, chevron) e `det-acc-body` (legenda + observação interna).
3. **Botão de copiar**: `det-acc-cbtn` com `data-detcopytheme`/`data-detcopycaption`
   (7348–7351), handler DELEGADO no documento (10083) com preventDefault+stopPropagation.
4. **Chevron**: `span.det-acc-chev` dentro do `<summary>` (toggle nativo do `<details>`).
5. **Evento de expansão**: nativo do `<details>/<summary>`; "Expandir/Recolher todos" via
   `data-detexpand`/`data-detcollapse`.
6–7. **Modelo de observações internas — JÁ EXISTE (F3.5.4W-H1 E5)**: campo top-level
   `tasks.designerItemNotes` = mapa `{ 'i<idx>': string }`. Leitura nos Detalhes (7353):
   `(t.designerItemNotes||{})['i'+c._i]`; exibição `.det-acc-note` com rótulo aprovado
   "Observação interna da Social Media" (só quando não-vazia).
8. **Fluxo de atribuição**: `openDesignerModal` → `openDesignerDeadline` (7893) →
   handler `data-designersend` (10168) → `sendToDesigner` (patch único).
9. **Modal de escolha do Designer**: `openDesignerDeadline` monta `dz-notes` com um
   textarea por tema.
10. **Textareas existentes**: `textarea.dz-note-ta[data-itemnote="<_i>"]` com prefill de
    `_existNotes['i'+c._i]` (7901–7912).
11. **Como salvam hoje**: coleta (10177–10179) — mapa `'i'+ix` com valor **trim**,
    vazios PULADOS; `sendToDesigner` grava `patch.designerItemNotes = mapa COMPLETO`
    (substitui; persiste limpezas) via `db.collection('tasks').doc(id).update(patch)`.
12–14. **Identificador dos temas**: `cronOf(t)` (6526) mapeia `_i` = ÍNDICE REAL do array
    (`map` ANTES do `filter`) de `t.cronContents` (cron/roteiro) ou `t.videos`
    (edição de mídia). Não há itemId/contentId próprio; a chave usada é `'i'+_i`.
15–17. **Reordenação/exclusão/inclusão: NÃO EXISTEM na 1.0.217.** Varredura de TODAS as
    escritas de `cronContents`:
    - criação (8611 e 9789): filtra vazios UMA vez, antes de existir qualquer nota;
    - `saveContentEdits` (7960): reescreve o array 1:1 pelo índice (mesmo n; preserva
      feed/story de `orig[i]`); sem UI de adicionar/remover/reordenar;
    - `saveItemFix` (7766): edita SÓ `arr[idx]` (pad `{}` se faltar) — índice preservado;
    - modal de produção (8049/8052): mapeia 1:1 `cronContents` → grava na mesma ordem;
    - Worker: NUNCA escreve `cronContents` (só `clientItems.i<idx>.cs` etc.).
    ⇒ Pós-criação, comprimento e ordem dos índices são ESTÁVEIS; editar o TEXTO do tema
    não desloca notas. `'i'+_i` é chave estável comprovada (não é necessário criar ID
    aditivo). O filtro de `cronCtx` (8143) é só para preview/mensagem — nunca regrava.
18–22. **Modelos**: cronograma/roteiro = `cronContents[{tema,legenda,feedImageUrl,storyImageUrl}]`;
    edição de mídia = `t.videos[{id,n,tema}]` (sem legenda; SEM notas por tema — mantido fora
    na W-H1); edição de cards = campos fixos via `cardsFieldOf` (Legenda/Observações; sem
    itens) — modelo diferente, fica FORA (documentado). `isClientSector(k)` =
    `cronograma||roteiro` (2586) — escopo com notas por tema.
23. **Firestore**: doc `tasks/<id>`; escrita direta SDK v8 no renderer (`db...update`);
    `firebase.firestore.FieldValue` disponível (arrayUnion já usado; `.delete()` idem).
24. **Transação de atribuição**: `sendToDesigner` é um `update(patch)` único (não-transação),
    com otimista + snapshot confirmando — padrão vigente.
25. **Histórico**: `history: FieldValue.arrayUnion(entry)` (padrões `social_editou_conteudo`,
    `social_corrigiu`, `enviado_designer` com `notesCount` = CONTAGEM, nunca os textos).
26. **Permissões**: `roleCat(u)` = ADMIN (`u.admin`) | MANAGER (`MANAGER_KW` inclui
    'social', 'gestor', 'admin'…) | OPERATIONAL (Designer). `canSeeAll(u)` =
    ADMIN||MANAGER (2629) — mesmo gate já usado para "Editar tarefa"/atribuição.
    Rules vivas (captura F4.3C4A): `tasks` write &lt; 80 campos SEM validação por papel/campo
    — o modelo de confiança vigente para TODAS as edições de tarefa é o gate de papel no
    app + sessão autenticada. Esta fase NÃO amplia esse modelo (usa o mesmo caminho e o
    mesmo gate `canSeeAll` da atribuição; nenhum campo novo, nenhuma Rule alterada).
27–29. **Privacidade (Worker/portal)**: `cloudflare-worker.js` tem ZERO referência a
    `designerItemNotes` (e zero a `executionTracking`). O portal serializa por ALLOWLIST
    por item ({i, cs, tema, legenda, feed, story…}) a partir de `cronContents`+`clientItems`;
    `history` só recebe append (updateTransforms) — nunca é lido/serializado ao cliente.
    O dado interno NUNCA chega ao navegador do cliente (não é CSS: o campo não é enviado).
30. **Designer**: vê `.det-acc-note` (rótulo aprovado W-H1, pre-wrap, escapado, oculto
    quando vazio) — display JÁ APROVADO fisicamente nas 1.0.215→217; permanece intacto.
31. **Tarefas antigas**: `(t.designerItemNotes||{})` em todos os pontos; update com
    dot-path cria o mapa automaticamente. Retrocompatível.
32. **Funções alteradas (plano)**: SOMENTE `index.html` — (a) render do item no bloco
    `if(cron)` de `openDetails` (botão lápis + wrapper + editor + estado); (b) handler
    delegado novo `data-detnoteedit`/ações do editor no dispatcher global; (c) função nova
    `detNoteSave/detNoteCancel` (dot-path update + history + feedback); (d) NADA em main/
    preload/slareminder/bgnotify/worker/functions/android.
33. **Riscos e mitigação**: perda de texto em rebuild do modal (mitigado: `#modalRoot`
    está FORA de `#app` — `renderFromSnapshot()`→`render()` NÃO toca o modal; e draft
    cache por tarefa+item reidrata nas reaberturas explícitas, ex. `markItemsAdjusted`);
    conflito multi-edição (mitigado: update por DOT-PATH toca SÓ a chave do item + detecção
    de mudança remota antes de gravar); duplo listener (mitigado: delegação única já
    existente); vazamento em logs (mitigado: observabilidade allowlist sem texto).
34. **Schema aditivo**: NÃO é necessário — o campo e a chave estável JÁ existem (W-H1).
    PROIBIDO criar segundo campo: esta fase REUTILIZA `designerItemNotes` como fonte única
    (Detalhes ↔ modal de atribuição já leem/escrevem o mesmo mapa).

## B. Estratégia (plano cirúrgico)

- **Fonte única**: `tasks.designerItemNotes['i'+_i]` (a MESMA da atribuição). Editor dos
  Detalhes grava por dot-path `update({ 'designerItemNotes.i<idx>': <texto trim> })`;
  vazio ⇒ `FieldValue.delete()` na chave (equivale à limpeza do fluxo W-H1).
- **Lápis**: `det-acc-cbtn` com `svg('editnote')`, `data-detnoteedit="<_i>"`,
  title/aria "Editar observação interna", na ordem [Copiar][Editar][Chevron], gated
  `canSeeAll(state.user)` (Admin+Social) e `isClientSector` (cronograma+roteiro).
  Designer NÃO vê o lápis (mantém visualização); cliente não tem acesso ao app.
- **Editor**: área integrada AO ITEM, FORA do `<details>` (item passa a ser
  `<div class="det-acc-item"><details…/><div class="det-note-ed" hidden>…</div></div>`
  — `.det-contents` é flex simples, sem seletor filho; zero impacto visual nos demais).
  Clicar no lápis NÃO expande/recolhe o accordion e abre SÓ o editor. Label literal
  "OBSERVAÇÃO INTERNA PARA O DESIGNER — OPCIONAL", textarea com prefill, sem limite
  arbitrário (não existe limite real no campo hoje; sem contador), Cancelar (com
  descarte em 2 cliques quando houver texto alterado) e "Salvar observação".
  UM editor ativo por vez (abrir outro com rascunho sujo pede salvar/cancelar antes).
- **Salvar**: valida papel → lê a tarefa VIVA (snapshot) → detecção de conflito (valor
  remoto ≠ baseline do editor ⇒ 1ª tentativa mostra aviso e atualiza a base, preservando
  o texto digitado) → `update` dot-path + `history` arrayUnion
  `{type:'obs_interna_tema', label:'Observação interna do Tema NN atualizada.', contentIndex,
  contentLength, by, byId, at, channel:'social_edit'}` (SEM texto) → sucesso REAL ⇒
  atualiza `.det-acc-note` in place + fecha editor + "Observação salva." Falha ⇒ mantém
  editor/texto + mensagem clara + retry. NUNCA: mover status/coluna/prazo, atribuir,
  notificar cliente, pedir nova aprovação.
- **Observabilidade sanitizada**: `details.note.save_succeeded|save_failed|opened|
  cancelled` com {taskIdHash, itemIndex, action, contentLength, actorRole, appVersion,
  timestamp} — nunca o texto/cliente/título.
- **Congelados**: main/preload/slareminder/bgnotify/sons/worker/functions/android
  byte-idênticos vs 1.0.217; alertas laranja/amarelo/vermelho intocados.

## C. Decisões registradas

- Rótulo de exibição ao Designer permanece o APROVADO da W-H1 ("Observação interna da
  Social Media") — mesmo bloco visual, zero regressão nas suítes 74 da W-H1.
- Sem contador de caracteres: não existe limite real no campo (nenhum maxlength/valida-
  ção hoje); impor um seria limite arbitrário vedado pelo mandato.
- Edição de mídia (vídeos) e Edição de Cards ficam FORA (modelos distintos; mesma
  decisão da W-H1) — documentado; cronograma+roteiro cobertos.
- Designer permanece SEM edição (nenhuma permissão específica existente foi encontrada
  que o autorize; mandato: só com permissão comprovada — não há).
