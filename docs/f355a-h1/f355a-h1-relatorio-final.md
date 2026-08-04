# F3.5.5A-H1 — OBSERVAÇÕES INTERNAS POR TEMA — RELATÓRIO FINAL (45 itens)

Desktop **1.0.218** · base de código 1.0.217 (`311ed81`) · baseline física/rollback imediato **1.0.216** · adicional **1.0.213**
Branch `desktop/f355a-h1-edit-internal-notes-per-theme-1.0.218`

## A. Auditoria e arquitetura (1–8)
1. **Auditoria read-only (34 itens) executada e commitada ANTES de qualquer edição** (`docs/f355a-h1/f355a-h1-checkpoint-auditoria.md`, commit f0ee651): Central de Detalhes, render dos temas, botões de cópia, chevron, modelo de notas, atribuição, Worker, permissões, índices, riscos, plano.
2. **Campo já existia (W-H1)**: `tasks.designerItemNotes` = mapa `{'i<idx>': texto}` — REUTILIZADO como fonte ÚNICA; **nenhum campo concorrente criado** (prova: únicas escritas no app = atribuição (mapa completo, W-H1 intacta) + editor novo (dot-path)).
3. **Identificador estável**: `_i` = índice REAL do array `cronContents` (map ANTES do filter). **Estabilidade PROVADA**: pós-criação NENHUM fluxo adiciona/remove/reordena itens (saveContentEdits reescreve 1:1; saveItemFix edita 1 índice; produção mapeia 1:1; Worker nunca escreve cronContents; criação filtra vazios UMA vez, antes de existir nota; zero sort/reverse/splice no renderer). Não foi necessário ID aditivo.
4. **Persistência**: MESMO caminho da atribuição (`db.collection('tasks').doc(id).update`), agora por **dot-path** `designerItemNotes.i<idx>` — toca SÓ a chave do item; vazio ⇒ `FieldValue.delete()` (mesma semântica de limpeza da W-H1). Retrocompatível com tarefas antigas (mapa ausente é null-safe; dot-path cria o mapa).
5. **Permissões**: botão e salvamento gated por `canSeeAll` (Admin + Social Media via papel) — o MESMO gate vigente da atribuição/edição de tarefa; validado também no caminho de persistência (checagem dentro de `detNoteSave`). Designer = somente visualização (nenhuma permissão específica de edição existia). Cliente não tem acesso ao app.
6. **Privacidade estrutural**: o Worker (portal/HTML//state/Card Premium/OG) tem **ZERO** referência a `designerItemNotes`; serialização por allowlist por item; `history` só recebe append e NUNCA é lido/serializado ao cliente. O dado não é enviado ao navegador do cliente (não é CSS).
7. **Escopo de setores**: cronograma + roteiro (`isClientSector` — mesma infraestrutura e modelo). Edição de mídia (t.videos) e Edição de Cards (campos fixos) têm modelos distintos e ficam FORA, documentado (mesma decisão da W-H1) — sem generalização insegura.
8. **Delta 100% renderer**: só `index.html` (+ versão/suites/provas/docs/workflows). `main/`, `preload/`, `slareminder.html`, `bgnotify.html`, sons, worker, functions e android **byte-idênticos** vs 1.0.217 (gate congelados diff-vazio no CI).

## B. Ícone e editor (9–19)
9. **Lápis profissional por tema** (`svg('editnote')`, classe aprovada `det-acc-cbtn`) na ordem **[Copiar] [Editar] [Expandir]**, com `title`/`aria-label` "Editar observação interna", foco visível e área clicável adequada (provas em 100%/125%/150%).
10. Clicar no lápis **NÃO** expande/recolhe o acordeão (editor mora FORA do `<details>`), **não** copia, **não** fecha a Central, **não** altera status, **não** movimenta a tarefa (prova P2: estado open inalterado).
11. Tema/chevron continuam expandindo/recolhendo; Copiar continua copiando (regressão W-H1 74/74).
12. **Editor inline integrado ao item**: label literal "OBSERVAÇÃO INTERNA PARA O DESIGNER — OPCIONAL" + sub "…Nunca aparece para o cliente." + textarea + Cancelar + "Salvar observação".
13. Textarea preserva **parágrafos/quebras/acentos/emojis/caracteres especiais** (pre-wrap; esc; provas P3/P4 com texto multi-linha e emoji); copiar/colar nativos.
14. **Sem limite arbitrário nem contador**: auditoria provou que NÃO existe limite real no campo hoje (nenhum maxlength/validação) — impor um seria vedado pelo mandato.
15. **Prefill automático** da observação existente ao abrir (P4) e no modal de atribuição (P12).
16. **Nunca perde texto**: `#modalRoot` está FORA de `#app` — snapshots (`renderFromSnapshot→render`) não tocam o modal (prova P3: `render()` durante a edição mantém o texto); reconstruções explícitas do modal capturam e restauram o rascunho (`detNoteCaptureDraft`/`detNoteRestore`).
17. **Um editor ativo por vez**: trocar de tema com texto sujo mostra a mensagem literal "Salve ou cancele esta observação antes de editar outro tema." (P2); sem listeners múltiplos (delegação única no document).
18. **Teclado**: botões nativos `<button type="button">` (Enter/Espaço), trap de Tab da Central preservado, foco RETORNA ao lápis ao salvar/cancelar (P2/P3).
19. **Escalas 125% e 150%**: lápis clicável, editor abre, textarea visível, sem corte horizontal (P13/P14 com PNGs).

## C. Salvamento (20–27)
20. Salvar valida papel → lê a tarefa VIVA → grava **SÓ** `designerItemNotes.i<idx>` + `history` (prova P3: patch com exatamente 2 chaves) → atualiza a exibição in place → feedback **"Observação salva."**
21. **Nada além disso**: nenhum campo de status/coluna/prazo/Designer/aprovação no patch (assert G1/G2); nenhuma notificação ao cliente; nenhuma nova aprovação; NÃO atribui Designer (contratos G3 + provas).
22. O salvamento funciona **ANTES da atribuição** (o fluxo-alvo do mandato) e a observação permanece disponível quando a Social abrir depois a escolha do Designer (P12).
23. **Feedback verdadeiro**: "Observação salva." só após o `await` do update com sucesso — sem sucesso falso (contrato F6 + prova P15).
24. **Vazio ⇒ remove a chave** (`FieldValue.delete()`); o Designer não vê seção vazia; sem "Sem observação" por item (P6).
25. **Falha de rede/persistência**: mantém o texto digitado, mantém o editor aberto, mensagem literal "Não foi possível salvar. Verifique a conexão e tente novamente.", permite tentar de novo; retry grava (P15).
26. **Conflito multi-computador**: antes de gravar compara o valor vivo com a base do editor; se mudou, NUNCA sobrescreve silenciosamente — avisa ("…alterada em outro computador…"), rebaseia e exige novo Salvar explícito (contrato F8). Edições simultâneas em ITENS diferentes nunca se sobrescrevem (dot-path por chave).
27. **Cancelar**: descarta alterações não salvas com confirmação DISCRETA em 2 cliques ("Descartar alterações?", desarme automático), restaura o texto persistido, fecha o editor, não altera a tarefa, não gera histórico falso nem notificação (P2 + contratos H1–H4).

## D. Exibição, atribuição e vínculo (28–33)
28. **Designer vê** dentro do tema o bloco aprovado da W-H1 ("Observação interna da Social Media", visual interno com borda/acento, pre-wrap, escapado) — parágrafos preservados; SEM lápis e SEM editor no DOM (P8).
29. **Social/Admin** veem e editam (P1/P7); os dois papéis passam pelo mesmo gate server-verified de papel do app.
30. **Atribuição reutiliza** as observações: o modal de prazo prefila cada textarea com a MESMA fonte (sem cópia paralela, sem apagar, sem redigitação; ajustes finais continuam possíveis como na W-H1) e o envio persiste tudo consistentemente (P12 + contratos J1–J4).
31. **Vínculo estável provado nas provas**: editar o TEXTO do tema no mesmo índice mantém a nota no item correto (P10); item esvaziado é ocultado SEM deslocar as notas dos demais (P11); a nota nunca é associada pelo texto do tema (contrato B8).
32. Reenvio de revisão/correções (`saveItemFix`) preserva índices (pad `{}`; contrato K3).
33. Tarefas antigas sem o mapa: tudo null-safe (contrato N1); nenhum backfill necessário.

## E. Histórico, observabilidade e privacidade (34–38)
34. **Histórico interno resumido**: entrada `obs_interna_tema` com label "Observação interna do Tema NN atualizada." + `contentIndex` + `contentLength` — **SEM o texto** (prova P3: JSON do history não contém o conteúdo).
35. **Logs/observabilidade sem conteúdo**: eventos `details.note.opened/cancelled/save_succeeded/save_failed` com allowlist {taskIdHash, itemIndex, action, contentLength, actorRole, appVersion, timestamp} — nunca título/cliente/texto/UID/e-mail/token/caminho (contratos M1–M3 + prova P3/P15); `console.warn` só com o código do erro.
36. **Cliente nunca vê**: portal de aprovação, `/state`, HTML, Card Premium, mensagem do WhatsApp, metadados OG, histórico exibido ao cliente, notificações ao cliente e exportações — o Worker não seleciona o campo (ZERO referências; prova P9 nos bytes reais + contratos L1–L4).
37. O tipo `obs_interna_tema` não existe no Worker (nunca chega ao cliente por nenhuma via).
38. A notificação premium/sino/agrupamento NÃO foram tocados (nenhum produtor novo; zero eventos de notificação nesta fase).

## F. Testes, provas e regressão (39–42)
39. **Suíte f355ah1-internal-notes: 72/72** — a matriz obrigatória de 45 itens do mandato coberta em contratos verificáveis (com/sem observação; adicionar/editar/vazio/cancelar; textos curtos/longos/quebras/emojis/acentos/especiais; 1..20 temas — render é map N; dois editores/1 ativo; snapshot; falha/retry; papéis; tarefa antiga; reordenar/excluir/inserir/editar tema; atribuição; sem movimentação; sem notificação; histórico; sem vazamento; escalas e teclado nas provas).
40. **15/15 provas REAIS Electron** no app EMPACOTADO (app.asar do index REAL; BrowserWindow/preload/cliques delegados reais; PNGs + manifesto sha256 em `docs/f355a-h1-qa/`): P1 lápis (cron 3, roteiro 2, mídia/cards 0, ordem, aria) · P2 editor sem expandir + 1 editor + descarte 2 cliques + foco · P3 salvar (snapshot no meio, dot-path puro, history sem texto, obs sanitizada, foco) · P4 prefill · P5 editar · P6 vazio · P7 Admin · P8 Designer só leitura · P9 worker byte a byte · P10 tema editado · P11 item ocultado sem deslocar · P12 atribuição prefill · P13 125% · P14 150% · P15 falha+retry.
41. **Regressão integral**: f355a 98+38+33+25 (planner/orquestrador/central/integração) + canônica 37+74+53+40 (som imediato/detalhes/cards/sessão) verdes; provas herdadas F3.5.5A 25/25 re-executadas verdes com o renderer novo; congelados diff-vazio (todo o main, preload, slareminder, bgnotify, sons, worker, functions, android).
42. **1.0.217 preservada por inteiro**: Acompanhamento OFF/SOMBRA/ATIVO, alertas amarelo/vermelho/laranja, check-in legado, fila central, sons, "Registrando…", notificações imediatas, card compacto, Central, cópias, aprovação em lote/individual, status Social/Designer, autenticação/sessão/autostart, quantidade personalizada, drag-and-drop/Mover, sino, histórico, Minhas Prioridades, Monitor SLA, watchdog, tray, atualizador, portal, backend e Android — intocados (bases congeladas + suítes + provas).

## G. Build e publicação (43–45)
43. **Build CI gated** (`desktop-build-f355ah1.yml`; `--publish never`): ancestria 311ed81+e509f43+e626d36; versão 1.0.218×3; tsc + sintaxe dos 3 renderers; suíte nova 72 + f355a 4 + regressão 4; provas 15+25 no runner (xvfb); isolamento allowlist; congelados; marcadores; **Gate EMPACOTADO** rodando a PRÓPRIA suíte da fase + wh2 37 + wh1 74 contra os bytes do app.asar — run: 30949340342 (VERDE nos 2 jobs).
44. **Release**: tag v1.0.218 publicada DIRETO no Latest pelo GitHub App "Agenda ID Seven Release Bot" com os MESMOS bytes da run 30949340342 (digests dos 2 artifacts + 5 hashes SHA-256 conferidos no workflow desktop-release-f355ah1.yml antes de publicar; 6 assets: EXE, MSI, latest.yml, blockmap, SHA256SUMS, VERSAO-DESKTOP.txt). SHA-256 EXE d9647bbd8ec147009bdc61afb78f386850b8ce4ded94badc6aa963cc32796002 · MSI 18044254c9ab2f898be62f062e1febfff1da152e3f87566fdec15c6ad675d8dc. Sem prerelease/canal de teste/feed alternativo/download manual; rollbacks v1.0.217/v1.0.216/v1.0.213 preservados (verificados pós-publicação).
45. **DECISÃO: GO TÉCNICO da F3.5.5A-H1** — ícone de editar implementado em cada tema; observação interna opcional; MESMA fonte de dados entre Detalhes e atribuição; observação vinculada ao item correto; Social Media e Admin autorizados; Designer com visualização; cliente sem QUALQUER acesso; nenhuma movimentação de status; nenhuma regressão nas notificações; pipeline integralmente verde. A publicação NÃO é aprovação física — depende da validação física do owner no Windows.
