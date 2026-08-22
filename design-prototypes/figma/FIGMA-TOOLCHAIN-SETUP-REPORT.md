# FIGMA TOOLCHAIN SETUP — RELATÓRIO (I7.5 Figma Full Ownership)

Data: 2026-08-22 · Sessão: remota/headless (Claude Code na nuvem).
Objetivo do owner: tornar o Figma a **source of truth de design** do Agenda ID Seven;
Claude executa discovery → install → enable → connect → authenticate → validate → use,
parando só no ponto de consentimento humano (OAuth), com prova técnica.

## DISCOVERY (executado, não assumido)
| Sinal | Resultado | Evidência |
|---|---|---|
| FIGMA_FOUND | **true** | registro MCP retorna "Figma" (uuid c758d038-d8eb-4421-b426-9dd68dc7f84a); tools: get_design_context, get_code, get_screenshot, get_metadata, get_variable_defs, get_code_connect_map, create_design_system_rules, generate_diagram, get_figjam |
| FIGMA_INSTALLABLE | **true** | presente no registro de conectores da conta |
| FIGMA_ALREADY_INSTALLED | **false** | `ListConnectors` não lista Figma; registro `installState:not_installed` |
| FIGMA_ENABLED (plugin) | **true** | plugin `figma` (knowledge-work-plugins) `enabled:true` — bundle de skills + declara mcp_server, mas ≠ conexão MCP ativa |
| FIGMA_CONNECTED | **false** | `connected:false`, `enabledInChat:false`; sem tools `figma:*`/MCP nesta sessão |
| CLI `claude` | presente (`/opt/node22/bin/claude`) | `claude mcp` disponível |
| MCP config local/user | vazio | `/root/.claude.json` → `mcpServers:{}` |
| Env FIGMA | nenhuma | `env` sem chaves Figma |

## AÇÕES EXECUTADAS POR CLAUDE (não delegadas)
1. **Adicionei o MCP remoto do Figma via CLI** — sucesso:
   `claude mcp add --transport http figma-probe https://mcp.figma.com/mcp` →
   *"Added HTTP MCP server figma-probe … to local config"*.
2. **Health-check da conexão** — `claude mcp get figma-probe` →
   **`Status: ! Needs authentication`** (o provedor exige OAuth).
3. **Reachability do endpoint** — `curl https://mcp.figma.com/mcp` →
   **`CONNECT tunnel failed, response 403`** (proxy da sessão bloqueia egress ao Figma).
4. **Surfacing do conector de diretório** (via claude.ai, que roteia pelo proxy Anthropic
   permitido) — card de conexão renderizado para o owner.
5. **Cleanup** — `claude mcp remove figma-probe` (ambiente limpo).

## BLOQUEIO TÉCNICO (prova, não suposição)
Dois bloqueios reais, ambos comprovados:
- **B1 — OAuth obrigatório:** `Status: Needs authentication`. A conexão exige consentimento
  humano (login Figma). Sessão headless remota **não abre o fluxo OAuth**.
- **B2 — Egress bloqueado:** `mcp.figma.com` e `api.figma.com` → **403 CONNECT** pelo proxy
  da sessão. O endpoint cru do Figma não é alcançável daqui.
  - Nuance: o **conector de diretório do claude.ai** roteia por `mcp-proxy.anthropic.com`
    (que ESTÁ na allowlist do proxy) — então o caminho *diretório* evita o B2. Resta o B1
    (OAuth) + a limitação documentada de que conectores autenticados interativamente
    **podem não carregar em sessão headless/remota**.

## AÇÃO HUMANA ÚNICA NECESSÁRIA
**Autorizar o conector Figma na sua conta:** claude.ai → Configurações → Conectores →
**Figma → Conectar** → autorizar (tela OAuth do Figma). É o único passo que o provedor
exige de um humano; não há tool que eu possa chamar para consentir por você.

## DEPOIS DO CONSENTIMENTO — onde o Figma fica operacional
- **Sessão interativa do Claude Code** (app desktop / VS Code / JetBrains / `claude` no seu
  computador, logado na sua conta): as tools do Figma carregam e eu leio/gero a partir do
  seu arquivo. **É o ambiente correto para o redesign guiado por Figma.**
