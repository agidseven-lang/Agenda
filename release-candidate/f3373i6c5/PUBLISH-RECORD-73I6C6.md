# PUBLISH-RECORD — F3.3.73I6C6 (Desktop 1.0.162 producao controlada)

Registro da publicação controlada executada na fase C6, com autorização explícita do owner
("Release de produção controlada"; Android não incluído).

## Release publicada

| Campo | Valor |
|---|---|
| Tag | `desktop/v1.0.162-production` |
| Release id | `354094216` |
| URL | https://github.com/agidseven-lang/Agenda/releases/tag/desktop/v1.0.162-production |
| prerelease | **false** (produção) |
| draft | false |
| immutable | true |
| target (tag no SHA) | `f1101df555842ac92be9809d89be74dc9e29d817` |
| make_latest | **false** (passei `--latest=false`) |
| Assets (4, uploaded) | EXE, MSI, SHA256SUMS.txt, VERSAO-DESKTOP.txt |
| Publicador | workflow `f3373i6c6-desktop-release-162.yml` (espelha o 71E), run `29370494738` = success |
| Autor (bot) | github-actions[bot] |

Hashes oficiais (conferidos byte a byte no publicador + digests da API):
```
EXE  Agenda-ID-Seven-Desktop-1.0.162-x64.exe  5bbd937afedb412faca874faac4b9df5df2f8bd6aa30106cc5ddad1e28fb4069
MSI  Agenda-ID-Seven-Desktop-1.0.162-x64.msi  d123b15c24049b5c6bfba701450c67ce186e9723f9752a2e741a677057721f1a
```

## Nuance "latest" (transparência)

- **Badge "Latest" (make_latest):** NÃO marcado — passei `--latest=false`, honrando "não marcar latest automaticamente".
- **Endpoint `releases/latest` (computado):** retorna `desktop/v1.0.162-production`, porque o GitHub computa a *latest* como a full release (não-prerelease) mais recente. Isso é comportamento da plataforma para uma release de produção mais nova, **não** uma marcação explícita minha. Para nunca aparecer em `releases/latest`, a release teria que ser prerelease=true — o que contraria a decisão "produção controlada". Fica registrado para clareza.

## Rollback (correção sobre o ROLLBACK-PLAN.md da C5)

O alvo real de rollback do Desktop é a **release publicada 1.0.159** (não a 1.0.161, que foi build interno nunca publicado):
- `desktop/v1.0.159-production` (id 353178394), preservada e intacta (verificada no publicador: `tag|4|false`).
- EXE 1.0.159: `f772de61c8f11e444a5089a9dbdefb9370ecb03f9cf242c54f5dea1bcf9312f1`.
- Procedimento: fechar o app pela bandeja (Sair) → desinstalar 1.0.162 → reinstalar 1.0.159 (conferir hash antes).

Rollback da própria publicação C6 (se necessário): apagar SOMENTE a release/tag `desktop/v1.0.162-production`
criadas aqui (não toca 1.0.159/1.0.153 nem qualquer outra).

## Android

Não publicado nesta fase (decisão do owner). O APK **debug** aprovado segue disponível apenas como
artifact do CI (run `29354162243`, APK SHA `7695fa33559822e7f32b7bd39af9f51185bfe3f4463ea5179ad5437f0fea64c7`)
para sideload/uso interno controlado. Play Store/produção exige build release assinada + version bump em fase própria.

## Guard-rails honrados

Sem Play Store · sem deploy Firebase · sem Firestore write manual · sem Rules · sem Hosting ·
sem Worker/Card Premium · sem PWA/WebView · sem alterar código de produto · sem mexer em releases/tags antigas ·
sem imprimir tokens/segredos. Functions `onEventCreated/Updated/Deleted` já deployadas (inalteradas nesta fase).
