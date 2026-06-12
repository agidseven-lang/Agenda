# RUNBOOK HUMANO v3 (4.4-A4-PREP-v3 — base REAL de produção V64.53) — BASELINE REAL READ-ONLY
Worker `idseven-push` · pacote V64.54-sla-baseline-ready · executor: humano (painel Cloudflare)
Versão canônica. NADA foi executado; este documento é o roteiro operacional.

## ⚠️ AVISO CENTRAL
O deploy do V64.54, mesmo read-only, é uma ALTERAÇÃO REAL do Worker de produção.
Trate como JANELA CONTROLADA: anote horário de início e fim, só comece com o
backup conferido por hash e com o rollback pronto ao lado (seção 6 aberta em
outra aba). Se qualquer item da seção "NÃO CONTINUAR SE" ocorrer, não prossiga.

## 1. RESUMO DO OBJETIVO
Medir dados REAIS (WIP por designer, atrasos, retroativos) com o engine em
read-only absoluto. Cadeado duplo: sem `SLA_WRITE` não existe caminho de escrita;
sem `SLA_ACTIVATED_AT` não existe evento elegível. Única env temporária:
`SLA_ENGINE_ENABLED=true`. Saída da janela: produção idêntica ao estado anterior.

## 2. PRÉ-REQUISITOS
- Painel Cloudflare (`idseven-push`); console Firebase (apenas LEITURA ao final).
- Terminal com `curl` (Windows: `curl.exe`) e hash
  (Windows: `certutil -hashfile <arq> SHA256`; Linux/Mac: `sha256sum <arq>`).
- Hashes de referência:
  - V64.53 produção (`V64.53-premium-portal`): `a03f3d625ee77b844190bd6c0b5b0600ece03dfc56425f6c67b2ab09180cc001`
  - V64.54 pacote (`V64.54-sla-baseline-ready`): `a85338d22270f14f0ca8d4cc0a80cb5ded0cbcf1c8f66bdf8bdc0a5705684433`
- Anotar: HORÁRIO DE INÍCIO DA JANELA: ________  FIM: ________ (com fuso)

### 2a. O QUE NÃO PODE EXISTIR / NÃO PODE SER CRIADO
| Item | Regra |
|---|---|
| `SLA_WRITE` | **PROIBIDO CRIAR — é a única env capaz de habilitar escrita** |
| `SLA_ACTIVATED_AT` | **PROIBIDO CRIAR — segundo cadeado: sem ela, zero eventos elegíveis** |
| Outras envs/secrets (FCM_*, IMAGEKIT_*, REMINDER_*) | NÃO tocar |
| Firestore Rules | NÃO mexer |
| Android / Desktop / UI / `appConfig/flags` | NÃO mexer |
| Botões de delete (worker, envs alheias, coleções) | NÃO usar |

### 2b. O QUE NÃO DEVE SER TESTADO (disparam push REAL)
- **NÃO** testar `POST /notify-assignee`;
- **NÃO** testar `POST /notify-designer`;
- **NÃO** testar `POST /` (relay);
- **NÃO** chamar qualquer rota com payload real de notificação;
- **NÃO** usar `/cron-test` com `{"send":true}` (esse body liga envio de verdade).
A equivalência dessas rotas V64.53×V64.54 já foi provada em harness (15/15) — não há
necessidade de exercitá-las em produção.

### 2c. POR QUE `/cron-test` com `{}` é seguro (verificado no código)
`handleCronTest` inicia `opts = { dryRun: true }` e só muda para envio se o body
contiver exatamente `{"send": true}`. Dentro de `handleCronTrigger`, TODAS as vias
de envio têm a guarda `if (dryRun)` ANTES de `sendToTokens` e ANTES de
`markReminderSent`: lembrete de compromissos, lembrete de tarefas e fallback
imediato apenas registram "wouldSendTo" no relatório e fazem `continue`. Com body
`{}`: zero FCM, zero escrita. Por isso C6 permanece no checklist.

## 3. ROTEIRO PASSO A PASSO

### ANTES (pré-check + backup) — não altera nada
A1. Painel Cloudflare → Workers & Pages → `idseven-push`. Se você não tiver certeza
    absoluta de onde está clicando, PARE aqui (seção "NÃO CONTINUAR SE").
A2. Comando C1 → resposta deve conter `"version":"V64.53-premium-portal"`.
A3. Settings → Variables and Secrets → PRINT da lista. Estado esperado: **zero `SLA_*`**.
A4. BACKUP: "Edit code" → selecionar TODO o código → salvar como `worker-v6453-backup.js`
    → conferir hash (C2) = `a03f3d62…80cc001`.
