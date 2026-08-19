# LIGHT UI — IMPLEMENTATION ROADMAP (trilha nova · I0…I12)

**Natureza:** roadmap TÉCNICO da implementação do Design Freeze. O Design Closure (R1–R11) está
FINALIZADO/FROZEN e **não é reutilizado** — esta trilha começa do zero com nomenclatura própria.
**Estado:** **I0 = ENTREGUE — aguarda owner. I1+ = NÃO INICIADAS. IMPLEMENTAÇÃO = PROIBIDA até
o GO da I0** (zero branch, zero código, zero CSS, zero build, zero deploy).

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

## I0 · IMPLEMENTATION PRE-FLIGHT & BASELINE REAUDIT — ▶ ENTREGUE (aguarda owner)
Auditoria read-only completa: Desktop mais recente identificada e provada (= 1.0.246, tip
`a4312c57`, tag v1.0.246, release Latest); **drift funcional 1.0.246→atual = ZERO** (renderer/
main/preload/auth byte-idênticos; zero commits novos); mapa 30/30 vigente; F1–F13/B/C1–C8 sem
drift; token table, guardrails responsivos mapeados a alvos reais, blockers a11y, arquitetura do
renderer (monólito 13.034 linhas com `:root` tokens + **mecanismo de aparência REAL:
`applyAppearance()` com `body.light`/`body.hc`/zoom de fonte**), estratégia de tema (classe
técnica paralela via pipeline existente), metodologia de teste, fluxos P0, base recomendada
(`a4312c57`). Docs: `LIGHT-UI-BASELINE-REAUDIT.md` + este roadmap +
`LIGHT-UI-IMPLEMENTATION-TOKENS.md`. **Gate de saída:** GO do owner.

## I1 · FOUNDATION — TOKENS & THEME RAIL (primeira fase com código; branch novo)
Criar branch `desktop/light-ui-i1-foundation-tokens` a partir de `a4312c57`. Introduzir bloco
`<style id="light-ui">` (fim do head) + classe técnica **`body.light-ui`** aplicada pelo
pipeline `applyAppearance()` sob flag técnica INTERNA (não exposta; owner decide exposição na
I12). Re-declarar sob `.light-ui` os tokens canônicos (TOKENS doc §2): canvas/surface/hairlines/
tx-1..tx-4′/inks/brand/grad′/radius/shadows/focus. Incluir desde já: aria-live no flashToast
(D17) e toast X hit 28×28 (E10) — mudanças globais de baixo risco. **Gate:** app dark intacto
com flag OFF (screenshot diff = zero); com flag ON só cores mudam; smoke P0 1–13.
**Dependências:** GO da I0. **Risco:** baixo.

## I2 · CORE SHELL — SIDEBAR · HEADER · CANVAS
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
