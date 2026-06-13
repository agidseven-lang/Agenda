# F0 — PLANO OPERACIONAL DE VALIDAÇÃO (única fase autorizada)

**Escopo: instalar e validar 1.0.146 (Desktop + Android), validar fluxo
social→designer, atribuição formal, status em tempo real e notificação básica;
executar a triagem das 16 tarefas NO APP. Zero código, zero build, zero deploy.**

Decisões registradas p/ F1 (futura, NÃO autorizada): Roteiro = opção B (handoff
manual p/ Edição de Mídia) · Copywriting = hide-only sem migração · SLA 30/30.

Instaladores (builds de 12/06, artifacts válidos até 12/07/2026):
- Desktop: run 27410792474 → artifact `agenda-id-seven-desktop-1.0.146-beta-board-rebuild-installer`
- Android: run 27410559781 → artifact `idseven-nativebeta-1.0.146-beta-board-rebuild` (versionCode 126)

## 1. Checklist final — Desktop (PC do gestor; depois 1 PC por social)
- [ ] D1. Versão antiga fechada pela bandeja (botão direito → Sair) antes de instalar.
- [ ] D2. Instalado pelo `.exe` (SmartScreen: Mais informações → Executar assim mesmo).
- [ ] D3. Tela de login exibe rótulo 1.0.146.
- [ ] D4. Login com conta SOCIAL MEDIA funciona; Hub carrega.
- [ ] D5. Quadro abre com as 16 tarefas reais (8 copy + 8 design) visíveis em "A Fazer".
- [ ] D6. Chips (Meu quadro/Cliente/Designers/Social/Setores) na toolbar do quadro; trocar de aba e voltar não some/duplica.
- [ ] D7. Criar tarefa de teste funciona (título "TESTE F0 — pode apagar").
- [ ] D8. Campo de responsável aceita marcação; data/hora de início e término aceitam edição.
- [ ] D9. "Enviar ao designer" abre e lista os designers.
- [ ] D10. App minimizado fica vivo na bandeja (necessário para toasts).

## 2. Checklist final — Android (celular do gestor; depois 1 por designer)
- [ ] A1. APK transferido e instalado (Apps desconhecidos permitido; Play Protect: Instalar assim mesmo).
- [ ] A2. Instalou AO LADO do app oficial (ícone nativebeta separado).
- [ ] A3. Login/perfil exibe 1.0.146-beta-board-rebuild.
- [ ] A4. Permissão de NOTIFICAÇÕES concedida (pop-up ou Configurações→Apps→Notificações).
- [ ] A5. Bateria: "Sem restrições"/"Não otimizar" para o app.
- [ ] A6. Login com conta DESIGNER funciona.
- [ ] A7. "Meu quadro" abre (colunas A Fazer/Em andamento/Entregue).
- [ ] A8. As tarefas do PC aparecem iguais no celular (mesmo conteúdo).

## 3. Teste social → designer (passo a passo, com resultado esperado)
Preparação: PC logado como SOCIAL, celular logado como DESIGNER, relógio dos dois certo.
1. PC: criar tarefa "TESTE F0 — fluxo designer", setor Edição de mídia, cliente qualquer.
   → tarefa aparece no quadro do PC em "A Fazer".
2. PC: definir data/hora de início = agora+1h e término = amanhã.
   → datas salvas e visíveis no card/detalhe.
3. PC: "Enviar ao designer" escolhendo o designer logado no celular.
   → sem erro; detalhe mostra o designer atribuído (atribuição formal gravada).
4. Celular: em até ~10s a tarefa aparece em "Meu quadro" → "A Fazer".
5. Celular: notificação push recebida (ver teste 5).
6. PC (segundo PC ou após relogin como o designer, se houver): toast nativo de atribuição.
   (Se só houver 1 PC, este sub-item é coberto no piloto FASE B — anotar N/T.)

## 4. Teste de status em tempo real
Com PC (social) e celular (designer) ABERTOS lado a lado, na tarefa do teste 3:
1. Celular: mover para "Em andamento". → PC reflete em segundos, SEM recarregar.
2. Celular: mover para "Entregue". → PC mostra estado entregue/aguardando a social.
3. PC: editar o título da tarefa. → celular reflete em segundos.
4. PC: concluir/validar a tarefa. → os dois lados ficam consistentes.
Critério: nenhuma divergência entre PC e celular após cada passo (esperar até 30s
antes de declarar falha; anotar o tempo observado).

## 5. Teste de notificação básica (SOMENTE o que existe na 1.0.146)
Cobre N1 (atribuição). NÃO testar: push de mudança de status p/ social, alertas
laranja/vermelho, push ao cliente — não existem nesta versão (vão p/ F1+/F3+).
1. Android com app ABERTO: social atribui nova tarefa → notificação aparece.
2. Android com app FECHADO (deslizado da lista de recentes): nova atribuição →
   push chega (pode levar segundos a ~1min; FCM).
