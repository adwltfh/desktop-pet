// node_modules/electron/dist/Electron.app punya bundle identifier generik
// (com.github.Electron) yang dipakai bareng SEMUA app Electron dev di mesin
// manapun -- macOS (terutama versi baru) menolak kasih izin Notification ke
// identity segenerik itu, dan appnya juga sering gak muncul di System
// Settings > Notifications sama sekali. Skrip ini bikin SALINAN Electron.app
// dengan bundle ID & nama sendiri, ditandatangani ad-hoc (codesign -s -,
// tidak butuh akun developer), lalu didaftarkan ke Launch Services -- supaya
// macOS mengenalinya sebagai app yang benar-benar terpisah dan mau
// memprosesnya lewat alur izin normal (Notification, Accessibility,
// Automation semuanya harus di-approve ulang di bawah identity baru ini).
//
// Disimpan di ~/Applications (bukan di dalam node_modules/ atau folder
// proyek) supaya tidak ikut kehapus tiap `npm install`, dan tidak perlu
// masuk .gitignore karena memang di luar folder proyek sama sekali.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')

const BUNDLE_ID = 'com.jinshi.pet.dev'
const APP_NAME = 'Jinshi Dev'
const PLIST_BUDDY = '/usr/libexec/PlistBuddy'
const LSREGISTER = '/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister'

const source = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app')
const dest = path.join(os.homedir(), 'Applications', `${APP_NAME}.app`)
const versionMarker = path.join(dest, 'Contents', '.electron-version')
const electronVersion = require('../node_modules/electron/package.json').version

function isUpToDate() {
  try {
    return fs.readFileSync(versionMarker, 'utf8').trim() === electronVersion
  }
  catch {
    return false
  }
}

function setPlistString(plist, key, value) {
  try {
    execFileSync(PLIST_BUDDY, ['-c', `Set :${key} ${value}`, plist])
  }
  catch {
    // Key belum ada di Info.plist bawaan Electron -> tambahkan, bukan set.
    execFileSync(PLIST_BUDDY, ['-c', `Add :${key} string ${value}`, plist])
  }
}

if (!isUpToDate()) {
  if (!fs.existsSync(source)) {
    console.error('Electron belum terpasang (node_modules/electron/dist/Electron.app tidak ada). Jalankan npm install dulu.')
    process.exit(1)
  }

  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  execFileSync('cp', ['-R', source, dest])

  const plist = path.join(dest, 'Contents', 'Info.plist')

  setPlistString(plist, 'CFBundleIdentifier', BUNDLE_ID)
  setPlistString(plist, 'CFBundleName', APP_NAME)
  setPlistString(plist, 'CFBundleDisplayName', APP_NAME)

  // Cuma wrapper terluar yang ditandatangani ulang -- Electron Helper.app di
  // Contents/Frameworks/ (proses GPU/renderer/plugin) sudah punya tanda
  // tangan & entitlements sandbox aslinya sendiri dari build Electron, dan
  // itu WAJIB dibiarkan apa adanya. --deep menimpa semuanya jadi ad-hoc
  // polos tanpa entitlements sandbox itu -> proses GPU/renderer gagal minta
  // sandbox extension buat baca folder Resources-nya sendiri.
  execFileSync('codesign', ['--force', '--sign', '-', dest])
  execFileSync(LSREGISTER, ['-f', dest])

  fs.writeFileSync(versionMarker, electronVersion, 'utf8')
}

process.stdout.write(dest)
