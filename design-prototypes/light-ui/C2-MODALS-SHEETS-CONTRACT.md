# C2 — MODAIS & SHEETS · FOUNDATION CONTRACT (Light UI)

**Status:** CONSOLIDADA DOCUMENTALMENTE (R3) — **aguarda avaliação do owner; NÃO declarada
concluída.** Fonte funcional auditada: Desktop **1.0.246** (renderer completo — não apenas F13).
Branch: `design/f356b-light-ui-mockups`. Zero produção; zero imagem nova nesta fase.
Taxonomia formal: `MASTER-SURFACE-MAP.md` §F ("C2 — Modais & Sheets").

## 1 · OBJETIVO
Congelar o contrato visual/estrutural dos modais e sheets REAIS do produto no Light UI Golden,
a partir das âncoras aprovadas (F13 · R2) e da auditoria integral do renderer. **Não cria um
sistema modal novo; não redesenha modais aprovados; não fabrica variantes de biblioteca.**

## 2 · ESCOPO
Tudo que renderiza em `#modalRoot` (`.modal-back > .sheet`) + os 2 containers modais PRÓPRIOS
reais fora dele (team-session `ts-auth-back`; "Editar prazo" `slaedit-ov` do Monitor SLA).
**Fora do escopo:** diálogos NATIVOS (`alert()`/`confirm()` — ex.: validação global do wizard e
"Limpar histórico" da Central), menu nativo Electron, menus/popovers CSS (→ **C3**), drawer
lateral dos boards (padrão Golden próprio dos F1–F5) e as **A-futuras gated** (bgnotify ·
lembrete SLA · check-in = janelas Electron `BrowserWindow` — trilha própria, intocadas).

