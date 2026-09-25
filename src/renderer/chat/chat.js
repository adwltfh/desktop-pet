const messagesElement = document.querySelector('#messages')
const composer = document.querySelector('#composer')
const input = document.querySelector('#input')
const sendButton = document.querySelector('#send-button')

const settingsPanel = document.querySelector('#settings-panel')
const settingsButton = document.querySelector('#settings-button')
const clearButton = document.querySelector('#clear-button')
const saveSettingsButton = document.querySelector('#save-settings')

const memoryPanel = document.querySelector('#memory-panel')
const memoryLogButton = document.querySelector('#memory-log-button')
const memoryCounter = document.querySelector('#memory-counter')
const memoryTabs = [...document.querySelectorAll('.memory-tabs__tab')]
const memoryList = document.querySelector('#memory-list')

const providerSelect = document.querySelector('#provider-select')
const modelInput = document.querySelector('#model-input')
const keyField = document.querySelector('#key-field')
const keyInput = document.querySelector('#key-input')
const personaInput = document.querySelector('#persona-input')
const settingsHint = document.querySelector('#settings-hint')

const walkSpeedInput = document.querySelector('#walk-speed-input')
const walkSpeedOutput = document.querySelector('#walk-speed-output')
const runSpeedInput = document.querySelector('#run-speed-input')
const runSpeedOutput = document.querySelector('#run-speed-output')
const spriteScaleInput = document.querySelector('#sprite-scale-input')
const spriteScaleOutput = document.querySelector('#sprite-scale-output')

const petNameElement = document.querySelector('#pet-name')
const providerLabel = document.querySelector('#provider-label')
const affectionLabel = document.querySelector('#affection-label')
const usageLabel = document.querySelector('#usage-label')

const modeBar = document.querySelector('#mode-bar')
const modeSelect = document.querySelector('#mode-select')
const modeHint = document.querySelector('#mode-hint')
const modeButtons = [...document.querySelectorAll('[data-mode]')]

const attachmentButton = document.querySelector('#attachment-button')
const attachmentChip = document.querySelector('#attachment-chip')
const attachmentChipName = document.querySelector('#attachment-chip-name')
const attachmentRemoveButton = document.querySelector('#attachment-remove')

const providerNames = {
  claude: 'Claude (CLI)',
  'claude-api': 'Claude (API)',
  chatgpt: 'ChatGPT',
}

// Mode cuma berlaku buat provider 'claude' (CLI lokal) -- claude-api &
// chatgpt tidak punya akses skill/tool, jadi mode-bar disembunyikan.
const modeHints = {
  auto: 'Jinshi menyesuaikan nada pesanmu.',
  roleplay: 'Jinshi menemanimu mengobrol.',
  working: 'Jinshi membantu pekerjaanmu.',
  searching: 'Jinshi mencari info terkini.',
}

let settings = null
let sending = false
let pendingAttachment = null

let memoryEntries = []
let memoryTotalTurns = 0
let memoryFilter = 'all'

const memoryTypeLabels = { auto: 'Auto', manual: 'Manual', habit: 'Kebiasaan' }

const memoryTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})

function basename(filePath) {
  return filePath.split(/[/\\]/).pop()
}

function setAttachment(filePath) {
  pendingAttachment = filePath

  attachmentButton.classList.toggle('has-file', Boolean(filePath))
  attachmentChip.hidden = !filePath
  attachmentChipName.textContent = filePath ? basename(filePath) : ''
}

function renderEmpty() {
  messagesElement.replaceChildren()

  const hint = document.createElement('p')

  hint.className = 'messages__empty'
  hint.textContent = 'Paviliunmu masih sunyi. Sapa Jinshi untuk memulai obrolan.'

  messagesElement.append(hint)
}

function clearEmptyHint() {
  const hint = messagesElement.querySelector('.messages__empty')

  if (hint) {
    hint.remove()
  }
}

// mermaid.min.js divendor lokal (bukan CDN, CSP-nya 'self' saja) dan
// dimuat MALAS -- cuma disuntik sekali, waktu balasan pertama yang
// benar-benar berisi ```mermaid muncul, bukan tiap jendela chat dibuka.
// Berkasnya ~5.5MB, jadi sayang kalau ikut kepanggil buat obrolan biasa.
let mermaidLoadPromise = null
let mermaidRenderCounter = 0

function loadMermaid() {
  if (mermaidLoadPromise) {
    return mermaidLoadPromise
  }

  mermaidLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')

    script.src = './vendor/mermaid.min.js'

    script.onload = () => {
      // securityLevel 'strict' -> label di diagram disanitasi (DOMPurify
      // internal mermaid) sebelum jadi SVG, aman buat langsung disisipkan.
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default',
      })

      resolve(window.mermaid)
    }

    script.onerror = () => reject(new Error('Gagal memuat mermaid.min.js'))

    document.head.append(script)
  })

  return mermaidLoadPromise
}

