# LIGHT UI — I3I · F9 CENTRAL DE NOTIFICAÇÕES — RELATÓRIO

**Fase:** I3I · F9 — Golden Frame 9 sobre a Central de Notificações REAL
**Base congelada:** `1cf13637` (F1–F8 GOLDEN/CONGELADAS) · **Branch:** `impl/light-ui-f9-notificacoes-1.0.246`
**Golden:** `proposta-c-frame9-notificacoes.html` (Frame 9 aprovado, Design Freeze `8173940`; renderizado antes de editar)
**Versão:** 1.0.246 (inalterada) · **Status:** ENTREGUE — aguarda owner. **F9 NÃO congelado até owner GO. F10 NÃO iniciado.**

---

## A · Reauditoria literal (FASE 2 — código atual, não memória)

1. **Entry real:** `TABS` k:'notificacoes' → dispatch `state.tab==='notificacoes'` →
   `renderNotifCentral()` + `afterNotifCentral()`. Badge da sidebar = `notifNavBadge`
   (`.nc-navbadge#navbadge-notif`) + `notifBadgeRefresh` — fonte `notifHistoryUnread()`.
2. **Helpers históricos REVALIDADOS no código atual (nomes idênticos):**
   `renderNotifCentral` · `ncRow` · `notifHistoryLoad/Save/Append/Unread/MarkRead/MarkAll/
   Clear` · `notifHistoryFilter` · `notifTypeLabel` · `ncSev` · `ncTypeHex` · `ncDayLabel` ·
   `ncTimeHM` · `ncAvatar` · `ncCaptureBusy` · `ncEnsureStyle`/`NC_CSS`.
3. **Estado:** `notifCentralFilters {tipo, sev, designer, cliente, q}` + `notifDetailId`.
4. **CSS real:** `NC_CSS` string DARK HARDCODED injetada por `ncEnsureStyle()`
   (`<style id="nc-style">`) — não consome vars do tema (achado estrutural da fase).
5. **Row real (`ncRow`):** rail de severidade (`.nc-acc`, cor `ncSev`), avatar 40
   (responsável||ator, `ncAvatar` com foto ou iniciais+`userColor`), badge de tipo
   (`notifTypeLabel` + tint inline `ncTypeHex`+alpha), título, badge **CRÍTICO**
   (critical + `sla_critical`|`operational_block`), subtítulo (subtitle || cliente ·
   tarefa), contexto colorido pela severidade, hora `ncTimeHM`, dot de não lida
   (`.nc-ur`), CTA "Abrir tarefa" quando `x.deep`.
6. **Grouping real:** `ncDayLabel` — Hoje / Ontem / dd/mm/aaaa (comparação por data
   local); ordenação = ordem do store (unshift no append ⇒ mais recentes primeiro).
7. **Detalhe real:** painel lateral fixo `.nc-detail` 416px (não-modal, sem trap — 
   semântica real preservada) com tipo/CRÍTICO/X, avatar 52, título, quando, linhas
   Tarefa/Cliente/Responsável/Origem-ator/Etapa/Severidade/Detalhe e CTA deep.
8. **Empty states reais:** "Nenhuma notificação por aqui" (histórico vazio) e "Nada
   encontrado" (filtros sem match). **Loading: NÃO existe** (localStorage síncrono —
   documentado; nada inventado).
9. **A11y (débito histórico REVALIDADO):** `nc-row`/`nc-act`/`nc-open`/`nc-dx`/`nc-dcta`
   eram divs/spans clicáveis SEM role/tabindex/teclado — confirmado no código atual.

## B · Fonte real dos dados (FASE 3)

10. **100% LOCAL:** `localStorage['idseven.notif.history.v1']` (`NOTIF_HIST_KEY`),
    read-side/capture-only do pipeline real de notificações (`notifHistoryAppend`:
    dedup por `dedupKey`, retenção 300 itens/30 dias, captura passiva quando o usuário
    edita — `ncCaptureBusy`); `deep` default `detail/<taskId>`. **NÃO grava Firestore;
    não chama provider; não envia a backend** (o próprio Golden estampa isso no rodapé).
    Schema literal do item usado nos fixtures do harness (20 campos).
11. **Bell × Central (FASE 10):** o contador da SIDEBAR (`navbadge-notif`) é a MESMA
    fonte da Central (`notifHistoryUnread`) — sem contador paralelo; marcar
    lida/todas/limpar atualiza o badge via `notifBadgeRefresh` (provado no harness:
    4→3→0/oculto). O `slaib-bell` do shell é OUTRA superfície (Alertas de SLA em
    contexto de board) e não foi tocado.

## C · Matriz Golden × Real (FASE 4)

