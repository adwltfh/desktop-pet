;(() => {
  const bubble = document.querySelector('#bubble')
  const bubbleText = document.querySelector('#bubble-text')

  let hideTimer = null

  function estimateDuration(text) {
    // Kira-kira waktu baca: 60ms per karakter, dibatasi 2.5 - 12 detik
    return Math.min(Math.max(text.length * 60, 2500), 12000)
  }

  function showBubble(text, options = {}) {
    if (!text) {
      return
    }

    clearTimeout(hideTimer)

    bubbleText.textContent = text
    bubble.hidden = false
    bubble.classList.toggle('is-thinking', Boolean(options.thinking))

    // Paksa reflow supaya animasi pop selalu jalan ulang
    bubble.classList.remove('is-visible')
    void bubble.offsetWidth
    bubble.classList.add('is-visible')

    if (options.sticky) {
      return
    }

    const duration = options.duration ?? estimateDuration(text)

    hideTimer = setTimeout(hideBubble, duration)
  }

  function hideBubble() {
    clearTimeout(hideTimer)

    bubble.classList.remove('is-visible')

    // Tunggu transisi selesai sebelum benar-benar disembunyikan
    hideTimer = setTimeout(() => {
      bubble.hidden = true
      bubble.classList.remove('is-thinking')
    }, 180)
  }

  function isBubbleVisible() {
    return !bubble.hidden
  }

  function isThinkingBubble() {
    return !bubble.hidden && bubble.classList.contains('is-thinking')
  }

  function getBubbleRect() {
    return bubble.hidden ? null : bubble.getBoundingClientRect()
  }

  window.petBubble = {
    element: bubble,
    showBubble,
    hideBubble,
    isBubbleVisible,
    isThinkingBubble,
    getBubbleRect,
  }
})()
