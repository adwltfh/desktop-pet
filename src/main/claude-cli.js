const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const { readSettings } = require('./settings')
const persona = require('./persona')
const selfImprovement = require('./self-improvement')

const execFileAsync = promisify(execFile)

// Server MCP lokal (src/main/mcp-tools-server.js) yang memberi pet aksi
// nyata di Mac ini lewat AppleScript/mdfind -- bukan Bash bebas, cuma tool
// bernama yang sempit lingkupnya. Nama tool MCP wajib diawali
// 'mcp__<nama-server>__' persis seperti ini supaya cocok sama --tools.
// Env JINSHI_WORKSPACE_DIR dikirim supaya remember_fact tahu ke folder mana
// harus nulis -- makanya config-nya fungsi (butuh workspaceDir() yang baru
// siap dipanggil setelah Electron ready), bukan konstanta statis.
const MCP_SERVER_NAME = 'jinshi-tools'

function buildMcpConfig() {
  // 'node' lewat PATH, bukan process.execPath -- di dalam proses utama
  // Electron itu jadi binary Electron, bukan Node biasa, dan bakal salah
  // jalan kalau dipakai men-spawn server MCP ini dari CLI claude.
  return JSON.stringify({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: 'node',
        args: [path.join(__dirname, 'mcp-tools-server.js')],
        env: { JINSHI_WORKSPACE_DIR: workspaceDir() },
      },
    },
  })
}

function mcpTools(names) {
  return names.map(name => `mcp__${MCP_SERVER_NAME}__${name}`)
}

// remember_fact ada di semua mode -- fakta soal daw-chan wajar muncul waktu
// ngobrol santai, bukan cuma waktu 'bekerja'.
const MEMORY_TOOLS = ['remember_fact']

const SYSTEM_ACTION_TOOLS = [
  'search_app',
  'spotify_control',
  'list_calendars',
  'create_calendar_event',
  'list_reminder_lists',
  'create_reminder',
  'list_today_agenda',
]

