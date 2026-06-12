# MINI-RUNBOOK — V64.58 LENTE LEGADO (baseline operacional read-only)

**Objetivo:** descobrir quantas demandas estão ATRASADAS HOJE no modelo real de
produção (`status` + `dueDate`), com agregados anônimos. Measure-only por
construção: a lente legado NÃO gera alerta pessoal, NÃO gera lock, NÃO gera
push, NÃO escreve nada, NÃO toca slaEvents/designerLocks/designerSla/tasks.

## Hash do pacote
`worker-deploy/worker-v658-bundle.js` → `9f466f21c89972506ff5cdb764b9442c26967d31f715e65354f3c1ea6936d23e`

## O que a rota nova devolve (`POST /sla-legacy-baseline`, exige env)
Agregados anônimos: contagens por status (afazer/andamento/revisao/concluido),
por setor (copy/design), por responsável PSEUDONIMIZADO (resp01..respNN — o id
nunca sai), ATRASADAS por dueDate (com magnitude: até 1d / 1-3d / 3-7d / +7d,
por setor e por respNN), futuras, sem dueDate/sem responsável/sem setor, aging
(0-7/8-30/31-90/90+/sem createdAt) e diag por consulta (4 igualdades, status
HTTP + contagens). Zero títulos/clientes/nomes/ids/e-mails/telefones/tokens.

## Passos (um por vez; colar saídas entre eles)
R1. `certutil -hashfile worker-v658-bundle.js SHA256` = hash acima.
R2. Edit code → colar INTEIRO → Save and deploy (anotar horário).
R3. `curl -s https://idseven-push.agidseven.workers.dev/`
    → `"version":"V64.58-legacy-baseline"` → COLAR.
R4. `curl -s -o NUL -w "%{http_code}\n" -X POST .../sla-dryrun` → 403 → COLAR.
R4b. idem para `/sla-legacy-baseline` → 403 (sem env) → COLAR.
R5. Criar SOMENTE `SLA_ENGINE_ENABLED=true` →
    `curl -s -X POST .../sla-legacy-baseline > baseline-legado.json`
    (UMA chamada) → colar o JSON inteiro (anônimo).
R6. REMOVER `SLA_ENGINE_ENABLED` →
    confirmar `/sla-legacy-baseline` = 403 e `/sla-dryrun` = 403 → COLAR.

## Proibições (inalteradas)
SEM `SLA_WRITE` · SEM `SLA_ACTIVATED_AT` · SEM Rules · SEM UI · SEM push · SEM
lock · SEM escrita · SEM 4.4-B. Rollback: nível 1 = remover env; nível 2 =
backup `worker-v6453-backup.js` (`2702312d…024dd7`).
