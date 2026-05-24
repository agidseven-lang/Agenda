# ID Seven — App Android Nativo (React Native) · Fase 1

App **nativo** (não Capacitor/TWA) que compartilha o **mesmo Firestore** do PWA
(projeto `agenda-id-seven`). O app web continua intacto — este projeto vive isolado em `/native`.

## Por que compartilha sem quebrar o PWA
- O app web **não usa Firebase Auth**: usuários ficam em `users` (doc id auto-gerado),
  senha = `"s2:" + sha256(salt + "|" + senha)`, "logado" = id do doc.
- Este app **replica esse login** (`src/services/crypto.ts` + `auth.ts`) — não usa Firebase Auth,
  então não cria um sistema de identidade paralelo nem altera as contas.
- Firestore é acessado direto (`@react-native-firebase/firestore`) nas mesmas coleções
  (`users`, `events`). Nenhuma mudança de schema, regras ou dados — web e nativo são
  apenas dois clientes do mesmo banco.

## Stack
React Native 0.76 · React Native Firebase (app/firestore/messaging) · Notifee
(notificações locais exatas) · React Navigation · AsyncStorage · js-sha256.

## Pré-requisitos
- Node 18+, JDK 17, Android Studio + SDK.
- App Android registrado no Firebase **`agenda-id-seven`** com package **`br.com.idseven.agenda`**
  (adicione as SHA-1/SHA-256 da sua chave de assinatura).

## Passo a passo

A pasta **`android/` já está no repositório** (Gradle, Manifest, MainActivity/MainApplication,
plugin google-services, permissões, ícone adaptativo). Faltam só **2 coisas que não vão pro Git**:
o `gradle-wrapper.jar` (binário) e o `google-services.json`.

### 1. Instalar dependências
```bash
cd native
npm install
```

### 2. Gerar o gradle-wrapper.jar (binário — uma vez)
O repo traz `gradle/wrapper/gradle-wrapper.properties`, mas **não** o `.jar` (binário).
Gere o wrapper (escolha UMA opção):
```bash
# A) se tiver Gradle instalado:
cd android && gradle wrapper --gradle-version 8.10.2
# B) ou simplesmente abra a pasta `native/android` no Android Studio:
#    ele baixa o wrapper e sincroniza sozinho.
```

### 3. Colocar o `google-services.json` (NÃO vai pro Git)
Baixe no Firebase Console (app Android **`br.com.idseven.agenda`** no projeto
**`agenda-id-seven`**) e salve EXATAMENTE em:
```
native/android/app/google-services.json
```
Já está no `.gitignore` — **não será commitado**.

### 4. Rodar / Buildar
```bash
npm run android       # instala em device/emulador (debug)
# ou, dentro de native/android:
./gradlew assembleDebug      # APK debug  → app/build/outputs/apk/debug/
./gradlew assembleRelease    # APK release (configure sua assinatura antes de publicar)
```
> Debug usa o keystore padrão do SDK (`~/.android/debug.keystore`, gerado automaticamente).
> `minSdk = 26` (ícone adaptativo em XML; sem PNGs binários no repo).

## O que a Fase 1 entrega
- Login compatível com o web.
- Sessão persistente (AsyncStorage).
- Lista de `events` em tempo real (onSnapshot).
- Criar / editar / finalizar / excluir compromisso.
- **Lembrete local exato** (Notifee + AlarmManager) X min antes (X = `reminderMinutes`
  do usuário, default 60); reagenda ao editar; cancela ao finalizar/excluir; reagenda no boot.
- Permissão `POST_NOTIFICATIONS` em runtime; preparado para alarme exato.
- Tocar a notificação abre o compromisso certo.

## Anti-duplicidade com o push remoto (Worker/FCM)
O Worker continua como **backup**. Quando a notificação **local** é entregue, o app grava
`events/{id}.reminderSentAt` — e o Worker já **pula** quando esse campo existe (dedup que
já vive no backend). Se o aparelho estava desligado e o local não disparou, o Worker
cobre na janela dele.

## Limitações conhecidas
- O build do APK precisa ser feito localmente/CI (este projeto não builda no ambiente do agente).
- Android 14+ restringe `SCHEDULE_EXACT_ALARM`; use `USE_EXACT_ALARM` (apps de agenda).
- Fase 1 cobre login + agenda + lembrete local. Tarefas, chat, comentários e push rico FCM
  nativo entram em fases seguintes.
