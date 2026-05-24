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

### 1. Gerar o esqueleto nativo do Android
Este repositório traz a camada JS/TS pronta. Gere a pasta nativa `android/` (uma vez):

```bash
cd native
# instala dependências
npm install
# gera a pasta android/ nativa com o package correto
npx @react-native-community/cli init IdSevenTmp --version 0.76.5 --skip-install --directory ./_tmp
# copie a pasta _tmp/android para ./android e ajuste (veja item 3) — ou use Android Studio.
```
> Alternativa recomendada: abrir o projeto no Android Studio e deixar o Gradle sincronizar.

### 2. Colocar o `google-services.json` (NÃO vai pro Git)
Baixe no Firebase Console (app Android `br.com.idseven.agenda`) e salve em:

```
native/android/app/google-services.json
```
Esse caminho está no `.gitignore` — **não será commitado**.

### 3. Ajustes Android obrigatórios

**`android/app/build.gradle`**
```gradle
android {
  defaultConfig {
    applicationId "br.com.idseven.agenda"
    minSdkVersion 24
    targetSdkVersion 34
  }
}
apply plugin: 'com.google.gms.google-services'   // no final do arquivo
```

**`android/build.gradle`** (classpath do plugin)
```gradle
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.4.2'
  }
}
```

**`android/app/src/main/AndroidManifest.xml`** (permissões)
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.USE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
```
> `USE_EXACT_ALARM` é a via aceita pela Play Store para apps de agenda/alarme.
> O Notifee já registra o receiver de boot para reagendar os triggers.

### 4. Rodar
```bash
npm run android      # debug
npm run build:apk    # release (assembleRelease)
```

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
