# LIGHT UI — I3H.1 · F8 AGENDA — FUNCTIONAL HARDENING (ADENDO)

**Código testado:** `1cf13637` (checkpoint candidato) · **Branch:** `impl/light-ui-f8-agenda-1.0.246`
**Natureza da fase:** HARNESS/DOCS ONLY — **nenhuma linha de `desktop/src` alterada**.
**Resultado:** **I3H.1 = PASS · F8 = PRONTO PARA CONGELAMENTO DO OWNER · CHECKPOINT CANDIDATO = `1cf13637`.**

---

## GATE 1 — HEAD / higiene · PASS
HEAD `1cf13637` confirmado; worktree limpa; versão 1.0.246; Light UI inativa (classe só via
harness); F1–F7 congelados na cadeia (`c4c114e9` → `8e288c6b` → …); F9 não iniciado.

## GATE 2 — Auditoria literal dos seletores I3H · PASS
Fonte = diff literal do commit `1cf13637` (84 linhas adicionadas: 39 linhas-seletor CSS,
2 `@media`, 14 de comentário, 1 fechamento, 25 JS/comentário do `renderAgenda`, listadas
uma a uma no processo). Expandindo grupos com vírgula: **43 seletores individuais — 43/43
começam literalmente com `body.light-ui.desktop ` · 0 selector leakage · 0 global**
(inclui os 3 internos do `@media (prefers-reduced-motion)`; o `@media (max-width:1500px)`
contém apenas seletor gated). Guardas: 26 sob `#content:has([data-ag="vmonth"])`, 7 sob
`.sheet.ev-sheet`, 10 sob `.modal-back[data-evdmodal]` — todas com o prefixo completo
(forma exata exigida, sem equivalências estruturais). **`!important`: 8 ocorrências em 3
declarações**, todas contra styles inline do markup real: `.ag-tools > *{margin:0
!important}` (1); `[data-ag="new"]` background/height/border-radius (3); 
`[data-ag="togglecancel"]` margin-left/height/border-radius/background (4). Nenhum
seletor pode casar sem `body.light-ui.desktop`.

## GATE 3 — Legacy deep-state regression · PASS (9/9 = 0px puro)
BASE `c4c114e9` × CURRENT `1cf13637`, mesmos driver/modo/fixtures/relógio, **SEM
máscara**: {dark, light legacy, hc} × {A month aberta, B detalhe real
`.modal-back[data-evdmodal]` aberto, C form real `.sheet.ev-sheet` aberto} = **9 pares,
todos 0px**. O sino não aparece nessas capturas (a Agenda não é contexto de board
operacional — `isOperationalBoardContext`), logo a política A–E não foi necessária.
F8-LEGACY-LEAK: nenhum.

## GATE 4 — Write map completo (nomes literais reauditados) · PASS

| AÇÃO | HANDLER REAL | FIRESTORE OP | DOC ALVO | PAYLOAD | RBAC | CONFIRMAÇÃO | WRITES |
|---|---|---|---|---|---|---|---|
| Criar | `[data-ag="new"]`→`openEventForm()`→`[data-evsave]`→`saveEvent()` (branch `!evEditId`) | `add` em `events` | novo id | content(10: type/client/title/location/date/start/end/owner/ownerId/notes) + `by, done:false, createdAt, src:'webpreview'` = **14 chaves** | usuário autenticado | validação título+data (`#evErr`) | **1** |
| Editar | `[data-evedit]`→`openEventForm(id)`→`saveEvent()` (branch `evEditId`) | `update` em `events` | mesmo id | content(10) + `updatedAt, updatedBy` = **12 chaves** | usuário autenticado; gate visual `st!=='cancelled'` | validação idem | **1** |
| Iniciar | `[data-evstart]`→`evStart(id)`→`evLifecycle` | `update` | mesmo id | `{startedAt, startedBy}` = **2** | autenticado; gate `scheduled` | — | **1** |
| Finalizar | `[data-evfinish]` (pri em `in_progress`; menu ⋯ em `scheduled`)→`evFinish(id)` | `update` | mesmo id | `{done:true, doneAt, doneBy}` = **3** | autenticado; gate `scheduled\|in_progress` | — | **1** |
| Cancelar | `[data-evcancel]`→tela real de confirmação→`[data-evcancelyes]`→`evCancel(id)` | `update` | mesmo id | `{status:'cancelled', cancelledAt, cancelledBy}` = **3** | autenticado; gate `scheduled\|in_progress` | sim (tela do detalhe) | **0 antes · 1 depois** |
| Excluir | menu ⋯ `[data-evmore]`→`[data-evdelete]`→confirmação digitada→`[data-evdeleteyes]`→`evDelete`→`evDeletePermanent` | `update` + `delete` | mesmo id | `{deletedBy, deletedAt}` (2) e delete físico | **SÓ admin** (`state.user.admin` no render) | digitar `EXCLUIR` exato | **0 antes · 2 depois (semântica literal)** |