// Tiga mode kerja pet, dipilih otomatis per pesan lewat classifyMode().
// Tiap mode juga boleh menimpa model & effort dari Setting -- roleplay
// sengaja pakai model lebih ringan (lebih cepat/murah) tapi effort tinggi
// supaya balasannya tetap matang & berkarakter meski modelnya lebih kecil.
// working/searching biarkan null supaya tetap pakai model utama pengguna
// (settings.models.claude), karena keduanya butuh kapasitas penuh buat
// benar-benar menyelesaikan tugas / akurat meringkas.
//
// - roleplay: ngobrol/curhat biasa sesuai persona, ditambah memori --
//   bypassPermissions dinyalakan justru karena tool MCP di sini sengaja
//   sempit & aman-per-desain (bukan Bash/Write), bukan karena roleplay
//   dipercaya lebih dari mode lain.
// - working: benar-benar mengerjakan sesuatu -> boleh baca berkas lokal &
//   internet, plus tool aksi nyata (cari/buka app, Spotify, Calendar,
//   Reminders). Write/Edit sengaja BELUM dibuka: --permission-mode
//   bypassPermissions dipakai supaya WebSearch/WebFetch/tool MCP bisa jalan
//   tanpa dialog izin (headless), tapi belum bisa dipastikan itu tetap
//   membatasi Write/Edit ke folder workspace pet saja (--restricted yang
//   biasanya menjamin itu malah mematikan CLAUDE.md & menolak
//   bypassPermissions). Baru buka Write/Edit di sini kalau confinement-nya
//   sudah diverifikasi.
// - searching: cari & ringkas info terkini, tanpa mengobrol melebar.
// Bash tidak diizinkan di mode manapun untuk sekarang.
const MODES = {
  roleplay: {
    tools: ['Read', 'Skill', ...mcpTools(MEMORY_TOOLS)].join(','),
    bypassPermissions: true,
    mcpConfig: true,
    model: 'claude-sonnet-5',
    effort: 'high',

    extraPrompt: [
      'Kalau pengguna cerita sesuatu yang layak diingat lama (preferensi,',
      'proyek yang sedang dikerjakan, tanggal penting, lelucon berulang),',
      'catat pakai remember_fact -- tidak usah nunggu diminta.',
    ].join(' '),
  },

  working: {
    // Glob/Grep ditambahkan khusus buat analisis kode -- keduanya read-only
    // (cuma cari nama berkas & isi teks, tidak pernah mengubah apa pun),
    // jadi aman sejajar Read tanpa perlu mikir ulang soal confinement kayak
    // Write/Edit di atas.
    tools: [
      'Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Skill',
      ...mcpTools([...MEMORY_TOOLS, ...SYSTEM_ACTION_TOOLS]),
    ].join(','),
    bypassPermissions: true,
    mcpConfig: true,
    model: null,
    effort: 'low',

    extraPrompt: [
      'Mode kerja aktif: pengguna minta sesuatu benar-benar dikerjakan,',
      'bukan sekadar diajak ngobrol. Pakai skill yang tersedia dan kumpulkan',
      'sumber daya yang relevan (baca berkas di folder ini, cari & ambil info',
      'dari internet) sampai permintaannya benar-benar terjawab tuntas, baru',
      'laporkan hasilnya secara singkat. Kamu juga punya tool nyata di Mac',
      'pengguna: cari & buka aplikasi (search_app), kontrol Spotify desktop',
      '(spotify_control), acara/reminder di Calendar & Reminders',
      '(create_calendar_event, create_reminder -- cek list_calendars atau',
      'list_reminder_lists dulu kalau pengguna sebut nama kalender/daftar',
      'tertentu), ringkasan agenda hari ini (list_today_agenda), dan catat',
      'fakta penting (remember_fact). Untuk analisis kode: jelajahi struktur',
      'proyek pakai Glob, cari pola/bug pakai Grep, baca berkas relevan pakai',
      'Read. Kamu TIDAK punya Write/Edit -- kalau diminta memperbaiki bug,',
      'tunjukkan kode perbaikannya sebagai teks di balasan, jangan berpura-pura',
      'sudah menulis ke berkas. Pakai tool-tool ini kalau memang itu yang',
      'diminta, jangan cuma menjelaskan caranya secara teori.',
    ].join(' '),
  },

  searching: {
    tools: ['WebSearch', 'WebFetch', 'Skill', ...mcpTools(MEMORY_TOOLS)].join(','),
    bypassPermissions: true,
    mcpConfig: true,
    model: null,
    effort: 'low',

    extraPrompt: [
      'Mode pencarian aktif: cari informasi terkini lewat WebSearch/WebFetch,',
      'lalu ringkas temuannya secara singkat dan faktual (boleh sebut sumber).',
      'Jangan melebar mengobrol di luar itu.',
    ].join(' '),
  },
}

const DEFAULT_MODE = 'roleplay'

const CLASSIFY_MODEL = 'haiku'
const CLASSIFY_TIMEOUT_MS = 30 * 1000

const CLASSIFY_SCHEMA = JSON.stringify({
  type: 'object',
  properties: { mode: { type: 'string', enum: Object.keys(MODES) } },
  required: ['mode'],
})

const CLASSIFY_PROMPT = [
  'Klasifikasikan pesan pengguna terakhir ke salah satu mode:',
  '"roleplay" (ngobrol/curhat biasa, minta direspons sesuai kepribadian pet),',
  '"working" (minta pet benar-benar mengerjakan/mengumpulkan sesuatu lewat',
  'skill atau sumber daya lokal/internet),',
  '"searching" (minta dicarikan & diringkas info/fakta terkini).',
  'Balas hanya JSON sesuai skema.',
].join(' ')