- **Esta sessão remota:** após você autorizar, pode ser que as tools passem a aparecer (o
  conector de diretório usa o proxy permitido); se não aparecerem (limitação headless
  documentada), seguimos na sessão interativa. Eu re-verifico aqui a pedido.

## CAPABILITIES (honestas — nenhuma comprovada AINDA, pois não conectado)
READ=NÃO PROVADO · WRITE=NÃO PROVADO · CREATE_DESIGN=NÃO PROVADO · EDIT_EXISTING=NÃO PROVADO ·
SCREENSHOT=NÃO PROVADO · VARIABLES=NÃO PROVADO · COMPONENTS=NÃO PROVADO · CODE_CONNECT=NÃO PROVADO ·
DESIGN_TO_CODE=NÃO PROVADO.
> As tools anunciadas pelo registro (get_design_context, get_code, get_variable_defs,
> get_code_connect_map, get_screenshot, get_metadata…) sugerem forte READ + DESIGN_TO_CODE.
> A criação/escrita de arquivos/páginas do Figma normalmente NÃO é suportada por esse
> conector (é orientado a *ler contexto e gerar código*). Confirmação real só após conectar.

## FIGMA PROJECT (FASE 8) — NÃO CRIADO (bloqueado; não simulado)
Não criei arquivo/páginas no Figma (conector não operacional). Estrutura-alvo registrada
para quando estiver ativo: `Agenda ID Seven — Product Design` · páginas 00 Cover / 01
References / 02 Foundations / 03 Components / 04 Patterns / 05 Meu Quadro Exploration /
06 Meu Quadro Candidate / 07 Responsive / 08 Prototype / 09 Handoff / 99 Archive.
Observação: se o conector for read/design-to-code apenas, a **criação** do arquivo Figma é
feita por você (ou por um plugin de escrita), e Claude passa a **ler/gerar** a partir dele.

## PRÓXIMA FASE
`I7.6 — FIGMA MEU QUADRO EXPLORATION` (3 composições PREMIUM OPERATIONAL SAAS: A Kanban-
centric / B Balanced workspace / C Operational cockpit) — **só inicia após o Figma
operacional e GO do owner**. Não iniciar automaticamente.

## PÓS-AUTORIZAÇÃO (owner autorizou; tools Figma carregaram nesta sessão)
- **Conexão comprovada (READ/auth):** `mcp__Figma__whoami` → handle "Id Seven",
  email agidseven@gmail.com, plano `team::1673067149303361523`, **seat: "View"**, tier starter.
- **Tools reais expostas:** whoami, get_design_context, get_screenshot, get_metadata,
  get_variable_defs, get_code_connect_map, get_libraries, search_design_system,
  create_new_file, use_figma, generate_figma_design, upload_assets, download_assets,
  generate_diagram, get_figjam, get_figma_skill… (nomes literais do servidor).
- **Teste de ESCRITA (create_new_file):** BLOQUEADO por DOIS gates reais:
  - **G1 — aprovação de permissão da sessão:** retornou *"MCP tool call requires approval"*.
    As tools de escrita exigem aprovação do owner nesta sessão (não autoaprovável em sessão autônoma).
  - **G2 — assento "View":** provável recusa do Figma a criar/editar mesmo após G1 —
    View não escreve. Requer assento **Editor** no time.
- **READ de conteúdo:** tools presentes, porém ainda não demonstrado num nó real (não há
  arquivo/URL para apontar — a criação está bloqueada por G1/G2). whoami já prova auth/READ.

### CAPABILITIES (atualizado, honesto)
CONNECTION/AUTH = SIM (provado) · READ_CONTENT = PROVÁVEL (tools presentes; sem arquivo p/ provar) ·
WRITE/CREATE_DESIGN/EDIT = BLOQUEADO (G1 aprovação + G2 assento View) · SCREENSHOT/VARIABLES/
COMPONENTS/CODE_CONNECT/DESIGN_TO_CODE = disponíveis como tools, pendentes de um arquivo-alvo.

### AÇÃO HUMANA NECESSÁRIA (2 itens)
1. **Aprovar** as tools de escrita do Figma (`create_new_file`, `use_figma`) nesta sessão
   (ou rodar numa sessão interativa onde você aprova o prompt ao vivo).
