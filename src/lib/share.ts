import { gameData } from '../engine/data.ts'
import type { CollectionState } from '../engine/collection.ts'
import { loadImage } from '../peel/textures.ts'

export async function renderBoardPng(collection: CollectionState): Promise<Blob> {
  const { board, properties } = gameData
  const img = await loadImage(board.image)
  const size = 1600
  const header = 170
  const footer = 60
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size + header + footer
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffc72c'
  ctx.font = '900 64px "Helvetica Neue", Arial, sans-serif'
  ctx.fillText('McD', 48, 98)
  const mcdWidth = ctx.measureText('McD').width
  ctx.fillStyle = '#da291c'
  ctx.fillRect(48 + mcdWidth + 12, 42, 360, 72)
  ctx.fillStyle = '#ffffff'
  ctx.fillText('MONOPOLY', 48 + mcdWidth + 26, 100)

  const have = collection.collected.length
  const total = properties.properties.length
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'right'
  ctx.font = '800 44px "Helvetica Neue", Arial, sans-serif'
  ctx.fillText(`${have} / ${total} stamps`, size - 48, 88)
  ctx.font = '500 26px "Helvetica Neue", Arial, sans-serif'
  ctx.fillStyle = '#bdbdbd'
  ctx.fillText(
    `${collection.peels} stickers peeled · ${collection.completedSets.length} sets complete`,
    size - 48,
    128,
  )

  ctx.drawImage(img, 0, header, size, size)

  const supportsFilter = 'filter' in ctx
  for (const s of board.spaces) {
    const x = s.x * size
    const y = header + s.y * size
    const w = s.w * size
    const h = s.h * size
    if (collection.collected.includes(s.stampNumber)) {
      ctx.save()
      ctx.strokeStyle = '#ffc72c'
      ctx.lineWidth = 6
      ctx.shadowColor = 'rgba(255, 199, 44, 0.9)'
      ctx.shadowBlur = 18
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6)
      ctx.restore()
    } else {
      ctx.save()
      if (supportsFilter) {
        ctx.filter = 'grayscale(1) brightness(0.55)'
        const sx = s.x * img.naturalWidth
        const sy = s.y * img.naturalHeight
        ctx.drawImage(img, sx, sy, s.w * img.naturalWidth, s.h * img.naturalHeight, x, y, w, h)
        ctx.filter = 'none'
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.fillRect(x, y, w, h)
      ctx.restore()
    }
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#8a8a8a'
  ctx.font = '500 20px "Helvetica Neue", Arial, sans-serif'
  ctx.fillText(
    "Unofficial fan-made simulator. Not affiliated with McDonald's or Hasbro. Non-commercial.",
    size / 2,
    size + header + 38,
  )

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not export image'))), 'image/png'),
  )
}

export async function downloadBoardPng(collection: CollectionState) {
  const blob = await renderBoardPng(collection)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mcdmonopoly-board.png'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}
