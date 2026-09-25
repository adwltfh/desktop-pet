// Aksi macOS nyata (AppleScript/mdfind) dipakai bersama oleh dua pemanggil:
// mcp-tools-server.js (AI lewat chat) dan jendela aksi cepat di menu bar
// (dipicu klik langsung) -- supaya logikanya cuma ditulis sekali.
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const path = require('node:path')

const execFileAsync = promisify(execFile)

// String bebas (judul, catatan, nama kalender/daftar) ditaruh di dalam
// literal AppleScript lewat string builder di bawah -- ini mencegah string
// itu "kabur" dari literalnya dan menyuntik perintah AppleScript lain.
function escapeAppleScriptString(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function runAppleScript(script, { timeout = 30_000 } = {}) {
  const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout })

  return stdout.trim()
}

function parseDateTime(dateStr, timeStr) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr ?? '')

  if (!dateMatch) {
    throw new Error(`Format tanggal harus YYYY-MM-DD, dapat: "${dateStr}"`)
  }

  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeStr ?? '09:00')

  if (!timeMatch) {
    throw new Error(`Format jam harus HH:MM (24 jam), dapat: "${timeStr}"`)
  }

  const [, year, month, day] = dateMatch
  const [, hours, minutes] = timeMatch

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hours: Number(hours),
    minutes: Number(minutes),
  }
}

// Konstruksi tanggal AppleScript field demi field, bukan lewat string
// literal tanggal -- itu tergantung locale sistem dan gampang salah parse.
function appleScriptDateBlock(varName, { year, month, day, hours, minutes }) {
  return [
    `set ${varName} to current date`,
    `set year of ${varName} to ${year}`,
    `set month of ${varName} to ${month}`,
    `set day of ${varName} to ${day}`,
    `set hours of ${varName} to ${hours}`,
    `set minutes of ${varName} to ${minutes}`,
    `set seconds of ${varName} to 0`,
  ].join('\n')
}

// Daftar nama dikembalikan dipisah newline lewat text item delimiters
// eksplisit -- koersi list->string default AppleScript (", ") ambigu kalau
// salah satu nama itemnya sendiri mengandung koma.
async function listNames(appName, listExpr) {
  const script = [
    `tell application "${appName}"`,
    '  set AppleScript\'s text item delimiters to linefeed',
    `  set out to (${listExpr}) as string`,
    '  set AppleScript\'s text item delimiters to ""',
    '  return out',
    'end tell',
  ].join('\n')

  const raw = await runAppleScript(script)

  return raw.split('\n').map(item => item.trim()).filter(Boolean)
}

