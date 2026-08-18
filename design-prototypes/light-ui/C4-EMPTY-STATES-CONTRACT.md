# C4 — EMPTY STATES · FOUNDATION CONTRACT (Light UI)

**Status:** CONSOLIDADA DOCUMENTALMENTE (R5) — aguarda owner; NÃO concluída. Fonte: Desktop
**1.0.246**. Zero produção; zero imagem nova. Nome formal: MASTER-SURFACE-MAP §F.

## 1 · OBJETIVO / ESCOPO
Congelar os empties REAIS. **Regra transversal comprovada: NENHUM empty do produto tem CTA nem
ilustração decorativa** — nunca adicionar "Criar agora". **EMPTY TABLE ≠ EMPTY PAGE:** tabela
vazia = comportamento C7 (thead + row colspan textual), apenas referenciado aqui.

## 2 · INVENTÁRIO REAL
| Empty | Superfície | Icon | Título | Sub (literal) | CTA | Condição |
|---|---|---|---|---|---|---|
| `emptyState('calendar',…)` | Agenda · dia | calendar | **Dia livre** | "Nenhum compromisso para esta data." | NÃO | dia sem eventos |
| `emptyState('calendar',…)` | Agenda · lista | calendar | **Sem compromissos** | "Nenhum compromisso encontrado." | NÃO | lista/busca vazia |
| `emptyState('checklist',…)` | Board · coluna | checklist | **Coluna vazia** | "Nenhuma tarefa em \"{status}\"." | NÃO | coluna sem cards |
| `nc-empty` inicial | Central Notificações | bell (eic 60 tint accent) | **Nenhuma notificação por aqui** | "Alertas de SLA, fluxo, atribuições…" | NÃO | histórico vazio |
| `nc-empty` filtrado | Central Notificações | bell | **Nada encontrado** | "Nenhuma notificação corresponde à busca/filtros atuais." | NÃO | busca/filtros sem resultado |
| `exec-empty` | Executivo | gauge (ic 64/18) | **Sem dados no período selecionado** | "Nenhuma tarefa com SLA nos filtros atuais. Ajuste o período ou os filtros acima." | NÃO | count===0 |
| `exec-empty` | Relatórios | bars | **Sem dados no período selecionado** | "…a exportação gera um arquivo vazio com cabeçalho." | NÃO | count===0 |
| `exec-empty-mini` | mini-lists Exec/Rep | — | — | "Sem itens no período." | NÃO | lista vazia |
| `emptyline` | Hoje (3×) | — | — | "Nada agendado para hoje." · "Nenhuma tarefa pendente. 🎉" · "Nenhum compromisso futuro agendado." | NÃO | seções vazias |
| (C7) row colspan | 3 tabelas | — | — | literais do C7 §3 | NÃO | tbody vazio |

## 3 · TAXONOMIA (emerge do código)
**UMA linguagem** (ícone-em-caixa + título + subtítulo, centrado, sem CTA) em **três escalas
reais**: **Padrão** (`emptyState()`: ebox 64/r18 hairline · título 15/800 soft · sub 12.5 faint)
· **Grande de superfície** (`nc-empty` 48vh / `exec-empty` 460px: ic 60–64 · título 17/700–800 ·
sub 13 max ~420–430) · **Linha** (`emptyline`/`exec-empty-mini`: texto único; desktop emptyline
= caixa dashed radius 14 centrada). **INITIAL ≠ NO RESULTS é REAL** (Central distingue títulos)
— manter a distinção; demais superfícies usam o mesmo componente para ambos (não inventar).

## 4 · GOLDEN ANCHOR
**R2 (`3c06c26`): "Dia livre"** — amostra aprovada da escala Padrão (Light: ebox 60/17 hairline,
título 14.5/750 tx-2, sub 12.5 tx-4, SEM CTA). Escalas Grande/Linha = mesmas fontes/tokens em
proporção — consolidação documental suficiente (**sem gap material**).

## 5 · TOKENS (real → Light)
ebox 64 r18 surface+hairline (grande 60–64; tint accent na Central) · ícone 26–30 faint · título
15→17 pesos 700–800 (Light 750 tx-2 / grandes tx-1) · sub 12.5–13 faint→tx-4, max-width 420–430,
line-height 1.5 · gap 9–12 · centrado vertical (48vh/460px nas grandes) · emptyline desktop:
dashed `--line`, r14, pad 18, texto faint.

## 6 · A11Y / RESPONSIVIDADE / DEPENDÊNCIAS / DÍVIDAS
Comprovado: conteúdo 100% textual (ícone decorativo). Requirement: nada adicional (sem CTA não
há alvo). R8 valida escalas em 1366/125%. C4 consome tokens C1; C7 referencia (não duplica).
Dívidas: nenhuma específica. **GAP VISUAL C4 = NÃO** (anchor R2 + escalas documentais).

## 7 · GUARDRAILS
Nunca adicionar CTA/ilustração/emoji extra (o "🎉" do Hoje é literal REAL — preservar); manter
literais; não fundir initial/no-results na Central; não usar emptyState() dentro de tabela.
