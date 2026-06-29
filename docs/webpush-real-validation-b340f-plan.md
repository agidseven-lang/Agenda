# Plano — Validação Web Push REAL canária (F3.3.21-B3.40F)

> **Status: PREPARAÇÃO (PLAN-PREP).** Este documento NÃO autoriza nem executa
> validação Web Push real. A execução real permanece **BLOQUEADA** até uma fase
> posterior (B3.40G review/merge → fase de execução real própria), com confirmação
> explícita dos itens pendentes abaixo.

## 1. Objetivo
Preparar o plano técnico + runner + workflow controlados para uma **futura**
validação Web Push **real end-to-end**, estritamente limitada a **1 usuário canário
e 1 dispositivo canário**, com logs sanitizados, cleanup, rollback e critérios de
parada. Nenhuma ação real ocorre nesta fase.

## 2. Estado de referência (read-only)
- `main`: `6786104da723dbd3a6c396d0798b2c44f48f9964`
- `app/main`: `92b71f21178f254258b12bb41e4d530af10cf82f`
- Hosting: `https://agenda-id-seven.web.app` (cutover client-side FCM LIVE)
- `fcm_token_server`: **OFF por padrão** (não será ativado nesta fase)
- Firestore Rules: inalteradas; **`users` read ABERTO (blocker HIGH)** — não será fechado aqui
- Gate técnico dry-run (B3.40C, run `28389941347`): GO, `structuralReadiness=true`,
  `workflowSafeForRealValidation=false`
- Decisão operacional (B3.40D): NO-GO operacional externo
- Checklist (B3.40E): preparado; owner respondeu parcialmente

## 3. Escopo da futura validação real (limites rígidos)
| Dimensão | Valor único permitido |
|---|---|
| Usuário canário | `teste.webpush@idseven.com.br` |
| Dispositivo canário | Samsung Galaxy A54 |
| Navegador | Chrome Android |
| Mensagem aprovada | `Teste técnico de notificação ID Seven.` |
| Janela de teste | 2026-06-29T16:00:00-03:00 (America/Fortaleza) |
| Flag | `fcm_token_server` **OFF** (caminho legacy). ON = fase separada própria |
| Responsável (operar/confirmar) | Miercohévisk |

A base inteira **não** será notificada. Nenhum usuário real será usado.

## 4. Dados operacionais fornecidos pelo owner (B3.40E → B3.40F)
- **Consentimento explícito:** SIM (preparar validação Web Push real controlada).
- **Usuário canário:** `teste.webpush@idseven.com.br`.
- **Dispositivo Android canário:** Samsung Galaxy A54.
- **Navegador Android:** Chrome Android.
- **Janela de teste:** 29/06/2026 às 16h (America/Fortaleza).
- **Mensagem aprovada:** `Teste técnico de notificação ID Seven.`.
- **Responsável por operar e confirmar:** Miercohévisk.

## 5. Itens PENDENTES — bloqueiam a execução real
A execução real **não** pode ocorrer até que TODOS sejam CONFIRMADOS:
1. Versão do Android do Galaxy A54.
2. Confirmação explícita da permissão manual de notificação no aparelho.
3. Rota segura de envio FCM real (ex.: console Firebase manual OU workflow dedicado com segredo, sem impressão).
4. Confirmação de credencial/segredo de envio disponível **sem impressão**.
5. Critério final de cleanup do token canário.
6. Critérios detalhados de sucesso: foreground / background / app fechado / lockscreen.
7. Critério de parada operacional.
8. Responsável por aprovar o cleanup final (se diferente de Miercohévisk).

## 6. Sequência de fases (após este PR)
1. **B3.40G** — review/merge deste plano/runner/workflow em `main` (sem executar).
2. **Fase futura (separada, gate próprio)** — somente quando os 8 itens pendentes
   forem CONFIRMADOS: execução real canária com flags/inputs explícitos
   (`webpush_real=true` etc.), consentimento por execução, escopo 1/1, cleanup e
   auditoria. Esta fase NÃO está autorizada aqui.

## 7. Invariantes de segurança (todas as fases até a execução real)
- `webpush_real=false`, `fcm_token_server=false`, `allow_get_token_real=false`,
  `allow_endpoint_real=false`, `allow_push_send_real=false`,
  `allow_firestore_write=false`, `hosting_publish=false`, `deploy=false` — **default**.
- Sem Hosting publish, sem deploy, sem `gcloud secrets versions access`.
- Sem impressão de VAPID privada / token FCM / sessão / senha / hash / salt.
- `users` read permanece ABERTO; Firestore Rules inalteradas.
- Rollback: `fcm_token_server` OFF por padrão + cutover idempotente; cleanup do token canário.

## 8. Pré-requisitos técnicos (documentados pelo runner)
`browserRealRequired`, `serviceWorkerRealRequired`, `notificationPermissionRealRequired`,
`getTokenRealRequired`, `fcmTokenRealRequired`, `canaryUserRequired`,
`realAndroidDeviceRequired`, `lockscreenValidationRequired`, `manualConsentRequired`,
`cleanupRequired` — todos `true`; `workflowSafeForRealValidation=false` até a fase de execução real.

## 9. Resultado desta fase
O runner emite **PLAN_READY** (scaffold pronto e seguro; execução real bloqueada,
itens pendentes listados) ou **PLAN_BLOCKED** (flag real ligada / refs/canário
divergentes). Em nenhum caso executa Web Push real.
