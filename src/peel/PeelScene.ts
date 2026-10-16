import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { StickerSpot } from '../engine/types.ts'
import { curlPoint, edgeDistance, edgeNormalAt, type CurlResult } from './curl.ts'
import type { PeelConfig } from './peelConfig.ts'
import { PeelController } from './peelController.ts'
import type { PeelAudio } from './sound.ts'
import {
  STICKER_FRONT_URL,
  cardTexture,
  drawStampCard,
  itemTexture,
  loadImage,
  stickerBackTexture,
  stickerFrontTexture,
  type CardSpec,
} from './textures.ts'

export interface PeelSceneCallbacks {
  /** Called the first time a sticker is touched; returns what's printed underneath. */
  onGrab?: (stickerId: string) => CardSpec | null
  /** Called the moment a release tears the sticker free. */
  onDetach?: (stickerId: string) => void
  onGone?: (stickerId: string) => void
  onHint?: (message: string) => void
  onReady?: () => void
}

export interface PeelSceneOptions {
  canvas: HTMLCanvasElement
  container: HTMLElement
  itemImage: string
  stickers: StickerSpot[]
  getConfig: () => PeelConfig
  reducedMotion: boolean
  audio: PeelAudio | null
  callbacks: PeelSceneCallbacks
}

interface StickerEntry {
  spot: StickerSpot
  w: number
  h: number
  group: THREE.Group
  flyGroup: THREE.Group
  geometry: THREE.PlaneGeometry
  base: Float32Array
  frontMat: THREE.MeshStandardMaterial
  backMat: THREE.MeshStandardMaterial
  card: THREE.Mesh
  cardTex: THREE.CanvasTexture
  cardCanvas: HTMLCanvasElement
  cardCtx: CanvasRenderingContext2D
  shimmer: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  controller: PeelController
  spec: CardSpec | null
  shimmerT: number
  fadeT: number
  nudgeT: number
  flat: boolean
  goneNotified: boolean
}

const DEG = Math.PI / 180
const STICKER_Z = 0.0016
const CARD_Z = 0.0005
const SHADOW_Z = 0.0009

const shimmerVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const shimmerFragment = /* glsl */ `
uniform float uProgress;
uniform float uIntensity;
uniform float uGlow;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float x = vUv.x + (vUv.y - 0.5) * 0.45;
  float band = smoothstep(0.16, 0.0, abs(x - uProgress));
  float edge = max(smoothstep(0.08, 0.0, min(vUv.x, 1.0 - vUv.x)), smoothstep(0.16, 0.0, min(vUv.y, 1.0 - vUv.y)));
  float a = (band * 0.85 + edge * uGlow) * uIntensity;
  gl_FragColor = vec4(uColor * a, a);
}`

