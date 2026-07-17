# F3.3.73I6C23 — BLOQUEIOS OPERACIONAIS DO QA (registro para a equipe operacional)

Registro formal exigido pela autorização executiva complementar da C23
("registrar o bloqueio para a equipe operacional responsável; não transferir
o bloqueio ao owner"). **Nenhuma ação é solicitada ao owner.**

## Estado da candidata C23 (pronta, aguardando QA físico)

| Componente | Branch | Commit | Prova disponível |
|---|---|---|---|
| Worker (share snapshot) | `worker/f3373i6c23-share-snapshot` | `392354b` (código: `5356ed0`) | Golden Master 52/52; c17 43/43; c18b 31/31; c18e 34/34; approval APROVADO |
| Desktop (wizard reset + fluxo snapshot) | `desktop/f3373i6c23-newtask-reset-snapshot` | `4b15fc7` | wizard 21/21; c18c 46/46; c18h 30/30; sweep verde; tsc limpo |

A versão **1.0.169 NÃO foi criada** (o mandato exige Worker QA verde antes do
bump, e o QA está bloqueado pelos itens abaixo). A produção permanece
intocada (Worker `V64.59-c20-golden-contract` do run 78; release 1.0.168
congelada como "publicada, porém não aprovada fisicamente").

## BLOQUEIO 1 — Token Cloudflare sem permissão "Workers KV Storage"

- Evidência: runs 1 e 2 do workflow `deploy-worker-qa.yml`
  (ids 29510353997 e 29510558888). A listagem/criação de namespace KV
  respondeu `{"success": false, "errors": [{"code": 10000,
  "message": "Authentication error"}]}` — código 10000 = o token não tem
  permissão para essa API. O mesmo token faz deploy de Workers Scripts
  normalmente (runs 73–78), ou seja, o escopo atual é só de scripts.
- Desbloqueio (equipe operacional, painel Cloudflare):
  1. Editar o API token usado em `CLOUDFLARE_API_TOKEN` (ou emitir um novo)
     adicionando a permissão **Account → Workers KV Storage → Edit**;
  2. Atualizar o secret `CLOUDFLARE_API_TOKEN` do repositório (se novo token);
  3. Re-executar `deploy-worker-qa.yml` com `confirm=PROVISIONAR-QA-C23` e
     `ref=worker/f3373i6c23-share-snapshot`. O workflow é idempotente:
     cria/reutiliza o namespace `SHARE_SNAPSHOTS_QA`, publica o serviço
     ISOLADO `idseven-push-qa` (workers.dev apenas, sem rotas/cron), gera
     `TEAM_API_KEY` de QA por CSPRNG, semeia snapshots SINTÉTICOS e valida
     o contrato C23 ao vivo (READY/NOT_FOUND/imagens/HIT/HEAD/401/400/
     /sla-*/produção-intocada).
- Observação: o serviço de QA não usa nenhum secret de produção; o caminho
  Firestore-dependente do endpoint responde 502 explícito em QA por design
  (provado hermeticamente no Golden Master).

## BLOQUEIO 2 — Ambiente WhatsApp Business da equipe (prova física)

- A prova final exige: número/SIM de teste, conta WhatsApp Business de QA,
  telefone/dispositivo controlado pela equipe e WhatsApp Web autenticado.
- O ambiente executor atual (container de nuvem) não possui dispositivo,
  telefone, SIM nem sessão autenticada, e nenhum conector disponível é um
  cliente WhatsApp (verificação objetiva registrada nas fases C22/C23).
- Desbloqueio (equipe operacional): provisionar o aparelho/conta de QA e
  executar o roteiro da ETAPA 5 da C23 (Cronograma, Roteiro 4/6/8/12,
  wizard nos 4 quadros), coletando vídeo/screenshots com tokens redigidos.

## Ordem de retomada (quando os dois bloqueios caírem)

1. `deploy-worker-qa.yml` verde (bloqueio 1 removido);
2. bump `1.0.169` no branch desktop (+ pins A1/H3 das suítes) e build QA;
3. prova física da ETAPA 5 no ambiente da equipe (bloqueio 2 removido);
4. só então ETAPA 6 (produção): namespace KV de produção + binding +
   backup byte-exato + deploy `--keep-vars` + L3 + rollback automático +
   build final + validação da MESMA candidata + release controlada.

É PROIBIDO declarar o Card Premium corrigido, publicar 1.0.169 ou fazer
deploy de produção antes da prova física real.

---

# ADENDO F3.3.73I6C24 — RUNBOOK DE DESBLOQUEIO (equipe operacional)

## Desbloqueio 1 em 3 passos (Cloudflare — ~5 minutos, painel)

1. **Criar token técnico dedicado de QA** (dash.cloudflare.com → My Profile →
   API Tokens → Create Token → Custom): permissões MÍNIMAS
   - Account → **Workers KV Storage → Edit**
   - Account → **Workers Scripts → Edit**
   - (opcional) Account → Account Settings → Read
   - Zone: NENHUMA (QA usa somente workers.dev)
   - Account Resources: somente a conta do idseven-push.
   Não reutilizar credencial pessoal; não alterar o token de produção.
2. **Gravar como secret do GitHub Actions** com o nome exato
   `CLOUDFLARE_QA_API_TOKEN` (Settings → Secrets and variables → Actions).
   O workflow de QA já prefere esse secret automaticamente (fallback ao
   atual apenas se ausente); o valor nunca aparece em logs.
3. **Re-executar** `deploy-worker-qa.yml` (confirm=`PROVISIONAR-QA-C23`,
   ref=`worker/f3373i6c23-share-snapshot`). O run verde comprova, ao vivo:
   namespace `SHARE_SNAPSHOTS_QA` criado/reutilizado (idempotente), binding
   KV, serviço `idseven-push-qa` publicado, contrato C23 completo
   (ready/not_found/imagens/HIT/HEAD/401/400) e **produção intocada**
   (gate final). Diagnóstico auxiliar: `ops-cf-token-diagnose.yml`
   (confirm=`DIAGNOSTICAR-CF-C24`) — read-only, mostra o que a credencial
   pode fazer sem criar nada.

## Desbloqueio 2 — WhatsApp Business QA (registro obrigatório)

Provisionar e REGISTRAR neste arquivo (via PR/commit da equipe):
- responsável operacional: ______
- número/SIM ou eSIM de teste corporativo (NUNCA conta pessoal do owner): ______
- dispositivo controlado + WhatsApp Web autenticado (perfil de navegador QA): ______
- conversa individual e grupo de teste: ______
- data do provisionamento: ______
- retenção das evidências (vídeo/screenshots, tokens SEMPRE redigidos): ______
- política de privacidade aplicada; PROIBIDO usar dados reais de clientes.

## Sequência pós-desbloqueio (C24 objetivos 3→5)

1. QA verde (workflow acima) → 2. Desktop **1.0.169-QA** (bump + build
   apontando EXCLUSIVAMENTE para o Worker QA, identificado visualmente como
   QA, sem release/tag) → 3. prova física da ETAPA 5 (Cronograma, Roteiro
   4/6/8/12, wizard nos 4 quadros) com evidências → só então abrir
   **F3.3.73I6C25-PRODUCTION-CUTOVER-DESKTOP-1.0.169** (única fase
   autorizada a criar KV de produção, implantar o Worker C23 e publicar).

## ATUALIZAÇÃO C24 — QA DESBLOQUEADO PARCIALMENTE (runs 3→5)

- **Bloqueio 1 (token Cloudflare): RESOLVIDO pela equipe operacional.**
  Run #5 (`29518981844`) VERDE: namespace `SHARE_SNAPSHOTS_QA`
  (`699bc76fcdec46889863bd07439c3972`), serviço `idseven-push-qa`
  implantado, contrato READY/NOT_FOUND/imagens/HIT/HEAD/401/400/502
  validados ao vivo, produção intocada (gate final).
  Aprendizados de consistência eventual registrados nos commits
  `c3ac27f` (KV write→read: run 3) e `aa5f237` (secret put → nova
  versão do worker: run 4) — relevantes para o cutover C25.
- **Desktop 1.0.169-QA**: branch `desktop/f3373i6c24-qa-1.0.169-qa`
  (sabor de QA; nunca mergear) — aponta só para o Worker QA, banner
  permanente de QA, allowlist do prewarm no host QA.
- **SUB-BLOCKER NOVO (equipe operacional) — secrets próprios do Worker QA**
  para o fluxo Card end-to-end do Desktop-QA (ETAPA 5):
  1. criar service account GCP de QA com leitura de
     `tasks` (Firestore) — console GCP (IAM) do projeto;
  2. `wrangler secret put` no serviço `idseven-push-qa` (token QA já
     habilitado): `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`,
     `FCM_PROJECT_ID` (=agenda-id-seven), `TEAM_SESSION_SECRET`
     (CSPRNG novo, exclusivo de QA).
  Sem esses secrets, o POST /share-snapshot em QA responde 502 explícito
  (comprovado e esperado) e o /team/session responde 503 — o Desktop-QA
  bloqueia o WhatsApp corretamente (fail-closed), mas a prova física
  fim-a-fim não fecha.
- **Bloqueio 2 (WhatsApp Business QA)**: permanece com a equipe
  operacional (dispositivo/número/conta/sessão) — registro acima.

## ATUALIZAÇÃO C24A — SECRETS DO WORKER QA: RESOLVIDO PELO PIPELINE

- **Sub-blocker "secrets próprios do Worker QA": RESOLVIDO sem ação
  operacional**, pelo workflow `ops-qa-secrets-c24a.yml`
  (run 2 = `29521583522`, VERDE):
  1. **Análise explícita da credencial** (exigida pelo mandato antes de
     qualquer cópia): a SA `GOOGLE_APPLICATION_CREDENTIALS_JSON` — a mesma
     já confiada ao pipeline p/ Secret Manager — provou LEITURA de
     Firestore no projeto `agenda-id-seven` (GET de doc inexistente →
     HTTP 404; sem permissão seria 403). Nenhum secret do serviço de
     produção foi lido/copiado; o serviço de produção não foi tocado.
  2. **Provisão (somente `idseven-push-qa`)**: secrets `FCM_CLIENT_EMAIL`
     + `FCM_PRIVATE_KEY` (da SA), `TEAM_SESSION_SECRET` (CSPRNG novo,
     exclusivo de QA) e `TEAM_API_KEY` (CSPRNG renovado). `FCM_PROJECT_ID`
     permanece **VAR** (id público, não-segredo): secret homônimo colide
     com a var implantada (API 10053, run 1); o deploy aplicou
     `FCM_PROJECT_ID="agenda-id-seven"` com o MESMO código do run 5.
  3. **Validação ao vivo da cadeia completa** (sem tarefa física e sem
     escrever em produção): POST `/share-snapshot` autenticado com taskId
     sintético inexistente → **404 `task_not_found`** (prova
     chave→OAuth Google→consulta REAL ao Firestore, somente leitura);
     `/team/session` com credencial inválida → **401 genérico**
     ("credenciais inválidas"); seeds sintéticos continuam **READY**;
     gate final: **produção intacta** (`V64.59-c20-golden-contract`).
- **Endurecimento recomendado (opcional, equipe operacional/IAM)**: criar
  SA GCP DEDICADA somente-leitura (`roles/datastore.viewer`) p/ o Worker
  QA e regravar `FCM_CLIENT_EMAIL`/`FCM_PRIVATE_KEY`. O pipeline NÃO faz
  isso por design: conceder papel exige alterar a IAM policy do projeto
  de PRODUÇÃO (`setIamPolicy`), o que é vedado ao pipeline nesta fase.
- **Workflow `deploy-worker-qa.yml` atualizado (C24A)**: preserva a var
  `FCM_PROJECT_ID` real no deploy (não regride p/ `qa-sem-firestore`),
  gate C3 passa a exigir **404 `task_not_found`** quando a credencial GCP
  existe (502 explícito segue valendo no mundo sem credencial) e ganhou
  gate de **portal acessível** (`/cliente/cronograma/<token sintético>` →
  404 HTML amigável "Cronograma não encontrado" via consulta real).
- **ÚNICO bloqueio restante = Bloqueio 2 (físico)**: dispositivo/número/
  conta WhatsApp Business de QA + instalação do Desktop **1.0.169-QA**
  (run 224: EXE sha256 `82886cd2…7a14a49`, MSI `c9897657…aeeb46`) +
  execução das ETAPAS 2–7 da C24A (wizard nos 4 quadros; E2E Cronograma
  3/6/12 e Roteiro 4/6/8/12 com tarefa de CLIENTE SINTÉTICO criada no
  próprio Desktop-QA; evidências com tokens redigidos). Nada disso pode
  ser executado deste ambiente (sem dispositivo/SIM/sessão WhatsApp) e
  NADA é transferido ao owner.

---

# ADENDO F3.3.73I6C24B — PROVA FÍSICA WHATSAPP QA: ROTEIRO EXECUTÁVEL (equipe operacional)

## Ponto exato do NO-GO (registro exigido pelo mandato C24B)

- **Falha na etapa 0 (provisão do ambiente físico), não em código**: o
  executor da fase é um container Linux de nuvem SEM dispositivo, SIM,
  telefone, conta WhatsApp Business ou sessão WhatsApp Web autenticada.
- **Evidência objetiva (2026-07-16T18:06Z, nesta sessão)**:
  1. enumeração de conectores instalados → somente `Cloudflare Developer
     Platform`, `meta ads`, `Windsor.ai` (nenhum é cliente WhatsApp; os
     três sem OAuth possível em sessão não-interativa);
  2. busca de ferramentas por `whatsapp/message/send/phone/sms/device` →
     nenhuma ferramenta de WhatsApp/SMS/dispositivo disponível;
  3. egress direto do sandbox a `*.workers.dev` bloqueado pelo proxy
     (CONNECT 403) — até WhatsApp Web seria inalcançável daqui, e
     autenticá-lo exigiria QR de aparelho com conta ativa (inexistente).
- Consequência: é PROIBIDO declarar GO (nenhum Card foi visto no
  WhatsApp Business QA) e é PROIBIDO simular/usar dummy como prova.
  Produção intocada; nenhum código alterado; nenhum build/release novo.

## Estado do ambiente (pronto AGORA para a prova — nada a reconstruir)

| Item | Valor | Prova |
|---|---|---|
| Worker QA | `idseven-push-qa` / `V64.59-c23-share-snapshot` | run 6 `29521890042` (17:57Z): `QA ativo` |
| Version ID QA | `8e249449-9aae-4900-80e1-fd228377ab8f` | log do deploy (run 6) |
| KV QA | `SHARE_SNAPSHOTS_QA` = `699bc76fcdec46889863bd07439c3972` | run 6 (reuso idempotente) |
| Secrets QA | FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY/TEAM_SESSION_SECRET/TEAM_API_KEY | run `29521583522` verde |
| Cadeia Firestore | POST `/share-snapshot` → 404 `task_not_found`; portal → 404 amigável | runs `29521583522`/`29521890042` |
| Desktop QA | **1.0.169-QA** (run 224 `29519468683`, commit `2a06de0`) | EXE `82886cd2a7f92047ffcc83895bfa9179aa220ea3e5792d7078a17551f7a14a49`; MSI `c989765718edea195ecba5e8413cd9ed48523b3f1df8e51ba78a567831aeeb46` |
| Produção | `V64.59-c20-golden-contract` (intacta) | gate final dos 2 runs |

## Roteiro VERBATIM da prova (executar e anexar evidências via PR/commit)

Ambiente obrigatório: número/SIM de QA; conta WhatsApp Business exclusiva
de QA; telefone controlado pela equipe; WhatsApp Web autenticado; Windows
de QA; Desktop 1.0.169-QA instalado (verificar SHA-256 acima e o banner
"AMBIENTE QA"); NENHUM dado real de cliente.

TESTE CRONOGRAMA: 1) criar tarefa sintética pela UI; 2) confirmar cliente
e conteúdos; 3) gerar share snapshot; 4) confirmar "Card Premium
preparado"; 5) abrir WhatsApp Business; 6) confirmar Card Premium
visível; 7) confirmar "Aprovar cronograma" + imagem correta + link
correto; 8) abrir portal; 9) aprovar; 10) confirmar retorno ao Desktop;
11) reenviar e confirmar URL estável.