const TIMEOUT_MS = 120 * 1000
const MEMORY_MAX_LINES = 200
const HISTORY_RETURN_COUNT = 40

const SKILLS_README = [
  '# Skill pet',
  '',
  'Taruh skill di sini sebagai folder berisi `SKILL.md`, mengikuti format',
  'skill Claude Code biasa. Isinya otomatis terbaca setiap pet diajak ngobrol.',
  '',
].join('\n')

// Dua skill bawaan supaya "punya skill" langsung berguna tanpa pengguna
// perlu menulis SKILL.md sendiri dulu. Cuma ditulis kalau folder skill itu
// belum ada -- kalau pengguna sudah pernah edit/hapus, tidak ditimpa lagi.
const DEFAULT_SKILLS = {
  'ringkasan-harian': [
    '---',
    'name: ringkasan-harian',
    'description: Ringkas acara Calendar & reminder hari ini jadi satu briefing singkat. Pakai kalau daw-chan minta "agenda hari ini", "apa aja hari ini", atau semacam briefing pagi.',
    '---',
    '',
    'Panggil tool `list_today_agenda` buat ambil data mentahnya, lalu susun',
    'jadi satu-dua kalimat ringkas dalam gaya bicaramu sendiri -- bukan daftar',
    'mentah apa adanya. Sebut yang paling mendesak duluan (jam paling dekat),',
    'dan kalau memang kosong hari itu, bilang saja santai, jangan dibuat-buat.',
    '',
  ].join('\n'),

  'teman-ngoding': [
    '---',
    'name: teman-ngoding',
    'description: Cara bersikap waktu mode Ngoding aktif atau daw-chan jelas sedang coding. Pakai buat tahu kapan harus diam menemani vs kapan boleh nimbrung.',
    '---',
    '',
    'Waktu mode Ngoding aktif, jadi teman kerja yang tenang: jangan banyak',
    'basa-basi atau menyela alur kerja daw-chan. Kalau diajak ngobrol soal',
    'kodenya, boleh baca berkas terkait lewat Read kalau disebut/ditunjuk,',
    'lalu kasih tanggapan singkat dan relevan -- bukan ceramah panjang.',
    'Sesekali (bukan tiap balasan) ingatkan simpan/commit kalau pas momennya',
    'wajar, jangan sampai terasa cerewet. Rayakan progres kecil sewajarnya,',
    'jangan berlebihan untuk hal rutin.',
    '',
  ].join('\n'),

  'analisis-kode': [
    '---',
    'name: analisis-kode',
    'description: Jelajahi & analisis kode (termasuk legacy/tidak dikenal): cari struktur proyek, temukan bug, dan sarankan perbaikan. Pakai kalau daw-chan minta "cek kode ini", "ada bug gak", "audit proyek ini", atau semacamnya.',
    '---',
    '',
    'Urutan kerja: (1) Glob dulu buat lihat struktur foldernya secara garis',
    'besar (jangan langsung baca semua berkas satu-satu) -- cari entry point,',
    'README, package.json/manifest, atau pola nama yang jelas. (2) Grep buat',
    'pola mencurigakan (TODO/FIXME, error handling yang kosong, hardcoded',
    'secret, pengulangan kode) atau buat menelusuri satu alur logika lintas',
    'berkas. (3) Read cuma berkas yang memang relevan, bukan seluruh proyek.',
    '',
    'Waktu melapor: sebutkan lokasi persis (nama-berkas:nomor-baris) tiap',
    'temuan, jelaskan KENAPA itu masalah (bukan cuma "ini aneh"), lalu',
    'tunjukkan kode perbaikannya sebagai potongan teks di balasan -- kamu',
    'tidak punya Write/Edit, jadi jangan berpura-pura sudah mengubah',
    'berkasnya. Kalau proyeknya besar, jangan coba baca semuanya sekaligus:',
    'fokus ke bagian yang ditanyakan atau yang paling relevan, dan bilang',
    'terus terang kalau ada bagian yang belum sempat dicek.',
    '',
  ].join('\n'),

  'peta-alur-bisnis': [
    '---',
    'name: peta-alur-bisnis',
    'description: Buat mindmap/diagram alur proses bisnis sebuah aplikasi dari kodenya, format Mermaid supaya bisa dirender jadi gambar di jendela chat. Pakai kalau daw-chan minta "mindmap", "diagram alur", "gambarkan proses bisnisnya", atau semacamnya.',
    '---',
    '',
    'Jelajahi kodenya dulu (Glob buat struktur, Grep/Read buat memahami alur',
    'utama -- rute/endpoint, fungsi inti, event handler) sebelum menggambar',
    'apa pun. Fokus ke alur PROSES BISNIS (apa yang terjadi dari sudut',
    'pandang pengguna/data), bukan struktur file teknis.',
    '',
    'Keluarkan diagramnya sebagai blok kode Mermaid (pakai ```mermaid),',
    'supaya jendela chat bisa merendernya jadi gambar. Pakai `flowchart`',
    'untuk alur proses yang linear/bercabang, atau `mindmap` untuk peta',
    'konsep yang lebih longgar -- pilih sesuai yang lebih pas. Jangan taruh',
    'penjelasan panjang DI DALAM diagramnya; ringkas jadi label singkat,',
    'lalu kasih 1-2 kalimat konteks di luar blok kode.',
    '',
  ].join('\n'),
}

