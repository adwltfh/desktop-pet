// CSP jendela chat cuma izinkan script 'self' (bukan CDN), jadi mermaid
// perlu dilayani dari dalam folder renderer sendiri -- bukan langsung dari
// node_modules/, supaya path relatifnya pendek & tidak tergantung struktur
// node_modules yang bisa berubah antar versi npm. Berkas hasil salinan ini
// sengaja tidak di-commit (lihat .gitignore) karena cuma turunan dari
// node_modules/mermaid, jadi dibuat ulang tiap `npm install`.
const fs = require('node:fs')
const path = require('node:path')

const source = path.join(__dirname, '..', 'node_modules', 'mermaid', 'dist', 'mermaid.min.js')
const destDir = path.join(__dirname, '..', 'src', 'renderer', 'chat', 'vendor')
const dest = path.join(destDir, 'mermaid.min.js')

if (!fs.existsSync(source)) {
  console.warn('mermaid.min.js tidak ditemukan di node_modules, lewati vendor.')
  process.exit(0)
}

fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(source, dest)

console.log('mermaid.min.js divendor ke src/renderer/chat/vendor/')
