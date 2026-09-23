;(() => {
  // Jendela pet lebih besar dari sprite-nya (ada ruang untuk bubble),
  // jadi area kosongnya dibuat tembus klik ke desktop. Mouse event tetap
  // diteruskan ke sini (forward: true) supaya posisi kursor tetap terbaca.
  const petHitbox = document.querySelector('#pet')

  let interactive = false
  let forced = false

  function setInteractive(next) {
    if (next === interactive) {
      return
    }

    interactive = next

    window.petAPI.setIgnoreMouse(!next)
  }

  function pointInRect(x, y, rect) {
    return (
      Boolean(rect)
      && x >= rect.left
      && x <= rect.right
      && y >= rect.top
      && y <= rect.bottom
    )
  }

  function update(x, y) {
    if (forced) {
      setInteractive(true)
      return
    }

    const overPet = pointInRect(x, y, petHitbox.getBoundingClientRect())
    const overBubble = pointInRect(x, y, window.petBubble.getBubbleRect())

    setInteractive(overPet || overBubble)
  }

  // Dipakai saat drag: jendela tidak boleh jadi tembus klik di tengah jalan
  function setForced(value) {
    forced = Boolean(value)

    if (forced) {
      setInteractive(true)
    }
  }

  window.addEventListener('mousemove', event => {
    update(event.clientX, event.clientY)
  })

  window.addEventListener('mouseleave', () => {
    if (!forced) {
      setInteractive(false)
    }
  })

  window.petPassthrough = {
    setForced,
    isInteractive: () => interactive,
  }
})()
