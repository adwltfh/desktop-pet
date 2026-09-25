const { app, BrowserWindow, Notification } = require('electron')

const affection = require('./affection')
const drinks = require('./drinks')
const pomodoro = require('./pomodoro')
const {
  createPetWindow,
  sendToPet,
  sendToPatCounter,
  sendToDrinkCounter,
  sendToPomodoro,
  keepOnTop,
  setPetHiddenForPomodoro,
} = require('./windows')
const { registerIpc } = require('./ipc')
const { watchActiveWindow } = require('./active-window')
const { watchScrolling, stopScrolling } = require('./scroll-watch')
const { watchDeviceActivity } = require('./device-activity')
const { createTray, refreshTray } = require('./tray')

// Tanpa ini, tiap restart yang gagal keluar bersih (lihat stopScrolling di
// bawah) menumpuk jadi beberapa instance app hidup sekaligus -- masing-
// masing dengan jendela, poller, dan hook global sendiri -- yang lumayan
// menguras baterai tanpa kelihatan. Instance kedua langsung berhenti kalau
// yang pertama masih pegang lock ini.
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
}
else {
  // Instance kedua tadi tidak jadi jalan (lock ditolak) -- yang pertama ini
  // cukup naikkan pet-nya ke depan, bukan buka jendela baru.
  app.on('second-instance', () => keepOnTop(true))

  // Selain dicek waktu bootstrap renderer, pergantian hari juga dicek
  // berkala di sini -- supaya kalau app dibiarkan menyala lewat tengah
  // malam berhari-hari tanpa direstart, pundung karena kelewat pat tetap
  // terpicu & widget counter-nya ikut balik ke 0 tanpa perlu dipat dulu.
  const AFFECTION_CHECK_INTERVAL = 30 * 60 * 1000

  function watchAffection() {
    setInterval(() => {
      const result = affection.checkDaily()

      if (result.penalized) {
        sendToPet('pet:affection-penalty', result)
      }

      sendToPatCounter('pat-counter:update', result)
    }, AFFECTION_CHECK_INTERVAL)
  }

  // Jam pengingat disimpan di drinks.json, jadi restart tidak mengulang
  // hitungan dua jam. Notifikasi OS tetap dijadwalkan saat pet sibuk; jika pet
  // sibuk, bubble-nya dicoba lagi sampai benar-benar tampil.
  function showDrinkNotification() {
    if (!Notification.isSupported()) {
      return
    }

    try {
      const notification = new Notification({
        title: 'Jinshi mengingatkanmu minum',
        body: 'Sudah dua jam. Minum air dulu sebentar, ya 💧',
      })

      notification.on('failed', (_event, error) => {
        console.warn('Notifikasi minum tidak tampil:', error)
      })
      notification.show()
    }
    catch (error) {
      console.warn('Gagal mengirim notifikasi minum:', error)
    }
  }

  function watchDrinks() {
    function check() {
      const state = drinks.checkDaily()

      if (state.dateChanged) {
        sendToDrinkCounter('drink-counter:update', state)
      }

      if (drinks.notificationDue()) {
        drinks.markNotificationSent()
        showDrinkNotification()
      }

      if (drinks.reminderDue()) {
        sendToPet('pet:drink-reminder')
      }
    }

    check()
    setInterval(check, 30 * 1000)
  }

  // Dev only (electron-reloader no-op saat packaged): ubah file main -> app
  // direstart, ubah file renderer -> jendela yang terbuka di-reload otomatis.
  try {
    require('electron-reloader')(module)
  }
  catch (error) {
    console.error('electron-reloader gagal diaktifkan:', error)
  }

  app.whenReady().then(() => {
    // Menyembunyikan icon aplikasi dari Dock Mac
    if (process.platform === 'darwin') {
      app.dock.hide()
    }

    registerIpc()
    createPetWindow()
    createTray()
    pomodoro.setOnChange((timer, finished, action) => {
      sendToPomodoro('pomodoro:update', timer)
      refreshTray()

      if (action === 'start') {
        setPetHiddenForPomodoro(true)
      }
      else if (finished || ['pause', 'reset', 'skip', 'set-duration'].includes(action)) {
        setPetHiddenForPomodoro(false)
      }

      if (finished && Notification.isSupported()) {
        try {
          new Notification({
            title: finished === 'focus' ? 'Waktunya istirahat' : 'Siap fokus lagi?',
            body: finished === 'focus'
              ? `Sesi fokus selesai. Ambil jeda ${Math.round(timer.durationMs / 60000)} menit 🍵`
              : 'Jeda selesai. Mulai sesi fokus berikutnya saat siap ✨',
          }).show()
        }
        catch (error) {
          console.warn('Gagal mengirim notifikasi Pomodoro:', error)
        }
      }
    })
    watchAffection()
    watchDrinks()
    watchActiveWindow()
    watchScrolling()
    watchDeviceActivity()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPetWindow()
    }
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  // uiohook (deteksi scroll) jalan di thread native sendiri -- dihentikan
  // eksplisit di sini supaya bukan alasan proses gagal keluar bersih dan
  // menumpuk jadi instance zombie (lihat requestSingleInstanceLock di atas).
  app.on('before-quit', stopScrolling)
}
