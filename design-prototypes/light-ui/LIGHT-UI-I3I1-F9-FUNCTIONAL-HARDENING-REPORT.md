# LIGHT UI — I3I.1 · F9 — FUNCTIONAL HARDENING (ADENDO)

**Código testado:** `d74b7fcf` · **Natureza:** HARNESS/DOCS ONLY — **zero mudanças em `desktop/src`** (hash re-confirmado ao final; worktree limpa; 1.0.246; Light UI inativa; F1–F8 congelados; F10 não iniciado; sem PR/merge/build/tag/release/deploy).

## ⚠ RESULTADO FINAL: **I3I.1 = STOP · F9 = NÃO CONGELAR**

**1 bug funcional real encontrado e reproduzido de forma estável (F9-D01, abaixo).
48 dos 49 gates da bateria = PASS. Nada foi corrigido (mandato).**

---

## F9-D01 — Dupla ativação por TECLADO no controle interno "Abrir tarefa" (nested interactive)

- **Causa:** o handler `onkeydown` adicionado pela I3I no `afterNotifCentral` é ligado
  TANTO na row `[data-nc-open]` (`role="button"`) QUANTO no controle interno
  `[data-nc-deep]` ("Abrir tarefa"), e **não faz `stopPropagation`**. O keydown do
  controle interno bubbla até a row, cujo handler também dispara `el.click()`. O
  `stopPropagation` pré-existente protege apenas o caminho de CLICK (mouse) — não o de
  teclado. Estruturalmente já havia nested-interactive (controle clicável dentro de row
  clicável); o caminho de teclado novo expôs a dupla ativação.
- **Reprodução (harness, estável):** F9 → focar o link "Abrir tarefa" de uma row →
  Enter (ou Espaço) → o destino abre (ex.: modal da Central de Detalhes) **e o painel
  lateral da notificação (`.nc-detail`) também abre por trás**. Medido:
  `{modal: 1, panelAlso: true}`.
- **Impacto:** teclado no controle interno produz estado duplo (painel aberto atrás do
  destino). Mouse NÃO afetado (1 ativação — g10a PASS). Sem writes duplicados
  (`markRead` idempotente: 0 writes quando o item já está lido; o write único do deep
  quando não lido). Sem perda de dados. Severidade: média (a11y/UX de teclado).
- **Código responsável:** bloco `keyables` do `afterNotifCentral` (commit `d74b7fcf`,
  I3I) sobre a estrutura nested pré-existente do `ncRow`.
- **NÃO corrigido** (mandato desta fase). Correção candidata é trivial (ex.:
  `e.stopPropagation()` no handler, e/ou tratar o alvo interno antes da row) — aguarda
  decisão do owner.

---

## GATE 1 — Higiene · PASS
`d74b7fcf` · worktree limpa · 1.0.246 · Light UI inativa · F1–F8 congelados · F10 não iniciado.

## GATE 2 — Reauditoria literal do diff `d74b7fcf` · PASS
**83 linhas adicionadas / 5 reescritas.** A) CSS: 51 linhas-seletor → **55 seletores
individuais, 55/55 gated `body.light-ui.desktop`, 0 leakage, 0 global, 0 `!important`**,
1 `@media` (reduced-motion, conteúdo gated). B) Wrappers: nenhum. C) Atributos a11y: 5
pontos (nc-row role/tabindex/aria-label dinâmico; nc-act ×2; nc-dx aria; nc-dcta). D)
Handlers: 1 bloco `keyables` (`onkeydown`, Enter/Espaço → click, `preventDefault`). E)
Mutations tocadas: **zero** (nenhum helper de história alterado).

## GATE 3 — Write map local (nomes reais reauditados) · PASS

| AÇÃO | HANDLER | CHAVE | READS | WRITES | EFEITO MEMÓRIA/UI | NAVBADGE | FAILURE |
|---|---|---|---|---|---|---|---|
| markRead | row/deep onclick → `notifHistoryMarkRead` | `idseven.notif.history.v1` | 1 load | **1 setItem se havia unread; 0 se já lida (flag `ch`)** | UI relê o storage no re-render | `notifBadgeRefresh` | try/catch silencioso |
| markAll | `notifHistoryMarkAll` | idem | 1 load | **1 setItem SEMPRE (sem flag de mudança — literal)** | idem | idem | idem |
| clear | `notifHistoryClear`→`notifHistorySave([])` | idem | — | **1 setItem `'[]'` (NÃO removeItem — literal)** + `notifDetailId=null` | empty real | oculto | idem |
| (indireto) | `notifHistoryLoad/Save/Unread` | idem | — | — | fonte única | fonte única | load: catch → `[]` |

## GATE 4 — markRead · PASS (8/8)
1 write exato; item correto marcado; os outros 9 intactos (7 lidas/3 não); navbadge
4→3; row vira read; destino (painel) correto; retorno coerente; **row já lida = 0
writes (idempotência literal pela flag `ch`)**.

## GATE 5 — markAll · PASS (5/5)
1 write; 10/10 read (nenhuma perdida); navbadge oculto; grouping intacto; **re-execução
com 0 unread AINDA grava 1 setItem (literal: `notifHistoryMarkAll` não tem flag de
mudança)** — documentado, não corrigido.

