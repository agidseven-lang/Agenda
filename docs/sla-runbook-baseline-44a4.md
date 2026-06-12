# RUNBOOK HUMANO v4 (4.4-A4) — BASELINE REAL READ-ONLY · base real V64.53 (BUNDLE)
Worker `idseven-push` · pacote `worker-v655-bundle.js` (V64.55-sla-baseline-ready)
Executor: humano (painel Cloudflare). NADA foi executado; este é o roteiro.
Substitui o v3 (suspenso): o v3 assumia que o editor continha a FONTE git — o seu
portão A4 provou que o editor contém o BUNDLE wrangler/esbuild da fonte.

## O QUE MUDOU NO v4 (entenda antes de executar)
1. Produção é um **module worker bundlado** (`var cloudflare_worker_default = {...};
   export { cloudflare_worker_default as default };`) — gerado por `wrangler deploy`
   a partir de `cloudflare-worker.js` (confirmado no `wrangler.toml`: `main =
   "cloudflare-worker.js"`; o nome da variável deriva do filename).
2. O pacote agora é entregue NA MESMA FORMA (bundle): `worker-v655-bundle.js`.
3. O portão de hash do backup mudou de natureza: a referência canônica é **o hash
   que VOCÊ capturou do editor real** (`2702312d…`), registrado no momento da cópia
   — não um hash pré-calculado de git. A íntegra é verificada por estrutura (A4b).

## HASHES DE REFERÊNCIA (v4)
| Artefato | SHA-256 |
|---|---|
| Backup REAL do editor (`worker-v6453-backup.js`, capturado por você) | `2702312d2c5d6522aa05f2c3b301b40a4e7eef58fbbaa91bbef121d493024dd7` |
| Bundle-réplica V64.53 p/ conferência (`worker-deploy/repro-v6453-bundle.js`) | `49c5025bb4f8936d2ec6ed2275491b66aa5eedf6e819daf784e1a87813fe528b` |
| **PACOTE de deploy (`worker-deploy/worker-v655-bundle.js`)** | `5d7a912dccc8a0e7773a642b02c8ad8f00544186e927fb8879acd1ee2c52f1df` |
| Fonte V64.55 (repo, `cloudflare-worker.js`) | `77970c70daadd529573b79d488bcd2acec84d7dd7a25fbe01dafa177ccaf9cf6` |
Obs.: backup ≠ réplica é ESPERADO no byte (versões de esbuild diferentes) — a
equivalência é estrutural/semântica e é verificada no passo A4b.

## PROIBIÇÕES (inalteradas)
NÃO criar `SLA_WRITE` · NÃO criar `SLA_ACTIVATED_AT` · NÃO tocar outras envs/secrets ·
NÃO tocar Firestore Rules · NÃO tocar Android/Desktop/UI/`appConfig/flags` ·
NÃO testar `/notify-assignee`, `/notify-designer`, `POST /` relay ·
NÃO usar `/cron-test` com `{"send":true}` (com `{}` é dry-run provado: guarda
`if (dryRun)` antes de `sendToTokens` e de `markReminderSent` nas 3 vias).

## ROTEIRO

### ANTES — pré-check, backup e VERIFICAÇÃO DO BACKUP
A1. Painel Cloudflare → Workers & Pages → `idseven-push`. Em dúvida sobre onde
    clica: PARE.
A2. C1 → `"version":"V64.53-premium-portal"`. Diferente: PARE e reporte.
A3. Settings → Variables → PRINT. Esperado: zero `SLA_*`.
A4. BACKUP (se ainda não tiver o de 16:18 UTC guardado): copiar TODO o editor →
    `worker-v6453-backup.js`. Registrar o hash (C2). Referência canônica:
    `2702312d…024dd7` (o seu, já capturado).
A4b. VERIFICAÇÃO DE ÍNTEGRA/EQUIVALÊNCIA do backup (read-only, local):
    1. `node --check worker-v6453-backup.js`  → sem erro (arquivo completo).
    2. `find /c /v "" worker-v6453-backup.js` → anotar nº de linhas
       (réplica tem 2.936 — o seu pode variar um pouco pela versão do esbuild).
    3. `findstr /N /C:"url.pathname" worker-v6453-backup.js | find /c /v ""`
       → esperado **25** (mesmo nº da réplica; é o despacho completo de rotas).
    4. Baixar `worker-deploy/repro-v6453-bundle.js` do branch
       `desktop/local-detail-hierarchy-v2` e rodar:
       `fc worker-v6453-backup.js repro-v6453-bundle.js > diff-backup.txt`
       Esperado: diferenças PEQUENAS e cosméticas (whitespace/forma da versão do
       esbuild). Se aparecerem BLOCOS de código presentes num e ausentes no outro
       (rotas/funções inteiras): **PARE e me envie o diff-backup.txt**.
A5. PACOTE: baixar `worker-deploy/worker-v655-bundle.js` (mesmo branch) como
    `worker-v655-bundle.js` → conferir hash (C3) = `5d7a912d…52f1df`.

