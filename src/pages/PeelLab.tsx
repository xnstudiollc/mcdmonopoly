import { useMemo, useState } from 'react'
import { peelAudio } from '../lib/audio.ts'
import { stampCardSpec } from '../lib/cards.ts'
import { useReducedMotion } from '../lib/useReducedMotion.ts'
import { defaultPeelConfig, peelConfigFields, type PeelConfig } from '../peel/peelConfig.ts'
import { PeelStage } from '../peel/PeelStage.tsx'

const LAB_SURFACE = '/assets/items/large-drink.svg'
const LAB_STICKERS = [{ id: 'lab', x: 0.5, y: 0.4, size: 0.5, rotation: 0 }]

export function PeelLab() {
  const [config, setConfig] = useState<PeelConfig>(defaultPeelConfig)
  const [session, setSession] = useState(0)
  const [status, setStatus] = useState('Grab the sticker by an edge or corner.')
  const reducedMotion = useReducedMotion()

  const callbacks = useMemo(
    () => ({
      onGrab: () => stampCardSpec(821, 'instant-food-medium-fries'),
      onDetach: () => setStatus('Torn free.'),
      onGone: () => setStatus('Gone. Press "Reset sticker" to try again.'),
      onHint: (m: string) => setStatus(m),
    }),
    [],
  )

  const changed = peelConfigFields.filter((f) => config[f.key] !== defaultPeelConfig[f.key])
  const snippet = `{\n${changed.map((f) => `  ${f.key}: ${config[f.key]},`).join('\n')}\n}`

  return (
    <main className="peel-lab">
      <div className="peel-lab__stage-wrap">
        <div className="spotlight" aria-hidden="true" />
        <PeelStage
          className="peel-lab__stage"
          itemImage={LAB_SURFACE}
          stickers={LAB_STICKERS}
          sessionKey={String(session)}
          config={config}
          reducedMotion={reducedMotion}
          audio={peelAudio}
          callbacks={callbacks}
          label="Peel lab test sticker"
        />
        <div className="peel-lab__status" role="status">
          {status}
        </div>
      </div>
      <aside className="peel-lab__panel">
        <h1>Peel lab</h1>
        <p className="muted small">
          Tune the peel live. Distances are in sticker heights, speeds in sticker heights per second. Copy the changed values
          into <code>src/peel/peelConfig.ts</code>.
        </p>
        <div className="row">
          <button
            className="btn btn--primary"
            onClick={() => {
              setSession((s) => s + 1)
              setStatus('Grab the sticker by an edge or corner.')
            }}
          >
            Reset sticker
          </button>
          <button className="btn" onClick={() => setConfig(defaultPeelConfig)}>
            Defaults
          </button>
        </div>
        <div className="sliders">
          {peelConfigFields.map((f) => (
            <label key={f.key} className="slider">
              <span className="slider__label">
                {f.label}
                <output>{config[f.key]}</output>
              </span>
              <input
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={config[f.key]}
                onChange={(e) => setConfig((c) => ({ ...c, [f.key]: Number(e.target.value) }))}
              />
            </label>
          ))}
        </div>
        {changed.length > 0 && <pre className="peel-lab__snippet">{snippet}</pre>}
      </aside>
    </main>
  )
}
