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

  // Sebagian animasi urutannya tidak berurutan dan temponya beda-beda per
  // frame, jadi ditulis sebagai daftar langkah [nomorFrame, durasi].
  function createSequence(folder, steps) {
    const frames = []
    const holds = {}

    steps.forEach(([number, duration], index) => {
      frames.push(
        `./assets/frames/${folder}/${String(number).padStart(2, '0')}.png`,
      )

      holds[index] = duration
    })

    return { frames, holds }
  }

  // Satu putaran baca: tiga kali baca lalu membalik halaman, dan baru di
  // akhir dia menemukan sesuatu yang menarik. Jadi frame membalik halaman
  // muncul tiga kali lebih sering daripada frame berbinar.
  const READING_TURN_PAGE = [[2, 900], [3, 900], [4, 450]]
  const READING_FOUND_SOMETHING = [[2, 900], [3, 900], [5, 700]]

  const READING_STEPS = [
    ...READING_TURN_PAGE,
    ...READING_TURN_PAGE,
    ...READING_TURN_PAGE,
    ...READING_FOUND_SOMETHING,
  ]

  // Dua sheet arah pandang (assets/jinshi-gaze-a.png dan -b.png) disambung
  // jadi satu putaran penuh 16 frame: frame pertama menunduk, lalu tiap
  // frame berputar 22,5 derajat lewat kiri, atas, kanan, dan kembali ke
  // bawah. Urutan itu yang bikin framenya bisa dipilih dari sudut kursor.
  const GAZE_FRAMES = [
    ...createFrames('gaze-a', 8),
    ...createFrames('gaze-b', 8),
  ]

  // Sudut layar frame pertama. Sumbu y layar mengarah ke bawah, jadi
  // menunduk itu +90 derajat.
  const GAZE_DOWN_ANGLE = 90
  const GAZE_STEP = 360 / GAZE_FRAMES.length

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

    // Diputar sendiri, pandangannya berkeliling. Waktu mengikuti kursor
    // framenya tidak diputar timer, tapi dipilih lewat `lookAt`.
    gaze: {
      frames: GAZE_FRAMES,
      speed: 150,
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

    // Baris "patting" isinya satu putaran utuh: 01-02 tangan datang, 03
    // kepala sedang diusap, 04-05 reaksi senang setelah tangannya pergi,
    // 06 reda. Tangannya cuma ada di 02-03, jadi kalau seluruh baris
    // diulang selama masih diusap, tangannya muncul-hilang terus dan
    // reaksi senangnya keluar padahal elusannya belum berhenti.
    //
    // Makanya dipecah dua: tangan datang lalu berhenti di kepala, dan
    // reaksinya disimpan untuk saat elusannya berhenti.
    //
    // Frame 03 ditahan selama kursor masih mengusap — gerakannya sudah
    // datang dari kursor pengguna, jadi frame yang berganti-ganti malah
    // bikin tangannya terlihat mengambang naik-turun.
    patting: {
      frames: createFrames('patting', [1, 3]),
      speed: 170,
      loop: false,
    },

    // Frame hati (05) ditahan supaya reaksinya sempat terbaca sebelum reda
    pattingEnd: {
      frames: createFrames('patting', [4, 6]),
      speed: 240,
      loop: false,

      holds: { 1: 900 },
    },

    // Sprite sheet aktivitas (assets/jinshi-activities.png). Semuanya kegiatan
    // yang berlangsung lama, jadi looping dan dihentikan lewat durasi.
    // Frame 01 dan 06 bukunya sudah ditutup, jadi tidak ikut putaran baca —
    // kalau ikut, dia seperti buka-tutup buku terus.
    reading: {
      ...createSequence('reading', READING_STEPS),
      speed: 450,
      loop: true,
    },

    // Menutup buku: puas dulu (06), lalu berdiri dengan tangan kosong (01).
    // Dipakai sekali saat pet keluar dari mode baca.
    bookClose: {
      frames: [
        ...createFrames('reading', [6, 6]),
        ...createFrames('reading', [1, 1]),
      ],
      speed: 500,
      loop: false,

      holds: { 0: 900 },
    },

    // Menunggu itu melirik jam saku (03) lama-lama lalu mengetuk kaki (04),
    // dan sesekali menguap (05) sebelum balik melirik jam lagi. Menguapnya
    // sengaja tidak tiap putaran: kalau selalu muncul, urutannya kebaca dan
    // menunggunya jadi terasa seperti animasi, bukan seperti bosan.
    //
    // Frame 01-02 cuma pose berdiri biasa dan 06 itu pet menyadari
    // penggunanya kembali, jadi dua-duanya tidak ikut putaran ini.
    waiting: {
      frames: createFrames('waiting', [3, 5]),
      speed: 700,
      loop: true,

      holds: {
        0: 1800,
        2: 1200,
      },

      chances: { 2: 0.25 },

      // Frame mengetuk kaki (04) dicondongkan ke kiri atau kanan, diacak
      // tiap kali muncul, supaya tumpuannya terlihat pindah-pindah.
      tilts: { 1: [-7, 7] },
    },

    // Dipakai sekali waktu pengguna menyapa balik pet yang sedang menunggu
    waitingNotice: {
      frames: createFrames('waiting', [6, 6]),
      speed: 900,
      loop: false,
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

    // Frame 01 laptopnya masih tertutup, jadi tidak ikut putaran kerja —
    // kalau ikut, dia seperti buka-tutup laptop terus. Putaran kerja cuma
    // 02-06, dengan frame mengetik dan frame berpikir ditahan lebih lama
    // supaya tidak terlihat panik.
    usingLaptop: {
      frames: createFrames('using-laptop', [2, 6]),
      speed: 400,
      loop: true,

      holds: {
        0: 700,
        2: 1100,
        3: 500,
        4: 700,
      },
    },

    // Menutup laptop: dipakai sekali saat pet keluar dari mode ngoding
    // atau fokus, bukan bagian dari putaran kerja.
    laptopClose: {
      frames: createFrames('using-laptop', [1, 1]),
      speed: 1200,
      loop: false,
    },
  }

  // Animasi yang arah hadapnya sudah ada di framenya sendiri: ada yang
  // digambar menghadap kiri, ada yang framenya dipilih menurut arah kursor.
  // Kalau dicerminkan lewat CSS, arahnya jadi terbalik.
  const unmirroredAnimations = new Set(['dragLeft', 'gaze'])

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
        'dragLeft',
        'dragRight',
        'drop',
        'sleepy',
        'sleep',
        'wakeUp',
        'laptopClose',
        'bookClose',
        'pattingEnd',
        'waitingNotice',
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
