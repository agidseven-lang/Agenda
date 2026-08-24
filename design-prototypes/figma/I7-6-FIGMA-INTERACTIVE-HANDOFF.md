# I7.6 — FIGMA MEU QUADRO EXPLORATION — INTERACTIVE HANDOFF

Handoff da sessão remota (Claude Code na web) para uma **sessão interativa** do Claude Code,
onde o conector Figma permanece habilitado na conversa. A sessão remota foi suspensa para
operações Figma porque `connected=true` mas `enabledInChat=false` revertia após wakes/retomadas.

**NÃO reiniciar do zero.** Todo o estado real já construído está no arquivo Figma oficial e
no ledger versionado.

---

## 1. Figma file
- **Nome:** Agenda ID Seven — Product Design
- **File key:** `aG7NXRdpCaiRDMeBiT8EKu`
- **URL:** https://www.figma.com/design/aG7NXRdpCaiRDMeBiT8EKu
- **Página de trabalho:** `Design` (Starter limita a 3 pages → usar sections/frames, não novas pages)

## 2. Design direction
**PREMIUM OPERATIONAL SAAS.** DNA: Linear (precisão/densidade), Attio (hierarquia/superfícies),
Stripe (maturidade/clareza), Height (densidade operacional), identidade ID Seven (petroleum + teal).
Três composições da mesma direção, diferindo só na **composição**:
- **A — Kanban-centric** (board dominante, rail mínimo)
- **B — Balanced Workspace** (board + contexto equilibrados)
- **C — Operational Cockpit** (board + inteligência operacional forte)
Nenhuma foi escolhida. Interface LIGHT, sem branco puro em todos os níveis. Acentos de coluna
coloridos (azul/âmbar/roxo/verde) + brand teal fazem parte da identidade.

## 3. Completed objects (reais no arquivo)
- Foundations — collection **Agenda Tokens** (`VariableCollectionId:2:2`, mode `2:0`): surface **S0–S6**,
  text (ink/ink2/ink3/inverse), border (line/line2), brand (teal/teal-strong/petroleum/petroleum2),
  status (todo/doing/review/done/danger) + collection **Scale** (`VariableCollectionId:2:25`: radius/space). Scopes aplicados.
- **Card A** (minimal), **Card B** (informational), **Card C** (operational) — componentes.
- **Composição B — sidebar**: petroleum, marca, botão Nova tarefa, nav primária (Meu quadro ativo,
  Cliente, Designers, Social Medias, Setores) + secundária (Calendário, Relatórios, Configurações)
  com ícones lucide SVG reais, rodapé de usuário.

## 4. Node / component ids
| Objeto | id |
|---|---|
| Card A (component) | `3:2` |
| Card B (component) | `4:2` |
| Card C (component) | `5:2` |
| Composição B (frame) | `6:2` |
| Composição B — sidebar | `6:3` |
| Agenda Tokens (collection) | `VariableCollectionId:2:2` (mode `2:0`) |
| Scale (collection) | `VariableCollectionId:2:25` |

Alturas de card: A=93, B=136, C=132. Tokens hex e ids de variável completos em `i76_state.json`.

## 5. Pending objects
1. **COMPOSITION_B_MEGA_CALL** (próxima ação) — rodar `i76_compB.js`: header, view controls,
   board well + 4 stages, 2 tarefas reais (instância de Card B + card "A fazer" inline),
   empty states (dashed), operational context rail (Resumo/SLA/Equipe). **Sem recriar sidebar/foundations/cards.**
2. Composição A completa (preparar `i76_compA.js`, usa Card A `3:2`).
3. Composição C completa (preparar `i76_compC.js`, usa Card C `5:2`).
4. Owner Choice Board (A/B/C lado a lado: nome/conceito/3 forças/2 tradeoffs/score).
5. Screenshots A/B/C (`get_screenshot`).
6. Re-read: metadata + variables + components + design_context.
7. Premium Scorecard + recomendação + entrega + HARD STOP aguardando APROVO A/B/C.

## 6. Ledger path
`design-prototypes/figma/i76_state.json` (fonte de verdade da retomada; ler primeiro).

## 7. Comp B script path
`design-prototypes/figma/i76_compB.js` — rodar o conteúdo como **UMA** `use_figma`
(`fileKey aG7NXRdpCaiRDMeBiT8EKu`, `skillNames resource:figma-use,resource:figma-generate-design`).
**Idempotência:** se `get_metadata` em `6:2` já mostrar um filho chamado `header`, B está pronta → pular para A.

## 8. Zero-cost policy
Figma **Starter / Free**. **CUSTO = R$0 / US$0.** Proibido: Professional, seat pago, upgrade,
billing, créditos. Se alguma operação exigir pagamento: não executar; usar alternativa gratuita.

## 9. Rate-limit observation
`FIGMA_STARTER_MCP_RATE_LIMIT = OBSERVED` · `RESET_WINDOW = UNKNOWN`. O limite de chamadas MCP do
Starter foi observado (mensagem de tool-call-limit). O tamanho da janela e o orçamento por janela
**não** foram provados — **não** afirmar "1 call/hora", "1 call/janela" ou "limite diário".
Mitigação: **mega-calls** (uma composição inteira por chamada), sem gastar chamada em probe/telemetria.

## 10. Connector instability in remote session
Na sessão remota, `ListConnectors` mostrou repetidamente `connected=true` mas `enabledInChat=false`
após wakes/retomadas, e as tools `mcp__Figma__*` não carregavam. O toggle por-conversa não persistiu.
`REMOTE_FIGMA_OPERATIONS_SUSPENDED = true`. `NEXT_EXECUTION_ENVIRONMENT = INTERACTIVE_CLAUDE_CODE`.
Em sessão interativa (app/desktop/VS Code) com o Figma habilitado na conversa, o toggle não cai.

## 11. Exact next action (na sessão interativa)
1. Abrir/confirmar o conector **Figma habilitado nesta conversa** (`enabledInChat=true`).
2. Ler `design-prototypes/figma/i76_state.json`.
3. **Sem probe.** Rodar `design-prototypes/figma/i76_compB.js` como UMA `use_figma` → Composição B completa.
4. 1 `get_screenshot` de `6:2` para validar; ajustar micro-craft se necessário.
5. Seguir para A, depois C (mesmo padrão de mega-call), owner choice board, screenshots, re-read, scorecard, recomendação.
6. HARD STOP aguardando o owner: APROVO A / APROVO B / APROVO C / refinamento.

> Caveat honesto: o `i76_compB.js` foi auditado offline mas **não executado** (o board completo não
> foi verificado visualmente). Os padrões de auto-layout (minHeight, counterAxis STRETCH, barra de
> acento ABSOLUTE) foram usados com sucesso nos componentes de card. Após rodar, tirar screenshot e
> corrigir qualquer clip/overlap com edições cirúrgicas — não reconstruir tudo.

## 12. Product safety status
`Agenda 1.0.248 = FROZEN` · `renderer = INTOCADO` · `PWA = INTOCADO` · `1.0.249 = NÃO CRIADA` ·
nenhuma implementação de produto · nada publicado · **custo R$0**. I7.6 = DESIGN ONLY.