const MERMAID_BLOCK_RE = /```mermaid\n([\s\S]*?)```/g

function splitMermaidBlocks(text) {
  const segments = []
  let lastIndex = 0

  for (const match of text.matchAll(MERMAID_BLOCK_RE)) {
    const [full, code] = match

    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }

    segments.push({ type: 'mermaid', content: code.trim() })
    lastIndex = match.index + full.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return segments
}

async function renderMermaidInto(container, code) {
  try {
    const mermaid = await loadMermaid()
    const id = `mermaid-diagram-${++mermaidRenderCounter}`
    const { svg } = await mermaid.render(id, code)

    container.innerHTML = svg
  }
  catch (error) {
    console.error('Gagal merender diagram mermaid:', error)

    // Sintaksnya mungkin tidak valid -- kodenya tetap ditampilkan apa
    // adanya daripada balasan jadi kosong/rusak.
    container.textContent = code
    container.classList.add('message__diagram--fallback')
  }
}

function appendMessage(role, text, options = {}) {
  clearEmptyHint()

  const element = document.createElement('div')
  const content = document.createElement('div')
  const bubble = document.createElement('div')

  element.className = `message-row message-row--${role}`
  content.className = 'message__content'
  bubble.className = `message message--${role}`

  if (options.pending) {
    bubble.classList.add('message--pending')
  }

  const segments = splitMermaidBlocks(text)

  if (segments.length === 1 && segments[0].type === 'text') {
    bubble.textContent = text
  }
  else {
    for (const segment of segments) {
      if (segment.type === 'text') {
        if (!segment.content.trim()) {
          continue
        }

        const span = document.createElement('span')

        span.textContent = segment.content
        bubble.append(span)
      }
      else {
        const diagram = document.createElement('div')

        diagram.className = 'message__diagram'
        diagram.textContent = 'Menggambar diagram...'
        bubble.append(diagram)

        renderMermaidInto(diagram, segment.content)
      }
    }
  }

  if (options.emotion) {
    const emotion = document.createElement('span')

    emotion.className = 'message__emotion'

    emotion.textContent = options.mode
      ? `ekspresi: ${options.emotion} · mode: ${options.mode}`
      : `ekspresi: ${options.emotion}`

    bubble.append(emotion)
  }

  if (role === 'pet') {
    const avatar = document.createElement('span')
    const portrait = document.createElement('img')

    avatar.className = 'message__avatar'
    portrait.src = './assets/jinshi-portrait.jpg'
    portrait.alt = ''
    avatar.append(portrait)
    element.append(avatar)
  }

  content.append(bubble)

  if (options.timestamp) {
    const time = document.createElement('time')
    const now = new Date()

    time.className = 'message__time'
    time.dateTime = now.toISOString()
    time.textContent = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(now)
    content.append(time)
  }

  element.append(content)
  messagesElement.append(element)
  messagesElement.scrollTop = messagesElement.scrollHeight

  return element
}

function hintForProvider(provider) {
  if (provider === 'claude') {
    return [
      'Provider ini jalan lewat Claude CLI lokal, tidak perlu API key di sini.',
      'Pastikan perintah `claude` sudah terpasang & login (jalankan `claude login` di terminal).',
      'Skill, memori, dan persona pet disimpan di folder lokalnya sendiri.',
    ].join(' ')
  }

  const hasKey = settings?.hasKey?.[provider]

  return [
    hasKey
      ? 'API key tersimpan. Kosongkan kolom key kalau tidak mau mengubahnya.'
      : 'API key belum diisi untuk provider ini.',

    settings?.keyEncrypted
      ? 'Key disimpan terenkripsi oleh OS.'
      : 'OS tidak mendukung enkripsi, key disimpan apa adanya di settings.json.',
  ].join(' ')
}

function formatUsage(usage) {
  if (!usage?.model) {
    return ''
  }

  const tokens = usage.totalTokens >= 1000
    ? `${(usage.totalTokens / 1000).toFixed(1)}k`
    : String(usage.totalTokens)

  return `${usage.model} · ${tokens} tok`
}

function renderUsage(usage) {
  usageLabel.textContent = formatUsage(usage)
}

async function loadUsage() {
  renderUsage(await window.chatAPI.usage())
}

function renderAffection(affection) {
  if (!affection) {
    affectionLabel.textContent = ''
    return
  }

  // Jumlah pat sekarang ditampilkan di widget mengambang tersendiri
  // (lihat src/renderer/pat-counter/), bukan di sini lagi.
  affectionLabel.textContent = `♥ ${affection.likes}`
}

async function loadAffection() {
  renderAffection(await window.chatAPI.getAffection())
}

