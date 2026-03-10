; Cria atalhos com o ícone correto para a barra de tarefas
!macro customInstall
  ; Cria atalho na pasta do desktop com ícone correto
  CreateDirectory "$SMPROGRAMS\Daily"
  CreateShortcut "$SMPROGRAMS\Daily\Daily.lnk" "$INSTDIR\Daily.exe" "" "$INSTDIR\build\logo-daily.ico" 0
  
  ; Atalho no desktop
  CreateShortcut "$DESKTOP\Daily.lnk" "$INSTDIR\Daily.exe" "" "$INSTDIR\build\logo-daily.ico" 0
  
  ; Registra a aplicação com o ícone
  WriteRegStr HKCU "Software\Classes\Applications\Daily.exe" "" "$INSTDIR\Daily.exe"
  WriteRegStr HKCU "Software\Classes\Applications\Daily.exe\DefaultIcon" "" "$INSTDIR\build\logo-daily.ico"
!macroend

!macro customUnInstall
  RMDir /r "$SMPROGRAMS\Daily"
  Delete "$DESKTOP\Daily.lnk"
  DeleteRegKey HKCU "Software\Classes\Applications\Daily.exe"
!macroend



