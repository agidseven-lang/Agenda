# C7 — TABELA · DENSE DATA FOUNDATION CONTRACT (Light UI)

**Status:** ✔ **FOUNDATION OFICIAL / GOLDEN** — aprovada pelo owner (R4 = GO, commit `2516426`;
âncoras visuais F10+F11 — sem gap visual). Congelada; alterações só com autorização do owner.
(Header corrigido na R10 — o texto anterior "aguarda avaliação" era stale de antes do GO.)

## 1 · OBJETIVO
Congelar o contrato da tabela densa de dados REAL do produto no Light UI Golden, a partir das
três tabelas existentes e das âncoras aprovadas (F10 `9de9a6b` · F11 `efb264a`). Não é uma
tabela genérica de Design System.

## 2 · ESCOPO
Estruturas com semântica tabular REAL (`<table><thead><th>` + rows por colunas). **Fora do
escopo:** listas com aparência tabular (regra §22), KPI/chart/stat-tile (→ C8/foundations
próprias), mini-lists, e qualquer capacidade inexistente (§14–§16).

## 3 · INVENTÁRIO REAL — **3 tabelas no renderer inteiro** (grep `<table`/`<thead` = 3)
| # | Tabela | Origem (linha) | Superfície | Colunas thead × células row | Row builder | Empty real (literal) | Interação |
|---|---|---|---|---|---|---|---|
| 1 | **Ranking de designers** | renderExecPanel 5540 | Executivo (F10) | **7 × 7 (consistente)**: Designer · Carga · % no prazo · Lar. · Atr. · Crít. · Atraso méd. | `execDesRow` 5521 | `<tr><td colspan="7">` "Sem designers no período." | NENHUMA (read-only) |
| 2 | **Atrasos por designer** | renderReports 5621 | Relatórios (F11) | **5 × 7 (DÍVIDA — §21)**: thead Designer · Atrasadas · Críticas · Atraso méd. · % no prazo; rows = execDesRow (7 células) | `execDesRow` 5521 | `colspan="5"` "Sem designers." | NENHUMA |
| 3 | **Histórico resumido por tarefa** | renderReports 5623 | Relatórios (F11) | **4 × 4**: Tarefa · Responsável · Atrasos · Linha do tempo | inline (título · nome soft · `execPill` N× · `rep-tl`) | `colspan="4"` "Sem histórico de atraso no período." | NENHUMA |
Nenhuma outra `<table>` existe (Config/Equipe/Central/etc. usam listas/rows — §22). CSS único:
`.exec-tbl` (5502–5503). Ordenação dos DADOS é feita na fonte (ex.: `execRiskScore` no
agregador), **não** na tabela.

## 4 · GOLDEN ANCHORS
**F10 — Executivo** (`9de9a6b`): tabela nº 1 completa. **F11 — Relatórios** (`efb264a`):
tabelas nº 2 (representada com as 7 colunas REAIS das rows; header 5 registrado como dívida) e
nº 3 (timeline hospedada). As âncoras cobrem TODA a taxonomia → **sem gap visual C7**.

## 5 · TAXONOMIA (emerge do código)
**UMA família real** — *Dense data table* (`.exec-tbl` única) — com **duas composições**:
(a) **Métrica/ranking** (person cell + numéricos + pct cell + severity pills + unidade "min");
(b) **Histórico** (texto + pill de contagem + célula-hospedeira de timeline).
Não criar terceira variante nem nomes sem correspondência no produto.

## 6 · ANATOMIA
- **Container:** a tabela vive DENTRO de um card (exec-card/card Golden: surface, radius,
  hairline/sh-1, header de card com título + sub contagem). A `<table>` em si: `width:100%;
  border-collapse:collapse`, sem borda externa própria, sem sombra própria, sem overflow próprio.
- **Header (`th`):** real 11/600 #6E7480, `text-align:left` (centro via `.c`), padding 6×8,
  divider inferior hairline. **Light Golden aprovado (F10/F11): 10.5/700 UPPERCASE tx-4,
  letter-spacing .03em, padding 0 10 9, hairline `--hair`.** Sem sticky.