async function searchApp({ query, open = true }) {
  const escaped = query.replace(/'/g, "\\'")

  const mdfindQuery = `kMDItemContentType == 'com.apple.application-bundle' `
    + `&& kMDItemDisplayName == '*${escaped}*'c`

  const { stdout } = await execFileAsync('mdfind', [mdfindQuery])

  const matches = stdout
    .split('\n')
    .filter(Boolean)
    .map(appPath => path.basename(appPath, '.app'))
    .slice(0, 8)

  if (matches.length === 0) {
    return { status: 'none', matches: [] }
  }

  if (matches.length === 1 && open !== false) {
    await execFileAsync('open', ['-a', matches[0]])

    return { status: 'opened', matches, opened: matches[0] }
  }

  return { status: 'ambiguous', matches }
}

async function openApp(name) {
  await execFileAsync('open', ['-a', name])

  return { opened: name }
}

const SPOTIFY_ACTIONS = {
  play: 'play',
  pause: 'pause',
  next: 'next track',
  previous: 'previous track',
}

async function spotifyControl({ action, volume }) {
  if (action === 'now_playing') {
    return runAppleScript(
      'tell application "Spotify" to return (name of current track) '
      + '& " -- " & (artist of current track) & " (" & (player state as string) & ")"',
    )
  }

  if (action === 'volume') {
    await runAppleScript(`tell application "Spotify" to set sound volume to ${Math.round(volume)}`)

    return `Volume Spotify diatur ke ${Math.round(volume)}.`
  }

  await runAppleScript(`tell application "Spotify" to ${SPOTIFY_ACTIONS[action]}`)

  return `Spotify: ${action} berhasil.`
}

function listCalendars() {
  return listNames('Calendar', 'name of every calendar')
}

async function createCalendarEvent({ title, date, startTime, durationMinutes, calendarName }) {
  const start = parseDateTime(date, startTime)
  const duration = durationMinutes && durationMinutes > 0 ? Math.round(durationMinutes) : 60

  const calendarTarget = calendarName
    ? `calendar "${escapeAppleScriptString(calendarName)}"`
    : 'calendar 1'

  const script = [
    appleScriptDateBlock('startDate', start),
    `set endDate to startDate + (${duration} * minutes)`,
    'tell application "Calendar"',
    `  tell ${calendarTarget}`,
    `    make new event with properties {summary:"${escapeAppleScriptString(title)}", start date:startDate, end date:endDate}`,
    '  end tell',
    '  reload calendars',
    'end tell',
  ].join('\n')

  await runAppleScript(script)

  return { title, date, startTime, durationMinutes: duration, calendarName: calendarName || null }
}

function listReminderLists() {
  return listNames('Reminders', 'name of every list')
}

async function createReminder({ title, date, time, listName, notes }) {
  const lines = []
  let dueClause = ''
  let dueTime = null

  if (date) {
    dueTime = time || '09:00'
    const due = parseDateTime(date, dueTime)

    lines.push(appleScriptDateBlock('dueDate', due))
    dueClause = ', remind me date:dueDate'
  }

  const notesClause = notes ? `, body:"${escapeAppleScriptString(notes)}"` : ''

  const listTarget = listName
    ? `list "${escapeAppleScriptString(listName)}"`
    : 'default list'

  lines.push(
    'tell application "Reminders"',
    `  tell ${listTarget}`,
    `    make new reminder with properties {name:"${escapeAppleScriptString(title)}"${notesClause}${dueClause}}`,
    '  end tell',
    'end tell',
  )

  await runAppleScript(lines.join('\n'))

  return { title, date: date || null, time: dueTime, listName: listName || null }
}

const TODAY_AGENDA_SCRIPT = `
set todayStart to current date
set hours of todayStart to 0
set minutes of todayStart to 0
set seconds of todayStart to 0
set todayEnd to todayStart + (1 * days)

set eventLines to {}
tell application "Calendar"
  repeat with cal in calendars
    set theEvents to (every event of cal whose start date ≥ todayStart and start date < todayEnd)
    repeat with ev in theEvents
      set end of eventLines to (summary of ev) & " @ " & (start date of ev as string)
    end repeat
  end repeat
end tell

set reminderLines to {}
tell application "Reminders"
  repeat with lst in lists
    set theReminders to (every reminder of lst whose completed is false)
    repeat with r in theReminders
      set d to due date of r
      if d is not missing value then
        if d ≥ todayStart and d < todayEnd then
          set end of reminderLines to (name of r) & " @ " & (d as string)
        end if
      end if
    end repeat
  end repeat
end tell

set AppleScript's text item delimiters to linefeed
set eventText to eventLines as string
set reminderText to reminderLines as string
set AppleScript's text item delimiters to ""

return "ACARA HARI INI:" & linefeed & eventText & linefeed & linefeed & "REMINDER HARI INI:" & linefeed & reminderText
`.trim()

function listTodayAgenda() {
  return runAppleScript(TODAY_AGENDA_SCRIPT, { timeout: 60_000 })
}

module.exports = {
  searchApp,
  openApp,
  spotifyControl,
  listCalendars,
  createCalendarEvent,
  listReminderLists,
  createReminder,
  listTodayAgenda,
}
