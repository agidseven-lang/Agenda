# R8 · RESPONSIVIDADE — VALIDAÇÃO 1366×768 @100% + WINDOWS 125% (Light UI)

**Status:** ✔ **APROVADA PELO OWNER (GO R8)** — responsividade 1366×768 + Windows 125% VALIDADA. Fonte funcional: Desktop **1.0.246**.
**Natureza:** VALIDAÇÃO do DS Golden congelado — **não é redesign**. Golden 1920 = IMUTÁVEL
(zero arquivo Golden alterado; verificado por `git status` antes do commit). Toda adaptação vive
em **cópias isoladas** em `r8-responsive/` (HTML Golden + um único bloco `<style id="r8">`
injetado no fim do `<head>` + hrefs `../`). Screenshots **NÃO são versionados** (política
histórica reconfirmada) — entregues apenas no chat.

---

## 1 · METODOLOGIA (instrumento e honestidade)

- **Instrumento:** Playwright 1.56.1 sobre Chromium (build 1194 do ambiente), com
  `browser.newContext({viewport:{width,height}, deviceScaleFactor})` — ou seja, **CDP
  `Emulation.setDeviceMetricsOverride`**, o mesmo mecanismo de métricas de dispositivo do
  Chromium/Electron. **Nenhum** `transform:scale()`, **nenhum** zoom CSS, **nenhuma** redução
  manual de screenshot.
- **Modos:**
  - `1366` → viewport CSS **1366×768** · DSF **1** · PNG físico **1366×768**.
  - `win125` → viewport CSS **1093×614** · DSF **1.25** · PNG físico **1366×768**
    (físico = DIP × 1,25).
- **Verificação por captura:** o harness imprime `innerWidth×innerHeight` e `devicePixelRatio`
  reais da página em cada render (confirmados: `1366x768 dpr1` e `1093x614 dpr1.25`).
- **Achado de harness (honestidade):** a 1ª tentativa usou `chrome --headless=new
  --window-size=1366,768 --screenshot`; medição com uma página-sonda (`div` 100vh) provou que o
  viewport real era **1366×681** (≈87px de chrome de janela) com o PNG "esticado" para 768 —
  isso **invalidaria** o teste. O harness foi trocado pelo Playwright acima ANTES de qualquer
  captura ser considerada. Registrado para nunca regredir.

**Critérios de PASS (12, aplicados a cada captura):** nenhum elemento essencial cortado · nenhum
CTA inacessível · nenhum footer sobre conteúdo · nenhum modal fora do viewport · header íntegro ·
sidebar não sobrepõe conteúdo · tipografia = Golden (nenhum token reduzido) · nenhum alvo de
clique reduzido de forma insegura · scroll só onde justificado · nenhuma perda de conteúdo ·
nenhuma mudança de função · nenhum componente inventado.

---

## 2 · AUDITORIA ELECTRON / JANELA REAL (P0 — feita ANTES de simular)

`audit/main.ts` (Desktop 1.0.246), linhas 651–655:

- `new BrowserWindow({ width: 1440, height: 900, minWidth: 1024, minHeight: 640, … })`
- `contextIsolation: true`, `nodeIntegration: false` (não afetam layout; registrados).
- **Não existe** `zoomFactor` custom, **não existe** manipulação de `deviceScaleFactor` —
  o app segue a escala do SO (modelo **DIP** padrão do Chromium/Electron no Windows).

Consequências para o teste:
- Em display 1366×768 @125%, a área útil é ≈ **1092,8×614,4 DIP**. `minWidth/minHeight` valem
  para redimensionamento do usuário; janela **maximizada** segue a work area do Windows.
  O próprio renderer real documenta o alvo: *"Escala 125% (viewport ~1092×614)"* e *"escala
  125% ≈ 614px úteis"* — exatamente o viewport do modo `win125` (1093×614). Ou seja, o modelo
  do harness coincide com o modelo que o produto real já usa.