A5. PACOTE: baixar `cloudflare-worker.js` do branch `desktop/local-detail-hierarchy-v2`
    (raw do GitHub) como `worker-v654.js` → conferir hash (C3) = `a85338d2…5684433`.

### ████ PONTO DE PARADA OBRIGATÓRIO ████
**PARAR AQUI E CONFIRMAR COM O USUÁRIO (você mesmo, conscientemente) ANTES DE
CLICAR EM "SAVE AND DEPLOY".** Checklist de portão:
[ ] A2 = V64.53 confirmado   [ ] A3 = zero `SLA_*` (print salvo)
[ ] A4 backup salvo com hash OK   [ ] A5 pacote com hash OK
[ ] Rollback (seção 6) aberto em outra aba   [ ] Horário de início anotado
Somente com TODOS marcados, prossiga para B1. Em dúvida: não deployar.

### DEPLOY CONTROLADO (ainda SEM env)
B1. "Edit code" → apagar conteúdo → colar `worker-v654.js` INTEIRO.
B2. "Save and deploy". (Anotar horário.)
B3. C1 → `"version":"V64.54-sla-baseline-ready"`.
B4. C4 (`/sla-dryrun`) → **403**. C5 (`/sla-reschedule-plan`) → **403**.
B5. Conferir Settings → Variables: NENHUMA variável `SLA_*` surgiu automaticamente
    (deploy de código não cria envs — a lista deve estar idêntica ao print A3). PRINT.
B6. Rotas antigas seguras: C6 (cron-test `{}` → 200 `"mode":"dry-run"`) e
    C7 (imagekit-auth → 200 com token/expire/signature).
B7. Observar 10 min de logs (Begin log stream): `[CRON]` normal a cada minuto;
    **NENHUMA linha `[SLA]`** (env não existe). PRINT.

### JANELA DE MEDIÇÃO
D1. Settings → Variables → Add **Variable** (texto, NÃO secret):
    `SLA_ENGINE_ENABLED` = `true` → Save.
D2. PRINT da lista. Checklist visual de variáveis:
    ┌─────────────────────────────────────────────┐
    │ ANTES:   zero SLA_*                         │
    │ DURANTE: SOMENTE SLA_ENGINE_ENABLED=true    │
    │ PROIBIDO: SLA_WRITE          ← conferir 2×  │
    │ PROIBIDO: SLA_ACTIVATED_AT   ← conferir 2×  │
    │ DEPOIS:  zero SLA_*                         │
    └─────────────────────────────────────────────┘
D3. Medição 1 (~10h): C8 → `run1.json`. Conferir no arquivo: `"mode":"dry-run"`,
    `"writeAllowed":false`, `"writes":0`, `"eligibleEvents":0`. Divergiu? → ABORTO.
D4. Medição 2 (~14h, ≥2h depois): C8 → `run2.json` (mesma conferência).
D5. Medição 3 (~17-18h): C8 → `run3.json` (mesma conferência).
D6. Durante toda a janela: logs sem `[SLA] erro:`; lembretes normais; nenhum push anômalo.

### DEPOIS (encerramento OBRIGATÓRIO + verificação)
E1. **REMOVER `SLA_ENGINE_ENABLED`** (obrigatório, sempre, mesmo que tudo tenha ido bem).
E2. C4 → **403** de volta. PRINT.
E3. Variables → zero `SLA_*`. PRINT.
E4. VERIFICAÇÃO FIRESTORE (console Firebase → Firestore Database → painel de coleções):
    - `slaEvents`: NÃO aparece na lista de coleções (ou, se existir de teste antigo,
      sem NENHUM doc novo com timestamp da janela);
    - `designerLocks`: idem — não existe / vazia / sem docs novos;
    - `wipLimits`: não foi criada nem alterada;
    - `adminOverrides`: não foi criada nem alterada;
    - `tasks`: abrir 2-3 tarefas ativas e conferir que NÃO surgiu campo novo
      inesperado (em especial `designerSla` — o Worker read-only não o grava e o
      app instalado 1.0.146 também não) e que nenhum valor mudou durante a janela
      sem ação de usuário (status, prazos, history sem entradas estranhas).
    PRINT da lista de coleções + de 1 task de exemplo.
E5. FCM: nenhuma notificação anômala nos celulares/Desktop da equipe na janela;
    logs do Worker sem envios fora do padrão `[CRON]`.
E6. DECISÃO DE PERMANÊNCIA (regra de encerramento):
    - Opção 1: manter V64.54 SEM env (comportamento byte-equivalente ao V64.53 —
      provado; deixa o terreno pronto para a 4.4-B);
    - Opção 2 (conservação máxima): restaurar V64.53 via seção 6 nível 2.
    Qualquer uma é aceitável; anotar a escolha no relatório.
E7. Anotar HORÁRIO DE FIM da janela.

