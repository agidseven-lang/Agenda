# PLANO ESTRATÉGICO — ADOÇÃO DAS BETAS 1.0.146 (trilho principal; SEM código)

**Por que este plano:** o baseline real provou que o modelo legado registra a
FILA mas não a EXECUÇÃO (16 tarefas, todas `afazer`, todas sem responsável,
zero movimentação, zero concluídas). Os atrasos que motivaram o projeto vivem
no trecho invisível. O eixo designer das betas é o que torna a execução
mensurável — e é pré-requisito da 4.4-B.

## FASE A — Validação final das betas (estado: em reteste seu)
1. Concluir seu reteste manual do Desktop 1.0.146-beta-board-rebuild (checklists
   já definidos) e do APK 1.0.146 (versionCode 126) no celular real.
2. Critério de saída: aprovação visual/funcional sua, sem regressões.

## FASE B — Piloto controlado (1 social + 1 designer, 1 semana)
1. Instalar Desktop beta na máquina da Social piloto; APK no designer piloto.
2. Fluxo-alvo COMPLETO dentro do app, para cada demanda do piloto:
   - criação da tarefa (Nova tarefa) → **atribuição FORMAL** ao designer via
     "Enviar ao designer" (modal já grava designerAssignment + prazos início/
     término + semente designerSla);
   - designer **inicia** movendo para "Em andamento" (grava startedAt);
   - movimentações reais (Revisão/Ajuste ⇄ Em andamento → Entregue);
   - prazos do designer SEMPRE preenchidos no modal (data/hora início e término).
3. Regra do piloto: nenhuma demanda do par piloto fora do app.
4. Medição da semana: micro-janela `/sla-dryrun` (read-only) — agora com dados:
   `scanned>0`, WIP observado real, retroIgnored real. Compara com a fila legado.

## FASE C — Expansão (toda a equipe, 2ª semana)
1. Desktop beta para todas as Socials; APK para todos os designers.
2. Congelar criação de demandas de design/copy fora do app (decisão de gestão).
3. Micro-janelas read-only 2x/semana para acompanhar adoção: % de tarefas novas
   com designerAssignment; % com início registrado; WIP por designer.
4. Critério de adoção atingida: ≥80% das demandas novas com atribuição formal
   E ≥80% com movimentação real (started/entregue) por 5 dias úteis seguidos.

## FASE D — Definição do SLA_ACTIVATED_AT
- Valor = epoch ms do dia em que o critério da FASE C foi atingido (proposta:
  00:00 local desse dia). Efeito: zero rajada retroativa por construção —
  só eventos de prazos/tarefas posteriores à adoção são elegíveis.

## CRITÉRIOS MÍNIMOS PARA AUTORIZAR A 4.4-B (gate objetivo)
1. Betas aprovadas por você (FASE A) e adoção atingida (FASE C).
2. Duas micro-janelas `/sla-dryrun` consecutivas com `scanned>0`, diagnostics
   limpos e wouldNotify/wouldLock coerentes com a realidade observada.
3. WIP soft/hard calibrados com os dados reais (substituindo o chute 2/2).
4. `SLA_ACTIVATED_AT` definido (FASE D) e aprovado por você.
5. Escopo da 4.4-B continua o mínimo: escrita real APENAS de `slaEvents`
   (medição) — push/bloqueio/painel/UI seguem proibidos até nova autorização.

## O QUE NÃO MUDA NESTE PLANO
Zero mudança de UI/Desktop/Android além das betas JÁ construídas e aprovadas;
zero Rules; zero push; zero bloqueio; lente legado (V64.58/59) segue como
termômetro até a FASE C e é descontinuada depois.
