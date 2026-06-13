# PLANO MESTRE — Workflows por setor, SLA em tempo real e notificações por papel

**Status: análise e planejamento. ZERO código alterado. Sem pacote, sem deploy, sem
workflow executado, sem variável, sem escrita/push/bloqueio real, sem 4.4-B.**
Toda afirmação abaixo tem evidência no código real (arquivo:linha) ou em produção
(coletas read-only V64.57–V64.59).

---

## 0. VEREDITO DA AUDITORIA (o que muda o plano inteiro)

O escopo descrito NÃO exige construir um sistema novo. O app 1.0.146 já é um
sistema de workflows por setor — grande parte do que foi pedido **existe e está
desligado, incompleto ou sem polimento**, não ausente:

| Pedido no escopo | Situação real | Evidência |
|---|---|---|
| Setores Edição de Mídia / Cronograma / Roteiro / Programação de Posts / Copywriting | EXISTEM os 5, com cores, ícones e formulários próprios | `index.html:1652-1656` (SECTORS) |
| `copy`/`design` legados | São ALIASES do catálogo novo (`copy→copywriting`, `design→edicao_midia`, `postagem→programacao_posts`) | `index.html:1657` |
| Cronograma 3/6/12 temas | EXISTE: semanal 3, quinzenal 6, mensal 12 conteúdos, com checklist | `index.html:1678-1681` |
| Status em tempo real por papel | EXISTEM 3 eixos: `status` (social), `designerFlowStatus` (designer: afazer/andamento/revisao/entregue), `clientFlowStatus` (cliente) | `index.html:1659-1664, 2334-2338, 2623` |
| Histórico de status | EXISTE campo `history[]` gravado nas transições | `index.html:2974,2979,3342…` |
| Notificação desktop (PC) | EXISTE NotifierService nativo (toast Windows, tempo real, dedupe, clique abre o quadro) — cobre ATRIBUIÇÃO, não mudança de status | `desktop/src/main/notifier.ts` |
| Push Android | EXISTE (FCM + canal + ícone `ic_notify.xml` + tela premium de lembrete) | `android-native-beta/.../core/*.kt` |
| Push ao designer na atribuição | EXISTE rota `/notify-designer` (server re-lê a task) | `cloudflare-worker.js:460` |
| Link de aprovação do cliente | EXISTE portal premium `/cliente/cronograma/:token` com Aprovar/Pedir revisão | worker V64.6+ |
| WhatsApp Business ao cliente | EXISTE envio REAL via Cloud API, template `cronograma_aprovacao`, confirmado com `message_id` da Meta | worker V64.31, release 1.0.121 |
| Push personalizado ao cliente | PREPARADO: web push VAPID no portal (`ENABLE_CLIENT_WEB_PUSH` + chaves já em produção) | worker linhas ~1484-1972; bindings da janela |
| Lembrete antes do prazo | EXISTE cron por minuto (`REMINDER_BEFORE_MINUTES`/`REMINDER_WINDOW_SECONDS`) | worker `handleCronTrigger` |
| SLA laranja/vermelho | CONSTRUÍDO E ADORMECIDO: motor V64.59 com estados `inicio_proximo`/`inicio_atrasado`/`entrega_proxima`/`entrega_atrasada`, 11 tipos de evento, dedupe, replanejamento — 100% read-only, flags OFF | `cloudflare-worker.js` seção SLA; `SlaContract.kt` |

A arquitetura correta, portanto, é: **formalizar o contrato de dados, ligar o que
está adormecido em fases, polir as notificações para o padrão premium e
construir só os 2 fluxos realmente ausentes** (aviso de post publicado; decisão
do handoff do roteiro) — além de remover Copywriting com segurança.

---

## 1. DOCUMENTO DE REQUISITOS FINAL

