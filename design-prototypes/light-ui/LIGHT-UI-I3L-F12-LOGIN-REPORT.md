# LIGHT UI — I3L · F12 LOGIN — RELATÓRIO

**Fase:** I3L · F12 — Golden Frame 12 sobre o Login REAL (standalone, pré-auth)
**Base:** `cdea6da5` (F1–F11 CONGELADAS; F11 @ cdea6da5) · **Branch:** `impl/light-ui-f12-login-1.0.246` (criado DIRETO de cdea6da5)
**Golden:** `proposta-c-frame12-login.html` (Frame 12 aprovado, Design Freeze `6e52905`; renderizado 1920×1080 ANTES de editar)
**Checkpoint:** `6a677133` (`feat(light-ui): port F12 login golden`) · **Versão:** 1.0.246 (inalterada)
**Status:** ENTREGUE — aguarda owner. **F12 NÃO CONGELADA. F13 NÃO INICIADO.**

---

## 1-2 · Preflight + Golden · PASS
HEAD exato `cdea6da5` · worktree limpa · 1.0.246 · Light UI inativa · cadeia F1–F11 intacta · branch de código (não de docs). Golden localizado sem assumir (MASTER map linha 20: F12 `6e52905`); 181 linhas; anatomia auditada; renderizado antes do primeiro edit.

## 3 · Reauditoria funcional literal (FASE 2, A–Q) · PASS

**A. Entrypoint:** `<section id="login">` estático (nasce `.hidden`; revelado por `_revealLogin` no boot F3.5.4V-H1 em negativa real — no_session/expired — ou logout; splash "Restaurando sessão…" é o default do boot). `renderLogin()` popula `#loginForm`; `loginMode` login/forgot(1/2).
**B. Inputs reais:** `#liId` (.inp, label/placeholder "E-mail ou WhatsApp", `inputmode="email"` — servidor aceita e-mail OU telefone, por isso type=text) · `#liPw` (type=password, label "Senha", toggle TEXTUAL "Mostrar"/"Ocultar" `[data-toggle]` em `.pwwrap`). Modos forgot: fEmail/fCode/fPw/fPw2 (stub documentado no Golden — Cloud Functions de produção não tocadas).
**C/D. Ação real:** `button.btn#btnLogin` "Entrar" → handler DELEGADO de click em `#login` → `banner(''); loading(btn,true); const u=await doLogin(val('liId'),val('liPw')); startApp(u)`; catch → banner; finally → `loading(btn,false)`.
**E. Validação:** NENHUMA client-side no login (literal) — vazio vai ao servidor → `bad_request`. Forgot valida e-mail por regex.
**F. Mensagens reais (literais de `doLogin`):** invalid_credentials → "E-mail/WhatsApp ou senha incorretos." · user_inactive → "Conta inativa ou aguardando aprovação." · rate_limited → "Muitas tentativas. Aguarde alguns minutos e tente de novo." · bad_request → "Preencha e-mail/WhatsApp e senha." · default → "Sem conexão com o servidor de login. Verifique a internet e tente de novo." — banner form-level `.banner.err` em `#loginBanner`.
**G. Loading:** `loading(btn,on)` → `disabled` + spinner (dataset.t restaura o texto).
**H/I. Sucesso/rota:** `startApp(u)`: esconde splash, `state.user=u`, `saveSession`, `body.authed`, `#login` hidden, `#app` flex, `subscribeData()`, `render()` (tab inicial **'hoje'** — literal do state), `desktopAPI.sessionLogin(u.id)`.
**J. Sessão:** token confinado ao MAIN (userData/session.json — nunca no renderer); renderer grava `wp_uid`/`wp_name` (saveSession) e `wp_team_jwt` via `acquireTeamSession` (fire-and-forget POST Worker `/team/session`; falha NÃO bloqueia o login — literal).
**K. Logout:** clearSession (remove as 3 chaves) + sessionLogout + volta ao login.
**L. RBAC:** user público retornado pelo servidor; sem seleção de perfil no login.
**M. Retry:** finally libera o botão; nova tentativa integral.
**N. ENTER (BEFORE, prova EMPÍRICA no código intocado):** keydown+keypress+keyup completos nos DOIS campos → **0 chamadas de authLogin**; zero `<form>` no arquivo (grep=0); zero keydown no login. Dívida do Golden CONFIRMADA no código atual.
**O. Tab order:** liId → liPw → toggle → btnLogin → txtbtn (DOM natural).
**P. Labels/ARIA/autocomplete BEFORE:** labels `<label>` SEM `for`; sem aria; sem autocomplete (literal).
**Q. WRITE/AUTH MAP:** authLogin via IPC (desktopAPI→main→Cloud Run POST loginUser {identifier,password}) · fetch Worker /team/session · localStorage wp_uid/wp_name/wp_team_jwt — TODOS pré-existentes; NENHUMA função de autenticação nova.

