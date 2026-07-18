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

## ADENDO 74H — HOST CUSTOM QA NO AR: aprovar-qa.agendaidseven.com.br → idseven-push-qa (fail-open)

A 74G provou que o WhatsApp NÃO busca links `*.workers.dev` (zero requests na colagem) e
BUSCA links do domínio custom (picos reais na produção no teste noturno). A 74H atacou
exatamente esse diferencial: o MESMO worker QA fail-open (candidata `d134193a5f65…`,
`V64.59-c20-failopen-74f`, SEM redeploy) agora atende também por um subdomínio próprio
e isolado da zona, criado como **Worker Custom Domain** (mesmo mecanismo do vínculo de
produção `aprovar.` → `idseven-push`):

- **Host QA:** `aprovar-qa.agendaidseven.com.br` (custom domain; DNS/cert gerenciados
  pela Cloudflare; cert dedicado GTS WE1 com SAN `aprovar-qa.` + `*.aprovar-qa.`,
  válido até 15/10/2026; ALPN h2; cf-ray ativo).
- **Rollback registrado:** `DELETE /accounts/<acct>/workers/domains/`
  `4bc9b2d4d35a301a7d8787ed97429201bee75cc4` (artifact `f3374h-custom-domain-evidence`,
  out/rollback.txt). Nada além desse objeto foi criado (zero mudança em `aprovar.`,
  rotas, WAF, cache, secrets).
- **Produção intocada** (gate no mesmo run): `aprovar.` e workers.dev de produção
  respondendo `V64.59-c20-golden-contract`; DNS de produção íntegro.
- **Runs:** capability gate `29575831445` (host livre; produção vinculada como custom
  domain; escopos de zona DENIED honestamente); criar+provar `29575882272` (criou o
  domínio; FASE 5 caiu por bug de shell no probe — `hv` + `-e`/pipefail — SEM efeito de
  borda) e `29576112006` (VERDE integral, caminho idempotente).

**Provas vivas no host custom (run `29576112006`):** 3 UAs (browser, facebookexternalhit,
WhatsApp) × GET+HEAD no `/share/cronograma/<tok:156df4c2>` → `200/200`, `text/html`,
**13 metas OG**, `X-Share-Task=not_found`, `X-Share-Type=generic`, `no-store`,
`X-Share-Cache=bypass` (2º GET continua bypass), `X-Robots-Tag` vazio; imagem
`/og/wa-card-v64-39.jpg` → `200`, 0 redirects, `image/jpeg`, 144941 B,
`c038636d…` byte-exata. `canonical`: ausente por design comprovado (HTML inalterado).

**Contraste workers.dev × custom QA (mesmo token, mesmo código):** GET/HEAD/headers/
metas/imagem/versão IGUAIS; HTML bruto difere APENAS pelo hostname — **normalizado por
hostname, sha256 idêntico** (`cbe4ea260443…`) nos dois hosts. Ou seja: a página é a
mesma; o que muda é SÓ o host — exatamente a variável que a 74G isolou.

**Observabilidade estrutural nova:** por estar NA ZONA, o host QA aparece no dataset
`httpRequestsAdaptiveGroups` (minuto, método, status, user-agent, ASN, path) — o que o
workers.dev nunca teve. Workflow `f3374h-crawler-trace-custom.yml` consulta a janela
dada (host QA + `/share/*` da produção para contraste, paths sanitizados) e, com
`probe=true`, valida o pipeline com sondas `74H-OBS-PROBE`:
- **Tail ao vivo (nível UA) VALIDADO** — run `29577789573`: as 4 sondas apareceram na
  janela com timestamp/método/status/outcome/ASN/país e URL sanitizada
  (correlação sub-segundo com `probe_fired_at`). O self-test achou e corrigiu 3
  defeitos reais ANTES de entregar o link ao owner: ponto cego de attach do
  `npx wrangler` frio, marcador de attach errado e parser JSONL que descartava
  eventos pretty-printed (agora decodifica STREAM). Commits no main:
  `630742b`, `d64bb6d`, `aa1f2ca`, `2a1f71d`, `2b13e33`.
- **Presença pós-fato (invocações) VALIDADA** — runs `29576790981`/`29577916070`:
  minuto exato das sondas com contagem esperada (4 e 5).
- **Dataset de zona (UA/ASN pós-fato) INDISPONÍVEL por escopo** — erro literal:
  `does not have permission 'com.cloudflare.api.account.zone.analytics.read'`.
  PENDÊNCIA equipe: adicionar "Zone Analytics: Read" (zona agendaidseven.com.br)
  ao token CF do CI — destrava auditoria pós-fato com UA/ASN sem coordenação.
- **robots do host custom QA:** gerenciado da zona (1908 B): `*` → `Allow: /`;
  `Disallow: /` SÓ para bots de IA (incl. `meta-externalagent`, que é o crawler
  de IA da Meta — NÃO o de preview). `facebookexternalhit`/WhatsApp: livres.
- **Ruído real no host novo:** ondas de scanners (56/78/83/100 req/min) começaram
  minutos após o cert entrar no CT log — identificação do crawler na prova física
  é POR UA na janela de tail, nunca por contagem de invocações.
- Nota menor: a etiqueta `<tok:sha8>` impressa pela captura divergiu do sha8
  local do token sintético (cosmético; sanitização OK; atribuição é por UA;
  investigar fora de fase).

### PROVA FÍSICA 74H — UM único link (Cronograma; token sintético SEM capacidade)

1. Actions → "[manual] F3.3.74F Crawler Capture (tail janela)" → Run workflow com
   `service=idseven-push-qa`, `window_minutes=30`, `note=fisico-74h-cronograma`.
   Aguardar "JANELA ATIVA" no log do run.
2. Colar SOZINHO no WhatsApp Business (grupo QA), aguardar até 30 s observando
   ANTES de enviar, e registrar captura de tela:
   `https://aprovar-qa.agendaidseven.com.br/share/cronograma/f3374a00000000000000000000000000000000000074a001`
3. O log do run mostra, sanitizado, cada requisição (UA, método, status, busca da
   imagem, ASN). Depois, rodar "[manual] F3.3.74H Crawler Trace (custom QA)" com a
   janela UTC correspondente (registro pós-fato de presença).
4. Leitura (FASE 9): request+card ⇒ **B** (host workers.dev era o diferencial → preparar
   `F3.3.74I-PRODUCTION-FAILOPEN-PROMOTION-PLAN`; nada é promovido automaticamente);
   request 200+OG sem card ⇒ **C** (registrar comportamento Meta; comparar com
   `aprovar.`); sem request ⇒ **A** (bloqueio antes da borda; comparar o mesmo
   aparelho com `aprovar.`); request com erro ⇒ **D** (primeiro divergente; fix só QA).

Rollback integral do host QA (se ordenado): `DELETE /accounts/<acct>/workers/domains/`
`4bc9b2d4d35a301a7d8787ed97429201bee75cc4` — remove DNS+cert+vínculo de uma vez;
nada mais foi criado nesta fase.