## 3 · INVENTÁRIO REAL (20 modais/sheets — auditoria integral; mapa citava o conjunto sem exaustão)
| # | Modal/Sheet | Função (linha) | Container | Tipo estrutural | Ações reais | Notas de estado |
|---|---|---|---|---|---|---|
| 1 | Trocar senha | `openChangePasswordModal` 3198 | modalRoot · sheet 420 (keep) | Form | Cancelar · Salvar nova senha | erro inline `cpErr` (literais reais) |
| 2 | Alterar e-mail (self) | `openChangeEmailModal` 3247 | modalRoot · sheet 440 (keep) | Form | Cancelar · Solicitar alteração | erros `_ceMsg` literais |
| 3 | Alterar e-mail (admin) | `openAdminEmailModal` 3278 | modalRoot · sheet 460 (keep) | Form | Cancelar · confirmar (literal "ALTERAR EMAIL") | gate admin server-side |
| 4 | Novo/Editar compromisso | `openEventForm` 5919 | modalRoot · **ev-sheet 720** | Form | Cancelar? · salvar (`data-evsave`) | save = "Salvando…" + busy (5950) |
| 5 | Detalhes do compromisso | `openEventDetail` 6016 | modalRoot · **evd-sheet 560** | Detail + ações por estado | Iniciar/Finalizar/Cancelar/Editar/Excluir/Fechar | **role=dialog+aria-modal+aria-label+foco inicial+trap Tab** (`evdSetupModalFocus`); menu interno "Mais opções" (role=menu → interseção C3); confirmação em 2 ETAPAS INLINE ("Sim, cancelar"/"Excluir definitivamente" danger); erro inline `evd-err role=alert`; Excluir SÓ admin |
| 6 | Mover tarefa | `openMove` 8229 | modalRoot · sheet | Selection (status) | chips de status + itens por conteúdo (`data-wfitemdone`) | gates reais: slaGuard + pós-conclusão bloqueado (toast) |
| 7 | Central de Detalhes da tarefa | `openDetails` 8415 | modalRoot · **det-sheet 1240×92vw · 88vh flex** | Detail GRANDE (corpo interno rola) | ações da tarefa | **trap Tab + foco inicial + RETORNO DE FOCO no close** (F3.5.4W `_detReturnEl`); preserva rascunho de observação em re-render |
| 8 | Corrigir conteúdo (item) | `openItemFix` 8907 | modalRoot · sp-sheet 560 | Workflow | ações do fluxo | header selo+título+sub |
| 9 | Escolher designer | `openDesignerModal` 8976 | modalRoot · dz-sheet | Selection | lista/ação | centrada |
| 10 | Prazo do designer | `openDesignerDeadline` 9090 | modalRoot · dz-sheet | Form | confirmar | par com o nº 9 |
| 11 | Editar conteúdos | `openContentEditor` 9134 | modalRoot · ce-sheet 580 | Form/Workflow | salvar/fechar | temas/legendas |
| 12 | **Legendas e artes** | `renderProductionModal` 9221 | modalRoot · **pr-sheet 680** | Production | Cancelar · **Salvar** · **Salvar e reenviar ao cliente** | **ÂNCORA GOLDEN F13** `32103bd`; lista interna 56vh + scrollTop preservado |
| 13 | Enviar ao cliente (grupo) | `openSendClientModal` 9532 | modalRoot · **gcs-sheet 640** | Workflow/preview | Abrir WhatsApp · opção avançada · X | gates: pós-conclusão ZERO write; token ANTES do modal (aborta com toast se falhar); URLs técnicas só no clique; **envio só é real na confirmação posterior** (Worker) |
| 14 | Remover tarefa | `openDeleteConfirm` 10195 | modalRoot · **del-sheet 440** | Confirmation DESTRUTIVA | Cancelar · **Remover tarefa** (danger) | **ÂNCORA R2**; literais congelados; erro pós = alert |
| 15 | Conta / Segurança / Sobre | `openSheet(which)` 10539 | modalRoot · sheet 480 | Detail read-only (infoline) | Alterar e-mail / Trocar senha / **Sair da conta** (tint vermelho) | rows `infoline` (label 120 + valor 600) |
| 16 | Encolher lote (Cards) | `openScriptShrinkConfirm` 11214 | modalRoot · sheet 460 (keep) | Confirmation | manter/reduzir | perda de conteúdo explícita |
| 17 | Encolher cronograma | `openCronShrinkConfirm` 11293 | modalRoot · sheet 460 (keep) | Confirmation | manter/reduzir | rejeição devolve foco + `cqErr` (R2) |
| 18 | Responsável | `openAssignee` 11389 | modalRoot · sheet | Selection (pessoa) | rows settrow (avatar 34+nome+cargo) + "Ninguém" + ✓ accent | sem busca; escolher fecha/aplica |
| 19 | Sessão de segurança (team) | `ensureTeamSession` 2990 | **`ts-auth-back` PRÓPRIO (z-90)** | Form (senha) | Cancelar · Continuar envio | backdrop rgba(6,7,11,.72)+blur 3; **backdrop-click e Esc FECHAM (próprios)**; "Autenticando…" disabled; erro literal; idempotência busy/settled |
| 20 | Editar prazo (SLA) | `slaEditPrazo` 4043 | **`slaedit-ov` PRÓPRIO (Monitor SLA)** | Form (2× datetime-local) | Cancelar · Salvar prazo | RBAC Social/Admin (nota literal); read-back no servidor; **backdrop-click fecha (próprio)**; concluída ⇒ toast consulta |
`openCardsEdit` (12004) reutiliza o editor de conteúdos p/ Cards. `openTaskForm`/`openNewTaskWizard`
NÃO são modais (wizard = superfície dedicada F7). `openClientView` = página (F6). WhatsApp helpers
abrem app externo.

## 4 · TAXONOMIA REAL (emerge do código; 5 famílias + 2 containers próprios)
1. **Confirmation sheet** (centrada, 420–460): selo-ícone opcional + pergunta 18–19/800 + mensagem
   com objeto em `<b>` + 2 ações. Destrutiva = del-sheet (âncora R2). Variantes keep = shrink.
2. **Form sheet** (420–720): título + campos **C1** + erro inline próprio + Cancelar/ação. Ex.:
   evento (720), credenciais (420–460), prazo do designer, team-session, slaedit (próprio).
3. **Selection sheet**: título + lista de opções (settrow com avatar / chips de status) + seleção
   aplica; ✓ accent no atual; "Ninguém" como opção real. Ex.: Responsável, Mover tarefa, designer.
4. **Detail sheet** (read-only + ações por estado): infoline (Conta/Segurança/Sobre) · evd 560
   (a11y completa + menu interno + confirmação inline 2 etapas) · **det 1240×88vh** (Central da
   tarefa; corpo interno rola; retorno de foco).
5. **Production/Workflow sheet** (560–680): header selo+título+sub · corpo rico (RTE/arquivos/
   preview de mensagem) · footer multi-ação. Âncora Golden = **F13**; inclui gcs/sp/ce.
+ **Containers próprios** (fora do modalRoot): `ts-auth-back` (z-90) e `slaedit-ov` — únicos com
  backdrop-click-fecha; ts-auth também fecha com Esc. NÃO generalizar esses comportamentos.

