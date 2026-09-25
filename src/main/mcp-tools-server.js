#!/usr/bin/env node
// Server MCP lokal (proses terpisah, dijalankan lewat stdio oleh CLI Claude
// sendiri lewat --mcp-config) yang memberi pet beberapa aksi nyata di Mac
// ini: cari & buka aplikasi, kontrol Spotify desktop, bikin acara Calendar &
// reminder di Reminders, ringkas agenda hari ini, dan catat fakta jangka
// panjang. Aksi macOS-nya sendiri (AppleScript/mdfind) ada di mac-actions.js,
// dipakai bersama jendela aksi cepat di menu bar -- modul ini cuma
// mendaftarkannya sebagai tool MCP bersama skema zod-nya.
const path = require('node:path')
const { z } = require('zod')
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')

const mac = require('./mac-actions')
const selfImprovement = require('./self-improvement')

// Folder workspace pet (lihat claude-cli.js: buildMcpConfig mengirim ini
// lewat env server MCP), dipakai remember_fact buat tahu ke mana harus
// nulis. Tool lain di sini tidak butuh ini -- semuanya aksi tingkat OS.
const WORKSPACE_DIR = process.env.JINSHI_WORKSPACE_DIR

function text(value) {
  return { content: [{ type: 'text', text: String(value) }] }
}

const server = new McpServer({ name: 'jinshi-tools', version: '1.0.0' })

server.registerTool('search_app', {
  title: 'Cari & buka aplikasi',

  description: [
    'Cari aplikasi macOS yang terpasang berdasarkan nama (pakai Spotlight),',
    'lalu buka kalau cocok persis satu. Kalau cocok lebih dari satu, daftar',
    'namanya dikembalikan tanpa dibuka -- minta pengguna memperjelas.',
  ].join(' '),

  inputSchema: {
    query: z.string().describe('Nama atau sebagian nama aplikasi yang dicari'),
    open: z.boolean().optional().describe('Buka aplikasinya kalau ketemu persis satu (default true)'),
  },
}, async ({ query, open }) => {
  const result = await mac.searchApp({ query, open })

  if (result.status === 'none') {
    return text(`Tidak ada aplikasi yang cocok dengan "${query}".`)
  }

  if (result.status === 'opened') {
    return text(`Aplikasi "${result.opened}" dibuka.`)
  }

  return text(`Ditemukan: ${result.matches.join(', ')}. Sebutkan nama persis kalau mau dibuka.`)
})

server.registerTool('spotify_control', {
  title: 'Kontrol Spotify',

  description: [
    'Kontrol aplikasi Spotify desktop yang sedang jalan di Mac ini:',
    'play/pause/skip lagu, atur volume, atau lihat lagu yang sedang diputar.',
    'Butuh aplikasi Spotify desktop terbuka (bukan versi web).',
  ].join(' '),

  inputSchema: {
    action: z.enum(['play', 'pause', 'next', 'previous', 'now_playing', 'volume']),
    volume: z.number().min(0).max(100).optional().describe('0-100, wajib diisi kalau action=volume'),
  },
}, async ({ action, volume }) => {
  if (action === 'volume' && volume === undefined) {
    return text('Sebutkan angka volume (0-100) dulu.')
  }

  try {
    return text(await mac.spotifyControl({ action, volume }))
  }
  catch (error) {
    return text(`Spotify tidak merespons (${error.message}). Pastikan aplikasi Spotify desktop terbuka.`)
  }
})

server.registerTool('list_calendars', {
  title: 'Daftar kalender',
  description: 'Lihat nama-nama kalender yang ada di Calendar.app, buat tahu nama persis sebelum bikin acara.',
  inputSchema: {},
}, async () => {
  const names = await mac.listCalendars()

  return text(names.join(', '))
})

server.registerTool('create_calendar_event', {
  title: 'Buat acara kalender',

  description: [
    'Buat acara baru di macOS Calendar.app pada tanggal & jam tertentu.',
    'Kalau nama kalender tidak disebutkan pengguna, tidak usah isi calendarName',
    '-- otomatis masuk ke kalender pertama/utama.',
  ].join(' '),

  inputSchema: {
    title: z.string().describe('Judul acara'),
    date: z.string().describe('Tanggal acara, format YYYY-MM-DD'),
    startTime: z.string().describe('Jam mulai, format HH:MM (24 jam)'),
    durationMinutes: z.number().optional().describe('Lama acara dalam menit, default 60'),
    calendarName: z.string().optional().describe('Nama kalender tujuan persis (lihat list_calendars), default kalender pertama'),
  },
}, async ({ title, date, startTime, durationMinutes, calendarName }) => {
  const result = await mac.createCalendarEvent({ title, date, startTime, durationMinutes, calendarName })

  return text(`Acara "${result.title}" dibuat pada ${result.date} jam ${result.startTime}.`)
})

