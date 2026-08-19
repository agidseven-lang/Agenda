# Maquetes Light UI — “Agenda ID Seven” · Meu quadro

> **NOTA R10:** este README descreve a FASE INICIAL (propostas do Frame 1). O estado vigente
> da trilha (Frames A 1–13 Golden, C1–C8, B, R8, a11y/errata) está em
> **`DESIGN-FREEZE-MANIFEST.md`** + `MASTER-SURFACE-MAP.md` + `DESIGN-CLOSURE-ROADMAP.md`.
>
> # ⚠️ MAQUETES DE DESIGN — NÃO É PRODUÇÃO.
> **Não altera o app, o tema, nem entra no build.** Arquivos isolados apenas para aprovação visual do
> proprietário. Ficam fora de `desktop/` (não entram no `app.asar`) e não tocam workflows nem releases.

Protótipos visuais de alta fidelidade (não são wireframes) para a tela **“Meu quadro”** — um Kanban de
agência criativa com 4 colunas: **A Fazer** (azul), **Em andamento** (laranja), **Revisão** (violeta),
**Finalizado** (verde). Três direções em Light UI, cada uma em telas de **1920×1080**. Textos em PT-BR.

## Como abrir

Arquivos HTML autocontidos (CSS inline, sem assets externos). Basta **abrir no navegador**
(duplo clique) ou arrastar para uma aba. Cada arquivo empilha as vistas em quadros de 1920×1080 —
role a página para ver todas. Para “screenshot” fiel, use zoom 100% numa tela ≥1920px de largura
ou o print de página inteira do navegador.

## Índice de arquivos

### Maquetes (HTML — os 3 quadros completos principais)
| Arquivo | Proposta | Vistas incluídas |
|---------|----------|------------------|
| [`proposta-a-pinterest-clean.html`](./proposta-a-pinterest-clean.html) | **A — Pinterest Clean** | 1) Quadro completo · 2) Drawer aberto · 3) 4 estados · 4) Cor por usuário |
| [`proposta-b-executive.html`](./proposta-b-executive.html) | **B — Executive** | 1) Quadro completo (KPIs) · 2) Drawer c/ abas · 3) 4 estados · 4) Tabela de cores por usuário |
| [`proposta-c-creative-studio.html`](./proposta-c-creative-studio.html) | **C — Creative Studio (Híbrido A+C) ★ recomendada** | 1) Quadro + métricas · 2) Drawer 480px · 3) 4 estados · 4) Cor por usuário · 5) Densidade Compacto×Confortável |

### Documentação
| Arquivo | Conteúdo |
|---------|----------|
| [`TOKENS.md`](./TOKENS.md) | Tokens visuais (paleta, status, raios, sombras, tipografia) + **tabela completa de cor por usuário** |
| [`COMPARISON.md`](./COMPARISON.md) | Comparativo A × B × C (prós/cons, densidade, quando usar) + **recomendação (Híbrido A+C)** |
| [`RESEARCH-NOTES.md`](./RESEARCH-NOTES.md) | Notas da pesquisa visual (5–8 takeaways aplicados) |
| `README.md` | Este índice |

## Destaques de design

- **Cor por usuário (identificar, não dominar):** cada pessoa tem uma cor fixa aplicada no anel do avatar,
  no filete de acento da borda, no chip “responsável” e no filtro — nunca no card inteiro. Escala 10 → 20+.
- **Status nunca só por cor:** toda coluna e todo card de status usam **ponto + rótulo + ícone**.
- **Cards compactos com divulgação progressiva:** o essencial no card; os detalhes num **drawer lateral
  direito** (não um modal que cobre o board).
- **Direção recomendada — C:** workspace claro + **sidebar escura de marca** (petróleo/teal), drawer de
  480px e **barra de métricas discreta** no rodapé; densidade Compacta com variante Confortável.

## Resumo (um parágrafo)

Estas maquetes apresentam três caminhos de Light UI para o “Meu quadro” do Agenda ID Seven — **A** arejada
e amigável, **B** densa e gerencial, e **C** (recomendada) um híbrido que une o workspace claro a uma
sidebar escura de marca, com drawer lateral para detalhes e uma barra de métricas discreta, oferecendo
identidade forte e produtividade sem poluir a tela. Todas compartilham os mesmos tokens, as quatro cores
de status (sempre com rótulo + ícone) e um sistema de cor por responsável que escala de 10 a mais de 20
pessoas mantendo a legibilidade. **É um entregável somente de design, para aprovação — não é produção e
não afeta o aplicativo.**
