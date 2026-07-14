# ROLLBACK-PLAN — F3.3.73I6C5 (Agenda C3A: Desktop 1.0.162 + Android)

Plano de reversão caso algo regrida após uma eventual distribuição controlada (C6).
**Nada aqui é executado na fase C5** — é procedimento documentado para o owner/pipeline autorizado.
Observação: este é o **primeiro** pacote da Agenda compartilhada; "rollback" = voltar ao **último build interno aprovado**
anterior, não a um produto de loja pré-existente.

---

## 1) Desktop rollback

**Sintoma-gatilho:** instalador 1.0.162 apresenta regressão em campo.

**Ação:**
1. Parar de distribuir o `Agenda-ID-Seven-Desktop-1.0.162-x64.exe`.
2. Redistribuir o instalador **anterior aprovado (1.0.161)** — build da fase C2 (run `29346309326`).
   - Como não há servidor de auto-update, o rollback é por **reinstalação**: usuário fecha o app pela bandeja ("Sair"), desinstala 1.0.162 e instala 1.0.161.
3. Confirmar o SHA-256 do instalador 1.0.161 a partir do `VERSAO-DESKTOP.txt` do run `29346309326` antes de redistribuir (owner conferir — não reproduzido aqui de memória).

**Reversibilidade:** total (troca de instalador). Dados na nuvem (Firestore) não são afetados pela versão do cliente.

---

## 2) Android rollback

**Sintoma-gatilho:** APK C3A apresenta regressão em campo.

**Ação:**
1. Parar de distribuir o `app-debug.apk` (C3A, run `29354162243`, `3a6162f`).
2. Re-sideload do **APK aprovado anterior** — build da fase C3 (run `29350963196`, commit `e2ca03f`).
   - `applicationId` é o mesmo (`br.com.idseven.agenda.nativebeta`) e ambos são **debug** (mesmo esquema de assinatura de debug) → instalação por cima é possível em aparelhos de teste; se o Android reclamar de assinatura, desinstalar e reinstalar.
3. Confirmar o SHA-256 do APK C3 do run `29350963196` antes de redistribuir (owner conferir).

**Reversibilidade:** total (troca de APK). Nenhum dado real é alterado pela versão do cliente.

> Nota: se em C6 for gerada uma build **release** (cert `idseven-test.keystore`), o rollback entre
> release↔debug pode exigir **desinstalar** antes de reinstalar (assinaturas diferentes).

---

## 3) Functions rollback (backend)

O único componente de backend novo do C3A é a function **`onEventDeleted`**. Lifecycle (create/update)
vem do C1 e **não muda** aqui.

**Rollback cirúrgico (remover apenas a notificação de exclusão):**
```
firebase functions:delete onEventDeleted --project agenda-id-seven --force
```
- Efeito: para de enviar a notificação "excluiu definitivamente"; a exclusão física do documento (feita pelo cliente) **continua funcionando**; `onEventCreated`/`onEventUpdated` seguem intactos (C1).

**Rollback amplo (voltar a base anterior de Functions), se necessário:**
- Re-deploy da fonte de Functions do estado pré-C3A (`onEventCreated` + `onEventUpdated` do C1) via workflow pinado equivalente, com alvo `--only functions:onEventCreated,functions:onEventUpdated`. **Nunca** alvo total; nunca hosting/rules.

**Requer:** credencial de deploy (Service Account em secret da CI) — executado por workflow autorizado, **não** manualmente com secret em claro. **Fora do escopo da C5.**

---

## 4) O que NÃO faz parte do rollback

- Não há rollback de **Rules/Hosting/Worker** porque **nada** disso foi alterado nesta linha de trabalho.
- Não há alteração de dados reais do Firestore a reverter (cliente só faz operações normais de usuário).
