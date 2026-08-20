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
>
> **I3I.2 — F9-D01 FIX (GO do owner; correção cirúrgica): ✔ PASS.** Branch
> `fix/light-ui-f9-d01-keyboard-1.0.246` de `d74b7fcf`; **checkpoint `ad8dd9d3`**
> ("fix(light-ui): resolve F9 notification keyboard activation"); diff **+11/−5 em 4
> pontos** (a11y da row → filho REAL `.nc-body`; keyables folha com stopPropagation; 1
> seletor de focus-visible F9-gated) — zero incidental. **Nested-interactive ELIMINADO
> estruturalmente** (prova no DOM: nenhum interactive descendente de role=button);
> invariantes medidos: row/detalhe e "Abrir tarefa" com 1 ativação exata por mouse/
> Enter/Espaço (preventDefault, zero scroll, zero painel fantasma — antes
> `{modal:1,panelAlso:true}`, depois `{modal:1,panelAlso:false}`); write invariance
> preservada; foco/tab order/nomes distintos ✓. **Visual before×after 4/4 = 0px**
> (1920/1366/win125/detail). **Hardening completo re-rodado: 54/54** (49 da I3I.1 + 5
> invariantes novos; contagem explicada) · smoke 28/28 · **legacy 7/7 = 0px sem
> máscara** · **regressão F1–F8 = 0px** (17 pares puros; F3/F4/F5 board+painel só na
> zona do sino com A–E provado PER-SUPERFÍCIE — o próprio base×base divergiu sozinho
> na bbox exata, incl. f3b 1458,26→1500,68; 0px fora; máscara não ampliada). Relatório:
> `LIGHT-UI-I3I2-F9-D01-FIX-REPORT.md`.
> **I3I.2 = PASS · F9-D01 = RESOLVIDO · F9 = PRONTO PARA CONGELAMENTO DO OWNER ·
> CHECKPOINT CANDIDATO = `ad8dd9d3` · F10 = NÃO INICIADO.**
>
> **I3I.2 = ✔ GO DO OWNER (registrado). F9 = CONGELADA @ `ad8dd9d3`.**

