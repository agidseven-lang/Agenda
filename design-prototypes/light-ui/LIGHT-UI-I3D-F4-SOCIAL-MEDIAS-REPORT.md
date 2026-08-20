# LIGHT UI — I3D · F4 SOCIAL MEDIAS REPORT

**Fase:** I3D — porte do Golden Social Medias (Frame 4) para o app real. **Status:**
ENTREGUE — aguarda owner. **1. Branch:** `impl/light-ui-f4-social-medias-1.0.246` ·
**2. Base:** `05910f33` (HEAD confirmado; worktree limpa) · **3. Commit:** checkpoint
único **`6d4796ff`** · **4. Arquivos:** `desktop/src/renderer/index.html` ·
**5. Diffstat:** +73/−3 · version 1.0.246 · zero build/package/tag/release/deploy/
updater/PR · Light UI inativa · **F5+ não iniciadas**.

## 6–8 · FUNÇÕES REAIS AUDITADAS · COLUNAS · SELEÇÃO/AUTOLOAD
Rota real: `state.flowView='socials'` → `renderSocialBoard` (board por Social;
`state.socialBoard`) / `renderSocialsHub` (hub sem seleção). **Strip real
`f354SocialStrip`** (`.f354-dchip` avatar+nome+contagem, `.on`, `[data-socialboard]`).
**Autoload real `f354SocialAutoPick` com ORDEM PRÓPRIA:** (1) última seleção válida →
(2) o PRÓPRIO usuário se Social válida → (3) 1ª ativa A→Z — **diferente da ordem dos
designers e preservada sem "correção"** (na fixture, com o CEO logado e sem seleção
salva, abre Rafaela = 1ª A-Z ✓ regra real). Persistência real por usuário
(`f354SocialSelSave`, localStorage EXISTENTE do produto — nenhum storage novo meu).
Lista: `socialBoardsList` = sociais ativas (`isSocialUser`) + contagens por
`socialOf` — não amplia permissão; aba só para `canSeeAll`. Coleção do quadro:
`socialOf(t)===id` (socialOwnerId → criador social → responsável social) — **quadros
isolados**. **SOCIAL_COLS4 reconfirmado:** A Fazer `#9BA0AB` · Em andamento `#F59E0B` ·
Revisão `#60A5FA` · Finalizado `#34D399` (mesma constante que o F1 usa — eixo
operacional; provado pelo código, não assumido).

## 9–11 · RESPONSÁVEL · SLA · SEMÂNTICA DE WORKFLOW F4
Anel/rail = `respOf` real (responsável primário; na prática o Social dono é o
assignee — contrato global inalterado). SLA = `kbv2SlaLocal`/`resolveTaskDisplayState`
por prazo final (Em prazo/Prazo próximo/Prazo encerrado/Entregue-Concluído; espera do
cliente NUNCA vira atraso interno — `externalWaitOf` neutro real). **Semântica F4
(crítica, preservada):** eixo OPERACIONAL Social→Designer→Cliente — comentário real do
renderer: "a Social vê o estágio REAL (aguardando designer/legenda/aprovação final),
não a aprovação do cliente. Aprovação parcial do cliente NÃO vira 'Concluído' aqui";
estágios `aguardando_designer*` reais; "Concluído final" só com aprovação final.
Próxima ação real (fonte única `pres.nextAction`; ex.: "Criar e enviar ao cliente",
"Cliente visualizou e não respondeu — considere…", "Corrigir e reenviar ao cliente").

## CARD (Golden F4 sobre foundation v4) e SINAIS REAIS
cliente + **pill de status operacional real** → título 14/800 → Prazo real + chip SLA
real na mesma linha → **sinal real**: "Visualizado às HH:MM · há X" / "Não visualizado ·
enviado há X" (rounds reais) / "Ajuste solicitado · há X" (`clientReview`) / **"Designer
entregou · dd/mm/aaaa"** (`designerSla.finishedAt` real; ramo emitido SÓ na perspectiva
operacional — F2/F3 intocados) → barra+% reais do fluxo (cols 2–3) → próxima ação →
avatares com anel + contagem real ("16 temas", "8 roteiros"). Span nasce
`display:none` (legado byte-inerte; revelado só sob `.scr-socials`/`.scr-client`).

## 12 · PAINEL
MESMA Central real por origem `socials` (hook mínimo): drawer overlay <1760 (paridade
I3A.1) e **docada ≥1760** (392px; top 240/right 26/bottom 53 = extensão exata das
colunas 240..1027). Lifecycle real provado: fechar por X ✓, por Esc ✓, retorno de foco
ao card ✓, foco inicial no X ✓.

