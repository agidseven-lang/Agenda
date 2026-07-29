# F3.5.4 — Provas visuais (ANTES 1.0.193 × DEPOIS candidata 1.0.194)

Geradas por `desktop/scripts/f354-visual-proof.mjs` com o CSS REAL e o `kbv2Card` REAL de cada
versão (ANTES = `git show 5f1c3cf…`; DEPOIS = candidata), fixtures sintéticas idênticas nas duas
versões, Chromium headless em 1366×768 / 1600×900 / 1920×1080.

## Cenas
- `*-incident-*` — a cena do print do owner: **Edição de Cards × Edição de vídeos**, 1 tarefa em cada coluna;
- `*-multi-*` — múltiplos cards (3 × 2): empilhamento natural, nenhum card esticado/comprimido;
- `*-cron-*` — **Cronograma × Roteiro** (mesmo componente-base);
- `depois-designers-*` — tela Designers: faixa de seleção visível + quadro aberto automaticamente.

## Guias sobrepostas (por coluna: sólida = col. 1; tracejada = col. 2)
topo do card · trilho de progresso · etapa atual · prazo · botões/rodapé · base do card,
com a posição em px impressa em cada linha.

## Métricas (metrics-f354.json)
- **ANTES (1600×900, incident)**: os DOIS cards esticados à altura da coluna; **trilho Δ178px** e
  **etapa Δ178px** entre as colunas (o respiro `margin-top:auto` distribuía o vão em pontos
  diferentes conforme o conteúdo do setor) — é a causa visual provada do print.
- **DEPOIS**: topo Δ0; trilho/etapa/prazo/botões deslocados **uniformemente** apenas pelo volume
  do conteúdo do slot (crescimento natural permitido pelo contrato); nenhum vão artificial.
- **Altura do card (incident)**: 851px (esticado) → **430px / 479px** = compactação real de
  **−49% / −44%** vs 1.0.193 nesta cena; a redução da altura FIXA do esqueleto é ~30%
  (f354-kanban-unified C7), dentro da meta 20–30% "quando o conteúdo permitir".
