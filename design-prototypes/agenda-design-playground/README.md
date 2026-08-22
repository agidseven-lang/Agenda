# Agenda Design Playground

Laboratório de design **fora do produto**. Serve para testar visualmente, de forma isolada e
rápida, os blocos do sistema visual do Agenda antes de qualquer implementação no renderer.

## O que é
`index.html` é uma página estática e autossuficiente (fonte Inter e ícones lucide embutidos —
não depende de rede). Abra no navegador. Os controles no topo (densidade, radius, sombra,
acento) escrevem CSS custom properties ao vivo em todos os specimens:

- Sistema de superfícies (S0 → S6, anti white-canvas)
- Sistema de cor (1 acento + estados)
- Escala tipográfica (Inter, 9 papéis)
- Task card em 6 estados (default / hover / focus / selected / overdue / drag)
- Kanban (palco proporcional, dados reais)
- Sidebar (estados on / hover / default)
- Sombra & radius (escala contida)
- Botões & chips (estados)

## Regras (inegociáveis)
- **NÃO toca no renderer de produção.** É prototipagem isolada.
- Usa **dados reais** (as 2 tarefas de produção), nunca conteúdo inventado para preencher.
- Governado pela skill `agenda-premium-product-design` (superfícies, tipografia, anti-patterns, gate).

## Lugar no fluxo
`referências → Design/UI-UX Pro Max → agenda-premium-product-design → ESTE PLAYGROUND → Figma → aprovação do owner → implementação`

## Regenerar
O fonte com tokens de fonte/ícone fica no scratchpad da sessão
(`i7-mock/src/PLAYGROUND.html`), compilado por `i7_build.js` (inline de Inter + lucide).
Para editar de forma persistente, edite `index.html` diretamente.
