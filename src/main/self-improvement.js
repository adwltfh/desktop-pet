// Log self-improvement pet: fakta/aturan yang diingat (auto/manual lewat
// remember_fact) + ringkasan kebiasaan otomatis. Dipanggil dari DUA proses
// OS terpisah -- proses utama Electron (claude-cli.js, tiap giliran) dan
// subprocess mcp-tools-server.js (tool remember_fact) -- jadi TIDAK ada
// cache modul (beda dari affection.js/drinks.js): tiap fungsi baca file
// fresh di awal, tulis fresh di akhir. Tulis lewat file sementara + rename
// (atomic di filesystem yang sama) supaya proses lain yang baca bersamaan
// tidak pernah dapat JSON setengah jadi.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

function storeFile(memoryDir) {
  return path.join(memoryDir, 'self-improvement.json')
}

function defaultStore() {
  return { entries: [], totalTurns: 0, habitTally: {}, lastHabitSummaryAtTurn: 0 }
}

function readStore(memoryDir) {
  try {
    const raw = fs.readFileSync(storeFile(memoryDir), 'utf8')
    const parsed = JSON.parse(raw)

    return {
      ...defaultStore(),
      ...parsed,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      habitTally: parsed.habitTally && typeof parsed.habitTally === 'object' ? parsed.habitTally : {},
    }
  }
  catch {
    // Berkas belum ada atau rusak -> mulai kosong, jangan crash.
    return defaultStore()
  }
}

function writeStore(memoryDir, store) {
  fs.mkdirSync(memoryDir, { recursive: true })

  const file = storeFile(memoryDir)
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`

  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8')
  fs.renameSync(tmp, file)

  return store
}

function addEntry(memoryDir, { type, text, source }) {
  const store = readStore(memoryDir)

  const entry = {
    id: crypto.randomUUID(),
    type,
    text: text.trim(),
    source: source ?? null,
    createdAt: new Date().toISOString(),
    turnAtCreation: store.totalTurns,
  }

  store.entries.push(entry)
  writeStore(memoryDir, store)

  return entry
}

function removeEntry(memoryDir, id) {
  const store = readStore(memoryDir)

  store.entries = store.entries.filter(entry => entry.id !== id)
  writeStore(memoryDir, store)

  return { entries: store.entries, totalTurns: store.totalTurns }
}

function listEntries(memoryDir) {
  const store = readStore(memoryDir)

  return { entries: store.entries, totalTurns: store.totalTurns }
}

// Tiap berapa giliran ringkasan kebiasaan otomatis dibuat, dan berapa
// kategori teratas yang ditampilkan di teksnya.
const HABIT_INTERVAL = 20
const HABIT_TOP_N = 3

// Kata kunci Bahasa Indonesia per kategori kebiasaan -- dicocokkan sebagai
// substring case-insensitive ke pesan pengguna. Kategori pertama yang cocok
// menang (satu pesan = satu kategori, bukan tally ganda per pesan).
const CATEGORY_KEYWORDS = {
  catatan: ['catat', 'catatan', 'notes'],
  dokumen: ['dokumen', 'docx', 'surat', 'laporan', 'pdf'],
  ringkas: ['ringkas', 'rangkum', 'rangkuman', 'summary', 'intisari'],
  jadwal: ['jadwal', 'reminder', 'ingatkan', 'agenda', 'kalender', 'rapat', 'meeting'],
  cari: ['cari', 'carikan', 'googling', 'search'],
  kode: ['kode', 'bug', 'debug', 'ngoding', 'coding', 'fungsi', 'error'],
  spreadsheet: ['spreadsheet', 'excel', 'sheet', 'tabel'],
}

function classifyHabit(message) {
  const lower = (message ?? '').toLowerCase()

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => lower.includes(keyword))) {
      return category
    }
  }

  return null
}

function formatHabitText(tally) {
  const top = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, HABIT_TOP_N)
    .map(([category, count]) => `${category} (${count}x)`)

  return `Paling sering minta: ${top.join(', ')}`
}

// Dipanggil SEKALI per giliran obrolan sukses, HANYA dari claude-cli.js
// (proses utama) -- subprocess MCP tidak pernah memanggil ini, cuma
// addEntry lewat remember_fact, jadi tidak ada giliran dihitung dobel.
// Sengaja tidak memanggil addEntry() untuk entry habit -- itu akan baca
// ulang store dari disk dan kehilangan totalTurns yang baru saja dinaikkan
// di memori tapi belum ditulis. Satu read-modify-write per panggilan.
function recordTurn(memoryDir, userMessageText) {
  const store = readStore(memoryDir)

  store.totalTurns += 1

  const category = classifyHabit(userMessageText)

  if (category) {
    store.habitTally[category] = (store.habitTally[category] ?? 0) + 1
  }

  const dueForSummary = store.totalTurns - store.lastHabitSummaryAtTurn >= HABIT_INTERVAL
    && Object.keys(store.habitTally).length > 0

  if (dueForSummary) {
    store.entries.push({
      id: crypto.randomUUID(),
      type: 'habit',
      text: formatHabitText(store.habitTally),
      source: `dari giliran ke-${store.totalTurns}`,
      createdAt: new Date().toISOString(),
      turnAtCreation: store.totalTurns,
    })

    store.lastHabitSummaryAtTurn = store.totalTurns
    // Tally direset supaya ringkasan BERIKUTNYA mencerminkan kebiasaan sejak
    // ringkasan ini, bukan akumulasi seumur hidup yang didominasi kategori
    // paling awal terus-menerus.
    store.habitTally = {}
  }

  writeStore(memoryDir, store)
}

module.exports = {
  addEntry,
  removeEntry,
  listEntries,
  recordTurn,
  HABIT_INTERVAL,
}
