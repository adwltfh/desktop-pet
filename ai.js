const Anthropic = require('@anthropic-ai/sdk')
const { getApiKey, readSettings } = require('./settings')

// Ekspresi yang boleh dipilih model -> dipetakan ke nama animasi di renderer
const EMOTIONS = [
  'idle',
  'celebrate',
  'cuteGesture',
  'hugPlushie',
  'lookAround',
  'waving',
  'reactions',
  'shocked',
  'waterReminder',
  'patting',
  'reading',
  'waiting',
  'dancing',
  'listeningMusic',
  'usingLaptop',
  // Pose duduk mengantuk, bukan 'sleep' yang telungkup dan looping terus
  'sleepy',
]

const MAX_HISTORY_TURNS = 20

// Riwayat percakapan (stateless API, jadi kita simpan sendiri)
let history = []

function buildSystemPrompt() {
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
    '- Pilih ekspresi yang cocok dengan isi balasan (celebrate kalau masalah pengguna berhasil selesai atau pertanyaannya terjawab tuntas, hugPlushie kalau menenangkan atau mengingatkan tidur, lookAround kalau bingung, shocked kalau kaget, waving kalau menyapa atau berpamitan, waterReminder kalau mengingatkan minum, patting kalau memuji, reading kalau membahas bacaan atau belajar, waiting kalau menunggu jawaban pengguna, dancing kalau riang sekali, listeningMusic kalau membahas musik atau suasana santai, usingLaptop kalau membahas kerjaan atau ngoding, reactions untuk reaksi ringan lainnya).',
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

function pushHistory(role, content) {
  history.push({ role, content })

  const maxMessages = MAX_HISTORY_TURNS * 2

  if (history.length > maxMessages) {
    history = history.slice(history.length - maxMessages)
  }
}

function clearHistory() {
  history = []
}

function getHistory() {
  return history.map(entry => ({ ...entry }))
}

function isBetaUnsupported(error) {
  const message = String(error?.message ?? '').toLowerCase()

  return (
    error?.status === 400
    && (message.includes('beta') || message.includes('fallback'))
  )
}

async function askClaude(userMessage) {
  const apiKey = getApiKey('claude')

  if (!apiKey) {
    throw new Error('API key Claude belum diisi. Buka jendela chat > Setting.')
  }

  const settings = readSettings()
  const client = new Anthropic({ apiKey })

  const request = {
    model: settings.models.claude,
    max_tokens: 600,
    system: buildSystemPrompt(),
    output_config: { effort: 'low' },
    messages: [...history, { role: 'user', content: userMessage }],
  }

  let response

  try {
    // Fallback sisi server: kalau model menolak, request diulang otomatis
    // ke model cadangan dalam satu panggilan yang sama.
    response = await client.beta.messages.create({
      ...request,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
  }
  catch (error) {
    if (!isBetaUnsupported(error)) {
      throw error
    }

    // Organisasi/endpoint tidak mendukung beta fallback: jalan tanpa itu
    response = await client.messages.create(request)
  }

  if (response.stop_reason === 'refusal') {
    const category = response.stop_details?.category ?? 'unknown'

    throw new Error(`Claude menolak menjawab permintaan ini (${category}).`)
  }

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')

  return parseReply(text)
}

async function askChatGPT(userMessage) {
  const apiKey = getApiKey('chatgpt')

  if (!apiKey) {
    throw new Error('API key OpenAI belum diisi. Buka jendela chat > Setting.')
  }

  const settings = readSettings()

  const response = await fetch(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },

      body: JSON.stringify({
        model: settings.models.chatgpt,
        max_tokens: 600,

        messages: [
          { role: 'system', content: buildSystemPrompt() },
          ...history,
          { role: 'user', content: userMessage },
        ],
      }),
    },
  )

  if (!response.ok) {
    const detail = await response.text()

    throw new Error(`OpenAI error ${response.status}: ${detail.slice(0, 300)}`)
  }

  const payload = await response.json()
  const text = payload.choices?.[0]?.message?.content ?? ''

  return parseReply(text)
}

async function ask(userMessage) {
  const message = (userMessage ?? '').trim()

  if (!message) {
    throw new Error('Pesan kosong.')
  }

  const provider = readSettings().provider

  const result = provider === 'chatgpt'
    ? await askChatGPT(message)
    : await askClaude(message)

  pushHistory('user', message)
  pushHistory('assistant', result.reply)

  return result
}

module.exports = {
  EMOTIONS,
  ask,
  clearHistory,
  getHistory,
}