## I3J · F10 — EXECUTIVO ▶ ENTREGUE (aguarda owner)
> **GO do owner recebido (F10 somente; F11+ NÃO autorizadas).** **Branch:**
> `impl/light-ui-f10-executivo-1.0.246` de `ad8dd9d3` (HEAD confirmado; worktree limpa) ·
> **checkpoint único `594cf02c`** ("feat(light-ui): port F10 executive golden") ·
> relatório `LIGHT-UI-I3J-F10-EXECUTIVO-REPORT.md` · Golden
> `proposta-c-frame10-executivo.html` (freeze `9de9a6b`; C7 `2516426`; renderizado antes
> de editar). Reauditoria literal: entry `state.tab==='exec'` → `renderExecPanel`;
> agregador PURO `slaExecAggregate` sobre `resolveTaskDisplayState` (fonte única) +
> `visibleTasks` (dados por papel); fórmulas LITERAIS documentadas (KPIs; ranking por
> `execRiskScore`=crít×3+atr×2+lar com desempate carga; % no prazo por concl;
> **atraso médio = média de TODOS os overdue, críticos INCLUÍDOS** — fórmula corrigida
> na fase após prova empírica); filtros/períodos reais (`execApplyFilters`/
> `execWithinPeriod` |fm−now|≤dias); vencimentos por finishMs asc; críticas por
> critical→overdueMs; empty/footers literais; **deep-link NÃO existe na F10 real**
> (nada fabricado; F6 não ampliada); **CSS real EXEC_CSS dark hardcoded injetado por
> JS** (padrão F9) com media real ≤1100px. **Write map: READ-ONLY provado** (0
> Firestore/API; storage novo 0 — só wp_uid/wp_name do saveSession real do auth,
> documentado). Implementação **CSS-only (+51/−0)**: 35 seletores exec-* **35/35
> gated, 0 global, 1 !important justificado** (color inline do KPI Ativas no markup
> real); a11y real preservada (button/select nativos, th, legenda textual) +
> focus-visible; **nenhum nested interactive (provado)**. Smoke **32/32 com PROVA
> MATEMÁTICA** (fixture calibrada no relógio N: 7 ativas; 29%; distribuição 2|1|2|2;
> Felipe risco 6 > Boaz 5; atraso méd 14/19 min; listas ordenadas; filtros um a um +
> combinação; período hoje exclui fm+3d; empty real; coleção vazia sem crash; dataset
> parcial seguro; navegação F9↔F10↔F1 sem vazamento; zero writes). Responsivo
> 1920/1366/**win125** 0 overflow (media real ≤1100 rege). Fidelidade **ISSUE=0 ·
> F10-E0x = NENHUMA** (Golden desenhado sobre o EXEC-CORE real; números do protótipo
> são fictícios — o app prova os reais). Regressão base `ad8dd9d3`: **F1–F9 = 0px**
> (15/17 puro; F5 board+painel só na bbox do sino com **A–E per-superfície** — base×
> base divergiu sozinho; 0px fora) · **legacy 8/8 = 0px puro** (incl. Executivo 3
> temas). Provas F10-EXECUTIVO-{1920, 1920-ALTERNATE, 1366, win125}.png +
> F10-COMPARE-GOLDEN-vs-APP.png no chat (detail real não existe → ALTERNATE = empty
> real, explicado). **Recomendação: GO.**
> **Gate de saída: avaliação do owner. F10 = NÃO congelado. F11 = NÃO INICIADO.**
>
> **I3J = ✔ GO DO OWNER (registrado). F10 = CONGELADA @ `594cf02c`.**

## I3K · F11 — RELATÓRIOS ▶ ENTREGUE (aguarda owner)
> **GO do owner recebido (F11 somente; F12 NÃO autorizada).** **Branch:**
> `impl/light-ui-f11-relatorios-1.0.246` de `594cf02c` (HEAD confirmado; worktree limpa;
> 1.0.246; Light UI inativa) · **checkpoint único `db53881a`** ("feat(light-ui): port F11
> reports golden") · relatório `LIGHT-UI-I3K-F11-RELATORIOS-REPORT.md` · Golden
> `proposta-c-frame11-relatorios.html` (freeze `efb264a4`; C7 `2516426`; renderizado antes
> de editar). Reauditoria literal 50 itens SEM memória: entry `state.tab==='relatorios'` →
> `renderReports`/`afterReports`; pipeline PURO `slaExecReports` = `reportsFilter`
> (execApplyFilters + soAtrasados + concluidas) → `slaExecAggregate({periodo:'all'})` +
> `execPeriodBuckets(repPeriodDays)` (hoje=1·30d=30·**all=30**·senão 7); KPIs literais
> (atrasoMedio=round(mean(overdueMin)); pctNoPrazo concl>0?round:**100**; reincidentes=
> length TOTAL; criticas=totais.critico); reincidência REAL `execTaskLateCount` (history
> atras|overdue|late|to=revisao + overdue→max(c,1); lc≥2, top 12; membership INDEPENDE do
> estado atual — running com 2 hits entra, provado); histórico lc≥1 steps slice(−7) com
> fallback ['enviado',label] e `repStepColor`; **THRESHOLD DO CRÍTICO REPROVADO
> LITERALMENTE: `now>=finishMs+GRACE` em MS BRUTOS, GRACE POR SETOR (`SECTOR_SLA`:
> cronograma/default 10min · edicao_midia 20min)** com boundary provado engine+UI
> (599999ms NÃO crítica com overdueMin=10 · 600000ms CRÍTICA · 600001ms CRÍTICA · 15min
> edicao_midia NÃO crítica apesar de >10 · 25min crítica — subtítulo ">10 min" é texto
> herdado explicado pela lógica real). **Write map: read-only + EXPORT LOCAL ≠ backend
> write** (Firestore/API 0 em toda a bateria incl. exports; storage novo 0). **Export
> auditado byte a byte:** CSV `;` com escaping aspas-duplicadas provado (título com `"` e
> `;`), campo vazio, header/ordem literais, 8 rows; JSON shape 9 chaves/tipos/counts;
> filenames `relatorio-atraso-AAAA-MM-DD.*` + `execDownload` real (Blob) exercido; export
> respeita filtro; **export vazio = '' SEM cabeçalho (literal; texto do empty promete
> cabeçalho — imprecisão herdada documentada)**. **F11-D01 (defeito PRÉ-EXISTENTE
> documentado, NÃO corrigido):** tabela "Atrasos por designer" com header de **5 th** ×
> **7 td** do execDesRow (desalinhamento em produção; o Golden registra a dívida e desenha
> as 7 reais; correção muda markup universal → decisão do owner). F11-E01: `.rep-pbn.z`
> cosmético do Golden sem classe no produto. Implementação: **+45/−2** — seção CSS I3K
> (19 seletores **19/19 gated**, 1 media min-width:1101px preservando a media REAL ≤1100,
> **1 contra-!important escopado** devolvendo a cor inline #F2A93B ao 1º KPI da F11 contra
> o :first-child da I3J) + **a11y mínima nos spans clicáveis REAIS** (toggle/exports:
> role/tabindex/aria-pressed + keyables FOLHA com stopPropagation — invariante F9-D01;
> pixel-inertes provados) — caixa do toggle via ::before (zero markup novo). Smoke
> **48/48** (44 gates do mandato: KPIs 199min/50%/3/6 com recomputo manual; barras
> 0,0,0,0,0,1,7=8 com normalização count/pmax e cores literais; rows
> `Boaz50%005309 min`/`Felipe6100%12116 min` risco 15>8; 7 filtros isolados + combinação
> bm+crítico {5·309min·1 row·barras …,1,4}; navegação F10↔F11↔F9↔F1 sem vazamento; zero
> writes/storage; nested=0; teclado Enter/Espaço com defaultPrevented). Responsivo
> 1920/1366/**win125** 0 overflow (≤1100 rege: KPIs 2col). Fidelidade **ISSUE=0**
> (masonry do Golden = adaptação de apresentação declarada NO próprio Golden; DOM real
> preservado; labels MM-DD do código real vencem o DD-MM desenhado). **Diff audit
> F9-D01: ZERO toque em handlers/DOM F9** (grep nc-*/notif no diff = 0). Regressão base
> `594cf02c`: **F1–F10 = 19 pares, 16 puro 0px** + f3p/f4b/f5b SÓ na bbox do sino
> `(1443,29,1485,71)` com **A–E per-superfície auto-provado** (base×base/cur×cur divergem
> sozinhos; 0px fora) · **legacy 11/11 = 0px PURO** (Relatórios+Executivo+Central 3 temas
> + Detalhes/Agenda dark — atributos a11y pixel-inertes provados). Provas
> F11-RELATORIOS-{1920, 1920-FILTERED, 1920-EMPTY, 1366, win125}.png +
> F11-COMPARE-GOLDEN-vs-APP.png no chat. **Recomendação: GO.**
> **Gate de saída: avaliação do owner. I3J = ✔ GO · F10 = CONGELADA @ `594cf02c` ·
> I3K = ENTREGUE — AGUARDA OWNER · F11 = NÃO CONGELADA · F12 = NÃO INICIADO.**

