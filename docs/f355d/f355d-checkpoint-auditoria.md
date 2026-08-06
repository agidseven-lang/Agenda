# F3.5.5D — CHECKPOINT DA AUDITORIA READ-ONLY (A–D, 50 itens)
## Cronogramas Personalizados (quantidade de temas) + Colagem Universal — Desktop 1.0.223

Base auditada: branch `desktop/f355d-custom-cronograma-quantity-universal-paste-1.0.223`
criada em `1eac3672` (tip da 1.0.222 = `9ebc4682` + workflow de release H2).
Nada foi editado antes deste checkpoint.

---

## A. CRONOGRAMA — onde a periodicidade fixa vive (itens 1–15)

1. **Renderização de Semanal/Quinzenal/Mensal**: config estática `TEMPLATES.cronograma.subtypes`
   (`index.html:2802-2805`) com `subLabel:'Periodicidade'` e `contentCount` fixo
   (semanal=3, quinzenal=6, mensal=12). Os CHIPS renderizam na etapa **Briefing**
   (`stepBriefing`, ramo genérico `index.html:10422-10423` — `data-fsub`), porque o
   Cronograma nunca recebeu o tratamento de quantidade personalizada que
   Edição de Vídeos (F3.5.4V, `videoQty`) e Roteiro (F3.5.5C, `scriptQty`) receberam.
2. **Valor salvo**: `f.subtype` → `data.cronSub` (`saveTask`, `index.html:10767`, só `if(f.subtype)`).
3. **Uso do valor**: `curSub()` (`index.html:10283-10292`) devolve o subtipo fixo → `sub.contentCount`
   dirige blocos do Briefing (10428-10431), Revisão (10522-10524), `composedDesc` (10666) e o
   corte/compactação no save (10742: `data.cronContents` = contents preenchidos).
4. **Quantidade de itens gerada**: `sub.contentCount` (3/6/12) — única origem da contagem.
5. **Fonte canônica real**: a jusante do formulário, TUDO é dirigido pelo comprimento REAL de
   `cronContents` (cards `index.html:6820-6832`; Central de Detalhes 7990/8030/8055; progresso
   6373-6397; portal). A periodicidade é só o SEED da contagem no wizard + rótulo derivado.
6. **Array de temas**: `f.contents[]` no form; `task.cronContents[]` persistido (compactado, F3.5.4I).
7. **Revisão**: `stepReview` usa `sub.contentCount` (10522-10524) — contagem, não periodicidade.
8. **Salvamento**: `saveTask` (10718-…) com validação/saneamento F3.5.4I; `cronSub` gravado só se subtype.
9. **Reabertura**: Cronograma NÃO reabre no wizard (não há "Editar tarefa" para cronograma — só
   Edição de Cards tem `data-cardedit`). Edição pós-criação acontece na Central de Detalhes
   (patch `cronContents`, 8085-8098 e 8261-8304) e no fluxo produzir/ajustar (`state._prod`, 8331) —
   ambos dirigidos pelo comprimento real do array (contagem-agnósticos).
10. **Portal (Worker)**: `cloudflare-worker.js` renderiza por `cronWeeks||cronContents` (2416/2489/2554/
    2999/3381 — array, qualquer N). `frequencyLabel` (3350-3365) lê `freq/frequencia/cronFrequency`
    (campos que o Desktop NÃO grava) → fallback literal **"Cronograma"**. Precedente F3.5.5C: roteiro
    custom (sem cronSub) cai no fallback "Roteiro" — vivo em produção desde a 1.0.220. **Nenhuma
    alteração no Worker é necessária.**
11. **Aprovação**: individual e "Aprovar tudo" operam por índice/revisão sobre o array (count-agnósticas).
12. **Tarefas antigas**: docs com `cronSub` semanal/quinzenal/mensal continuam lidos APENAS como rótulo
    (`cronTypeLabel`, 8457-8462; Worker 3362) e nunca regeneram contagem — a contagem exibida sempre
    vem de `cronContents.length`.
13. **Busca/labels derivados**: `cronTypeLabel` (8457-8462) e o chip do card (6832) DERIVAM
    Semanal/Quinzenal/Mensal do comprimento quando não há subtype — heurística legada de EXIBIÇÃO,
    idêntica desde antes da F3.5.5C (roteiro custom já passa por ela hoje). **Mantida byte-idêntica**
    (REGRA MÁXIMA; zero regressão) — documentado no relatório.
