**Produção controlada validada** — QA físico cross-platform aprovado pelo owner (F3.3.73I6C4, GO). **Substitui a produção controlada 1.0.159** como versão oficial do Desktop.
**Release controlada:** instalar somente em máquinas autorizadas, após conferência de hash. Sem rollout amplo e **sem marcar como *latest*** nesta etapa.

## O que há nesta versão (Agenda compartilhada em tempo real)
- **Agenda compartilhada em tempo real** — mesma base do app Android; alterações refletem entre Desktop e celular ao vivo.
- **Criar compromisso** — CTA "Novo compromisso" na Agenda, com título/cliente/tipo/data/início/término/local/responsável/observações.
- **Editar compromisso** — preserva autor/criação; registra quem editou e quando.
- **Iniciar / Finalizar** — por botão explícito; status passa a **Em andamento** e depois **Finalizado**.
- **Cancelar logicamente** — o compromisso sai da agenda ativa **sem ser apagado** (histórico preservado).
- **Mostrar cancelados** — alternador para reencontrar cancelados e abrir o detalhe.
- **Excluir definitivamente (novo)** — remoção **física** do compromisso, **somente administrador**, em **qualquer** estado (agendado/andamento/finalizado/cancelado).
- **Confirmação forte** — aviso *"Esta ação é permanente e não poderá ser desfeita."* e exigência de digitar **EXCLUIR** antes de remover.
- **Status visual** — Agendado / Em andamento / Finalizado / Cancelado no card e no detalhe.
- **Notificações server-side** — criação, lifecycle e exclusão definitiva notificam pelo servidor (o autor da ação não é notificado).

## Preservado (regressões protegidas)
- **Chat removido** do fluxo principal e **Copywriting removido** da criação de tarefa — mantidos.
- Board/Kanban canônico, Card Premium WhatsApp, link do portal, Equipe, Perfil, troca de e-mail e bandeja/tray — intactos.

## Artefatos e hashes oficiais (SHA-256)
| Arquivo | SHA-256 |
|---|---|
| `Agenda-ID-Seven-Desktop-1.0.162-x64.exe` | `5bbd937afedb412faca874faac4b9df5df2f8bd6aa30106cc5ddad1e28fb4069` |
| `Agenda-ID-Seven-Desktop-1.0.162-x64.msi` | `d123b15c24049b5c6bfba701450c67ce186e9723f9752a2e741a677057721f1a` |

## Instalação (somente máquinas autorizadas)
1. Baixe o `.exe` (ou o `.msi`) desta release.
2. Confira o hash: `certutil -hashfile "Agenda-ID-Seven-Desktop-1.0.162-x64.exe" SHA256` — deve ser **exatamente** o da tabela. Se divergir, **não instale** e reporte.
3. Feche o app atual (bandeja → botão direito → **Sair**) e execute o instalador com **um** duplo clique. Se o SmartScreen avisar: **"Mais informações" → "Executar assim mesmo"**.
4. Após instalar, abra o app e confirme **1.0.162** em Configurações → Sobre e no Perfil.

## ⚠️ Aviso — Smart App Control / assinatura digital
O instalador **ainda não é assinado digitalmente**. Em máquinas com **Smart App Control ativo** (Windows 11), o Windows **pode bloquear a instalação sem opção de prosseguir**. Instale somente em máquinas autorizadas, sempre após conferência de hash.

## Limitação conhecida (notificações)
- O Desktop recebe notificações enquanto estiver **aberto, minimizado ou na bandeja**. Se você "Sair" pela bandeja, o Desktop não recebe até reabrir (não há backend de push dedicado para Desktop nesta arquitetura). O celular (Android) recebe via FCM conforme as permissões do aparelho.
- As notificações **excluem o autor da ação** (quem cria/edita/exclui não é notificado; os demais usuários ativos sim).

## Android
- **Fora desta release.** O app Android da Agenda C3A foi validado como **APK debug para sideload/uso interno controlado** (artifact de CI), e **não** é publicado aqui nem na Play Store. Um pacote Android de produção exige build release assinada em fase própria.

## Rollback
- Rebaixar **apenas em caso de falha crítica**, **reportando antes**.
- Versão de rollback oficial: **1.0.159** (release `desktop/v1.0.159-production`, preservada) — confira o hash naquela página antes de reinstalar (EXE `f772de61c8f11e444a5089a9dbdefb9370ecb03f9cf242c54f5dea1bcf9312f1`).

## Procedência do build
- Workflow **desktop-build (Windows)**, run id `29353487838`, concluído com sucesso; gates de tray e de prova-de-versão (asar-aware) aprovados.
- Fonte: branch `desktop/f3373i6c3a-permanent-delete` @ commit `f1101df`.
- Backend: Firebase Functions `onEventCreated` / `onEventUpdated` / `onEventDeleted` já deployadas. **Nenhuma alteração de Worker/Card Premium, Firestore, Rules ou Hosting nesta release.**
