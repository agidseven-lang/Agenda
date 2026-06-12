# PLANO — Baseline real READ-ONLY do Designer SLA Engine (pré-4.4-B)

**Status: PLANO. Nada aqui foi executado. Execução exige autorização explícita.**

## Objetivo
Medir a realidade operacional (WIP real por designer, volume de atrasos, tamanho
da rajada retroativa) ANTES de qualquer escrita real, calibrando: `wipSoft`,
`wipHard`, antecedências de alerta e o valor de `SLA_ACTIVATED_AT`.

## Pré-requisitos (fora deste ambiente)
1. Acesso ao painel Cloudflare do Worker `idseven-push` (quem opera: você).
2. Nenhum secret novo: usa a MESMA service account já configurada (leitura
   Firestore via REST já é usada pelo cron de lembretes hoje).

## Procedimento (15 min, reversível em 1 passo)
1. **Deploy do V64.6** *(exige sua autorização de deploy — ainda não dada)*:
   o arquivo `cloudflare-worker.js` deste branch. Sem env novas, o
   comportamento é byte-idêntico ao V64.5 em produção (provado por teste:
   rota nova responde 403; gancho do cron é no-op sem env).
2. No painel, criar APENAS a var **`SLA_ENGINE_ENABLED=true`**.
   - NÃO criar `SLA_WRITE` (escrita impossível).
   - NÃO criar `SLA_ACTIVATED_AT` (emissão de eventos = zero; tudo vira
     `retroIgnored` no relatório — read-only absoluto por construção dupla).
3. Rodar: `curl -X POST https://idseven-push.agidseven.workers.dev/sla-dryrun`
   (3× em horários distintos: manhã/tarde/fim do dia).
4. Coletar do JSON: `totals.byDesigner` (WIP observado e atrasos reais),
   `totals.byClient`, `totals.byType`, `retroIgnored` (tamanho real da rajada),
   `locksConsolidated` (quantos designers ficariam bloqueados HOJE),
   `pagination.totalQueried` (volume real de tarefas ativas).
5. Remover a var `SLA_ENGINE_ENABLED` (rollback total em 1 passo).

## Garantias durante o baseline
- Zero escrita em `tasks`/`slaEvents`/`designerLocks`/`wipLimits` (sem
  `SLA_WRITE` + flag `slaEngine` OFF = `writeAllowed:false` sempre).
- Zero push (caminho de FCM não existe no engine desta fase).
- Zero bloqueio, zero UI, zero impacto nos lembretes atuais (cron intocado).
- Custo: 1 runQuery extra/minuto no cron + sob demanda na rota (≤300 docs).

## Decisões que o baseline alimenta (gate da 4.4-B)
1. `wipSoft`/`wipHard` reais por designer (hoje: chute 2/2 em modo observe).
2. `SLA_ACTIVATED_AT` (proposta: o instante da ativação da 4.4-B, eliminando
   100% da rajada retroativa medida).
3. Se `maxTasksPerPass=200` cobre o volume real (`totalQueried`).
4. Tamanho esperado do fluxo de eventos/dia (custo de `slaEvents`).