function buildMemoryCard(entry) {
  const card = document.createElement('article')

  card.className = 'memory-entry'
  card.dataset.id = entry.id

  const head = document.createElement('div')

  head.className = 'memory-entry__head'

  const badge = document.createElement('span')

  badge.className = `memory-badge memory-badge--${entry.type}`
  badge.textContent = memoryTypeLabels[entry.type] ?? entry.type
  head.append(badge)

  const time = document.createElement('time')

  time.className = 'memory-entry__time'
  time.dateTime = entry.createdAt
  time.textContent = memoryTimeFormatter.format(new Date(entry.createdAt))
  head.append(time)

  card.append(head)

  const textElement = document.createElement('p')

  textElement.className = 'memory-entry__text'
  textElement.textContent = entry.text
  card.append(textElement)

  if (entry.source) {
    const source = document.createElement('p')

    source.className = 'memory-entry__source'
    source.textContent = entry.source
    card.append(source)
  }

  const undoButton = document.createElement('button')

  undoButton.type = 'button'
  undoButton.className = 'memory-entry__undo'
  undoButton.textContent = 'Urungkan'
  undoButton.addEventListener('click', () => undoMemoryEntry(entry.id))
  card.append(undoButton)

  return card
}

function renderMemoryCounter() {
  memoryCounter.textContent = `${petNameElement.textContent} belajar ${memoryEntries.length} hal dari ${memoryTotalTurns} giliran`
}

function renderMemoryList() {
  const filtered = memoryFilter === 'all'
    ? memoryEntries
    : memoryEntries.filter(entry => entry.type === memoryFilter)

  memoryList.replaceChildren()

  if (filtered.length === 0) {
    const empty = document.createElement('p')

    empty.className = 'memory-list__empty'
    empty.textContent = 'Belum ada catatan di kategori ini.'
    memoryList.append(empty)

    return
  }

  // Terbaru dulu di daftar (entries tersimpan kronologis lama->baru).
  for (const entry of [...filtered].reverse()) {
    memoryList.append(buildMemoryCard(entry))
  }
}

async function loadMemoryLog() {
  const result = await window.chatAPI.getMemoryLog()

  memoryEntries = result.entries
  memoryTotalTurns = result.totalTurns

  renderMemoryCounter()
  renderMemoryList()
}

async function undoMemoryEntry(id) {
  const result = await window.chatAPI.undoMemoryEntry(id)

  memoryEntries = result.entries
  memoryTotalTurns = result.totalTurns

  renderMemoryCounter()
  renderMemoryList()
}

function applySettingsToForm(next) {
  settings = next

  petNameElement.textContent = next.petName
  providerLabel.textContent = providerNames[next.provider] ?? next.provider

  providerSelect.value = next.provider
  modelInput.value = next.models[next.provider] ?? ''
  personaInput.value = next.persona ?? ''
  keyInput.value = ''
  keyField.hidden = next.provider === 'claude'
  modeBar.hidden = next.provider !== 'claude'

  walkSpeedInput.value = next.behavior?.walkSpeed ?? 2
  runSpeedInput.value = next.behavior?.runSpeed ?? 5
  spriteScaleInput.value = next.behavior?.spriteScale ?? 1
  walkSpeedOutput.textContent = walkSpeedInput.value
  runSpeedOutput.textContent = runSpeedInput.value
  spriteScaleOutput.textContent = `${spriteScaleInput.value}x`

  settingsHint.textContent = hintForProvider(next.provider)
}

async function loadSettings() {
  applySettingsToForm(await window.chatAPI.getSettings())
}

async function loadHistory() {
  const history = await window.chatAPI.history()

  if (history.length === 0) {
    renderEmpty()
    return
  }

  messagesElement.replaceChildren()

  for (const entry of history) {
    appendMessage(entry.role === 'user' ? 'user' : 'pet', entry.content)
  }
}

function setSending(value) {
  sending = value

  sendButton.disabled = value
  sendButton.querySelector('span').textContent = value ? 'Mengirim' : 'Kirim'
}

async function send() {
  const text = input.value.trim()
  const attachmentPath = pendingAttachment

  if ((!text && !attachmentPath) || sending) {
    return
  }

  const userBubbleText = attachmentPath
    ? `${text}${text ? '\n' : ''}📎 ${basename(attachmentPath)}`
    : text

  appendMessage('user', userBubbleText, { timestamp: true })

  input.value = ''
  setAttachment(null)
  setSending(true)

  const pending = appendMessage('pet', 'mengetik...', { pending: true })

  try {
    const result = await window.chatAPI.ask(text, modeSelect.value, attachmentPath)

    pending.remove()

    if (result.ok) {
      appendMessage('pet', result.reply, { emotion: result.emotion, mode: result.mode, timestamp: true })
      renderUsage(result.usage)
    }
    else {
      appendMessage('error', result.error)
    }
  }
  catch (error) {
    pending.remove()
    appendMessage('error', String(error?.message ?? error))
  }
  finally {
    setSending(false)
    input.focus()
  }
}

