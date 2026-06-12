# PLANO DE AUTOMAÇÃO — Worker `idseven-push` (fim do processo manual no painel)

**Status: plano + scripts entregues. NADA executado. Primeiro deploy automatizado
só com sua autorização explícita.**

## 1. Pré-requisitos mínimos (uma vez, na SUA máquina)
1. Node.js 18+ (`node -v`).
2. Repositório clonado, branch `desktop/local-detail-hierarchy-v2`.
3. API Token do Cloudflare (seção 2) exportado na sessão do terminal:
   - Windows (PowerShell): `$env:CLOUDFLARE_API_TOKEN="<token>"`
   - Linux/Mac: `export CLOUDFLARE_API_TOKEN=<token>`
4. (Opcional, se o token mínimo limitar o `whoami`):
   `$env:CLOUDFLARE_ACCOUNT_ID="<account id>"` — visível na lateral do dashboard;
   o account id NÃO é secreto.
O wrangler é baixado automaticamente pelo `npx` na primeira execução — nada para
instalar manualmente.

## 2. API Token — criação com MENOR privilégio possível
No dashboard: My Profile → API Tokens → **Create Token** → *Create Custom Token*:
- **Permissions:** `Account` → `Workers Scripts` → **Edit** (apenas isso).
- **Account Resources:** *Include* → somente a SUA conta.
- **Zone Resources:** *None* (o worker atende por workers.dev; zero permissão de zona).
- **TTL:** defina validade curta (ex.: 30 dias) e renove quando precisar.
- Não compartilhe o token; NUNCA cole em chat; guarde num gerenciador de senhas.
O que esse token NÃO consegue fazer: ler/alterar secrets de outros produtos, DNS,
zonas, billing, usuários. O que consegue: publicar versões do worker e ler o
script — exatamente o necessário. Secrets do worker (FCM_*, IMAGEKIT_*) **não são
tocados** pelos deploys do wrangler (preservados pelo Cloudflare).

## 3a. LAUDO TÉCNICO — risco `wrangler --var` × `keep_vars` (revisão exigida)
O risco apontado é REAL e o desenho original foi corrigido. Comportamento do wrangler:
1. `wrangler deploy` SEM `keep_vars`: as variáveis comuns do Worker passam a ser
   EXATAMENTE as do wrangler.toml + `--var` — **qualquer var criada só no painel
   é APAGADA silenciosamente**. (Secrets nunca são apagados por deploy.)
2. `--keep-vars`/`keep_vars=true`: nenhuma var existente é apagada — MAS, se a
   env temporária fosse uma var comum, ela seria PRESERVADA pelo keep-vars e a
   "remoção por deploy limpo" FALHARIA. Exatamente a armadilha da Opção B.
CONCLUSÃO: ligar/desligar env via deploy é o mecanismo errado. Correção adotada
(Opção A): deploy de CÓDIGO sempre com `--keep-vars` (nada existente é apagado;
provado por snapshot antes/depois com aborto se qualquer nome sumir) e a env
temporária via **Cloudflare API por variável**:
- `PUT  /accounts/{id}/workers/scripts/idseven-push/secrets`
  body `{"name":"SLA_ENGINE_ENABLED","text":"true","type":"secret_text"}`
  → adiciona SÓ essa variável (binding secret_text; o worker a lê igualzinho:
  `env.SLA_ENGINE_ENABLED === "true"`). Nenhuma outra var é lida ou escrita.
- `DELETE /accounts/{id}/workers/scripts/idseven-push/secrets/SLA_ENGINE_ENABLED`
  → remove SÓ ela (retry ×3 no `finally`; 404 = já ausente = ok).
- Snapshot `GET /settings` ANTES e DEPOIS: o log registra SOMENTE nomes+tipos
  (valores nunca são gravados); aborto se a env já existir antes; alerta crítico
  se persistir depois; alerta se qualquer outro nome aparecer/sumir.
- O 403 final é verificado por chamada REAL nas 3 rotas, sempre.
Permissão extra do token: NENHUMA — `Workers Scripts: Edit` já cobre settings/secrets.

## 3b. Por que wrangler para o CÓDIGO (decisão técnica)
Produção foi historicamente publicada via `wrangler deploy` (provado pela
assinatura do bundle no seu backup). Automatizar com a MESMA ferramenta elimina
de vez a divergência de forma (bundle × fonte) e dá: versionamento de deployments
no painel (auditável), rollback nativo (`wrangler rollback`) e env temporária por
deploy (`--var`), removida com um deploy limpo — sem nunca tocar nos secrets.

