// Mode aktivitas: menentukan animasi apa yang menemani pengguna. Dinyalakan
// lewat menu klik-kanan pet dan hanya bertahan selama aplikasi jalan.
const petModes = {
  reading: false,
  music: false,
  coding: false,
  focus: false,
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
  setPetAnimations,
  getPetAnimations,
}
