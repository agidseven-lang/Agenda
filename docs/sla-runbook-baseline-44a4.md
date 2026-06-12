# RUNBOOK HUMANO — BASELINE REAL READ-ONLY (FASE 4.4-A4)
Worker `idseven-push` · pacote V64.7-sla-baseline-ready · executor: humano (painel Cloudflare)
Versão canônica deste runbook. Nada aqui foi executado; este documento é o roteiro.

## 1. RESUMO DO OBJETIVO
Medir dados REAIS (WIP por designer, atrasos, volume de retroativos) com o Designer
SLA Engine em modo read-only absoluto, numa janela controlada, e sair da janela com
produção idêntica ao estado anterior. Nenhuma escrita, nenhum push, nenhum bloqueio,
nenhuma UI. Duração total estimada: 1 dia de trabalho (3 medições) ou, no mínimo,
3 medições com ≥2h de intervalo.

## 2. PRÉ-REQUISITOS
- Acesso ao painel Cloudflare da conta que hospeda o Worker `idseven-push`.
- Acesso ao console do Firebase (apenas para CONFERIR coleções ao final — não mexer).
- Um terminal com `curl` (Windows: usar `curl.exe`; macOS/Linux: `curl`).
- Ferramenta de hash:
  - Windows (PowerShell): `certutil -hashfile <arquivo> SHA256`
  - macOS/Linux: `sha256sum <arquivo>` (macOS: `shasum -a 256 <arquivo>`)
- Hashes de referência (NÃO prosseguir se não baterem):
  - V64.5 produção atual: `58264a3da232348269b1699a9d80e39e4e3db1477ce0df2ec092df62fb3e661f`
  - V64.7 pacote:        `b17a5f3701b3d074b3d1244f8b5f89749967aa423e6e7c64634b9a04b8cf7acc`

### O QUE É TERMINANTEMENTE PROIBIDO NESTA JANELA
- **NÃO criar `SLA_WRITE`** (é a ÚNICA env capaz de habilitar escrita — não deve existir).
- **NÃO criar `SLA_ACTIVATED_AT`** (sem ela, zero eventos elegíveis — é o segundo cadeado).
- NÃO criar/alterar qualquer outra variável ou secret (FCM_*, IMAGEKIT_*, REMINDER_* ficam como estão).
- NÃO mexer em Firestore Rules.
- NÃO mexer em Android, Desktop, UI, builds, flags `appConfig/flags`.
- NÃO usar o botão de "delete" em nada.
- Única env permitida (temporária): `SLA_ENGINE_ENABLED = true`.

## 3. ROTEIRO PASSO A PASSO

### ANTES (pré-check + backup)
A1. Abrir painel Cloudflare → Workers & Pages → `idseven-push`.
A2. Identificar produção: aba "Deployments" deve mostrar o deployment ativo;
    em um terminal, rodar o comando C1 (abaixo). A resposta deve conter
    `"version":"V64.5-designer-notify"`. Se mostrar OUTRA versão, **PARAR** e me reportar.
A3. Conferir variáveis atuais: Settings → Variables and Secrets. Anotar (print) a lista.
    NÃO deve existir nenhuma `SLA_*`. Se existir, **PARAR** e me reportar.
A4. **Backup**: abrir "Edit code" (Quick Edit), selecionar TODO o conteúdo do editor,
    colar num arquivo local chamado `worker-v645-backup.js`. Conferir o hash (comando C2):
    deve ser `58264a3d…fb3e661f`. Se não bater, **PARAR** (o que está em produção não é
    o V64.5 esperado) e me reportar o hash obtido.
A5. **Obter o pacote V64.7**: arquivo `cloudflare-worker.js` do branch
    `desktop/local-detail-hierarchy-v2` (commit `da3c615` ou posterior do mesmo branch).
    Caminho direto (logado no GitHub):
    `https://raw.githubusercontent.com/agidseven-lang/Agenda/desktop/local-detail-hierarchy-v2/cloudflare-worker.js`
    Salvar como `worker-v647.js` e conferir o hash (comando C3): deve ser
    `b17a5f37…b8cf7acc`. Se não bater, **PARAR** e me reportar.

