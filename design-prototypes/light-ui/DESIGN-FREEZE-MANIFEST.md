# DESIGN FREEZE MANIFEST — LIGHT UI · AGENDA ID SEVEN

**Função:** documento final de fechamento do Design Closure Roadmap (R1–R11).

# ★ DESIGN COMPLETO — DECLARADO PELO OWNER
**Declaração registrada no R11 em 19/08/2026**, após revalidação read-only dos Gates 1–11
(todos PASS; provas no relatório R11 e na closure matrix §14). Autorização explícita do owner
no mandato R11. **Esta declaração fecha exclusivamente o DESIGN — NÃO autoriza implementação**
(desktop/src, build, deploy, release, PR de produção, Firebase/Firestore/Functions/Worker/
Electron/updater seguem intocados e proibidos). A futura implementação terá mandato e roadmap
próprios, aprovados separadamente pelo owner.

## 1 · SCOPE
Redesign visual Light UI da Desktop "Agenda ID Seven": 13 Frames A Golden + 8 foundations
(C1–C8) + 6 superfícies B com specs aplicadas + validação responsiva + acessibilidade de design
com errata canônica. **Fora do escopo:** produção (desktop/src, Firebase, Worker, build/release),
Client Portal (trilha separada), janelas Electron A-futuras (gated), funcionalidade nova.

## 2 · DESIGN VERSION / BASE
- Base funcional auditada durante TODO o redesign: **Desktop 1.0.246**
  (`desktop/f356bh2-workflow-notifications-premium-1.0.246`; renderer 13.034 linhas + main/preload).
- Branch de design: `design/f356b-light-ui-mockups` · trilha: 42 commits (`ed11c08`→`363d221`)
  + o commit desta R10.
- Estética Golden: canvas `#F5F6F9` · surface `#FFF` · sidebar petróleo 284px (`#252B3D→#1B2031`)
  · header 92px · Inter/InterTight · ícones stroke 1.7 · radius 8/12/16/999 · sh-1/sh-2 ·
  brand `#5B7CFA` · grad `135deg #6E5EF3→#8356E6` (stop 2 pela errata E4).

## 3 · FRAMES GOLDEN (A · 13 — congelados)
| Frame | Arquivo | Commit |
|---|---|---|
| F1 Meu quadro (V10) | `proposta-c-v10-premium-frame1.html` | `e7107e3` |
| F2 Cliente | `proposta-c-frame2-cliente.html` | `45721bc` |
| F3 Designers | `proposta-c-frame3-designers.html` | `b5842bc` |
| F4 Social Medias | `proposta-c-frame4-socialmedias.html` | `66d9a6a` |
| F5 Setores | `proposta-c-frame5-setores.html` | `c0c83f4` |
| F6 Detalhes | `proposta-c-frame6-detalhes.html` | `9644d94` |
| F7A/B/C/D Nova tarefa | `proposta-c-frame7a…7d…html` | `ea485c2` · `c0cb413`+V2 `5d2b10d` · `7361f92` · `e18d9f7`+V2 `755eee6` (checkpoint `f5d1909`) |
| F8 Agenda | `proposta-c-frame8-agenda.html` | `96fd7d3` |
| F9 Central de Notificações | `proposta-c-frame9-notificacoes.html` | `8173940` |
| F10 Executivo | `proposta-c-frame10-executivo.html` | `9de9a6b` |
| F11 Relatórios | `proposta-c-frame11-relatorios.html` | `efb264a` |
| F12 Login (standalone) | `proposta-c-frame12-login.html` | `6e52905` |
| F13 Modal Legendas e artes | `proposta-c-frame13-modal-legendas-artes.html` | `32103bd` |

**A-futuras GATED (3 — não bloqueiam o closure; só skin com GO específico, contrato funcional
congelado):** Notificação externa premium (`bgnotify`) · Lembrete central SLA (`slareminder`) ·
Check-in de execução.

