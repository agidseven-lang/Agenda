# RESPONSIVE VALIDATION

O Agenda é desktop 1920×1080-first, mas a proposta só passa no gate se sobreviver a três
condições reais de uso. Validar (capturar) antes de apresentar candidato:

## Alvos
| Condição | Por quê | O que checar |
|---|---|---|
| **1920×1080 @100%** | tela de referência | composição, densidade alvo, cockpit fechado ao conteúdo |
| **1366×768 @100%** | notebooks comuns na agência | colunas não quebram; cockpit não empurra o board; sem scroll horizontal |
| **1920×1080 @125%** | escala de fonte do Windows | nada trunca; alvos ≥24px; header ≤2 faixas ainda cabem |

## Regras
- Sem **scroll horizontal** em nenhuma condição (o corpo nunca rola lateral).
- Conteúdo largo (tabela, board) rola dentro do próprio container com `overflow-x:auto`.
- Cockpit tem largura mínima; abaixo dela, colapsa para uma faixa superior (não some).
- Colunas do kanban têm min-width; abaixo, viram scroll horizontal do board (não esmagam cards).

## Registro
No scorecard, o critério "Responsive behavior" só recebe ≥8 com as 3 capturas anexadas.
Enquanto Playground/Figma não cobrirem as 3, registrar honestamente "validado só em 1920".
