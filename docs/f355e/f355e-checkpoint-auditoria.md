# F3.5.5E — CHECKPOINT DA AUDITORIA READ-ONLY (A/B/C — 58 itens)

Base auditada: Desktop 1.0.223 (baseline fisicamente aprovada) @ 217ed0622993acced1a20b72ba677e9d17ed2f03.
Nenhum arquivo foi alterado durante esta auditoria.

## A. MÓDULOS RETIRADOS (itens 1–20)

1. **IDs canônicos (comprovados no código, nunca texto visual)** — `desktop/src/renderer/index.html:2763-2776`:
   - `copywriting` (alias legado `copy`) — JÁ possui `descontinuado:true` desde F3.3.71C7;
   - `roteiro` (sem alias);
   - `programacao_posts` (alias legado `postagem`).
   `SECTOR_ALIAS={design:'edicao_midia',copy:'copywriting',postagem:'programacao_posts'}` (2776).
   **Risco crítico mapeado:** `secOf()` (2777) tem fallback `SECTORS[0]` (= `edicao_midia`) para chave
   desconhecida ⇒ as DEFINIÇÕES dos 3 setores DEVEM permanecer no array `SECTORS` (labels/cores para
   histórico), exatamente como o precedente F3.3.71C7 documenta ("A definição permanece para tarefas
   HISTÓRICAS"). A retirada é por FLAG + GATES, nunca por remoção da definição.
2. **Templates**: `TEMPLATES.copywriting` (2806, subtipos de Periodicidade), `TEMPLATES.roteiro`
   (2814-2818, q4/q6/q8/q12 + stepper scriptQty da F3.5.5C), `TEMPLATES.programacao_posts` (2819).
   Ficam INERTES (inalcançáveis) — remoção física descartada por risco (pins herdados f355c/f355d e
   renderização residual defensiva); não são "referência visual" nem "rota acessível".
3. **Rotas/deep-links**: `notifRoute` (`detail/<id>`, `board/<setor>`) + `openTaskForm(sector)`
   (10169 — já bloqueia descontinuado) + `openDetails(taskId)` (7584 — hoje `if(!t)return;` SILENCIOSO
   para tarefa fora do state ⇒ precisa da mensagem de descontinuado).
4. **Quadros**: `renderHub` linha 5908 — `SECTORS.map` SEM filtro de descontinuado ⇒ os 3 aparecem
   (evidência física do owner confirmada no código). Nova tarefa (10398) JÁ filtra
   `!s.descontinuado` (por isso Copywriting já não aparece lá — bate com a evidência).
5. **Formulários**: `stepSector` filtra descontinuado; salvar não tem gate defensivo por setor (será
   adicionado).
6. **Contadores**: todos derivam de `state.tasks` (cards dos quadros 5908; "N tarefas"; pills).
7. **Filtros**: chips/eixo por quadro usam `state.tasks` filtrado por setor do quadro.
8. **Busca**: apenas `boardQuery` por quadro (não há busca global) — deriva de `state.tasks`.
9. **Relatórios**: `renderReports` (5374) — deriva de `state.tasks`.
10. **Prioridades**: `priBuildItems(state.tasks, me)` (5072/5177) — deriva de `state.tasks`.
11. **Alertas**: `notifScanSla` (renderer, varre `slaibVisible(state)`); `SECTOR_SLA` (3406-3410) SEM
    entrada para copywriting/programacao_posts ⇒ caem no DEFAULT `designerSla:true` 30/10 — tarefa
    histórica desses setores com designer PODE emitir SLA hoje (lacuna real). Roteiro já é
    `designerSla:false` + skip explícito (4673). Modal central: `slaReminder.ts` (CONGELADO H2) recebe
    via HUB; revalidação H2 usa `taskGate` definido em `main.ts:985` (EDITÁVEL) sobre `slaTaskMap`
    (listener PRÓPRIO do main, 806-827 — independente de `state.tasks` do renderer).
12. **Notificações**: dois produtores — renderer (`notifScanFlow`/atribuições, varre `state.tasks`) e
    main (`notifierA.ts:85` → `notifEvents.deriveTaskEvents` por doc do listener durável). Gates
    necessários nos DOIS.
13. **Portal**: Desktop envia ao cliente só por superfícies operacionais (que deixarão de listar os
    retirados) ⇒ nenhum link novo possível.
14. **Worker**: `cloudflare-worker.js` tem perfil específico `roteiro` (61 refs — OG/labels/render
    tema+legenda dos LINKS EXISTENTES); copywriting/programacao_posts: 0 refs. DECISÃO: Worker
    INTOCADO nesta fase — o perfil serve exclusivamente links históricos já emitidos (preservação do
    registro histórico; "não quebrar o Worker de forma geral"); nenhum link novo será criável; ciclo
    de vida existente (expiresAt/revoked) permanece. Recomendação documentada (não executada): gate
    opcional futuro de "módulo descontinuado" no Worker SE o owner confirmar links órfãos ativos de
    roteiro que não deva mais expor.
15. **Functions**: 0 referências aos módulos ⇒ intocadas.
16. **Rules**: nenhuma regra específica por setor comprovada ⇒ intocadas (condição do mandato).
17. **Android**: 0 referências aos 3 módulos em `android/app/src` ⇒ intocado.
18. **Dados históricos**: precedente EXATO já aprovado — `pwaCutoffFilter` (3053-3073): "legado ⇒ NÃO
    entra no state (nada é apagado no Firestore)" + contador sanitizado + console info. O filtro de
    retirados espelha 1:1 esse padrão (drop do state + contagem + log; ZERO delete; ZERO write).
19. **Tarefas ativas nos módulos**: contagem REAL em produção NÃO é mensurável deste ambiente (sem
    credenciais Firestore de produção). Honestidade obrigatória: o relatório registrará contagem
    LOCAL sanitizada por módulo no runtime (o filtro conta e loga `window.__retiredCutoff` por setor,
    sem conteúdo) + instrução administrativa de contagem/recuperação read-only fora do fluxo
    operacional (query por `sector in ['copywriting','copy','roteiro','programacao_posts','postagem']`).
    Nenhum status será alterado; nenhuma conclusão automática.
20. **Links existentes**: shareLinks históricos permanecem no banco (item 14); sino/histórico local
    preservado (entradas antigas não são recomputadas).

## B. NOTIFICAÇÕES IMEDIATAS (itens 21–45)

21. **Produtores**: renderer `notifScanFlow` (flow_*) + atribuições (task_assigned/designer_assigned)
    + main `notifierA` → `notifEvents.deriveTaskEvents` (task_moved/completed/reopened/updated/
    assigned/help/blocked) — eventos canônicos duráveis com eventId determinístico.
22. **Payload canônico**: `notifBuildPayload` (renderer 4265) e `buildCategoryAPayload`
    (main notifEvents.js ~300): eventId/dedupKey, eventType, taskId, taskTitle, clientName, actor*/
    responsible*, title/subtitle/body/context, fromStatus/toStatus, sector, severity, sound, action
    (deep detail/<id>), createdAt.
23. taskId: presente e correto (deep-link atual preservado).
24-25. **Cliente — CAUSA EXATA PROVADA**: modelo real NÃO tem `clientId` em tarefas (0 ocorrências).
    Fonte canônica = SNAPSHOT salvo na tarefa: `t.client` (string; obrigatório em setores-cliente).
    O produtor MAIN grava `clientName: ''` FIXO (`notifEvents.js:320`) ⇒ toasts task_* (os mais
    comuns) NUNCA mostram cliente. O produtor renderer já envia `t.client`. Ordem canônica aplicável:
    (1) id canônico — inexistente no modelo; (2) snapshot `t.client` — ADOTADO; (3) fallback seguro
    "Sem cliente vinculado". Proibido inferir por título — nada no pipeline usa título como cliente.
26. **Autor**: resolvido por `resolveNotificationActorProfile`/`resolveUserIdentity` (diretório +
    denormalizado); hoje é a LINHA DOMINANTE do card premium (acima do título) — causa do
    "nome de usuário em tamanho exagerado".
27. **Responsável**: `responsibleName` (designerAssignment → assigneeId), linha própria já existente.
28. **Tipo/setor**: main envia `sector` = CHAVE CRUA (`ev.sector`); o template imprime a chave
    ('cronograma' minúsculo) — causa do "tipo em posição secundária" amador. Falta label oficial.
29-30. **Subtipo/quantidade (contexto do Cronograma)**: AUSENTES do payload. Campos reais no doc:
    `subtype`/`cronSub` (semanal|quinzenal|mensal — só legado), `cronQty` (custom F3.5.5D),
    `cronContents[]` (comprimento REAL). `cronTypeLabel` (8457-8464) INFERE periodicidade pela
    contagem (n>=12 ⇒ Mensal) — PROIBIDO nas notificações ⇒ NÃO será reutilizado; novo resolvedor
    puro `cronNotifContext` usa SÓ subtipo real + contagem real ('Cronograma quinzenal • 6 temas' /
    'Cronograma • 7 temas'), sem inventar periodicidade.
31-32. **Status**: `fromStatus`/`toStatus` (chaves cruas) presentes em task_moved/completed/reopened;
    chips premium já traduzem via mapa (afazer/andamento/revisao/concluido/entregue).
33. **Timestamp**: `createdAt` no payload; hora exibida `premiumHM()` 24h (relógio local do render;
    horário do evento disponível em `ev.at`).
34. **dedupeKey**: eventId canônico (main) / dedupKey (renderer) — INTOCÁVEL.
35. **Som**: autoridade única por superfície (1.0.216) no MAIN — INTOCÁVEL (presentation-only).
36. **Agrupamento**: `notificationGrouping.ts` (janela 5s, maxVisibleItems 5, flag ON) — INTOCÁVEL;
    template de grupo (`premiumGroupInner`) será reestilizado apenas visualmente (mesmos campos).
37. **Fila/entrega**: `deliverNotification` (main.ts ~338-364): janela ativa ⇒ `notif-toast` renderer
    (ACK 4s) ⇒ fallback janela bgnotify ⇒ fallback nativa. Empilhamento in-app: `notifEnsureStack`.
38. **Janela**: `bgNotify.ts` (frameless canto inferior direito, workArea-aware) + `bgnotify.html`.
39-41. **Renderer/preload/main**: toast inline (index.html 4451-4620) + `bgnotify.html` (127-192) com
    construtores premium DUPLICADOS e teste de PARIDADE DE DOM (F3.5.4U) ⇒ o redesign DEVE alterar os
    dois em sincronia + atualizar o teste de paridade.
42. **CSS**: `.ntfp-*` inline nos dois arquivos; `.ntf.ntfp-w{width:500px}`; reduced-motion já
    respeitado (`@media (prefers-reduced-motion: reduce)`).
43. **Deep-link**: CTA "Abrir tarefa" → `data-deep` → `notifRoute('detail/<id>')` — preservar.
44. **Sino/histórico**: `notifHistoryAppend` (usa body/context genéricos — intactos).
45. **Permissões**: destinatários via `resolveNotificationTargets` (SLA pessoal / fluxo de equipe) —
    INTOCÁVEL; payload exibe apenas evento/título/cliente/tipo/contexto/status/autor/responsável/hora
    (sem legenda/tema/observações/tokens/IDs técnicos na superfície).

## C. IMPACTO (itens 46–58)

46. **Arquivos necessários (delta planejado)**: `renderer/index.html` (flags+filtro+gates+template),
    `renderer/bgnotify.html` (template paridade), `main/notifEvents.js` (enriquecimento clientName/
    sectorLabel/cronContext + isRetiredSector), `main/notifierA.ts` (skip retirados), `main/main.ts`
    (taskGate retirado→terminal com motivo auditável; gate defensivo no deliver; gate no feed do
    check-in/orquestrador), possivelmente `main/taskIdle*.ts`/`executionTracking.js` (gate de setor
    retirado no elegível — só se o feed não for bloqueável no main.ts), `package.json`/lock (1.0.224),
    suítes/scripts f355e, re-pins herdados, workflows f355e, docs/f355e.
47. **Componentes compartilhados (PROVADOS — NÃO REMOVER)**: editor rico/rteSanitize (Cronograma usa),
    steppers de quantidade (cronQty/vídeos usam o padrão), sanitização, colagem universal, menu de
    contexto, Central de Detalhes, Card Kanban unificado, portal/aprovação, `isClientSector`
    (roteiro na definição — comportamento congelado; nunca mais avaliado operacionalmente),
    `cronTypeLabel` (chips legados de card — intocado), `SECTOR_ALIAS`, `secOf`.
48. **Dados legados**: preservação total (filtro read-only no state; zero write/delete).
49. **Migração**: NENHUMA (não destrutivo, idempotente — reaplicável a cada snapshot).
50. **Limpeza seletiva**: pendências persistidas do modal central p/ tarefas retiradas — via
    `taskGate` (main.ts, EDITÁVEL) retornando `terminal` para setor retirado + diag
    `retired_module_<setor>` sanitizado (taskId + motivo): as 3 barreiras H2 aprovadas descartam a
    pendência (boot/pré-exibição) SEM tocar em `slaReminder.ts` (permanece byte-congelado).
    Check-ins/claims/Acompanhamento: gate no produtor (novo ciclo nunca nasce) + mesmo taskGate.
51. Backend: NÃO necessário. 52. Worker: NÃO alterado (item 14). 53. Functions: NÃO. 54. Rules: NÃO
    (nenhuma regra específica comprovada). 55. Android: NÃO (0 refs).
56. **Riscos**: (a) fallback `secOf→SECTORS[0]` se definição fosse removida — mitigado (definições
    ficam); (b) paridade toast×bgnotify — teste atualizado em conjunto; (c) pins herdados
    f355c/f355d sobre segmentos alterados — re-pins honestos rotulados; (d) som/dedup/fila —
    presentation-only, suítes herdadas 53+56+128+94+f354o/u obrigatórias verdes; (e) pendência SLA
    persistida de tarefa retirada — coberta pelo item 50; (f) links órfãos do portal de roteiro —
    documentados (item 14), sem exposição NOVA possível.
57. **Rollback**: imediato v1.0.223 (Latest preservado), adicional v1.0.222, físico v1.0.218
    (todas publicadas e imutáveis).
58. **Congelados desta fase**: slaReminder.ts/Store/Window + slareminder.html/preload (H2), sons,
    auth-core, updaterService, editContextMenu, preload (se sem delta), sanitizador/editor rico,
    steppers cronQty/scriptQty/vqty, Worker, Functions, Rules, Android, electron-builder.yml,
    tsconfig — diff-empty no CI, como nas fases anteriores.

## ESTRUTURA REAL DA NOTIFICAÇÃO (antes) × NOVO WIREFRAME

ANTES (premium F3.5.4U): [avatar 44px coluna inteira] | eyebrow evento + hora + × / LINHA DO ATOR /
título da tarefa / chips status / meta minúscula "chave_setor · cliente" / CTA. Sem cliente nos
task_* (payload vazio), setor como chave crua, sem contexto de cronograma.

NOVO (hierarquia obrigatória do mandato):
```
[linha lateral por categoria]
[ícone] TAREFA REABERTA                      15:02  [×]
TEMAS                                   (título, máx 2 linhas)
Hospital Visão                          (cliente | "Sem cliente vinculado")
Cronograma mensal • 12 temas            (setor + contexto real; custom: "Cronograma • 7 temas")
[Concluído] → [Em andamento]            (chips compactos)
Reaberta por Miercohévisk Niheb…  [av 36px]  (autor = metadado)
Responsável: Felipe Teodozio            (quando existir/relevante)
[ Abrir tarefa ]
```
Cores por evento (texto+ícone sempre; nunca só cor): criada/atribuída azul; movimentada/andamento
violeta; concluída/aprovação verde/turquesa; reaberta âmbar; cancelada vermelho discreto; ajuste
laranja. Largura ~480px (dentro de 420–500); avatar 36-40px secundário; padding 16-20px; fallbacks
profissionais; aria-label no ×; foco/Enter/Espaço no CTA; aria-live único; reduced-motion mantido.

## FONTE REAL DO CLIENTE
`t.client` (snapshot canônico salvo na tarefa; obrigatório nos setores-cliente). Sem clientId no
modelo. Fallback: "Sem cliente vinculado". Nunca título/descrição/texto de usuário.

## TRATAMENTO CRONOGRAMA LEGADO × PERSONALIZADO
Legado: subtipo REAL (`subtype`/`cronSub` ∈ semanal|quinzenal|mensal) + contagem real ⇒
"Cronograma quinzenal • 6 temas". Personalizado: SEM periodicidade ⇒ "Cronograma • 7 temas"
(contagem = cronContents.length → cronQty). Proibido inferir periodicidade pela contagem —
`cronTypeLabel` NÃO é reutilizado nas notificações.

## PLANO NÃO DESTRUTIVO (resumo executável)
1. `descontinuado:true` em roteiro + programacao_posts (padrão F3.3.71C7 do próprio owner).
2. `retiredCutoffFilter` no ingest (espelho do pwaCutoffFilter aprovado) + `__retiredIndex`
   (id→setor, sem conteúdo) + contadores sanitizados por módulo.
3. Quadros: `SECTORS.filter(s=>!s.descontinuado)`; save-gate defensivo; deep-links: mensagem
   "Este módulo foi descontinuado e não está mais disponível no Agenda ID Seven." + redirect Tarefas
   + log taskId+motivo; guard em `notifRoute`/cliques `data-sector`.
4. Gates nos produtores main (notifierA/notifEvents/check-in/orquestrador/deliver) + taskGate
   retirado→terminal (motivo auditável) — invalidação seletiva sem tocar nos congelados H2.
5. Redesign premium nas DUAS superfícies (toast + bgnotify) com enriquecimento canônico
   (clientName real do main; sectorLabel; cronContext) + paridade + acessibilidade + fallbacks.
6. Suítes f355e (30 retirada + 40 notificações) + re-pins herdados + 26 provas Electron empacotadas
   + build gated 1.0.224 + release pinada no Latest.