## ADENDO 74I — CAUSA-RAIZ CONSOLIDADA + CANÁRIO DE ROTA EXATA PRONTO (bloqueado por 1 permissão)

**Fato físico novo (mandato 74I):** run #14 (`29584936565`) — colagem no host custom QA
com observador PROVADO (TAIL_ATTACH_PROVADO + SELF_PROBE_CAPTURED=1) terminou com
`externos=0`. Com a 74G (zero em workers.dev × bursts reais em `aprovar.` no teste
noturno), fica demonstrado por contraste: **o WhatsApp busca o host histórico e não
busca hosts novos** — a validação física do fail-open TEM de acontecer em `aprovar.`.

**Causa-raiz consolidada (cadeia sob nosso controle, evidência primária):**
1. Desktop C18C `2bcad42` — gate de prewarm matou o clique (corrigido: 1.0.174-QA, 37/37).
2. Worker c20 (deploy #78) — `handleShareCard` não-resolvido passou de fail-open
   (200+OG, provado até 15/07 no C18E run 6) para fail-closed (404, ZERO OG) — no
   ÚNICO host que o crawler busca. Correção cirúrgica pronta e provada na borda QA:
   `worker/f3374f-share-og-failopen-candidate @ d134193` (V64.59-c20-failopen-74f).

**Canário FASE 7/8 (workflow `f3374i-canary-exact-route.yml`, main `7e27626`):** cria
rota EXATA `aprovar.agendaidseven.com.br/share/cronograma/<tok:1b96d7a8>` →
`idseven-push-qa`, prova isolamento comportamental em 5 checagens (token irmão segue
404 produção; raiz/portal/imagem intactos), tail autovalidado por self-probe (74H2),
captura classificada (`self_probe` × `external`) e REMOVE a rota em `always()` com
prova de reversão. Token canário público/sintético/sem capacidade:
`dedec9f4f5aafc33a9bcc56f49e6cf7092d4cba8bfc1d7f0`.

**Run de validação #1 (`29641775269`):** o POST da rota respondeu
`[{"code":10000,"message":"Authentication error"}]` — o token CF do CI **não tem
"Zone → Workers Routes → Edit"**. Fail-safe comprovado no mesmo run: nada criado,
canário seguiu 404 (produção), produção intacta, artifact ok.

### PENDÊNCIAS EXATAS PARA A EQUIPE (destravam a prova final)
1. **Adicionar ao token CF do CI:** `Zone → Workers Routes → Edit` (zona
   agendaidseven.com.br) — destrava o canário (FASE 7-9 do 74I).
2. (Da 74H, opcional mas recomendado) `Zone → Analytics → Read` — auditoria pós-fato
   com UA/ASN sem coordenação de janela.

### RUNBOOK DA ÚNICA PROVA FÍSICA (após a permissão 1)
1. Actions → "[manual] F3.3.74I Canário rota exata (host histórico)" → Run com
   `confirm=CANARIO-74I`, `window_minutes=30`.
2. Aguardar no log: isolamento provado → `TAIL_ATTACH_PROVADO` →
   `SELF_PROBE_CAPTURED=1` → `JANELA ATIVA`.
3. Colar SOZINHO no WhatsApp Business (grupo QA), aguardando até 30 s antes de enviar:
   `https://aprovar.agendaidseven.com.br/share/cronograma/dedec9f4f5aafc33a9bcc56f49e6cf7092d4cba8bfc1d7f0`
4. Registrar captura de tela. O log classifica requests `[external]` (UA/ASN/status/
   imagem); a rota é removida automaticamente ao fim (mesmo com erro/cancelamento).
5. Leitura: card aparece ⇒ causa fechada de ponta a ponta (fail-closed era o único
   bloqueio no host real) → preparar promoção mínima (fail-open produção + Desktop
   1.0.174) com canário/rollback — só com autorização expressa. Card não aparece mas
   request 200+OG+imagem capturado ⇒ classe C com evidência primária completa para a
   FASE 10 (comparação com baseline). Zero request até em `aprovar.` ⇒ refuta a tese
   de host e aponta o cliente WhatsApp — decidir com a captura em mãos.

Candidato único (FASE 14): **já existe** — Desktop 1.0.174-QA (74E) + Worker QA
fail-open d134193. Nenhum build novo será gerado sem causa adicional comprovada.

## ADENDO 74J — GO FÍSICO DO CRONOGRAMA (canário no host histórico) + PROMOÇÃO PREPARADA

**GO FÍSICO registrado pelo owner (~08:51 local):** o Card Premium completo (imagem,
título "Aprovar cronograma", descrição, domínio, link clicável) apareceu no WhatsApp
Business com a URL canário no host histórico.

**Request real capturado (run `29642737121`, tail autovalidado):**
`[external] 2026-07-18T11:51:27.878Z GET 200 ok ASN28126/BR UA=WhatsApp/2.23.20.0`
`[external] 2026-07-18T11:51:28.608Z GET 200 ok ASN28126/BR UA=WhatsApp/2.23.20.0`
(= 08:51 local; DOIS fetches da página em ~0,7 s; unfurl CLIENTE-side — ASN brasileiro,
não datacenter Meta). self-probe 11:34:34 classificada à parte; os 6 eventos
ASN8075/US 11:37:41-49 são o edge-audit `29642885792` (minha prova comportamental),
honestamente atribuídos. Imagem: buscada na PRODUÇÃO (rota canário cobria só o path
do share) — 200 byte-exata `c038636d…` provada ao vivo no mesmo minuto.

**Rollback comprovado:** `DELETE rota: success=true` → canário de volta a 404 →
produção `V64.59-c20-golden-contract` (aprovar. e workers.dev). Zero resíduo.

**CAUSA-RAIZ FINAL (fechada de ponta a ponta):** (A) Desktop C18C `2bcad42` matou o
clique (corrigido: 1.0.174-QA); (B) Worker C20 fail-closed matou o OG no host que o
WhatsApp consulta — a MESMA URL, com fail-open, gerou o card físico. Confirmado.

**Promoção preparada (SEM deploy):**
- Patch mínimo = candidata `f9b54ce` (V64.59-c20-failopen-74f; só handleShareCard+versão).
- Testes: `scripts/f3374j-failopen-contract.test.mjs` — RED 5/5 no c20 `928669eb2`
  (404/503 sem OG micro-executados) e GREEN 19/19 na candidata (resolved cron/rot
  tipados+cacheáveis; not_found/error 200+OG no-store bypass; HEAD/GET; token não
  exposto; zero Firestore write; zero contaminação; portal intacto por escopo de diff).
- Workflow gated: `f3374j-promote-failopen.yml` (main `af28207`) — confirmação literal
  `PROMOVER-FAILOPEN-74J`; snapshot versão/rotas/hash; RED/GREEN no runner; deploy;
  validação viva (GET/HEAD/not_found/error/imagens/versão); **rollback automático
  para o c20 `928669eb2`** se qualquer gate pós-deploy falhar; cmp rotas pré/pós.
  NÃO EXECUTAR sem autorização expressa do owner.

**Roteiro (prova tipada preparada):** o canário agora aceita input `token` — runbook:
(1) criar tarefa SINTÉTICA de Roteiro na 1.0.174-QA (wizard; opções 4/6/8/12; sem
Designer); (2) copiar o token do link gerado; (3) rodar o canário com
`confirm=CANARIO-74I`, `token=<token-da-tarefa>`, `window_minutes=30` (rota exata só
desse token → worker QA resolve e serve card TIPADO "Aprovar roteiro" + arte
`wa-card-roteiro-v64-60.jpg`); (4) colar o link `aprovar.…/share/cronograma/<token>`
na JANELA ATIVA; (5) card de Roteiro deve aparecer SEM nada de Cronograma; reversão
automática. Proibido aprovar Roteiro com card genérico.

## ADENDO 74J-PROMOÇÃO — FAIL-OPEN NO AR EM PRODUÇÃO (validado ao vivo; rollback armado)

**PROMOÇÃO EXECUTADA** (owner autorizou `PROMOVER-FAILOPEN-74J`). Workflow gated
`f3374j-promote-failopen.yml`, run **`29644274208`** (main `5cfdba7`), 9/9 steps verdes:
- Gate 1 literal OK; Gate 2 identidade da fonte (`f9b54ce` = c20 golden + fail-open,
  worker byte-idêntico a `d134193`); Gate 3 herméticos no runner RED **5/5** (c20
  `928669eb2`) + GREEN **19/19** (candidata).
- **DEPLOY produção `idseven-push`** — Cloudflare Version ID
  **`b82e5b03-b779-4b04-9a8e-29ddc522416c`**; mesmos bindings (12 vars inalteradas),
  mesmo cron, mesmas rotas; secrets só por nome.
- **Validação viva:** `aprovar.` = `V64.59-c20-failopen-74f`; not_found sintético
  `GET=200 og=13 task=not_found type=generic cc=no-store xc=bypass`; HEAD 200; 2º GET
  bypass; imagens `c038636d…`/`f64f6f3e…` byte-exatas; workers.dev = failopen.
- **Gate final:** rotas pós **IDÊNTICAS** ao snapshot; DNS/Custom Domain/bindings
  intocados. **Rollback armado** no próprio workflow (redeploy `928669eb2` →
  golden-contract) e disponível a qualquer momento.

**Nota do run 1 (`29643969870`, falso NO-GO):** o fail-open subiu e funcionou no
domínio custom, mas o check do workers.dev era single-shot e leu golden-contract antes
da propagação → rollback falso disparou (e re-deployou c20). Corrigido no run 2 com
poll de propagação; remoção do `git stash -u` que engolia `out/`. Sem impacto de dados.

### FASE 6 — prova física do card sintético EM PRODUÇÃO (owner; janela autovalidada)
1. Actions → "[manual] F3.3.74F Crawler Capture" → `service=idseven-push`,
   `window_minutes=30`, `note=fisico-74j-prod-cronograma`. Aguardar
   `TAIL_ATTACH_PROVADO` / `SELF_PROBE_CAPTURED=1` / `JANELA ATIVA` (a self-probe em
   produção agora aceita 200 = fail-open).
2. Colar SOZINHO no WhatsApp Business, aguardar até 30 s antes de enviar:
   `https://aprovar.agendaidseven.com.br/share/cronograma/f3374jprova000000000000000000000000000000000001`
   (token sintético, sem capacidade). Card Premium de Cronograma DEVE aparecer.
3. Registrar captura; o log mostra o request real `[external]` (UA/ASN/status/imagem).

### FASE 7 — E2E com a Desktop 1.0.174-QA EXISTENTE (owner; sem build nova)
- CRONOGRAMA: criar tarefa sintética → 1-clique copia+abre WhatsApp → colar → card
  tipado → enviar → portal → aprovar → retorno ao Desktop.
- ROTEIRO (prova TIPADA, sem card genérico): criar tarefa sintética de Roteiro
  (opções 4/6/8/12, sem Designer) → card "Aprovar roteiro" + arte
  `wa-card-roteiro-v64-60.jpg` + descrição própria, ZERO texto de Cronograma → portal
  → aprovar → retorno. (Alternativa de canário tipado disponível no
  `f3374i-canary-exact-route.yml` via input `token`, se preferir isolar por rota.)

### STOP GATE
Após GO físico de Cronograma E Roteiro: **PARAR**. NÃO publicar Desktop 1.0.174 — fica
para a fase separada **F3.3.74K-DESKTOP-1.0.174-CONTROLLED-PRODUCTION-PROMOTION**
(auditar build existente, hashes, regressão, release controlada, rollback 1.0.168).
Desktop de produção permanece **1.0.168**.

---

## F3.3.74J2 — Validação FÍSICA em produção + E2E Desktop (2026-07-18)

Produção Worker: **V64.59-c20-failopen-74f** (Version ID `b82e5b03-b779-4b04-9a8e-29ddc522416c`,
promovido no run `29644274208`). Desktop produção segue **1.0.168**.

### FASE 1 — gate vivo (PASSOU, 12:41 UTC)
- Edge-audit `29644781093`: `/share/cronograma/<dummy>` → **GET 200 + HEAD 200** nos 3 UAs
  (browser/facebookexternalhit/WhatsApp) em `aprovar.` **e** `workers.dev` (sob c20 era 404 —
  assinatura comportamental do fail-open vivo nos DOIS caminhos).
- Imagem `wa-card-v64-39.jpg`: 144941 bytes, sha256 `c038636d…` byte-exata nos 2 hosts.
- `cf_mitigated` vazio + zero marcador de challenge; TLS (GTS WE1, SAN aprovar.) e DNS ok.
- Rotas idênticas ao snapshot (gate final do promote `29644274208`); nenhuma rota canário.
- **Rollback em 1 clique ARMADO**: workflow `f3374j2-rollback-c20.yml` no main (commit `80c18bf`);
  confirmação literal `ROLLBACK-C20-74J2` → redeploya `928669eb2` (golden) e valida ao vivo.

### FASE 2 — janela autovalidada em produção
Run do `f3374f-crawler-capture.yml`: `service=idseven-push`, `window_minutes=30`,
`note=fisico-74j2-producao-sintetico`. Gates exigidos ANTES do link: `service validado`,
self-probe status, evento no tail, `TAIL_ATTACH_PROVADO`, `SELF_PROBE_CAPTURED=1`, `JANELA ATIVA`.

### FASE 3 — prova física do card sintético EM PRODUÇÃO (owner)
Colar SOZINHO no WhatsApp Business, aguardar até 30 s, CAPTURAR a pré-visualização, enviar UMA vez:
`https://aprovar.agendaidseven.com.br/share/cronograma/74f74f74f74f74f74f74f74f74f74f74f74f74f74f74f74f`
(token sintético 74J2; supersede o token `f3374jprova…` do runbook 74J acima).
- Card Premium de Cronograma DEVE aparecer (imagem + título + descrição + domínio + link).
- **Se NÃO aparecer** → Actions → "[manual] F3.3.74J2 Rollback c20" → digitar `ROLLBACK-C20-74J2`
  → produção volta ao golden-contract → **HARD NO-GO**, NÃO seguir ao Desktop.
- Se aparecer → registrar **GO FÍSICO DO WORKER EM PRODUÇÃO** (log da janela mostra o request
  `[external]` real: horário/UA/ASN-país/método/status/outcome).
- Janela expirou antes de colar? Reabrir com os MESMOS inputs da FASE 2 e colar de novo.

### FASE 4 — reinstalar Desktop 1.0.174-QA EXISTENTE (owner; NENHUMA build nova)
Artefato oficial do run `29542929297`: `Agenda-ID-Seven-Desktop-1.0.174-QA-x64.exe`,
SHA-256 `fe6051e76f790e7fc6cf9ac8df9ee163b133c659a5d90d642833c10b4f4c9fa9`
(conferir com `certutil -hashfile <exe> SHA256`). Banner QA visível; nenhum cliente real.

### FASE 5 — E2E Cronograma na 1.0.174-QA (15 checagens)
1 hash do EXE confere; 2 instala como 1.0.174-QA; 3 banner QA visível; 4 ambiente/tarefa
sintética (cliente QA, nunca real); 5 criar tarefa de Cronograma; 6 botão 1-clique COPIA o link
e ABRE o WhatsApp (regressão C18C corrigida — clique não morre); 7 link tem a forma
`aprovar.agendaidseven.com.br/share/cronograma/<token>`; 8 colar e aguardar ≤30 s; 9 card TIPADO
de Cronograma (arte `wa-card-v64-39.jpg`); 10 título/descrição de Cronograma + domínio corretos;
11 enviar → card renderiza no destinatário; 12 tocar o link → portal abre a tarefa correta;
13 aprovar no portal → status atualiza; 14 retorno/notificação no Desktop; 15 zero contaminação
Roteiro×Cronograma no card.

### FASE 6 — E2E Roteiro TIPADO na 1.0.174-QA (12 checagens)
1 criar tarefa sintética de Roteiro; 2 opções de quantidade **4/6/8/12** presentes; 3 fluxo SEM
Designer; 4 1-clique copia+abre WhatsApp; 5 colar e aguardar ≤30 s; 6 card **"Aprovar roteiro"**
tipado (**NUNCA** o card genérico); 7 arte `wa-card-roteiro-v64-60.jpg`; 8 descrição própria de
Roteiro, ZERO texto de Cronograma; 9 enviar UMA vez → renderiza; 10 portal abre a tarefa de
Roteiro; 11 aprovar → status atualiza → retorno ao Desktop; 12 captura/headers comprovam página
tipada (`X-Share-Type: roteiro` no GET do share).

### FASE 7 — regressão física mínima (owner, pós-GO)
raiz `/` JSON 200 nos 2 hosts; imagens OG ambas byte-exatas; robots.txt da zona intacto; portal
de aprovação de link RESOLVIDO segue funcionando (cache público C20 preservado); push FCM/cron
do worker seguem; espelho QA `aprovar-qa` intacto; Desktop produção 1.0.168 segue operando.

### STOP GATE 74J2
Mesmo com GO total (Worker + Cronograma + Roteiro): **NÃO publicar** Desktop 1.0.174 — sem
release, sem tag, sem troca do instalador de produção. Preparar apenas a autorização de
**F3.3.74K-DESKTOP-1.0.174-CONTROLLED-PRODUCTION-PROMOTION**.

### ✅ GO FÍSICO DO WORKER FAIL-OPEN EM PRODUÇÃO — REGISTRADO (2026-07-18, 12:52 UTC)
- **Prova física (owner)**: Card Premium de Cronograma apareceu no WhatsApp Business às
  ~09:52 locais (12:52 UTC) a partir do link sintético `…/share/cronograma/74f74f…74f` em
  `aprovar.agendaidseven.com.br` — imagem Premium, título "Aprovar cronograma", descrição,
  domínio e link clicável corretos. **Rollback NÃO executado (não necessário).**
- **Prova instrumental (run #15 = `29644819510`)**: observador PROVADO por self-probe capturada
  no MESMO stream (12:44:43 probe HTTP **200**; 12:44:46 `evento da sonda encontrado no Tail …
  método=GET status=200 outcome=ok`; `TAIL_ATTACH_PROVADO`; `SELF_PROBE_CAPTURED=1`;
  `JANELA ATIVA por 30 minutos — serviço: idseven-push — etiqueta: fisico-74j2-producao-sintetico`).
  Na janela: **3 eventos EXTERNOS** (self_probe excluída), todos `UA=WhatsApp/2.23.20.0
  ASN28126/BR GET 200 ok` em `aprovar.`:
  1. `12:51:59.797Z` GET `/share/cronograma/<tok>` (página, 1ª busca)
  2. `12:52:00.582Z` GET `/share/cronograma/<tok>` (página, retry +785 ms)
  3. `12:52:00.794Z` GET `/og/wa-card-v64-39.jpg` (imagem; `isBot=true` no WA-DIAG)
  = unfurl **client-side** (mesmo padrão do GO do canário 74I); nenhum fetch de datacenter Meta;
  correlação exata com o horário físico. Artefato: `f3374f-crawler-capture-15` (id 8429988763).
- **Estado de produção reconfirmado ao vivo 12:56–58 UTC** (run `29645237524`, read-only, tudo
  fail-closed): versão `V64.59-c20-failopen-74f` nos 2 caminhos; deployment ativo
  `b82e5b03-b779-4b04-9a8e-29ddc522416c` @100% (criado 12:25:42Z); script vivo com identidade
  failopen e SEM a golden; rotas da zona: **nenhuma** (canário segue removido); Custom Domains
  `aprovar.→idseven-push` e `aprovar-qa.→idseven-push-qa`; DNS ok; **12 vars + 8 secrets POR
  NOME** idênticos ao inventário 74J; fonte de rollback sha256 `aa07171e…` canônica; botão
  `ROLLBACK-C20-74J2` presente no main.
- Nota técnica: o robots.txt servido em `aprovar.` = bloco gerenciado da zona + corpo do origin
  (o JSON da raiz do worker) anexado — por isso 1911 B (golden) → **1908 B** (failopen, versão
  3 bytes mais curta). Política de crawlers inalterada (`*` Allow: /; Meta/WhatsApp livres).
- **Próximo**: FASES 4–7 (Desktop 1.0.174-QA E2E Cronograma/Roteiro + regressão) → somente
  depois, com tudo verde, a 74K (promoção controlada da Desktop). Worker fail-open PERMANECE.

---

## F3.3.74J3 — Portal de Roteiro: SOMENTE Tema + Legenda (QA; 2026-07-18)

**Bug físico (owner)**: no portal de aprovação de ROTEIRO, expandir um conteúdo mostrava
"PEÇAS" + blocos FEED/STORY + placeholders "Feed pendente"/"Story pendente". Regra de
negócio: Roteiro de gravação de vídeos tem SÓ Tema e Legenda.

**Causa-raiz (exata, com repro RED)**: `cloudflare-worker.js` → `renderClientHtml`
(template por-conteúdo, L3443 pré-patch) gerava SEM condição de tipo:
`'<div class="field">…' + ICN.img + 'Peças…' + media("feed", feedUrl) + media("story", storyUrl)`.
`media()` sem URL emite `<span class="pl">Feed pendente</span>` (labels CONCATENADOS —
por isso a busca literal falhava) e "Peças" vira "PEÇAS" por `text-transform:uppercase`
(CSS `.flabel .fl`). Classificação: **G = A+B** (componente compartilhado + ausência de
`type==='roteiro'`), mais latente **E/D**: `clientPhase` derivava fase `production` se
todos os itens tivessem `feedImageUrl` (legado) — mesmo em roteiro.

**Patch cirúrgico (branch `worker/f3374j3-roteiro-portal-tema-legenda-only`, commit
`2919f5c`; diff +10/−1 em 2 pontos)**:
1. bloco de Peças embrulhado em `(pt.key === "roteiro" ? "" : '…string EXATA…')` —
   para roteiro o DOM **não é gerado** (nada de display:none);
2. `clientPhase`: `if (premiumTypeOf(task).key === "roteiro") return "themes";` antes da
   derivação por peças (explícito/final continuam respeitados; cronograma inalterado).
Campos legados: lidos, **ignorados** na renderização/validação, **nunca enviados** no
payload (`/action` = {action, contentIndex, value, note}; `clientItems` = {cs, theme,
legenda, note, at}), **jamais apagados**.

**Provas**:
- Suíte nova `scripts/f3374j3-roteiro-portal.test.mjs`: RED 5/5 (repro pré-patch,
  incl. fase legada 'production') + GREEN **34/34** (Tema/Legenda presentes; PEÇAS/FEED/
  STORY/placeholders/upload/anexos AUSENTES em 4/6/8/12; aprovação/ajuste/progresso/final
  ok; legado ignorado e intacto; **cronograma HTML BYTE-IDÊNTICO** pré×pós em fixtures
  com e sem mídia; handlers/payload/OG/share/media byte-idênticos).
- Contrato 74J na candidata: RED c20 5/5 + GREEN failopen **19/19**.
- Suítes existentes: conjunto de falhas **IDÊNTICO** ao pré-patch (só pins c20 da 74J;
  41/43, 21/24, 32/2) — zero regressão nova.
- **Deploy QA** run `29651523278` (workflow `f3374j3-deploy-qa.yml`, confirm
  `ESPELHAR-QA-74J3`): testes re-executados no runner; QA vivo nos 2 endereços com
  `V64.59-c20-failopen-74f`; contrato share GET=200 og=13 not_found/generic/no-store/
  bypass/HEAD; artes byte-exatas; **IDENTIDADE PROVADA** upload==deployment ativo QA
  (`bc9d600f-1978-4444-b661-0c7ad5f3a807` @100%) + marcadores J3 no script vivo QA;
  **PRODUÇÃO INTOCADA** (`b82e5b03…` @100%; script vivo SEM J3). Evidências: artifact
  `f3374j3-qa-deploy-evidence` (8431607088).

### Checklist FÍSICO do owner no portal QA (FASE 11)
No link do Roteiro sintético do E2E, trocar o host `aprovar.` por `aprovar-qa.` e abrir
no navegador do celular (mesmo token; NÃO criar cliente real):
1 cabeçalho "Roteiro de gravação de vídeos"/"Aprovação de roteiros"; 2 pílula "4 roteiros";
3 conteúdos corretos; 4 ao expandir: Tema ✓, Legenda ✓, PEÇAS ✗, Feed ✗, Story ✗, nenhum
espaço vazio; 5 aprovar conteúdo; 6 pedir ajuste; 7 progresso 0/N…N/N; 8 aprovação final;
9 retorno ao Desktop. (6/8/12: cobertos por teste automatizado.) 📸 de cada etapa.

### STOP GATE 74J3
**NENHUM deploy de produção.** Produção segue `V64.59-c20-failopen-74f`/`b82e5b03` com o
portal atual. Só após aprovação física do owner no QA: autorizar
**F3.3.74J4-ROTEIRO-PORTAL-TEMA-LEGENDA-ONLY-PRODUCTION-PROMOTION**.

---

## F3.3.74J3C — Causa-raiz FÍSICA do PEÇAS no portal QA (2026-07-18)

**HARD NO-GO físico**: portal QA de Roteiro (owner, aprovar-qa) exibiu PEÇAS/Feed/Story.

### O que a fonte PROVA (token-free)
- Resolução de tipo **simétrica**: Card (`handleShareCard`/crawler) e portal
  (`handleClientCronogramaView`→`renderClientHtml`) usam o **mesmo** `premiumTypeOf(task)`
  = `task.sector.trim().toLowerCase()==='roteiro'`. Não há "duas regras" (refuta hip. F).
- `media()` (PEÇAS/Feed/Story) é gerado **só** no template por-conteúdo (L3452), agora
  roteiro-gated; **não há** builder client-side nem 2º bloco (refuta G/H).
- Portal = `htmlResponse` **no-store** → nunca cacheado no edge (refuta C p/ o portal).
- Desktop grava setor pela KEY (`roteiro`); `decodeFields` mapeia `sector` stringValue.

### PONTO CEGO corrigido
QA (`idseven-push-qa`) e produção (`idseven-push`) reportavam a **MESMA** string de versão
`V64.59-c20-failopen-74f`. Nenhum check por host distinguia os runtimes; o "marcador J3" da
74J3 foi lido pela **API do serviço**, nunca pelo host `aprovar-qa`, e o gate 74J3 **jamais
renderizou um portal roteiro no host**. Além disso, `aprovar-qa` serviu o **74F mirror
(fail-open SEM J3)** até o deploy 74J3 (16:13 UTC).

### Instrumento J3C (branch worker/f3374j3c-roteiro-portal-physical-fix, commit 6d5360b)
Headers/JSON de identidade (sem token/cliente, sem mudar corpo/cache/status):
`const WORKER_BUILD="j3c-portal-fix"` em `GET /` (campo build) e header **X-ID7-Worker-Build**
(share/crawler/portal); **X-ID7-Portal-Type** = tipo canônico resolvido 1x no handler (prova
viva do tipo que o portal vê p/ a tarefa REAL); **X-ID7-Portal-Renderer** = full/ack/success/
notfound. Testes: RED 5/5, portal GREEN 35/35 (T27 cronograma byte-idêntico; T28 núcleo
byte-idêntico; T28b handlers só ganham identidade), contrato 74J RED c20 5/5 + failopen 19/19.

### PROBE DE IDENTIDADE (run 29654776264, SUCCESS) — VEREDITO=ROTA-OK
| host | GET /.build | X-ID7-Worker-Build |
|---|---|---|
| aprovar-qa (custom) | **j3c-portal-fix** | **j3c-portal-fix** |
| idseven-push-qa (workers.dev) | j3c-portal-fix | j3c-portal-fix |
| aprovar. (produção) | ausente | ausente |
| idseven-push (workers.dev prod) | ausente | - |
Deployment produção `b82e5b03…` @100% — **PRODUÇÃO INTOCADA**.

**Conclusão**: `aprovar-qa` **executa o worker corrigido**; a divergência física **não é
roteamento**. Causa mais provável = **timing/observabilidade**: o teste do owner caiu num
worker de QA **SEM** J3 (74F mirror pré-16:13, ou propagação do custom domain). Para a tarefa
roteiro, worker sem J3 → `premiumTypeOf=roteiro` (Card OK) **mas** media-block ungated → PEÇAS.
Nenhuma contradição com o Card; **o código J3/J3C do portal está correto**.

### PROVA FÍSICA DECISIVA (owner; mesmo token privado; sem divulgá-lo)
Reabrir a MESMA tarefa de Roteiro em `https://aprovar-qa.agendaidseven.com.br/cliente/cronograma/<mesmo_token>`
AGORA (aprovar-qa serve J3C). Esperado: **SEM** PEÇAS/Feed/Story; só Tema+Legenda+controles.
Confirmar o header **X-ID7-Portal-Type** (deve ser `roteiro`) por qualquer um:
- Chrome Android: `chrome://net-export` OU compartilhar → "Ver código-fonte" não mostra header;
  mais simples: abrir DevTools remoto — porém, no celular, o caminho prático é o **visual**:
  se não aparecer PEÇAS, é GO. (O X-ID7-Portal-Type fica no artifact/print se aberto via
  desktop com F12 → Network → resposta do documento.)
Se PEÇAS **persistir** com X-ID7-Portal-Type=`cronograma` → é dado/tipo real (a tarefa não
tem sector='roteiro'); aí o fix canônico é robustecer `premiumTypeOf` (reconhecer roteiro por
cronSub q4/q6/q8/q12 além de sector) — NÃO aplicado ainda (sem prova do valor real).

### STOP GATE 74J3C
Produção intocada; nenhuma promoção. 74J4 permanece PROIBIDA até GO físico do owner no portal
QA (J3C). Se GO: promover J3C (não J3) — inclui as duas correções (media-gate + identidade).

---

## F3.3.74J4 — Portal de Roteiro (Tema+Legenda) PROMOVIDO À PRODUÇÃO (2026-07-18, 18:21 UTC)

**Evidência que fechou a causa:** a captura física do owner (74J3C) era em
`aprovar.agendaidseven.com.br` = **PRODUÇÃO** (barra de endereço). A correção J3/J3C estava
só no Worker QA (`idseven-push-qa`); produção seguia servindo o portal antigo → Roteiro com
PEÇAS. Causa operacional: **correção QA não promovida**; causa de código: bloco de peças
compartilhado sem exclusão do tipo roteiro (já corrigido no J3).

**Candidata J4** (branch `worker/f3374j4-roteiro-portal-production`, commit `85787d0`): base =
produção `f9b54ce` + media-gate do Roteiro + `clientPhase` sem mídia + identidade estática.
Nova identidade de versão **V64.59-c20-failopen-j4-roteiro-portal** (build `j4-roteiro-portal`)
— distingue o worker promovido do anterior (fecha o ponto cego de versão em produção).

**Promoção gated** (workflow `f3374j4-promote-roteiro-portal.yml`, confirm
`PROMOVER-PORTAL-ROTEIRO-74J4`, run **29655678585**, SUCCESS 57s):
- Gate 2 snapshot pré (versão viva failopen-74f; rotas; domains; bindings; imagens; fonte de rollback f9b54ce).
- Gate 3 **RED contra produção 5/5** (Roteiro exibe PEÇAS/Feed/Story) + **GREEN candidata 35/35**
  (Roteiro só Tema/Legenda; Cronograma byte-idêntico) + contrato 74J **RED c20 5/5 + failopen 19/19**.
- Deploy `idseven-push` (wrangler@4).
- **Validação viva na PRODUÇÃO**: `aprovar.` versão=`…-j4-roteiro-portal` build=`j4-roteiro-portal`;
  **X-ID7-Worker-Build no HOST = j4-roteiro-portal** (prova que aprovar. roda J4 — o check que
  faltava antes); not_found GET=200 og=13 not_found/generic/no-store + HEAD 200; imagens
  byte-exatas (c038636d…, f64f6f3e…); workers.dev = mesma versão.
- Gate final: **rotas / Custom Domains / bindings IDÊNTICOS** ao snapshot (aprovar.→idseven-push,
  aprovar-qa→idseven-push-qa; 12 vars + 8 secrets por nome).
- **Rollback automático armado** no próprio workflow: qualquer falha → redeploy `f9b54ce`
  (V64.59-c20-failopen-74f). Não disparou (tudo verde). Artifact `f3374j4-promotion-evidence` (90d).

**Escopo/preservação:** diff vs produção só em `renderClientHtml` (peças não geradas p/ roteiro;
cronograma byte-idêntico), `clientPhase` (roteiro sem dep. de mídia), headers de identidade
estáticos, versão. **Intocados**: Card Premium/OG/fail-open/resolved/not_found/error/imagens/
Cronograma/DNS/rotas/Custom Domains/bindings/secrets/Desktop. Dados legados de Feed/Story:
ignorados na renderização, **jamais apagados**.

**Estado de produção pós-J4:** Worker `idseven-push` = **V64.59-c20-failopen-j4-roteiro-portal**
(build j4-roteiro-portal); Desktop produção **1.0.168** (intocado).

### PROVA FÍSICA DO OWNER (FASE 8) — mesma página já aberta
NÃO gerar link novo, NÃO reinstalar Desktop. Na MESMA página de Roteiro em produção
(`aprovar.agendaidseven.com.br/cliente/cronograma/<mesmo_token>`): **Ctrl+F5** (ou fechar a aba
e reabrir o mesmo link) → expandir Conteúdo 1. Esperado: Tema + Legenda + controles; **SEM**
PEÇAS/Feed/Story/placeholder/área de imagem. Se PEÇAS persistir → disparar rollback
(o workflow reverte automaticamente em falha de gate; manual: redeploy f9b54ce) + HARD NO-GO.

### STOP GATE
Sem alteração de Desktop. Promoção controlada do Desktop 1.0.174 permanece fase à parte
(F3.3.74K), somente com autorização literal futura.

**Confirmação independente pós-deploy (auditoria read-only run 29655819351):** versão viva
`V64.59-c20-failopen-j4-roteiro-portal` nos 2 caminhos; **Version ID ativo
`cace97b6-1eb0-44c8-9493-853d0fd675e5` @100%** (deployment 574779cb, 18:21:28Z; anterior
b82e5b03); **`media-gate do Roteiro PRESENTE no script vivo`**; rotas nenhuma; Custom Domains
corretos; 12 vars + 8 secrets por nome; rollback c20 íntegro (sha aa07171e…) + botão
ROLLBACK-C20-74J2 no main. Deploy run 29655678585, commit 85787d0.

---

## F3.3.74K — Desktop 1.0.174 Produção Controlada (candidata) (2026-07-18)

Promove a Desktop de PRODUÇÃO 1.0.174 a partir da fonte funcional fisicamente aprovada
**1.0.174-QA** (`670cef2`), removendo SÓ empacotamento (versão + banner QA). Worker de
produção CONGELADO em `V64.59-c20-failopen-j4-roteiro-portal` (cace97b6); nada de backend.

### FASE 1 — capability gate: GO
- Sem tag/release `desktop/v1.0.174-production` (404 + list_tags só até 1.0.168).
- 1.0.168 produção intacta (release 355084579 immutable; EXE `299162a0…`; MSI `a761317…`;
  commit `4fb0a7f`) — rollback oficial preservado.
- QA `670cef2` "F3.3.74E restore" · package.json 1.0.174-QA.
- Worker live j4 confirmado.

### FASE 2-6 — candidata limpa (branch `desktop/f3374k-1.0.174-production`, commit `b6b800c`)
Diff = **só empacotamento** (7 arquivos; nenhum `.ts` tocado → tsc idêntico ao QA):
- `package.json`/`package-lock.json`: 1.0.174-QA → **1.0.174**;
- `index.html`: removida a ÚNICA linha do banner "AMBIENTE QA — NÃO USAR COM CLIENTES";
- testes de versão/banner: R16 (banner AUSENTE), R17/A1/H3 (versão 1.0.174);
- gate novo `f3374k-production-invariance.test.mjs` **30/30**: renderer da candidata ==
  QA menos a linha do banner; `buildClientMessage`/`buildShareClientUrl`/`ensureReviewToken`/
  `copyMsgClean`/`openWhatsAppWebOnly`/`persistClientSend`/`runPrewarm`/`main.ts`/`preload.ts`/
  `electron-builder.yml` BYTE-IDÊNTICOS ao QA; regressões C18C/native-share/Windows Share/
  Canvas ausentes.
Suítes herméticas: **36/38 verde**; as 2 restantes (`auth-core`, `main-notifier`) exigem
node_modules/tsc e falham IDÊNTICAS no QA baseline (ambiente, não regressão).

### FASE 7 — build oficial (desktop-build.yml, run 29656441708, branch 74K @ b6b800c)
Windows; version derivada do package.json → artefatos `Agenda-ID-Seven-Desktop-1.0.174-x64.exe/.msi`
(sem "QA" no nome). O bloco de gate QA do build (condicional a "AMBIENTE QA") é PULADO por
construção (sem banner) — os gates funcionais são reproduzidos na FASE 8/9 (app.asar).

### FASE 8-9 — gate do app.asar (workflow `f3374k-desktop-asar-verify.yml`)
Extrai o app.asar do EXE de produção e do EXE 1.0.174-QA (run 29542929297) e prova no runtime
empacotado: produção 1.0.174 sem banner, contrato restaurado intacto, regressões ausentes; e
comparação QA×prod: renderer idêntico a menos do banner, package.json só versão, main/preload
compilados byte-idênticos, inventário do app idêntico (única divergência = index.html + package.json).

### STOP GATE PRÉ-RELEASE
Após build + gates + entrega ao owner: **PARAR**. Release só com QA físico do owner (35 checagens)
e o literal **PUBLICAR-DESKTOP-1.0.174-74K**. Rollback oficial = 1.0.168 (release preservada).

### FASE 7-9 — build de produção + gates app.asar: VERDE
- Build oficial **run 29656441708** (desktop-build, branch 74K @ b6b800c) SUCCESS (~4 min).
  Artefatos: `Agenda-ID-Seven-Desktop-1.0.174-x64.exe` (79 MB) SHA-256
  `4940f8a6374ee26a90cfb6d2e67b1bdf01b0663b01474b48aacd43d148aff276`;
  `…-1.0.174-x64.msi` (88 MB) SHA-256
  `160a1d315206d86e1e1fc36701d3f2513ef8e077d45732f9c75eb45a5b81a947`.
  Installer artifact id **8433040597** (digest sha256 b6b2a61f…); bundle id **8433042465**.
- **app.asar verify run 29656718630** (FASES 8+9) SUCCESS: versão empacotada 1.0.174, SEM
  banner, contrato restaurado intacto, regressões ausentes; renderer produção == QA menos
  a linha do banner (todos handlers byte-idênticos); package.json só versão; main.js/preload.js
  byte-idênticos; inventário do app idêntico. app.asar prod `f51ae131…` / QA `842a629c…`.

### FASE 12-13 — release gated ARMADO (não publicado)
Workflow `f3374k-desktop-release-production.yml` no main (literal **PUBLICAR-DESKTOP-1.0.174-74K**):
pinado a run 29656441708 / commit b6b800c / EXE 4940f8a6… / MSI 160a1d31…; cria tag
`desktop/v1.0.174-production` (draft=false, prerelease=false, latest=false), assets EXE+MSI+
SHA256SUMS+VERSAO+RELATORIO; gate do Worker j4 read-only; smoke pós-publicação; **não toca a
1.0.168**. NÃO roda sem o literal.

### FASE 10-11 — entrega ao owner (candidata) + QA físico 35 checagens
Instalador: run 29656441708 → artifact `agenda-id-seven-desktop-1.0.174-installer`.
`certutil -hashfile "Agenda-ID-Seven-Desktop-1.0.174-x64.exe" SHA256` = 4940F8A6…276.
QA físico obrigatório antes da release (35 checagens do mandato; dados sintéticos).

### ESTADO após 74K (candidata)
Desktop produção OFICIAL segue **1.0.168** (rollback preservado) até o literal de publicação.
Worker produção `V64.59-c20-failopen-j4-roteiro-portal` (cace97b6) congelado. Candidata 1.0.174
buildada e verificada; aguardando QA físico + PUBLICAR-DESKTOP-1.0.174-74K.

---

## F3.3.74J5 — Cronograma: aprovação do cliente em DUAS etapas (ETAPA 1 = só Tema)

**Incidente físico (owner):** portal do Cronograma na ETAPA 1 (APROVAÇÃO DE TEMAS, cabeçalho
"Você está aprovando apenas os temas…") exibia indevidamente no Conteúdo 1: LEGENDA, "Legenda
pendente", PEÇAS, FEED, STORY, "Feed pendente", "Story pendente", placeholders e áreas grandes de
imagem. HARD NO-GO. Regra correta: ETAPA 1 mostra SÓ o Tema (+ nº, estado, observação, controles
aprovar/ajuste/editar-tema). Legenda/Feed/Story só na ETAPA 2 (após produção + reenvio no MESMO
link → cronStatus='ready_for_final_client_review').

### Causa-raiz (auditoria forense read-only)
- Portal renderiza no **worker** (`renderClientHtml`, cloudflare-worker.js) — não no Desktop.
- Linha do tempo (git): Desktop 1.0.85 (52e65d0, 2026-06-04) desenhou o fluxo em 2 etapas
  (`cvw`: legenda só `if(c.legenda)`, arte só `if(feed||story)` — **corte por PRESENÇA**). O portal
  HTML do worker nasceu no dia seguinte (V64.6 fe2cd1e) e já em V64.7 (bfc9790) gerava Legenda +
  Peças **incondicionalmente** para o cronograma. `clientPhase` (V64.13 3df257c) separou fases mas
  só mexeu em cabeçalho/CTA — **o corpo nunca foi gated por fase**. Desde 74J3 o único gate era por
  TIPO (`pt.key==='roteiro'`), nunca por FASE.
- **Objetivo:** o corpo por conteúdo emitia o campo Legenda e o bloco Peças (Feed/Story) para o
  cronograma em TODA fase → na fase 'themes' aparecia "Legenda/Feed/Story pendente".

### Correção (worker-only, cirúrgica; branch worker/f3374j5-cronograma-themes-only, e8f7b3a)
`renderClientHtml`: `const themesOnly = pt.key !== "roteiro" && phase === "themes";` e gate de
(1) campo Legenda, (2) bloco Peças, (3) botão "Editar legenda" por `themesOnly` — **não gerados no
DOM** na ETAPA 1 (nada de esconder por CSS). ETAPA 2 (production/final) e Roteiro (74J3): idênticos.
Corte por **FASE**, não por presença — registros com legenda/feed LEGADO em 'themes' mostram só o
Tema e **jamais** são apagados. Identidade: version `V64.59-c20-failopen-j5-cronograma-themes`,
build `j5-cronograma-themes`.

### Provas
- Testes `scripts/f3374j5-cronograma-themes.test.mjs`: **RED 7/7** reproduz o print sobre a fonte
  de PRODUÇÃO viva (85787d0/j4); **GREEN 43/43** na candidata (inclui byte-idêntico de ETAPA 2 +
  roteiro + TODOS os handlers vs j4). Regressão: 74J3 **35/35** (roteiro preservado; cronograma-
  production byte-idêntico), contrato 74J 17/17 real (T17/T18 são gated de runner, idênticos em j4).
- **Físico (Playwright, DOM real após expandir os cards):** etapa1-themes = 0 Legenda / 0 Peças /
  0 media-row / 0 editLegenda + 3 Tema + 3 Aprovar; etapa2-production = 3/3/3/3; roteiro = 4 Legenda
  / 0 Peças / 4 editLegenda / 4 Tema. Screenshots em scratchpad/j5-proof/.

### Deploy QA (isolado; produção INTOCADA)
Workflow `f3374j5-deploy-qa.yml` (gate literal **ESPELHAR-QA-74J5**): roda RED/GREEN/regressão no
runner, deploy só em `idseven-push-qa`, prova QA=build j5 e produção segue j4 (cace97b6 @100%).

### ESCOPO / BLOQUEIO
Mudança **só no worker** → Desktop 1.0.174 (candidata b6b800c) permanece **byte-idêntica** e
**HARD-BLOCKED**: NÃO publicar `desktop/v1.0.174-production` nem aceitar PUBLICAR-DESKTOP-1.0.174-74K
até o GO físico do 74J5. Produção do worker congelada em j4 até F3.3.74J6 (promoção gated).

---

## F3.3.74J6 — Cronograma 2-etapas PROMOVIDO à PRODUÇÃO (GO)

Literal **PROMOVER-CRONOGRAMA-2-ETAPAS-74J6**. Candidata **worker/f3374j6-cronograma-two-stage-production**
`db325d9` = fix 74J5 byte-idêntico (predicado `themesOnly` + gate Legenda/Peças/Editar-legenda por FASE)
+ identidade nova. Diff J4→J6 = SÓ os hunks autorizados (themesOnly + 3 gates + versão/build + testes).

**Deploy gated** (workflow `f3374j6-promote-cronograma-two-stage.yml`, run **29659163418 SUCCESS**, 9/9 steps):
snapshot → RED(j4: ETAPA 1 mostra Legenda/Peças) 7/7 → GREEN 43/43 + roteiro 35/35 + contrato 74J →
deploy só em `idseven-push` → validação viva → gate infra → **sem rollback**.

**Produção AGORA:**
- service **idseven-push**
- versão **V64.59-c20-failopen-j6-cronograma-two-stage**
- build **j6-cronograma-two-stage**
- **Version ID `9fbdf417-0348-4c46-b815-0393d6f837e7`** (anterior j4 `cace97b6-…` substituído)
- rollback armado: j4 `85787d0` → V64.59-c20-failopen-j4-roteiro-portal.

**Gates vivos no host aprovar.agendaidseven.com.br:** version+build=j6; **X-ID7-Worker-Build=j6-cronograma-two-stage**;
not_found GET=200 og=13 task=not_found type=generic cc=no-store; HEAD 200; artes byte-exatas
(cron c038636d…eea, roteiro f64f6f3e…cf3); workers.dev=j6. **rotas/Custom Domains/bindings IDÊNTICOS**
ao snapshot (aprovar-qa→idseven-push-qa, aprovar.→idseven-push; 12 vars + 8 secrets só por NOME; cron `* * * * *`
preservado). Evidência: artifact **8433792636** (16 arquivos). Nenhum secret impresso.

**Comportamento provado (identidade viva ∧ RED/GREEN herméticos):** ETAPA 1 (themes) = só Tema; ETAPA 2
(production/final) = Tema+Legenda+Feed+Story; Roteiro = Tema+Legenda. Render de portal resolvido ao vivo
é validado fisicamente pelo owner (PASSO A/B/C/D) — não se cunha token de cliente.

**Desktop 1.0.174 (b6b800c) permanece HARD-BLOCKED** — 74J6 é worker-only. Publicação só após GO físico
integral das duas etapas + reauditoria da candidata Desktop + reliberação de PUBLICAR-DESKTOP-1.0.174-74K.
QA `idseven-push-qa` segue j5 (`c4660441`).
