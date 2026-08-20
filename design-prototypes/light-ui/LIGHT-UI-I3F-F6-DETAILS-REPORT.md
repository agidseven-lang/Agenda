# LIGHT UI — I3F · F6 DETAILS — RELATÓRIO (40 itens)

**Fase:** I3F · F6 Detalhes — Golden Frame 6 sobre a Central de Detalhes REAL
**Base congelada:** `f6915110` (F1–F5 GOLDEN/CONGELADAS) · **Branch:** `impl/light-ui-f6-details-1.0.246`
**Checkpoint único:** `8e288c6b` — `feat(light-ui): implement F6 details golden`
**Versão:** 1.0.246 (inalterada) · **Golden:** `proposta-c-frame6-detalhes.html` (Frame 6 aprovado, Design Freeze `9644d94`)
**Status:** ENTREGUE — aguarda avaliação do owner. F7+ NÃO iniciada.

---

## A · Hard gate de acoplamento (mandato: provar antes de editar)

1. **(A) Superfície real do Golden F6 provada.** As funções do Golden são as da **Central de
   Detalhes** (`openDetails` → `.det-sheet`): CTA "Legendas e artes" = ação de fase real `prod`
   (`data-prodopen`), "Enviar ao cliente" = `sendclient` com gate real `canSendToClient`,
   "Editar prazo" = `data-sla-editprazo` (canSeeAll), "Mover status" = `data-move`, "Remover" =
   `data-del` (canDelTask), "PRÓXIMA AÇÃO" = `.det-hero-next`, "RESPONSÁVEL AGORA" =
   `.det-hero-owner`/`detailOwner`, OPERAÇÃO = `flowSummaryBlock`, LINHA DO TEMPO =
   `opPanelBlock`/`taskTimeline` (10 marcos), PRAZOS/SLA = `detailSlaBlock`+`.det-dates`,
   RESPOSTA DO CLIENTE = `.det-cresp`/`clientReview`, CONTEÚDOS numerados = `.det-acc`.
   Nada precisou ser inventado.
2. **(B) Mesma Central de F1–F5 — SIM.** Um único `openDetails` (superfície compartilhada).
   Por isso o hard gate exigiu contexto disjunto (item 3) e regressão absoluta (seção F).
3. **(C) Contexto real independente — SIM, provado por código.** A expressão literal do
   `openDetails`: `data-detorigin` só é emitido quando `state.tab==='tarefas'` E `activeTab()`
   ∈ {`mine`,`client`,`designers`,`socials`,`hub`+`state.boardSector`}. Toda abertura real fora
   disso emite string vazia → **modal central DEFAULT sem o atributo** (base legada
   `width:min(1240px,92vw); height:88vh`). Caminhos reais auditados: **Minhas Prioridades**
   (`data-priopen`, tab `prioridades`), **deep-link/notificação** `detail/<id>`
   (`notifRoute`, também via `onNotifOpen`), **hub raiz** de Setores (tab tarefas,
   `activeTab()==='hub'` sem `boardSector`). Nota: o sino de Alertas SLA só existe DENTRO dos
   boards kanban (`isOperationalBoardContext`) — lá a origem sempre existe; portanto o sino
   NÃO é caminho do default (registrado, não usado como prova).
4. **(D) Aplicável sem alterar 1px dos congelados — SIM.** Escopo estrito
   `.modal-back[data-detmodal]:not([data-detorigin])`: os 5 painéis congelados exigem
   `[data-detorigin="X"]` → disjunção por construção nos DOIS sentidos. Prova por screenshot
   na seção F (0px).
5. **`renderClientView` NÃO é a superfície do F6.** O cabeçalho do protótipo a cita como
   referência estrutural do "resumo editorial"; a auditoria provou que ela é rota REAL
   distinta (`state.clientView`, espelho interno do portal) com **ações de cliente**
   (aprovar/pedir revisão/editar — `clientReviewAction`), função diferente do detalhe da
   equipe do Golden. Permanece **intocada** nesta fase.
6. **Nenhum contorno proibido usado:** sem origin/rota/modo fake, sem clone da Central, sem
   markup duplicado, sem atributo só para screenshot. A única mudança de markup é 1 atributo
   ARIA real de acessibilidade (item 22).

## B · Reauditoria real da Central (nomes literais)

