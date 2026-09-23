const { app, BrowserWindow, screen } = require('electron')
const path = require('node:path')

let petWindow

function createPetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  petWindow = new BrowserWindow({
    width: 200,
    height: 200,

    // Posisi awal di kanan bawah layar
    x: width - 220,
    y: height - 220,

    frame: false,
    transparent: true,
    backgroundColor: '#00000000',

    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,

    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  petWindow.loadFile('index.html')

  // Window tetap muncul saat berpindah desktop/Space
  petWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
  })

  petWindow.setAlwaysOnTop(true, 'floating')
}

app.whenReady().then(() => {
  // Menyembunyikan icon aplikasi dari Dock Mac
  if (process.platform === 'darwin') {
    app.dock.hide()
  }

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