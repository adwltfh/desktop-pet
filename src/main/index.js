const { app, BrowserWindow } = require('electron')

const { createPetWindow } = require('./windows')
const { registerIpc } = require('./ipc')

app.whenReady().then(() => {
  // Menyembunyikan icon aplikasi dari Dock Mac
  if (process.platform === 'darwin') {
    app.dock.hide()
  }

  registerIpc()
  createPetWindow()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createPetWindow()
  }
})

app.on('window-all-closed', () => {
  app.quit()
})