TESTE ROTEIRO: 1) criar tarefa sintética pela UI; 2) confirmar ausência
de designer/responsável; 3) confirmar 4/6/8/12; 4) gerar share snapshot;
5) confirmar "Card Premium preparado"; 6) abrir WhatsApp Business;
7) confirmar Card Premium visível; 8) confirmar "Aprovar roteiro" +
"Roteiro de gravação de vídeos" + logo oficial Id Seven + arte correta;
9) abrir portal; 10) aprovar; 11) confirmar retorno ao Desktop;
12) reenviar e confirmar URL estável.

TESTE NOVA TAREFA: 1) abrir Quadro de Cronograma; 2) clicar no botão
global "Nova tarefa"; 3) confirmar etapa Setor; 4) repetir em Roteiro,
Edição de mídia e Programação de posts; 5) confirmar que nenhum setor ou
formulário anterior é herdado.

EVIDÊNCIAS OBRIGATÓRIAS: vídeo ou screenshots; data e hora; versão
Desktop (1.0.169-QA); versão Worker (V64.59-c23-share-snapshot); Card
Cronograma; Card Roteiro; portal; aprovação; retorno ao Desktop; Nova
tarefa abrindo Setor; tokens SEMPRE redigidos.

PROIBIÇÕES: não pedir teste ao owner; não usar conta pessoal do owner;
não tocar produção; não alterar código; não gerar novo build; não criar
release/tag; não usar dummy como prova física; não declarar GO sem Card
visível no WhatsApp Business QA.