## GATE 6 — clear · PASS (2/2)
Cancelar `window.confirm` real: **0 writes**, history e UI intactas. Confirmar: **1
setItem com `'[]'`** (mecanismo literal — não é removeItem), empty real "Nenhuma
notificação por aqui", navbadge oculto.

## GATE 7 — Failure de localStorage (setItem lançando) · PASS (7/7)
markRead/markAll/clear com persistência falhando: **sem crash** (try/catch real,
silencioso); **sem falso sucesso** — a UI relê o storage a cada re-render, então rows/
navbadge permanecem coerentes com o storage intacto; **retry funciona** após a falha
(1 write). Divergência UI×persistência: NÃO há (arquitetura reler-do-storage).

## GATE 8 — Deep link / ordering · PASS (5/5)
Ordem literal do handler: **markRead (1 setItem) ANTES de `notifRoute`**; 1 navegação;
destino abre 1×; painel da row NÃO abre no mouse (stopPropagation do click). `detail/`
e `agenda` provados. **Task inexistente:** markRead ocorre (1 write), `openDetails`
retorna sem abrir nada, sem crash, permanece na F9 — literal documentado. **Route
malformada (`xyz/abc`):** sem crash; o parser real cai no ramo `deep='board/'` →
`state.tab='tarefas'` com `boardSector` vazio (aterrissou e voltamos) — literal
documentado, sem fallback inventado. Item sem `deep`: não renderiza o CTA (condicional
real, já provado na I3I).

## GATE 9 — Keyboard na ROW · PASS (4/4)
Enter: 1 ativação (1 painel), write idempotente correto. **Espaço: `defaultPrevented
=true`, ZERO scroll (scrollTop inalterado), 1 ativação.** role/tabindex/aria-label
reais verificados; foco visível (outline #4353D8 — prova A11Y da I3I).

## GATE 10 — "Abrir tarefa" × row · **FAIL → F9-D01**
Elemento real: `div.nc-open[data-nc-deep]` com role=button/tabindex=0 (I3I), onclick
com `stopPropagation`. **Mouse: PASS** (1 navegação, 0 painel, write idempotente
correto). **Teclado: FAIL** — dupla ativação (descrita acima). Tab order em si é
coerente (row → controle interno), mas o padrão nested-interactive + bubbling de
keydown produz a dupla ativação. **STOP conforme mandato; sem correção.**

## GATE 11 — Read-side robustness · PASS (8/8, literais)
A) chave ausente → `[]`/empty; B) `[]` → empty; C) **JSON corrompido → catch → `[]`,
sem crash**; D) entry mínima (3 campos) renderiza (tipo "Sistema", fallbacks reais);
E) dedup real por `dedupKey` no `notifHistoryAppend` (não duplica); F) **TTL literal:
entry >30d PERMANECE no load (o filtro de retenção roda APENAS no append) e é varrida
no próximo append** — documentado; G) cap: 305 no store + 1 append → **300** (mais
novas primeiro); H) mix read/unread → counts corretos; I) severidade/tipo desconhecidos
→ `ncSev` default `#8B94A6` + tipo "Sistema", renderiza sem crash.

## GATE 12 — Source of truth · PASS (4/4)
`navbadge-notif` == `notifHistoryUnread()` == pill da Central em: startup (4),
pós-markRead (3), **pós-falha de storage (3 — coerente)**, pós-markAll (0/oculto).
`slaib-bell` fora do mecanismo e intocado.

## GATE 13 — Filtros/estado · PASS (4/4)
Combo Tipo=Fluxo + Cliente=Sunset Wear → 4 rows corretas; **filtrar = 0 writes e não
altera read state**; F9 → Agenda → F9 preserva filtros e resultado (semântica real:
`notifCentralFilters` é var de sessão em memória; reload do app reseta — literal);
zero Firestore em TODA a bateria.

## GATE 14 — Legacy (sem máscara) · PASS (6/6 = 0px puro)
Base `1cf13637` × `d74b7fcf`, dark/light/hc × {Central populada, filtro ativo com
empty filtrado}: **6/6 = 0px**. Sem sino nas capturas (Central fora de board) —
política A–E não foi necessária.

## GATE 15 — F1–F8 · PASS
`desktop/src` INALTERADO nesta fase (hash `d74b7fcf`); a regressão F1–F8 da I3I
permanece válida. Registro explícito: F1, F2, F3, F4, F5, F6, F7 = congelados ·
**F8 = congelado @ `1cf13637`**.

---

**Síntese:** 48/49 gates PASS · write map completo com counts/idempotências literais ·
failure paths sem falso sucesso · robustez do read-side provada (corrompido/TTL/cap/
dedup/desconhecidos) · source of truth única · legacy 6/6 0px · zero Firestore ·
**1 bug real: F9-D01 (dupla ativação por teclado no controle interno — introduzido
pelo caminho de teclado da I3I sobre estrutura nested pré-existente; não corrigido).**

**I3I.1 = STOP · F9 = NÃO CONGELAR · aguardando decisão do owner sobre F9-D01.**
F10 não iniciado.
