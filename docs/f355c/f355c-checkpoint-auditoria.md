# F3.5.5C — QUANTIDADE PERSONALIZADA DE ROTEIROS E EDITOR RICO DE TEMAS E LEGENDAS
## Checkpoint da Auditoria Read-Only (FASE 1) — Desktop 1.0.220

- **Base de código**: Desktop 1.0.219 (tip `7e54cdf`); **baseline física**: 1.0.218; rollback imediato 1.0.218; adicional 1.0.216. Branch: `desktop/f355c-custom-script-quantity-rich-editor-1.0.220`.
- Método: leitura direta do código real (index.html, cloudflare-worker.js, functions, android-native, workflows), sem edição.

## A. QUANTIDADE (itens 1–15)
1. **Opções fixas** — `TEMPLATES.roteiro.subtypes` q4/q6/q8/q12 (index 2718+), cada um `{label,formTitle,contentCount:4|6|8|12,fields:[],checklist:[4 itens IGUAIS]}`. Chips no Briefing (9689, `data-fsub`).
2. **Campo de subtipo** — `f.subtype` (newForm 9500) → persistido como `cronSub` SÓ p/ setores-cliente (10026). `curSub()` (9566): edicao_midia usa **subtipo SINTÉTICO** (`synthVideoSub(videoQtyOf(f))` — precedente F3.5.4V aprovado); demais usam `t.subtypes[f.subtype]`.
3. **items** — roteiro NÃO usa `sub.items` (só edicao_midia/videoTema). Roteiro usa `sub.contentCount` → blocos de conteúdo.
4. **Estado do formulário** — `state.form` = newForm(); `f.contents[]` = {tema,legenda} por índice; `_openContent` = índice do accordion aberto (UM por vez).
5. **Array de roteiros** — Briefing (9694-9696): `for i<sub.contentCount` → `content-card` accordion com `data-ctema` (input) + `data-cleg` (textarea); binds oninput (9829-9830) → `f.contents[i].tema/legenda`.
6. **Validação** — stepNext (10738): subtipo/quantidade NÃO exigidos p/ avançar (**campo OPCIONAL** — igual videoQty '', que é permitido); título+cliente obrigatórios no passo 1. saveTask compacta: só itens preenchidos entram (10001).
7. **Revisão** — 9786-9791: lista `filled/contentCount` com `esc(tema)`/`esc(legenda)`; `revItem('Subtipo', sub.label)` (9776).
8. **Salvamento** — saveTask (9977): `data.cronContents=f.contents.filter(preenchido)`; `data.desc=composedDesc()` (projeção TEXTO já existente, 9921-9925); `cronSub=f.subtype`; sanitização cronSanitizeDeep + validação + write idempotente + read-back (F3.5.4I) — INTOCADOS.
9. **Reabertura** — o wizard com `f.id` só existe p/ edicao_cards (10135/10160). Cronograma/Roteiro reabrem por superfícies próprias (itens 16-17): a quantidade de uma tarefa existente É `cronContents.length` (fonte real).
10. **Edição** — `openContentEditor`/`saveContentEdits` (8149/8170): reescreve cronContents 1:1 preservando explicitamente `feedImageUrl/storyImageUrl`; `openItemFix`/`saveItemFix` (7953/7978): edita UM campo com `Object.assign({},arr[idx])` (preserva campos desconhecidos) + history com old/new (300 chars).
11. **Tarefas antigas** — q4/q6/q8/q12 em `cronSub` + cronContents com N itens. Todos os consumidores derivam de `cronContents.length` (pendências 6277+, det 6730, produção 8212, portal) — NENHUM lê o número do cronSub para contagem. Compat pela via natural.
12. **Portal** — Worker serializa itens do array (state JSON 2143-2160: `tema`, `legenda` texto puro; overlays `clientItems.i<idx>`); cliente pode **editar a legenda** (editLegenda 2196/2221 — TEXTO PURO server-side). Aprovação individual + Aprovar tudo por índice.
13. **Android** — zero referências a `legenda`/cronContents no app nativo (grep vazio) — sem impacto.
14. **Functions** — push por triggers de tasks/events; corpos fixos; não lêem legenda/tema de cronContents p/ notificação de conteúdo. Sem impacto.
15. **Worker (quantidade)** — nenhuma dependência de 4/6/8/12; itera o array real.

