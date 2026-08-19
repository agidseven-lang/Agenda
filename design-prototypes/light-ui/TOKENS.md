# Tokens visuais — Light UI "Agenda ID Seven"

> **DOCUMENTO HISTÓRICO (fase de propostas A/B/C — R10):** NÃO é mais fonte canônica.
> Tokens canônicos vigentes = **contracts C1–C8 + `ACCESSIBILITY-TOKEN-ERRATA.md` (R9.1 GO)**
> — em particular tx-3′ `#697181` · tx-4′ `#6E7786` · brand-ink `#4353D8` · grad stop 2
> `#8356E6` · inks semânticos. Mantido apenas como registro da fase inicial.
> MAQUETES DE DESIGN — NÃO É PRODUÇÃO. Não altera o app, o tema, nem entra no build.

---

## 1. Paleta neutra (base Light UI)

| Token       | Papel                                   | Valor      |
|-------------|-----------------------------------------|------------|
| `--bg`      | Fundo do workspace (off-white frio)     | `#F5F6F8`  |
| `--surface` | Cards e painéis (branco puro)           | `#FFFFFF`  |
| `--surface2`| Poços / hover / corpo de coluna         | `#EEF1F5`  |
| `--line`    | Bordas hairline (1px)                    | `#E4E7EC`  |
| `--line2`   | Linhas internas mais suaves              | `#EDEFF3`  |
| `--ink`     | Texto primário (slate profundo)          | `#14202E`  |
| `--soft`    | Texto secundário                         | `#5A6675`  |
| `--faint`   | Texto terciário / muted                  | `#98A2B3`  |

## 2. Acento por proposta

Cada proposta mantém a base neutra e troca só o acento (cor de ação/foco/links).

| Proposta                | Acento    | Notas |
|-------------------------|-----------|-------|
| A — Pinterest Clean     | `#6366F1` | Índigo suave, sidebar clara, muito ar |
| B — Executive           | `#2F6FED` | Azul corporativo, denso, crisp |
| C — Creative Studio A+C | `#12B0A0` | Teal, casado à sidebar petróleo `#0E2A33` (sidebar escura de marca — não preto) |

## 3. Cores de status das colunas (iguais nas 3 propostas)

> Regra de ouro: **a cor NUNCA é o único indicador**. Toda coluna e todo card de status usam
> **ponto colorido + rótulo de texto + ícone/palavra**.

| Status         | Nome PT-BR     | Cor       | Tint (fundo) | Ícone   |
|----------------|----------------|-----------|--------------|---------|
| Azul           | A Fazer        | `#2E6BE6` | `#E7F0FE`    | lista ▤ |
| Laranja        | Em andamento   | `#F5860F` | `#FDEEDA`    | play ▶  |
| Violeta        | Revisão        | `#8250DF` | `#F0E9FC`    | olho ◎  |
| Verde          | Finalizado     | `#1FA85C` | `#E2F6EB`    | check ✓ |

## 4. Sistema de cor POR USUÁRIO (identificar, não dominar)

Cada pessoa tem **uma** cor consistente e distinguível. Ela aparece SEMPRE como identidade da
pessoa, nunca como fundo do card inteiro. Aplicações canônicas:

- **Anel do avatar** (2px, com respiro branco de 1px → `box-shadow: 0 0 0 1px #fff, 0 0 0 3px <cor>`).
- **Filete de acento** na borda esquerda do card (3px).
- **Chip "responsável"** (fundo com tint da cor a ~12%, texto na cor escurecida ~14% p/ contraste AA).
- **Controle de filtro** por pessoa (linha de avatares/chips no topo do board).
- **Indicador discreto** no card (ponto colorido junto ao nome).

### 4.1 Equipe (10 pessoas fictícias PT-BR) — paleta base

