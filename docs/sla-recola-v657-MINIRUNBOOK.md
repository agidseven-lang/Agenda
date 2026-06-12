# MINI-RUNBOOK — RECOLA V64.57 (descoberta de schema + baseline)

**Contexto da correção:** a janela V64.56 provou (queryDiagnostics: 200 com zero
docs nas 4 igualdades) que NENHUMA tarefa em produção tem `designerFlowStatus` —
e a auditoria de código confirmou o porquê: o app WEB de produção (branch main,
agendaidseven.com.br) grava o fluxo no campo genérico `status`; o eixo designer
só é escrito pelos apps BETA (Desktop 1.0.14x / Android nativebeta). O scanned:0
era a verdade dos dados, não defeito de consulta.

**Novidade V64.57:** rota `POST /sla-discover` (read-only absoluto, exige
SLA_ENGINE_ENABLED) — amostra as 60 tarefas mais recentes e devolve SOMENTE
agregados anônimos: presença de campos, histogramas de valores enum (status/
cronStatus/clientFlowStatus/sector), contagem de ATRASOS REAIS por dueDate,
idade das tarefas e 3 sondas de igualdade. Zero ids/títulos/clientes/nomes.

## Hash do pacote
`worker-deploy/worker-v657-bundle.js` → `e5a8efde99fb23f473e1d8a962bf7d7a57427ad09911b54a90a1a3a9d673f8d5`

## Passos (um por vez)
R1. Conferir hash local = acima.
R2. Edit code → colar INTEIRO → Save and deploy.
R3. `curl -s .../` → `"version":"V64.57-sla-discover"` → COLAR AQUI.
R4. `curl -s -o NUL -w "%{http_code}\n" -X POST .../sla-dryrun` → 403 → COLAR.
R5. (após liberação) criar `SLA_ENGINE_ENABLED=true` e rodar:
    `curl -s -X POST .../sla-discover > discover.json` → colar o JSON inteiro
    (é 100% anônimo). Ele responde DE UMA VEZ: campo real, valores reais,
    adoção do eixo designer, atrasos reais por dueDate.
R6. Remover `SLA_ENGINE_ENABLED` → 403 → fim da micro-janela (~2 min).

## Proibições
SEM `SLA_WRITE` · SEM `SLA_ACTIVATED_AT` · SEM Rules · SEM UI · SEM push ·
SEM lock · SEM 4.4-B. Rollback: nível 1 = remover env; nível 2 = backup
`worker-v6453-backup.js` (`2702312d…024dd7`).
