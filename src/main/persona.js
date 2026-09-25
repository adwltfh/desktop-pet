const { readSettings } = require('./settings')

// Ekspresi yang boleh dipilih model -> dipetakan ke nama animasi di renderer
const EMOTIONS = [
  'idle',
  'celebrate',
  // Selebrasi besar, cuma untuk momen personal yang sangat membahagiakan/
  // membanggakan (ulang tahun, pencapaian besar) — jangan disimpulkan dari
  // keberhasilan teknis rutin atau masalah kecil yang baru selesai.
  'celebrateBig',
  'cuteGesture',
  'hugPlushie',
  'waving',
  'reactions',
  'sulky',
  'shocked',
  'waterReminder',
  'patting',
  'reading',
  'waiting',
  'dancing',
  'listeningMusic',
  'usingLaptop',
  // Reaksi kedip mengantuk sekali jalan; tidur panjang hanya lewat menu.
  'sleepy',
]

function buildPersonaText() {
  const settings = readSettings()

  return [
    `Kamu adalah "${settings.petName}", sebuah desktop pet yang hidup di layar pengguna.`,
    settings.persona,
    '',
    'Aturan menjawab:',
    '- Balas dalam bahasa yang dipakai pengguna.',
    '- Singkat dan hangat: maksimal 3 kalimat, kecuali pengguna minta penjelasan panjang.',
    '- Jangan pakai markdown heading atau bullet kecuali diminta.',
    `- Akhiri SETIAP balasan dengan satu tag ekspresi: [emotion:X] dengan X salah satu dari ${EMOTIONS.join(', ')}.`,
    '- Pilih ekspresi yang cocok dengan isi balasan (celebrate kalau masalah pengguna berhasil selesai atau pertanyaannya terjawab tuntas, hugPlushie kalau menenangkan atau mengingatkan tidur, reactions kalau bingung atau memberi reaksi ringan, shocked kalau kaget, waving kalau menyapa atau berpamitan, waterReminder kalau mengingatkan minum, patting kalau memuji, reading kalau membahas bacaan atau belajar, waiting kalau menunggu jawaban pengguna, dancing kalau riang sekali, listeningMusic kalau membahas musik atau suasana santai, usingLaptop kalau membahas kerjaan atau ngoding, sulky kalau cemberut manja atau merasa diabaikan).',
    '- celebrateBig HANYA untuk momen personal yang sangat membahagiakan/membanggakan pengguna sendiri: ulang tahun, pencapaian besar, cerita yang jelas-jelas bikin bangga atau bahagia. JANGAN pakai celebrateBig untuk keberhasilan teknis rutin, masalah kecil yang baru selesai, atau respons yang sekadar berhasil biasa — itu tetap celebrate.',
  ].join('\n')
}

function parseReply(rawText) {
  const text = (rawText ?? '').trim()
  const match = text.match(/\[emotion:\s*([a-zA-Z]+)\s*\]/)

  const emotion = match && EMOTIONS.includes(match[1])
    ? match[1]
    : 'idle'

  const reply = text.replace(/\[emotion:\s*[a-zA-Z]+\s*\]/g, '').trim()

  return {
    reply: reply || '...',
    emotion,
  }
}

// Dipakai buat indikator pemakaian di UI (bukan sisa limit/kuota -- itu
// tidak tersedia lewat CLI/SDK untuk akun langganan, cuma total token yang
// benar-benar terpakai/kebaca cache di panggilan ini).
function tokensFromAnthropicUsage(usage) {
  if (!usage) {
    return 0
  }

  return (
    (usage.input_tokens ?? 0)
    + (usage.cache_creation_input_tokens ?? 0)
    + (usage.cache_read_input_tokens ?? 0)
    + (usage.output_tokens ?? 0)
  )
}

module.exports = {
  buildPersonaText,
  parseReply,
  tokensFromAnthropicUsage,
}
