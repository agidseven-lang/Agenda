# HASHES-ARTIFACTS — F3.3.73I6C5 Release Candidate

Projeto: **Agenda ID Seven** · Fase: **F3.3.73I6C5-RELEASE-CANDIDATE-PREP** · Data: 2026-07-14
Escopo desta fase: preparação de RC (documentação). **Sem publicação, sem deploy, sem tag, sem latest.**

> ⚠️ **Como conferir corretamente:** o artefato baixado do GitHub Actions vem como um **.zip**.
> O `digest` que o GitHub exibe é o hash **do .zip**, NÃO do binário interno. **Descompacte primeiro**
> e rode o `certutil`/`sha256sum` no arquivo interno (`.exe`/`.msi`/`app-debug.apk`) para bater com o
> **SHA-256 do binário** abaixo.

---

## Desktop — Agenda ID Seven Desktop 1.0.162

| Campo | Valor |
|---|---|
| Versão | **1.0.162** |
| appId | `br.com.idseven.agenda.desktop` |
| Workflow run | `29353487838` (Desktop Build (Windows)) — conclusão **success** |
| Fonte (ref buildada) | commit `f1101df` · branch `desktop/f3373i6c3a-permanent-delete` |
| Artifact installer | `8319234363` — `agenda-id-seven-desktop-1.0.162-installer` (expira 2026-08-13) |
| Artifact bundle | `8319240131` — `agenda-id-seven-desktop-1.0.162-bundle` (expira 2026-08-13) |
| Gates de build | tray-icon **PASS**, prova-de-versão **PASS** |

**SHA-256 dos binários (conferir após descompactar):**

```
EXE  Agenda-ID-Seven-Desktop-1.0.162-x64.exe
     5bbd937afedb412faca874faac4b9df5df2f8bd6aa30106cc5ddad1e28fb4069

MSI  Agenda-ID-Seven-Desktop-1.0.162-x64.msi
     d123b15c24049b5c6bfba701450c67ce186e9723f9752a2e741a677057721f1a
```

SHA-256 dos **.zip** wrapper (informativo; NÃO é o binário):
- installer.zip: `a884be92dbc6e978a710bf856f44cb7b9d9bdb3f04720ab9154116faa5b9ca1f`
- bundle.zip: `3bcade4980525604d594ca12ef51ca23415caa703dd7b051881142600c4cb962`

Comando de verificação (Windows):
```
certutil -hashfile "Agenda-ID-Seven-Desktop-1.0.162-x64.exe" SHA256
certutil -hashfile "Agenda-ID-Seven-Desktop-1.0.162-x64.msi" SHA256
```

---

## Android — APK DEBUG (Agenda C3A)

| Campo | Valor |
|---|---|
| applicationId | `br.com.idseven.agenda.nativebeta` |
| versionName / versionCode | `1.0.69-beta-prod17c-card-parity` / `74` *(NÃO reflete o trabalho C3A — ver limitação)* |
| Tipo de build | **DEBUG** (`:app:assembleDebug`) — assinado com **debug keystore efêmero da CI**, `debuggable=true` |
| Workflow run | `29354162243` (Android DEBUG build) — conclusão **success** (`assembleDebug` ⇒ compileDebugKotlin PASS) |
| Fonte (ref buildada) | commit `3a6162f` · branch `android/f3373i6c3a-agenda-permanent-delete` |
| Artifact | `8319511469` — `idseven-nativebeta-DEBUG-3a6162f0f0cf3b1264cf2efb50bf5536c7a5e48a` (expira **2026-07-28**) |

**SHA-256 do binário (conferir após descompactar):**
```
app-debug.apk  (23.610.762 bytes)
     7695fa33559822e7f32b7bd39af9f51185bfe3f4463ea5179ad5437f0fea64c7
```
SHA-256 do **.zip** wrapper (informativo): `371c0fb7866b1f5f079a811a56314473e2825ac878420288390456934a69c1eb`

Comando de verificação:
```
certutil -hashfile app-debug.apk SHA256          (Windows)
sha256sum app-debug.apk                           (Linux/macOS)
```

> ⚠️ **Este é um APK DEBUG**, adequado a **distribuição controlada/sideload interno**.
> **NÃO** é um pacote de loja/produção. Ver `RELEASE-NOTES-ANDROID-AGENDA-C3A.md` e
> `OWNER-HANDOFF.md` para o caminho de release de produção (fase C6).

---

## Firebase Functions (já deployadas — estado confirmado no deploy)

| Function | Trigger | Fase / evidência |
|---|---|---|
| `onEventCreated` | `firestore.document.v1.created` (events/{id}) | C1 |
| `onEventUpdated` | `firestore.document.v1.updated` (events/{id}) | C1 |
| `onEventDeleted` | `firestore.document.v1.deleted` (events/{id}) | C3A — run `29354374188`, pós-deploy `functions:list` confirmou presença + siblings intactos |

Projeto `agenda-id-seven`, região `us-central1`, runtime `nodejs20`.
**Nenhum deploy de Functions ocorre nesta fase C5.**