## I3K.1 · F11 — DEBT HARDENING ▶ ENTREGUE (aguarda owner)
> **HARNESS + AUDITORIA + DOCS ONLY sobre `db53881a` — ZERO mudanças em `desktop/src`**
> (md5 do index.html idêntico ao commit antes/depois; worktree limpa; 1.0.246). Relatório
> `LIGHT-UI-I3K1-F11-DEBT-HARDENING-REPORT.md` (+ relatório I3K atualizado: D02/adendo).
> **F11-D01 fechado objetivamente:** matriz TH×TD provada no DOM — th=5 · td=7; associação
> implícita (sem scope/headers/aria em TODA a tabela): **1/7 correta** (td2 carga sob
> "Atrasadas", td3 pct sob "Críticas", td4 laranja sob "Atraso méd.", td5 atrasadas sob
> "% no prazo"; **td6 críticas e td7 atraso médio = ÓRFÃS**, ambas informação REAL do
> agregador); empty interno `colspan="5"` sob rows de 7; **severidade MEDIUM** (AT recebe
> rótulos errados em 4 colunas + 2 sem rótulo; read-only e valores corretos mitigam).
> **Autoridade literal:** Golden `efb264a4` registra a dívida como nota de auditoria; C7
> `2516426` §21 — "o código segue com o bug até fase FUNCIONAL do owner" — e §22 — "a
> dívida 5×7 é correção FUNCIONAL (thead), nunca 'consertada' só no CSS/visual" — ⇒ **o
> contrato NÃO exige preservar 5×7, apenas registra**; estado-alvo visual aprovado tem 7
> headers. **Opções modeladas (nada implementado):** A manter · **B thead 7 + colspan 7
> (1 linha, zero risco F1–F10/export/sort, corrige 7/7 associações — canônica pelo C7)** ·
> C descartada (execDesRow compartilhado/downgrade) · D headers/aria via afterReports
> (0px, mas visual segue errado) · E CSS-only VETADA pelo §22. **Export vazio →
> F11-D02 (LOW):** copy exata "…a exportação gera um arquivo vazio com cabeçalho" ×
> realidade provada: CSV `''` (0 bytes, SEM cabeçalho) e JSON NÃO-vazio (shape completo,
> 828 bytes; kpis {0,100,0,0}; 7 buckets); botões/handlers ATIVOS no empty. **E01
> permanece só `.rep-pbn.z`.** Boundary reexecutado com constantes literais:
> cron GRACE=600000ms e edicao_midia GRACE=1200000ms — ±1ms provado (false/true/true) com
> display textual IDÊNTICO dos dois lados ("10 min"/"20 min" — critério real é ms-bruto).
> Export hardening: payload byte-idêntico a `toCSV(R.taskRows)`/recomputo JSON; `\n` no
> conteúdo escapado DENTRO de aspas; UTF-8/;;/aspas/zero-rows ok. Zero writes · zero
> storage novo. Evidência da I3K permanece vinculada por hash (nenhuma mudança de
> renderer). **Recomendação: FIX BEFORE FREEZE (I3K.2 = opção B + D02, ~2 linhas) —
> alternativa: ACCEPT DEBT + FREEZE.**
> **Gate de saída: decisão do owner. I3J = ✔ GO · F10 = CONGELADA @ `594cf02c` · I3K =
> ENTREGUE · I3K.1 = HARDENING ENTREGUE — AGUARDA OWNER · F11 = NÃO CONGELADA ·
> CHECKPOINT CANDIDATO = `db53881a` · F12 = NÃO INICIADO.**

