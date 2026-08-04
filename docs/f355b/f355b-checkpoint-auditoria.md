# F3.5.5B — REDESIGN PREMIUM DA AGENDA E DOS COMPROMISSOS
## Checkpoint da Auditoria Read-Only (FASE 1) — Desktop 1.0.219

- **Base auditada**: Desktop 1.0.218 — branch `desktop/f355a-h1-edit-internal-notes-per-theme-1.0.218`, tip `1a94515` (baseline oficial fisicamente aprovada).
- **Branch da fase**: `desktop/f355b-premium-agenda-redesign-1.0.219` (criada a partir de `1a94515`).
- **Rollback imediato**: Desktop 1.0.218 (`v1.0.218` no Latest anterior). **Rollback adicional**: Desktop 1.0.216.
- **Método**: leitura direta do código real (`desktop/src/renderer/index.html`, `desktop/src/main/*`, `functions/index.js`, `cloudflare-worker.js`, `android-native/`), sem nenhuma edição.

---

## A. DADOS E REGRAS (itens 1–39)

1. **Modelo real do compromisso** — coleção Firestore `events`. Campos gravados pelo Desktop (`saveEvent`, index.html:5477-5482): `type, client, title, location, date, start, end, owner, ownerId, notes` + na criação `by, done:false, createdAt, src:'webpreview'`; na edição `updatedAt, updatedBy`. Lifecycle: `startedAt/startedBy` (Iniciar), `done/doneAt/doneBy` (Finalizar), `status:'cancelled'/cancelledAt/cancelledBy` (Cancelar), `deletedBy/deletedAt` gravados antes do hard delete (Excluir).
2. **ID** — doc id do Firestore (`e.id`, injetado no snapshot 2838).
3. **Título** — `title` (string; obrigatório no save: "Informe o título do compromisso.").
4. **Tipo** — `type` ∈ `TYPES` (2610-2612): `gravacao` (Gravação, #EF4444), `foto` (Fotografia, #F59E0B), `reuniao` (Reunião, #60A5FA), `edicao` (Edição, #A78BFA), `outro` (Outro, #9CA3AF); fallback `typeOf()` → `outro`.
5. **Status** — DERIVADO por `evStatus(e)` (5438): `cancelled` (status==='cancelled'||cancelledAt) → `completed` (done===true) → `in_progress` (+startedAt>0) → `scheduled`. Labels/cores por `evStatusMeta` (5439): Agendado #60A5FA, Em andamento #F59E0B, Finalizado #34D399, Cancelado #F87171.
6. **Cliente** — `client` (string livre, opcional).
7. **Data** — `date` string `YYYY-MM-DD` (validada por regex no save). É a fonte canônica do dia.
8. **Horário inicial** — `start` string `HH:MM` (input type=time), opcional.
9. **Horário final** — `end` string `HH:MM`, opcional.
10. **Local** — `location` (string, opcional).
11. **Responsável** — `ownerId` (uid ou null) + `owner` (nome denormalizado).
12. **Criador** — `by` (uid). Exibido no modal via lookup em `state.users`.
13. **Observações** — `notes` (string multiline, opcional).
14. **Links** — NÃO EXISTEM no modelo. (Regra do mandato: não inventar → o novo modal NÃO terá seção de links.)
15. **Anexos** — NÃO EXISTEM no modelo. (Idem: sem seção de anexos.)
16. **Histórico** — não há array `history`; o histórico factual é o trio de marcos `startedAt/doneAt/cancelledAt` (+ atores), já exibido hoje em linhas "Iniciado/Finalizado/Cancelado" com `evWhen()` (5442). Será mantido como linha do tempo discreta.
17. **Campos opcionais** — client, location, notes, start, end, ownerId/owner, updatedAt/updatedBy, marcos de lifecycle.
18. **Timezone** — não há timezone armazenado; `date/start/end` são strings locais e TODO o parse é manual/local: `dtMs` (2651) faz `split('-')`+`new Date(y,m-1,d,hh,mm)` (nunca `new Date('YYYY-MM-DD')` UTC). `todayStr()` (2653) idem local. **Regra desta fase: manter parse manual local — proibido `new Date(stringISO)` para a data do compromisso.**
19. **Fonte canônica de data/horário** — `e.date` + `e.start`/`e.end` (strings). `dtMs(e.date, e.end||e.start||'23:59')` para atraso (`eventLate`, 5425).
20. **Status disponíveis** — os 4 derivados (item 5). Não há outros.
21. **Regras para iniciar** — `evStart` (5494): patch `{startedAt:Date.now(),startedBy:uid}`; botão visível só `st==='scheduled'` (5531). Qualquer usuário autenticado.
22. **Regras para finalizar** — `evFinish` (5495): `{done:true,doneAt,doneBy}`; visível `scheduled||in_progress` (5532). Qualquer usuário.
23. **Regras para editar** — `openEventForm(id)`; visível `st!=='cancelled'` (5530). Qualquer usuário. Edição grava updatedAt/updatedBy e preserva by/createdAt/src/done (comentário 5433-5436).
24. **Regras para cancelar** — `evCancel` (5496): `{status:'cancelled',cancelledAt,cancelledBy}`; visível `scheduled||in_progress` (5533); exige TELA DE CONFIRMAÇÃO (`confirm==='cancel'`, 5520-5522: "Cancelar este compromisso para toda a equipe? Ele sai da agenda ativa (não é apagado).").
25. **Regras para excluir** — `evDelete` (5500): exige input `#evDelConfirm` com o texto exato `EXCLUIR`; senão erro em `#evDelErr` ("Digite EXCLUIR (em maiúsculas) para confirmar."). `evDeletePermanent` (5505): update `{deletedBy,deletedAt}` ANTES do `delete()` físico (para o fan-out atribuir o ator). Botão visível SÓ `state.user.admin` (5535), em qualquer estado.
26. **Permissões por perfil** — criar/editar/iniciar/finalizar/cancelar: qualquer usuário autenticado; excluir definitivamente: só Admin (`isAdmin`, 5517). NADA disso muda nesta fase.
27. **Eventos de notificação** — server-side: `functions/index.js` `onEventCreated` (events/{eventId}, linha 148) + fan-out em updates (comentário 5436: `onEventUpdated`); Desktop NÃO dispara push no cliente (comentário 5428-5432). Lembrete local: `desktop/src/main/reminder.ts` (57 linhas): escuta `events`, notifica na bandeja 1h antes de `dtMs(e.date,e.start)` (title + "date start"). Worker `cloudflare-worker.js` também lê `events` p/ lembretes/push (linhas 428/677/763). **Todos CONGELADOS — dependem de `date`/`start` no formato atual, que fica intacto.**
28. **Histórico de alterações** — updatedAt/updatedBy + marcos de lifecycle (sem log adicional). Sem mudança.
29. **Deep-link** — `notifRoute('agenda')` (4235) só troca a aba. Não há deep-link por compromisso. Sem mudança.
30. **Sincronização** — onSnapshot sem filtro (2838) → `state.events` → `renderFromSnapshot()`.
31. **Offline** — comportamento padrão do SDK compat (sem persistência explícita configurada aqui); falha de write → catch com `console.warn` + (form) mensagem "Não foi possível salvar…". Sem mudança.
32. **Listener** — `unsub.events` (2838). Sem mudança.
33. **Integração com "Hoje"** — `renderHoje` (5384): `todays` = `date===todayStr() && !done && !cancelled` (ordena por start); `future` = `date>hoje && !done && !cancelled` (ordena date+start, `slice(0,5)`); seções "Compromissos de hoje" e "Próximos compromissos", ambos via `eventCard`. Desktop: grid `.d-home` (CSS 412-419).
34. **Integração com "Agenda"** — `renderAgenda` (5554): visão Mês (calendarGrid + lista do dia selecionado) e visão Agenda (buckets Atrasados/Hoje/Próximos, 5582); busca `agSearch`, filtro por tipo `data-agf`, "Mostrar cancelados" (`agShowCancelled`, default oculta). TODAS as listas usam `eventCard` → **um único componente cobre todas as superfícies** (escopo item 3 satisfeito por construção).
35. **Integração com notificações** — item 27; nenhum produtor no card/modal. O redesign não adiciona nem remove notificações.
36. **Integração com relatórios** — `state.events` NÃO é usado em Relatórios (grep: usos apenas em 2838/5386/5390/5445/5515/5558). Sem impacto.
37. **Integração com o Executivo** — idem: nenhum uso. Sem impacto.
38. **Integração com portal** — o portal do cliente (share links) não serializa events; o Worker usa events só p/ push/lembretes (item 27). CONGELADO.
39. **Integração com Android** — `android-native/.../data/EventRepo.kt` + `EventFormActivity.kt` usam a MESMA coleção `events` (contrato EventContract). CONGELADO; contrato preservado por não alterar o modelo.

## B. CARD ATUAL (itens 40–64)

40. **Função** — `eventCard(e)` (5414-5424). Única produtora do card de compromisso.
41. **CSS** — `.evc` e filhos (177-186): flex, `bar` 4px (userColor do responsável; #F87171 se atrasado), avatar 40, `.ti` 17px/800, `.time .s` 16px/800 / `.e` 12px faint, `.meta` 13.5px com svg 16px, `.pill` (159) uppercase 10.5px.
42. **Data exibida** — **AUSENTE**. O card NUNCA mostra `e.date` — só horários. Em "Próximos compromissos" (dias futuros) o usuário não vê QUANDO será sem clicar. **Causa exata do problema físico nº 1 do mandato.**
43. **Horário** — start 16px/800 à direita; end 12px apagado abaixo. Sem separador visual "—"; end vazio deixa um div vazio.
44. **Título** — `.ti` 17px/800 SEM line-clamp: título longo cresce sem limite (sem corte, mas estoura altura e compete com o horário à direita).
45. **Cliente** — meta line com ícone `person` (quando existe).
46. **Local** — meta line com ícone `place` (quando existe).
47. **Responsável** — nome COLORIDO (userColor) sob o título + avatar 40 à esquerda. O nome aparece 1×, mas a cor forte + avatar grande competem com o título.
48. **Avatar** — `avatar(owner,40)` com ring `userColor`; sem responsável → círculo com iniciais vazias na cor `UCOLORS[0]` (#F87171 — colide com o vermelho de atraso).
49. **Status** — pill SÓ para `in_progress`/`completed` (5419). `Agendado` NUNCA aparece; `Cancelado` (visível via toggle na Agenda) fica SEM chip. Violado o requisito "chip elegante p/ 4 estados".
50. **Cor lateral** — `bar` 4px = userColor(responsável); #F87171 quando `eventLate` (atrasado e não concluído).
51. **Chips** — tipo (sempre) + status (parcial). `pill` uppercase 10.5/800.
52-53. **Altura/Largura** — altura livre (min-height 46 do bar); largura 100% da coluna (`.d-home` 1.4fr/1fr; ≥1360px: 3 colunas).
54. **Overflow** — `.main` tem `min-width:0` (ok), mas `.ti` sem clamp e `.meta` sem ellipsis: local/cliente longos QUEBRAM em várias linhas (nada corta, mas o card incha — "informação espremida").
55. **Line-clamp** — inexistente no card inteiro.
56. **Textos longos** — título/cliente/local crescem verticalmente sem limite; nome do responsável idem.
57. **Escalas 100/125/150%** — nenhum tratamento específico; tudo em px relativos ao zoom do Chromium (escala multiplicativa). Sem quebra conhecida, mas sem prova. Provas desta fase cobrirão zoom 1.25/1.5.
58-59. **1366×768 / 1920×1080** — `.d-home` 2 col <1360px, 3 col ≥1360px. Provas cobrirão ambas as resoluções.
60. **Máximo de cards** — Hoje: todos os de hoje + 5 futuros (slice(0,5), 5390). Agenda: sem limite.
61. **Rolagem** — página `.scr` rola; sem scroll interno no card.
62. **Clique** — card inteiro `data-evdetail` → `openEventDetail(id)` (dispatcher 10297). `cursor:pointer` inline.
63. **Estado selecionado** — inexistente (não há seleção persistente). Sem mudança.
64. **Acessibilidade** — **NENHUMA**: div sem role/tabindex/aria-label; não focável nem acionável por teclado; hover inexistente.

## C. MODAL ATUAL (itens 65–84)

65. **Função** — `openEventDetail(id, confirm)` (5514-5549); `confirm` ∈ {undefined, 'cancel', 'delete'}.
66. **Estrutura** — `.modal-back[data-modalbg] > .sheet` genérico (max-width 480px desktop, 1131) com `grab` mobile; conteúdo = pills + título + LINHAS DE TABELA (`row(lbl,val)`, 5518: label 110px + valor) + ações.
67. **Cabeçalho** — pills de tipo+status e título 19px/800; SEM botão fechar isolado (fechar é um `.btn ghost` no meio da fileira de ações).
68. **Data** — `row('Data', e.date)` → **EXIBE BRUTO `2026-08-10`**. Causa exata do problema físico nº 2.
69. **Horários** — `row('Início', e.start)` + `row('Término', e.end)` em linhas separadas de tabela; sem duração.
70. **Informações** — Cliente/Data/Início/Término/Local/Responsável/Criado por/Iniciado/Finalizado/Cancelado/Observações, todas como linhas iguais (formulário técnico; observações multiline SEM `pre-wrap` — quebras de linha do usuário são achatadas).
71. **Botões** — fileira única `del-actions` com flex-wrap (5537): até 6 botões (Editar/Iniciar/Finalizar/Cancelar/Excluir definitivamente/Fechar), TODOS `.btn` flex:1 height 46 — mesmo peso; 2 destrutivos vermelhos lado a lado das ações principais. Causa exata dos problemas "excesso de botões no mesmo nível" e "ações destrutivas com peso excessivo".
72. **Permissões** — gates por status (5530-5533) + `isAdmin` p/ excluir (5535). Preservação obrigatória 1:1.
73. **Confirmação de exclusão** — tela própria com aviso permanente + input `#evDelConfirm` (digitar `EXCLUIR`) + `#evDelErr` + Voltar/Excluir definitivamente (5523-5527). Preservada.
74. **Confirmação de cancelamento** — tela própria Voltar/"Sim, cancelar" (5520-5522). Preservada.
75-77. **Estados em andamento/finalizado/cancelado** — pills + linhas de marcos com `evWhen`+ator (5543-5545); cancelado esconde Editar e lifecycle.
78. **Esc** — **NÃO fecha** (handler 10061 fecha só `[data-detmodal]`).
79. **Focus trap** — **inexistente** (só a Central de Detalhes tem, `detSetupModalFocus` 7264).
80. **Retorno de foco** — **inexistente** para este modal (`_detReturnEl` é setado só por `openDetails`; `closeModal` 8981 devolve genericamente quando setado).
81. **Rolagem** — `.sheet` max-height 88vh overflow:auto (288). OK.
82. **Responsividade** — sheet 480px desktop / bottom-sheet mobile; linhas de 110px de label podem espremer valores longos.
83. **Carregamento** — evento não encontrado → `return` silencioso (5515). Mantido.
84. **Erro** — `evLifecycle`/`evDeletePermanent` em falha: `console.warn` + reabre o detalhe **SEM NENHUMA MENSAGEM** ao usuário. O novo modal ganhará linha de erro discreta ("Não foi possível concluir a ação. Verifique a conexão e tente novamente.") ao reabrir após falha — sem mudar a regra (mesmo catch, mesmo reopen).

## D. ARQUIVOS (itens 85–89)

85. **Arquivos realmente necessários** — SOMENTE `desktop/src/renderer/index.html` (CSS do card/modal + `eventCard` + `openEventDetail` + helpers novos + handlers aditivos) e `desktop/package.json`/`package-lock.json` (versão 1.0.219). Suporte: `desktop/scripts/f355b-*` (suíte+provas), pins herdados (f355a-integration/orchestrator/wh2/vh1/f355ah1), workflows `desktop-build-f355b.yml`/`desktop-release-f355b.yml`, `docs/f355b*/`.
86. **Byte-idênticas (congeladas nesta fase)** — no próprio index.html: `evStatus`, `evStatusMeta`, `isEvCancelled`, `evActorName`, `evWhen`, `eventLate`, `saveEvent`, `evLifecycle`, `evStart`, `evFinish`, `evCancel`, `evDelete`, `evDeletePermanent`, `openEventForm` (formulário FORA do escopo visual desta fase), `renderAgenda`/`calendarGrid`/`afterAgenda`, `renderHoje` (estrutura de dados/filtros/ordenações intactas — muda só o HTML dos cards que ela já monta via `eventCard`), dispatcher de cliques `data-ev*` (aditivo apenas). Arquivos 100% intocados: `desktop/src/main/**` (inclui `reminder.ts`), `desktop/src/preload/**`, `bgnotify.html`, `slareminder.html`, `sounds/`, `priorityEngine.js`, `copy-renderer.js`, `tsconfig.json`, `cloudflare-worker.js`, `functions/`, `android-native/**`, `android-native-beta/**`, Firestore Rules, schema.
87. **Backend necessário?** — **NÃO.** Todos os dados exigidos pelo novo layout já existem (`date/start/end/title/client/location/owner/ownerId/by/notes/status derivado/marcos`). Duração = calculada localmente só quando start/end válidos e end>start. Nenhum campo novo, nenhuma migração, nenhuma mudança de Rules/Worker/Functions.
88. **Risco de regressão** — (a) quebra do contrato de clique `data-evdetail` → mitigado: atributo preservado no novo card; (b) perda de ação/gate no modal → mitigado: mesmos `data-ev*`, mesmos predicados de status/admin, testados 1:1; (c) confirmação de exclusão (ids `evDelConfirm`/`evDelErr` lidos por `evDelete`) → ids preservados; (d) formatação de data errada por UTC → parse manual `split('-')` (proibido `new Date(string)`); (e) tema claro/HC → só tokens `var(--…)` + cores semânticas já usadas hoje; (f) `_editingNow`/defer de render → confirmações mantêm inputs (defer continua funcionando), detalhe sem inputs (render segue não tocando o modalRoot, que fica fora de `#app`); (g) lembrete 1h/Functions/Android → intocados (dependem só de dados, não de UI).
89. **Plano de rollback** — rollback imediato: release `v1.0.218` (Latest anterior preservado); adicional: `v1.0.216`. Publicação nova só via release pinada com pós-verificação de preservação das versões anteriores.

---

## CAUSA DOS PROBLEMAS VISUAIS (diagnóstico consolidado)

1. **Data ausente no card**: `eventCard` nunca renderiza `e.date` (item 42).
2. **Horário sem hierarquia**: start/end são dois números soltos à direita, sem faixa "14:00 — 16:00" e sem tratamento de end vazio (item 43).
3. **Excesso competindo**: título 17/800 + nome colorido + avatar 40 + até 3 meta lines + 2 pills no mesmo peso visual (itens 44-51).
4. **Modal amador**: tabela label/valor uniforme, data bruta `2026-08-10`, 6 botões de mesmo peso com destrutivos misturados, sem fechar isolado, sem Esc/foco (itens 66-80).
5. **Acessibilidade zero no card** (item 64) e parcial no modal.

## PROPOSTA VISUAL (o que será implementado)

**Card premium (`eventCard` novo, classes `evc`/`evc2-*`)** — data-first:
- **Bloco de data** à esquerda (sempre visível): `DOM` / `10` / `AGO` (+ ano pequeno quando ≠ ano corrente), derivado de `e.date` por parse manual local; fundo `var(--surface2)`, borda `var(--line-soft)`.
- **Linha de horário**: ícone `clock` + `14:00` forte + `— 16:00` secundário; sem end → só início; sem start → linha omitida (nada inventado).
- **Chip de status** (4 estados, dot+texto, cores `evStatusMeta`) — inclusive Agendado e Cancelado.
- **Título** 14.5px/750, `-webkit-line-clamp:2` + ellipsis.
- **Cliente** e **Local** em meta lines com ellipsis de 1 linha (ícones `person`/`place` 15px).
- **Rodapé**: avatar 22 + nome do responsável (1×, neutro) + chip do tipo à direita (cor do tipo).
- **Identidade**: trilho lateral 3px = `userColor(responsável)` (mantém a semântica atual; #F87171 quando atrasado — sinal preservado); sem responsável → trilho neutro `var(--line)`.
- **Acessibilidade**: `role="button"`, `tabindex="0"`, `aria-label` (título+data+horário), Enter/Espaço abre, `:focus-visible` com anel, hover discreto (desktop) com `prefers-reduced-motion` respeitado.

**Modal premium (`openEventDetail` novo, classes `evd-*`, sheet `evd-sheet` ~560px)**:
1. Cabeçalho: chip do tipo + chip de status à esquerda; **X isolado** no canto (aria-label "Fechar"); título 19px/750 + linha do cliente.
2. **Bloco principal de data/horário**: `DOMINGO` (eyebrow) + `10 de agosto de 2026` (destaque) + `14:00 — 16:00` + `Duração: 2 horas` SÓ quando calculável (start/end válidos e end>start). Nunca data bruta.
3. **Resumo operacional** em grid 2 colunas (labels discretas/valores legíveis): Cliente · Local · Responsável (avatar+nome) · Criado por · Tipo · Status — células vazias omitidas.
4. **Observações**: seção própria com `white-space:pre-wrap` (parágrafos preservados; `esc()` sempre) — omitida quando vazia. (Links/Anexos: não existem no modelo → sem seção; documentado.)
5. **Linha do tempo** discreta (Iniciado/Finalizado/Cancelado + ator/`evWhen`) quando existir.
6. **Ações hierarquizadas** (mesmas ações, mesmos gates, mesmos `data-ev*`):
   - PRIMÁRIA (accent): `Iniciar` (scheduled) / `Finalizar` (in_progress).
   - SECUNDÁRIA (ghost): `Editar`; `Cancelar` (ghost com tom destrutivo sutil, quando aplicável).
   - **Mais opções (⋯)**: menu discreto com as ações menos frequentes — `Finalizar` a partir de scheduled e `Excluir definitivamente` (só Admin, tom destrutivo); botão ⋯ omitido quando o menu ficaria vazio.
   - FECHAR: X no cabeçalho + `Fechar` discreto no rodapé apenas quando não há primária (finalizado/cancelado).
   - Confirmações preservadas 1:1 (cancelar: Voltar/"Sim, cancelar"; excluir: digitar `EXCLUIR` em `#evDelConfirm`), com visual de aviso adequado.
7. **Erro**: linha `#evdErr` exibida quando `evLifecycle`/`evDeletePermanent` reabrem após falha.
8. **Acessibilidade**: `role="dialog" aria-modal`, foco inicial no X, trap de Tab (`evdSetupModalFocus`, espelho do padrão da Central), Esc fecha (em confirmação, Esc = Voltar ao detalhe), retorno de foco ao card de origem (mecanismo `_detReturnEl` + `closeModal` existente).

**Ícones** — reutilizar o set `ICON` existente (24×24, stroke 2, currentColor): calendar, clock, place, person, notes, editnote, check, trash, close, arr. Adicionar NO MESMO estilo: `play` (Iniciar), `ban` (Cancelar), `dots` (Mais opções). Zero emoji operacional; aria-label/title em todos os botões de ícone.

**Tipografia** — família do app (system stack já empacotada); sem fonte externa. Hierarquia: dia 20px/800; data por extenso 17px/750; horário 15px/700; título card 14.5px/750 (2 linhas); labels 10px/800 uppercase +.05em (padrão `.lbl` existente); valores 13.5px/500-600; nada 100% bold, nada tudo caps.

**Temas** — apenas tokens `var(--bg/--surface/--surface2/--line/--line-soft/--ink/--soft/--faint/--accent)` + cores semânticas de status/tipo já vigentes → compatível com dark, light e alto contraste sem trabalho extra.

## FUNÇÕES/ÁREAS CONGELADAS NESTA FASE
Lista integral no item 86 + todas as do mandato (Acompanhamento OFF/SOMBRA/ACTIVE, alertas, sons, check-in, notificações, fila central, prioridade, cards de tarefas, Central de Detalhes, observações internas, Aprovar tudo, auth, autostart, vídeos, criação/edição de tarefas, drag-and-drop, Mover, sino, histórico, Minhas Prioridades, Monitor SLA, watchdog, tray, atualizador, portal, Worker, Functions, Rules, schema, Android). Verificação por diff-quiet no CI contra `1a94515` + suíte de regressão integral.

## RISCOS E MITIGAÇÕES
Item 88 + gates do CI: isolamento por allowlist de arquivos, congelados diff-quiet, marcadores, gate no app EMPACOTADO (asar), 3 harnesses de provas reais (f355b novo + f355ah1 + f355a-execution herdados), pipeline verde obrigatório antes de qualquer publicação.

## PLANO CIRÚRGICO (ordem de execução)
1. Versão 1.0.219 + description em package.json/lock.
2. CSS: substituir o bloco `.evc` (177-186) pelo novo conjunto `evc2-*` (escopado) + novo bloco `evd-*` junto aos estilos de sheet; ícones `play/ban/dots` no mapa `ICON`.
3. `eventCard` novo (mesmo contrato `data-evdetail`).
4. Helpers novos namespaced: `evDateParts`, `evDateFull`, `evTimeRange`, `evDurationText`, `evdSetupModalFocus`, `_evdErr`.
5. `openEventDetail` novo (mesmos gates/atributos/ids; + `data-evdmodal`, X, menu ⋯, erro, foco).
6. Aditivos: captura de `_detReturnEl` ao abrir; extensão do handler de Escape (evd: confirmação→Voltar, detalhe→fechar); Enter/Espaço no card; handler `data-evmore` (abre/fecha menu) no dispatcher.
7. `evLifecycle`/`evDeletePermanent`: NENHUMA mudança de regra — apenas setar `_evdErr` antes do reopen já existente no catch.
8. Suíte `f355b-agenda-premium.test.mjs` (30 cards + 35 modal + isolamento/pins) + atualização dos pins herdados p/ 1.0.219.
9. Provas reais empacotadas (20 cenas) + manifest → `docs/f355b-qa/`.
10. Workflow de build gated (--publish never) → CI verde → workflow de release pinado → Latest → relatório 46 itens → GO técnico → STOP.

**Decisões registradas**: sem seção Links/Anexos (não existem no modelo — nada inventado); observações saem do card (ficam no modal, conforme estrutura do mandato); `Fechar` de rodapé só quando não há ação primária (X sempre presente); menu ⋯ nunca mostra ação indisponível; nenhuma mudança no formulário Novo/Editar compromisso (fora do escopo visual definido).
