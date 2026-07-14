# Release Notes — Agenda ID Seven Desktop **1.0.162** (Release Candidate)

Status: **Release Candidate** (aprovado no owner-run cross-platform F3.3.73I6C4). **Não publicado.**
Build: run `29353487838` · fonte `f1101df` (`desktop/f3373i6c3a-permanent-delete`) · appId `br.com.idseven.agenda.desktop`.
Instalador: `Agenda-ID-Seven-Desktop-1.0.162-x64.exe` / `.msi` — hashes em `HASHES-ARTIFACTS.md`.

## Novidades desta versão (Agenda compartilhada em tempo real)

- **Agenda compartilhada em tempo real** — leitura por `onSnapshot` na coleção `events`; alterações refletem entre Desktop e Android ao vivo.
- **Criar compromisso** — CTA "Novo compromisso" na Agenda; formulário com título/cliente/tipo/data/início/término/local/responsável/observações; grava com `src:"webpreview"` (honesto).
- **Editar compromisso** — atualização preservando `by/createdAt/src/done`; grava `updatedAt/updatedBy`.
- **Iniciar compromisso** — grava `startedAt/startedBy`; status passa a **Em andamento**.
- **Finalizar compromisso** — grava `done/doneAt/doneBy`; status **Finalizado**.
- **Cancelar logicamente** — grava `status:"cancelled"` + `cancelledAt/cancelledBy`; **não apaga** o documento; sai da Agenda ativa.
- **Mostrar cancelados** — alternador "Mostrar/Ocultar cancelados" para alcançar cancelados e abrir o detalhe.
- **Excluir definitivamente (novo)** — remoção **física** do documento de `events`, **somente admin**, disponível em **qualquer** estado (agendado/andamento/finalizado/cancelado).
- **Confirmação forte EXCLUIR** — aviso de irreversibilidade *"Esta ação é permanente e não poderá ser desfeita."* + exigência de digitar **EXCLUIR**; grava `deletedBy/deletedAt` antes do delete físico (para atribuição do ator na notificação).
- **Status visual** — pills Agendado / Em andamento / Finalizado / Cancelado no card e no detalhe.
- **Integração com notificações server-side** — lifecycle e exclusão notificam via Firebase Functions (fan-out `onEventUpdated`/`onEventDeleted`), excluindo o autor da ação. O cliente Desktop **não** faz push próprio.

## Preservado (regressões protegidas)

- **Chat removido** — sem aba de chat no fluxo principal.
- **Copywriting removido** — descontinuado na criação (setores filtram `descontinuado`).
- Board/Kanban canônico, Card Premium WhatsApp, link de portal, Equipe, Perfil, troca de e-mail, bandeja/tray — intactos.

## Limitações conhecidas

- **Notificação com o app totalmente encerrado:** o Desktop usa notificador de processo principal (Firestore `onSnapshot` → notificação nativa). Ele funciona com o app **aberto, minimizado ou na bandeja**. Se você "Sair" pela bandeja, o Desktop **não** recebe notificações até reabrir (não há backend de push dedicado para Desktop — arquitetura atual).
- **Notificações excluem o autor:** quem realizou a ação não é notificado; para observar push em teste, use usuários diferentes em cada aparelho.
- Sem certificado de assinatura de código (SmartScreen avisa na 1ª instalação — esperado em RC).

## Instalação

1. Baixe o artifact `8319234363` (run `29353487838`) e **descompacte**.
2. Confira o SHA-256 do `.exe` (`HASHES-ARTIFACTS.md`). Se não bater, **não instale**.
3. Execute o `.exe` (SmartScreen → "Mais informações" → "Executar assim mesmo").
4. Faça login; o app vive na bandeja (fechar no X apenas minimiza). Para notificações confiáveis, mantenha na bandeja / "Iniciar com o Windows".

## Próximos passos

- Decisão de publicação controlada na fase **F3.3.73I6C6-DESKTOP-ANDROID-RELEASE-PUBLISH-GATE** (tag/latest/distribuição — nada disso é feito nesta fase C5).
