const { ipcMain, screen } = require('electron')

const ai = require('./ai')
const settings = require('./settings')
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

    const next = windows.clampToDisplay(
      bounds.x + (delta?.dx ?? 0),
      bounds.y + (delta?.dy ?? 0),
    )

    petWindow.setPosition(next.x, next.y)
    windows.keepOnTop()
  })

  ipcMain.on('pet:set-position', (_event, position) => {
    const petWindow = windows.getPetWindow()

    if (!petWindow || petWindow.isDestroyed()) {
      return
    }

    const next = windows.clampToDisplay(position?.x ?? 0, position?.y ?? 0)

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

    return { bounds, workArea: area }
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

  ipcMain.handle('pet:get-modes', () => ({ ...state.petModes }))

  ipcMain.on('pet:test-command', (_event, payload) => {
    windows.sendToPet('pet:command', payload)
  })

  ipcMain.handle('settings:get', () => settings.publicSettings())

  ipcMain.handle('settings:update', (_event, patch) => {
    settings.writeSettings(patch ?? {})

    const next = settings.publicSettings()

    windows.sendToPet('pet:settings', next)

    return next
  })

  ipcMain.handle('settings:set-key', (_event, payload) => {
    settings.setApiKey(payload?.provider, payload?.key)

    return settings.publicSettings()
  })

  ipcMain.handle('ai:ask', async (_event, message) => {
    windows.sendToPet('pet:thinking', true)

    try {
      const result = await ai.ask(message)

      windows.sendToPet('pet:say', {
        text: result.reply,
        emotion: result.emotion,
        source: 'ai',
      })

      return { ok: true, ...result }
    }
    catch (error) {
      windows.sendToPet('pet:say', {
        text: 'Aduh, aku gagal menghubungi otakku...',
        emotion: 'lookAround',
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
}

module.exports = { registerIpc }