7. **Estrutura:** `.modal-back[data-modalbg][data-detmodal][±data-detorigin][data-detsector]
   [data-dettaskid]` → `.sheet.det-sheet[role="dialog"][aria-modal="true"][aria-label=
   "Central de Detalhes da tarefa"]` → `.det-head` (`.det-badge` do setor real + `.det-x`
   `data-modalclose`) · `.det-title` · `.det-client` · `.det-chips` (1 chip de estado
   `detailState`/`stOf` + prioridade + `cron.label`) · `.det-body` (rola) · `detFooter` →
   `.det-actions > .det-act-row-solo`.
8. **Corpo (ordem real):** `.det-people` (Responsável pela execução `respOf` / Enviado por
   `t.by`) → `detailHeroBlock` (status+sub, PRÓXIMA AÇÃO, RESPONSÁVEL AGORA `detailOwner`,
   ações de fase `detailActionsHtml`: fix/teamfix/clientview/senddesigner/redesigner/dboard/
   prod/sendclient/edit) → `detailSlaBlock` (chip Dentro do prazo/Prazo próximo/Prazo
   encerrado/**Entregue**/**Concluída** via `resolveTaskDisplayState`+`isTaskCompleted`;
   Início planejado/Prazo final; Editar prazo gated) → `flowDetailsBlock` (`<details
   class="det-flowdet">` COLAPSADO com `flowSummaryBlock` [4 pills reais: Fluxo do cliente/
   Fluxo do designer·nome/Status operacional/Fase do cliente] + `opPanelBlock` [`.det-next` +
   `.det-tl` 10 marcos `taskTimeline` com done/current/attention/optional/pending]) →
   `execTrackingBlock` → Datas (`.det-dates`: Criado em/Início/Término/Atualizado em/Prazo
   final) → Conteúdos (`.det-acc` acordeões numerados com copiar tema/legenda
   `data-detcopytheme|caption`, editar observação `data-detnoteedit` gated `canSeeAll`,
   `.det-acc-note` observação interna) → Briefing/`edicao_cards` → Checklist (não-cliente) →
   Link/anexo → Resposta do cliente (`.det-cresp`) → `clientRevisionFixBlock` (`.det-fix`
   com Editar tema/legenda `data-itemfix`) → Designer atribuído.
9. **Rodapé real:** [Editar tarefa (`edicao_cards`+canSeeAll)] · [Mover status `data-move` —
   oculto se `isTaskCompleted` (H17)] · [Remover `data-del` — `canDelTask`, permanece
   pós-conclusão] · [Fechar `data-modalclose`].
10. **Lifecycle real:** `_detReturnEl` capturado na 1ª abertura; `detSetupModalFocus` (foco
    inicial no `.det-x`, trap de Tab manual com filtro de visibilidade); Escape global fecha
    SÓ `[data-detmodal]`; `closeModal` devolve o foco; reaberturas internas
    (`markItemsAdjusted`→`openDetails`) preservam retorno e rascunho (`detNoteCaptureDraft`).
11. **Writes possíveis (nenhum novo):** moveStatus/deleteTask/markItemsAdjusted (Worker)/
    edição de prazo/observações — todos gated e INTACTOS; a fase não adicionou nem removeu
    nenhum caminho de escrita.

## C · Matriz Golden×App (classes)

12. **A (match direto):** hero status/sub · PRÓXIMA AÇÃO · RESPONSÁVEL AGORA · CTA de fase
    gradiente · Editar prazo/Mover status/Remover · Resposta do cliente com citação/data ·
    timeline 10 marcos com atores/carimbos · conteúdos numerados com kicker/título · datas.
13. **B (adaptação dimensional):** página full-canvas → modal central real 1240×88vh
    (F6-E01); título 29px Golden → 27px no modal; chips r8 aplicados aos `rev-chip`.
14. **C (reapresentação de dado real):** SLA do designer "Entregue — aguardando
    envio/aprovação final" (o Golden mostra "Em prazo" pois simula o eixo social; o real
    exibe o eixo do designer — **Entregue≠Concluída preservado**).
15. **D (existe no real em OUTRA superfície — não fabricado):** resumo editorial por item com
    Feed 1080×1440/Story 1080×1920/situação derivada (`itemStatus` real da
    `renderClientView`) — F6-E03.
16. **E (compartilhado com congeladas):** todo o `.det-sheet` — resolvido pelo escopo
    `:not([data-detorigin])` + regressão 0px (hard gate).

## D · Implementação (CSS aditivo, 1 seção; +55/−1 no monólito)

