# DIREÇÃO DE ARTE ANTES DE CÓDIGO

A causa-raiz de interface amadora é começar pelo CSS. Produto sênior começa por **decisão
de composição**. Antes de escrever uma linha de estilo, responder por escrito:

## 1. Intenção da tela (1 frase)
O que esta superfície faz o usuário *sentir e decidir* em 3 segundos? (ex.: "O CEO vê, em
3s, o que está atrasado e quem está sobrecarregado.")

## 2. Direção visual (escolher UMA, citar a referência)
Nomear a direção e a referência de princípio (ver `references/professional-reference-library.md`):
operational-calm (Linear), data-dense-ops (Height/Attio), executive-clarity (Stripe Dashboard).
Uma tela = uma direção. Misturar direções é o que gera "cara de template".

## 3. Grid e composição (antes do CSS)
- Definir as **zonas** (sidebar / header / view-controls / palco / cockpit) e a proporção de cada uma.
- Definir o **eixo de leitura** (onde o olho entra, para onde vai).
- Definir a **razão conteúdo:superfície** alvo por zona (o palco não pode ser 86% vazio).
- Só então: tokens → componentes → CSS.

## 4. Orçamento de cor (antes do CSS)
Listar explicitamente onde a cor semântica aparece. Regra: **1 acento de marca + no máximo
1 cor de estado visível por tela** (normalmente só o overdue). Se a lista tiver 3+ cores
competindo, a composição está errada — voltar ao passo 2.

## 5. Orçamento de componentes
Contar quantos "sinais visuais" cada card/linha terá. Alvo: **≤ 2 sinais** além do texto
(ex.: 1 barra de progresso + 1 estado). Cada chip/badge/borda extra precisa justificar-se
ou ser cortado (ver `anti-patterns/`).

## 6. Só agora: código
Protótipo no **Agenda Design Playground** (fora do produto), captura 1920×1080, crop 2× do
componente crítico, e **scorecard**. Abaixo de 90 → não mostrar; voltar ao passo 2 ou 5.

> Regra dura: se você não consegue escrever os passos 1–5 em texto, você ainda não está
> pronto para desenhar. Direção primeiro; pixel depois.