| # | Pessoa                    | Iniciais | Cor (nome)  | Hex       | Uso texto (escurecido) |
|---|---------------------------|----------|-------------|-----------|------------------------|
| 1 | Ana Beatriz Rocha         | AB       | Coral       | `#F0616D` | `#C43F4C`              |
| 2 | Bruno Carvalho            | BC       | Ciano       | `#159FD6` | `#0E7BAA`              |
| 3 | Carla Mendonça            | CM       | Violeta     | `#7C5CFF` | `#5B3FD6`              |
| 4 | Diego Ramos               | DR       | Esmeralda   | `#12A56A` | `#0C7E51`              |
| 5 | Eduarda Lima              | EL       | Rosa        | `#E24C9A` | `#B83179`              |
| 6 | Felipe Andrade            | FA       | Índigo      | `#4C63D9` | `#3547AE`              |
| 7 | Gabriela Nunes            | GN       | Âmbar       | `#E08A1E` | `#B06A0F`              |
| 8 | Henrique Dias             | HD       | Turquesa    | `#0FB5B0` | `#0A8A86`              |
| 9 | Isabela Freitas           | IF       | Magenta     | `#B84AC0` | `#93359A`              |
| 10| João Pedro Vasconcelos    | JP       | Grafite     | `#64748B` | `#465264`              |

### 4.2 Escala para 20+ pessoas (extensão)

Mesma lógica, hues bem separados. Para além de 20, gerar por **ângulo áureo** (≈137,5°) em HSL com
`S≈62% / L≈52%` fixos e escurecer 12–16% para texto sobre branco (contraste AA).

| # | Cor         | Hex       | # | Cor         | Hex       |
|---|-------------|-----------|---|-------------|-----------|
| 11| Verde-Lima  | `#7BAF3A` | 16| Framboesa   | `#D6336C` |
| 12| Céu         | `#3E8BFF` | 17| Oliva       | `#8A8F2E` |
| 13| Ameixa      | `#9A5BD6` | 18| Cobalto     | `#2D53C8` |
| 14| Terracota   | `#D2683C` | 19| Uva         | `#7048B6` |
| 15| Petróleo    | `#0E7C86` | 20| Bronze      | `#B07A2E` |

> **Legibilidade em escala:** com 5/10/20 usuários a distinção se mantém porque (a) a cor só aparece
> em elementos pequenos e consistentes (anel, chip, filete), (b) sempre acompanha iniciais + nome, e
> (c) o avatar tem respiro branco que separa o anel do fundo. A cor identifica; o texto confirma.

## 5. Raios (border-radius)

| Token      | Valor |
|------------|-------|
| `--r-sm`   | 8px   |
| `--r-md`   | 12px  |
| `--r-lg`   | 16px  |
| `--r-xl`   | 20px  |
| `--r-pill` | 999px |

## 6. Sombras (Light UI — suaves e curtas)

| Token             | Valor |
|-------------------|-------|
| `--sh-xs`         | `0 1px 2px rgba(20,32,46,.06)` |
| `--sh-sm`         | `0 1px 3px rgba(20,32,46,.08), 0 1px 2px rgba(20,32,46,.04)` |
| `--sh-md`         | `0 6px 16px rgba(20,32,46,.08)` |
| `--sh-lg`         | `0 16px 40px rgba(20,32,46,.14)` |
| `--sh-card-hover` | `0 10px 24px rgba(20,32,46,.12)` |
| `--sh-drawer`     | `-24px 0 60px rgba(20,32,46,.16)` |

## 7. Espaçamento (escala 4px)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40` — usada em paddings, gaps e margens.
Densidades: **Compacto** (gap card 8–10px, padding card 12px) e **Confortável** (gap 14–16px,
padding card 16px) — ver Proposta C.

## 8. Tipografia

- Família: system-ui / Inter-like (`-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial`).
- Escala: Título board 22/28 · Título drawer 18–20 · Coluna 14–15 · Título card 13.5–14 ·
  Meta 12 · Chip/contagem 11.
- Pesos: 400 (corpo) · 500 (meta forte) · 600 (títulos de card/coluna) · 700 (número KPI).
- Tracking: títulos `-0.01em`; caixa-alta de rótulos de status com `+0.04em`.
