# Plano de implementação — Web Push REAL send-once canário (F3.3.21-B3.40M)

> **Status: IMPLEMENTATION-PREP.** Este PR **não executa** Web Push real. Cria o
> mecanismo que faltou na B3.40M (workflow + runner de envio único, gated) e o
> runbook humano. A execução real só ocorrerá em fase posterior explicitamente
> autorizada (B3.40N review/merge → fase de execução real).

## 1. Por que a B3.40M foi NO-GO
Os workflows webpush existentes eram apenas **scaffold/gate/prep** (validação
estrutural/readiness). **Nenhum** fazia getToken real, login, envio FCM real ou
cleanup. Além disso, a parte física depende do **operador no Samsung Galaxy A54**.
Este PR resolve a lacuna do mecanismo automatizável (envio único seguro) e
documenta a parte humana.

## 2. Estado de referência
- `main`: `4111d45021ac7ae0702bb130ec7007c16d171c4f`
- `app/main`: `92b71f21178f254258b12bb41e4d530af10cf82f`
- `fcm_token_server`: **OFF** (não ativado) · `users` read: **ABERTO** (não fechado)
- B3.40L: GO (8/8, Android 14, `REAL_RUN_PREP_READY`)

## 3. Escopo travado (1 / 1)
Usuário `teste.webpush@idseven.com.br` · dispositivo Samsung Galaxy A54 · Android 14 ·
Chrome Android · mensagem `Teste técnico de notificação ID Seven.` · janela
2026-06-29T16:00:00-03:00 (America/Fortaleza) · responsável Miercohévisk.

## 4. Componentes criados
1. **Runner** `scripts/worker-ops/f3321-b340m-webpush-real-send-once.e2e.mjs`
   - **PREP/dry-run (padrão):** valida plano/inputs/escopo 1/1; sem rede/endpoint/push/segredo/Firestore/token/login.
   - **FUTURE_REAL_SEND (gated, não executado aqui):** envia **exatamente 1** push para **1** token canário via FCM v1; aborta antes de qualquer rede se faltar `DRY_RUN=false` + `allow_push_send_real=true` + `confirm_real_send` + escopo 1/1 + canário + token + secret + cleanup.
2. **Workflow** `.github/workflows/auth-webpush-real-send-once.yml`
   - `workflow_dispatch` only; `permissions: contents: read`; defaults seguros; recusa confirm/refs/canário/android/escopo inválidos, `hosting_publish=true`, `fcm_token_server=true`; exige secret presente para qualquer execução real futura.
3. **Runbook do operador** `docs/webpush-real-validation-b340m-operator-runbook.md` (passos físicos no A54 por Miercohévisk).

## 5. Como o mecanismo resolve o NO-GO da B3.40M
Agora **existe** um runner/workflow capaz de, em fase posterior autorizada, enviar
**1** push real ao token canário — com escopo 1/1 imposto em código, secret sem
impressão, cleanup obrigatório e parada imediata. A parte física (permissão,
fg/bg/app-fechado/lockscreen, confirmação visual) é coberta pelo runbook humano.

## 6. Limite 1 usuário / 1 dispositivo
- `max_targets`/`max_devices` **fixos em 1**; workflow recusa ≠1; runner aborta ≠1.
- Envio real é para **1 token** específico (`CANARY_FCM_TOKEN`), nunca query ampla.
- Nenhuma consulta a coleção de usuários; sem base-wide.

## 7. Mascaramento de segredos/tokens
- Runner **nunca** imprime token FCM, VAPID privada, sessão, senha, hash, salt ou
  segredo. Reporta apenas presença booleana (`canaryTokenProvided`,
  `sendBearerProvided`) e o **status HTTP** do envio (sem corpo).
- E-mail do canário mascarado (`***@dominio`).
- Segredos (`FCM_SEND_BEARER`, `CANARY_FCM_TOKEN`) vêm de `secrets.*` e são
  consumidos **só** no caminho real gated.

## 8. Cleanup
Após o envio real (fase futura), o token canário deve ser removido via
`removeMyFcmToken` (sessão do canário) ou fluxo legacy documentado. O runner exige
`allow_cleanup` para autorizar o caminho real; o runbook conclui com a remoção +
confirmação por Miercohévisk.

## 9. Critério de parada (imediato)
>1 usuário, >1 dispositivo, usuário não-canário, token/segredo/sessão/senha/hash/salt
em log, Firestore write inesperado, erro de permissão, endpoint fora do escopo,
indício de base-wide, tentativa de ligar `fcm_token_server`, tentativa de fechar
`users` read, ou Hosting/deploy → **parar**.

## 10. Sequência de fases
1. **B3.40N** — review/merge deste PR (sem executar).
2. **Fase de execução real** (separada, autorizada): configurar secret de envio,
   operador no A54, dry-run final, então `dry_run=false`+`allow_push_send_real=true`
   +`confirm_real_send`+`allow_cleanup` → **1** envio real → validações → cleanup.

## 11. Invariantes desta fase
Sem execução real, sem Web Push real, sem token FCM real, sem endpoint real, sem
Firestore write, sem login, sem segredo acessado/impresso, sem Hosting/deploy,
`fcm_token_server` OFF, `users` read ABERTO.