### RF-1 Edição de Mídia
1. Social atribui tarefa a UM designer com data/hora de início e término (UI já tem; horas precisam virar canônicas — ver modelo de dados).
2. Designer notificado imediatamente: in-app (existe), toast PC (existe p/ atribuição), push Android aberto/fechado/tela bloqueada (existe; tela bloqueada depende de canal `IMPORTANCE_HIGH` + exceção de bateria — limites do SO documentados no item 9).
3. Notificação premium: logo, nome do designer, título, prazo, mensagem estruturada, cor por urgência (HOJE é texto simples — lacuna L-1).
4. Cada mudança de status do designer notifica a social no PC e celular (HOJE só atualiza o quadro em tempo real; push de mudança de status NÃO existe — lacuna L-2).
5. Alerta LARANJA a X min do término e VERMELHO após vencer (motor pronto; entrega de push bloqueada até 4.4-B — lacuna L-3).

### RF-2 Cronograma
Fluxo completo já existente: criação 3/6/12 → envio WhatsApp (template real) → cliente aprova no portal → social atribui ao designer com prazos → designer produz → "entregues. Falta legenda e post para a aprovação final" (`index.html:3109`) → legendas/posts ao cliente pelo mesmo link → nova notificação WhatsApp. Requisito: aplicar a RF-1 (SLA + notificações premium) à etapa do designer.

### RF-3 Roteiro
Setor e formulário existem (gancho/desenvolvimento/CTA/obs. de gravação; checklist termina em "Enviar para gravação" — `index.html:1686`). O portal de aprovação atual é específico do CRONOGRAMA. **Decisão de mapeamento (sua):**
- (a) Roteiro termina na aprovação do cliente (portal genérico a criar); ou
- (b) Roteiro aprovado gera tarefa de Edição de Mídia (handoff p/ designer/editor — o checklist atual sugere isso).
**Recomendação: (b) com handoff manual** — botão "Gerar tarefa de edição" após aprovação, herdando cliente/tema; mantém a social no controle e reusa o fluxo RF-1.

### RF-4 Programação de Post
NÃO EXISTE HOJE (lacuna L-4). Requisito: ao publicar/programar, cliente é avisado:
- via WhatsApp = mensagem de template NOVO (ex.: `post_publicado`) no grupo — exige aprovação prévia da Meta (lead time);
- via push ID Seven = SOMENTE se o cliente tiver subscription web push ativa no portal (infra VAPID pronta, flag `ENABLE_CLIENT_WEB_PUSH`).
**Nunca prometer push personalizado a cliente sem app/subscription** — sem ela, o canal é exclusivamente WhatsApp (notificação nativa do próprio WhatsApp, inclusive em tela bloqueada, comportamento do app deles, não nosso).

### RF-5 Remoção de Copywriting — AUDITORIA FEITA
Onde aparece:
1. **Menu/Hub**: card do setor (SECTORS `index.html:1654` — o hub renderiza a partir do catálogo);
2. **Criação**: templates semanal/quinzenal/mensal (`index.html:1682-1685`);
3. **Filtros/chips**: chips de setor derivam do mesmo catálogo;
4. **Cards**: rótulo/cor via `secOf()` (`index.html:1658`);
5. **Dados antigos**: SIM — **8 das 16 tarefas reais de produção têm `sector:"copy"`** (coletas V64.57/58/59), renderizadas via alias `copy→copywriting`;
6. **Android**: catálogo espelhado (Types.kt — o comentário do renderer indica paridade).
**Recomendação: HIDE-ONLY, sem migração de dados.** Remover do hub/criação/chips de filtro, MANTER o alias e o `secOf()` para que as 8 tarefas históricas continuem renderizando (e os relatórios continuem batendo). Migração de dados em Firestore é risco sem benefício — e as 8 tarefas copy estão na triagem de hoje (parte deve ser cancelada). Destino das demandas de texto: a etapa "legendas e posts" do Cronograma já cobre o caso de uso principal.

### RF-6 Designer SLA (contrato por tarefa atribuída)
Campos obrigatórios e onde vivem — ver modelo de dados (item 5). Estados, gatilhos e regras — ver matriz de status (item 4) e regras de SLA (item 6 do plano).

---

## 2. FLUXOGRAMA TEXTUAL POR SETOR

