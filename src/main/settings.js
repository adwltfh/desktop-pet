const { app, safeStorage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

// Dihitung lazy: app.getPath baru tersedia setelah modul electron siap
function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json')
}

// Sumber kebenaran persona default: vault Obsidian personality/ di root
// proyek (satu catatan .md per topik, dihubungkan pakai [[wikilink]] biasa)
// supaya gampang dibaca/ditata/dihubung-hubungkan langsung tanpa buka
// Setting. Semua catatan digabung apa adanya -- link [[...]] dibiarkan jadi
// teks biasa, model tetap paham itu sebagai rujukan antar topik. Setelah
// tersimpan ke settings.json (lewat Setting atau setelah pertama jalan),
// perubahan di vault tidak lagi otomatis terpakai -- itu jadi override
// milik pengguna.
function loadDefaultPersona() {
  const dir = path.join(__dirname, '..', '..', 'personality')

  try {
    const notes = fs.readdirSync(dir)
      .filter(name => name.endsWith('.md'))
      .sort()

    const sections = notes.map(name => {
      const raw = fs.readFileSync(path.join(dir, name), 'utf8')

      // Baris heading '# Judul' di awal tiap catatan dibuang, sisanya dipakai apa adanya
      return raw.replace(/^#.*\n+/, '').trim()
    })

    return sections.filter(Boolean).join('\n\n')
  }
  catch (error) {
    console.error('Gagal membaca vault personality/, pakai persona kosong:', error)

    return ''
  }
}

const defaultSettings = {
  provider: 'claude',

  models: {
    claude: 'claude-opus-5',
    'claude-api': 'claude-opus-5',
    chatgpt: 'gpt-4o-mini',
  },

  petName: 'Jinshi',

  // Persona dikirim sebagai system prompt
  persona: loadDefaultPersona(),

  behavior: {
    // Berapa lama tanpa interaksi sebelum pet bosan (ms)
    boredAfter: 3 * 60 * 1000,

    // Peluang bubble dialog muncul setiap ganti aktivitas (0 - 1)
    chatterChance: 0.35,

    walkSpeed: 2,
    runSpeed: 5,

    // Faktor skala sprite pet, dibatasi 0.7-1.6 di behavior.js supaya tidak
    // kepotong jendela pet yang ukurannya tetap.
    spriteScale: 1,
  },

  // Disimpan terenkripsi bila OS mendukung. Provider 'claude' (CLI lokal)
  // tidak butuh key di sini -> login-nya terpisah lewat `claude login`.
  apiKeys: {
    'claude-api': null,
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
    const fallback = provider === 'claude-api'
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
      'claude-api': Boolean(getApiKey('claude-api')),
      chatgpt: Boolean(getApiKey('chatgpt')),
    },

    keyEncrypted: canEncrypt(),
  }
}

module.exports = {
  readSettings,
  writeSettings,
  setApiKey,
  getApiKey,
  publicSettings,
}
