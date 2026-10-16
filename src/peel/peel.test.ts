import { describe, expect, it } from 'vitest'
import { curlPoint, edgeNormalAt, solveFold, type CurlResult } from './curl.ts'
import { defaultPeelConfig } from './peelConfig.ts'
import { PeelController } from './peelController.ts'

const out = (): CurlResult => ({ x: 0, y: 0, z: 0, d: 0 })
const fold = { px: 0, py: 0, nx: 0, ny: 1, radius: 0.1 }

describe('curlPoint', () => {
  it('leaves points behind the fold line flat', () => {
    const r = curlPoint(0.3, -0.2, fold, out())
    expect(r).toMatchObject({ x: 0.3, y: -0.2, z: 0 })
  })

  it('wraps points around the cylinder', () => {
    const r = curlPoint(0, (Math.PI / 2) * 0.1, fold, out())
    expect(r.y).toBeCloseTo(0.1, 6)
    expect(r.z).toBeCloseTo(0.1, 6)
  })

  it('folds points past the half-turn back over the sticker at twice the radius', () => {
    const r = curlPoint(0, Math.PI * 0.1 + 0.25, fold, out())
    expect(r.y).toBeCloseTo(-0.25, 6)
    expect(r.z).toBeCloseTo(0.2, 6)
  })
})

describe('solveFold', () => {
  const base = { edgeNormal: { x: 0, y: 1 }, radius: 0.05, maxFoldAngle: (80 * Math.PI) / 180, outwardLift: 0.2, minLift: 0 }

  it('puts the grabbed point under the pointer once folded back', () => {
    const grab = { x: 0.1, y: 0.5 }
    const pointer = { x: 0.05, y: -0.1 }
    const f = solveFold({ ...base, grab, pointer })
    const r = curlPoint(grab.x, grab.y, f, out())
    expect(r.x).toBeCloseTo(pointer.x, 6)
    expect(r.y).toBeCloseTo(pointer.y, 6)
  })

  it('stays flat when the pointer has not moved', () => {
    const grab = { x: 0, y: 0.5 }
    const f = solveFold({ ...base, grab, pointer: grab })
    expect(curlPoint(grab.x, grab.y, f, out()).z).toBe(0)
  })

  it('curls the edge up instead of flipping the sticker on outward pulls', () => {
    const grab = { x: 0, y: 0.5 }
    const f = solveFold({ ...base, grab, pointer: { x: 0, y: 2 } })
    const r = curlPoint(grab.x, grab.y, f, out())
    expect(r.z).toBeGreaterThan(0)
    expect(r.z).toBeLessThanOrEqual(f.radius + 1e-9)
    expect(curlPoint(0, -0.5, f, out()).z).toBe(0)
  })

  it('limits how far the fold can swing away from the grabbed edge', () => {
    const f = solveFold({ ...base, grab: { x: 0, y: 0.5 }, pointer: { x: 3, y: 0.5 } })
    const angle = Math.acos(f.ny)
    expect(angle).toBeLessThanOrEqual(base.maxFoldAngle + 1e-9)
  })
})

describe('edgeNormalAt', () => {
  it('points to the nearest edge or corner', () => {
    expect(edgeNormalAt(0, 0.4, 2, 1)).toEqual({ x: 0, y: 1 })
    const right = edgeNormalAt(0.95, 0, 2, 1)
    expect(right.x).toBeCloseTo(1)
    expect(right.y).toBeCloseTo(0)
    const corner = edgeNormalAt(-1, -0.5, 2, 1)
    expect(corner.x).toBeLessThan(0)
    expect(corner.y).toBeLessThan(0)
  })
})

describe('PeelController', () => {
  const cfg = defaultPeelConfig
  const step = (c: PeelController, seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) c.update(1 / 60, cfg)
  }

  it('springs back and re-sticks when released early', () => {
    const c = new PeelController(1)
    c.begin({ x: 0, y: 0.5 }, { x: 0, y: 1 }, cfg)
    c.move({ x: 0, y: 0.3 })
    step(c, 0.3)
    c.fraction = 0.1
    expect(c.release(cfg)).toBe(false)
    expect(c.phase).toBe('returning')
    step(c, 3)
    expect(c.phase).toBe('idle')
    expect(c.fold).toBeNull()
  })

  it('tears free past the detach fraction, then flies off and disappears', () => {
    const c = new PeelController(1)
    c.begin({ x: 0, y: 0.5 }, { x: 0, y: 1 }, cfg)
    c.move({ x: 0, y: -0.4 })
    step(c, 0.3)
    c.fraction = cfg.detachFraction + 0.01
    expect(c.release(cfg)).toBe(true)
    expect(c.phase).toBe('detaching')
    c.fraction = 1
    step(c, 0.1)
    expect(c.phase).toBe('flying')
    step(c, cfg.flyDuration + 0.1)
    expect(c.phase).toBe('gone')
  })

  it('a fast flick tears the sticker free even below the detach fraction', () => {
    const c = new PeelController(1)
    c.begin({ x: 0, y: 0.5 }, { x: 0, y: 1 }, cfg)
    for (let i = 1; i <= 6; i++) {
      c.move({ x: 0, y: 0.5 - i * 0.4 })
      c.update(1 / 60, cfg)
    }
    c.fraction = cfg.minFlingFraction + 0.05
    expect(c.normalizedSpeed).toBeGreaterThan(cfg.flingSpeed)
    expect(c.release(cfg)).toBe(true)
  })

  it('pointercancel always springs back', () => {
    const c = new PeelController(1)
    c.begin({ x: 0, y: 0.5 }, { x: 0, y: 1 }, cfg)
    c.fraction = 0.9
    expect(c.release(cfg, true)).toBe(false)
    expect(c.phase).toBe('returning')
  })

  it('uses a tighter curl for slow drags than for fast ones', () => {
    const slow = new PeelController(1)
    const fast = new PeelController(1)
    slow.begin({ x: 0, y: 0.5 }, { x: 0, y: 1 }, cfg)
    fast.begin({ x: 0, y: 0.5 }, { x: 0, y: 1 }, cfg)
    for (let i = 1; i <= 30; i++) {
      slow.move({ x: 0, y: 0.5 - i * 0.01 })
      fast.move({ x: 0, y: 0.5 - i * 0.2 })
      slow.update(1 / 60, cfg)
      fast.update(1 / 60, cfg)
    }
    expect(fast.fold!.radius).toBeGreaterThan(slow.fold!.radius * 2)
  })
})