## I3K.2 · F11 — D01+D02 SURGICAL FIX ▶ ENTREGUE (aguarda owner)
> **I3K.1 = ✔ GO do owner (FIX BEFORE FREEZE autorizado).** **Branch:**
> `fix/light-ui-f11-d01-d02-1.0.246` DIRETO de `db53881a` (HEAD exato; worktree limpa;
> 1.0.246; NÃO partiu do commit de docs) · **checkpoint único `cdea6da5`**
> ("fix(reports): resolve F11 table headers and empty export copy") · relatório
> `LIGHT-UI-I3K2-F11-D01-D02-FIX-REPORT.md`. **Diff cirúrgico: 1 arquivo, 2 linhas
> (+2/−2), ZERO CSS, ZERO funções** — linha 7001 (copy D02) e linha 7006 (thead+colspan
> D01). **D01 RESOLVIDO:** thead da F11 5→7 com os labels/classes EXATOS da fonte dupla
> inequívoca (Golden `efb264a4` linha 330 ≡ thead REAL da F10 sobre o MESMO execDesRow):
> `Designer·Carga(.c)·% no prazo·Lar.(.c)·Atr.(.c)·Crít.(.c)·Atraso méd.(.c)` + colspan
> do empty interno 5→7; scope não aplicado (não é padrão real). Prova DOM: **th=7 · td=7
> · mapping 7/7 · 0 órfãs · 0 deslocado · colspan=7**; F10 INVARIANTE before×after
> (thead/row0/`execDesRow.toString()` byte-idênticos); rows/sort/valores idênticos.
> **D02 RESOLVIDO:** copy do empty → "…as exportações continuam disponíveis."
> (verdadeira p/ CSV E JSON; preferência funcional do mandato — Golden não tinha
> alternativa verdadeira); mecanismo de export INTOCADO: CSV vazio `''` 0 bytes idem ·
> JSON vazio byte-idêntico · **CSV normal byte-idêntico (===)** · JSON normal
> byte-idêntico exceto `geradoEm` (relógio real do handler) · filenames/MIMEs idênticos.
> **Invariância:** boundary cron 600000ms e edicao_midia 1200000ms ±1ms idênticos;
> KPIs 199min/50%/3/6 idênticos; smoke I3K **48/48** + **27 gates fix** = **75 PASS**;
> a11y 7/7 pela estrutura real (sem ARIA paralela), teclado/nested/focus preservados;
> zero writes/storage. **Visual bounded provado por bbox⊆rect:** populated/1366/legacy
> dark-light-hc SÓ dentro do card da tabela; empty SÓ na linha da copy; win125 0px
> (thead abaixo do fold); **KPIs/filtros/barras/laterais/footer = 0px**. **Regressão
> F1–F10 base `db53881a`: 24/28 = 0px PURO com HARD GATES F10 main+empty = 0px e F9 =
> 0px**; f3b/f3p/f4p/f5b só nas bboxes do sino com A–E auto-provado (0px fora).
> **Golden: D01 → MATCH; D02 → adaptação funcional justificada; fidelity ZERO ISSUE.**
> Provas F11-FIXED-{1920, 1920-EMPTY, 1366, win125, A11Y-TABLE, COMPARE}.png no chat.
> **Recomendação: GO.**
> **Gate de saída: GO do owner p/ congelar. I3K.1 = ✔ GO · D01 = RESOLVIDO · D02 =
> RESOLVIDO · F11 = ENTREGUE — AGUARDA OWNER (NÃO CONGELADA até GO explícito) ·
> CHECKPOINT CANDIDATO = `cdea6da5` · F12 = NÃO INICIADO.**

