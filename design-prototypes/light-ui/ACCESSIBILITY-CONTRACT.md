# ACCESSIBILITY CONTRACT — LIGHT UI (R9)

**Status:** ENTREGUE (R9) — aguarda owner; NÃO concluída. Fonte funcional: Desktop **1.0.246**.
**Natureza:** fase READ-ONLY (auditoria + spec + contrato de implementação futura). **ZERO
implementação**: nenhum ARIA adicionado ao produto, nenhum tabindex alterado, nenhum keyboard
corrigido, nenhuma cor trocada, nenhum modal modificado, nenhum Golden alterado. **ZERO imagem
nova.** Implementação Light UI segue **NÃO AUTORIZADA**.

## 1 · OBJETIVO
Especificação transversal final de acessibilidade do Light UI, separando SEMPRE três categorias:
- **[A] COMPROVADO** — existe no código real 1.0.246 (com linha/prova);
- **[B] REQUIREMENT** — contrato do DS para a futura implementação Light;
- **[C] DÍVIDA** — barreira real do produto atual (registrada, NÃO corrigida nesta fase).

## 2 · ESCOPO
Shell, sidebar, header, kanban, cards, drawer, wizard, forms, calendário, notificações,
executivo, relatórios, login, modais, menus, toasts, tabelas, stat-tiles, empty states, loading —
sobre o renderer real + contratos C1–C8 + protótipos Golden + harness R8. Fora de escopo: portal
do cliente, superfícies A-futuras Electron, produção.

## 3 · METODOLOGIA
- **Code-based audit do renderer real** (13.034 linhas): greps sistemáticos por
  `keydown/keyup/keypress`, `tabindex`, `.focus()`, nomes de tecla, `aria-*`, `role=`,
  `setAttribute('role'/'aria-…')`, `<label>/for`, `autocomplete`, `alt=`, `type="file"`,
  `prefers-reduced-motion`, `forced-colors/prefers-contrast/-ms-high-contrast`,
  `scope=/<caption`, `alert(/confirm(` — cada achado citado com linha.
- **Contraste**: cálculo WCAG real (luminância relativa sRGB) sobre os hex dos tokens Golden
  (`:root` do frame V10) — nada foi "estimado no olho". Baseline: 4.5:1 texto normal · 3:1 texto
  grande (≥24px ou ≥18.66px bold) · 3:1 componentes/foco.
- **Automated audit**: axe-core **4.13.0** (dependência TEMPORÁRIA instalada só no
  scratchpad/harness de design — NADA em produção), injetado via Playwright, config
  `runOnly: wcag2a + wcag2aa + wcag21aa`, viewport 1366×768, sobre os protótipos
  (cópias r8). **Limite declarado:** o produto real (Electron+Firebase) não é executável neste
  ambiente ⇒ axe rodou nos protótipos como proxy do DS; o produto real foi coberto pela
  auditoria de código acima. Automated ≠ substituto de auditoria manual (keyboard/foco/fluxos).
- `<html lang="pt-BR">` **[A]** comprovado no documento real (idioma declarado).

## 4 · MATRIZ GLOBAL DE ACESSIBILIDADE

