!macro customInstallMode
  ; Force per-user installs and skip the install-mode choice page.
  ; A per-machine install needs UAC elevation that electron-updater's
  ; silent quitAndInstall can't satisfy, breaking auto-update.
  StrCpy $isForceCurrentInstall "1"
!macroend
