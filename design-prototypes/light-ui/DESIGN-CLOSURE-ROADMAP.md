# AGENDA ID SEVEN — LIGHT UI · DESIGN CLOSURE ROADMAP

**Origem:** Checkpoint Global do Design (Frames A 1–13 = GOLDEN, decisão do owner).
**Função:** sequência oficial para terminar o DESIGN. Derivada da auditoria real do
`MASTER-SURFACE-MAP.md` (30 superfícies; taxonomia C1–C8 do §F) + `C1-FORMS-CONTROLS-CONTRACT.md`
+ `REFINEMENT-NOTES-C.md`. **Nenhuma etapa foi iniciada.** Cada etapa só começa com GO do owner.
**Regra permanente:** implementação Light UI **PROIBIDA** até o owner declarar DESIGN COMPLETO.

Formato de cada etapa: Objetivo · Artefato · Dependência · Imagem? · Owner approval? · Critério
de fechamento.

---

## R1 · CONSOLIDAÇÃO DO CHECKPOINT GLOBAL ✔ (esta fase)
- **Objetivo:** congelar documentalmente F1–13, promover candidatos C1 §10–15, corrigir taxonomia
  (modal → C2), consolidar dívidas, registrar estado real de foundations/responsividade/a11y.
- **Artefato:** atualizações em MASTER-SURFACE-MAP / C1-CONTRACT / REFINEMENT-NOTES + este roadmap.
- **Dependência:** aprovação F13 (dada). **Imagem?** NÃO. **Owner approval?** SIM (do relatório).
- **Fechamento:** owner aceita o checkpoint (GO para R2).

## R2 · C1 COMPLETION — FRAME DE ESTADOS ✔ APROVADO PELO OWNER (GO)
> **C1 = GOLDEN / COMPLETA no escopo real do produto** (commit `3c06c26`). Exclusões formais
> permanentes: radio · multi-select · paginação · skeleton · validation summary (inexistentes).
> **Status:** prancha `r2-c1-completion-estados.html` entregue (spec board 1920×1080). Estados
> reais provados + exclusões formais auditadas (validation summary = `alert()` nativo · radio ·
> multi-select · paginação · skeleton — inexistentes). Candidatos registrados no C1 §16.
> **C1 NÃO declarada completa**; critério de fechamento = aprovação do owner. R3 não iniciado.
- **Objetivo:** demonstrar sobre superfícies REAIS da 1.0.246 os estados C1 ainda sem prova:
  **disabled genérico · error inline (`sq-err`/`cqErr`) · saving/loading ("Salvando cronograma…",
  anti-duplo-clique) · validation summary (real = `alert()` — representar fiel ou registrar
  divergência p/ owner) · destructive confirmation (del-sheet real — também âncora C2) ·
  checkbox (`checklistHtml` de setor real que o usa)**. Multi-select: inexistente no real —
  propor EXCLUSÃO formal do escopo C1 (owner ratifica).
- **Artefato:** 1 frame único de componente ("C1 STATES", grade de amostras reais) + C1 §3 → §1/§2.
- **Dependência:** R1. **Imagem?** SIM (1). **Owner approval?** SIM.
- **Fechamento:** C1 sem pendências no escopo ratificado ⇒ **C1 = GOLDEN COMPLETA**.

## R3 · C2 — MODAIS & SHEETS · DESIGN CONTRACT ✔ APROVADO PELO OWNER (GO)
> **C2 = FOUNDATION OFICIAL / GOLDEN DOCUMENTAL** (commit `f9fe31a`); âncoras F13 + del-sheet R2.
> **Status:** `C2-MODALS-SHEETS-CONTRACT.md` criado (documental, ZERO imagem nova): inventário
> integral (20 modais/sheets reais + exclusões), taxonomia de 5 famílias + 2 containers próprios,
> tokens, scroll/header/footer/close, a11y comprovado×requirement (trap real em evd/det — corrige
> o registro do R1), dívidas e gaps visuais (§17). Âncoras: F13 + del-sheet R2. Nenhuma
> superfície nova (30/30 intacto). **C2 NÃO declarada concluída**; R4 não iniciado.
- **Objetivo:** contrato dedicado da C2 com âncora no F13 Golden (sheet 680/r18, backdrop+blur 3px
  real, lista interna rolável, footer 3 ações, selo de ícone, X) + anatomia dos demais modais
  reais (del-sheet destrutivo [prova visual vem do R2], sheet de evento da Agenda [documentado no
  F8], picker de designer/prazo, confirmações de fluxo). Definir se focus-trap entra como
  requisito de implementação (não é contrato do código atual).