## B. CAMPOS DE TEXTO (itens 16–30)
16. **Tema** — escrito em 4 superfícies: wizard (`data-ctema`), Editar conteúdos (`data-cetema`, 8155), correção pontual (`openItemFix` campo 'tema'), NUNCA na Produção (produção mostra tema fixo 8229).
17. **Legenda** — wizard (`data-cleg`), Editar conteúdos (`data-celeg`), correção pontual ('legenda'), **Produção “Legendas e artes”** (`data-prodleg` 8230 → prodCollect 8257 → saveProduction 8264 — reescreve {tema,legenda,feed,story}).
18. **Eventos** — binds `oninput` idempotentes (re-bind a cada render; sem duplicação); produção usa addEventListener no re-render do modal (recriado por innerHTML — sem vazamento).
19. **Sanitização existente** — `esc()` (2657) em TODA exibição; campos armazenam TEXTO PURO; F3.5.3 cola SEMPRE texto puro em input/textarea (`f353IsTextField` — **não intercepta contenteditable** ✓).
20. **Limites** — sem maxlength; history de saveItemFix trunca old/new em 300 (mantido).
21. **Quebras** — textarea preserva \n; exibições com pre-wrap (det/notes) ou esc simples.
22. **Detalhes** — Central: `det-acc-t` (linha-resumo do tema) + corpo com legenda (+ observação interna) — texto com esc.
23. **Portal** — renderClientHtml (3109) + estado JSON (2143): tema/legenda texto puro; edição do cliente na legenda (texto puro).
24. **Aprovação** — por item (cs) e Aprovar tudo (F3.5.4W-H1) — independem do formato do texto.
25/26. **Copiar tema/legenda** — det-acc-cbtn → `detClipWrite` (texto puro via IPC→navigator→execCommand). Contrato: TEXT/PLAIN limpo (WhatsApp).
27. **Busca** — filtros usam SÓ `title+client` (5841 etc.) — legenda/tema fora da busca hoje.
28. **Notificações** — payloads com título/rotulos; NUNCA legenda. Sem impacto.
29. **Relatórios** — não consomem legenda/tema de cronContents (Executivo/Relatórios agregam tarefas).
30. **Histórico** — saveItemFix grava old/new truncado (texto); social_editou_conteudo sem conteúdo.

## C. SEGURANÇA (itens 31–42)
31. **CSP** — index.html NÃO define meta CSP (grep vazio); rede do renderer sai p/ Firebase/gstatic/ImageKit. O editor NÃO adiciona rede nem afrouxa nada (zero CDN, zero fonte externa).
32. **innerHTML** — padrão do app (modais/render) SEMPRE com esc() nos dados. O editor introduz `contenteditable` + render de rico: SÓ via sanitizador/normalizador próprio (allowlist), nunca HTML bruto.
33. **esc()** — 2657, será mantido em todo fallback texto.
34. **Worker** — sem DOM/DOMParser (Cloudflare): validação server-side será por **gramática estrita de tokens** (fail-closed → texto puro escapado).
35. **allowlists** — portal já projeta itens por allowlist de campos; será estendida com os campos ricos validados.
36. **Rules** — tasks write <80 campos, sem validação por campo (modelo vigente); 2 campos novos por item ficam DENTRO de cronContents (não muda contagem de campos raiz).
37. **endpoint** — nenhum novo.
38. **serialização** — Firestore aceita strings; canônico = string HTML restrita.
39/40. **context isolation/preload** — intocados (renderer clássico; nada novo exposto).
41. **clipboard** — leitura texto via `desktopAPI.clipboardReadText` (existente); colagem RICA via evento `paste` (clipboardData text/html) SANITIZADA; fallback texto puro. Escrita (copiar) permanece TEXTO PURO.
42. **dependências** — ZERO novas (decisão de arquitetura abaixo); SBOM inalterado.

