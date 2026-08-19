# C3 — MENUS / DROPDOWNS / POPOVERS · FOUNDATION CONTRACT (Light UI)

**Status:** **FOUNDATION OFICIAL / GOLDEN** — aprovada pelo owner (R5 = GO; prova visual
R5.1 `5959ae0`). Congelada; alterações só com autorização do owner. A prancha mostra os DOIS menus ABERTOS
(ancorado do detalhe de evento + card ⋯ portal) na mesma família visual, com itens/literais/
a11y reais e requirements pendentes anotados. Fonte: Desktop
**1.0.246** (renderer integral). Zero produção; zero imagem nova. Nome formal: MASTER-SURFACE-MAP §F.

## 1 · OBJETIVO / ESCOPO
Congelar os padrões REAIS de menu/popover do renderer. Fora do escopo: `<select>` estilizado
(**SELECT C1 ≠ MENU C3** — nc-fl/exec-fl são selects nativos C1), menu NATIVO Electron
(`editContextMenu.ts` — fora do CSS do renderer; fase própria se um dia for redesenhado),
tooltips nativos, drawer (boards Golden).

## 2 · INVENTÁRIO REAL (2 famílias)
| Componente | Origem | Estrutura | Trigger | Itens | Close | Keyboard | Anchor visual |
|---|---|---|---|---|---|---|---|
| **Menu do detalhe de evento ("Mais opções")** | `openEventDetail` 6062 | `.evd-menu` role=menu ancorado ACIMA do trigger (`bottom:calc(100%+8px)`), surface+line, r12, shadow 0 16 44 -12, pad 6, min-w 220, `.open` toggle, z-5 local | `.evd-btn.more` ⋯ com `aria-label="Mais opções"` + `aria-haspopup` + `aria-expanded` | `.evd-mi` role=menuitem (ícone+label); variante `.danger` ("Excluir definitivamente", SÓ admin; "Finalizar" por estado) | toggle no trigger; ação fecha | Escape/arrows NÃO comprovados no menu | NENHUM (nunca renderizado aberto nos Frames) |
| **Card menus ⋯ (boards)** | `closeCardMenus` 12109; comentário 5099 | `.tcv4-menu`/`.kbv2-menu` — **PORTAL movido ao `<body>`** quando `.open` (left/top calculados), devolvido ao host (`.tcv4-more`/`.kbv2-more`) no close | botão ⋯ do card (`data-cardmenu`) | ações do card | **scroll (capture) · resize · Escape (12117) · re-render (5099) · qualquer ação tratada** | Escape global ✔; arrows não | NENHUM |

## 3 · TAXONOMIA
Uma linguagem de popover (painel surface + hairline + r12 + shadow + itens ícone+label com
variante danger) em DUAS mecânicas reais: **ancorado local** (evd) e **portal no body** (cards).
Não criar dropdown/context-menu genéricos além destas.

## 4 · TOKENS (do real)
Painel: surface · border line · radius 12 · shadow 0 16px 44px -12px · padding 6 · min-width
220 · z-index 5 (local) / portal no body (cards). Item: ícone 16–18 + label; danger = ink
vermelho (#F87171 real → tokens Light). Posicionamento evd: acima do trigger +8px. Transições:
display none↔block (sem animação declarada).

## 5 · ESTADOS
default · open (`.open`) · item hover (real dark: tint leve) · danger. **Inexistentes:**
disabled de item, submenus, checkable items, focus de item estilizado — não inventar.

## 6 · A11Y — comprovado × requirement
**Comprovado:** role=menu/menuitem, aria-haspopup/expanded, aria-label no trigger (evd);
Escape fecha card menus (global). **Requirement (não existe; não declarar):** navegação por
setas, foco gerenciado nos itens, Escape no evd-menu, click-outside dedicado (fechamentos reais
são scroll/resize/Escape/re-render/ação).

## 7 · RESPONSIVIDADE / DEPENDÊNCIAS / DÍVIDAS / GAP
1366×768/125% = requirement (R8). C3 consome tokens C1 (tipografia/ícones/cores). Dívidas:
keyboard incompleto; click-outside implícito. **GAP VISUAL C3 = FECHADO na R5.1** (Transversal Anatomy
Board — evd-menu e card ⋯ portal abertos). **CONGELADA (GO do owner).**

## 8 · GUARDRAILS
Não transformar selects em menus; não redesenhar o menu nativo Electron nesta trilha; manter
mecânica portal dos card menus; danger nunca vira item comum.