export class PeelScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(26, 1, 0.05, 20)
  private readonly raycaster = new THREE.Raycaster()
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  private readonly opts: PeelSceneOptions
  private readonly entries: StickerEntry[] = []
  private readonly disposables: { dispose(): void }[] = []
  private readonly resizeObserver: ResizeObserver
  private readonly tmp: CurlResult = { x: 0, y: 0, z: 0, d: 0 }
  private itemHeight = 1
  private active: StickerEntry | null = null
  private activePointer: number | null = null
  private lastFraction = 0
  private raf = 0
  private lastTime = 0
  private disposed = false
  private needsRender = true

  constructor(opts: PeelSceneOptions) {
    this.opts = opts
    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.setClearColor(0x000000, 0)

    this.camera.position.set(0, 0, 3)
    this.camera.lookAt(0, 0, 0)

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const key = new THREE.DirectionalLight(0xfff6e8, 1.5)
    key.position.set(-0.9, 1.1, 2.2)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.radius = 5
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.001
    const sc = key.shadow.camera
    sc.left = -0.8
    sc.right = 0.8
    sc.top = 0.8
    sc.bottom = -0.8
    sc.near = 0.5
    sc.far = 5
    this.scene.add(key)
    this.scene.add(key.target)

    opts.canvas.style.touchAction = 'none'
    opts.canvas.addEventListener('pointerdown', this.onPointerDown)
    opts.canvas.addEventListener('pointermove', this.onPointerMove)
    opts.canvas.addEventListener('pointerup', this.onPointerUp)
    opts.canvas.addEventListener('pointercancel', this.onPointerCancel)
    opts.canvas.addEventListener('lostpointercapture', this.onLostCapture)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(opts.container)
    this.resize()

    void this.load()
  }

  private async load() {
    const [itemImg, stickerImg] = await Promise.all([
      loadImage(this.opts.itemImage),
      loadImage(STICKER_FRONT_URL),
    ])
    if (this.disposed) return
    const r = this.renderer

    const pmrem = new THREE.PMREMGenerator(r)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    room.dispose()
    pmrem.dispose()
    this.disposables.push(env)

    const itemAspect = (itemImg.naturalWidth || 1000) / (itemImg.naturalHeight || 1000)
    this.itemHeight = 1 / itemAspect
    const itemTex = itemTexture(itemImg, r)
    const itemGeo = new THREE.PlaneGeometry(1, this.itemHeight)
    // Unlit so scans keep their true colours; shadows land on a separate catcher plane.
    const itemMat = new THREE.MeshBasicMaterial({ map: itemTex, transparent: true, alphaTest: 0.02 })
    const item = new THREE.Mesh(itemGeo, itemMat)
    this.scene.add(item)
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.42, depthWrite: false })
    const shadowCatcher = new THREE.Mesh(itemGeo, shadowMat)
    shadowCatcher.position.z = SHADOW_Z
    shadowCatcher.receiveShadow = true
    this.scene.add(shadowCatcher)
    this.disposables.push(itemTex, itemGeo, itemMat, shadowMat)

    const stickerAspect = stickerImg.naturalWidth / stickerImg.naturalHeight
    const frontTex = stickerFrontTexture(stickerImg, r)
    const backTex = stickerBackTexture(stickerImg, r)
    this.disposables.push(frontTex, backTex)

    const config = this.opts.getConfig()
    for (const spot of this.opts.stickers) {
      const w = spot.size
      const h = w / stickerAspect
      const segX = Math.max(8, Math.round(config.segments))
      const segY = Math.max(6, Math.round((segX * h) / w))
      const geometry = new THREE.PlaneGeometry(w, h, segX, segY)
      const base = Float32Array.from(geometry.attributes.position!.array as ArrayLike<number>)

      const frontMat = new THREE.MeshStandardMaterial({
        map: frontTex,
        metalness: 0.35,
        roughness: 0.36,
        envMap: env,
        envMapIntensity: 0.35,
        alphaTest: 0.5,
        side: THREE.FrontSide,
        shadowSide: THREE.DoubleSide,
      })
      const backMat = new THREE.MeshStandardMaterial({
        map: backTex,
        color: 0xd4d7dc,
        metalness: 0.2,
        roughness: 0.6,
        envMap: env,
        envMapIntensity: 0.4,
        alphaTest: 0.5,
        side: THREE.BackSide,
      })
      const front = new THREE.Mesh(geometry, frontMat)
      front.castShadow = true
      const back = new THREE.Mesh(geometry, backMat)

      const flyGroup = new THREE.Group()
      flyGroup.position.z = STICKER_Z
      flyGroup.add(front, back)

      const { texture: cardTex, canvas: cardCanvas, ctx: cardCtx } = cardTexture(null, w / h, r)
      const cardGeo = new THREE.PlaneGeometry(w * 0.93, h * 0.86)
      const cardMat = new THREE.MeshBasicMaterial({ map: cardTex })
      const card = new THREE.Mesh(cardGeo, cardMat)
      card.position.z = CARD_Z

      const shimmerMat = new THREE.ShaderMaterial({
        vertexShader: shimmerVertex,
        fragmentShader: shimmerFragment,
        uniforms: {
          uProgress: { value: -1 },
          uIntensity: { value: 0 },
          uGlow: { value: 0 },
          uColor: { value: new THREE.Color('#ffd257') },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const shimmer = new THREE.Mesh(cardGeo, shimmerMat)
      shimmer.position.z = CARD_Z + 0.0003
      shimmer.visible = false

      const group = new THREE.Group()
      group.position.set((spot.x - 0.5) * 1, (0.5 - spot.y) * this.itemHeight, 0)
      group.rotation.z = -spot.rotation * DEG
      group.add(card, shimmer, flyGroup)
      this.scene.add(group)

      this.disposables.push(geometry, frontMat, backMat, cardTex, cardGeo, cardMat, shimmerMat)
      this.entries.push({
        spot,
        w,
        h,
        group,
        flyGroup,
        geometry,
        base,
        frontMat,
        backMat,
        card,
        cardTex,
        cardCanvas,
        cardCtx,
        shimmer,
        controller: new PeelController(h),
        spec: null,
        shimmerT: -1,
        fadeT: -1,
        nudgeT: -1,
        flat: true,
        goneNotified: false,
      })
    }

    this.fit()
    this.needsRender = true
    this.lastTime = performance.now()
    this.raf = requestAnimationFrame(this.tick)
    this.opts.callbacks.onReady?.()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    const c = this.opts.canvas
    c.removeEventListener('pointerdown', this.onPointerDown)
    c.removeEventListener('pointermove', this.onPointerMove)
    c.removeEventListener('pointerup', this.onPointerUp)
    c.removeEventListener('pointercancel', this.onPointerCancel)
    c.removeEventListener('lostpointercapture', this.onLostCapture)
    this.opts.audio?.setPeel(0, false)
    for (const d of this.disposables) d.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.opts.container
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.fit()
    this.needsRender = true
  }

  private fit() {
    const portrait = this.camera.aspect < 0.8
    const halfH = Math.max(this.itemHeight / 2, 0.5 / this.camera.aspect) * (portrait ? 1.0 : 1.1)
    this.camera.position.z = halfH / Math.tan((this.camera.fov / 2) * DEG)
    this.camera.updateProjectionMatrix()
  }

  private toWorld(e: PointerEvent): THREE.Vector3 | null {
    const rect = this.opts.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const hit = new THREE.Vector3()
    return this.raycaster.ray.intersectPlane(this.plane, hit)
  }

  private toLocal(entry: StickerEntry, world: THREE.Vector3) {
    const dx = world.x - entry.group.position.x
    const dy = world.y - entry.group.position.y
    const a = -entry.group.rotation.z
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) }
  }

  /** Touch input gets a margin around each sticker and a wider edge zone, since fingers are imprecise. */
  private hitTest(world: THREE.Vector3, coarse: boolean) {
    const zone = this.opts.getConfig().grabEdgeZone * (coarse ? 1.35 : 1)
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i]!
      const phase = entry.controller.phase
      if (phase !== 'idle' || entry.fadeT >= 0) continue
      const raw = this.toLocal(entry, world)
      const pad = coarse ? entry.h * 0.35 : 0
      if (Math.abs(raw.x) > entry.w / 2 + pad || Math.abs(raw.y) > entry.h / 2 + pad) continue
      const local = {
        x: Math.max(-entry.w / 2, Math.min(entry.w / 2, raw.x)),
        y: Math.max(-entry.h / 2, Math.min(entry.h / 2, raw.y)),
      }
      const grabbable = edgeDistance(local.x, local.y, entry.w, entry.h) <= zone * entry.h
      return { entry, local, grabbable }
    }
    return null
  }

  private ensureCard(entry: StickerEntry) {
    if (entry.spec) return
    const spec = this.opts.callbacks.onGrab?.(entry.spot.id) ?? null
    if (!spec) return
    entry.spec = spec
    drawStampCard(entry.cardCtx, entry.cardCanvas.width, entry.cardCanvas.height, spec)
    entry.cardTex.needsUpdate = true
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.activePointer !== null) return
    this.opts.audio?.unlock()
    const world = this.toWorld(e)
    if (!world) return
    const hit = this.hitTest(world, e.pointerType !== 'mouse')
    if (!hit) return
    e.preventDefault()

    if (this.opts.reducedMotion) {
      this.ensureCard(hit.entry)
      hit.entry.fadeT = 0
      this.opts.callbacks.onDetach?.(hit.entry.spot.id)
      this.opts.audio?.pop(0.6)
      this.needsRender = true
      return
    }

    if (!hit.grabbable) {
      hit.entry.nudgeT = 0
      this.opts.callbacks.onHint?.('Grab an edge or corner of the sticker to peel it')
      return
    }

    this.ensureCard(hit.entry)
    this.opts.canvas.setPointerCapture(e.pointerId)
    this.activePointer = e.pointerId
    this.active = hit.entry
    this.lastFraction = 0
    hit.entry.controller.begin(hit.local, edgeNormalAt(hit.local.x, hit.local.y, hit.entry.w, hit.entry.h), this.opts.getConfig())
    this.opts.canvas.style.cursor = 'grabbing'
    this.needsRender = true
  }

  private onPointerMove = (e: PointerEvent) => {
    const world = this.toWorld(e)
    if (!world) return
    if (this.active && e.pointerId === this.activePointer) {
      this.active.controller.move(this.toLocal(this.active, world))
      return
    }
    if (this.activePointer !== null || e.pointerType !== 'mouse') return
    const hit = this.hitTest(world, false)
    this.opts.canvas.style.cursor = hit ? (hit.grabbable || this.opts.reducedMotion ? 'grab' : 'pointer') : ''
  }

  private finishPointer(e: PointerEvent, cancelled: boolean) {
    if (e.pointerId !== this.activePointer) return
    const entry = this.active
    this.activePointer = null
    this.active = null
    this.opts.canvas.style.cursor = ''
    if (this.opts.canvas.hasPointerCapture(e.pointerId)) this.opts.canvas.releasePointerCapture(e.pointerId)
    this.opts.audio?.setPeel(0, false)
    if (!entry) return
    const torn = entry.controller.release(this.opts.getConfig(), cancelled)
    if (torn) {
      this.opts.audio?.pop(Math.min(1.2, 0.6 + entry.controller.normalizedSpeed / 20))
      this.opts.callbacks.onDetach?.(entry.spot.id)
    }
  }

  private onPointerUp = (e: PointerEvent) => this.finishPointer(e, false)
  private onPointerCancel = (e: PointerEvent) => this.finishPointer(e, true)
  private onLostCapture = (e: PointerEvent) => this.finishPointer(e, false)

  private deform(entry: StickerEntry, time: number, config: PeelConfig) {
    const fold = entry.controller.fold
    const pos = entry.geometry.attributes.position as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const base = entry.base
    if (!fold) {
      if (entry.flat) return
      arr.set(base)
      pos.needsUpdate = true
      entry.geometry.computeVertexNormals()
      entry.flat = true
      entry.controller.fraction = 0
      return
    }
    const h = entry.h
    const arc = Math.PI * fold.radius
    const amp = config.flutterAmplitude * h * entry.controller.flutter
    const omega = 2 * Math.PI * config.flutterFrequency
    let lifted = 0
    const count = base.length / 3
    for (let i = 0; i < count; i++) {
      const r = curlPoint(base[i * 3]!, base[i * 3 + 1]!, fold, this.tmp)
      let z = r.z
      if (r.d > 1e-5) lifted++
      if (amp > 0 && r.d > arc) {
        const t = (r.d - arc) / h
        z += amp * Math.min(1, t) * Math.sin(omega * time - t * 5)
      }
      arr[i * 3] = r.x
      arr[i * 3 + 1] = r.y
      arr[i * 3 + 2] = z
    }
    entry.controller.fraction = lifted / count
    pos.needsUpdate = true
    entry.geometry.computeVertexNormals()
    entry.geometry.computeBoundingSphere()
    entry.flat = false
  }

  private startShimmer(entry: StickerEntry) {
    entry.shimmerT = 0
    entry.shimmer.visible = true
    entry.shimmer.material.uniforms.uGlow!.value = entry.spec?.rare ? 0.9 : 0.25
    this.opts.audio?.chime(Boolean(entry.spec?.rare))
  }

  private tick = (now: number) => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.tick)
    const dt = Math.min(1 / 20, Math.max(1 / 240, (now - this.lastTime) / 1000))
    this.lastTime = now
    const time = now / 1000
    const config = this.opts.getConfig()
    let animating = false

    for (const entry of this.entries) {
      const c = entry.controller
      const before = c.phase
      if (c.update(dt, config)) {
        animating = true
        if (c.phase !== 'flying' && c.phase !== 'gone') this.deform(entry, time, config)
      }
      if (before === 'returning' && c.phase === 'idle') {
        this.deform(entry, time, config)
        this.opts.audio?.stick()
      }
      if (before === 'detaching' && c.phase === 'flying') {
        entry.frontMat.transparent = true
        entry.backMat.transparent = true
        entry.frontMat.alphaTest = 0.02
        entry.backMat.alphaTest = 0.02
        entry.frontMat.needsUpdate = true
        entry.backMat.needsUpdate = true
        this.startShimmer(entry)
      }
      if (c.phase === 'flying' || c.phase === 'gone') {
        const f = c.fly
        entry.flyGroup.position.set(f.x, f.y, STICKER_Z + f.z)
        entry.flyGroup.rotation.z = f.angle
        entry.frontMat.opacity = f.opacity
        entry.backMat.opacity = f.opacity
        if (c.phase === 'gone') this.markGone(entry)
      }

      if (entry.fadeT >= 0) {
        animating = true
        entry.fadeT += dt / 0.35
        const o = Math.max(0, 1 - entry.fadeT)
        if (!entry.frontMat.transparent) {
          entry.frontMat.transparent = true
          entry.frontMat.needsUpdate = true
        }
        entry.frontMat.opacity = o
        if (entry.fadeT >= 1) {
          entry.fadeT = -1
          c.phase = 'gone'
          this.markGone(entry)
          this.startShimmer(entry)
        }
      }

      if (entry.nudgeT >= 0) {
        animating = true
        entry.nudgeT += dt
        const s = 1 + 0.035 * Math.sin(entry.nudgeT * 34) * Math.exp(-entry.nudgeT * 7)
        entry.flyGroup.scale.set(s, s, 1)
        if (entry.nudgeT > 0.7) {
          entry.nudgeT = -1
          entry.flyGroup.scale.set(1, 1, 1)
        }
      }

      if (entry.shimmerT >= 0) {
        animating = true
        const dur = entry.spec?.rare ? 1.8 : 1.0
        entry.shimmerT += dt / dur
        const u = entry.shimmer.material.uniforms
        const passes = entry.spec?.rare ? 2 : 1
        const p = (entry.shimmerT * passes) % 1
        u.uProgress!.value = -0.3 + p * 1.6
        u.uIntensity!.value = Math.sin(Math.min(1, entry.shimmerT) * Math.PI)
        if (entry.shimmerT >= 1) {
          entry.shimmerT = -1
          entry.shimmer.visible = false
        }
      }
    }

    const a = this.active
    if (a && this.opts.audio) {
      const advancing = a.controller.fraction > this.lastFraction + 1e-4
      this.lastFraction = Math.max(this.lastFraction, a.controller.fraction)
      const speed = Math.min(1, a.controller.normalizedSpeed / Math.max(0.1, config.speedForMaxCurl))
      this.opts.audio.setPeel(speed, advancing || speed > 0.15)
    }

    if (animating || this.needsRender) {
      this.renderer.render(this.scene, this.camera)
      this.needsRender = false
    }
  }

  private markGone(entry: StickerEntry) {
    if (entry.goneNotified) return
    entry.goneNotified = true
    entry.flyGroup.visible = false
    this.opts.callbacks.onGone?.(entry.spot.id)
  }
}
