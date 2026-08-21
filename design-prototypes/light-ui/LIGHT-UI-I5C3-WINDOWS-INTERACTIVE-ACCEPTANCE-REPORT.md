# LIGHT UI — I5C.3 · OWNER WINDOWS INTERACTIVE ACCEPTANCE

**PRODUCT SOURCE FROZEN:** `dcc019ca` · 1.0.246 · **ZERO mudanças** (source e workflows intocados nesta fase; nenhum RC novo gerado; nenhuma tag/release/deploy/bump). Estado herdado: I5C.2 = GO · RC-A02 = RESOLVED · RC-A03 = RESOLVED · RC-A01 = OPEN somente pelos 2 gates interativos.

## SITUAÇÃO DESTA EXECUÇÃO — declaração sem simulação
Os Gates 1–7 desta fase são, por definição, **interativos**: instalador NSIS com interface VISÍVEL, `Settings → System → Display → Scale = 125%` NATIVO do Windows, julgamento VISUAL das superfícies e screenshots do desktop. **Esta sessão é um container Linux sem nenhuma máquina Windows interativa** — e a política da cadeia inteira proíbe maquiar/fingir gates. Portanto: **nenhum dos gates interativos foi executado; nenhuma screenshot `I5C3-*` foi fabricada; RC-A01 permanece OPEN.** Nenhum RC-A04 (não surgiu problema de produto — nada foi testado além do executável abaixo).

O que ERA executável desta sessão foi feito:
- **Artefato/identidade (pré-requisito):** o artefato canônico está no run verde `32431962343` (artifact `agenda-id-seven-desktop-1.0.246-RC-bundle`, id 9429498317, 174 302 047 B, expira 2026-08-28). O **RC-MANIFEST oficial foi gerado dentro do próprio run** sobre os artefatos que ele empacotou (fonte de verdade da identidade). Tentativa de download do bundle NESTA sessão: **bloqueada pelo proxy (CONNECT 403 ao blob do Azure)** — registrado; a conferência do SHA-256 local é o Passo 0 do roteiro do operador, com os hashes esperados abaixo.
- **Roteiro operacional binário completo** (abaixo) — para o owner executar os 8 subgates em ~15 min, com critérios PASS/FAIL e nomes exatos das evidências.

## IDENTIDADE ESPERADA DO ARTEFATO (manifest oficial do run 32431962343)
- `Agenda-ID-Seven-Desktop-1.0.246-x64.exe` · **82 549 920 bytes** · SHA-256 `ca94a337a9baf52647efd2173cc7508642108486df2bad337cbc60df32e5580d` · NSIS x64 · unsigned (por design; SmartScreen avisará — esperado)
- (referência) MSI `91517b1ca27f585c1a83360ecb04c866e1653e796ead6d739d085ecdadb12e1b` · 92 561 408 B

