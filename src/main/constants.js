const PET_WIDTH = 320
const PET_HEIGHT = 300

// Widget kecil pojok layar buat counter pat harian -- ukurannya cuma
// cukup buat satu baris teks, bukan jendela biasa. Tingginya sengaja punya
// ruang lebih dari isi teksnya supaya padding vertikal .badge (lihat
// pat-counter/style.css) tidak harus dipepetkan ke 0.
const PAT_COUNTER_WIDTH = 110
const PAT_COUNTER_HEIGHT = 48
const PAT_COUNTER_MARGIN = 14
const COUNTER_GAP = 5

const DRINK_COUNTER_WIDTH = 170
const DRINK_COUNTER_HEIGHT = PAT_COUNTER_HEIGHT
const MODE_PICKER_WIDTH = PAT_COUNTER_WIDTH + COUNTER_GAP + DRINK_COUNTER_WIDTH
const MODE_PICKER_HEIGHT = 64
const MODE_PICKER_GAP = 6
const POMODORO_WIDTH = 210
const POMODORO_HEIGHT = 260

// Jendela aksi cepat (dipicu dari menu bar): form kecil per aksi, lebih
// tinggi kalau field-nya lebih banyak.
const SEARCH_APP_WIDTH = 440
const SEARCH_APP_HEIGHT = 520
const CALENDAR_EVENT_WIDTH = 320
const CALENDAR_EVENT_HEIGHT = 300
const REMINDER_WIDTH = 320
const REMINDER_HEIGHT = 370

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
  PAT_COUNTER_WIDTH,
  PAT_COUNTER_HEIGHT,
  PAT_COUNTER_MARGIN,
  COUNTER_GAP,
  DRINK_COUNTER_WIDTH,
  DRINK_COUNTER_HEIGHT,
  MODE_PICKER_WIDTH,
  MODE_PICKER_HEIGHT,
  MODE_PICKER_GAP,
  POMODORO_WIDTH,
  POMODORO_HEIGHT,
  SEARCH_APP_WIDTH,
  SEARCH_APP_HEIGHT,
  CALENDAR_EVENT_WIDTH,
  CALENDAR_EVENT_HEIGHT,
  REMINDER_WIDTH,
  REMINDER_HEIGHT,
}
