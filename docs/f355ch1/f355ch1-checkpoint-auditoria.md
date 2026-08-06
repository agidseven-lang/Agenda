# F3.5.5C-H1 — CHECKPOINT DA AUDITORIA (P0: restauração automática de sessão no boot do Windows)

Fase: hotfix P0 autorizado pelo owner — Desktop **1.0.221**.
Base auditada: **v1.0.220** (`2d003adaeeec00499e95a9eac5fe01f48859e4ed`).
Baseline física/rollback: **v1.0.218** (`1a945159dd563eba5c80657427519d0f22b4b673`); rollback adicional: **v1.0.216** (`e509f43ae8f3130a9922791f89db0ba29aa7a410`).
Branch: `desktop/f355c-h1-session-restore-boot-hotfix-1.0.221`.

A auditoria foi executada em modo **somente leitura, antes de qualquer edição**, por 8 agentes paralelos
(A1 máquina de estados do renderer; A2 ordem de execução/DOM; A3 armazenamento/ciclo de vida;
A4 diff 1.0.218→1.0.219; A5 diff 1.0.219→1.0.220; A6 identidade/instalador/partição;
A7 contrato real do backend; A8 observabilidade/evidência de usuários), cobrindo os blocos A–F
(100 itens) do mandato. Nenhuma das 23 hipóteses foi presumida: cada uma foi confirmada ou refutada
com diff, hash ou leitura de código.

---

## 1. Sintoma (evidência do owner)

Após reiniciar o Windows, a Desktop 1.0.220 abriu **direto na tela de login**, sem logout voluntário.
Comportamento esperado: restaurar a sessão automaticamente (como um app profissional) e só exigir
login com negativa real.

## 2. NÃO é regressão de código 218→220 (provado por diff)

- **1.0.218→1.0.219 (A4)**: 8 hunks em `desktop/src/renderer/index.html`, todos da F3.5.5B
  (CSS/modal de card premium). Zero hits para 16 padrões de auth. `desktop/src/main` e
  `desktop/src/preload` **byte-idênticos** (mesmos blob hashes).
- **1.0.219→1.0.220 (A5)**: único arquivo alterado em `desktop/src` é `renderer/index.html`
  (+785 linhas, editor rico F3.5.5C). Zero hits de protocolo de auth no diff; a máquina de estados
  F3.5.4V-H1 fica após o último hunk e está intocada; `_rteWireGlobal()` roda sob `try/catch` e não
  toca DOM/desktopAPI no registro.
- **Identidade/instalador/partição (A6)**: `electron-builder.yml` **byte-idêntico nas 3 versões**
  (sha256 `851a1326eec0…`): appId `br.com.idseven.agenda.desktop`, productName
  "Agenda ID Seven Desktop", `perMachine:false`, `deleteAppDataOnUninstall:false`;
  `build/installer.nsh` byte-idêntico (`3dcd45f207ae…`), nunca toca AppData. **Não existe**
  `setPath`, `fromPartition` nem `persist:` em nenhuma das 3 versões — hipóteses de troca de
  appId/userData/partição/instalador **REFUTADAS**.

Conclusão: os defeitos são **latentes** — presentes, byte-idênticos, em 218/219/220 — no
`desktop/src/main/auth-core.ts` (congelado desde a era F3.3.56-G2) e no boot do renderer.

## 3. Causa-raiz (defeitos provados no código da 1.0.220)

Arquitetura real: a sessão do Desktop é **server-session própria** (não persistência do cliente
Firebase): token em memória do main + `userData/session.json` (0600), validado via
`getUserSelf` (Cloud Run). O renderer confia 100% na classificação do main.

Defeitos (todos com linha citada na 1.0.220):

- **D1 — expiração decidida LOCALMENTE com wipe destrutivo** (`auth-core.ts` `self()` linha 125):
  `if (!valid()) { if (mem) wipe(); return {error:"no_session"}; }`. `valid()` exige
  `expiresAt > now+30s`. Relógio adiantado no boot (pré-NTP/CMOS/resume) **ou** TTL local vencido
  ⇒ apaga `session.json` **sem consultar o servidor** ⇒ `no_session` ⇒ tela de login.
  Agravante: se o login não trouxe `expiresAt` utilizável, o fallback local é de **apenas 6h**
  (`FALLBACK_TTL_MS`) — qualquer boot no dia seguinte cai neste caminho.
- **D2 — QUALQUER HTTP 401 apaga a sessão** (linha 131): `if (r.status===401) { wipe(); return
  {error:"expired"}; }` — sem exigir o contrato JSON e sem confirmação. Um 401 transitório de
  borda/proxy/portal cativo durante o boot (rede subindo) apagava sessão boa. Os demais endpoints
  do mesmo arquivo já exigiam contrato (`error==="unauthorized"`), o `self()` não.
