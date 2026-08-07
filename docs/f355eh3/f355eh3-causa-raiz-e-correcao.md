# F3.5.5E-H3 — Visibilidade Global das Notificações (Desktop 1.0.227): causa-raiz e correção

Fase P0 sobre a **1.0.226 FISICAMENTE APROVADA** (design da referência do owner **byte-congelado**;
`bgnotify.html` diff-vazio provado por gate). Problema físico: as notificações imediatas não
apareciam de forma confiável com o Agenda aberto atrás de outro programa, minimizado, oculto no
tray ou com aplicativos comuns maximizados na frente.

## Causa-raiz (auditoria read-only de 86 itens, provada no código real)

1. **Topmost e bounds nunca eram reafirmados na apresentação** — `setAlwaysOnTop(true,"screen-saver")`
   rodava SÓ na criação da janela premium (`ensureWin`); `showBgNotify` fazia `showInactive()` sem
   `position()`, sem reassert e sem `moveTop()`. Depois de `hide()` (fila vazia) ou de mudança de
   display/DPI, uma janela `focusable:false` re-exibida podia voltar ABAIXO de janelas comuns
   (z-order do Windows não reafirmado) e com bounds antigos.
2. **O morph de GRUPO não reafirmava o z-order** — o card "N atualizações" podia seguir atrás do
   programa em primeiro plano.
3. **Toast interno ativo ficava invisível no Alt+Tab** — com o Agenda focado o toast (TTL 6/8/11s)
   vive DENTRO da mainWindow; não havia handler de `blur` migrando os cards ativos para a janela
   externa quando o usuário alternava para outro aplicativo.
4. A hipótese "`if (mainWindow) → toast`" **não se confirmou**: o roteamento por FOCO REAL
   (`windowActive()==isFocused()`, F3.5.4K) já estava correto e permanece **congelado**.

## Regra de roteamento (anterior → nova)

| Estado | Antes (1.0.226) | Agora (1.0.227) |
|---|---|---|
| Sessão bloqueada | Notification nativa | (igual — Secure Desktop/lock é limitação legítima do SO) |
| Main FOCADA | toast interno (ACK 4s → bg → nativa) | igual **+ registro do handoff** |
| Main focada → usuário alterna p/ outro app | toast ativo ficava invisível atrás | **HANDOFF no blur**: cards vivos migram para a janela premium (sound:false; mover, nunca duplicar) |
| Aberta atrás / minimizada / oculta / X-tray | janela premium (showInactive) | igual **+ REASSERT completo a cada apresentação** |
| Quit REAL (menu da tray) | processo morre — sem notificações | igual (documentado; "fechado" do owner = X→tray, que segue entregando) |

## Correção cirúrgica

- **`bgNotify.ts`** — `reassert()` antes de CADA card: janela existe (recria se destruída) →
  `position(altura viva)` na workArea do display do cursor → `setAlwaysOnTop("screen-saver")`
  reafirmado → `showInactive()` (nunca rouba foco) → `moveTop()`. Reafirmação de topmost no update
  de grupo visível. Reposição em `display-metrics-changed/added/removed`. `lastHeight` memorizada
  do ack de resize.
- **`main.ts`** — registro dos toasts entregues (payload por dedupKey, TTL espelhado 6/8/11s+900ms);
  `blur` → coleta IPC (`notif-collect-request`/`notif-collect-reply`, guarda de reqId, timeout
  700ms) → re-exibição dos cards AINDA vivos na premium com `sound:false` e `_handoff`; chaves não
  devolvidas (fechadas pelo usuário) saem do registro; o fallback por falta de ACK do toast
  desregistra a chave (nunca re-mostra). `dedupKey` canônico materializado no payload.
- **`preload.ts`** — 2 canais novos da coleta. **`index.html`** — `__ntfPayload`/`__ntfKey` no
  elemento do toast + listener da coleta que fecha os cards e responde SEMPRE (grupo `data-group`
  não migra — regra F3.5.4O congelada; eventos seguem no sino). **Zero mudança visual.**

## Provas (Electron real, xvfb) — 22/22

Pipeline REAL: `bgNotify.js`/`toastAck.js`/`notifEvents.js` do dist compilado + `deliverNotification`
+ bloco do handoff + `bringToFrontAndOpen` + handler da coleta EXTRAÍDOS byte-a-byte do
`dist/main/main.js` + renderers do app.asar + canais IPC de produção. Destaques: E03 handoff no
blur com coleta respondida e som suprimido (`suppressed_by_payload`); E04 aberta-atrás → premium
direto; E08 digitação de 20 caracteres em outro app SEM perder 1 tecla nem o foco com 2
notificações no meio; E09 clique real no segmento "Abrir →" = único caminho que foca o Agenda;
E11 reassert pós-hide re-ancorado no canto (workArea−14px); E12 destroy→recreate; E13 rajada de
20 com cap 5 e 20 ACKs; E17/E18 avatar flutuante íntegro a 125%/150%. PNGs em `docs/f355eh3-qa/`.

## Limitações declaradas (validação física do owner no Windows)

- O **z-order do DWM do Windows real** (screen-saver topmost sobre Chrome/Word/Photoshop reais,
  janelas maximizadas e fullscreen comum) não é reproduzível em xvfb — aqui provamos
  `isAlwaysOnTop()` + nível + `moveTop` + bounds + foco; a confirmação visual sobre aplicativos
  reais é o teste físico A/B/C/D do mandato.
- `minimize`/`isMinimized` reais dependem do window manager (xvfb não tem WM); o que o roteador
  usa — perda de foco — foi provado.
- A Notification NATIVA (fallback e caminho de sessão bloqueada) não renderiza em xvfb.
- Multi-monitor físico e resoluções 1600×900/2560×1440 reais: a matemática de `position()` é
  provada por contrato e os bounds reais numa workArea real; matrizes físicas ficam para o owner.
- Card de GRUPO ativo no toast interno não migra no blur (não existe caminho congelado de CRIAÇÃO
  de grupo na premium — F3.5.4O só morfa); janela ≤15s, eventos já registrados no sino.
