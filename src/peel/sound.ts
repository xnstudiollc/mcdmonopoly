export class PeelAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private peelGain: GainNode | null = null
  private peelFilter: BiquadFilterNode | null = null
  private noise: AudioBuffer | null = null
  private muted: boolean

  constructor(muted: boolean) {
    this.muted = muted
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.02)
  }

  /** Must be called from a user gesture so browsers allow audio. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.9
    this.master.connect(ctx.destination)

    const len = ctx.sampleRate * 2
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    let crackle = 0
    for (let i = 0; i < len; i++) {
      if (Math.random() < 0.004) crackle = 1
      crackle *= 0.995
      data[i] = (Math.random() * 2 - 1) * (0.35 + crackle * 0.65)
    }

    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    this.peelFilter = ctx.createBiquadFilter()
    this.peelFilter.type = 'bandpass'
    this.peelFilter.Q.value = 0.9
    this.peelFilter.frequency.value = 1200
    this.peelGain = ctx.createGain()
    this.peelGain.gain.value = 0
    src.connect(this.peelFilter).connect(this.peelGain).connect(this.master)
    src.start()
  }

  /** speed is 0..1; advancing is false when the peel front isn't moving. */
  setPeel(speed: number, advancing: boolean) {
    if (!this.ctx || !this.peelGain || !this.peelFilter) return
    const t = this.ctx.currentTime
    const level = advancing ? Math.min(1, 0.08 + speed * 0.9) * 0.55 : 0
    this.peelGain.gain.setTargetAtTime(level, t, advancing ? 0.015 : 0.06)
    this.peelFilter.frequency.setTargetAtTime(700 + speed * 4200, t, 0.03)
  }

  pop(strength = 1) {
    if (!this.ctx || !this.master || !this.noise) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1800
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5 * strength, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    src.connect(hp).connect(g).connect(this.master)
    src.start(t, Math.random())
    src.stop(t + 0.2)

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(520, t)
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.12)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.0001, t)
    og.gain.exponentialRampToValueAtTime(0.18 * strength, t + 0.01)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    osc.connect(og).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.16)
  }

  stick() {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.08)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.12)
  }

  chime(rare: boolean) {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const notes = rare ? [784, 988, 1175, 1568] : [784, 1175]
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      const g = ctx.createGain()
      const start = t + i * 0.07
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(0.09, start + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.6)
      osc.connect(g).connect(this.master!)
      osc.start(start)
      osc.stop(start + 0.65)
    })
  }

  dispose() {
    void this.ctx?.close()
    this.ctx = null
  }
}