attachmentButton.addEventListener('click', async () => {
  const filePath = await window.chatAPI.pickAttachment()

  if (filePath) {
    setAttachment(filePath)
  }
})

attachmentRemoveButton.addEventListener('click', () => {
  setAttachment(null)
})

// Screenshot/gambar yang ditempel di composer (mis. Cmd+V habis screenshot)
// ditangani sama seperti lampiran dari dialog file -- ditulis ke berkas
// sementara dulu supaya attachmentPath-nya bisa dipakai jalur yang sama.
input.addEventListener('paste', async event => {
  const items = event.clipboardData?.items

  if (!items) {
    return
  }

  const imageItem = [...items].find(item => item.kind === 'file' && item.type.startsWith('image/'))

  if (!imageItem) {
    return
  }

  event.preventDefault()

  const blob = imageItem.getAsFile()
  const buffer = await blob.arrayBuffer()

  try {
    const filePath = await window.chatAPI.saveClipboardImage(buffer, imageItem.type)
    setAttachment(filePath)
  }
  catch (error) {
    console.error('Gagal menyimpan gambar dari clipboard:', error)
  }
})

composer.addEventListener('submit', event => {
  event.preventDefault()
  send()
})

input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    send()
  }
})

function setPanelOpen(panel, button, open) {
  panel.hidden = !open
  button.setAttribute('aria-expanded', String(open))
}

settingsButton.addEventListener('click', () => {
  const opening = settingsPanel.hidden

  if (opening) {
    setPanelOpen(memoryPanel, memoryLogButton, false)
  }

  setPanelOpen(settingsPanel, settingsButton, opening)
})

memoryLogButton.addEventListener('click', () => {
  const opening = memoryPanel.hidden

  if (opening) {
    setPanelOpen(settingsPanel, settingsButton, false)
    loadMemoryLog()
  }

  setPanelOpen(memoryPanel, memoryLogButton, opening)
})

for (const tab of memoryTabs) {
  tab.addEventListener('click', () => {
    memoryFilter = tab.dataset.filter

    for (const t of memoryTabs) {
      const active = t === tab

      t.classList.toggle('is-active', active)
      t.setAttribute('aria-selected', String(active))
    }

    renderMemoryList()
  })
}

providerSelect.addEventListener('change', () => {
  const provider = providerSelect.value

  modelInput.value = settings?.models?.[provider] ?? ''
  keyInput.value = ''
  keyField.hidden = provider === 'claude'
  modeBar.hidden = provider !== 'claude'

  settingsHint.textContent = hintForProvider(provider)
})

modeSelect.addEventListener('change', () => {
  modeHint.textContent = modeHints[modeSelect.value] ?? ''
  for (const button of modeButtons) {
    const active = button.dataset.mode === modeSelect.value
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-pressed', String(active))
  }
})

for (const button of modeButtons) {
  button.addEventListener('click', () => {
    modeSelect.value = button.dataset.mode
    modeSelect.dispatchEvent(new Event('change'))
  })
}

walkSpeedInput.addEventListener('input', () => {
  walkSpeedOutput.textContent = walkSpeedInput.value
})

runSpeedInput.addEventListener('input', () => {
  runSpeedOutput.textContent = runSpeedInput.value
})

spriteScaleInput.addEventListener('input', () => {
  spriteScaleOutput.textContent = `${spriteScaleInput.value}x`
})

saveSettingsButton.addEventListener('click', async () => {
  const provider = providerSelect.value

  if (keyInput.value.trim()) {
    await window.chatAPI.setApiKey(provider, keyInput.value)
  }

  const next = await window.chatAPI.updateSettings({
    provider,
    persona: personaInput.value,
    models: { [provider]: modelInput.value.trim() },

    behavior: {
      walkSpeed: Number(walkSpeedInput.value),
      runSpeed: Number(runSpeedInput.value),
      spriteScale: Number(spriteScaleInput.value),
    },
  })

  applySettingsToForm(next)
  loadUsage()

  settingsPanel.hidden = true
  settingsButton.setAttribute('aria-expanded', 'false')
})

clearButton.addEventListener('click', async () => {
  await window.chatAPI.clear()

  renderEmpty()
})

// Elusan bisa terjadi di jendela pet sementara jendela chat ini tetap
// terbuka, jadi angkanya disegarkan lagi tiap jendela ini difokus.
window.addEventListener('focus', loadAffection)

async function bootstrap() {
  modeHint.textContent = modeHints[modeSelect.value] ?? ''

  await loadSettings()
  await loadHistory()
  await loadUsage()
  await loadAffection()

  input.focus()
}

bootstrap()