### ████ PONTO DE PARADA OBRIGATÓRIO ████
[ ] A2 = V64.53  [ ] A3 zero `SLA_*` (print)  [ ] A4 backup guardado + hash anotado
[ ] A4b íntegra OK (node --check, 25 rotas, fc sem blocos faltantes)
[ ] A5 pacote hash OK  [ ] Rollback (seção abaixo) aberto  [ ] Horário anotado
TODOS marcados → B1. Qualquer dúvida → NÃO deployar.

### DEPLOY CONTROLADO (sem env)
B1. "Edit code" → apagar → colar `worker-v655-bundle.js` INTEIRO.
B2. "Save and deploy" (anotar horário).
B3. C1 → `"version":"V64.55-sla-baseline-ready"`.
B4. C4 → **403**. C5 → **403**.
B5. Variables inalteradas vs A3 (PRINT).
B6. C6 (cron-test `{}` → 200 dry-run) e C7 (imagekit-auth → 200).
B6b. SMOKE DO PORTAL (read-only, novo no v4): abrir no navegador UM link de
    portal/preview já existente (ex.: um link `/cliente/...` válido recente) e
    confirmar que a página renderiza normal. Falhou → ABORTO (rollback).
B7. 10 min de logs: `[CRON]` normal; ZERO linha `[SLA]`. PRINT.

### JANELA DE MEDIÇÃO
D1. Criar Variable `SLA_ENGINE_ENABLED` = `true` → Save.
D2. PRINT (única `SLA_*`; `SLA_WRITE` e `SLA_ACTIVATED_AT` conferidos 2× como INEXISTENTES).
D3-D5. C8 → `run1.json` (~10h), `run2.json` (~14h), `run3.json` (~17-18h).
    Em cada um: `"mode":"dry-run"`, `"writeAllowed":false`, `"writes":0`,
    `"eligibleEvents":0`. Divergiu → ABORTO.
D6. Logs sem `[SLA] erro:`; lembretes normais; nenhum push anômalo; portal normal.

### DEPOIS — encerramento OBRIGATÓRIO
E1. REMOVER `SLA_ENGINE_ENABLED` (sempre).
E2. C4 → 403 (PRINT). E3. Variables zero `SLA_*` (PRINT).
E4. Firestore: coleções `slaEvents`/`designerLocks`/`wipLimits`/`adminOverrides`
    inexistentes/sem docs novos; 2-3 `tasks` sem campo novo (`designerSla`) nem
    mudanças sem ação de usuário. PRINTs.
E5. Zero push anômalo na equipe; logs limpos.
E6. DECISÃO: manter V64.55 sem env (equivalência provada; pronto p/ 4.4-B) OU
    restaurar o backup (rollback nível 2). Anotar.
E7. Horário de fim.

## COMANDOS
```
C1  curl -s https://idseven-push.agidseven.workers.dev/
C2  certutil -hashfile worker-v6453-backup.js SHA256     (Linux/Mac: sha256sum)
C3  certutil -hashfile worker-v655-bundle.js SHA256
C4  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://idseven-push.agidseven.workers.dev/sla-dryrun
C5  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://idseven-push.agidseven.workers.dev/sla-reschedule-plan
C6  curl -s -X POST https://idseven-push.agidseven.workers.dev/cron-test -H "Content-Type: application/json" -d "{}"
C7  curl -s -X POST https://idseven-push.agidseven.workers.dev/imagekit-auth -H "Content-Type: application/json" -d "{\"token\":\"teste\",\"expire\":9999999999}"
C8  curl -s -X POST https://idseven-push.agidseven.workers.dev/sla-dryrun > run1.json
```

## NÃO CONTINUAR SE
1. C1 ≠ `V64.53-premium-portal` antes do deploy.
2. `node --check` falhar no backup, contagem de rotas ≠ 25, ou `fc` mostrar blocos
   de código faltantes (enviar diff-backup.txt e parar).
3. Hash do pacote ≠ `5d7a912d…52f1df`.
4. Qualquer env `SLA_*` pré-existente; dúvida no painel; rota antiga falhando;
   portal não renderizando (B6b); linha `[SLA]` antes da env; `run*.json` com
   `writeAllowed:true`/`writes>0`/`eligibleEvents>0`.

## ROLLBACK
Nível 1: remover `SLA_ENGINE_ENABLED` → C4 = 403.
Nível 2: colar `worker-v6453-backup.js` (SEU backup do editor — restauração
byte-exata do que rodava) → Save and deploy → C1 = `V64.53-premium-portal`.

## ENVIAR DE VOLTA
Horários início/fim · hash do backup + nº de linhas + resultado do fc (A4b) ·
C1 antes/depois · C4 pré-env e pós-remoção (403/403) · `run1/2/3.json` integrais ·
PRINTs (variáveis A3/B5/D2/E3, Firestore E4, logs B7) · linhas `[SLA]` (ou "nenhuma")
· decisão E6. Análise: `node scripts/sla-baseline-analise.mjs run1.json run2.json run3.json`.