3. Android com TELA BLOQUEADA: nova atribuição → notificação na tela de bloqueio
   (conforme configuração do aparelho; se o aparelho ocultar conteúdo, vale o ícone).
4. Tocar na notificação → app abre na área correta.
5. PC (designer logado, app na bandeja): atribuição → toast nativo do Windows;
   clique no toast traz a janela e abre o quadro.
Cada cenário: anotar PASS/FAIL + tempo até chegar + print.

## 6. Registro de evidência (padrão único)
- Uma pasta `F0-evidencias/` (Drive ou local) com subpastas `desktop/`, `android/`,
  `fluxo/`, `triagem/`.
- Nome do arquivo: `<item>-<resultado>.png` (ex.: `D3-pass.png`, `A4-fail.png`).
- Prints obrigatórios: D3 e A3 (rótulos de versão), passo 3.3 (designer atribuído),
  4.1 (PC refletindo), 5.2 e 5.3 (push fechado/bloqueado), ata da triagem.
- Planilha-índice com colunas: item · PASS/FAIL/N-T · observação · arquivo.
- Ao final, me cole a planilha (ou os FAIL com prints) para o laudo de F0.

## 7. Triagem das 16 tarefas USANDO o app (roteiro já aprovado, agora in-app)
Pré-condição: itens D1–D8 PASS (o app é a ferramenta da triagem).
1. Reunião de 30 min conforme roteiro aprovado (ordem: 7 paradas há 8–30d → 6 de
   3–7d → 3 recentes; copy antes de design).
2. Para cada decisão, executar NO APP na hora, projetado para todos verem:
   - CANCELAR → concluir/arquivar com nota do motivo;
   - FAZER HOJE → marcar responsável + mover a primeira de cada pessoa p/ "Em andamento";
   - REPACTUAR → editar data/hora de término para a data real + marcar responsável.
3. Conferência final no app: nenhuma tarefa ativa sem responsável; ninguém com
   mais de 2 "para hoje".
4. Ata preenchida (modelo aprovado) + print do quadro pós-triagem em `triagem/`.
5. Checkpoint das 14h e regra "sem dono = invisível" anunciados.

## 8. Critério de APROVAÇÃO de F0 (todos obrigatórios)
1. Desktop: D1–D10 todos PASS.
2. Android: A1–A8 todos PASS.
3. Fluxo social→designer: passos 1–5 PASS (6 pode ser N/T com 1 PC).
4. Tempo real: 4.1–4.4 PASS com sincronização ≤30s.
5. Notificação básica: 5.1, 5.4 e 5.5 PASS; 5.2 PASS; 5.3 PASS ou justificado por
   limitação documentada do aparelho (print da config).
6. Triagem executada NO APP: 0 tarefas ativas sem responsável; ata + prints arquivados.
7. Evidências completas na pasta padrão.
Com 1–7 cumpridos: F0 APROVADA → libera discutir o piloto FASE B e, quando você
autorizar, a microjanela semanal pós-triagem e a especificação da F1.

## 9. Critério de REPROVAÇÃO de F0 (qualquer um reprova)
1. App não instala, não abre ou não loga (D1–D4 / A1–A6 com FAIL).
2. Quadro não carrega as tarefas reais ou PC×Android mostram dados diferentes.
3. Atribuição formal não grava (passo 3.3) ou tarefa não chega ao designer (3.4).
4. Status não sincroniza (>30s repetidamente ou divergência persistente).
5. NENHUM cenário de push funciona no Android (5.1 e 5.2 ambos FAIL).
6. Crash/travamento reprodutível em fluxo essencial.
Reprovação NÃO derruba a triagem por completo: se o app falhar, a triagem é feita
na planilha (plano anterior) e a F0 fica pendente da correção.

## 10. Se alguma etapa falhar
1. NÃO improvisar correção. Congelar o cenário: print/vídeo + item do checklist +
   horário + aparelho/SO + conta usada.
2. Classificar: BLOQUEANTE (itens do critério 9) ou NÃO-BLOQUEANTE (cosmético/
   intermitente — anota e segue).
3. Repetir o passo 1× (afasta falha de rede pontual). Persistiu = registra FAIL.
4. Me enviar o pacote de evidências. Eu diagnostico pela base de código e devolvo
   laudo com causa provável + proposta de correção, que SÓ vira build novo com sua
   autorização explícita (build ≠ deploy; mesmo assim, só autorizado).
5. Falha exclusiva de aparelho (ex.: OEM bloqueando push): documentar a config,
   testar em um segundo aparelho; se o segundo passar, item PASS com ressalva.
6. Enquanto houver FAIL bloqueante aberto, o time NÃO é cobrado a usar o app —
   regra "sem dono = invisível" só entra em vigor com F0 aprovada.
