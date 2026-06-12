# PACOTE DE DEPLOY — worker-v655-bundle.js (V64.55-sla-baseline-ready)

**Status: PREPARADO E AUDITADO. NENHUM DEPLOY FOI FEITO.**
Substitui o V64.54 (formato fonte). Mudança do v4: o artefato é entregue na MESMA
FORMA que o editor da Cloudflare exibe em produção — **bundle esbuild de module
worker** (`var cloudflare_worker_default = {...}; export { cloudflare_worker_default
as default };`) — confirmada pelo backup real do usuário e pelo `wrangler.toml`
(`main = "cloudflare-worker.js"`, deploy via `wrangler deploy`).

## Identidade
| Item | Valor |
|---|---|
| Base real | bundle de produção V64.53-premium-portal (backup do usuário: `2702312d…024dd7`) |
| Réplica de conferência | `worker-deploy/repro-v6453-bundle.js` = esbuild(fonte git V64.53) — `49c5025b…fe528b` |
| **Pacote (colar no editor)** | `worker-deploy/worker-v655-bundle.js` = esbuild(fonte V64.55) — **`5d7a912d…52f1df`** |
| Fonte V64.55 | `cloudflare-worker.js` no branch — `77970c70…af9cf6` |
| Cadeia | fonte git V64.53 ──(+seção SLA, +419/−1)──> fonte V64.55 ──(esbuild)──> pacote |

## Provas
- Equivalência EM FORMA DE BUNDLE (repro-V64.53 × V64.55): 15/15 PASS
  (`scripts/sla-fase44a3-equivalencia.mjs`) — rotas legadas byte-idênticas,
  /sla-dryrun 403 sem env, read-only sem SLA_WRITE, 0 elegíveis sem
  SLA_ACTIVATED_AT, 0 FCM, cron com chamadas idênticas.
- Suites SLA sobre a fonte V64.55: 39+14+11+16 = 80 PASS.
- Verificação backup real × réplica: passo A4b do runbook v4 (fc local do usuário;
  esperado: só diferenças cosméticas de versão do esbuild).

## Execução
Runbook canônico v4: `docs/sla-runbook-baseline-44a4.md`.
Rollback nível 2 = colar o backup REAL do usuário (restauração byte-exata).