**EDIÇÃO DE MÍDIA**
`Social cria tarefa (template p4/p6/p12)` → `define início+término` → `Enviar ao designer (designerAssignment + designerSla seed)` → [push designer PC+Android] → `designer: afazer→andamento` → [notif social] → `andamento→revisao` → [notif social] → `revisao→entregue` → [notif social "Entregue — aguardando a Social"] → `social valida e conclui`. Paralelo: motor SLA emite `inicio_proximo`(laranja)/`inicio_atrasado`(vermelho)/`entrega_proxima`(laranja)/`entrega_atrasada`(vermelho) ao designer.

**CRONOGRAMA**
`Social cria cronograma (3/6/12 temas)` → `Enviar card premium ao grupo WhatsApp (Cloud API, template)` → [cliente: notificação nativa do WhatsApp] → `cliente abre portal /cliente/cronograma/:token` → `aprova / pede revisão (clientFlowStatus)` → [se revisão: social ajusta, portal atualiza sozinho] → `aprovado` → `social atribui ao designer com início+término` → **(fluxo Edição de Mídia)** → `entregue` → `social anexa legendas+posts` → `reenvia ao cliente (mesmo link)` → [novo template WhatsApp "legendas e posts disponíveis"] → `cliente aprova final`.

**ROTEIRO**
`Social cria roteiro (gancho/desenvolvimento/CTA)` → `envia ao cliente (link)` → [WhatsApp] → `cliente aprova/pede ajuste` → **DECISÃO (a/b)** → se (b): `Gerar tarefa de edição` → (fluxo Edição de Mídia).

**PROGRAMAÇÃO DE POSTS**
`Social publica/programa nas redes` → `marca no app "publicado/programado" (novo)` → [WhatsApp template `post_publicado` no grupo] e/ou [web push ID Seven SE subscription ativa] → tarefa concluída.

**COPYWRITING** → removido do menu/criação (hide-only); histórico continua legível.

---

## 3. MATRIZ DE NOTIFICAÇÕES

| # | Evento | Dispara | Recebe | Canal | Cor | Condição | Dedupe | Hoje |
|---|---|---|---|---|---|---|---|---|
| N1 | Tarefa atribuída ao designer | social | designer | in-app + toast PC + FCM | normal | designerAssignment gravado | `assignedAt` (PC já faz) | EXISTE (modelo simples) |
| N2 | Designer moveu status | designer | social (quem atribuiu) | in-app + toast PC + FCM | normal | mudança em designerFlowStatus | taskId+status+ts | **FALTA push** (in-app ok) |
| N3 | Lembrete pré-início | cron/SLA | designer | FCM + toast | laranja | T-30min de plannedStart, não iniciou | `taskId__inicio_proximo__anchor` | motor pronto, OFF |
| N4 | Início atrasado | cron/SLA | designer | FCM + toast | vermelho | passou plannedStart sem `andamento` | idem | motor pronto, OFF |
| N5 | Lembrete pré-entrega | cron/SLA | designer | FCM + toast | laranja | T-30min de plannedFinish | idem | motor pronto, OFF (cron legado cobre parcial) |
| N6 | Entrega atrasada | cron/SLA | designer (+social) | FCM + toast | vermelho | passou plannedFinish sem `entregue` | idem | motor pronto, OFF |
| N7 | Designer entregou | designer | social | in-app + toast + FCM | normal/verde | designerFlowStatus=entregue | taskId+entregue | parcial (=N2) |
| N8 | Cronograma disponível p/ cliente | social | cliente | **WhatsApp template** | — | envio do link | message_id Meta | EXISTE (produção) |
| N9 | Legendas/posts disponíveis | social | cliente | WhatsApp template | — | reenvio pós-produção | idem | EXISTE (mesmo fluxo) |
| N10 | Cliente aprovou/pediu revisão | cliente (portal) | social | in-app + toast + FCM | normal/laranja | clientLastAction | actionId | parcial (in-app) |
| N11 | Post publicado/programado | social | cliente | WhatsApp template NOVO + web push se subscrito | — | marcação no app | postId | **NÃO EXISTE** |
| N12 | Resumo de risco (termômetro) | microjanela semanal | gestor/admin | chat/laudo | — | segunda-feira | run id | EXISTE (read-only) |

