# F0 — LAUDO DE DIAGNÓSTICO (3 bloqueios) — SEM correção aplicada

**Nada foi alterado. Worker NÃO tocado. Apenas auditoria de código com evidência
(arquivo:linha) + timeline de build. Correção só após aprovação do plano.**

Build testado: Desktop 1.0.146 = commit `288d1ed` (12/06 10:44); Android 1.0.146
= commit `f5ba102` (12/06 10:39).

---

## BLOQUEIO 1 — Notificação Social→Designer não chegou

### Auditoria das 3 camadas (todas ESTRUTURALMENTE corretas no código)
1. **Desktop dispara** (`index.html:3452`): `sendToDesigner` faz
   `POST https://idseven-push.agidseven.workers.dev/notify-designer {id}`.
   → o PC chama a rota. **PORÉM a resposta é descartada** (`.catch(()=>{})`,
   sem `.then`), e o toast "Notificação disparada" aparece ANTES e
   INCONDICIONALMENTE (`index.html:3449`). Defeito real de UX/diagnóstico:
   mesmo quando o Worker responde "designer sem token" / "já notificado",
   a social vê "disparada". Zero feedback, zero retry, zero log do motivo.
2. **Worker entrega** (`cloudflare-worker.js:460` handleNotifyDesigner): lê a
   task, resolve designerId (designerAssignment.designerId ‖ assigneeId), lê
   `users/{uid}.fcmTokens[]` + `fcmTokenMeta`, deduplica por device, envia FCM,
   marca `designerNotifiedAt`. Lógica íntegra. **Não é a causa; não será alterado.**
   Dois retornos silenciosos (HTTP 200, ok:false) que explicam "nada chegou":
   - `"designer sem token"` → o doc do designer não tem `fcmTokens`.
   - `"ja notificado (designerNotifiedAt)"` → `designerNotifiedAt >= assignedAt`
     (acontece se a MESMA tarefa foi enviada 2×: a 2ª é suprimida por dedupe).
3. **Android registra/recebe**: `Fcm.register` (Fcm.kt) grava
   `users/{uid}.fcmTokens` (arrayUnion) + `fcmTokenMeta`; chamado em
   `MainScaffold.kt:135/142` (pós-login, ON_RESUME) e `ProfileScreen.kt:217`;
   `POST_NOTIFICATIONS` pedido (`MainScaffold.kt:133`); `onMessageReceived`
   cria a notificação no canal `CH_IMMEDIATE`. Código presente no build f5ba102.

### Causa-raiz (honesta)
O código das 3 camadas está correto. A falha é uma **condição de RUNTIME/DADOS**,
não de código — e não dá para corrigir no escuro. As hipóteses, do mais provável
ao menos:
- **(H1) Designer sem token salvo**: o aparelho do designer não chegou a rodar
  `Fcm.register` com sucesso (1º uso, permissão negada no momento do fetch,
  doc do usuário inexistente para `.update()`, ou falha de rede no sync). →
  Worker responde "designer sem token".
- **(H2) Dedupe**: a tarefa foi enviada mais de uma vez → "ja notificado".
- **(H3) Permissão de exibição**: token salvo e FCM aceitou, mas o Android não
  EXIBIU (POST_NOTIFICATIONS negada / otimização de bateria / OEM).
O artefato que decide entre H1/H2/H3 é **a resposta JSON do Worker ao
/notify-designer** — que hoje o Desktop joga fora.

### O que preciso de você (1 dado de runtime) — escolha o mais fácil:
- (A) No PC, abra DevTools do app (ou rode no navegador) e capture o JSON da
  resposta de `/notify-designer` ao enviar; OU
- (B) me autorize uma correção **Desktop-only** que LÊ essa resposta e mostra o
  motivo real no toast (e loga) — isso conserta o feedback mentiroso E captura
  o diagnóstico na próxima tentativa, sem tocar Worker/Android; OU
- (C) confirme no Firebase Console se o doc `users/<uid-do-designer>` tem o array
  `fcmTokens` preenchido (se vazio = H1 confirmada).

### Correção prevista por hipótese (nenhuma toca o Worker)
- H1: garantir que o designer rode o app logado COM permissão concedida (fluxo
  de 1º uso); reforço Desktop-only para reexibir o motivo e permitir reenviar.
- H2: Desktop-only — reenvio explícito ("reenviar notificação") que ignore o
  dedupe via campo já existente, ou orientação de testar com tarefa nova.