RESULTADO: GO E2E QA somente com TODAS as provas físicas. Só após o GO:
**F3.3.73I6C25-PRODUCTION-CUTOVER-DESKTOP-1.0.169**.

---

# ADENDO F3.3.73I6C24C — CAUSA-RAIZ CORRIGIDA + CANDIDATA 1.0.170-QA (substitui a 1.0.169-QA)

## Por que a 1.0.169-QA falhou fisicamente (HARD NO-GO) — causa PROVADA

`git diff 4fb0a7f→2a06de0`: a **1.0.169-QA foi cortada da base C20 (1.0.168)**,
que NÃO tem a etapa de publicação do snapshot (`ensureShareSnapshot` / POST
`/share-snapshot`). Contra o Worker C23 (GET público serve **só** o snapshot do
KV), o card nunca era publicado → GET `/share` respondia **404 not_found** → o
prewarm falhava em `get1` → botão desabilitado → "Não foi possível preparar o
Card Premium" — **antes** do WhatsApp. A "arte de cronograma" no Roteiro era
resíduo legado da mesma base C20. **A 1.0.169-QA está DESCARTADA.**

## O que foi corrigido na RAIZ (C24C)

- **Worker** `worker/f3373i6c23-share-snapshot` @ `30d64ba`: READY só após
  **readback** do KV (poll com backoff; timeout → 503 `kv_not_visible`, nunca
  ready antecipado); **códigos estruturados** de falha; **trace** `X-QA-Trace-Id`
  (só quando `QA_TRACE=1`); warm da Cache API também na ORIGEM; `og{title,
  description,imagePath}` na resposta. Deploy QA vivo verde: run
  `29528374193` (endpoint 404 `task_not_found` real, portal 404 amigável,
  produção intocada).
