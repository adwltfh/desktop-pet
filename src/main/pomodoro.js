const FOCUS_MS = 25 * 60 * 1000
const BREAK_MS = 5 * 60 * 1000
const MIN_MINUTES = 1
const MAX_MINUTES = 90

let phase = 'focus'
let remainingMs = FOCUS_MS
let focusMs = FOCUS_MS
let breakMs = BREAK_MS
let deadlineAt = null
let completedFocus = 0
let timeout = null
let onChange = () => {}

function duration() {
  return phase === 'focus' ? focusMs : breakMs
}

function snapshot() {
  return {
    phase,
    running: deadlineAt !== null,
    remainingMs: deadlineAt === null
      ? remainingMs
      : Math.max(0, deadlineAt - Date.now()),
    deadlineAt,
    durationMs: duration(),
    minDurationMinutes: MIN_MINUTES,
    maxDurationMinutes: MAX_MINUTES,
    completedFocus,
  }
}

function notify(finished = null, action = null) {
  onChange(snapshot(), finished, action)
}

function clearTimer() {
  if (timeout !== null) {
    clearTimeout(timeout)
    timeout = null
  }
}

function armTimer() {
  clearTimer()
  timeout = setTimeout(() => {
    timeout = null
    sync()

    // Timer dapat bangun sedikit lebih awal, atau jam sistem mundur.
    if (deadlineAt !== null) {
      armTimer()
    }
  }, Math.max(1, deadlineAt - Date.now()))
}

function sync() {
  if (deadlineAt === null || Date.now() < deadlineAt) {
    return
  }

  const finished = phase
  clearTimer()
  deadlineAt = null

  if (finished === 'focus') {
    completedFocus += 1
  }

  phase = finished === 'focus' ? 'break' : 'focus'
  remainingMs = duration()
  notify(finished, 'finished')
}

function getState() {
  sync()
  return snapshot()
}

function command(action, minutes) {
  sync()

  if (action === 'start' && deadlineAt === null) {
    deadlineAt = Date.now() + remainingMs
    armTimer()
    notify(null, action)
  }
  else if (action === 'pause' && deadlineAt !== null) {
    remainingMs = Math.max(0, deadlineAt - Date.now())
    deadlineAt = null
    clearTimer()
    notify(null, action)
  }
  else if (action === 'reset') {
    deadlineAt = null
    remainingMs = duration()
    clearTimer()
    notify(null, action)
  }
  else if (action === 'skip') {
    deadlineAt = null
    clearTimer()
    phase = phase === 'focus' ? 'break' : 'focus'
    remainingMs = duration()
    notify(null, action)
  }
  else if (action === 'set-duration'
    && Number.isInteger(minutes)
    && minutes >= MIN_MINUTES
    && minutes <= MAX_MINUTES) {
    const nextDuration = minutes * 60 * 1000

    if (phase === 'focus') {
      focusMs = nextDuration
    }
    else {
      breakMs = nextDuration
    }

    deadlineAt = null
    remainingMs = nextDuration
    clearTimer()
    notify(null, action)
  }

  return snapshot()
}

function setOnChange(handler) {
  onChange = handler
}

module.exports = { getState, command, setOnChange }