## I3L · F12 — LOGIN ▶ ENTREGUE (aguarda owner)
> **I3K.2 = ✔ GO do owner. F11 = CONGELADA @ `cdea6da5`.** **Branch:**
> `impl/light-ui-f12-login-1.0.246` DIRETO de `cdea6da5` (HEAD exato; worktree limpa;
> 1.0.246) · **checkpoint único `6a677133`** ("feat(light-ui): port F12 login golden") ·
> relatório `LIGHT-UI-I3L-F12-LOGIN-REPORT.md` · Golden `proposta-c-frame12-login.html`
> (freeze `6e52905`; renderizado antes de editar). Reauditoria A–Q do fluxo REAL:
> `renderLogin`/`doLogin` server-side via main (IPC authLogin → Cloud Run; renderer nunca
> vê hash/token; erros literais mapeados); `startApp` → tab 'hoje' + saveSession
> (wp_uid/wp_name) + sessionLogin; acquireTeamSession fire-and-forget (wp_team_jwt);
> WRITE/AUTH MAP completo — NENHUMA função de auth nova. **HARD GATE A (Enter):** BEFORE
> provado EMPIRICAMENTE = 0 chamadas (zero form/keydown no arquivo) → correção cirúrgica
> autorizada: keydown delegado no #login → click no `.btn` primário real do modo (caminho
> único; preventDefault; disabled durante loading bloqueia repetição). AFTER: mouse=1 ·
> Enter=1 (liId E liPw) · nenhum caminho=2. **HARD GATE B (auth stubada, zero rede):**
> sucesso {payload com trim provado · loading disabled+spinner · rota 'hoje' · authed ·
> sessão} e falha {5 mensagens literais byte a byte · retry · sem falso sucesso}.
> **HARD GATE C (race):** duplo clique=1 · Enter repetido=1 · Enter/click durante busy=0
> extras (bloqueio real disabled+pointer-events). **Implementação:** seção CSS I3L com
> **redefinição de CSS vars NO ESCOPO** `body.light-ui.desktop #login` (nada vaza) —
> **18 seletores 18/18 gated, 0 !important** — card Golden 464px sobre canvas com véu,
> labels C1 sentence-case, focus #6E5EF3, **CTA --lui-grad** (F1 v4 vence gradiente de
> protótipo), banners tint, pill; logo PNG oficial preservada; + markup mínimo
> autorizado PIXEL-INERTE: wrapper `.login-card` (fidelidade estrutural prescrita pelo
> Golden; regra base neutra), labels `for`, autocomplete username/current-password/
> one-time-code, `role="alert"` no banner. **Smoke 27/27** (24 itens do mandato + toggle
> Mostrar-Ocultar + role=alert; N/A literais documentados: sem validação client-side/
> remember-me/SSO/cadastro — ausências provadas no DOM). Responsive 1920/1366/win125
> scrollW==vw; media real ≤660px rege + card compacto gated. **Legacy F12 dark/light/hc
> = 0px PURO** (wrapper/attrs/keydown pixel-inertes provados). **Regressão F1–F11 base
> `cdea6da5`: 32/36 = 0px PURO com HARD GATES F9 pop/det · F10 main/empty · F11
> main/empty = 0px**; f3b/f3p/f4b/f5p só nas bboxes do sino com A–E auto-provado (0px
> fora). Diff audit: 1 arquivo +63/−5; zero toque em F9-D01/F10/F11-D01-D02/SLA/exports/
> routing (greps=0; doLogin só em comentário). Provas F12-LOGIN-{1920, 1366, win125,
> ERROR, LOADING, A11Y-FOCUS}.png + F12-COMPARE no chat. **Recomendação: GO.**
> **Gate de saída: avaliação do owner. I3K.2 = ✔ GO · F11 = CONGELADA @ `cdea6da5` ·
> I3L = ENTREGUE — AGUARDA OWNER · F12 = NÃO CONGELADA até GO explícito ·
> CHECKPOINT CANDIDATO = `6a677133` · F13 = NÃO INICIADO.**

