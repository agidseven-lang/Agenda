# WhatsApp OG Live Probe (diagnóstico read-only)

Workflow manual `[manual] WhatsApp OG Live Probe`
(`.github/workflows/whatsapp-og-live-probe.yml`) que executa a **matriz live de
HTTP/curl** que o ambiente do Claude **não** consegue rodar (egress para
`aprovar.agendaidseven.com.br` é bloqueado por proxy 403).

## O que faz

Somente requisições **GET/HEAD públicas** (zero POST/PUT/PATCH/DELETE, zero
secrets, zero deploy, zero Cloudflare write, zero Firestore, zero WhatsApp Cloud
API) contra:

- `/share/cronograma/<token>` no domínio **custom** e em **workers.dev**
- a imagem OG `/og/wa-card-v64-39.jpg` no **custom** e em **workers.dev**

Com 4 User-Agents: `default`, navegador (`Mozilla/5.0`),
`facebookexternalhit/1.1` e `WhatsApp/2.0`.

## Como executar

1. Actions → **[manual] WhatsApp OG Live Probe** → **Run workflow**.
2. Selecionar o branch que contém o workflow (ex.: `worker/v64-59-canonical`).
3. Informar um **token dummy** (default `audittoken0006`) — nunca token real de cliente.
4. Baixar o artefato **`whatsapp-og-live-probe`**.

## Artefato

- `summary.json` — status geral, divergências, suspeitas e **recomendação A–F**.
- `matrix.md` — matriz comparativa legível (status/og:image/script/no-store/cache/sha256).
- `headers/*.txt` — headers de cada `/share` × UA.
- `bodies/*.html` — HTML da `/share` **truncado** (primeiros 8 KB; conteúdo estático, sem dados de cliente).
- `images/*.headers.txt`, `images/*.sha256.txt` — headers/hash da imagem OG por UA.

## Recomendação automática (legenda)

- **A** server OK → suspeitar app/config/cache do WhatsApp Business
- **B** domínio custom diverge de workers.dev (cache/route Cloudflare)
- **C** WhatsApp UA recebe resposta diferente do navegador
- **D** imagem OG falha para o UA do WhatsApp
- **E** headers/cache suspeitos (x-robots-tag/CSP/no-store live)
- **F** HTML live não corresponde ao esperado (deploy/cache/route)

> Read-only: o workflow **não altera nenhum produto**, Worker funcional, Desktop,
> Firestore ou configuração. É apenas observação.