12. **A (função/dado real existe):** header da página (tile sino + "Notificações" +
    "Central e histórico · local" — literal do render real); pill "N não lidas"
    (unread real); Marcar todas; Limpar histórico (com confirmação real); busca; 4
    filtros (Tipo com os 4 tipos reais Atribuição/Fluxo/SLA/Sistema; Severidade com os
    4 níveis reais; Designer/Cliente derivados do histórico real); grupos Hoje/Ontem/
    data; rows completas (item 5); dot de não lida; "Abrir tarefa" com deep real;
    rodapé "Histórico LOCAL…" (o texto do Golden É o texto real); empty.
13. **B/C (adaptação):** dot de não lida no VERMELHO do Golden (real era índigo —
    apresentação); "Abrir tarefa" como link índigo (Golden) em vez de pill; badge "N
    não lidas" em tint clara com dot (real era gradiente saturado); largura útil 1200px
    (real 1040 — densidade do Golden).
14. **D (estrutural):** hairline dos day headers; sombras/hover.
15. **E (não existe no real):** NENHUM elemento do Golden precisou de invenção — zero
    F9-E. (Golden e implementação real já nasceram alinhados; o rodapé do Golden até
    documenta a semântica local.)

## D · Implementação (FASES 5/6/15)

16. **CSS — seção `I3I · F9` no `light-ui-foundation`:** como o CSS real é dark
    hardcoded injetado por JS, a seção SOBRESCREVE as classes `nc-*` (exclusivas da
    Central = guarda natural) com especificidade maior que o `nc-style`.
    **Auditoria automática: 55 seletores, 55/55 gated com `body.light-ui.desktop`,
    0 leakage, 0 global, 0 `!important`; balanço de chaves = 0.** Linguagem Light UI
    congelada: superfícies claras densas, hairlines `#EFF1F6/#E4E8EF`, rows brancas
    r14 com hover suave, unread `#FBFBFF` + dot `#F2415A`, tints de tipo/severidade
    INLINE REAIS preservadas (funcionam sobre claro), busca/filtros C1 claros, ações
    claras (Limpar = danger suave), detalhe branco com sombra, CTA do detalhe no
    gradiente do amendment, empty claro, navbadge sem ring dark sobre a sidebar teal.