## 5 · ÂNCORAS GOLDEN
- **F13 — Legendas e artes** (`32103bd`): backdrop+blur reais, sheet 680/r18, X, selo âmbar,
  título/sub literais, lista interna rolável (56vh; scrollTop preservado), cards internos, RTE,
  file slot, preview, remover, URL fallback, footer 3 ações. **SALVAR ≠ SALVAR E REENVIAR AO
  CLIENTE** (reenviar só PREPARA e abre o modal de envio; envio real só na confirmação Worker).
- **R2 — del-sheet** (`3c06c26`): estado destrutivo congelado (ícone tint vermelho, literais,
  Cancelar secundário, `btn-danger` inequívoco que nunca compete com primary).

## 6 · TOKENS C2 (extraídos do real + tradução Light Golden aprovada no F13)
| Token | Valor real (dark 1.0.246) | Light Golden (âncora F13/R2) |
|---|---|---|
| backdrop | mobile rgba(0,0,0,.6); desktop rgba(6,7,11,.62) + **blur 3px**; z-60 | véu ~46% + blur 3px (calibrado ao claro) |
| backdrop (ts-auth) | rgba(6,7,11,.72) + blur 3; z-90 | camada de auth acima de tudo |
| sheet base | surface; radius 22 (mobile) / **18 desktop**; border line; shadow 0 24 70 -20; max-height **88vh**; overflow auto; padding 20; **max-width 480 desktop** | branca; r18; sh-2 forte; mesmos limites |
| larguras por variante | ev 720 · pr 680 · gcs 640 · ce 580 · evd/sp 560 · shrink/admin 460 · chemail 440 · del 440 · chpw/ts 420 · **det 1240×92vw, 88vh** | manter por variante |
| grab handle | `.grab` presente no topo dos sheets | manter discreto |
| selo-ícone (header) | 54×54 r15 tint da categoria | idem (F13 âmbar; del vermelho) |
| título/sub | `.sp-title` 20/800 · `.sp-sub` 13 max 440 · título simples 18/800 | InterTight 20/700 · 13 tx-3 |
| X (close) | `.sp-x/.gcs-x/.evd-x/.det-x` abs topo-dir | 34px + hairline; **OPCIONAL** (ver §8) |
| footer | `.sp-actions/.del-actions` flex gap 10–12; btn h46 r12 | idem; primary flex maior |
| infoline | label 120px faint 13 + valor 600 14 | idem em tx-3/tx-1 |
| z-index | modal-back 60 · ts-auth 90 | preservar ordem |
| transições | dpop .14s ease-out (desktop sheet) | manter ~140ms; reduced-motion respeitado |

## 7 · SCROLL PATTERNS (não universalizar)
- **Padrão base:** o SHEET INTEIRO rola (`max-height 88vh; overflow auto`) — ev/evd explícitos.
- **Lista interna rola** (sheet fixo): SÓ no pr-sheet (F13; 56vh + scrollTop preservado 1.0.110).
- **Corpo interno rola** (header/footer fixos): SÓ no det-sheet (flex column, padding 0).
Header/footer "sticky" nos demais NÃO existe — não inventar.

## 8 · HEADER (padrões reais + regra de opcionalidade)
Três padrões comprovados: (a) **título simples** 18/800 (+sub opcional) — Mover/Responsável/
openSheet/ev; (b) **selo-ícone + título + sub** — pr/sp/dz/del (categoria do fluxo no tint);
(c) **header de detalhe** com meta/contexto (evd/det). **X é opcional** (existe em pr/gcs/evd/
det/sp; NÃO existe em del/shrink/chpw/ev — fechar = Cancelar/ação). Grab sempre. Não exigir
selo onde o real não tem.

## 9 · BODY — **C2 CONSOME C1** (regra formal)
Todo controle interno (inputs, selects, chips, toggle, checkbox, RTE, file slot, stepper,
settrow, infoline, empty) segue os contratos **C1 Golden** sem redesenho. Conteúdo read-only
usa as famílias de detalhe (revItem/infoline). Espaçamentos grid 4/8 do DS.

## 10 · FOOTER / HIERARQUIA DE AÇÕES (precedentes F7D · F13 · R2)
**PRIMARY** (conclui a jornada; gradiente Golden; 1 por modal) · **SECONDARY** (Cancelar/Voltar/
Fechar; ghost hairline) · **CONTEXTUAL** (auxiliar real; ghost+ícone ou tint suave; não compete)
· **DESTRUCTIVE** (`btn-danger` tint+microborder+ink vermelho 750). **Regra crítica: danger NUNCA
vira primary de marca; primary Golden NUNCA vira destructive.** Ações por estado (evd) mantêm a
mesma gramática (pri/sec/danger-sec/danger).