## ROTEIRO DO OPERADOR (Windows x64 real e interativo · ~15 min)
**Passo 0 · Identidade (STOP se divergir):** baixar o artifact `…-RC-bundle` do run `32431962343` (Actions → run → Artifacts), extrair, e no PowerShell: `Get-FileHash .\Agenda-ID-Seven-Desktop-1.0.246-x64.exe -Algorithm SHA256` → deve ser `ca94a337…` (e o tamanho 82 549 920). **Se divergir: STOP — não testar outro instalador.** Registrar: Windows edition/build/arquitetura/resolução física/scaling inicial/idioma (`winver` + Configurações de Vídeo).
**Gate 1 · NSIS GUI:** duplo-clique no exe (NÃO silencioso; SmartScreen → "Mais informações → Executar assim mesmo" — esperado, unsigned). Validar: assistente abre; textos corretos; sem tela branca/erro; controles usáveis; caminho coerente (`%LOCALAPPDATA%\Programs\…`); conclui; app instalado existe; abre; `Uninstall Agenda ID Seven Desktop.exe` presente. **Capturar `I5C3-NSIS-WIZARD.png` e `I5C3-NSIS-INSTALLED.png`** (sem dados pessoais).
**Gate 2 · First boot visual (perfil limpo):** abrir o app → splash → login; título/rodapé `1.0.246`; **Light UI OFF** (visual escuro legacy). **Capturar `I5C3-LEGACY-OFF.png`.** Se iniciar ON em perfil limpo: **RC-A01 = FAIL, STOP.**
**Gate 3 · Controlled ON:** logar (conta de teste do owner) → DevTools apenas para EXECUTAR o mecanismo real (não para adicionar classe): `appearSet({luiPreview:true})` no console — é o opt-in interno oficial. Confirmar `body.desktop.light-ui`, shell completo sem híbrido; recarregar (Ctrl+R) → permanece ON.
**Gate 4 · 125% NATIVO:** `Configurações → Sistema → Vídeo → Escala = 125%`. Registrar resolução física; no console (opcional): `devicePixelRatio` (esperado 1.25) e `innerWidth` (~1093 com janela maximizada em 1366×768; em telas maiores o valor difere — o critério é o comportamento, não o número).
**Gate 5 · Sanity visual em 125% (Light ON):** percorrer **F1 Tarefas · F6 Details · F8 Agenda · F9 Notificações · F10 Executivo · F11 Relatórios · F12 Login (deslogar/olhar/logar) · F13 Legendas e artes**. Critérios: zero scroll horizontal de página; sidebar/header íntegros; filtros acessíveis; cards não cortados; tabelas utilizáveis; drawer/modal ok; CTAs visíveis; sem clipping impeditivo; F13 alcançável; sem híbrido. **Capturar `I5C3-WIN125-F1/F9/F10/F11/F13.png`** (+ a falha, se houver).
**Gate 6 · Kill switch:** `appearSet({luiPreview:false})` → legacy volta na hora; reload → continua OFF. **Capturar `I5C3-KILL-OFF.png`.**
**Gate 7 · Reopen:** fechar completamente (bandeja → Sair) → reabrir → inicia normal, 1.0.246, OFF persistente, sem crash/loop.
**Se QUALQUER problema surgir:** não corrigir nada — anotar como **RC-A04 — <descrição>** com screenshot e parar.

## MATRIZ (a preencher pelo operador)
| SUBGATE | RESULT | EVIDÊNCIA |
|---|---|---|
| Identidade do exe (SHA/tamanho) | PENDING | hash local |
| NSIS GUI | PENDING | I5C3-NSIS-WIZARD/INSTALLED |
| Installed boot + versão | PENDING | — |
| Default OFF | PENDING | I5C3-LEGACY-OFF |
| Controlled ON + reload | PENDING | — |
| Windows 125% nativo (DPR/viewport) | PENDING | registro |
| Superfícies críticas em 125% | PENDING | I5C3-WIN125-* |
| Kill switch + reload OFF | PENDING | I5C3-KILL-OFF |
| Reopen | PENDING | — |

## SECURITY
Nada novo exposto nesta fase (nenhum log/screenshot gerado aqui). Lembrete ao operador: screenshots sem dados pessoais; nunca fotografar credenciais.

## POSTO DE CONTROLE
**SOURCE = `dcc019ca` intocado · WORKFLOWS intocados · RC novo = NÃO · TAG = NÃO · GITHUB RELEASE = NÃO · PUBLICAÇÃO = NÃO · DEPLOY = NÃO · BUMP = NÃO · RELEASE WORKFLOW = INERTE/NÃO EXECUTADO.**

## VEREDITO
**I5C.3 = NO-GO** (gates interativos não executáveis por esta sessão — pendência exclusivamente OPERACIONAL; zero falha de produto; zero RC-A04). **RC-A01 = OPEN** (aguarda a execução do roteiro pelo owner) · RC-A02 = RESOLVED · RC-A03 = RESOLVED.

**"O RC 1.0.246 está tecnicamente aprovado para RELEASE FINAL?" — NÃO** (ainda não: falta somente a aceitação interativa do roteiro acima; todo o mensurável está verde e o release permanece estruturalmente bloqueado até o GO explícito do owner).
