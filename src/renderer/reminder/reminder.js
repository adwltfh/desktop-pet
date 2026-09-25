const form = document.querySelector('#form')
const titleInput = document.querySelector('#title')
const dateInput = document.querySelector('#date')
const timeInput = document.querySelector('#time')
const listSelect = document.querySelector('#list')
const notesInput = document.querySelector('#notes')
const submitButton = document.querySelector('#submit')
const statusElement = document.querySelector('#status')
const noteElement = document.querySelector('#note')

function setStatus(message, tone = '') {
  statusElement.textContent = message
  statusElement.hidden = !message
  noteElement.hidden = Boolean(message)

  if (tone) {
    statusElement.setAttribute('data-tone', tone)
  }
  else {
    statusElement.removeAttribute('data-tone')
  }
}

window.reminderAPI.listLists().then(names => {
  for (const name of names) {
    const option = document.createElement('option')

    option.value = name
    option.textContent = name
    listSelect.appendChild(option)
  }
}).catch(error => console.error('Gagal mengambil daftar reminder:', error))

form.addEventListener('submit', async event => {
  event.preventDefault()

  submitButton.disabled = true
  setStatus('Membuat reminder...')

  try {
    const result = await window.reminderAPI.create({
      title: titleInput.value.trim(),
      date: dateInput.value || undefined,
      time: dateInput.value ? (timeInput.value || '09:00') : undefined,
      listName: listSelect.value || undefined,
      notes: notesInput.value.trim() || undefined,
    })

    if (result?.ok) {
      setStatus(
        result.date
          ? `Reminder "${result.title}" dibuat untuk ${result.date} jam ${result.time}.`
          : `Reminder "${result.title}" dibuat tanpa tanggal.`,
        'success',
      )
      setTimeout(() => window.reminderAPI.close(), 1100)
    }
    else {
      setStatus(result?.error ?? 'Gagal membuat reminder.', 'error')
    }
  }
  catch (error) {
    setStatus(String(error?.message ?? error), 'error')
  }
  finally {
    submitButton.disabled = false
  }
})

document.querySelector('#close').addEventListener('click', () => window.reminderAPI.close())

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    window.reminderAPI.close()
  }
})

titleInput.focus()
