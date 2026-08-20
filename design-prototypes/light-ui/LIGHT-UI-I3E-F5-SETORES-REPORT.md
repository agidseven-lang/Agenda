# LIGHT UI — I3E · F5 SETORES REPORT

**1. Branch:** `impl/light-ui-f5-setores-1.0.246` · **2. Base:** `6d4796ff` (HEAD
confirmado; worktree limpa; git status 0) · **3. Commit:** checkpoint único **`f6915110`**
· **4. Arquivos:** `desktop/src/renderer/index.html` · **5. Diffstat:** +88/−2 · version
1.0.246 · zero build/package/tag/release/deploy/merge/PR · Light UI inativa · F6+ não
iniciadas.

## 6–13 · REAUDITORIA REAL
**6. Funções:** rota Setores = `taskChips` "hub" (`data-board="hub"`) → `renderHub`
(índice real: nav cards + setores) → handler real `[data-sector]` (com guarda
`isRetiredSectorKey`) → `renderBoard` (desktop = board canônico `kbv2BoardHtml`).
**7. Fonte real dos setores:** `const SECTORS` (linha ~3688) + `secOf`/`SECTOR_ALIAS`.
**8. Setores reais ATIVOS:** `edicao_midia` "Edição de vídeos" `#60A5FA` (movie) ·
`cronograma` "Cronograma" `#34D399` (calendar) · `edicao_cards` "Edição de Cards"
`#F472B6` (image). Descontinuados (definições preservadas p/ tarefas históricas; NUNCA
expostos): copywriting, roteiro, programacao_posts. **9. Ordem:** a ordem literal de
`SECTORS` (Edição de vídeos → Cronograma → Edição de Cards) — preservada na strip.
**10. Seleção/autoload:** seleção = `state.boardSector` (real); **não existe autoload**
— entrada real é hub → clique (preservado; a strip usa o MESMO handler). Sem
persistência de seleção de setor (real; nada criado). **11. Permissões:**
`visibleTasks(u,tasks)` = `canSeeAll` ∨ `canSeeTask` por tarefa (aplicada no board e nos
counts). **12. Critério task→setor:** `secOf(t.sector).key === s.key` (com aliases
reais). **13. Colunas reais = const `STATUS` PRÓPRIA** (provado; NÃO é SOCIAL_COLS4):
A Fazer `#9BA0AB` · Em andamento `#F59E0B` · Revisão `#60A5FA` · **Concluído** `#34D399`;
bucketização por `flowBoardCol(t,'social')` (eixo operacional real do board de setor).

## 14–19 · SEMÂNTICA
**14. Responsável:** anel = `respOf` real (contrato global). **15. SLA:** `kbv2SlaLocal`
real (Em prazo/Prazo próximo/Prazo encerrado/Entregue-Concluído; espera externa neutra).
**16. Workflow:** eixo operacional real por setor (cronograma com fases/rounds;
edição_* por status direto); aprovação parcial nunca vira Concluído. **17. Próxima
ação:** fonte única real (`pres.nextAction`). **18. Card:** família v4 (foundation
congelada) com dados do setor: cliente + pill de status real + título 14/800 + Prazo
real + chip SLA + sinais reais (Visualizado/Ajuste/Designer entregou) + barra+% reais +
próxima ação + avatares com anel + contagem real; ordens de flex explícitas no escopo
(.scr-sector: perfil 8/resumo 9/checklist 10) para desempate determinístico; busca REAL
deste board (markup próprio, sem wrapper) estilizada v4. **19. Painel:** MESMA Central
real por origem `sectors` (hook via `activeTab()==='hub' && state.boardSector`): drawer
overlay <1760 (paridade I3A.1) e docada ≥1760 (392px; top 240/right 26/bottom 53 =
extensão exata das colunas 240..1027); origens mine/client/designers/socials intocadas.

## 20 · EXCEÇÕES (F5-E0x — nada inventado)
- **F5-E01 — ⌘K na busca:** o markup real do board de setor não tem o kbd ⌘K (input
  próprio sem wrapper); estilo v4 aplicado; atalho visual não fabricado.
