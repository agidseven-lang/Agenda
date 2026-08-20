# LIGHT UI — I3K.1 · F11 — FUNCTIONAL/STRUCTURAL DEBT HARDENING (ADENDO)

**Código testado:** `db53881a` · **Natureza:** HARNESS + AUDITORIA + DOCS ONLY — **zero mudanças em `desktop/src`** (md5 do `index.html` idêntico ao commit antes E depois da bateria; worktree limpa; 1.0.246; Light UI inativa; F12 não iniciado).

**Objetivo:** fechar objetivamente F11-D01 (tabela 5×7) e a classificação do export vazio antes da decisão de congelamento da F11.

---

## GATE 1 — Higiene · PASS
`db53881a` (HEAD confirmado) · worktree limpa · 1.0.246 · md5 `index.html` == md5 `db53881a:index.html` (`efd49d40…`) · F12 não iniciado.

## GATE 2 — F11-D01 · Matriz TH×TD (provada no DOM) · PASS

**th count = 5 · td count = 7** (provado). Zero `colspan`/`rowspan` nas células de dados; empty interno da tabela = `colspan="5"` "Sem designers." (provado com lista não-vazia sem designers). **Zero `scope`, zero `headers`/`id`, zero `aria-*` em toda a tabela** (th e td); `<table class="exec-tbl">` sem role/aria-label.

| pos | TH (real) | TD (real, execDesRow) | fonte real | associação semântica implícita |
|---|---|---|---|---|
| 1 | `Designer` | avatar + `first(r.name)` | porDesigner.name/user | **CORRETA** |
| 2 | `Atrasadas` | `r.carga` | tarefas NÃO concluídas do designer | **ERRADA** (rótulo "Atrasadas" sobre a carga) |
| 3 | `Críticas` | `execPctCell(r.pctNoPrazo)` | % conclusões no prazo | **ERRADA** |
| 4 | `Atraso méd.` | `execPill(r.laranja,'laranja')` | warnings ativos | **ERRADA** |
| 5 | `% no prazo` | `execPill(r.atras,'vermelho')` | overdue não-críticos | **ERRADA** |
| 6 | — (SEM TH) | `execPill(r.critico,'critico')` | críticos | **ÓRFÃ** |
| 7 | — (SEM TH) | `r.atrasoMedMin+' min'` \| `'—'` | média ms dos overdue (round(ms/60000)) | **ÓRFÃ** |

**As duas células sem header = posições 6 (pill de críticas) e 7 (atraso médio).** Ambas são **informação REAL** (não artefato): derivam de `byDes.critico` e `atrasoMsSum/atrasoN` do agregador congelado. Sort da tabela: risco (`execRiskScore`) desc → carga desc — não referenciado por nenhum header (sem sorting interativo; C7 §22 o proíbe sem decisão do owner). Associação acessível alternativa: **NENHUMA existe**.

## GATE 3 — Impacto a11y · severidade **MEDIUM** · PASS (não corrigido)

Sem `headers`/`scope`, leitores de tela aplicam o algoritmo implícito do HTML (header da mesma coluna no thead): **td1 anunciada corretamente; td2–td5 anunciadas com header ERRADO** (ex.: "Atrasadas: 5" quando 5 é a CARGA; "Críticas: 0%" quando é o % no prazo); **td6–td7 anunciadas SEM header** (números órfãos "5", "309 min" sem contexto próprio — pills não têm aria-label). Navegação por células permanece tecnicamente possível, mas a **ambiguidade é real e sistemática: 4 de 7 colunas com rótulo incorreto + 2 sem rótulo** — o usuário de AT recebe dados factualmente errados por associação. **Severidade MEDIUM**, justificativa objetiva: (agrava) associação incorreta — pior que ausente — em 4 colunas; células órfãs; desalinhamento também visível a olho nu (headers deslocados); (mitiga) superfície read-only secundária sem ação/perda de dados; valores em si corretos; os MESMOS números existem corretos nos KPIs/listas da própria página; tabela curta (1 header row, sem interação). Não é HIGH (não induz ação destrutiva nem bloqueia a superfície); não é LOW (informação incorreta para AT não é cosmética).

## GATE 4 — Autoridade do Golden/contrato (trechos LITERAIS) · PASS