- **Desktop 1.0.170-QA** `desktop/f3373i6c24c-qa-1.0.170-qa` @ `301a26c`:
  reconstruída sobre a **base C23** (`4b15fc7` — tem o fluxo snapshot-antes-do-
  WhatsApp + reset do wizard) + sabor QA + melhorias C24C (prewarm estruturado;
  preview por OG do tipo com skeleton; **resíduo removido**; trace).

## Candidata FÍSICA a instalar (substitui 1.0.169-QA) — build run 225 (`29528415451`)

| Item | Valor |
|---|---|
| Versão | **1.0.170-QA** |
| EXE | `Agenda-ID-Seven-Desktop-1.0.170-QA-x64.exe` |
| SHA-256 EXE | `c051f3cbe9e86482fd7034dbafc829a439d0c07581339df145a5da005d6aef35` |
| MSI | `Agenda-ID-Seven-Desktop-1.0.170-QA-x64.msi` |
| SHA-256 MSI | `c939b64a25b6c64603da17656adac9cc9ae29da535be29540e8a93aceab52d68` |
| Artifact installer | `8387697287` |
| Artifact bundle | `8387701665` |
| Banner permanente | "AMBIENTE QA — NÃO USAR COM CLIENTES" |
| Aponta para | Worker QA `idseven-push-qa` (exclusivo) |

## Prova hermética ponta a ponta (worker REAL + prewarm REAL) — antes da física

`scripts/f3373i6c24c-integrated-prewarm.e2e.test.mjs` (branch do worker) **26/26**:
reproduz a falha da 1.0.169-QA (sem POST → get1 not_found), prova o fix
Cronograma+Roteiro (botão liberado, arte do tipo, URL estável) e a matriz de
falhas (auth/task/type/kv/imagem/cache → botão desabilitado, razão exata, sem
WhatsApp). Golden Master 56/56; regressão desktop integral verde.

## O que a equipe operacional executa AGORA (idêntico ao roteiro C24B acima)

Instalar a **1.0.170-QA** (conferir SHA-256 acima e o banner) no Windows de QA e
rodar os TESTES CRONOGRAMA / ROTEIRO / NOVA TAREFA do adendo C24B, coletando
evidências (tokens redigidos). Expectativa técnica agora: o modal mostra
"Preparando prévia…" → "Card Premium preparado", o botão do WhatsApp **habilita**,
e o card aparece no WhatsApp Business QA com a arte do tipo correto (v64-39
cronograma / v64-60 roteiro). Só então **GO E2E QA** e abertura da
**F3.3.73I6C25-PRODUCTION-CUTOVER-DESKTOP-1.0.170** (produção segue intocada:
Worker `V64.59-c20-golden-contract`, Desktop 1.0.168).

---

# ADENDO F3.3.73I6C24D — GATE DE URL corrigido + candidata 1.0.171-QA (substitui a 1.0.170-QA)

## Por que a 1.0.170-QA falhou fisicamente (HARD NO-GO) — causa PROVADA (linha exata)

A prévia carregava, mas ao clicar aparecia **"Link inválido — gere o cronograma
novamente."** e os 3 botões travavam. Causa-raiz no renderer, função
`_gateValidLink` (segundo validador, separado do prewarm): fixava o host de
**produção** (`indexOf('https://aprovar.agendaidseven.com.br/share/cronograma/')
===0`) e **rejeitava `workers.dev`** (`!/workers\.dev/.test`) — reprovando o
próprio host de QA do build. O prewarm (`isAllowedShareUrl`) já fora corrigido
na C24C, mas este segundo validador ficou com a allowlist de produção.
Reproduzido no código real (RED): `RED_CRONOGRAMA/ROTEIRO_LINK_INVALID_CONFIRMED`.
**A 1.0.170-QA está DESCARTADA.**

## O que foi corrigido na RAIZ (C24D) — fail-closed, sem enfraquecer segurança

- **allowlist EXPLÍCITA por ambiente**: `SHARE_ENV`/`SHARE_ALLOWED_HOST`
  (QA=host QA; prod=host oficial) + invariante de build (host do
  `CLIENT_LINK_BASE` === allowlist).
- **`validateShareUrl()`**: validação ÚNICA por `new URL()` — host **EXATO**
  (`===`, nunca includes/startsWith/wildcard), https, rota oficial, token no
  formato, tipo válido; rejeita espaços/invisíveis/credencial/porta/query.
