# MINI-RUNBOOK — V64.59 LENTE DE RISCO (última extensão legado, read-only)

**Objetivo:** termômetro temporário da fila — risco ANTES do vencimento:
início vencido (startDate passada + afazer), vence-em-breve (<24h/24-72h/3-7d/
+7d/já vencida), fila parada (idade em afazer), consumo da janela (até 50%/
50-80%/80-100%/estourou) e nível de risco alto/médio/baixo por setor e por
responsável PSEUDONIMIZADO. Measure-only: zero alerta/lock/push/escrita.

## Hash do pacote
`worker-deploy/worker-v659-bundle.js` → `0e4fed88bc3a493e749d5e1cee5dfb890eb613c40492ce409889d7b83d4d7b4a`

## Passos (um por vez; colar saídas)
R1. `certutil -hashfile worker-v659-bundle.js SHA256` = hash acima.
R2. Edit code → colar INTEIRO → Save and deploy (anotar horário).
R3. `curl -s https://idseven-push.agidseven.workers.dev/` → `"version":"V64.59-legacy-risk"` → COLAR.
R4. SEM env, confirmar 403 nas três: `/sla-dryrun`, `/sla-legacy-baseline`,
    `/sla-legacy-risk` (`curl -s -o NUL -w "%{http_code}\n" -X POST ...`) → COLAR.
R5. Criar SOMENTE `SLA_ENGINE_ENABLED=true` →
    `curl -s -X POST .../sla-legacy-risk > legacy-risk.json` (UMA chamada)
    → colar o JSON inteiro (anônimo).
R6. REMOVER `SLA_ENGINE_ENABLED` (lembrar de SALVAR a mudança) →
    confirmar `/sla-legacy-risk` = 403 e `/sla-dryrun` = 403 → COLAR.

## Proibições (inalteradas)
SEM `SLA_WRITE` · SEM `SLA_ACTIVATED_AT` · SEM Rules · SEM UI · SEM push · SEM
lock · SEM escrita · SEM 4.4-B. Rollback: nível 1 = remover env; nível 2 =
backup `worker-v6453-backup.js` (`2702312d…024dd7`).