| Componente/Surface | Keyboard | Focus | Semantics | ARIA | Contrast | Motion | Status |
|---|---|---|---|---|---|---|---|
| Shell (nav/main/headings) | — | — | PARCIAL (1 `<nav>`, 0 `<main>`, h1×2) | REQUIREMENT | — | — | REQUIREMENT |
| Sidebar (sb-item/sb-user) | COMPROVADO (`<button>`) | COMPROVADO (regra global) | COMPROVADO | REQ (aria-current) | PASS (9.6–11:1) | SEM OVERRIDE (hover) | PARCIAL |
| Header (back/bell/SLA) | COMPROVADO (buttons) | COMPROVADO | COMPROVADO | PARCIAL (sino s/ nome provado) | sla-k FAIL 3.08 | — | PARCIAL |
| Kanban (tcv4/kbv2) | COMPROVADO (ações = buttons) | COMPROVADO | card=div, ações=button | title só no ⋯ | PASS núcleo | menu s/ override | PARCIAL |
| Cards evento (.evc) | COMPROVADO (Enter/Espaço 12131) | COMPROVADO | role=button+tabindex=0 | aria-label dinâmico | PASS | COMPROVADO (204) | COMPROVADO |
| priCard | **DÍVIDA** (div s/ teclado, 5347) | ausente | div clicável | ausente | PASS | — | DÍVIDA |
| Drawer (wfap) | Escape COMPROVADO (7937) | tabindex=-1 focável | role=dialog | aria-modal+label | PASS | COMPROVADO (7843) | COMPROVADO |
| Wizard (F7) | inputs nativos | COMPROVADO | labels s/ for/id | vqty aria-label ✓ | PASS núcleo | — | PARCIAL |
| Forms (C1) | nativo | COMPROVADO (C1 halo) | label s/ associação | aria-invalid/describedby ZERO | ver §12 | — | PARCIAL |
| Calendário (agcell) | COMPROVADO (`<button>` 6128) | COMPROVADO | button | nome=só nº do dia (REQ) | dias dim FAIL | — | PARCIAL |
| Central Notificações (nc-row) | **DÍVIDA** (divs 5726) | ausente | div clicável | ausente | PASS núcleo | — | DÍVIDA |
| Executivo (stat/filtros) | COMPROVADO (`<button class="stat">` 5831) | COMPROVADO | buttons | REQ (pressed/current) | orange FAIL | hover-lift s/ override | PARCIAL |
| Relatórios (tabela) | — | — | `<table>` real (C7) | scope/caption ZERO | tx-4 th FAIL 2.21 | — | PARCIAL |
| Login | **DÍVIDA** (Enter não submete) | COMPROVADO | s/ `<form>`; label s/ for | autocomplete ✓ | PASS (axe=0) | — | PARCIAL |
| Modais (4 sheets nomeados) | traps COMPROVADOS (6006/8377) | inicial+retorno (evd) | role=dialog ×4 | aria-modal ×4 | PASS | PARCIAL | PARCIAL |
| Modais genéricos (modalRoot) | s/ trap | s/ foco inicial provado | s/ role | ausente | — | — | REQUIREMENT |
| Menus (evd/tcv4/kbv2) | Escape ✓ · arrows ZERO | focus-visible danger ✓ (1144) | itens `<button>` | evd: menu/menuitem ✓ | PASS | tcv4MenuIn s/ override | PARCIAL |
| Toasts (notif-stack) | Enter/Espaço ✓ (4751) | X focus-visible | role=status | aria-live=polite ✓ (4459) | dark scheme próprio | COMPROVADO (4528) | COMPROVADO |
| flashToast | — | — | div | **sem aria-live** (10049) | — | — | DÍVIDA |
| Stat-tiles (Hoje) | COMPROVADO (button) | COMPROVADO | button | — | PASS | hover-lift s/ override | COMPROVADO |
| Empty states (C4) | n/a (zero CTA) | n/a | texto | — | tx-3 borderline | — | N/A |
| Loading (C5) | — | — | rev-send: disabled+texto | aria-busy ×1 ✓ (11578) | — | spinner reduced ✓ (125) | PARCIAL |
| Upload (pr-drop) | **DÍVIDA P0** (input hidden, 9217) | não focável | label envolvente ✓ | — | — | — | DÍVIDA |
| RTE | link Enter/Esc ✓ (11014) · paste ✓ | devolve foco ✓ | role=toolbar/textbox ✓ | labels ✓ · pressed ZERO | PASS | — | PARCIAL |

## 5 · KEYBOARD (inventário real)

Handlers keydown no renderer: **14**. Teclas com suporte real: `Enter` ×3 contextos ·
`Espaço` (via `k!==' '`) ×2 · `Escape` ×3 · `Tab` (traps) ×2 · `Ctrl/Cmd+V`/`Shift+Ins`
(paste) · `Ctrl+Shift+D` (debug). **ZERO** `ArrowUp/Down/Left/Right`, `Home`, `End` em todo o
arquivo. `tabindex="0"` ×3 (toast CTA ×2 + `.evc`) · `tabindex="-1"` ×21 · `.focus()` ×43.

| Componente | Tab | Enter | Espaço | Escape | Arrows | Resultado |
|---|---|---|---|---|---|---|
| Sidebar/bottom-nav | ✓ (button) | ✓ nativo | ✓ nativo | — | ✗ | [A] COMPROVADO |
| Stat-tile | ✓ (button) | ✓ | ✓ | — | ✗ | [A] COMPROVADO |
| Botões/steppers (vqty) | ✓ | ✓ | ✓ | — | ✗ | [A] COMPROVADO (aria-label + disabled) |
| Inputs/select/checkbox | ✓ nativos | ✓ | ✓ | — | nativas | [A] nativo |
| Dia do calendário | ✓ (`<button data-day>`) | ✓ | ✓ | — | ✗ (grid nav) | [A] parcial · [B] grid arrows opcional |
| Kanban card (ações) | ✓ (3 buttons) | ✓ | ✓ | menu: ✓ | ✗ | [A] COMPROVADO via botões |
| priCard | ✗ | ✗ | ✗ | — | — | **[C] DÍVIDA (A11Y-D03)** |
| Card evento (.evc) | ✓ | ✓ (12131) | ✓ | — | — | [A] COMPROVADO |
| nc-row / "Abrir tarefa" (F9 real) | ✗ (divs) | ✗ | ✗ | — | — | **[C] DÍVIDA (A11Y-D04)** |
| Menus (trigger ⋯) | ✓ (button) | ✓ | ✓ | ✓ fecha+devolve foco (12117–12124) | ✗ | [A] parcial · [B] arrows |
| Ações de modal | ✓ (buttons) | ✓ | ✓ | evd/det/wf ✓ · genéricos ✗ | — | PARCIAL |
| Acordeões (`<details>`) | ✓ nativo | ✓ | ✓ | — | — | [A] COMPROVADO (nativo) |
| RTE | ✓ | link field ✓ (11014) | — | ✓ devolve foco | ✗ toolbar | PARCIAL |
| Tabela | scroll do card | — | — | — | — | leitura pura |
| Toast CTA/X | ✓ (tabindex=0) | ✓ (4751) | ✓ | — | — | [A] COMPROVADO |
| Login (liId/liPw) | ✓ | **✗ não submete** | — | — | — | **[C] DÍVIDA (A11Y-D02)** |
| ts-auth (senha) | ✓ | ✓ (3022) | — | handler próprio; backdrop=cancela | — | [A] COMPROVADO |
| Upload (pr-drop) | **✗ input hidden** | ✗ | ✗ | — | — | **[C] DÍVIDA P0 (A11Y-D01)** |

