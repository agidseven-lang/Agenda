# LIGHT UI — IMPLEMENTATION TOKEN TABLE (I0 · documental)

**Função:** tabela ÚNICA de consulta para a implementação. **Não duplica contracts** — cada
linha aponta a fonte canônica. **Prioridade absoluta: `ACCESSIBILITY-TOKEN-ERRATA.md`** (E1–E11,
canônica). **Proibido extrair cores de screenshots históricos.** Mapeamento alvo: re-declaração
sob a classe técnica `body.light-ui` (estratégia I1), espelhando o padrão real de
`body.light` (re-declarar tokens; `:root` dark intacto como fallback).

| Categoria | Token/valor canônico | Fonte |
|---|---|---|
| COLOR · canvas | `#F5F6F9` (`--canvas` → mapeia p/ `--bg` real) | Golden :root · C1 |
| COLOR · surface | `#FFFFFF` (`--surface`) · surface-2 `#FAFBFD` · sunk `#F1F4F8` | Golden :root |
| BORDER · hairlines | `#E8EBF1` (`--hair` → `--line`) · `#EFF1F6` (`--hair-2` → `--line-soft`) · borda de input `#DFE3EB` MANTIDA c/ justificativa E9 (condição de implementação no guardrail §10.8 do manifest) | C1 · Errata E9 |
| TEXT | tx-1 `#14181F` · tx-2 `#4B5364` · **tx-3′ `#697181` (E1)** · **tx-4′ `#6E7786` (E2 + regra de superfície: sobre canvas usa tx-3′)** | Errata E1/E2 |
| SEMANTIC INK (texto <18.66px NUNCA em cor crua — E7) | **brand-ink `#4353D8` (E3)** · info `#2563EB` · success `#12784C` · warning `#B45309` · danger `#C4302B` · crítico `#B10E38` · sistema `#5B6472` | Errata E3/E7 |
| ACCENTS crus (dot/barra/ícone/tint/KPI grande ≥3:1) | brand `#5B7CFA` · blue `#3B82F6`/`#60A5FA` · green `#22A06B` · orange `#F59E0B` · red `#EF4444` · crit `#E11D48` · violet `#8B5CF6` | C8 (regra accent×ink) |
| SÓLIDOS c/ texto branco pequeno | fundo usa o INK da família (pill visão ativa `#2563EB`; badges 9+/CRÍTICO `#C4302B`) — **E8** | Errata E8 |
| GRADIENT (CTA/dia selecionado) | `linear-gradient(135deg, #6E5EF3, #8356E6)` — **stop 2 pela E4**; branco ≥4.73 no pior stop | Errata E4 |
| SIDEBAR | sb-1 `#252B3D` → sb-2 `#1B2031` (gradiente 180°) · sb-tx `#D0D5E1` · sb-dim `#9299AC` · **sb-faint′ `#828AA8` (E6; micro-labels do topo usam sb-dim)** · largura 284px | Golden · Errata E6 |
| HEADER | 92px · sla pill (sla-k → **green-ink `#12784C`, E5**; sla-v `#115E3D`) · bell 48 | Golden · Errata E5 |
| RADIUS | 8 (`--r-sm`) · 12 (`--r-md`) · 16 (`--r-lg`) · 999 (pill) · cards 16–18 | C1/Golden |
| SHADOW | sh-1/sh-2/sh-drawer (definições do Golden :root) | Golden |
| SPACING | grid do shell: padding de página 26–32; gaps 13–24 por superfície (cada Frame/contract) | Golden/C-contracts |
| TYPE | Inter (corpo) · InterTight (títulos/números) · corpos 10.5–30px por contract · `font-feature-settings "cv05","cv11"` | C1/Golden |
| CONTROL HEIGHT | inputs 44–48 · botões 34–48 · chips 32–44 · steppers 40–42 (C1 §alturas) | C1 |
| FOCUS | `#6E5EF3` outline 2px + halo 11% (4.26–4.61 ≥3 ✓); variante danger contextual real preservada | C1/C8 |
| MOTION | sem foundation própria (C8); requirement único: `prefers-reduced-motion` transversal (D21) | C8/A11y §19 |
| CARD | superfície branca + hairline + sh-1; kanban card V10 (anatomia F1) | Golden F1/C8 |
| MODAL | sheet 420–720 (det 1240×92vw) · **max 94vw/88vh** · backdrop rgba(15,19,32,.46) blur 3px · X hit ≥28 | C2 · Errata E10 |
| TABLE | .tbl density C7 · th tx-4′ sobre surface · scope/caption (D20) · overflow-x no card | C7 · Errata E2 |
| TOAST | stack premium (role=status/aria-live) · width 420/max 94vw real · **X hit 28×28 glyph intacto (E10)** · TTL 11/8/6s | C6 · Errata E10 |
| CALENDÁRIO | dots **cor+FORMA** (● ■ ▲ ◆ ○, 5–6px) + chips-filtro = legenda (E11) | Errata E11 |
| MAPEAMENTO p/ vars REAIS | `--bg←canvas · --surface←surface · --surface2←surface-2 · --line←hair · --line-soft←hair-2 · --ink←tx-1 · --soft←tx-3′ · --faint←tx-4′ · --accent←brand/brand-ink (por uso: accent vs texto)` + novas vars para o que o real não tem (grad′, inks, sunk, sh-*) | I1 (a validar com o código na mão) |
