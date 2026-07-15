# ROTEIRO ↔ CARD PREMIUM PARITY — Diagnóstico F3.3.73I6C15 (para 1.0.165)

READ-ONLY — **nenhum código alterado**. Fonte auditada: Desktop baseline C14 (`d810e00`, 1.0.164)
`desktop/src/renderer/index.html` + `cloudflare-worker.js` (leitura apenas).

## 1. Fluxo atual do Roteiro (INCORRETO confirmado)
- Setor existe: `SECTORS` L2317 `{key:'roteiro',label:'Roteiro',icon:'description'}` — ativo na criação.
- `TEMPLATES.roteiro` (L2348) é um **template genérico de tarefa**: campos `tipo_roteiro/gancho/
  desenvolvimento/cta/obs_gravacao` + checklist interno. **Sem** `subtypes`, **sem** `contentCount`,
  **sem** `clientRequired` → cai no wizard comum com **Responsável** (assigneeField), **Etapa**
  (chips STATUS) e **Período** (início/término/limite) — exatamente o que o owner viu de errado.
- Por quê: só o Cronograma tem o maquinário de fluxo-cliente; todos os gates são hard-keyed em
  `secOf(t.sector).key==='cronograma'` (**17 ocorrências**, ex.: `isClientFlow` L4722, `isCron`
  L5385/5561/5640/5666/7529, save L7695, board L4870, stage views L5380-5692).

## 2. Fluxo correto do Cronograma (mapeado — o alvo da paridade)
- `TEMPLATES.cronograma` (L2340): `clientRequired:true` + `subtypes` com **`contentCount`**
  (semanal=3, quinzenal=6, mensal=12) → o wizard gera N blocos **tema+legenda** automaticamente
  (editor L7568-7569, bindings `data-ctema`/`data-cleg` L7661-7662, revisão L7627-7629).
- Save (L7695): `cronStatus:'rascunho_social'|'pronto_cliente'` + `cronSub`; conteúdos → `cronContents`.
- Envio: `canSendToClient` exige cliente + ≥1 tema (L6073); botão "Enviar ao cliente" → modal premium
  (CSS L1459) + assistente guiado 3 etapas (L1501); mensagem construída no Desktop
  (`buildClientMessage`, usada L6774/7294/7848) com o **link estável**
  `https://aprovar.agendaidseven.com.br/share/cronograma/<token>` (L6687; validador L6901 exige esse prefixo).
- Aprovação: portal do Worker `GET /cliente/cronograma/:token` (visão premium do cliente) +
  `POST .../action` (Aprovar/Pedir revisão). Polling de estado (V64.16). **Worker intocado nesta linha.**

## 3. Card Premium — de onde vem o TÍTULO (achado crítico)
- O título do card OG do WhatsApp é **HARDCODED NO WORKER**: `"Aprovar cronograma — "+cliente`
  (cloudflare-worker.js **L87**, fallback L106; alt L76) e o texto "Seu cronograma está pronto para
  avaliação." (L107). O portal vive na rota `/cliente/cronograma/:token`.
- **Consequência honesta:** com mudança **Desktop-only** (1.0.165), o card OG/preview do WhatsApp e o
  heading do portal continuarão dizendo "Aprovar cronograma". O que o Desktop controla e PODE dizer
  "Roteiro de gravação de vídeos": o **título da tarefa**, a **mensagem de WhatsApp** enviada
  (buildClientMessage + textos do assistente, ex.: L6801) e os conteúdos exibidos no portal (dados da task).
- Paridade **100%** do card ("Roteiro de gravação de vídeos" no preview OG) exige **fase própria de
  Worker** (título dinâmico por tipo/sector no payload) — deploy de Worker é **proibido** nesta linha,
  então fica explicitamente FORA da 1.0.165 e sujeito a autorização futura do owner.

## 4. Plano cirúrgico 1.0.165 (fase C16) — renderer-only
1. **`TEMPLATES.roteiro` reescrito em paridade**: `clientRequired:true`, `subLabel:'Quantidade de
   roteiros'`, `subtypes:{q4:{label:'4 roteiros',contentCount:4},q6:{…6},q8:{…8},q12:{…12}}`
   (formTitle "Roteiro de gravação de vídeos — N"). O editor de conteúdos EXISTENTE (tema+legenda)
   é reutilizado sem tocar (dirigido por `sub.contentCount`). Campos genéricos antigos
   (gancho/desenvolvimento/cta/tipo_roteiro/obs_gravacao) saem do template (histórico não é afetado).
2. **Helper único** `isClientSector(key)` = `key==='cronograma'||key==='roteiro'` substituindo os
   17 gates `==='cronograma'` (isClientFlow, isCron locais, board clientCol, stage/detail views,
   canSendToClient, save L7695, sinais de fluxo). Comportamento do cronograma preservado byte-a-byte
   (mesma condição para 'cronograma'); roteiro é aditivo.
3. **stepDados para roteiro**: ocultar **Responsável**, **Etapa** e **Período** (owner: designer NÃO
   participa; status default 'afazer'); manter Título, Cliente (obrigatório), Quantidade (subtypes),
   Conteúdos (tema+legenda). Labels dinâmicos: "Conteúdos do cronograma (N)" → por setor
   ("Roteiros (N)"), L7568/L7629.
4. **Textos de envio dinâmicos**: buildClientMessage + assistente guiado dizem
   **"Roteiro de gravação de vídeos"** quando setor='roteiro' (link continua `/share/cronograma/<token>` —
   rota do Worker, inalterada).
5. Versão **1.0.165** (pkg+lock) + suíte hermética nova (paridade roteiro) + sweep completo
   (ajustar pins que citem textos alterados) + build de validação.

## 5. Campos — decisão consolidada
- **Remover do Roteiro (wizard):** responsável/designer, etapa, período (datas), campos genéricos antigos.
- **Manter/adicionar:** título, cliente (obrigatório), quantidade 4/6/8/12, N×(tema+legenda/descrição),
  botão "Enviar para o cliente" pós-save (mesma trava ≥1 tema).

## 6. Riscos e mitigação
- **Cronograma/Card Premium:** risco BAIXO — generalização por helper preserva a condição atual;
  Worker não é tocado; testes herméticos existentes (f33I/J/O/P/Q, d3r10b) rodam no sweep e qualquer
  pin de texto alterado é atualizado explicitamente.
- **Board/Kanban:** clientCol/fluxos derivam dos mesmos sinais (cronStatus/clientFlowStatus/tokens) —
  roteiro entra pelo mesmo trilho; designer-flow nunca ativa (sem designer ⇒ `hasDesigner(t)=false`).
- **Limitação declarada:** título OG/portal "Aprovar cronograma" permanece até fase de Worker (item 3).

## 7. Arquivos
- **Alterar na C16:** somente `desktop/src/renderer/index.html` (+ `package.json`/`package-lock.json`
  1.0.165 + testes em `desktop/scripts/`).
- **NÃO tocar:** cloudflare-worker.js, functions/, rules, hosting, Android, main/preload do Desktop.