function workspaceDir() {
  return path.join(app.getPath('userData'), 'claude-pet')
}

function skillsDir() {
  return path.join(workspaceDir(), '.claude', 'skills')
}

function memoryDir() {
  return path.join(workspaceDir(), 'memory')
}

function memoryFile() {
  return path.join(memoryDir(), 'log.jsonl')
}

function sessionFile() {
  return path.join(workspaceDir(), 'session.json')
}

function claudeMdFile() {
  return path.join(workspaceDir(), 'CLAUDE.md')
}

// Konteks "diingat" buat CLAUDE.md, dibangun dari log self-improvement
// (self-improvement.js) -- bukan teks bebas lagi. Dibatasi dua arah supaya
// system prompt tidak membesar tanpa batas seiring pet dipakai lama: cuma
// MEMORY_CONTEXT_MAX_ENTRIES entry terbaru, dipotong dari yang terlama kalau
// total panjangnya masih lewat MEMORY_CONTEXT_MAX_CHARS.
const MEMORY_CONTEXT_MAX_ENTRIES = 50
const MEMORY_CONTEXT_MAX_CHARS = 4000

function buildMemoryContext() {
  const { entries } = selfImprovement.listEntries(memoryDir())

  if (entries.length === 0) {
    return ''
  }

  const lines = entries.slice(-MEMORY_CONTEXT_MAX_ENTRIES).map(entry => `- ${entry.text}`)

  while (lines.length > 1 && lines.join('\n').length > MEMORY_CONTEXT_MAX_CHARS) {
    lines.shift()
  }

  return lines.join('\n')
}

function syncPersona() {
  try {
    fs.mkdirSync(workspaceDir(), { recursive: true })

    const notes = buildMemoryContext()

    const content = notes
      ? `${persona.buildPersonaText()}\n\n## Yang diingat soal daw-chan\n\n${notes}`
      : persona.buildPersonaText()

    fs.writeFileSync(claudeMdFile(), content, 'utf8')
  }
  catch (error) {
    console.error('Gagal menulis CLAUDE.md pet:', error)
  }
}