## 4 · Matriz Golden × Real (FASE 3) · ISSUE = 0

**MATCH:** composição centrada; brand (logo + "ID Seven" + "Desktop · Paridade APK"); título "Entrar"; subtítulo literal; 2 campos com labels literais; toggle textual; CTA único "Entrar"; link "Esqueci minha senha"; nota "Cadastro interno desativado. Solicite acesso ao administrador."; banner de erro form-level; vfooter pill; fundo canvas + véu radial ≤5%.
**FUNCTIONALLY ADAPTED:** (a) logo = PNG oficial real (`--logo`) — o Golden usa brand-mark desenhado ("asset binário não copiado ao protótipo", declarado); (b) CTA com **`--lui-grad`** (autoridade F1 v4 sobre o gradiente do protótipo); (c) card = wrapper estrutural `.login-card` (o Golden PRESCREVE: "no Light UI a coluna vira CARD Golden branco sobre canvas"); (d) vfooter com literais REAIS do build ("Desktop dev · Fluxo" / "ID Seven · produção" — JS real atualiza a pill; Golden desenhou a forma base); (e) labels C1 13/600 sentence-case via CSS (literais preservados; real uppercase 11px).
**EXCEPTION:** nenhuma função inventada (sem remember-me/SSO/cadastro/biometria — ausências PROVADAS no DOM, g21). **Splash de restauração fora do frame** (candidato C1 §14 não desenhado — não skinado nesta fase).

## 5 · Implementação (FASE 4) · PASS

