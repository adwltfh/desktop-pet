;(() => {
  const petElement = document.querySelector('#pet')

  const { playAnimation, setFacing } = window.petAnim
  const { pickLine } = window.petDialogue
  const { showBubble } = window.petBubble

  const CLICK_THRESHOLD = 4
  const DROP_EFFECT_MS = 520

  // Geser sejauh ini dulu sebelum animasi diangkat ganti arah, supaya tidak
  // bolak-balik kanan-kiri waktu tangan bergetar sedikit.
  const DRAG_TURN_THRESHOLD = 12

  // Klik pet (bukan seret) = digelitik: gerakan malu-malu dulu, lalu
  // reaksi ngambek yang frame terakhirnya ditahan di animation.js.
  const TICKLE_SEQUENCE = ['cuteGesture', 'reactions']

  let dragging = false
  let grabX = 0
  let grabY = 0
  let startScreenX = 0
  let startScreenY = 0
  let dragDirection = 'right'
  let lastTurnX = 0

  function playInteraction() {
    showBubble(pickLine(TICKLE_SEQUENCE[0]))

    window.petBehavior.notifyInteraction()
    window.petBehavior.pause()

    // Dijalankan berurutan, behavior baru lanjut setelah rangkaian selesai
    function playFrom(index) {
      if (index >= TICKLE_SEQUENCE.length) {
        playAnimation('idle')
        window.petBehavior.resume(1200)

        return
      }

      playAnimation(TICKLE_SEQUENCE[index], {
        onEnd: () => playFrom(index + 1),
      })
    }

    playFrom(0)
  }

  // Frame diangkat ada dua arah, dipilih dari arah tarikan kursor
  function setDragDirection(direction) {
    if (direction === dragDirection) {
      return
    }

    dragDirection = direction

    setFacing(direction)
    playAnimation(direction === 'left' ? 'dragLeft' : 'dragRight')
  }

  function beginDrag(event) {
    dragging = true

    // Posisi kursor relatif jendela; selama drag nilainya tetap
    grabX = event.clientX
    grabY = event.clientY
    startScreenX = event.screenX
    startScreenY = event.screenY
    dragDirection = 'right'
    lastTurnX = event.screenX

    window.petPassthrough.setForced(true)
    window.petBehavior.pause()

    petElement.classList.remove('is-dropping')
    petElement.classList.add('is-dragging')

    setFacing('right')
    playAnimation('dragRight')
    showBubble(pickLine('drag'))
  }

  function endDrag(event) {
    dragging = false

    window.petPassthrough.setForced(false)
    petElement.classList.remove('is-dragging')

    // Pindah jendela berkali-kali bisa membuat Windows menurunkan z-order
    window.petAPI.raise()

    const distance = Math.hypot(
      event.screenX - startScreenX,
      event.screenY - startScreenY,
    )

    if (distance < CLICK_THRESHOLD) {
      setFacing('right')
      playInteraction()
      return
    }

    setFacing('right')

    petElement.classList.add('is-dropping')

    setTimeout(
      () => petElement.classList.remove('is-dropping'),
      DROP_EFFECT_MS,
    )

    showBubble(pickLine('drop'))
    window.petBehavior.notifyInteraction()

    playAnimation('drop', {
      onEnd: () => {
        playAnimation('idle')
        window.petBehavior.resume(600)
      },
    })
  }

  petElement.addEventListener('mousedown', event => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    window.petAPI.raise()
    beginDrag(event)
  })

  window.addEventListener('mousemove', event => {
    if (!dragging) {
      return
    }

    window.petAPI.setPosition(
      event.screenX - grabX,
      event.screenY - grabY,
    )

    const shift = event.screenX - lastTurnX

    if (Math.abs(shift) >= DRAG_TURN_THRESHOLD) {
      lastTurnX = event.screenX

      setDragDirection(shift < 0 ? 'left' : 'right')
    }
  })

  window.addEventListener('mouseup', event => {
    if (!dragging) {
      return
    }

    endDrag(event)
  })

  // Kursor keluar layar / jendela kehilangan fokus saat drag
  window.addEventListener('blur', () => {
    if (!dragging) {
      return
    }

    dragging = false

    window.petPassthrough.setForced(false)
    petElement.classList.remove('is-dragging')

    window.petAPI.raise()

    setFacing('right')
    playAnimation('idle')
    window.petBehavior.resume(600)
  })

  petElement.addEventListener('dblclick', () => {
    window.petAPI.openChat()
  })

  window.addEventListener('contextmenu', event => {
    event.preventDefault()

    window.petBehavior.notifyInteraction()
    window.petAPI.showMenu()
  })

  window.petBubble.element.addEventListener('click', () => {
    window.petAPI.openChat()
  })
})()
