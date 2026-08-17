# C1 — FORMS & CONTROLS · DESIGN CONTRACT (Light UI)

**Status:** GOLDEN PARCIAL / FOUNDATION OFICIAL. Congelado a partir do wizard **Nova tarefa**
(FRAME 7 completo, aprovado pelo owner). Fonte funcional auditada: Desktop **1.0.246**. Branch de
design: `design/f356b-light-ui-mockups`. Este documento **não** altera produção — apenas registra
os contratos visuais já aprovados. Sobrepõe-se aos tokens congelados dos Golden Frames 1–6.

Frames-fonte (não redesenhar sem autorização do owner):
- FRAME 7A · Setor — `proposta-c-frame7a-novatarefa-setor.html` — commit `ea485c2`
- FRAME 7B V2 · Dados — `proposta-c-frame7b-novatarefa-dados.html` — commit `5d2b10d`
- FRAME 7C · Briefing — `proposta-c-frame7c-novatarefa-briefing.html` — commit `7361f92`
- FRAME 7D V2 · Revisão — `proposta-c-frame7d-novatarefa-revisao.html` — commit `755eee6`

---

## 0 · SHELL & CONTAINER DO WIZARD (congelados)

- **Shell**: sidebar petróleo Golden + header global 92px + canvas Light (#F5F6F9); superfície
  focada CENTRALIZADA no canvas; **sem overlay, sem blur, sem aparência de modal genérico** —
  paradigma real `renderForm()` = superfície dedicada (`.form-wrap`), não modal.
- **Container**: card branco `width 920`, `radius 18`, sombra `--sh-2`, footer com hairline;
  âncora vertical ajustada por etapa; permanece dentro do viewport 1920×1080; **scroll interno
  real (`overflow-y:auto`) só rola quando o conteúdo excede** (Briefing rola; Revisão cabe).
- **Header do wizard** (no header global): título "Nova tarefa" + subtítulo de etapa/contexto
  ("Etapa N de 4 · Cronograma"); botão fechar (X) no canto do card.

### Stepper (congelado)
Sequência fixa: **Setor → Dados → Briefing → Revisão**. Três estados, nunca só cor:
- **Futuro**: círculo 30px hairline (`inset 0 0 0 1.5px --hair`), número, label `tx-3`.
- **Atual**: círculo 30px gradiente Golden (`--grad`) + número branco + kicker "ETAPA ATUAL"
  (#6E5EF3) + label 700 `tx-1`.
- **Concluída**: círculo tint verde (`green 13%` bg, ring `green 34%`) + **check** + kicker
  "CONCLUÍDA" (#2E8F63) + label 620 `tx-2`. Conector percorrido = verde.

---

## 1 · COMPONENTES C1 GOLDEN (aprovados)

| # | Componente | Contrato-chave (token real) |
|---|---|---|
| 1 | **Text input** | h46, radius 12, surface #FFF, ring `inset 0 0 0 1px #DFE3EB`; valor 14/520 tx-1; padding 0 14 |
| 2 | **Label de campo** | 13/600 tx-2, sentence-case, margin-bottom 7 (nunca caixa alta) |
| 3 | **Obrigatório** | pill 9.5/800 âmbar: `#B45309` sobre `#F59E0B 12%`, radius pill, pad 2.5×8 |
| 4 | **Opcional** | texto 12.5/500 `tx-3` (secundário, legível — nunca quase-invisível) |
| 5 | **Placeholder** | `tx-3` (menos contraste que o valor, ainda legível) |
| 6 | **Helper text** | 12 tx-3, line-height 1.5 (secundário, nunca microscópico) |
| 7 | **Focus (input/RTE)** | `inset 0 0 0 1.5px #6E5EF3` (roxo Golden) + halo `0 0 0 2.5px #6E5EF3@11%` — sem neon |
| 8 | **Date** | input h46 + leading icon calendar 16 tx-3; formato PT-BR DD/MM/AAAA |
| 9 | **Time** | mesma família de Date; leading icon clock 16 tx-3; HH:MM |
| 10 | **Person picker** | card hairline h auto, avatar 36 + nome 14/600 + chevron tx-4; abre sheet real |
| 11 | **Option/sector card** | h auto, radius 14, hairline; ícone 24 em pastilha 52 tintada na cor; selecionado = tint 7% + ring 1.5 (`cor 55%`) + microshadow + ✓ na cor |
| 12 | **Choice chip** | h32, radius pill, hairline; selecionado = **check** + tint 12% + ring 1.5 (`cor 62%`) + microsombra + 700 (nunca só cor) |
| 13 | **Toggle** | 46×28, OFF = trilho `#CDD3DE` + hairline interna + knob branco sombreado (disponível, **≠ disabled**); ON = `--brand` sólido, knob à direita |
| 14 | **Quantity stepper** | `[−][N][+]`: botões 42×42 radius 12 hairline; campo central 96×42; sufixo tx-3; − disabled no mínimo (opacity ~.4) |
| 15 | **Number field** | centralizado, 16/700, sem spinners nativos |
| 16 | **Summary banner** | pill índigo (`#5B6CFF 8%` bg, ring 20%, ink #4353D8), 12.5/700 — "Cronograma — N conteúdos" |
| 17 | **Accordion (repeated content)** | card radius 12 hairline; header dot (cinza vazio / verde `.fill`) + "Conteúdo N" + ▲/▼; **UM aberto por vez**; aberto = ring `#5B6CFF 26%` + microshadow; blocos permanecem compactos (nunca N cards gigantes) |
| 18 | **Rich text editor** | wrapper radius 11 hairline; área contenteditable 13.5 tx-1; foco = ring Golden (mesmo do input) |
| 19 | **RTE toolbar** | barra surface-2, botões ~24px; **visível só no editor focado** (`:focus-within`); ordem real: undo/redo · ¶▾ · A▾ · N/I/S/tachado/X₂/X² · cor/marca-texto · listas · alinhamentos · recuos · link/hr/limpar |
| 20 | **Internal scroll** | `.scr overflow-y:auto` — só quando excede; scrollbar fina; peek honesto |
| 21 | **Persistent footer** | hairline no topo; Voltar (ghost, a partir da etapa 2) à esquerda + ação primária à direita |
| 22 | **Primary button** | gradiente Golden `--grad`, h48, radius 13, 14.5/650, glow controlado `0 8px 20px rgba(110,94,243,.28)` — único por tela |
| 23 | **Secondary button (Voltar)** | h48, surface branca + hairline, tx-2, 14/600 |
| 24 | **Read-only summary** | card surface-2, radius 16, hairline; composição editorial (título + cliente + chips + grid + responsável), dividers hairline |
| 25 | **Summary row (revItem)** | ícone 17 tx-4 + label 10.5/700 uppercase tx-4 + valor 14/600 tx-1 |
| 26 | **Attribute/status chip (revisão)** | h28 radius pill, tint 14% + dot na cor (`dotc`); soft = surface + hairline (ex.: "Prioridade normal") |
| 27 | **Quick edit action** | botão h40, surface + hairline, ícone + label 13/600 (Editar / Editar dados / Editar briefing) |
| 28 | **PRIMARY ACTION** | ação que **conclui a etapa/jornada** — gradiente Golden, footer, contraste elevado, glow controlado. Ex.: "Salvar tarefa" |
| 29 | **SECONDARY CONTEXTUAL ACTION** | ação real importante **no corpo**, que **não conclui a jornada** — surface clara + tint suave + microborder na cor semântica + ícone/label em accent + hint contextual, **sem glow dominante, sem competir com o primary**. Ex.: "Enviar para o cliente" (tint `#5B6CFF 7%`→`#10B981 8%`, microborder `#12B39A 34%`, ink #1E7A66). Registrado formalmente: **PRIMARY ≠ CONTEXTUAL ACTION**. |

---

## 2 · ESTADOS C1 comprovados visualmente (congelados)

`default` · `hover` (conceitual) · `selected` · `focused` · `filled` · `empty` · `collapsed` ·
`expanded` · `OFF` (toggle) · `completed step` · `current step` · `future step` ·
`contextual action` · `primary action`.

---

## 3 · ESTADOS/CONTROLES C1 AINDA NÃO CONGELADOS (pendentes)
Só entram na C1 quando demonstrados sobre uma superfície REAL do 1.0.246. Não inventar backlog de
componente inexistente. Existem no produto e ainda precisam aparecer:

- **disabled genérico** de input/campo (o real `.btn[disabled]` existe, mas C1 só viu o `−` do
  stepper e o estado "Salvando…" do rev-send — não renderizado);
- **error inline genérico** (o real `sq-err`/`cqErr` do Cronograma está documentado mas **não
  renderizado** — foi mostrado só o estado válido);
- **saving/loading** (rev-send "Salvando cronograma…" disabled; botão save anti-duplo-clique) —
  o owner pediu o estado ANTES do clique, então não foi desenhado;
- **global validation / validation summary** (o real usa `alert()`, não banner inline);
- **destructive confirmation** (ex.: modal de corte de quantidade `openCronShrinkConfirm`; e o
  "Remover" administrativo do Detalhes — F6);
- **checkbox / radio** (o real `checklistHtml` usa checkbox em outros setores; cronograma não);
- **file upload** (existe só na tela de produção "Legendas e artes" — F13, não no wizard);
- **select nativo estilizado** (o real não usa `<select>` no wizard — usa chips choice);
- **multi-select** (canais é choice ÚNICA no real — multi não comprovado);
- **table control / pagination** (superfícies de lista — Relatórios/Notificações, ainda não vistas);
- **success state** (o real volta ao quadro sem toast — a ausência é o contrato; nada a desenhar).

**Conclusão:** C1 = **GOLDEN PARCIAL**, não 100% concluída.

---

## 4 · TOKENS C1 CONSOLIDADOS (extraídos dos frames aprovados — não alterar)

| Token | Valor |
|---|---|
| control height (input/date/time) | 46px |
| control height (botão primário/voltar) | 48px |
| control height (chip) | 32px · (stepper qty botão/campo) 42px · (toggle) 46×28 |
| radius (input/qty/rte/accordion) | 11–12px · (option card) 14 · (container) 18 · (chip/pill) 999 |
| border (repouso) | `inset 0 0 0 1px #DFE3EB` (campos) · `inset 0 0 0 1px var(--hair)` (cards/chips) |
| surface | #FFF (controle) · #FAFBFD (rev-card/rte-bar) · #F5F6F9 (canvas) |
| padding (input) | 0 14 · (option card) 20 22 · (rev-card) 16 20 |
| font-size (valor) | 14 · (label) 13 · (helper/opcional) 12–12.5 · (pill obrigatório) 9.5 |
| font-weight (valor) | 520 · (label) 600 · (chip selecionado) 700 · (título card) 640–700 |
| placeholder color | `--tx-3` (#767E8D) |
| value color | `--tx-1` (#14181F) |
| helper color | `--tx-3` |
| label color | `--tx-2` (#4B5364) · summary-row label `--tx-4` |
| disabled color | (parcial) opacity ~.4 no `−` do stepper; genérico pendente |
| focus color | #6E5EF3 (roxo Golden) |
| focus halo | `0 0 0 2.5px #6E5EF3@11%` |
| error color | (não congelado — real `sq-err` texto red-ink + tint red 8% + borda red 25%) |
| gap (grid 4/8) | 7–20px conforme densidade |
| transition duration | 120–140ms ease-out (conceitual) |
| icon size | 16 (leading/toolbar) · 17 (summary row) · 24 (option card) · stroke 1.7 |
| target mínimo | ≥40px de altura de clique (botões/pickers/qty); alvo confortável exigido em 1366/125% |

---

## 5 · RESPONSIVIDADE (requisitos de implementação — não gerar frames agora)
- **1920×1080** = Golden principal.
- **1366×768** = obrigatório suportar.
- **Windows 125%** = obrigatório suportar.
- Regras: wizard nunca ultrapassa o viewport; footer não cobre conteúdo; scroll interno quando
  necessário; inputs legíveis; target size preservado; RTE toolbar utilizável; stepper não quebra;
  labels não ficam microscópicas.

## 6 · ACESSIBILIDADE (requisitos de implementação)
Contraste suficiente; foco visível (ring Golden); **cor nunca como único indicador** (check/dot/
peso acompanham); targets confortáveis; keyboard focus; estados selecionados perceptíveis;
**disabled claramente diferente de OFF**; labels associados aos controles; ícones não substituem
informação crítica.

## 7 · CONTRATO DE FIDELIDADE FUNCIONAL (permanente)
**CÓDIGO REAL = FONTE DA VERDADE.** "NÃO INVENTAR" = não criar função inexistente; **não** =
esconder função real. Em conflito entre lista histórica e o renderer atual: (1) auditar → (2)
parar → (3) reportar divergência → (4) owner decide → (5) só então desenhar.
**Precedente formal:** "Enviar para o cliente" (`canSendToClient`, stepReview real) — proibido pela
lista histórica, porém REAL no código; owner decidiu INCLUIR fiel como ação contextual secundária.

## 8 · DÍVIDA SEMÂNTICA (registrada, não corrigir agora)
Na Revisão, o rótulo **"Subtipo"** exibindo **"12 conteúdos"** é legado real do `stepReview()`.
Permanece fiel no Golden. Melhoria semântica futura (ex.: "Quantidade"/"Conteúdos") fica como
dívida para uma fase FUNCIONAL posterior — **nunca** alterada só no mockup.

## 9 · FOTOS (contrato permanente)
Usuário com foto cadastrada → foto real (runtime `photoOf → avatar()`); sem foto → iniciais. Mocks
podem materializar fotos local-only/read-only. **ZERO** fotos pessoais versionadas (nem JPG/PNG/
base64/`data:image`/assets pessoais). `_team-photos.css` LOCAL-ONLY (gitignored).
