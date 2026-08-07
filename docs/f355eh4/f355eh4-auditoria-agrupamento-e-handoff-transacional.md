# F3.5.5E-H4 — Auditoria read-only do agrupamento + desenho do handoff transacional

## A. Arquitetura REAL do agrupamento (provada por leitura, sem presunção)

1. **Fonte de verdade** — `desktop/src/main/notificationGrouping.ts` (F3.5.4O, MAIN process,
   controlador puro): `Map<groupKey, GroupState>`; `groupKey = common_group:<recipientUid>:<taskId>`
   (taskId é a autoridade); janela FIXA de 5s a partir do 1º evento; allowlist exclusiva de 7
   eventTypes comuns (task_moved/updated/assigned/reassigned/completed/reopened/designer_assigned);
   denylist SLA/critical/idle/flow/app_update/help/blocked; `GroupState` = count, items (ordem de
   chegada), lastSeverity, lastActor(Name/Avatar), taskTitle, deep, firstAt/lastAt.
   `viewOf()` → **GroupView** (payload consolidado canônico): `{groupKey, taskId, taskTitle, count,
   items (≤5, recentes primeiro), extraCount, deep, primaryName, primaryAvatar, severity}`.
   `close(groupKey)` existe mas **NENHUM chamador** no app (grep vazio) — o grupo expira pela
   janela de 5s; o card visual pelo TTL próprio. `reset()` no logout/troca de usuário.

2. **Roteamento** — `deliverNotification` (main.ts): `route(p)` → `first`: `p.groupKey` marcado e o
   payload segue o fluxo NORMAL (focado→toast `notif-toast`; desfocado→`showBgNotify`; locked→nativa);
   `update`: `p._groupUpdate`, envia `notif-group-update` (toast) **e** `updateBgGroup(view)`
   (premium) — a superfície que tiver o card com aquele `data-group` morfa; retorna canal `grouped`
   (som suprimido; `markSeen`; o sino já capturou CADA evento individualmente antes).

3. **Toast interno (index.html)** — o card **nasce com `data-group` já no 1º evento** quando
   `p.groupKey` existe (linha 4639). `notifGroupUpdate(view)` (4703) morfa EM VIGOR o card
   endereçado por data-group: contagem + até 5 itens + "+N outras atualizações", CTA/deep, TTL
   refrescado com **teto de 15s** desde `__ntfFirstAt` (4730–4733). O dismiss do card NÃO avisa o
   main (nem o controlador).

4. **Janela premium (bgnotify.html, BYTE-CONGELADO)** — `bg-card` com `p.groupKey` seta
   `data-group` (linha 248); `bg-group-update` morfa por data-group com `GROUP_MAX_MS=15000`
   (275/310). **ACEITE REAL já existe**: o renderer manda `bgnotify-rendered` com o `dedupKey`
   (prova de render, F3.4.7); no main, `ackCancel` resolve; timeout 4s → `onNoRender`.
   ⇒ **A representação de grupo na janela externa JÁ É SUPORTADA** pelo par
   `showBgNotify(payload com groupKey)` + `updateBgGroup(view)` — nenhum renderer novo.

5. **Handoff H3 (a evoluir)** — `activeToasts` registra SÓ individuais; a coleta do renderer
   **PULA `data-group`** (5719) e FECHA os cards na própria coleta; o handler da reply **REMOVE do
   registro** as chaves fora da resposta (1246). Protocolo não transacional: interno fecha ANTES
   de o externo provar render.

## B. Causa-raiz da exceção declarada na H3 (4 fatores, provados)

(a) a coleta pulava `data-group` ⇒ até um "grupo de 1 evento" (qualquer comum agrupável focado)
ficava para trás; (b) a reply tratava o grupo não-respondido como "fechado pelo usuário" e o
descartava; (c) o registro do handoff não guardava o estado consolidado do grupo (p0 + view);
(d) o protocolo fechava o interno na coleta, sem aceite externo (não transacional).

## C. Correção H4 (cirúrgica; SÓ caminhos já suportados; zero visual)

- **main.ts** — espelho `activeToastGroups Map<groupKey, {p0, view|null, firstAt, timer}>`:
  registrado no ramo FOCADO quando `p.groupKey` existe (senão `toastRegister` como antes);
  atualizado (`groupTouch`) no ramo `update` quando o grupo vive no toast; TTL espelhado do
  renderer (min(ttl(sev), teto 15s − decorrido) + margem). Coleta H4 com entradas prefixadas
  `i:<dedupKey>` / `g:<groupKey>` (strings puras ⇒ o canal e o preload da coleta NÃO mudam de
  assinatura). **Transação**: `showBgNotify({...p, sound:false, _handoff:true})` → ACEITE =
  `bgnotify-rendered` do MESMO dedupKey (2º listener `ipcMain.on` no main.ts — sem tocar
  bgNotify.ts) → grupos: `updateBgGroup(view)` APÓS o aceite (FIFO de IPC garante o card antes do
  morph) → **COMMIT** `notif-collect-commit` → renderer fecha por `__ntfKey`/`data-group` →
  desregistro. **Timeout do aceite (4s+margem) ⇒ 1 retry; falha final ⇒ interno PRESERVADO**
  (zero perda; zero som novo; zero passagem pelo HUB — recibos/sino/dedupe intocados).
  Focus ANTES da reply ⇒ aborta (nada mostrado); focus APÓS shows disparados ⇒ transação
  COMPLETA (determinístico; nunca duas superfícies com o mesmo card).
  Fallback do toastAck para payload com groupKey ⇒ `groupUnregisterByDedup`.
- **index.html** (2 pontos técnicos, zero visual) — coleta responde TODOS os vivos (i:/g:) SEM
  fechar; novo handler do commit fecha os aceitos.
- **preload.ts** — +1 canal `onNotifCollectCommit` (`notif-collect-commit`).
- **bgNotify.ts / bgnotify.html / notificationGrouping.ts / som / dedupe / sino / recibos /
  deep-link / SLA / sessão / tray / updater** — **ZERO mudança** (gates de congelados).

## D. Mapa dos testes do mandato (1–18) → provas

Individual migra (1–4); grupo 2 eventos migra IMEDIATO com contagem (5–9); grupo 3 (10); grupo 4
(11); rajada multi-tarefa + cap/fila da premium (12); update DURANTE o handoff (13 — view mais
novo vence; morph idempotente); evento chegando já em blur (14 — vai direto à premium, caminho
1.0.227); blur/focus rápidos (15 — abort antes da reply; completa após shows); Alt+Tab repetido
(16 — registros esvaziam e re-populam); minimizado logo após formar grupo (17 — blur dispara);
X→tray com grupo ativo (18 — hide+blur; renderer vivo responde a coleta).