- **URL canônica única**: os 3 botões (WhatsApp/Copiar/Testar) observam a MESMA
  `canonicalShareUrl` e o MESMO estado (nascem `disabled`; só habilitam com
  prewarm ok **E** URL válida; qualquer falha → os 3 bloqueados, reason exato).
- **texto por setor**: "gere o roteiro novamente"/"Preparando o link do
  roteiro…"/"Link do roteiro pronto para envio." (sem contaminação de cronograma).
- **gate EMPACOTADO** (app.asar) no `desktop-build.yml`: reprova build QA que
  reintroduza o validador legado (provado: detecta a 1.0.170-QA, aprova a
  1.0.171-QA). O **Worker QA não mudou** — a causa é 100% renderer.

## Candidata FÍSICA a instalar (substitui 1.0.170-QA) — build run 226 (`29531146350`)

| Item | Valor |
|---|---|
| Versão | **1.0.171-QA** |
| Branch/commit | `desktop/f3373i6c24d-qa-1.0.171-qa` @ `77f84f0` |
| EXE | `Agenda-ID-Seven-Desktop-1.0.171-QA-x64.exe` |
| SHA-256 EXE | `3d29eebea4f553a968d5be5c6eb470052dad1a854d4ed5778c57a4f2aeae8f5f` |
| MSI | `Agenda-ID-Seven-Desktop-1.0.171-QA-x64.msi` |
| SHA-256 MSI | `e844f87bc08dca6d0bb0ace8a2e4dffd0c55dc41a8bd5e47de3df032d999b289` |
| Artifact installer | `8388728455` |
| Artifact bundle | `8388733727` |
| Banner permanente | "AMBIENTE QA — NÃO USAR COM CLIENTES" |
| Aponta para | Worker QA `idseven-push-qa` (exclusivo; host QA aceito pela allowlist) |

## Provas
Suite do gate de URL `f3373i6c24d-share-url-gate.test.mjs` **35/35** (RED→GREEN;
matriz host/proto/path/token/tipo/re-render/reenvio/URL-canônica/texto/
fail-closed); regressão desktop integral **verde**; tsc limpo; gate empacotado
provado. Worker QA C24C permanece vivo (run `29528374193`); produção intocada.

## O que a equipe operacional executa AGORA
Instalar a **1.0.171-QA** (conferir SHA-256 acima e o banner) e rodar o roteiro
C24B (Cronograma/Roteiro/Nova tarefa). Expectativa técnica: os 3 botões
habilitam com o host QA, "Link do &lt;tipo&gt; pronto para envio.", e o card
aparece no WhatsApp Business QA. Só então **GO E2E QA** e
**F3.3.73I6C25-PRODUCTION-CUTOVER-DESKTOP-1.0.171**.

---

# ADENDO F3.3.74B — SHARE NATIVO: Card Premium como IMAGEM REAL (candidata 1.0.172-QA)

## Mudança de conceito (decisão funcional do owner)

O envio **não depende mais do preview automático do link** no WhatsApp
(Open Graph/prewarm/cache-HIT viraram **bônus**, nunca gate). O app gera
nativamente o pacote de envio: **imagem premium real** (arte aprovada por
tipo, byte-exata: v64-39 cron / v64-60 roteiro + faixa "Cliente ·
quantidade"), **mensagem por tipo** com o link de aprovação (allowlist
C24D) e **abertura assistida** do WhatsApp Business.

## Novo fluxo físico (o que a equipe vai ver na 1.0.172-QA)

1. Abrir a tarefa → "Enviar no grupo do cliente": o modal mostra
   "Preparando o card premium do &lt;tipo&gt;…" e então a **prévia da imagem
   REAL gerada** + "Card premium pronto para envio".
2. Clicar **"Abrir WhatsApp Business"**: a IMAGEM vai ao clipboard
   (read-back confirmado) e o WhatsApp abre. No grupo: **colar (Ctrl+V) a
   imagem e enviar**; depois **"Copiar mensagem"** e colar/enviar (é a
   mensagem que leva o link de aprovação). Botões extras: Copiar link /
   Testar link / Regenerar card.
3. Critério de sucesso FÍSICO: **imagem premium real enviada no grupo** +
   mensagem com link funcional (portal abre; aprovação flui). O preview
   automático do link, se aparecer, é bônus — NÃO é critério.
4. Limite honesto da plataforma: o WhatsApp não permite envio 100%
   automático em grupo; o clipboard segura UM item por vez (imagem OU
   texto) — por isso o fluxo é assistido em 2 colagens.

## Candidata FÍSICA a instalar (substitui 1.0.171-QA) — build run 227 (`29535973035`)

| Item | Valor |
|---|---|
| Versão | **1.0.172-QA** |
| Branch/commit | `desktop/f3374b-qa-1.0.172-qa` @ `fb3b546` |
| EXE | `Agenda-ID-Seven-Desktop-1.0.172-QA-x64.exe` |
| SHA-256 EXE | `aac6be0069bef548bb0e6c38e083c75fa3159eb1c4dcc4f7431d4c9a53ff82c0` |
| MSI | `Agenda-ID-Seven-Desktop-1.0.172-QA-x64.msi` |
| SHA-256 MSI | `56fec965ac7c25bb13053bc03e7c7dd367150a207a131351f58ab3a9057e513e` |
| Artifact installer | `8390594819` |
| Artifact bundle | `8390598240` |
| Banner permanente | "AMBIENTE QA — NÃO USAR COM CLIENTES" |
| Gate empacotado (app.asar) | verde no run 227 (validateShareUrl/allowlist QA/textos por setor) |

Provas técnicas: suíte 74B `f3374b-share-package.test.mjs` **36/36** (artes
embutidas byte-exatas sha256 `c038636d…`/`f64f6f3e…`; tipos fortes; matriz de
negativos; fiação do modal); sweep integral **verde**; tsc limpo; **cards REAIS
gerados pelo código do renderer em Chromium headless** (1200×630 PNG, cron +
roteiro) entregues como evidência visual. Produção intocada (Desktop 1.0.168;
Worker `V64.59-c20-golden-contract`).

