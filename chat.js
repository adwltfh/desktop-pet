const messagesElement = document.querySelector('#messages')
const composer = document.querySelector('#composer')
const input = document.querySelector('#input')
const sendButton = document.querySelector('#send-button')

const settingsPanel = document.querySelector('#settings-panel')
const settingsButton = document.querySelector('#settings-button')
const clearButton = document.querySelector('#clear-button')
const saveSettingsButton = document.querySelector('#save-settings')

const providerSelect = document.querySelector('#provider-select')
const modelInput = document.querySelector('#model-input')
const keyInput = document.querySelector('#key-input')
const personaInput = document.querySelector('#persona-input')
const settingsHint = document.querySelector('#settings-hint')

const petNameElement = document.querySelector('#pet-name')
const providerLabel = document.querySelector('#provider-label')

const providerNames = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
}

let settings = null
let sending = false

function renderEmpty() {
  messagesElement.replaceChildren()

  const hint = document.createElement('p')

  hint.className = 'messages__empty'
  hint.textContent = 'Belum ada obrolan. Sapa pet-mu dulu!'

  messagesElement.append(hint)
}

function clearEmptyHint() {
  const hint = messagesElement.querySelector('.messages__empty')

  if (hint) {
    hint.remove()
  }
}

function appendMessage(role, text, options = {}) {
  clearEmptyHint()

  const element = document.createElement('div')

  element.className = `message message--${role}`

  if (options.pending) {
    element.classList.add('message--pending')
  }

  element.textContent = text

  if (options.emotion) {
    const emotion = document.createElement('span')

    emotion.className = 'message__emotion'
    emotion.textContent = `ekspresi: ${options.emotion}`

    element.append(emotion)
  }

  messagesElement.append(element)
  messagesElement.scrollTop = messagesElement.scrollHeight

  return element
}

function applySettingsToForm(next) {
  settings = next

  petNameElement.textContent = next.petName
  providerLabel.textContent = providerNames[next.provider] ?? next.provider

  providerSelect.value = next.provider
  modelInput.value = next.models[next.provider] ?? ''
  personaInput.value = next.persona ?? ''
  keyInput.value = ''

  const hasKey = next.hasKey[next.provider]

  settingsHint.textContent = [
    hasKey
      ? 'API key tersimpan. Kosongkan kolom key kalau tidak mau mengubahnya.'
      : 'API key belum diisi untuk provider ini.',

    next.keyEncrypted
      ? 'Key disimpan terenkripsi oleh OS.'
      : 'OS tidak mendukung enkripsi, key disimpan apa adanya di settings.json.',
  ].join(' ')
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
  sendButton.textContent = value ? 'Kirim...' : 'Kirim'
}

async function send() {
  const text = input.value.trim()

  if (!text || sending) {
    return
  }

  appendMessage('user', text)

  input.value = ''
  setSending(true)

  const pending = appendMessage('pet', 'mengetik...', { pending: true })

  try {
    const result = await window.chatAPI.ask(text)

    pending.remove()

    if (result.ok) {
      appendMessage('pet', result.reply, { emotion: result.emotion })
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

settingsButton.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden
})

providerSelect.addEventListener('change', () => {
  const provider = providerSelect.value

  modelInput.value = settings?.models?.[provider] ?? ''
  keyInput.value = ''

  settingsHint.textContent = settings?.hasKey?.[provider]
    ? 'API key tersimpan untuk provider ini.'
    : 'API key belum diisi untuk provider ini.'
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
  })

  applySettingsToForm(next)

  settingsPanel.hidden = true
})

clearButton.addEventListener('click', async () => {
  await window.chatAPI.clear()

  renderEmpty()
})

async function bootstrap() {
  await loadSettings()
  await loadHistory()

  input.focus()
}

bootstrap()
