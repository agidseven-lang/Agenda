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
