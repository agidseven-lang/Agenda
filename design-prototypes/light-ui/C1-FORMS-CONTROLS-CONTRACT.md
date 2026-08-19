# C1 — FORMS & CONTROLS · DESIGN CONTRACT (Light UI)

> **★ R9.1 — TOKEN ERRATA CANÔNICA (GO do owner):** `--tx-3:#697181` (4.91/4.54) · `--tx-4:#6E7786` (4.52; regra de superfície: sobre canvas usa tx-3) · `--brand-ink:#4353D8` p/ texto brand ≤18.66px · `--grad` stop claro → `#8356E6` (branco 4.73 no pior stop) · borda de input #DFE3EB MANTIDA com justificativa técnica (label+placeholder+shape+focus ring ≥3) · hit target mínimo 24×24 (WCAG 2.2) para microcontroles, conforto 28. Fonte única: `ACCESSIBILITY-TOKEN-ERRATA.md` (before×after com contraste calculado). Estes valores SÃO os canônicos; imagens Golden históricas permanecem como registro.

> **★ CHECKPOINT GLOBAL (decisão do owner):** os frames-fonte F8–F13 foram aprovados como
> GOLDEN; portanto os candidatos das seções **§10 (F8) · §11 (F9) · §12 (F10) · §13 (F11) ·
> §14 (F12) · §15 (F13)** ficam **PROMOVIDOS a GOLDEN** com seus frames (prova visual +
> aprovação). Itens antes pendentes em §3 agora COBERTOS por frames posteriores: select nativo
> estilizado (F9 `nc-fl`), table control (F10/F11 dense table — **paginação não existe no real**),
> file upload/preview/remove/URL (F13), password input + reveal (F12). §3 permanece a lista dos
> AINDA sem prova. C1 segue **GOLDEN PARCIAL** até esses estados serem demonstrados.
> Correção de taxonomia: os componentes de MODAL do §15 pertencem à foundation **C2 — Modais &
> Sheets** (nome formal já definido no `MASTER-SURFACE-MAP.md` §F; a nota original do F13 dizendo
> "sem foundation nomeada" estava incorreta). O §15 permanece aqui como registro de origem;
> o contrato dedicado da C2 usará o F13 como âncora Golden.

**Status:** GOLDEN PARCIAL / FOUNDATION OFICIAL. Congelado a partir do wizard **Nova tarefa**
(FRAME 7 completo, aprovado pelo owner) e AMPLIADO pelas promoções F8–F13 (banner acima). Fonte
funcional auditada: Desktop **1.0.246**. Branch de design: `design/f356b-light-ui-mockups`. Este
documento **não** altera produção — apenas registra os contratos visuais já aprovados.
Sobrepõe-se aos tokens congelados dos Golden Frames 1–6.

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
- ~~file upload~~ → **COBERTO no F13** (§15: drop, thumb, remove, URL fallback — Golden);
- ~~select nativo estilizado~~ → **COBERTO no F9** (§11 `nc-fl`) e F10/F11 (`exec-fl`);
- **multi-select** (canais é choice ÚNICA no real — multi não comprovado);
- ~~table control~~ → **COBERTO no F10/F11** (§12–13 dense table); **paginação NÃO existe no
  real** (listas cortam por slice/scroll) — não inventar;
- **success state** (o real volta ao quadro sem toast — a ausência é o contrato; nada a desenhar).

**Conclusão (pós-checkpoint global):** C1 = **GOLDEN PARCIAL**. Restam sem prova visual:
**disabled genérico · error inline genérico · saving/loading · validation summary (real =
`alert()`) · destructive confirmation (del-sheet) · checkbox/radio · multi-select (inexistente
no real — provavelmente sai do escopo por decisão do owner)**. Fechar via etapa R2 do
`DESIGN-CLOSURE-ROADMAP.md` (1 frame de estados sobre superfícies reais).

