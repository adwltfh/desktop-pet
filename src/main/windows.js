const { BrowserWindow, screen } = require('electron')
const path = require('node:path')

const {
  PET_WIDTH,
  PET_HEIGHT,
  TOP_LEVEL,
  TOP_REASSERT_MS,
  PAT_COUNTER_WIDTH,
  PAT_COUNTER_HEIGHT,
  PAT_COUNTER_MARGIN,
  COUNTER_GAP,
  DRINK_COUNTER_WIDTH,
  DRINK_COUNTER_HEIGHT,
  MODE_PICKER_WIDTH,
  MODE_PICKER_HEIGHT,
  MODE_PICKER_GAP,
  POMODORO_WIDTH,
  POMODORO_HEIGHT,
  SEARCH_APP_WIDTH,
  SEARCH_APP_HEIGHT,
  CALENDAR_EVENT_WIDTH,
  CALENDAR_EVENT_HEIGHT,
  REMINDER_WIDTH,
  REMINDER_HEIGHT,
} = require('./constants')
const claudeCli = require('./claude-cli')
const settings = require('./settings')
const collision = require('./pet-collision')
const state = require('./state')
const { refreshTray, getTrayBounds } = require('./tray')

let lastTopReassert = 0

let petWindow = null
let chatWindow = null
let testerWindow = null
let patCounterWindow = null
let drinkCounterWindow = null
let modePickerWindow = null
let pomodoroWindow = null
let petHiddenForPomodoro = false
let searchAppWindow = null
let calendarEventWindow = null
let reminderWindow = null

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

function spriteScale() {
  return settings.readSettings().behavior?.spriteScale ?? 1
}

function counterBarrier() {
  const counters = [patCounterWindow, drinkCounterWindow, modePickerWindow]
    .filter(win => win && !win.isDestroyed())
    .map(win => win.getBounds())

  if (!counters.length) {
    return null
  }

  const x = Math.min(...counters.map(bounds => bounds.x))
  const y = Math.min(...counters.map(bounds => bounds.y))
  const right = Math.max(...counters.map(bounds => bounds.x + bounds.width))
  const bottom = Math.max(...counters.map(bounds => bounds.y + bounds.height))

  return { x, y, width: right - x, height: bottom - y }
}

function resolvePetPosition(current, desired) {
  return collision.resolvePosition(
    current,
    desired,
    counterBarrier(),
    spriteScale(),
    clampToDisplay,
  )
}

function keepPetClearOfCounters() {
  if (!petWindow || petWindow.isDestroyed()) {
    return
  }

  const current = petWindow.getBounds()
  const safe = resolvePetPosition(current, current)

  if (safe.x !== current.x || safe.y !== current.y) {
    petWindow.setPosition(safe.x, safe.y)
  }
}

function petWalkMaxX(bounds) {
  const barrier = counterBarrier()

  if (!barrier || screen.getDisplayMatching(bounds).id
    !== screen.getDisplayMatching(barrier).id) {
    return null
  }

  return collision.walkMaxX(bounds.y, barrier, spriteScale())
}

function petContactX(counterX) {
  return collision.leftOf({ x: counterX }, spriteScale())
}

function keepOnTop(force = false) {
  if (!petWindow || petWindow.isDestroyed() || petHiddenForPomodoro) {
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

  // Jangan memindahkan panel ke Space aktif: panel hanya ada di desktop
  // tempat aplikasi dibuka, sehingga tidak ikut ke Space fullscreen macOS.
}

function setPetHiddenForPomodoro(hidden) {
  if (hidden) {
    if (!petHiddenForPomodoro && petWindow && !petWindow.isDestroyed()
      && petWindow.isVisible()) {
      petHiddenForPomodoro = true
      petWindow.hide()
    }

    return
  }

  if (petHiddenForPomodoro) {
    petHiddenForPomodoro = false

    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.showInactive()
      keepOnTop(true)
    }
  }
}

function sendToPet(channel, payload) {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send(channel, payload)
  }
}

