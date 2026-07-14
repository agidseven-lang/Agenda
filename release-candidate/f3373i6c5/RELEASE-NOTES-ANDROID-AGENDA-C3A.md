# Release Notes — Agenda Android (C3A) · APK DEBUG (Release Candidate controlado)

Status: **Release Candidate para distribuição controlada/sideload** (aprovado no owner-run F3.3.73I6C4). **Não publicado. Não é pacote de loja.**
Build: run `29354162243` · fonte `3a6162f` (`android/f3373i6c3a-agenda-permanent-delete`) · `assembleDebug`.
applicationId `br.com.idseven.agenda.nativebeta` · APK `app-debug.apk` — hash em `HASHES-ARTIFACTS.md`.

## Novidades (Agenda alinhada ao Desktop 1.0.162)

- **Agenda alinhada ao Desktop** — mesma coleção `events`, tempo real.
- **Criar / editar / iniciar / finalizar / cancelar / excluir** compromisso.
  - Criar grava `src:"nativebeta"`; editar grava `updatedAt/updatedBy`.
  - Cancelar = **lógico** (`status:"cancelled"`), **não apaga**; sai da Agenda ativa.
  - **Excluir definitivamente (novo)** — hard delete de `events`, **somente admin** (`canManage`), em **qualquer** estado; grava `deletedBy/deletedAt` antes do delete.
- **Confirmação forte EXCLUIR** — aviso de irreversibilidade + campo exigindo digitar **EXCLUIR** (botão só arma com o texto exato).
- **Mostrar/Ocultar cancelados** — alternador na Agenda para alcançar cancelados.
- **Status visual** — Agendado / Em andamento / Finalizado / Cancelado.
- **Deep-link `event:<id>`** — preservado (push de evento existente abre `event/<id>`).
- **FCM preservado** — token server-side; push data-only; exclusão entra no guard `isLifecycle` (não reagenda lembrete) e o payload de exclusão vem **sem** deep-link (documento removido → abre a Agenda, não uma rota morta).

## Preservado (regressões protegidas)

- **Chat removido** do fluxo principal.
- **Copywriting removido** do Hub de Quadros e da criação de tarefa.
- Login, Perfil, Equipe, Agenda, FCM/push — intactos. `applicationId` **inalterado**.

## ⚠️ Natureza do artefato e caminho para produção

- Este RC é um **APK DEBUG** (`assembleDebug`), assinado com o **debug keystore efêmero da CI** e com `debuggable=true`. É adequado a **teste/distribuição controlada interna (sideload)** — foi o binário **validado fisicamente** pelo owner na fase C4.
- **NÃO** é publicável na Play Store / produção, porque: (a) assinatura de debug não-estável (cert efêmero), (b) `debuggable`, (c) `applicationId` termina em `.nativebeta` (pacote beta), (d) `versionName 1.0.69-beta-prod17c-card-parity` / `versionCode 74` **não** refletem o trabalho da Agenda C3A.
- **Existe pipeline de release** no repo (`android-beta-build.yml` / `build-android-native-beta.yml` → `gradlew clean assembleRelease`), cujo buildType `release` é assinado com o **keystore de teste versionado** `idseven-test.keystore` (cert estável, `debuggable=false`, `minifyEnabled=false`).
- **Um release de produção/loja é uma build SEPARADA** que requer, na fase C6 (decisão do owner):
  1. **bump de `versionName`/`versionCode`** refletindo a Agenda C3A (mudança de código, autorizável);
  2. escolha de **assinatura** (test keystore versionado p/ distribuição controlada, ou upload key real p/ Play);
  3. build `assembleRelease` (ou `bundleRelease`/AAB para Play);
  4. **re-validação física** do novo binário (não é o APK debug validado em C4).

## Limitações conhecidas

- Notificações dependem das permissões do aparelho (Android 13+ exige POST_NOTIFICATIONS).
- Notificações excluem o autor da ação (usar usuários diferentes para observar push).

## Próximos passos

- Fase **F3.3.73I6C6-DESKTOP-ANDROID-RELEASE-PUBLISH-GATE**: decidir e (se autorizado) executar a build release-assinada + versionada, ou promover o APK debug para distribuição **controlada interna** com as ressalvas acima. **Nada disso é feito na fase C5.**