14. **Notificações**: nenhum produtor usa periodicidade (payloads usam título/tema/prazos).
15. **Android**: lê tarefas pelo mesmo esquema `cronContents` (array) — quantidade personalizada não
    muda o esquema; **nenhuma alteração Android**.

### CAUSA DA LIMITAÇÃO (item obrigatório)
O formulário de Cronograma ficou na ARQUITETURA ANTIGA de subtipos fixos (chips `Periodicidade`
com `contentCount` 3/6/12 hardcoded em 2802-2805), enquanto Edição de Vídeos (F3.5.4V) e Roteiro
(F3.5.5C) migraram para quantidade personalizada com subtipo sintético. Não há razão técnica para
o limite — todo o pipeline a jusante já é dirigido pelo comprimento real do array.

## B. COLAGEM — causa exata do bloqueio (itens 16–32)

16. **Handlers de `paste` existentes**: (a) editor rico — `document.addEventListener('paste',…,true)`
    escopado a `.rte-ed` (10110-10140): sanitiza HTML (`rteSanitize`) e insere canônico — GLOBAL e
    correto, mas o disparo do EVENTO depende do accelerator nativo; (b) formulário Nova tarefa —
    `f353WirePasteRecovery(c)` ligado SÓ no container do wizard (10593), com guarda `if(!state.form)`.
17. **`preventDefault` relacionados**: só dentro dos handlers acima (para inserir deterministicamente).
    Nenhum `preventDefault` que BLOQUEIE colagem foi encontrado.
18. **Handlers globais de teclado**: 10083 (atalhos do RTE, escopado `.rte-ed`; Ctrl+Z/Y passam),
    10981/10995 (Escape/Enter de cards — não tocam V/Insert), 11759 (Ctrl+Shift+D diagnóstico),
    5751/7546 (Escape em modais). **NENHUM intercepta Ctrl+V/Shift+Insert.**
19-21. **Inputs/textareas/contenteditable**: fora do wizard (Agenda/openEventForm 5664, observações
    internas, Central de Detalhes produzir/ajustar `pr-url` 8342, Configurações 9562-9564, login,
    correção/Revisão) NÃO têm nenhum caminho determinístico de colagem nem menu.
22. **Editor rico**: pipeline COLAR→SANITIZAR→NORMALIZAR→INSERIR→PROJEÇÃO já existe (F3.5.5C) e fica
    INTACTO; só ganha um disparo determinístico (fallback IPC) quando o accelerator nativo falhar.
23. **Menu de contexto**: inexistente no app TODO, exceto o menu DOM próprio do f353 (só wizard).
    `f353-paste-recovery.test.mjs` P14 pina por PADRÃO DE FONTE a presença do listener `contextmenu`
    + guardas `state.form` — o listener será mantido como passthrough (sem `preventDefault`), cedendo
    a superfície ao menu NATIVO (mandato ordena roles nativos).
24. **Preload**: expõe `clipboardReadText` (IPC `clipboard-read-text`, main.ts:1264). NÃO há leitura
    de HTML do clipboard (necessária p/ fallback rico Word/Docs) — será adicionada (read-only, aditiva).
25. **Main**: `mainWin.removeMenu()` (main.ts:500) — **CAUSA-RAIZ PROVADA (herdada da F3.5.3)**: o app
    não tem menu de aplicação nem accelerators de edição registrados; sem fallback, Ctrl+V/Shift+Insert
    dependem exclusivamente do caminho nativo do Chromium, que a evidência física do owner mostra
    falhando nas máquinas reais; botão direito não oferece NADA fora do wizard.
26. **Clipboard**: módulo Electron no main (1264-1300) — read/write text + write image (Card Premium).
27. **CSP**: `index.html` NÃO tem meta CSP (superfícies auxiliares bgnotify/slareminder têm CSP
    restritiva própria). NADA será alterado em CSP; `contextIsolation:true`, `nodeIntegration:false`
    (main.ts:492-497) preservados.
28. **Sanitização**: `rteSanitize` (allowlist; remove script/iframe/on*/javascript:/mso-*/etc.) +
    projeção `richToPlain` — INTOCADOS; campos simples só recebem TEXTO PURO.
29. **Persistência**: campos simples disparam `Event('input')` → bind existente captura (f353InsertPlainText
    já faz); RTE usa `rteSync` — nada novo a persistir.
30. **Revisão/31. Detalhes/32. Portal**: consomem os mesmos campos persistidos — colagem correta
    aparece neles sem mudança adicional.

