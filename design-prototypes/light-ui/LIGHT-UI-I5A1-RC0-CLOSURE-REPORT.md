# LIGHT UI — I5A.1 · RC-0 CLOSURE

**Base:** `ae6fc7b0` (candidato I5A, verificado: HEAD exato, ancestral `899862a2`, worktree limpa, 1.0.246, zero tags no HEAD, nenhum artefato de build) · **Branch:** `rc/light-ui-activation-hardening-1.0.246` · **Checkpoint:** **`dcc019ca`** · `fix(rc): close login recovery and win125 gates` (1 arquivo, **7+/20−**, 6 hunks todos no bloco LOGIN UI). Sem I5B, sem build/package/installer/tag/release/deploy/bump/merge/PR. **Light UI permanece DESLIGADA por padrão.**

**Decisões do owner registradas nesta fase:** M1/CDN = **ACEITO para 1.0.246** (sem vendorização; fallback provado suficiente; vendorization = dívida pós-1.0.246) · A4/per-machine = **ACEITO para RC/preview interno** (default OFF, sem UI pública, kill switch, sem ativação automática; exposição pública exigirá nova decisão) · RC-D02 = **remover/ocultar a ação de recovery stub** (sem backend novo, sem Firebase Auth client, sem endpoint, sem simulação de e-mail).

---

## 1 · RC-D02 FIX (Fase 1)
Reauditoria literal do login: ponto de entrada ÚNICO era o botão `data-mode="forgot"` ("Esqueci minha senha"); modos forgot step 1/2 renderizados por `renderLogin`; handlers stub `btnFreq`/`btnResend`/`btnFconf` (banners falsos "enviamos um código" sem envio real); listener `[data-mode]`; estado `forgotStep`/`forgotEmail`; Enter genérico clicava o `.btn` do modo. **Correção aplicada = remoção semântica COMPLETA do stub** (preferência do mandato — não apenas bloquear onclick): saem o botão, os 2 branches, os 3 handlers, o listener `[data-mode]` (sem outro uso no produto — verificado por grep global) e o estado. `loginMode` permanece (usado por logout/boot, sempre `'login'`). Resultado: **nenhum botão/link de recovery · nenhum handler órfão acessível · nenhum keyboard target morto · nenhum fake success · nenhuma chamada de auth nova · nenhuma escrita · nenhum endpoint/backend**. Spacing: o card encurtou naturalmente (hint "Cadastro interno desativado. Solicite acesso ao administrador." agora segue o botão Entrar) — ajuste contido no card, autorizado. Registros: CSS `.txtbtn`/regra focus-visible light tornam-se órfãos e inertes (zero elementos; não removidos — F12 congelado visualmente; limpeza candidata futura); estado `loginMode='forgot'` é inalcançável (nenhum caminho o seta — grep 0).

## 2 · F12 FUNCTIONAL / A11Y (Fase 2)
Smoke F12 re-executado no commit final: **29/29** (27 gates originais — entry, render, campos/labels/autocomplete, validação de vazio, credencial inválida/inativa/rate/rede, loading/spinner, busy-block, retry, Enter=1/mouse=1/double-block, toggle senha, tab order, focus-visible, sem invenções, sucesso/redirect/sessão/nav, storage, zero-real-writes — adaptados onde o forgot saiu) **+ 2 gates novos: `g25_noRecoveryTarget`** (nenhum `[data-mode]`/btnFreq/btnResend/btnFconf/texto "Esqueci|Redefinir senha|Enviar código|Reenviar código" no `#login`) **e `g26_noDeadTab`** (focáveis do form = exatamente `liId → liPw → toggle → btnLogin`). **Recovery target = 0. Nenhum elemento morto na tab order.**

## 3 · WIN125 HARD GATE (Fase 3)
Reconhecimento: a C4 da I5A usou 1536×864@dsf1 — **não** era o Win125 congelado; gate agora fechado com o cenário EXATO do R8 (o próprio renderer documenta "viewport ~1092×614"): **CSS 1093×614 · deviceScaleFactor 1.25 · Light UI pelo MECANISMO REAL** (localStorage + boot completo). Resultados: navegação global **15/15** (2 voltas × 8 tabs com `scrollWidth == viewport` em TODAS — zero overflow horizontal de página; modais Central/Legendas e artes abrem/fecham; H16; deep-link F9→F6; filtros; par `desktop+light-ui` sempre coerente; sem pageerror próprio) + **login 6/6** (`L1` visível pós-logout real · `L2` par coerente · `L3` utilizável, botão ≥30px · `L4` sem H-scroll · `L5` sem recovery · `L6` card sem clipping). **Evidências: `I5A1-WIN125-1093x614-dsf125-hoje.png` e `…-login.png`** (enviadas no chat; não versionadas).