**Modelo visual premium (todas):** logo ID Seven (large icon Android / ícone Electron / header do card WhatsApp), título curto ("Nova tarefa para você", "Prazo em 30 min"), corpo estruturado (cliente — título · responsável · prazo dd/mm hh:mm), cor do canal por urgência (normal azul/laranja/vermelho). No Android: 3 canais de notificação (normal/laranja/vermelho) p/ som e prioridade distintos — `IMPORTANCE_HIGH` nos dois últimos (aparece em tela bloqueada conforme SO).

### Matriz por papel
| Papel | Vê | Recebe | Age |
|---|---|---|---|
| Social media | todos os quadros, 4 colunas | N2, N7, N10, (N6 cópia) | cria, define prazos, atribui, valida, envia ao cliente, repactua |
| Designer | "Meu quadro" 3 colunas (A Fazer/Em andamento/Entregue) | N1, N3, N4, N5, N6 | move status, entrega |
| Cliente | portal pelo link (4 estados) | N8, N9, N11 (WhatsApp; push só com subscription) | aprova, pede revisão |
| Gestor/Admin | tudo + termômetro | N12 (+ futura escalada de N6) | triagem, repactuação, regra de WIP |

---

## 4. MATRIZ DE STATUS (telas reais)

| Eixo | Valores reais | Quem move | Observação |
|---|---|---|---|
| `status` (social) | afazer / andamento / revisao / concluido | social | `index.html:1659-1663`; é o eixo que o termômetro lê |
| `designerFlowStatus` | afazer / andamento / revisao / **entregue** | designer | fonte única PC+Android (`index.html:2952`); "Entregue — aguardando a Social" |
| `clientFlowStatus` | enviado / em análise / revisão solicitada / aprovado | cliente (portal) | 10 pontos no renderer; release 1.0.97/1.0.121 |

**"Ajuste"**: NÃO criar status novo — o estado "em ajuste" é derivado (clientFlowStatus=revisão solicitada ⇒ social ajusta; ou social devolve designer p/ `andamento` com nota). Menos estados = menos divergência entre eixos (bug histórico 1.0.97 nasceu exatamente da duplicidade de eixos).

Mapeamento p/ SLA (motor V64.59): afazer+não iniciou=`aguardando_inicio`; T-30min=`inicio_proximo`; passou início=`inicio_atrasado`; andamento=`em_producao`; T-30min entrega=`entrega_proxima`; venceu=`entrega_atrasada`; entregue=`entregue`; cancelada=`cancelada`.

---

## 5. MODELO DE DADOS RECOMENDADO (aditivo; nada quebra o legado)

| Campo pedido | Onde já vive | Ação |
|---|---|---|
| workflowType | `sector` (+ alias) | usar como está |
| taskType | subtipo do template (`semanal/p4/...`) + `type` | formalizar `taskType` no doc na criação (hoje implícito no form) |
| sector | `sector` | manter; gravar SEMPRE a chave NOVA (`edicao_midia`…), alias só leitura |
| assignedBy / assignedTo | `designerAssignment.assignedBy/.designerId` (+`by`, `assigneeId`) | usar como está |
| plannedStartAt / plannedFinishAt | `startDate`+`startTime`, `dueDate`+`dueTime` (strings) | **canonizar em ms** dentro de `designerSla.planStartAt/planDueAt` (a semente já faz isso — commits pós-1.0.146) |
| status / statusHistory | 3 eixos + `history[]` | padronizar entrada do history: `{axis,from,to,byUid,atMs}` |
| clientApprovalStatus | `clientFlowStatus` + `clientLastAction` | usar como está |
| designerSla | semente `designerSla{...}` no Enviar ao designer | JÁ DESENHADA (contrato V64.59 + `SlaContract.kt`) |
| notificationEvents | coleção `slaEvents` (docId = `taskId__eventType__anchorMs`) + marcadores `*SentAt` | criada pelo motor na 4.4-B; dedupe nativa por ID |
| deliveryLinks / whatsappShareLinks | token do portal + links `aprovar.agendaidseven.com.br/cliente/cronograma/<token>` | usar como está; guardar `message_id` da Meta no doc (auditoria de entrega) |
| timestamps | `createdAt`, `assignedAt`, `clientLastAction.at`… | completar `publishedAt` (RF-4) |