> **ATUALIZAÇÃO R2:** a prancha `r2-c1-completion-estados.html` fornece a PROVA VISUAL de todos os
> itens acima que EXISTEM no real (ver §16). Os inexistentes (validation summary/radio/multi-select)
> ficam formalmente FORA do escopo. **Congelamento APROVADO (R2 = GO `3c06c26`) — C1 = GOLDEN COMPLETA no escopo real.**

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

## 10 · NOVOS CANDIDATOS observados na AGENDA (Frame 8 — a congelar no checkpoint da Agenda)
Controles REAIS da Agenda que começam a estabelecer contrato (ainda não formalmente congelados):
- **Segmented view switcher** (Mês/Agenda): track sunk, item ativo = surface branca + sh-1 + tx-1;
  inativo tx-3. Alternativa premium ao par de chips accent do real.
- **Calendar grid cell** (`.agcell`): radius 11, surface-2 + hairline; número topo + dots (cor do
  tipo); estados dim (transparente, tx-4) / today (ring brand) / selected (gradiente Golden + branco).
- **Event/list card** (`.evc`): faixa lateral = responsável (identity), bloco de data, hora tabular,
  status pill (dot + tint), título line-clamp 2, meta cliente/local, rodapé avatar+nome+tag de tipo.
- **Busca com ícone leading**: input h44 + ícone search 17 tx-3.
- **Type filter chip com dot**: chip com dot na cor do tipo; selecionado = tint + ring na cor.
- **Empty state** (`.empty`): caixa de ícone 64 + título 15/800 + sub 12.5 (documentado; não
  renderizado no Frame 8 pois o dia tem compromissos).
Congelam formalmente quando o owner aprovar o Frame 8.


## 11 · NOVOS CANDIDATOS observados na CENTRAL (Frame 9 — a congelar no checkpoint respectivo)
Controles REAIS da Central de Notificações que começam a estabelecer contrato:
- **Select nativo estilizado** (`nc-fl`): h44, radius 12, surface + hairline #DFE3EB, valor 13/600
  tx-2, chevron próprio à direita. Valida o pendente "select nativo estilizado" — a Central é a
  primeira superfície REAL com `<select>`.
- **Notification list row** (`nc-row`): faixa de severidade (4px) + avatar 40 + [badge de tipo +
  título + selo CRÍTICO] + subtítulo + contexto (cor da severidade) + hora + dot de não-lida +
  "Abrir tarefa →". Não-lida = surface branca + sombra + 700 + dot; lida = surface-2 + 600
  (legível, ≠ disabled).
- **Unread/read state**: booleano `read`; indicador combinado (peso + surface + dot), nunca só cor.
- **Bulk actions**: "Marcar todas" (ghost) e "Limpar histórico" (ghost danger — destructive com
  confirm() real).
- **Day grouping**: rótulo 11/700 uppercase tx-4 (Hoje/Ontem/data).
- **Empty state** (documentado, não renderizado): ícone + título + subtítulo.
Congelam formalmente quando o owner aprovar o Frame 9.


## 12 · NOVOS CANDIDATOS observados no EXECUTIVO (Frame 10 — a congelar no checkpoint respectivo)
Componentes REAIS do Painel Executivo (SLA & Produtividade):
- **KPI / metric card**: surface branca radius 16, faixa de accent lateral 3.5px na cor semântica,
  label 12/600 tx-3, valor InterTight 30/700 na cor, hint 11 tx-4. Nunca 64px/gradiente/glow.
- **Distribution bar + legend**: barra empilhada h16 (larguras % por segmento) + legenda dot+label+
  contagem. Cores por severidade.
- **Data table (dense)**: header 10.5/700 uppercase tx-4 com hairline; linhas 13.5 tx-2, hairline
  suave; alinhamento numérico central (`.c`); célula de designer avatar 24 + 1º nome.
- **Pct progress cell**: track sunk 74×6 + fill na cor por faixa (≥90 verde/≥75 azul/≥60 laranja/
  senão vermelho) + % à direita.