### DEPLOY CONTROLADO (sem env ainda)
B1. No "Edit code", apagar o conteúdo e colar o conteúdo INTEGRAL de `worker-v647.js`.
B2. "Save and deploy".
B3. Smoke imediato (≤1 min): comando C1 → deve responder `"version":"V64.7-sla-baseline-ready"`.
B4. Comando C4 (`/sla-dryrun`) → deve responder **HTTP 403** com
    `"SLA engine desabilitado"`. (Prova de que nada roda sem env.)
B5. Comando C5 (`/sla-reschedule-plan`) → também **403**.
B6. Rotas antigas essenciais: comandos C6 (cron-test dry-run → 200 com `"dryRun":true`)
    e C7 (imagekit-auth → 200 com `token/expire/signature`).
    OBS: NÃO testar `/notify-assignee`, `/notify-designer` nem `POST /` (relay) com dados
    reais — elas ENVIAM push de verdade. A equivalência delas já foi provada em harness.
B7. Observar 10 minutos: painel → Logs (Begin log stream). Os lembretes do cron devem
    continuar aparecendo normalmente ("[CRON] … candidatos"). NENHUMA linha `[SLA]` deve
    aparecer (env ainda não existe). Tirar print.

### JANELA DE MEDIÇÃO
D1. Settings → Variables and Secrets → Add → **Variable** (texto simples, NÃO secret):
    Nome: `SLA_ENGINE_ENABLED`  Valor: `true` → Save (redeploy automático da config).
D2. Conferir na lista que ela é a ÚNICA `SLA_*` (print da tela). `SLA_WRITE` e
    `SLA_ACTIVATED_AT` NÃO devem existir.
D3. Medição 1 (ex.: ~10h): comando C8 → salva `run1.json`. Abrir o arquivo e conferir
    rapidamente: `"mode":"dry-run"`, `"writeAllowed":false`, `"writes":0`,
    `"eligibleEvents":0`. Qualquer coisa diferente ⇒ ABORTO (seção 5).
D4. Medição 2 (ex.: ~14h, ≥2h depois): comando C8 → `run2.json` (mesma conferência).
D5. Medição 3 (ex.: ~17-18h): comando C8 → `run3.json` (mesma conferência).
D6. Durante a janela, qualquer linha `[SLA] erro:` recorrente nos logs ⇒ ABORTO.

### DEPOIS (encerramento + verificação)
E1. Settings → Variables → **REMOVER** `SLA_ENGINE_ENABLED` → Save.
E2. Comando C4 → deve voltar a **403**. Print.
E3. Conferir lista de variáveis: nenhuma `SLA_*` restante. Print.
E4. Firebase console → Firestore → confirmar que NÃO existem as coleções
    `slaEvents`, `designerLocks`, `wipLimits`, `adminOverrides` (se a UI mostrar a lista
    de coleções sem elas, está provado). Print.
E5. Abrir 2-3 tarefas no app (ou no console, coleção `tasks`): nenhum campo `designerSla`
    novo deve ter surgido durante a janela (o Worker read-only não escreve; o app
    instalado 1.0.146 também não grava esse campo).
E6. FCM: nenhuma notificação anômala recebida nos celulares da equipe durante a janela
    (o engine desta fase não possui caminho de envio; logs sem chamadas FCM extras).
E7. Comando C1 → produção segue no V64.7 estável (ou, se preferir máxima conservação,
    restaurar V64.5 — seção 6 — até a decisão da 4.4-B; AMBOS são aceitáveis, pois o
    V64.7 sem env é byte-equivalente em comportamento).

## 4. COMANDOS PRONTOS (copiar/colar)
Windows: substituir `curl` por `curl.exe`; `sha256sum` por `certutil -hashfile <arq> SHA256`.

C1  status/versão:
    curl -s https://idseven-push.agidseven.workers.dev/
C2  hash do backup:
    sha256sum worker-v645-backup.js
C3  hash do pacote:
    sha256sum worker-v647.js
C4  rota nova (esperado 403 sem env; 200 dry-run com env):
    curl -s -o /dev/null -w "%{http_code}\n" -X POST https://idseven-push.agidseven.workers.dev/sla-dryrun