**a) Golden `proposta-c-frame11-relatorios.html` (freeze `efb264a4` — "design(light-ui): Frame 11 Relatorios de Atraso — superficie real (renderReports) no DS Golden"), comentário de cabeçalho, linhas 50–57:**
> "▸ DÍVIDA FUNCIONAL registrada (precedente Subtipo; NÃO corrigir): a tabela "Atrasos por designer" no renderReports tem HEADER de 5 colunas (Designer/Atrasadas/Críticas/Atraso méd./% no prazo) mas reusa execDesRow que emite 7 células (Designer/Carga/%noPrazo/Lar/Atr/Crít/Atraso méd) — DESALINHAMENTO header×linha em produção. […] O mockup representa a tabela com as 7 colunas REAIS que as linhas contêm (contrato Golden do F10), registrando o header buggy como dívida."

**b) `C7-TABLE-CONTRACT.md` (R4 aprovada `2516426`) — §21 "DÍVIDAS (fora do redesign; NÃO corrigir)":**
> "F11 · thead 5 × rows 7 (re-provada nesta R4): `renderReports` monta 5 `<th>` mas reusa `execDesRow` com 7 `<td>` → desalinhamento header×célula EM PRODUÇÃO (o empty também usa `colspan="5"` sob rows de 7). A **representação Golden aprovada** (F11) mostra as 7 colunas reais das rows — contrato visual; **o código segue com o bug até fase FUNCIONAL do owner.**"

**c) `C7-TABLE-CONTRACT.md` §22 "GUARDRAILS":**
> "…a dívida 5×7 é **correção FUNCIONAL (thead), nunca 'consertada' só no CSS/visual.**"

**Resposta objetiva:** o contrato congelado **NÃO exige preservar 5×7 — apenas REGISTRA a dívida existente** e a exclui do escopo do redesign/skin. O "NÃO corrigir" é instrução de ESCOPO da trilha de design (nota de guardrail dirigida às fases de skin), com destino explícito: "correção FUNCIONAL (thead)" em "fase FUNCIONAL do owner". O **estado-alvo visual aprovado tem 7 headers** (o mockup os desenha). O contrato também **VETA** qualquer conserto CSS/visual-only.

## GATE 5 — Viabilidade de correção (modelada; NADA implementado) · PASS

| Opção | Mudança | Funcional? | Visual? | Legacy 0px F11? | Export/Sort | Screen reader | Risco F1–F10 |
|---|---|---|---|---|---|---|---|
| **A. manter 5×7** | nenhuma | — | — | ✓ (atual) | — | permanece MEDIUM | zero |
| **B. thead com 7 th reais** (`Designer·Carga·% no prazo·Lar.·Atr.·Crít.·Atraso méd.`) + `colspan 5→7` no empty | **1 linha** do `renderReports` (thead literal) + literal do colspan | NÃO (dados/sort/agregador intactos) | SIM (rótulos corretos + 2 novos, todos os temas) | **NÃO** — diff visual APENAS na tabela F11 (esperado e justificado) | zero impacto (taskRows/export não derivam do thead) | **CORRIGE 7/7 associações** | **zero** (linha exclusiva da F11; a F10 já tem seu próprio thead de 7 correto — B iguala F11 à F10 real e ao Golden) |
| **C. remover/reordenar 2 td** | `execDesRow` (COMPARTILHADO com F10 congelada) ou variante duplicada | SIM (perde Carga/pill = downgrade funcional PROIBIDO) | SIM | não | risco | parcial | **ALTO (F10)** — descartada |
| **D. associação acessível sem mudar apresentação** (pós-processamento no `afterReports` da F11: `id` nos th + `headers`/`aria-label` nos td via setAttribute) | JS da superfície F11 (~6 linhas), zero mudança visual | NÃO | NÃO (atributos pixel-inertes) | **SIM (0px)** | zero | corrige as ÓRFÃS e pode re-rotular td2–5 — mas o VISUAL continua desalinhado (AT ouviria rótulos diferentes do que se vê — nova divergência) | zero |
| **E. F11-Light-UI-only (CSS desenha 7 headers)** | esconder 5 th e gerar texto via pseudo-elementos | — | — | — | — | AT leria os th escondidos ou nada (fake markup) | **INVIÁVEL: violaria o C7 §22 ("nunca consertada só no CSS/visual") e a restrição sem clone/fake markup** |

