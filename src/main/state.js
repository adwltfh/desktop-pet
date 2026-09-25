// Satu mode aktif pada satu waktu. Pilihan manual menahan hasil deteksi app
// sampai pengguna memilih Auto lagi; semuanya hidup selama aplikasi jalan.
const petModes = {
  reading: false,
  music: false,
  coding: false,
  focus: false,
}

const MODE_NAMES = ['reading', 'music', 'coding', 'focus']
let manualMode = null
let detectedMode = null

function applyMode() {
  const active = manualMode ?? detectedMode

  for (const name of MODE_NAMES) {
    petModes[name] = name === active
  }
}

function getModeState() {
  return {
    modes: { ...petModes },
    selection: manualMode ?? 'auto',
    active: manualMode ?? detectedMode,
  }
}

function selectMode(name) {
  if (name !== 'auto' && !MODE_NAMES.includes(name)) {
    return null
  }

  manualMode = name === 'auto' ? null : name
  applyMode()

  return getModeState()
}

function setDetectedMode(name) {
  const next = MODE_NAMES.includes(name) && name !== 'focus' ? name : null

  if (detectedMode === next) {
    return false
  }

  detectedMode = next

  if (manualMode !== null) {
    return false
  }

  applyMode()

  return true
}

// Dikirim renderer pet saat siap, dipakai jendela penguji animasi
let petAnimations = []

function setPetAnimations(list) {
  petAnimations = Array.isArray(list) ? list : []
}

function getPetAnimations() {
  return petAnimations
}

module.exports = {
  petModes,
  getModeState,
  selectMode,
  setDetectedMode,
  setPetAnimations,
  getPetAnimations,
}
