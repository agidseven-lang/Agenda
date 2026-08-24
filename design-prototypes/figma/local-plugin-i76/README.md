# I7.6 — Composition B Builder (plugin local do Figma, custo zero)

Ferramenta **temporária de design**. NÃO é produto, NÃO faz parte do Agenda Desktop.
Serve só para escrever a **Composition B — Balanced Workspace** dentro do arquivo Figma oficial,
**sem usar a cota MCP** do Starter (que é mensal) e **sem qualquer custo**.

Roda no **Figma Desktop** como *development plugin* (não publicado na Community).

---

## O que ele faz
Localiza o frame **B — Balanced Workspace** (que já tem a sidebar pronta) e adiciona:
- **Header**: contexto "Meu quadro", tabs (Quadro/Timeline/Lista), busca, SLA, notificação, perfil.
- **View controls**: responsável, equipe, filtros, contagem de tarefas.
- **Kanban**: 4 estágios (A Fazer / Em andamento / Revisão / Finalizado) com contadores, botão
  "Adicionar tarefa", **2 tarefas reais** e **empty states** nas colunas vazias.
- **Contexto operacional** (rail direito): Resumo da visão, SLA da visão, Equipe.

**Reutiliza** o que já existe (Foundations, Agenda Tokens, Card A/B/C, sidebar). **Não recria nada disso.**

---

## Como executar (passo a passo)
1. Instale/abra o **Figma Desktop** (o app de computador — plugins de desenvolvimento não rodam no navegador).
2. Abra o arquivo oficial **"Agenda ID Seven — Product Design"**
   (`https://www.figma.com/design/aG7NXRdpCaiRDMeBiT8EKu`) e vá para a página **"Design"**.
3. No menu do topo: **Figma → Plugins → Development → Import plugin from manifest…**
4. Selecione o arquivo: `design-prototypes/figma/local-plugin-i76/manifest.json` (deste repositório).
5. Rode: **Figma → Plugins → Development → I7.6 — Composition B Builder**.
6. Aguarde a confirmação: *"I7.6 — Composition B criada com sucesso."* O plugin seleciona e dá zoom no frame B.
7. **NÃO execute novamente** se a B já tiver sido criada — o plugin é idempotente e vai avisar
   *"COMPOSITION B ALREADY EXISTS"* sem duplicar nada, mas não há motivo para rodar 2×.

---

## Segurança (idempotência e abort)
- Se o frame **B** já contém um `header`, o plugin **não duplica** — encerra com *ALREADY EXISTS*.
- Se **não encontrar** o frame "B — Balanced Workspace" (id `6:2`), **aborta** com mensagem clara,
  sem criar uma segunda B em outro lugar.
- Se o componente **Card B** (`4:2`) não for encontrado, usa um card informacional equivalente
  **inline** (mesma aparência), para nunca deixar a tela incompleta.
- Carrega as fontes **Inter** (Regular/Medium/Semi Bold/Bold) antes de criar textos.
- `networkAccess: none` — o plugin **não acessa a rede**.

---

## Notas técnicas
- Convertido de `design-prototypes/figma/i76_compB.js`. A única API incompatível com o plugin
  clássico era o helper `figma.createAutoLayout(...)` (exclusivo do MCP `use_figma`); foi
  substituída pelo helper local `AL()` (`createFrame` + `layoutMode` + sizing). Todo o restante
  já é Plugin API padrão.
- Usa **cores token-matched** (hex idênticos aos Agenda Tokens). **Não cria** novas variáveis nem
  coleção de tokens — as Agenda Tokens existentes ficam intactas.
- Depois de aprovar a B, os builders de **A** (`i76_compA.js`) e **C** (`i76_compC.js`) podem ser
  convertidos do mesmo jeito (ainda **não** faça isso — o owner quer avaliar a B primeiro).

**Produto intocado:** este plugin não altera o Agenda 1.0.248, renderer, PWA, backend ou updater.