**CSS — seção `I3L · F12` (light-ui-foundation):** o login é estilizado por CSS VARS do tema → a skin **redefine as vars NO ESCOPO** `body.light-ui.desktop #login` (--accent/--soft/--faint/--surface/--line/--ink/--red/--green — nada vaza) + overrides pontuais (card, títulos, labels C1, focus #6E5EF3, CTA --lui-grad, banners tint, pill, focus-visible, media ≤660px do card). **18 seletores, 18/18 gated, 0 `!important`, balanço 0.** Logo PNG (--logo) preservada.
**Markup mínimo autorizado (fidelidade estrutural/a11y — FASE 4):** wrapper `.login-card` (brand→form; vfooter fora, como no Golden) com **regra base estrutural neutra** que replica o contexto flex (pixel-inerte nos 3 temas — provado na FASE Legacy); `role="alert"` no `#loginBanner` estático (erro anunciado por AT); labels com `for` (liId/liPw/fEmail/fCode/fPw/fPw2); `autocomplete` (username/current-password no login; email/one-time-code/new-password no forgot — padrão de password manager compatível com o fluxo; type do liId NÃO mudado: e-mail OU telefone).
**Nada criado:** rota fake 0 · login duplicado 0 · form screenshot-only 0 · auth paralela 0 · storage paralelo 0 · mock em produção 0.

## 6 · HARD GATE A — Enter · PASS (corrigido com autorização)

**BEFORE (empírico, arquivo intocado): Enter = 0 chamadas** (dois campos; eventos completos), mouse = 1. **Correção cirúrgica:** listener `keydown` DELEGADO no `#login` (mesmo padrão do click real): Enter com foco em INPUT do `#loginForm` → `preventDefault` → click no `.btn` primário do modo atual — **exatamente o mesmo caminho/função do botão** (handler delegado único; zero segundo fluxo; zero duplicação). Botão `disabled` durante loading não dispara `click()` ⇒ Enter repetido/durante busy = 0 chamadas extras. Não interfere no toggle (só reage a INPUT). **AFTER provado: mouse = 1 · Enter = 1 (liPw E liId) · nenhum caminho = 2.**

## 7 · HARD GATE B — Autenticação (stub da função REAL; zero rede) · PASS

`desktopAPI.authLogin` STUBADO no harness (fila de respostas + contador) — **zero autenticação real em toda a bateria** (fetch visto: apenas o `/team/session` stubado, fire-and-forget real; falha → `wp_team_jwt` removido — literal). **Sucesso:** campos reais preenchidos → botão real → payload exato PROVADO (**trim do identifier** aplicado pelo doLogin: `' a@b.c '` → `'a@b.c'`) → loading real (disabled+spinner) → `startApp`: authed + #app flex + **tab 'hoje'** + `wp_uid`/`wp_name` gravados + `sessionLogin('u1')`. **Falha:** os 5 erros literais provados byte a byte no banner; busy liberado (finally); botão reutilizável; retry integral; sem falso sucesso; sem redirect indevido. Mensagens NÃO alteradas.

## 8 · HARD GATE C — Duplicação/race · PASS

1 clique = 1 · 1 Enter = 1 · **duplo clique rápido = 1** (loading síncrono ANTES do await + `.btn[disabled]{pointer-events:none}`) · Enter repetido = 1 · **Enter durante loading = 0 extras** · click durante loading = 0 extras. O bloqueio REAL (disabled) rege; nenhum race pré-existente encontrado.

## 9 · A11y (FASE 5) · PASS

Labels associados (`for`) provados; e-mail/usuário com inputmode real + autocomplete username; senha identificada (type=password + current-password); foco visível (inputs `:focus` border #6E5EF3 real + `:focus-visible` outline #4353D8 nos controles); Tab order coerente (g11); Enter funcional (gate A); **erro perceptível por AT** (`role="alert"` no container real do banner); **nested interactive = 0**; botão loading `disabled` semanticamente coerente; contraste por tokens; reduced motion: media real do spinner preservada (animation-duration 1.6s). ARIA redundante NÃO adicionada a controles nativos.

## 10 · Responsive (FASE 6) · PASS
1920 / 1366 / win125 (1093×614 @1.25): **scrollW == vw nas 3** (zero overflow); card inteiro utilizável; inputs/CTA acessíveis; banner de erro não quebra a composição; a media REAL `max-height:660px` do login segue regendo (logo/títulos compactos) + card compacto gated; sem fake scale.

## 11 · Legacy (FASE 7) · PASS
Login legado before×after (base `cdea6da5`, sem body.light-ui) em **dark / light / HC: 0px PURO nos 3 temas** — o wrapper `.login-card` (regra base estrutural), os atributos (for/autocomplete/role=alert) e o keydown são PIXEL-INERTES provados. Sem máscara.

## 12 · Smoke funcional (FASE 8) · **27/27 PASS**
Cobre os 24 itens do mandato + 3 extras: entrypoint/render/campos/validação-vazia (server-side literal: bad_request → banner)/5 erros literais/loading/retry/sucesso/redirect 'hoje'/sessão real/tab order/focus-visible/Enter×2 campos/mouse/duplo-clique/busy-block/copy erro/responsive/zero-overflow/nenhuma função inventada (provado no DOM)/storage só real/zero auth real/navegação pós-login + toggle Mostrar-Ocultar + role=alert. N/A literais documentados: validação client-side não existe; remember-me/SSO/MFA/cadastro não existem.

## 13 · Regressão F1–F11 (FASE 10, base `cdea6da5`) · PASS
36 pares: **32 = 0px PURO** — incluindo os HARD GATES **F9 populated/detail = 0px · F10 main/empty = 0px · F11 populated/empty = 0px** — e F12 legacy 3 temas + legacy suite (Relatórios/Executivo/Central dark-light-hc, Detalhes dark, Agenda dark) = 0px. f3 board/f3 painel/f4 board/f5 painel divergiram SÓ nas bboxes conhecidas do sino ((1458,26,1500,68) e (1443,29,1485,71)) com flake **AUTO-PROVADO A–E per-superfície** (base×base e/ou cur×cur divergem sozinhos na MESMA bbox; máscara = apenas essa bbox; **0px fora nos 4**). Nunca máscara genérica.

## 14 · Diff audit (FASE 11) · PASS
**1 arquivo, +63/−5.** Blocos: seção CSS I3L (+43, 18/18 gated, 0 !important) · wrapper `.login-card` + `role="alert"` (HTML estático, 2 linhas) · regra base `.login-card` (CSS compartilhado, 1 declaração estrutural neutra — pixel-inerte provado) · labels for/autocomplete no template do renderLogin (3 linhas) · keydown delegado (+8). **Greps no diff = 0 para:** renderReports/renderExecPanel/execDesRow (F10/F11 D01-D02 intocados)/nc-*/notifHistory (F9-D01 intocado)/renderAgenda/resolveTaskDisplayState/authLogin (a função)/acquireTeamSession/startApp/saveSession/toCSV/routing (`state.tab===`). `doLogin` aparece 1× APENAS em comentário CSS. Storage: zero novo. Auth/backend: zero mudanças de contrato.

## 15 · Provas (FASE 9, no chat)
F12-LOGIN-{1920, 1366, win125, ERROR, LOADING, A11Y-FOCUS}.png + F12-COMPARE-GOLDEN-vs-APP.png.

## 16 · Fechamento
Checkpoint único `6a677133` + push. **Sem PR · sem merge · sem build · sem tag · sem release · sem deploy · sem version bump · Light UI continua INATIVA · F13 NÃO INICIADO.** Roadmap: **I3K.2 = ✔ GO · F11 = CONGELADA @ `cdea6da5` · I3L = ENTREGUE — AGUARDA OWNER · F12 = NÃO CONGELADA até GO explícito · F13 = NÃO INICIADO.**

**Recomendação: GO** — skin por vars escopadas sobre o fluxo real intocado; Enter corrigido com autorização pelo caminho único do botão real; auth provada por stub da função real (payload/trim/loading/rota/sessão); race gates limpos; a11y estrutural mínima pixel-inerte.

**HARD STOP.** F13 não iniciado. Aguarda GO explícito do owner.
