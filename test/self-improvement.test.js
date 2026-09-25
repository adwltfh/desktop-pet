const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

function tmpMemoryDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jinshi-self-improvement-'))
}

test('addEntry mencatat entry & removeEntry (urungkan) menghapusnya', () => {
  const selfImprovement = require('../src/main/self-improvement')
  const dir = tmpMemoryDir()

  const entry = selfImprovement.addEntry(dir, { type: 'manual', text: '  Panggil aku daw-chan  ' })

  assert.equal(entry.type, 'manual')
  assert.equal(entry.text, 'Panggil aku daw-chan')
  assert.ok(entry.id)

  let listed = selfImprovement.listEntries(dir)
  assert.equal(listed.entries.length, 1)
  assert.equal(listed.entries[0].id, entry.id)

  const afterUndo = selfImprovement.removeEntry(dir, entry.id)
  assert.equal(afterUndo.entries.length, 0)

  listed = selfImprovement.listEntries(dir)
  assert.equal(listed.entries.length, 0)
})

test('recordTurn menaikkan totalTurns tiap giliran', () => {
  const selfImprovement = require('../src/main/self-improvement')
  const dir = tmpMemoryDir()

  selfImprovement.recordTurn(dir, 'halo Jinshi')
  selfImprovement.recordTurn(dir, 'apa kabar')

  assert.equal(selfImprovement.listEntries(dir).totalTurns, 2)
})

test('recordTurn membuat entry kebiasaan tiap HABIT_INTERVAL giliran & reset tally', () => {
  const selfImprovement = require('../src/main/self-improvement')
  const dir = tmpMemoryDir()
  const interval = selfImprovement.HABIT_INTERVAL

  for (let i = 0; i < interval - 1; i++) {
    selfImprovement.recordTurn(dir, 'tolong catatin ide ini ya')
  }

  let { entries, totalTurns } = selfImprovement.listEntries(dir)
  assert.equal(totalTurns, interval - 1)
  assert.equal(entries.filter(entry => entry.type === 'habit').length, 0)

  selfImprovement.recordTurn(dir, 'tolong catatin lagi')

  ;({ entries, totalTurns } = selfImprovement.listEntries(dir))
  assert.equal(totalTurns, interval)

  const habitEntries = entries.filter(entry => entry.type === 'habit')
  assert.equal(habitEntries.length, 1)
  assert.match(habitEntries[0].text, /Paling sering minta: catatan \(\d+x\)/)
  assert.equal(habitEntries[0].source, `dari giliran ke-${interval}`)

  // Giliran berikutnya (kategori beda) tidak langsung bikin entry kebiasaan
  // baru lagi -- tally sudah direset, harus nunggu HABIT_INTERVAL lagi.
  selfImprovement.recordTurn(dir, 'bikinin dokumen laporan')

  const afterReset = selfImprovement.listEntries(dir)
  assert.equal(afterReset.entries.filter(entry => entry.type === 'habit').length, 1)
})

test('pesan tanpa kata kunci kategori tidak memicu ringkasan kebiasaan', () => {
  const selfImprovement = require('../src/main/self-improvement')
  const dir = tmpMemoryDir()
  const interval = selfImprovement.HABIT_INTERVAL

  for (let i = 0; i < interval; i++) {
    selfImprovement.recordTurn(dir, 'cuma ngobrol santai aja')
  }

  const { entries, totalTurns } = selfImprovement.listEntries(dir)
  assert.equal(totalTurns, interval)
  assert.equal(entries.filter(entry => entry.type === 'habit').length, 0)
})

test('listEntries/removeEntry pada memoryDir kosong tidak crash', () => {
  const selfImprovement = require('../src/main/self-improvement')
  const dir = tmpMemoryDir()

  assert.deepEqual(selfImprovement.listEntries(dir), { entries: [], totalTurns: 0 })
  assert.deepEqual(selfImprovement.removeEntry(dir, 'tidak-ada'), { entries: [], totalTurns: 0 })
})
