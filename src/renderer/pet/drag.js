;(() => {
  const petElement = document.querySelector('#pet')

  const { playAnimation, setFacing } = window.petAnim
  const { pickLine } = window.petDialogue
  const { showBubble } = window.petBubble

  const CLICK_THRESHOLD = 4
  // Sama dengan total durasi delapan frame `drop` di animation-data.js.
  const DROP_EFFECT_MS = 1230

  // Klik pet (bukan seret) = digelitik: gerakan malu-malu dulu, lalu
  // reaksi ngambek yang frame terakhirnya ditahan di animation.js.
  const TICKLE_SEQUENCE = ['cuteGesture', 'reactions']

  // Diklik selagi tidur (`isAsleep()`): bukan digelitik, tapi kaget
  // dibangunkan mendadak.
  const STARTLED_SEQUENCE = ['shocked']

  // Diklik terus-terusan dalam waktu singkat: dari geli jadi ngambek
  // sungguhan (lihat personality/Kepribadian.md). Pola hitungnya sama
  // seperti elusan berturut-turut di pat.js.
  const SULKY_CLICK_SEQUENCE = ['sulky']
  const CLICKS_TO_SULK = 4
  const CLICK_STREAK_WINDOW_MS = 3000

  // Klik kedua yang datang secepat ini dianggap dobel klik (buka chat),
  // bukan dua klik tunggal terpisah -- reaksi klik tunggal jadi menunggu
  // sebentar dulu sebelum benar-benar tampil, supaya bisa dibatalkan kalau
  // ternyata klik keduanya menyusul (lihat handleClick).
  const DOUBLE_CLICK_WINDOW_MS = 300

  let dragging = false
  let dragStarted = false
  let grabX = 0
  let grabY = 0
  let startScreenX = 0
  let startScreenY = 0
  let clickTimes = []
  let pendingClickTimer = null
  let lastClickAt = 0

  function pickInteractionSequence() {
    // Dicek sebelum notifyInteraction() supaya masih menangkap keadaan
    // sebelum wake() membangunkannya.
    if (window.petBehavior.isAsleep()) {
      clickTimes = []

      return STARTLED_SEQUENCE
    }

    const now = Date.now()

    clickTimes = clickTimes
      .filter(time => now - time <= CLICK_STREAK_WINDOW_MS)
      .concat(now)

    if (clickTimes.length < CLICKS_TO_SULK) {
      return TICKLE_SEQUENCE
    }

    // Ngambeknya sekali tampil lalu hitungannya direset, supaya klik
    // berikutnya mulai dari geli lagi, bukan langsung ngambek terus.
    clickTimes = []

    return SULKY_CLICK_SEQUENCE
  }

  function playInteraction() {
    const sequence = pickInteractionSequence()

    // notifyInteraction() dulu: kalau lagi tidur, wake() di dalamnya
    // memanggil hideBubble() — bubble reaksi ini harus tampil SESUDAH itu,
    // supaya tidak langsung ketutup lagi.
    window.petBehavior.notifyInteraction()
    window.petBehavior.pause()

    showBubble(pickLine(sequence[0]))

    // Dijalankan berurutan, behavior baru lanjut setelah rangkaian selesai
    function playFrom(index) {
      if (index >= sequence.length) {
        playAnimation('idle')
        window.petBehavior.resume(1200)

        return
      }

      playAnimation(sequence[index], {
        onEnd: () => playFrom(index + 1),
      })
    }

    playFrom(0)
  }

  // Klik & dobel klik dipakai berdua di elemen yang sama untuk dua hal
  // berbeda (reaksi digelitik/ngambek vs buka chat) -- tanpa penundaan ini,
  // tiap klik dalam dobel klik langsung memicu reaksinya sendiri duluan,
  // baru menyusul jendela chat kebuka, jadi tabrakan.
  function handleClick() {
    const now = Date.now()

    if (now - lastClickAt <= DOUBLE_CLICK_WINDOW_MS) {
      clearTimeout(pendingClickTimer)
      pendingClickTimer = null
      lastClickAt = 0

      window.petAPI.openChat()

      return
    }

    lastClickAt = now

    pendingClickTimer = setTimeout(() => {
      pendingClickTimer = null
      lastClickAt = 0

      playInteraction()
    }, DOUBLE_CLICK_WINDOW_MS)
  }

  // Ditekan dulu (mousedown) belum tentu jadi seret -- animasi & pose
  // "diangkat" baru benar-benar main begitu kursor terbukti lewat
  // CLICK_THRESHOLD (lihat mousemove), supaya klik biasa tidak sempat
  // kelihatan pose itu sekilas sebelum reaksi klik/sulky-nya sendiri main.
  function beginPress(event) {
    dragging = true
    dragStarted = false

    // Posisi kursor relatif jendela; selama drag nilainya tetap
    grabX = event.clientX
    grabY = event.clientY
    startScreenX = event.screenX
    startScreenY = event.screenY
  }

  function startDragging() {
    dragStarted = true

    window.petPassthrough.setForced(true)
    window.petBehavior.pause()

    petElement.classList.remove('is-dropping')
    petElement.classList.add('is-dragging')

    // Posenya sekarang satu sheet saja (menghadap depan, tidak dibedakan
    // arah), jadi tidak perlu ganti animasi lagi selama diseret.
    setFacing('right')
    playAnimation('drag', { onEnd: () => playAnimation('dragHeld') })
    showBubble(pickLine('drag'))
  }

  function endDrag() {
    dragging = false

    // Pindah jendela berkali-kali bisa membuat Windows menurunkan z-order
    window.petAPI.raise()

    if (!dragStarted) {
      // Tidak pernah lewat CLICK_THRESHOLD -- klik murni, animasi seret
      // tidak pernah sempat main sama sekali.
      setFacing('right')
      handleClick()
      return
    }

    window.petPassthrough.setForced(false)
    petElement.classList.remove('is-dragging')

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
    beginPress(event)
  })

  window.addEventListener('mousemove', event => {
    if (!dragging) {
      return
    }

    if (!dragStarted) {
      const distance = Math.hypot(
        event.screenX - startScreenX,
        event.screenY - startScreenY,
      )

      if (distance >= CLICK_THRESHOLD) {
        startDragging()
      }
    }

    window.petAPI.setPosition(
      event.screenX - grabX,
      event.screenY - grabY,
    )
  })

  window.addEventListener('mouseup', () => {
    if (!dragging) {
      return
    }

    endDrag()
  })

  // Kursor keluar layar / jendela kehilangan fokus saat drag
  window.addEventListener('blur', () => {
    if (!dragging) {
      return
    }

    dragging = false

    if (dragStarted) {
      window.petPassthrough.setForced(false)
      petElement.classList.remove('is-dragging')
      playAnimation('idle')
      window.petBehavior.resume(600)
    }

    dragStarted = false

    window.petAPI.raise()
    setFacing('right')
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
