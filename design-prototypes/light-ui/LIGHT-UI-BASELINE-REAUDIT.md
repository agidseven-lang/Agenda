# LIGHT UI — BASELINE REAUDIT (I0 · Implementation Pre-flight)

**Trilha:** IMPLEMENTAÇÃO (nova — o Design Closure R1–R11 está FINALIZADO e FROZEN).
**Status:** I0 = ENTREGUE — aguarda owner. **Zero implementação nesta fase** (nenhum arquivo de
produção tocado; nenhum branch de implementação criado). Escopo de escrita: só
`design-prototypes/light-ui/`.

---

## 1 · GATE 1 — ESTADO DO REPOSITÓRIO (read-only, provado)
- Branch atual: `design/f356b-light-ui-mockups` · HEAD `f014d95` (declaração R11) · working
  tree limpa (0) · remote único `origin` (github.com/agidseven-lang/Agenda) · `git fetch --prune`
  executado antes da auditoria.
- **450 branches remotos**; famílias: `desktop/*` (166), `app/*` (PWA), `android/*`, `main`,
  `design/*`. **`origin/main` NÃO contém `desktop/`** (é PWA/worker/docs/workflows) — a linha de
  produção Desktop vive nas branches `desktop/*`.
- **O branch de design NÃO contém `desktop/`** (histórias desconectadas da linha desktop —
  `git merge-base` exit 1). Consequência estrutural: a implementação NUNCA parte do branch de
  design; exigirá branch próprio a partir da linha desktop (não criado nesta I0).

## 2 · GATE 2 — DESKTOP MAIS RECENTE (provado, sem assumir nome)
Métodos: maior versão em `desktop/package.json` de todas as `desktop/*` candidatas + ordenação
de TODAS as refs por `committerdate` + tags.
- **Maior versão existente: `1.0.246`** — branch
  `desktop/f356bh2-workflow-notifications-premium-1.0.246`, tip **`a4312c57`**
  ("F3.5.6B-H2 release: publicar 1.0.246 no Latest", 2026-08-11), `package.json = 1.0.246`.
- **Ref mais recente do repositório inteiro** (excluindo o próprio branch de design): essa mesma
  branch (2026-08-11). Nenhuma branch desktop posterior; nenhuma experimental além dela.
- **Release publicada mais recente: tag `v1.0.246`** (o tip é o commit de publicação no Latest).
  Tags v1.0.242–246 existem — código mais recente = release mais recente (mesma linha, sem
  divergência entre "código" e "release").
- Diferenciação pedida: main = PWA (outra plataforma) · `desktop/local-*`/`whatsapp-*`/etc. =
  linhas antigas (≤1.0.131 por data 2025) · linha ativa = `f356*` culminando na 1.0.246.

## 3 · GATE 3 — BASELINE 1.0.246 (a mesma usada no design)
- Branch `desktop/f356bh2-workflow-notifications-premium-1.0.246` · commit `a4312c57` · tag
  `v1.0.246`.
- Artefatos: `desktop/src/renderer/index.html` (13.034 linhas) · `desktop/src/main/` (25+ módulos
  TS/JS: main.ts, auth.ts, auth-core.ts, bgNotify.ts, slaReminder*, notifier*, tray/updater etc.)
  · `desktop/src/preload/` (preload.ts + bgnotify/slareminder preloads) · janelas auxiliares
  `bgnotify.html`/`slareminder.html` · `priorityEngine.js` · sounds. Total `desktop/src`: 46
  arquivos.

## 4 · GATE 4 — DIFF 1.0.246 → DESKTOP ATUAL = **ZERO DRIFT (provado)**
A Desktop mais recente **É** a baseline do design:
- `renderer/index.html` do tip atual `a4312c57` = **byte-idêntico** ao renderer auditado na
  trilha de design (diff -q; 13.034 linhas).
- `main.ts`, `preload.ts`, `auth.ts`, `auth-core.ts` = **byte-idênticos** aos auditados.
- **Zero commits novos** na linha desktop desde `a4312c57` (nenhuma ref desktop com data
  posterior).

| Categoria (A–O) | Mudanças pós-1.0.246 | Registro |
|---|---|---|
| A Novas funcionalidades · B Correções · C Fluxo · D Dados/Firestore · E Auth · F Notif/SLA · G Agenda · H Workflow cliente · I Designer/Social · J Reports/Exec · K Configurações · L Electron/tray/updater · M Responsividade · N A11y · O Outros | **NENHUMA** | Tabela de drift: **vazia** — não há linha para classificar. Toda a auditoria funcional das fases R (linhas citadas nos contracts) permanece válida SEM tradução. |