**[B] Requirements:** Enter submete login; priCard/nc-row = `<button>`/role+tabindex+handler;
upload focável; arrows em menus com `role=menu`; toolbar RTE com navegação por setas.

## 6 · FOCUS

- **[A]** Regra global real: `body.desktop button/.inp:focus-visible` outline 2px accent
  (~linha 1324) — C8 §focus. Golden C1: `#6E5EF3` + halo 11%.
- **[A]** Variante danger real: `.tcv4-menu-it:focus-visible{outline:2px solid
  rgba(248,113,113,.55)}` (1144) — especialização legítima documentada.
- **[A]** Ratio do anel de foco: 4.61 (surface) / 4.26 (canvas) ⇒ ≥3:1 **PASS**.
- **[A]** Devolução de foco comprovada: Escape no menu evd devolve ao botão ⋯ (12124); erro do
  ts-auth devolve ao campo de senha; RTE devolve ao editor.
- **Ordem de foco:** DOM = ordem visual nos frames (drawer F1 no fim do DOM = à direita —
  coerente); modais em `#modalRoot` (fim do body) — seguro APENAS com trap; sem problemas de
  ordem detectados nos protótipos.
- **[B] PRINCÍPIO ÚNICO:** *todo controle interativo tem foco visível* — o halo Golden por
  padrão; variantes já documentadas em foundation (danger, sidebar) permanecem válidas.

## 7 · SEMANTIC HTML

- **[A]** `<button>` real na grande maioria: sidebar, stats, agcell, ações tcv4/kbv2, vqty,
  toggle "Mostrar", slaib-open, itens de menu, toolbar RTE.
- **[A]** `<details>/<summary>` nativos (acordeões da Central de Detalhes, "Detalhes do fluxo").
- **[A]** `<table>` semântica ×3 (C7); `<label>` ×24; `<html lang="pt-BR">`.
- **[C]** DIVs interativos sem papel: `pri-card` (5347), `nc-row`/`nc-open` (5726+). Exceção
  mitigada: toast `ntfp-pill` é div **com** `role="button" tabindex="0"` (4671) — padrão aceito.
- **Landmarks/headings reais:** `<nav>` ×1 (bottomNav), `<main>` ×0, `<h1>` ×2, `<h3>` ×1.
- **[B]** Light UI: `nav` (sidebar), `main` (conteúdo), 1 `h1`/tela + hierarquia h2/h3; todo
  interativo = `<button>`/`<a>` (nunca div clicável novo).

## 8 · ARIA INVENTORY (real, contagens exatas)

| Atributo/role | Qtde | Onde (exemplos com linha) |
|---|---|---|
| aria-label | 42 (+5 setAttribute) | "Fechar" ×5 · "Aumentar/Diminuir quantidade" ×6 (11424) · "Copiar tema/legenda/observações" ×5 · "Abrir tarefa" ×2 · RTE ("Formatação", "Cor do texto", "Marca-texto", "Estilo de parágrafo", "Tamanho do texto") · dialogs (§10) |
| aria-hidden | 16 | ícones decorativos (setas "→", dots) |
| aria-modal | 4 | ts-auth (2992) · evd-sheet (6072) · wfap-panel (7890) · det-sheet (8429) |
| aria-expanded | 4+3 setAttr | botão ⋯ evd (6062) · menus |
| aria-live | 2 | notif-stack polite (4459) · det-note-ed-msg (12211) |
| aria-haspopup | 1 | ⋯ evd (6062) |
| aria-busy | 1 | rev-send "Salvando cronograma…" (11578) |
| aria-multiline | 1 | RTE textbox |
| role=dialog | 3+1 setAttr | os 4 acima |
| role=button | 3+1 | ntfp-pill ×2 (4671) · .evc (5890) |
| role=alert | 3 | erros inline (R2) |
| role=status | 1 setAttr | notif-stack (4459) |
| role=menu/menuitem | 1/2 | evd-menu (6062) |
| role=toolbar/textbox/img | 1/1/1 | RTE · logo |
| **aria-selected / aria-current / aria-pressed / aria-invalid / aria-describedby / aria-labelledby** | **0** | reconfirmado (R6) — vira REQUIREMENT, nunca "comprovado" |