## I3M · F13 — MODAL LEGENDAS E ARTES ▶ ENTREGUE (aguarda owner)
> **I3L = ✔ GO do owner. F12 = CONGELADA @ `6a677133`.** **Branch:**
> `impl/light-ui-f13-legendas-artes-1.0.246` DIRETO de `6a677133` · **checkpoint único
> `899862a2`** ("feat(light-ui): port F13 captions and artwork golden") · relatório
> `LIGHT-UI-I3M-F13-LEGENDAS-ARTES-REPORT.md` · Golden
> `proposta-c-frame13-modal-legendas-artes.html` (freeze `32103bd`; C2 `f9fe31a`;
> renderizado antes de editar). Reauditoria real: `openProductionModal` (bloqueio H16
> completed = toast + ZERO write, provado) → `renderProductionModal` (pilha .pr-list,
> RTE real 'prod', artBox Feed/Story, footer 3 ações) → `saveProduction` (Salvar ≠
> Enviar; H13 sem histórico falso de envio); matriz completa de side effects com
> counts/payloads: upload = ikUpload stubado (folder `/cronogramas/{id}` + fileName
> provados; erro/cancel literais), Salvar = 1 update (patch real capturado: pendências
> recalculadas — opSnap 'aguardando_legenda' com pFeed), double-submit = 1 write
> (closeModal síncrono — dívida "sem disabled" registrada no Golden), Reenviar = 1
> update + 1 set do token {clientReviewToken,clientReviewUrl} + openSendClientModal 1×,
> fechar 3 vias = 0 writes; Escape NÃO fecha (literal). **HARD GATE A:** BEFORE
> empírico = teclado 0 caminhos (input hidden) → correção autorizada: LABEL focável
> (tabindex/role/aria-label) + keydown mínimo → `input.click()` (mesmo picker/change);
> **AFTER com filechooser REAL: mouse=1 · Enter=1 · Space=1**; 1ª técnica (input
> sr-only focável) DESCARTADA pelo gate de legacy (box de form control muda o
> antialiasing do sheet — bissecção provou; abordagem final 100% pixel-inerte).
> Skin: **vars redefinidas no escopo da .pr-sheet** (RTE herda o claro; wizard/F7
> intocado) — **26 seletores 26/26 gated, 0 !important**; CTA reenvio = --lui-grad;
> a11y: role/aria-modal/aria-label na sheet + aria-label no X (padrão das sheets
> reais). **Smoke 21/21.** Responsive 1920/1366/win125 scrollW==vw (lista com scroll
> interno real 56vh). **Legacy deep-state 9/9 = 0px PURO** (host/modal/empty × 3
> temas). **Regressão F1–F12: 29/31 = 0px PURO com TODOS os hard gates (F9 pop/det ·
> F10 m/e · F11 m/e · F12 default/error/loading) = 0px**; f3b/f5b só no sino A–E
> auto-provado (0px fora). Diff audit: 1 arquivo +46/−3; greps=0 em
> login/reports/exec/F9/SLA/exports/saveProduction/ikUpload/routing/storage. Provas
> F13-LEGENDAS-{1920, 1366, win125, EMPTY, A11Y-FOCUS}.png + F13-COMPARE no chat.
> **Recomendação: GO.**
> **Gate de saída: avaliação do owner. I3L = ✔ GO · F12 = CONGELADA @ `6a677133` ·
> I3M = ENTREGUE — AGUARDA OWNER · F13 = NÃO CONGELADA até GO explícito ·
> CHECKPOINT CANDIDATO = `899862a2` · etapa posterior = NÃO INICIADA.**

## I4 · GLOBAL INTEGRATION & RELEASE READINESS ▶ AUDITORIA ENTREGUE
> **Contexto declarado pelo owner na I4: "F1 a F13 concluídos; checkpoint atual `899862a2`"**
> (registro literal). Natureza: auditoria + harness + docs — **ZERO mudança de código**
> (md5 do renderer idêntico a `899862a2` antes/depois; branch de auditoria descartado sem
> commits). Relatório `LIGHT-UI-I4-INTEGRATION-AUDIT-REPORT.md`. **Resultados:** foundation
> consolidado 1466 linhas · 15 seções · **905/905 seletores gated** (863 .desktop + 42
> shell I1/I2) · 43 tokens · balanço 0; **gate de segurança verificado: ZERO
> `classList.add('light-ui')` no produto** (só 3 leituras condicionais — ativação por
> padrão impossível); **integração end-to-end 11/11** (2 voltas × 8 tabs, modais cruzados
> F6/F13, deep-link real F9→F6, bloqueio H16 integrado, filtros preservados, badge=storage,
> consistência exec-kpi F10≡F11, zero writes/storage, nested sweep global=0, zero
> pageerrors próprios); **PROVA DE INÉRCIA inédita: foundation REMOVIDO×PRESENTE sem
> body.light-ui = 0px em 9/9 cenários legados** (7 superfícies dark + HC + legacy-light);
> **smokes das 8 fases re-executados no MESMO commit: 265/265 PASS** (+ chooser 1/1/1).
> **Achados: 0 críticos · 0 altos · M1 Firebase SDK via CDN no boot (pré-existente,
> decisão RC: vendorizar?) · M2 mecanismo de ativação inexistente por design (trabalho da
> RC, com guard rail .desktop — B1) · B2 dívidas herdadas formalizadas (F13 sem validação
> de arte/progress/disabled; F11 críticas com não-crít herdado F10; recovery stub F12;
> Escape não fecha F13) · B3 flake do sino (A–E).** **Veredito: APROVADA COM RESSALVAS ·
> GO CONDICIONADO para RC** — condições são trabalho DA RC (mecanismo de ativação
> controlada + decisões do owner sobre M1/B2); Light UI permanece INATIVA; nenhum
> build/installer/deploy/tag/bump gerado.
> **Estado: I3M = ✔ GO · F13 = CONGELADA @ `899862a2` · I4 = ✔ GO CONDICIONADO (PASS) ·
> RC-0 (I5A) = ver bloco abaixo.**