Princípio: **um único documento `tasks/{id}` continua sendo a verdade**, com os 3 eixos + designerSla; eventos de notificação ficam em `slaEvents` (já especificado e testado em 127 testes locais). Nenhuma migração de dados.

---

## 6. REGRAS DE SLA (motor já implementado — V64.59, dormindo)

1. **Começa** a contar na atribuição (`designerAssignment.assignedAt`); o relógio de início alvo é `planStartAt`, o de entrega é `planDueAt`.
2. **Laranja**: `inicio_proximo` em T-30min do início (se não começou) e `entrega_proxima` em T-30min da entrega (configuráveis; defaults 30/30).
3. **Vermelho**: `inicio_atrasado` ao passar do início sem `andamento`; `entrega_atrasada` ao passar da entrega sem `entregue`.
4. **Status mudou**: entrar em `andamento` encerra alertas de início; `entregue/cancelada` encerra tudo (estado terminal; nenhum alerta posterior).
5. **Prazo repactuado**: `planReschedule` (já implementado) reseta os marcadores do prazo antigo ⇒ o prazo novo ganha alertas novos, sem duplicar os antigos (dedupe por âncora).
6. **Designer não iniciou**: vira `inicio_atrasado` (vermelho ao designer); escalada à social/gestor é evento previsto (consolidateLocks/observação de WIP) — só com autorização futura.
7. **Corte temporal**: nada retroativo — eventos só para âncoras ≥ `SLA_ACTIVATED_AT` (proteção anti-enxurrada já embutida e testada).

---

## 7. REGRAS POR PLATAFORMA

- **PC/Desktop (Electron)**: tempo real via listener Firestore (já); toasts nativos com clique-abre-quadro (já); cobertura a ampliar p/ N2-N7; cores/urgência no card do quadro podem ser **calculadas localmente** a partir de `designerSla` (sem backend!).
- **Android (nativebeta)**: FCM com canais por urgência; large icon = logo; funciona aberto/fechado; tela bloqueada = `IMPORTANCE_HIGH` + permissão de notificação + exceção de bateria (item 7 do plano de instalação); OEMs agressivas (Xiaomi/Samsung) podem atrasar — limite do SO, documentar ao time.
- **WhatsApp Business (cliente)**: SEMPRE template aprovado pela Meta (fora da janela de 24h só template); notificação em tela bloqueada é do próprio WhatsApp; sucesso = `message_id`.
- **Link web do cliente (portal)**: atualização ao vivo já existe ("A equipe atualizou seu cronograma"); web push opcional via VAPID **somente com opt-in** no portal (`ENABLE_CLIENT_WEB_PUSH`).

---

## 8. CHECKLIST DE LACUNAS / CLASSIFICAÇÃO

**Reaproveitar (pronto):** catálogo de setores+templates; 3 eixos de status; history; portal cliente + ações; WhatsApp Cloud API (cronograma); push de atribuição (PC+Android); cron de lembrete legado; TODO o motor SLA read-only; termômetro semanal; infra VAPID.
**Incompleto:** L-1 visual premium das notificações (logo/cores/estrutura); L-2 push de mudança de status p/ social; L-5 horas canônicas em ms (semente resolve; falta build); L-6 `taskType` explícito no doc; L-7 push de N10 (cliente agiu) p/ social.
**Errado no modelo atual:** time opera FORA dos eixos (16/16 sem responsável, 0 movimento — problema de adoção, não de código); duplicidade copy/design legado × catálogo novo nos DADOS (resolvida por alias, mas exige gravar sempre a chave nova); prazos como strings dispersas (`dueDate/dueTime`) em vez de ms canônicos.
**Remover:** Copywriting (hide-only, RF-5).
**Criar:** N11 fluxo "post publicado" (+ template Meta novo); decisão+handoff do Roteiro; canais de notificação por urgência no Android; entrega dos eventos SLA (4.4-B+, futuro autorizado).
**Apenas configurar:** thresholds laranja/vermelho (defaults 30/30 já parametrizados); `REMINDER_BEFORE_MINUTES`; `ENABLE_CLIENT_WEB_PUSH`; canais Android.
**Testar antes de qualquer build:** suíte e2e desktop (pins do quadro); 127 testes SLA locais; roteiro manual 10 itens da instalação 1.0.146; fluxo cronograma→cliente→designer em staging humano (piloto FASE B).

