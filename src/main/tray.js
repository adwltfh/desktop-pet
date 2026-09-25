const { app, Menu, Tray } = require('electron')
const path = require('node:path')

const affection = require('./affection')
const drinks = require('./drinks')
const state = require('./state')
const pomodoro = require('./pomodoro')

let tray = null
let panelsOpen = false
let refreshing = false

function buildMenu() {
  const selected = state.getModeState().selection
  const pats = affection.getAffection().patsToday
  const water = drinks.checkDaily().drinksToday
  const timer = pomodoro.getState()
  const pomodoroWindow = require('./windows').getPomodoroWindow()
  const pomodoroOpen = pomodoroWindow && !pomodoroWindow.isDestroyed()

  const modeItem = (label, name) => ({
    label,
    type: 'radio',
    checked: selected === name,
    click: () => require('./menu').toggleMode(name),
  })

  return Menu.buildFromTemplate([
    { label: `Jinshi · Pat hari ini: ${pats}`, enabled: false },
    { label: `Minum hari ini: ${water}`, enabled: false },
    {
      label: 'Catat minum +1',
      click: () => {
        const next = drinks.adjustDrink(1)
        require('./windows').sendToDrinkCounter('drink-counter:update', next)
      },
    },
    {
      label: 'Koreksi minum −1',
      enabled: water > 0,
      click: () => {
        const next = drinks.adjustDrink(-1)
        require('./windows').sendToDrinkCounter('drink-counter:update', next)
      },
    },
    { type: 'separator' },
    {
      label: `Pomodoro · ${timer.phase === 'focus' ? 'Fokus' : 'Istirahat'}${timer.running ? ' berjalan' : ''}`,
      click: () => require('./windows').createPomodoroWindow(),
    },
    {
      label: 'Tutup Pomodoro',
      enabled: Boolean(pomodoroOpen),
      click: () => require('./windows').closePomodoroWindow(),
    },
    { type: 'separator' },
    {
      label: 'Tampilkan panel di Space ini',
      click: () => {
        require('./windows').showPanelsHere()
        panelsOpen = true
        refreshTray()
      },
    },
    {
      label: 'Sembunyikan panel',
      enabled: panelsOpen,
      click: () => {
        require('./windows').hidePanels()
        panelsOpen = false
        refreshTray()
      },
    },
    { type: 'separator' },
    {
      label: 'Aksi cepat',
      submenu: [
        { label: 'Jelajahi file...', click: () => require('./windows').createSearchAppWindow() },
        { label: 'Buat acara Calendar...', click: () => require('./windows').createCalendarEventWindow() },
        { label: 'Buat reminder...', click: () => require('./windows').createReminderWindow() },
      ],
    },
    { type: 'separator' },
    {
      label: 'Mode',
      submenu: [
        modeItem('Auto', 'auto'),
        modeItem('Kerja / ngoding', 'coding'),
        modeItem('Musik', 'music'),
        modeItem('Baca', 'reading'),
        modeItem('Fokus', 'focus'),
      ],
    },
    { label: 'Ngobrol...', click: () => require('./windows').createChatWindow() },
    { label: 'Lihat Jinshi', click: () => require('./windows').keepOnTop(true) },
    { type: 'separator' },
    { label: 'Keluar', click: () => app.quit() },
  ])
}

function refreshTray() {
  if (tray && !refreshing) {
    refreshing = true
    try {
      tray.setContextMenu(buildMenu())
    }
    finally {
      refreshing = false
    }
  }
}

function createTray() {
  if (tray) {
    return tray
  }

  tray = new Tray(path.join(__dirname, 'assets/jinshiTemplate.png'))
  tray.setToolTip('Jinshi · mode, pat, minum, dan Pomodoro')
  refreshTray()

  return tray
}

function getTrayBounds() {
  return tray ? tray.getBounds() : null
}

module.exports = { createTray, refreshTray, getTrayBounds }
