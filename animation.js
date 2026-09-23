;(() => {
  const pet = document.querySelector('#pet')
  const petSprite = document.querySelector('#pet-sprite')

  // `range` boleh berupa jumlah frame (mulai dari 01) atau [awal, akhir]
  // kalau satu folder berisi lebih dari satu gerakan.
  function createFrames(folder, range) {
    const [first, last] = Array.isArray(range) ? range : [1, range]

    return Array.from(
      { length: last - first + 1 },
      (_, index) => {
        const frameNumber = String(first + index).padStart(2, '0')

        return `./assets/frames/${folder}/${frameNumber}.png`
      },
    )
  }

  // `holds` menahan frame tertentu lebih lama dari `speed`. Kuncinya indeks
  // frame (mulai 0), nilainya durasi dalam ms.
  const animations = {
    idle: {
      frames: createFrames('idle-blink', 6),
      speed: 220,
      loop: true,
    },

    walk: {
      frames: createFrames('walk-right', 8),
      speed: 110,
      loop: true,
    },

    run: {
      frames: createFrames('run-right', 8),
      speed: 75,
      loop: true,
    },

    // Baris sprite "sleep" berisi dua gerakan: 01-02 duduk mengantuk,
    // 03-04 telungkup tidur. Mengantuk diulang dulu beberapa detik, baru
    // turun ke posisi tidur yang diam di frame terakhir.
    sleepy: {
      frames: createFrames('sleep', [1, 2]),
      speed: 520,
      loop: true,
    },

    sleep: {
      frames: createFrames('sleep', [3, 4]),
      speed: 900,
      loop: false,
    },

    // Bangun = seluruh urutan tidur dibalik: telungkup lalu bangkit duduk.
    // Kalau cuma frame duduk yang dibalik, hasilnya sama saja dengan
    // `sleepy` — 01 dan 02 itu dua frame napas, bukan gerakan bangkit.
    wakeUp: {
      frames: createFrames('sleep', [1, 4]).reverse(),
      speed: 320,
      loop: false,
    },

    // Bekas animasi "greeting" disambung ke depan celebrate: dipakai waktu
    // pet dan pengguna berhasil menyelesaikan sesuatu di chat, bukan menyapa.
    celebrate: {
      frames: [
        ...createFrames('greeting', 5),
        ...createFrames('celebrate', 8),
      ],
      speed: 150,
      loop: false,
    },

    // Tiga folder arah pandang digabung jadi satu putaran: tengah, kanan,
    // lalu kiri. Dipakai waktu pet mencari pengguna yang sedang tidak ada.
    lookAround: {
      frames: [
        ...createFrames('look-around', 6),
        ...createFrames('look-directions-a', 8),
        ...createFrames('look-directions-b', 8),
      ],
      speed: 220,
      loop: true,
    },

    cuteGesture: {
      frames: createFrames('cute-gesture', 6),
      speed: 300,
      loop: false,
    },

    hugPlushie: {
      frames: createFrames('hug-plushie', 6),
      speed: 280,
      loop: false,
    },

    // Sprite sheet ekspresi (assets/jinshi-expressive.png) menyediakan
    // frame diangkat ke kanan/kiri, jadi tidak lagi memakai look-around.
    // Frame kiri sudah digambar menghadap kiri, jangan dicerminkan lagi.
    dragRight: {
      frames: createFrames('drag-right', 8),
      speed: 120,
      loop: true,
    },

    dragLeft: {
      frames: createFrames('drag-left', 8),
      speed: 120,
      loop: true,
    },

    drag: {
      frames: createFrames('drag-right', 8),
      speed: 120,
      loop: true,
    },

    // Melayang lalu mendarat, dipakai saat pet dilepas setelah diseret
    drop: {
      frames: createFrames('jump-fall', 4),
      speed: 110,
      loop: false,
    },

    idleThinking: {
      frames: createFrames('idle-thinking', 6),
      speed: 240,
      loop: true,
    },

    waving: {
      frames: createFrames('waving', 4),
      speed: 190,
      loop: false,
    },

    // Frame terakhir (08) pose jongkok ngambek, ditahan supaya kebacanya
    // bukan sekadar frame yang lewat.
    reactions: {
      frames: createFrames('reactions', 8),
      speed: 230,
      loop: false,
      holds: { 7: 2000 },
    },

    shocked: {
      frames: createFrames('shocked', 6),
      speed: 130,
      loop: false,
    },

    waterReminder: {
      frames: createFrames('water-reminder', 6),
      speed: 340,
      loop: false,
    },

    patting: {
      frames: createFrames('patting', 6),
      speed: 180,
      loop: false,
    },

    // Sprite sheet aktivitas (assets/jinshi-activities.png). Semuanya kegiatan
    // yang berlangsung lama, jadi looping dan dihentikan lewat durasi.
    reading: {
      frames: createFrames('reading', 6),
      speed: 260,
      loop: true,
    },

    waiting: {
      frames: createFrames('waiting', 6),
      speed: 420,
      loop: true,
    },

    dancing: {
      frames: createFrames('dancing', 6),
      speed: 140,
      loop: true,
    },

    listeningMusic: {
      frames: createFrames('listening-music', 6),
      speed: 200,
      loop: true,
    },

    usingLaptop: {
      frames: createFrames('using-laptop', 6),
      speed: 220,
      loop: true,
    },
  }

  // Animasi yang framenya sudah digambar menghadap kiri. Kalau dicerminkan
  // lewat CSS, arahnya jadi terbalik.
  const preMirroredAnimations = new Set(['dragLeft'])

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
    petSprite.src = animation.frames[0]

    // Animasi baru mungkin butuh cermin yang berbeda untuk arah yang sama
    applyFacing()

    // Tiap frame dijadwalkan sendiri supaya `holds` bisa menahan satu frame
    // lebih lama tanpa mengubah tempo frame lainnya.
    function step() {
      animationTimer = setTimeout(() => {
        currentFrame += 1

        if (currentFrame >= animation.frames.length) {
          if (animation.loop) {
            currentFrame = 0
          }
          else {
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
        }

        petSprite.src = animation.frames[currentFrame]
        step()
      }, frameDuration(animation, currentFrame))
    }

    step()
  }

  // Sebagian besar frame menghadap kanan, arah kiri tinggal dicerminkan.
  // Animasi yang framenya sudah menghadap kiri dikecualikan.
  function applyFacing() {
    const mirror = facing === 'left'
      && !preMirroredAnimations.has(currentAnimation)

    pet.classList.toggle('is-facing-left', mirror)
  }

  function setFacing(direction) {
    facing = direction === 'left' ? 'left' : 'right'

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
        'dragLeft',
        'dragRight',
        'drop',
        'sleepy',
        'sleep',
        'wakeUp',
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
    getCurrentAnimation,
    getAnimationInfo,
    animationDuration,
    isLooping,
  }
})()
