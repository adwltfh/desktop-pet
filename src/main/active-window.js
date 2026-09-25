const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const state = require('./state')
const { broadcastModeState } = require('./windows')

const execFileAsync = promisify(execFile)

const POLL_INTERVAL_MS = 20 * 1000

// Nama proses persis seperti dikembalikan System Events -> mode yang cocok.
// Daftar app umum saja; app yang tidak terdaftar di sini tidak mengubah
// mode apa pun.
const APP_MODE_MAP = {
  Code: 'coding',
  Cursor: 'coding',
  Terminal: 'coding',
  iTerm2: 'coding',
  Xcode: 'coding',
  Books: 'reading',
  Preview: 'reading',
  Kindle: 'reading',
  Spotify: 'music',
  Music: 'music',
}

// Mode yang boleh dinyalakan/dimatikan otomatis dari deteksi ini. 'focus'
// sengaja tidak diikutkan -- tidak ada app spesifik yang identik dengan
// "fokus", jadi tetap pilihan manual lewat panel atau menu klik-kanan.
async function detectFrontmostApp() {
  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'tell application "System Events" to get name of first application process whose frontmost is true',
    ], { timeout: 5000 })

    return stdout.trim()
  }
  catch (error) {
    console.error('Gagal mendeteksi aplikasi aktif:', error.message)

    return null
  }
}

async function poll() {
  const app = await detectFrontmostApp()
  const mappedMode = app ? APP_MODE_MAP[app] : undefined

  if (state.setDetectedMode(mappedMode)) {
    broadcastModeState()
  }
}

function watchActiveWindow() {
  setInterval(() => {
    poll().catch(error => console.error('Gagal poll aplikasi aktif:', error))
  }, POLL_INTERVAL_MS)
}

module.exports = { watchActiveWindow }
