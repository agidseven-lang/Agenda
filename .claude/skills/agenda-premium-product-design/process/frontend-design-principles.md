# PRINCÍPIOS DE FRONTEND DESIGN (absorvidos)

> `FRONTEND DESIGN OFFICIAL = NOT AVAILABLE IN CURRENT CATALOG`.
> A skill oficial não existe neste catálogo. Por decisão do owner, os **princípios**
> profissionais equivalentes — legitimamente reproduzíveis — vivem aqui. Não é cópia de
> nenhuma skill de terceiros; é a disciplina de front-end de produto aplicada ao Agenda.

## 1. Optical craft (o que separa sênior de amador no zoom 2×)
- **Alinhamento óptico**, não matemático: ícones e texto alinham pela massa visual, não pela caixa.
- **Baseline consistente**: rótulo, valor e ícone assentam na mesma linha de base.
- **Tabular-nums** em toda métrica, contador, prazo, porcentagem (nada "dança" ao atualizar).
- **Tracking**: títulos com leve negativo (-0.01em); rótulos micro com leve positivo.
- **Peso**: hierarquia por 450/500/600/650; evitar 800 gritando. Bold é ênfase, não default.
- **Hairlines** de 1px em tom frio para separar; borda cheia só quando agrupa de fato.

## 2. Componentização (pensar em sistema, não em telas)
- Todo elemento é uma **instância de um componente** com estados definidos (default/hover/
  focus/active/selected/disabled/loading/empty). Desenhar o componente, não o pixel.
- **Ritmo**: o mesmo componente repete com o mesmo espaçamento interno em toda a tela.
- **Slots**: card = header slot / body slot / footer slot; nunca inventar layout por card.

## 3. Layout e composição
- **Grid explícito** (12/16 col ou zonas flex); nada posicionado "no olho".
- **Densidade proporcional ao conteúdo**: o palco encolhe/expande com os dados; não deixar
  torre vazia quando há poucos cards (ver `anti-patterns/dead-space.md`).
- **Uma ação primária por tela**; secundárias visualmente subordinadas.

## 4. Estados e interação (o que um mockup estático precisa PROVAR que previu)
Todo componente interativo declara: hover (feedback ≤100ms), focus visível (anel 2px acento,
contraste 3:1), pressed (scale 0.98 sutil), disabled (opacidade + cursor), drag (elevação +
placeholder). Ver `process/micro-craft-checklist.md`.

## 5. Performance percebida
Skeleton em >1s; reservar espaço (sem layout shift); transições por transform/opacity;
respeitar `prefers-reduced-motion`.

## 6. Web moderno
Quando **Modern Web Guidance** estiver habilitado, consultar suas best practices de layout/CSS
atuais antes de implementar. Até lá, seguir estes princípios como piso.
