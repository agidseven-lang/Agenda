# LIGHT UI — I3M · F13 MODAL "LEGENDAS E ARTES" — RELATÓRIO

**Base:** `6a677133` (F1–F12 CONGELADAS; F12 @ 6a677133) · **Branch:** `impl/light-ui-f13-legendas-artes-1.0.246` (DIRETO da base; não de docs)
**Golden:** `proposta-c-frame13-modal-legendas-artes.html` (Frame 13 aprovado, freeze `32103bd`; contrato C2 `f9fe31a`; renderizado 1920×1080 ANTES de editar)
**Checkpoint:** `899862a2` (`feat(light-ui): port F13 captions and artwork golden`) · **Versão:** 1.0.246 (inalterada)
**Status:** ENTREGUE — aguarda owner. **F13 NÃO CONGELADA. Nenhuma etapa posterior iniciada. Light UI INATIVA.**

---

## 1 · Preflight (FASE 0) · PASS
HEAD exato `6a677133` · worktree limpa · 1.0.246 · Light UI inativa · F1–F12 congelados · zero divergência da base.

## 2 · Golden (FASE 1) · PASS
Localizado sem assumir (MASTER map: F13 `32103bd`); 625 linhas; render 1920×1080 antes do primeiro edit. Zonas: sheet 680 r18 sobre backdrop; X; ícone âmbar; título/sub literais; pilha `.pr-list` (scroll 56vh); card por conteúdo (nº + tema read-only + RTE + Feed/Story); drop tracejado/thumb+X/URL alternativa; footer 3 ações. **Dívidas REGISTRADAS NO GOLDEN (não corrigir):** dimensões 1080×1440/1920 são editoriais (sem validação); sem limite de tamanho/formato além de `image/*`; upload sem progress (toast only); botões de salvar sem disabled/loading (fecham antes do await); URL sem validação de host. **Dívida a11y histórica:** upload por teclado (gate A).

## 3 · Reauditoria funcional real (FASE 2) · PASS

**Trigger:** CTA "Legendas e artes" `[data-prodopen]` (delegação global → `openProductionModal(taskId)`); disponibilidade por FASE do fluxo (sem gate de papel no handler — literal). **Bloqueio real H16:** `isTaskCompleted` → toast "Esta tarefa já foi concluída e não pode ser reenviada." + return (ZERO write — provado g01). **Estado:** `state._prod = {taskId, items: cópia de cronContents}` (nada grava até Salvar). **Modal:** `#modalRoot` → `.modal-back[data-modalbg]` → `.sheet.pr-sheet` (X `.sp-x` · `.pr-ic` · título · sub literal · `.pr-list` → `.pr-card` [nº, tema via rteInlineDisplay, label "Legenda", **RTE REAL** `rteField('prod|i|legenda')` sincronizado por `rteSync`, `.pr-arts` com `artBox` Feed/Story] · footer). **Empty real:** "Nenhum conteúdo neste cronograma." (`.cvw-soft`).

**Matriz ação → handler → side effect (write/auth map):**

| ação | handler | side effect | backend/storage | confirmação |
|---|---|---|---|---|
| abrir | `[data-prodopen]` → openProductionModal | snapshot em memória | 0 | bloqueio completed |
| legenda | RTE real → `rteSync('prod')` | `_prod.items[i]` | 0 | — |
| URL da arte | `[data-produrl]` change | url + re-render (scroll preservado 1.0.110) | 0 | — |
| **upload** | `[data-produp]` change → `ikUpload(file,'/cronogramas/{taskId}')` | toasts "Enviando arte…"/"Arte anexada." | **2 fetches (assinatura Worker + POST ImageKit)** | erro → toast fallback literal |
| remover arte | `[data-prodclear]` | url='' + re-render | 0 | — |
| Cancelar/X/backdrop | `[data-modalclose]`/`[data-modalbg]` | closeModal | 0 | — |
| **Salvar** | `[data-prodsave]` → `saveProduction(id,false)` | otimista + closeModal+render ANTES do await + toast | **1 `update` Firestore** (patch: cronContents, clientFlowStatus 'producao', operationalStatus por pendências, pendingLegend/Feed/Story, history arrayUnion 'social_producao') | — |
| **Salvar e reenviar** | `[data-prodresend]` → `saveProduction(id,true)` | + preparação final (SEM afirmar envio — H13) + `ensureReviewToken` + `openSendClientModal` | **1 `update` + 1 `set` {clientReviewToken, clientReviewUrl}** (token de review — literal) | envio só confirmado via Worker |

