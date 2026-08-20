# LIGHT UI — I4 · GLOBAL INTEGRATION & RELEASE READINESS — AUDITORIA

**Código auditado:** `899862a2` (F1–F13; md5 do renderer confirmado idêntico ao commit ANTES e DEPOIS da bateria — **ZERO mudança de código nesta fase**) · **Versão:** 1.0.246 · **Natureza:** auditoria + harness + docs. Sem build, sem installer, sem deploy, sem tag, sem bump. **Light UI permanece INATIVA por padrão (gate de segurança verificado).**

**Veredito: APROVADA COM RESSALVAS · GO CONDICIONADO para RC.** Resposta objetiva à pergunta da fase: **ainda não** — pronta para ativação CONTROLADA e para iniciar a fase de RC, com 2 pré-condições de RC (mecanismo de ativação inexistente por design + guard rail `.desktop`) e dívidas registradas abaixo. Nenhum bloqueador de código novo.

---

## 1 · Integração entre frames (checklist 1) · PASS
Auditoria estática GLOBAL do `style#light-ui-foundation` consolidado: **1466 linhas · 15 seções (I1→I3M) · 905 seletores individuais · 905/905 gated pela classe `light-ui`** (863 `body.light-ui.desktop` + 42 `body.light-ui`/`body.light-ui.hc` do shell I1/I2 congelado) · **0 seletor sem gate · balanço de chaves 0 · 16 media queries (conteúdo gated) · 43 tokens `--lui-*`**. `!important`: 157 ocorrências brutas concentradas nas seções congeladas de shell/F1v4 (I1/I2=49, I3A.3=61), 1–9 nas demais — todos historicamente aprovados por fase. Componentes repetidos consistentes: sonda dinâmica provou `exec-kpi` byte-igual entre F10 e F11 (`rgb(255,255,255)`); padrão único de skin (classes exclusivas por superfície OU vars redefinidas no escopo — ev-sheet/login/pr-sheet).

## 2 · Navegação cruzada (checklist 2) · PASS
`i4_driver` (sessão light ÚNICA, fixture combinada real, clock N): **2 voltas completas pelas 8 tabs reais** (hoje/agenda/tarefas/equipe/perfil/exec/relatorios/notificacoes) — `state.tab` correto e conteúdo presente em todas; **modais cruzados**: Central de Detalhes aberta/fechada sobre Tarefas (contexto preservado), Legendas e artes aberto/fechado sobre Hoje, **deep-link REAL F9→F6** (CTA "Abrir tarefa" da Central abre a Central de Detalhes na sessão integrada); bloqueio H16 integrado (produção de task concluída NÃO abre); **teclado**: gates por superfície re-executados neste commit (F12 Enter, F11 toggle/exports, F13 upload picker 1/1/1, F9-D01 sem regressão). Rotas quebradas: nenhuma encontrada.

## 3 · Estados funcionais (checklist 3) · PASS
**265/265 gates dos smokes das 8 fases re-executados NO MESMO commit** (f6 42 · f7 35 · f8 32 · f9 28 · f10 32 · f11 48 · f12 27 · f13 21 + chooser) — cobrem vazio/carregando/dados/erro/sem-permissão/edição/salvo/filtros/busca-sem-resultado/listas-overflow/modais curtos-longos por superfície, com provas matemáticas (KPIs), boundaries (crítico ±1ms por setor) e literais de copy.

## 4 · Persistência e dados (checklist 4) · PASS (semântica literal documentada)
Write maps por superfície re-validados no commit: leitura pura nas telas analíticas (F9 storage-only com dedup/TTL/cap; F10/F11 zero writes; export = download local); mutações com counts exatos (F7 batch; F13 save=1 update com pendências recalculadas, resend=update+set do token; double-submit=1 por bloqueio real). **Zero writes/storage novos na navegação integrada inteira** (i10/i11). Reidratação: boot do zero a cada sessão (equivalente a refresh) re-lê Firestore/localStorage; **filtros são vars de sessão em memória (reset no reload — semântica literal do produto, documentada nas fases)**. Dados vazios/corrompidos: F9 read-side robusto (JSON corrompido→[]); campos opcionais provados por fase.

## 5 · Permissões e segurança de fluxo (checklist 5) · PASS (com registro)
`visibleTasks/canSeeAll` regem os DADOS (provado admin 13× designer 7 na F11); ações destrutivas com confirmação real (F9 clear com `window.confirm`); H16 bloqueia produção pós-conclusão (0 write); H13 impede histórico falso de envio; login server-side sem credencial no renderer. **Registro (pré-existente, literal):** a disponibilidade do CTA "Legendas e artes" é por FASE do fluxo, sem gate de papel no handler — qualquer usuário com o CTA visível aciona o fluxo (comportamento aprovado do produto; não alterado).

## 6 · Responsividade (checklist 6) · PASS
1920/1366/win125 provados por superfície nesta cadeia (scrollW==vw em TODAS; medias reais regem ≤1100/≤660; scroll interno real em listas/tabelas; zero fake scale). Reutilizado como evidência válida por hash (código idêntico).

## 7 · Acessibilidade básica (checklist 7) · PASS (com dívidas registradas)
Focus-visible #4353D8 consistente nas 13 superfícies; tab order provado por fase; labels associados (F12 `for`/autocomplete); dialogs com role/aria-modal (F6/F8/F13); banner de login `role="alert"`; upload por teclado corrigido (F13); Enter no login corrigido (F12); **nested interactive = 0 em sweep GLOBAL nas 8 tabs (2 voltas)**; reduced-motion respeitado onde há animação real. Dívidas registradas (não corrigidas — fora do escopo cirúrgico): selects sem `aria-label` dedicado (nomeados pelo value — padrão aprovado F10/F11); `th` sem `scope` (padrão real); RTE toolbar com roving tabindex parcial (real).