## 4. O script único: `scripts/worker-ops/microjanela.mjs`
Cobre todos os passos que você fazia à mão. Modos:

| Comando | O que faz | Toca produção? |
|---|---|---|
| `node scripts/worker-ops/microjanela.mjs dry-run` | gera o bundle EXATO de deploy localmente (hash + versão) e lê o estado atual de produção (`GET /`) | NÃO (só leitura) |
| `… deploy` | backup do script ativo via API (conteúdo+SHA-256) → snapshot de vars → `wrangler deploy --keep-vars` → valida versão → **snapshot pós-deploy com aborto se qualquer var tiver sumido** → 403 nas 3 rotas | SIM (com backup + rollback prontos) |
| `… janela <rota>` | snapshot de vars (nomes) → liga a env via **API PUT /secrets** (atômico) → **UMA** coleta → salva JSON → **DELETE /secrets no `finally`** (retry ×3, mesmo em erro) → snapshot final (prova ausência) → re-confirma 403 real | SIM (janela completa, ~60s) |
| `… full <rota>` | `deploy` + `janela` em sequência com abortos automáticos | SIM |
| `… rollback` | `wrangler rollback` para o deployment anterior (alternativa byte-exata: redeploy do `backup-producao-*.js` salvo) | SIM (restauração) |

Rotas aceitas (whitelist hard-coded): `sla-dryrun`, `sla-legacy-baseline`,
`sla-legacy-risk`. Qualquer outra → recusa.

**Comando único da micro-janela inteira:**
```
node scripts/worker-ops/microjanela.mjs full sla-legacy-risk
```

## 5. Cadeados embutidos no script (hard-coded, com teste)
- Guard de variáveis proibidas: se `SLA_WRITE` ou `SLA_ACTIVATED_AT` existirem no
  ambiente ou nos argumentos → **aborto imediato** (testado: aborta).
- A env temporária é removida num bloco `finally` — falha de rede/coleta NÃO deixa
  a env ligada; e o script ainda re-verifica 403 nas 3 rotas ao final.
- Anomalia na coleta (`writeAllowed:true` ou `writes>0`) → aborto + remoção da env.
- Nada destrutivo: sem deletes; secrets intocados; cada passo logado.

## 6. Logs e arquivos gerados (auditoria)
Por execução, em `worker-ops-logs/<timestamp>/`:
`relatorio.txt` (passo a passo com horários e status final) · `bundle.sha256.txt`
· `backup-producao-<hash8>.js` · `deployments-antes.txt` · `producao-get.json`
· `deploy-limpo.txt` / `deploy-com-env.txt` · `<rota>-<timestamp>.json` (a coleta)
· `rollback.txt` (quando aplicável). A pasta inteira é a evidência da janela.

## 7. Critérios de sucesso/falha (automáticos)
SUCESSO = backup salvo com hash + versão esperada no `GET /` + 403 nas 3 rotas
sem env + coleta 200 com `writeAllowed:false`/`writes:0` + 403 re-confirmado após
remoção. QUALQUER desvio = `FALHA` no relatório, exit code ≠ 0 e, se a env chegou
a ser ligada, ela JÁ foi removida pelo `finally` antes do script terminar.

## 8. O que continua dependendo de aprovação humana (sua)
1. Criar/renovar o API Token (uma vez) — nunca passa por mim nem pelo chat.
2. **Autorizar cada deploy/janela** (você roda o comando; eu nunca executo
   produção por conta própria — e deste ambiente nem posso: rede bloqueada).
3. Autorizar qualquer pacote novo (V64.60+), 4.4-B, escrita real, push, bloqueio,
   Rules, UI — inalterado.
4. Opcional futuro (se quiser que EU rode as janelas): adicionar
   `api.cloudflare.com` + `idseven-push.agidseven.workers.dev` ao allowlist de
   rede do ambiente Claude Code e configurar `CLOUDFLARE_API_TOKEN` como secret
   DO AMBIENTE (nunca no chat) — aí o mesmo script roda daqui, sob as mesmas
   autorizações por janela.

## 9. Fluxo recomendado da primeira execução automatizada (quando autorizar)
1. `dry-run` (sem rede de escrita) → conferir hash do bundle e versão de produção.
2. Você autoriza explicitamente no chat ("autorizo deploy automatizado VX").
3. `full <rota>` → me cola o `relatorio.txt` + JSON da coleta → eu entrego o laudo.
