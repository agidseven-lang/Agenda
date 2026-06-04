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
!macro customInit
  !insertmacro killRunningApp
!macroend

; Roda no .onInit do DESINSTALADOR (libera arquivos antes de remover).
!macro customUnInit
  !insertmacro killRunningApp
!macroend