- H3: ajuste de permissão/bateria no aparelho (item 7 do plano de instalação)
  + canal HIGH (Android-only, se necessário).

---

## BLOQUEIO 2 — Card alto demais / fora da proporção premium

### Causa-raiz (PROVADA por timeline) — CAUSA #1
O instalador 1.0.146 (`288d1ed`, 10:44) **é anterior ao contrato visual 1.0.147**:
- `36ca757` (11:20): respiro card↔coluna 16px, avatar 18/34, chips r10.
- `392047c` (14:14): Full HD ratio card×coluna **0.825→0.883**, margem inferior
  **89px→31px**, `.kcol max-height:815` na rampa ≥1700.
`git merge-base`: 288d1ed **NÃO contém** nenhum dos dois. Ou seja: o "card alto
demais com vazio embaixo" que você viu é EXATAMENTE o estado pré-1.0.147 (ratio
0.825, 89px de zona morta) — defeito que **já corrigimos no código-fonte** e que
nunca foi rebuildado. Vale para os DOIS quadros (CSS `#content.board-mode`
compartilhado). → Correção = **rebuild** do que já está no fonte (com sua
autorização de build).

---

## BLOQUEIO 3 — "Meu quadro" desalinhado vs "Setores" / sobra lateral

### Causa-raiz (PROVADA por código) — CAUSA #2 (independente do build)
Em ≥1700px (`index.html:539`): `.kcol{flex:1 1 0; max-width:432px}`, `.kanban`
é `display:flex` com `flex-start` (eixo esquerdo = eixo da busca, sem
centralização — `index.html:518`).
- "Setores" = **4 colunas** → 4×432 ≈ 1728px → preenche a largura útil (~1852px
  em 1920). Alinhado.
- "Meu quadro" (designer) = **3 colunas** (A Fazer/Em andamento/Entregue) →
  3×432 ≈ 1296px + gaps → **sobra ~500px à direita**. Como o flex é flex-start
  sem adaptação por nº de colunas, o vazio fica todo de um lado = exatamente a
  "sobra/área vazia lateral" e o "desalinhamento vs Setores" que você relatou.
Isto **não é corrigido pelo rebuild** — é um bug real de layout para quadros com
menos de 4 colunas, ainda não tratado no contrato.

### Decisão de design necessária (sua) — abordagem da correção
- (Opção V1) **Centralizar** o grupo de colunas quando houver <4 colunas: o vazio
  vira simétrico, o board parece intencional; mantém o card sem esticar (a regra
  "card esticado reprovado" 1.0.141 fica preservada). Quebra levemente o
  princípio "eixo esquerdo = eixo da busca".
- (Opção V2) **Escalar a largura** das colunas por contagem (3 colunas usam um
  max-width maior p/ preencher), mantendo o eixo esquerdo; risco = aproximar do
  "card esticado" reprovado — exige medição cuidadosa.
- (Opção V3 recomendada) **Híbrida**: manter eixo esquerdo + cap por px, mas
  distribuir a largura disponível entre as colunas existentes com um teto
  intermediário (ex.: 3 colunas preenchem sem virar "pílula"), validado por
  medição DOM + previews 1366/1920 (mesmo rigor do 1.0.147).

Seja qual for, a correção será feita com **medição DOM + previews Electron em
1366×768 e 1920×1080** e comparação lado a lado "Meu quadro" × "Setores", como no
ciclo 1.0.147 — sem chute.

---

## RESUMO EXECUTIVO

| Bloqueio | Causa-raiz | Escopo | Toca Worker? | Precisa rebuild? |
|---|---|---|---|---|
| 1 Notificação | runtime (token/dedupe/permissão) + Desktop ignora resposta | Desktop/Android + 1 dado seu | **NÃO** | depende da hipótese |
| 2 Card alto | build anterior ao 1.0.147 (já corrigido no fonte) | rebuild | NÃO | **SIM** |
| 3 Meu quadro | 3 colunas × max-width sem adaptação (flex-start) | CSS Desktop (+ Android paridade) | NÃO | SIM (após corrigir) |

**Nada será editado/buildado até você: (1) escolher A/B/C para o dado de
notificação; (2) escolher a abordagem visual V1/V2/V3.** Worker, Rules,
SLA_WRITE, SLA_ACTIVATED_AT e 4.4-B permanecem intocados.
