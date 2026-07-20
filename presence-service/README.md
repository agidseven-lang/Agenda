# idseven-presence-canary

Serviço **CANÁRIO** de presença em tempo real — Cloudflare Worker + Durable Object (SQLite) + WebSocket Hibernation. **Totalmente isolado** do Worker J6 (`idseven-push`): outro `name`, outro DO, outro secret, outra rota, outro deploy, outro rollback. **Não** edita `cloudflare-worker.js`, **não** usa Firestore/Firebase Auth/Rules, **não** altera o Cloud Run.

## Arquitetura
- **`/auth`** (POST, `Authorization: Bearer <sessionToken>`) → valida a identidade no **`getUserSelf` existente** (read-only) → emite um **ticket efêmero** (HS256, `aud=idseven-presence`, 60s, `nonce`). O token de sessão **nunca** é logado/persistido/encaminhado.
- **`/ws?ticket=…`** (flag `PRESENCE_WS_ENABLED`) → verifica o ticket → encaminha ao Durable Object `PresenceHubCanary`.
- **`PresenceHubCanary`** (SQLite DO, hibernação): agrega sessões por usuário; emite transição **só** em `0↔1`; `transitionRevision` monotônico; **alarm único** na expiração mais próxima (sem `setInterval/setTimeout`); baseline (snapshot) na conexão sem notificar.

## Correções aplicadas (auditoria)
1. **DO SQLite** (`[[migrations]] new_sqlite_classes`) — não assume plano Paid.
2. **Alarm único** na menor `expiresAt`, reprogramado a cada heartbeat/conexão/desconexão/limpeza; idempotente.
3. **Sem `setInterval`/`setTimeout`** no DO → elegível à hibernação.

## Feature flags (server-side)
| Flag | 1º deploy | Efeito |
|---|---|---|
| `PRESENCE_AUTH_ENABLED` | `true` | `/auth` ativo |
| `PRESENCE_WS_ENABLED` | `false` | `/ws` desligado |
| `PRESENCE_BROADCAST_ENABLED` | `false` | sem broadcast |

No primeiro deploy só `/health` e `/auth` funcionam.

## Testes (proteção técnica; não substituem a prova física)
```
npm test      # node test/ticket.test.mjs && node test/presence.test.mjs
```
Cobrem: ticket (assina/verifica/expira/adultera/aud/reuso) e agregação (0↔1, multi-device, heartbeat sem notificar, alarm idempotente, crash de 1-de-2, nextExpiry, baseline sanitizado, seed/reconexão sem entrada falsa).

## Deploy em 2 estágios (ação do OWNER — exige conta Cloudflare)
> STOP GATE: criar secrets e fazer deploy são passos do owner. Este repositório entrega o código; o deploy usa a conta Cloudflare do owner.

**STAGE 1 — AUTH-ONLY (só `/health` e `/auth`; SEM Durable Object/WS).** Config: `wrangler.toml` (default). Entry: `src/auth-only.ts`. NÃO cria DO/binding/migration.
1. **Auditar plano/Workers/workers.dev** na conta (não contratar/alterar plano em silêncio).
2. Secret próprio: `wrangler secret put PRESENCE_TICKET_SECRET` (aleatório forte, ≥32 bytes; separado do J6).
3. **Primeiro deploy**: `cd presence-service && wrangler deploy` (usa `wrangler.toml` = stage 1).
4. Conferir `GET https://idseven-presence-canary.<subdominio>.workers.dev/health`.
5. **PARAR** e fazer a **prova real do `/auth`** com a conta real do owner pelo Desktop 1.0.179-canary.1.

**STAGE 2 — DURABLE OBJECT + WebSocket (só após autorização literal).** Config: `wrangler.stage2.toml` (traz DO `PresenceHubCanary` + migration SQLite + WS). Deploy: `npm run deploy:stage2`. NÃO fazer antes do STAGE-2 autorizado.

Alternativa de deploy: workflow `.github/workflows/presence-canary-deploy.yml` (stage 1; requer `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` como secrets do repositório — ação do owner).

## Segurança
Ver `THREAT-MODEL.md`. Identidade só do `getUserSelf`; `userId` do body ignorado; eventos sanitizados (sem token/IP/hostname/deviceId/localização).
