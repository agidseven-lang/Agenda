# F3.5.4V-H1 — Persistência/restauração segura da sessão no autostart do Windows (Desktop 1.0.213)

Base: **1.0.212** · Baseline físico aprovado / rollback imediato: **1.0.211** · Rollback adicional: **1.0.208**.

## Causa-raiz PROVADA (não presumida)
No boot, o `#login` era o **estado estático padrão** e `renderLogin()` era a **1ª instrução, incondicional**,
executada ANTES de `desktopAPI.authSelf()` (ligado à rede). No autostart do Windows (rede fria), a sessão
VÁLIDA persistida em `userData/session.json` (mode 0600, no processo main) não conseguia ser confirmada a
tempo e a tela de login já pintada permanecia visível — o usuário via "deslogado" com sessão válida.
`auth-core.self()` já estava correto: em erro de rede RESOLVE `{ok:false,error:"network"}` e **nunca** apaga
a sessão. O defeito era 100% do renderer (ordem de pintura), não do main/persistência.

## Correção (renderer-only, cirúrgica)
Máquina de estados de autenticação com **SPLASH neutro** como estado padrão:
`AUTH_INITIALIZING → AUTH_RESTORING → {AUTHENTICATED | AUTH_OFFLINE_CACHED | AUTH_UNAUTHENTICATED_CONFIRMED | AUTH_REVOKED}`.
O login SÓ aparece em **negativa REAL** (`no_session`/`expired`) ou por **escape manual**. Erro de rede
MANTÉM o splash e reintenta (backoff 3s→60s preservado da F3.5.4-C4). `main.ts`/`auth-core.ts`/preloads e a
funcionalidade 1.0.212 (quantidade personalizada de vídeos) permanecem **INTOCADOS**.

## Provas
- **Contrato estático** `f354vh1-session-persistence.test.mjs`: **40/40**.
- **Regressão delta-zero** (bateria completa): 1.0.213 = **68 OK / 30 FAIL**, conjunto de falhas **idêntico**
  ao base 1.0.212 (suites históricas com pin de versão / hermética 1.0.163 — falham igual no base, não são
  regressão). Nenhuma suite que passava no 1.0.212 falha no 1.0.213.
- **Provas reais Electron 31.3.1** (`f354vh1-electron-proof-manifest.json`): **15 cenas, 0 falhas** no app
  EMPACOTADO (renderer = mesmos bytes do pacote), com PNGs reais (`win.capturePage`) em 1x e 1.5x:
  - `ok`, `ok_autostart` (janela OCULTA, `win.isVisible()===false`), 5× "reboot" (ok): autenticam, splash some,
    **sem flash de login** (`loginRendered=false`), sessão preservada (`wp_uid` mantido).
  - `net_then_ok`: offline→ok autentica sem flash de login; sessão preservada.
  - `net_throw`: `authSelf` lança → splash PERMANECE, nunca login; sessão preservada.
  - `net_persistent`: rede sempre fria → splash+aviso persistem (≥3 `offline_cached`), NUNCA login; escape
    manual revela login **sem apagar a sessão** (`wp_uid` preservado).
  - `no_session`/`expired`: negativa real → login visível, sessão **LIMPA** (`wp_uid=null`).
  - `logout`: logout explícito → login visível, sessão LIMPA, `authLogout` chamado.

## Suites de regressão atualizadas (contrato antigo × novo — comportamento PRESERVADO)
Três suites afirmavam a ESTRUTURA de código antiga do boot/startApp/logout que a correção autorizada mudou
de propósito; foram atualizadas preservando a invariante real de cada uma (delta-zero confirmado antes e
depois via `git stash`):
- **f33L-account-anchor** — `boot: renderLogin() no arranque` (afirmava o PRÓPRIO bug) → agora afirma
  splash-first + login só em negativa real (mantendo authSelf server-side, nunca lê wp_uid).
- **f354-notifications-reliability C2a** — `startApp` ganhou o hide do splash antes de `state.user=u`; o reset
  do once-guard (`notifAttrToastSeen={}`) permanece imediatamente após — invariante preservada.
- **f354-notifications-reliability C4b** — o ramo único `expired||no_session` foi dividido em dois estados;
  ambos ainda `clearSession()+return` (negativa real PARA o retry) — invariante preservada.
- **f354i-cronograma-save-send-client (#42)** — guarda de confinamento aprimorada: conta ocorrência LÍQUIDA
  de tokens protegidos (sino/Monitor/card/notif/Card Premium/cache-bust) entre `-`/`+` do diff, em vez de
  sinalizar qualquer linha alterada que apenas CONTENHA o token (falso-positivo na linha aditiva do logout).
  Mais preciso, não mais frouxo.

## Segurança (nada proibido introduzido)
Sem senha/token em plaintext/localStorage/JSON/logs; sem login automático com credenciais; sem token
permanente; revogação (`expired`) respeitada; logout explícito preservado; observabilidade `auth.startup.*`
sanitizada (authState/networkAvailable/manualOrAutostart/appVersion/ts/resultReason — sem e-mail/nome/UID-raw/
token/refreshToken/cookies/caminhos completos).
