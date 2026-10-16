import { PeelAudio } from '../peel/sound.ts'
import { useGame } from '../state/store.ts'

export const peelAudio = new PeelAudio(useGame.getState().muted)

useGame.subscribe((s, prev) => {
  if (s.muted !== prev.muted) peelAudio.setMuted(s.muted)
})
