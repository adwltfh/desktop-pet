const { BrowserWindow, screen } = require('electron')
const path = require('node:path')

const { PET_WIDTH, PET_HEIGHT, TOP_LEVEL, TOP_REASSERT_MS } = require('./constants')

let lastTopReassert = 0

let petWindow = null
let chatWindow = null
let testerWindow = null

function clampToDisplay(x, y) {
  const display = screen.getDisplayNearestPoint({
    x: Math.round(x + PET_WIDTH / 2),
    y: Math.round(y + PET_HEIGHT / 2),
  })

  const area = display.workArea

  return {
    x: Math.min(
      Math.max(Math.round(x), area.x),
      area.x + area.width - PET_WIDTH,
    ),

    y: Math.min(
      Math.max(Math.round(y), area.y),
      area.y + area.height - PET_HEIGHT,
    ),
  }
}

function keepOnTop(force = false) {
  if (!petWindow || petWindow.isDestroyed()) {
    return
  }

  const now = Date.now()

  if (!force && now - lastTopReassert < TOP_REASSERT_MS) {
    return
  }

  lastTopReassert = now

  // Set ulang, bukan cuma cek isAlwaysOnTop(): Electron tetap melaporkan
  // true walau flag di level OS sudah hilang.
  petWindow.setAlwaysOnTop(true, TOP_LEVEL)
  petWindow.moveTop()
}

function sendToPet(channel, payload) {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send(channel, payload)
  }
}

function createPetWindow() {
  const area = screen.getPrimaryDisplay().workArea

  petWindow = new BrowserWindow({
    width: PET_WIDTH,
    height: PET_HEIGHT,
    x: area.x + area.width - PET_WIDTH - 40,
    y: area.y + area.height - PET_HEIGHT,

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
      preload: path.join(__dirname, '../preload/pet.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  petWindow.loadFile(path.join(__dirname, '../renderer/pet/index.html'))

  // Window tetap muncul saat berpindah desktop/Space (macOS)
  petWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
  })

  // Tetap terlihat saat pengguna menekan Win + D
  keepOnTop(true)

  // Jendela lain yang baru muncul / fokus pindah bisa menaikkan dirinya
  // di atas pet, jadi posisinya diklaim ulang.
  petWindow.on('blur', () => keepOnTop(true))
  petWindow.on('show', () => keepOnTop(true))
  petWindow.on('always-on-top-changed', (_event, isOnTop) => {
    if (!isOnTop) {
      keepOnTop(true)
    }
  })

  // Awalnya klik tembus ke desktop; renderer menyalakan lagi saat
  // kursor berada di atas sprite atau bubble.
  petWindow.setIgnoreMouseEvents(true, { forward: true })

  // PET_DEBUG=1 npm start -> error renderer ikut tampil di terminal
  if (process.env.PET_DEBUG) {
    petWindow.webContents.on('console-message', event => {
      console.log(
        `[pet:${event.level}] ${event.message}`,
        `(${event.sourceId}:${event.lineNumber})`,
      )
    })
  }

  // Pet nyala berjam-jam; kalau renderer-nya mati jendela jadi kosong
  // melompong, jadi langsung dimuat ulang.
  petWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer pet mati:', details.reason, details.exitCode)

    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.reload()
    }
  })

  petWindow.webContents.on('unresponsive', () => {
    console.error('Renderer pet tidak merespons')
  })

  petWindow.on('closed', () => {
    petWindow = null
  })
}

function createChatWindow() {
  if (chatWindow) {
    chatWindow.show()
    chatWindow.focus()

    return chatWindow
  }

  chatWindow = new BrowserWindow({
    width: 420,
    height: 580,
    minWidth: 340,
    minHeight: 420,
    title: 'Ngobrol sama pet',
    show: false,
    backgroundColor: '#1b1620',

    webPreferences: {
      preload: path.join(__dirname, '../preload/chat.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  chatWindow.setMenuBarVisibility(false)
  chatWindow.loadFile(path.join(__dirname, '../renderer/chat/chat.html'))

  chatWindow.once('ready-to-show', () => {
    chatWindow.show()
  })

  chatWindow.on('closed', () => {
    chatWindow = null
  })

  return chatWindow
}

function createTesterWindow() {
  if (testerWindow) {
    testerWindow.show()
    testerWindow.focus()

    return testerWindow
  }

  testerWindow = new BrowserWindow({
    width: 480,
    height: 640,
    minWidth: 360,
    minHeight: 420,
    title: 'Uji animasi',
    show: false,
    backgroundColor: '#1b1620',

    webPreferences: {
      preload: path.join(__dirname, '../preload/tester.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  testerWindow.setMenuBarVisibility(false)
  testerWindow.loadFile(path.join(__dirname, '../renderer/tester/test.html'))

  testerWindow.once('ready-to-show', () => {
    testerWindow.show()
  })

  // Pet dibiarkan beraktivitas lagi begitu jendela penguji ditutup
  testerWindow.on('closed', () => {
    testerWindow = null

    sendToPet('pet:command', { action: 'resume' })
  })

  return testerWindow
}

function getPetWindow() {
  return petWindow
}

module.exports = {
  clampToDisplay,
  keepOnTop,
  sendToPet,
  createPetWindow,
  createChatWindow,
  createTesterWindow,
  getPetWindow,
}