Nenhuma outra mutation real na superfície Agenda (navegação/filtros/busca/toggle/seleção
= zero write — já provado no smoke I3H g30 e re-confirmado aqui em toda a bateria).

## GATE 5 — Criar · PASS
Form real → `saveEvent` → **exatamente 1 `add` na coleção `events`, 14 chaves**, payload
completo validado campo a campo (título/cliente/tipo/data/início/término/local/
`ownerId:'tg'` + `owner:'Tatiana Gomes'` resolvido/notes/`by:'t1'`/`done:false`/
`createdAt`/`src:'webpreview'`); id gerado pelo add (comportamento real); **zero update ·
zero delete · zero write real** (file://, stub).

## GATE 6 — Editar · PASS
Entry real `Editar` no detalhe do `e1` → form **pré-preenchido pelo evento real** (7
campos verificados literalmente). Alterados título+local; salvo pelo MESMO `saveEvent` —
**branch `add × update` provado por `evEditId`**: **exatamente 1 `update` no MESMO doc
`e1`** (12 chaves), **zero add, zero delete, nenhum evento duplicado** (state e store com
1 único "Alinhamento de pauta"). Campos não editados preservados no payload (client/
start/end/ownerId/notes/date idênticos ao original). Read-back: não existe na
implementação real de `saveEvent` (documentado; o espelho local vem do `onSnapshot` em
produção). RBAC preservado.

## GATE 7 — Iniciar · PASS
`e1` scheduled expõe o CTA real (pri "Iniciar"); **1 write** `update e1 {startedAt:N,
startedBy:'t1'}` (2 chaves, nomes literais atuais); nenhum campo extra; aplicando o
patch real ao evento, `evStatus` deriva **`in_progress`**. CTA ausente em estados onde é
impossível (matriz Gate 12). Zero write real.

## GATE 8 — Finalizar · PASS
`e2` in_progress: primário real "Finalizar" (e SEM Iniciar); **1 write** `update e2
{done:true, doneAt:N, doneBy:'t1'}` (3 chaves — os campos atuais são `doneAt/doneBy`,
não "completedAt/By"); status derivado após mutation = **`completed`**; zero extras;
zero real.

## GATE 9 — Cancelar · PASS
Caminho real com a confirmação real do detalhe ("Cancelar este compromisso?"): **0
writes antes da confirmação**; após `[data-evcancelyes]`: **1 write** `update e4
{status:'cancelled', cancelledAt:N, cancelledBy:'t1'}`; o evento passa a ser interpretado
como cancelado **pela lógica real** (`evStatus`/`isEvCancelled` sobre o patch aplicado —
nenhum status inventado no harness); zero extras; zero real.

## GATE 10 — Excluir admin · PASS (semântica literal documentada)
**Não-admin (`ft`):** opção ausente no menu ⋯ (render condicionado a
`state.user.admin`); zero delete. **Admin:** menu ⋯ real → confirmação real com digitação;
**0 writes ao abrir a confirmação**; digitação errada (`excluir`) → erro "Digite
EXCLUIR…" e **0 writes**; digitação correta → **semântica LITERAL do
`evDeletePermanent`: 2 writes em sequência — 1 `update {deletedBy, deletedAt}` (para o
fan-out server-side `onEventDeleted` atribuir o ator) e 1 `delete` físico no doc
correto**; zero add; o update de autoria é esperado por projeto (difere do enunciado "1
delete apenas" — documentado conforme instruído); doc removido do store; zero write real.

## GATE 11 — Failure paths · PASS
Rejection simulada por stub em cada mutation:
- **Criar:** erro capturado pelo caminho real → `#evErr` visível ("Não foi possível
  salvar…"), form ABERTO, botão restaurado ("Salvar compromisso", flag `busy` limpa),
  evento NÃO criado; **retry após a falha funciona** (add ok, form fecha).
- **Editar:** idem ("Salvar alterações" restaurado; evento local intacto).
- **Iniciar/Finalizar/Cancelar (`evLifecycle` catch):** detalhe REABERTO com
  `.evd-err.show` (`role="alert"`), estado do evento inalterado, `_evBusy` liberado no
  finally → **retry possível e provado**.
- **Excluir — falha no 1º write (update):** **zero delete, doc intacto**, erro exibido.
- **Excluir — falha no 2º write (delete):** update de autoria aplicado e **doc
  permanece** (com `deletedBy`) + erro exibido — as 2 ops NÃO são atômicas
  (comportamento literal; o pior caso deixa o evento visível/recuperável e o retry
  disponível — **sem blocker funcional**; registrado para ciência do owner).
- Nenhuma UI declara sucesso em falha; nenhum 2º write espontâneo; nenhuma mutation
  parcial inventada pelo harness.

## GATE 12 — Status × CTA matrix (estados reais; labels reais) · PASS

| ESTADO REAL (`evStatus`) | CTA PRIMÁRIO | SECUNDÁRIOS | CANCELAR? | EDITAR? | EXCLUIR (admin)? | WRITE POSSÍVEL |
|---|---|---|---|---|---|---|
| `scheduled` (Agendado) | **Iniciar** | Editar · menu ⋯ (Finalizar) | SIM | SIM | SIM | start/finish/cancel/edit/delete |
| `in_progress` (Em andamento) | **Finalizar** | Editar | SIM | SIM | SIM (sem Iniciar; sem Finalizar duplicado no menu) | finish/cancel/edit/delete |
| `completed` (Finalizado) | — (Fechar) | Editar | **NÃO** | SIM (regra real: `st!=='cancelled'`) | SIM | edit/delete |
| `cancelled` (Cancelado) | — (Fechar) | — | **NÃO** | **NÃO** | SIM | delete |

Provado por DOM em 4 fixtures reais: **nenhum CTA impossível existe** (sem Iniciar fora
de scheduled; sem Finalizar fora de scheduled/in_progress; sem Cancelar/Editar em
cancelado; sem Cancelar em finalizado).

## GATE 13 — Correção documental · FEITA
No `LIGHT-UI-I3H-F8-AGENDA-REPORT.md`: (a) a frase "legado gera HTML byte-idêntico" foi
corrigida — os wrappers `.ag-tools/.ag-body/.ag-day` SÃO emitidos também no legado;
byte-identidade vale apenas para o span `.ag-count` (gated). Formulação correta: markup
funcional legado preservado; wrappers aditivos pixel-inertes sem Light UI; regressão
legacy comprovada 0px (incl. deep-state 9/9 desta fase). (b) contagem de `!important`
corrigida: 8 ocorrências em 3 declarações. Nenhum código alterado por causa disso.

## GATE 14 — F1–F7 · PASS
`desktop/src` inalterado nesta fase (worktree limpa; HEAD `1cf13637`); regressão visual
F1–F7 da I3H permanece válida por hash — não repetida por definição do gate.

---

**Resumo:** código testado `1cf13637` · nenhum app code alterado · selector audit
**43/43 gated (39 linhas-seletor), 0 leakage, 0 global, 8 `!important` localizados** ·
legacy deep-state **9/9 = 0px sem máscara** · write matrix completa com counts e payloads
literais · RBAC provado (admin × não-admin) · failure paths cobertos (9 casos) · CTA/status
matrix sem estados impossíveis · **zero writes reais de backend em toda a bateria** ·
correção documental aplicada · F1–F7 congelados · F9 não iniciado.

**I3H.1 = PASS · F8 = PRONTO PARA CONGELAMENTO DO OWNER · CHECKPOINT CANDIDATO = `1cf13637`.**
