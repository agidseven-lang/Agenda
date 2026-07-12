; ============================================================================
; Agenda ID Seven Desktop — Hooks customizados do instalador NSIS (1.0.68)
; ----------------------------------------------------------------------------
; CAUSA QUE ISTO RESOLVE (bug 1.0.66 -> 1.0.67):
;   O app vive na BANDEJA (fechar = esconder). Ao instalar uma versao nova com
;   o app antigo ainda rodando na tray, o processo trava o "resources\app.asar".
;   O instalador assistido nao encerra apps tray-only de janela oculta de forma
;   confiavel, entao PULA a gravacao do asar travado e mantem a versao ANTIGA.
;   Resultado: titulo/badge/layout continuavam 1.0.66 mesmo "instalando" o novo.
;
; SOLUCAO:
;   Encerrar a forca QUALQUER instancia em execucao ANTES de copiar os arquivos,
;   tanto na instalacao quanto na desinstalacao. Assim o asar fica livre e a nova
;   versao e SEMPRE gravada por cima.
; ============================================================================

!macro killRunningApp
  ; /F = forca, /T = encerra arvore (filhos), /IM = por nome de imagem.
  ; O nome do executavel instalado e o productName + ".exe".
  nsExec::Exec 'taskkill /F /T /IM "Agenda ID Seven Desktop.exe"'
  Pop $0
  Sleep 1200
!macroend

; Roda no .onInit do INSTALADOR (antes de qualquer secao de copia de arquivos).
; ----------------------------------------------------------------------------
; F3.3.71C5 — "primeiro duplo clique nao abre; o segundo instala" (2 camadas):
;  (1) FORA do nosso codigo (nao corrigivel por NSIS): com Mark-of-the-Web,
;      SmartScreen/Defender VERIFICAM o EXE inteiro ANTES de criar o processo —
;      nessa janela nenhum codigo nosso roda e nenhum feedback e possivel. O
;      template do electron-builder ainda tem mutex de instancia unica: um novo
;      clique durante a verificacao vira a instancia "vencedora" e a primeira,
;      atrasada, se encerra sozinha (Abort silencioso) — dai "o segundo instala".
;      MITIGACAO OPERACIONAL: apos conferir o SHA-256, aguardar ~10-30s no 1o
;      clique OU desbloquear o arquivo (Propriedades -> Desbloquear) antes de rodar.
;  (2) NOSSA janela (corrigida AQUI): customInit roda taskkill + Sleep 1200 antes
;      da GUI -> 1,2s+ de silencio proprio. Banner nativo da feedback imediato.
;      IfSilent preserva instalacao silenciosa /S sem UI.
!macro customInit
  IfSilent instPrepSemBanner
    Banner::show "Preparando o instalador..."
  instPrepSemBanner:
  !insertmacro killRunningApp
  IfSilent instPrepFim
    Banner::destroy
  instPrepFim:
!macroend

; Roda no .onInit do DESINSTALADOR (libera arquivos antes de remover).
!macro customUnInit
  !insertmacro killRunningApp
!macroend

; ============================================================================
; F3.3.71C3 — NITIDEZ DO INSTALADOR EM TELAS HiDPI (100/125/150%).
; ----------------------------------------------------------------------------
; CAUSA DO "instalador embacado": o executavel do NSIS assistido nao declarava
; DPI-awareness (o template do electron-builder deixa ManifestDPIAware no
; default = notset). Em telas com escala > 100% o Windows aplica bitmap-stretch
; na janela inteira do instalador -> texto e icone borrados. Os assets ja sao
; alta resolucao (icon.ico 16..256, icon.png 1024) — o problema NUNCA foi o
; asset, e sim a ausencia da flag de DPI.
;
; SOLUCAO: declarar o instalador DPI-aware via customHeader (escopo global do
; script, antes de .onInit). O Windows para de esticar bitmap e passa a renderizar
; o texto/icone de forma nitida. NAO altera nada do app empacotado (asar/exe/
; funcionalidade) — afeta somente o manifest do proprio instalador.
; ============================================================================
!macro customHeader
  ManifestDPIAware true
!macroend
