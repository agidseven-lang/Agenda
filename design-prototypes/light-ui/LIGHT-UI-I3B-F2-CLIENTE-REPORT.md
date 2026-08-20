# LIGHT UI — I3B · F2 CLIENTE REPORT

**Fase:** I3B — porte do Golden Cliente (Frame 2 aprovado) para o app real. **Status:**
ENTREGUE — aguarda owner. **Branch:** `impl/light-ui-f2-cliente-1.0.246` de `f10aabe0`
(HEAD confirmado antes do branch) · **checkpoint único `62613a29`** · 1 arquivo,
+102/−2 · version 1.0.246 · zero build/release/deploy · nenhum PR · Light UI inativa ·
**F3+ não iniciadas**.

## 1 · ORDEM DE AUTORIDADE APLICADA
Função/dados/permissões/workflow = código real 1.0.246 · Visual F2 = Frame 2 aprovado ·
Componentes shared = **F1 v4 final** (sidebar 266 teal, header, Monitor/bell, canvas,
toolbar/tabs tint, board grid, card foundation) · A11y = contracts+errata · Auxiliar =
UI UX Pro Max (v4/Frame 2 vencem).

## 2 · REAUDITORIA REAL (sem memória) — achados centrais
- **Colunas** `CLIENT_COLS4` reais: **Enviado `#5B6CFF` · Em análise `#22D3EE` · Revisão
  solicitada `#F59E0B` · Aprovado `#34D399`** — labels IDÊNTICOS aos do Golden (nenhuma
  cópia necessária); mapeamento por `flowBoardCol(t,'client')`/`deriveBoardColumn` real.
- **Faixa "Aprovações pendentes" = componente REAL** `wfApprovalsBarHtml`:
  | Indicador | Campo real | Fórmula | Determinístico? |
  |---|---|---|---|
  | Não visualizadas (nv) | `wfExternalInfo`: ativa ∧ !decidida ∧ `firstViewedAt`=0 | contagem | SIM |
  | Visualizadas sem resposta (vs) | ativa ∧ !decidida ∧ `firstViewedAt`>0 | contagem | SIM |
  | Ajustes solicitados (aj) | `clientReview.status='revisao'` ∨ `workflowPhase*_adjustment` | contagem | SIM |
  | Aguardam >24h | nv+vs com `waitingMs≥24h` | contagem | SIM (relógio) |
  | Badge total | nv+vs+aj | soma | SIM |
  "Ver aprovações →" abre o **drawer real** (`wfDrawer`). Nenhum número fabricado.
- **Visualizado/Não visualizado = dados REAIS**: rounds `approvalRounds.ar_{themes|captions}_rN`
  (`sentAt`/`firstViewedAt`/`decision`/`decisionAt`) via `wfExternalInfo`; timestamps
  reais (`slaibFmtHM`/`wfFmtDur`); nenhum horário fabricado.
- **External wait**: `externalWaitOf` real → SLA **neutro** ("Aguardando cliente") já no
  código; F2 não introduz severidade falsa (chip de SLA interno nem aparece no card).
- **Próxima ação**: helper real (`clientFacingNextShort` → `.kbv2-st2-next`); zero frase manual.
- **Status do card**: pill real client-facing (`kbv2DeriveStatus/pres.statusLabel`) —
  ex.: "Temas para sua aprovação", "Em preparação", "Versão final disponível para análise".
- **Permissões**: aba Cliente só existe via `canSeeAll(u)` real (taskChips); rota real.
- **Responsible**: anéis dos avatares seguem `respOf`/`userColor` (semântica congelada).

## 3 · IMPLEMENTAÇÃO (CSS + 3 hooks mínimos; zero rewrite)
Hooks aditivos, inertes no legado (0px provado): (1) classe `scr-client` na raiz da
surface; (2) `data-detorigin="client"` no hook real de origem do detalhe; (3) span
`.kbv2-cliview` no `kbv2Card` (clientView; nasce `display:none`; helpers reais).
CSS: seção "I3B · F2 CLIENTE" no bloco light-ui, escopo estrito `.scr-client` /
`#content:has(.scr-client)` / `[data-detorigin="client"]` — nenhum seletor F3+/Agenda/
Notificações/Exec/Reports/Wizard/Login/F13. Colunas F2 usam as CORES REAIS do eixo
(`--kc2:var(--kc)` desfaz a paleta F1 por posição, só ali).