## I5A · RC-0 — CONTROLLED ACTIVATION GATE + RELEASE DEBT CLOSURE ▶ ENTREGUE (aguarda owner)
> **Mandato do owner (GO explícito).** Base DIRETA `899862a2` · branch
> `rc/light-ui-activation-hardening-1.0.246` · **checkpoint `ae6fc7b0`**
> (`feat(rc): add controlled light-ui activation and release hardening`; 1 arquivo, 34+/11−)
> · relatório `LIGHT-UI-I5A-RC0-ACTIVATION-HARDENING-REPORT.md`. **Entregas:** (A) feature
> flag interna `luiPreview` DENTRO de `idseven.desktop.appearance` (padrão real de
> preferências; default OFF provado em 3 variantes de máquina; opt-in/kill via `appearSet`;
> guard rail `.desktop` fechado + reavaliação na MQ; A1–A6 todos PASS — kill×legacy 0px,
> mecanismo×injeção 0px sob paint igual, first paint sem flash, logout/isolamento no padrão
> do produto); (B) dívidas: **B1 F10/F11 copy verdadeira em 5 pontos** (KPI só critical por
> setor; cards "Atrasos recentes"/"críticas primeiro" — decomposição base+copy×HEAD=0px);
> **B2 F13 saveProduction confiável** (await antes de fechar; busy acessível; falha→retry
> integral; 19/19 gates); **B3 sem mudança** (padrão real: nenhuma sheet fecha com Escape);
> **B4 → RC-D02 STOP** (recovery NÃO implementável sem backend novo — decisão do owner:
> copy honesta / ocultar link / endpoint futuro); **B5 CDN provado em 3 cenários**
> (guard offline F3.5.5C-H1 real: splash honesto + auto-reload; risco M1 aceito com
> fallback; vendorização não aplicada); (C) QA com mecanismo REAL: smokes 265/265 + 62
> gates novos · navegação global 15/15 × 3 viewports · write map: única escrita nova =
> campo `luiPreview` (só em `appearSet` explícito) · a11y nested=0 · F9-D01 ok; (D) legado
> OFF base×HEAD: byte-idêntico fora das 5 strings B1 (decomposição 0px; 12×0px estrito);
> (E) F1–F13 flag ON: 24×0px + 3 copy-proven + sino via política A–E (f4main provado
> não-determinístico por base×base na bbox conhecida). **Veredito: I5A = GO. RC
> tecnicamente autorizável (SIM), condicionada às decisões do owner: RC-D02 (recovery) +
> aceite M1.**
> **Estado: I5A = HOLD — NO-GO do owner para congelamento (superseded pela I5A.1 closure) ·
> `ae6fc7b0` = candidato histórico, não congelado.**

### I5A.1 · RC-0 CLOSURE ▶ ENTREGUE (aguarda owner)
> **Mandato do owner (GO explícito) — fechamento cirúrgico dos 2 gates do NO-GO da I5A.**
> Base `ae6fc7b0` verificada (ancestral `899862a2`) · **checkpoint `dcc019ca`**
> (`fix(rc): close login recovery and win125 gates`; 1 arquivo, 7+/20−, 6 hunks todos no
> bloco LOGIN UI) · relatório `LIGHT-UI-I5A1-RC0-CLOSURE-REPORT.md`. **Decisões formais do
> owner registradas: M1/CDN = ACEITO PARA 1.0.246** (sem vendorização; vendorization =
> dívida pós-1.0.246) · **A4 per-machine = ACEITO para RC/preview interno** (default OFF,
> sem UI pública, kill switch; exposição pública = nova decisão) · **RC-D02 = REMOÇÃO do
> stub autorizada.** **Entregas:** (1) **RC-D02 = RESOLVED** — fluxo "Esqueci minha senha"
> removido semanticamente (botão + modos forgot + handlers btnFreq/btnResend/btnFconf +
> listener [data-mode] + estado; zero handler órfão acessível; troca de senha real do
> perfil intacta; smoke F12 29/29 com gates novos g25 recovery-target=0 e g26 tab order
> limpa); (2) **WIN125 = PROVADO NO CENÁRIO CONGELADO EXATO** (CSS 1093×614 @ dsf 1.25,
> mecanismo real: navegação 15/15 + login 6/6, zero overflow; evidências
> I5A1-WIN125-1093x614-dsf125-*.png no chat); (3) regressão: F12 bounded à região
> autorizada do card em 7 cenários (3 temas legacy + light default/error/loading/focus;
> decomposição trivial — diff = só o removal), 12 superfícies críticas 0px estrito, smokes
> f9 28 · f10 32 · f11 48 (copies B1 mantidas) · f13 21 + chooser (B2 mantido 19/19),
> activation recheck 5/5 + 17/17 (flag intacta). **Veredito: I5A.1 = GO · RC Build
> tecnicamente autorizável (SIM).**
> **Estado: I5A.1 = ✔ GO (owner) · RC-0 SOURCE FROZEN @ `dcc019ca`.**

