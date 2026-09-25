;(() => {
  const pet = document.querySelector('#pet')
  const petSprite = document.querySelector('#pet-sprite')

  const {
    animations,
    unmirroredAnimations,
    GAZE_FRAMES,
    GAZE_DOWN_ANGLE,
    GAZE_STEP,
  } = window.petAnimData

  // Frame yang gagal dimuat bikin pet tampak hilang, jadi dicatat
  petSprite.addEventListener('error', () => {
    console.error(`Frame gagal dimuat: ${petSprite.getAttribute('src')}`)
  })

  let currentAnimation = 'idle'
  let currentFrame = 0
  let facing = 'right'
  let animationTimer = null
  let pendingOnEnd = null

  function frameDuration(animation, index) {
    return animation.holds?.[index] ?? animation.speed
  }

  // `tilts` memiringkan frame tertentu: kuncinya indeks frame, nilainya
  // daftar sudut yang boleh dipakai, dipilih acak tiap frame itu muncul.
  //
  // Sudutnya dipasang sebagai custom property, bukan transform langsung,
  // supaya aturan cermin di style.css tetap ikut terpakai.
  function applyTilt(animation, index) {
    const angles = animation?.tilts?.[index]

    if (!angles?.length) {
      petSprite.style.removeProperty('--pet-tilt')

      return
    }

    const angle = angles[Math.floor(Math.random() * angles.length)]

    petSprite.style.setProperty('--pet-tilt', `${angle}deg`)
  }

  function showFrame(animation, index) {
    applyTilt(animation, index)

    petSprite.src = animation.frames[index]
  }

  // `chances` menandai frame selingan: kuncinya indeks frame, nilainya
  // peluang frame itu ikut diputar. Frame tanpa entri selalu diputar.
  function framePicked(animation, index) {
    const chance = animation.chances?.[index]

    return chance === undefined || Math.random() < chance
  }

  // Indeks frame berikutnya, melewati frame selingan yang kali ini tidak
  // kebagian giliran. null berarti putarannya sudah habis.
  function nextFrame(animation, index) {
    const total = animation.frames.length

    for (let ahead = 1; ahead <= total; ahead += 1) {
      const next = index + ahead

      if (next >= total && !animation.loop) {
        return null
      }

      const wrapped = next % total

      if (framePicked(animation, wrapped)) {
        return wrapped
      }
    }

    // Satu putaran penuh terlewat semua. Tidak mungkin selama masih ada
    // frame tanpa `chances`, tapi jangan sampai animasinya berhenti diam.
    return animation.loop ? (index + 1) % total : null
  }

  function playAnimation(name, options = {}) {
    const animation = animations[name]

    if (!animation) {
      console.warn(`Animation "${name}" not found`)
      return
    }

    clearTimeout(animationTimer)

    // Callback animasi sebelumnya dibatalkan, bukan dipanggil
    pendingOnEnd = options.onEnd ?? null

    currentAnimation = name
    currentFrame = 0
    pet.dataset.animation = name

    showFrame(animation, 0)

    // Animasi baru mungkin butuh cermin yang berbeda untuk arah yang sama
    applyFacing()

    // Tiap frame dijadwalkan sendiri supaya `holds` bisa menahan satu frame
    // lebih lama tanpa mengubah tempo frame lainnya.
    function step() {
      animationTimer = setTimeout(() => {
        const next = nextFrame(animation, currentFrame)

        if (next === null) {
          const onEnd = pendingOnEnd

          pendingOnEnd = null

          if (onEnd) {
            onEnd(name)
          }
          else {
            // Setelah animasi selesai, kembali idle
            playAnimation('idle')
          }

          return
        }

        currentFrame = next
        showFrame(animation, currentFrame)
        step()
      }, frameDuration(animation, currentFrame))
    }

    step()
  }

  // Sebagian besar frame menghadap kanan, arah kiri tinggal dicerminkan.
  // Animasi yang framenya sudah menghadap kiri dikecualikan.
  function applyFacing() {
    const mirror = facing === 'left'
      && !unmirroredAnimations.has(currentAnimation)

    pet.classList.toggle('is-facing-left', mirror)
  }

  function setFacing(direction) {
    facing = direction === 'left' ? 'left' : 'right'

    applyFacing()
  }

  // Sudut kursor terhadap kepala pet (dx ke kanan, dy ke bawah) dibulatkan
  // ke frame pandangan terdekat.
  function gazeFrameFor(dx, dy) {
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    const fromDown = (((angle - GAZE_DOWN_ANGLE) % 360) + 360) % 360

    return Math.round(fromDown / GAZE_STEP) % GAZE_FRAMES.length
  }

  // Pandangan tidak berjalan sendiri: framenya ditentukan posisi kursor,
  // jadi putaran animasi yang sedang jalan dihentikan dan frame-nya
  // dipasang langsung. Frame yang sama tidak dipasang ulang supaya `src`
  // tidak diganti tiap kali kursor bergeser sedikit.
  function lookAt(dx, dy) {
    const index = gazeFrameFor(dx, dy)

    if (currentAnimation === 'gaze' && currentFrame === index) {
      return
    }

    clearTimeout(animationTimer)

    pendingOnEnd = null

    currentAnimation = 'gaze'
    currentFrame = index
    pet.dataset.animation = 'gaze'

    applyTilt()
    petSprite.src = GAZE_FRAMES[index]

    applyFacing()
  }

  function getCurrentAnimation() {
    return currentAnimation
  }

  function isLooping(name = currentAnimation) {
    return Boolean(animations[name]?.loop)
  }

  // Total durasi satu putaran penuh, dipakai behavior untuk menjadwalkan
  // animasi looping supaya berhenti di batas putaran, bukan di tengah.
  function animationDuration(name) {
    const animation = animations[name]

    if (!animation) {
      return 0
    }

    return animation.frames.reduce(
      (total, _frame, index) => total + frameDuration(animation, index),
      0,
    )
  }

  // Dipakai jendela penguji animasi supaya daftarnya tidak perlu ditulis ulang
  function getAnimationInfo() {
    return Object.entries(animations).map(([name, animation]) => ({
      name,
      frames: animation.frames.length,
      speed: animation.speed,
      loop: Boolean(animation.loop),
      folder: animation.frames[0]
        ?.replace('./assets/frames/', '')
        .replace(/\/\d+\.png$/, '') ?? '',
    }))
  }

  function playRandomAnimation() {
    const names = Object.keys(animations).filter(
      name => ![
        'drag',
        'dragHeld',
        'skipping',
        'kickCounter',
        'drop',
        'sleepy',
        'drowsyBlink',
        'drowsyYawn',
        'drowsyMicroDoze',
        'drowsyToSleep',
        'sleepBreathing',
        'wakeUp',
        'laptopClose',
        'bookClose',
        'pattingEnd',
        'waitingNotice',
        'lookAround',
      ].includes(name),
    )

    const randomIndex = Math.floor(Math.random() * names.length)

    playAnimation(names[randomIndex])

    return names[randomIndex]
  }

  playAnimation('idle')

  // Supaya fungsi bisa dipanggil dari DevTools console
  window.playAnimation = playAnimation
  window.playRandomAnimation = playRandomAnimation
  window.animations = animations

  window.petAnim = {
    animations,
    playAnimation,
    playRandomAnimation,
    setFacing,
    lookAt,
    getCurrentAnimation,
    getAnimationInfo,
    animationDuration,
    isLooping,
  }
})()
