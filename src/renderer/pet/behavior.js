;(() => {
  const {
    playAnimation,
    playRandomAnimation,
    setFacing,
    lookAt,
    getCurrentAnimation,
    isLooping,
  } = window.petAnim
  const { pickLine } = window.petDialogue
  const { showBubble, hideBubble } = window.petBubble

  // Diisi ulang dari settings di main process saat renderer siap
  let config = {
    boredAfter: 3 * 60 * 1000,
    chatterChance: 0.35,
    walkSpeed: 2,
    runSpeed: 5,
    spriteScale: 1,
  }

  // Aktivitas acak + bobot kemunculannya. Animasi yang sekarang punya pemicu
  // sendiri (sapaan, mode, pengingat, klik, chat) sengaja tidak masuk sini supaya
  // tidak muncul di saat yang tidak berarti apa-apa.
  const activities = [
    { name: 'idle', weight: 24 },
    { name: 'idleThinking', weight: 10 },
    { name: 'walk', weight: 28 },
    { name: 'run', weight: 7 },
    { name: 'shocked', weight: 3 },
  ]

  const STEP_INTERVAL = 40

  // Jarak antar penyegaran arah pandang. Lebih rapat dari ini cuma menambah
  // lalu lintas IPC: framenya toh cuma ada 16.
  const GAZE_INTERVAL = 100

  // Kursor sedekat ini ke kepala tidak punya arah yang jelas lagi, jadi
  // pandangan terakhir dipertahankan.
  const GAZE_DEAD_ZONE = 12

  // Geser sependek ini belum dihitung sebagai kursor yang bergerak. Tangan
  // yang cuma bertumpu di mouse tidak seharusnya menahan pandangan.
  const GAZE_MOVE_THRESHOLD = 6

  // Kursor diam selama ini: pet kembali berkedip. Frame pandangan tidak
  // bergerak sendiri, jadi kalau dibiarkan pet terlihat membeku.
  const GAZE_REST_AFTER = 1500

  // Jam mulai pengingat tidur (peluk boneka) sampai jam berakhirnya, lewat
  // tengah malam. Di luar rentang ini animasinya tidak pernah jalan.
  const SLEEP_REMINDER_FROM_HOUR = 17
  const SLEEP_REMINDER_TO_HOUR = 3
  const SLEEP_REMINDER_INTERVAL = 45 * 60 * 1000

  // Tendangan hanya selingan sesekali dalam rutinitas bosan.
  const BORED_KICK_COOLDOWN = 90 * 1000
  const BORED_KICK_CHANCE = 0.12

  // Prompt chat yang lebih lama dari ini: bubble-nya diganti jadi "masih
  // mikir", tapi animasinya tetap usingLaptop.
  const LONG_PROMPT_AFTER = 8000

  // Mode diurutkan dari yang paling menang kalau dinyalakan bersamaan
  const MODE_ANIMATIONS = [
    ['reading', 'reading'],
    ['music', 'listeningMusic'],
    ['coding', 'usingLaptop'],
    ['focus', 'usingLaptop'],
  ]

  // Mode yang pegang barang harus membereskannya dulu sebelum ditinggal
  const MODE_EXIT_ANIMATIONS = {
    usingLaptop: 'laptopClose',
    reading: 'bookClose',
  }

  let activityTimer = null
  let walkTimer = null
  let gazeTimer = null
  let sleepReminderTimer = null
  let longPromptTimer = null
  let kickImpactTimer = null

  let paused = false
  let asleep = false
  let chatBusy = false
  let scrollThinking = false
  let lastInteraction = Date.now()
  let lastBoredAt = 0
  let lastCounterKickAt = 0

  let modes = {
    reading: false,
    music: false,
    coding: false,
    focus: false,
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min)
  }

  // Rentang jam yang boleh melewati tengah malam (mis. 17 - 3)
  function hourWithin(hour, from, to) {
    return from <= to
      ? hour >= from && hour < to
      : hour >= from || hour < to
  }

  function activeMode() {
    const found = MODE_ANIMATIONS.find(([name]) => modes[name])

    return found ? found[0] : null
  }

  function modeAnimation() {
    const found = MODE_ANIMATIONS.find(([name]) => modes[name])

    return found ? found[1] : null
  }

  function pickActivity() {
    const total = activities.reduce(
      (sum, activity) => sum + activity.weight,
      0,
    )

    let roll = Math.random() * total

    for (const activity of activities) {
      roll -= activity.weight

      if (roll <= 0) {
        return activity.name
      }
    }

    return 'idle'
  }

  function maybeChatter(key) {
    if (Math.random() > config.chatterChance) {
      return
    }

    const line = pickLine(key)

    if (line) {
      showBubble(line)
    }
  }

  function stopWalking() {
    clearInterval(walkTimer)
    walkTimer = null
  }

  function stopGazing() {
    clearInterval(gazeTimer)
    gazeTimer = null
  }

  // Gerak berkala dan benturan tertunda harus berhenti saat aktivitas berganti.
  function stopMotion() {
    stopWalking()
    stopGazing()
    clearTimeout(kickImpactTimer)
    kickImpactTimer = null
  }

  // Berdiri diam sambil mengikuti kursor. Frame pandangan tidak diputar
  // timer animasi: tiap denyut posisi kursor ditanya ke main process, lalu
  // frame yang arahnya paling dekat dipasang.
  //
  // Frame itu diam kalau kursornya diam, jadi begitu kursor berhenti pet
  // dikembalikan ke kedipan `idle`. Pandangannya tetap dipantau, jadi
  // begitu kursor bergerak lagi dia langsung menoleh.
  function startGaze(duration) {
    const until = Date.now() + duration

    let previous = null
    let lastMovedAt = Date.now()

    maybeChatter('idle')
    stopMotion()
    setFacing('right')

    // Aktivitas ini yang pegang jadwalnya sampai durasinya habis;
    // penjadwalan yang masih menggantung akan memotongnya di tengah jalan.
    clearTimeout(activityTimer)

    function moved(cursor) {
      if (!previous) {
        return true
      }

      return Math.hypot(
        cursor.dx - previous.dx,
        cursor.dy - previous.dy,
      ) > GAZE_MOVE_THRESHOLD
    }

    async function follow() {
      if (paused || asleep || chatBusy) {
        stopGazing()
        return
      }

      const cursor = await window.petAPI.getCursor()

      // Denyut ini bisa datang setelah pandangan dihentikan, karena
      // jawaban main process ditunggu.
      if (!gazeTimer) {
        return
      }

      const now = Date.now()

      if (cursor) {
        if (moved(cursor)) {
          previous = cursor
          lastMovedAt = now
        }

        // Kursor menempel di kepala: arahnya tidak jelas lagi, diperlakukan
        // sama seperti kursor yang diam.
        const aimed = Math.hypot(cursor.dx, cursor.dy) > GAZE_DEAD_ZONE

        if (aimed && now - lastMovedAt < GAZE_REST_AFTER) {
          lookAt(cursor.dx, cursor.dy)
        }
        else if (getCurrentAnimation() !== 'idle') {
          playAnimation('idle')
        }
      }

      if (now >= until) {
        stopGazing()
        playAnimation('idle')
        scheduleNext(randomBetween(800, 2500))
      }
    }

    gazeTimer = setInterval(follow, GAZE_INTERVAL)

    follow()
  }

  function scheduleNext(delay) {
    clearTimeout(activityTimer)

    activityTimer = setTimeout(runActivity, delay)
  }

  async function startWalk(isRunning) {
    stopGazing()

    const info = await window.petAPI.getBounds()

    if (!info || paused || asleep) {
      scheduleNext(1000)
      return
    }

    const { bounds, workArea } = info
    const minX = workArea.x
    const maxX = Math.min(
      workArea.x + workArea.width - bounds.width,
      info.walkMaxX ?? Infinity,
    )

    if (maxX <= minX) {
      playAnimation('idle')
      scheduleNext(randomBetween(800, 2500))
      return
    }

    let direction = Math.random() < 0.5 ? -1 : 1

    // Kalau sudah mepet tembok, balik arah
    if (bounds.x <= minX + 8) {
      direction = 1
    }
    else if (bounds.x >= maxX - 8) {
      direction = -1
    }

    const speed = isRunning ? config.runSpeed : config.walkSpeed
    const duration = isRunning
      ? randomBetween(1500, 3500)
      : randomBetween(2500, 7000)

    let x = bounds.x
    let startedAt = Date.now()

    // Skipping dan gestur lucu menyela jalan biasa, bukan lari. Gerak
    // mendatar tetap berlanjut selama sprite melompat.
    let accentEligibleCheckedAt = startedAt
    let accentCooldownUntil = 0
    let playingAccent = false
    let turning = false

    setFacing(direction === -1 ? 'left' : 'right')
    playAnimation(isRunning ? 'run' : 'walk')
    maybeChatter(isRunning ? 'run' : 'walk')

    stopMotion()

    walkTimer = setInterval(() => {
      if (paused || asleep || turning) {
        return
      }

      const nextX = x + direction * speed

      if (nextX <= minX || nextX >= maxX) {
        const edgeX = Math.min(Math.max(nextX, minX), maxX)

        window.petAPI.moveBy(edgeX - x, 0)
        x = edgeX
        turning = true
        playingAccent = false

        const turnStartedAt = Date.now()

        playAnimation('lookAround', {
          onEnd: () => {
            if (!walkTimer || paused || asleep) {
              return
            }

            startedAt += Date.now() - turnStartedAt
            direction *= -1
            setFacing(direction === -1 ? 'left' : 'right')
            playAnimation(isRunning ? 'run' : 'walk')
            turning = false
          },
        })

        return
      }

      x = nextX
      window.petAPI.moveBy(direction * speed, 0)

      const now = Date.now()

      if (
        !isRunning
        && !playingAccent
        && now - startedAt >= 1600
        && now >= accentCooldownUntil
        && now - accentEligibleCheckedAt >= 1200
        && Math.min(x - minX, maxX - x) > speed * 24
      ) {
        accentEligibleCheckedAt = now

        if (Math.random() < 0.22) {
          playingAccent = true
          accentCooldownUntil = now + 5500
          const accent = now - startedAt >= 4000 && Math.random() < 0.36
            ? 'walkCute'
            : 'skipping'

          playAnimation(accent, {
            onEnd: () => {
              playingAccent = false

              if (walkTimer) {
                playAnimation('walk')
              }
            },
          })
        }
      }

      if (now - startedAt >= duration && !playingAccent) {
        stopWalking()
        setFacing('right')
        playAnimation('idle')
        scheduleNext(randomBetween(800, 2500))
      }
    }, STEP_INTERVAL)
  }

  function playOneShot(name) {
    maybeChatter(name)

    playAnimation(name, {
      onEnd: () => {
        playAnimation('idle')
        scheduleNext(randomBetween(1200, 4000))
      },
    })
  }

  function playLooping(name, duration) {
    maybeChatter(name)
    playAnimation(name)
    scheduleNext(duration)
  }

  // Setelah bosan, pet tetap terjaga: menunggu, melirik, berjalan, atau
  // sesekali mengusik counter. Dialog bosan hanya muncul sekali tiap kali
  // pengguna meninggalkannya.
  function runBoredActivity() {
    if (!lastBoredAt) {
      lastBoredAt = Date.now()

      const line = pickLine('bored')

      if (line) {
        showBubble(line)
      }

      playAnimation('waiting')
      scheduleNext(randomBetween(8000, 12000))
      return
    }

    const roll = Math.random()

    if (
      roll < BORED_KICK_CHANCE
      && Date.now() - lastCounterKickAt >= BORED_KICK_COOLDOWN
    ) {
      kickBoredCounter()
      return
    }

    if (roll < 0.42) {
      startWalk(false)
      return
    }

    if (roll < 0.57) {
      playOneShot('lookAround')
      return
    }

    if (getCurrentAnimation() !== 'waiting') {
      playAnimation('waiting')
    }

    scheduleNext(randomBetween(9000, 16000))
  }

  // Selingan langka: pet menghampiri widget pat lalu menendangnya pelan.
  // Angka pat tidak berubah; widget hanya bergoyang.
  async function kickBoredCounter() {
    const interactionAt = lastInteraction

    lastCounterKickAt = Date.now()
    stopMotion()
    clearTimeout(activityTimer)

    let destination

    try {
      destination = await window.petAPI.getCounterTarget()
    }
    catch (error) {
      console.warn('Gagal mencari pat counter:', error)
    }

    const interrupted = () => (
      paused || asleep || chatBusy || lastInteraction !== interactionAt
    )

    if (interrupted()) {
      if (!paused && !asleep && !chatBusy) {
        scheduleNext(800)
      }
      return
    }

    if (!destination) {
      startWalk(false)
      return
    }

    const { bounds, target, sameDisplay } = destination
    let x = bounds.x
    let y = bounds.y

    function finishApproach() {
      stopWalking()
      window.petAPI.setPosition(target.x, target.y)
      window.petAPI.raise()
      setFacing('right')

      const line = pickLine('kickCounter')

      if (line) {
        showBubble(line)
      }

      playAnimation('kickCounter', {
        onEnd: () => {
          if (interrupted()) {
            if (!paused && !asleep && !chatBusy) {
              playAnimation('idle')
              scheduleNext(800)
            }
            return
          }

          playAnimation('waiting')
          scheduleNext(randomBetween(9000, 16000))
        },
      })

      // Frame tendang mulai pada 170 ms; benturan badge sedikit sesudahnya.
      kickImpactTimer = setTimeout(() => {
        kickImpactTimer = null

        if (!interrupted()) {
          window.petAPI.kickCounter()
        }
      }, 240)
    }

    // Kalau Jinshi berada di sisi lain counter, lintasan lurusnya akan
    // menembus badge. Pindahkan ke sisi tendang yang aman dulu.
    if (!sameDisplay || x > target.x) {
      finishApproach()
      return
    }

    const distance = Math.hypot(target.x - x, target.y - y)

    if (distance <= 12) {
      finishApproach()
      return
    }

    setFacing(target.x < x ? 'left' : 'right')
    playAnimation('run')

    walkTimer = setInterval(() => {
      if (interrupted()) {
        stopWalking()

        if (!paused && !asleep && !chatBusy) {
          playAnimation('idle')
          scheduleNext(800)
        }
        return
      }

      const dx = target.x - x
      const dy = target.y - y
      const remaining = Math.hypot(dx, dy)

      if (remaining <= 12) {
        finishApproach()
        return
      }

      x += dx / remaining * 12
      y += dy / remaining * 12
      window.petAPI.setPosition(Math.round(x), Math.round(y))
    }, STEP_INTERVAL)
  }

  // Tidur tetap bisa diminta lewat menu. Transisi berakhir di napas tidur.
  function playSleepTransition() {
    playAnimation('drowsyToSleep', {
      onEnd: () => playAnimation('sleepBreathing'),
    })
  }

  // Hanya dipanggil langsung (menu "tidur sekarang" / uji manual).
  function goSleep() {
    asleep = true

    stopMotion()
    clearTimeout(activityTimer)
    clearTimeout(longPromptTimer)

    setFacing('right')
    playSleepTransition()

    const line = pickLine('sleep')

    if (line) {
      showBubble(line)
    }
  }

  function runActivity() {
    if (paused) {
      scheduleNext(1500)
      return
    }

    // Tidur yang diminta pengguna bertahan sampai ia membangunkan pet.
    if (asleep) {
      return
    }

    stopGazing()

    const idleFor = Date.now() - lastInteraction

    // Mode aktif menggantikan aktivitas acak dan bosan: pengguna memang
    // sedang sibuk, bukan pergi.
    const mode = modeAnimation()

    if (mode) {
      // Animasi modenya sudah jalan: biarkan putarannya selesai. Kalau
      // diputar ulang tiap penjadwalan, frame yang letaknya di akhir
      // putaran (mis. saat menemukan sesuatu di buku) tidak pernah sempat
      // muncul.
      if (getCurrentAnimation() === mode) {
        scheduleNext(randomBetween(8000, 14000))
        return
      }

      playLooping(mode, randomBetween(8000, 14000))
      return
    }

    if (idleFor >= config.boredAfter) {
      runBoredActivity()
      return
    }

    const activity = pickActivity()

    if (activity === 'walk' || activity === 'run') {
      startWalk(activity === 'run')
      return
    }

    // Berdiri diam berarti mengikuti kursor. Berhenti lewat durasinya
    // sendiri, bukan lewat scheduleNext.
    if (activity === 'idle') {
      startGaze(randomBetween(5000, 11000))
      return
    }

    // Animasi looping tidak pernah memanggil onEnd, jadi dijadwalkan
    // ulang lewat durasi.
    if (isLooping(activity)) {
      playLooping(activity, randomBetween(3000, 8000))
      return
    }

    playOneShot(activity)
  }

  // Pengingat menyela apa pun yang sedang jalan, lalu mengembalikan pet ke
  // aktivitas biasa. Diabaikan kalau pet tidur, diangkat, atau lagi dipakai.
  function playReminder(animation, lineKey) {
    if (paused || asleep || chatBusy) {
      return false
    }

    stopMotion()
    clearTimeout(activityTimer)

    const line = pickLine(lineKey)

    if (line) {
      showBubble(line)
    }

    setFacing('right')

    playAnimation(animation, {
      onEnd: () => {
        playAnimation('idle')
        scheduleNext(randomBetween(1500, 3000))
      },
    })

    return true
  }

  // Dipicu sekali sehari kalau lewat semalaman tanpa dipat sama sekali
  // (lihat affection:check di main process). Beda dari playReminder: ini
  // kejadian langka yang tidak boleh terlewat begitu saja, jadi kalau pet
  // kebetulan sedang tidur dia dibangunkan dulu, dan kalau sedang dijeda
  // (diseret / dipat / chat) dicoba lagi sebentar lagi alih-alih dilewati.
  //
  // Animasi khusus sulky diputar sekali, lalu pet kembali beraktivitas.
  function showSulk(likes) {
    if (paused || chatBusy) {
      setTimeout(() => showSulk(likes), 5000)
      return
    }

    stopMotion()
    clearTimeout(activityTimer)
    clearTimeout(longPromptTimer)

    asleep = false
    lastInteraction = Date.now()
    lastBoredAt = 0

    setFacing('right')

    const line = pickLine('sulk')

    if (line) {
      showBubble(line.replace('{likes}', String(likes)))
    }

    playAnimation('sulky', {
      onEnd: () => {
        playAnimation('idle')
        scheduleNext(randomBetween(1500, 3000))
      },
    })
  }

  function startReminders() {
    clearInterval(sleepReminderTimer)

    sleepReminderTimer = setInterval(() => {
      const hour = new Date().getHours()

      if (!hourWithin(hour, SLEEP_REMINDER_FROM_HOUR, SLEEP_REMINDER_TO_HOUR)) {
        return
      }

      playReminder('hugPlushie', 'sleepReminder')
    }, SLEEP_REMINDER_INTERVAL)
  }

  function wake(options = {}) {
    const wasAsleep = asleep
    const wasLyingDown = getCurrentAnimation() === 'sleepBreathing'

    asleep = false
    lastInteraction = Date.now()
    lastBoredAt = 0

    // Jeda antar-klip mengantuk atau transisi ke sleep mungkin masih
    // menunggu di `activityTimer`; kalau tidak dibatalkan dia akan
    // memotong animasi bangun begitu waktunya tiba.
    clearTimeout(activityTimer)
    stopGazing()

    if (wasAsleep || options.force) {
      hideBubble()

      const greet = () => playAnimation('waving', {
        onEnd: () => {
          playAnimation('idle')
          scheduleNext(randomBetween(800, 2000))
        },
      })

      // Dari telungkup perlu bangkit duduk dulu. Kalau baru sebatas duduk
      // mengantuk, tinggal melek — `wakeUp` malah membuatnya rebahan dulu.
      if (wasAsleep && wasLyingDown) {
        playAnimation('wakeUp', { onEnd: greet })
      }
      else {
        greet()
      }

      return
    }

    scheduleNext(randomBetween(600, 1500))
  }

  // Pet yang sedang menunggu baru menyadari penggunanya di sini, bukan di
  // tengah putaran menunggu. Di luar keadaan itu tidak ada yang berubah:
  // notifyInteraction dipanggil dari mana-mana (seret, usap, chat, menu).
  function noticeReturn() {
    if (paused || chatBusy) {
      return
    }

    if (getCurrentAnimation() !== 'waiting') {
      return
    }

    playAnimation('waitingNotice', {
      onEnd: () => {
        playAnimation('idle')
        scheduleNext(randomBetween(600, 1500))
      },
    })
  }

  function notifyInteraction() {
    lastInteraction = Date.now()
    lastBoredAt = 0

    if (asleep) {
      wake()
      return
    }

    noticeReturn()
  }

  // Kursor mendekat ke pet yang sedang menunggu sudah cukup: frame itu
  // memang menggambarkan dia baru ngeh ada orang, bukan dia dipegang.
  // Sengaja hanya berlaku di pose menunggu — kalau tidak, kursor yang
  // kebetulan parkir di atas pet bikin dia tidak pernah mengantuk.
  //
  // Mouse event tetap diteruskan ke renderer walau jendelanya tembus klik,
  // jadi cukup dengar di window.
  window.addEventListener('mousemove', () => {
    if (getCurrentAnimation() !== 'waiting') {
      return
    }

    if (!window.petPassthrough?.isInteractive()) {
      return
    }

    notifyInteraction()
  })

  function pause() {
    paused = true

    stopMotion()
    clearTimeout(activityTimer)
  }

  function resume(delay = 800) {
    paused = false

    scheduleNext(delay)
  }

  // Prompt chat sedang diproses: pet ikut "kerja" di laptop, dan tetap di
  // situ selama masih diproses — kalau jawabannya lama, yang berubah cuma
  // bubble-nya jadi "masih mikir", bukan animasinya.
  function setChatBusy(value) {
    chatBusy = Boolean(value)

    clearTimeout(longPromptTimer)

    if (!chatBusy) {
      return
    }

    lastInteraction = Date.now()
    lastBoredAt = 0

    if (asleep) {
      asleep = false
    }

    pause()
    playAnimation('usingLaptop')

    longPromptTimer = setTimeout(() => {
      if (!chatBusy) {
        return
      }

      showBubble(pickLine('thinkingLong'), { sticky: true, thinking: true })
    }, LONG_PROMPT_AFTER)
  }

  // Scroll global terdeteksi di mana pun (lihat main/scroll-watch.js), bukan
  // cuma di atas pet -- dipakai sebagai sinyal "sedang menyimak layarnya",
  // pet ikut memasang wajah berpikir selama rentetan scroll-nya berlangsung.
  // scrollThinking dilacak terpisah dari `paused` supaya tidak menimpa atau
  // ikut membatalkan jeda dari drag/pat/chat yang sedang berlangsung.
  function setScrollActive(active) {
    if (active) {
      if (scrollThinking || paused || chatBusy || asleep) {
        return
      }

      scrollThinking = true

      notifyInteraction()
      pause()
      playAnimation('idleThinking')

      return
    }

    if (!scrollThinking) {
      return
    }

    scrollThinking = false
    resume(400)
  }

  // Mode diganti dari panel atau menu klik-kanan: pet langsung pindah ke animasi
  // yang sesuai, tidak menunggu aktivitas berjalan selesai.
  function applyModes(next) {
    const before = modeAnimation()

    modes = { ...modes, ...(next ?? {}) }

    const after = modeAnimation()

    notifyInteraction()

    if (paused || chatBusy) {
      return
    }

    stopMotion()

    // Meninggalkan mode yang pegang barang: laptop ditutup atau buku
    // dibereskan dulu, baru pindah ke mode berikutnya / aktivitas biasa.
    const exitAnimation = before === after
      ? null
      : MODE_EXIT_ANIMATIONS[before]

    if (exitAnimation) {
      clearTimeout(activityTimer)

      playAnimation(exitAnimation, {
        onEnd: () => {
          if (after) {
            scheduleNext(200)
            return
          }

          playAnimation('idle')
          scheduleNext(randomBetween(600, 1200))
        },
      })

      return
    }

    scheduleNext(200)
  }

  function setInitialModes(next) {
    modes = { ...modes, ...(next ?? {}) }
  }

  // Dibatasi supaya sprite-nya tidak kepotong jendela pet yang ukurannya
  // tetap (lihat PET_WIDTH/PET_HEIGHT di main/constants.js) -- jendelanya
  // sendiri sengaja tidak ikut di-resize, biar posisi di layar tidak
  // meloncat tiap skalanya diganti.
  const SPRITE_SCALE_MIN = 0.7
  const SPRITE_SCALE_MAX = 1.6

  function applySettings(settings) {
    config = { ...config, ...(settings?.behavior ?? {}) }

    const scale = Math.min(
      Math.max(config.spriteScale ?? 1, SPRITE_SCALE_MIN),
      SPRITE_SCALE_MAX,
    )

    document.documentElement.style.setProperty('--pet-scale', scale)
  }

  function greet({ withBubble = false, afterWave = null } = {}) {
    asleep = false
    paused = false
    scrollThinking = false
    lastInteraction = Date.now()
    lastBoredAt = 0
    stopMotion()
    clearTimeout(activityTimer)
    hideBubble()
    setFacing('right')

    playAnimation('waving', {
      onEnd: () => {
        if (afterWave) {
          afterWave()
          return
        }

        if (chatBusy) {
          playAnimation('usingLaptop')
          return
        }

        playAnimation('idle')
        scheduleNext(1500)
      },
    })

    if (withBubble) {
      showBubble(pickLine('greeting'))
    }
  }

  function start(options = {}) {
    startReminders()
    greet({ ...options, withBubble: options.afterWave == null })
  }

  window.petBehavior = {
    start,
    pause,
    resume,
    wake,
    sleepNow: goSleep,
    sulk: showSulk,
    notifyInteraction,
    applySettings,
    setChatBusy,
    setScrollActive,
    applyModes,
    setInitialModes,
    greetAfterDeviceActive: () => greet(),
    getModes: () => ({ ...modes }),

    // Pengingat aslinya dipicu timer; dibuka juga supaya bisa diuji manual
    remindWater: () => playReminder('waterReminder', 'waterReminder'),
    remindSleep: () => playReminder('hugPlushie', 'sleepReminder'),

    // Jalur bosan bisa dicoba langsung dari DevTools tanpa menunggu ambang.
    boredNow: () => {
      paused = false
      asleep = false
      lastInteraction = Date.now() - config.boredAfter
      lastBoredAt = 0
      stopMotion()
      clearTimeout(activityTimer)
      runBoredActivity()
    },

    kickCounterNow: () => {
      paused = false
      asleep = false
      lastInteraction = Date.now() - config.boredAfter
      lastBoredAt = Date.now()
      kickBoredCounter()
    },

    // Aslinya pandangan cuma muncul sebagai aktivitas acak, jadi susah
    // ditunggu. Dibuka supaya bisa dipanggil langsung waktu diuji.
    gazeNow: (duration = 20000) => {
      notifyInteraction()

      // Panel uji biasanya sudah menjeda pet lewat tombol lain, dan
      // pandangan berhenti sendiri kalau pet dijeda.
      paused = false

      startGaze(duration)
    },

    playRandom: () => {
      notifyInteraction()

      const name = playRandomAnimation()

      maybeChatter(name)
      scheduleNext(randomBetween(2000, 4000))
    },

    isAsleep: () => asleep,
    isPaused: () => paused,
    isChatBusy: () => chatBusy,
    activeMode,
  }
})()
