const { powerMonitor } = require('electron')
const { sendToPet } = require('./windows')

const RESUME_SETTLE_MS = 1200
const GREETING_DEDUPE_MS = 3000

function watchDeviceActivity() {
  let locked = powerMonitor.getSystemIdleState(1) === 'locked'
  let sessionInactive = false
  let resumeTimer = null
  let lastGreetingAt = Date.now() // startup renderer sudah menyapa sendiri

  function greet() {
    const now = Date.now()

    if (now - lastGreetingAt < GREETING_DEDUPE_MS) {
      return
    }

    lastGreetingAt = now
    sendToPet('pet:command', { action: 'device-active' })
  }

  powerMonitor.on('lock-screen', () => {
    locked = true
    clearTimeout(resumeTimer)
  })

  powerMonitor.on('resume', () => {
    clearTimeout(resumeTimer)
    resumeTimer = setTimeout(() => {
      resumeTimer = null

      if (!locked && powerMonitor.getSystemIdleState(1) !== 'locked') {
        greet()
      }
    }, RESUME_SETTLE_MS)
  })

  powerMonitor.on('unlock-screen', () => {
    locked = false
    sessionInactive = false
    clearTimeout(resumeTimer)
    resumeTimer = null
    greet()
  })

  powerMonitor.on('user-did-resign-active', () => {
    sessionInactive = true
  })

  powerMonitor.on('user-did-become-active', () => {
    if (sessionInactive && !locked) {
      sessionInactive = false
      greet()
    }
  })
}

module.exports = { watchDeviceActivity }