- **D3 — leitura única do disco** (`load()` chamado 1× no start do processo): falha transitória de
  leitura no boot (antivírus/disco) deixa `mem=null` para a vida inteira do processo ⇒ `no_session`.
- **D4 — corrida da ponte no autostart**: `no_bridge` revelava login **imediatamente** se
  `desktopAPI.authSelf` ainda não existisse quando o boot rodou (preload atrasado no autostart).
- **D5 — deadlock offline do gstatic** (A2): os únicos statements de topo não protegidos do script
  são `firebase.initializeApp`/`firebase.firestore()`, que dependem dos scripts remotos do gstatic;
  sem rede no autostart o script morre e o splash congela para sempre (sintoma vizinho do P0:
  boot sem sessão utilizável).

O que já estava correto (preservado): erro de rede/5xx/timeout mantém splash + retry infinito
3s→60s (nunca vira logout); estado estático do DOM é seguro (splash visível, `#login` hidden).

## 4. Contrato real do servidor (A7 — mapeado ponta a ponta)

- `getUserSelf` responde **uniformemente** `401 {ok:false, error:"invalid_session"}` para QUALQUER
  falha de sessão (expirada, assinatura inválida, malformada, sem scope). O servidor **nunca**
  envia `expired` nem `no_session` — `no_session` é 100% local; `expired` é tradução do cliente.
- Na linhagem de backend presente nos worktrees deste repositório (`functions/index.js`,
  idêntica entre as cópias): token HMAC stateless com `exp = login + 24h`
  (`AUTH_SESSION_TTL_MS`), **sem endpoint de refresh**; o "sliding" local só ajusta uma dica —
  não o `exp` assinado. **Limitação declarada**: o código realmente implantado no Cloud Run
  (`*-de36pi7vza-uc.a.run.app`) **não está neste repositório** — não é possível afirmar daqui o TTL
  vigente em produção. A evidência empírica (sessões físicas do owner persistiram semanas entre
  1.0.213→1.0.218) sugere TTL implantado maior que 24h, mas isso não é prova.
- Consequência honesta: se o servidor implantado enforçar TTL curto, o boot após esse TTL cairá
  **legitimamente** no login (revogação real confirmada) — nenhum fix de cliente pode nem deve
  contornar isso (REGRA MÁXIMA: não simular usuário autenticado, não contornar a autenticação).
  Recomendação registrada para fase futura de backend: renovação/reemissão de token (fora do
  escopo deste hotfix Desktop).
- Riscos adicionais mapeados: rotação/ausência do `AUTH_SESSION_SECRET` produz o mesmo 401 para
  todos (indistinguível de expiração); a revogação server-side (F4.3C2) nunca foi implantada.

## 5. Outros usuários — análise com evidência real (A8)

**Declaração expressa: não existe evidência histórica suficiente** para produzir a tabela
[usuário × resultado da restauração], e nada será inventado. Motivo provado: a observabilidade de
auth é **100% local** — `_authObs` → IPC `diag-log` → `fs.appendFileSync` em
`userData/idseven-notif-diag.log` (`%APPDATA%\Agenda ID Seven Desktop\idseven-notif-diag.log`),
sem envio de rede e sem Firestore. As telemetrias remotas existentes (notifLog dormente,
waPreviewDiagnostics, clientPortalFirstViewedAt) **não** registram login/restore/logout.
Caminho de evidência real disponível ao owner: coletar o arquivo local de cada máquina — os novos
códigos de motivo desta fase (`authcore.self.reload`, `authcore.self.401_opaque`,
`authcore.self.revoke_unconfirmed`, `authcore.wipe.reason`) permitem identificar o gatilho exato
por máquina durante a validação física.

## 6. Correção (cirúrgica; servidor = única autoridade de expiração/revogação)

`desktop/src/main/auth-core.ts` — apenas `self()` + `persist()`:

1. **Sem gate local de validade**: `self()` não usa mais `valid()` para negar/apagar; se há token
   (memória ou disco), ele **vai ao servidor** decidir (D1 eliminado).
2. **Releitura do disco (2ª chance)**: `if (!mem||!mem.token) { load(); … }` antes de negar
   `no_session` (D3 eliminado).
3. **Wipe só com revogação confirmada**: 401 **com contrato JSON** (`error` string) é reconfirmado
   1200ms depois; só o **segundo** 401-contrato faz `wipe()` (+`wipe.reason:
   server_unauthorized_confirmed`) e retorna `expired`. 401 opaco ⇒ `http_401_opaque`;
   2ª leitura com rede fora/outro status ⇒ `http_401_unconfirmed` — ambos caem no ramo transitório
   do renderer (splash + retry), **sem wipe** (D2 eliminado).
4. **Dica local deslizante**: em cada `self()` 200-ok, `expiresAt = max(atual, now+6h)` — a dica
   local nunca derruba sessão que o servidor aceita.