## 4 · CARD CLIENTE (Golden; card=resumo, painel=detalhe)
cliente → pill de status real → título 14/800 → sinal real de visualização/ajuste →
próxima ação real ("→ …") → avatares com anel + contagem real ("12 temas"/"8 roteiros").
Ocultos no card (permanecem no painel): prazo, barra/%/trilho, chips de setor, SLA
interno, origem, ficha, etapas. Foundation v4 (radius 12, pad 13, sombras) por ordem de
autoridade shared. Aprovado/concluído: pill "Aprovado" + "Nenhuma pendência" (real), sem
CTA impossível (gates reais de ação preservados: cobertura Detalhes/⋯/Mover-guarda).

## 5 · PAINEL LATERAL
**MESMA Central de Detalhes real** (dados/handlers/foco/Esc/outside reais; zero HTML
duplicado): drawer overlay 416 <1760px (paridade I3A.1) e **DOCADA como 5ª coluna
392px em ≥1760px** (top 244 / right 26 / bottom 53 = extensão exata das colunas
244..1027; backdrop transparente). Conteúdo = campos reais da Central (status,
título, cliente, responsável, envio, próxima ação, CTAs reais, menu).

## 6 · MATRIZ DE FIDELIDADE (medida; alvo ZERO ISSUE)
| Zona | Golden | App | Status |
|---|---|---|---|
| Shell | (superseded pelo amendment) | F1 v4 compartilhado — **0px vs F1 congelado** | **MATCH** (amendment) |
| Header | tile olho + Cliente + sub/contagem | tile teal 46 + título real + sub real "· 10 tarefas" | **MATCH** |
| Toolbar | busca + tabs (ativa sólida no Golden) | compartilhada F1 v4 (ativa TINT por amendment); Cliente ativa | **MATCH** (amendment) |
| Approval strip | faixa com badge, 3 indicadores, >24h, CTA | wfap REAL re-skin linha única; todos os números reais (5=2+1+2; 2>24h) | **MATCH** |
| Columns | Enviado/Em análise/Revisão solicitada/Aprovado | labels/cores REAIS idênticos + barra curta v4 + counts reais | **MATCH** |
| Cards | compacto: cliente/pill/título/visualização/próxima/avatares/conteúdo | idem com dados 100% reais; foundation v4 (r12/pad13 vs r16/pad22 do mock) | **MATCH** (foundation v4 por autoridade) |
| Panel | painel integrado à direita + CTA inferior | Central REAL docada 392 (≥1760) / drawer (<1760); CTAs reais | **FUNCTIONALLY ADAPTED** (conteúdo = campos reais da Central) |
| **ISSUES** | | | **ZERO** |

## 7 · EXCEÇÕES (F2-E0x — Golden sem equivalente funcional; nada inventado)
- **F2-E01 — Card selecionado persistente**: o Golden destaca um card "selecionado" com
  anel; não existe estado real de seleção persistente no board Cliente (o painel abre por
  clique e fecha por Esc/X/fora). Não criado.
- **F2-E02 — Conteúdo do painel do mock** (ex.: bloco "1ª RODADA", linha "Visualização e
  resposta" com cópia própria): o painel usa os CAMPOS REAIS da Central (inclui envio/
  responsável/próxima ação reais); itens do mock sem fonte funcional não foram fabricados.
- **F2-E03 — "+" no header da coluna**: o adicionar REAL vive no botão inferior
  "Adicionar tarefa" (v4); não duplicado no header.
- Nota: chip de SLA interno oculto no card Cliente (Golden não o exibe; dado permanece no
  Monitor/painel).

## 8 · PROVAS E GATES
Smoke **12/12**: Meu quadro↔Cliente (F1 volta com filtro+KPIs), tab ativa, busca (1),
card→painel real abre/fecha (origem client), scroll interno, menu ⋯, drawer de aprovações
real abre/fecha, estados de fixture reais (nv/vs/aj/aprovado; colunas 2/4/2/2).
**F1 REGRESSION: 0px** (board + painel docado, relógio congelado, vs `f10aabe0`) — F1
segue CONGELADO. **Legado 0px** nos DOIS boards (dark/light/hc; hooks aditivos inertes).
**Responsive**: 1920/1366/win125 sem overflow de página (R8 F2: faixa empilha ≤1240;
board scroll-x). **Zero backend write** (fixtures locais; nenhuma aprovação real tocada).
UI UX Pro Max consultada (chips/hierarquia/disclosure/painel contextual) — Frame 2/v4
venceram. Provas: F2-CLIENTE-{1920, 1920-PANEL, 1366, win125}.png + comparação
GOLDEN×APP no chat (não versionadas).

## 9 · ROLLBACK
Reverter `62613a29` (1 commit: seção CSS F2 + 3 hooks aditivos).

**Gate de saída: avaliação do owner.** F3+ NÃO iniciadas.
