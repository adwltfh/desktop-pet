const Anthropic = require('@anthropic-ai/sdk')

const { getApiKey, readSettings } = require('./settings')
const {
  buildPersonaText,
  parseReply,
  tokensFromAnthropicUsage,
} = require('./persona')
const claudeCli = require('./claude-cli')

// Total token & model asli-dipakai per provider sejak app ini dibuka --
// dipakai buat indikator "model + pemakaian" di UI. Ini BUKAN sisa
// limit/kuota (itu tidak tersedia lewat CLI/SDK untuk akun langganan), cuma
// akumulasi lokal & reset tiap app di-restart. Model dicatat per panggilan
// (bukan cuma dibaca dari Setting) karena mode 'claude' bisa menimpa model
// per mode (lihat MODES di claude-cli.js -- roleplay pakai model lebih
// ringan dari model utama pengguna).
const usageByProvider = {}
const lastModelByProvider = {}

function addUsage(provider, tokens, model) {
  if (tokens) {
    usageByProvider[provider] = (usageByProvider[provider] ?? 0) + tokens
  }

  if (model) {
    lastModelByProvider[provider] = model
  }
}

function getUsage(providerOverride) {
  const settings = readSettings()
  const provider = providerOverride ?? settings.provider

  return {
    provider,
    model: lastModelByProvider[provider] ?? settings.models[provider] ?? null,
    totalTokens: usageByProvider[provider] ?? 0,
  }
}

const MAX_HISTORY_TURNS = 20

// Riwayat provider berbasis API stateless (Claude API key & ChatGPT) disimpan
// sendiri di memori di sini. Provider 'claude' (CLI lokal) beda: riwayat &
// sesinya disimpan di folder pet lewat claude-cli.js, bukan di sini.
function createHistoryStore() {
  let history = []

  return {
    entries: () => history,

    push(role, content) {
      history.push({ role, content })

      const maxMessages = MAX_HISTORY_TURNS * 2

      if (history.length > maxMessages) {
        history = history.slice(history.length - maxMessages)
      }
    },

    clone: () => history.map(entry => ({ ...entry })),
    clear: () => { history = [] },
  }
}

const chatGptStore = createHistoryStore()
const claudeApiStore = createHistoryStore()

function isBetaUnsupported(error) {
  const message = String(error?.message ?? '').toLowerCase()

  return (
    error?.status === 400
    && (message.includes('beta') || message.includes('fallback'))
  )
}

async function askClaudeApi(userMessage) {
  const apiKey = getApiKey('claude-api')

  if (!apiKey) {
    throw new Error('API key Claude belum diisi. Buka jendela chat > Setting.')
  }

  const settings = readSettings()
  const client = new Anthropic({ apiKey })

  const request = {
    model: settings.models['claude-api'],
    max_tokens: 600,
    system: buildPersonaText(),
    output_config: { effort: 'low' },
    messages: [...claudeApiStore.entries(), { role: 'user', content: userMessage }],
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

  const result = parseReply(text)

  result.model = settings.models['claude-api']
  result.usageTokens = tokensFromAnthropicUsage(response.usage)

  return result
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
          { role: 'system', content: buildPersonaText() },
          ...chatGptStore.entries(),
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

  const result = parseReply(text)

  result.model = settings.models.chatgpt
  result.usageTokens = payload.usage?.total_tokens ?? 0

  return result
}

async function ask(userMessage, forcedMode, attachmentPath) {
  const message = (userMessage ?? '').trim()

  if (!message && !attachmentPath) {
    throw new Error('Pesan kosong.')
  }

  const provider = readSettings().provider
  let result

  if (provider === 'claude-api' || provider === 'chatgpt') {
    // Lampiran cuma didukung lewat CLI (pakai tool Read), bukan API mentah --
    // daripada diam-diam diabaikan, mending ditolak jelas.
    if (attachmentPath) {
      throw new Error(
        'Lampiran berkas cuma didukung di provider Claude (CLI lokal) untuk sekarang.',
      )
    }

    if (provider === 'claude-api') {
      result = await askClaudeApi(message)

      claudeApiStore.push('user', message)
      claudeApiStore.push('assistant', result.reply)
    }
    else {
      result = await askChatGPT(message)

      chatGptStore.push('user', message)
      chatGptStore.push('assistant', result.reply)
    }
  }
  else {
    // Provider 'claude' jalan lewat CLI lokal (src/main/claude-cli.js), yang
    // menyimpan riwayat & sesi sendiri di folder pet. forcedMode dari UI
    // (roleplay/working/searching) dilewatkan; kalau kosong/'auto', CLI yang
    // mengklasifikasi mode-nya sendiri.
    result = await claudeCli.ask(message, forcedMode, attachmentPath)
  }

  const { usageTokens, model, ...publicResult } = result

  addUsage(provider, usageTokens, model)

  return { ...publicResult, usage: getUsage(provider) }
}

function getHistory() {
  const provider = readSettings().provider

  if (provider === 'claude-api') {
    return claudeApiStore.clone()
  }

  if (provider === 'chatgpt') {
    return chatGptStore.clone()
  }

  return claudeCli.getHistory()
}

function clearHistory() {
  const provider = readSettings().provider

  if (provider === 'claude-api') {
    claudeApiStore.clear()
    return
  }

  if (provider === 'chatgpt') {
    chatGptStore.clear()
    return
  }

  claudeCli.clearHistory()
}

module.exports = {
  ask,
  clearHistory,
  getHistory,
  getUsage,
}
