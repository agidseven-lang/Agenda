---
name: agenda-premium-product-design
description: Autoridade visual OBRIGATÓRIA do Agenda ID Seven. Use SEMPRE que for desenhar, criticar, mockar, prototipar ou revisar QUALQUER superfície do Agenda (F1-F13, shell, sidebar, header, kanban, task cards, KPIs, SLA, cockpit, modais, login). Impõe direção-de-arte-antes-de-código, referência-antes-de-invenção, sistema de superfícies anti-white-canvas, densidade, sistema tipográfico, ritmo de componentes, contenção de marca e micro-craft. Premium Score mínimo para apresentar ao owner = 90/100; candidato a implementação >= 93; meta 95+. Nenhuma proposta abaixo do gate chega ao owner. Decisões finais de direção pertencem ao OWNER (ver owner-approved/).
---

# AGENDA PREMIUM PRODUCT DESIGN

Autoridade visual específica do **Agenda ID Seven** — SaaS desktop 1920×1080-first de
operações criativas (agência: kanban de produção, SLA, cronogramas, clientes, designers,
social media, setores). Esta skill existe para **impedir que o Claude volte a produzir
interface com cara de template de IA** e para elevar cada superfície ao padrão de um
produto SaaS sênior (Linear/Height/Attio/Stripe-class).

## LEIA PRIMEIRO — a ordem importa
1. `toolchain.md` — o que está ATIVO, o que está PENDENTE (Figma, Modern Web Guidance) e
   o que está **NOT AVAILABLE** no catálogo (frontend-design oficial, playground oficial).
2. `process/direction-before-code.md` — **direção de arte ANTES de qualquer código.**
   Nenhuma superfície começa em CSS. Começa em decisão de composição.
3. `process/reference-before-invention.md` + `references/professional-reference-library.md`
   — escolher a referência de princípio antes de inventar.
4. `design-system/*` — superfícies, tipografia, densidade, cor, sombra, radius, spacing.
5. `anti-patterns/*` — as proibições. Cada anti-pattern presente **derruba o teto** do
   critério correspondente no scorecard.
6. `process/frontend-design-principles.md` — princípios de front-end design de produto
   (absorvidos, já que a skill oficial não existe neste catálogo).
7. `process/micro-craft-checklist.md` + `process/responsive-validation.md` — acabamento.
8. `evaluation/premium-scorecard.md` — **o gate. < 90 não vai ao owner.**

## O FLUXO OBRIGATÓRIO (mandato do owner)
```
REFERÊNCIAS PROFISSIONAIS
  → DESIGN / UI-UX PRO MAX          (linguagem, estilos, paletas, tipografia, UX)
  → AGENDA PREMIUM PRODUCT DESIGN   (decisão específica do Agenda + gate)
  → AGENDA DESIGN PLAYGROUND        (protótipo HTML fora do produto)
  → FIGMA                           (superfície de design final — quando disponível)
  → APROVAÇÃO DO OWNER
  → IMPLEMENTAÇÃO                    (só depois do GO explícito)
```
Nunca pular etapas. Nunca começar por "IMPLEMENTAÇÃO". Nunca desenhar a tela final antes
de existir a direção de arte e a referência.

## O GATE (endurecido)
Toda proposta passa por `evaluation/premium-scorecard.md` → **PREMIUM SCORE 0–100**.
- **< 90/100** → NÃO apresenta ao owner. Refazer.
- **>= 93/100** → elegível a candidato de implementação.
- **Meta: 95+/100.**
Anti-pattern presente = teto 6 no critério correspondente (impossível passar do gate com
um anti-pattern na tela). O score é medido contra a **screenshot real com DADOS REAIS**
(as 2 tarefas de produção), nunca contra mockup preenchido artificialmente.

## MANIFESTO (resumo executivo — íntegra nos arquivos referenciados)
1. **Direção de arte antes de código.** Composição, hierarquia e ritmo decididos antes do CSS.
2. **Referência antes de invenção.** Todo padrão nasce de um princípio verificável (ver library).
3. **Função antes de decoração.** Nenhum pixel decora sem informar.
4. **Hierarquia antes de cor.** Tamanho, peso e espaço criam a ordem; cor é o último recurso.
5. **Superfícies têm NÍVEIS.** Branco puro nunca é o fundo dominante de todos os níveis.
6. **Densidade é eficiência espacial com legibilidade.** Espaço morto é defeito; whitespace é intencional.
7. **Todo card ganha o espaço que ocupa.** Nenhum elemento flutua num vazio gigante.
8. **Contenção de marca.** UM acento principal (petroleum/teal). Cor semântica só quando a informação exige.
9. **Cor comunica estado, não enfeita.** Sem rainbow status, sem gradiente gratuito.
10. **Empty states ficam quietos.** Uma linha discreta, nunca protagonistas.
11. **Profundidade por tons + hairlines + sombra CONTIDA.** Premium ≠ excesso de efeitos.
12. **Micro-craft não é opcional.** Baseline, tabular-nums, alinhamento óptico, tracking, alvos 24px+.
13. **Dados reais comandam a composição** (2 tarefas reais > 30 inventadas).
14. **A sidebar petroleum é âncora de marca; o workspace precisa do MESMO acabamento.**
15. **1920×1080 é a tela de referência**, validada também em 1366 e 125% (ver responsive-validation).
16. **Acessibilidade não regride:** contraste 4.5:1+, foco visível, alvos 24px+, motion respeita reduce.
17. **PROIBIDA a estética "AI admin template genérico"** (ver todos os anti-patterns).

## Cadeia de conhecimento (quem decide o quê)
- **Design** (plugin) + **UI/UX Pro Max** = linguagem geral (estilos, paletas, tipografia, UX, ícones).
  Busca: `python3 /root/.claude/skills/ui-ux-pro-max/scripts/search.py "<q>" -d <style|product|color|typography|icons|ux>`
- **agenda-premium-product-design** (esta skill) = decisão específica do Agenda + gate.
- **DesignSync** = pipeline para biblioteca de componentes real em projeto Claude Design.
- **Figma** (quando autenticado) = superfície de design final.
- Em conflito de linguagem geral vs. Agenda: **esta skill vence para o Agenda; o OWNER vence sempre.**

## owner-approved/
Decisões de direção (referência aprovada, sistema de superfícies, card system, densidade,
direção visual como P1-PRO) vivem em `owner-approved/`. **Vazio = decisão do OWNER, nunca do
Claude.** Propor, mostrar, aguardar "APROVO". Registrar aqui só o que o owner aprovou por escrito.