- `min-width:1024px` (o minWidth real) foi aplicado ao `.frame` das cópias; **min-height NÃO**
  (a work area maximizada pode ficar abaixo de 640 DIP a 125% — cf. acima).

## 3 · METODOLOGIA DPI 125% (por que é fiel)

- Windows 125% = escala de SO; Chromium traduz em `devicePixelRatio 1.25` com layout em DIP.
  O modo `win125` reproduz exatamente isso: **layout a 1093×614 DIP + rasterização a 1,25×**
  → PNG físico 1366×768, como numa tela real 1366×768 @125%.
- `transform:scale`/zoom CSS foram **proibidos e não usados**: mudariam o layout (viewport CSS
  errado) e/ou a rasterização (blur), não reproduzindo o comportamento de DPI do SO.
- O produto real ainda tem uma defesa extra de posicionamento: o menu portal dos cards
  **se auto-calibra** medindo onde `left:0/left:100px` caem de verdade — comentário literal:
  *"posicionamento exato independentemente de qualquer escala/zoom de SO ou do Chromium"*
  (renderer ~12394–12400). Registrado como contrato real de robustez a DPI.

## 4 · INVENTÁRIO DE BREAKPOINTS REAIS (renderer 1.0.246)

| Tipo | Query | Efeito real |
|---|---|---|
| Altura | `max-height:660px` (×3 blocos) | login compacto SEM scroll (logo 54 · h1 22 · title 19 · vfooter 14) · chrome do quadro encolhe (só chrome; card V2 já cabe) · card tcv4 compacta (clamp 1 linha, temas viram contador) |
| Altura | `max-height:740px` · `849px` · `850–999px` · `1000–1039px` · `1040px+` | densidade do kanban por faixas de altura |
| Movimento | `prefers-reduced-motion` | desliga animações |
| Largura | `max-width:560px` (×4) · `520` · `720` · `440` | sheets/pr-arts/modais em telas estreitas |
| Largura | `max-width:1100px` | Executivo 2-col → 1-col |

**Fato registrado:** os protótipos Golden são composições FIXAS 1920×1080 sem media queries —
por design de apresentação. A responsividade é contrato de IMPLEMENTAÇÃO; a R8 valida que o DS
congelado SOBREVIVE aos dois viewports obrigatórios sem trair token nenhum.

## 5 · MATRIZ DE RISCO (por arquétipo)

| Arquétipo | Risco 1366 | Risco 125% | Mecanismo crítico |
|---|---|---|---|
| F1 Board (4 col + drawer) | ALTO | ALTO | largura de colunas × drawer 416 |
| F6 Detalhes (3 col) | ALTO | ALTO | 1fr+354+332 não cabem |
| F7C Wizard denso | MÉDIO | ALTO | altura do card 920 + footer |
| F8 Agenda (2 panes) | MÉDIO | ALTO | células do mês legíveis |
| F9 Notificações | BAIXO | MÉDIO | coluna 1200 + filtros |
| F10 Executivo | MÉDIO | MÉDIO | ex 1360 + 5 KPIs + toolbar |
| F11 Relatórios | MÉDIO | ALTO | tabela C7 nunca encolhe tipografia |
| F12 Login | BAIXO | ALTO | media real 660 tem que disparar |
| F13 Modal | MÉDIO | ALTO | sheet 88vh · pr-list · footer/X |

## 6 · MATRIZ DE VALIDAÇÃO (Testes A–I)

| Teste | Frame | Cópia r8 | 1366×768 @1× | 1093×614 @1.25× (125%) |
|---|---|---|---|---|
| A | F1 Meu Quadro V10 | `r8-f1-board.html` | **PASS** (+ prova extra sem drawer) | **PASS** |
| B | F6 Detalhes | `r8-f6-detalhes.html` | **PASS** | **PASS** (após fixes P1) |
| C | F7C Wizard | `r8-f7c-wizard.html` | **PASS** | **PASS** |
| D | F8 Agenda | `r8-f8-agenda.html` | **PASS** | **PASS** (após fix P2 CTA) |
| E | F9 Notificações | `r8-f9-notificacoes.html` | **PASS** | **PASS** |
| F | F10 Executivo | `r8-f10-executivo.html` | **PASS** | **PASS** (após fix P1 toolbar) |
| G | F11 Relatórios | `r8-f11-relatorios.html` | **PASS** | **PASS** |
| H | F12 Login | `r8-f12-login.html` | **PASS** (media 660 NÃO dispara — correto) | **PASS** (media 660 dispara — espelho fiel) |
| I | F13 Modal Legendas e artes | `r8-f13-modal.html` | **PASS** | **PASS** |