## 4. COMANDOS PRONTOS
(Windows: `curl.exe`; hash: `certutil -hashfile <arq> SHA256`)
```
C1  curl -s https://idseven-push.agidseven.workers.dev/
C2  sha256sum worker-v6453-backup.js
C3  sha256sum worker-v654.js
C4  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://idseven-push.agidseven.workers.dev/sla-dryrun
C5  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://idseven-push.agidseven.workers.dev/sla-reschedule-plan
C6  curl -s -X POST https://idseven-push.agidseven.workers.dev/cron-test -H "Content-Type: application/json" -d "{}"
C7  curl -s -X POST https://idseven-push.agidseven.workers.dev/imagekit-auth -H "Content-Type: application/json" -d "{\"token\":\"teste\",\"expire\":9999999999}"
C8  curl -s -X POST https://idseven-push.agidseven.workers.dev/sla-dryrun > run1.json
    (2ª: > run2.json   3ª: > run3.json — salvar na mesma pasta do backup)
```

## 5. NÃO CONTINUAR SE (portões duros — qualquer um ⇒ parar/abortar)
1. Hash do backup ≠ `a03f3d62…80cc001` (produção não é o V64.53 esperado — exatamente o portão que parou a 1ª tentativa: produção evolui, conferir SEMPRE antes).
2. Hash do pacote ≠ `a85338d2…5684433` (arquivo errado/corrompido).
3. C1 inicial não responder `V64.53-premium-portal` (foi exatamente este portão que salvou a 1ª tentativa: produção evolui — conferir SEMPRE).
4. Existir QUALQUER env `SLA_*` antes da janela.
5. Você não tiver certeza de onde está clicando no painel.
6. Qualquer rota antiga falhar no smoke (C1/C6/C7) — abortar e rollback.
7. Qualquer log `[SLA]` aparecer ANTES de criar a env.
8. Qualquer `run*.json` com `writeAllowed:true`, `writes>0` ou `eligibleEvents>0`.
Critérios adicionais de aborto DURANTE a janela: doc novo em coleção SLA; campo novo
em `tasks`; push anômalo; `[SLA] erro:` recorrente; lembrete falho/duplicado;
reclamação de usuário; qualquer comportamento não previsto.

## 6. ROLLBACK (deixar aberto ANTES de iniciar)
- **Nível 1 (1 passo, sem redeploy):** Settings → Variables → remover
  `SLA_ENGINE_ENABLED` → Save → C4 deve responder 403.
- **Nível 2 (restauração total):** "Edit code" → colar `worker-v6453-backup.js`
  (hash conferido em A4) → "Save and deploy" → C1 = `V64.53-premium-portal`.

## 7. CHECKLIST FINAL (antes / durante / depois)
ANTES:   [ ] horário início anotado [ ] A2 V64.53 [ ] A3 zero SLA_* (print)
         [ ] A4 backup hash OK [ ] A5 pacote hash OK [ ] PONTO DE PARADA cumprido
DURANTE: [ ] B3 V64.54 [ ] B4 403/403 [ ] B5 zero env pós-deploy (print)
         [ ] B6 C6/C7 OK [ ] B7 10min logs limpos (print)
         [ ] D2 só SLA_ENGINE_ENABLED (print) [ ] D3-D5 run1/2/3 conferidos
DEPOIS:  [ ] E1 env removida [ ] E2 403 (print) [ ] E3 zero SLA_* (print)
         [ ] E4 Firestore conferido (prints) [ ] E5 zero push
         [ ] E6 decisão V64.54-sem-env OU V64.53 anotada [ ] E7 horário fim anotado
PROIBIDOS (conferir 2×): [ ] SLA_WRITE nunca criada [ ] SLA_ACTIVATED_AT nunca criada
         [ ] Rules intocadas [ ] Android/Desktop/UI intocados

## 8. O QUE ENVIAR DE VOLTA PARA ANÁLISE
1. Horários de início e fim (com fuso) e a decisão E6.
2. Hashes C2 (backup) e C3 (pacote).
3. Saída do C1 antes (V64.53) e depois do deploy (V64.54).
4. Saída do C4 antes da env (403) e após remover a env (403).
5. Conteúdo INTEGRAL de `run1.json`, `run2.json`, `run3.json`.
6. Prints: variáveis (A3, B5, D2, E3), coleções Firestore + task exemplo (E4),
   10 min de logs (B7).
7. Linhas `[SLA]` vistas (ou confirmação de nenhuma).
Análise: `node scripts/sla-baseline-analise.mjs run1.json run2.json run3.json`
(valida os gates automaticamente; violação ⇒ "ABORTAR") → laudo completo + calibração
de wipSoft/wipHard + proposta de `SLA_ACTIVATED_AT` para a decisão da 4.4-B.
