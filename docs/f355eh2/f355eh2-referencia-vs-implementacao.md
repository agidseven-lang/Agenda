# F3.5.5E-H2 — Comparação: REFERÊNCIA do owner × implementação (Desktop 1.0.226)

Fase: NOTIFICAÇÃO PREMIUM BASEADA EXATAMENTE NA REFERÊNCIA APROVADA PELO OWNER.
A imagem fornecida pelo owner É o conceito — nenhuma proposta criativa nova foi produzida.
Adaptações permitidas e aplicadas: cores (dark premium do Agenda), textos/dados reais da
tarefa, ações e funcionamento do app. Medidas físicas capturadas no Electron EMPACOTADO
(harness `f355eh2-electron-proof-main.js`, 23 provas; PNGs em `docs/f355eh2-qa/`).

| # | Elemento da referência | Implementação (medida real) |
|---|---|---|
| 1 | Card principal horizontal com cantos bastante arredondados | Superfície `.ntfp-wrap` 450×212px, border-radius **24px** (mandato 22–28) |
| 2 | Avatar circular grande parcialmente para fora do card | `.ntfp-fl` **65px** (62 + ring 2px; mandato 58–72), **~37% acima** da superfície (mandato 30–40%), topo-esquerdo, z-index acima do card |
| 3 | Avatar sobreposto na região superior esquerda | `top:-24px;left:18px` absoluto sobre o wrap; premiumAvatar REAL (foto/iniciais congeladas; iniciais 22px) |
| 4 | Bastante respiro na área superior | Cabeçalho deslocado à direita (margin-left 72px); título só após a zona do avatar (mt 16) |
| 5 | Corpo interno extremamente limpo | Título 18/700 → cliente 14/650 → contexto 12.5/450 → autor metadata 12/450 → responsável (só quando distinto); sem chips soltos, sem blocos extras |
| 6 | Composição com profundidade | Sombra 0 24px 56px −20px rgba(0,0,0,.78) + inset 1px; avatar com sombra própria leve; janela premium TRANSPARENTE real (o card flutua sobre o desktop) |
| 7 | Superfície principal suave | Gradiente navy `#151D30→#101726` (adaptação dark dos exemplos do mandato), borda 1px `rgba(139,162,255,.14)` |
| 8 | Área inferior em formato pill/cápsula horizontal | `.ntfp-pill` **40px** de altura, radius 999, largura total, borda/fundo sutis |
| 9 | Segmento destacado dentro dessa cápsula | `.ntfp-pr` no lado direito com `background:var(--catc)` (cor CONTEXTUAL do evento — violeta/verde/âmbar/vermelho/laranja/azul; nunca o amarelo literal), texto escuro #0E1424 = **CTA "Abrir →"** (data-cta/role/tabindex/aria; clique/taskId/deep-link/teclado preservados) |
| 10 | Ausência de excesso de elementos | Transição de status INTEGRADA na cápsula (dot do estado origem → destino em texto); sem dois chips independentes; sem CTA separado; sem barra lateral; sem grid |
| 11 | Estética sofisticada, limpa e premium | Ring do avatar em gradiente azul→violeta; hover discretos; micro-scale .98→1 no avatar (180ms, sem bounce/glow); reduced-motion respeitado |

## Garantias técnicas do avatar flutuante (overflow/workArea/empilhamento)
- O headroom do avatar (26px) é PADDING transparente do wrapper `.ntf.ntfp-w` → o bounding
  box do componente JÁ inclui a área flutuante: nada é cortado por overflow, o auto-resize
  CONGELADO do `bgNotify.ts` mede a altura correta sozinho, e o empilhamento (gap 10)
  nunca deixa o avatar de um card invadir o card vizinho (prova E13: invade=false).
- Janela premium: `transparent:true` de produção + body transparente — avatar aparece
  sobre o desktop sem corte (prova E20 com bgnotify.html DO ASAR + preload REAL + IPC
  `bg-card` de produção; flVisivel=true, flAcima≥18).

## Pergunta de controle do mandato
"Esse componente ainda lembra claramente a referência?" — SIM: os 7 elementos estruturais
obrigatórios (avatar sobreposto, card arredondado, topo limpo, profundidade, cápsula
horizontal, segmento direito colorido, composição minimalista) estão presentes e medidos.