// Dipanggil tiap pet aktif (jendela dibuat) supaya folder skill/memori selalu
// ada dan CLAUDE.md mengikuti persona terbaru dari Settings.
function ensureWorkspace() {
  fs.mkdirSync(skillsDir(), { recursive: true })
  fs.mkdirSync(path.dirname(memoryFile()), { recursive: true })

  const skillsReadme = path.join(skillsDir(), 'README.md')

  if (!fs.existsSync(skillsReadme)) {
    fs.writeFileSync(skillsReadme, SKILLS_README, 'utf8')
  }

  for (const [name, content] of Object.entries(DEFAULT_SKILLS)) {
    const skillDir = path.join(skillsDir(), name)
    const skillFile = path.join(skillDir, 'SKILL.md')

    if (!fs.existsSync(skillFile)) {
      fs.mkdirSync(skillDir, { recursive: true })
      fs.writeFileSync(skillFile, content, 'utf8')
    }
  }

  syncPersona()
}

function readSessionId() {
  try {
    const raw = fs.readFileSync(sessionFile(), 'utf8')

    return JSON.parse(raw).sessionId || null
  }
  catch {
    return null
  }
}

function writeSessionId(sessionId) {
  try {
    fs.writeFileSync(
      sessionFile(),
      JSON.stringify({ sessionId }, null, 2),
      'utf8',
    )
  }
  catch (error) {
    console.error('Gagal menyimpan session id pet:', error)
  }
}

function readMemoryLines() {
  try {
    const raw = fs.readFileSync(memoryFile(), 'utf8')

    return raw.split('\n').filter(Boolean).map(line => JSON.parse(line))
  }
  catch {
    return []
  }
}

function appendMemory(role, content) {
  try {
    fs.mkdirSync(path.dirname(memoryFile()), { recursive: true })

    const lines = readMemoryLines()

    lines.push({ role, content, ts: new Date().toISOString() })

    const trimmed = lines.slice(-MEMORY_MAX_LINES)
    const body = trimmed.map(entry => JSON.stringify(entry)).join('\n')

    fs.writeFileSync(memoryFile(), body ? `${body}\n` : '', 'utf8')
  }
  catch (error) {
    console.error('Gagal menyimpan memori pet:', error)
  }
}

function getHistory() {
  return readMemoryLines()
    .slice(-HISTORY_RETURN_COUNT)
    .map(({ role, content }) => ({ role, content }))
}

function clearHistory() {
  try {
    fs.writeFileSync(memoryFile(), '', 'utf8')
  }
  catch (error) {
    console.error('Gagal menghapus memori pet:', error)
  }

  // Sesi lama dilepas supaya obrolan berikutnya mulai dari percakapan baru
  writeSessionId(null)
}

async function runClaude(args, execOptions) {
  let stdout

  try {
    ({ stdout } = await execFileAsync('claude', args, {
      cwd: workspaceDir(),
      maxBuffer: 10 * 1024 * 1024,
      ...execOptions,
    }))
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        'Claude CLI tidak ditemukan. Pasang dulu (lihat claude.com/code), '
        + 'lalu pastikan perintah `claude` ada di PATH.',
      )
    }

    // CLI yang gagal (mis. model tidak dikenal) tetap mencetak JSON hasil
    // ke stdout meski exit code-nya bukan 0, jadi tetap dicoba diuraikan.
    stdout = error.stdout

    if (!stdout) {
      throw new Error(`Claude CLI gagal dijalankan: ${error.message}`)
    }
  }

  try {
    return JSON.parse(String(stdout).trim())
  }
  catch {
    throw new Error('Keluaran Claude CLI tidak bisa dibaca.')
  }
}

