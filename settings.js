const { app, safeStorage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

// Dihitung lazy: app.getPath baru tersedia setelah modul electron siap
function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json')
}

const defaultSettings = {
  provider: 'claude',

  models: {
    claude: 'claude-opus-5',
    chatgpt: 'gpt-4o-mini',
  },

  petName: 'Jinshi',

  // Persona dikirim sebagai system prompt
  persona: [
    'Kamu seorang pemuda rupawan dari istana: wajahmu memukau, gerak-gerikmu anggun,',
    'dan suaramu tenang. Tutur katamu halus, sopan, sesekali menggoda dengan santai,',
    'tapi perhatianmu tulus. Kamu percaya diri tanpa sombong, sabar, dan diam-diam',
    'senang kalau diperhatikan. Panggil pengguna dengan akrab dan hangat, jangan kaku.',
  ].join(' '),

  behavior: {
    // Berapa lama tanpa interaksi sebelum pet bosan (ms)
    boredAfter: 3 * 60 * 1000,

    // Berapa lama tanpa interaksi sebelum pet tidur (ms)
    sleepAfter: 10 * 60 * 1000,

    // Peluang bubble dialog muncul setiap ganti aktivitas (0 - 1)
    chatterChance: 0.35,

    walkSpeed: 2,
    runSpeed: 5,
  },

  // Disimpan terenkripsi bila OS mendukung
  apiKeys: {
    claude: null,
    chatgpt: null,
  },
}

function isPlainObject(value) {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  )
}

function mergeDeep(base, patch) {
  const result = { ...base }

  for (const [key, value] of Object.entries(patch ?? {})) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      result[key] = mergeDeep(base[key], value)
    }
    else if (value !== undefined) {
      result[key] = value
    }
  }

  return result
}

let cache = null

function readSettings() {
  if (cache) {
    return cache
  }

  try {
    // BOM dibuang: editor Windows sering menambahkannya dan JSON.parse gagal
    const raw = fs.readFileSync(settingsFile(), 'utf8').replace(/^﻿/, '')

    cache = mergeDeep(defaultSettings, JSON.parse(raw))
  }
  catch {
    cache = { ...defaultSettings }
  }

  return cache
}

function writeSettings(patch) {
  cache = mergeDeep(readSettings(), patch)

  const file = settingsFile()

  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf8')

  return cache
}

function canEncrypt() {
  try {
    return safeStorage.isEncryptionAvailable()
  }
  catch {
    return false
  }
}

function setApiKey(provider, key) {
  const trimmed = (key ?? '').trim()

  if (!trimmed) {
    return writeSettings({ apiKeys: { [provider]: null } })
  }

  const stored = canEncrypt()
    ? {
        encrypted: true,
        value: safeStorage.encryptString(trimmed).toString('base64'),
      }
    : {
        encrypted: false,
        value: trimmed,
      }

  return writeSettings({ apiKeys: { [provider]: stored } })
}

function getApiKey(provider) {
  const stored = readSettings().apiKeys?.[provider]

  if (!stored) {
    // Fallback ke environment variable supaya gampang dipakai saat development
    const fallback = provider === 'claude'
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY

    return fallback || null
  }

  if (!stored.encrypted) {
    return stored.value
  }

  try {
    return safeStorage.decryptString(Buffer.from(stored.value, 'base64'))
  }
  catch {
    return null
  }
}

// Versi aman untuk dikirim ke renderer: tanpa isi API key
function publicSettings() {
  const settings = readSettings()

  return {
    provider: settings.provider,
    models: settings.models,
    petName: settings.petName,
    persona: settings.persona,
    behavior: settings.behavior,

    hasKey: {
      claude: Boolean(getApiKey('claude')),
      chatgpt: Boolean(getApiKey('chatgpt')),
    },

    keyEncrypted: canEncrypt(),
  }
}

module.exports = {
  settingsFile,
  defaultSettings,
  readSettings,
  writeSettings,
  setApiKey,
  getApiKey,
  publicSettings,
}
