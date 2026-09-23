const { app, BrowserWindow, screen } = require('electron')
const path = require('node:path')

let petWindow

function createPetWindow() {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.workAreaSize

  petWindow = new BrowserWindow({
    width: 180,
    height: 180,
    x: width - 200,
    y: height - 200,

    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    hasShadow: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',

    webPreferences: {
      preload: path.join(__dirname, 'renderer.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  petWindow.loadFile('index.html')

  // Tetap terlihat saat pengguna menekan Win + D
  petWindow.setAlwaysOnTop(true, 'floating')
}

app.whenReady().then(createPetWindow)

app.on('window-all-closed', () => {
  app.quit()
})