- **Row (`td`):** real 13, padding 9×8, divider hairline, última linha sem divider, sem hover/
  zebra/selected/background alternado. **Light Golden: 13.5 tx-2, padding 11×10, hairline
  `--hair-2`, tabular-nums.**
- **Célula:** variantes §9–§13. Alinhamento: texto à esquerda; numéricas/pills CENTRO (`.c`);
  pct cell à esquerda com % à direita do track.

## 7 · TOKENS C7 (real → Light Golden aprovado)
| Token | Real (dark) | Light Golden (F10/F11) |
|---|---|---|
| table | 100% · collapse | idem |
| th | 11/600 #6E7480 left · pad 6×8 · hairline | 10.5/700 uppercase tx-4 · pad 0 10 9 · `--hair` |
| td | 13 · pad 9×8 · hairline · last sem borda | 13.5 tx-2 · pad 11×10 · `--hair-2` · tabular-nums |
| align center | `.c` | `.c` |
| person cell | `exec-dz`: avatar 24 + **primeiro nome** bold 13/600 gap 9 | avatar 24 (ring identidade) + 13.5/650 tx-1 |
| pct cell | `exec-pcell`: track flex h6 r4 min-w 54 + fill · % 12/700 w34 right | track 74×6 sunk + fill · % 12.5/700 |
| pct thresholds | ≥90 verde · ≥75 azul · ≥60 laranja · senão vermelho (fill E texto) | mesmas faixas, hex Light (34D399/60A5FA/F59E0B/EF4444 + inks) |
| severity pill | `exec-pill`: min-w 22 · pad 2×7 · r7 · 12/700 · tint hex+22 | min-w 24 · h22 · r7 · 12/750 · tint 14% + ink |
| unidade | "N min" · vazio = "—" (soft) | idem (tx-3) |
| empty | `<tr><td colspan>` texto soft (literais §3) | idem — inline na tabela, NÃO usa `emptyState()` |
| timeline cell | `rep-tl` hospedada (dots 8 + labels 11 + separadores 14×1; wrap) | contrato do F11 (C-candidato próprio) |

## 8 · DENSIDADE (a única existente)
Row real ≈ 31–40px (13px + 2×9 pad; célula mais alta manda — pct/pill/avatar 24). Golden Light
≈ 44–46px. **Não existem modos "compact/comfortable"** — densidade única operacional, sem
aparência de planilha (sem gridlines verticais; só dividers horizontais hairline).

## 9 · ALINHAMENTO NUMÉRICO (real)
Contagens e pills = **CENTRO** (`.c`); % = dentro da pct cell (número à direita do track,
largura fixa 34/w); "Atraso méd." = centro com unidade "min" (ou "—"); títulos/pessoa/timeline
= esquerda. **Light Golden acrescenta `font-variant-numeric: tabular-nums`** (aprovado F10).
Sem decimais no real; não introduzir.

## 10 · PERSON CELL
Avatar 24 + **primeiro nome** (`first(name)`) em bold. Contrato global de foto: cadastrada →
foto real do runtime; sem foto → iniciais; identidade por anel de cor (C1). Nunca versionar
foto pessoal.

## 11 · PERCENTAGE CELL
Track + fill + valor textual SEMPRE presente (cor nunca é o único indicador — número
acompanha). Clamp 0–100 real. Não é gráfico; sem tooltip; sem animação declarada.

## 12 · SEVERITY PILL (na tabela)
Tint + ink por severidade (laranja/vermelho/crítico; verde para 1× no histórico) com o VALOR
numérico dentro (0 inclusive — célula nunca fica vazia). Semântica = contagem por severidade;
o texto permanece.

## 13 · TIMELINE CELL
A linha do tempo SLA (`rep-tl`/`repStepColor`) é **componente próprio do F11 hospedado na
célula** — C7 define apenas a HOSPEDAGEM (célula à esquerda, conteúdo pode quebrar linha e a
row cresce; truncamento real = `steps.slice(-7)` na fonte). Não duplicar a foundation da
timeline dentro de C7.

