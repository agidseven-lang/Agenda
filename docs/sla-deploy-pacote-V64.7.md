# PACOTE DE DEPLOY CONTROLADO — Worker V64.7-sla-baseline-ready (FASE 4.4-A3)

**Status: PREPARADO E AUDITADO. NENHUM DEPLOY FOI FEITO. Execução = FASE 4.4-A4,
somente com autorização explícita.**

## Identidade do pacote

| Item | Valor |
|---|---|
| Arquivo | `cloudflare-worker.js` (single-file, padrão painel Cloudflare) |
| Versão | `V64.7-sla-baseline-ready` |
| SHA-256 do pacote | `b17a5f3701b3d074b3d1244f8b5f89749967aa423e6e7c64634b9a04b8cf7acc` |
| Base de produção | `V64.5-designer-notify` (commit `0a356fd`), SHA-256 `58264a3da232348269b1699a9d80e39e4e3db1477ce0df2ec092df62fb3e661f` |
| Diff | **+419 linhas / −1 linha** (a única remoção é a string de versão) — estritamente aditivo |
| Equivalência | 15/15 PASS (`scripts/sla-fase44a3-equivalencia.mjs`): sem env SLA_*, respostas idênticas rota a rota e cron com as mesmas chamadas de rede |

## Rotas

| Preservadas (resposta idêntica provada) | Novas (inertes sem env) |
|---|---|
| `GET /` (status) | `POST /sla-dryrun` → **403** sem `SLA_ENGINE_ENABLED` |
| `POST /` (push relay) | `POST /sla-reschedule-plan` → **403** sem `SLA_ENGINE_ENABLED` |
| `POST /cron-test` (dry-run lembretes) | |
| `POST /notify-assignee` | |
| `POST /notify-designer` | |
| `POST /imagekit-auth` | |
| cron `scheduled()` 1/min (lembretes) | gancho SLA: no-op absoluto sem env |

## Execução do baseline (FASE 4.4-A4 — NÃO EXECUTAR SEM AUTORIZAÇÃO)

Checklist, na ordem, com ator humano (você) no painel Cloudflare:

1. [ ] Janela: horário de baixo uso (sugestão: fora do horário comercial).
2. [ ] Copiar o conteúdo de `cloudflare-worker.js` deste branch (conferir SHA-256
   acima, ex.: `sha256sum cloudflare-worker.js`).
3. [ ] Painel Cloudflare → Worker `idseven-push` → Quick Edit → colar → Save and deploy.
4. [ ] Smoke imediato (1 min): `curl https://idseven-push.agidseven.workers.dev/`
   → deve responder `version:"V64.7-sla-baseline-ready"`.
   `curl -X POST .../sla-dryrun` → deve responder **403** (env ainda ausente).
5. [ ] Observar 10 min: lembretes do cron seguem normais (logs do painel).
6. [ ] Criar var `SLA_ENGINE_ENABLED=true` (ÚNICA var; NÃO criar `SLA_WRITE`,
   NÃO criar `SLA_ACTIVATED_AT`).
7. [ ] Rodar 3× em horários distintos: `curl -X POST .../sla-dryrun` e salvar os JSON.
8. [ ] Coletar: `totals.byDesigner/byClient/byType`, `retroIgnored`,
   `locksConsolidated`, `wip`, `pagination.totalQueried`.
9. [ ] **Remover** a var `SLA_ENGINE_ENABLED` ao final da janela.
10. [ ] Entregar os JSONs para análise/calibração (decisão da 4.4-B).

## Rollback em 1 passo (comando exato)

- **Nível 1 (engine):** remover a var `SLA_ENGINE_ENABLED` no painel → rotas SLA
  voltam a 403 e o gancho do cron vira no-op. Sem redeploy.
- **Nível 2 (total):** restaurar o V64.5 byte-idêntico:
  `git show 0a356fd:cloudflare-worker.js > worker-v645.js` → colar no Quick Edit
  → Save and deploy. (Verificação: `sha256sum worker-v645.js` =
  `58264a3d…fb3e661f`.)

## Critérios de ABORTO IMEDIATO (qualquer um ⇒ rollback nível 1; se persistir, nível 2)

1. Lembrete de compromisso/tarefa não entregue ou duplicado após o deploy.
2. Qualquer rota legada respondendo diferente do esperado (status ≠ histórico).
3. `/sla-dryrun` reportando `writeAllowed:true` ou `writes>0` (não deve ser possível
   sem `SLA_WRITE` — se ocorrer, é anomalia grave: abortar e investigar).
4. Qualquer doc novo em `slaEvents`/`designerLocks`/`wipLimits` (não deve existir).
5. Erros novos no log do Worker (`[SLA] erro:` recorrente) ou aumento de latência/CPU.
6. Qualquer reclamação de push/notificação no app durante a janela.

## Riscos restantes (honestos)

1. O harness local não exercita TLS/limites de CPU reais do edge — mitigado pela
   janela curta + smoke + observação de 10 min antes da env.
2. `runQuery` do baseline lê até 300 tasks/min no cron com env ligada — custo
   pequeno, mas real; janela limitada e env removida ao final.
3. A var `SLA_ENGINE_ENABLED` ligada no cron gera 1 query/min extra durante a
   janela (sem escrita). Aceitável; remover ao final (passo 9).

## Confirmações desta fase (4.4-A3)

- Nenhum deploy foi feito; nenhuma env de produção foi criada/alterada
  (este ambiente não tem credenciais do painel — impossibilidade material, além
  da proibição).
- `SLA_WRITE` NÃO será configurada no baseline (o checklist não a inclui; o
  critério de aborto 3 vigia exatamente isso).
