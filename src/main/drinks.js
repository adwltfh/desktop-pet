const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const REMINDER_INTERVAL = 2 * 60 * 60 * 1000

function drinksFile() {
  return path.join(app.getPath('userData'), 'drinks.json')
}

function localDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

let cache = null

function readDrinks() {
  if (cache) {
    return cache
  }

  try {
    const saved = JSON.parse(fs.readFileSync(drinksFile(), 'utf8'))

    cache = {
      date: typeof saved?.date === 'string' ? saved.date : null,
      drinksToday: Number.isSafeInteger(saved?.drinksToday)
        ? Math.max(0, saved.drinksToday)
        : 0,
      lastReminderAt: Number.isFinite(saved?.lastReminderAt)
        ? saved.lastReminderAt
        : null,
      lastNotificationAt: Number.isFinite(saved?.lastNotificationAt)
        ? saved.lastNotificationAt
        : saved?.lastReminderAt ?? null,
    }
  }
  catch {
    cache = {
      date: null,
      drinksToday: 0,
      lastReminderAt: null,
      lastNotificationAt: null,
    }
  }

  return cache
}

function writeDrinks(patch) {
  cache = { ...readDrinks(), ...patch }

  const file = drinksFile()

  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf8')

  return cache
}

function checkDaily() {
  const state = readDrinks()
  const date = localDate()
  const now = Date.now()
  const dateChanged = state.date !== date
  const clockChanged = !Number.isFinite(state.lastReminderAt)
    || state.lastReminderAt > now
  const notificationClockChanged = !Number.isFinite(state.lastNotificationAt)
    || state.lastNotificationAt > now

  if (dateChanged || clockChanged || notificationClockChanged) {
    return {
      ...writeDrinks({
        date,
        drinksToday: dateChanged ? 0 : state.drinksToday,
        lastReminderAt: clockChanged ? now : state.lastReminderAt,
        lastNotificationAt: notificationClockChanged
          ? now
          : state.lastNotificationAt,
      }),
      dateChanged,
    }
  }

  return { ...state, dateChanged: false }
}

function adjustDrink(delta) {
  const state = checkDaily()
  const drinksToday = Math.max(0, state.drinksToday + delta)

  return writeDrinks({ drinksToday })
}

function reminderDue() {
  const state = checkDaily()

  return Date.now() - state.lastReminderAt >= REMINDER_INTERVAL
}

function notificationDue() {
  const state = checkDaily()

  return Date.now() - state.lastNotificationAt >= REMINDER_INTERVAL
}

function markNotificationSent() {
  checkDaily()

  return writeDrinks({ lastNotificationAt: Date.now() })
}

function acknowledgeReminder() {
  checkDaily()

  return writeDrinks({ lastReminderAt: Date.now() })
}

module.exports = {
  REMINDER_INTERVAL,
  checkDaily,
  adjustDrink,
  reminderDue,
  notificationDue,
  markNotificationSent,
  acknowledgeReminder,
}
