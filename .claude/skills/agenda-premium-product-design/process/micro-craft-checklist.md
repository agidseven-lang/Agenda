# MICRO-CRAFT CHECKLIST (validar no crop 2×)

Todo componente crítico (task card, cockpit, header) é capturado em **2×** e validado item a
item. Qualquer falha derruba o critério "Card craft" / "Interaction polish" no scorecard.

## Tipografia
- [ ] Inter real embutida (não fallback de sistema) — pesos 450/500/600/650.
- [ ] Título com tracking -0.008 a -0.012em; line-height 1.3–1.4.
- [ ] Métricas/prazos/contadores em tabular-nums.
- [ ] Nenhum texto abaixo de 10.5px; corpo ≥ 12px.

## Alinhamento e ritmo
- [ ] Ícone + texto alinhados opticamente (não pela caixa).
- [ ] Baseline consistente entre rótulo, valor e ícone.
- [ ] Espaçamento interno do card em grade de 4px.
- [ ] Avatares sobrepostos com borda 1.5px na cor da superfície.

## Superfície e profundidade
- [ ] Card mais claro que a coluna; coluna distinta do palco (2–4% L).
- [ ] Hairline 1px frio onde separa; sombra ≤ 5% só onde flutua.
- [ ] Radius coerente com a escala (7/9/12) — nada "excessivamente arredondado".

## Cor
- [ ] 1 acento de marca; no máximo 1 cor de estado visível.
- [ ] Overdue em âmbar terroso (não vermelho neon); sucesso contido.

## Estados (mockup deve PROVAR que previu)
- [ ] hover, focus (anel 2px, 3:1), pressed (scale 0.98), disabled, drag definidos.
- [ ] Alvo de clique ≥ 24px (menu ⋯, add, chips).

## Empty
- [ ] Empty state discreto (uma linha), nunca centralizado gritando.