**Leitura técnica:** B é a correção canônica (a que o C7 §21/§22 já prevê), custo 1 linha + colspan, risco zero fora da própria tabela F11; D é o único paliativo 0px-legacy possível, mas cria divergência falado×visto e NÃO fecha a dívida. C e E descartadas tecnicamente. **Nenhuma opção foi implementada.**

## GATE 6 — Export vazio (literal, os dois lados) · PASS

- **Copy EXATA da UI (empty state, byte a byte):** título `Sem dados no período selecionado`; corpo `Nenhuma tarefa nos filtros atuais. Ajuste o período/filtros — a exportação gera um arquivo vazio com cabeçalho.`
- **Botões:** os 2 `rep-exp` CONTINUAM renderizados e ligados no empty (onclick E onkeydown provados) — o empty retorna antes dos cards mas depois da toolbar.
- **CSV vazio (provado):** `toCSV([])` → `if(!rows||!rows.length) return ''` → payload **`''` (0 bytes) — SEM cabeçalho**; filename `relatorio-atraso-2026-08-20.csv`; mime `text/csv;charset=utf-8`; `execDownload` retorna true (arquivo vazio é gerado).
- **JSON vazio (provado):** payload **828 bytes, NÃO vazio** — shape completo `{geradoEm,filtros,kpis,porDesigner:[],porCliente:[],porTipo:[],periodo:[7 buckets zerados],reincidentes:[],tarefas:[]}` com `kpis {atrasoMedio:0, pctNoPrazo:100, reincidentes:0, criticas:0}`.
- **O que a interface promete:** "a exportação gera um arquivo vazio com cabeçalho". **O que entrega:** CSV = vazio SEM cabeçalho (contradiz "com cabeçalho"); JSON = arquivo NÃO-vazio com estrutura completa (contradiz "arquivo vazio").

## GATE 7 — Classificação corrigida · PASS (docs only)

- **F11-E01** permanece representando SOMENTE `.rep-pbn.z` (estilo Golden-only do zero nas barras — segue válido).
- **Export vazio → F11-D02 (defeito, severidade LOW):** existe **promessa funcional contradita** — o texto do empty afirma comportamento ("arquivo vazio com cabeçalho") que a implementação não cumpre em NENHUM dos dois exports (CSV entrega menos: 0 bytes sem cabeçalho; JSON entrega mais: objeto completo). Não é mera nota herdada: é copy funcional da própria F11 descrevendo o export incorretamente. LOW: texto informativo em edge-case, sem perda de dados, exports em si consistentes com as funções. Correção candidata (a decidir pelo owner): ajustar a string OU fazer `toCSV` emitir o header com 0 rows — ambas mudanças mínimas, NÃO executadas.
- Relatório I3K atualizado (§21 reclassificado; adendo com matriz/autoridade/opções). **Zero código.**

## GATE 8 — Critical boundary (reexecutado; constantes literais) · PASS

Constantes literais provadas: `SLA_PANEL_GRACE_MS=600000` · `SLA_PANEL_WARN_MS=1800000` · `SECTOR_SLA.cronograma.overdueGraceMinutes=10` · `SECTOR_SLA.edicao_midia.overdueGraceMinutes=20` (warning 40) · `slaCfgDefault()=10`.

| setor | GRACE | GRACE−1ms | GRACE exato | GRACE+1ms |
|---|---|---|---|---|
| cronograma | 600000ms | **critical=false** · texto "Atraso **10 min**" | **critical=true** · "Atraso **10 min**" | critical=true · "Atraso **10 min**" |
| edicao_midia | 1200000ms | **critical=false** · "Atraso **20 min**" | **critical=true** · "Atraso **20 min**" | critical=true · "Atraso **20 min**" |

Ilustrativos edicao_midia (valores seguem adequados à constante 20): 15 min → critical=false · 25 min → critical=true. **Registro obrigatório:** o texto exibido é IDÊNTICO dos dois lados do threshold ("10 min"/"20 min" via `round`) — o critério real é ms-bruto (`now>=finishMs+GRACE`, comparação ≥); a documentação NÃO mascara bug: display arredondado pode mostrar "10 min" ANTES do threshold em ms (599999ms) sem ser crítico.

## GATE 9 — Export hardening (reexecutado) · PASS

