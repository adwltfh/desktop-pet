const { PET_WIDTH, PET_HEIGHT } = require('./constants')

// Jendela pet punya ruang transparan untuk bubble. Yang kaku hanya area
// sprite di tengah bawah; sedikit ruang ekstra menutup ayunan/scale jalan.
const SPRITE_SIZE = 160
const COLLISION_GAP = 4

function bodySize(scale = 1) {
  const safeScale = Number.isFinite(scale)
    ? Math.min(Math.max(scale, 0.7), 1.6)
    : 1

  return Math.ceil(SPRITE_SIZE * safeScale * 1.15) + 4
}

function bodyRect(position, scale) {
  const size = bodySize(scale)
  const x = position.x + (PET_WIDTH - size) / 2
  const y = position.y + PET_HEIGHT - size

  return { x, y, right: x + size, bottom: y + size }
}

function overlaps(body, obstacle) {
  return body.x < obstacle.x + obstacle.width + COLLISION_GAP
    && body.right > obstacle.x - COLLISION_GAP
    && body.y < obstacle.y + obstacle.height + COLLISION_GAP
    && body.bottom > obstacle.y - COLLISION_GAP
}

function leftOf(obstacle, scale) {
  return Math.floor(
    obstacle.x - COLLISION_GAP - (PET_WIDTH + bodySize(scale)) / 2,
  )
}

function above(obstacle) {
  return obstacle.y - COLLISION_GAP - PET_HEIGHT
}

function resolvePosition(current, desired, obstacle, scale, clamp) {
  const next = clamp(desired.x, desired.y)

  if (!obstacle || !overlaps(bodyRect(next, scale), obstacle)) {
    return next
  }

  const previous = bodyRect(current, scale)
  const left = clamp(leftOf(obstacle, scale), next.y)
  const top = clamp(next.x, above(obstacle))
  const leftFits = !overlaps(bodyRect(left, scale), obstacle)
  const topFits = !overlaps(bodyRect(top, scale), obstacle)

  // Dari kiri ia berhenti di sisi counter; dari atas ia bisa meluncur
  // melintasinya tanpa turun menembus badge.
  if (previous.right <= obstacle.x && leftFits) {
    return left
  }

  if (previous.bottom <= obstacle.y && topFits) {
    return top
  }

  if (leftFits && topFits) {
    const leftTravel = Math.hypot(left.x - next.x, left.y - next.y)
    const topTravel = Math.hypot(top.x - next.x, top.y - next.y)

    return leftTravel <= topTravel ? left : top
  }

  return leftFits ? left : topFits ? top : next
}

function walkMaxX(y, obstacle, scale) {
  if (!obstacle) {
    return null
  }

  const body = bodyRect({ x: 0, y }, scale)

  if (body.y >= obstacle.y + obstacle.height + COLLISION_GAP
    || body.bottom <= obstacle.y - COLLISION_GAP) {
    return null
  }

  return leftOf(obstacle, scale)
}

module.exports = { bodySize, leftOf, resolvePosition, walkMaxX }
