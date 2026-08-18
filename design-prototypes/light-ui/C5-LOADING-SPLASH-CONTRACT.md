# C5 — LOADING / SPLASH / PROCESSING · FOUNDATION CONTRACT (Light UI)

**Status:** CONSOLIDADA DOCUMENTALMENTE (R5) — aguarda owner; NÃO concluída. Fonte: Desktop
**1.0.246**. Zero produção; zero imagem nova. Nome formal: MASTER-SURFACE-MAP §F.

## 1 · REGRAS CRÍTICAS (reconfirmadas)
**SKELETON = INEXISTENTE NO PRODUTO REAL — FORA DO ESCOPO** (zero ocorrências; nunca criar).
**PROGRESS BAR = INEXISTENTE** (upload F13 usa toasts; sem percentual — nunca inventar).

## 2 · INVENTÁRIO REAL
| Loading | Origem | Visual | Bloqueia? | Texto literal | Spinner | Error path |
|---|---|---|---|---|---|---|
| **Login submit** | `loading(btn,on)` 3180 | botão disabled + spinner SUBSTITUI o texto | sim (double-submit) | — | 20px/2px branco | banner.err (C6/C1) |
| **Salvar cronograma** | rev-send 11578 | botão `disabled aria-busy` (**único aria-busy do renderer**) | sim | "Salvando cronograma…" | não (texto) | alert() legado |
| **Salvar evento** | 5950 | `data-evsave` busy flag + texto | sim | "Salvando…" | evd-err/alert |  |
| **Salvar observação (det)** | 12289 | save disabled + texto; **Cancelar também disabled** | sim | "Salvando…" | mensagem inline (conflito de edição) |
| **Team session** | ts-auth 3012 | botão disabled + texto | sim | "Autenticando…" | erro inline literal |
| **Splash de sessão** | `#authSplash` 2676 | tela cheia: brand + spinner accent + status | sim (pré-app) | "Restaurando sessão…" → "Aguardando conexão…" + hint "Tentar novamente · Entrar manualmente" (3 falhas; backoff 3s→60s) | 26px/3px accent | mantém splash (offline ≠ logout) |
| **Linha de Config** | settrow 10374/10405/10446 | row com ícone clock + texto soft | não | "Carregando…" / "Carregando diagnóstico…" | — |
| **Status line (envio)** | `setStatus` gcs 9639 | linha de status no modal (classe err p/ erro) | não | "Enviando o card premium pela WhatsApp Cloud API…" | mesma linha com `err` |
| **Upload de arte** | F13 toasts | flashToast (canal C6) | não | "Enviando arte…" → "Arte anexada."/"Falha no upload…" | toast |

## 3 · TAXONOMIA (4 famílias reais)
**1. Processing button** (Golden anchor **R2**): disabled + spinner-substitui-texto OU
disabled + texto-de-progresso ("Salvando…"/"Autenticando…"); largura preservada; anti-duplo.
**2. Full splash** (anchor documentado **F12**): brand + spinner accent + status + hint de
recuperação; nunca mostra login antes de negativa real.
**3. Inline status** (linha): settrow "Carregando…" (Config) e status line de modal (gcs/etMsg).
**4. Toast de progresso** (canal C6; referência cruzada — flashToast do upload).
Não existem: skeleton, progress bar, overlay de página com spinner, shimmer.

## 4 · TOKENS
Spinner botão 20px/borda 2px branco-40% topo branco · spinner accent 26px/3px (rgba accent .25
+ topo accent) · rotação .7s linear (reduced-motion: 1.6s) · disabled opacity .6 (C1) · textos
literais acima · splash: coluna centrada, gap 18, status 14/600 soft · settrow loading = ícone
clock + sl soft.

## 5 · A11Y — comprovado × requirement
**Comprovado:** `aria-busy` (rev-send) · disabled real bloqueando reentrada · texto de estado
visível (não só spinner) nos casos com literal. **Requirement:** aria-busy nos demais botões de
processo; `aria-live` para status lines; anúncio do splash — NÃO existem hoje; não declarar.

## 6 · RESPONSIVIDADE / DEPENDÊNCIAS / DÍVIDAS / GAP
R8 valida (splash já tem media query própria via login compacto). C5 consome C1 (botões/
disabled) e C6 (toasts). Dívidas: F13 salvar SEM loading (fecha otimista — C2 §16); alert() como
error-path legado; aria-busy ausente fora do rev-send. **GAP VISUAL C5 = NÃO** (anchor R2 +
splash documentado F12 suficientes).

## 7 · GUARDRAILS
Nunca skeleton/progress/percentual · manter literais e anti-duplo · splash nunca vira tela de
login antecipada · "Carregando…" de Config permanece row (não vira spinner de página).
