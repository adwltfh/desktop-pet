;(() => {
  // Titik masuk renderer jendela pet: menyambungkan animasi, behavior,
  // bubble, dan pesan dari main process.
  const { playAnimation } = window.petAnim
  const { showBubble, hideBubble } = window.petBubble
  const { pickLine } = window.petDialogue

  function handleSay(payload) {
    if (!payload?.text) {
      return
    }

    window.petBehavior.notifyInteraction()
    window.petBehavior.pause()

    const emotion = payload.emotion && window.petAnim.animations[payload.emotion]
      ? payload.emotion
      : 'idle'

    showBubble(payload.text)

    playAnimation(emotion, {
      onEnd: () => playAnimation('idle'),
    })

    // Lanjut beraktivitas lagi setelah bubble selesai dibaca
    window.petBehavior.resume(
      Math.min(Math.max(payload.text.length * 60, 3000), 12000),
    )
  }

  function handleThinking(isThinking) {
    if (isThinking) {
      // behavior yang pegang animasinya: ikut kerja di laptop dulu, lalu
      // celingukan dan menunggu kalau promptnya lama.
      window.petBehavior.setChatBusy(true)

      showBubble(pickLine('thinking'), { sticky: true, thinking: true })

      return
    }

    window.petBehavior.setChatBusy(false)

    // Jangan tutup bubble jawaban yang sudah keburu tampil
    if (window.petBubble.isThinkingBubble()) {
      hideBubble()
    }
  }

  function playTestAnimation(payload) {
    if (!window.petAnim.animations[payload?.name]) {
      console.warn(`Animation "${payload?.name}" not found`)
      return
    }

    window.petBehavior.pause()

    if (payload.withDialogue) {
      const line = pickLine(payload.name)

      if (line) {
        showBubble(line, { sticky: true })
      }
      else {
        hideBubble()
      }
    }
    else {
      hideBubble()
    }

    // Animasi sekali jalan dibiarkan berhenti di frame terakhirnya, bukan
    // balik ke idle, supaya hasilnya bisa diamati.
    window.petAnim.playAnimation(payload.name, { onEnd: () => {} })
  }

  function handleCommand(payload) {
    switch (payload?.action) {
      case 'sleep':
        window.petBehavior.sleepNow()
        break

      case 'wake':
        window.petBehavior.wake({ force: true })
        break

      case 'random':
        window.petBehavior.playRandom()
        break

      // Dari jendela penguji: behavior dihentikan dulu supaya aktivitas acak
      // tidak memotong animasi yang sedang dicoba.
      case 'play':
        playTestAnimation(payload)
        break

      case 'facing':
        window.petAnim.setFacing(payload.facing)
        break

      case 'resume':
        hideBubble()
        window.petBehavior.resume(200)
        break

      default:
        break
    }
  }

  async function bootstrap() {
    try {
      const settings = await window.petAPI.getSettings()

      window.petBehavior.applySettings(settings)
    }
    catch (error) {
      console.warn('Gagal membaca settings:', error)
    }

    window.petAPI.reportAnimations(window.petAnim.getAnimationInfo())

    try {
      const startModes = await window.petAPI.getModes()

      window.petBehavior.applyModes(startModes)
    }
    catch (error) {
      console.warn('Gagal membaca mode:', error)
    }

    window.petAPI.onSay(handleSay)
    window.petAPI.onThinking(handleThinking)
    window.petAPI.onCommand(handleCommand)
    window.petAPI.onSettings(settings => {
      window.petBehavior.applySettings(settings)
    })

    window.petAPI.onModes(next => {
      window.petBehavior.applyModes(next)
    })

    window.petBehavior.start()
  }

  bootstrap()
})()
