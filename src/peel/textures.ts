import * as THREE from 'three'

export interface CardSpec {
  title: string
  number: string
  requires: string
  prizeLabel: string
  prize: string
  accent: string
  instant: string | null
  rare: boolean
}

export const STICKER_FRONT_URL = '/assets/stickers/sticker-front.png'

const imageCache = new Map<string, Promise<HTMLImageElement>>()

export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = imageCache.get(url)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Failed to load ${url}`))
      img.src = url
    })
    imageCache.set(url, p)
  }
  return p
}

const toTexture = (canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) => {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  return tex
}

export function rasterize(img: HTMLImageElement, maxSize: number): HTMLCanvasElement {
  const w = img.naturalWidth || img.width || 1000
  const h = img.naturalHeight || img.height || 1000
  const scale = maxSize / Math.max(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

export function itemTexture(img: HTMLImageElement, renderer: THREE.WebGLRenderer) {
  const max = Math.min(2048, renderer.capabilities.maxTextureSize)
  return toTexture(rasterize(img, max), renderer)
}

export function stickerFrontTexture(img: HTMLImageElement, renderer: THREE.WebGLRenderer) {
  return toTexture(rasterize(img, 1064), renderer)
}

export function stickerBackTexture(img: HTMLImageElement, renderer: THREE.WebGLRenderer) {
  const canvas = rasterize(img, 1064)
  const ctx = canvas.getContext('2d')!
  const { width: w, height: h } = canvas
  ctx.globalCompositeOperation = 'source-in'
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#b7bcc4')
  g.addColorStop(0.35, '#dde0e5')
  g.addColorStop(0.6, '#a8aeb6')
  g.addColorStop(1, '#d0d4da')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-atop'
  ctx.save()
  ctx.translate(w, 0)
  ctx.scale(-1, 1)
  ctx.fillStyle = 'rgba(70, 76, 86, 0.42)'
  ctx.font = `600 ${Math.round(h * 0.07)}px "Helvetica Neue", Arial, sans-serif`
  ctx.textAlign = 'center'
  for (let row = 0; row < 5; row++) {
    const y = h * (0.22 + row * 0.15)
    ctx.fillText('SEE RULES · VOIR LES RÈGLEMENTS · MONOPOLY', w / 2 + (row % 2) * h * 0.2, y)
  }
  ctx.restore()
  return toTexture(canvas, renderer)
}

const fitText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight: string) => {
  let s = size
  do {
    ctx.font = `${weight} ${s}px "Helvetica Neue", Arial, sans-serif`
    if (ctx.measureText(text).width <= maxWidth) break
    s -= 1
  } while (s > 8)
  return s
}

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function drawStampCard(ctx: CanvasRenderingContext2D, w: number, h: number, spec: CardSpec) {
  ctx.clearRect(0, 0, w, h)
  const r = h * 0.07
  roundRect(ctx, 0, 0, w, h, r)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = spec.accent
  ctx.fillRect(0, 0, w, h * 0.055)
  ctx.restore()

  const pad = w * 0.05
  const inner = w - pad * 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#111111'

  const hasInstant = spec.instant !== null
  const top = hasInstant ? 0.25 : 0.3
  const step = hasInstant ? 0.15 : 0.18

  fitText(ctx, `${spec.title.toUpperCase()} • ${spec.number}`, inner, Math.round(h * 0.12), '800')
  ctx.fillText(`${spec.title.toUpperCase()} • ${spec.number}`, w / 2, h * top)

  fitText(ctx, spec.requires, inner, Math.round(h * 0.075), '700')
  ctx.fillStyle = '#333333'
  ctx.fillText(spec.requires, w / 2, h * (top + step * 0.75))

  ctx.fillStyle = '#6b6b6b'
  fitText(ctx, spec.prizeLabel.toUpperCase(), inner, Math.round(h * 0.06), '700')
  ctx.fillText(spec.prizeLabel.toUpperCase(), w / 2, h * (top + step * 1.45))

  ctx.fillStyle = '#111111'
  fitText(ctx, spec.prize.toUpperCase(), inner, Math.round(h * 0.11), '900')
  ctx.fillText(spec.prize.toUpperCase(), w / 2, h * (top + step * 2.25))

  if (spec.instant) {
    const bh = h * 0.2
    ctx.save()
    roundRect(ctx, pad, h - bh - h * 0.07, inner, bh, bh * 0.25)
    ctx.fillStyle = '#da291c'
    ctx.fill()
    ctx.fillStyle = '#ffc72c'
    const label = `INSTANT WIN: ${spec.instant.toUpperCase()}`
    fitText(ctx, label, inner * 0.92, Math.round(bh * 0.5), '900')
    ctx.textBaseline = 'middle'
    ctx.fillText(label, w / 2, h - bh / 2 - h * 0.07)
    ctx.restore()
  }
}

export function cardTexture(spec: CardSpec | null, aspect: number, renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = Math.round(1024 / aspect)
  const ctx = canvas.getContext('2d')!
  if (spec) drawStampCard(ctx, canvas.width, canvas.height, spec)
  else {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  return { texture: toTexture(canvas, renderer), canvas, ctx }
}
