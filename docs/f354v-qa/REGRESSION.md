# F3.5.4V — Regressão (delta-zero vs baseline 1.0.211)

Prova: rodando TODAS as suítes `desktop/scripts/*.test.mjs` na baseline **1.0.211** (fisicamente
aprovada, `wt-f354u` @ 59a694f) e na branch **1.0.212** (F3.5.4V), o conjunto de suítes que falham
é **IDÊNTICO** (30 = 30, diff vazio). Portanto **nenhuma falha nova** foi introduzida por esta fase.

As 30 suítes que já falhavam na 1.0.211 são pré-existentes e NÃO são gates desta fase:
- Pinadas a versões antigas (f352b→1.0.189, f352c→1.0.190, f352d→1.0.191, f354p X18→1.0.206, f351f→1.0.184/186).
- Region-invariance / byte-identidade contra baselines antigas (f341a, f343/344/345/346/347-hotfix, f3374k).
- Arquitetura de notificação "produtor único no main" (f33D/E/K/N, f343-assignment, f3377a-r3) — base-red.
- Dependentes de Playwright/ambiente (f354g-*, f354m) — SKIP controlado (Playwright não provisionado).

Gates VERDES relevantes desta fase:
- `f354v-custom-video-quantity.test.mjs` — 72/0 (novo).
- `f3377a-media-editing.test.mjs` — 79/0 (contrato de vídeos/temas/SLA — o mais relevante; PRESERVADO).
- Prova Electron real (app.asar) — 12 cenas / 0 falhas (`f354v-electron-proof-manifest.json`).
