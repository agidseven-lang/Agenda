# P1 GOLDEN — ESPECIFICAÇÃO IMPLEMENTÁVEL (Meu quadro)

Direção **oficial aprovada pelo owner = P1 ("Atelier")**. Fonte da verdade visual:
`I7-P1-MEU-QUADRO-1920x1080`. Esta spec transforma o conceito aprovado em tokens + grid
implementáveis. Melhorias aplicadas = **apenas micro-craft** (Inter real, hairlines,
estados, spacing, responsividade). Nada da P1-PRO foi importado.

## 1. TOKENS (extraídos da própria P1)

### Superfícies (escada fria clara)
| Token | Papel | Hex |
|---|---|---|
| `--s-app` | fundo do app (atrás da sidebar/rail) | `#E7EDF3` |
| `--s-work` | workspace (main) | `#EEF3F8` |
| `--s-board` | moldura/well do kanban | `#E2E9F1` |
| `--s-col` | coluna (rebaixada no well) | `#EDF1F6` |
| `--s-card` | card (elevado) | `#FFFFFF` |

### Tinta / linha
`--ink #16233B` · `--ink2 #42506B` · `--ink3 #7B879D` · `--line #DCE3EC`

### Marca + semânticos
`--teal #0D9488` · `--teal-bg #E9F7F5` · `--orange #EA580C`
Sidebar: gradiente `#0E343B → #0C2C35`; logo/CTA gradiente `#14B8A6 → #0D9488`.
Overdue (texto/cards): `#C2410C` / `#B93815`; SLA pill fundo `#FFF4EC` borda `#F5D8C1`.

### Acentos das colunas (PRESERVAR — identidade P1)
| Estágio | Token | Hex |
|---|---|---|
| A Fazer | `--c1` | `#5B6CFF` (azul) |
| Em andamento | `--c2` | `#F59E0B` (âmbar) |
| Revisão | `--c3` | `#8B5CF6` (roxo) |
| Finalizado | `--c4` | `#22C55E` (verde) |
Uso: ponto/ícone do column-header, legenda do board e **border-left 3px do card**.

### Sombras (contidas)
`--e1 0 1px 2px rgba(15,42,60,.05)` · `--e2 = e1 + 0 4px 14px rgba(15,42,60,.08)` ·
`--e3 0 12px 28px rgba(15,42,60,.18)` (só drag/hover forte).

### Radius
card 11 · coluna 13 · well/board 16 · painel do cockpit 14 · chip/botão 8–10 · pill de contagem 8.

### Tipografia (implementação = Inter real, pesos/tamanhos da P1 preservados)
| Papel | size / weight |
|---|---|
| Page title (h1) | 16.5 / 800, ls −0.01em |
| Card title (h4) | 13.5 / 800, ls −0.01em |
| Column header | 12 / 800 |
| Tab | 12 / 700 |
| Chip / tag | 10–11 / 700 |
| KPI valor | 15 / 800 (tabular) |
| Eyebrow cliente | 9 / 800, upper, ls .09em |
| Metadata / due | 10–11.5 / 700 (tabular) |
Micro-craft: `-webkit-font-smoothing:antialiased`, `font-variant-numeric:tabular-nums`
em todo numérico (contadores, %, prazos).

## 2. GRID / SPEC ESPACIAL
| Métrica | Valor |
|---|---|
| Sidebar width | 256 px (fixa) |
| Header height | 60 px |
| Toolbar (filter bar) | ~40 px (padding 10px 20px 0) |
| Main padding (wrap) | 12px 20px 16px |
| Board↔rail gap | 14 px |
| Well/board padding | 14 px, radius 16, inset shadow |
| Colunas | grid 4×1fr, gap 11, radius 13, padding 10 |
| Card | radius 11, padding 11/12/10, border-left 3px, margin-bottom 9 |
| Cockpit (rail) width | 268 px (fixa), gap entre painéis 11 |
Percepção espacial da Golden = idêntica à screenshot P1 em 1920×1080.

## 3. RESPONSIVO (mesma identidade; só reflow)
- **1920×1080** — referência.
- **1366×768** — legenda do board oculta; busca compacta; SLA completo; tudo cabe.
- **Win125 (1093×614 CSS / DPR 1.25)** — busca colapsa para ícone; SLA curto (`SLA · 22:00`);
  chip "CEO" oculto (redundante com o perfil); título 1 linha. Sem scroll horizontal.
Regras: sidebar/rail com largura fixa e min; colunas `minmax(0,1fr)`; nada de scroll lateral no body.

## 4. COMPONENTES + ESTADOS
Card: default · hover (translateY −2, e3) · focus (outline 2px teal) · selected (teal-bg + borda teal)
· overdue (due âmbar + tag late) · drag (rotate −1.5° + e3) · completed (opacidade .72, barra 100% teal→verde).
Nav item: default · hover (bg branco 5%) · active (bg branco 10% + inset ring + ícone teal) · count · hot (laranja).
Botão: primary (gradiente teal) default/hover/focus · secondary · ghost. Alvos ≥ 24px.

## 5. PROIBIÇÃO DE DRIFT (o que NÃO importar da P1-PRO)
Nenhuma destas mudanças da P1-PRO entra na Golden: acento único/monocromático · cockpit
unificado · remoção do border-left colorido · remoção da moldura/well · board proporcional
(a P1 mantém o palco grande) · outra interpretação de card. **P1 antes e depois = mesmo design.**
