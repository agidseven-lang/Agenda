# Agenda ID Seven — Web Preview (homologação LOCAL)

**Versão:** `1.0.64-web-preview` · commit `7ddbd44` · ref `app/main`

Cópia **isolada** do PWA para testar no navegador do computador.
**Não é produção.** Não substitui `agendaidseven.com.br`. Não faz deploy.

## O que muda em relação à produção
- "Copywriter" → **"Copywriting"** (alinhado ao app nativo) — 12 ocorrências.
- Rodapé do login mostra **"Web Preview 1.0.64 · commit 7ddbd44 · ref app/main"**.
- Selo flutuante **"Web Preview 1.0.64"** visível durante o uso.
- **Service Worker e Push FCM desativados** nesta cópia (evita cache preso e ruído de push no localhost).
- Usa a **mesma base Firebase** (`agenda-id-seven`) — **sem mudança de schema**.

O layout **desktop responsivo já existia** no PWA (sidebar lateral a partir de 1024px,
painéis viram modal a partir de 900px). Nada disso foi reescrito nesta etapa.

## Como rodar no computador

A partir da **raiz do repositório** (a pasta que contém `web-preview/`):

### Python (já vem no Mac/Linux; no Windows instale do python.org)
```bash
python3 -m http.server 8000
```
Depois abra no navegador:
```
http://localhost:8000/web-preview/
```

### Alternativa com Node (se preferir)
```bash
npx serve -l 8000 .
# abra http://localhost:8000/web-preview/
```

> Importante: rode o servidor na **raiz do repo**, não dentro de `web-preview/`.
> A pasta `web-preview/` é auto-contida (tem seu próprio index.html, ícones, manifest).

## O que dá para testar agora
1. **Login** (e-mail/WhatsApp + senha) — mesma conta da equipe.
2. **Home / dashboard**.
3. **Agenda** (preservada, igual à produção aprovada).
4. **Quadros** e **Kanban** (modelo atual do PWA).
5. **Copywriting** escrito corretamente.
6. **Cronograma** (fluxo atual do PWA, por semanas).
7. **Chat** interno.
8. Layout **desktop** (sidebar lateral em telas largas).

## Limpando o ambiente (se algum dia instalou o PWA de produção neste navegador)
Se este navegador já tem o site de produção como PWA/SW, abra DevTools >
Application > Service Workers > "Unregister", e teste em uma **aba anônima**
para garantir que está vendo o preview, não o cache de produção.