## 4 · FOUNDATIONS (C1–C8 — todas OFICIAIS, GO do owner)
| Cn | Contrato | Status | Commit |
|---|---|---|---|
| C1 Forms & Controls | `C1-FORMS-CONTROLS-CONTRACT.md` | OFICIAL / **GOLDEN COMPLETA no escopo real** (exclusões formais: radio·multi-select·paginação·skeleton·validation-summary inexistentes) | R2 `3c06c26` |
| C2 Modais & Sheets | `C2-MODALS-SHEETS-CONTRACT.md` | OFICIAL / **GOLDEN DOCUMENTAL** (nomenclatura mantida por decisão) | R3 `f9fe31a` |
| C3 Menus/Popovers | `C3-MENUS-POPOVERS-CONTRACT.md` | OFICIAL / GOLDEN (gap visual fechado na R5.1) | R5 `7aba3fa` + R5.1 `5959ae0` |
| C4 Empty States | `C4-EMPTY-STATES-CONTRACT.md` | OFICIAL / GOLDEN | R5 `7aba3fa` |
| C5 Loading/Splash | `C5-LOADING-SPLASH-CONTRACT.md` | OFICIAL / GOLDEN | R5 `7aba3fa` |
| C6 Toasts/Errors | `C6-TOASTS-ERRORS-CONTRACT.md` | OFICIAL / GOLDEN (gap visual fechado na R5.1; X hit 28×28 pela errata E10) | R5 `7aba3fa` + R5.1 `5959ae0` |
| C7 Tabela | `C7-TABLE-CONTRACT.md` | OFICIAL / GOLDEN | R4 `2516426` |
| C8 Estados de Interação & stat-tile | `C8-INTERACTION-STATES-CONTRACT.md` | OFICIAL / GOLDEN (+ regra global accent×ink pela errata E7) | R6 `b2f6833` |

## 5 · SUPERFÍCIES B (6 — SPEC APLICADA / APROVADA R7 `4b72d08`; nenhuma vira Frame A)
Prioridades · Hoje · Hub/quadros por pessoa · Equipe · Perfil · Configurações —
`B-SURFACES-APPLIED-SPECS.md` (matriz foundation×superfície 100%).

## 6 · RESPONSIVE (R8 = GO `1b7210c`)
- **Validado (escopo exato e ÚNICO declarado): 1920×1080 · 1366×768 @1× · Windows 125%**
  (1093×614 DIP @ DSF 1.25). NÃO declarado: 200% zoom, outras resoluções, mobile.
- Doc: `R8-RESPONSIVE-VALIDATION.md` (metodologia Playwright/CDP honesta; 18/18 PASS).
- **Guardrail P0 (fonte única = `R8-RESPONSIVE-VALIDATION.md` §12 item 1; contracts apenas referenciam):** `min-width:0` em `.main>*`, `.hd>*`, `.page>*`
  e itens de grid/flex equivalentes — sem isso o shell corta Monitor SLA/sino/toolbar a 1093 DIP.
- **Reflow rules canônicas (R8 §6):** F1 kanban scroll-x controlado + drawer overlay em viewport
  menor · F6 3→2 colunas + timeline scroll-x controlado · F7C scroll interno + footer persistente
  · F8 reflow calendário/painel do dia · F9 filtros wrap · F10 KPIs auto-fit + toolbar wrap ·
  F11 overflow-x controlado no card da tabela quando necessário · F12 media real
  `max-height:660px` · F13 sheet ≤94vw/88vh + corpo rolável.

## 7 · ACCESSIBILITY (R9 = GO `d927c01`)
`ACCESSIBILITY-CONTRACT.md` = spec oficial (30 seções): comprovado × requirement × dívida;
keyboard/focus/semântica/ARIA com linhas do renderer; matriz global; axe-core 4.13.0 registrado;
zoom: só DPI 125% validado (200% fora de escopo, declarado).

## 8 · ERRATA (R9.1 = GO `363d221` — CANÔNICA)
`ACCESSIBILITY-TOKEN-ERRATA.md` E1–E11: tx-3′ `#697181` (4.91/4.54) · tx-4′ `#6E7786`
(4.52 + regra de superfície) · brand-ink `#4353D8` (6.06) · grad stop 2 `#8356E6` (4.73) ·
sla-k→green-ink (5.01) · sb-faint′ `#828AA8` + topo→sb-dim · regra accent×ink (inks 5.02–7.02) ·
sólidos com branco → ink · borda de input mantida com justificativa técnica · toast X hit 28×28 ·
dots do calendário cor+forma+legenda. **Regra formal:** a implementação segue CONTRACTS ATUAIS +
ERRATA CANÔNICA — **NUNCA extrair cores dos screenshots Golden históricos** (são registro de
aprovação, não fonte de valores).

## 9 · FUNCTIONAL DEBTS (registradas, FORA do redesign — fase funcional futura)
Fonte: notes por frame + `ACCESSIBILITY-CONTRACT.md` §28 (IDs A11Y-D01–D25 sem duplicação).
Principais (origem · natureza · impacto · fase): `alert()`×34/`confirm()`×2 nativos (UX de
feedback; futura) · thead 5×7 do relatório real (F11; dado x coluna; futura) · Enter não submete
login (D02) · priCard div sem teclado (D03) · nc-row/nc-open divs (D04) · labels sem for/id
(D12) · flashToast sem aria-live (D17) · modais genéricos sem role/trap (D19) · tabelas sem
scope/caption (D20) · menus sem arrows (D16) · aria-selected/current/pressed ausentes (D15) ·
forced-colors inexistente (D22) · ícones sem nome em parte dos casos (D23) · reduced-motion
parcial (D21). Nenhuma corrigida no redesign (regra); nenhuma bloqueia o DESIGN closure.

