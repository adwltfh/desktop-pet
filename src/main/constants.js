const PET_WIDTH = 320
const PET_HEIGHT = 300

// Tinggi mata pet dari dasar jendela. Sprite-nya menempel di dasar stage,
// jadi angkanya tetap. Dipakai supaya arah pandang dihitung dari kepala,
// bukan dari titik tengah jendela yang sebagian besarnya kosong.
const PET_EYE_OFFSET = 108

// Windows kadang melepas flag topmost saat jendela frameless + transparent
// dipindah berkali-kali, jadi levelnya dipasang ulang secara berkala.
const TOP_LEVEL = 'screen-saver'
const TOP_REASSERT_MS = 300

module.exports = {
  PET_WIDTH,
  PET_HEIGHT,
  PET_EYE_OFFSET,
  TOP_LEVEL,
  TOP_REASSERT_MS,
}