17. **JS (a11y fix universal, padrão REAL do `.evc` da Agenda):** `role="button"` +
    `tabindex="0"` + `aria-label` descritivo na row ("Notificação [não lida]: título ·
    tipo · hora"); role/tabindex em `nc-open`/`nc-act`/`nc-dcta`; `nc-dx` com
    `aria-label="Fechar detalhe"`; **Enter/Espaço** por `onkeydown` (mesmo esquema de
    propriedade dos onclick existentes do `afterNotifCentral` — sem acúmulo). Correção
    de débito documentada; universal (dark e light); atributos pixel-inertes —
    **regressão legado da Central 0px provada nos 3 temas**.
18. **Focus-visible** claro (#4353D8, 2px) em todos os controles; reduced-motion
    escopado (row/act/open/fl + hover transform).

## E · Ações/mutations (FASE 9 — todas LOCAIS; tabela)

| AÇÃO | HANDLER | OP | PAYLOAD | RBAC | WRITES | FAILURE PATH |
|---|---|---|---|---|---|---|
| Abrir row (marca lida) | `[data-nc-open]` onclick | localStorage setItem | item.read=true | todos | **1 local** | try/catch silencioso (real) |
| Abrir destino (deep) | `[data-nc-deep]` onclick → `notifRoute` | setItem (markRead) + navegação | idem | todos | **1 local** | try/catch no notifRoute |
| Marcar todas | `[data-nc-markall]` | setItem | todos read=true | todos | **1 local** | try/catch |
| Limpar histórico | `[data-nc-clear]` + `window.confirm` REAL | setItem `[]` | limpa store local | todos | **0 se cancelar · 1 se confirmar** | confirm=false ⇒ nada (provado) |
| Fechar detalhe | `[data-nc-close]` | — | — | todos | 0 | — |

**Zero mutations de backend** (Firestore/API/Functions) — por construção e provado
(stub com contador = 0 em toda a bateria). Sem RBAC (ações locais do próprio usuário —
semântica real documentada).

## F · Smoke (FASE 16 — 28/28 PASS)

19. Entry real pela sidebar; render síncrono com 10 notificações (loading N/A real);
    grouping "Hoje|Ontem|17/08/2026" exato; unread = 4 rows + pill "4 não lidas" + 4
    dots + navbadge "4"; lidas sem dot; severidade/tipo reais na row crítica (rail
    #FF6B61 + SLA + CRÍTICO); filtros REAIS um a um: Tipo SLA=3 · Severidade
    critical=1 · Designer "Tatiana Gomes"=3 · Cliente "MovOn"=1; busca "Reels"=2;
    busca sem match → "Nada encontrado"; **abrir pelo MOUSE** (painel + markRead com
    exatamente 1 write local + unread 3 + navbadge 3); fechar o painel PELO TECLADO
    (Enter no X); **abrir pelo TECLADO** (Enter na row — o fix); **destino real 1:
    deep `detail/k1` → a Central de Detalhes (F6) VERDADEIRA abre sem
    `data-detorigin`** + markRead + Esc volta; **destino real 2: deep `agenda` →
    `notifRoute` muda a tab**; Marcar todas (1 write; unread 0; pill some; navbadge
    oculto); Limpar com `confirm` REAL — **cancelar = 0 writes e nada muda; confirmar
    = 1 write + empty "Nenhuma notificação por aqui"**; navegação F9→Tarefas→Agenda→F9
    (filtros preservados); **zero writes Firestore** (contador = 0). Writes locais
    totais da bateria: 6 (2 markRead de abertura + 2 de deep + 1 markall + 1 clear).

## G · Responsivo (FASE 14)

20. 1920 / 1366 / **win125 1093×614 @1.25** — zero page-level overflow nos três
    (scrollW == vw); toolbar refluí (flex-wrap real); rows elipsam (nowrap+ellipsis
    reais); targets ≥40px nos controles.

## H · Fidelidade (FASE 18 — ISSUE = 0)

21. Zonas: shell MATCH (congelado) · header MATCH (tile/título/sub literais) · toolbar
    MATCH (badge+ações no header; busca+4 filtros) · grouping MATCH · rows MATCH
    (rail/avatar/tipo/título/CRÍTICO/sub/contexto/hora/dot/CTA) · unread
    FUNCTIONALLY ADAPTED (dot vermelho Golden) · severity MATCH (cores reais) ·
    avatars MATCH (fotos reais quando existem; iniciais+userColor) · timestamps MATCH ·
    actions MATCH · empty MATCH · detalhe FUNCTIONALLY ADAPTED (painel real 416px
    claro; Golden não o desenha) · responsive ADAPTED. **EXCEPTION: 0 · ISSUE: 0.**
22. Medidas (1920): content max-width 1200 · row pad 13/15/19 r14 · rail 3px · avatar
    40 (detalhe 52) · tipo badge 10px/800 upper · day header 11px/800 + hairline ·
    busca/filtros 40px r11 · hora 11.5 tabular · dot 8px · painel 416px · foco 2px
    #4353D8.

## I · Regressão congelada (FASE 19 — base `1cf13637`)

23. **Light UI (18 pares):** F1 board+painel · F2 board+painel · F3 board+painel · F4
    board+painel · F5 board+painel · F6 default · F7 Setor+Dados · **F8 month+list+
    detail** = **0px em 15 dos 18 pares** (incl. F6 default, F7 Setor+Dados e F8 month/list/detail); os 3 diffs (F3/F4/F5 painel) caíram na região EXATA do flake do sino (1443,29→1485,71) — política A–E cumprida: em F3p/F4p a PRÓPRIA BASE divergiu entre duas rodadas (A) e em F5p o atual divergiu sozinho (B); **0px fora da região comprovada nos 3**, máscara não ampliada. *Known async bell flake.*
24. **Legado (8 pares):** Central de Detalhes aberta dark/light/hc · **Central de
    NOTIFICAÇÕES dark/light/hc (com o markup a11y novo)** · Agenda dark · board F5
    dark = **0px puro em 8/8** — em especial a **Central de Notificações legada dark/light/hc com o markup a11y novo** (atributos pixel-inertes provados), a Central de Detalhes aberta nos 3 temas, a Agenda dark e o board F5 dark

## J · Fechamento (FASE 20)

25. Provas no chat: F9-NOTIFICACOES-{1920, 1366, win125, DETAIL-1920, A11Y-FOCUS}.png +
    F9-COMPARE-GOLDEN-vs-APP.png. Checkpoint único `d74b7fcf`
    (`feat(light-ui): port F9 notifications golden`) + push; sem PR/merge/build/
    release/tag/bump/ativação. Roadmap: **I3H = ✔ GO · F8 = CONGELADO @ `1cf13637` ·
    I3I = ENTREGUE — AGUARDA OWNER · F9 = NÃO CONGELADO até owner GO · F10 = NÃO
    INICIADO.**

**HARD STOP.** F10 Executivo não iniciado. Aguarda GO explícito do owner.