## 10 · IMPLEMENTATION GUARDRAILS (bloqueiam a FUTURA implementação ser declarada pronta)
1. **P0 — upload F13 acessível por teclado (A11Y-D01)**: input focável + Enter/Espaço + anúncio.
   *Não impede o fechamento do DESIGN (contrato §22 da a11y já especifica o correto), mas é
   BLOCKER da implementação.*
2. `min-width:0` no shell (guardrail R8).
3. Enter submete login · priCard/nc-row com teclado (D02–D04).
4. Labels associados + aria-invalid/describedby (D12/§10).
5. Toast X hit ≥24 (errata E10) · aria-live no flashToast (D17).
6. Foco visível universal + modais com foco/trap/retorno/role (D19).
7. Semântica selected/current/pressed por componente (D15/§9) · tabelas scope/caption (D20).
8. Reduced-motion transversal (D21) · **input border:** se na implementação final a borda for o
   ÚNICO identificador do limite do campo, o contraste não-textual precisa atender o requisito
   aplicável OU outro indicador visual suficiente deve cumprir essa função (hoje: label +
   placeholder + shape + focus ring — justificativa E9).

## 11 · SOURCE OF TRUTH HIERARCHY (ordem de precedência para a implementação)
1. **CONTRACTS/SPECS aprovados mais recentes** (C1–C8 · B-SURFACES · anexos R2/R5.1);
2. **ACCESSIBILITY-TOKEN-ERRATA (canônica)**;
3. **R8-RESPONSIVE-VALIDATION + guardrails**;
4. **Golden Frames** (composição visual);
5. **Desktop 1.0.246** (fidelidade funcional BASE).

**REGRA GLOBAL: código mais recente = fonte FUNCIONAL · Golden/contracts = fonte VISUAL.**
A implementação pode ocorrer sobre código posterior à 1.0.246 ⇒ antes de implementar,
**reauditar o código real MAIS RECENTE** e preservar qualquer função aprovada adicionada após
a 1.0.246 (a implementação Light NÃO pode reverter funcionalidade nova). Conflito visual ×
funcional ⇒ **PARAR → REPORTAR → OWNER DECIDE**.

## 12 · CANONICAL FILES (ownership por domínio)
| Domínio | Fonte canônica |
|---|---|
| Cobertura de superfícies (30/30) | `MASTER-SURFACE-MAP.md` |
| Sequência/status das fases | `DESIGN-CLOSURE-ROADMAP.md` |
| Componentes/foundations | `C1…C8-*-CONTRACT.md` |
| Superfícies B | `B-SURFACES-APPLIED-SPECS.md` |
| Responsividade | `R8-RESPONSIVE-VALIDATION.md` |
| Acessibilidade | `ACCESSIBILITY-CONTRACT.md` |
| Tokens corrigidos | `ACCESSIBILITY-TOKEN-ERRATA.md` |
| Handoff/closure | `DESIGN-FREEZE-MANIFEST.md` (este) |
| Histórico/decisões | `REFINEMENT-NOTES-C.md` (**NÃO** é source-of-truth principal) |
| Históricos da fase de propostas | `TOKENS.md` · `README.md` · `COMPARISON.md` · `RESEARCH-NOTES.md` (marcados) |
| Backlog futuro (não-contrato) | `LIGHT-UI-FUTURE-UX-BACKLOG.md` |

**Classificação dos protótipos (nenhum deletado — preferência por preservar histórico):**
- **CANONICAL (16):** 13 Golden A (§3) + `r2-c1-completion-estados.html` +
  `r5-1-transversal-anatomy-board.html` + `r9-1-accessibility-token-closure.html`.
- **VALIDATION (18):** `r8-responsive/` ×9 · `r9-1-regression/` ×9 (cópias; nunca Golden).
- **HISTORICAL/INTERMEDIATE (12):** `proposta-a-…` · `proposta-b-…` · `proposta-c-creative-studio`
  · `proposta-c-refinada-v2/v3/v4` · `proposta-c-v5…v9` (iterações pré-V10; registro).
- **Assets:** `_fonts.css` (local) · `_avatars.css` (DiceBear micah CC BY 4.0, sintético) ·
  `_team-photos.css` (LOCAL-ONLY, gitignored — nunca versionar).
- **Órfãos/lixo acidental:** NENHUM encontrado.
- **PNG POLICY (reconfirmada):** screenshots de validação/entrega NÃO ficam no Git — entregues
  no chat; pranchas/protótipos HTML são versionados.

