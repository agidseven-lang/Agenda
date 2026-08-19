# C6 — TOASTS / ERRORS / FEEDBACK · FOUNDATION CONTRACT (Light UI)

**Status:** DOCUMENTAL (R5) + **PROVA VISUAL DO TOAST PREMIUM ENTREGUE (R5.1:
`r5-1-transversal-anatomy-board.html`)** — CANDIDATA a Golden; aguarda owner; NÃO concluída.
**Upgrades comprovados na reauditoria R5.1** (antes listados como requirement): o STACK premium
tem `role="status"` + `aria-live="polite"` REAIS (notifEnsureStack) e o teclado Enter/Espaço no
CTA e no fechar é REAL (F3.5.5E). TTLs reais: 11s critical · 8s warning · 6s info/success.
O AGRUPADO premium tem CTA pill REAL `data-cta` ("N atualizações nesta tarefa" | "Abrir →"). Fonte: Desktop
**1.0.246**. Zero produção; zero imagem nova. Nome formal: MASTER-SURFACE-MAP §F. Escopo =
feedback IN-APP do renderer (a notificação EXTERNA premium bgnotify é A-futura gated — fora).

## 1 · OS 7 CANAIS REAIS (nunca fundir; nunca "tudo vira toast")
| Canal | Origem | Trigger típico | Visual | Persistência | Ação |
|---|---|---|---|---|---|
| **1. flashToast (utilitário)** | `flashToast` 10049 · CSS 1854 | confirmações/erros rápidos ("Produção salva…", "Enviando arte…", "Arte anexada.", "Falha no upload…", bloqueios H16) | singleton `#flashToast` fixed bottom 30px CENTRO, z-9999, ícone info accent + texto 1 linha | auto ~2600ms (param); nova chamada REAPROVEITA (sem stack) | nenhuma (sem X, sem clique) |
| **2. Toast premium interno** | `notifShowToast` 4690 (+`notifEnsureStack` 4457) | eventos de notificação in-app (SLA/fluxo/atribuição/update) | **STACK real**; card `.ntf` 420px (min 340, max 94vw) por severidade critical/warning/success/info; ícone por sev; **avatar identidade** (foto real→iniciais→genérico); título+sub; linha do responsável; variante premium; agrupamento `data-group` ("N atualizações") | fila com **auto-dismiss** + **X** (`.ntf-x`, aria-label, `:focus-visible` outline) | **clique/CTA → deep link** (abre a tarefa) |
| **3. Inline error de campo** | C1 (sq-err/cqErr) + cpErr/ceErr/tsErr/etMsg/evd-err | validação local/resposta de endpoint | tint+microborder+ink vermelho; `role="alert"` (sq-err/evd-err) | até corrigir | foco volta ao campo (quantidade) |
| **4. Form-level banner** | `.banner.err/.ok` (Login, C1/F12) | erro/aviso do formulário inteiro | banner tint full-width | até nova ação | — |
| **5. Status line** | `setStatus` gcs 9639 · etMsg | progresso/erro de operação no modal | linha de texto (classe `err`) | até mudar | — |
| **6. alert() NATIVO** | ×34 | validação global do wizard ("Informe o título." etc.) e erros legados ("Não foi possível remover agora…") | diálogo do SO | modal | OK |
| **7. confirm() NATIVO** | ×2 | "Limpar todo o histórico local de notificações?…" (Central) · "Registrar APROVAÇÃO de {label} recebida pelo WhatsApp?…" (decisão canônica) | diálogo do SO | modal | OK/Cancelar |

## 2 · TAXONOMIA / CLASSIFICAÇÃO FORMAL
TOAST utilitário (1) ≠ TOAST premium com identidade/ação (2) ≠ INLINE ERROR (3) ≠ FORM-LEVEL
BANNER (4) ≠ STATUS LINE (5) ≠ NATIVOS (6–7). O canal certo é o do código — não migrar
mensagens entre canais no design.

## 3 · SUCCESS (real)
flashToast de confirmação ("Produção salva. Reflete no link do cliente." · "Arte anexada." ·
"Senha alterada com sucesso.") · severidade success no toast premium · `.banner.ok` (Login).
**Sem check verde global; sem tela de sucesso** — a ausência de feedback ao salvar o wizard é o
contrato real (C1 §3).

## 4 · TOKENS
flashToast: fixed bottom 30 centro · z-9999 · pill surface escura real → Light: surface +
hairline + sombra média · ícone 16 accent · texto 13 · fade/translateY .18s · 2600ms.
Toast premium: stack (canto), card 420 (min 340, max 94vw) · borda/tint por severidade · avatar
32–40 foto/iniciais · título 700 + sub · X 20px (32 premium) com focus-visible outline 2px
#8FA2FF · transição .18s · reduced-motion respeitado. Inline/banner/status: tokens C1/F12.

## 5 · DEPENDÊNCIA FORMAL — **C6 USA C1 PARA ERROS DE FORMULÁRIO**
`sq-err`, `.banner.err/.ok`, disabled/loading de botões = contratos C1/R2 — NÃO redefinidos
aqui. C6 organiza o SISTEMA transversal (canais, quando cada um aparece, persistência, ação).

## 6 · A11Y — comprovado × requirement
**Comprovado:** `role="alert"` (sq-err/evd-err) · X do toast premium com aria-label +
`:focus-visible` · cor nunca é o único indicador (ícone+texto sempre) · reduced-motion.
**Requirement (não existe; não declarar):** `aria-live` no flashToast e status lines (o STACK premium JÁ tem aria-live=polite — comprovado R5.1) · foco
automático no primeiro erro (fora do caso quantidade) · announcement de toasts para leitores.

## 7 · DÍVIDAS (registradas; NÃO corrigir)
alert() ×34 como validação global (UX legada — decisão do owner em fase funcional) · confirm()
×2 (distinto do destructive sheet C2 — não fundir silenciosamente) · flashToast sem aria-live ·
mensagens técnicas em alguns literais (ex.: rodapé/status técnicos — dívida de UX-writing já
consolidada no checkpoint) · F13 depende de toast para erro de upload (sem estado no slot).

## 8 · GAPS VISUAIS / GUARDRAILS
**GAP VISUAL C6 = FECHADO na R5.1** (stack com crítico/SLA + atribuição info + AGRUPADO com
CTA pill; flashToast como amostra de canal distinto). Congela com a aprovação do owner. Guardrails: não redesenhar alert()/confirm() como toast; não
adicionar stacking ao flashToast; não remover o X/CTA do premium; canais permanecem separados.