Decisões de mecanismo por teste (auditadas, não assumidas):
- **A (F1):** colunas kanban `minmax(264px,1fr)` (≈ card Golden) + **scroll-x controlado** no
  board (padrão kanban legítimo; ~110px a 1366) + **drawer vira OVERLAY** ≤1600px (não comprime
  o board; sombra à esquerda; ancorado sob o header 92px). Prova complementar: captura
  `sem-drawer` mostra as 4 colunas utilizáveis. Espelha o real: a 125% o renderer compacta só o
  CHROME do quadro (`max-height:660`).
- **B (F6):** 3→2 colunas ≤1560px (ordem preservada; coluna 3 = faixa full-width abaixo);
  ≤1200px a lateral vai ao piso 310px; linha do tempo horizontal = **scroll-x controlado no
  painel** (mín-conteúdo real 781px); scroll-y da página = comportamento real.
- **C (F7C):** card ganha teto `100vh − header − respiro` e o corpo `.scrolly` (que o Golden JÁ
  projetou como região de scroll interno) absorve a altura via flex. Stepper e footer persistem.
- **D (F8):** mês + painel do dia lado a lado até 1240px (painel 384px a 1366 ⇒ células ≈86px,
  legíveis); ≤1240px o painel do dia REFLUI para baixo do calendário (nada some).
- **E (F9):** coluna `min(1200px,100%)`; filtros com wrap (mandato permite explicitamente).
- **F (F10):** `min(1360px,100%)`; KPIs `auto-fit ≥186px` (5→3+2 a 125%); grade 1fr 400 → 1fr
  340 → 1 col; toolbar com wrap; scroll-y = comportamento real da superfície.
- **G (F11):** decisão C7: **o card da tabela ganha scroll-x controlado** (`overflow-x:auto` +
  `.tbl{min-width:560px}`) — a tipografia da tabela NUNCA encolhe. A 1366 e a 125% a tabela
  coube SEM scroll (empilhamento ≤1440px libera a largura); o scroll só armaria abaixo de
  ~1024 DIP úteis. `rep-filters` já tinha wrap no Golden (registrado).
- **H (F12):** a cópia ganha o ESPELHO da media REAL `@media(max-height:660px)` mapeada para as
  classes Golden (logo 54 · h1 22 · title 19 · vfooter 14 · paddings) — nenhuma regra além do
  mapa. A 768 ela NÃO dispara (correto); a 614 dispara e o card cabe SEM scroll, footer visível.
- **I (F13):** contrato C2 real aplicado: `.sheet{max-width:min(680px,94vw);max-height:88vh}`
  e `.pr-list` flexível ≤56vh (o 655px fixo era altura de COMPOSIÇÃO 1920). X e footer
  (Cancelar · Salvar · Salvar e reenviar ao cliente) permanecem visíveis nos dois viewports.

## 7 · CAPTURAS (entregues no chat; NÃO versionadas)

Nomenclatura declarativa: viewport/DSF no nome; frame no prefixo. 19 arquivos (10 × 1366 incl. prova sem-drawer + 9 × win125):
`R8-F1-1366x768.png` · `R8-F1-1366x768-sem-drawer.png` (prova A) · `R8-F6-1366x768.png` ·
`R8-F7c-1366x768.png` · `R8-F8-1366x768.png` · `R8-F9-1366x768.png` · `R8-F10-1366x768.png` ·
`R8-F11-1366x768.png` · `R8-F12-1366x768.png` · `R8-F13-1366x768.png` e
`R8-F{1,6,7c,8,9,10,11,12,13}-win125.png`. Todos: 1366→ CSS 1366×768 DSF 1 · PNG 1366×768;
win125→ CSS 1093×614 DSF 1.25 · PNG 1366×768. Todas em tamanho real (nunca thumbnail).
O modo 125% foi capturado para **todos os 9 arquétipos** (mínimo exigido era 7; Executivo e
Notificações incluídos — custo zero e prova mais forte).