function sendToPatCounter(channel, payload) {
  if (patCounterWindow && !patCounterWindow.isDestroyed()) {
    patCounterWindow.webContents.send(channel, payload)
  }

  if (channel === 'pat-counter:update') {
    refreshTray()
  }
}

function sendToDrinkCounter(channel, payload) {
  if (drinkCounterWindow && !drinkCounterWindow.isDestroyed()) {
    drinkCounterWindow.webContents.send(channel, payload)
  }

  if (channel === 'drink-counter:update') {
    refreshTray()
  }
}

function broadcastModeState() {
  const current = state.getModeState()

  sendToPet('pet:modes', current.modes)

  if (modePickerWindow && !modePickerWindow.isDestroyed()) {
    modePickerWindow.webContents.send('mode-picker:update', current)
  }

  refreshTray()
}

function createPetWindow() {
  // "Pet aktif" = folder skill/memori/persona lokalnya harus siap dan
  // CLAUDE.md sinkron dengan persona terbaru sebelum ada yang bisa ngobrol.
  try {
    claudeCli.ensureWorkspace()
  }
  catch (error) {
    console.error('Gagal menyiapkan folder Claude CLI pet:', error)
  }

  const area = screen.getPrimaryDisplay().workArea
  const patX = area.x + area.width - PAT_COUNTER_MARGIN
    - DRINK_COUNTER_WIDTH - COUNTER_GAP - PAT_COUNTER_WIDTH

  petWindow = new BrowserWindow({
    width: PET_WIDTH,
    height: PET_HEIGHT,
    x: Math.max(area.x, petContactX(patX) - 24),
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

  if (petHiddenForPomodoro) {
    petWindow.hide()
  }
}

// Widget kecil, diam di pojok layar (tidak ikut jalan sama pet), nunjukin
// berapa kali dipat hari ini. Frameless & click-through, jadi murni HUD --
// tidak bisa diklik/ditutup lewat UI, cuma hilang kalau app-nya ditutup.
function createPatCounterWindow() {
  if (patCounterWindow) {
    return patCounterWindow
  }

  const area = screen.getPrimaryDisplay().workArea

  patCounterWindow = new BrowserWindow({
    width: PAT_COUNTER_WIDTH,
    height: PAT_COUNTER_HEIGHT,
    x: area.x + area.width - PAT_COUNTER_MARGIN - DRINK_COUNTER_WIDTH
      - COUNTER_GAP - PAT_COUNTER_WIDTH,
    y: area.y + area.height - PAT_COUNTER_HEIGHT - PAT_COUNTER_MARGIN,

    frame: false,
    transparent: true,
    backgroundColor: '#00000000',

    alwaysOnTop: true,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    show: false,

    webPreferences: {
      preload: path.join(__dirname, '../preload/pat-counter.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  patCounterWindow.loadFile(path.join(__dirname, '../renderer/pat-counter/index.html'))

  patCounterWindow.setAlwaysOnTop(true, TOP_LEVEL)
  patCounterWindow.showInactive()

  // Murni tampilan -- klik tembus ke desktop selamanya
  patCounterWindow.setIgnoreMouseEvents(true, { forward: true })

  keepPetClearOfCounters()

  patCounterWindow.on('closed', () => {
    patCounterWindow = null
  })

  return patCounterWindow
}

// Sejajar dengan pat counter di kanan bawah, dengan jarak kecil antar badge.
function createDrinkCounterWindow() {
  if (drinkCounterWindow) {
    return drinkCounterWindow
  }

  const area = screen.getPrimaryDisplay().workArea

  drinkCounterWindow = new BrowserWindow({
    width: DRINK_COUNTER_WIDTH,
    height: DRINK_COUNTER_HEIGHT,
    x: area.x + area.width - DRINK_COUNTER_WIDTH - PAT_COUNTER_MARGIN,
    y: area.y + area.height - DRINK_COUNTER_HEIGHT - PAT_COUNTER_MARGIN,

    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    show: false,

    webPreferences: {
      preload: path.join(__dirname, '../preload/drink-counter.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  drinkCounterWindow.loadFile(path.join(__dirname, '../renderer/drink-counter/index.html'))
  drinkCounterWindow.setAlwaysOnTop(true, TOP_LEVEL)
  drinkCounterWindow.showInactive()

  // Jaga posisi awal saat layar kecil atau skala sprite besar.
  keepPetClearOfCounters()

  drinkCounterWindow.on('closed', () => {
    drinkCounterWindow = null
  })

  return drinkCounterWindow
}

// Panel mode tepat di atas dua counter, sehingga pilihan selalu terlihat
// tanpa harus membuka menu klik-kanan pet.
function createModePickerWindow() {
  if (modePickerWindow) {
    return modePickerWindow
  }

  const area = screen.getPrimaryDisplay().workArea

  modePickerWindow = new BrowserWindow({
    width: MODE_PICKER_WIDTH,
    height: MODE_PICKER_HEIGHT,
    x: area.x + area.width - MODE_PICKER_WIDTH - PAT_COUNTER_MARGIN,
    y: area.y + area.height - PAT_COUNTER_MARGIN - PAT_COUNTER_HEIGHT
      - MODE_PICKER_GAP - MODE_PICKER_HEIGHT,

    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    show: false,

    webPreferences: {
      preload: path.join(__dirname, '../preload/mode-picker.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  modePickerWindow.loadFile(path.join(__dirname, '../renderer/mode-picker/index.html'))
  modePickerWindow.setAlwaysOnTop(true, TOP_LEVEL)
  modePickerWindow.showInactive()
  keepPetClearOfCounters()

  modePickerWindow.on('closed', () => {
    modePickerWindow = null
  })

  return modePickerWindow
}

function createPomodoroWindow() {
  // Menu bar dapat dibuka dari Space lain; buat ulang panel di Space aktif.
  if (pomodoroWindow && !pomodoroWindow.isDestroyed()) {
    pomodoroWindow.destroy()
  }

  const trayBounds = getTrayBounds()
  const point = trayBounds
    ? { x: trayBounds.x + trayBounds.width / 2, y: trayBounds.y + trayBounds.height / 2 }
    : screen.getCursorScreenPoint()
  const area = screen.getDisplayNearestPoint(point).workArea
  const x = area.x + (area.width - POMODORO_WIDTH) / 2

  const window = new BrowserWindow({
    width: POMODORO_WIDTH,
    height: POMODORO_HEIGHT,
    x: Math.round(x),
    y: area.y + 8,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/pomodoro.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  pomodoroWindow = window
  window.loadFile(path.join(__dirname, '../renderer/pomodoro/index.html'))
  window.setAlwaysOnTop(true, TOP_LEVEL)
  window.showInactive()
  window.on('closed', () => {
    if (pomodoroWindow === window) {
      pomodoroWindow = null
      refreshTray()
    }
  })

  refreshTray()

  return window
}

function closePomodoroWindow() {
  if (pomodoroWindow && !pomodoroWindow.isDestroyed()) {
    pomodoroWindow.destroy()
  }
}

function sendToPomodoro(channel, payload) {
  if (pomodoroWindow && !pomodoroWindow.isDestroyed()) {
    pomodoroWindow.webContents.send(channel, payload)
  }
}

// Panel kecil transien (form aksi cepat dari menu bar): posisinya sama
// seperti Pomodoro (dekat ikon tray), tapi butuh fokus keyboard beneran
// buat mengetik -- jadi dipakai show() biasa, bukan showInactive().
function createTrayPopupWindow({ width, height, preload, file }) {
  const trayBounds = getTrayBounds()
  const point = trayBounds
    ? { x: trayBounds.x + trayBounds.width / 2, y: trayBounds.y + trayBounds.height / 2 }
    : screen.getCursorScreenPoint()
  const area = screen.getDisplayNearestPoint(point).workArea
  const x = area.x + (area.width - width) / 2

  const window = new BrowserWindow({
    width,
    height,
    x: Math.round(x),
    y: area.y + 8,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.loadFile(file)
  window.setAlwaysOnTop(true, TOP_LEVEL)
  window.once('ready-to-show', () => {
    window.show()
    window.focus()
  })

  return window
}

function createSearchAppWindow() {
  if (searchAppWindow && !searchAppWindow.isDestroyed()) {
    searchAppWindow.focus()

    return searchAppWindow
  }

  const window = createTrayPopupWindow({
    width: SEARCH_APP_WIDTH,
    height: SEARCH_APP_HEIGHT,
    preload: path.join(__dirname, '../preload/search-app.js'),
    file: path.join(__dirname, '../renderer/search-app/index.html'),
  })

  searchAppWindow = window
  window.on('closed', () => {
    if (searchAppWindow === window) {
      searchAppWindow = null
    }
  })

  return window
}

function createCalendarEventWindow() {
  if (calendarEventWindow && !calendarEventWindow.isDestroyed()) {
    calendarEventWindow.focus()

    return calendarEventWindow
  }

  const window = createTrayPopupWindow({
    width: CALENDAR_EVENT_WIDTH,
    height: CALENDAR_EVENT_HEIGHT,
    preload: path.join(__dirname, '../preload/calendar-event.js'),
    file: path.join(__dirname, '../renderer/calendar-event/index.html'),
  })

  calendarEventWindow = window
  window.on('closed', () => {
    if (calendarEventWindow === window) {
      calendarEventWindow = null
    }
  })

  return window
}

function createReminderWindow() {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.focus()

    return reminderWindow
  }

  const window = createTrayPopupWindow({
    width: REMINDER_WIDTH,
    height: REMINDER_HEIGHT,
    preload: path.join(__dirname, '../preload/reminder.js'),
    file: path.join(__dirname, '../renderer/reminder/index.html'),
  })

  reminderWindow = window
  window.on('closed', () => {
    if (reminderWindow === window) {
      reminderWindow = null
    }
  })

  return window
}

function hidePanels() {
  for (const widget of [patCounterWindow, drinkCounterWindow, modePickerWindow]) {
    if (widget && !widget.isDestroyed()) {
      widget.destroy()
    }
  }

  patCounterWindow = null
  drinkCounterWindow = null
  modePickerWindow = null
}

function showPanelsHere() {
  // Jendela baru mengikuti Space aktif saat tombol menu bar ditekan.
  // Tidak perlu setVisibleOnAllWorkspaces(false): default-nya sudah begitu,
  // dan memanggilnya dapat membuat macOS mengubah tipe proses sesaat.
  hidePanels()
  createPatCounterWindow()
  createDrinkCounterWindow()
  createModePickerWindow()
  keepPetClearOfCounters()
}

function createChatWindow() {
  if (chatWindow) {
    chatWindow.show()
    chatWindow.focus()

    return chatWindow
  }

  chatWindow = new BrowserWindow({
    width: 420,
    height: Math.min(720, screen.getPrimaryDisplay().workArea.height),
    minWidth: 340,
    minHeight: 420,
    title: 'Paviliun Jinshi',
    show: false,
    backgroundColor: '#111624',

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

function getPatCounterWindow() {
  return patCounterWindow
}

module.exports = {
  clampToDisplay,
  resolvePetPosition,
  keepPetClearOfCounters,
  petWalkMaxX,
  petContactX,
  keepOnTop,
  setPetHiddenForPomodoro,
  sendToPet,
  sendToPatCounter,
  sendToDrinkCounter,
  broadcastModeState,
  createPetWindow,
  createPatCounterWindow,
  createDrinkCounterWindow,
  createModePickerWindow,
  createPomodoroWindow,
  closePomodoroWindow,
  sendToPomodoro,
  showPanelsHere,
  hidePanels,
  createChatWindow,
  createTesterWindow,
  createSearchAppWindow,
  createCalendarEventWindow,
  createReminderWindow,
  getPetWindow,
  getPatCounterWindow,
  getModePickerWindow: () => modePickerWindow,
  getPomodoroWindow: () => pomodoroWindow,
  getSearchAppWindow: () => searchAppWindow,
  getCalendarEventWindow: () => calendarEventWindow,
  getReminderWindow: () => reminderWindow,
}