## 13 · EXCEÇÕES (F4-E0x — nada inventado)
- **F4-E01** — "Fluxo N de 9" literal do Golden: representado pela barra+% REAIS do
  trilho operacional (representação compacta aprovada desde o F1).
- **F4-E02** — "Aprovação final [data]"/"Temas aprovados [data]" como linha do card
  Finalizado no Golden: sem fonte única confiável de data de conclusão no card; pill
  real "Concluído final" + prazo verde comunicam (painel tem o detalhe).
- **F4-E03** — card "selecionado" persistente e "+" no header da coluna: sem estado/
  função real (mesma decisão de F2/F3).

## 14–21 · GATES
**14. Smoke 18/18:** entrar em F4 · autoload real · Rafaela→Tatiana→Rafaela (counts
3↔9) · isolamento por `socialOf` · busca (1) · busca+seleção · empty real · abrir
detalhe · fechar X · fechar Esc · retorno de foco · menu ⋯ · Mover (no-write) ·
Monitor SLA real reage ("Tatiana Gomes · 32h30m em atraso") · F1→F2→F3→F4 ·
F4→F3→F2→F1 · seleções não vazam (filtro do F1 limpo).
**15–17. Regressões congeladas (relógio congelado, mesmas fixtures):** F1 board+painel
**0px** · F2 board+painel **0px** · F3 board+strip+painel **0px**.
**18. Legado sem classe (dark/light/hc):** F1 0px · F2 0px · F4 0px · F3 light/hc 0px;
F3-dark 0px **fora de uma zona-flake ambiental de 40×40px** no cluster do sino
(ícone assíncrono de alerta; **comprovado divergente até em base×base do MESMO
arquivo** — não é regressão; máscara documentada só nessa zona).
**19. Perfis:** 1920×1080 / 1366×768 / win125 (1093×614 DIP @1.25) PASS ·
**20. Overflow de página: ZERO** (board scroll interno ≤1240; strip scroll-x real).
**21. Backend writes: ZERO** (Firestore/Functions/Worker/API/localStorage novo = 0;
nenhuma ação destrutiva; Mover apenas aberto/fechado em harness).

## 22–23 · FIDELIDADE GOLDEN · SCREENSHOTS
| Zona | Golden | App | Status |
|---|---|---|---|
| Shell | superseded | F1 v4 — 0px vs congelado | **MATCH** (amendment) |
| Header | "Social Medias" (hub) | header REAL da seleção ("Social · Tatiana" + "Fluxo operacional · 9 tarefas · 1 em atraso" = o próprio contexto do Golden) | **ADAPTAÇÃO FUNCIONAL JUSTIFICADA** |
| Strip | "Quadros de Social Media:" + chips | strip REAL re-skin (42/r12/12.5; contagem em pill; ativo azul) | **MATCH** |
| Toolbar/busca | compartilhada | v4 (574×48; Social Medias ativa tint) | **MATCH** (amendment) |
| Columns | A Fazer/Em andamento/Revisão/Finalizado | labels/cores REAIS idênticos | **MATCH** |
| Cards | cliente/status/prazo+SLA/sinal/fluxo/próxima/avatares/contagem | idem com dados 100% reais; foundation v4 (r12/pad13/título14) | **MATCH** (foundation v4) |
| Sinais | Visualizado/Designer entregou/Ajuste | reais (rounds/designerSla/clientReview) | **MATCH** |
| Progresso | "Fluxo N de 9" + barra | barra+% reais compactos | **ADAPTAÇÃO** (F4-E01) |
| Panel | docado à direita + CTA | Central REAL docada/drawer | **ADAPTAÇÃO** (campos reais) |
| **ISSUES** | | | **ZERO** |
Medidas: sidebar 266 · busca 574×48 · strip 42/r12 · col 382 (288 docado) · gap 16 ·
card r12/13-13-11/título 14 · painel 392 · canvas #FDFEFE.
Screenshots (chat; não versionados): F4-SOCIAL-MEDIAS-{1920 (Tatiana), 1920-PANEL,
1920-OUTRO-USUARIO (Rafaela = autoload real), 1366, win125}.png + F4-COMPARE.

## 24 · RECOMENDAÇÃO
**GO** — todos os gates do mandato PASS; ZERO ISSUE; F1/F2/F3 congelados intactos.
**Próxima fase: I3E/F5 Setores — SOMENTE após GO explícito.** Rollback: reverter `6d4796ff`.
