# LIGHT UI — IMPLEMENTATION ROADMAP (trilha nova · I0…I12)

**Natureza:** roadmap TÉCNICO da implementação do Design Freeze. O Design Closure (R1–R11) está
FINALIZADO/FROZEN e **não é reutilizado** — esta trilha começa do zero com nomenclatura própria.
**Estado:** **I0 = ✔ GO · I1 = ✔ GO · I2 = técnica PASS, NÃO FECHADA (owner) · I2.1 =
▶ ENTREGUE (gate final da I2; aguarda owner) · I3+ = NÃO INICIADAS.**
Branches: `impl/light-ui-foundation-1.0.246` (I1, `0dc87ccb`, ✔ GO) →
`impl/light-ui-core-shell-1.0.246` (I2, `6a4ea142`) →
`impl/light-ui-core-shell-refine-1.0.246` (I2.1, `c368a6c2`).
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
> **Gate de saída: GO do owner (fecha I2+I2.1).**
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
