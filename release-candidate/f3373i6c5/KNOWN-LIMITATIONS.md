# KNOWN LIMITATIONS — Agenda 1.0.162 (Desktop produção controlada + Android debug)

Limitações conhecidas e esperadas nesta linha. Não são bugs; são características da arquitetura/escopo atual.

## Notificações — Desktop
- O Desktop recebe notificações locais **apenas enquanto o app está aberto, minimizado ou na bandeja**.
  Se você **"Sair" pela bandeja** (encerrar de verdade), o Desktop **não** recebe notificações até reabrir.
  Não há backend de push dedicado para Desktop nesta arquitetura (o notificador é do processo principal,
  via Firestore `onSnapshot` → notificação nativa).
- **O autor da ação não é notificado** — quem cria/edita/inicia/finaliza/cancela/exclui não recebe push;
  os demais usuários ativos recebem. Para observar push em teste, use **usuários diferentes** por aparelho.

## Notificações — Android
- Dependem da **permissão de notificação** do aparelho (Android 13+ exige `POST_NOTIFICATIONS`) e do
  **token FCM** registrado (server-side). Sem permissão/token, não há push (comportamento do sistema).
- Com FCM, funciona em primeiro plano, segundo plano, app fechado e tela bloqueada.

## Instalação — Desktop (sem assinatura de código)
- O instalador **não é assinado digitalmente**. O **SmartScreen** avisa na 1ª instalação; máquinas com
  **Smart App Control** (Windows 11) podem **bloquear sem opção de prosseguir**. Instalar somente em
  máquinas autorizadas/compatíveis, sempre após conferência de hash.
- **Sem auto-update**: atualizar/rebaixar é por reinstalação manual (fechar pela bandeja → instalar).

## "Latest" da release (GitHub)
- A 1.0.162 foi publicada com `--latest=false` (badge *Latest* não marcado). O **endpoint** `releases/latest`
  é computado pelo GitHub e retorna a 1.0.162 por ser a full release mais recente — comportamento da
  plataforma, não marcação explícita. Sem efeito prático (não há auto-updater consumindo esse endpoint).

## Android — natureza do artefato
- O APK aprovado é **DEBUG** (assinatura de debug efêmera, `debuggable=true`, `applicationId .nativebeta`,
  `versionName 1.0.69-beta` desatualizado). Serve para **sideload/uso interno controlado**, **não** para
  Play Store/produção. Um pacote de produção exige build **release** assinada + version bump + re-validação
  (ver `NEXT-PHASES-ANDROID-RELEASE.md`).

## Escopo de produto (intencional)
- **Chat removido** do fluxo principal; **Copywriting removido** da criação de tarefa. São cortes de escopo
  aprovados, não defeitos. **PWA não é produto** e **WebView não é usado**.
- **Card Premium WhatsApp** e **Cloudflare Worker** permanecem em produção, **intocados** nesta linha.
