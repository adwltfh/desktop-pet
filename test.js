;(() => {
  const listElement = document.querySelector('#list')
  const statusElement = document.querySelector('#status')
  const dialogueToggle = document.querySelector('#dialogue-toggle')

  const faceLeftButton = document.querySelector('#face-left')
  const faceRightButton = document.querySelector('#face-right')

  let buttons = []
  let playing = null

  function setStatus(text) {
    statusElement.textContent = text
  }

  function markPlaying(name) {
    playing = name

    for (const button of buttons) {
      button.classList.toggle('is-playing', button.dataset.name === name)
    }
  }

  function play(animation) {
    window.testerAPI.play(animation.name, dialogueToggle.checked)

    markPlaying(animation.name)

    setStatus(
      `${animation.name} - ${animation.frames} frame, ${animation.speed}ms`
      + (animation.loop ? ', loop' : ''),
    )
  }

  function createButton(animation) {
    const button = document.createElement('button')

    button.type = 'button'
    button.className = 'anim-button'
    button.dataset.name = animation.name

    const name = document.createElement('span')

    name.className = 'anim-button__name'
    name.textContent = animation.name

    const meta = document.createElement('span')

    meta.className = 'anim-button__meta'
    meta.textContent = [
      `${animation.frames} frame`,
      animation.loop ? 'loop' : 'sekali',
      animation.folder,
    ].filter(Boolean).join(' - ')

    button.append(name, meta)
    button.addEventListener('click', () => play(animation))

    return button
  }

  function setFacing(direction) {
    window.testerAPI.setFacing(direction)

    faceLeftButton.classList.toggle('is-active', direction === 'left')
    faceRightButton.classList.toggle('is-active', direction === 'right')
  }

  async function load() {
    const animations = await window.testerAPI.list()

    listElement.replaceChildren()

    if (!animations?.length) {
      const empty = document.createElement('p')

      empty.className = 'list__empty'
      empty.textContent = 'Renderer pet belum melapor. Coba buka ulang jendela ini.'

      listElement.append(empty)
      setStatus('kosong')

      return
    }

    buttons = animations.map(createButton)

    listElement.append(...buttons)
    setStatus(`${animations.length} animasi`)

    // Jendela dibuka ulang saat masih ada yang diputar
    if (playing) {
      markPlaying(playing)
    }
  }

  faceLeftButton.addEventListener('click', () => setFacing('left'))
  faceRightButton.addEventListener('click', () => setFacing('right'))

  document.querySelector('#random-button').addEventListener('click', () => {
    window.testerAPI.random()

    markPlaying(null)
    setStatus('animasi acak')
  })

  document.querySelector('#resume-button').addEventListener('click', () => {
    window.testerAPI.resume()

    markPlaying(null)
    setStatus('pet beraktivitas lagi')
  })

  setFacing('right')
  load()
})()