## 9 · SELECTED / CURRENT / ACTIVE (requirements semânticos por componente)

C8 congelou o visual; semântica futura decidida componente a componente (nada aplicado agora):

| Componente | Estado visual (C8) | Semântica futura [B] |
|---|---|---|
| Sidebar item ativo | `.on` | `aria-current="page"` |
| Tabs de visão (Meu quadro/Cliente/…) | `.on.tab` | `role=tablist/tab` + `aria-selected` OU `aria-current` (decidir na implementação; NÃO ambos) |
| Segmented (Hoje/7/30/Tudo) | `.seg .on` (DS Golden; real não tem segmented) | grupo com `aria-pressed` por botão OU radiogroup |
| Dia selecionado (agenda) | `agcell-sel` | `aria-selected="true"` + nome completo do dia |
| Wizard step atual | "ETAPA ATUAL" | `aria-current="step"` |
| Filter chips (responsável/tipo) | accent sólido | `aria-pressed` |
| Toggle "Mostrar/Ocultar" senha | texto muda | dispensa `aria-pressed` (estado JÁ é textual) — [A] |
| Unread (F9) | dot+fundo | texto acessível "não lida" (§14) |

## 10 · FORMS & LABELS

- **[A]** `autocomplete` correto: `email` ×1, `current-password` ×3, `new-password` ×2, `off` ×3.
- **[A]** Password reveal = `<button class="toggle">Mostrar/Ocultar` — botão real com estado
  TEXTUAL visível (3160/3184). Alvo 34px de altura.
- **[C]** **ZERO `for`/`id`** nos 24 `<label>` (login incluído: label irmão do input, 3162) —
  associação programática ausente (**A11Y-D12**); única associação implícita real: label
  envolvente do upload (9217).
- **[C]** `aria-invalid`/`aria-describedby`: **ZERO** no produto.
- **[A]** Erro inline com `role="alert"` (R2, cq/sq err) — mas SEM associação ao campo.
- **[B]** Light: label sempre associado (for/id ou envolvente); erro = `aria-invalid="true"` +
  `aria-describedby` apontando o texto do erro; placeholder NUNCA é o único rótulo; helper
  associado por describedby; required comunicado textualmente (produto não usa asterisco hoje).

## 11 · ERRORS
- **[A]** `role=alert` ×3 (inline R2); toasts de erro via stack `role=status aria-live=polite`.
- **[C]** `alert()` ×34 / `confirm()` ×2 nativos — anúncio fica por conta do SO (funciona em
  leitor de tela, mas é a dívida UX já registrada; NÃO converter em toast nesta fase).

## 12 · CONTRAST (cálculo WCAG real — luminância sRGB dos tokens Golden)

> **R9.1:** os FAILs desta tabela receberam ERRATA CANDIDATA com prova numérica —
> `ACCESSIBILITY-TOKEN-ERRATA.md` (tx-3′ 4.91/4.54 · tx-4′ 4.52+regra · brand-ink 6.06 ·
> grad′ 4.73 · sla-k→green-ink 5.01 · sb-faint′ 4.74 · inks globais 5.02–7.02 · borda de
> input justificada). Aguarda GO do owner.

| Par (fg/bg) | Ratio | Critério | Status | Uso real |
|---|---|---|---|---|
| tx-1 #14181F / surface | **17.79** | 4.5 | PASS | corpo/títulos |
| tx-1 / canvas | 16.47 | 4.5 | PASS | |
| tx-2 #4B5364 / surface | **7.72** | 4.5 | PASS | secundário |
| tx-2 / canvas | 7.14 | 4.5 | PASS | |
| tx-3 #767E8D / surface | **4.09** | 4.5 | **FAIL** | soft/placeholder 13–13.5px |
| tx-3 / canvas | 3.78 | 4.5 | FAIL | |
| tx-4 #A8AFBC / surface | **2.21** | 4.5 | **FAIL** | th tabela 10.5px · metas 11–12px |
| tx-4 / canvas | 2.04 | 4.5 | FAIL | |
| brand #5B7CFA / surface (texto) | 3.68 | 4.5 | **FAIL** | links 12.5–14px ("Abrir tarefa", "Mostrar") |
| brand como componente/ícone | 3.68 | 3 | PASS | bordas/ícones |
| blue-ink #2563EB / surface | 5.17 | 4.5 | PASS | links exec |
| green-ink #12784C / surface | 5.50 | 4.5 | PASS | |
| green #22A06B / surface (texto) | 3.33 | 4.5 | FAIL | usar green-ink p/ texto |
| red #EF4444 / surface (texto) | 3.76 | 4.5 | FAIL (large: PASS 3:1) | números KPI grandes OK; texto pequeno não |
| orange #F59E0B / surface | **2.15** | 3 (large) | **FAIL até large** | número KPI laranja (F10/F11) |
| nc-unread #B23636 / tint 9% | 5.38 | 4.5 | PASS | |
| sla-k #3E9C74 / #E8F8F0 | 3.08 | 4.5 | FAIL | micro-label 9.5px b800 |
| sla-v #115E3D / #E8F8F0 | 7.10 | 4.5 | PASS | "Tudo em dia" |
| branco / grad stop #6E5EF3 | 4.61 | 4.5 | PASS | CTA (stop escuro) |
| branco / grad stop #9A6BF5 | 3.62 | 4.5 | **FAIL** | CTA (pior stop) |
| branco / brand #5B7CFA | 3.68 | 4.5 | FAIL | tab ativa 13.5px |
| sb-tx #D0D5E1 / sb-2 | **11.01** | 4.5 | PASS | nav sidebar |
| sb-dim #9299AC / sb-1 | 4.94 | 4.5 | PASS | section labels |
| sb-faint #727990 / sb-2 | 3.74 | 4.5 | FAIL | "CEO · admin" 12px |
| focus #6E5EF3 / surface·canvas | 4.61·4.26 | 3 | **PASS** | anel de foco |
| inp border #DFE3EB / surface | 1.29 | 3 (UI) | FAIL | borda de input (mitigada por label) |

