# LIGHT UI — I2.2 CORE SHELL FINAL CLEANUP REPORT

**Fase:** I2.2 — último gate da I2 (corner-avatar + semantic brand name) · **Status:**
ENTREGUE — aguarda owner. **Branch:** `impl/light-ui-core-shell-final-1.0.246` (base EXATA
`c368a6c2` = I2.1). **Commit:** `0d107dea` · version **1.0.246 intacta** · zero build/release
· nenhum PR · checkpoints I1/I2/I2.1 intactos.

## 1 · GATE 1 — CORNER AVATAR AUDIT (integral)
| Aspecto | Achado |
|---|---|
| Markup | `button#cornerAvatar.corner-avatar.topav-btn[data-tab=perfil][title="Abrir perfil"]` com `avatar(state.user,38)` |
| Criação | `slaibRefresh()` (produção), gate `isDesktop() && isOperationalBoardContext()`; removido fora do quadro |
| Handler/click | **Delegação global única `[data-tab]`** (~12578): `state.tab='perfil'` + `render()` — a MESMA rota do `.sb-user` |
| Keyboard | Botão nativo (Enter/Espaço → click delegado); nenhum listener próprio |
| Tooltip | `title="Abrir perfil"` |
| Menu | **Nenhum** (sem menu/contexto próprios) |
| Destination | Aba `perfil` — idêntica ao `.sb-user` do rodapé da sidebar (sempre visível no shell) |
| State/permission | Nenhum gate próprio além do contexto do quadro |
| Relação SLA/bell | Âncora de MEDIDA do alinhamento (`slaClusterAlign`); com rect zero o runtime F3.5.4G **não reposiciona** (avOk=false) e encadeia o monitor pelo SINO |
| Motivo histórico | Substituto visual do `#topAvatar` do `.topbar` OCULTO na 1.0.140 ("avatar operacional do quadro", F3.3.15) |

**Possui função única? NÃO.** Função (navegar ao perfil) duplicada e permanente no
`.sb-user`; identidade coberta pelo user card do rodapé. **Decisão executada:** ocultar do
core header **somente sob `body.light-ui`** (`display:none`) — o elemento continua criado,
com handler, no DOM; o legado não muda em nada. Nenhuma função movida/duplicada/removida.

## 2 · GATE 2 — GOLDEN COMPARISON (F1–F5, direto dos arquivos congelados)
`hd-right` nos 5 Golden = **`.sla` + `.hd-bell` — zero avatar** (grep por `class="av` no
cluster = 0 nos cinco). O `av av-46` do Golden vive no `.hd-title` (esquerda) = **avatar
contextual da SURFACE** (ex.: "Meu quadro") — pertence às fases I3+, não ao shell.
Referência do Core Shell confirmada: **[Monitor SLA][Bell]**.

## 3 · GATES 3/4/12 — BRAND DOM (nome visual = nome acessível)
- **Antes (I2.1):** DOM `ID Seven`; visual Light "Agenda ID Seven" via `::before`
  (dívida consciente de duplicação p/ SR).
- **Depois (I2.2):** markup real do brand (composição da nav, literal de string — zero
  lógica):
  `<div class="nm"><span class="nm-legacy">ID Seven</span><span class="nm-lui" style="display:none">Agenda ID Seven</span></div>`
  O default do span novo vive NO PRÓPRIO markup (style inline) ⇒ nenhuma regra CSS global
  fora do namespace. Sob `body.light-ui`: `.nm-legacy{display:none}` +
  `.nm-lui{display:inline !important}` (vence o inline).
- **::before REMOVIDO como fonte textual** (regras `font-size:0` + `content` eliminadas do
  bloco). **A11y pontual (Gate 12):** sob a classe, `innerText` do `.nm` =
  **"Agenda ID Seven"** e `::before` computado = `none`; spans legacy/lui = none/inline —
  árvore acessível SEM duplicação e SEM texto vazio. Legado: "ID Seven" (inalterado).
- **"sincronizado"** permanece texto real (intocado; dot/lógica idem). O `.topbar` estático
  legado (oculto por 1.0.140) mantém seu markup antigo — fora do shell Light UI.
- **Gate 5:** mark real (--logo, 46px, sombra Golden, spacing) preservado — nada trocado.

## 4 · GATE 6 — CLUSTER FINAL
**[Monitor SLA][Bell]** no topo direito da banda — sem avatar e **sem gap residual**:
`bell right:34px` (eixo lateral Golden) e `monitor right:90px` (34+46+10). Convergência
CSS×runtime preservada: com avatar sem rect, o runtime não reescreve o right do sino (CSS
manda) e encadeia o monitor pelo sino (`innerWidth − bell.left + 10` = 90 = CSS). Monitor
markup/cálculo/polling/severidade/textos, bell handler/badge/count/click/state: **intocados**.

## 5 · VALIDAÇÃO (Gates 8–11)
| Perfil | navw | overflow | cluster | brand (innerText) | corner-avatar |
|---|---|---|---|---|---|
| 1920×1080 @1 | 284 | 0 | monitor right 90 · bell right 34/top 23 | "Agenda ID Seven" | display:none (no DOM) |
| 1366×768 @1 | 284 | 0 | idem | idem | idem |
| **1093×614 @1.25** | 284 | 0 | **bell right edge 1059 < 1093 (P0 — folga maior sem avatar)** | idem | idem |
- **Legado (Gate 8): 0px** — I2.1 (`c368a6c2`) × I2.2, SEM a classe, animações congeladas,
  @1920: bbox=None em dark/light/hc (arquivo inteiro) **+ prova complementar**: sidebar
  montada com markup velho × novo sob os 3 temas legados = **0px** (span transparente).
- **Gate 9 (light regression):** sidebar 284 ✓ brand real ✓ sincronizado ✓ active nav ✓
  banda 92 ✓ Monitor SLA verde "Tudo em dia" real ✓ bell ✓ canvas ✓ sem corner-avatar ✓.
- **Gate 11 (funcional):** elemento+handler existem (inDom:true); navegação ao perfil
  provada via `.sb-user` no nav smoke **11/11**; nenhuma ação/menu/status removido.
- HC smoke ✓ (monitor real, sem overflow). Marcador de título = harness-only (Gate 7 ✓).

## 6 · GATES 13–15 + DIFF
Zero seletor novo de surface (board/card/drawer/calendar/wizard/notifications/exec/reports/
modal). Zero auto-ativação (classe só por harness; sem flag/Config/localStorage/Firebase).
Version 1.0.246; nenhum build/package/tag/release/deploy/updater. **Diff:** 1 arquivo ·
**+22/−14** · 6 hunks (5 no bloco `light-ui-foundation`, 1 no literal de markup do brand) ·
**functional/JS diff = ZERO lógica** (grep addEventListener/localStorage/firebase/function no
diff adicionado = 0).

## 7 · ROLLBACK & GATE FINAL
Rollback: reverter `0d107dea` (seção I2.2 do CSS + literal do brand). **Recomendação:
I2 / I2.1 / I2.2 = GO** — corner-avatar redundante removido do shell Light, brand DOM =
"Agenda ID Seven", Monitor+Bell = Golden, 3 perfis PASS, legado 0px, zero função quebrada.
Somente após o GO do owner: **I3 (Boards F1–F5)** pode ser autorizada.