---

# ADENDO F3.3.74C — PACOTE ÚNICO: imagem+legenda+link em UMA mensagem de mídia (candidata 1.0.173-QA)

## Por que a 1.0.172-QA reprovou fisicamente (HARD NO-GO do owner)

Na 1.0.172-QA a imagem premium chegou ao grupo, mas **sem legenda e sem link
clicável**: o clipboard do Windows carrega UM item por vez, então o fluxo
exigia **duas colagens** (imagem; depois texto). O owner rejeitou o mecanismo
— cliente final não pode depender de segunda colagem. Requisito DEFINITIVO:
o WhatsApp Business deve receber **UMA ÚNICA mensagem de mídia** com (1) a
imagem premium real, (2) a legenda correta e (3) o link de aprovação clicável
dentro da legenda.

## O que mudou na 1.0.173-QA (troca de mecanismo, não cosmética)

- Novo helper nativo **`AgendaIdSeven.NativeShare.exe`** (C++/WinRT, Win32),
  embutido no instalador (`resources/native-share`), chamado pelo processo
  main por IPC restrito. Ele monta **UM DataPackage** com **StorageItems
  (PNG real do card) + Text (legenda completa com o link) + WebLink +
  Title/Description + Thumbnail** e abre o **Windows Share UI** ancorado em
  janela própria (`IDataTransferManagerInterop::ShowShareUIForWindow` —
  padrão Win32 que NÃO exige package identity/MSIX).
- O botão principal do modal virou **"Compartilhar Card Premium no
  WhatsApp"**: abre o Share do Windows; a equipe escolhe **WhatsApp
  (Business)** → grupo do cliente; imagem+legenda+link seguem **JUNTOS na
  mesma mídia**. **Sem segunda colagem.**
- Cancelar/fechar sem confirmar → estado honesto ("Nada foi enviado").
  Helper indisponível/falha real → **MODO ALTERNATIVO** rotulado (o fluxo
  assistido da 74B, nunca apresentado como solução definitiva).
- Telemetria sanitizada (nunca legenda/URL completa/token; só flags, host,
  tamanhos, alvo e duração) com trace QA.

## Prova de pacote em CI (FASE 12 — "QA Share Target") — run 228 (`29539245049`)

O gate compila o helper (MSVC `/std:c++20`) e roda `--selftest`: monta o
DataPackage real e o **RELÊ** pelo `DataPackageView` — o MESMO objeto que um
Share Target recebe — exigindo TODOS os formatos simultaneamente:
`storageItems:true` (`itemCount:1`), `text:true`, `webLink:true`,
`titlePresent:true`, `descPresent:true`. Resultado do run 228: `selftest_ok` em 47 ms — `storageItems:true, text:true, webLink:true, titlePresent:true, descPresent:true, itemCount:1, textLen:180, linkHost:idseven-push-qa.agidseven.workers.dev` (valores relidos do próprio pacote).
Gate pós-build confirma o helper DENTRO do instalador
(`resources/native-share/AgendaIdSeven.NativeShare.exe`, 394.240 bytes).

**HONESTIDADE:** isso prova a **COMPOSIÇÃO** do pacote entregue ao Windows.
NÃO prova o comportamento do WhatsApp Business ao recebê-lo — essa prova é
FÍSICA (roteiro abaixo). **PROIBIDO GO só pelo selftest.**

## Candidata FÍSICA a instalar (substitui 1.0.172-QA) — build run 228 (`29539245049`)

| Item | Valor |
|---|---|
| Versão | **1.0.173-QA** |
| Branch/commit | `desktop/f3374c-qa-1.0.173-qa` @ `f34c872` |
| EXE | `Agenda-ID-Seven-Desktop-1.0.173-QA-x64.exe` |
| SHA-256 EXE | `cc6cfae0d28799d1844567fcfba8bb2134a62b851b11c3f4ea635cfcbab5a334` |
| MSI | `Agenda-ID-Seven-Desktop-1.0.173-QA-x64.msi` |
| SHA-256 MSI | `bf975a9626a0917df6d6d145550d75b768dc688e9a51e326501bd093a09e4a1f` |
| Artifact installer | `8391826153` |
| Artifact bundle | `8391830106` |
| Banner permanente | "AMBIENTE QA — NÃO USAR COM CLIENTES" |
| Gates do run 228 | compilação helper + selftest FASE 12 + tray + prova-de-versão + URL C24D + helper empacotado: todos VERDES (15/15 passos) |

## O que a equipe operacional executa AGORA (prova física 74C — Cronograma E Roteiro)

1. Instalar a **1.0.173-QA** (conferir SHA-256 acima; banner QA visível).
2. Tarefa de **Cronograma** → "Enviar no grupo do cliente" → aguardar
   "Card premium do cronograma pronto para envio" (prévia = imagem REAL).
3. Clicar **"Compartilhar Card Premium no WhatsApp"** → na janela de
   compartilhamento do Windows escolher **WhatsApp (Business)** → escolher o
   **grupo QA** → conferir a prévia da mensagem → **confirmar o envio**.
4. **Verificar no grupo (no celular e no desktop):** deve haver **UMA única
   mensagem de mídia** com a imagem premium + legenda completa + **link
   clicável** que abre o portal QA (testar o toque no link no celular).
5. Repetir os passos 2–4 com uma tarefa de **Roteiro** (arte de roteiro,
   texto de roteiro, título "Aprovar roteiro" — sem nenhum texto de
   cronograma).
6. Evidências obrigatórias: print do grupo mostrando imagem+legenda+link em
   UMA mensagem (cron E roteiro); print do portal aberto a partir do link;
   diagnóstico QA `qa.desktop.nativeshare.result` com `ok:true` +
   `target:sim`.

