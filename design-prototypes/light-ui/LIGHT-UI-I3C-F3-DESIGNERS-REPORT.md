# LIGHT UI — I3C · F3 DESIGNERS REPORT

**Fase:** I3C — porte do Golden Designers (Frame 3) para o app real. **Status:** ENTREGUE —
aguarda owner. **Branch:** `impl/light-ui-f3-designers-1.0.246` de `62613a29` (HEAD
confirmado) · **checkpoint único `05910f33`** · 1 arquivo, +64/−2 · version 1.0.246 ·
zero build/package/tag/deploy/release/updater/PR · Light UI inativa · **F4+ não iniciadas**.

## 1–2 · BASE E REAUDITORIA (sem memória)
Render real: `renderDesignerBoard` (board por designer; `state.designerBoard`) +
`renderDesignersHub` (hub quando sem seleção). **Strip real `f354DesignerStrip`**
(chips avatar+nome+contagem, `.on`, click `[data-designerboard]`, scroll-x) e **autoload
real `f354DesignerAutoPick`** (ordem REAL: eu-designer → seleção salva → 1º alfabético;
persistência real `f354DesignerSelSave`). Quadros POR designer 100% isolados
(`isDesignerFlow ∧ designerOf===id`); lista de designers derivada das tasks visíveis
(`designerBoardsList` — não amplia permissão). **DESIGNER_COLS4 reconfirmado:**
A Fazer `#9BA0AB` · Em andamento `#F59E0B` · Revisão/Ajuste `#60A5FA` · Entregue
`#34D399` — labels idênticos ao Golden; **"Recebido" NÃO existe** (não usado).

