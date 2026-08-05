# F3.5.5C — Relatório Final (45 itens)
## Desktop 1.0.220 — Roteiros Personalizados e Editor Profissional

> Preenchimento final (pins RUN_ID/hashes/release) após o build verde e a publicação.

## A. Estado e escopo

1. **Estado**: GO técnico condicionado à validação física do owner no Windows (a publicação NÃO é aprovação física).
2. **Fase**: F3.5.5C — quantidade personalizada de roteiros (Problema 1) + editor rico de Tema/Legenda (Problema 2), com portal/Worker retrocompatível.
3. **Base de código**: Desktop 1.0.219 @ `7e54cdf` (Latest anterior). Baseline física de rollback imediato: 1.0.218 @ `1a94515`. Rollback adicional: 1.0.216 @ `e509f43`.
4. **Branch**: `desktop/f355c-custom-script-quantity-rich-editor-1.0.220` (isolada; `main` intocada).
5. **Commits da fase**: 111007c (renderer A+B) → 433fb4f (portal rico) → 544b8fa (identidade V64.60) → b61d2f9 (suítes) → 188e052 (provas + 3 correções de produto) → 584f536 (re-pins C2–C5) → c932fca (CI + smoke + paridade cruzada) → 879a6f6 (worker reancorado na linhagem viva + K1) → 486b7a3 (re-pins wh1-details/w-compact + allowlist) → 2e91a3a (colagem robusta sem execCommand + provas determinísticas) → 2d003adaeeec00499e95a9eac5fe01f48859e4ed (tip candidato) + 7707433 (workflow de release, único commit posterior).

## B. Problema 1 — Quantidade personalizada de roteiros

6. **Stepper [−][N][+]** substitui os chips fixos 4/6/8/12 no Briefing do Roteiro (`#fScriptQty`, `type=number`, `min=1`, `step=1`; botões `data-sqminus`/`data-sqplus`).
7. **Validação**: inteiro ≥ 1; valor inválido exibe a mensagem literal "Informe uma quantidade inteira igual ou superior a 1." (`#sqErr`) sem travar a tela; campo vazio permanece permitido (como os chips eram opcionais).
8. **Crescer preserva**: aumentar N mantém tudo que já foi preenchido e cria blocos vazios ao final (prova Q3).
9. **Reduzir com conteúdo pede confirmação**: modal explícito com contagem dos excedentes preenchidos; Cancelar mantém TUDO (Q7); Confirmar remove SÓ os excedentes (Q8).
10. **Compatibilidade legado**: q4/q6/q8/q12 → 4/6/8/12; tarefas antigas abrem pelo tamanho REAL do array (ex.: 7); criação livre (ex.: 13); nenhuma migração destrutiva (Q9). `SCRIPT_QTY_MAX=500` como teto sanitário.
11. **Portal**: `frequencyLabel` aceita `q<N>` para qualquer N≥1 ("7 roteiros", "1 roteiro"); q4/6/8/12 produzem EXATAMENTE os textos do mapa antigo; fallback "Roteiro" preservado.

## C. Problema 2 — Editor rico de Tema/Legenda

