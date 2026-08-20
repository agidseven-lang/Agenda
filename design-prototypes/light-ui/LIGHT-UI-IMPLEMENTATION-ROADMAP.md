# LIGHT UI — IMPLEMENTATION ROADMAP (trilha nova · I0…I12)

**Natureza:** roadmap TÉCNICO da implementação do Design Freeze. O Design Closure (R1–R11) está
FINALIZADO/FROZEN e **não é reutilizado** — esta trilha começa do zero com nomenclatura própria.
**Estado:** **I0 = ✔ GO · I1 = ✔ GO · I2 = ✔ GO · I2.1 = ✔ GO · I2.2 = ✔ GO (CORE SHELL
GOLDEN = CONGELADO, commit `0d107dea`) · I3A — F1 Meu Quadro = VISUAL REFINEMENT REQUIRED (task card) ·
I3A.1 — F1 drawer = PASS · I3A.2 — Golden Task Card = ▶ ENTREGUE (aguarda owner) ·
I3B+ = NÃO INICIADAS.**
Branches: `impl/light-ui-foundation-1.0.246` (I1, `0dc87ccb`) →
`impl/light-ui-core-shell-1.0.246` (I2, `6a4ea142`) →
`impl/light-ui-core-shell-refine-1.0.246` (I2.1, `c368a6c2`) →
`impl/light-ui-core-shell-final-1.0.246` (I2.2, `0d107dea`, ✔ GO) →
`impl/light-ui-f1-meu-quadro-1.0.246` (I3A, `7eb93bb1`) →
`impl/light-ui-f1-final-1.0.246` (I3A.1, `58847c85`) →
`impl/light-ui-f1-golden-cards-1.0.246` (I3A.2, `6744090a` + `116723a7`).
Zero build/deploy/release; produção intacta; version 1.0.246.

**Regras permanentes da trilha inteira:**
1. **Fonte funcional = código Desktop MAIS RECENTE no momento de cada fase** (hoje: 1.0.246 —
   provado na I0); **fonte visual = Design Freeze** (contracts → errata → R8 → Golden). Conflito
   ⇒ AUDITAR → CLASSIFICAR → REPORTAR → OWNER DECIDE → só então implementar.
2. **Zero downgrade funcional** — nunca remover/reverter função para imitar um Frame.
3. **MINIMAL STRUCTURAL CHANGE** — tokens → CSS → classes → markup mínimo; proibido reescrever
   o renderer "para organizar".
4. Cada fase: pequena · auditável · **reversível** (rollback = remover classe/bloco) · com gate
   de saída · **screenshot compare** (1920/1366/125% vs Golden/R8) · **smoke funcional real**
   (fluxos P0 do reaudit §17) · sem alterar função.
5. Tokens/cores SEMPRE de contracts + `ACCESSIBILITY-TOKEN-ERRATA.md` (canônica) — nunca de
   screenshots históricos.
6. Antes de criar o branch da I1: reconfirmar que 1.0.246 ainda é a Desktop mais recente
   (senão, re-executar o Gate 4 da I0 sobre a mais nova; drift ⇒ owner antes de começar).

---

## I0 · IMPLEMENTATION PRE-FLIGHT & BASELINE REAUDIT — ✔ APROVADA PELO OWNER (GO)
Auditoria read-only completa: Desktop mais recente identificada e provada (= 1.0.246, tip
`a4312c57`, tag v1.0.246, release Latest); **drift funcional 1.0.246→atual = ZERO** (renderer/
main/preload/auth byte-idênticos; zero commits novos); mapa 30/30 vigente; F1–F13/B/C1–C8 sem
drift; token table, guardrails responsivos mapeados a alvos reais, blockers a11y, arquitetura do
renderer (monólito 13.034 linhas com `:root` tokens + **mecanismo de aparência REAL:
`applyAppearance()` com `body.light`/`body.hc`/zoom de fonte**), estratégia de tema (classe
técnica paralela via pipeline existente), metodologia de teste, fluxos P0, base recomendada
(`a4312c57`). Docs: `LIGHT-UI-BASELINE-REAUDIT.md` + este roadmap +
`LIGHT-UI-IMPLEMENTATION-TOKENS.md`. **Gate de saída:** GO do owner.

## I1 · FOUNDATION — TOKENS & THEME RAIL — ✔ APROVADA PELO OWNER (GO)
Branch `impl/light-ui-foundation-1.0.246` de `a4312c57` (tip reverificado; tag v1.0.246 =
commit de build 0fa34335, diff tag→tip só workflow). **Commit `0dc87ccb` APROVADO (GO):** 1
arquivo, +55/−0, bloco único `<style id="light-ui-foundation">` no fim do head — namespace
`body.light-ui` (SEM ativação em produção; só harness; zero JS), tokens --lui-* literais de
contracts+errata, base canvas via vars reais (--bg/--ink/…; --accent/--grad ficam p/ I2+),
precedência HC preservada (body.light-ui.hc), guardrail R8 min-width:0 em seletores estruturais
reais. Validado: tokens computados == errata (literal); legado pixel-idêntico sem a classe
(dark/light/hc/light+hc @1920, 0px); smokes light-ui 3 perfis + hc + zoom sem overflow. Desvios
registrados: aria-live flashToast e toast X 28 adiados p/ fases de componente; brand-hover não
criado (sem valor canônico). Docs da entrega: `65acd652`. Relatório:
`LIGHT-UI-I1-FOUNDATION-REPORT.md`. **Gate de saída: ✔ GO do owner (registrado).**

## I2 · CORE SHELL — SIDEBAR · HEADER · CANVAS — técnica PASS · NÃO FECHADA
> **Decisão do owner sobre a entrega I2:** implementação técnica = PASS, MAS Core Shell
> Golden ainda não fechado (brand block fora do Golden; header/cluster persistente não
> provado visualmente). **A I2.1 abaixo é o GATE FINAL da I2** — a I2 só fecha com o GO
> da I2.1. Registro original da entrega I2 mantido a seguir para rastreabilidade.