**Escape:** NÃO fecha (provado empiricamente — sem handler; fechar = X/Cancelar/backdrop — literal documentado, nada inventado).

## 4 · HARD GATE A — Upload keyboard path · PASS (corrigido com autorização)

**BEFORE (empírico, arquivo intocado):** controle real = `<label class="pr-drop"><input type="file" accept="image/*" hidden>`; **`hidden` ⇒ input NÃO focável; label NÃO focável ⇒ teclado = 0 caminhos** (Enter/Space provados = 0); mouse = ativação nativa label→input (1 caminho, 1 change handler). **Correção cirúrgica (2ª preferência do mandato — keydown mínimo no controle real):** o LABEL real do controle (`.pr-drop`) fica focável (`tabindex="0" role="button" aria-label="Anexar arte Feed/Story"`; input permanece `hidden` — zero box novo) + keydown mínimo no próprio label: Enter/Espaço → `preventDefault`+`stopPropagation` → `input.click()` → o MESMO file picker/change handler do clique (zero segundo handler funcional; payload/destino intocados). **AFTER (eventos `filechooser` REAIS do Chromium): mouse = 1 · Enter = 1 · Space = 1** — nenhum gesto 2×; nested activation = 0 (input hidden fora da árvore; 1 tab stop). Ring de foco via `:focus-visible` (gated light). **Nota de engenharia (registrada):** a 1ª tentativa (input invisível-focável estilo sr-only) foi DESCARTADA pelo próprio gate de legacy — o box do form control muda o antialiasing de texto do sheet inteiro nos 3 temas (diff determinístico provado por bissecção: aria-only = 0px; input-only = diff; layout subpixel byte-idêntico) — a abordagem final é 100% pixel-inerte.

## 5 · HARD GATE B — Upload side effects (stub; ZERO rede real) · PASS

`fetch` stubado (assinatura + ImageKit) — zero upload/backend/storage REAL na bateria. **Sucesso:** File real via DataTransfer → change → 1 POST ImageKit com **payload provado: folder `/cronogramas/tk1` + fileName `arte.png`** → url aplicada → thumb renderizado → toasts literais. **Erro (stub 500):** toast literal "Falha no upload. Cole a URL da arte como alternativa."; url intacta; sem crash; drop permanece. **Picker cancelado:** change sem files → return (0 side effects — provado). Validações inexistentes NÃO exigidas (dimensão/tamanho — dívida registrada no Golden).

## 6 · HARD GATE C — Demais mutações · PASS

**Salvar:** exatamente **1 `update`** com patch REAL capturado: `cronContents`(2), `clientFlowStatus:'producao'`, `operationalStatus:'aguardando_legenda'` (literal: pendingFeed=true na fixture ⇒ opSnap), `pendingLegend:false · pendingFeed:true · pendingStory:true · pendingSocialReview:true` (recalculadas pelas funções reais), `history` arrayUnion; fecha + otimista + toast. **Double-submit:** 2 cliques rápidos = **1 write** (closeModal SÍNCRONO remove o botão antes do 2º — comportamento literal da dívida "sem disabled" registrada no Golden: o fluxo real fecha antes do await). **Reenviar:** 1 `update` (cronStatus `ready_for_final_client_review` + clientApprovalPhase `'final'` + finalApprovalRequired) **+ 1 `set` do token** ({clientReviewToken, clientReviewUrl} — write literal do `ensureStableClientReviewToken`) + `openSendClientModal` invocado 1× (spy); SEM evento de "envio" no history (H13 — envio só na confirmação do Worker). **Fechar (3 vias):** 0 writes. **RBAC:** sem gate de papel no handler (literal); bloqueio funcional = completed. Zero falso sucesso; zero write real.

## 7 · A11y do modal (FASE 3) · PASS

