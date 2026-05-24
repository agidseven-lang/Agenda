# ID Seven — App Android NATIVO (Kotlin)

App 100% nativo (Kotlin + Android SDK). **Sem** React Native, Hermes, Metro, JS bundle, npm,
Notifee, autolinking, Codegen ou bridge. Vive isolado em `/android-native` e **não** mexe no
PWA, no Cloudflare Worker nem no Firebase web.

## Build (automático, via GitHub Actions)
Workflow: **`.github/workflows/build-android-native.yml`** (`Build Android Nativo`).
- Roda em `ubuntu-latest`, JDK 17, `./gradlew assembleRelease`.
- Restaura `app/google-services.json` do secret `GOOGLE_SERVICES_JSON_BASE64` (usado a partir da Fase 2).
- Publica o artifact com o APK release (assinado com chave de teste).
- Dispara em push na branch `feat/android-native-kotlin` e por `workflow_dispatch`.

Baixar: **Actions → Build Android Nativo → run → Artifacts**.

## google-services.json
**Nunca** é commitado (está no `.gitignore`). É restaurado no CI a partir do secret base64.

## Package / app
- Package: `br.com.idseven.agenda`
- Nome: **ID Seven**
- minSdk 26 · targetSdk/compileSdk 34 · Kotlin/Java target 17

## Roadmap por fases
- **Fase 1 (esta):** base nativa — app abre, tela inicial escura ("ID Seven Android nativo
  abriu"), botão Continuar → tela de Login (UI). Workflow gerando APK. **Sem Firebase.**
- **Fase 2:** Firebase/Firestore nativo + login custom (users + `"s2:" + sha256(salt+"|"+senha)`),
  sessão local (SharedPreferences com o ID do doc), logout.
- **Fase 3:** ler/criar compromissos no Firestore (compatível com o PWA).
- **Fase 4:** notificação local exata (NotificationChannel + AlarmManager
  `setExactAndAllowWhileIdle`, BroadcastReceiver, reagenda no boot; cancela ao editar/finalizar/excluir).

## Estrutura
```
android-native/
├── settings.gradle, build.gradle, gradle.properties
├── gradlew, gradlew.bat, gradle/wrapper/ (jar + properties)
├── README.md, .gitignore
└── app/
    ├── build.gradle, proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/br/com/idseven/agenda/  (MainActivity, LoginActivity)
        └── res/  (layouts, values, ícone adaptativo)
```