17. **Seção `I3F · F6 DETAILS`** ao fim do `<style id="light-ui-foundation">`; 24 seletores,
    TODOS com o prefixo `body.light-ui.desktop .modal-back[data-detmodal]:not([data-detorigin])`
    (verificação automatizada: 0 seletores fora do escopo; balanço de chaves do bloco = 0).
18. **Paleta por override de custom properties no subtree do sheet default** (--surface/
    --surface2/--ink/--soft/--faint/--text/--line/--line-soft/--accent/--green/--red) — os
    consumos internos legados clareiam de uma vez; os tints inline reais (`withAlpha`)
    funcionam sobre branco como no Golden.
19. **Regras extras só onde o base tinha cor dark hardcoded:** hover do `.det-x` (#262a36),
    hover do summary dos acordeões, numeral `.det-content-n` (branco+ring Golden), box
    PRÓXIMA AÇÃO lilás, nós da timeline (done tint verde/pendente branco), rodapé (hairline
    superior, botões compactos, `Remover` claro com texto #C43D3D, destrutivo à direita via
    `margin-left:auto` + regra de adjacência para o caso sem Remover), `slaedit-btn` (CSS
    base é injetado LAZY pelo slaib só em contexto de board — o escopo F6 traz o shape
    completo; dark fora do escopo permanece como em produção), `cvw-open`/`ce-edit` (cyan
    claro), `det-teamfix` (fundo verde-tint p/ contraste com a cor congelada `--lui-green-ink`).
20. **CTA de fase no gradiente do amendment v4** (`--lui-grad` 90deg #3B5CF9→#E604AE — o
    amendment vence o gradiente 135deg do protótipo C, como nas fases anteriores) e CTAs do
    hero compactos lado a lado (width:auto; o base `.btn{width:100%}` produzia barras
    full-width no modal largo).
21. **Backdrop:** mantido o global light-ui congelado (`rgba(15,19,32,.46)`, C2) — sem
    alteração.

## E · A11y (só dívidas da superfície real)

22. **Já existiam (não tocados):** `role="dialog"`, `aria-modal="true"`, nome acessível do
    dialog, trap de Tab, Escape, retorno de foco, `:focus-visible` nos controles.
23. **Dívida quitada 1:** `.det-x` era icon-only sem nome acessível → `aria-label="Fechar
    detalhes"` no `openDetails` (única edição de markup; pixel-inerte — **provado 0px** em
    dark/light/hc com a Central aberta e nos 5 painéis light congelados).
24. **Dívida quitada 2:** `prefers-reduced-motion` desliga a animação de entrada do sheet —
    escopado ao modal default (nenhuma regra global alterada).
25. **Tabs semânticos:** a superfície real NÃO tem tabs (seções empilhadas + `<details>`
    nativo) — nada a corrigir, nada inventado.
26. **Prova de foco:** F6-DETAILS-A11Y-FOCUS.png — abertura real via Minhas Prioridades com
    foco no X e outline visível (#4353D8, 2px — `--accent` do escopo).

## F · Gates executados

27. **Smoke 41/41 PASS** (f6_driver.js, fixtures 100% campos reais, relógio congelado
    N=1787265000000, stubs com contador de writes): abertura pelas **2 superfícies reais**
    (Prioridades `data-priopen`; deep-link `notifRoute('detail/…')`), origem ausente
    (prioridades E hub raiz), conteúdo da task clicada (título/cliente/`data-dettaskid`),
    dialog a11y + aria do X, foco inicial/trap/Escape/retorno de foco/reabertura/fechar
    pelo X, campos reais (hero/próxima ação/responsável agora/datas/12 acordeões/copiar
    7+12/observação interna/resposta do cliente), **Entregue≠Concluída**, timeline 10 no
    `<details>` real (fechado por padrão; expandido por interação real), RBAC
    admin×designer (designer sem editar-observação/Remover/Editar prazo), CTA gating real
    (ativo com temas; **bloqueado 🔒** sem tema via `canSendToClient` + hint), pós-conclusão
    H16/H17 (sem Mover/sem Editar prazo; Remover permanece), **zero writes** (contador nos
    stubs = 0).
28. **Responsivo:** 1920 (sheet 1240×950) · 1366 (1240×676) · win125 1536×864@1.25
    (1240×760) — modal central real nas três; **sem dock ≥1760** (nem o contrato real nem o
    Golden o determinam para o default — o Golden é página; dock é apresentação POR ORIGEM
    das fases congeladas).
29. **Regressão congelada ABSOLUTA (base `f6915110` × atual, mesmo driver/modo/relógio):**
    F1 board `diff` + painel `diffdet` · F2 board + painel · F3 board(strip) + painel · F4
    board(strip) + painel · F5 board(strip) + painel — **0px**, exceto F4 (board e painel)
    na região EXATA do flake documentado.
30. **Política do flake A–E cumprida à risca:** (A) base×base divergiu SOZINHO em
    f4-painel na MESMA região (1443,29→1485,71) — flake ambiental independente do código;
    (B) atual×atual divergiu nas mesmas regiões; (C) independência provada por A; (D)
    regiões idênticas às documentadas (aberto 1443,29→1485,71 · fechado 1460,30→1500,72);
    (E) **0px FORA da região comprovada nas 4 ocorrências** (máscara exata, NÃO ampliada).
    Registro canônico: *known async bell flake; 0px outside proven region*.
31. **Legado 0px:** Central ABERTA (k4 via `diffdet`, contém o aria novo) em **dark, light e
    hc** = 0px puro; boards f5 dark = 0px; hc/light com o flake do sino na região fechada,
    0px fora (mesma política).
32. **Zero write:** nenhum caminho novo de escrita; contador de writes dos stubs = 0 em todo
    o smoke; `localStorage` novo = 0.

## G · Fidelidade (alvo ZERO ISSUE)

33. **Matriz por zonas = MATCH/ADAPTAÇÃO, zero ISSUE.** Zonas MATCH: hero (status/sub/
    próxima ação/responsável agora/CTAs), SLA/prazos, timeline (nós done tint verde/atual
    azul/pendente branco/condicional), conteúdos numerados (numeral branco+ring, kicker,
    título), resposta do cliente (banner verde com citação), rodapé administrativo, paleta/
    raios/hairlines/sombras Golden.
34. **F6-E01** — Golden é PÁGINA full-canvas 3 colunas; a função real é MODAL overlay com
    corpo linear condicional (pares `det-sec`+bloco irmãos; Operação/Timeline dentro do
    `<details>` real colapsável). Re-estruturar o markup mudaria a superfície compartilhada
    congelada → apresentação adaptada: modal central claro 1240×88vh em coluna única com a
    linguagem visual Golden integral. Transformar em rota/página seria função inventada
    (proibido).
35. **F6-E02** — pill "MONITOR SLA · AO VIVO" e o conjunto de 4 chips do hero do Golden não
    fabricados: o real tem 1 chip de estado (detail-hierarchy-v2: um único estado no topo,
    nunca status concorrentes) + label de periodicidade; setor no `det-badge`; SLA e fase
    nos blocos reais.
36. **F6-E03** — resumo editorial por conteúdo com Feed/Story/situação derivada pertence à
    superfície real `renderClientView` (função de cliente) — não fabricado na Central; a
    Central mantém a apresentação real por acordeões (tema/legenda/observação/copiar).
37. **F6-E04** — contadores reais `N / M` no `det-sec-c` (não a frase composta do Golden);
    rodada/carimbos exibidos são os reais dos blocos.

## H · Entregas e fechamento

38. **Provas no chat (política: nunca versionar):** F6-DETAILS-1920.png (paridade Golden:
    designer entregou/Em prazo/Tatiana/CTAs gradiente) · F6-DETAILS-1920-ALT-STATE.png
    (cliente pediu ajuste: hero vermelho com nota real, "Detalhes do fluxo" expandido com as
    4 pills reais, Corrigir/Marcar como corrigido/Abrir visão do cliente) ·
    F6-DETAILS-1920-SCROLL.png (corpo: acordeões numerados claros) · F6-DETAILS-1366.png ·
    F6-DETAILS-win125.png · F6-DETAILS-A11Y-FOCUS.png · F6-COMPARE-GOLDEN-vs-APP.png.
39. **Git:** checkpoint ÚNICO `8e288c6b` em `impl/light-ui-f6-details-1.0.246` (de
    `f6915110`), push feito; **sem PR, sem merge, sem build/tag/release**; produção intacta;
    1.0.246 inalterada; screenshots fora do repo; nenhum identificador de modelo em
    artefatos versionados.
40. **Docs:** roadmap atualizado (I3E = ✔ GO registrado; F5 = CONGELADO `f6915110`; I3F =
    ENTREGUE `8e288c6b` — aguarda owner; F7+ NÃO iniciada) + este relatório. **STOP: a fase
    para aqui; F7 não foi iniciada; Light UI não foi ativada para usuários.**