5. **Persistência atômica**: `persist()` grava `session.json.tmp` (0600) + `renameSync`
   (elimina truncamento por queda de energia — insumo do D3).

`desktop/src/renderer/index.html` — 3 edições:

6. **Tolerância à ponte** (D4): `no_bridge` só após **40 tentativas × 300ms (~12s)**; antes disso o
   splash espera a ponte chegar.
7. **"Tentar novamente"**: o hint offline ganhou ação de retry imediato (`authRetryNow` /
   `window.__authWake`) além do escape manual existente.
8. **Bloco-guarda separado** (D5): `<script>` próprio detecta `firebase` ausente (gstatic
   inalcançável), mostra "Aguardando conexão… / Sua sessão está preservada." e recarrega com
   backoff 4s→60s + listener `online` — o boot offline nunca mais congela nem vira login.

Máquina de estados resultante (explícita, exigida pelo mandato):
`BOOTING → INITIALIZING_AUTH → RESTORING_SESSION → {AUTHENTICATED | LOGIN_REQUIRED (só com prova) |
AUTH_ERROR_RECOVERABLE (backoff + Tentar novamente) | AUTH_ERROR_TERMINAL}` — implementada sobre os
estados já aprovados da F3.5.4V-H1 (`AUTH_INITIALIZING/AUTH_RESTORING/AUTHENTICATED/
AUTH_OFFLINE_CACHED/AUTH_UNAUTHENTICATED_CONFIRMED/AUTH_REVOKED`), sem renomear eventos aprovados.

Tela de login SOMENTE com prova: (a) nunca houve sessão persistida (`no_session` após releitura);
(b) logout explícito; (c) revogação/expiração **confirmada pelo servidor** (401-contrato 2×);
(d) escape manual do usuário. Rede indisponível **nunca** é tratada como logout.

## 7. Arquivos alterados × congelados

Alterados (allowlist da fase): `desktop/src/main/auth-core.ts`; `desktop/src/renderer/index.html`;
`desktop/package.json` + `package-lock.json` (versão 1.0.221); novos
`desktop/scripts/f355ch1-session-restore.test.mjs`, `f355ch1-electron-proof-main.js`,
`f355ch1-proof-preload.js`; re-pins de versão em `f354vh1-session-persistence.test.mjs`,
`f355c-script-quantity-rich-editor.test.mjs`, `f355{ah1,b,c}-proof-preload.js`; workflows e docs
`f355ch1*`.

Congelados (diff vazio obrigatório contra a 1.0.220): TODO o resto — em particular
`desktop/src/main/{main.ts,auth.ts,diag.ts,…}`, `desktop/src/preload/`, `electron-builder.yml`
(appId/productName/userData/partição intocados), instalador NSIS, Worker, functions, Android.

## 8. Riscos e mitigações

- **Sessão revogada não pode continuar autenticada** ⇒ mantido: 401-contrato confirmado 2× apaga e
  exige login (S5 da suíte prova).
- **Janela de dupla confirmação (1,2s)**: um incidente de borda >1,2s devolvendo 401-JSON válido
  ainda apagaria sessão boa — mitigado por exigir contrato JSON exato (opaco nunca apaga) e pelo
  custo/benefício de segurança (não deixar sessão revogada viva). Registrado como limitação.
- **TTL implantado desconhecido** (seção 4): se for 24h, o login diário é comportamento do servidor,
  não deste cliente; os logs locais novos permitirão distinguir isso na validação física.
- **Logout explícito** continua apagando (S9); fechar/reiniciar/atualizar/offline/timeout não apagam.

## 9. Rollback

- 1.0.220 permanece publicada e intocada (assets preservados), assim como 1.0.219/1.0.218/1.0.216.
- Rollback físico imediato: instalar v1.0.218 (baseline física) ou v1.0.216; o updater continua
  funcional pois o Latest só muda com release explícita.
- `session.json` não muda de formato (mesmos campos token/expiresAt/uid) — downgrade não invalida
  sessão; a escrita atômica é retrocompatível.

## 10. Estado da validação local no momento deste checkpoint

- Build TypeScript OK; os DOIS blocos inline do renderer parseiam.
- `f355ch1-session-restore.test.mjs`: **25/25** (S1–S10, inclui RED→GREEN dos 4 defeitos).
- `f3356-auth-core.test.mjs`: 16/16; `f354vh1-session-persistence.test.mjs`: 40/40 (pin de versão
  re-pinado 1.0.221); `f355c-script-quantity-rich-editor.test.mjs`: 128/128.
- Provas Electron empacotadas (xvfb): **10/10 cenas verdes**
  (`ok, ok_autostart, net_then_ok, net_throw, net_persistent [retry-now + escape], no_session,
  expired, logout, no_bridge_race, fb_guard`).
- Bateria completa espelho-CI, ciclos repetitivos, build gated e publicação: fases seguintes.
