# LIGHT UI — I2 CORE SHELL REPORT

**Fase:** I2 — Core Shell (sidebar · header · canvas) · **Status:** ENTREGUE — aguarda owner.
**Branch:** `impl/light-ui-core-shell-1.0.246` (base EXATA `0dc87ccb` = I1 aprovada; verificado
antes do branch). **Commit:** `6a4ea142` (único; código) · version **1.0.246 intacta** · zero
build/release/deploy · nenhum PR · design branch FROZEN (este doc entra em commit docs-only).

## 1 · SHELL AUDIT MATRIX (Gate 1 — markup real auditado ANTES de migrar)
| Elemento real | Veredito | Ação na I2 |
|---|---|---|
| `#app` grid `var(--d-side) 1fr` + `.nav` (sb-brand · new-task-btn · sb-sect · sb-items · sb-user · sb-footer) | SHELL compartilhado autenticado | Re-skin Golden completo |
| `#app > .content` (canvas onde `render()` monta as superfícies) | SHELL (contêiner) | Padding de página + canvas claro; conteúdo INTERNO não tocado |
| `.topbar` | SHELL, mas **oculto** (`display:none !important`, linha 574) por decisão de produto da **1.0.140** — título vive por superfície | **NÃO reabilitado** (§2) |
| `.corner-avatar` + `.slaib-bell` + `.slamon` (cluster flutuante kanban) | SHELL compartilhado (posição via JS) | **Skin-only** por token; zero mudança em posição/cálculo/texto/click |
| Título de página, toolbars, KPIs, boards, drawer, wizard, agenda, notificações, exec, reports, login, modais | SUPERFÍCIE | **Fora do escopo** — permanecem legadas dentro do shell (SHELL FIRST, CONTENT LATER) |

## 2 · DECISÃO AUDITADA — HEADER GOLDEN 92 vs TOPBAR OCULTO (regra permanente 1)
O Golden prevê header de ~92px; o app real **removeu o topbar do desktop na 1.0.140**
(decisão de produto: `display:none !important`; o título/toolbar é renderizado por cada
superfície dentro do `.content`). Reabilitar o topbar na I2 seria mudança ESTRUTURAL/funcional
(reintroduzir elemento morto + duplicar títulos) — viola MINIMAL STRUCTURAL CHANGE e o mandato
(zero JS). **Classificação:** o header Golden é implementável fielmente nas fases de surface
(I3+), onde cada superfície já renderiza seu cabeçalho. Decisão registrada em comentário no
próprio bloco CSS e aqui; **owner valida na revisão da I2**.

## 3 · SELETORES ADICIONADOS (Gate 24/25 — todos sob `body.light-ui`; nenhum atinge superfície)
Seção `/* ===== CORE SHELL (I2) ===== */` dentro do MESMO bloco `<style id="light-ui-foundation">`:
1. `body.light-ui{--d-side:284px}` — sidebar Golden 284 SÓ sob a classe (legado mantém 216).
2. `body.light-ui.desktop{background:var(--lui-canvas)}` — canvas #F5F6F9 (vence o
   radial-gradient navy declarado como property direta em `body.desktop`).
3. `.nav` — gradiente petróleo 180° sb-1→sb-2, `border-right:0`, padding/gap Golden.
4. `.sb-brand` — logo 46px r14 + sombra; nm 18/700 #F5F7FB; sy 12 sb-faint; dot #33D6A6+halo.
5. `.new-task-btn` — 48px r13, gradiente E4 + sombra, 14/650 (CTA Golden; handler intacto).
6. `.sb-sect` — 10.5/700 tracking .15em em sb-dim (E6: micro-labels do topo usam sb-dim).
7. `button.sb-item` (+hover) — 42px r11, sb-tx 14/450; **`.on`** = pill rgba(255,255,255,.065)
   + inset ring + `::before` barra gradiente #7C8CFF→#6E5EF3 (C8: ACTIVE nav ≠ selected).
8. `.nc-navbadge` — `order:9; margin-left:auto`, pill 20px, **background var(--lui-danger-ink)
   #C4302B (errata E8** vence o #EF4444 cru do Golden histórico), texto branco 11/700.
9. `.sb-user` — card no rodapé via `margin-top:auto` + hairline inset (mesmo botão/handler).
10. `.sb-footer` — versão/discreto.
11. `#app > .content` — padding de página 30px 32px 48px + `max-width:none` no filho direto
    (canvas Golden, não card gigante; guardrail min-width:0 da I1 já cobre `#app>*`).
