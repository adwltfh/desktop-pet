;(() => {
  // "Pat-pat": mengusap kepala pet dengan kursor, tanpa klik. Klik sudah
  // dipakai untuk mengangkat (drag.js), jadi elusan dibaca dari gerakan
  // kursor yang bolak-balik di atas kepala.
  const petElement = document.querySelector('#pet')

  const { playAnimation } = window.petAnim
  const { pickLine } = window.petDialogue
  const { showBubble } = window.petBubble

  // Bagian atas sprite yang dianggap kepala
  const HEAD_RATIO = 0.45

  // Satu elusan = balik arah sejauh ini. Cukup jauh supaya kursor yang cuma
  // bergetar atau lewat saja tidak terhitung.
  const STROKE_DISTANCE = 10
  const STROKES_TO_START = 3

  // Elusan yang lebih tua dari ini dilupakan, jadi harus beruntun
  const STROKE_WINDOW_MS = 1200

  // Kursor berhenti mengusap selama ini dianggap sudah selesai
  const STROKE_IDLE_MS = 800

  let strokeTimes = []
  let direction = 0
  let anchorX = null
  let patting = false
  let stopTimer = null

  function isBusy() {
    // Sedang diangkat: gerakan kursor itu drag, bukan elusan
    return petElement.classList.contains('is-dragging')
  }

  function overHead(event) {
    const rect = petElement.getBoundingClientRect()

    return (
      event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.top + rect.height * HEAD_RATIO
    )
  }

  function forgetStrokes() {
    strokeTimes = []
    direction = 0
    anchorX = null
  }

  // Mengembalikan true kalau gerakan ini melengkapi satu elusan
  function trackStroke(x) {
    const shift = x - anchorX

    if (Math.abs(shift) < STROKE_DISTANCE) {
      return false
    }

    const next = shift < 0 ? -1 : 1

    anchorX = x

    // Arah pertama belum dihitung: baru satu tarikan, belum bolak-balik
    if (direction === 0) {
      direction = next

      return false
    }

    if (next === direction) {
      return false
    }

    direction = next

    return true
  }

  function stopPatting() {
    patting = false

    clearTimeout(stopTimer)
    stopTimer = null
  }

  function scheduleStop() {
    clearTimeout(stopTimer)

    stopTimer = setTimeout(stopPatting, STROKE_IDLE_MS)
  }

  function playPatting() {
    playAnimation('patting', {
      onEnd: () => {
        // Keburu diangkat: drag.js yang pegang animasinya sekarang
        if (isBusy()) {
          return
        }

        // Selama masih diusap, animasinya diulang
        if (patting) {
          playPatting()
          return
        }

        playAnimation('idle')
        window.petBehavior.resume(800)
      },
    })
  }

  function startPatting() {
    patting = true

    forgetStrokes()

    window.petBehavior.notifyInteraction()
    window.petBehavior.pause()

    showBubble(pickLine('patting'))
    playPatting()
    scheduleStop()
  }

  window.addEventListener('mousemove', event => {
    if (isBusy()) {
      forgetStrokes()
      return
    }

    if (!overHead(event)) {
      forgetStrokes()
      return
    }

    // Titik acuan disiapkan waktu kursor pertama masuk area kepala
    if (anchorX === null) {
      anchorX = event.clientX

      return
    }

    if (!trackStroke(event.clientX)) {
      return
    }

    // Sedang dipat: tiap elusan cuma memperpanjang durasinya
    if (patting) {
      scheduleStop()
      return
    }

    const now = Date.now()

    strokeTimes = strokeTimes
      .filter(time => now - time <= STROKE_WINDOW_MS)
      .concat(now)

    if (strokeTimes.length < STROKES_TO_START) {
      return
    }

    // Kalau sedang tidur, elusan membangunkan dulu — bukan langsung dipat
    if (window.petBehavior.isAsleep()) {
      forgetStrokes()
      window.petBehavior.notifyInteraction()

      return
    }

    startPatting()
  })

  window.addEventListener('mouseleave', forgetStrokes)

  // Tombol ditekan berarti mau diangkat, bukan diusap
  window.addEventListener('mousedown', () => {
    forgetStrokes()
    stopPatting()
  })

  window.petPat = {
    isPatting: () => patting,
  }
})()
