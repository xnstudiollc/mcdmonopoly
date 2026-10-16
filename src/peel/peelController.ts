import { solveFold, type Fold, type Vec2 } from './curl.ts'
import type { PeelConfig } from './peelConfig.ts'

export type PeelPhase = 'idle' | 'dragging' | 'returning' | 'detaching' | 'flying' | 'gone'

export interface FlyState {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  spin: number
  angle: number
  opacity: number
  t: number
}

const DEG = Math.PI / 180

export class PeelController {
  phase: PeelPhase = 'idle'
  fold: Fold | null = null
  fraction = 0
  speed = 0
  flutter = 0
  fly: FlyState = { x: 0, y: 0, z: 0, vx: 0, vy: 0, spin: 0, angle: 0, opacity: 1, t: 0 }

  private grab: Vec2 = { x: 0, y: 0 }
  private edgeNormal: Vec2 = { x: 0, y: 1 }
  private pointer: Vec2 = { x: 0, y: 0 }
  private lastPointer: Vec2 = { x: 0, y: 0 }
  private pos: Vec2 = { x: 0, y: 0 }
  private vel: Vec2 = { x: 0, y: 0 }
  private pointerVel: Vec2 = { x: 0, y: 0 }
  private radius = 0
  private engagement = 0
  private detachDir: Vec2 = { x: 0, y: 0 }
  private detachSpeed = 0
  private detachTime = 0
  private readonly height: number

  constructor(height: number) {
    this.height = height
  }

  get isActive(): boolean {
    return this.phase !== 'idle' && this.phase !== 'gone'
  }

  /** Smoothed pointer speed in sticker heights per second. */
  get normalizedSpeed(): number {
    return this.speed / this.height
  }

  begin(grab: Vec2, edgeNormal: Vec2, config: PeelConfig): void {
    this.phase = 'dragging'
    this.grab = { ...grab }
    this.edgeNormal = { ...edgeNormal }
    this.pointer = { ...grab }
    this.lastPointer = { ...grab }
    this.pos = { ...grab }
    this.vel = { x: 0, y: 0 }
    this.pointerVel = { x: 0, y: 0 }
    this.radius = config.minCurlRadius * this.height
    this.engagement = 0
    this.flutter = 0
  }

  move(p: Vec2): void {
    if (this.phase !== 'dragging') return
    this.pointer = { ...p }
  }

  /** Returns true when the release tears the sticker free. */
  release(config: PeelConfig, cancelled = false): boolean {
    if (this.phase !== 'dragging') return false
    const speedH = this.normalizedSpeed
    const fling = speedH >= config.flingSpeed && this.fraction >= config.minFlingFraction
    if (!cancelled && (this.fraction >= config.detachFraction || fling)) {
      const across = this.fold ? { x: -this.fold.nx, y: -this.fold.ny } : { x: 0, y: -1 }
      const pv = this.pointerVel
      const pvLen = Math.hypot(pv.x, pv.y)
      let dir = across
      if (pvLen > 1e-6) {
        const pd = { x: pv.x / pvLen, y: pv.y / pvLen }
        if (pd.x * across.x + pd.y * across.y > 0.2) dir = pd
      }
      this.detachDir = dir
      this.detachSpeed = Math.max(pvLen, config.autoPeelSpeed * this.height)
      this.detachTime = 0
      this.phase = 'detaching'
      return true
    }
    this.phase = 'returning'
    this.pointer = { ...this.grab }
    return false
  }

  update(dt: number, config: PeelConfig): boolean {
    if (this.phase === 'idle' || this.phase === 'gone') return false
    const h = this.height

    if (this.phase === 'flying') {
      const f = this.fly
      f.t += dt
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.vx *= Math.exp(-1.5 * dt)
      f.vy *= Math.exp(-1.5 * dt)
      f.z += h * 1.4 * dt
      f.angle += f.spin * dt
      const p = Math.min(1, f.t / config.flyDuration)
      f.opacity = 1 - p * p
      if (p >= 1) this.phase = 'gone'
      return true
    }

    const tau = Math.max(1e-3, config.velocitySmoothing)
    const blend = 1 - Math.exp(-dt / tau)
    const rawVx = (this.pointer.x - this.lastPointer.x) / dt
    const rawVy = (this.pointer.y - this.lastPointer.y) / dt
    this.pointerVel.x += (rawVx - this.pointerVel.x) * blend
    this.pointerVel.y += (rawVy - this.pointerVel.y) * blend
    this.lastPointer = { ...this.pointer }
    this.speed = Math.hypot(this.pointerVel.x, this.pointerVel.y)

    if (this.phase === 'detaching') {
      this.detachTime += dt
      this.pointer.x += this.detachDir.x * this.detachSpeed * dt
      this.pointer.y += this.detachDir.y * this.detachSpeed * dt
      this.detachSpeed *= 1 + 1.5 * dt
    }

    const returning = this.phase === 'returning'
    const k = returning ? config.springBackStiffness : config.followStiffness
    const zeta = returning ? config.springBackDamping : config.followDamping
    const c = 2 * zeta * Math.sqrt(k)
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)))
    const sdt = dt / steps
    for (let i = 0; i < steps; i++) {
      const ax = k * (this.pointer.x - this.pos.x) - c * this.vel.x
      const ay = k * (this.pointer.y - this.pos.y) - c * this.vel.y
      this.vel.x += ax * sdt
      this.vel.y += ay * sdt
      this.pos.x += this.vel.x * sdt
      this.pos.y += this.vel.y * sdt
    }

    const speedNorm = Math.min(1, this.normalizedSpeed / Math.max(0.1, config.speedForMaxCurl))
    const targetRadius =
      h * (config.minCurlRadius + (config.maxCurlRadius - config.minCurlRadius) * Math.pow(speedNorm, 0.8))
    this.radius += (targetRadius - this.radius) * (1 - Math.exp(-dt * config.radiusResponse))

    const flutterTarget = this.phase === 'dragging' || this.phase === 'detaching' ? speedNorm : 0
    this.flutter += (flutterTarget - this.flutter) * (1 - Math.exp(-dt * (flutterTarget > this.flutter ? 12 : 3)))

    const engageTarget = returning ? 0 : 1
    this.engagement += (engageTarget - this.engagement) * (1 - Math.exp(-dt * 18))

    this.fold = solveFold({
      grab: this.grab,
      pointer: this.pos,
      edgeNormal: this.edgeNormal,
      radius: this.radius,
      maxFoldAngle: config.maxFoldAngle * DEG,
      outwardLift: config.outwardLift * h,
      minLift: config.pinchLift * h * this.engagement,
    })

    if (returning) {
      const offset = Math.hypot(this.pos.x - this.grab.x, this.pos.y - this.grab.y)
      const v = Math.hypot(this.vel.x, this.vel.y)
      if (offset < h * 0.004 && v < h * 0.05 && this.engagement < 0.02) {
        this.phase = 'idle'
        this.fold = null
        this.fraction = 0
      }
    }

    if (this.phase === 'detaching' && (this.fraction >= 0.999 || this.detachTime > 0.9)) {
      this.phase = 'flying'
      const dir = this.detachDir
      const s = Math.min(this.detachSpeed, h * 30)
      this.fly = {
        x: 0,
        y: 0,
        z: 0,
        vx: dir.x * s * 0.9,
        vy: dir.y * s * 0.9,
        spin: (dir.x >= 0 ? -1 : 1) * (1.5 + Math.min(4, s / h / 6)),
        angle: 0,
        opacity: 1,
        t: 0,
      }
    }
    return true
  }
}