12. `.corner-avatar` — halo rgba(91,124,250,.45) (skin).
13. `.slaib-bell` — surface/hair/tx-2/sh-card por token; especificidade `body.light-ui …`
    (0,2,1) vence o CSS injetado por JS (0,1,0) sem tocar a função.
`!important` só espelhando onde o CSS real já o usa. **Grep de verificação:** nenhum seletor
com tcv4/kbv2/drawer/scr-internos/modal/login no diff.

## 4 · VALIDATION (harness scratchpad modo `shell`; monta o shell com funções REAIS de
produção — sbItem/svg/avatar/TABS/APP_VER/slaibEnsureStyle; stubs de teste só p/ Firebase/
desktopAPI em file://; nada disso é versionado)
- **Sidebar 284 (Gates 3/20): PASS** — navw=284 e `scrollWidth == viewport` nos 3 perfis:
  1920×1080@1 · 1366×768@1 · **1093×614@1.25 (Windows 125%)**. Zoom de fonte 110/125:
  proporcional (navw físico 312/355), sem overflow. **Sem sidebar colapsada** (Gate 21).
- **P0 Gate 22 (header/cluster min-content win125): PASS** — sino re-skinado DENTRO do
  viewport nos 3 perfis (right 1798/1244/**971 < 1093**); cluster não corta.
- **Nav smoke funcional (Gates 5/23): PASS 11/11** — clique em todos os `[data-tab]` reais
  com handlers reais (stub apenas em `render()`): prioridades·hoje·agenda·tarefas·equipe·
  perfil·exec·relatorios·notificacoes·config + sb-user→perfil; `state.tab` correto em todos.
  Ordem/gates (priTabVisible)/labels/ícones preservados (composição idêntica à linha real).
- **Badge (Gate 16): PASS** — `9+` no fim da linha em danger-ink #C4302B branco (E8).
- **HC precedence (Gate 17, smoke): PASS** — light-ui+hc: sidebar/badge íntegros, HC soberano.
- **Legacy (Gates 18/29): PASS** — SEM a classe, I1(`0dc87ccb`)×I2 @1920 com animações
  congeladas: **bbox=None (0px)** em dark, light legado e hc; navw=216 e sino #1b2030 intactos.
- **Visual vs Golden (Gates 27/30): PASS orientado** — sidebar/canvas lêem como o mesmo
  produto do Golden F1; diferenças esperadas e explicadas: conteúdo do canvas = placeholder
  emptyState real (superfícies são I3+), header 92 ausente (§2).
- **Screenshots (Gate 28):** A 1920×1080 · B 1366×768 · C win125 — entregues NO CHAT
  (política PNG: nunca versionadas).

## 5 · VALIDATION MATRIX
| Teste | Dark s/classe | Light legado s/classe | HC s/classe | LUI 1920 | LUI 1366 | LUI win125 | LUI+HC | LUI 110/125 |
|---|---|---|---|---|---|---|---|---|
| Pixel-idêntico à I1 (0px) | PASS | PASS | PASS | n/a | n/a | n/a | n/a | n/a |
| navw / overflow | 216 ✓ | 216 ✓ | 216 ✓ | 284 ✓ | 284 ✓ | 284 ✓ · P0 ✓ | ✓ | 312/355 ✓ |
| Nav smoke 11/11 · badge E8 · sino skin | n/a | n/a | n/a | PASS | PASS | PASS | PASS | PASS |

## 6 · DIFF (Gate 32)
1 arquivo (`desktop/src/renderer/index.html`) · **+80/−0** · **1 hunk único**
(`@@ -2722,0 +2723,80 @@`, inserção pura após o guardrail da I1, dentro do bloco existente) ·
grep no diff por firestore/firebase/version/workflow/localStorage/addEventListener = **0** ·
zero JS/handlers/strings funcionais · version 1.0.246 intacta. Desvios vs rascunho I0 do
roadmap (registrados): `aria-current` (D15) e landmarks `<nav>`/`<main>` (D25) exigiriam
JS/markup — fora do mandato I2 (zero JS) → ficam na I11; accessible name do sino segue como
dívida rastreada (mandato I2 Gate 9 proíbe corrigir dívida não classificada para a fase).

## 7 · ROLLBACK
Remover a seção `CORE SHELL (I2)` do bloco (ou o bloco inteiro = rollback I1+I2). Nenhuma
outra referência existe. **A11Y-D01 (upload P0) segue GLOBAL IMPLEMENTATION BLOCKER** (I9+I11).
Próxima fase proposta após GO: **I3 — Boards F1–F5** (primeira superfície sobre o shell).
