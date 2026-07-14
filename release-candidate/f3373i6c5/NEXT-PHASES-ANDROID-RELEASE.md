# NEXT PHASES — Android release assinado (+ linhas futuras)

Planejamento das próximas linhas possíveis após a C8. **Documentação/planejamento** — nada é executado aqui.

## A. Android release de produção (quando desejado)
Hoje só existe o **APK debug** (sideload interno). Um pacote de loja/produção é uma build **separada** que
precisa das decisões e passos abaixo — cada um em fase própria, gated, com owner-run de re-validação.

### A.1 Decisões pendentes (do owner)
1. **Canal**: distribuição controlada interna (APK release por link) **ou** Play Store (AAB)?
2. **Assinatura**:
   - Distribuição controlada → pode usar o keystore de teste versionado `idseven-test.keystore`
     (o buildType `release` já o referencia; cert estável, `debuggable=false`, `minifyEnabled=false`).
   - Play Store → **upload key** real (não versionar segredo no repo; usar secret da CI + Play App Signing).
3. **applicationId**: hoje `br.com.idseven.agenda.nativebeta` (beta). Para produção Play, decidir se muda
   para um id de produção — mudança sensível (novo app na loja) → **fase própria**.
4. **Versão**: `versionName`/`versionCode` estão desatualizados (`1.0.69-beta` / `74`). Precisam de **bump**
   refletindo a Agenda C3A antes de qualquer release.

### A.2 Passos (fase futura)
1. Bump de `versionName`/`versionCode` (mudança de código autorizável).
2. Build `assembleRelease` (APK) ou `bundleRelease` (AAB) via pipeline existente (`build-android-native-beta.yml` / `android-beta-build.yml` fazem `assembleRelease`).
3. Assinatura conforme decisão A.1.2.
4. Gate de hash + **re-validação física** do novo binário (não é o APK debug validado na C4).
5. Se Play: fluxo de loja (ficha, faixas de teste, revisão) — fora do escopo desktop.

### A.3 Guard-rails
Sem tocar Worker/Card Premium/Firestore/Rules/Hosting; sem imprimir segredos; keystore/upload key
tratados como secret (nunca em claro).

## B. Linhas futuras possíveis (escolher após C8)
1. **Monitoramento D+0/D+1** — se surgirem bugs reais (usar `MONITORING-CHECKLIST-D0-D7.md`).
2. **Android release assinado** — seção A acima.
3. **Melhorias pós-release** — agrupar bugs não-críticos e pequenas melhorias da Agenda.
4. **Encerramento formal da linha Desktop 1.0.162** — se estável em D+7, consolidar como produção controlada corrente.

## C. Estado atual (referência)
- Desktop **1.0.162** = produção controlada publicada (rollback: 1.0.159).
- Android = **APK debug sideload controlado** (não publicado).
- Functions `onEventCreated/Updated/Deleted` ativas.
- Ops-branch limpa (workflows no-op desarmados na C7).
