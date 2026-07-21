# F3.4.3 — Status dos testes na branch de hotfix `desktop/f343-background-notifications-hotfix`

**Baseline estável:** `9444e7f` (1.0.178) · **Candidata (esta branch):** `1.0.180-rc.1`
**Escopo autorizado do hotfix:** produtor-único-no-main de notificações em background
(`main.ts`, `notifier.ts`, `auth.ts`, `renderer/index.html`, novos `slaRules.js` + `slaScheduler.ts`,
`copy-renderer.js`, `package.json`/`package-lock.json`) + testes/fixtures do hotfix.

Este documento registra os testes que **não** ficam verdes nesta branch e prova que **o hotfix não é a causa**.
A verificação de "RED no baseline" foi feita rodando cada teste contra um worktree em `9444e7f` (árvore 100% baseline).
As provas de máquina estão em `f343-preexisting-registry.test.mjs` (VERDE) e `f343-hotfix-region-invariance.test.mjs` (VERDE).

---

## A) Falhas históricas PRÉ-EXISTENTES (RED já em `9444e7f`, fora do escopo do hotfix)

Classificação de todos os itens desta seção: **falha histórica pré-existente (fora do escopo do hotfix)**.

| Teste | Baseline `9444e7f` | Candidata `1.0.180-rc.1` | Assertiva que falha | Prova de que o hotfix não é a causa |
|---|---|---|---|---|
| `f3370-d3r10b-card-canonical-pwa-cutoff` | RED | RED | `K11` (8 espaçadores de seção do config em `index.html`) | Subjects `tray.ts`/`auth-core.ts`/`preload.ts` byte-idênticos a 9444e7f; a região dos espaçadores do config no `index.html` é **idêntica** base↔candidata (9 ocorrências em ambos; o teste exige 8) → região inalterada pelo hotfix. |
| `f3373i6c11-auth-logout-tray-diag` | RED | RED | `F5` (exatamente **1** `destroyTray()` em `main.ts`) | Subjects `tray.ts`/`auth-core.ts` byte-idênticos a 9444e7f; a contagem de `destroyTray()` em `main.ts` é **idêntica** base↔candidata (2 em ambos; o teste exige 1) → o aspecto que o `F5` inspeciona não foi alterado pelo hotfix. Obs.: `B2`/`D2` passavam no baseline e viram RED por **colateral de regex frágil** sobre as edições AUTORIZADAS de `main.ts`/`auth.ts` (novo `getAuthUser`, `slaScheduler.stop()` no `realQuit`); o teste **já era RED** no baseline por `F5`. |
| `f3373i6c14-settings-completion` | RED | RED | `E5` (`cfg-head/cfg-wrap` + 8 espaçadores em `index.html`) | Espaçadores do config **idênticos** base↔candidata (9; exige 8) e `cfg-head` idêntico (2) → região inalterada pelo hotfix; sem subject fora do conjunto autorizado. |
| `f3373i6c18c-card-prewarm` | RED | RED | `A1` (pin de versão `1.0.177`) | Subjects `prewarm.ts`/`preload.ts`/`cloudflare-worker.js` byte-idênticos a 9444e7f; o pin `1.0.177` **já estava violado** no baseline (que é `1.0.178`) → falha de versão anterior ao hotfix. |
| `f3373i6c18h-stable-token` | RED | RED | `H3` (pin de versão `1.0.177`) | Pin `1.0.177` **já violado** no baseline `1.0.178`; a falha independe das edições do hotfix. |
| `f3374d-restore-contract` | RED | RED | `R17` (versão `1.0.177`, sem literal de versão no renderer) | Pin `1.0.177` **já violado** no baseline `1.0.178`; falha de versão anterior ao hotfix. |
| `f3374k-production-invariance` | RED | RED | `K-pkg` (candidata deve ser `1.0.177`) + `K-proc`/`K2` (vs QA `960d8ed`) | Subjects de processo `preload.ts`/`clockSync.ts`/`bgNotify.ts`/`firebase.ts`/`auth-core.ts` byte-idênticos a 9444e7f; o pin `1.0.177` já estava violado no baseline (`1.0.178`) e `preload.ts` **já divergia** do baseline QA `960d8ed` em 9444e7f → RED estrutural anterior ao hotfix. |

Notas:
- Todos os subjects listados como "byte-idênticos a 9444e7f" são verificados por igualdade de blob git em `f343-preexisting-registry.test.mjs`.
- Os testes acima **continuam RED** de propósito — não é papel do hotfix consertá-los. O hotfix apenas prova que não os causou.

## B) Guards ESTÁVEIS 1.0.178 — intencionalmente vermelhos na rc, preservados p/ produção

Classificação: **guard estável da 1.0.178 — intencionalmente vermelho na branch rc 1.0.180
(versão prerelease + main editado); guard estável preservado para produção; substituído no escopo
do hotfix por `f343-hotfix-region-invariance`.**

| Guard | Baseline `9444e7f` | Candidata `1.0.180-rc.1` | Por que vermelho na rc |
|---|---|---|---|
| `f341a-region-invariance` | GREEN | RED (esperado) | Compara contra a PRODUÇÃO 1.0.177 (`2963927`) exigindo versão `1.0.178` e `main.ts`/`notifier.ts`/`auth.ts` byte-idênticos fora das regiões `UPDATER`. Na rc a versão é `1.0.180-rc.1` e o `main`/`notifier`/`auth` foram editados (produtor único) → vermelho POR DESIGN. |
| `f3375a-wizard-reset-roteiro-no-designer` | GREEN | RED (esperado) | `Q2` exige versão de produção sem sufixo prerelease; a rc é `-rc.1` → vermelho POR DESIGN. |

Estes dois guards **não foram modificados** (byte-idênticos a `9444e7f`, verificado no registry e no
`f343-hotfix-region-invariance`). Eles permanecem como proteção de PRODUÇÃO 1.0.177/1.0.178. No escopo
desta branch privada de hotfix, a proteção region-scoped equivalente é dada por
`f343-hotfix-region-invariance` (baseline `9444e7f`, versão `1.0.180-rc.1`).

---

## C) Testes VERDES do escopo do hotfix (contrato produtor-único-no-main)

- `f343-main-scheduler`, `f343-delivery-channel`, `f343-preservation`, `f343-assignment-transition`,
  `f343-sla-golden-master`, `f343-operational-block`, `f343-hotfix-region-invariance`,
  `f343-preexisting-registry` — todos VERDES.
- Testes obsoletos **reescritos** ao novo contrato (histórico no Git; mesmo nome de arquivo):
  `f3377a-r3-single-producer-clock`, `f3377a-r4b-http-date-clock`, `f33D-background-notif`,
  `f33E-main-notifier`, `f33N-assign-baseline-fix` — todos VERDES.