### I2.1 · CORE SHELL GOLDEN ALIGNMENT ▶ ENTREGUE (aguarda owner — gate final da I2)
> **Status:** branch `impl/light-ui-core-shell-refine-1.0.246` criado de `6a4ea142` (I2).
> Commit `c368a6c2`: 1 arquivo, **+95/−0, 1 hunk**, seção I2.1 comentada no MESMO bloco
> `<style id="light-ui-foundation">`; zero JS; zero markup. **A — Brand:** app mark = ASSET
> REAL `--logo` reutilizado (mark circular oficial; caixa-gradiente do Golden era stand-in
> de protótipo) em 46px + sombra Golden; **"Agenda ID Seven"** como brand copy VISUAL só
> sob a classe (::before — legado pixel-idêntico); "sincronizado" + dot Golden. **B/C —
> Header:** token `--lui-hd-h:92px` (CONGELADO do Golden V10 grid rows); banda surface +
> hairline pintada no scroller `.content` (fixa no topo); eixo lateral 34px; topbar legado
> segue oculto (1.0.140); sem título global — surfaces I3+ assentam o head na banda.
> **D/E — Monitor SLA + sino REAIS:** skin Golden do `#sla-monitor` real (chip 50 r14,
> verde tint F1FBF7→E8F8F0 ring CBEEDD, orb 34 branco, kicker green-ink E5, status
> #115E3D "Tudo em dia"; amber/red com inks E7; badges E8) e do `#slaib-bell` real
> (46 squircle, surface+hairline, badge danger-ink); avatar 46 (Golden av-46); geometria
> do cluster na banda com fallbacks CSS que ESPELHAM o runtime (34/90/146 = mesmos px do
> slaClusterAlign; zero briga CSS×JS); cálculo/polling/severidade/textos/handlers 100%
> preservados; dropdowns/painéis dark auto-contidos → fases de componente. **Validação:**
> cluster real criado por `slaibRefresh()` de produção no harness (contexto mínimo de
> quadro p/ o gate real); 3 perfis ok (P0 win125 PASS); nav smoke 11/11; HC/zoom ok;
> legado sem classe = **0px vs I2** (dark/light/hc). Provas I2.1-SHELL-{1920,1366,win125}
> entregues no chat (não versionadas). Relatório: `LIGHT-UI-I2-1-SHELL-REFINEMENT-REPORT.md`.
> **Owner sobre a I2.1: visual PASS**, MAS dois pontos impediram o GO final do Core Shell:
> corner-avatar no cluster (fora do Golden) e brand name via `::before` (DOM ≠ visual).
> Resolvidos na I2.2 abaixo.

### I2.2 · CORE SHELL FINAL CLEANUP ▶ ENTREGUE (aguarda owner — ÚLTIMO gate da I2)
> **Status:** branch `impl/light-ui-core-shell-final-1.0.246` de `c368a6c2`. Commit
> `0d107dea`: 1 arquivo, **+22/−14** (5 hunks CSS + 1 literal de markup do brand), zero
> lógica JS. **GAP 1 — corner-avatar:** auditoria = **NÃO possui função única** (navega p/
> 'perfil' pela MESMA delegação `[data-tab]` do `.sb-user`, sempre visível; sem menu/keyboard
> próprios; substituto histórico do #topAvatar oculto em 1.0.140; p/ SLA/sino é só âncora de
> medida — runtime F3.5.4G trata rect-zero). Golden F1–F5 reconfirmados: hd-right = SÓ
> [Monitor SLA][Bell] (av-46 = avatar contextual da SURFACE no título). Decisão: **oculto sob
> `body.light-ui`** (elemento/handler intactos no DOM e no legado); cluster recalculado SEM
> gap (bell right 34 = eixo Golden; monitor 90 = runtime-converge). **GAP 2 — brand DOM:**
> nome visual = nome acessível via TEXTO REAL — markup do brand passa a ter
> `.nm-legacy` "ID Seven" + `.nm-lui` "Agenda ID Seven" (nasce display:none inline); sob a
> classe o par inverte (`display:inline !important`); **::before removido como fonte
> textual**; SR sob light-ui = "Agenda ID Seven" sem duplicação; legado anuncia/renderiza
> "ID Seven" como sempre. "sincronizado" texto real intacto; mark real 46 preservado.
> **Validação:** a11y pontual (innerText/::before=none); legado **0px** (arquivo inteiro
> dark/light/hc + prova complementar da SIDEBAR montada markup velho×novo = 0px); 3 perfis
> PASS (win125 bell edge 1059<1093, folga maior); cluster [Monitor SLA][Bell]; monitor verde
> real; nav smoke 11/11. Provas I2.2-SHELL-{1920,1366,win125} no chat (não versionadas).
> Relatório: `LIGHT-UI-I2-2-CORE-SHELL-FINAL-REPORT.md`.
> **Gate de saída: ✔ GO do owner (registrado) — I2 + I2.1 + I2.2 fechadas; Core Shell Golden
> CONGELADO para implementação em `0d107dea`.**

## I3A · F1 — MEU QUADRO ▶ ENTREGUE (aguarda owner)
> **Status:** branch `impl/light-ui-f1-meu-quadro-1.0.246` de `0d107dea` (Gate 0 ✓). Commit
> `7eb93bb1`: 1 arquivo, **+121/−2, 3 hunks** (114 CSS na seção F1 do bloco + 2 literais de
> template do card com vars aditivas inertes no dark — zero lógica). **Reaudit real:** F1 =
> `renderPersonBoard` (isMe) + `boardToolbar` (busca ⌘K + abas reais) + `kbv2BoardHtml`
> (SOCIAL_COLS4 reais: A Fazer/Em andamento/Revisão/Finalizado) + `kbv2Card`
> (KanbanTaskCardUnified) + **"drawer" real = Central de Detalhes** (`openDetails` → modal
> `.det-sheet`; NÃO existe drawer lateral no produto — decisão auditada: o det-sheet é o
> painel de detalhe do F1 e foi re-skinado; o F6 página segue para I4). **Skin Golden:**
> header da surface na banda (avatar contextual real 46 + título 26/700), busca clara (o dark
> pintava preto com !important), abas com ativa em info-ink (E8), colunas limpas sobre canvas,
> card com faixa lateral = RESPONSÁVEL PRIMÁRIO (--kresp via userColor real; contrato
> congelado), pills/chips com inks derivados por color-mix (E7), CTA hierarquia (Detalhes
> grad E4 / Mover secondary / menu contextual), estados provados (normal/Hoje/Atrasada/
> pré-envio neutro/Concluída sem Mover — guarda real). **R8:** colunas min 260 + scroll-x SÓ
> no kanban; página sem overflow nos 3 perfis. **Desvios auditados (P0):** filtro Golden
> "Filtrar por responsável" NÃO existe como função no Meu quadro real → NÃO adicionado
> (regra P0 vence; análogo real = hub por responsável/strips, fases próprias); drawer =
> Central de Detalhes (acima). **Validação:** smoke funcional 6/6 real, shell regression
> cluster/banda 0px + sidebar deltas só de conteúdo harness→render, legado 0px (arquivo E
> board montado, relógio congelado), HC smoke. Provas I3A-F1-{1920,1366,win125,drawer-1920}
> no chat (não versionadas). Relatório: `LIGHT-UI-I3A-F1-MEU-QUADRO-REPORT.md`.
> **Owner sobre a I3A: TECHNICAL PASS** (board/cards/responsividade/legado/smoke), MAS F1
> Golden não fechado: detail era modal central (Golden = drawer) e o filtro por responsável
> exigia resolução formal. A I3A.1 abaixo é o ÚLTIMO gate do F1.

### I3A.1 · F1 FINAL GOLDEN ALIGNMENT ▶ ENTREGUE (aguarda owner — último gate do F1)
> **Status:** branch `impl/light-ui-f1-final-1.0.246` de `7eb93bb1`. Commit `58847c85`:
> 1 arquivo, **+38/−1** (33 CSS + 1 literal de hook no openDetails), zero lógica.
> **B — Detail = Golden drawer:** a MESMA Central real (openDetails/.det-sheet; trap/Escape/
> outside-click/handlers/conteúdo/estrutura det-head·det-body·det-actions INTACTOS)
> apresentada como drawer lateral direito Golden (416px/max 94vw, full-height right:0, sem
> radius, --sh-drawer, hairlines de zona, título 23/700, SEM backdrop visível — mecânica
> modal preservada), SOMENTE para aberturas do Meu quadro via hook aditivo
> `data-detorigin="mine"` (derivado do estado real `activeTab()`; inerte no legado — provado
> 0px com a Central ABERTA no dark); demais origens/superfícies = modal central. CTA primária
> real `.send-go` ("Enviar ao cliente") = grad E4 (Gate 7). **A — Responsible filter:**
> reauditoria ampla (responsavel/filter/mine/personBoard/strip/f354/owner/userFilter)
> confirmou: função INEXISTENTE no Meu quadro real → **IMPLEMENTATION EXCEPTION F1-E01**
> registrada: controle NÃO criado (código funcional vence; Design Freeze intacto — Golden
> permanece registro histórico). **Validação:** drawer 416 full-height nos 3 perfis (X e
> footer no viewport, corpo rola, página sem overflow-x); card→drawer, Escape, outside-click
> e RETORNO DE FOCO ao botão de origem provados; regressões 0px (board light I3A×I3A.1 sem
> drawer; legado dark/light/hc com board montado; dark com a Central ABERTA — hook inerte).
> Provas I3A.1-F1-{1920, DRAWER-1920, DRAWER-1366, DRAWER-win125} no chat (não versionadas).
> Relatório: `LIGHT-UI-I3A-1-F1-FINAL-REPORT.md`. **Owner: DRAWER = PASS; task card = NO-GO
> visual (regressão ao modelo denso legado) → I3A.2.**

### I3A.2 · GOLDEN TASK CARD RESTORATION ▶ ENTREGUE (aguarda owner)
> **Status:** branch `impl/light-ui-f1-golden-cards-1.0.246` de `58847c85` (F1 + drawer
> preservados). Commit `6744090a`: 1 arquivo, **+64/−0, 1 hunk CSS-ONLY** (zero markup/JS/
> função). **CARD MODEL CORRECTION registrada:** "os cards densos da I3A eram regressão para
> o modelo legado; a fonte visual correta são os cards dos Frames Golden aprovados"
> (prints 5/6). Regra compartilhada F1–F5: **CARD = RESUMO OPERACIONAL · DRAWER = DETALHE.**
> Reorganização por CSS order/display sobre o markup real do kbv2Card: título primeiro;
> "Cliente · nome" discreto; chip de categoria; pill de prazo/urgência real; **progresso real
> como barra segmentada 5px** (mesma semântica); microstats de 1 linha (conteúdo/checklist;
> vazio não renderiza); participante avatar 24; ações compactas 28px (Detalhes grad E4 /
> Mover / ⋯); ocultados do card (permanecem no DOM e no DRAWER): ficha do responsável,
> origem, Etapa atual/Próxima ação, data absoluta, hint. RAIL = responsável primário
> (congelado, inalterado). **Números (mesmo fixture):** altura média **460→246px (−46%)**;
> densidade @1920 = **2 cards completos/coluna** (antes 1). Smoke 8/8 intacto; drawer I3A.1
> intacto (416/right:0/foco); shell intacto; 1366/win125 sem overflow; **legado 0px**
> (dark/light/hc, board montado). Provas I3A.2-F1-{1920, DRAWER-1920, 1366, win125} no chat.
> **Refino `116723a7`:** o owner forneceu o PRINT DE REFERÊNCIA canônico do card → ajustes
> CSS-only 1:1: título → categoria UPPERCASE tint (sem dot) → "Cliente" label+nome (2 linhas)
> → "Prazo" + DATA REAL colorida pelo estado (--kdue) → barra → microstats → avatar → ações;
> pill de prazo relativo removida (data+cor comunicam; urgência só com SLA real ativo);
> temas/notas → drawer; colunas com barra na cor real (--kc) + add colorido. Altura média
> 264px; 2 cards completos/coluna; smoke OK; drawer intacto; legado 0px.
> Relatório: `LIGHT-UI-I3A-2-GOLDEN-CARDS-REPORT.md`. **Gate de saída: GO do owner.**

### F1 · PROTÓTIPO v4 — ✔ **APROVADO PELO OWNER** (REFERÊNCIA VISUAL INTEGRAL DO F1)
> **Registro formal (2026-08-20, correção de direção do owner).** O protótipo
> `design-prototypes/light-ui/proposta-e-f1-card-golden-restoration.html` na revisão
> **`0600303c`** (v4, medido pixel a pixel da referência canônica) foi **APROVADO PELO OWNER
> como referência visual integral da tela F1 — Meu Quadro**. O owner confirmou que o problema
> das iterações anteriores **não era o layout**, e sim os cards densos/legados; o v4 corrigiu.
>
> **Escopo integral da aprovação (manter, não reinterpretar):** sidebar teal/petróleo ·
> header · enquadramento · toolbar · filtro por responsável · grid (4 colunas kanban + painel
> lateral de detalhes NA MESMA LINHA) · alinhamento vertical · botões "Adicionar tarefa" ·
> KPIs do rodapé · legenda de responsáveis · spacing · proporções · cores · tipografia ·
> cards compactos · densidade dos cards.
>
> **Proibições vigentes:** NÃO alterar o layout do v4 · NÃO voltar ao shell/layout anterior ·
> NÃO remover KPIs · NÃO remover o painel lateral · NÃO trocar a sidebar · NÃO reinterpretar
> a composição · NÃO gerar nova proposta visual (sem v5, sem redesign).
>
> **Regra de autoridade atualizada (F1):** código real = funções, dados, permissões e
> workflow; **protótipo v4 aprovado = apresentação visual e layout**. Conflito funcional →
> preservar a função real e adaptar visualmente **sem descaracterizar o v4**.
>
> **AMENDMENT CANÔNICO DO DESIGN (ordem do owner, 2026-08-20):**
> **F1 v4 = OWNER-APPROVED DESIGN AMENDMENT = referência visual integral e canônica do F1.**
> Quando o v4 divergir de QUALQUER decisão visual anterior do F1 — sidebar/calibração,
> enquadramento, header, toolbar, grid, 4 colunas, painel lateral integrado, cards,
> "Adicionar tarefa", KPIs, legenda, spacing, proporções, cores, tipografia — **o v4 VENCE
> e SUPERSEDE a decisão anterior** (aprovação explícita do owner; não é mera "coerência
> com I2"). Isto supersede, entre outras: a seção "REFERENCE ALIGNMENT v2" (reprovada), a
> calibração de sidebar da I2 (284px → **266px v4**, calibração COMPARTILHADA do Light
> Shell), o copy de brand da I2.2 ("Agenda ID Seven" → **"ID Seven"** como no v4) e o
> canvas anterior (→ `#FDFEFE`). O código real segue vencendo SOMENTE em: função, dados,
> permissões e workflow.
>
> **V4-FUNCTIONAL-CONFLICT-01 — RESPONSIBLE FILTER — ✔ RESOLVIDO PELO OWNER (2026-08-20 · resolution: IMPLEMENT RESPONSIBLE FILTER; implementado na I3A.4, commit `f10aabe0`).** Registro original da parada mantido para rastreabilidade:
> Reauditoria objetiva (base real `58847c85`, pré-adições): o Meu Quadro real **NÃO possui
> filtro por responsável** — nenhuma função/handler/state: a seleção de tasks é fixa do
> dono do board (`t.assigneeId===pid||t.by===pid`, L6578), o único filtro de board é
> `boardQuery` (busca textual, state L7477, handler `afterBoard()` L8603) e `taskChips()`
> é NAVEGAÇÃO entre quadros, não filtro; `boardMine` existe só em boards de setor. Confirma
> F1-E01. Conforme a ordem: **não criar controle falso, não inventar JS** — a linha de
> chips do v4 fica FORA do porte até decisão do owner; o JS gated adicionado na
> reconstrução (`boardRespFilter`) será REMOVIDO no porte. O restante do porte prossegue
> (independente).
>
> **AUDITORIA DE KPIs (dados reais; nenhum mock em runtime):**
> | KPI v4 | Campo(s) real(is) | Fórmula | Fonte | Determinístico? |
> |---|---|---|---|---|
> | Tarefas ativas | lista do board + `isTaskCompleted(t)` | `list.filter(t=>!done).length` | estado real do board | SIM |
> | Conclusão geral | idem | `round(100*done/total)` (0 se total=0) | idem | SIM |
> | Atrasadas | `taskDeadline(t).late` (prazo real vs relógio) | `list.filter(late).length` | helper real L3225 | SIM (dado o relógio) |
> | SLA em dia (98%) | **inexiste % real** — SLA real é estado/contagem (`slaMonData().total`, "Tudo em dia" L4317) | estado real: "Em dia"/`N alertas` | mesma família do Monitor SLA | SIM (estado), **% NÃO portável** |
> | Deltas "vs mês passado" | tasks NÃO carregam `createdAt` confiável (grava-se em events/notifs; `doneAt` só num caminho de conclusão) | — | — | **NÃO derivável → NÃO renderizar** |
> | Sparklines (séries) | exigiria série histórica; `doneAt`/`designerSla.finishedAt` não cobrem todas as formas de conclusão de `isTaskCompleted` | — | — | **NÃO derivável → NÃO renderizar** |
> | Legenda de responsáveis | `respOf(t)`/`userColor(id)`/`state.users` | usuários reais da visão | estado real | SIM |
>
> Decisão registrada: KPIs 1–3 e legenda = números/dados REAIS; KPI-4 = estado real (sem %
> inventado); deltas e sparklines NÃO são renderizados no runtime real (slots/layout do v4
> preservados sem a polyline) — **reportado ao owner nesta seção antes de qualquer dado
> fictício**, conforme ordem.
>
> **Fase: I3A.3 · F1 V4 PORT — ✔ APROVADA PELO OWNER (checkpoint `93ffc235`; "o porte visual integral do F1 v4 está APROVADO")**

### I3A.4 · F1 V4 FUNCTIONAL CLOSURE — ✔ GATES PASS · **F1 V4 = IMPLEMENTADO / GOLDEN / CONGELADO**
> **Branch:** `impl/light-ui-f1-v4-final-1.0.246` (de `93ffc235`) · **checkpoint único
> `f10aabe0`** ("feat(light-ui): complete F1 v4 with responsible filter") ·
> relatório `LIGHT-UI-I3A-4-F1-CLOSURE-REPORT.md`.
> **Decisão 1 (conflito-01 RESOLVIDO):** filtro por responsável IMPLEMENTADO como função
> nova autorizada — exclusivo do F1, client-side/in-memory, semântica `respOf()` real
> (responsável primário do produto), chips das próprias tasks do board (visibilidade real),
> seleção única + "Todos", busca E filtro compõem (interseção), counts/KPIs refletem a
> visão filtrada, empty state real, estado só na surface (reset junto ao `boardQuery`),
> **zero escrita** (Firestore/Functions/Worker/API), gated por `body.light-ui`.
> **Decisão 2:** KPIs permanecem 100% dados reais (sem 78%/98%/deltas/sparklines
> fabricados; SLA como estado real). **Decisão 3:** "ID Seven · Agência" e "Plano Business
> 80%" = **VISUAL REFERENCE — FUNCTION NOT AVAILABLE** (nenhuma função fictícia criada; a
> ausência não invalida o layout do F1).
> **Gate final do F1 (todas as condições PASS):** v4 visual MATCH (zone metrics = zero
> regressão vs `93ffc235`) · filtro funciona (teste funcional 14/14: Todos→A→B→Todos,
> busca+filtro, counts, empty, seleção, painel) · KPIs reais · painel docado intacto
> (392px, extensão exata das colunas 230..911; Esc/fechar/foco/clique-fora PASS) ·
> responsive PASS (1920/1366/win125 sem overflow) · legado **0px** (dark/light/hc,
> relógio congelado) · zero backend write. Provas F1-V4-FINAL-{1920-TODOS,
> 1920-RESPONSAVEL, 1366, win125, 1920-PANEL}.png no chat.
> **I3A.4 = ✔ GO DO OWNER (registrado; "A I3A.4 está APROVADA").
> F1 = IMPLEMENTADO / GOLDEN / CONGELADO — NÃO REABRIR salvo regressão comprovada.**

## I3B · F2 — CLIENTE ▶ ENTREGUE (aguarda owner)
> **GO do owner recebido (F2 somente; F3+ NÃO autorizadas).** **Branch:**
> `impl/light-ui-f2-cliente-1.0.246` de `f10aabe0` (HEAD confirmado) · **checkpoint único
> `62613a29`** ("feat(light-ui): implement Golden Cliente surface") · relatório
> `LIGHT-UI-I3B-F2-CLIENTE-REPORT.md`. Fonte visual F2 = Frame 2 aprovado
> (`proposta-c-frame2-cliente.html`); shell/toolbar/board/card-foundation = F1 v4
> compartilhado (amendment). Reauditoria real completa (colunas CLIENT_COLS4 = labels do
> Golden; faixa "Aprovações pendentes" = wfApprovalsBarHtml REAL com nv/vs/aj + urgência
> >24h + drawer real; visualização = rounds reais approvalRounds/wfExternalInfo; espera
> externa JÁ neutra no SLA real; próxima ação = helper real). Card Cliente compacto
> (anatomia Golden sobre foundation v4; sinal de visualização real via span aditivo
> inerte). Painel = MESMA Central real (drawer <1760 / DOCADA ≥1760, 244..1027). Gates:
> smoke 12/12 · **F1 REGRESSION 0px** (board+painel, relógio congelado) · legado 0px nos
> DOIS boards (dark/light/hc) · 1920/1366/win125 sem overflow · zero escrita · matriz de
> fidelidade ZERO ISSUE. Provas F2-CLIENTE-{1920,1920-PANEL,1366,win125}.png no chat.
> **I3B = ✔ GO DO OWNER (registrado). F2 = IMPLEMENTADO / GOLDEN / CONGELADO.**

## I3C · F3 — DESIGNERS ▶ ENTREGUE (aguarda owner)
> **GO do owner recebido (F3 somente; F4+ NÃO autorizadas).** **Branch:**
> `impl/light-ui-f3-designers-1.0.246` de `62613a29` (HEAD confirmado) · **checkpoint
> único `05910f33`** ("feat(light-ui): implement Golden Designers surface") · relatório
> `LIGHT-UI-I3C-F3-DESIGNERS-REPORT.md`. Fonte visual = Frame 3 aprovado; shell/cards =
> F1 v4 + padrões F2. Reauditoria real: DESIGNER_COLS4 confirmado (labels do Golden;
> "Recebido" inexiste); strip real `f354DesignerStrip` + autoload real
> `f354DesignerAutoPick` (1º alfabético/seleção salva) com quadros POR designer isolados;
> SLA real `kbv2SlaLocal` (Em prazo/Prazo próximo/Prazo encerrado/Entregue — **Entregue ≠
> conclusão global**, regra REAL); próxima ação real; conteúdo real; rail/anel = respOf.
> Card F3 = foundation v4 + anatomia Golden (setor no topo, Prazo+SLA na mesma linha,
> barra+% cols 2–3, próxima ação compacta). Painel = MESMA Central real (drawer <1760 /
> docada ≥1760, 240..1027). Gates: smoke 11/11 · **F1 REGRESSION 0px** · **F2 REGRESSION
> 0px** (board+painel) · legado 0px nas 3 superfícies · 1920/1366/win125 sem overflow ·
> zero escrita · matriz ZERO ISSUE. Provas F3-DESIGNERS-{1920,1920-PANEL,1920-BOAZ,1366,
> win125}.png no chat. **I3C = ✔ GO DO OWNER (registrado). F3 = IMPLEMENTADO / GOLDEN /
> CONGELADO.**

## I3D · F4 — SOCIAL MEDIAS ▶ ENTREGUE (aguarda owner)
> **GO do owner recebido (F4 somente; F5+ NÃO autorizadas).** **Branch:**
> `impl/light-ui-f4-social-medias-1.0.246` de `05910f33` (HEAD confirmado, worktree
> limpa) · **checkpoint único `6d4796ff`** ("feat(light-ui): implement F4 social medias
> golden") · relatório `LIGHT-UI-I3D-F4-SOCIAL-MEDIAS-REPORT.md`. Fonte visual = Frame 4
> aprovado; shell/cards = F1 v4 + padrões F2/F3. Reauditoria real: SOCIAL_COLS4
> confirmado (A Fazer/Em andamento/Revisão/Finalizado — eixo OPERACIONAL; aprovação
> parcial do cliente NUNCA vira Concluído, regra real); strip real `f354SocialStrip` +
> autoload real `f354SocialAutoPick` com ORDEM PRÓPRIA (seleção salva → o próprio →
> 1º A-Z — diferente do designers; preservada); `socialOf` real; sinais reais no card
> (Visualizado/Não visualizado/Ajuste/Designer entregou — `designerSla.finishedAt`).
> Painel = MESMA Central real (drawer <1760 / docada ≥1760, 240..1027; X/Esc/foco
> provados). Gates: smoke **18/18** · **F1/F2/F3 REGRESSION 0px** (board+painel; F3 com
> strip) · legado 0px nas QUATRO superfícies (F3-dark 0px fora de zona-flake ambiental
> 40×40 no cluster, comprovada base×base) · 1920/1366/win125 sem overflow · zero write ·
> matriz ZERO ISSUE. Provas F4-SOCIAL-MEDIAS-{1920, 1920-PANEL, 1920-OUTRO-USUARIO,
> 1366, win125}.png + comparação no chat. **I3D = ✔ GO DO OWNER (registrado).
> F4 = IMPLEMENTADO / GOLDEN / CONGELADO.**

## I3E · F5 — SETORES — ✔ GO DO OWNER (CONGELADA)
> **GO do owner recebido (F5 somente; F6+ NÃO autorizadas).** **Branch:**
> `impl/light-ui-f5-setores-1.0.246` de `6d4796ff` (HEAD confirmado; worktree limpa) ·
> **checkpoint único `f6915110`** ("feat(light-ui): implement F5 setores golden") ·
> relatório `LIGHT-UI-I3E-F5-SETORES-REPORT.md`. Reauditoria real: rota = taskChips
> "hub" → `renderHub` (índice real) → `[data-sector]` → `renderBoard` (board canônico);
> **colunas = const `STATUS` própria** (A Fazer/Em andamento/Revisão/**Concluído** — não
> SOCIAL_COLS4); **setores reais ativos:** Edição de vídeos `#60A5FA` · Cronograma
> `#34D399` · Edição de Cards `#F472B6` (descontinuados preservados p/ histórico e nunca
> expostos); critério task→setor = `secOf`+`visibleTasks` (permissão real); "Minhas
> tarefas" = chip real `boardMine` (efeito provado); sem autoload próprio (real: hub →
> clique). **Strip de setores = reapresentação GATED da navegação real** (mesmo handler
> `[data-sector]`, mesma lista, counts reais — nenhuma função nova). Painel = MESMA
> Central real (drawer <1760 / docada ≥1760, 240..1027; X/Esc/foco provados). Gates:
> smoke **24/24** · F1/F2 regression **0px** · F3/F4 regression **0px** (painéis: flake
> do sino reprovado pela política A–E — base×base e atual×atual divergem na MESMA região
> ~40×40; **0px fora**) · legado **0px nas CINCO superfícies** (mesma política) ·
> 1920/1366/win125 sem overflow · zero write · matriz ZERO ISSUE. Provas
> F5-SETORES-{1920, 1920-PANEL, 1920-OUTRO-SETOR, 1366, win125}.png + comparação no
> chat. **I3E = ✔ GO DO OWNER (registrado 2026-08-20). F5 = IMPLEMENTADO / GOLDEN /
> CONGELADO (checkpoint `f6915110`).**

## I3F · F6 — DETAILS — ✔ GO DO OWNER (CONGELADA)
> **GO do owner recebido (F6 somente; F7+ NÃO autorizadas).** **Branch:**
> `impl/light-ui-f6-details-1.0.246` de `f6915110` (HEAD confirmado; worktree limpa) ·
> **checkpoint único `8e288c6b`** ("feat(light-ui): implement F6 details golden") ·
> relatório `LIGHT-UI-I3F-F6-DETAILS-REPORT.md`. **HARD GATE de acoplamento APROVADO
> com prova por código:** `data-detorigin` é emitido SÓ em `state.tab==='tarefas'` com
> sub-tab ∈ {mine, client, designers, socials, hub+boardSector} (expressão literal do
> `openDetails`); toda abertura real fora disso — Minhas Prioridades (`data-priopen`),
> deep-link/notificação `detail/<id>` (`notifRoute`), hub raiz sem setor — abre a MESMA
> Central como **modal central DEFAULT sem o atributo**. Superfície do Golden F6 = essa
> apresentação default (funções da equipe: Legendas e artes/`prod`, Enviar ao cliente,
> Editar prazo, Mover status, Remover — todas da Central real; `renderClientView` é
> superfície DISTINTA com ações de cliente e permanece intocada — referência estrutural
> do protótipo, registrada). **Escopo CSS estrito `:not([data-detorigin])`** — disjunto
> por construção dos 5 painéis congelados; paleta Golden por override de custom
> properties no subtree do sheet default; regras extras só onde o base tinha cor dark
> hardcoded (det-x hover, numerais, timeline, rodapé, slaedit-btn de CSS lazy); CTA de
> fase no gradiente do amendment (`--lui-grad`); rodapé compacto com destrutivo à
> direita (sem reordenar DOM). A11y real: dialog/aria-modal/nome acessível e
> trap/Esc/retorno de foco JÁ existiam na Central; dívidas quitadas = `aria-label`
> "Fechar detalhes" no X (pixel-inerte; provado 0px em dark/light/hc e nos 5 painéis
> light) + reduced-motion escopado ao modal default; a superfície real não tem tabs
> (nada inventado). Adaptações registradas: **F6-E01** Golden é página 3 colunas →
> modal central real 1240×88vh em coluna única (corpo linear condicional; Operação/
> Timeline vivem no `<details>` real colapsável "Detalhes do fluxo" — função
> preservada); **F6-E02** pill "MONITOR SLA · AO VIVO" e os 4 chips do hero não
> fabricados (1 chip de estado real + cron label; setor no det-badge; SLA/fase nos
> blocos reais); **F6-E03** resumo editorial com Feed/Story/situação por item pertence
> à `renderClientView` real (não fabricado na Central); **F6-E04** contadores reais
> `N / M` (não "12 temas · 7 legendas · 5 pendentes"). Gates: smoke **41/41**
> (abertura pelas 2 superfícies reais + origem ausente também no hub raiz, conteúdo da
> task clicada, campos reais, **Entregue≠Concluída**, RBAC admin×designer, CTA gating
> ativo/locked real `canSendToClient`, pós-conclusão H16/H17, X/Esc/trap/retorno/
> reabrir, zero writes) · regressão congelada **F1 board+painel, F2 board+painel, F3
> board+painel, F4 board+painel, F5 board+painel = 0px** (F4: flake do sino reprovado
> pela política A–E — base×base diverge sozinho na MESMA região ~1443,29→1485,71;
> known async bell flake; **0px fora da região comprovada**) · legado **0px** (Central
> aberta em dark/light/hc + boards; hc/light com o mesmo flake na região fechada
> 1460,30→1500,72, 0px fora) · 1920/1366/win125 = modal central real (sem dock ≥1760:
> nem contrato real nem Golden o determinam para o default) · matriz ZERO ISSUE com
> F6-E01..E04. Provas F6-DETAILS-{1920, 1920-ALT-STATE, 1920-SCROLL, 1366, win125,
> A11Y-FOCUS}.png + F6-COMPARE-GOLDEN-vs-APP.png no chat (política: não versionar).
> **I3F = ✔ GO DO OWNER (registrado 2026-08-20). F6 = IMPLEMENTADO / GOLDEN /
> CONGELADO (checkpoint `8e288c6b`).**

## I3G · F7 — WIZARD ▶ ENTREGUE (aguarda owner)
> **GO do owner recebido (F7 somente; F8+ NÃO autorizadas).** **Branch:**
> `impl/light-ui-f7-wizard-1.0.246` de `8e288c6b` (HEAD confirmado; worktree limpa) ·
> **checkpoint único `c4c114e9`** ("feat(light-ui): implement F7 wizard golden") ·
> relatório `LIGHT-UI-I3G-F7-WIZARD-REPORT.md`. **Reauditoria literal ANTES de editar:**
> superfície real = `renderForm` (rota `state.form`, PÁGINA com card `.form-wrap`; um único
> wizard p/ criação e edição); entry points `[data-fab]` (CTA sidebar/FAB/coluna kanban) →
> `openNewTaskWizard` (reset canônico F3.3.75A); **4 etapas reais** Setor→Dados→Briefing→
> Revisão; setores ativos reais = Edição de vídeos/Cronograma/Edição de Cards (gated
> `canCreateCards`; descontinuados nunca); Dados por setor (titleLabel real, clientRequired,
> assignee gated, chips STATUS, períodos, prioridade; Cards 1..50 travada na edição);
> Briefing real (quantidades personalizadas c/ `#cqErr role=alert`, fields reais "Período de
> referência"/"Canais" do `synthCronSub`, `rteField`, cards c/ intervalo obrigatório);
> Revisão real (`rev-*`, contador N/M, `canSendToClient` + hint literal, "Salvar tarefa"/
> "Criar N tarefas"); validações reais via alert()+erro inline; submit `saveTask` (draft id
> estável → set → read-back) e `saveCardsBatch` (batch atômico); **Esc NÃO fecha (página);
> X fecha direto** — comportamentos preservados. **Escopo estrito:** `body.light-ui.desktop
> #app > .content > .form-wrap` + modais exclusivos `:has([data-pickasg])`/
> `:has([data-sqshrinkok])` — 66 seletores 100% escopados, 0 global, balanço 0; nenhuma
> superfície F1–F6 atingida. Skin C1 (stepper premium com estados reais, inputs h46 foco
> ring, labels sentence-case, pill obrigatório, option-cards, chips h32 c/ dot, switch,
> vqty, revisão clara) + CTA no gradiente do amendment; grupos FLAT e Dados em 2 colunas de
> grupos (grid :has dense, ordem real). **A11y:** 9 rótulos da etapa Dados viram
> `<label for>` REAIS (pixel-inerte com display:block; provado 0px no legado) + reduced
> motion escopado; nada de dialog/trap/Esc inventado (é página). Exceções F7-E01..E06
> (texto real do subtítulo; topbar do Golden fora do wizard; alert() real preservado; X sem
> confirmação/Esc real; rte em tema E legenda; modais pós-save fora do escopo). Gates:
> smoke **35/35** (2 caminhos reais de abertura, RBAC designer sem Cards, validações
> literais, gate real da quantidade, disabled real, roundtrip, Esc real, **submit stubado:
> exatamente 1 set com payload de 31 chaves validado** — workflowPhase themes_preparation,
> cronStatus rascunho_social, clientFlowStatus afazer — e zero writes além do esperado) ·
> responsivo 1920/**1366**/**win125 1093×614** sem overflow e CTAs visíveis · regressão
> congelada **F1–F6 board+painel+strip+default = 0px** (21 pares; flake do sino em f5/f5p e
> legado-light na região exata documentada — política A–E cumprida, 0px fora, máscara não
> ampliada) · legado **0px** incluindo o WIZARD nos 3 temas (labels novas comprovadamente
> pixel-inertes). Provas F7-WIZARD-{1920, ETAPA-INTERMEDIARIA-1920, BRIEFING-1920,
> REVISAO-1920, VALIDACAO-1920, 1366, win125, A11Y-FOCUS}.png + F7-COMPARE-GOLDEN-vs-APP.png
> no chat (política: não versionar). **Gate de saída: avaliação do owner.**
> **F8+ = NÃO INICIADA.**

### I3G.1 · F7 FUNCTIONAL HARDENING — ✔ PASS (harness-only; produção intocada)
> Visual da I3G aceito pelo owner; hard gate funcional fechado SEM alterar código:
> **EDIT MODE PASS (22/22)** — entry real `data-cardedit` (Central + menu do card) →
> `openCardsEdit` (form factory-fresh, `f.id`, SEM `_draftId`), pré-preenchimento real,
> **quantidade travada por MODO EDIÇÃO** (`#fCardsQty disabled value=1 title literal`,
> distinguida do disabled do "−" por N=1), stepper/roundtrip/Revisão "Salvar alterações";
> gravação real `update(f.id)` + read-back do prazo: **1 update, zero criação**, patch de
> 26 chaves (tema+prazo, `cardDeadlineRev 1→2`, `deadlineVersion 0→1`, history ADITIVO
> kind:'edited' fields=[titulo,prazo] com prev/new, `designerAssignment` intervalo
> atualizado SEM reatribuição) e preservação provada de by/createdAt/status/checklist/src.
> **CARDS BATCH PASS (16/16)** — fluxo real N=3 (designer pelo modal `data-pickasg`,
> "Criar 3 tarefas"): `saveCardsBatch` real com **3 `batch.set` + 1 `batch.commit`
> atômico**, ids distintos, `cardsBatchId` único, `cardIndex 1..3`, campos comuns/
> distintos validados, AUSÊNCIA de workflowPhase/cronStatus/clientFlowStatus/token/
> designerSla (setor interno), tabela sem duplicação. **BATCH ATOMICITY PASS (5/5)** —
> commit rejeitado no stub (semântica Firestore) ⇒ **0 de 3 persistidos**, alerta real
> "(nada foi criado)", form preservado p/ retry, `_saving` resetado — atomicidade do
> próprio `db.batch()` real, nenhuma correção necessária. **ZERO REAL WRITES.**
> **Produção NÃO alterada** — HEAD segue `c4c114e9` (worktree limpa; F1–F6 congelados;
> 1.0.246; Light UI inativa). Adendo: `LIGHT-UI-I3G1-F7-FUNCTIONAL-HARDENING-REPORT.md`.
> **I3G.1 = PASS · F7 = READY FOR OWNER FREEZE · CODE CHECKPOINT = `c4c114e9`.**
> **I3G = ✔ GO DO OWNER (registrado). F7 WIZARD = GOLDEN / CONGELADO @ `c4c114e9`.**

## I3H · F8 — AGENDA ▶ ENTREGUE (aguarda owner)
> **GO do owner recebido (F8 somente; F9+ NÃO autorizadas).** **Branch:**
> `impl/light-ui-f8-agenda-1.0.246` de `c4c114e9` (HEAD confirmado; worktree limpa) ·
> **checkpoint único `1cf13637`** ("feat(light-ui): port F8 agenda golden") · relatório
> `LIGHT-UI-I3H-F8-AGENDA-REPORT.md`. Reauditoria literal (26 itens): entry real
> `[data-tab="agenda"]` → `renderAgenda` (agView month|list, agCursor/agSel/agFilter/
> agQuery/agShowCancelled); eventos = coleção própria `events` via onSnapshot (SEM task
> linkage — vínculo real é ownerId/by); `TYPES` reais = as cores do Golden; status real
> `evStatus/evStatusMeta` (Agendado/Em andamento/Finalizado/Cancelado); `calendarGrid` 42
> células domingo-first com dots ≤4 por tipo e sel que oculta dots; buckets reais da
> lista; cards `evc2-*` completos (rail userColor/late, data, horário, status, cliente,
> local, owner, tipo) já com role=button/tabindex/aria-label/Enter reais; detalhe
> `evd-*` com dialog/aria-modal/trap/Esc em camadas/retorno de foco REAIS e ações gated
> (Iniciar/Finalizar/Cancelar/Editar/⋯ Excluir só admin + EXCLUIR); form `ev-sheet` com
> saveEvent (add/update). Matriz: A massivo; B = 2 colunas via wrappers ADITIVOS neutros
> (.ag-tools/.ag-body/.ag-day, pixel-inertes — legado 0px nos 3 temas), toolbar por CSS
> order, células min-height 92 número ao topo, gradiente do amendment em hoje/sel/CTAs
> (!important só contra styles inline reais — 9, registrados); C = count do dia
> `dayEvs.length` real gated pela classe; D = topbar de página do Golden (shell);
> **E = nenhum conflito; nenhum evento/campo fabricado; lógica de datas intocada**.
> Guardas estritas: `#content:has([data-ag="vmonth"])` + `.sheet.ev-sheet` +
> `.modal-back[data-evdmodal]` — 39 seletores 100% escopados, 0 global, balanço 0.
> Gates: smoke **32/32** (entry real; prev/next/Hoje; dots reais; múltiplos no dia;
> ordenação por horário; count real; empty; cancelados toggle real; filtro/busca;
> buckets; detalhe por clique E teclado com foco no X, Esc e RETORNO ao card; RBAC
> admin×não-admin no Excluir; **zero mutation por navegar**; writes stubados: Iniciar =
> 1 update {startedAt,startedBy}, criação = 1 add com payload real completo) ·
> responsivo 1920 (grid 1140+416)/1366/**win125 1093×614** sem overflow · regressão
> congelada **F1–F7 = 0px** (12/13 puro; F5 painel só na região exata do flake — A–E
> cumprida, 0px fora) · legado **0px em 7/7 pares** (Agenda 3 temas com wrappers;
> Central 3 temas; board dark) · fidelidade ZERO ISSUE com medidas. Provas
> F8-AGENDA-{1920, LIST-1920, EVENT-DETAIL-1920, 1366, win125, A11Y-FOCUS}.png +
> F8-COMPARE-GOLDEN-vs-APP.png no chat. **Gate de saída: avaliação do owner (F8 NÃO é
> marcado congelado — quem congela é o owner).** **F9+ = NÃO INICIADA.**
>
> **I3H.1 — F8 FUNCTIONAL HARDENING (harness/docs only, código = `1cf13637` INALTERADO):
> PASS.** Selector audit pelo diff literal do commit: **43/43 seletores individuais
> gated com `body.light-ui.desktop`, 0 leakage, 0 global; `!important` = 8 ocorrências
> em 3 declarações (todas contra styles inline reais; localizadas)**. Legacy deep-state
> **9/9 = 0px SEM máscara** (dark/light/hc × month/detalhe aberto/form aberto; sem sino
> nas capturas — A–E não necessária). Write map completo provado com stub: Criar = 1 add
> `events` 14 chaves; Editar = 1 update no MESMO doc 12 chaves (branch add×update por
> `evEditId`; pré-preenchimento real; zero duplicação); Iniciar = 1 update
> {startedAt,startedBy}→`in_progress`; Finalizar = 1 update {done,doneAt,doneBy}→
> `completed`; Cancelar = 0 antes da confirmação real, 1 update {status:'cancelled',
> cancelledAt,cancelledBy}→`isEvCancelled`; Excluir = só admin, digitação EXCLUIR
> (errada = 0 writes), semântica LITERAL = 1 update {deletedBy,deletedAt} + 1 delete
> (documentada); failure paths 9 casos (erro inline/`.evd-err.show` role=alert, flags
> resetadas, retry provado, falha no update do delete ⇒ zero delete); CTA/status matrix
> real sem estados impossíveis; **zero writes reais**. Correção documental aplicada
> (byte-identidade → wrappers emitidos no legado, pixel-inertes 0px; contagem de
> !important). Adendo: `LIGHT-UI-I3H1-F8-FUNCTIONAL-HARDENING-REPORT.md`.
> **I3H.1 = PASS · F8 = PRONTO PARA CONGELAMENTO DO OWNER · CHECKPOINT CANDIDATO =
> `1cf13637`.** **F9+ = NÃO INICIADA.**
>
> **I3H = ✔ GO DO OWNER (registrado). F8 AGENDA = GOLDEN / CONGELADO @ `1cf13637`.**

## I3I · F9 — CENTRAL DE NOTIFICAÇÕES ▶ ENTREGUE (aguarda owner)
> **GO do owner recebido (F9 somente; F10+ NÃO autorizadas).** **Branch:**
> `impl/light-ui-f9-notificacoes-1.0.246` de `1cf13637` (HEAD confirmado; worktree
> limpa) · **checkpoint único `d74b7fcf`** ("feat(light-ui): port F9 notifications
> golden") · relatório `LIGHT-UI-I3I-F9-NOTIFICACOES-REPORT.md` · Golden
> `proposta-c-frame9-notificacoes.html` (freeze `8173940`, renderizado antes de
> editar). Reauditoria literal: entry `state.tab==='notificacoes'` →
> `renderNotifCentral`/`afterNotifCentral`; helpers históricos REVALIDADOS com os
> mesmos nomes (ncRow/notifHistory*/notifTypeLabel/ncSev/ncTypeHex/ncDayLabel/
> ncAvatar); **fonte 100% LOCAL** (`localStorage NOTIF_HIST_KEY`, read-side, dedup por
> dedupKey, retenção 300/30d, captura passiva ncCaptureBusy — o rodapé do Golden
> estampa exatamente essa semântica); tipos reais Atribuição/Fluxo/SLA/Sistema e
> severidades critical/warning/success/info; grupos Hoje/Ontem/data (ncDayLabel);
> detalhe real = painel lateral fixo 416px (não-modal — semântica preservada); bell da
> sidebar (navbadge-notif) = MESMA fonte notifHistoryUnread (sem contador paralelo; o
> slaib-bell é superfície separada de SLA e não foi tocado). **Achado estrutural: o
> CSS real da Central (NC_CSS/ncEnsureStyle) é DARK HARDCODED injetado por JS** — a
> seção I3I sobrescreve as classes nc-* (exclusivas = guarda natural): **55 seletores,
> 55/55 gated `body.light-ui.desktop`, 0 leakage, 0 global, 0 !important**. Matriz:
> A massivo (Golden e código já nasceram alinhados); B/C = dot de não lida no vermelho
> do Golden, "Abrir tarefa" como link, badge de não lidas em tint clara, largura 1200;
> **E = ZERO exceções**. **A11y — débito histórico de teclado REVALIDADO e quitado com
> o padrão REAL do .evc da Agenda:** role=button + tabindex=0 + aria-label descritivo
> nas rows/controles + Enter/Espaço por onkeydown (esquema dos onclick existentes);
> universal (dark e light); **Central legada 0px provada em dark/light/hc**. Mutations
> (todas LOCAIS, tabela no relatório): abrir/markRead = 1 setItem; markall = 1; clear
> = confirm REAL (cancelar = 0 writes provado; confirmar = 1 + empty real); **zero
> Firestore/API** (contador do stub = 0 na bateria inteira). Smoke **28/28** (entry
> real; grouping exato; unread 4→3→0 com navbadge coerente; filtros reais um a um +
> busca + "Nada encontrado"; abrir por MOUSE e por TECLADO; **destinos reais: deep
> detail/k1 abre a Central de Detalhes F6 VERDADEIRA sem origem + deep agenda troca de
> tab**; retorno F9→Tarefas→Agenda→F9 com filtros preservados). Responsivo
> 1920/1366/**win125 1093×614** sem overflow. Fidelidade ISSUE=0 (medidas no
> relatório). Regressão congelada base `1cf13637`: **F1–F8 = 0px** (15/18 puro; F3/F4/
> F5 painel só na região exata do flake do sino — A–E cumprida com base×base
> divergindo sozinha; 0px fora) · **legado 8/8 = 0px puro** (incl. a Central de
> Notificações nos 3 temas com o markup novo). Provas F9-NOTIFICACOES-{1920, 1366,
> win125, DETAIL-1920, A11Y-FOCUS}.png + F9-COMPARE-GOLDEN-vs-APP.png no chat.
> **Gate de saída: avaliação do owner. F9 = NÃO CONGELADO até owner GO. F10 = NÃO
> INICIADO.**
>
> **I3I.1 — F9 FUNCTIONAL HARDENING (harness/docs only, código = `d74b7fcf` INALTERADO):
> ⚠ STOP — F9 NÃO CONGELAR.** 48/49 gates PASS: diff literal auditado (83+/5−; CSS
> 55/55 gated, 0 global, 0 !important; 5 pontos de atributos a11y; 1 bloco onkeydown;
> **zero mutations tocadas**); write map local completo com idempotências LITERAIS
> (markRead: 1 write/0 se já lida via flag `ch`; markAll: 1 write SEMPRE, sem flag;
> clear: setItem '[]', não removeItem; cancelar confirm = 0 writes); failure de
> setItem: sem crash, **sem falso sucesso** (UI relê o storage), retry ok; deep
> ordering literal (markRead ANTES do route; task inexistente = write+no-op sem crash;
> route malformada cai no ramo `board/` do parser real — documentado); keyboard na ROW
> ok (Espaço com preventDefault, zero scroll, 1 ativação); read-side robusto
> (corrompido→[]; TTL literal SÓ no append; cap 300; dedup; sev/tipo desconhecidos
> renderizam); source of truth única (navbadge==unread inclusive sob falha); filtros
> combinados sem writes; **legacy 6/6 = 0px puro sem máscara** (3 temas × populada/
> filtrada-empty); zero Firestore. **1 BUG REAL: F9-D01 — dupla ativação por TECLADO
> no controle interno "Abrir tarefa"** (Enter/Espaço no link interno abre o destino E
> o painel da row atrás — bubbling do onkeydown da I3I sem stopPropagation sobre
> nested-interactive pré-existente; mouse não afetado; sem writes duplicados;
> reproduzido estável no harness; **NÃO corrigido** conforme mandato). Adendo:
> `LIGHT-UI-I3I1-F9-FUNCTIONAL-HARDENING-REPORT.md`.
> **I3I.1 = STOP · F9 = NÃO CONGELAR · aguarda decisão do owner sobre F9-D01 · F10
> NÃO INICIADO.**

> — GO do owner (2026-08-20) com 4 correções
> obrigatórias (amendment registrado; filtro parado como conflito-01; KPIs auditados acima;
> sidebar 266px como calibração compartilhada do Light Shell sob `body.light-ui`, validada
> em 1920/1366/win125). Painel lateral: MESMA Central de Detalhes real DOCADA como 5ª
> coluna no desktop largo; viewport reduzido = drawer overlay responsivo (derivação R8).
> Card anatomy v4 congelada. UI UX Pro Max como auxiliar (v4 vence a skill). UM checkpoint
> final de implementação após todos os gates; provas F1-V4-PORT-{1920,1366,win125}.png +
> comparação por zonas medida numericamente; gate de fidelidade por zona
> (MATCH/ADAPTAÇÃO/ISSUE, alvo ZERO ISSUE). **STOP pós-provas para avaliação do owner.**
> **Status:** branch `impl/light-ui-core-shell-1.0.246` criado EXATAMENTE de `0dc87ccb` (I1
> aprovada). Commit `6a4ea142`: 1 arquivo, **+80/−0, 1 hunk**, seção SHELL comentada dentro do
> MESMO bloco `<style id="light-ui-foundation">`. Escopo cumprido = SÓ camada compartilhada
> autenticada sob `body.light-ui`: sidebar Golden 284 (--d-side re-declarado só sob a classe;
> gradiente petróleo, brand 46, CTA grad E4 48px, sb-sect, itens 42 com ativo pill+ring+barra
> C8, badge danger-ink E8, sb-user/footer; nada inventado — sem collapse/workspace selector),
> canvas claro (vence radial navy do body.desktop) + padding de página, cluster skin-only
> (sino/avatar por token; zero mudança em cálculo/texto/click do Monitor SLA). **Decisão
> auditada (regra 1):** topbar real está `display:none` por decisão de produto da 1.0.140
> (título vive por superfície) — NÃO foi reabilitado; header Golden 92 materializa nas fases
> de surface (owner valida na revisão). Desvios vs rascunho abaixo: aria-current D15 e
> landmarks D25 exigiriam JS/markup — fora do mandato I2 (zero JS) → I11; accessible name do
> sino segue dívida (mandato Gate 9). Validado: navw=284 nos 3 perfis sem overflow; **P0
> win125 PASS** (cluster dentro do viewport); nav smoke **11/11 handlers reais**; zoom
> 110/125; HC smoke; legado sem classe = 0px vs I1 (dark/light/hc @1920) com navw=216.
> Screenshots 1920/1366/win125 entregues no chat (política: não versionar). Relatório:
> `LIGHT-UI-I2-CORE-SHELL-REPORT.md`. **Gate de saída: GO do owner.**
Sob `.light-ui`: shell Golden (sidebar petróleo 284 com `sb-item`s reais, header 92, canvas
#F5F6F9) sobre a navegação REAL (`TABS`/`render()` intactos). Guardrail `min-width:0` nos filhos
de grid do shell (R8 P0). Semântica: `aria-current="page"` no item ativo (D15 parcial), `<nav>`/
`<main>` landmarks (D25). **Gate:** navegação completa funcional; screenshot 3 perfis; smoke 1.
**Dep:** I1. **Risco:** médio (afeta tudo — por isso vem cedo e sozinho).

## I3 · BOARDS — F1–F5 (kanban V10)
Cards tcv4/kbv2 re-skin V10 + colunas (funções/handlers intactos: detalhes/mover/menu/portal
clamp). Kanban: colunas min + scroll-x controlado; drawer overlay. Menus: manter role=menu ⇒
arrows/Home/End (D16) OU rebaixar semântica — decidir aqui com o código na mão. **Gate:** smoke
P0 2/4/7; screenshot F1–F5; medias de altura reais (660–1040) preservadas. **Dep:** I2.

## I4 · DETALHES — F6
`renderClientView` re-skin (HERO/OPERAÇÃO/conteúdos/marcos/aprovações); reflow 3→2 + timeline
scroll-x (R8). Traps/Escape reais preservados. **Gate:** smoke P0 3/6; copiar tema/legenda;
diagnóstico durável intacto. **Dep:** I2 (usa C1/C2 de I1).

## I5 · WIZARD — F7 (+ forms C1 em profundidade)
`renderForm` re-skin (stepper/4 passos/lote); labels associados for/id (D12) + aria-invalid/
describedby nos erros (parte do D15/§10) + boundary de input conforme E9. Scroll interno +
footer persistente (R8). **Gate:** smoke P0 2 completo (criar/editar/lote); validações
intactas. **Dep:** I2.

## I6 · AGENDA + NOTIFICAÇÕES — F8/F9
Agenda: grade mensal re-skin + dots **cor+forma** (E11) + pane reflow ≤1240; sheet de evento
(traps reais preservados). Central F9: re-skin + nc-row/nc-open com teclado (D04) + "não lida"
acessível (D14). **Gate:** smoke P0 8/9. **Dep:** I2 (F9 usa toasts I1).

## I7 · EXEC + REPORTS — F10/F11
Re-skin painéis; KPIs auto-fit; toolbars wrap; tabelas: scope="col" + caption (D20) + overflow-x
no card. Exportação CSV/JSON intacta. **Gate:** smoke P0 10/11; números idênticos aos do dark
(zero mudança de agregação). **Dep:** I2.

## I8 · LOGIN — F12
Re-skin standalone (fora do shell); **Enter submete (D02)**; media 660 real preservada; brand-ink
nos textos brand. **Gate:** smoke P0 1 (login/restauração/logout + ts-auth intacto). **Dep:** I1
(não precisa do shell).

## I9 · MODAL LEGENDAS E ARTES — F13 (+ modais C2)
Re-skin do modal denso; **P0 A11Y-D01: upload acessível por teclado** (input focável sr-only +
Enter/Espaço + anúncio + remover com label); traps/role/aria-modal nos modais genéricos (D19);
sheet 94vw/88vh. **Gate:** smoke P0 5 COMPLETO por teclado e mouse; Salvar ≠ reenviar intacto.
**Dep:** I4 (fundo/fluxo), I5 (RTE C1).

## I10 · SUPERFÍCIES B (6)
Prioridades (+ priCard teclado D03) · Hoje · Hub · Equipe · Perfil · Configurações (inclui a
própria seção Aparência re-skin — sem criar opção nova). **Gate:** smoke por superfície; gates
reais (priIsEnabled etc.) intactos. **Dep:** I2–I7.

## I11 · A11Y + RESPONSIVE HARDENING (transversal)
Varredura final dos guardrails: reduced-motion transversal (D21), selected semantics restantes
(D15), ícones-only com nome (D23), forced-colors se o owner incluir (D22 opcional), targets,
**matriz completa R8 re-executada no app real** (1920/1366/125%) + interações com `body.hc` e
fonte lg/xl (novo teste, herdado do mecanismo real). axe no app dev. **Gate:** blockers do
reaudit §11 TODOS fechados — **sem isso o Light UI não pode ser declarado pronto (P0 D01
incluído)**. **Dep:** I1–I10.

## I12 · FULL REGRESSION + OWNER ROLLOUT DECISION
Regressão completa (todos os P0 flows + screenshot matrix final + soak com updater/tray).
**OWNER DECISION registrada:** destino do tema (Light UI substitui o `body.light` básico? o
dark? exposição ao usuário?) + estratégia de release (mandato próprio — fora deste roadmap).
**Gate:** owner declara implementação pronta. Nenhuma release é definida por este roadmap.

---

### Grafo de dependências
I0 → I1 → I2 → {I3, I4, I5, I6, I7, I10*} · I1 → I8 · (I4+I5) → I9 · (I2…I10) → I11 → I12.
(*I10 consome padrões de I3–I7 onde existirem; pode iniciar após I2 com as partes independentes.)

### O que este roadmap NÃO define (mandatos futuros do owner)
Estratégia de release/rollout público · exposição do tema ao usuário · correção das dívidas
funcionais fora dos guardrails (alert/confirm, thead 5×7, métricas SLA) · Client Portal ·
janelas A-futuras (F14a–c, gated).