### I5B · RELEASE CANDIDATE BUILD ▶ ENTREGUE (aguarda owner)
> **Mandato do owner (GO explícito) — primeiro artefato executável/instalável do RC a partir
> do source congelado `dcc019ca`.** Relatório `LIGHT-UI-I5B-RC-BUILD-REPORT.md`. **Pipeline
> npm OFICIAL** (`npm ci` 386 pkgs lockfile intocado → `npm run build` tsc strict exit 0 →
> `electron-builder --win nsis --publish never`): **NSIS x64 GERADO —
> `Agenda-ID-Seven-Desktop-1.0.246-x64.exe` · 82 618 621 B · SHA-256
> `82576b18209dcc420968506a5e2d53245f136eef04107ebec6f3e781ac493f35` · UNSIGNED TEST RC
> (sem code-sign POR DESIGN do projeto)** + blockmap + latest.yml (sha512/size conferem).
> **Integridade fechada:** package.json empacotado=1.0.246; renderer do asar BYTE-IDÊNTICO à
> fonte `dcc019ca`; flags do updater na ordem exigida; RC-D02=0 no asar; payload de DENTRO
> do instalador == asar do build; source imutável (SHA `bd5001b1…` pré==pós). **Boot do
> PACOTE provado** (asar do artefato + Electron 31.3.1 do lockfile, userData isolado):
> janela/título/versão 1.0.246 via preload real, splash/login reais, **DEFAULT OFF absoluto
> em perfil limpo**, ON pelo mecanismo real com reload persistente, kill switch íntegro,
> F1/F8/F9/F10/F11/F12/F13 sem erro/overflow, **Win125 no pacote (dpr 1.25 · CSS ~1093)**,
> guard CDN honesto, zero write real, zero chave nova de storage, zero segredo em
> logs/artefatos. **RC-B01 (ambiental):** MSI requer Windows/WiX — coberto pelo CI oficial
> `windows-latest`; install/uninstall do NSIS em Windows real + MSI + CDN em rede aberta =
> conteúdo da I5C. **Veredito: I5B = GO — RC apto a seguir para I5C (SIM).**
> **Estado: I5B = ✔ GO (owner).**

### I5C · RC ACCEPTANCE & FINAL QA ▶ ENTREGUE — **NO-GO (blockers ambientais; zero defeito de código)**
> **Mandato do owner (GO explícito). ZERO modificações de source** (regra central cumprida;
> HEAD segue `dcc019ca`; SHAs renderer/lockfile idênticos à I5B; nenhum commit de produto).
> Relatório `LIGHT-UI-I5C-RC-ACCEPTANCE-REPORT.md`. **QA executável = 68/68 efetivos sobre o
> MESMO binário da I5B (hashes re-verificados):** boot/versão/IPC · default OFF absoluto ·
> ON controlado + reload · kill + reopen A-C persistentes · global flow 2 voltas (F1/F6/F7
> wizard caminho completo/F8/F9/F10/F11) · **RC-D02 dinâmico com auth REAL do pacote**
> (blank local, busy determinístico, erro de rede honesto, retry, nunca authed falso) ·
> **F13 B2 completo no pacote** (busy/await/falha mantém modal+conteúdo/retry grava) ·
> 1920+1366+Win125 · CDN blocked honesto · storage sem chave nova · security limpa ·
> perf sanity ok. **BLOCKERS FORMAIS (decisão do owner):** **RC-A01** — ambiente Windows
> real INDISPONÍVEL na sessão (Linux): pipeline `windows-latest`, NSIS install/uninstall/
> reinstall, MSI (RC-B01) e first-boot do INSTALADO inexecutáveis; workflows oficiais não
> disparáveis para o RC por construção (gate de versão 1.0.183 no canônico; gate de branch +
> isolamento vs 1.0.245 no f356bh2) e alterá-los/criar novo = vedado pela regra central.
> **RC-A02** — CDN normal inexecutável (proxy 403 gstatic). **Roteiro sugerido ao owner
> (fecha tudo):** em Windows real: `git checkout dcc019ca && cd desktop && npm ci && npm run
> dist` → instalar NSIS → versão/OFF/ON/kill → uninstall/reinstall → MSI → 1 boot em rede
> aberta (CDN normal); OU autorizar fase corretiva mínima (workflow RC dedicado).
> **Veredito: I5C = NO-GO · "RC aprovado para RELEASE FINAL?" = NÃO (ainda não — gates de
> ambiente abertos; nenhuma reprovação de produto).**
> **Estado: I5C = ENTREGUE — AGUARDA OWNER · RC SOURCE = `dcc019ca` (imutável) ·
> NSIS I5B = artefato de referência (hash `82576b18…`) · M1 = ACCEPTED · TAG = NÃO ·
> GITHUB RELEASE = NÃO · DEPLOY = NÃO · BUMP = NÃO · RELEASE FINAL = NÃO INICIADA.**

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