## 8 · Hardening técnico (checklist 8) · PASS (com observações)
Sem pageerror/console-error PRÓPRIOS na sessão integrada (os 2 únicos console-errors = **Firebase SDK via CDN gstatic bloqueado pelo harness** — dependência de REDE NO BOOT pré-existente do produto, ver achado M1); loading infinito: inexistente nos fluxos auditados (toasts/finally liberam busy — F12 finally, F13 toast fallback); múltiplos cliques bloqueados onde há bloqueio real (F12 disabled; F13 closeModal síncrono — dívida "sem disabled" registrada no Golden); listeners: padrão innerHTML-rebuild + delegação global (sem acúmulo em elementos vivos) e `unsub` map limpo no logout (linha 4514 — literal); fonte de verdade única provada (SLA `resolveTaskDisplayState`; F9 badge==storage na sessão integrada, i07).

## 9 · Regressão sobre o legacy (checklist 9) · PASS (prova nova e definitiva)
**Prova de inércia inédita da I4: o `style#light-ui-foundation` INTEIRO foi REMOVIDO do DOM e comparado com presente, SEM `body.light-ui` — 9/9 cenários = 0px** (hoje/tarefas/agenda/exec/relatorios/notificacoes/login em dark + hoje em HC + hoje em legacy-light). Conclusão: **o CSS consolidado da Light UI é 100% inerte no legado** — nada vaza, nenhum reset impacta, nenhuma dependência de a folha existir. Somado às regressões encadeadas por fase (0px além do flake do sino A–E), o legado está intacto.

## 10 · Prontidão para ativação futura (checklist 10) · PASS com pré-condições de RC
- **Gate de segurança VERIFICADO: nenhum caminho de código adiciona `light-ui` ao body** (grep: 0 `classList.add('light-ui')`; apenas 3 LEITURAS condicionais — hooks gated das fases). Ativação por padrão: IMPOSSÍVEL no estado atual.
- **Isolamento:** classe única + 905/905 seletores gated + inércia 0px provada.
- **Ordem de carregamento:** foundation é `<style>` ESTÁTICO no head; os CSS dark injetados (NC/EXEC/REP) entram por `appendChild` sempre DEPOIS — as fases venceram por ESPECIFICIDADE (não por ordem), então a ordem não é frágil (provado por pixel em cada fase).
- **Risco de ativação parcial (registro):** com `light-ui` sem `.desktop`, só as 42 regras de shell aplicariam — mitigado porque o Desktop sempre tem `.desktop`; guard rail recomendado para RC: o futuro mecanismo deve aplicar a classe apenas quando `body.desktop` (ou testar o par).
- **Pré-condição de RC (por design):** o mecanismo de ativação (setting/toggle persistido) **ainda não existe** — as fases nunca o criaram (mandatos proibiam ativar). A RC precisa criá-lo com mandato próprio.

---

## ACHADOS (nenhum crítico · nenhum alto)

**M1 · MÉDIO · Firebase SDK via CDN no boot** — `<script src="https://www.gstatic.com/firebasejs/...>` (linhas 4187–4188): dependência de rede no boot do renderer (pré-existente, alheia à Light UI). Impacto: sem rede/CDN, o app degrada no boot (o auth splash/retry do produto trata a negativa). Recomendação RC: avaliar vendorizar o SDK no pacote. **Registrado (não corrigido — fora do escopo cirúrgico da I4).**
**M2 · MÉDIO · Mecanismo de ativação inexistente (por design)** — pré-condição para RC (ver checklist 10). **Registrado.**
**B1 · BAIXO · Guard rail `.desktop` na futura ativação** — ver checklist 10. **Registrado.**
**B2 · BAIXO · Dívidas funcionais herdadas e formalizadas nas fases** (não são novas): F13 sem validação de dimensão/tamanho de arte, upload sem progress, botões de salvar sem disabled (double-submit mitigado pelo fechamento síncrono — provado 1 write); F11 "Tarefas críticas" inclui overdue não-crítico (herdado F10); subtítulo "atraso > 10 min" impreciso para setores com grace ≠10 (lógica real explica); recovery de senha stub nesta build (F12, registrado no Golden); Escape não fecha o modal F13 (literal). Todas com registro nos relatórios de fase e no C7/C2. **Registradas.**
**B3 · BAIXO · Flake de rasterização do sino** — bbox conhecida, política A–E consolidada; não é defeito de código. **Registrado.**

## MUDANÇAS REALIZADAS
**NENHUMA.** A auditoria não encontrou bug claro novo que justificasse correção cirúrgica. `desktop/src` permanece byte-idêntico a `899862a2` (md5 `0a3c3d7f…` antes/depois). Nenhum arquivo de produto alterado; artefatos da I4 = harness (`i4_driver.js`, `inert.js`) e este relatório.

## GO / NO-GO
**GO CONDICIONADO para a fase de Release Candidate.** Condições (ambas são TRABALHO DA RC, não bloqueiam iniciá-la): (1) criar o mecanismo de ativação controlada com guard rail `.desktop` + persistência decidida pelo owner; (2) decisão do owner sobre M1 (CDN) e sobre as dívidas B2 (aceitar para 1.0.246 ou tratar). Próximo passo: **seguir para RC** com mandato próprio do owner (ativação controlada → QA manual assistido → empacotamento), mantendo a Light UI inativa até lá.

**Light UI permanece INATIVA. Nenhum build/instalador/deploy/tag/bump foi gerado. Nenhuma etapa de release foi iniciada.**