## 14 · INTERAÇÕES — inexistentes (registrado; nunca inventar)
**ROW ACTION/CLICK = NÃO EXISTE** (nenhum handler/data-attr nas rows) · **SORTING = NÃO EXISTE**
(nenhum listener em `th`; sem asc/desc/ícone — ordenação é da FONTE de dados) · **PAGINAÇÃO =
NÃO EXISTE** (reconfirmado; corte real = `slice` na fonte, ex.: histórico 10, e scroll da
página) · **ROW SELECTION = NÃO EXISTE** (sem checkbox/active row) · sem sticky header, column
resize, filtros na tabela (filtros reais vivem na TOOLBAR da superfície), bulk actions, menus,
exportação na tabela (export do F11 é ação da superfície, não da tabela).

## 15 · EMPTY (comportamento real)
A tabela NÃO some: renderiza o `<thead>` + uma única row `colspan` com o literal soft (§3).
Não usa `emptyState()` (C4) — apenas referência cruzada; C4 permanece foundation própria.

## 16 · SCROLL
Real: sem scroll próprio da tabela (sem max-height/overflow-x no `.exec-tbl`); a página/coluna
rola; largura natural dentro do card. Clipping horizontal não tratado no real — vira ponto de
atenção do R8 (1366×768/125%), NÃO resolvido aqui.

## 17 · RESPONSIVIDADE (requirement — validação = R8)
Validado visualmente: **somente 1920×1080** (F10/F11). Requisitos: 1366×768 e Windows 125%.
Estratégias PERMITIDAS (derivadas do layout Golden, decisão final só no R8): compressão de
colunas (paddings/track menores), truncation de texto com reticências, e — em último caso —
scroll horizontal do CARD contêiner. Nada declarado pronto.

## 18 · ACESSIBILIDADE (requirement × comprovado)
**Comprovado no real:** semântica nativa `<table><thead><th>/<tbody>` (headers programáticos);
valores sempre textuais (pills/% com número — cor nunca sozinha); empty textual.
**Requirement (não existe hoje; não declarar):** `scope="col"` nos th; `aria-label`/caption da
tabela; foco/teclado em rows (não aplicável — sem interação); contraste dos tons soft a
revalidar no claro (R9 consolida).

## 19 · DEPENDÊNCIAS — **C7 CONSOME C1** (e vizinhos)
Avatar/anel de identidade, pills, tipografia, hairlines, tabular-nums, tokens de cor por
severidade = **C1/tokens Golden** (não redefinidos). Timeline cell → componente F11. KPI/chart/
stat-tile ao redor das tabelas = **C8/foundations próprias** (não absorvidos). Card contêiner =
contrato de card Golden.

## 20 · **LIST ≠ TABLE** (regra formal)
Lista tem anatomia própria (row flex, sem thead/colunas): `execMiniList` (exec-ml k/v),
notification row (F9 `ncRow`), `infoline` (Conta/Segurança/Sobre), `settrow` (Config), urgentes
do Hoje, day-list da Agenda. **Nenhuma lista é "tabela"**; C7 aplica-se apenas às 3 estruturas
do §3. Mini-lists truncam por `slice(0,5–6)` — comportamento de LISTA, não de tabela.

## 21 · DÍVIDAS (fora do redesign; NÃO corrigir)
- **F11 · thead 5 × rows 7 (re-provada nesta R4):** `renderReports` monta 5 `<th>` mas reusa
  `execDesRow` com 7 `<td>` → desalinhamento header×célula EM PRODUÇÃO (o empty também usa
  `colspan="5"` sob rows de 7). A **representação Golden aprovada** (F11) mostra as 7 colunas
  reais das rows — contrato visual; o código segue com o bug até fase FUNCIONAL do owner.
- Tons soft do real (#6E7480/#9FB0C8) vêm do tema dark — remapeados no Light (tx-3/tx-4); sem
  mudança de produção.

## 22 · GUARDRAILS DE IMPLEMENTAÇÃO (futuros; design-only hoje)
Não introduzir sorting/paginação/seleção/hover/zebra/sticky/ações de linha sem decisão do
owner · manter alinhamentos e literais · pct cell sempre com número · pills sempre com valor ·
empty inline por colspan (literais) · timeline permanece componente hospedado · a dívida 5×7 é
correção FUNCIONAL (thead), nunca "consertada" só no CSS/visual.
