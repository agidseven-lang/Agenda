# SETTINGS INVENTORY — Desktop Configurações (baseline 1.0.163)

Fase **F3.3.73I6C13** — diagnóstico READ-ONLY do módulo Configurações. **Nenhum código alterado.**
Fonte: `desktop/src/renderer/index.html` (baseline 1.0.163 @ `7a45d90`). Função principal: `renderConfig()` (L7430),
sheets `openSheet()` (L7468), handlers de clique (L7826–7843), modais de conta `openChangePasswordModal`/`openChangeEmailModal`/`openAdminEmailModal` (auth endpoints).

## Achado-chave
- Os itens "pendentes" que o owner viu são **rótulos "Em breve"** (helper `soon()` — pill com relógio, `cursor:default`, **não-clicável**). **NÃO são botões mortos/enganosos** — são placeholders honestos.
- Todas as **ações reais funcionam** e passam por **IPC/endpoints seguros** (`notifTest`, `trayRecreate`, `authChangePassword/Email/AdminEmail`). **Zero escrita Firestore direta** em Configurações.
- Configurações **não toca** Agenda, Board/Kanban nem Card Premium → mexer aqui é **isolado/baixo risco**.

## Matriz funcional (por seção)
Legenda status: **FUNC** (ação funciona) · **INFO** (linha informativa read-only) · **SOON** (placeholder "Em breve", inerte).

| # | UI | Responsável | Status | Dependência | Recomendação |
|--|--|--|--|--|--|
| 1 | Conta › Seus dados | `openSheet('conta')` + `data-chemail`→`authChangeEmail` | **FUNC** | endpoint changeEmail | Manter |
| 2 | Atualizar dados pessoais | `soon()` | SOON | backend perfil | **Ocultar** (não pronto) |
| 3 | Assinatura / plano | `soon()` | SOON | billing (inexistente) | **Ocultar** (fora de escopo) |
| 4 | Segurança da sessão | `openSheet('seguranca')` + `data-chpw`→`authChangePassword` + logout | **FUNC** | endpoint changePassword | Manter (rever rótulo "s2/SHA-256" — legado) |
| 5 | 2FA | `soon()` | SOON | backend auth 2FA | **Ocultar** / fase futura |
| 6 | Sessões e dispositivos | `soon()` | SOON | backend session mgmt | **Ocultar** / fase futura |
| 7 | Dados coletados | `info()` | INFO | — | Manter |
| 8 | Testar notificação | `data-cfgnotiftest`→`notifTest` | **FUNC** | IPC notif | Manter |
| 9 | Lembretes | `info()` | INFO | — | Manter |
| 10 | Notificações de tarefas | `soon()` | SOON | preferências/backend | **Ocultar** / fase futura |
| 11 | Versão do aplicativo | `info()` (`desktopAPI.version`) | INFO/FUNC | IPC app-version | Manter |
| 12 | Bandeja › status | `cfgTrayRowHtml()` (IPC tray-status) | **FUNC** | IPC tray | Manter |
| 13 | Recriar ícone da bandeja | `data-cfgtrayrecreate`→`trayRecreate` | **FUNC** | IPC tray-recreate | Manter |
| 14 | Onde encontro o ícone? | `info()` | INFO | — | Manter |
| 15 | Fechar (X) × Sair | `info()` | INFO | — | Manter |
| 16 | Tema › Escuro (premium) | `info()` | INFO | — | Manter |
| 17 | Tema claro | `soon()` | SOON | **client-side viável** (CSS) | **Corrigir 1.0.164** ou ocultar |
| 18 | Tamanho da fonte | `soon()` | SOON | **client-side viável** (zoom/CSS) | **Corrigir 1.0.164** ou ocultar |
| 19 | Alto contraste | `soon()` | SOON | **client-side viável** (CSS) | **Corrigir 1.0.164** ou ocultar |
| 20 | Sincronização | `info()` | INFO | — | Manter |
| 21 | Limpar cache | `soon()` | SOON | client (definir escopo) | **Ocultar** (ambíguo) |
| 22 | Otimizar uso de dados | `soon()` | SOON | indefinido | **Ocultar** (fora de escopo) |
| 23 | Idioma › Português (Brasil) | `info()` | INFO | — | Manter |
| 24 | Formato de data | `info()` | INFO | — | Manter |
| 25 | Formato de hora | `info()` | INFO | — | Manter |
| 26 | Outros idiomas e moeda | `soon()` | SOON | i18n (grande) | **Ocultar** / fase futura |
| 27 | Alterar e-mail de usuário (admin) | `data-cfgadminemail`→`authAdminChangeUserEmail` | **FUNC** | endpoint admin (gated `u.admin`) | Manter |
| 28 | Sessão › avatar/nome/função | display | INFO | — | Manter |
| 29 | Sobre o aplicativo | `openSheet('sobre')` | **FUNC** | — | Manter |
| 30 | Sair da conta | `data-logout`→`logout()` | **FUNC** | (auto-login pós-logout = item aberto C11) | Manter (fix no diagnóstico separado) |

## Contagem
- **Total de itens:** 30.
- **Funcionais (ação que funciona):** 8 (itens 1,4,8,12,13,27,29,30).
- **Informativos (read-only OK):** 11 (7,9,11,14,15,16,20,23,24,25,28).
- **"Em breve" (placeholder honesto, inerte):** 11 (2,3,5,6,10,17,18,19,21,22,26).
- **Parciais que quebram / mortos enganosos:** **0**.
- **Inseguros (write direto/leak):** **0**.

## Buckets de decisão (para 1.0.164)
- **Corrigir agora (client-side viável, sem backend):** Tema claro (17), Tamanho da fonte (18), Alto contraste (19) — só se o owner quiser; senão ocultar.
- **Ocultar (não pronto / fora de escopo):** 2,3,5,6,10,21,22,26 (8 linhas). Zero risco funcional (linhas inertes).
- **Manter como está:** as 8 ações + 11 informativos.
- **Depende de fase futura (backend):** 2FA (5), Sessões e dispositivos (6), Assinatura/plano (3), Notificações de tarefas (10), i18n (26).

## O que Configurações toca (risco)
- **Sessão/login/logout:** SIM (4, 30) — funcional, via endpoints seguros. **Ocultar "Em breve" NÃO afeta login/logout.**
- **Usuários/permissões:** admin email (27), gated por `u.admin`. Nenhuma linha "Em breve" mexe em permissão.
- **Notificações:** Testar (8, funcional); "Notificações de tarefas" (10, Em breve).
- **Tema/aparência:** 17/18/19 (Em breve, client-side).
- **Firestore/Functions/Worker/Card Premium/Agenda/Board:** **NÃO tocados** por Configurações.
- **Risco geral de uma fase de conclusão:** **BAIXO** — módulo isolado; ocultar placeholders = risco nulo; implementar aparência = risco baixo (renderer/CSS), exige teste de regressão visual.

## Arquivos que precisariam ser alterados numa fase 1.0.164
- **Somente** `desktop/src/renderer/index.html` (função `renderConfig()` + eventuais handlers/CSS de tema). Nenhum arquivo de main/preload/Functions/Rules necessário para ocultar placeholders ou implementar aparência client-side.

## Bugs reais / inconsistências
- Nenhum botão quebrado. Inconsistência **cosmética** menor: subtítulo "Segurança da sessão › Login custom (s2 / SHA-256)" é rótulo **legado** (o login hoje é server-side via `loginUser`); ajuste de texto opcional na 1.0.164.