## 4 · LEGACY / DEFAULT OFF (Fase 4)
`ae6fc7b0 × dcc019ca`, flag OFF: **login dark / legacy-light / HC → diff EXCLUSIVAMENTE dentro da região autorizada** (união dos rects do card base×head + margem de sombra/reflow — o card encurtou e recentralizou; fundo/página fora do card = intacto). **Superfície não-login (hoje dark) = 0px puro.**

## 5 · LIGHT UI F12 (Fase 5)
Flag ON: default/error/loading/focus → **4/4 bounded à mesma região autorizada**. Decomposição exigida (`ae6fc7b0 + recovery-removal-only × HEAD`): **trivialmente 0px por construção** — o diff audit prova que o commit contém APENAS o recovery-removal (6 hunks no bloco LOGIN UI), logo HEAD ≡ base+removal-only byte a byte. O estado "forgot" deixou de existir como superfície (remoção funcional autorizada pelo owner; Golden F12 permanece autoridade em tudo o mais).

## 6 · REGRESSÃO CRÍTICA CROSS-FRAME (Fase 6)
Pixel `ae6fc7b0 × dcc019ca` flag ON: **F9 main/detail · F10 main/empty · F11 main/filtered/empty · F13 main/empty/focus/host = 12 × 0px ESTRITO** (nenhum flake de sino nesta bateria). Funcional no commit final: **f9 28/28** (F9-D01 mantido) · **f10 32/32** e **f11 48/48** (copies B1 mantidas: "acima da tolerância", "Atrasos recentes", "críticas primeiro") · **f13 21/21 + chooser upload mouse/Enter/Space 1/1/1** (a11y) · **B2 19/19** (await antes do close · busy · failure mantém modal · retry integral · reentrancy guard).

## 7 · CDN (Fase 7)
Nenhuma modificação no Firebase SDK. Registro formal: **M1 = RISCO FORMALMENTE ACEITO PELO OWNER PARA 1.0.246** (fallback/retry do guard F3.5.5C-H1 provado na I5A: splash honesto + auto-reload + nunca login falso). **Vendorization = dívida pós-1.0.246.** Arquitetura não reaberta.

## 8 · ACTIVATION RECHECK (Fase 8)
Com o novo HEAD: **a1-empty 5/5** (default OFF, boot não grava, zero writes) + **on 17/17** (par completo no boot; skin viva; kill switch; re-opt-in; logout coerente; first paint sem flash — 1º frame renderizável só com splash e classe no DOMContentLoaded; MQ shrink/grow par junto; reload persiste; única chave de storage tocada). A alteração F12 **não afetou** o activation gate. A4 per-machine mantido como aceito para preview interno — arquitetura não redesenhada.

## 9 · DIFF AUDIT (Fase 9)
**1 arquivo** (`desktop/src/renderer/index.html`) · **7+/20−** · 6 hunks, todos entre as linhas 4622–4660 (bloco LOGIN UI): estado, comentário RC-D02 + titles/subs, botão de entrada, branches forgot, listener `[data-mode]`, handlers stub. **Zero mudanças em:** CSS, DOM fora do login, auth (doLogin intocado), storage, Firestore, network, bootstrap, routing, harness de produto. Nenhum incidental. Artefatos de análise (base extraída, shots) removidos do worktree antes do commit; harness/docs vivem fora do repo de produto (scratchpad/branch de design).

## 10 · CHECKPOINT (Fase 10)
**`dcc019ca`** · `fix(rc): close login recovery and win125 gates` → push em `rc/light-ui-activation-hardening-1.0.246`. Sem PR/merge/build/tag/release/deploy/bump.

## 11 · RECOMENDAÇÃO
Os 2 gates que motivaram o NO-GO do congelamento da I5A foram fechados: **RC-D02 = RESOLVED** (função falsa removida da UI; troca de senha real do perfil intacta) e **WIN125 = PROVADO NO CENÁRIO CONGELADO EXATO**. M1 aceito formalmente; A4 aceito para preview interno; QA integral verde; legado intacto fora da região autorizada; F1–F13 sem regressão real.

**I5A.1 = GO.**

**"Está autorizado tecnicamente iniciar I5B / RC Build?" — SIM.**

Nenhuma etapa de build/package/release/deploy foi iniciada. **HARD STOP — I5B somente com GO explícito do owner.**