`role="dialog"` + `aria-modal="true"` + `aria-label="Legendas e artes"` na sheet e `aria-label="Fechar"` no X — **atributos mínimos adicionados seguindo o padrão REAL das outras sheets** (det-sheet/evd-sheet já os têm); labels de upload focáveis com role/aria-label (gate A); RTE real já acessível (role=textbox aria-multiline + toolbar role=toolbar); tab order provado (X → RTE → label de upload → URL → … → botões); nested = 0; focus-visible gated (#4353D8) incl. `:focus-visible` no drop; sem focus trap paralelo (não existe um real — literal); reduced-motion: sem animações novas.

## 8 · Port visual (FASE 4) · PASS

**Padrão ev-sheet/login: CSS VARS redefinidas NO ESCOPO** `body.light-ui.desktop .sheet.pr-sheet` (--surface/--surface2/--ink/--soft/--faint/--line/--line-soft/--accent) ⇒ **o RTE interno herda o claro AUTOMATICAMENTE** (o RTE do wizard/F7 fora do modal permanece intocado); backdrop claro já vem da regra C2 do foundation. Overrides do Golden: sheet r18+sh-2, ícone âmbar tint, nº indigo, drop tracejado claro, thumb/url claros, ghosts claros, **CTA "Salvar e reenviar" com `--lui-grad`** (autoridade F1 v4 sobre o gradiente real de envio — precedente C2 PRIMARY documentado no Golden). **Auditoria: 26 seletores, 26/26 gated, 0 leakage, 0 global, 0 `!important`, balanço 0.**

## 9 · Responsivo (FASE 5) · PASS
1920 / 1366 / win125 (1093×614 @1.25): **scrollW == vw nas 3**; modal alcançável; ações visíveis; `.pr-list` com scroll interno real (max-height 56vh); sheet max-height 88vh real; sem fake scale; nenhuma função escondida.

## 10 · Estados visuais (FASE 6)
F13-LEGENDAS-{1920, 1366, win125, EMPTY, A11Y-FOCUS}.png + F13-COMPARE-GOLDEN-vs-APP.png (estado principal = eco do Golden: c1 com Feed anexado + Story vazia; upload/preview coberto pelo estado principal; loading de upload é toast transitório — não fabricado; sem estado de confirmação real).

## 11 · Legacy deep-state (FASE 7) · PASS
Base `6a677133` × current, Light UI OFF, **9 pares deep-state: host (superfície anterior) · F13 ABERTA (main, com conteúdo/upload/preview) · empty interno × dark/legacy-light/HC = 0px PURO nos 9** — sem máscara. (O gate FUNCIONOU como projetado: rejeitou a 1ª técnica do input focável por diff de rasterização determinístico e forçou a abordagem final pixel-inerte — ver §4.)

## 12 · Regressão F1–F12 (FASE 8, base `6a677133`) · PASS
31 pares light+legacy: **29 = 0px PURO** — incluindo TODOS os hard gates: **F9 populated/detail · F10 main/empty · F11 main/empty · F12 default/error/loading = 0px** — e legacy suite (Central 3 temas, Executivo/Relatórios/Login dark) = 0px. f3 board e f5 board divergiram SÓ nas bboxes conhecidas do sino com **A–E auto-provado** (base×base/cur×cur divergem sozinhos na MESMA bbox; 0px fora nos 2). F12 Enter/F11 D01-D02/F9-D01: protegidos pelo diff audit (zero toque — greps=0) + regressão visual 0px; nenhum handler congelado alterado.

## 13 · Diff audit (FASE 9) · PASS
**1 arquivo, +46/−3.** Separação: (1) CSS I3M +38 gated; (2) markup mínimo pixel-inerte: label do upload com tabindex/role/aria-label (gate A, 1 linha) e role/aria-modal/aria-label na sheet + aria-label no X (a11y, 1 linha); (3) correção cirúrgica do teclado: 1 bloco keydown nos `.pr-drop` dentro do próprio `renderProductionModal` (+3 — chama `input.click()`, zero segundo fluxo); (4) handlers de produção/change/click/delegação INTACTOS; zero lógica de negócio alterada. **Greps no diff = 0 para:** login/auth (doLogin/renderLogin/authLogin) · reports/exports (renderReports/toCSV) · exec (renderExecPanel/execDesRow) · F9 (nc-*/notifHistory) · SLA (resolveTaskDisplayState) · saveProduction/ikUpload (funções intocadas) · routing (state.tab===) · storage (setItem). Light UI NÃO ativada; zero storage novo; zero função de negócio nova.

## 14 · Fechamento
Checkpoint único `899862a2` + push. Sem PR/merge/build/tag/release/deploy/bump. Roadmap: **I3L = ✔ GO · F12 = CONGELADA @ `6a677133` · I3M = ENTREGUE — AGUARDA OWNER · F13 = NÃO CONGELADA até GO explícito · etapa posterior = NÃO INICIADA.**

**Recomendação: GO** — skin por vars escopadas sobre o modal real intocado; upload por teclado corrigido com semântica nativa (filechooser real provado 1/1/1); todos os side effects stubados e contados com payloads literais; smoke 21/21.

**HARD STOP.** Nenhuma etapa posterior iniciada. Aguarda GO explícito do owner.
