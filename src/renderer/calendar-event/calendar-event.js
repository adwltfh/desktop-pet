const form = document.querySelector('#form')
const titleInput = document.querySelector('#title')
const dateInput = document.querySelector('#date')
const startTimeInput = document.querySelector('#start-time')
const durationInput = document.querySelector('#duration')
const calendarSelect = document.querySelector('#calendar')
const submitButton = document.querySelector('#submit')
const statusElement = document.querySelector('#status')
const scheduleElement = document.querySelector('#schedule')
const mascotNote = document.querySelector('#mascot-note')

function localDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function setStatus(message) {
  statusElement.textContent = message
  statusElement.hidden = !message
  mascotNote.hidden = Boolean(message)
}

function formatSchedule(result) {
  const [year, month, day] = result.date.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const monthName = new Intl.DateTimeFormat('id-ID', { month: 'short' })
    .format(date).replace('.', '').toUpperCase()
  const fullDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
  const [hour, minute] = result.startTime.split(':').map(Number)
  const totalMinutes = hour * 60 + minute + result.durationMinutes
  const nextDayCount = Math.floor(totalMinutes / (24 * 60))
  const endHour = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')
  const endMinute = String(totalMinutes % 60).padStart(2, '0')

  document.querySelector('#schedule-day').textContent = String(day)
  document.querySelector('#schedule-month').textContent = monthName
  document.querySelector('#schedule-title').textContent = result.title
  document.querySelector('#schedule-title').title = result.title
  document.querySelector('#schedule-date').textContent = fullDate
  document.querySelector('#schedule-time').textContent = `${result.startTime}–${endHour}:${endMinute}${nextDayCount ? ` (+${nextDayCount} hari)` : ''}`
  document.querySelector('#schedule-duration').textContent = `${result.durationMinutes} menit`
  document.querySelector('#schedule-calendar').textContent = result.calendarName || 'Kalender default'
}

const nextSlot = new Date()
nextSlot.setMinutes(Math.ceil((nextSlot.getMinutes() + 1) / 30) * 30, 0, 0)
dateInput.value = localDate(nextSlot)
startTimeInput.value = `${String(nextSlot.getHours()).padStart(2, '0')}:${String(nextSlot.getMinutes()).padStart(2, '0')}`

window.calendarEventAPI.listCalendars().then(names => {
  for (const name of names) {
    const option = document.createElement('option')
    option.value = name
    option.textContent = name
    calendarSelect.appendChild(option)
  }
}).catch(error => console.error('Gagal mengambil daftar kalender:', error))

form.addEventListener('submit', async event => {
  event.preventDefault()
  const title = titleInput.value.trim()

  if (!title) {
    setStatus('Isi judul acara dulu, ya.')
    titleInput.focus()
    return
  }

  submitButton.disabled = true
  submitButton.textContent = 'Menyimpan...'
  setStatus('')

  try {
    const result = await window.calendarEventAPI.create({
      title,
      date: dateInput.value,
      startTime: startTimeInput.value,
      durationMinutes: Number(durationInput.value),
      calendarName: calendarSelect.value || undefined,
    })

    if (result?.ok) {
      formatSchedule(result)
      form.hidden = true
      scheduleElement.hidden = false
      document.querySelector('#heading').textContent = 'Jadwalmu siap!'
      document.querySelector('#mascot-note-text').textContent = 'Tercatat rapi oleh Jinshi'
      scheduleElement.focus()
    }
    else {
      setStatus(result?.error ?? 'Acara belum tersimpan. Coba lagi, ya.')
    }
  }
  catch (error) {
    setStatus(`Acara belum tersimpan: ${String(error?.message ?? error)}`)
  }
  finally {
    submitButton.disabled = false
    submitButton.textContent = 'Simpan acara'
  }
})

document.querySelector('#close').addEventListener('click', () => window.calendarEventAPI.close())
document.querySelector('#done').addEventListener('click', () => window.calendarEventAPI.close())

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    window.calendarEventAPI.close()
  }
})

titleInput.focus()
