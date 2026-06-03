# ID Seven — Web Preview 1.0.65 (Paridade APK)

App web de **homologação** que **espelha o app Android (APK 1.0.64)**: mesmo
design (dark/Compose), mesmos fluxos (Login → Hoje → Agenda → Quadros por setor
→ Kanban → Nova tarefa wizard → Cronograma) e a **mesma base Firestore**
(`agenda-id-seven`). **Não é produção.** Não usa o PWA antigo como referência.

## Stack
- HTML/CSS/JS único (sem framework), Firebase Firestore (compat) via CDN.
- Login custom `s2:` + SHA-256 (Web Crypto) — idêntico ao `Crypto.kt` do nativo.
- Sem Firebase Auth, sem Service Worker, sem push (homologação).

## Rodar local
Na raiz do repo: `python3 -m http.server 8000` → `http://localhost:8000/web-preview/`

## Publicado (homologação remota)
Cloudflare Worker separado: **https://idseven-web-preview.agidseven.workers.dev**
(deploy manual via `.github/workflows/web-preview-deploy.yml`, config
`wrangler-preview.toml`). Não toca produção, APK, Functions, Resend, SM ou Rules.

## Telas espelhadas do APK
Login (entrar/criar conta/recuperar) · Hoje (saudação + 3 cards + compromissos +
urgentes + próximos) · Agenda (mês/lista, filtros por tipo, calendário) ·
Quadros (hub por setor) · Kanban por setor (A Fazer/Em andamento/Revisão/
Concluído + mover status) · Nova tarefa (wizard Setor→Dados→Briefing→Revisão) ·
Cronograma (cliente obrigatório; semanal=3/quinzenal=6/mensal=12; Tema+Legenda) ·
Visibilidade por função (admin/social=tudo; designer/freelancer/desconhecido=só
suas) · Equipe · Perfil. Chat aparece como lista da equipe (divergência documentada).