### CAUSA EXATA DO BLOQUEIO (item obrigatório)
(1) `main.ts:500 removeMenu()` ⇒ sem menu de aplicação, sem roles de edição e sem menu de contexto —
"colar pelo botão direito" é IMPOSSÍVEL em todo o app; (2) o caminho determinístico de Ctrl+V/
Shift+Insert (leitura do clipboard via IPC) existe SÓ no wizard Nova tarefa (guarda `state.form` +
`f353IsTextField` exclui `type=number`); (3) o RTE depende do EVENTO nativo de paste (sem fallback);
(4) demais formulários (Agenda, observações, Central de Detalhes, Configurações, login, correção)
não têm caminho nenhum. Não há listener bloqueando — há AUSÊNCIA de caminho confiável.

## C. FORMULÁRIOS AUDITADOS (itens 33–40)

33. **Cronograma** (wizard steps 0-3; campos título/cliente/subcampos/temas RTE/obs textarea).
34. **Roteiro** (wizard; stepper scriptQty type=number; temas RTE).
35. **Cards** (wizard próprio: fCardsQty number, temas/legendas RTE, datas; edição data-cardedit).
36. **Programação de Posts / produzir-ajustar** (`state._prod`: inputs `pr-url` type=url + uploads).
37. **Edição de Vídeos** (wizard; fVideoQty number; temas `data-vtema` inputs).
38. **Agenda** (openEventForm 5664: título/local/descrição/data/hora).
39. **Observações internas** (editor inline f355ah1; textarea).
40. **Edição de tarefas/correção/Revisão/Configurações/login**: inputs/textareas comuns.
    → TODOS são alcançados por um pipeline UNIVERSAL no `document` (capture) — nenhuma fiação
    por-formulário; campos `readOnly/disabled` EXCLUÍDOS; botões/labels/cards nunca elegíveis
    (`f353IsTextField` reutilizado + guarda rte).

## D. IMPACTO (itens 41–50)

41. **Arquivos a alterar**: `desktop/src/renderer/index.html` (qty cronograma + pipeline universal +
    passthrough f353 menu), `desktop/src/main/main.ts` (wiring menu nativo + IPC clipboard-read-html),
    **NOVO** `desktop/src/main/editContextMenu.ts` (builder DI do menu nativo, testável hermeticamente),
    `desktop/src/preload/preload.ts` (clipboardReadHTML), package.json/lock (1.0.223 + descrição),
    re-pins de suítes herdadas, suíte f355d nova + provas, workflows build/release f355d, docs.
42. **Dependências**: nenhuma nova (Electron Menu/clipboard já disponíveis).
43. **Backend**: NÃO necessário. 44. **Worker**: NÃO necessário (fallback "Cronograma" provado).
45. **Portal**: NÃO necessário (render por array). 46. **Rules**: NÃO. 47. **Android**: NÃO.
48. **Riscos**: (a) duplo-paste se caminho nativo + determinístico rodarem — mitigado: keydown
    determinístico SEMPRE `preventDefault` antes do IPC; paste-event universal também `preventDefault`
    e insere uma única vez; (b) segmentos pinados das suítes f353/f355c — edições são ADITIVAS dentro
    dos segmentos (pins são includes-based) e o listener contextmenu permanece; (c) menu nativo em
    campo readonly — `params.isEditable=false` ⇒ menu não abre; (d) número: `setRangeText` não existe
    em type=number — caminho próprio via commit/onchange com validação visível (nunca corrige em silêncio).
49. **Rollback**: técnico v1.0.222; físico v1.0.218; adicional v1.0.216 (todas publicadas e íntegras).
50. **Funções congeladas** (diff-empty exigido no CI): auth-core (sessão 1.0.221), slaReminder/main
    barreiras H2 (marcadores intactos; main.ts recebe SÓ o wiring aditivo do menu), store/window/rules/
    scheduler/idle/orchestrator, bgnotify.html, slareminder.html, sons, priorityEngine, copy-renderer,
    tsconfig, electron-builder.yml, worker, worker-ops, functions, android. `rteSanitize`/`richToPlain`
    byte-idênticos (pins da f355c continuam passando).

---

## ESTRATÉGIA DA QUANTIDADE (plano cirúrgico)

Porte fiel do padrão APROVADO do Roteiro (F3.5.5C), sob o rótulo do mandato **"Quantidade de temas"**:
- `CRON_QTY_MAX=500` (mesmo limite técnico alto do Roteiro — teto de segurança do documento
  Firestore/UI, com toast claro ao exceder; NUNCA truncamento silencioso);
