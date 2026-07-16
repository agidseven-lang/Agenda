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