**Critério de GO:** somente se, para **os dois tipos**, a mensagem única de
mídia chegou com imagem + legenda + link clicável, **sem segunda colagem** e
sem contaminação de tipo. **Se o WhatsApp Business descartar o Text/WebLink
do DataPackage** (limitação do alvo, fora do nosso controle): registrar
**NO-GO objetivo** com o print + o evento `target_selected`, e a fase
seguinte decide o caminho (ex.: Share Target dedicado/outro canal). O MODO
ALTERNATIVO (74B) permanece embutido como contingência — rotulado como tal.

---

# ADENDO F3.3.74F — AUDITORIA FULL-STACK: primeiro ponto real de divergência COMPROVADO ao vivo

## O que a auditoria DESCARTOU com prova (nada disso é a causa)

- **Mensagem/clipboard-fonte:** byte-idêntica na 1.0.153 × 1.0.168 × 1.0.174 (mesmo sha256,
  265 chars, 8 linhas, zero caracteres invisíveis, link sozinho em linha própria).
- **HTML/OG do Worker para token RESOLVIDO:** byte-idêntico entre o Worker bom
  (V64.59-legacy-risk) e o de produção (c20) — só headers de diagnóstico a mais.
- **DNS/TLS:** saudáveis nos dois hosts (Cloudflare anycast; certificados válidos; ALPN h2).
- **WAF/Bot Fight/challenge:** ZERO mitigação para browser/facebookexternalhit/WhatsApp,
  GET e HEAD, nos dois hosts (matriz viva de 22 requisições, run `29544534906`).
- **Imagem OG ao vivo:** 200 image/jpeg, byte-exata (`c038636d…`, 144.941 bytes) nos dois
  hosts, TTFB ~40 ms.

## O PRIMEIRO PONTO REAL DE DIVERGÊNCIA (com data, requests e bytes)

O MESMO token real (default público do workflow `wa-share-meta-probe`), na MESMA URL:

