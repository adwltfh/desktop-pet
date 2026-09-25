const { uIOhook } = require('uiohook-napi')

const { sendToPet } = require('./windows')

// Scroll dianggap berhenti kalau tidak ada event roda mouse/trackpad baru
// selama ini -- dipakai supaya pet cuma "mikir" sekali per rentetan scroll,
// bukan berkedip tiap event (yang bisa berpuluh-puluh per detik).
const SCROLL_STOP_MS = 800

let scrollActive = false
let stopTimer = null

// uiohook memantau scroll SECARA GLOBAL (lintas aplikasi lain, bukan cuma
// jendela pet) -- itu satu-satunya cara mendeteksi scroll di app lain dari
// Electron, karena scroll trackpad tidak selalu menggerakkan kursor. Cuma
// event 'wheel' yang didengarkan & diteruskan di sini; klik/keyboard dari
// uiohook sengaja tidak dipakai sama sekali.
function watchScrolling() {
  try {
    uIOhook.on('wheel', () => {
      if (!scrollActive) {
        scrollActive = true
        sendToPet('pet:scroll-state', { active: true })
      }

      clearTimeout(stopTimer)

      stopTimer = setTimeout(() => {
        scrollActive = false
        sendToPet('pet:scroll-state', { active: false })
      }, SCROLL_STOP_MS)
    })

    uIOhook.start()
  }
  catch (error) {
    // Butuh izin Accessibility (System Settings > Privacy & Security >
    // Accessibility). Kalau belum diizinkan, fitur ini nonaktif diam-diam
    // saja -- tidak menghentikan atau mengganggu bagian app yang lain.
    console.error('Gagal mengaktifkan deteksi scroll (izin Accessibility?):', error.message)
  }
}

// uiohook menjalankan thread native sendiri di luar event loop Node --
// dipanggil eksplisit waktu app mau berhenti (lihat main/index.js) supaya
// thread itu tidak jadi alasan proses gagal keluar bersih.
function stopScrolling() {
  clearTimeout(stopTimer)

  try {
    uIOhook.stop()
  }
  catch {
    // Belum sempat start() (mis. izin Accessibility belum ada) -> tidak apa
  }
}

module.exports = { watchScrolling, stopScrolling }
