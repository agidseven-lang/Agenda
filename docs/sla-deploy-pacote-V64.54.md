# PACOTE DE DEPLOY CONTROLADO — Worker V64.54-sla-baseline-ready (rev. base real)

**Status: PREPARADO E AUDITADO. NENHUM DEPLOY FOI FEITO.**
Substitui e OBSOLETA o pacote V64.7 (que fora montado sobre uma cópia defasada
V64.5 da raiz do branch desktop — erro detectado pelo portão A2 do runbook quando
a produção respondeu V64.53-premium-portal).

## Identidade

| Item | Valor |
|---|---|
| Base REAL de produção | `V64.53-premium-portal` — fonte: branch `worker/v64-42-team-adjust-idem-cleanup` |
| SHA-256 da base V64.53 | `a03f3d625ee77b844190bd6c0b5b0600ece03dfc56425f6c67b2ab09180cc001` |
| Pacote | `cloudflare-worker.js` @ branch `desktop/local-detail-hierarchy-v2` — `V64.54-sla-baseline-ready` |
| SHA-256 do pacote V64.54 | `a85338d22270f14f0ca8d4cc0a80cb5ded0cbcf1c8f66bdf8bdc0a5705684433` |
| Diff V64.53→V64.54 | estritamente aditivo: +419/-1 (única remoção = string de versão) |
| Equivalência | 15/15 PASS (`scripts/sla-fase44a3-equivalencia.mjs`, OLD=V64.53 real) |
| Suites SLA | 39+14+11+16 = 80 PASS sobre o pacote V64.54 |

## Rotas da V64.53 preservadas (nenhuma linha tocada)
`GET /` · `POST /` relay · `/cron-test` · `/notify-assignee` · `/notify-designer` ·
`/imagekit-auth` · portal premium: `/cliente/*`, `/client/send-premium-whatsapp`,
`/team/session`, `/preview`, `/preview.jpg`, `/og/*`, `/wa-card-test-*`, `/wa-diag` ·
cron `scheduled()`.
Novas (inertes sem env): `/sla-dryrun` (403) e `/sla-reschedule-plan` (403).

## Execução, rollback, aborto e entrega
Ver runbook canônico v3: `docs/sla-runbook-baseline-44a4.md`.
Rollback nível 2 restaura o backup `worker-v6453-backup.js` (hash `a03f3d62…80cc001`).