12. **Superfícies**: Briefing (por roteiro), Revisão, modal "Editar conteúdos", correção de item (fix) e produção — todas com `rteField` (contenteditable + toolbar da casa).
13. **Toolbar completa**: desfazer/refazer; parágrafo/H3/H4/tamanhos (S/L/XL); negrito/itálico/sublinhado/tachado/sub/sobrescrito; COR (paleta fechada de 8) e MARCA-TEXTO (6); listas ul/ol; alinhamentos (esquerda limpa, centro/direita/justificado); recuo ±(1–6); linha divisória; link http(s) com rel/target forçados; LIMPAR formatação. Atalhos Ctrl+B/I/U/K.
14. **Arquitetura**: execCommand é apenas GESTO (com `styleWithCSS=false` nos estruturais); o formato persistido é o CANÔNICO determinístico do `rteSanitize` (allowlist p/br/strong/em/u/s/sub/sup/ul/ol/li/a/hr/h3/h4/span; atributos só data-al|data-ind|data-cl|data-hl|data-fs). Colagem: sanitização SEMPRE antes de inserir; se o engine recusar o insertHTML, o MESMO canônico entra via Range+`<template>` (inerte) — menos dependência do execCommand obsoleto.
15. **Projeção em texto**: `richToPlain` determinístico (blocos→\n; ul "• "; ol "N. "; hr "---"; `<br>` terminal = linha vazia; NBSP→espaço) gravado nos campos legados `tema`/`legenda` — compatibilidade total com tudo que consome texto.
16. **Aditividade**: `temaRich`/`legendaRich` só existem quando HÁ formatação (`rteHasFormatting`); texto simples grava byte-equivalente ao legado (E2).
17. **Paridade obrigatória**: qualquer exibição rica exige `richToPlain(rich)===plain`; divergência mostra o texto escapado de sempre (E15). Fixpoint garantido: `rteSanitize(canon)===canon` e `rteSanitize(rteEditableHtml(canon))===canon`.
18. **Colagem Word/Google Docs**: mso/class/estilos arbitrários caem; font-weight:700/bold→strong, italic→em, underline/line-through→u/s; margin-left→data-ind; cor/fundo anexados a formatadores (`<b style="color:…">`) capturados via stWrap → span[data-cl|data-hl] (E7 + bateria B1–B24).
19. **Proibições ativas (inertes por construção)**: script, iframe, object, embed, form, style arbitrário, handlers on*, SVG, `javascript:`, imagens externas automáticas, CSS remoto — descartados na raiz (E6 + A1–A15); sem CSP afrouxada; sem CDN; sem lib externa; sem fontes arbitrárias.
20. **Kanban compacto**: o card NÃO renderiza rico (resumo continua texto). Central de Detalhes renderiza rico GATEADO com espelho `.det-plain-src`; **cópia continua text/plain EXATA** (E13/E14). Notificações permanecem sem HTML bruto. Observabilidade jamais registra conteúdo.

## D. Portal/Worker (ordem segura: portal ANTES da Desktop)

21. **Validação server-side fail-closed**: `rteWkValid` (gramática canônica token a token, stack machine, bound 120k, QUALQUER desvio ⇒ rejeita) + `rteWkPlain` (projeção idêntica à do Desktop) + paridade com o texto exibido + override do cliente desliga o rico. Falhou ⇒ renderização escapada de sempre.
22. **Integração**: tema (título inline + campo com data-plain) e legenda (bloco rico + data-plain); `getText` prefere `data-plain` (edição do cliente lê o texto exato); CSS `.rtev` dentro do `CV_CSS`; contrato 74J intacto (roteiro só Tema+Legenda; ETAPA 1 do cronograma só Tema).
23. **Identidade viva**: `/health` = `{version:"V64.60-f355c-rich-render", build:"f354wh1-approve-all+f355c-rich"}` — o campo `build` prova as DUAS linhagens no runtime (headers `X-ID7-Worker-Build` idem).
24. **Paridade cruzada Desktop↔Worker**: os canônicos REAIS exportados pelo app EMPACOTADO (E16) validam na gramática do Worker e projetam o MESMO texto (10/10 no CI e local).

## E. INCIDENTE do Worker (transparência total) — detectado, contido e corrigido nesta fase

25. **Causa-raiz**: o `cloudflare-worker.js` da linhagem desktop estava FOSSILIZADO em 19/jun (`V64.59-legacy-risk`); a linhagem VIVA evoluiu em branches `worker/*` (C18E→C20 Golden Master /share→fail-open OG→74J3–J6 contrato do portal→F3.5.0A→W-H1 Aprovar tudo) e as duas linhas não compartilham nem ancestral git (raiz órfã). O deploy F3.5.5C inicial (run 79, 01:15 UTC) publicou o arquivo de junho + RTE — regressão real em produção (sem Aprovar tudo/74J/C20).
26. **Agravante**: a tentativa de restauração pelo workflow do wh1 (run 80, 01:24) deployou os bytes corretos, mas o check de versão (leitura ÚNICA no edge, consistência eventual) recebeu a resposta da versão ANTERIOR, abortou e o rollback automático devolveu produção exatamente para a versão errada (`c687211a`). Falso-negativo de propagação de edge.
27. **Correção definitiva**: patch 3-way das mudanças F3.5.5C (6d46bce→544b8fa) SOBRE o arquivo do branch `worker/f354wh1-approve-all-pending` — diff final vs wh1: 138 inserções / 9 deleções, TODAS as 9 substituições F3.5.5C intencionais; approveAllPending/C20/74J/F3.5.0A byte-idênticos. Deploy do run 81 (01:39): health com `build:"f354wh1-approve-all+f355c-rich"` — impossível em qualquer versão anterior — prova o worker mesclado VIVO.
28. **Janela de exposição**: ~24 minutos (01:15:50→01:39:53 UTC; ~22:15–22:40 de 4/ago no horário de Brasília), com 10s dos bytes wh1 no meio. Nenhum dado gravado foi afetado (o worker é stateless sobre Firestore; rotas de escrita permaneceram com contratos compatíveis).
29. **Prevenções incorporadas**: worker do branch = superset da linhagem viva com validador 97 + paridade cruzada no CI; identidade `build` composta prova a linhagem no runtime; suítes worker-ops f33G–f33Z (293 checks) verdes contra o arquivo mesclado. Recomendações registradas (item 44).