CSV normal: **payload byte-IDÊNTICO a `toCSV(R.taskRows)`** (===) · 9 linhas · header literal `tarefa;cliente;tipo;designer;status_sla;atraso_min;reincidencias;prazo;concluida` · `;`+aspas no conteúdo → `"Cronograma ""urgente""; edição"` ✓ · UTF-8 (ê/ç presentes; charset no mime) ✓ · campo vazio `;;` ✓ · **quebra de linha no conteúdo → `"Linha1\nLinha2"` DENTRO de aspas** (1 linha lógica; 11 linhas físicas com 10 rows — parser CSV correto lê 1 registro; escaping literal provado) ✓ · zero rows = `''` (GATE 6). JSON: shape 9 chaves ✓ · optional field (client ausente → `cliente:''` presente como string vazia — semântica literal `t.client||''`) ✓ · tipos numéricos ✓ · **tarefas/porDesigner byte-idênticos ao recomputo da função real** ✓ · zero rows = shape completo (GATE 6). **Zero backend writes · zero storage novo** (só wp_uid/wp_name do saveSession real do boot).

## GATE 10 — Hash invariance · PASS
Ao final da bateria: HEAD = `db53881a` · `git status --porcelain` vazio · **md5 `desktop/src/renderer/index.html` == md5 `db53881a:…/index.html` = `efd49d40a28b1bca0d64e46ab0309b68`** → ZERO mudança de código.

## GATE 11 — Vínculo da evidência da I3K · PASS
Nenhuma mudança de renderer ocorreu (GATE 10) ⇒ os screenshots F11-RELATORIOS-* e toda a evidência de regressão/legacy da I3K permanecem vinculados a `db53881a` por hash (o conteúdo testado é byte-idêntico ao commit). Bateria visual NÃO repetida (desnecessária sem mudança de código — conforme mandato).

## GATE 12 — Documentação · PASS
Este relatório + relatório I3K atualizado (reclassificação D02; adendo matriz/severidade/autoridade/opções) + roadmap: **I3J = ✔ GO · F10 = CONGELADA @ `594cf02c` · I3K = ENTREGUE · I3K.1 = HARDENING ENTREGUE — AGUARDA OWNER · F11 = NÃO CONGELADA · CHECKPOINT CANDIDATO = `db53881a` · F12 = NÃO INICIADO.**

---

## Síntese e recomendação

Defeitos abertos da F11 (ambos PRÉ-EXISTENTES no produto, nenhum introduzido pela skin):
- **F11-D01 (MEDIUM):** thead 5 × rows 7 — 4 colunas com rótulo errado + 2 órfãs para AT; o contrato NÃO exige preservar (registra e destina a correção FUNCIONAL do thead ao owner); correção B = 1 linha + colspan, risco zero fora da tabela F11.
- **F11-D02 (LOW):** copy do empty promete "arquivo vazio com cabeçalho"; CSV real = 0 bytes sem cabeçalho; JSON real = objeto completo não-vazio.

**Recomendação: FIX BEFORE FREEZE** — autorizar mandato curto (I3K.2) aplicando a opção **B** (thead de 7 headers reais + `colspan="7"` no empty, espelhando o Golden aprovado e o thead que a F10 real já usa) e resolvendo **D02** (ajuste da string do empty OU header em CSV vazio — 1 mudança mínima), com re-prova dirigida (tabela + export + legacy da F11 com diff esperado documentado + regressão F1–F10 0px). Custo total ≈ 2 linhas; remove uma dívida MEDIUM de a11y ANTES do congelamento. Alternativa válida se o owner preferir congelar já: ACCEPT DEBT + FREEZE com D01/D02 formalizados (o C7 §21 já os destina a fase funcional futura).

**HARD STOP.** D01 NÃO corrigido · F12 NÃO iniciado · aguardando decisão explícita do owner.

---

**[ATUALIZAÇÃO I3K.2]** O owner autorizou FIX BEFORE FREEZE. **F11-D01 e F11-D02 RESOLVIDOS em `cdea6da5`** (branch `fix/light-ui-f11-d01-d02-1.0.246`; opção B do GATE 5 + copy verdadeira; F10/execDesRow/exports provados invariantes) — ver `LIGHT-UI-I3K2-F11-D01-D02-FIX-REPORT.md`.