2. **Assento Editor:** elevar a conta agidseven@gmail.com de **View → Editor** no time Figma
   (admin do time faz em figma.com → Members). Sem isso, o Figma recusa escrita.
Alternativa para READ imediato: me enviar a **URL de um arquivo Figma** existente (design)
que eu já leio agora (get_metadata/get_design_context/get_screenshot) para provar READ de conteúdo.

## POSTO DE CONTROLE
1.0.248 = congelada · PWA/renderer/produção = intocados · 1.0.249 = não criada ·
nenhum mockup HTML novo · ambiente MCP limpo (probe removido) · Figma READ-conectado, WRITE pendente (G1+G2).

## ZERO-COST POLICY AUDIT (correção do owner — Figma exclusivamente gratuito)
Política do owner: **NENHUM plano/assento pago** (não pedir Professional, Full/Dev seat,
Organization, Enterprise, Weave pago, add-on). Usar só **Figma Starter/Iniciante = GRATUITO**.
Hard cost gate = **R$0 / US$0**.

### Estado verificado nesta sessão (2026-08-22)
- **Plano/custo:** `whoami` anterior provou **tier starter, seat "View"**, plano
  `team::1673067149303361523`. **FIGMA PLAN = STARTER/FREE**, **FIGMA COST = ZERO**. Nenhuma
  ação paga executada; nenhuma será.
- **Conector (ListConnectors):** `installState:"connected"`, `connected:true`,
  **`enabledInChat:false`** → o conector segue **autenticado** na conta, porém **desligado
  para este chat**. As tools `mcp__Figma__*` **não estão carregadas neste turno** (confirmado:
  ToolSearch por figma retornou só `SearchMcpRegistry`).
- **Consequência:** os testes de escrita/geração **não rodam neste turno** — não por custo,
  mas por (a) conector *toggled off* neste chat e (b) sessão remota autônoma não aprova o
  prompt das tools de escrita ao vivo (G1).

### Resultado dos 7 campos (honesto)
| Campo | Resultado | Motivo |
|---|---|---|
| FIGMA PLAN | **STARTER/FREE** | tier starter (whoami) |
| FIGMA COST | **ZERO** | nenhuma ação paga; hard gate R$0 respeitado |
| MCP READ | **PASS** (provado antes) | whoami retornou identidade/plano/seat = auth+read OK no free tier; hoje não re-executável (conector off no chat) |
| DRAFT CREATE | **FAIL nesta sessão — NÃO por custo** | tools off no chat + G1 (aprovação de escrita não concedível em sessão autônoma) + G2 (seat View read-only) |
| CODE TO CANVAS | **FAIL nesta sessão — NÃO por custo** | mesmos motivos; `generate_figma_design` é write-path |
| FIGMA RE-READ | **N/A** | nenhum design criado para reler |
| PAID FEATURE REQUIRED | **NÃO** | o redesign continua sem qualquer recurso pago do Figma |

### Registro obrigatório
`STRUCTURED_WRITE_TO_CANVAS = UNAVAILABLE UNDER ZERO-COST POLICY` — e, adicionalmente,
indisponível nesta sessão remota por G1 (aprovação ao vivo). **Isto NÃO bloqueia o redesign.**

### Onde o WRITE/GERAÇÃO gratuito é possível (sem custo)
O bloqueio é de **tipo de sessão**, não de dinheiro. As tools de escrita/geração do Figma
precisam de uma **sessão interativa** do Claude (app desktop / VS Code / claude.ai) onde o
owner clica "aprovar" no prompt, e do conector Figma **ligado naquele chat**. Tudo isso é
**gratuito** (Starter permite ao owner criar/editar seus próprios Drafts). A leitura
(get_metadata/get_design_context/get_screenshot/get_variable_defs) já está provada no free.

### Ação zero-custo para reabilitar os testes nesta linha (opcional)
1. Ligar o conector **Figma neste chat** (claude.ai → Conectores → habilitar no chat) — free.
2. Para o write-path, rodar numa **sessão interativa** e aprovar o prompt das tools — free.
Sem nenhum desses passos, o redesign **prossegue mesmo assim** (READ + P1 Golden/spec locais).