## F. Testes e provas (tudo contra o código REAL; nada de mockup)

30. **Suíte da fase**: `f355c-script-quantity-rich-editor.test.mjs` — 128/128 (35 quantidade + 50 editor + segurança + Worker + congelados), fonte E asar (SRC=/WSRC=).
31. **Validador do portal**: `f355c-rte-worker-validator.test.mjs` — 97/97 (gramática fail-closed, projeção, display/inline/attr).
32. **Bateria comportamental**: 91 casos no Chromium REAL do Electron (payloads maliciosos inertes A1–A15; Word/mso B; Google Docs; stWrap; precedência C; projeção D; paridade/round-trip E; fixpoint F incl. editável; desempenho G<25ms) — funções EXTRAÍDAS do renderer (nenhuma cópia divergente).
33. **Provas reais empacotadas**: 32 cenários no app.asar REAL (BOOT, Q1–Q9 quantidade, E1–E17 editor, P1–P5 desempenho/resoluções) com PNGs oficiais no artifact `f355c-provas-qa` — resultado final: 32/32 VERDES no CI (run 30968443751, artifact f355c-provas-qa com os PNGs oficiais) (32/32 no run verde).
34. **Desempenho medido**: 50 roteiros renderizam em ~44ms com 100 editores e heap ~10MB (P1); digitação ~1,4ms/tecla (P2); 12 itens ricos no modal em ~15ms (P5); sem overflow horizontal em 1366×768 e 125% (P3/P4).
35. **Herdadas todas verdes**: f355b 84; f355ah1 72 (K1 re-pinado aditivo); f355a planner 98 + orquestrador 38 + central 33 + integração 25; wh2 37; wh1-details 74 (E2.16/E5.15 re-pinados com contrato igual/mais forte); w-compact 53 (D2.8/D2.9 exigem o GATE rico); vh1 40; provas herdadas f355b 20 + ah1 15 + f355a 25.
36. **Worker-ops**: f33G–f33Z 293 checks verdes contra o arquivo mesclado; paridade cruzada 10/10. (f31/f331/share-card são pins fósseis do arquivo de junho — testam o motor SLA removido/contratos pré-C20; NÃO são gates do CI; catalogadas para limpeza futura.)
37. **Re-pins de suítes herdadas (4 checagens, todas documentadas no código)**: ah1-K1 (cronOf ganha campos ricos ADITIVOS; garantia idêntica), wh1-E2.16 (cópia via .det-plain-src/textContent + assert anti-innerHTML novo), wh1-E5.15 (janela do regex; estrutura idêntica), w-D2.8/D2.9 (exigem rteDisplayHtml/rteInlineDisplay + fallback esc()).

## G. Build, isolamento e publicação