## 3–5 · HEADER · TABS · COLUNAS
Header real da surface (avatar do designer, "Designer · Nome", sub real "Designer e
Editor · 8 tarefas · **3 em atraso**") sob o shell v4 intocado — o Monitor SLA REAL
reagiu à fixture ("Felipe Teodozio · 32h30m em atraso" + badge). Tabs compartilhadas;
Designers ativa; Meu quadro/Cliente intactos (roundtrip provado). Colunas = labels e
semântica reais, cores REAIS do eixo (reset da paleta F1 no escopo `.scr-designers`).

## 6–13 · CARD (foundation v4 · perspectiva Designer)
cliente + **chip de setor real** (topo, tint) → título 14/800 → **Prazo real** + **chip
SLA REAL** na mesma linha (`kbv2SlaLocal` via `resolveTaskDisplayState` POR PRAZO FINAL:
"Em prazo" azul / "Prazo próximo" laranja / "**Prazo encerrado**" vermelho-tint — estado
atrasado perceptível SEM pintar o card / "Entregue"/"Concluído" verde; chip ausente
quando neutro; reserva de espaço via `:has`) → **barra+% reais** (trilho de 3 etapas do
designer na representação compacta v4; cols 2–3 apenas, como o Golden) → **próxima ação
real** (fonte única `pres.nextAction`; ex.: "Concluir e enviar para revisão",
"Aguardando decisão da Social") → avatares com **anel = respOf** (responsável primário —
contrato global reconfirmado e inalterado) + **contagem real** ("9 temas"; texto real do
slot quando sem itens). **ENTREGUE ≠ CONCLUSÃO GLOBAL (crítico):** regra REAL preservada
— `kbv2SlaLocal` diz "Entregue" (nunca "Concluído") p/ cronograma sem aprovação final;
`personBoardCol` real nunca move para "Finalizado"; col4 = selo verde + data verde +
"Entregue — aguardando a Social" (texto real); Mover ausente conforme guardas reais.
Estados de prova (fixture, relógio congelado): recém-atribuída/não iniciada/em produção/
prazo próximo/atrasada/revisão-ajuste/entregue — todos reais.

## 14 · PAINEL
MESMA Central real por origem `designers` (hook mínimo): drawer overlay <1760 (paridade
I3A.1) e **docada ≥1760** (392px; top 240/right 26/bottom 53 = extensão exata das colunas
240..1027); conteúdo real (status banner "Designer em produção", responsáveis reais,
próxima ação real, CTA real "Ver quadro do designer", Mover/Remover/Fechar); foco no X.

## 15 · UI UX PRO MAX
SKILL.md relido; consultas (strip horizontal/dense kanban/deadline card): sem overflow
horizontal de página ✓, chips 42px alvo adequado ✓, focus-visible nos chips ✓, wrap/
scroll da strip = comportamento REAL preservado (sem dropdown novo). Golden venceu.

## 16 · MATRIZ DE FIDELIDADE (medida)
| Zona | Golden | App | Status |
|---|---|---|---|
| Shell | superseded | F1 v4 — 0px vs congelado | **MATCH** (amendment) |
| Header | grupo+Designers+sub | header REAL do board (designer avatar/nome/contagem/atrasos) | **FUNCTIONALLY ADAPTED** (dados reais da seleção) |
| Tabs | Designers ativa | compartilhadas v4; Designers tint ativa | **MATCH** (amendment) |
| Designer strip | "Quadros de designer:" + chips avatar/nome/contagem/ativo | strip REAL re-skin: 42px r12 fs12.5, contagem em pill, ativo azul | **MATCH** |
| Columns | A Fazer/Em andamento/Revisão-Ajuste/Entregue | labels/cores REAIS idênticos + barra curta v4 | **MATCH** |
| Cards | compacto: cliente/setor/prazo/SLA/etapa/próxima/avatares/conteúdo | idem com dados reais; foundation v4 (r12/pad13/título14) | **MATCH** (foundation v4) |
| SLA | Em prazo/Atrasada/Prazo próximo/Entregue | labels REAIS kbv2SlaLocal (Prazo encerrado = vermelho tint) | **MATCH** (labels reais) |
| Progress | "Etapa 2 de 3" + barra | barra+% reais (trilho 3 etapas compactado v4) | **FUNCTIONALLY ADAPTED** (representação compacta aprovada) |
| Panel | integrado à direita + CTA | Central REAL docada/drawer | **FUNCTIONALLY ADAPTED** (campos reais) |
| **ISSUES** | | | **ZERO** |
Medidas: sidebar 266 · busca 574×48 · strip chip 42/r12/12.5 · col 382 (fechado; 288
docado) · gap 16 · card r12/pad 13-13-11 · título 14/800 · painel 392 · canvas #FDFEFE.

## 17–22 · EXCEÇÕES · GATES
**F3-E01** — "Etapa X de 3" literal do Golden: sem string real equivalente; representado
pela barra+% reais (compacto v4). **F3-E02** — "+" no header da coluna: adicionar real =
botão inferior. **F3-E03** — card "selecionado" persistente do Golden: sem estado real.
Nada inventado (capacity/productivity NÃO criados). Smoke **11/11** (autoload real;
Boaz↔Felipe counts 3↔8; busca; painel; menu; Mover sem confirmar backend; F1→F2→F3).
**F1 REGRESSION 0px** e **F2 REGRESSION 0px** (board+painel, relógio congelado) — ambos
seguem CONGELADOS; shared CSS intocado (apenas escopos novos). **Legado 0px** nas TRÊS
superfícies (dark/light/hc). 1920/1366/win125 sem overflow de página (board scroll-x
interno ≤1240; strip com scroll-x real). Permissões reais (tab via canSeeAll; lista por
tasks visíveis). **Zero write** (nenhuma tarefa movida/concluída/atribuída de verdade;
nenhuma notificação real). Rollback: reverter `05910f33`.

**Provas no chat:** F3-DESIGNERS-{1920 (Felipe), 1920-PANEL, 1920-BOAZ (2º designer),
1366, win125}.png + F3-COMPARE-GOLDEN-vs-APP.png. **Recomendação: GO** (todos os gates
do owner PASS). **Próxima fase: I3D/F4 — SOMENTE após GO explícito.**
