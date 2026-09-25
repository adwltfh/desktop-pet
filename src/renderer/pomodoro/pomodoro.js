const timeElement = document.querySelector('#time')
const durationSlider = document.querySelector('#duration-slider')
const progressRing = document.querySelector('#progress-ring')
const progressDot = document.querySelector('#progress-dot')
const startButton = document.querySelector('#start')
const pauseButton = document.querySelector('#pause')
const petImage = document.querySelector('.pet')

const blinkSequence = [...Array(18).fill(1), 2, 3, 4, 5, 6]
let blinkStep = 0
let currentFrame = 1

for (let frame = 2; frame <= 6; frame += 1) {
  const image = new Image()
  image.src = `../pet/assets/frames/idle-blink/${String(frame).padStart(2, '0')}.png`
}

const segmentNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
const glyphs = {
  0: 'abcdef',
  1: 'bc',
  2: 'abdeg',
  3: 'abcdg',
  4: 'bcfg',
  5: 'acdfg',
  6: 'acdefg',
  7: 'abc',
  8: 'abcdefg',
  9: 'abcdfg',
}

const digitSegments = []
timeElement.textContent = ''

for (let position = 0; position < 5; position += 1) {
  if (position === 2) {
    const colon = document.createElement('span')
    colon.className = 'colon'

    for (let dot = 0; dot < 2; dot += 1) {
      const mark = document.createElement('span')
      mark.className = 'colon-dot'
      colon.append(mark)
    }

    timeElement.append(colon)
    continue
  }

  const digit = document.createElement('span')
  digit.className = 'segment-digit'
  const segments = []

  for (const name of segmentNames) {
    const segment = document.createElement('span')
    segment.className = `segment seg-${name}`
    digit.append(segment)
    segments.push(segment)
  }

  timeElement.append(digit)
  digitSegments.push(segments)
}

let shownTime = ''
let timer = null
let previewMinutes = null
let dragStartMinutes = null
let dragging = false

function paintTime(value) {
  if (value === shownTime) return

  for (const [index, character] of [...value.replace(':', '')].entries()) {
    const lit = glyphs[character]

    digitSegments[index].forEach((segment, segmentIndex) => {
      segment.classList.toggle('lit', lit.includes(segmentNames[segmentIndex]))
    })
  }

  shownTime = value
}

paintTime('25:00')

function remaining() {
  return timer?.running
    ? Math.max(0, timer.deadlineAt - Date.now())
    : timer?.remainingMs ?? 0
}

function selectedMinutes() {
  return previewMinutes ?? Math.round((timer?.durationMs ?? 25 * 60 * 1000) / 60000)
}

function render() {
  if (!timer) return

  const minutes = selectedMinutes()
  const ms = previewMinutes === null ? remaining() : minutes * 60 * 1000
  const seconds = Math.ceil(ms / 1000)
  const minutesPart = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secondsPart = String(seconds % 60).padStart(2, '0')
  const displayTime = `${minutesPart}:${secondsPart}`
  const range = timer.maxDurationMinutes - timer.minDurationMinutes
  const fraction = (minutes - timer.minDurationMinutes) / range
  const angle = fraction * Math.PI * 2 - Math.PI / 2

  paintTime(displayTime)
  document.body.classList.toggle('running', timer.running)
  timeElement.setAttribute('aria-label', `${timer.phase === 'break' ? 'Istirahat' : 'Fokus'} ${displayTime}`)
  durationSlider.setAttribute('aria-valuenow', String(minutes))
  durationSlider.setAttribute('aria-valuetext', `${minutes} menit`)
  progressRing.style.strokeDasharray = `${fraction * 100} 100`
  progressDot.setAttribute('cx', String(80 + 69 * Math.cos(angle)))
  progressDot.setAttribute('cy', String(80 + 69 * Math.sin(angle)))
  startButton.disabled = timer.running || previewMinutes !== null
  pauseButton.disabled = !timer.running || previewMinutes !== null
}

async function command(action, minutes) {
  try {
    timer = await window.pomodoroAPI.command(action, minutes)
  }
  catch (error) {
    console.error('Gagal mengubah Pomodoro:', error)
  }
  finally {
    previewMinutes = null
    render()
  }
}

function minutesFromPointer(event) {
  const bounds = durationSlider.getBoundingClientRect()
  const x = (event.clientX - bounds.left) * 160 / bounds.width - 80
  const y = (event.clientY - bounds.top) * 160 / bounds.height - 80
  const distance = Math.hypot(x, y)

  if (distance < 52 || distance > 86) return null

  const angle = (Math.atan2(y, x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)
  const fraction = angle / (Math.PI * 2)

  return Math.round(
    timer.minDurationMinutes
      + fraction * (timer.maxDurationMinutes - timer.minDurationMinutes),
  )
}

durationSlider.addEventListener('pointerdown', event => {
  if (!timer) return

  const minutes = minutesFromPointer(event)
  if (minutes === null) return

  dragging = true
  dragStartMinutes = selectedMinutes()
  previewMinutes = minutes
  durationSlider.setPointerCapture(event.pointerId)
  render()
})

durationSlider.addEventListener('pointermove', event => {
  if (!dragging) return

  const minutes = minutesFromPointer(event)
  if (minutes !== null) {
    previewMinutes = minutes
    render()
  }
})

durationSlider.addEventListener('pointerup', event => {
  if (!dragging) return

  durationSlider.releasePointerCapture(event.pointerId)
  dragging = false
  const minutes = previewMinutes

  if (minutes !== dragStartMinutes) {
    command('set-duration', minutes)
  }
  else {
    previewMinutes = null
    render()
  }
})

durationSlider.addEventListener('pointercancel', () => {
  dragging = false
  previewMinutes = null
  render()
})

durationSlider.addEventListener('keydown', event => {
  if (!timer) return

  const current = selectedMinutes()
  let next = current

  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next += 1
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next -= 1
  else if (event.key === 'Home') next = timer.minDurationMinutes
  else if (event.key === 'End') next = timer.maxDurationMinutes
  else return

  event.preventDefault()
  next = Math.max(timer.minDurationMinutes, Math.min(timer.maxDurationMinutes, next))

  if (next !== current) {
    previewMinutes = next
    render()
    command('set-duration', next)
  }
})

startButton.addEventListener('click', () => command('start'))
pauseButton.addEventListener('click', () => command('pause'))
document.querySelector('#reset').addEventListener('click', () => command('reset'))

window.pomodoroAPI.onUpdate(next => {
  timer = next
  render()
})

window.pomodoroAPI.get().then(next => {
  timer = next
  render()
}).catch(error => {
  console.error('Gagal membaca Pomodoro:', error)
})

setInterval(render, 250)

setInterval(() => {
  blinkStep = timer?.running ? (blinkStep + 1) % blinkSequence.length : 0
  const frame = blinkSequence[blinkStep]

  if (frame !== currentFrame) {
    currentFrame = frame
    petImage.src = `../pet/assets/frames/idle-blink/${String(frame).padStart(2, '0')}.png`
  }
}, 200)
