# MINI-RUNBOOK — RECOLA CONTROLADA V64.56 (correção do scanned:0)

**Pré-aprovado pelos portões já cumpridos (A2/A3/A4/A4b/A5). Backup inalterado:
`worker-v6453-backup.js` (hash `2702312d…024dd7`) segue sendo o rollback nível 2.**

## O que mudou V64.55 → V64.56 (só na seção SLA; rotas premium intocadas)
1. Consulta de tarefas robusta: tenta o filtro IN; se o Firestore rejeitar OU
   retornar vazio, faz fallback com 4 consultas de IGUALDADE (índice default)
   mescladas por id — read-only nas duas vias.
2. `report.queryDiagnostics`: status HTTP do IN, corpo de erro (truncado),
   estratégia usada e contagens por status — o run1.json passa a explicar
   sozinho qualquer zero, sem depender de Observability.
3. Cadeados idênticos: sem `SLA_WRITE` → zero escrita; sem `SLA_ACTIVATED_AT` →
   zero eventos elegíveis; zero FCM; zero lock; zero visual.

## Hash do pacote
`worker-deploy/worker-v656-bundle.js` →
`200dbe1e08752788eadb5b027be4f7cf7bb8bfe5d8c2c4267cd60214add7bbf6`

## Passos (um de cada vez; pare e reporte entre eles)
R1. Conferir hash local do arquivo baixado (certutil) = hash acima.
R2. Edit code → colar INTEIRO → Save and deploy → anotar horário.
R3. `curl -s https://idseven-push.agidseven.workers.dev/` → esperado
    `"version":"V64.56-sla-baseline-ready"` → COLAR AQUI.
R4. `curl -s -o NUL -w "%{http_code}\n" -X POST .../sla-dryrun` → esperado 403
    (env removida) → COLAR AQUI e AGUARDAR liberação do passo seguinte.
R5. (após liberação) criar `SLA_ENGINE_ENABLED=true` → 1 curl de diagnóstico
    `curl -s -X POST .../sla-dryrun > diag.json` → colar `queryDiagnostics`,
    `scanned` e `totals` AQUI. Se `scanned>0`: janela liberada p/ run1/2/3.
    Se `scanned==0`: o queryDiagnostics dirá exatamente por quê — remover env
    e me enviar.
R6. Encerramento padrão do runbook v4 (remover env → 403 → verificações E4-E7).

## Proibições (inalteradas)
SEM `SLA_WRITE` · SEM `SLA_ACTIVATED_AT` · SEM Rules · SEM UI · SEM push · SEM
lock · SEM 4.4-B. Rollback nível 1 = remover env; nível 2 = colar o backup.