- **Severity pill**: min 24×22, tint 14% + ink na cor (laranja/vermelho/crítico).
- **Executive mini-list**: item (dot + texto) ... valor colorido; hairline entre linhas.
- **Executive alert banner**: tint crítico 7% + microborder 24% + ícone + texto (não gigante).
- **Period segmented**: track sunk, item ativo surface + sh-1 (reforça o de F8).
Congelam formalmente quando o owner aprovar o Frame 10.

## 13 · NOVOS CANDIDATOS observados nos RELATÓRIOS (Frame 11 — a congelar no checkpoint respectivo)
Componentes REAIS do `renderReports` (Relatórios de Atraso · read-only · exportável):
- **Bar chart (time-series)** `rep-pbars`: colunas flex align-end, altura fixa (~118px) + hairline de
  base; barra `rep-pbfill` largura ~62%, radius topo 7, `min-height` 6px; número (`rep-pbn`, tabular,
  atenuado em zero) acima e label MM-DD (`rep-pbl`) abaixo. Cor da barra por faixa de contagem
  (≥4 vermelho / ≥2 laranja / senão azul). Sem eixo/grid pesado; sem gradiente/3D.
- **SLA timeline row** `rep-tl`: sequência de passos (`rep-tlstep` = dot 8px com anel branco + rótulo
  11.5 tx-2) separados por hairline `rep-tlsep` 16×1.5; cor do dot por `repStepColor` (enviado cinza /
  produção azul / revisão laranja / atraso vermelho / crítico crítico / concluído verde). `flex-wrap`
  permitido. Vive dentro da célula "Linha do tempo" da dense table.
- **Toggle chip** `rep-tg`: chip h40 com quadradinho 15px (`.box`); OFF = outline hair + tx-2 + box
  vazio; ON = tint vermelho 8% + microborder 34% + ink `sv-vermi` + box preenchido. É filtro binário
  ("Só atrasados"), NÃO um switch iOS.
- **Export contextual action** `rep-exp`: botão VERDE secundário (tint green 8% + microborder 30% + ink
  `--green`, ícone download 15px). **Regra de hierarquia (reforça F7D):** ação contextual/secundária —
  em superfície read-only não existe CTA primário; os dois export coexistem sem competir. Nunca gradiente
  de marca (isso é do "Nova tarefa"/"Salvar tarefa").
- **Serialização/entrega:** CSV (`;` UTF-8) e JSON via `execDownload` (Blob) — download LOCAL do
  browser; sem rede/IPC/Firestore. Nomes `relatorio-atraso-AAAA-MM-DD.{csv,json}`.
- **Grid de KPI 4-col** (`.ex-kpis.k4`): variação do KPI card do F10 (4 em vez de 5).
Reutiliza integralmente (do F10): KPI card, dense data table, pct cell, sev pill, mini-list, select,
period segmented. Congelam formalmente quando o owner aprovar o Frame 11 (ainda NÃO Golden).