- `cronQty` no form (`newForm`); `cronQtyOf(f)`: `cronQty` na criação; fallback defensivo em edição
  (`f.id`): comprimento REAL de `contents` → mapa legado {semanal:3,quinzenal:6,mensal:12};
- `synthCronSub(n,f)`: subtipo sintético MESMO contrato (formTitle `Cronograma — N conteúdos`;
  em edição legada preserva label/fields/checklist do subtipo original com contagem REAL);
  criação nova usa fields neutros (Período de referência texto + Canais choice) e checklist genérico;
- `cronQtyCommit`: validação `^\d+$ ∧ ≥1` (`_cqErr` + mensagem EXATA "Informe uma quantidade inteira
  igual ou superior a 1."); aumentar NUNCA toca itens; diminuir com excedente preenchido ⇒ modal
  Cancelar/«Remover e reduzir» (conta itens preenchidos); vazios cortam direto;
- `curSub()`: ramo cronograma → sintético (Copywriting INTOCADO — fora do escopo do mandato);
- stepBriefing: stepper `[−][fCronQty type=number][+]` no lugar dos chips SÓ para cronograma;
- `stepNext`: ao avançar do Briefing com cronograma sem quantidade válida ⇒ bloqueia com a mensagem;
- `saveTask`: inalterado (custom não grava `cronSub`; `cronContents` já compacta preenchidos).

## ESTRATÉGIA DE PASTE + MENU (plano cirúrgico)

1. **Menu de contexto NATIVO** (novo `editContextMenu.ts`, DI `{Menu}`): `webContents 'context-menu'`
   → se `params.isEditable`: popup com Desfazer/Refazer/│/Recortar/Copiar/Colar/│/Selecionar tudo
   (roles nativos `undo/redo/cut/copy/paste/selectAll`, labels PT-BR, `enabled` por `editFlags`,
   Recortar/Copiar exigem seleção). Não editável: sem menu (botões/cards/labels/readonly).
   Ligado em `createWindow` (main.ts) — só a janela principal (única com campos editáveis).
2. **Pipeline universal no renderer** (document, capture): (a) `paste` — campos de texto simples
   (f353IsTextField, não-readonly/disabled, fora de `.rte-ed`): `preventDefault` + inserir SEMPRE
   texto puro no cursor (`f353InsertPlainText`; HTML nunca entra em input/textarea); (b) `keydown`
   Ctrl/Meta+V e Shift+Insert — determinístico via IPC: texto simples → `f353PasteFromClipboard`;
   `.rte-ed` → `clipboardReadHTML`+`clipboardReadText` → MESMO pipeline sanitizado do RTE
   (`_rtePasteApply`, refatorado do listener existente sem mudança de comportamento);
   `type=number` (fCronQty/fScriptQty/fVideoQty/fCardsQty/Configurações) → texto do clipboard
   entregue ao `onchange` do campo (commit valida; letras/decimais/negativos ⇒ mensagem visível;
   sem correção silenciosa); (c) fora de campo editável: NADA (sem ação indevida).
3. **f353**: funções e wiring PRESERVADOS (suíte f353 continua verde); bloco (3) vira passthrough
   comentado (o menu DOM f353Ctx é substituído pelo menu nativo — superset em todos os campos).
4. **Atalhos**: Ctrl+C/X/A/Z/Y continuam NATIVOS nos campos (nenhum interceptador novo); roles do
   menu cobrem as mesmas ações; atalhos do RTE (Ctrl+B/I/U/K) intactos.

## ESTRATÉGIA DE SANITIZAÇÃO
Inalterada e reforçada: campos simples SÓ texto puro (esc/insert por setRangeText); RTE mantém
`rteSanitize` allowlist (script/iframe/object/embed/form/on*/javascript:/CSS remoto/imagens externas/
mso-* REMOVIDOS; b/i/u/p/br/li/links http-https preservados) + projeção `richToPlain`. IPC novo é
READ-ONLY do clipboard. Nenhum conteúdo de clipboard vai a logs/telemetria.

## COMPATIBILIDADE
Cronogramas antigos: abrem/exibem/editam/salvam/Revisão/Detalhes/portal/aprovação como hoje
(rótulo legado preservado; contagem = array real; sem migração, sem reescrita ao abrir, sem
duplicação). Novos: quantidade livre ≥1. Roteiro/Vídeos/Cards/Copywriting INTOCADOS.

## GO/NO-GO DA AUDITORIA: **GO** — prosseguindo automaticamente para a implementação.