**Leitura honesta:** o núcleo essencial (conteúdo tx-1/tx-2, valores, nav sidebar, CTA sobre o
stop escuro, anel de foco) **PASSA**. Os FAILs concentram-se em texto suave/meta/micro-labels
(tx-3 borderline 4.09; tx-4 2.21; brand-como-texto; orange; sla-k; sb-faint) e no pior stop do
gradiente. **Nenhum classificado A11Y-P0 de design**: em todos os casos a informação essencial
tem portador que passa (valor da célula tx-2; rótulo textual adjacente; stop escuro sob a área
inicial do texto; redundância no Perfil) e workaround por zoom existe — mas são **design debts
formais** (D05–D10) que o owner pode endereçar numa **microfase opcional de tokens** antes do
R11 (ex.: tx-3→≈#6E7686 ~4.7:1 · tx-4→≈#8A92A3 ~3.4:1 p/ 10.5px b700 th, ou th em tx-3 · texto
laranja→#B45309). Exemplos documentais — NADA foi alterado.

## 13 · COLOR NOT SOLE INDICATOR

| Estado | Portador real além da cor | Veredito |
|---|---|---|
| Status/severity (pills, F9/F10/F11) | rótulo textual ("CRÍTICO", "Atrasadas 3") | [A] OK |
| SLA rail F1 / banners | texto + ícone | [A] OK |
| Progress | número % textual | [A] OK |
| Selected (dia, chips, nav) | forma/peso + posição; sem semântica | [B] §9 |
| Unread (F9) | dot + fundo tint — SEM texto | **[C] D14** |
| **Dots do calendário (tipo)** | **só cor** (6128: dots 5px, sem title/legenda/nome) | **[C] D13** — requirement: legenda/da célula um nome acessível com tipos; NADA inventado agora |
| Tabela severidade | pill textual | [A] OK |

## 14 · TARGET SIZE (dimensões reais medidas)

| Alvo | Tamanho | Referência 24×24 (WCAG 2.2 AA) |
|---|---|---|
| btn-primary/inp | 48/46px | OK |
| hd-bell 48 · hd-back 42 · tab/rchip/ag-new/nc-fl 44 · sino SLA real 38–40 · vqty 40×40 · evd-btn 40 · ex-fl 40 · nc-act 38 | ≥38 | OK |
| seg/ag-cancel/toggle "Mostrar"/sp-x 34 · evd-x 32 | 32–34 | OK |
| tcv4-btn 34 (28 no compact ≤660) | 28–34 | atenção no compact |
| col-add (Golden F1) 25×25 | 25 | limítrofe (P2) |
| **ntf-x (X do toast real) 20×20** | **20** | **FAIL 2.5.8 (D11)** |
| Dias do calendário | grid ≥60px | OK |
| Itens de menu (tcv4/kbv2-menu-it) | ~38 de altura | OK |

**[B]** Requirement: nenhum controle novo abaixo de 24×24; X de toast ≥24 (área clicável pode
ser padding, mantendo o visual Golden).

## 15 · TABLES (3 tabelas reais + Golden F11)
- **[A]** `<table>/<thead>/<th>` semânticos; valores textuais; % com número visível.
- **[C]** `scope="col"` **ZERO** · `<caption>`/aria-label **ZERO** (reconfirma C7 §a11y).
- **[B]** Requirement C7: `scope="col"` em todos os th; `caption` (visually-hidden ok) ou
  `aria-label` na table; th nunca só-cor; barra de % sempre com texto (já real).

## 16 · MENUS
- **[A]** evd-menu: `role=menu` + `role=menuitem` + trigger com `aria-haspopup/aria-expanded`
  (6062); abre p/ cima ancorado no sheet. Card menus (tcv4/kbv2): itens `<button>`, container
  SEM role; portal + clamp de viewport + autocalibração DPI (12390–12404) — R8 §11.
- **[A]** Escape fecha e DEVOLVE o foco ao ⋯ (12117–12124); fecha em scroll/resize (12116).
- **ZERO** navegação por setas/Home/End (nenhum handler Arrow no arquivo).
- **[B]** Requirements: manter `role=menu` ⇒ adicionar ArrowUp/Down + Home/End + foco no 1º
  item ao abrir; OU rebaixar para popover de botões (sem role=menu) — decidir na implementação;
  return focus obrigatório (já real no evd).

## 17 · TOASTS / LIVE REGIONS

| Feedback | role | live | teclado | dismiss | Status |
|---|---|---|---|---|---|
| notif-stack premium | status (4459) | polite | Enter/Espaço CTA e X (4751) | X aria-label "Fechar notificação"; TTL 11/8/6s | [A] COMPROVADO |
| flashToast | — | **ausente** (10049) | — | timeout 2.6s | **[C] D17** → [B] `aria-live=polite` |
| sla-notif (canal SLA) | — | não provado | botões reais | — | PARCIAL |
| Erro inline | alert | implícito | — | — | [A] |
| alert()/confirm() nativos | SO | SO | SO | SO | [C] dívida UX (não converter) |
| Status lines (rodapés) | — | — | — | estático | N/A |

## 18 · LOADING
- **[A]** rev-send: `disabled` + `aria-busy="true"` + TROCA TEXTUAL ("Salvando cronograma…") —
  o padrão de referência do produto (11578).
- **[A]** spinner respeita reduced-motion (125); **[C]** spinner sem nome acessível/role.
- **[B]** Requirement transversal: TODO processamento perceptível além da animação —
  preferência pelo padrão real (disabled + texto + aria-busy); spinner isolado ganha
  `role=status` + texto (visually-hidden ok). Splash: tem texto visível (C5) — OK.

## 19 · MOTION
- **[A]** `prefers-reduced-motion` ×6 blocos reais: spinner (125) · .evc (204) · evd-btn/x
  (1307) · slamon orb (3648) · ntf/ntfp (4528) · wfap scrim/panel (7843).
- **SEM OVERRIDE** (registrado, não corrigido): hover-lift (.stat/.bcard translateY 1320–1321),
  tcv4MenuIn (1136), transições de modal-back/sheet genéricos, flash-toast.
- **[B]** Requirement transversal único (SEM criar foundation de motion — C8): toda
  animação/transição decorativa do Light respeita `prefers-reduced-motion:reduce`.

## 20 · ICON-ONLY CONTROLS (screen reader text)

| Controle | Nome acessível real | Status |
|---|---|---|
| X de modais/sheets | aria-label "Fechar" ×5 / "Fechar detalhes" | [A] |
| X do toast | "Fechar notificação" | [A] |
| ⋯ dos cards | `title="Mais ações"` (só title) | PARCIAL → [B] aria-label |
| ⋯ do evd | aria-label "Mais opções" + haspopup/expanded | [A] |
| +/− quantidade | "Aumentar/Diminuir quantidade" ×6 | [A] |
| Copiar (tema/legenda/obs) | aria-label ×5 | [A] |
| Sino SLA (slaib-bell) | não comprovado | [B] requirement |
| Setas de navegação do calendário/período | não comprovado | [B] requirement |
| "+" de coluna (Golden col-add) | mockup sem nome (axe button-name) | [B] requirement |
| Remover arquivo (F13) | não comprovado | [B] requirement |
| Ícones decorativos (→, dots) | aria-hidden ×16 | [A] |

## 21 · IMAGES / AVATARS
- **[A]** `avatar()` = div com background-image OU iniciais TEXTUAIS (fallback legível); alt
  ×4 no produto (1 decorativo `alt=""`, 1 dinâmico, 2 descritivos).
- **[B]** Contrato: avatar acompanhado do nome em texto adjacente = decorativo
  (`aria-hidden="true"`); avatar sozinho (stack, filtro) = `aria-label` com o nome; NUNCA
  transmitir cargo/status só pelo alt. **Arte do F13 = CONTEÚDO** (verificação visual da
  entrega) ⇒ preview precisa de nome acessível ("Arte Feed do conteúdo N — nome-do-arquivo"),
  nunca `alt=""`.

## 22 · FILE UPLOAD (F13)
- **[A]** `<label class="pr-drop"><input type="file" accept="image/*" … hidden>` (9217) —
  associação implícita correta, acionável por MOUSE.
- **[C] A11Y-D01 (P0 implementação):** o atributo `hidden` tira o input da árvore de foco/AT —
  **não existe caminho de teclado para anexar arte**, função essencial do fluxo.
- **[B]** Requirement: input visualmente oculto porém FOCÁVEL (padrão sr-only/clip), Enter/
  Espaço acionam, foco visível no slot, nome do arquivo anunciado após seleção, botão remover
  com aria-label, erro de upload textual associado. Drag-drop NÃO existe — não inventar.

## 23 · RTE (editor de legendas)
- **[A]** `role="toolbar"` + botões/selects com aria-label ("Formatação", "Cor do texto",
  "Marca-texto", "Estilo de parágrafo", "Tamanho do texto") · editor `role="textbox"
  aria-multiline` com aria-label · campo de link: Enter aplica, Esc fecha e devolve foco
  (11014) · paste acessível Ctrl/Cmd+V e Shift+Ins (11677/11766).
- **[C]** Toggles (negrito/itálico/…) sem `aria-pressed`; toolbar sem navegação por setas.
- **[B]** Requirements: aria-pressed nos toggles; roving tabindex/arrows na toolbar; anúncio
  de estado dos seletores de cor (nome da cor, não só amostra).

## 24 · RESPONSIVE A11Y (sobre o R8 aprovado)
Reconfirmado sobre as 19 capturas + código: nenhum alvo reduzido, nenhum token de texto
reduzido, foco nunca em região cortada (scrolls controlados), menus com clamp de viewport no
código real, toast ≤94vw no código real, footers/CTAs acessíveis nos 18/18 PASS. A 125% os
alvos FÍSICOS crescem 25% (favorece motor/visão). **Guardrail estrutural do R8** (P0):
`.main>*`, `.hd>*`, `.page>*` e equivalentes com `min-width:0` na implementação — sem isso o
shell corta Monitor SLA/sino/toolbar a 1093 DIP (é guardrail de implementação, NÃO mudança de
design).

## 25 · FORCED COLORS / HIGH CONTRAST
`forced-colors` / `prefers-contrast` / `-ms-high-contrast`: **ZERO** no código real e nos
protótipos (registrado). **[B]** Candidato P2 futuro: sob `forced-colors:active`, garantir
bordas/foco/estado visíveis (não urgente para o closure; owner decide).

## 26 · ZOOM (limite de escopo)
Validado: DPI Windows 125% (R8, GO). **Browser zoom arbitrário (ex.: 200%) NÃO testado — não
declarado.** O closure exige 1366+125%; teste de 200% fica como requirement de implementação.

## 27 · AUTOMATED AUDIT (axe)
- Ferramenta: **axe-core 4.13.0** · Playwright/Chromium · `runOnly: [wcag2a, wcag2aa,
  wcag21aa]` · viewport 1366×768 · protótipos r8 (F1, F7C, F8, F9, F11, F12, F13).
- Dependência instalada APENAS no scratchpad do harness (fora do repo/produção).

| Protótipo | Violações |
|---|---|
| F1 | button-name (10: hd-back, hd-bell, col-add ×4…) · color-contrast (18) |
| F7C | button-name (2) · color-contrast (10) · label (1) |
| F8 | button-name (3) · color-contrast (37 — dias dim) |
| F9 | color-contrast (16) |
| F11 | button-name (1) · color-contrast (34 — th/meta tx-4) |
| **F12** | **ZERO** |
| F13 | button-name (4) · color-contrast (4) |

Interpretação: `button-name` = botões só-ícone dos MOCKUPS sem nome (no produto real vários já
têm aria-label — §20); vira requirement transversal, não defeito novo. `color-contrast` =
exatamente os pares FAIL do §12 (tx-3/tx-4/brand/orange). **Limitação declarada:** axe sobre
protótipos mede o HTML do mockup — o produto real foi coberto por auditoria de código.

## 28 · A11Y DEBT REGISTER (única fonte; referencia dívidas funcionais já registradas)

| ID | Sev | Superfície/Comp. | Problema provado (linha) | Design/Impl | Requirement |
|---|---|---|---|---|---|
| A11Y-D01 | **P0** | Upload F13 | input file `hidden` sem caminho de teclado (9217) | Implementação | input focável + Enter/Espaço + anúncio (§22) |
| A11Y-D02 | P1 | Login | Enter não submete (sem `<form>`, sem handler em liId/liPw; ts-auth TEM — 3022) | Implementação | submit por Enter (F12 já registrara) |
| A11Y-D03 | P1 | Prioridades | priCard div clicável sem role/tabindex/teclado (5347) | Implementação | button/role+tabindex+Enter/Espaço (R7 reconfirmado) |
| A11Y-D04 | P1 | Central Notificações | nc-row/nc-open divs sem teclado (5726–5732) | Implementação | linha e CTA focáveis |
| A11Y-D05 | P1 | Tabelas/metas | tx-4 2.21:1 (th 10.5px; metas) | **Design** | **RESOLVIDA NO DESIGN — errata R9.1 E2 (tx-4′ 4.52 + regra de superfície), aguarda GO** |
| A11Y-D06 | P1 | KPIs | orange #F59E0B 2.15:1 (falha até large) | **Design** | **RESOLVIDA — auditado: KPIs Golden já usam #B45309 (5.02); regra ink formalizada (errata E7), aguarda GO** |
| A11Y-D07 | P1 | Links | brand #5B7CFA como texto 3.68:1 | **Design** | **RESOLVIDA NO DESIGN — errata E3 (brand-ink #4353D8 · 6.06), aguarda GO** |
| A11Y-D08 | P2 | Texto soft | tx-3 4.09:1 (borderline) | Design | **RESOLVIDA NO DESIGN — errata E1 (tx-3′ #697181 · 4.91/4.54), aguarda GO** |
| A11Y-D09 | P2 | CTA grad | branco 3.62:1 no stop claro | Design | **RESOLVIDA NO DESIGN — errata E4 (stop→#8356E6 · 4.73), aguarda GO** |
| A11Y-D10 | P2 | Micro-labels | sla-k 3.08 · sb-faint 3.74 · inp border 1.29 (UI) | Design | **RESOLVIDA — errata E5/E6 (green-ink 5.01 · sb-faint′ 4.74+migração topo); borda de input MANTIDA c/ justificativa técnica E9. Aguarda GO** |
| A11Y-D11 | P1 | Toast X | ntf-x 20×20 < 24×24 (4482) | Impl.+Design | **CONTRATO CORRIGIDO — errata E10 (hit 28×28, glyph intacto), aguarda GO**; aplicação no produto = implementação |
| A11Y-D12 | P1 | Forms | 24 `<label>` sem for/id (3160/3162) | Implementação | associação obrigatória (§10) |
| A11Y-D13 | P2 | Calendário | dots de tipo só-cor (6128) | Impl.+Design | **VISUAL RESOLVIDO — errata E11 (cor+forma+legenda), aguarda GO**; nome acessível do dia = implementação |
| A11Y-D14 | P2 | Notificações | unread sem texto acessível | Implementação | "não lida" sr-only |
| A11Y-D15 | P2 | Estados | 0 aria-selected/current/pressed | Implementação | §9 por componente |
| A11Y-D16 | P2 | Menus | sem arrows/Home/End; tcv4/kbv2 sem role=menu | Implementação | §16 |
| A11Y-D17 | P2 | flashToast | sem aria-live (10049) | Implementação | polite |
| A11Y-D18 | P2 | Loading | spinner sem nome/role | Implementação | §18 |
| A11Y-D19 | P2 | Modais genéricos | modalRoot sem role=dialog/aria-modal/trap (4 sheets nomeados TÊM) | Implementação | contrato §4/C2 |
| A11Y-D20 | P2 | Tabelas | scope/caption ZERO | Implementação | C7 §a11y |
| A11Y-D21 | P2 | Motion | hover-lift/menus/modais sem reduced-motion | Implementação | §19 |
| A11Y-D22 | P2 | Forced colors | zero suporte | Implementação | §25 (opcional) |
| A11Y-D23 | P2 | Ícones-only | sino SLA/setas calendário/⋯ (title-only)/remover arquivo sem nome provado | Implementação | §20 |
| A11Y-D24 | P2 | Avatares/artes | sem contrato de alternativa textual | Implementação | §21 |
| A11Y-D25 | P2 | Shell | 0 `<main>`, headings mínimos | Implementação | §7 |

**Gates:** Design P0 = **NÃO** (justificativas §12/§13/§14). Implementation P0 = **SIM (D01)** —
vira **IMPLEMENTATION GUARDRAIL** (com D02–D04, D11, D12 e o guardrail min-width:0 do R8) sem
reabrir Golden. Gap visual material = **NÃO** (zero prancha nova). Nova superfície = **NÃO**.

## 29 · IMPLEMENTATION GUARDRAILS (bloqueiam merge da futura implementação, não o design)
1. Upload acessível por teclado (D01 — P0).
2. Enter submete login (D02) · priCard/nc-row com teclado (D03/D04).
3. Labels associados + erro com aria-invalid/describedby (D12/§10).
4. Toast X ≥24×24 de área clicável (D11).
5. `min-width:0` nas linhas de grid do shell (achado P0 do R8 — corta SLA/sino/toolbar).
6. Focus visível universal (§6) · modais com foco/trap/retorno/role (§4, D19).
7. aria-live no flashToast (D17) · reduced-motion transversal (§19).
8. Semântica de selecionado por componente (§9) · tabelas com scope/caption (D20).

## 30 · CLOSURE CRITERIA (R9)
R9 fecha quando o owner: (a) aceitar este contrato como spec oficial de a11y do Light UI;
(b) decidir sobre a microfase OPCIONAL de tokens de contraste (D05–D10) — antes do R11 ou como
dívida assumida; (c) ratificar os guardrails §29. **Nada disso autoriza implementação.**