| Quando | Worker vigente | Resposta viva |
|---|---|---|
| 21/06 e 09/07 (era do GO físico) | V64.59-legacy (estático) | **200 + OG 9/9** (2.324 bytes) |
| 15/07 23:03 (probe C18E #6) | C18E (com lookup) | tokens reais: **200 miss→hit + OG tipado**; dummy: **200 + OG genérico (fail-open)** |
| 16/07 12:11 | **deploy #78 → c20-golden-contract** | — |
| 16/07 (mesmo dia) | c20 | **C22: primeiro NO-GO físico registrado** |
| 17/07 00:33 (hoje) | c20 | **404 + OG 0/9** (714 bytes, página not_found SEM NENHUMA meta OG, no-store) |

**Divergência:** o c20 transformou o `/share` de **fail-open com OG sempre** (contrato da
época fisicamente aprovada, vigente até 15/07 23:03) em **fail-closed sem OG** para qualquer
token não-resolvido — e o token que resolvia ao vivo em 15/07 hoje NÃO resolve. Qualquer
colagem cujo lookup não resolva recebe uma página sem NENHUM OG → o WhatsApp não tem o que
renderizar → sem Card Premium, em QUALQUER versão do Desktop (por isso a 1.0.174 falhou
mesmo com o clique restaurado). Fatores secundários registrados: TTFB do /share subiu de
~40 ms (estático) para 1,0–2,3 s (OAuth+Firestore por requisição não cacheada); robots.txt
GERENCIADO na zona (fora do git; o worker não tem handler) bloqueando `GPTBot` e
`meta-externalagent` com `Disallow: /`.

## O discriminador que falta (UMA sessão correlacionada com a equipe)

Para separar os 3 ramos possíveis para TAREFAS NOVAS — (i) o WhatsApp nem busca a URL;
(ii) busca e recebe 404 (lookup vivo falhando também para tarefas novas); (iii) busca,
recebe 200+OG e não renderiza (lado Meta/dispositivo) — executar:

1. Actions → **"[manual] F3.3.74F Crawler Capture (tail janela)"** → Run workflow
   (window_minutes=12; note=colagem-<data>). Aguardar no log "JANELA ATIVA".
2. Na 1.0.174-QA: criar tarefa sintética NOVA de Cronograma → "Abrir WhatsApp Business
   para enviar no grupo" → colar no grupo QA → aguardar até 60 s → enviar mesmo sem prévia.
3. Repetir com Roteiro dentro da MESMA janela.
4. O run imprime (sanitizado, token nunca aparece): se houve requisição, quando, GET/HEAD,
   user-agent, status devolvido e se a imagem foi buscada. Anexar o print do grupo.

## Pendências para a equipe

- Secrets `C18E_CRONOGRAMA_TOKEN` / `C18E_ROTEIRO_TOKEN`: existem mas com caractere
  inválido (rotacionados/alterados pós-fase) — re-gravar com tokens válidos de tarefas QA
  reais reabilita o probe diferencial completo (`c18e-share-differential-probe`).
- robots.txt gerenciado da zona: revisar no painel Cloudflare (Bot Management / AI bots)
  quando foi habilitado; o conteúdo integral está no artifact `f3374f-crawler-capture-*`.

## Correção cirúrgica candidata (camada COMPROVADA; não aplicada — produção congelada)

No Worker (`handleShareCard`): restaurar **fail-open do OG** — token não-resolvido volta a
receber a página de card genérica (200 + OG completo, `no-store`, sem aquecer cache; sem
contaminação: resolvido continua tipado; erro de lookup idem fail-open). É a restauração
exata do comportamento vigente até 15/07 (C18E) e equivalente ao da baseline física de
10/07. Validar primeiro no serviço QA (`idseven-push-qa`) com captura correlacionada e
prova física, antes de qualquer produção.

Provas: runs `29544534906` (edge audit), `29545126269`/`29026657304`/`27920037629`
(meta-probe hoje/09-07/21-06), `29457363181` (C18E #6 15/07), `29544795520`+`29545099725`
(capturas baseline; robots integral no artifact). Produção intocada (somente leituras).

## ADENDO 74F-B — ESPELHO DE PRODUÇÃO EM QA COM O FIX ESTÁ NO AR (prova viva pós-fix verde)

O serviço `idseven-push-qa` agora roda o **espelho de produção com a correção 74F**
(`V64.59-c20-failopen-74f`, branch `worker/f3374f-share-og-failopen-candidate` @ `d134193`,
deploy run `29572278371`, 17/07 10:06 UTC). **Atenção:** isto SUBSTITUIU o worker
C23-snapshot do serviço QA (linha 1.0.169–1.0.173, revogada pelo owner). Produção
(`idseven-push`) confirmada intocada no gate final do mesmo run.

**Prova viva pós-fix (gates do run, todos verdes):** token dummy em
`/share/cronograma/…` no host QA respondeu **200 + X-Share-Task=not_found +
X-Share-Type=generic + no-store + OG completo (≥9 metas, título "Aprovar cronograma",
arte v64-39) + bypass no 2º GET + HEAD 200 text/html** — exatamente o contrato
fisicamente aprovado, onde produção hoje responde 404 sem NENHUMA meta. Artes
byte-exatas no espelho (cron `c038636d…`, roteiro `f64f6f3e…`).

### Roteiro físico ANTES/DEPOIS (equipe; ~15 min, no mesmo WhatsApp Business QA)

1. **Janela de captura no espelho:** Actions → "[manual] F3.3.74F Crawler Capture" →
   Run workflow com `service=idseven-push-qa`, `window_minutes=12`,
   `note=fisico-espelho-74f`. Aguardar "JANELA ATIVA" no log.
2. **DEPOIS (fix):** colar no grupo QA a URL do espelho com QUALQUER token 48-hex, ex.:
   `https://idseven-push-qa.agidseven.workers.dev/share/cronograma/f3374fmirror0000000000000000000000000000000000001`
   → aguardar até 60 s → o Card Premium DEVE aparecer (página com OG sempre presente).
3. **ANTES (produção, controle):** na mesma janela (ou numa segunda com
   `service=idseven-push`), colar a URL de uma tarefa sintética criada na 1.0.174
   (domínio `aprovar.agendaidseven.com.br`) → registrar SIM/NÃO do card.
4. O log do run mostra, sanitizado, cada requisição do WhatsApp (método, UA, status,
   busca da imagem) — anexar prints do grupo + link do run.

**Leitura dos resultados:** espelho SIM + produção NÃO ⇒ causa 74F confirmada de ponta
a ponta → promover o fail-open à produção em fase autorizada. Espelho NÃO ⇒ examinar a
captura (se o WhatsApp nem requisitou → causa no lado do cliente/dispositivo; se
requisitou 200+OG e não renderizou → política/cache Meta — investigar com a captura em mãos).

## ADENDO 74G — A COLAGEM FÍSICA NO ESPELHO (workers.dev) NUNCA CHEGOU AO WORKER (classificação A)

A colagem já realizada (~07:28 local = ~10:28 UTC de 17/07; link
`https://idseven-push-qa.agidseven.workers.dev/share/cronograma/<tok:3d9cb673>`, token
sintético inexistente no Firestore) foi rastreada READ-ONLY por GraphQL Analytics
(`workersInvocationsAdaptive`, por minuto) no workflow
`f3374g-trace-existing-attempt.yml` — runs `29573896114` (+6 min da colagem),
`29574067563` (janela 06:00–10:20), `29574082583` (janela do teste noturno 16/07) e
`29574564886` (+18 min da colagem).

**Resultado:** o script `idseven-push-qa` registrou APENAS as provas do deploy
(10:05 = 1, 10:06 = 21) e as sondas dos próprios runs (10:34 = 7, 10:37 = 16).
Na sub-janela da colagem (10:20–10:40 UTC), **ZERO invocações externas** — em
particular, no minuto 10:28 só existe o heartbeat de cron da produção. Controles
internos que blindam a leitura: (a) mesmíssimo pipeline mostrou as sondas feitas às
10:34/10:37 quando consultado às 10:46 (lag de ingestão vencido); (b) a produção
aparece com `sum.requests=1` em ~cada minuto por 4h+ (amostragem captura eventos de
1 request); (c) o fail-open estava no ar 22 min ANTES da colagem e a sonda do link
exato respondia `200 + 13 metas OG + not_found/generic/no-store`, X-Robots-Tag vazio,
imagem `200 image/jpeg 144941 B c038636d…` para os 3 UAs (browser/facebookexternalhit/
WhatsApp), GET e HEAD.

**Classificação (A–E do mandato): A — o WhatsApp/Meta NÃO requisitou a URL colada.**
O Worker QA (fail-open) **não participou da falha**: não houve request para divergir.
(Nota honesta: um bloqueio edge-side ao crawler específico do domínio compartilhado
workers.dev seria indistinguível de A do nosso ponto de observação — e tem a mesma
consequência operacional.)

**Contraste que orienta a próxima fase (workers.dev × domínio custom):** na janela do
teste físico noturno da 1.0.174 (16/07 23:30–17/07 00:30 UTC), a PRODUÇÃO (servida pelo
domínio custom `aprovar.agendaidseven.com.br`) mostra picos reais acima do baseline de
cron exatamente nos minutos do teste — 23:56 (5), 00:21 (24), 00:26 (3) — ou seja, o
WhatsApp BUSCA links do domínio custom (e o card falhou naquela noite pelo 404-sem-OG
fail-closed, causa 74F), mas NÃO busca links `*.workers.dev` (zero eventos na colagem).
DNS/TLS/WAF idênticos e limpos nos dois hosts (edge audit `29544534906`); robots.txt =
fallback JSON 200 em ambos (sem Disallow). O diferencial é o HOST, não a página.

**Consequência:** teste físico de card via `*.workers.dev` é INCAPAZ de exercitar o
fix (o crawler nunca vem). Próxima fase deve expor o candidato fail-open sob o domínio
custom (rota/subdomínio QA na zona, ou promoção autorizada à produção — congelada até
lá). Corrigido no `main` (commit `630742b`) o contador da sub-janela do workflow
(soma agora sai do JSON; as linhas por minuto sempre foram corretas).