## 8 · ACHADOS (P0/P1/P2) — todos com correção aplicada NA CÓPIA (nunca no Golden)

| # | Sev | Achado | Correção na cópia |
|---|---|---|---|
| 1 | P0 (harness) | `--headless=new --window-size` ≠ viewport (1366×681 real) — teste inválido | harness Playwright/CDP com viewport+DSF exatos; verificação `innerWidth/dpr` por captura |
| 2 | P0 | A 1093 DIP, `min-width:auto` de itens de grid inflava a coluna do `.main` p/ 957px → header cortava pill SLA + sino (CTA inacessível) | shim estrutural `.main>*{min-width:0}` + `.hd>*{min-width:0}` (todas as cópias); title com ellipsis |
| 3 | P1 | F6 a 125%: `.cols` (grid item) sem `min-width:0` estourava 831px → coluna EQUIPE cortada no viewport | `.page>*{min-width:0}` (shim global das cópias) |
| 4 | P1 | F6 a 125%: régua OPERAÇÃO 3-col clipava texto ("RESPONSABILID…") | `.op` vira pilha 1-col ≤1200px (divisores horizontais) |
| 5 | P1 | F6 a 125%: linha do tempo horizontal min-content 781 > 745 úteis | scroll-x controlado no painel (mecânica preservada) |
| 6 | P1 | F10 a 125%: 4º select ("Status SLA") cortado; segmentos quebravam por dentro | `.ex-tools`/`.ex-fls` com wrap; `.seg button{white-space:nowrap}` |
| 7 | P2 | F6 a 125%: chips de status quebravam POR DENTRO e colidiam com "RESPONSÁVEL AGORA" | `.hchip{white-space:nowrap}` + `.hero-chips{flex-wrap:wrap}` |
| 8 | P2 | F8 a 125%: "Novo compromisso" quebrava em 2 linhas dentro do pill | `.ag-new{white-space:nowrap}` + toolbar wrap |

Nenhum achado exigiu mudança FUNCIONAL nem token novo ⇒ zero dívida funcional nova nesta fase.
Itens 2–3 são **requisitos de implementação** a registrar no contrato (ver §12).

## 9 · ADAPTAÇÕES ("ADAPTAÇÃO LIGHT PROPOSTA" — só nas cópias, documentadas no próprio CSS)

Base comum: `.frame` 1920×1080 fixo → `100vw×100vh` + `min-width:1024px` (minWidth real).
Scroll-y de página onde o produto real rola (F6/F8/F10/F11) = comportamento honesto, não
gambiarra. Cada bloco por frame está comentado dentro de `<style id="r8">` da respectiva cópia
(decisão + porquê). Prioridade seguida à risca: **REFLOW → WRAP → SCROLL controlado**; nenhum
14px virou 10px; nenhum alvo encolheu; sidebar 284 permanece (não existe contrato de sidebar
colapsada no código real — auditado; **não inventada**); login permanece standalone.

## 10 · COBERTURA SUPERFÍCIES B (por arquétipo responsivo)

| Superfície B | Arquétipo que a cobre | Veredito |
|---|---|---|
| Prioridades | F9 (coluna central + filtros wrap + lista) + F1 (cards) | COVERED BY RESPONSIVE ARCHETYPE |
| Hoje | F10 (stat-tiles auto-fit) + F8 (eventCard lista) | COVERED BY RESPONSIVE ARCHETYPE |
| Hub / quadros por pessoa | F1 (board shell) + F5≈F1 (faixas de cards) | COVERED BY RESPONSIVE ARCHETYPE |
| Equipe | F9 (lista de linhas em coluna central) | COVERED BY RESPONSIVE ARCHETYPE |
| Perfil | F6 (colunas → reflow) + C2 sheets (F13) | COVERED BY RESPONSIVE ARCHETYPE |
| Configurações | F6/F9 (página 1-col de seções; settrows = C1) | COVERED BY RESPONSIVE ARCHETYPE |

