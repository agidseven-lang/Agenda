# TOOLCHAIN DE DESIGN DO AGENDA — estado real (auditado nesta sessão)

Registro honesto do que existe, o que está pendente de ação do owner e o que **não existe**
no catálogo. Reavaliar quando Figma e Modern Web Guidance forem habilitados.

## REGISTROS OBRIGATÓRIOS DE INDISPONIBILIDADE
```
FRONTEND DESIGN OFFICIAL = NOT AVAILABLE IN CURRENT CATALOG
PLAYGROUND OFFICIAL      = NOT AVAILABLE IN CURRENT CATALOG
```
- **frontend-design** é citada como *dependência* por outras skills (design, banner-design),
  mas **não existe** como plugin/skill instalável no marketplace `knowledge-work-plugins`
  nem em disco. Decisão do owner (aprovada): **replicar os princípios** dentro desta skill —
  ver `process/frontend-design-principles.md`. Nunca afirmar que foi instalada.
- **playground** oficial não existe no catálogo nem em disco. Decisão do owner (aprovada):
  criar um **Agenda Design Playground** local em HTML — ver `../../../<repo>/design-prototypes/agenda-design-playground/`.
  Nunca afirmar que um "Playground oficial" foi instalado.

## ATIVO NESTA FASE (usar)
| Ferramenta | Papel | Como acessar |
|---|---|---|
| **Design** (plugin, enabled) | linguagem de design, rotas design-system | skills `design:*` (quando invocáveis) + skill local `design` |
| **UI/UX Pro Max** (em disco) | estilos/paletas/tipografia/UX/ícones pesquisáveis | `search.py "<q>" -d <dom>` |
| **agenda-premium-product-design** (esta) | autoridade do Agenda + gate | esta skill |
| **DesignSync** (tool) | sincronizar biblioteca de componentes a um projeto Claude Design | tool `DesignSync` + skill `design-sync` |
| **Skill Creator** (skill) | criar/endurecer esta skill | skill `skill-creator` |

## PENDENTE — depende de ação do OWNER no claude.ai
| Ferramenta | Estado real | Ação necessária |
|---|---|---|
| **Modern Web Guidance** | plugin existe, `enabled:false` | owner habilita (card já renderizado) |
| **Figma** | plugin habilitado, mas **conector MCP NÃO autenticado** — tools do Figma NÃO carregadas nesta sessão | owner autentica o conector Figma no claude.ai; redesign com Figma ao vivo deve rodar em **sessão interativa** (MCP autenticado pode não carregar em sessão headless) |

## Quando Figma + Modern Web Guidance ficarem disponíveis
Reavaliar a toolchain e informar ao owner **exatamente** o que passou a ser possível:
- Figma: ler contexto de design real, `get_code`/design-to-code, tokens/variáveis, Code Connect.
  Figma passa a ser a **superfície de design final** do fluxo.
- Modern Web Guidance: best practices modernas de layout/CSS aplicadas ao Playground e à implementação.