38. **Build CI gated**: run 30968443751 @ `2d003adaeeec00499e95a9eac5fe01f48859e4ed (tip candidato) + 7707433 (workflow de release, único commit posterior)` — verify (ancestria 219/218/216, versão, tsc+sintaxe+worker, todas as suítes acima, smoke 91, provas 32, paridade cruzada, provas herdadas, ISOLAMENTO com allowlist explícita e congelados diff-vazio, marcadores fonte) + build Windows (asar extraído re-validado pelas suítes com SRC=, SBOM, SHA256SUMS, VERSAO-DESKTOP; `--publish never`).
39. **Isolamento provado**: delta vs 1.0.219 restrito a: renderer index.html, package(-lock).json (versão), scripts f355c-*, 6 suítes herdadas re-pinadas/allowlisted, cloudflare-worker.js + worker-ops/f355c-* + docs/f355c*, e os 2 workflows da fase. main/preload/slareminder/bgnotify/sons/functions/android: byte-idênticos.
40. **Hashes (mesmos bytes publicados)**: EXE `c0c9ab2fe88153e21e0f51888fecfdc7c2f6631bab5937a9ddef8a6adce93da4` · MSI `dc3f417ccad77588e31d65a8be4184bcef73e9eaa4ab9cb8a3e5a9c5cb8f8008` · latest.yml `f44afabae1e8cdd1997bac2d714429d174b268409ee87e37ffdb8a0cd811c2c8` · blockmap `70c22f3fea39fee9cdfed91dda9b95bcc2c2a7d7dbbd85b7d6fbd9777a549931` · SBOM `274590bd7a2de3dbe2ff5120abb833978eed460cbdea0debc1ed66783d538310`; digests dos artifacts pinados no workflow de release.
41. **Publicação**: release `v1.0.220` DIRETO no Latest via GitHub App "Agenda ID Seven Release Bot" (token temporário, escopo 1 repo), 6 assets, `latest=true`, sem prerelease/canal de teste/feed alternativo/download manual; sha512 do latest.yml == EXE (updater aceita); pós-verificação preserva v1.0.219, v1.0.218 (rollback imediato) e v1.0.216 (rollback adicional).
42. **Rollback**: instantâneo re-apontando o Latest para v1.0.218 (fisicamente aprovada); adicional v1.0.216. Worker: redeploy do wh1 puro pelo workflow do branch wh1 (com atenção ao falso-negativo de edge do item 26) ou do mesclado por este branch.

## H. Pendências e recomendações (não bloqueiam o GO técnico)

43. **Validação física obrigatória (owner, Windows real)**: criar Roteiro com N personalizado (ex.: 7) + mensagens de validação + reduzir com confirmação; formatar Tema/Legenda (cores/listas/links) e ver no portal do cliente o rico idêntico; colar de Word/Docs REAIS; copiar tema/legenda (texto limpo); card kanban compacto; tarefas antigas intactas; 100%/125%/150%; Aprovar tudo e edição do cliente no portal (regressão do incidente).
44. **Recomendações operacionais** (aprovação do owner para fases futuras): (a) unificar a linhagem do worker (o arquivo do branch desktop agora É o superset — merges futuros devem partir dele); (b) endurecer o deploy-worker simples com verificação de identidade por leituras consecutivas + rollback por BACKUP byte-exato (nunca "previous deployment", que pode ser a versão ruim); (c) aposentar/atualizar f31/f331/share-card ao contrato C20; (d) CI do worker no push (hoje só validadores no build da fase).
45. **Diferença entre GO técnico e GO físico**: GO técnico = todos os gates automatizados verdes sobre os bytes publicados (este relatório). GO físico = SOMENTE o owner, no Windows real, seguindo o item 43 — até lá, nenhuma nova fase inicia e o rollback está armado.

---
### Decisão final (declarações explícitas)
- Publicado v1.0.220 no canal Latest do atualizador interno com os MESMOS bytes do run verde 30968443751: SIM — release v1.0.220 publicado em 05/08 02:19:51 UTC pelo GitHub App Release Bot (run 30969018587, 34s, todos os gates 0–5 + pós-verificação VERDES); Latest=v1.0.220 @ 2d003ad; 6 assets com digests idênticos aos pinos; v1.0.219, v1.0.218 e v1.0.216 preservadas.
- Nenhuma funcionalidade congelada foi alterada (isolamento diff-vazio + suítes herdadas verdes): CONFIRMADO.
- Worker de produção restaurado E atualizado (linhagem viva + F3.5.5C), com prova de identidade no runtime: CONFIRMADO.
- Incidente do Worker: reportado integralmente no bloco E (25–29), com janela, causa e prevenções: CONFIRMADO.
- **GO TÉCNICO** declarado; **aguardando validação física do owner**; nenhuma fase nova será iniciada: CONFIRMADO.