Nenhuma B tem mecânica de layout que não exista nos 9 arquétipos testados ⇒ **zero screenshot
extra necessário** (NEEDS EXTRA PROOF: nenhuma).

## 11 · COBERTURA C1–C8 (foundation → preocupação responsiva → prova)

| Cn | Preocupação | Prova |
|---|---|---|
| C1 Forms | campos/labels em largura mínima | F7C (form denso a 745px úteis) + F12 (form 376px) |
| C2 Modais/Sheets | 88vh · 94vw · footer/X visíveis | F13 nos 2 viewports; medias reais 560/520/720/440 registradas §4 |
| C3 Menus | **nunca sair do viewport** | CÓDIGO REAL: clamp `max(8,min(r.right−mw, innerWidth−mw−8))` + fallback vertical `innerHeight−mh−8` + autocalibração p/ escala de SO (renderer ~12402–12404); RTE menu idem (~10930). evd-menu: ancorado DENTRO do sheet (abre p/ cima, `bottom:calc(100%+8px)`), portanto herda a contenção do sheet. Provado por auditoria, sem imagem nova. |
| C4 Empty states | escala em largura | 1 linguagem/3 escalas centrada — sem dimensão fixa (documental) |
| C5 Loading/Splash | centrados/fluidos | splash centrado; rev-send inline (documental) |
| C6 Toasts | stack no viewport a 125% | CÓDIGO REAL: `.ntf{width:420px;min-width:340px;max-width:94vw}` (linha ~4464) e canal SLA `.sla-notif{width:360px;max-width:92vw}` (~3668). A 1093 DIP: 94vw=1027 e 92vw=1005 ⇒ larguras fixas 420/360 valem e cabem com folga; a trava só age <~453/391 DIP. Provado aritmeticamente do código; sem imagem nova. Nota: o mandato citou "94vw" — confirmado no stack premium; o canal `.sla-notif` usa **92vw** (valor real registrado). |
| C7 Tabela | tipografia NUNCA encolhe | F11: scroll-x controlado no card (armado; não necessário a 1366/125% pós-empilhamento) |
| C8 Estados | alvos/focus inalterados | nenhuma cópia altera alvo/estado; tokens intactos (inspeção das 17 capturas) |

## 12 · NÃO RESOLVIDO / REQUISITOS DE IMPLEMENTAÇÃO (não são pendências visuais)

1. **Requisito estrutural (novo, desta fase):** na implementação, toda linha filha do grid do
   `.main` e da `.page` precisa de `min-width:0` (achados #2/#3). Sem isso, o shell Golden
   estoura o viewport a 125% — é regra de engenharia do DS, não decisão de design.
2. As regras de reflow das cópias (§6) são **PROPOSTA** de contrato responsivo do Light UI;
   viram spec de implementação só com GO do owner (nenhuma mudança em contrato Golden agora).
3. Dívidas pré-existentes intactas (alert()/confirm() nativos etc.) — fora do escopo R8.

## 13 · GO/NO-GO (honesto)

- Windows 125% foi reproduzido **fielmente** (DSF 1.25 nativo do motor + viewport DIP idêntico
  ao que o próprio renderer real documenta) ⇒ o gate de honestidade NÃO exigiu "PARCIAL".
- 18 execuções de teste (9 arquétipos × 2 viewports) + 1 prova complementar = **18/18 PASS**
  após os 8 achados corrigidos nas cópias.
- **Decisão do owner: R8 = GO (APROVADO).** Responsividade oficial: 1920 Golden · 1366 validado · 125% validado.
