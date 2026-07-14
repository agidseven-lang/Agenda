# MONITORING CHECKLIST — Desktop 1.0.162 (D+0 → D+7)

Acompanhamento de uso real da produção controlada. Preencha ○ com OK/FALHA/N-A em cada checkpoint.
**Não é deploy nem alteração** — apenas observação em máquinas autorizadas já atualizadas para 1.0.162
(conferir versão em Configurações → Sobre / Perfil).

## Cadência
- **D+0** (dia da distribuição): smoke completo logo após instalar.
- **D+1**: reteste rápido + coleta de erros do 1º dia de uso.
- **D+3**: reteste de fluxos de exclusão/notificação sob uso real.
- **D+7**: fechamento — estabilidade e decisão de próxima linha.

## Itens (17) por checkpoint
| # | Item | D+0 | D+1 | D+3 | D+7 |
|---|---|---|---|---|---|
| 1 | Login | ○ | ○ | ○ | ○ |
| 2 | Agenda abre / tempo real | ○ | ○ | ○ | ○ |
| 3 | Criar compromisso | ○ | ○ | ○ | ○ |
| 4 | Editar compromisso | ○ | ○ | ○ | ○ |
| 5 | Iniciar compromisso | ○ | ○ | ○ | ○ |
| 6 | Finalizar compromisso | ○ | ○ | ○ | ○ |
| 7 | Cancelar logicamente (não apaga) | ○ | ○ | ○ | ○ |
| 8 | Excluir definitivamente (admin + EXCLUIR) | ○ | ○ | ○ | ○ |
| 9 | Notificações lifecycle (usuários distintos) | ○ | ○ | ○ | ○ |
| 10 | Board/Kanban | ○ | ○ | ○ | ○ |
| 11 | Card Premium WhatsApp | ○ | ○ | ○ | ○ |
| 12 | Equipe | ○ | ○ | ○ | ○ |
| 13 | Perfil | ○ | ○ | ○ | ○ |
| 14 | Tray/bandeja (ícone visível; Sair encerra) | ○ | ○ | ○ | ○ |
| 15 | Ausência de Chat | ○ | ○ | ○ | ○ |
| 16 | Ausência de Copywriting na criação | ○ | ○ | ○ | ○ |
| 17 | Erros reportados por usuários | ○ | ○ | ○ | ○ |

## Notas para interpretar corretamente
- **Notificações (item 9):** o autor da ação **não** é notificado — use **dois usuários** (um no Desktop, outro no Android) para observar o push. O Desktop só recebe com o app **aberto/minimizado/na bandeja** (ver limitações).
- **Excluir definitivamente (item 8):** só aparece para **admin**; exige digitar **EXCLUIR**; funciona em qualquer estado; o documento some dos dois lados em tempo real.
- **Real-time ≠ push:** a lista atualiza ao vivo nos dois lados mesmo sem push; o push é o sinal separado (item 9).

## Registro de bugs (por checkpoint)
| Data | Severidade (crítico/alto/médio/baixo) | Descrição | Passos | Decisão (rollback? corrigir?) |
|---|---|---|---|---|
|  |  |  |  |  |

## Critério de escalonamento
- **Bug crítico** (perda de dado, crash recorrente, notificação errada a usuário errado, exclusão indevida) → abrir **fase de resposta** e considerar **rollback para 1.0.159** (ver `ROLLBACK-RUNBOOK-1.0.162.md`).
- Bug não-crítico → registrar e agrupar para uma **fase de melhorias pós-release**.
