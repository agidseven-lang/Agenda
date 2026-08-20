# LIGHT UI — I3K.2 · F11 — D01 + D02 SURGICAL FIX

**Natureza:** correção funcional AUTORIZADA pelo owner (FIX BEFORE FREEZE da I3K.1).
**Base:** `db53881a` (HEAD exato confirmado; worktree limpa; 1.0.246; Light UI inativa; F1–F10 intactos; F12 não iniciado; branch criado DIRETO de `db53881a` — não do commit de docs `adee6353`).
**Branch:** `fix/light-ui-f11-d01-d02-1.0.246` · **Checkpoint:** `cdea6da5` (`fix(reports): resolve F11 table headers and empty export copy`)
**Status:** ENTREGUE — aguarda owner. **F11 NÃO CONGELADA. F12 NÃO INICIADO.**

---

## FASE 1 · Revalidação literal PRÉ-edit · PASS

Reprovados no código atual ANTES do edit: (A/B) thead F11 com **5 th** `Designer|Atrasadas(.c)|Críticas(.c)|Atraso méd.(.c)|% no prazo` (linha 7006); (C) `execDesRow` (linha 6906, definição ÚNICA, 3 ocorrências = def + F10 + F11) com **7 td** na ordem nome|carga(.c)|pct|lar(.c)|atr(.c)|crít(.c)|amed(.c); (D) empty interno `colspan="5"` "Sem designers."; (E) copy exata "…a exportação gera um arquivo vazio com cabeçalho."; (F/G/H) toCSV/JSON builder/execDownload localizados e FORA do edit; (I) `execDesRow` COMPARTILHADO com F10 (linha 6925 — thead da F10 já tem 7).

**Matriz pré-edit e HARD GATE da fonte (inequívoca, DUPLA):** o Golden F11 aprovado (`efb264a4`, linha 330) e o thead REAL da F10 (`renderExecPanel`, sobre o MESMO execDesRow) são **IDÊNTICOS**: `Designer · Carga(.c) · % no prazo · Lar.(.c) · Atr.(.c) · Crít.(.c) · Atraso méd.(.c)` — exatamente a ordem real dos 7 td. Nenhum header inventado; nenhum td reordenado. `scope="col"` NÃO aplicado: não é padrão real (nem F10 nem Golden usam) — aplicá-lo ampliaria o diff.

## FASE 2 · Fix · PASS

1. thead F11 5→**7** (labels/classes byte-iguais ao thead da F10/Golden); 2. empty interno `colspan 5→7`; 3. copy do empty → **"Nenhuma tarefa nos filtros atuais. Ajuste o período/filtros — as exportações continuam disponíveis."** (preferência funcional do mandato; verdadeira p/ CSV E JSON; Golden não oferece alternativa literal verdadeira — o comentário do protótipo repete a promessa falsa). NADA além: execDesRow/dados/fórmulas/ranking/risco/critical/carga/%/F10/CSS intocados; zero CSS novo; zero ARIA paralela.

## FASE 3 · Prova D01 (DOM) · PASS

**th=7 · td=7 · mapping 7/7 correto · 0 órfãs · 0 header deslocado · empty colspan=7** (provados no DOM):

| pos | TH | TD | dado real |
|---|---|---|---|
| 1 | Designer | avatar+nome | porDesigner.name |
| 2 | Carga | 5 | tarefas não concluídas |
| 3 | % no prazo | 0% (pct cell) | conclNoPrazo/concl |
| 4 | Lar. | 0 (pill) | warnings |
| 5 | Atr. | 0 (pill) | overdue não-crít |
| 6 | Crít. | 5 (pill) | críticos |
| 7 | Atraso méd. | 309 min | round(atrasoMsSum/atrasoN/60000) |

Classes th `['','c','','c','c','c','c']` casam com as td. **F10 invariante (before×after):** thead da F10 idêntico (7 labels), row0 text+html idênticos, **`execDesRow.toString()` byte-idêntico**. **Sort/valores intactos:** rows F11 before×after IDÊNTICAS (`BMBoaz50%005309 min` / `FTFelipe6100%12116 min` — risco 15>8, iniciais = avatar-fallback do harness sem foto).

