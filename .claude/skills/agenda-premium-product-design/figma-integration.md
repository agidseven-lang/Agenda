# INTEGRAÇÃO COM FIGMA (preparação — ativar quando autenticado)

> Estado atual: plugin Figma **habilitado**, mas o **conector MCP NÃO está autenticado** —
> as tools do Figma não estão carregadas nesta sessão (ver `toolchain.md`). Este arquivo
> prepara o fluxo para quando o owner autenticar o Figma no claude.ai.

## Papel do Figma no fluxo
Figma passa a ser a **superfície de design final** entre o Playground e a aprovação:
```
… → AGENDA DESIGN PLAYGROUND (HTML) → FIGMA (design final) → APROVAÇÃO DO OWNER → IMPLEMENTAÇÃO
```
O Playground continua sendo o laboratório rápido; o Figma é onde a direção aprovada vira
design system navegável e handoff.

## O que passa a ser possível (quando as tools carregarem)
- **Ler contexto de design real** do arquivo Figma (`get_design_context`, `get_metadata`).
- **Design-to-code** (`get_code`) alinhado ao nosso sistema de tokens (S0–S6, tipografia, cor).
- **Variáveis/tokens** (`get_variable_defs`) ↔ nossos tokens three-layer (design-system/).
- **Code Connect** (`get_code_connect_map`) para amarrar componentes Figma ↔ componentes reais.
- **Screenshot** de frames para o scorecard.

## Pré-condições e honestidade operacional
1. Owner autentica o conector Figma no claude.ai.
2. O redesign com Figma ao vivo deve rodar em **sessão interativa** — conectores MCP
   autenticados interativamente **podem não carregar em sessão headless/remota** como esta.
3. Nunca afirmar que o Figma está conectado sem confirmar via `ListConnectors`
   (`enabledInChat: true`) ou pela presença real das tools `figma:*`/MCP nesta sessão.

## Ponte com DesignSync (paralelo, já disponível)
Enquanto o Figma não entra, o **DesignSync** já permite manter uma **biblioteca de componentes
real** sincronizada com um projeto **Claude Design** (claude.ai/design) — um caminho legítimo
de design system versionado, incremental (um componente por vez). Ver skill `design-sync`.
