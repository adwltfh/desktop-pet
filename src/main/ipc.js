const { app, ipcMain, screen, dialog, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

const ai = require('./ai')
const affection = require('./affection')
const drinks = require('./drinks')
const pomodoro = require('./pomodoro')
const settings = require('./settings')
const claudeCli = require('./claude-cli')
const mac = require('./mac-actions')
const fileExplorer = require('./file-explorer')
const selfImprovement = require('./self-improvement')
const { PET_EYE_OFFSET } = require('./constants')
const state = require('./state')
const windows = require('./windows')
const { showPetMenu } = require('./menu')

function registerIpc() {
  ipcMain.on('pet:set-ignore-mouse', (_event, ignore) => {
    const petWindow = windows.getPetWindow()

    if (!petWindow || petWindow.isDestroyed()) {
      return
    }

    petWindow.setIgnoreMouseEvents(Boolean(ignore), { forward: true })
    windows.keepOnTop()
  })

  ipcMain.on('pet:move-by', (_event, delta) => {
    const petWindow = windows.getPetWindow()

    if (!petWindow || petWindow.isDestroyed()) {
      return
    }

    const bounds = petWindow.getBounds()

    const next = windows.resolvePetPosition(
      bounds,
      {
        x: bounds.x + (delta?.dx ?? 0),
        y: bounds.y + (delta?.dy ?? 0),
      },
    )

    petWindow.setPosition(next.x, next.y)
    windows.keepOnTop()
  })

  ipcMain.on('pet:set-position', (_event, position) => {
    const petWindow = windows.getPetWindow()

    if (!petWindow || petWindow.isDestroyed()) {
      return
    }

    const next = windows.resolvePetPosition(
      petWindow.getBounds(),
      { x: position?.x ?? 0, y: position?.y ?? 0 },
    )

    petWindow.setPosition(next.x, next.y)
    windows.keepOnTop()
  })

  // Dipanggil renderer saat drag selesai: throttle dilewati sekali
  ipcMain.on('pet:raise', () => windows.keepOnTop(true))

  ipcMain.handle('pet:get-bounds', () => {
    const petWindow = windows.getPetWindow()

    if (!petWindow || petWindow.isDestroyed()) {
      return null
    }

    const bounds = petWindow.getBounds()
    const area = screen.getDisplayNearestPoint(bounds).workArea

    return { bounds, workArea: area, walkMaxX: windows.petWalkMaxX(bounds) }
  })

  // Titik tempat kaki sprite tendang menyentuh sisi kiri badge. Posisi
  // counter dibaca dari jendelanya sendiri, jadi pet tetap bisa mencarinya
  // setelah berpindah tempat.
  ipcMain.handle('pet:get-counter-target', () => {
    const petWindow = windows.getPetWindow()
    const counterWindow = windows.getPatCounterWindow()

    if (!petWindow || petWindow.isDestroyed()
      || !counterWindow || counterWindow.isDestroyed()) {
      return null
    }

    const bounds = petWindow.getBounds()
    const counter = counterWindow.getBounds()
    const petDisplay = screen.getDisplayMatching(bounds)
    const counterDisplay = screen.getDisplayMatching(counter)
    const area = counterDisplay.workArea

    return {
      bounds,
      target: windows.clampToDisplay(
        windows.petContactX(counter.x),
        area.y + area.height - bounds.height,
      ),
      sameDisplay: petDisplay.id === counterDisplay.id,
    }
  })

  ipcMain.on('pet:kick-counter', () => {
    windows.keepOnTop(true)
    windows.sendToPatCounter('pat-counter:kick')
  })

  // Kursor bisa berada di mana saja di layar, jadi posisinya tidak bisa
  // dibaca dari renderer yang jendelanya tembus klik. Yang dikembalikan
  // langsung selisihnya terhadap mata pet supaya renderer tidak perlu
  // menanyakan bounds tiap kali pandangannya disegarkan.
  ipcMain.handle('pet:get-cursor', () => {
    const petWindow = windows.getPetWindow()

    if (!petWindow || petWindow.isDestroyed()) {
      return null
    }

    const point = screen.getCursorScreenPoint()
    const bounds = petWindow.getBounds()

    return {
      dx: point.x - (bounds.x + bounds.width / 2),
      dy: point.y - (bounds.y + bounds.height - PET_EYE_OFFSET),
    }
  })

  ipcMain.on('pet:open-chat', () => {
    windows.createChatWindow()
  })

  ipcMain.on('pet:menu', () => {
    showPetMenu()
  })

  ipcMain.on('pet:animations', (_event, list) => {
    state.setPetAnimations(list)
  })

  ipcMain.handle('pet:animation-list', () => state.getPetAnimations())

  ipcMain.handle('pet:get-modes', () => state.getModeState().modes)

  ipcMain.handle('modes:get', () => state.getModeState())

  ipcMain.handle('pomodoro:get', event => {
    const panel = windows.getPomodoroWindow()
    return panel && event.sender === panel.webContents
      ? pomodoro.getState()
      : null
  })

  ipcMain.handle('pomodoro:command', (event, action, minutes) => {
    const panel = windows.getPomodoroWindow()
    return panel && event.sender === panel.webContents
      ? pomodoro.command(action, minutes)
      : null
  })

  ipcMain.handle('modes:choose', (event, name) => {
    const picker = windows.getModePickerWindow()

    if (!picker || event.sender !== picker.webContents) {
      return state.getModeState()
    }

    if (state.getModeState().selection !== name && state.selectMode(name)) {
      windows.broadcastModeState()
    }

    return state.getModeState()
  })

  ipcMain.on('pet:test-command', (_event, payload) => {
    windows.sendToPet('pet:command', payload)
  })

  ipcMain.handle('settings:get', () => settings.publicSettings())

  ipcMain.handle('settings:update', (_event, patch) => {
    settings.writeSettings(patch ?? {})
    windows.keepPetClearOfCounters()

    // Persona/nama pet bisa berubah lewat patch ini -> CLAUDE.md disegarkan
    // supaya CLI langsung pakai persona terbaru di obrolan berikutnya.
    claudeCli.syncPersona()

    const next = settings.publicSettings()

    windows.sendToPet('pet:settings', next)

    return next
  })

  ipcMain.handle('settings:set-key', (_event, payload) => {
    settings.setApiKey(payload?.provider, payload?.key)

    return settings.publicSettings()
  })

  // Dialog file native, diikat ke jendela chat supaya modal-nya benar di macOS
  ipcMain.handle('composer:pick-attachment', async event => {
    const win = BrowserWindow.fromWebContents(event.sender)

    const result = await dialog.showOpenDialog(win, {
      title: 'Lampirkan berkas',
      properties: ['openFile'],
    })

    if (result.canceled || !result.filePaths.length) {
      return null
    }

    return result.filePaths[0]
  })

  // Gambar dari clipboard (mis. screenshot) ditempel langsung ke composer --
  // ditulis ke berkas sementara supaya bisa dipakai attachmentPath yang sama
  // seperti hasil dialog file di atas (AI baca lewat tool Read).
  const CLIPBOARD_IMAGE_EXTENSIONS = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }

  ipcMain.handle('composer:save-clipboard-image', async (_event, buffer, mimeType) => {
    const extension = CLIPBOARD_IMAGE_EXTENSIONS[mimeType] ?? 'png'
    const filePath = path.join(app.getPath('temp'), `jinshi-pasted-image.${extension}`)

    await fs.writeFile(filePath, Buffer.from(buffer))

    return filePath
  })

  ipcMain.handle('ai:ask', async (_event, payload) => {
    windows.sendToPet('pet:thinking', true)

    try {
      const result = await ai.ask(
        payload?.message,
        payload?.mode,
        payload?.attachmentPath,
      )

      windows.sendToPet('pet:say', {
        text: result.reply,
        emotion: result.emotion,
        source: 'ai',
      })

      return { ok: true, ...result }
    }
    catch (error) {
      windows.sendToPet('pet:say', {
        text: 'Maaf, daw-chan — pikiranku sempat tersesat entah ke mana. Coba sekali lagi, ya?',
        emotion: 'reactions',
        source: 'error',
      })

      return { ok: false, error: String(error?.message ?? error) }
    }
    finally {
      windows.sendToPet('pet:thinking', false)
    }
  })

  ipcMain.handle('ai:history', () => ai.getHistory())

  ipcMain.handle('ai:clear', () => {
    ai.clearHistory()

    return true
  })

  ipcMain.handle('ai:usage', () => ai.getUsage())

  // Dipanggil renderer pet saat bootstrap: kalau hari sebelumnya kelewat
  // tanpa dipat, like-nya berkurang dan hasilnya (penalized: true) dipakai
  // renderer buat menampilkan reaksi ngambek.
  ipcMain.handle('affection:check', () => {
    const result = affection.checkDaily()
    windows.sendToPatCounter('pat-counter:update', result)
    return result
  })

  ipcMain.handle('affection:record-pat', () => {
    const result = affection.recordPat()

    windows.sendToPatCounter('pat-counter:update', result)

    return result
  })

  ipcMain.handle('affection:get', () => affection.getAffection())

  ipcMain.handle('memory-log:list', () => selfImprovement.listEntries(claudeCli.memoryDir()))

  ipcMain.handle('memory-log:undo', (_event, id) => {
    const result = selfImprovement.removeEntry(claudeCli.memoryDir(), id)

    // CLAUDE.md disegarkan segera supaya giliran berikutnya langsung tidak
    // lagi membawa entry yang baru diurungkan.
    claudeCli.syncPersona()

    return result
  })

  ipcMain.handle('drinks:get', () => drinks.checkDaily())

  ipcMain.handle('drinks:adjust', (_event, delta) => {
    if (delta !== 1 && delta !== -1) {
      return drinks.checkDaily()
    }

    const state = drinks.adjustDrink(delta)

    windows.sendToDrinkCounter('drink-counter:update', state)

    return state
  })

  ipcMain.handle('drinks:ack-reminder', event => {
    const petWindow = windows.getPetWindow()

    if (!petWindow || event.sender !== petWindow.webContents) {
      return false
    }

    if (!drinks.reminderDue()) {
      return false
    }

    drinks.acknowledgeReminder()

    return true
  })

  // Jendela aksi cepat (menu bar): tiap handler dikunci ke jendelanya
  // sendiri -- mengulang pola pomodoro:get/modes:choose di atas -- supaya
  // aksi macOS nyata ini cuma bisa dipicu dari panel yang memang
  // menampilkannya, bukan sembarang webContents lain.
  ipcMain.handle('file-explorer:list', async (event, location, base) => {
    const panel = windows.getSearchAppWindow()

    if (!panel || event.sender !== panel.webContents) {
      return null
    }

    try {
      return { ok: true, ...(await fileExplorer.listDirectory(location, base)) }
    }
    catch (error) {
      return { ok: false, error: String(error?.message ?? error) }
    }
  })

  ipcMain.handle('file-explorer:search', async (event, query) => {
    const panel = windows.getSearchAppWindow()

    if (!panel || event.sender !== panel.webContents) {
      return null
    }

    try {
      return { ok: true, ...(await fileExplorer.searchFiles(query)) }
    }
    catch (error) {
      return { ok: false, error: String(error?.message ?? error) }
    }
  })

  ipcMain.handle('file-explorer:open', async (event, location) => {
    const panel = windows.getSearchAppWindow()

    if (!panel || event.sender !== panel.webContents) {
      return null
    }

    try {
      return { ok: true, ...(await fileExplorer.openFile(location)) }
    }
    catch (error) {
      return { ok: false, error: String(error?.message ?? error) }
    }
  })

  ipcMain.handle('quick-action:list-calendars', async event => {
    const panel = windows.getCalendarEventWindow()

    if (!panel || event.sender !== panel.webContents) {
      return []
    }

    try {
      return await mac.listCalendars()
    }
    catch (error) {
      console.error('Gagal mengambil daftar kalender:', error)

      return []
    }
  })

  ipcMain.handle('quick-action:create-calendar-event', async (event, payload) => {
    const panel = windows.getCalendarEventWindow()

    if (!panel || event.sender !== panel.webContents) {
      return null
    }

    try {
      return { ok: true, ...(await mac.createCalendarEvent(payload ?? {})) }
    }
    catch (error) {
      return { ok: false, error: String(error?.message ?? error) }
    }
  })

  ipcMain.handle('quick-action:list-reminder-lists', async event => {
    const panel = windows.getReminderWindow()

    if (!panel || event.sender !== panel.webContents) {
      return []
    }

    try {
      return await mac.listReminderLists()
    }
    catch (error) {
      console.error('Gagal mengambil daftar reminder:', error)

      return []
    }
  })

  ipcMain.handle('quick-action:create-reminder', async (event, payload) => {
    const panel = windows.getReminderWindow()

    if (!panel || event.sender !== panel.webContents) {
      return null
    }

    try {
      return { ok: true, ...(await mac.createReminder(payload ?? {})) }
    }
    catch (error) {
      return { ok: false, error: String(error?.message ?? error) }
    }
  })

  // Satu channel dipakai ketiga panel aksi cepat -- tiap panel cuma bisa
  // menutup jendelanya sendiri karena BrowserWindow.fromWebContents diambil
  // dari event.sender pemanggilnya sendiri.
  ipcMain.on('quick-action:close', event => {
    BrowserWindow.fromWebContents(event.sender)?.destroy()
  })
}

module.exports = { registerIpc }
