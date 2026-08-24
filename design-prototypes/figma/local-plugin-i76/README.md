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
3. No menu: **Figma → Plugins → Development → Import plugin from manifest…** → selecione
   `design-prototypes/figma/local-plugin-i76/manifest.json`.
4. Rode: **Figma → Plugins → Development → I7.6 — Composition B Builder**.
5. Aguarde a confirmação: *"Composition B (Balanced Workspace) criada com sucesso."* — o plugin
   seleciona e dá zoom no frame B.
6. **Rode apenas uma vez.** É idempotente: se já estiver completa, avisa *ALREADY EXISTS* e não duplica.

> **Sobre o `id` do manifest:** o Figma normalmente **atribui o plugin id** ao criar o plugin
> (Create/New Plugin), então o `id` textual do nosso manifest **não é garantidamente aceito** na
> importação direta. Caminho garantido:
> 1. **Plugins → Development → New plugin…** → **Figma design**
> 2. deixe o Figma **gerar** o `manifest.json` e o `id`
> 3. substitua **somente** o `code.js` gerado pelo **nosso** builder
> 4. **mantenha o `id` gerado pelo Figma**
> 5. acrescente/confirme no manifest gerado: `"documentAccess": "dynamic-page"` e
>    `"networkAccess": { "allowedDomains": ["none"] }`
>
> Não publique na Community.

---

## Segurança (endurecida após auditoria pré-execução do owner)
- **Idempotência por marker explícito:** conclusão é marcada com
  `setPluginData("i76-composition-b-status","complete")` **somente depois** que TODAS as seções
  existem. A checagem inicial olha o **marker**, não a mera presença de `header`.
- **Transacional (rollback):** cada node criado nesta execução é rastreado; se ocorrer **qualquer
  erro**, todos os nodes desta execução são removidos. A B termina **ou intacta ou completa —
  nunca parcial**.
- **Build parcial anterior (não-destrutivo):** se alguma seção do builder já existir **sem** o marker
  de conclusão, o plugin **ABORTA e não altera nada** (não apaga automaticamente), para nunca deixar
  o arquivo em estado parcial. Você revisa/limpa o parcial manualmente e roda de novo.
- **Ordem do marker:** a conclusão é marcada **por último** (depois de seleção/zoom). Em qualquer erro,
  o marker é **limpo** e os nodes **desta execução** são removidos → nunca há "marker complete" sobre
  conteúdo revertido. O rollback cobre só os nodes criados nesta execução (não conteúdo preexistente).
- **Estado complete inconsistente:** se o marker disser "complete" mas faltar alguma seção, o plugin
  **ABORTA** (INCONSISTENT COMPLETE STATE) sem alterar nada.
- **Card B obrigatório:** se o componente oficial **Card B (`4:2`)** não for encontrado, o plugin
  **ABORTA** com mensagem clara. Não cria cópia visual inline — Figma é a source of truth.
- **Abort seguro:** se o frame **B (`6:2`)** não existir, aborta sem criar uma segunda B.
- **Fontes** Inter (Regular/Medium/Semi Bold/Bold) carregadas antes de qualquer texto.
- `documentAccess: "dynamic-page"` · `networkAccess: none` (sem rede).

---

## Notas técnicas
- Convertido de `design-prototypes/figma/i76_compB.js`. A única API incompatível com o plugin
  clássico era o helper `figma.createAutoLayout(...)` (exclusivo do MCP `use_figma`); substituído
  pelo helper local `AL()` (`createFrame` + `layoutMode` + sizing). Todo o resto já é Plugin API padrão.
- **Colunas de igual altura** via `col.layoutAlign = "STRETCH"` + `minHeight` (válido). O valor
  inválido `counterAxisAlignItems = "STRETCH"` foi **removido** (essa propriedade só aceita
  MIN/MAX/CENTER/BASELINE).
- **`VARIABLE_BINDING = PENDING`:** as cores usam **hex token-matched** (idênticos aos Agenda Tokens),
  mas **ainda não estão vinculadas por binding** às Variables reais. Isso é intencional para o
  primeiro preview visual; o binding às Variables é um passo posterior. **Não** foram criadas novas
  variáveis nem coleção — as Agenda Tokens existentes ficam intactas.
- Depois de aprovar a B, os builders de **A** (`i76_compA.js`) e **C** (`i76_compC.js`) podem ser
  convertidos do mesmo jeito (ainda **não** faça isso — o owner quer avaliar a B primeiro).

**Produto intocado:** este plugin não altera o Agenda 1.0.248, renderer, PWA, backend ou updater.
