# SURFACE SYSTEM — hierarquia obrigatória (anti white-canvas)
REGRA DURA: #FFFFFF puro NUNCA é a superfície dominante de todos os níveis ao mesmo
tempo. A interface é CLARA (não dark), mas em ESCADA de tons frios (slate/petroleum tint).
Escada de referência (valores iniciais; owner pode recalibrar):
| Nível | Papel | Token | Valor base |
|---|---|---|---|
| 0 | App background (atrás de tudo) | --s-app | #E7EDF3 |
| 1 | Workspace (área de trabalho) | --s-workspace | #EEF3F8 |
| 2 | Primary surface (painéis/context bar) | --s-primary | #FFFFFF |
| 3 | Secondary surface (toolbars internas) | --s-secondary | #F4F7FB |
| 4 | Board frame (moldura do kanban) | --s-board | #E2E9F1 |
| 5 | Column well (coluna, rebaixada) | --s-column | #EDF1F6 |
| 6 | Card (elevado) | --s-card | #FFFFFF |
| 7 | Elevated card (drag/hover forte) | --s-card-hi | #FFFFFF + elevation-3 |
| 8 | Selected | --s-selected | #E9F7F5 (teal 8%) |
| 9 | Hover | --s-hover | nível atual +2% de tom |
| 10 | Disabled | --s-disabled | #F1F4F8 + texto 45% |
Princípios: card SEMPRE mais claro que a coluna; coluna SEMPRE distinta do board;
board SEMPRE distinto do workspace. Diferenças sutis (2–5% L), nunca cinza chapado.
Hairlines (#D9E2EC) separam; sombra só em superfícies que FLUTUAM (card, modal, popover).