## D. IMPACTO (itens 43–50)
43. **Arquivos** — `desktop/src/renderer/index.html` (stepper roteiro + editor + sanitizador + projeção + exibições), `cloudflare-worker.js` (render rico validado no portal — ADITIVO), versão package/lock, suítes/provas f355c, pins herdados, 2-3 workflows, docs.
44. **Backend** — NÃO (sem Functions/Rules/endpoints novos).
45. **Portal** — SIM, aditivo e retrocompatível (ordem coordenada: Worker primeiro).
46. **Android** — intocado (não renderiza cronContents).
47. **Migração** — NENHUMA (campos aditivos por item; tarefas antigas seguem texto puro; abrir NÃO reescreve).
48. **Compatibilidade** — Desktop antigo que reescrever cronContents derruba os campos ricos → fallback texto (regra de paridade) — degradação graciosa, sem corrupção.
49. **Performance** — accordions já existentes (`_openContent`) + toolbar por editor visível apenas com foco (focus-within) + contenteditable leve; metas: 50 roteiros sem travar (provas).
50. **Rollback** — v1.0.219/1.0.218/1.0.216 preservadas; Worker com deploy reversível (mesmo workflow `deploy-worker.yml` + versão anterior).

## CAUSAS DAS LIMITAÇÕES
- Quantidade: presa ao mapa estático `subtypes` q4/6/8/12 — a MESMA limitação que a F3.5.4V removeu p/ vídeos (precedente aprovado com stepper + subtipo sintético).
- Texto: inputs/textarea simples; formatação impossível; colagem do Word vira texto plano (f353) — sem negrito/listas/alinhamento.

## ESTRATÉGIA — QUANTIDADE (espelho fiel da F3.5.4V)
- `f.scriptQty` (novo em newForm) + `SCRIPT_QTY_MAX=500` (mesmo teto técnico/1MiB) + `normScriptQty(raw)` (inteiro ≥1; ''=vazio permitido — campo é OPCIONAL hoje e PERMANECE; zero/negativo→1; decimal→piso; lixo→''; teto com toast claro) + `scriptQtyOf(f)` (fonte: scriptQty; fallback SÓ com f.id: cronSub q4/6/8/12 → 4/6/8/12 ou cronContents.length) + `synthScriptSub(n)` = `{label:n+' roteiros',formTitle:'Roteiro de gravação de vídeos — '+n+' roteiros',contentCount:n,fields:[],checklist:[mesmos 4 itens]}`.
- `curSub()`: ramo `roteiro` → `synthScriptSub(scriptQtyOf(f))` (cronograma/copywriting intactos).
- Briefing roteiro: chips **substituídos** por `[−][N][+]` (`vqty-row` reutilizada; ids/atributos próprios `fScriptQty`/`data-sqplus`/`data-sqminus`); mensagem de validação literal exigida quando inválido ao interagir: “Informe uma quantidade inteira igual ou superior a 1.” (inline `sq-err`, não silenciosa); placeholder claro; commit no change/blur normaliza e re-renderiza.
- **Diminuir com conteúdo preenchido nos itens excedentes** ⇒ modal de confirmação clara (lista o nº de itens com conteúdo que serão removidos; Cancelar mantém TUDO; Confirmar corta `f.contents` para N). Aumentar ⇒ NUNCA toca itens existentes (blocos novos vazios). Sem persistir cronSub sintético novo? `cronSub` continua recebendo `f.subtype` (null p/ roteiro novo — igual edicao_midia pós-V, que não grava pacote) — **fonte única = cronContents.length**; q4/6/8/12 antigos seguem lidos só como fallback de exibição.
- Persistência/validações/read-back de saveTask INTOCADOS.