- **F5-E02 — "Minhas tarefas" à direita da strip (Golden):** o chip REAL `boardMine`
  vive na toolbar real (antes das tabs); estilizado v4 e mantido no DOM real (posição =
  adaptação; mover exigiria markup/JS sem ganho funcional).
- **F5-E03 — rail lateral colorido nos cards do Golden:** contrato v4 congelado usa
  ANÉIS de responsável nos avatares (mesma semântica; amendment do F1).
- **F5-E04 — "Fluxo N de 9"/card selecionado/"+" no header:** mesmas decisões F2–F4
  (barra+% reais; sem estado de seleção persistente; adicionar real no rodapé).

## 21–32 · GATES
**21. Smoke 24/24** (20 do mandato + 4 da auditoria): hub real; retirados FORA do hub e
da strip; entrar F5; strip 3 setores; A→B→A pela strip (handler real; counts 9↔4);
estado ativo; busca (1); busca+setor; **"Minhas tarefas" com EFEITO provado** (t1g
reatribuída → 9→8); SLA/próxima ação presentes; menu ⋯; detalhe abre; fecha X; fecha
Esc; retorno de foco; F1→F2→F3→F4→F5; F5→F4→F3→F2→F1; empty real (col 0 no outro
setor). **22–25. Regressões congeladas** (relógio congelado, mesmas fixtures): F1 board
**0px** + painel **0px** · F2 **0px**+**0px** · F3 board+strip **0px**, painel **0px
fora da região-flake** · F4 board+strip **0px**, painel **0px fora da região-flake**.
**26. Flake do sino (política A–E cumprida):** A) base×base = diverge em
(1443,29,1485,71); B) atual×atual = MESMA região; C) independente do código; D) mesma
região do flake documentado (deslocada pelo painel aberto); E) **0px fora** — registrado
como "known async bell flake; 0px outside proven region"; nenhuma outra máscara.
**27. Legado (dark/light/hc × F1..F5):** 0px em todos os pares; flakes ocasionais SÓ na
região comprovada (1460,30–1500,72), 0px fora, mesma política. **28–30.** 1920/1366/
win125 PASS. **31. Overflow de página: ZERO.** **32. Writes: ZERO** (Firestore/
Functions/Worker/API/localStorage novo = 0; smoke não persiste nada de setor).

## 33–35 · FIDELIDADE · SCREENSHOTS · RECOMENDAÇÃO
| Zona | Golden | App | Status |
|---|---|---|---|
| Shell | superseded | F1 v4 — 0px | **MATCH** (amendment) |
| Header | "Setores" + sub "Quadro de Cronograma · desc" | header REAL "Quadro de Cronograma" + desc + tile do setor real | **ADAPTAÇÃO** (dados reais; família F3/F4) |
| Strip | "Quadros de setor:" + chips ícone/label/count | navegação REAL reapresentada (ícones/cores/labels/counts reais; 42/r12; tile 26) | **MATCH** |
| Toolbar/busca | busca longa + Minhas tarefas à direita | busca real 574×48 estilo v4 (sem ⌘K — F5-E01); chip real na toolbar (F5-E02) | **ADAPTAÇÃO** |
| Columns | A Fazer/Em andamento/Revisão/Concluído | STATUS real idêntico + cores reais | **MATCH** |
| Cards | família compacta com sinais | família v4 com dados 100% reais | **MATCH** (foundation) |
| SLA/progresso | chips + Fluxo N de 9 | chips reais + barra+% reais | **MATCH**/ADAPTAÇÃO (F5-E04) |
| Panel | docado + CTA | Central REAL docada/drawer | **ADAPTAÇÃO** (campos reais) |
| **ISSUES** | | | **ZERO** |
Medidas: sidebar 266 · busca 574×48 · strip chip 42/r12 (tile 26) · col 382/gap 16 ·
card r12/pad 13-13-11/título 14 · "Minhas tarefas" 44 · painel 392 · canvas #FDFEFE.
**34.** Screenshots no chat (não versionados): F5-SETORES-{1920, 1920-PANEL,
1920-OUTRO-SETOR, 1366, win125}.png + F5-COMPARE-GOLDEN-vs-APP.png.
**35. Recomendação: GO.** Rollback: reverter `f6915110`. **F6+ não iniciadas.**
