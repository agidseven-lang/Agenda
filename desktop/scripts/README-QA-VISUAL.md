# Desktop QA — execução controlada (test-only / harness-only)

> F3.3.22-GAP-FIX. Documento **somente de QA/harness**. Não descreve nem altera produto.
> Nenhum passo aqui faz build de instalador, deploy, Firestore write, Web Push ou notificação real.

## Testes de contrato/DOM/harness (`*.test.mjs`)

Rodam offline com Node (sem rede; espião de `fetch`/XHR aborta qualquer chamada de provider).
Os testes DOM (`f33C`, `f33D`) usam um Chromium já instalado (não baixam browser).

```bash
# na raiz do desktop, fixado na ref/tag desejada:
npm ci
npm run build            # tsc (main+preload) + copy-renderer — NÃO é electron-builder
for t in scripts/*.test.mjs; do node "$t" || echo "FALHOU: $t"; done
node scripts/e2e-flow-test.js
```

## QA visual (`visual-qa-*.mjs`) — Playwright + Chromium existente

Os scripts usam `chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined })`.
Defina `CHROMIUM_BIN` para um Chromium já presente — **sem download automático**.
Se `CHROMIUM_BIN` estiver vazio, cai no comportamento padrão do Playwright
(que exige `npx playwright install` num runner provisionado para isso).

```bash
# 1) Playwright (pacote JS) disponível no runner — sem baixar browser:
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright

# 2) Apontar para um Chromium existente (ex.: cache do ambiente):
export CHROMIUM_BIN="$(ls /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1)"

# 3) Rodar a QA visual (saída em desktop/qa-out/):
for q in scripts/visual-qa-*.mjs; do CHROMIUM_BIN="$CHROMIUM_BIN" node "$q" || echo "FALHOU: $q"; done
```

Se nenhum Chromium estiver disponível e o download for proibido, a QA visual deve ser
reportada como **SKIP controlado** (causa explícita: Playwright/Chromium não provisionado),
nunca como SKIP silencioso. As asserções de fonte (`f3311`, `f332-panel`) e os testes DOM
(`f33C`/`f33D`, Chromium real) seguem cobrindo o renderer mesmo quando a QA visual faz SKIP.
