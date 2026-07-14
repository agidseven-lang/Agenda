# POST-RELEASE HANDOFF — Agenda ID Seven Desktop 1.0.162

Fase **F3.3.73I6C8** — consolidação pós-release. **Somente documentação** (sem deploy/build/write/release/tag).
Documento-mestre; ver também: `MONITORING-CHECKLIST-D0-D7.md`, `ROLLBACK-RUNBOOK-1.0.162.md`,
`KNOWN-LIMITATIONS.md`, `NEXT-PHASES-ANDROID-RELEASE.md`, `PUBLISH-RECORD-73I6C6.md`.

## 1. Release publicada (produção controlada)
| Campo | Valor |
|---|---|
| URL | https://github.com/agidseven-lang/Agenda/releases/tag/desktop/v1.0.162-production |
| Tag | `desktop/v1.0.162-production` (SHA `f1101df`) |
| Release id | `354094216` |
| Estado | prerelease=**false**, draft=false, **immutable=true** |
| make_latest | **false** (badge *Latest* não marcado) |
| Assets (4) | EXE, MSI, `SHA256SUMS.txt`, `VERSAO-DESKTOP.txt` |
| Publicador | `f3373i6c6-desktop-release-162.yml`, run `29370494738` = success |

**Hashes oficiais (SHA-256):**
```
EXE  Agenda-ID-Seven-Desktop-1.0.162-x64.exe  5bbd937afedb412faca874faac4b9df5df2f8bd6aa30106cc5ddad1e28fb4069
MSI  Agenda-ID-Seven-Desktop-1.0.162-x64.msi  d123b15c24049b5c6bfba701450c67ce186e9723f9752a2e741a677057721f1a
```
> Nuance *latest*: passei `--latest=false`; o endpoint `releases/latest` é computado pelo GitHub e retorna a 1.0.162 por ser a full release mais recente (comportamento da plataforma, não marcação explícita). Detalhe em `PUBLISH-RECORD-73I6C6.md`.

## 2. Status de produção
- **Desktop 1.0.162 = produção oficial controlada**, sucedendo a **1.0.159**. Distribuição controlada (máquinas autorizadas, após conferência de hash). Instalador **não assinado** (SmartScreen/Smart App Control podem avisar/bloquear).

## 3. Rollback (resumo; detalhe no runbook)
- Alvo oficial de rollback: **1.0.159** (`desktop/v1.0.159-production`, EXE `f772de61c8f11e444a5089a9dbdefb9370ecb03f9cf242c54f5dea1bcf9312f1`), preservada e intacta.

## 4. Android
- **Não publicado** (nem Play Store). Mantido como **APK debug para sideload/uso interno controlado** — artifact de CI (run `29354162243`, APK `7695fa33559822e7f32b7bd39af9f51185bfe3f4463ea5179ad5437f0fea64c7`).
- **Release de produção Android = fase futura** (build assinada + version bump + re-validação) — ver `NEXT-PHASES-ANDROID-RELEASE.md`.

## 5. Functions (backend) — ativas, inalteradas nesta fase
`onEventCreated`, `onEventUpdated`, `onEventDeleted` (projeto `agenda-id-seven`, `us-central1`, `nodejs20`). Notificações server-side de criação/lifecycle/exclusão (o autor da ação não é notificado).

## 6. Workflows (ops-branch) — limpos (C7)
Push-triggers de `d9r2-userspublic-cleanup` e `f3371b-email-change-deploy` **desarmados** (commit `6c441de`); `workflow_dispatch` preservado. Ops-branch **sem falsos vermelhos** em pushes futuros. Publicadores C3A/C6 também desarmados pós-uso.

## 7. Escopo de produto preservado
- **Chat removido** e **Copywriting removido** (criação de tarefa) — mantidos.
- **Card Premium WhatsApp** e **Cloudflare Worker** — **preservados/intocados**.
- **PWA não é produto**; **WebView não usado**.

## 8. Guard-rails desta linha (C5–C8)
Sem Play Store · sem deploy Firebase · sem Firestore write manual · sem Rules · sem Hosting · sem Worker/Card Premium · sem PWA/WebView · sem alterar código de produto nesta fase · sem tokens/segredos impressos.
