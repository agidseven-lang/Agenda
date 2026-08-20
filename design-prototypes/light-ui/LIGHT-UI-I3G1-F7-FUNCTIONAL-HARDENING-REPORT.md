# LIGHT UI — I3G.1 · F7 FUNCTIONAL HARDENING — ADENDO

**Objetivo:** fechar os dois hard gates funcionais pendentes do F7 (edição real; batch real de
Cards + atomicidade) **sem alterar o visual aprovado e sem alterar produção**.
**Base:** `c4c114e9` (HEAD confirmado; worktree limpa; 1.0.246; Light UI inativa).
**Método:** harness-only — modos novos `edit` / `batch` / `batchfail` no `f7_driver.js`
(scratchpad; nunca versionado), com stub firestore de semântica REAL: `update` com merge (para o
read-back), `batch.set` acumula e **só o `commit` aplica (tudo-ou-nada)**, flag de falha de
commit, contador de todas as escritas. Zero rede (file://); zero write real.

---

## RESULTADO

| # | Gate | Resultado |
|---|------|-----------|
| 1 | EDIT MODE | **PASS** (22/22) |
| 2 | SAVE TASK (edição → gravação real) | **PASS** |
| 3 | CARDS BATCH | **PASS** (16/16) |
| 4 | BATCH ATOMICITY | **PASS** (5/5 no failure path) |
| 5 | ZERO REAL WRITES | **PASS** (todas as escritas no stub; file:// sem rede) |
| 6 | Produção alterada? | **NÃO** — `desktop/src/renderer/index.html` intocado |
| 7 | Hash final de código | **`c4c114e9`** (inalterado) |

**I3G.1 = PASS · F7 = READY FOR OWNER FREEZE · CODE CHECKPOINT = `c4c114e9`.**
F1–F6 continuam congelados; Light UI inativa; 1.0.246 intacta. F8 NÃO iniciada.

---

## A · Edição real (openCardsEdit → saveCardsEdit) — 22/22

- **Entry point real:** Central de Detalhes (modal default, caminho real `detail/<id>`) →
  botão "Editar tarefa" (`data-cardedit`, gate `canSeeAll` + setor `edicao_cards`) →
  `openCardsEdit` (o mesmo botão existe no menu ⋯ do card kanban — mesma delegação 13634).
- **Modo edição provado:** `state.form.id==='kc1'`; form FACTORY-FRESH (`newForm` + fill,
  contrato F3.4.3D/E); **`_draftId===null`** (o identificador de criação idempotente NÃO
  participa da edição — o fluxo usa o PRÓPRIO id da task); entrada direto no passo Dados
  (`step 1`) com stepper real (Setor `done`, Dados `on`); header "Editar tarefa".
- **Pré-preenchimento real:** cliente "Hospital Visão"; responsável `ft` (picker mostra
  "Felipe Teodozio"); briefing com tema/legenda/obs e Início `2026-08-21 09:00` /
  Término `2026-08-22 18:00` (fallbacks reais `cardTema||title`, `cardsFieldOf`).
- **Quantidade TRAVADA por MODO EDIÇÃO** — provado o estado específico: `#fCardsQty` com
  `disabled` + `value="1"` + `title="Edição de tarefa existente — quantidade fixa"`.
  **Distinguido do disabled do "−" por N=1:** o setor Cards nem renderiza stepper de
  quantidade (`[data-cqminus]/[data-vqminus]/[data-sqminus]` ausentes) — são estados
  funcionais diferentes e o gate cobre ambos os lados.
- **Navegação:** Voltar→Dados e Avançar→Briefing preservando estado; Revisão com 1 card e
  CTA literal **"Salvar alterações"**.
- **Gravação real (mecanismo documentado):** `db.collection('tasks').doc(f.id).update(patch)`
  → **read-back do prazo** (`get` + comparação `dueDate/dueTime/cardDeadlineRev`; falha →
  alerta e NADA declarado salvo) → `Object.assign(t,fresh)` reflete o servidor no estado
  local. No harness: **exatamente 1 `update` em `kc1`; ZERO `set/add/batch`; contagem do
  store inalterada — nenhuma task duplicada.**
- **Payload final (patch de 26 chaves; alterados tema+prazo):** `title`/`cardTema` novos;
  `dueDate 2026-08-24`/`dueTime 12:00` (+`due`, `endDate/endTime`, `dueAt/startAt` ms);
  **`cardDeadlineRev: 1→2`** e **`deadlineVersion: 0→1`** (prazo mudou);
  `updatedAt/updatedBy('t1')/updatedByName`; `history` **arrayUnion ADITIVO**
  `{kind:'edited', fields:['titulo','prazo'], prevDueDate:'2026-08-22',
  newDueDate:'2026-08-24', forId:'ft', …}`; `designerAssignment` com o INTERVALO atualizado
  e a IDENTIDADE preservada (`designerId:'ft'`, `assignedBy:'tg'` original — sem
  reatribuição, como o código promete).
- **Campos preservados (ausentes do patch):** `by`, `createdAt`, `status`, `checklist`,
  `src`, `internal` — e o doc final no stub mantém `by:'tg'` e o `createdAt` original com o
  prazo novo aplicado.
- Pós-save real: `state.form=null` + board `edicao_cards`.

## B · Batch real (saveCardsBatch, N=3) — 16/16

- **Fluxo 100% real:** wizard → setor "Edição de Cards" (admin `canCreateCards`) → Dados
  (cliente "MovOn", quantidade **3**, designer `ft` escolhido pelo **modal real**
  `data-pickasg`) → Briefing (3 cards completos: tema + início/término data+hora) →
  Revisão com CTA literal **"Criar 3 tarefas"** e 3 itens → submit.
- **`saveCardsBatch` realmente chamado** (rota `data-form="save"` + setor cards sem `f.id`);
  **NÃO convertido em saveTask**: zero `set/add/update/delete` soltos.
- **Operações:** exatamente **3 `batch.set`** (cada uma com `db.collection('tasks').doc()`
  novo → ids distintos `auto1/auto2/auto3`) + **exatamente 1 `batch.commit` (n=3)** —
  atômico por construção.
- **Campos comuns às 3 tasks:** `client:'MovOn'` · `sector:'edicao_cards'` ·
  `status:'afazer'` · `assigneeId/designerAssignment.designerId:'ft'` ·
  `designerAssignment.assignedBy:'t1'` · `by:'t1'` · `src:'webpreview'` ·
  `createdAt:N` (timestamp congelado do harness) · `internal:true` ·
  `cardsBatchId` ÚNICO compartilhado (`cards_<ts>_<rand>`) · `cardsBatchTotal:3` ·
  `cardDeadlineRev:1` · `designerFlowStatus:'afazer'`.
- **Campos que diferem:** `cardIndex 1,2,3` · `title/cardTema` próprios · intervalos e
  `dueAt` distintos (3 valores) · `desc` só onde há legenda (card 1).
- **Semântica de setor interno provada por AUSÊNCIA:** sem `workflowPhase`, sem
  `cronStatus`, sem `clientFlowStatus`, sem `clientReviewToken`, sem `designerSla` (fora do
  motor de SLA congelado). Sem `socialOwnerId` quando o criador é CEO/admin (regra real
  `isSocialUser`).
- **Tabela (sem duplicação inválida):**

| TASK | ID | tipo | cliente | resp | status | designerFlow | idx | tema | prazo |
|---|---|---|---|---|---|---|---|---|---|
| 1 | auto1 | edicao_cards | MovOn | ft | afazer | afazer | 1/3 | Card 1 — arte do feed | 2026-08-22 18:00 |
| 2 | auto2 | edicao_cards | MovOn | ft | afazer | afazer | 2/3 | Card 2 — arte do feed | 2026-08-23 18:00 |
| 3 | auto3 | edicao_cards | MovOn | ft | afazer | afazer | 3/3 | Card 3 — arte do feed | 2026-08-24 18:00 |

## C · Failure path do batch — 5/5 (atômico)

- Stub com `commit` REJEITANDO (semântica Firestore: nada aplicado antes do commit).
- Provado: `batch.commit` falhou → **0 de 3 docs persistidos** (nenhum id no store;
  contagem inalterada) — **não fica 1 nem 2 cards**; nenhum estado parcial.
- Comportamento real do catch: alerta literal "Não foi possível criar as tarefas. Verifique
  a conexão e tente novamente **(nada foi criado)**."; `state.form` PRESERVADO no passo
  Revisão com os 3 cards preenchidos (o usuário pode tentar de novo); `_saving=false`
  (retry não fica travado). **A atomicidade é do próprio `db.batch()` do código real — 
  nenhuma correção foi necessária.**

## D–F · Confirmações

- **Visual aprovado intocado** (nenhuma linha de CSS/markup alterada nesta fase).
- **Produção intocada:** `git status` limpo; HEAD `c4c114e9`; F1–F6 congelados; Light UI
  inativa; 1.0.246 intacta. Sem PR/merge/build/tag. Regressão visual da I3G permanece
  válida (nenhuma alteração de app após ela).
- Provas no chat: F7-EDIT-MODE-1920.png (edição real pré-preenchida com quantidade travada)
  · F7-CARDS-BATCH-REVISAO-1920.png (revisão do lote pós-submit provado).

**STOP.** Aguarda GO explícito do owner para o freeze do F7 e para a I3H · F8 Agenda.
