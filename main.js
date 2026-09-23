const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  screen,
} = require('electron')

const path = require('node:path')

const ai = require('./ai')
const settings = require('./settings')

const PET_WIDTH = 320
const PET_HEIGHT = 300

// Windows kadang melepas flag topmost saat jendela frameless + transparent
// dipindah berkali-kali, jadi levelnya dipasang ulang secara berkala.
const TOP_LEVEL = 'screen-saver'
const TOP_REASSERT_MS = 300

let lastTopReassert = 0

let petWindow = null
let chatWindow = null
let testerWindow = null

// Dikirim renderer pet saat siap, dipakai jendela penguji animasi
let petAnimations = []

// Mode aktivitas: menentukan animasi apa yang menemani pengguna. Dinyalakan
// lewat menu klik-kanan pet dan hanya bertahan selama aplikasi jalan.
const petModes = {
  reading: false,
  music: false,
  coding: false,
  focus: false,
}

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

function createPetWindow() {
  const area = screen.getPrimaryDisplay().workArea

  petWindow = new BrowserWindow({
    width: PET_WIDTH,
    height: PET_HEIGHT,
    x: area.x + area.width - PET_WIDTH - 40,
    y: area.y + area.height - PET_HEIGHT,

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
      preload: path.join(__dirname, 'preload-pet.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  petWindow.loadFile('index.html')

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
      preload: path.join(__dirname, 'preload-chat.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  chatWindow.setMenuBarVisibility(false)
  chatWindow.loadFile('chat.html')

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
      preload: path.join(__dirname, 'preload-test.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  testerWindow.setMenuBarVisibility(false)
  testerWindow.loadFile('test.html')

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

function sendToPet(channel, payload) {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send(channel, payload)
  }
}

// Dipakai submenu Mode (sedang dikomentari di showPetMenu)
function toggleMode(name) {
  if (!(name in petModes)) {
    return
  }

  petModes[name] = !petModes[name]

  sendToPet('pet:modes', { ...petModes })
}

function showPetMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Ngobrol...',
      click: () => createChatWindow(),
    },

    { type: 'separator' },

    {
      label: 'Suruh tidur',
      click: () => sendToPet('pet:command', { action: 'sleep' }),
    },

    {
      label: 'Bangunkan',
      click: () => sendToPet('pet:command', { action: 'wake' }),
    },

    {
      label: 'Animasi acak',
      click: () => sendToPet('pet:command', { action: 'random' }),
    },

    // { type: 'separator' },

    // SEMENTARA DIMATIKAN untuk uji coba. Hapus komentarnya untuk
    // mengembalikan submenu Mode.
    // {
    //   label: 'Mode',
    //   submenu: [
    //     {
    //       label: 'Baca',
    //       type: 'checkbox',
    //       checked: petModes.reading,
    //       click: () => toggleMode('reading'),
    //     },
    //
    //     {
    //       label: 'Musik',
    //       type: 'checkbox',
    //       checked: petModes.music,
    //       click: () => toggleMode('music'),
    //     },
    //
    //     {
    //       label: 'Ngoding',
    //       type: 'checkbox',
    //       checked: petModes.coding,
    //       click: () => toggleMode('coding'),
    //     },
    //
    //     {
    //       label: 'Fokus',
    //       type: 'checkbox',
    //       checked: petModes.focus,
    //       click: () => toggleMode('focus'),
    //     },
    //   ],
    // },

    {
      label: 'Uji animasi...',
      click: () => createTesterWindow(),
    },

    { type: 'separator' },

    {
      label: 'Keluar',
      click: () => app.quit(),
    },
  ])

  menu.popup({ window: petWindow, callback: () => keepOnTop(true) })
}

function registerIpc() {
  ipcMain.on('pet:set-ignore-mouse', (_event, ignore) => {
    if (!petWindow || petWindow.isDestroyed()) {
      return
    }

    petWindow.setIgnoreMouseEvents(Boolean(ignore), { forward: true })
    keepOnTop()
  })

  ipcMain.on('pet:move-by', (_event, delta) => {
    if (!petWindow || petWindow.isDestroyed()) {
      return
    }

    const bounds = petWindow.getBounds()

    const next = clampToDisplay(
      bounds.x + (delta?.dx ?? 0),
      bounds.y + (delta?.dy ?? 0),
    )

    petWindow.setPosition(next.x, next.y)
    keepOnTop()
  })

  ipcMain.on('pet:set-position', (_event, position) => {
    if (!petWindow || petWindow.isDestroyed()) {
      return
    }

    const next = clampToDisplay(position?.x ?? 0, position?.y ?? 0)

    petWindow.setPosition(next.x, next.y)
    keepOnTop()
  })

  // Dipanggil renderer saat drag selesai: throttle dilewati sekali
  ipcMain.on('pet:raise', () => keepOnTop(true))

  ipcMain.handle('pet:get-bounds', () => {
    if (!petWindow || petWindow.isDestroyed()) {
      return null
    }

    const bounds = petWindow.getBounds()
    const area = screen.getDisplayNearestPoint(bounds).workArea

    return { bounds, workArea: area }
  })

  ipcMain.on('pet:open-chat', () => {
    createChatWindow()
  })

  ipcMain.on('pet:menu', () => {
    showPetMenu()
  })

  ipcMain.on('pet:animations', (_event, list) => {
    petAnimations = Array.isArray(list) ? list : []
  })

  ipcMain.handle('pet:animation-list', () => petAnimations)

  ipcMain.handle('pet:get-modes', () => ({ ...petModes }))

  ipcMain.on('pet:test-command', (_event, payload) => {
    sendToPet('pet:command', payload)
  })

  ipcMain.handle('settings:get', () => settings.publicSettings())

  ipcMain.handle('settings:update', (_event, patch) => {
    settings.writeSettings(patch ?? {})

    const next = settings.publicSettings()

    sendToPet('pet:settings', next)

    return next
  })

  ipcMain.handle('settings:set-key', (_event, payload) => {
    settings.setApiKey(payload?.provider, payload?.key)

    return settings.publicSettings()
  })

  ipcMain.handle('ai:ask', async (_event, message) => {
    sendToPet('pet:thinking', true)

    try {
      const result = await ai.ask(message)

      sendToPet('pet:say', {
        text: result.reply,
        emotion: result.emotion,
        source: 'ai',
      })

      return { ok: true, ...result }
    }
    catch (error) {
      sendToPet('pet:say', {
        text: 'Aduh, aku gagal menghubungi otakku...',
        emotion: 'lookAround',
        source: 'error',
      })

      return { ok: false, error: String(error?.message ?? error) }
    }
    finally {
      sendToPet('pet:thinking', false)
    }
  })

  ipcMain.handle('ai:history', () => ai.getHistory())

  ipcMain.handle('ai:clear', () => {
    ai.clearHistory()

    return true
  })
}

app.whenReady().then(() => {
  registerIpc()
  createPetWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})