> Guardrail permanente mantido mesmo assim: se surgir Desktop >1.0.246 ANTES da I1 começar, a
> I1 só inicia após re-executar este Gate 4 sobre a nova versão (regra registrada no roadmap).

## 5 · GATE 5 — DRIFT DE SUPERFÍCIES = NENHUM
Código idêntico ⇒ as **30 superfícies do `MASTER-SURFACE-MAP.md` continuam cobrindo 100% do
produto atual**. Nenhuma rota/tela/modal/sheet/menu/página/painel/janela/estado novo.
**Nenhuma "DESIGN DRIFT — NOVA SUPERFÍCIE".**
Nota de precisão (não é superfície nova; é FATO de implementação exposto nesta I0): a seção
Config "Acessibilidade e Aparência" — já mapeada (superfície 20) — contém um **tema claro
BÁSICO já exposto ao usuário** (ver Gate 15), que o plano de implementação precisa tratar.

## 6 · GATE 6 — MATRIZ F1–F13 (função auditada × função atual)

| Frame | Função auditada (1.0.246, linha) | Função atual (tip `a4312c57`) | Drift | Compatível? |
|---|---|---|---|---|
| F1 Meu quadro | `renderPersonBoard` 6190 | idêntica | zero | ✔ |
| F2 Cliente | `renderClientFlowBoard` 6364 + wfApprovals drawer 7740+ | idêntica | zero | ✔ |
| F3 Designers | `renderDesignersHub/Board` 6376/6393 | idêntica | zero | ✔ |
| F4 Social Medias | `renderSocialsHub/Board` 7055/7074 | idêntica | zero | ✔ |
| F5 Setores | `renderBoard` 7093 | idêntica | zero | ✔ |
| F6 Detalhes | `renderClientView` 9913 | idêntica | zero | ✔ |
| F7 Nova tarefa (4 passos) | `renderForm` 11314 | idêntica (nenhum campo novo) | zero | ✔ |
| F8 Agenda | `renderAgenda` 6084 | idêntica | zero | ✔ |
| F9 Central de Notificações | `renderNotifCentral` 5734 | idêntica | zero | ✔ |
| F10 Executivo | `renderExecPanel` 5523 | idêntica | zero | ✔ |
| F11 Relatórios | `renderReports` 5600 | idêntica | zero | ✔ |
| F12 Login | `renderLogin` 3151 | idêntica | zero | ✔ |
| F13 Modal Legendas e artes | `renderProductionModal` 9221 | idêntica | zero | ✔ |

Regra preservada para o futuro: se um Golden divergir do código vigente na hora de implementar
(ex.: campo novo no wizard), **preserva-se a função nova + aplica-se o DS** — nunca remover
função para imitar o Frame.

## 7 · GATE 7 — SUPERFÍCIES B = 6/6 SEM DRIFT
Prioridades (`renderPrioridades` 5287) · Hoje (5821) · Hub (6135/6175) · Equipe (10260) ·
Perfil (10282) · Configurações (10334): funções idênticas ⇒ **SEM DRIFT** nas 6; specs da R7
aplicam sem tradução.

## 8 · GATE 8 — FOUNDATIONS C1–C8 = SEM COMPONENTE NOVO
Nenhum control/dialog/menu/feedback/tabela/estado novo no código (idêntico). **Nenhum candidato
a C9**; taxonomia C1–C8 cobre o produto atual por inteiro.

## 9 · GATE 9 — IMPLEMENTATION TOKEN TABLE
Criada em **`LIGHT-UI-IMPLEMENTATION-TOKENS.md`** (documental; aponta contracts + errata, não
duplica). **Errata tem prioridade; proibido copiar cores de screenshots históricos.**

## 10 · GATE 10 — RESPONSIVE GUARDRAILS → ALVOS REAIS (mapa de implementação futura)

