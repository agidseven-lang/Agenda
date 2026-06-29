# Plano — Execução REAL Web Push canária: PREP (F3.3.21-B3.40J)

> **Status: PREP da execução real.** Este documento e o runner/workflow associados
> **NÃO executam Web Push real**. Eles apenas preparam a execução real controlada e
> definem os **gates finais**. A execução real só ocorrerá em fase posterior,
> explicitamente autorizada, e **somente** quando o gate de prontidão estiver
> 100% verde (incluindo a versão do Android, hoje **PENDENTE**).

## 1. Objetivo
Preparar a execução real Web Push **estritamente canária** (1 usuário / 1 dispositivo),
com gates finais, logs sanitizados, cleanup e critério de parada. Nenhuma ação real
nesta fase.

## 2. Estado de referência
- `main`: `79b87feb316dfc810d69d2b72f8689eee8cef1e9`
- `app/main`: `92b71f21178f254258b12bb41e4d530af10cf82f`
- `fcm_token_server`: **OFF** (caminho legacy; ON seria fase separada)
- `users` read: **ABERTO (blocker HIGH)** — não será fechado
- Plano base (B3.40F) em `main`; gate técnico B3.40C GO; B3.40H freeze GO

## 3. Escopo travado (1 / 1)
| Dimensão | Valor |
|---|---|
| Usuário canário | `teste.webpush@idseven.com.br` (mascarado em logs) |
| Dispositivo | Samsung Galaxy A54 |
| **Versão Android** | **PENDENTE — owner ainda não preencheu (`Android ___.`)** |
| Navegador | Chrome Android |
| Mensagem | `Teste técnico de notificação ID Seven.` |
| Janela | 2026-06-29T16:00:00-03:00 (America/Fortaleza) |
| Flag | `fcm_token_server` **OFF** |

## 4. Itens pré-execução — status (B3.40I)
**Confirmados (7/8):**
1. Permissão manual de notificação: o operador concederá manualmente no Chrome Android.
2. Rota de envio: **workflow dedicado/controlado com segredo**, sem imprimir token/segredo/sessão/senha/hash/salt.
3. Credencial/segredo: apenas via **secret seguro GitHub/GCP**, sem impressão e sem `gcloud secrets versions access`.
4. Cleanup: `removeMyFcmToken` (senão fluxo legacy documentado); remover o token do canário ao final.
5. Critérios de sucesso: **foreground** (app em 1º plano → notificação/evento recebido e registrado), **background** (Chrome em 2º plano → notificação no Android), **app fechado** (entregue via SW/FCM → notificação no Android), **lockscreen** (A54 bloqueado → notificação na tela de bloqueio).
6. Critério de parada (abortar imediatamente): tentativa de >1 usuário, >1 dispositivo, usuário real não-canário, impressão de token/segredo/sessão/senha/hash/salt, Firestore write inesperado, erro de permissão, endpoint fora do escopo, ou qualquer indício de envio à base inteira.
7. Aprovador do cleanup final: **Miercohévisk**.

**PENDENTE (1/8) — BLOQUEANTE:**
8. **Versão do Android do Galaxy A54** — campo ainda em branco (`Android ___.`). Enquanto não for preenchido com um valor real (ex.: Android 13/14/15), o runner emite **REAL_RUN_BLOCKED** e a execução real é impedida.

## 5. Gates finais (todos obrigatórios antes da execução real)
- `confirm_real_run` = token explícito da fase de execução (não desta prep).
- `android_version` **não vazio e não placeholder** (gate bloqueante atual).
- Escopo 1 usuário / 1 dispositivo travado; canário fixo.
- Flags reais (`webpush_real`, `allow_get_token_real`, `allow_endpoint_real`, `allow_push_send_real`, `allow_firestore_write`, `fcm_token_server`, `hosting_publish`) **OFF nesta prep**; só habilitáveis em fase posterior com autorização própria.
- Logs sanitizados; nenhuma impressão de segredo/token.
- Cleanup do token + aprovação de Miercohévisk.
- Critério de parada armado.

## 6. Sequência de fases (após este PR)
1. **B3.40K** — review/merge desta prep em `main` (sem executar).
2. **Fase futura de execução real** (separada, autorização própria) — só com `android_version` preenchida e gate de prontidão 100% verde; escopo 1/1; secret de envio; cleanup; auditoria.

## 7. Invariantes de segurança (até a execução real)
Sem Web Push real, sem token FCM real, sem endpoint real, sem login real, sem
Firestore write, sem Hosting/deploy, sem `gcloud secrets versions access`, sem
impressão de VAPID privada/token/sessão/senha/hash/salt. `users` read ABERTO;
Rules inalteradas; `fcm_token_server` OFF.

## 8. Resultado desta fase
O runner emite **REAL_RUN_PREP_READY** (todos os 8 itens confirmados, incl.
`android_version` válida; execução real ainda bloqueada por flags/fase) ou
**REAL_RUN_BLOCKED** (versão pendente / flag real / refs/canário divergentes).
Hoje, com a versão em branco, o resultado é **REAL_RUN_BLOCKED**.