C5  rota nova 2 (esperado 403 sem env):
    curl -s -o /dev/null -w "%{http_code}\n" -X POST https://idseven-push.agidseven.workers.dev/sla-reschedule-plan
C6  cron dry-run (rota antiga; NÃO envia push):
    curl -s -X POST https://idseven-push.agidseven.workers.dev/cron-test -H "Content-Type: application/json" -d "{}"
C7  imagekit (rota antiga; só assinatura):
    curl -s -X POST https://idseven-push.agidseven.workers.dev/imagekit-auth -H "Content-Type: application/json" -d "{\"token\":\"teste\",\"expire\":9999999999}"
C8  medição do baseline (salvar com nome exato):
    curl -s -X POST https://idseven-push.agidseven.workers.dev/sla-dryrun > run1.json
    (2ª execução: > run2.json ; 3ª execução: > run3.json)

## 5. CRITÉRIOS DE ABORTO IMEDIATO (qualquer um ⇒ seção 6, nível 1; persistindo ⇒ nível 2)
1. `run*.json` com `writeAllowed:true` OU `writes>0` OU `eligibleEvents>0`.
2. Surgimento de QUALQUER doc/coleção `slaEvents`/`designerLocks`/`wipLimits`/`adminOverrides`.
3. Qualquer campo alterado em `tasks` durante a janela.
4. Qualquer push/notificação anômala (celular ou Desktop).
5. Linhas `[SLA] erro:` recorrentes no log.
6. Rota antiga respondendo diferente do esperado (C1/C6/C7) ou lembrete não entregue/duplicado.
7. Reclamação de usuário ou QUALQUER comportamento não previsto.

## 6. ROLLBACK
Nível 1 (1 passo, sem redeploy): Settings → Variables → remover `SLA_ENGINE_ENABLED`
  → Save → C4 deve responder 403. Engine morto; produção comporta-se como V64.5.
Nível 2 (restauração total): "Edit code" → colar o conteúdo de `worker-v645-backup.js`
  (hash conferido em A4) → "Save and deploy" → C1 deve responder
  `"version":"V64.5-designer-notify"`.

## 7. CHECKLIST FINAL
ANTES:   [ ] A2 versão V64.5 confirmada  [ ] A3 zero env SLA_* (print)
         [ ] A4 backup salvo + hash 58264a3d… OK  [ ] A5 pacote + hash b17a5f37… OK
DURANTE: [ ] B3 GET / = V64.7  [ ] B4 /sla-dryrun 403  [ ] B5 reschedule 403
         [ ] B6 C6/C7 OK  [ ] B7 10min logs limpos (print)
         [ ] D2 só SLA_ENGINE_ENABLED (print)  [ ] D3-D5 run1/2/3.json salvos e conferidos
DEPOIS:  [ ] E1 env removida  [ ] E2 403 de volta (print)  [ ] E3 zero env SLA_* (print)
         [ ] E4 coleções SLA inexistentes (print)  [ ] E5 tasks sem designerSla novo
         [ ] E6 zero push anômalo  [ ] E7 C1 estável
PROIBIDOS (conferir 2x): [ ] SLA_WRITE NUNCA criada  [ ] SLA_ACTIVATED_AT NUNCA criada
         [ ] Rules intocadas  [ ] Android/Desktop/UI intocados

## 8. O QUE ENVIAR DE VOLTA PARA ANÁLISE
1. Horário de início e fim da janela (com fuso).
2. Hash do backup (C2) e hash do pacote aplicado (C3).
3. Saída do C1 ANTES (V64.5) e DEPOIS do deploy (V64.7).
4. Saída do C4 ANTES da env (403) e APÓS remover a env (403).
5. Os três arquivos `run1.json`, `run2.json`, `run3.json` (conteúdo integral).
6. Prints: lista de variáveis (D2 e E3), coleções do Firestore (E4), 10min de logs (B7).
7. Qualquer linha de erro `[SLA]` vista (ou confirmação de nenhuma).
Análise automática: `node scripts/sla-baseline-analise.mjs run1.json run2.json run3.json`
(valida os gates sozinho e gera o relatório 10-18; eu executo e devolvo o laudo completo).