## 14 · NOVOS CANDIDATOS observados no LOGIN (Frame 12 — a congelar no checkpoint respectivo)
Componentes REAIS da superfície de autenticação (renderLogin/#login — standalone, sem shell):
- **Password input + reveal TEXTUAL**: mesma família do text input Golden (h46/r12/ring #DFE3EB),
  `type=password`, valor mascarado (glifos •, letter-spacing .14em); botão de revelar é **texto**
  "Mostrar"/"Ocultar" (12.5/700 brand) DENTRO do campo à direita, target ≥34px, padding-right no
  input p/ não sobrepor. Não é ícone de olho; sem caps-lock warn/strength meter (não existem).
- **Form-level error banner** (`.banner`): largura total, radius 12, padding 12×14, 13/500;
  `err` = tint vermelho ~12% + ink; `ok` = tint verde ~12% + ink. Posição REAL: `#loginBanner`
  entre subtítulo e form (não é inline por campo, não é toast, não é modal). Literais de erro do
  doLogin preservados. Estado default = SEM banner.
- **Auth card standalone**: superfície de entrada SEM shell (sem sidebar/topbar/SLA/sino) —
  card Golden branco (sh-2, ~464px, radius 18) centrado no canvas com véu radial da marca ≤4%;
  identidade vem de marca+tipografia+inputs+CTA, não do shell. Única tela onde o CTA primário
  convive sem footer de wizard.
- **Brand block (login)**: brand-mark Golden + h1 InterTight 25/700 + sub 13 tx-3 — literais
  reais "ID Seven" / "Desktop · Paridade APK". (No produto real o logo é o PNG oficial via
  CSS var `--logo`; o protótipo não copia o asset binário.)
- **Version footer pill** (`.vfooter`): pill tint brand 12% + ink (11/800, radius pill) com
  literal "Desktop" + linha "ID Seven" 11 tx-4. SEM número de versão (fiel ao real).
- **Loading de submit (documentado, não desenhado)**: botão disabled (opacity .6) + spinner
  20px substitui o texto — contrato real de `loading(btn,on)`; previne double-submit.
- **Splash de restauração (documentado, não desenhado)**: estado padrão do boot ("Restaurando
  sessão…" + spinner accent; hint com "Tentar novamente · Entrar manualmente" após 3 falhas de
  rede) — o login NUNCA aparece antes de negativa real de sessão.
Pendentes/dívidas anotadas no F12: Enter não submete (div sem form); recovery é stub nesta build.
Congelam formalmente quando o owner aprovar o Frame 12 (ainda NÃO Golden).

## 15 · NOVOS CANDIDATOS observados no MODAL "LEGENDAS E ARTES" (Frame 13 — a congelar no checkpoint)
Primeiro contrato de MODAL/DIALOG do Light UI (não havia foundation nomeada — candidato novo,
sem conflito). Componentes REAIS do renderProductionModal:
- **Modal/dialog (sheet)**: surface branca, width até 680 (real), radius 18, sombra elevada
  (hairline + 24/70 + 44/96), padding ~24×26, header centrado (ícone-selo + título InterTight
  20/700 + sub 13 tx-3 com termos em bold), X no topo-direito (34px, hairline, target ≥34).
- **Backdrop**: véu escuro + **blur 3px (REAL do produto)** — no tema claro véu ~46%; contextualiza
  a superfície de origem sem disputar (F6 legível atrás). Clique fora/Esc = fechar (real).
- **Lista interna rolável**: pilha vertical de cards (surface-2 + hairline, radius 14) com scroll
  próprio (real 56vh) e scrollbar fina visível; header/footer do modal sempre utilizáveis
  (sticky por estrutura — adaptação visual documentada, comportamento real preservado).
- **File drop (clique)**: área tracejada 1.5px (#CBD2DE), radius 12, ícone plus 22 + rótulo 12/700
  ("Anexar Feed/Story"); **aspect-ratio REAL da mídia** (1080/1440, 1080/1920) como forma do
  controle. SÓ clique (sem drag-and-drop — fiel ao código).
- **Image thumbnail**: radius 12, hairline, img cover no aspect real; **remove-chip** X 26px
  (fundo escuro 60%, canto sup-dir, title "Remover") — destructive contextual distinguível.
- **URL fallback input**: input compacto h34, radius 9, 11.5px, placeholder "ou cole a URL da
  arte…" — alternativa real ao upload; truncamento em 1 linha.
- **Footer de 3 ações**: SECONDARY ghost ("Cancelar") · CONTEXTUAL ghost+ícone ("Salvar") ·
  PRIMARY Golden gradiente ("Salvar e reenviar ao cliente", flex maior) — hierarquia real
  preservada (a primária do modal é o reenvio; Salvar é contextual).
- **Selo de ícone do modal** (`.pr-ic`): 54px radius 15, tint âmbar 13% + ink âmbar — categoria
  visual da ação (produção), padrão para selos de modal.
- **Read-only reference no card**: tema exibido como TÍTULO do card (nunca editável no modal) —
  contrato "referência ≠ campo".
Dívidas anotadas no F13 (não corrigir): sem validação de dimensão/tamanho; sem progress; botões
sem loading/disabled; URL sem validação. Congelam quando o owner aprovar o Frame 13 (NÃO Golden).

## 16 · R2 — C1 COMPLETION · ESTADOS REAIS (prancha `r2-c1-completion-estados.html` — ✔ APROVADA, R2 = GO)
Prancha de contrato (spec board, não é tela) que fecha visualmente as pendências do §3 com
componentes/estados/mensagens 100% reais da 1.0.246. Candidatos a congelar com a aprovação:
- **Disabled genérico**: `.btn[disabled]` real (opacity .6, pointer-events none) aplicado a
  primary e secondary; texto permanece legível. `−` do stepper no mínimo (opacity .4) reafirmado.
- **Contrato OFF ≠ DISABLED**: toggle OFF (escolha ativa: trilho cinza + knob pleno) lado a lado
  com ação disabled (indisponibilidade) — nunca ilegível, nunca confundíveis.
- **Loading de submit**: Login `loading(btn,on)` — botão disabled + spinner 20px substitui o
  texto (largura preservada). **Saving anti-duplo-clique**: rev-send `disabled aria-busy`
  "Salvando cronograma…" (literal real com reticências). Linha "Carregando…" de Config citada.
- **Inline error (campo)**: `sq-err`/`cqErr` — tint vermelho 8% + microborder 25% + ink, radius 9,
  `role="alert"`, ícone 14; literal real "Informe uma quantidade inteira igual ou superior a 1.";
  trigger valor não-inteiro/<1; foco volta ao campo; campo ganha ring vermelho de erro.
- **Form-level error (banner)**: reutilizado do F12 (`.banner.err`) — contrato DISTINTO do inline.
- **Destructive confirmation (estado)**: del-sheet real `openDeleteConfirm` — del-ic trash tint
  vermelho 13% + ring 24%, título "Remover tarefa?", mensagem literal com `<b>item</b>` + "Não é
  possível desfazer.", Cancelar (secondary) + "Remover tarefa" (`btn-danger`: tint 12% + microborder
  42% + ink 750 — nunca parece primary). Anatomia completa do modal = C2 (R3).
- **Checkbox (representação C1 da semântica nativa)**: real = `<input type="checkbox">` NATIVO em
  Config·Check-ins (labels literais; defaults reais 1º checked/2º unchecked). DS: box 18 radius 5;
  checked = brand + check branco; unchecked = hairline 1.6; focus = ring #6E5EF3 + halo. Estado
  nunca só por cor (box preenchido + check).
- **Checklist = EDITOR, não checkbox**: `checklistHtml` (input + remover vermelho + "+ Adicionar
  item") — distinção registrada; marcação "feito" não vive no editor.
- **Applied sample Configurações**: settrow (icb 38/11 + 14/700 + sub com `<b>`) + chips de modo
  (selecionado = accent sólido + check) + checkboxes + ação real "Salvar configuração" + gate
  admin literal + estados "Carregando…"/erro `#etMsg` citados.
- **Empty state (amostra p/ C4)**: `emptyState()` — ebox 60/17 hairline + título 750 + sub;
  literais "Dia livre"/"Nenhum compromisso para esta data."; SEM CTA/ilustração (fidelidade).
- **Stat-tile (amostra p/ C8)**: `.stat`/`.stat.accent` do Hoje — ic + valor InterTight 700 +
  label; accent = brand com conteúdo branco; clicável (`data-tab`).
**EXCLUSÕES FORMAIS AUDITADAS (não existem no real — fora do escopo, nunca inventar):**
validation summary (global = `alert()` nativo: "Informe o título." · "Informe o cliente." ·
"Selecione o setor.") · radio (`type="radio"` = 0; escolha única = choice chips) · multi-select
(canais = escolha única) · paginação (listas por slice/scroll) · skeleton (só splash/"Carregando…").
Splash "Restaurando sessão…" permanece na C5 (R5). **NÃO declarar C1 completa até o owner aprovar.**
