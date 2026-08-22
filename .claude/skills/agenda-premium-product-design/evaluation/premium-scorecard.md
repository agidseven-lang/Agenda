# PREMIUM SCORECARD — 15 critérios, 0–100 (GATE ENDURECIDO)

Peso igual (cada 0–10; média ×10 → 0–100).

## GATE (mandato do owner)
- **< 90/100** → NÃO apresenta ao owner. Refazer.
- **>= 93/100** → elegível a candidato de implementação.
- **Meta: 95+/100.**
- **Anti-pattern presente = teto 6 no critério correspondente** (ver `anti-patterns/*` +
  `anti-patterns/extended.md`). Com um anti-pattern na tela é matematicamente impossível
  passar do gate — é essa a intenção.

## Como pontuar
Contra a **screenshot real com DADOS REAIS** (as 2 tarefas de produção), 1920×1080, **não**
contra mockup preenchido artificialmente. Anexar: full shot + crop 2× do componente crítico
+ (para candidato) as 3 capturas de `process/responsive-validation.md`. Registrar a tabela
com **justificativa de 1 linha por critério** e listar anti-patterns detectados.

## Os 15 critérios
| # | Critério | O que mede |
|---|---|---|
| 1 | Visual hierarchy | ordem por tamanho/peso/espaço; o olho sabe onde entrar |
| 2 | Surface hierarchy | escada de superfícies; anti white-canvas |
| 3 | Density / eficiência espacial | pixels úteis; sem torre vazia; sem poluição |
| 4 | Typography | Inter real, escala, tabular-nums, tracking, baseline |
| 5 | Composition / balance | grid, zonas, eixo de leitura, proporção |
| 6 | Whitespace discipline | respiro intencional; zero espaço morto |
| 7 | Color restraint / semântica | 1 acento + estado pontual; sem rainbow/gradiente |
| 8 | Depth | tons + hairlines + sombra contida |
| 9 | Content grouping | cockpit como organismo; nada de widgets soltos |
| 10 | Information architecture | contexto uma vez; sem duplicação |
| 11 | Interaction polish (estados) | hover/focus/pressed/disabled/drag previstos |
| 12 | Responsive behavior | 1920 + 1366 + 125% (3 capturas p/ candidato) |
| 13 | Brand personality (ID Seven) | âncora petroleum; identidade própria, não template |
| 14 | Enterprise credibility | Stripe-class; parece produto pago sério |
| 15 | Creative-agency fit | serve operação de agência (SLA, cliente, designer, setor) |

## Registro
```
PREMIUM SCORE = <soma>/100
Anti-patterns detectados: <lista ou "nenhum">
Veredito: <ABAIXO DO GATE (<90) | APRESENTÁVEL (>=90) | CANDIDATO (>=93) | META (95+)>
```
