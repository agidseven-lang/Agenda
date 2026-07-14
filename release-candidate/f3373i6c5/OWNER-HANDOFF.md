# OWNER-HANDOFF — F3.3.73I6C5 Release Candidate (Agenda C3A)

Consolidação para o owner decidir a publicação controlada na fase **C6**.
Esta fase C5 **preparou** os pacotes candidatos e a documentação. **Não publicou, não deployou, não tagueou, não alterou latest.**

## 1) O que está pronto

| Item | Estado |
|---|---|
| Desktop 1.0.162 (RC) | **Pronto** — instalador NSIS+MSI, gates PASS, validado no owner-run C4 |
| Android APK debug C3A (RC controlado) | **Pronto para sideload/controlado** — validado no owner-run C4 |
| Functions (`onEventCreated/Updated/Deleted`) | **Deployadas e confirmadas** (nada muda em C5) |
| Documentos de release (6) | **Gerados** nesta pasta |

## 2) Referências rápidas (detalhe em `HASHES-ARTIFACTS.md`)

- **Desktop 1.0.162** — run `29353487838` · installer `8319234363` · EXE `5bbd937a…fb4069` · MSI `d123b15c…721f1a` · fonte `f1101df`.
- **Android debug** — run `29354162243` · artifact `8319511469` · APK `7695fa33…64c7` · fonte `3a6162f`.

## 3) Decisão central pendente para C6 — Android

O APK aprovado é **DEBUG** (assinatura efêmera, `debuggable`, `.nativebeta`, `versionName` desatualizado `1.0.69-beta`).
Serve para **distribuição controlada/sideload interno**. Para **loja/produção** é necessária uma build **separada**:

- **Caminho A (rápido, controlado):** distribuir o **APK debug** validado como RC interno, com as ressalvas documentadas. Sem nova build.
- **Caminho B (produção/loja):** `assembleRelease` (cert `idseven-test.keystore` versionado, `debuggable=false`) **ou** `bundleRelease`/AAB (upload key p/ Play), **com bump de `versionName`/`versionCode`** e **re-validação física** do novo binário.

> Recomendação: para publicação **controlada interna**, Caminho A é suficiente e mais seguro (é o binário validado).
> Para Play Store / produção, Caminho B é obrigatório e deve ser tratado como novo ciclo (build + QA) em C6.
> **Não** decidi por você nem gerei nova build — é decisão do owner na C6.

## 4) Guard-rails honrados nesta fase

Sem deploy · sem Firestore write manual · sem Rules · sem Hosting · sem Worker/Card Premium · sem PWA/WebView ·
sem reintroduzir Chat/Copywriting · sem tag/latest/Play Store · sem publicar release · sem imprimir tokens/segredos.

## 5) Tags sugeridas (NÃO criadas — criar só com autorização, C6)

- Desktop: `desktop-v1.0.162-rc`
- Android: `android-agenda-c3a-rc` (ou, se Caminho B, uma tag da nova versão release)

## 6) Próximos passos

1. Owner confere os hashes localmente (descompactar → `certutil`).
2. Owner decide Android Caminho A vs B.
3. Fase **F3.3.73I6C6-DESKTOP-ANDROID-RELEASE-PUBLISH-GATE**: autorizar/bloquear a publicação controlada, criação de tags e (se Caminho B) a build release Android.

## 7) Documentos desta pasta (`release-candidate/f3373i6c5/`)

- `RELEASE-NOTES-DESKTOP-1.0.162.md`
- `RELEASE-NOTES-ANDROID-AGENDA-C3A.md`
- `CHECKLIST-RELEASE-CANDIDATE.md`
- `HASHES-ARTIFACTS.md`
- `ROLLBACK-PLAN.md`
- `OWNER-HANDOFF.md` (este)