- **Artefato:** `C2-MODALS-SHEETS-CONTRACT.md`. **Dependência:** R2 (del-sheet).
- **Imagem?** NÃO (F13 + R2 já são as provas; nova imagem só se o owner exigir sheet de evento).
- **Owner approval?** SIM. **Fechamento:** C2 congelada com âncoras citadas.

## R4 · C7 — TABELA · SPEC CONSOLIDADA ✔ APROVADO PELO OWNER (GO)
> **C7 = FOUNDATION OFICIAL / GOLDEN** (commit `2516426`); âncoras F10+F11; sem gap visual.
> **Status:** `C7-TABLE-CONTRACT.md` criado (documental, ZERO imagem): inventário integral =
> **3 tabelas reais** (Ranking F10 7×7; Atrasos F11 5×7 — dívida re-provada; Histórico F11 4×4
> com timeline hospedada); 1 família/2 composições; tokens real→Light; interações inexistentes
> registradas (sorting/paginação/seleção/row-action/hover/zebra/sticky); empty inline por
> colspan (literais); regra LIST ≠ TABLE; **sem gap visual** (F10+F11 cobrem tudo).
> **C7 NÃO declarada concluída**; R5 não iniciado.
- **Objetivo:** consolidar a dense data table provada em F10/F11 (header 10.5/700 uppercase,
  linhas 13.5, alinhamento numérico, pct cell, sev pill, avatar cell; SEM paginação — não existe
  no real; truncamentos por slice/scroll documentados como contrato).
- **Artefato:** seção C7 formal (dentro do C1-CONTRACT ou arquivo próprio — decisão editorial).
- **Dependência:** R1. **Imagem?** NÃO. **Owner approval?** SIM. **Fechamento:** C7 congelada.

## R5 · C3/C4/C5/C6 — SPECS DOCUMENTAIS ▶ ENTREGUE (aguarda avaliação do owner)
> **Status:** 4 contracts criados (documental, ZERO imagem): `C3-MENUS-POPOVERS` (2 famílias:
> evd-menu ancorado + card menus portal; SELECT C1 ≠ MENU; Electron nativo fora) ·
> `C4-EMPTY-STATES` (1 linguagem/3 escalas; SEM CTA; initial ≠ no-results) · `C5-LOADING-SPLASH`
> (4 famílias; skeleton/progress INEXISTENTES) · `C6-TOASTS-ERRORS` (7 canais; C6 USA C1;
> nativos = dívida). **Gaps visuais registrados:** C3 (menus abertos) + C6 (toast premium) →
> UMA "Transversal Anatomy Board" futura OPCIONAL (owner decide). C4/C5 sem gap.
> **C3–C6 NÃO declaradas concluídas**; R6 não iniciado.
- **Objetivo:** contratos de Menus/Dropdowns (C3 — selects provados F9/F10/F11; card menus e
  popovers mapeados; menu NATIVO Electron registrado fora do CSS), Empty States (C4 —
  `emptyState()` real; 1 amostra visual pode ser incluída no frame R2 para prova), Loading/
  Splash (C5 — splash de restauração F12; decidir skeleton: hoje NÃO existe no real — não
  inventar sem decisão), Toasts & Erros inline (C6 — toast premium interno, flashToast, banner
  err/ok do login, banner update/team session).
- **Artefato:** specs C3–C6 (arquivo único "TRANSVERSAL-CONTRACTS" ou seções — decisão editorial).
- **Dependência:** R2 (amostras). **Imagem?** NÃO por padrão (amostras entram no frame R2).
- **Owner approval?** SIM. **Fechamento:** C3–C6 congeladas.

## R6 · C8 — ESTADOS DE INTERAÇÃO & STAT-TILE
- **Objetivo:** consolidar hover/selected/focus/scrollbar (maioria já congelada via C1 §2) +
  **stat-tile** (única peça sem prova — vive no "Hoje", classe B). Prova via spec aplicada do
  Hoje (R7) ou amostra no frame R2 — escolher no GO.
- **Artefato:** seção C8 formal. **Dependência:** R2/R7. **Imagem?** NÃO (herda amostra).
- **Owner approval?** SIM. **Fechamento:** C8 congelada.