## ESTRATÉGIA — EDITOR RICO (arquitetura auditada)
**Decisão de arquitetura**: SEM biblioteca externa (TipTap/ProseMirror exigiriam bundler no renderer single-file + dependências novas — risco/peso sem necessidade comprovada; SBOM intacto). Editor próprio sobre `contenteditable` com:
- **Comandos de gesto** via `document.execCommand` (bold/italic/underline/strike/sub/sup/listas/justify*/indent/outdent/undo/redo/insertHorizontalRule/createLink/foreColor/hiliteColor/fontName-token p/ tamanho) — JUSTIFICATIVA exigida pelo mandato: no Electron o engine é ÚNICO e fixado (Chromium 126); os comandos usados são estáveis e ficam TODOS integrados ao undo/redo nativo; e o execCommand NÃO é a fonte da verdade —
- **Formato CANÔNICO** = saída do NOSSO normalizador/sanitizador determinístico (`rteSanitize`): allowlist estrita de tags `p,br,strong,em,u,s,sub,sup,ul,ol,li,a,hr,h3,h4,span` e atributos APENAS `data-al∈{c,r,j}` (alinhamento; esquerda=ausente), `data-ind∈1..6` (recuo), `span[data-cl∈1..8]` (cor da paleta fixa), `span[data-hl∈1..6]` (marca-texto fixo), `span[data-fs∈{s,l,xl}]` (tamanho; normal=ausente), `a[href]` http/https apenas + `rel="noopener noreferrer" target="_blank"` forçados. **PROIBIDO no canônico: qualquer `style`, `class`, `on*`, script/iframe/object/embed/form/svg/img, `javascript:`** — b→strong, i→em, div→p, font/rgb→paleta, text-align→data-al, estilos mso-* e lixo do Word DESCARTADOS (texto preservado). Nada não-allowlist sobrevive (unwrap de texto).
- **Projeção texto** `richToPlain(html)` determinística (blocos→\n; `<br>`→\n; `ul li`→"• ", `ol li`→"N. "): gravada SEMPRE em `tema`/`legenda` (campos existentes = projeção/compat); canônico em `temaRich`/`legendaRich` (ADITIVOS por item, só quando há formatação).
- **Regra ANTI-DIVERGÊNCIA (fonte única)**: o rico só é EXIBIDO quando `richToPlain(temaRich)===tema` (idem legenda) — qualquer edição em texto puro (cliente no portal via editLegenda; Desktop antigo; superfície não-rica) invalida o rico automaticamente (fallback texto) até o próximo save rico. Mesma checagem no Worker. ⇒ `tema`/`legenda` (texto) permanecem a VERDADE de compatibilidade; o rico é camada de apresentação validada. Zero migração; zero duas-verdades.
- **Superfícies com editor**: wizard Briefing (tema+legenda por roteiro/conteúdo — cronograma e roteiro compartilham o MESMO bloco, aplicado a ambos), Editar conteúdos, Correção pontual (tema/legenda), Produção (legenda). Coletas correspondentes passam a carregar `{tema,legenda,temaRich,legendaRich,feedImageUrl,storyImageUrl}` (carry-over dos ricos não tocados; edição plana zera paridade do campo).
- **Toolbar** (por editor, visível via `:focus-within` — instância pesada nenhuma; 1 conjunto de listeners DELEGADO global): desfazer/refazer · estilo de parágrafo (Normal/Título/Subtítulo→p/h3/h4) · tamanho (Pequeno/Normal/Grande/Extra) · N I S U̶ ₓ ˣ · cor (paleta 8) · marca-texto (6) · listas • e 1. · alinhamento ←/center/→/justif. · recuo ±· link (Ctrl+K, http/https validado) · linha separadora · limpar formatação. **Citação: NÃO incluída** (o indent nativo do Chromium usa blockquote — ambiguidade insegura; sem utilidade comprovada p/ legendas) — decisão registrada. **Seletor de fonte: NÃO** (proibido fontes arbitrárias; família única do app).
- **Atalhos**: Ctrl+B/I/U, Ctrl+Z, Ctrl+Y e Ctrl+Shift+Z, Ctrl+K, Tab/Shift+Tab (indent em lista; senão navegação normal), escopados ao editor focado (stopPropagation; zero comandos globais do app).
- **Colagem**: handler `paste` no editor → text/html sanitizado (Word/Docs: mso-*, spans, classes, fontes → limpos; parágrafos/listas/negrito/itálico/quebras preservados) → insertHTML; sem HTML no clipboard → texto puro com quebras. Fallback Ctrl+V determinístico via IPC texto (padrão f353). “Limpar formatação” também na barra.
- **Preservação**: estado canônico sincronizado no `oninput` (serialize do editor ativo) → `f.contents[i]`/coletores; re-render restaura innerHTML do canônico (roundtrip sem perda); accordion/rolagem/snapshot seguem o contrato atual do wizard (modalRoot fora do #app nos modais; wizard protegido por _editingNow). NUNCA salva no banco por tecla — persistência apenas nos pontos atuais (Salvar/avançar).
- **Exibição**: Revisão do wizard, Central de Detalhes (corpo do tema: TEMA + LEGENDA formatados) e portal renderizam o canônico re-sanitizado (defesa em profundidade) SÓ com paridade ok; senão texto esc() como hoje. Card Kanban INTOCADO (compacto; nunca renderiza rico). Copiar tema/legenda INTOCADOS (texto puro da projeção — WhatsApp preservado).

## PORTAL (ordem segura do mandato)
1º **Worker** (aditivo, retrocompatível): validador de gramática estrita (tokens allowlist idênticos ao canônico; fail-closed → esc(texto)) + paridade `richToPlain`(implementação espelho em string puro) + render dos itens/state JSON com `temaRichHtml/legendaRichHtml` seguros; aprovado/Aprovar tudo/editLegenda INTOCADOS (edição do cliente continua texto → invalida rico por paridade). Testes do Worker + **deploy gated ANTES** da build Desktop; 2º Desktop 1.0.220; 3º publicação; 4º validação física.

## FUNÇÕES CONGELADAS NESTA FASE
Tudo da lista do mandato; em especial: Agenda Premium 1.0.219 (evc2/evd byte-idênticos), saveTask/validação/read-back F3.5.4I, sendToDesigner, aprovação/portal fluxos, copiar tema/legenda (contrato texto), observações internas, Card Kanban compacto, `desktop/src/main`+preload+janelas+sons, functions, Rules, Android. Worker: SÓ o delta aditivo descrito (diff além disso = falha de gate).

## RISCOS PRINCIPAIS E MITIGAÇÕES
(a) XSS por HTML colado/armazenado → allowlist dupla (Desktop na entrada/saída + Worker fail-closed) + provas com payloads reais; (b) divergência rico×texto → regra de paridade bilateral testada com vetores idênticos Desktop/Worker; (c) perda de conteúdo em re-render/diminuição → sincronização canônica por input + confirmação explícita de corte + provas; (d) desempenho com 50 editores → focus-within/accordion + prova de 50; (e) quebra do fluxo do cliente → Worker aditivo com fallback integral + regressão das suítes do portal; (f) execCommand → engine único pinado + canônico próprio (o comando nunca é persistido cru).

## PLANO CIRÚRGICO (ordem)
1. Versão 1.0.220 (+description) e pins herdados.
2. Quantidade: SCRIPT_QTY_MAX/normScriptQty/scriptQtyOf/synthScriptSub + curSub(roteiro) + UI stepper com erro literal + confirmação de diminuição + binds/handlers (espelho data-vq*).
3. Editor: CSS `rte-*`; `RTE_COLORS/RTE_HL`; `rteSanitize` (DOM walker) + `richToPlain` + `rteDisplay` (paridade→html|esc); componente `rteField(html)` + toolbar + delegação global (comandos/atalhos/paste/link/limpar); integração nas 4 superfícies + coletores com carry-over; exibições (Revisão/Central) com paridade.
4. Worker: validador/paridade/render aditivo + testes → deploy gated (deploy-worker.yml) ANTES da build.
5. Suíte f355c (35 qtd + 50 editor + perf/segurança estática) + pins; provas Electron (~24, incl. payloads maliciosos inertes e 50 roteiros); regressão integral.
6. Build gated 1.0.220 → release pinada → Latest → relatório 45 → GO técnico → STOP.

Depois deste checkpoint: prosseguir automaticamente (mandato).