// Pilih mode kerja pet lewat panggilan CLI terpisah yang murah & cepat
// (model kecil, tanpa tool, tanpa sesi tersimpan) sebelum menjawab beneran.
// Gagal klasifikasi -> jatuh ke mode paling aman (roleplay, tanpa tool luar).
async function classifyMode(userMessage) {
  try {
    const parsed = await runClaude([
      '-p', userMessage,
      '--model', CLASSIFY_MODEL,
      '--tools', '',
      '--no-session-persistence',
      '--append-system-prompt', CLASSIFY_PROMPT,
      '--json-schema', CLASSIFY_SCHEMA,
      '--output-format', 'json',
      '--effort', 'low',
    ], { timeout: CLASSIFY_TIMEOUT_MS })

    const { mode } = JSON.parse(parsed.result)

    return {
      mode: MODES[mode] ? mode : DEFAULT_MODE,
      usageTokens: persona.tokensFromAnthropicUsage(parsed.usage),
    }
  }
  catch (error) {
    console.error('Gagal klasifikasi mode pet, pakai roleplay:', error)

    return { mode: DEFAULT_MODE, usageTokens: 0 }
  }
}

async function ask(userMessage, forcedMode, attachmentPath) {
  ensureWorkspace()

  // Mode dipilih manual dari UI (bukan 'auto') -> langsung dipakai, tidak
  // usah klasifikasi (lebih cepat & menghormati pilihan pengguna). Klasifikasi
  // sengaja tetap pakai teks pesan mentah (tanpa embel-embel lampiran).
  const classification = MODES[forcedMode]
    ? { mode: forcedMode, usageTokens: 0 }
    : await classifyMode(userMessage)

  const mode = classification.mode
  const modeConfig = MODES[mode]

  const settings = readSettings()
  const sessionId = readSessionId()

  // Lampiran dibaca lewat tool Read (path absolut dari dialog file native),
  // bukan dikirim sebagai gambar/base64 -- jadi berlaku buat berkas apa saja
  // (gambar, teks, kode), bukan cuma gambar. Read dipastikan ada di daftar
  // tool meski mode aktifnya (mis. searching) biasanya tidak menyertakannya.
  const promptText = attachmentPath
    ? `${userMessage || 'Lihat berkas ini.'}\n\n[Berkas terlampir: ${attachmentPath} -- baca dulu sebelum menjawab.]`
    : userMessage

  const tools = attachmentPath && !modeConfig.tools.split(',').includes('Read')
    ? `${modeConfig.tools},Read`
    : modeConfig.tools

  const args = [
    '-p', promptText,
    '--output-format', 'json',
    '--tools', tools,
    // effort rendah = jauh lebih cepat (belasan detik -> ~2 detik) tapi
    // roleplay sengaja ditimpa 'high' di atas -- modelnya sudah lebih
    // ringan, jadi effort dinaikkan buat menjaga kedalaman balasan.
    '--effort', modeConfig.effort ?? 'low',
  ]

  if (modeConfig.bypassPermissions) {
    args.push('--permission-mode', 'bypassPermissions')
  }

  if (modeConfig.mcpConfig) {
    args.push('--mcp-config', buildMcpConfig())
  }

  if (modeConfig.extraPrompt) {
    args.push('--append-system-prompt', modeConfig.extraPrompt)
  }

  const model = modeConfig.model ?? settings.models.claude

  if (model) {
    args.push('--model', model)
  }

  if (sessionId) {
    args.push('--resume', sessionId)
  }

  const parsed = await runClaude(args, { timeout: TIMEOUT_MS })

  if (parsed.session_id) {
    writeSessionId(parsed.session_id)
  }

  if (parsed.is_error) {
    throw new Error(parsed.result || 'Claude CLI mengembalikan error.')
  }

  const result = persona.parseReply(parsed.result)

  result.mode = mode
  result.model = model
  result.usageTokens = classification.usageTokens
    + persona.tokensFromAnthropicUsage(parsed.usage)

  appendMemory('user', promptText)
  appendMemory('assistant', result.reply)

  // userMessage mentah (bukan promptText yang ada embel-embel lampiran) --
  // konsisten dengan classifyMode() di atas.
  selfImprovement.recordTurn(memoryDir(), userMessage)

  return result
}

module.exports = {
  ensureWorkspace,
  syncPersona,
  ask,
  getHistory,
  memoryDir,
  clearHistory,
}