## FASE 4/5 · Fix + prova D02 · PASS

Copy antiga (before, byte a byte): "Nenhuma tarefa nos filtros atuais. Ajuste o período/filtros — a exportação gera um arquivo vazio com cabeçalho." → Copy nova (after): "Nenhuma tarefa nos filtros atuais. Ajuste o período/filtros — as exportações continuam disponíveis." (título "Sem dados no período selecionado" inalterado). **Mecanismo de export INTOCADO e provado before×after:** CSV vazio `toCSV([])` = `''` **0 bytes** idêntico · JSON vazio **byte-idêntico** (shape completo da I3K.1) · **CSV normal byte-idêntico (`===`)** · **JSON normal byte-idêntico exceto o campo `geradoEm`** (timestamp de relógio REAL gravado pelo handler em cada execução — única diferença possível por construção; todo o resto byte-igual) · filenames e MIMEs idênticos nos 4 payloads.

## FASE 6 · Critical/KPI invariance · PASS

Boundary before×after IDÊNTICO: cron GRACE=600000ms → −1ms false / exato true / +1ms true · edicao_midia GRACE=1200000ms → false/true/true. KPIs da fixture I3K idênticos: **199 min · 50% · 3 · 6**; filtro designer=ft → críticas 1 (idem before); rows/sort idem (FASE 3). Smoke I3K completo re-executado no AFTER: **48/48 PASS** (g11 atualizado para o thead corrigido de 7).

## FASE 7 · A11y · PASS

7 headers correspondentes → associação implícita **7/7 correta** pela estrutura real (sem ARIA paralela); nested interactive = 0; teclado preservado: Enter liga o toggle (aria-pressed true) e Espaço desliga com defaultPrevented; exports com role/tabindex intactos; **zero toque em F9** (diff audit — F9-D01 protegido); nenhum tabindex novo; focus-visible preservado (CSS intocado).

## FASE 8 · Write map · PASS
Firestore/API/Functions/Worker writes = **0** em toda a bateria (incl. exports = download local); localStorage novo = **0** (só wp_uid/wp_name pré-existentes do boot).

## FASE 9 · Diff audit · PASS

**1 arquivo · 2 linhas reescritas (+2/−2)** — linha 7001 (copy D02) e linha 7006 (thead 7 + colspan 7). Funções tocadas: NENHUMA (só o template string do `renderReports` nessas 2 linhas). Markup tocado: thead+colspan+copy da F11. **CSS: ZERO.** HARD GATE greps no diff = 0 para: execDesRow(def), F10 ("Ranking de designers"), F9 (nc-*/notifHistory), F8 (agenda), shared SLA (resolveTaskDisplayState/SLA_PANEL/GRACE), exports (toCSV/execDownload/geradoEm), filtros (data-rep-filter/period), routing (state.tab===).

## FASE 10 · Visual before×after F11 (base `db53881a`) · PASS (bounded, provado por bbox⊆rect)
**Populated 1920:** diff bbox (522,497,1250,589) ⊆ rect do card da tabela (326,444,1267,773)±3 — o diff cobre o thead corrigido + o realinhamento das colunas do próprio tbody (consequência direta do table layout com os 7 headers); **KPIs, filtros, barras, laterais, footer e exports = 0px** (nada fora do card). **Empty 1920:** diff (890,409,1287,439) ⊆ rect da própria linha da copy (.exec-empty-s 878,407,1298,439) — só o texto D02. **1366:** diff ⊆ card da tabela. **win125:** diff = 0px — o thead fica abaixo do fold (~614 CSS) nessa altura com a fixture (card inicia em y=601; a região alterada não é visível no recorte) — documentado, não mascarado.

## FASE 11 · Golden F11 · PASS
**D01 → MATCH:** o thead de 7 colunas agora é IGUAL ao desenhado no Golden aprovado (mesmos labels/ordem/classes). **D02 → ADAPTAÇÃO FUNCIONAL JUSTIFICADA (não-ISSUE):** a copy nova diverge do texto do protótipo por necessidade de verdade funcional (o comentário do Golden repetia a promessa falsa "arquivo só com cabeçalho" — refutada empiricamente na I3K.1). **Fidelity final: ZERO ISSUE.**