## R7 · SUPERFÍCIES B — SPECS APLICADAS (sem frames próprios)
- **Objetivo:** para cada B, spec curta "como compor com Golden" (decisões já provadas no mapa):
  **Prioridades** (lista de cards DS; dep C4) · **Hoje** (stat-tiles C8 + listas) · **Hub/quadros
  por pessoa** (faixas Golden F1–F5) · **Equipe** (grid de cards — B confirmada por código) ·
  **Perfil** (pcard + rows; dep C1) · **Configurações** (settrow/toggle/select; dep C1 COMPLETA —
  amostra visual de uma seção incluída no frame R2 conforme decisão 3 do mapa).
- **Artefato:** seção "B-SPECS" no MASTER-SURFACE-MAP (ou arquivo próprio).
- **Dependência:** R2 (C1 completa) p/ Config; demais R1. **Imagem?** NÃO (amostra Config no R2).
- **Owner approval?** SIM. **Fechamento:** 6 B sem pendência na matriz.

## R8 · RESPONSIVIDADE MÍNIMA — REVALIDAÇÃO 1366×768 + 125%
- **Objetivo:** revalidar os marcados na matriz §H: boards F1–F5 (altura de coluna/drawer),
  Detalhes F6, Agenda F8, Executivo/Relatórios F10–F11 (+ wizard/login por amostragem; login já
  tem media query real documentada). Validação VISUAL (render em 1366×768 e 1920@125%), sem
  redesenho — ajustes só com aprovação.
- **Artefato:** imagens de validação + matriz §H atualizada (célula a célula).
- **Dependência:** R2–R7 (congelar antes de revalidar). **Imagem?** SIM (validação, não design
  novo). **Owner approval?** SIM. **Fechamento:** §H sem "SIM — revalidar" pendente.

## R9 · ACESSIBILIDADE — SPEC MÍNIMA CONSOLIDADA
- **Objetivo:** consolidar C1 §6 + registros por frame num requisito único de implementação
  (contraste, foco, cor-não-única, targets, labels, keyboard, disabled≠OFF, unread≠read,
  upload acessível, erro não-só-cor). Declarar explicitamente o que NÃO é contrato do código
  atual (ex.: focus trap, Enter no login) e vira decisão de implementação.
- **Artefato:** seção "A11Y-SPEC" única. **Dependência:** R2–R7. **Imagem?** NÃO.
- **Owner approval?** SIM. **Fechamento:** spec aceita.

## R10 · MASTER MAP CLEANUP FINAL
- **Objetivo:** matriz 30/30 sem célula pendente; dívidas funcionais listadas FORA do escopo de
  design (fase funcional futura); trilhas gated explícitas (F14a–c janelas premium; Client Portal
  = trilha separada; decisão do owner se ficam fora do "completo").
- **Artefato:** MASTER-SURFACE-MAP final. **Dependência:** R2–R9. **Imagem?** NÃO.
- **Owner approval?** SIM. **Fechamento:** mapa sem pendências.

## R11 · CHECKPOINT FINAL — DECLARAÇÃO "DESIGN COMPLETO"
- **Objetivo:** relatório final de fechamento (critérios abaixo) e decisão explícita do owner.
- **Critérios (todos):** 1) F1–13 Golden ✔ · 2) B cobertas (R7) · 3) transversais cobertos
  (R3–R6) · 4) foundations congeladas · 5) C1 completa no escopo ratificado (R2) · 6)
  responsividade mínima validada (R8) · 7) a11y mínima especificada (R9) · 8) mapa sem pendências
  (R10) · 9) dívidas separadas do redesign ✔ (checkpoint global) · 10) owner declara
  **DESIGN COMPLETO**.
- **Imagem?** NÃO. **Owner approval?** SIM (a própria declaração).
- **Fechamento:** só então a IMPLEMENTAÇÃO pode ser autorizada (gate separado do owner).

---

**Próximo passo recomendado: R2 (C1 Completion — frame de estados).** Justificativa derivada do
mapa: C1 é a única foundation P0 com pendências que bloqueiam outras etapas (Config/R7, C2/R3 via
del-sheet, C8/R6 via amostras); as demais foundations são majoritariamente documentais a partir de
âncoras Golden já existentes. Não iniciar sem GO do owner.
