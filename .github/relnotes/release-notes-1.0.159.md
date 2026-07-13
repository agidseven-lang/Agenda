**Produção controlada validada** — QA físico completo aprovado pelo owner em 13/07/2026 (F3.3.71C8, GO completo, sem bloqueadores).
**Substitui a produção controlada 1.0.153** como versão oficial do Desktop.
**Release controlada:** instalar somente em máquinas autorizadas, após conferência de hash. Sem rollout amplo nesta etapa.

## O que há nesta versão (1.0.154 → 1.0.159, cumulativa sobre a 1.0.153)
- **Chat removido do menu/fluxo principal** (corte de escopo do produto). Nenhum dado foi apagado; a remoção é somente de interface.
- **Copywriting removido da criação de tarefa** (Nova tarefa → Setor agora oferece: Edição de mídia, Cronograma, Roteiro e Programação de posts). Tarefas históricas de Copywriting continuam íntegras e visíveis no Board.
- **Wizard "Nova tarefa" corrigido em definitivo**: shell profissional em coluna com header/stepper fixos, corpo com scroll interno e footer integrado **sem sobreposição**; campos estáveis ao digitar/focar (nada sai do enquadramento).
- **Troca segura de e-mail de login** (Configurações → Conta): senha atual re-verificada no servidor, e fluxo administrativo com confirmação literal e auditoria. **Bloqueios validados**: e-mail duplicado, e-mail inválido e senha errada são recusados pelo servidor.
- **Configurações realinhada** (ícones, pills "EM BREVE", seção Bandeja do sistema) e **Equipe com os 5 integrantes reais**.
- **Instalador Windows aprimorado**: DPI-aware (nítido em 100/125/150%) e com feedback imediato "Preparando o instalador..." no primeiro duplo clique.
- **Aprovados no QA físico**: Card Premium WhatsApp (fluxo de um clique + link estável do portal), link do portal do cliente, Board/Kanban canônico, Agenda, Testar notificação e Tray/bandeja (ícone nunca-invisível + recriação automática).
- **Prova de versão**: todos os rótulos derivam do executável real (`app.getVersion()`); Sobre e Perfil exibem **1.0.159**.

## Escopo desta release
- **Sem Android** (pausado).
- **PWA fora do produto principal.**
- **Nenhuma alteração de servidor**: Worker/Card Premium em produção, Firestore, Rules e Functions intocados.

## Artefatos e hashes oficiais (SHA-256)
| Arquivo | SHA-256 |
|---|---|
| `Agenda-ID-Seven-Desktop-1.0.159-x64.exe` | `f772de61c8f11e444a5089a9dbdefb9370ecb03f9cf242c54f5dea1bcf9312f1` |
| `Agenda-ID-Seven-Desktop-1.0.159-x64.msi` | `a5aa9b5a9f75b914cd2ae7c361a951aa895d8b53ae7e31cfad721b3ed3a7c2f7` |

## Instalação (somente máquinas autorizadas)
1. Baixe o `.exe` (ou o `.msi`) desta release.
2. Confira o hash no Prompt/PowerShell:
   `certutil -hashfile "Agenda-ID-Seven-Desktop-1.0.159-x64.exe" SHA256`
   O valor deve ser **exatamente** o da tabela acima. Se divergir, **não instale** e reporte.
3. Feche o app atual (bandeja → botão direito → Sair) e execute o instalador com **um** duplo clique. Se o Windows demorar a abrir (verificação de arquivo sem assinatura), aguarde 10–30 s sem clicar de novo. Se o SmartScreen avisar: **"Mais informações" → "Executar assim mesmo"**.
4. Após instalar, abra o app e confirme **1.0.159** em Configurações → Sobre e no Perfil.

## ⚠️ Aviso — Smart App Control / assinatura digital
O instalador **ainda não é assinado digitalmente**. Em máquinas com **Smart App Control ativo** (Windows 11), o Windows **pode bloquear a instalação sem opção de prosseguir**. Instale somente em máquinas autorizadas e compatíveis, e sempre após conferência de hash.

## Rollback
- Rebaixar **apenas em caso de falha crítica**, **reportando antes**.
- Versão de rollback oficial: **1.0.153** (release `desktop/v1.0.153-production-rc`, preservada) — confira os hashes daquela página antes de reinstalar (EXE `407d19506aa92d830797be165ccc2c78c7dece287467f430b1c93b3a98791c1a`).
- **As versões 1.0.147–1.0.152 seguem fora de uso.** As intermediárias 1.0.154–1.0.158 foram builds de validação (não são releases).

## Procedência do build
- Workflow desktop-build, run **#211** (id `29251549150`), concluído com sucesso; gates de tray e de prova-de-versão (asar-aware) aprovados.
- Fonte: branch `desktop/f3371c7-scope-cut` @ commit `ef90fa2`.
