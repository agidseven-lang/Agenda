# MONITORING LOG — F3.3.73I6C9 (Desktop 1.0.162, D+0)

Registro **read-only** do monitoramento pós-release. Complementa `MONITORING-CHECKLIST-D0-D7.md`
(que permanece como template a ser preenchido pelo owner nas observações de uso real).

## Data de referência
- **Hoje: 2026-07-14** · release publicada 2026-07-14 (~21:43 UTC) → estamos em **D+0**.
- **D+1 (15/07), D+3 (17/07), D+7 (21/07): datas futuras → NÃO APLICÁVEIS AINDA.**

## D+0 — Verificações READ-ONLY (o que Claude PODE confirmar)
| Item | Resultado |
|---|---|
| Release `desktop/v1.0.162-production` acessível | **OK** (id 354094216) |
| prerelease / draft / immutable | false / false / **true** (estado estável, não editável) |
| Assets (4) uploaded | **OK** — EXE, MSI, SHA256SUMS.txt, VERSAO-DESKTOP.txt |
| Digest EXE == `sha256:5bbd937a…64069` | **MATCH** |
| Digest MSI == `sha256:d123b15c…721f1a` | **MATCH** |
| Hashes documentados (HASHES-ARTIFACTS / PUBLISH-RECORD) | **OK** |
| GitHub Actions — falhas novas afetando produção | **NENHUMA** (só no-op pré-desarme de d9r2/f3371b) |
| Ops-branch — falsos vermelhos novos | **NENHUM** (push-triggers desarmados na C7; ce8cdf5 gerou 0 runs) |
| Functions onEventCreated/Updated/Deleted | **ativas** (inalteradas) |
| Downloads dos assets (exe/msi) | 1/1 — provavelmente a re-verificação do publicador; **não** comprova uso real |

## D+0 — Itens de RUNTIME (só o owner PODE observar; NÃO fabricados)
Instalar/login/Agenda/criar/editar/iniciar/finalizar/cancelar/mostrar-cancelados/excluir-definitivamente/
confirmação EXCLUIR/notificações server-side/sincronização Desktop↔Android/Board-Kanban/Card Premium/
Equipe-Perfil/Tray/ausência-Chat/ausência-Copywriting/sem-tela-branca-crash:
- **PENDENTE de observação do owner** em máquinas autorizadas já atualizadas para 1.0.162.
- Não posso instalar EXE/APK, logar nos apps nem observar push/uso real deste ambiente — por isso estes itens
  ficam para o owner registrar no template. **Nenhum resultado de runtime foi reportado até agora.**

## Incidentes
- **Nenhum incidente reportado** até 2026-07-14 (D+0). Registro de bugs vazio.

## Classificação de severidade (referência; nada a classificar no momento)
CRÍTICO (login/abertura/Agenda/apagar dados/notificar errado/Card Premium → rollback) ·
ALTO (função principal falha com contorno) · MÉDIO (visual/fluxo) · BAIXO (texto/alinhamento).

## Recomendações (D+0)
- **Rollback:** **NÃO recomendado** — não há falha crítica comprovada; release íntegra; Actions saudável.
- **Hotfix:** **NÃO recomendado** — sem bug real.
- **Ação:** owner segue a observação de uso real por D+1/D+3/D+7 no `MONITORING-CHECKLIST-D0-D7.md`;
  posso re-auditar a infra (release/Actions) a pedido. Se surgir bug real, abrir fase cirúrgica de hotfix;
  se estável em D+7, seguir para o encerramento formal (C10).
