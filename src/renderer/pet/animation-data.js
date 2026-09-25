;(() => {
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

  // Seperti `createSequence`, tapi tiap langkah boleh ambil dari folder
  // berbeda — dipakai transisi yang menyambung beberapa sheet sekaligus
  // (mis. drowsy -> sleep, atau sleep -> drowsy -> idle waktu bangun).
  function createMixedSequence(steps) {
    const frames = []
    const holds = {}

    steps.forEach(([folder, number, duration], index) => {
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

  // Tiap variasi mengantuk berangkat dan kembali ke frame 01 (jangkar) —
  // biar gonta-ganti antar variasi tidak pernah "meloncat" pose.
  const DROWSY_BLINK_STEPS = [[1, 520], [2, 180], [1, 260], [2, 220], [1, 650]]
  const DROWSY_YAWN_STEPS = [[1, 380], [2, 180], [3, 680], [3, 420], [4, 520], [1, 700]]
  const DROWSY_MICRO_DOZE_STEPS = [[1, 420], [2, 260], [5, 820], [5, 720], [6, 380], [1, 620]]

  // Satu putaran penuh selebrasi besar: bersiap, tangan terangkat, melompat,
  // puncak confetti, mendarat, tepuk tangan bahagia.
  const CELEBRATE_BIG_STEPS = [
    [1, 180], [2, 120], [3, 100], [4, 200], [5, 140], [6, 220],
  ]

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
      speed: 105,
      loop: true,
    },

    // Dua langkah melompat ringan, dengan puff saat mendarat dan kilau
    // reaksi di lompatan kedua. Diputar sekali di sela jalan biasa.
    skipping: {
      ...createSequence('skipping', [
        [1, 105], [2, 95], [3, 125], [4, 105],
        [5, 105], [6, 95], [7, 135], [8, 110],
      ]),
      loop: false,
    },

    run: {
      frames: createFrames('run-right', 8),
      speed: 75,
      loop: true,
    },

    // Reaksi ekspresi tunggal ("kelihatan mengantuk") yang dipilih model
    // chat lewat [emotion:sleepy]. Tidur panjang hanya dimulai lewat menu.
    sleepy: {
      ...createSequence('drowsy', DROWSY_BLINK_STEPS),
      loop: false,
    },

    // Variasi mengantuk tersedia untuk uji manual; bosan tidak lagi
    // memutar rangkaian mengantuk atau membuat pet tidur otomatis.
    drowsyBlink: {
      ...createSequence('drowsy', DROWSY_BLINK_STEPS),
      loop: false,
    },

    drowsyYawn: {
      ...createSequence('drowsy', DROWSY_YAWN_STEPS),
      loop: false,
    },

    drowsyMicroDoze: {
      ...createSequence('drowsy', DROWSY_MICRO_DOZE_STEPS),
      loop: false,
    },

    // Jangkar (01), kedip berat (02), menguap (03) dari sheet drowsy, lalu
    // menyambung penuh ke seluruh sheet sleep (01-04: menguap duduk, usap
    // mata, melipat badan, sampai telungkup tidur). Behavior.js memutar ini
    // sekali sebagai transisi terakhir sebelum `sleepBreathing` mengambil
    // alih di frame terakhirnya.
    drowsyToSleep: {
      ...createMixedSequence([
        ['drowsy', 1, 360],
        ['drowsy', 2, 220],
        ['drowsy', 3, 720],
        ['sleep', 1, 620],
        ['sleep', 2, 520],
        ['sleep', 3, 720],
        ['sleep', 4, 1250],
      ]),
      loop: false,
    },

    // Napas selagi tidur: bergantian antara pose melipat badan (03) dan
    // telungkup penuh (04), bukan cuma diam di satu frame — itu yang
    // menciptakan efek naik-turunnya dada.
    sleepBreathing: {
      ...createSequence('sleep', [[3, 950], [4, 1150], [3, 900], [4, 1250]]),
      loop: true,
    },

    // Bangun: dibalik dari telungkup (04) ke usap mata (02), lewat kilau
    // pulih dari sheet drowsy (06), baru ke idle. Dipakai hanya kalau pet
    // sudah lewat tahap `sleepBreathing`; kalau baru sebatas mengantuk,
    // behavior.js melewati ini.
    wakeUp: {
      ...createMixedSequence([
        ['sleep', 4, 620],
        ['sleep', 3, 420],
        ['sleep', 2, 460],
        ['drowsy', 6, 420],
        ['idle-blink', 2, 260],
        ['idle-blink', 1, 520],
      ]),
      loop: false,
    },

    // Respons ringan: dipakai default waktu tugas/masalah pengguna selesai
    // biasa saja — bukan momen besar. Senyum kecil, angkat tangan lembut,
    // tepuk tangan kecil, lalu tenang lagi sebelum balik ke idle.
    celebrate: {
      ...createSequence('celebrate', [[1, 180], [2, 140], [6, 220], [1, 120]]),
      loop: false,
    },

    // Selebrasi besar: cuma untuk momen personal yang benar-benar
    // membahagiakan/membanggakan (ulang tahun, pencapaian besar) — bukan
    // keberhasilan teknis rutin. Satu putaran penuh dari sheet yang sama,
    // diulang dua kali sesuai urutan aslinya.
    celebrateBig: {
      ...createSequence('celebrate', [
        ...CELEBRATE_BIG_STEPS,
        ...CELEBRATE_BIG_STEPS,
      ]),
      loop: false,
    },

    // Berhenti sejenak di tepi desktop sebelum membalik arah jalan.
    lookAround: {
      frames: createFrames('look-around', 6),
      speed: 220,
      loop: false,
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

    // Diangkat: dua frame kaget (entri), lalu drag.js menyambung ke
    // `dragHeld` yang diam dalam satu pose; ayunan pelannya dibuat di CSS.
    // Satu sheet saja, tidak lagi dibedakan kiri/kanan — posenya menghadap depan.
    drag: {
      ...createSequence('drag', [[1, 120], [2, 140]]),
      loop: false,
    },

    dragHeld: {
      frames: createFrames('drag', [3, 3]),
      speed: 1200,
      loop: true,
    },

    // Pose jalan sebagai awalan, satu tendangan ke kanan, lalu menapak lagi.
    kickCounter: {
      ...createMixedSequence([
        ['walk-right', 1, 170],
        ['kick-counter', 1, 220],
        ['kick-counter', 1, 170],
        ['walk-right', 1, 260],
      ]),
      loop: false,
    },

    // Dilepas setelah diseret: kaget jatuh, mendarat, sempoyongan, lega.
    drop: {
      ...createSequence('drop', [
        [1, 100], [2, 100], [3, 90], [4, 160],
        [5, 120], [6, 130], [7, 180], [8, 350],
      ]),
      loop: false,
    },

    // Sesekali muncul di tengah jalan biasa (bukan lari) — behavior.js yang
    // menggulirkan peluangnya, lalu balik ke `walk` lewat `onEnd`.
    walkCute: {
      ...createSequence('walk-cute', [
        [1, 115], [2, 105], [3, 110], [4, 105],
        [5, 115], [6, 105], [7, 110], [8, 105],
      ]),
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
      // Frame 04 benar-benar meneguk air. Tahan agar gerak minumnya terbaca,
      // tetapi satu putaran tetap selesai sebelum jeda minimum balasan chat.
      holds: { 3: 1000 },
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

    // Cemberut kecil: menyilangkan tangan, memalingkan wajah, lalu melirik
    // kembali. Selesai satu putaran agar callback sulk kembali ke idle.
    sulky: {
      frames: createFrames('sulky', 6),
      speed: 400,
      loop: false,

      holds: {
        0: 650,
        2: 550,
        3: 650,
      },
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
  const unmirroredAnimations = new Set(['gaze'])

  window.petAnimData = {
    animations,
    unmirroredAnimations,
    GAZE_FRAMES,
    GAZE_DOWN_ANGLE,
    GAZE_STEP,
  }
})()
