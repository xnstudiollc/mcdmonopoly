import { useEffect, useRef } from 'react'
import type { StickerSpot } from '../engine/types.ts'
import type { PeelConfig } from './peelConfig.ts'
import { PeelScene, type PeelSceneCallbacks } from './PeelScene.ts'
import type { PeelAudio } from './sound.ts'

interface PeelStageProps {
  itemImage: string
  stickers: StickerSpot[]
  sessionKey: string
  config: PeelConfig
  reducedMotion: boolean
  audio: PeelAudio | null
  callbacks: PeelSceneCallbacks
  className?: string
  label: string
}

export function PeelStage({
  itemImage,
  stickers,
  sessionKey,
  config,
  reducedMotion,
  audio,
  callbacks,
  className,
  label,
}: PeelStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const configRef = useRef(config)
  const callbacksRef = useRef(callbacks)
  const stickersRef = useRef(stickers)

  useEffect(() => {
    configRef.current = config
    callbacksRef.current = callbacks
    stickersRef.current = stickers
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    // A fresh canvas per scene keeps WebGL contexts from leaking across remounts.
    const canvas = document.createElement('canvas')
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', label)
    canvas.style.cssText = 'display:block;width:100%;height:100%;'
    container.appendChild(canvas)
    const scene = new PeelScene({
      canvas,
      container,
      itemImage,
      stickers: stickersRef.current,
      getConfig: () => configRef.current,
      reducedMotion,
      audio,
      callbacks: {
        onGrab: (id) => callbacksRef.current.onGrab?.(id) ?? null,
        onDetach: (id) => callbacksRef.current.onDetach?.(id),
        onGone: (id) => callbacksRef.current.onGone?.(id),
        onHint: (m) => callbacksRef.current.onHint?.(m),
        onReady: () => callbacksRef.current.onReady?.(),
      },
    })
    return () => {
      scene.dispose()
      canvas.remove()
    }
  }, [itemImage, sessionKey, reducedMotion, audio, label])

  return <div ref={containerRef} className={className} style={{ position: 'relative' }} />
}
