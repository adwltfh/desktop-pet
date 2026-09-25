const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const source = fs.readFileSync(
  path.join(__dirname, '../src/renderer/calendar-event/calendar-event.js'),
  'utf8',
)

function openPanel(create) {
  const elements = new Map()
  const selectors = [
    '#form', '#title', '#date', '#start-time', '#duration', '#calendar',
    '#submit', '#status', '#schedule', '#heading', '#schedule-day',
    '#schedule-month', '#schedule-title', '#schedule-date', '#schedule-time',
    '#schedule-duration', '#schedule-calendar', '#close', '#done',
    '#mascot-note', '#mascot-note-text',
  ]

  for (const selector of selectors) {
    elements.set(selector, {
      listeners: {},
      hidden: selector === '#schedule' || selector === '#status',
      value: '',
      textContent: '',
      addEventListener(name, handler) { this.listeners[name] = handler },
      appendChild() {},
      focus() { this.focused = true },
    })
  }

  const calls = { create: [], close: 0 }
  const window = {
    calendarEventAPI: {
      listCalendars: async () => [],
      create: async payload => {
        calls.create.push(payload)
        return create(payload)
      },
      close: () => { calls.close += 1 },
    },
    addEventListener() {},
  }

  vm.runInNewContext(source, {
    document: {
      querySelector: selector => elements.get(selector),
      createElement: () => ({ value: '', textContent: '' }),
    },
    window,
    console,
    Date,
    Intl,
  })

  return { elements, calls }
}

test('acara berhasil mengganti form dengan jadwal sampai pengguna menutupnya', async () => {
  const panel = openPanel(payload => ({ ok: true, ...payload, durationMinutes: 60, calendarName: null }))
  panel.elements.get('#title').value = '  Rapat tim  '
  panel.elements.get('#date').value = '2026-09-25'
  panel.elements.get('#start-time').value = '09:30'
  panel.elements.get('#duration').value = '60'

  await panel.elements.get('#form').listeners.submit({ preventDefault() {} })

  assert.equal(panel.calls.create[0].title, 'Rapat tim')
  assert.equal(panel.elements.get('#form').hidden, true)
  assert.equal(panel.elements.get('#schedule').hidden, false)
  assert.equal(panel.elements.get('#schedule').focused, true)
  assert.equal(panel.elements.get('#schedule-title').textContent, 'Rapat tim')
  assert.equal(panel.elements.get('#schedule-time').textContent, '09:30–10:30')
  assert.equal(panel.elements.get('#schedule-calendar').textContent, 'Kalender default')
  assert.equal(panel.elements.get('#mascot-note-text').textContent, 'Tercatat rapi oleh Jinshi')
  assert.equal(panel.calls.close, 0)
})

test('gagal membuat acara tetap menampilkan form dan alasan kegagalan', async () => {
  const panel = openPanel(() => ({ ok: false, error: 'Izin Calendar ditolak' }))
  panel.elements.get('#title').value = 'Rapat tim'

  await panel.elements.get('#form').listeners.submit({ preventDefault() {} })

  assert.equal(panel.elements.get('#form').hidden, false)
  assert.equal(panel.elements.get('#schedule').hidden, true)
  assert.equal(panel.elements.get('#status').textContent, 'Izin Calendar ditolak')
  assert.equal(panel.elements.get('#status').hidden, false)
  assert.equal(panel.elements.get('#mascot-note').hidden, true)
})
