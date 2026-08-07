# F3.5.5E-H1 — Checkpoint: auditoria visual read-only + conceitos + decisão

Fase: REDESIGN ULTRA PREMIUM DAS NOTIFICAÇÕES IMEDIATAS (Desktop 1.0.225).
Base: Desktop 1.0.224 (fisicamente aprovada; branch @ 0c88a32). REGRA MÁXIMA: zero mudança funcional.

## Nota de ferramenta (honestidade)

O mandato ordena usar a skill "UI/UX Pro Max instalada neste ambiente". A skill NÃO existe neste
ambiente (verificado no registro de skills da sessão, nas skills do claude.ai via busca e nos
plugins habilitados — apenas security-guidance). Nenhuma ferramenta foi simulada. O ESPÍRITO da
ordem foi cumprido aplicando diretamente as disciplinas listadas no mandato (notification cards,
toast, SaaS desktop UI, hierarquia, dark mode, componentes enterprise compactos, tipografia,
spacing, status indicators, microinterações, acessibilidade, densidade, equilíbrio visual) e as
referências conceituais (Linear/Raycast/Notion/Arc/Vercel/Stripe/Slack/Superhuman/Framer/macOS),
sem cópia literal de nenhum produto. Este registro consta também do relatório final.

## Auditoria read-only (20 itens) — estado ATUAL (1.0.224)

1. Componente: builders compartilhados `premiumCommonInner`/`premiumGroupInner` + helpers
   (`premiumEvtCat`, `premiumByVerb`, `premiumChip`, `premiumHMOf`, `premiumAvatar`) — byte-a-byte
   idênticos em `index.html` (toast) e `bgnotify.html` (janela), gateados por `premiumUse(p)`.
2. CSS: bloco `.ntfp-*` injetado por `notifEnsureStack` (index) e replicado no bgnotify.
3. Tamanho REAL medido no Electron empacotado (payload idêntico à captura do owner —
   task_moved/TEMAS/ULTRA/Cronograma mensal • 12 temas/andamento→revisão/nome longo):
   card 480×242px; sem chips 480×209px; 3 empilhadas = 747px de coluna; avatar 36px (ring 2px);
   chip 24px de altura (borda+bg fortes); CTA 27×93px (bloco à esquerda); close 22×22px.