## 11 · CLOSE BEHAVIORS (comprovado × ausente)
- **Comprovado:** X e/ou botão (data-modalclose → `closeModal`); **retorno de foco** ao elemento
  de origem no close (F3.5.4W); seleção aplica-e-fecha nos selection sheets; slaedit/ts-auth
  fecham por backdrop (containers próprios); ts-auth fecha com Esc.
- **AUSENTE nos modais do modalRoot (não declarar):** Escape global; backdrop-click-fecha
  (`data-modalbg`/`-keep` existem no markup SEM handler — registro fiel). Viram REQUIREMENTS de
  implementação futura, decididos pelo owner — nunca "já existem".

## 12 · LOADING / ERROR por modal (não unificar)
- Evento: botão "Salvando…" + flag busy (anti-duplo). Team-session: "Autenticando…" disabled +
  erro literal + prova `teamJwtValid()` antes de retomar. Credenciais: erros inline literais
  (cpErr/_ceMsg; rate-limit/sessão expirada). evd: `evd-err role=alert` genérico. gcs: aborta
  ANTES de abrir se token falha (toast). F13: fecha OTIMISTA e grava async (sem loading —
  dívida). del: sem loading; erro pós = alert (dívida). slaedit: read-back no servidor.

## 13 · RESPONSIVIDADE (requirements — validação = R8)
1920×1080 Golden (F13 validado) · 1366×768 e Windows 125% OBRIGATÓRIOS: sheets ≤ viewport
(88vh/92vw reais já protegem), det-sheet reavaliar em 1366; targets preservados. **Nada além do
1920 foi validado visualmente** — pendente R8.

## 14 · ACESSIBILIDADE (comprovado × requirement)
- **COMPROVADO no real:** role=dialog + aria-modal + aria-label (evd) · foco inicial no X ·
  **trap de Tab** (evd + det, wrap bidirecional) · retorno de foco no close (det) · `role=alert`
  em erros (evd/sq-err) · aria-busy no saving · menus internos com role=menu/menuitem ·
  aria-haspopup/expanded ("Mais opções").
- **REQUIREMENT (não comprovado; não declarar existente):** trap/foco nos DEMAIS modais; Escape;
  backdrop-click; focus-visible consistente; título programaticamente associado (aria-labelledby)
  fora do evd. Correção formal ao registro do R1: focus trap EXISTE em evd/det — "não comprovado"
  valia apenas como regra geral.

## 15 · EXCLUSÕES (nunca absorver na C2)
`alert()`/`confirm()` nativos · menu nativo Electron (editContextMenu) · menus/popovers CSS
(evd-menu/card menus/selects → **C3**) · drawer lateral Golden dos boards · janelas Electron
A-futuras gated (bgnotify/slareminder/check-in) · wizard (superfície F7) · páginas (F6).

## 16 · DÍVIDAS C2 (registradas; NÃO corrigir no design)
F13: salvar sem loading/disabled (double-submit possível; fecha antes do await) · URL sem
validação · upload sem progress. R2/del: erro pós-ação via alert; sem loading. Gerais: Escape/
backdrop-click ausentes no modalRoot (com atributos data-modalbg órfãos no markup); trap de foco
só em 2 modais; confirm() nativo na Central (Limpar histórico); validação global do wizard =
alert(). Todas pertencem à fase funcional futura do owner.

## 17 · GAPS VISUAIS C2 (registrados; NENHUMA imagem gerada nesta R3)
Estruturas reais SEM prova visual Light dedicada (consolidadas aqui documentalmente): evd-sheet
(detail+a11y+menu interno) · det-sheet 1240 (Central da tarefa) · ev-sheet 720 (form de evento) ·
gcs-sheet (send-client) · selection sheets · ts-auth/slaedit próprios. **Recomendação:** se o
owner quiser prova visual além de F13+R2, UMA fase visual curta específica (ex.: "C2 Anatomy
Board") — a decidir; NÃO executada em R3.

## 18 · GUARDRAILS DE IMPLEMENTAÇÃO (futuros; design-only hoje)
Preservar gates funcionais (pós-conclusão/slaGuard/RBAC/token-antes-do-modal) · preservar
literais · não adicionar Esc/backdrop-close sem decisão do owner · não fundir Salvar/Reenviar ·
não converter modais em páginas (nem o inverso) · manter containers próprios (ts-auth/slaedit)
como estão · A-futuras intocadas.