## 13 · COMMIT MATRIX (SHAs reais do branch)
| Entrega | Commit |
|---|---|
| Propostas A/B/C (início da trilha) | `ed11c08` |
| Iterações V2–V9 (históricas) | `e96258e`…`dc127bd` |
| F1 V10 | `e7107e3` · F2 `45721bc` · F3 `b5842bc` · F4 `66d9a6a` · F5 `c0c83f4` |
| Master Map inicial | `0467d38` · F6 `9644d94` |
| F7A `ea485c2` · F7B `c0cb413` (V2 `5d2b10d`) · F7C `7361f92` · F7D `e18d9f7` (V2 `755eee6`) · checkpoint F7+C1 `f5d1909` |
| F8 `96fd7d3` · F9 `8173940` · F10 `9de9a6b` · F11 `efb264a` · F12 `6e52905` · F13 `32103bd` |
| R1 Checkpoint Global | `44fe256` |
| R2 `3c06c26` · R3 `f9fe31a` · R4 `2516426` · R5 `7aba3fa` · R5.1 `5959ae0` · R6 `b2f6833` |
| R7 `4b72d08` · R8 `1b7210c` · R9 `d927c01` · R9.1 `363d221` |
| R10 Final cleanup | `329cc35` |
| R11 Design Complete Declaration | commit desta entrega (declare design complete and freeze) |

## 14 · CLOSURE MATRIX
| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | Frames A Golden | **PASS** | §3; mapa banner; commits |
| 2 | B specs aprovadas | **PASS** | §5; R7 GO |
| 3 | C1–C8 oficiais | **PASS** | §4; GOs R2–R6 |
| 4 | Component states cobertos | **PASS** | R2 prancha + C8 + R5.1 |
| 5 | Responsividade mínima validada | **PASS** | R8 GO; 18/18; escopo §6 |
| 6 | A11y de design especificada | **PASS** | R9 GO; contract 30 seções |
| 7 | Errata de contraste aprovada | **PASS** | R9.1 GO; canônica |
| 8 | Master Surface Map 30/30 | **PASS** | §A do mapa (1–30, cada uma 1×); soma 13+3+6+7+1 |
| 9 | Dívidas separadas do redesign | **PASS** | §9/§10; a11y §28 |
| 10 | Branch limpo | **PASS** | 42 commits 100% em design-prototypes/light-ui; zero produção/segredo/foto real |
| 11 | Source-of-truth definida | **PASS** | §11/§12 |
| 12 | Owner declarar DESIGN COMPLETO | **✔ DECLARADO (R11 · 19/08/2026)** | mandato R11 do owner; Gates 1–11 revalidados PASS |

## 15 · FUTURE IMPLEMENTATION PRE-FLIGHT (registro; NADA executado)
Antes do primeiro commit de produção, a futura fase de implementação DEVE:
1. Atualizar a base para a versão Desktop MAIS RECENTE (não a 1.0.246);
2. Reauditar funções adicionadas após a 1.0.246 (diff funcional completo);
3. Confirmar que nenhuma função Golden-aprovada foi removida/alterada (conflito ⇒ owner);
4. Criar branch de implementação PRÓPRIO (nunca sobre o branch de design);
5. Preservar rollback (releases pinadas; tema atual intacto até GO de rollout);
6. Mapear os tokens canônicos (§8 + C1) para variáveis reais do renderer;
7. Aplicar a errata a11y (E1–E11) desde o primeiro componente;
8. Aplicar os guardrails responsivos R8 (§6);
9. Aplicar os implementation a11y guardrails (§10 — P0 upload primeiro);
10. Planejar rollout incremental (superfície a superfície; sem big-bang).
*A estratégia de release completa NÃO está definida aqui — a fase de implementação terá mandato
próprio.*

## 16 · DESIGN FREEZE (statement final — R11)
O Light UI do Agenda ID Seven está formalmente:

# DESIGN COMPLETE + DESIGN FROZEN

**Significa:** composição visual aprovada (13 Frames A Golden) · foundations aprovadas (C1–C8
oficiais) · B specs aprovadas (6) · responsividade mínima validada (1920×1080 · 1366×768 ·
Windows 125% — somente esse escopo) · acessibilidade de design fechada (R9/R9.1) · errata
canônica · mapa 30/30 completo.

**NÃO significa:** implementação pronta · código alterado · release aprovado · produção migrada.
Qualquer alteração de design a partir daqui exige reabertura explícita pelo owner. A
implementação futura segue o pre-flight (§15) sob NOVO mandato — o Design Closure Roadmap
termina aqui (não existe "R12" automático).
