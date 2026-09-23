const pet = document.querySelector('#pet')
const petSprite = document.querySelector('#pet-sprite')

function createFrames(folder, totalFrames) {
  return Array.from(
    { length: totalFrames },
    (_, index) => {
      const frameNumber = String(index + 1).padStart(2, '0')

      return `./assets/frames/${folder}/${frameNumber}.png`
    },
  )
}

const animations = {
  idle: {
    frames: createFrames('idle-blink', 6),
    speed: 220,
    loop: true,
  },

  walk: {
    frames: createFrames('walk-right', 8),
    speed: 110,
    loop: true,
  },

  run: {
    frames: createFrames('run-right', 8),
    speed: 75,
    loop: true,
  },

  sleep: {
    frames: createFrames('sleep', 4),
    speed: 350,
    loop: true,
  },

  greeting: {
    frames: createFrames('greeting', 5),
    speed: 180,
    loop: false,
  },

  celebrate: {
    frames: createFrames('celebrate', 8),
    speed: 150,
    loop: false,
  },

  lookAround: {
    frames: createFrames('look-around', 6),
    speed: 200,
    loop: true,
  },

  cuteGesture: {
    frames: createFrames('cute-gesture', 6),
    speed: 180,
    loop: false,
  },

  hugPlushie: {
    frames: createFrames('hug-plushie', 6),
    speed: 220,
    loop: false,
  },
}

let currentAnimation = 'idle'
let currentFrame = 0
let animationTimer = null

function playAnimation(name) {
  const animation = animations[name]

  if (!animation) {
    console.warn(`Animation "${name}" not found`)
    return
  }

  clearInterval(animationTimer)

  currentAnimation = name
  currentFrame = 0
  petSprite.src = animation.frames[0]

  animationTimer = setInterval(() => {
    currentFrame += 1

    if (currentFrame >= animation.frames.length) {
      if (animation.loop) {
        currentFrame = 0
      }
      else {
        clearInterval(animationTimer)

        // Setelah animasi selesai, kembali idle
        playAnimation('idle')

        return
      }
    }

    petSprite.src = animation.frames[currentFrame]
  }, animation.speed)
}

playAnimation('idle')

const interactionAnimations = [
  'greeting',
  'celebrate',
  'cuteGesture',
  'hugPlushie',
]

pet.addEventListener('click', () => {
  const randomIndex = Math.floor(
    Math.random() * interactionAnimations.length,
  )

  playAnimation(interactionAnimations[randomIndex])
})

window.playAnimation = playAnimation

// playAnimation('walk')
// playAnimation('sleep')
// playAnimation('celebrate')