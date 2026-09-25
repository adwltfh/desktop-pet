const test = require('node:test')
const assert = require('node:assert/strict')

test('Pomodoro tetap tepat saat dijeda, panel ditutup, dan sesi berganti', t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
  const timer = require('../src/main/pomodoro')
  const finished = []
  const actions = []
  timer.setOnChange((_state, phase, action) => {
    if (phase) finished.push(phase)
    if (action) actions.push(action)
  })

  assert.equal(timer.getState().remainingMs, 25 * 60 * 1000)
  timer.command('start')
  t.mock.timers.tick(10 * 60 * 1000)
  timer.command('pause')
  assert.equal(timer.getState().remainingMs, 15 * 60 * 1000)

  t.mock.timers.tick(30 * 60 * 1000)
  assert.equal(timer.getState().remainingMs, 15 * 60 * 1000)
  timer.command('start')
  t.mock.timers.tick(15 * 60 * 1000)

  assert.deepEqual(finished, ['focus'])
  assert.deepEqual(
    [timer.getState().phase, timer.getState().running, timer.getState().completedFocus],
    ['break', false, 1],
  )
  assert.deepEqual(actions.slice(0, 4), ['start', 'pause', 'start', 'finished'])

  timer.command('start')
  t.mock.timers.tick(5 * 60 * 1000)
  assert.deepEqual(finished, ['focus', 'break'])
  assert.equal(timer.getState().phase, 'focus')

  timer.command('skip')
  assert.equal(timer.getState().completedFocus, 1)
  assert.equal(timer.getState().phase, 'break')
  timer.command('start')
  t.mock.timers.tick(60 * 1000)
  timer.command('reset')
  assert.equal(timer.getState().remainingMs, 5 * 60 * 1000)
  assert.equal(timer.getState().running, false)

  timer.command('set-duration', 8)
  assert.equal(timer.getState().durationMs, 8 * 60 * 1000)
  timer.command('set-duration', 0)
  assert.equal(timer.getState().durationMs, 8 * 60 * 1000)
  timer.command('start')
  t.mock.timers.tick(8 * 60 * 1000)
  assert.equal(timer.getState().phase, 'focus')

  timer.command('set-duration', 40)
  assert.equal(timer.getState().remainingMs, 40 * 60 * 1000)
  timer.command('start')
  t.mock.timers.tick(40 * 60 * 1000)
  assert.equal(timer.getState().phase, 'break')
  assert.equal(timer.getState().durationMs, 8 * 60 * 1000)

  timer.command('start')
  t.mock.timers.tick(2 * 60 * 1000)
  timer.command('set-duration', 12)
  assert.equal(timer.getState().running, false)
  assert.equal(timer.getState().remainingMs, 12 * 60 * 1000)
  t.mock.timers.tick(20 * 60 * 1000)
  assert.equal(timer.getState().phase, 'break')
})