---

## 9. PLANO DE IMPLEMENTAÇÃO POR FASES (cada fase = autorização sua)

- **F0 (agora, sem código):** instalar/validar 1.0.146 (plano já entregue) + triagem das 16 + adoção FASE A/B/C. Critério de saída: checklist 10/10 + adoção ≥80%.
- **F1 (beta Desktop+Android, sem Worker):** Copywriting hide-only · notificações locais premium (logo/canais/cores/corpo estruturado) · **SLA VISUAL local** (card laranja/vermelho calculado no cliente a partir de `designerSla` — zero backend) · toast de mudança de status no PC (NotifierService já escuta o doc; é extensão local) · `taskType`/history padronizados na criação.
- **F2 (Worker, 1 deploy autorizado):** push FCM de mudança de status (N2/N7/N10) — rota aditiva no padrão `/notify-designer`; templates de payload premium.
- **F3 (ativação medida do motor):** `SLA_ACTIVATED_AT` (critérios do plano de adoção) → 4.4-B = escrita de `slaEvents` apenas → depois entrega de push N3-N6. Cada passo separado.
- **F4 (cliente):** template Meta `post_publicado` (pedir aprovação JÁ na F1 — lead time de dias) + marcação "publicado/programado" no app + N11; decisão do Roteiro (a/b) implementada.
- **F5 (opcional):** web push do portal ao cliente (opt-in), escalada ao gestor, relatórios.

## 10. PLANO DE TESTES PONTA A PONTA (antes de cada build/fase)

1. Suíte e2e desktop (pins do contrato visual) = APROVADA, 0 falhas.
2. Suítes SLA locais (39+44+11+16+17=127) = 127 PASS.
3. Roteiro humano F0: os 10 itens do checklist de instalação.
4. Roteiro humano F1: notificação premium em 6 cenários Android (aberto/fechado/bloqueado × normal/laranja-visual/vermelho-visual) + toast PC de status.
5. Roteiro F2/F3: 1 microjanela `/sla-dryrun` antes e depois de cada deploy (bundle hash + 403 + writeAllowed:false) — automação já validada.
6. Cliente real: 1 envio de cronograma a grupo de teste WhatsApp com `message_id` conferido + aprovação no portal pelo celular do gestor.

## 11. RISCOS TÉCNICOS

1. **Aprovação de template Meta** (N11): dias/semanas; mitigação = submeter na F1.
2. **OEM Android matando push** em tela bloqueada: mitigação = canais HIGH + instrução de bateria + teste 6 cenários.
3. **Divergência entre eixos de status** (origem do bug 1.0.97): mitigação = designer escreve SÓ `designerFlowStatus`; mapeamentos derivados; testes de paridade PC×Android.
4. **Enxurrada de eventos retroativos** ao ligar o motor: já mitigada por `SLA_ACTIVATED_AT` (zero elegíveis sem o corte — provado em teste).
5. **Fadiga de notificação**: dedupe por âncora + consolidação 1 lock/designer já desenhadas; calibrar thresholds com dados do termômetro.
6. **Adoção** (risco nº1 real): nenhuma notificação corrige quadro vazio — por isso F0 vem antes de tudo.
7. **Web push de cliente**: suporte desigual em iOS/Safari — tratar como bônus, WhatsApp é o canal garantido.

## 12. O QUE FAZER PRIMEIRO

1. Instalar e validar 1.0.146 (artifacts já localizados) + triagem das 16 — **hoje/amanhã, zero código**.
2. Decidir: (a/b) do Roteiro · confirmação do hide-only do Copywriting · thresholds laranja/vermelho (manter 30/30?).
3. Submeter template Meta `post_publicado` (texto eu redijo para sua aprovação).
4. Autorizar a especificação detalhada da F1 (lista exata de arquivos/telas, ainda sem build).
