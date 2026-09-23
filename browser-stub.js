;(() => {
  // Pengganti preload Electron supaya index.html bisa dijalankan di browser
  // biasa. Semua yang aslinya lewat IPC di sini dikerjakan di halaman.
  const handlers = {
    say: null,
    thinking: null,
    command: null,
    settings: null,
    modes: null,
  }

  const modes = {
    reading: false,
    music: false,
    coding: false,
    focus: false,
  }

  // Jendela pet palsu: posisinya disimpan dalam koordinat halaman
  const petWindowSize = { width: 320, height: 300 }
  const position = { x: 120, y: 160 }

  let petWindowElement = null
  let desktopElement = null
  let animationList = []

  function applyPosition() {
    if (!petWindowElement) {
      return
    }

    petWindowElement.style.left = `${position.x}px`
    petWindowElement.style.top = `${position.y}px`
  }

  function workArea() {
    if (!desktopElement) {
      return { x: 0, y: 0, width: 800, height: 600 }
    }

    const rect = desktopElement.getBoundingClientRect()

    return { x: 0, y: 0, width: rect.width, height: rect.height }
  }

  // drag.js memakai screenX/screenY karena di Electron posisi jendela itu
  // koordinat layar. Di browser dikembalikan dulu ke koordinat halaman.
  function screenToPage(x, y) {
    const chromeHeight = window.outerHeight - window.innerHeight

    return {
      x: x - window.screenX,
      y: y - window.screenY - chromeHeight,
    }
  }

  function clamp(x, y) {
    const area = workArea()

    return {
      x: Math.min(Math.max(x, area.x), area.x + area.width - petWindowSize.width),
      y: Math.min(Math.max(y, area.y), area.y + area.height - petWindowSize.height),
    }
  }

  window.petAPI = {
    // Tidak ada jendela sungguhan yang perlu dibuat tembus klik
    setIgnoreMouse: () => {},
    raise: () => {},

    moveBy: (dx, dy) => {
      const next = clamp(position.x + (dx ?? 0), position.y + (dy ?? 0))

      position.x = next.x
      position.y = next.y

      applyPosition()
    },

    setPosition: (x, y) => {
      const page = screenToPage(x, y)
      const next = clamp(page.x, page.y)

      position.x = next.x
      position.y = next.y

      applyPosition()
    },

    getBounds: async () => ({
      bounds: {
        x: position.x,
        y: position.y,
        width: petWindowSize.width,
        height: petWindowSize.height,
      },

      workArea: workArea(),
    }),

    openChat: () => window.petTestPanel?.log('buka chat (tidak ada di browser)'),
    showMenu: () => window.petTestPanel?.openContextMenu(),

    reportAnimations: list => {
      animationList = Array.isArray(list) ? list : []
    },

    getSettings: async () => ({
      petName: 'Jinshi',

      behavior: {
        boredAfter: 3 * 60 * 1000,
        sleepAfter: 10 * 60 * 1000,
        chatterChance: 0.35,
        walkSpeed: 2,
        runSpeed: 5,
      },
    }),

    getModes: async () => ({ ...modes }),

    onSay: handler => {
      handlers.say = handler
    },

    onThinking: handler => {
      handlers.thinking = handler
    },

    onCommand: handler => {
      handlers.command = handler
    },

    onSettings: handler => {
      handlers.settings = handler
    },

    onModes: handler => {
      handlers.modes = handler
    },
  }

  // Jam palsu untuk menguji aturan yang bergantung waktu tanpa menunggu.
  // Diterapkan ke seluruh Date karena behavior.js memanggil getHours()
  // pada instance baru setiap kali.
  const realGetHours = Date.prototype.getHours

  let hourOverride = null

  Date.prototype.getHours = function getHours() {
    return hourOverride === null ? realGetHours.call(this) : hourOverride
  }

  function setHourOverride(hour) {
    hourOverride = hour === null || Number.isNaN(hour) ? null : hour
  }

  // ---------- Panel kontrol ----------

  function initPanel() {
    petWindowElement = document.querySelector('#pet-window')
    desktopElement = document.querySelector('#desktop')

    applyPosition()

    const statusList = document.querySelector('#status')
    const logList = document.querySelector('#log')

    function log(message) {
      const item = document.createElement('li')
      const time = new Date()

      item.textContent = `${String(realGetHours.call(time)).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}  ${message}`

      logList.prepend(item)

      while (logList.children.length > 60) {
        logList.lastElementChild.remove()
      }
    }

    function send(payload) {
      handlers.command?.(payload)
    }

    // --- daftar animasi untuk dropdown ---
    const animSelect = document.querySelector('#anim-name')
    const emotionSelect = document.querySelector('#say-emotion')

    const names = animationList.length
      ? animationList.map(item => item.name)
      : Object.keys(window.petAnim.animations)

    for (const name of names) {
      animSelect.append(new Option(name, name))
    }

    for (const name of ['celebrate', 'lookAround', 'hugPlushie', 'waterReminder', 'reactions', 'shocked', 'waving', 'idle']) {
      emotionSelect.append(new Option(name, name))
    }

    // --- mode ---
    for (const input of document.querySelectorAll('[data-mode]')) {
      input.addEventListener('change', () => {
        modes[input.dataset.mode] = input.checked

        handlers.modes?.({ ...modes })
        log(`mode ${input.dataset.mode} = ${input.checked ? 'nyala' : 'mati'}`)
      })
    }

    // --- chat ---
    document.querySelector('#chat-busy').addEventListener('change', event => {
      handlers.thinking?.(event.target.checked)
      log(`prompt chat ${event.target.checked ? 'mulai' : 'selesai'}`)
    })

    document.querySelector('#say-send').addEventListener('click', () => {
      const emotion = emotionSelect.value

      document.querySelector('#chat-busy').checked = false
      handlers.thinking?.(false)

      handlers.say?.({
        text: 'Selesai. Masalahnya sudah beres, kok.',
        emotion,
        source: 'ai',
      })

      log(`jawaban chat dengan ekspresi ${emotion}`)
    })

    // --- tidur ---
    document.querySelector('#do-sleep').addEventListener('click', () => {
      send({ action: 'sleep' })
      log('suruh tidur')
    })

    document.querySelector('#do-wake').addEventListener('click', () => {
      send({ action: 'wake' })
      log('bangunkan')
    })

    // --- pengingat ---
    document.querySelector('#do-water').addEventListener('click', () => {
      window.petBehavior.remindWater()
      log('pengingat minum')
    })

    document.querySelector('#do-sleep-reminder').addEventListener('click', () => {
      window.petBehavior.remindSleep()
      log('pengingat tidur')
    })

    // --- animasi ---
    document.querySelector('#anim-play').addEventListener('click', () => {
      const name = animSelect.value
      const hold = document.querySelector('#anim-hold').checked

      window.petBehavior.pause()

      if (hold) {
        window.petAnim.playAnimation(name, { onEnd: () => {} })
      }
      else {
        window.petAnim.playAnimation(name)
      }

      log(`putar ${name}${hold ? ' (tahan)' : ''}`)
    })

    document.querySelector('#do-random').addEventListener('click', () => {
      send({ action: 'random' })
      log('animasi acak')
    })

    document.querySelector('#do-resume').addEventListener('click', () => {
      send({ action: 'resume' })
      log('lanjut aktivitas')
    })

    // --- jam palsu ---
    document.querySelector('#fake-apply').addEventListener('click', () => {
      const value = Number(document.querySelector('#fake-hour').value)

      setHourOverride(value)
      log(`jam dipalsukan jadi ${value}:00`)
    })

    document.querySelector('#fake-reset').addEventListener('click', () => {
      setHourOverride(null)
      document.querySelector('#fake-hour').value = ''
      log('jam kembali ke waktu asli')
    })

    // --- menu klik kanan tiruan ---
    const menu = document.createElement('div')

    menu.className = 'context-menu'
    menu.hidden = true
    document.body.append(menu)

    function openContextMenu() {
      const items = [
        ['Ngobrol...', () => log('buka chat (tidak ada di browser)')],
        ['Suruh tidur', () => send({ action: 'sleep' })],
        ['Bangunkan', () => send({ action: 'wake' })],
        ['Animasi acak', () => send({ action: 'random' })],
      ]

      menu.replaceChildren()

      for (const [label, action] of items) {
        const button = document.createElement('button')

        button.type = 'button'
        button.textContent = label

        button.addEventListener('click', () => {
          action()
          menu.hidden = true
        })

        menu.append(button)
      }

      const rect = petWindowElement.getBoundingClientRect()

      menu.style.left = `${rect.left + rect.width / 2}px`
      menu.style.top = `${rect.top + rect.height / 2}px`
      menu.hidden = false
    }

    window.addEventListener('click', event => {
      if (!menu.hidden && !menu.contains(event.target)) {
        menu.hidden = true
      }
    })

    // --- status berkala ---
    let lastAnimation = null

    setInterval(() => {
      const animation = window.petAnim.getCurrentAnimation()

      if (animation !== lastAnimation) {
        lastAnimation = animation
        log(`animasi -> ${animation}`)
      }

      const rows = [
        ['animasi', animation],
        ['mode', window.petBehavior.activeMode() ?? '-'],
        ['tidur', window.petBehavior.isAsleep() ? 'ya' : 'tidak'],
        ['dijeda', window.petBehavior.isPaused() ? 'ya' : 'tidak'],
        ['prompt chat', window.petBehavior.isChatBusy() ? 'jalan' : '-'],
        ['jam dipakai', hourOverride === null ? 'asli' : `${hourOverride}:00`],
      ]

      statusList.replaceChildren()

      for (const [label, value] of rows) {
        const dt = document.createElement('dt')
        const dd = document.createElement('dd')

        dt.textContent = label
        dd.textContent = value

        statusList.append(dt, dd)
      }
    }, 250)

    window.petTestPanel = { log, openContextMenu }

    log('siap. Electron diganti stub.')
  }

  window.addEventListener('DOMContentLoaded', initPanel)
})()
