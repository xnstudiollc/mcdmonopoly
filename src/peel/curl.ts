export interface Vec2 {
  x: number
  y: number
}

/** Fold line through (px, py); (nx, ny) points from the line towards the lifted side. */
export interface Fold {
  px: number
  py: number
  nx: number
  ny: number
  radius: number
}

export interface CurlResult {
  x: number
  y: number
  z: number
  /** Signed distance past the fold line; > 0 means the point is lifted. */
  d: number
}

export function curlPoint(x: number, y: number, f: Fold, out: CurlResult): CurlResult {
  const d = (x - f.px) * f.nx + (y - f.py) * f.ny
  out.d = d
  if (d <= 0) {
    out.x = x
    out.y = y
    out.z = 0
    return out
  }
  const bx = x - d * f.nx
  const by = y - d * f.ny
  const r = Math.max(f.radius, 1e-5)
  const arc = Math.PI * r
  if (d < arc) {
    const theta = d / r
    const s = r * Math.sin(theta)
    out.x = bx + f.nx * s
    out.y = by + f.ny * s
    out.z = r * (1 - Math.cos(theta))
  } else {
    const back = d - arc
    out.x = bx - f.nx * back
    out.y = by - f.ny * back
    out.z = 2 * r
  }
  return out
}

const rotateToward = (from: Vec2, to: Vec2, maxAngle: number): Vec2 => {
  const angle = Math.atan2(from.x * to.y - from.y * to.x, from.x * to.x + from.y * to.y)
  if (Math.abs(angle) <= maxAngle) return to
  const a = Math.sign(angle) * maxAngle
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: from.x * c - from.y * s, y: from.x * s + from.y * c }
}

export interface FoldInput {
  grab: Vec2
  pointer: Vec2
  edgeNormal: Vec2
  radius: number
  maxFoldAngle: number
  outwardLift: number
  minLift: number
}

/**
 * Places the fold so the grabbed point lands under the pointer once the flap is
 * folded back over the sticker (fold line on the perpendicular bisector, offset
 * by half the curl's arc length). Pulls away from the sticker can't fold it
 * back, so they curl the grabbed edge up towards the viewer instead.
 */
export function solveFold(input: FoldInput): Fold {
  const { grab, pointer, edgeNormal, maxFoldAngle } = input
  const ux = grab.x - pointer.x
  const uy = grab.y - pointer.y
  const len = Math.hypot(ux, uy)
  let n: Vec2 = edgeNormal
  if (len > 1e-6) n = rotateToward(edgeNormal, { x: ux / len, y: uy / len }, maxFoldAngle)

  let radius = input.radius
  const along = ux * n.x + uy * n.y
  let dGrab: number
  if (along >= 0) {
    const arc = Math.PI * radius
    dGrab = along < arc ? along : (along + arc) / 2
  } else {
    dGrab = Math.min(-along * 0.6, input.outwardLift)
    radius = Math.max(radius, (dGrab * 2) / Math.PI)
  }
  if (dGrab < input.minLift) {
    dGrab = input.minLift
    radius = Math.max(radius, (dGrab * 2) / Math.PI)
  }
  return { px: grab.x - n.x * dGrab, py: grab.y - n.y * dGrab, nx: n.x, ny: n.y, radius }
}

/** Outward normal of the nearest edge, rounded off towards the corners. */
export function edgeNormalAt(lx: number, ly: number, w: number, h: number): Vec2 {
  const halfW = w / 2
  const halfH = h / 2
  const capStart = halfW - halfH
  const nx = Math.max(0, Math.abs(lx) - capStart) / halfH
  const ny = Math.abs(ly) / halfH
  const len = Math.hypot(nx, ny)
  if (len < 1e-6) return { x: 0, y: ly >= 0 ? 1 : -1 }
  return { x: (Math.sign(lx) * nx) / len, y: (Math.sign(ly) * ny) / len }
}

export function edgeDistance(lx: number, ly: number, w: number, h: number): number {
  return Math.min(w / 2 - Math.abs(lx), h / 2 - Math.abs(ly))
}