4. Tokens: categorias `--catc` (cat-blue #60A5FA, cat-violet #A78BFA, cat-green #34D399,
   cat-amber #F59E0B, cat-red #F87171, cat-orange #FB923C, cat-teal #22D3B8, cat-neutral #8792a6);
   acentos `--nac`; chips `--cfg/--cbg/--cbd` por status; superfície gradiente
   rgba(26,32,46,.99)→rgba(17,22,32,.99); borda rgba(255,255,255,.10).
5. Fonte: InterVar variável (100–900) EMPACOTADA + Segoe UI fallback — escala de pesos
   450/500/600/650/700 disponível sem nenhum asset novo.
6. Icon set: registro `ICON` (linha 2865 do index; stroke 24×24 `currentColor`) com
   add/send/swap/editnote/check/revise/ban/chat/flag/clock/person… — o bgnotify NÃO possui o
   registro; ícones de evento devem ser AUTOCONTIDOS no builder compartilhado (paths literais do
   MESMO set) para preservar a paridade byte-a-byte. Sem emoji.
7. DOM: ntfp-wrap(cat) → ntfp-hd(eyebrow+tm+ntf-x) → ntfp-task → ntfp-client → ntfp-ctx →
   chips/ntfp-action → ntfp-by(av+texto) → ntfp-respline → ntfp-cta.
8. Variantes: 8 eventos mapeados em premiumEvtCat/ByVerb (criada/atribuída azul; movimentada/
   atualizada violeta; concluída verde; reaberta âmbar; cancelada vermelho; ajuste laranja;
   aprovação verde/teal) — estrutura única.
9. Fila: toast `.notif-stack` fixed right:18 bottom:18, gap 10, corte em 4 visíveis; janela bg
   `#stack` gap 10, cap 5 — contratos funcionais INTOCÁVEIS.
10. Animação: `.ntf` fade + translateY(8px), 180ms ease; `prefers-reduced-motion` já respeitado.
11. workArea: bgNotify.ts (CONGELADO) posiciona canto inferior direito com EDGE_MARGIN 14 e
    AUTO-RESIZE ao conteúdo (largura responsiva 440–560) — card mais compacto encolhe a janela
    sozinho; nenhuma mudança em código congelado é necessária.
12. Escala Windows: zoom 100/125/150 provado na fase anterior; larguras com max-width em vw.
13. bgnotify.html: 306 linhas; espelho exato de CSS premium + builders; `#stack` align flex-end.
14. Renderer principal: `notifShowToast` monta `.ntf.ntfp-w` (480px hoje) e chama o builder.
15. Paridade: garantida por testes CP2/CP3 (extração byte-a-byte) — continuará obrigatória.
16. Acessibilidade: aria-live="polite" único por superfície; `.ntf-x` aria-label; CTA
    role=button/tabindex=0; keydown Enter/Espaço; focus-visible outline.
17. Deep-link: `[data-cta]` usa payload.action/taskId — INTOCÁVEL (só o visual do botão muda).
18. Close: `.ntf-x` 22×22 (hit area ABAIXO do mínimo de 32px pedido — corrigir no redesign).
19. aria-live: sem leitura duplicada (autoridade única) — preservar.
20. Responsividade: largura fixa 480 + max-width calc(100vw-36px); clamps de 2 linhas em
    título/cliente/autor (cliente e autor passarão a 1 linha + tooltip por mandato).

## Diagnóstico visual (confirma a reprovação do owner)

Título 18/800 + cliente 13.5/700 clamp-2 + eyebrow UPPERCASE com letter-spacing + chips com borda
e fundo fortes + avatar 36 com ring colorido 2px + autor clamp-2 + CTA-bloco violeta à esquerda +
barra lateral 3px + close 22px solto = card de 242px com 7 pesos "gritando" ao mesmo tempo,
margens verticais somando ~52px e footer sem divisão estrutural. Funcional correto; composição sem
refinamento enterprise.

## Três conceitos avaliados

### A — Compact Enterprise (Linear/Stripe)
Header baixo (pastilha de ícone 18px por categoria + evento 12/600 sentence-case + hora 11
 tabular + close hit 32/glyph 15 integrado); título 18/700 clamp-2; CLIENTE linha própria 14/650
 clamp-1+tooltip; contexto 12.5/450 clamp-1; chips outline sutis 26px (dot 6 + 12.5/600, fundo
 6–8%, borda 1px fraca) com seta 12px discreta; FOOTER estruturado com hairline superior
 (1px rgba .06): avatar 28 (ring 1px neutro) + "Movimentada por Nome…" 12.5/450 1 linha, CTA
 ghost "Abrir tarefa →" 30px à direita; responsável "Responsável · Nome" 12/450 somente quando
 distinto; barra lateral 2px; largura 440.
### B — Minimal Premium (macOS/Arc)
Sem barra lateral (accent apenas no ícone); chips sem contorno (● texto → ● texto); CTA de texto
 puro; mais ar entre blocos; largura 440.
### C — Information Dense (Superhuman)
Meta-rail esquerdo vertical (ícone+hora), conteúdo em grade 2 colunas, título 16, tudo 12–12.5,
 autor+responsável na mesma linha; altura ~150px.

## Comparação (critérios do mandato)

| Critério | A | B | C |
|---|---|---|---|
| Legibilidade | Alta | Alta | Média (nomes PT-BR longos sofrem) |
| Densidade | Alta | Média | Máxima |
| Hierarquia | Excelente (4 degraus nítidos) | Boa (status perde affordance sem contorno) | Confusa sob truncamento |
| Clareza < 2s | Sim | Sim | Parcial |
| Aparência premium | Muito alta | Alta | Média |
| Ocupação (movimentada) | ~185–200px | ~200–215px | ~150px |
| Acessibilidade | Contraste/hit areas ok | Chips dot-only com affordance menor | Truncamentos agressivos |

## DECISÃO: Conceito A — Compact Enterprise (com o footer-ghost do B)

Justificativa: único conceito que mantém os 4 degraus de hierarquia exigidos (tarefa → cliente →
contexto → metadados) com nomes/títulos reais PT-BR longos, chips de status legíveis em dark
(contraste WCAG com texto+dot+contorno fraco — nunca só cor), e a maior densidade sem sacrificar
leitura em <2s. O cliente permanece em LINHA PRÓPRIA (as duas sugestões literais do owner têm o
cliente em linha própria). Do conceito B herda-se o CTA ghost de texto+seta no footer; do design
aprovado herda-se a barra lateral por categoria, reduzida a 2px. C rejeitado: densidade máxima às
custas de legibilidade/acessibilidade com conteúdo real.

## Especificação implementável (tokens e escala)

- Largura: 440px (mandato 420–460); alturas-alvo: movimentada ~185–200 (antes 242),
  sem chips ~155–170 (antes 209).
- Tipos: evento 12/600 sentence-case; hora 11/500 tabular-nums; título 18/700 lh 1.25 clamp-2;
  cliente 14/650 clamp-1+title; contexto 12.5/450 clamp-1+title; chips 12.5/600; autor 12.5/450
  clamp-1+title; responsável 12/450 clamp-1; CTA 12.5/600.
- Spacing (sistema 4/8/12/16): padding 14px 16px (esq. 14 por causa da barra 2px); gap blocos 8;
  linhas irmãs 3–4; footer margin-top 10 + border-top 1px rgba(255,255,255,.06) + padding-top 10.
- Avatar 28px, ring 1px rgba(255,255,255,.14), gen 11px/700.
- Chips: altura 26px (mandato 26–30), padding 4px 10px, radius 999, bg color-mix(status 8%),
  borda 1px color-mix(status 28%), dot 6px; seta 12px #7a8598.
- CTA ghost: 30px, padding 5px 11px, radius 8, borda 1px rgba(139,162,255,.35),
  bg rgba(109,91,255,.10), hover .18; seta "→" no rótulo; foco/teclado preservados.
- Close: hit 32×32 (margens negativas p/ não inflar o header), glyph 15px, hover bg 8%.
- Pastilha do evento: 18×18 radius 5, bg color-mix(catc 16%), svg 12px stroke currentColor —
  paths LITERAIS do icon set do app: add(criada)/send(atribuída)/swap(movimentada)/
  editnote(atualizada)/check(concluída+aprovação)/revise(reaberta)/ban(cancelada)/chat(ajuste).
- Card: borda 1px rgba(255,255,255,.08); radius 15; sombra 0 16px 40px -20px rgba(0,0,0,.75);
  barra lateral 2px var(--catc); fundo = gradiente atual (token existente, sem cor nova).
- Animação: manter 180ms fade+translateY(8px); hover discreto em CTA/close; reduced-motion mantido.
- Grupo (rajada): mesma cabeça nova (pastilha+eyebrow+hora+close), avatar 28, lista intocada.
- PROIBIDO nesta fase: alterar payload, produtores, dedupe, som, fila/caps, deep-link, recibos,
  agrupamento (lógica), sino, aria-live, keydown — só HTML dos builders + CSS.

Auditoria concluída — prosseguindo automaticamente para a implementação, conforme o mandato.