| Regra (R8) | Onde implementar (renderer real) |
|---|---|
| `min-width:0` (P0) | filhos diretos das grids/flex do novo shell Light (equivalentes reais de `.main>*`/`.hd>*`/`.page>*` quando o shell Golden for construído) — fonte única R8 §12.1 |
| Kanban scroll-x + colunas min | `body.desktop #content.board-mode .kanban`/`.kcol` (o real já usa medias por altura 660–1040+; adicionar contrato de largura mínima de coluna) |
| Drawer overlay ≤1600 | drawer de aprovações `wfap-panel` (já `position:fixed`) + futuro drawer de detalhe F1 |
| Detalhes 3→2 + timeline scroll-x | `renderClientView` (grid de colunas nova do F6; timeline `.tlx`) |
| Wizard internal scroll + footer | `renderForm` card (`.form-wrap`) — real já rola; garantir footer persistente |
| Agenda pane reflow ≤1240 | `renderAgenda` (grade mensal + painel do dia) |
| Filters wrap | toolbars F9/F10/F11 reais (`nc-tb`, `exec` filtros `ex-fls` equivalentes) |
| KPI auto-fit ≥186 | KPIs do exec (`slaExecAggregate` render) |
| Table overflow-x no card | `.exec-tbl` hosts (Exec/Reports) |
| Login `max-height:660` | **JÁ EXISTE no real** (media 660 do #login) — preservar |
| Modal 94vw/88vh | `.modal-back .sheet` (medias 560/520/720/440 reais preservadas) |

## 11 · GATE 11 — A11Y IMPLEMENTATION BLOCKERS (do `ACCESSIBILITY-CONTRACT.md`)
**P0 OBRIGATÓRIO: A11Y-D01 — upload F13 sem caminho de teclado** (input `hidden`, renderer
9217). O Light UI **não pode ser declarado pronto** sem resolver. Registrado no roadmap (I9 +
gate de saída I11).
Demais blockers mapeados (fase alvo no roadmap): Login Enter (D02→I8) · priCard keyboard
(D03→I10) · nc-row keyboard (D04→I6) · labels for/id (D12→I1/I5) · aria-invalid/describedby
(→I5) · modal traps genéricos (D19→I9) · menu keyboard/arrows (D16→I3) · selected semantics
(D15→I2/I3/I6) · table scope/caption (D20→I7) · flashToast aria-live (D17→I1) · reduced-motion
transversal (D21→I11) · target sizes (toast X 28 →I1/C6) · input boundary condicional (E9→I5).

## 12 · GATE 12 — DÍVIDAS FUNCIONAIS (triagem para implementação)
- **NÃO TOCAR (fase funcional futura, fora do skin):** alert()×34/confirm()×2 · thead 5×7 do
  relatório real (F11) · bases de métrica SLA · recovery stub/team-session.
- **NECESSÁRIA PARA IMPLEMENTAÇÃO SEGURA (viram trabalho nas fases I):** todas as do Gate 11
  (são a11y guardrails; o restante do comportamento NÃO muda).
- **OWNER DECISION (registradas, sem ação):** nenhuma nova identificada nesta I0.

## 13 · GATE 13 — ARQUITETURA REAL (como implementar com menor risco)
- Renderer = **monólito** `index.html` de **13.034 linhas**: 6 blocos `<style>` no head + HTML
  mínimo + JS inline (componentes = funções que retornam strings HTML, ex.: `renderLogin`,
  `taskCard`, `avatar()`); alguns estilos adicionais injetados por JS (`st.textContent`, ex.
  slaib). `main` = módulos TS separados (25+); preload ×3; janelas auxiliares próprias.
- **Tokens JÁ EXISTEM**: `:root{--bg,--surface,--surface2,--line,--line-soft,--ink,--soft,
  --faint,--accent,--grad,…}` (dark padrão) e TODO o CSS de tema deriva de `var()` — comentário
  literal do próprio código: *"body.light/hc só re-declaram tokens; o tema escuro padrão (:root)
  fica intacto (fallback seguro)"*.
- Duplicações: estilos por feature em blocos separados (F3.5.x) — conviver, não reorganizar.
- **Safe injection points:** (1) novo bloco `<style id="light-ui">` no FIM do head (vence a
  cascata sem tocar os blocos existentes); (2) classe técnica no `<body>` via pipeline
  `applyAppearance()` existente; (3) re-declaração de tokens escopada à classe.
- **Regra: MINIMAL STRUCTURAL CHANGE** — preferir tokens→CSS→classes→markup estritamente
  necessário; **PROIBIDO reescrever o renderer para "organizar"**.

## 14 · GATE 14 — ESTRATÉGIA DE MIGRAÇÃO (proposta; ver roadmap)
Incremental por superfície, cada fase pequena/auditável/reversível com gate + screenshot compare
+ smoke real. Sequência derivada de dependências reais (tokens→shell→superfícies; modal F13
depois do F6; B depois do shell): detalhada em `LIGHT-UI-IMPLEMENTATION-ROADMAP.md` (I1–I12).

## 15 · GATE 15 — THEME STRATEGY (auditada, não presumida)
**FATO (achado central da I0):** o produto real JÁ possui aparência client-side em Configurações
→ "Acessibilidade e Aparência": segmentado **Tema Escuro/Claro** (`data-cfgtheme`), **Alto
contraste** (`body.hc`) e **Tamanho da fonte** (std/lg/xl via `body.style.zoom` 100/110/125%),
aplicados por `applyAppearance()` (renderer 10331: `body.classList.toggle('light'…)`, persistidos
por máquina. O `body.light` atual é um tema claro **BÁSICO** (re-declara 8 tokens; layout dark
inalterado).
**Estratégia recomendada (menor risco, sem decidir pelo owner):**
- **PARALLEL THEME CLASS técnica** `body.light-ui`, aplicada pelo MESMO pipeline
  `applyAppearance()` sob **flag técnica interna** (não exposta) durante as fases I1–I11 —
  rollback = remover a classe; dark `:root` intacto como fallback seguro (padrão que o próprio
  produto já pratica).
- REPLACE direto: rejeitado (sem rollback trivial). Feature flag de build: desnecessário (o
  produto já tem pipeline de aparência).
- **OWNER DECISION registrada para o final da trilha (I12):** o destino do Light UI — substituir
  o `body.light` básico existente (o "Claro" do usuário passa a ser o Light UI Golden) e/ou o
  dark — é decisão de produto do owner; **nenhuma opção visível nova será criada sem essa
  decisão**.
- Interação a testar (novo requisito de teste, herdado do real): Light UI × `body.hc` × fonte
  lg/xl (`zoom` 110/125%) — o zoom de fonte NÃO foi coberto pelo R8 (que validou DPI de SO);
  entra no plano de testes da I11 (sem expandir claims do R8).

## 16 · GATE 16 — BASELINE VISUAL TESTING (metodologia planejada)
- **Screenshot regression** por fase: harness Playwright/CDP da R8 (viewport+DSF exatos) nos 3
  perfis validados — 1920×1080@1x · 1366×768@1x · 1093×614@1.25 (Windows 125%) — comparando
  contra Golden/R8 (pixel-diff com tolerância de AA + revisão visual).
- **Smoke funcional REAL por superfície** (não "parece funcionar"): executar as ações do Gate 17
  na app empacotada/dev após cada fase; toda regressão = rollback da fase.
- axe-core (harness, nunca produção) após I11 para o delta a11y.

## 17 · GATE 17 — P0 FLOWS (derivados do código atual; a implementação NUNCA pode quebrar)
1. Login → restauração de sessão (splash-first, session.json) → logout.
2. Criar tarefa (wizard 4 passos; lote Edição de Cards "Criar N tarefas"; validações).
3. Cronograma: enviar ao cliente (link) → aprovação de temas → envio ao designer.
4. Designer handoff: atribuição + notificação (dedupe 1.0.245) → entrega do designer.
5. Legendas e artes (F13): RTE + **upload Feed/Story** + Salvar ≠ Salvar e reenviar.
6. Aprovação final do cliente → conclusão (guards pós-conclusão 1.0.243/244).
7. SLA: monitor, lembrete central (janela), bloqueio crítico, sino/painéis.
8. Notificações: premium interno (stack) + externa (bgnotify TOPMOST) + central F9 (localStorage).
9. Agenda: CRUD de compromisso + cancelados + filtros + detalhe (traps Escape reais).
10. Reports: filtros + exportação CSV/JSON (download local).
11. Executivo read-only (agregados tempo real).
12. Electron: tray, updater (verificar/baixar/instalar), autostart, prewarm, edit context menu.
13. **Aparência atual: tema Escuro/Claro básico + alto contraste + tamanho de fonte** (não pode
    quebrar durante a migração).

## 18 · GATE 18 — BASE RECOMENDADA (não criada)
**Base: branch `desktop/f356bh2-workflow-notifications-premium-1.0.246` @ commit `a4312c57`
(= tag `v1.0.246`).** Razões: (1) é a Desktop mais recente por versão, data e release publicada
(Latest); (2) é byte-idêntica à baseline funcional auditada por TODO o design ⇒ drift zero, os
contracts aplicam sem tradução; (3) é um commit de release pinado (reprodutível). Branch de
implementação sugerido (criar SÓ na I1, após GO): `desktop/light-ui-i1-foundation-tokens` a
partir de `a4312c57`. **Regra:** se ao iniciar a I1 existir Desktop >1.0.246, re-executar o
Gate 4 sobre ela ANTES de criar o branch.

## 19–20 · GATES 19/20
Roadmap novo criado (`LIGHT-UI-IMPLEMENTATION-ROADMAP.md`, nomenclatura I0…I12 — o Design
Closure R1–R11 não é reutilizado). **IMPLEMENTATION FREEZE: até o owner aprovar esta I0, seguem
proibidos branch de implementação, código, CSS, build e deploy.**
