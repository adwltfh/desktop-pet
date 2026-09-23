;(() => {
  const {
    playAnimation,
    playRandomAnimation,
    setFacing,
    animationDuration,
    isLooping,
  } = window.petAnim
  const { pickLine } = window.petDialogue
  const { showBubble, hideBubble } = window.petBubble

  // Diisi ulang dari settings di main process saat renderer siap
  let config = {
    boredAfter: 3 * 60 * 1000,
    sleepAfter: 10 * 60 * 1000,
    chatterChance: 0.35,
    walkSpeed: 2,
    runSpeed: 5,
  }

  // Aktivitas acak + bobot kemunculannya. Animasi yang sekarang punya pemicu
  // sendiri (mode, pengingat, klik, chat) sengaja tidak masuk sini supaya
  // tidak muncul di saat yang tidak berarti apa-apa.
  const activities = [
    { name: 'idle', weight: 20 },
    { name: 'idleThinking', weight: 10 },
    { name: 'walk', weight: 28 },
    { name: 'run', weight: 7 },
    { name: 'lookAround', weight: 10 },
    { name: 'waving', weight: 6 },
    { name: 'shocked', weight: 3 },
  ]

  const STEP_INTERVAL = 40

  // Jam mulai pengingat tidur (peluk boneka) sampai jam berakhirnya, lewat
  // tengah malam. Di luar rentang ini animasinya tidak pernah jalan.
  const SLEEP_REMINDER_FROM_HOUR = 17
  const SLEEP_REMINDER_TO_HOUR = 3
  const SLEEP_REMINDER_INTERVAL = 45 * 60 * 1000

  // Lewat jam ini pet jauh lebih cepat mengantuk
  const NIGHT_HOUR = 21
  const MORNING_HOUR = 5
  const NIGHT_SLEEP_AFTER = 60 * 1000

  // Berapa lama pose duduk mengantuk diulang sebelum turun ke posisi tidur
  const SLEEPY_DURATION = 6000

  const WATER_INTERVAL = 2 * 60 * 60 * 1000

  // Prompt chat yang lebih lama dari ini: pet berhenti "ikut ngoding" dan
  // mulai celingukan lalu menunggu.
  const LONG_PROMPT_AFTER = 8000

  // Mode diurutkan dari yang paling menang kalau dinyalakan bersamaan
  const MODE_ANIMATIONS = [
    ['reading', 'reading'],
    ['music', 'dancing'],
    ['coding', 'usingLaptop'],
    ['focus', 'usingLaptop'],
  ]

  let activityTimer = null
  let walkTimer = null
  let waterTimer = null
  let sleepReminderTimer = null
  let longPromptTimer = null

  let paused = false
  let asleep = false
  let chatBusy = false
  let lastInteraction = Date.now()
  let lastBoredAt = 0

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

  function isNight() {
    return hourWithin(new Date().getHours(), NIGHT_HOUR, MORNING_HOUR)
  }

  function sleepThreshold() {
    // Lewat jam malam, diam sebentar saja sudah cukup untuk tidur
    return isNight()
      ? Math.min(config.sleepAfter, NIGHT_SLEEP_AFTER)
      : config.sleepAfter
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

  function scheduleNext(delay) {
    clearTimeout(activityTimer)

    activityTimer = setTimeout(runActivity, delay)
  }

  async function startWalk(isRunning) {
    const info = await window.petAPI.getBounds()

    if (!info || paused || asleep) {
      scheduleNext(1000)
      return
    }

    const { bounds, workArea } = info
    const minX = workArea.x
    const maxX = workArea.x + workArea.width - bounds.width

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
    const startedAt = Date.now()

    setFacing(direction === -1 ? 'left' : 'right')
    playAnimation(isRunning ? 'run' : 'walk')
    maybeChatter(isRunning ? 'run' : 'walk')

    stopWalking()

    walkTimer = setInterval(() => {
      if (paused || asleep) {
        return
      }

      x += direction * speed

      if (x <= minX || x >= maxX) {
        direction *= -1
        x = Math.min(Math.max(x, minX), maxX)

        setFacing(direction === -1 ? 'left' : 'right')
      }

      window.petAPI.moveBy(direction * speed, 0)

      if (Date.now() - startedAt >= duration) {
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

  // Celingukan satu putaran penuh dulu, baru lanjut ke animasi berikutnya
  function playLookAroundThen(next) {
    playAnimation('lookAround')

    clearTimeout(activityTimer)
    activityTimer = setTimeout(next, animationDuration('lookAround'))
  }

  // Tidak ada interaksi: pet mencari pengguna dulu, lalu berdiri menunggu.
  // Selama masih sepi, dia bertahan di pose menunggu; celingukannya baru
  // diulang sekali tiap periode boredAfter supaya tidak gelisah terus.
  function goBored() {
    const startOver = Date.now() - lastBoredAt >= config.boredAfter

    if (!startOver) {
      if (window.petAnim.getCurrentAnimation() !== 'waiting') {
        playAnimation('waiting')
      }

      scheduleNext(randomBetween(8000, 15000))

      return
    }

    lastBoredAt = Date.now()

    const line = pickLine('bored')

    if (line) {
      showBubble(line)
    }

    playLookAroundThen(() => {
      maybeChatter('waiting')
      playAnimation('waiting')

      scheduleNext(randomBetween(8000, 15000))
    })
  }

  function goSleep() {
    asleep = true

    stopWalking()
    clearTimeout(activityTimer)
    clearTimeout(longPromptTimer)

    setFacing('right')

    // Pose duduk mengantuk diulang beberapa detik, baru telungkup tidur.
    // `onEnd` kosong supaya frame tidur terakhir tidak balik ke idle.
    playAnimation('sleepy')

    clearTimeout(activityTimer)
    activityTimer = setTimeout(
      () => playAnimation('sleep', { onEnd: () => {} }),
      SLEEPY_DURATION,
    )

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

    const idleFor = Date.now() - lastInteraction

    // Mode aktif menggantikan aktivitas acak: pet menemani dengan satu
    // animasi yang sesuai. Selama modenya menyala dia tidak tidur dan tidak
    // bosan — pengguna memang sedang sibuk, bukan pergi.
    const mode = modeAnimation()

    if (mode) {
      playLooping(mode, randomBetween(8000, 14000))
      return
    }

    if (idleFor >= sleepThreshold()) {
      goSleep()
      return
    }

    if (idleFor >= config.boredAfter) {
      goBored()
      return
    }

    const activity = pickActivity()

    if (activity === 'walk' || activity === 'run') {
      startWalk(activity === 'run')
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
      return
    }

    stopWalking()
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
  }

  function startReminders() {
    clearInterval(waterTimer)
    clearInterval(sleepReminderTimer)

    // Minum diingatkan tiap dua jam selama aplikasi menyala
    waterTimer = setInterval(
      () => playReminder('waterReminder', 'waterReminder'),
      WATER_INTERVAL,
    )

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
    const wasLyingDown = window.petAnim.getCurrentAnimation() === 'sleep'

    asleep = false
    lastInteraction = Date.now()
    lastBoredAt = 0

    // Transisi sleepy -> sleep mungkin masih menunggu; kalau tidak dibatalkan
    // dia akan memotong animasi bangun.
    clearTimeout(activityTimer)

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

  function notifyInteraction() {
    lastInteraction = Date.now()
    lastBoredAt = 0

    if (asleep) {
      wake()
    }
  }

  function pause() {
    paused = true

    stopWalking()
    clearTimeout(activityTimer)
  }

  function resume(delay = 800) {
    paused = false

    scheduleNext(delay)
  }

  // Prompt chat sedang diproses: pet ikut "kerja" di laptop. Kalau
  // jawabannya lama, dia celingukan lalu berdiri menunggu.
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

      playAnimation('lookAround')

      longPromptTimer = setTimeout(() => {
        if (!chatBusy) {
          return
        }

        showBubble(pickLine('thinkingLong'), { sticky: true, thinking: true })
        playAnimation('waiting')
      }, animationDuration('lookAround'))
    }, LONG_PROMPT_AFTER)
  }

  // Mode diganti dari menu klik-kanan: pet langsung pindah ke animasi
  // yang sesuai, tidak menunggu aktivitas berjalan selesai.
  function applyModes(next) {
    modes = { ...modes, ...(next ?? {}) }

    notifyInteraction()

    if (!paused && !chatBusy) {
      stopWalking()
      scheduleNext(200)
    }
  }

  function applySettings(settings) {
    config = { ...config, ...(settings?.behavior ?? {}) }
  }

  function start() {
    startReminders()

    playAnimation('waving', {
      onEnd: () => {
        playAnimation('idle')
        scheduleNext(1500)
      },
    })

    showBubble(pickLine('greeting'))
  }

  window.petBehavior = {
    start,
    pause,
    resume,
    wake,
    sleepNow: goSleep,
    notifyInteraction,
    applySettings,
    setChatBusy,
    applyModes,
    getModes: () => ({ ...modes }),

    // Pengingat aslinya dipicu timer; dibuka juga supaya bisa diuji manual
    remindWater: () => playReminder('waterReminder', 'waterReminder'),
    remindSleep: () => playReminder('hugPlushie', 'sleepReminder'),

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