## FASE 12 · Regressão F1–F10 (base `db53881a`) · PASS
28 pares: **24 = 0px PURO** — incluindo os HARD GATES **F10 main+empty = 0px** (execDesRow compartilhado provado intacto) e **F9 populated+detail = 0px** — e legacy Executivo dark/light/hc, Central dark/light/hc, Detalhes dark, Agenda dark = 0px. f3 board/f3 painel/f4 painel/f5 board divergiram SÓ nas bboxes conhecidas do sino ((1458,26,1500,68) e (1443,29,1485,71)) com flake **AUTO-PROVADO A–E per-superfície** (base×base e/ou cur×cur divergem sozinhos na MESMA bbox; máscara = apenas essa bbox; **0px fora nos 4**). Nenhum pixel real em F10 → HARD GATE cumprido.

## FASE 13 · Legacy F11 (dark/light/hc) + suíte · PASS (bounded intencional)
F11 legacy dark/light/hc (sem body.light-ui): diff (541,553,1210,645) ⊆ rect do card da tabela (363,500,1226,829)±3 **nos 3 temas** — a mudança legacy limita-se ao thead corrigido/realinhamento interno da tabela (copy D02 não visível no estado populated); todo o restante da F11 legacy = 0px. Demais superfícies legacy da suíte (Exec/Central 3 temas + Detalhes + Agenda dark) = **0px puro** (FASE 12). Diff intencional NÃO mascarado.

## FASE 14 · Responsive · PASS
1920 / 1366 / win125 (1093×614 @1.25): **7 headers cabem** sem sobreposição e sem colapso incorreto (rects do card idênticos before×after em TODOS os viewports/temas — a correção não altera a geometria do card); nenhuma coluna desaparece; zero page x-overflow (scrollW==vw provado no smoke/responsivo da I3K, re-válido — e re-medido nos renders); media ≤1100 real continua regendo (KPIs 2 col no win125); sem fake scale.

## FASE 15 · Smoke/hardening · PASS
**Smoke I3K re-executado: 48/48** + **27 gates dedicados I3K.2** (before×after): th7 · td7 · mapping7/7 · orphans0 · emptyColspan7 · thClasses↔td · F10 thead same · F10 row same · execDesRowSrc same · rows literais same · copyOld provada · copyNew provada · título same · csvEmpty same ('' 0 bytes) · jsonEmpty same · csvNormal byte-identical · jsonNormal byte-identical (exceto geradoEm — relógio real) · filenames/MIMEs same · boundary same (cron+em ±1ms) · boundaryValues · KPIs same (199/50%/3/6) · kpiFilter same · keyboard (Enter/Espaço) · nested0 · zeroWrites · storage0 · dataset g04. **Total: 75 gates PASS (48 smoke + 27 fix).**

## FASE 16 · Provas (chat)
F11-FIXED-{1920, 1920-EMPTY, 1366, win125}.png · **F11-FIXED-A11Y-TABLE.png** (clip real do card — thead 7 alinhado 1:1, sem overlay) · F11-FIXED-COMPARE-GOLDEN-vs-APP.png.

## FASES 17/18 · Checkpoint + docs
Checkpoint único `cdea6da5` + push (sem PR/merge/build/tag/release/bump/ativação). Docs: este relatório + I3K report (D01/D02 → RESOLVIDOS) + I3K.1 report (nota de resolução) + roadmap (**I3K.1 = ✔ GO · D01 = RESOLVIDO · D02 = RESOLVIDO · F11 = ENTREGUE — AGUARDA OWNER · F11 NÃO CONGELADA até GO explícito · F12 = NÃO INICIADO**).

**Recomendação: GO** — correção mínima (2 linhas), estrutural conforme C7 §21/§22, com F10 provado invariante (HARD GATE), exports byte-idênticos, boundary/KPIs intactos e a11y 7/7.

**HARD STOP.** F12 não iniciado. Aguarda GO explícito do owner para congelamento da F11.