server.registerTool('list_reminder_lists', {
  title: 'Daftar list reminder',
  description: 'Lihat nama-nama daftar yang ada di Reminders.app, buat tahu nama persis sebelum bikin reminder.',
  inputSchema: {},
}, async () => {
  const names = await mac.listReminderLists()

  return text(names.join(', '))
})

server.registerTool('create_reminder', {
  title: 'Buat reminder',

  description: [
    'Buat item baru di macOS Reminders.app, boleh dengan tanggal & jam,',
    'boleh tanpa (jadi to-do tanpa due date).',
  ].join(' '),

  inputSchema: {
    title: z.string().describe('Judul reminder'),
    date: z.string().optional().describe('Tanggal due, format YYYY-MM-DD (opsional)'),
    time: z.string().optional().describe('Jam due, format HH:MM 24 jam (opsional, dipakai kalau date diisi)'),
    listName: z.string().optional().describe('Nama daftar tujuan persis (lihat list_reminder_lists), default daftar utama'),
    notes: z.string().optional().describe('Catatan tambahan (opsional)'),
  },
}, async ({ title, date, time, listName, notes }) => {
  const result = await mac.createReminder({ title, date, time, listName, notes })

  return text(
    result.date
      ? `Reminder "${result.title}" dibuat untuk ${result.date} jam ${result.time}.`
      : `Reminder "${result.title}" dibuat tanpa tanggal.`,
  )
})

server.registerTool('list_today_agenda', {
  title: 'Agenda hari ini',

  description: [
    'Ringkasan gabungan acara Calendar & reminder yang due hari ini, dari',
    'semua kalender/daftar sekaligus. Cocok buat "briefing" pagi atau kalau',
    'pengguna nanya apa saja agendanya hari ini.',
  ].join(' '),

  inputSchema: {},
}, async () => {
  return text(await mac.listTodayAgenda())
})

server.registerTool('remember_fact', {
  title: 'Ingat fakta',

  description: [
    'Simpan satu fakta/catatan penting soal pengguna secara permanen',
    '(preferensi, proyek yang sedang dikerjakan, tanggal penting, lelucon',
    'berulang, dll) supaya diingat di obrolan-obrolan berikutnya. Dipanggil',
    'kapan saja hal semacam itu muncul di obrolan, tidak usah nunggu',
    'pengguna eksplisit bilang "ingat ini ya".',
    'Set trigger ke "manual" HANYA kalau pengguna secara eksplisit minta',
    'diingat atau memberi aturan/preferensi tegas (mis. "selalu...",',
    '"jangan pernah...", "panggil aku...", "ingat ya..."). Untuk semua kasus',
    'lain -- termasuk kalau kamu sendiri yang berinisiatif mencatat sesuatu',
    'tanpa diminta -- pakai "auto" (atau kosongkan, itu default-nya).',
  ].join(' '),

  inputSchema: {
    note: z.string().describe('Fakta yang mau diingat, satu kalimat singkat & jelas'),
    trigger: z.enum(['auto', 'manual']).optional().describe(
      '"manual" kalau pengguna eksplisit minta diingat/memberi aturan tegas, "auto" (default) untuk selain itu',
    ),
  },
}, async ({ note, trigger }) => {
  if (!WORKSPACE_DIR) {
    return text('Gagal mencatat: folder workspace pet tidak diketahui.')
  }

  const memoryDir = path.join(WORKSPACE_DIR, 'memory')

  const entry = selfImprovement.addEntry(memoryDir, {
    type: trigger === 'manual' ? 'manual' : 'auto',
    text: note.trim(),
  })

  return text(`Dicatat: "${entry.text}"`)
})

const transport = new StdioServerTransport()

server.connect(transport).catch(error => {
  console.error('Gagal menjalankan server MCP jinshi-tools:', error)
  process.exit(1)
})
