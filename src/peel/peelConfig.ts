/**
 * Distances are in sticker heights and speeds in sticker heights per second,
 * so the feel stays the same whatever size a sticker is drawn at.
 */
export interface PeelConfig {
  segments: number
  grabEdgeZone: number
  pinchLift: number
  followStiffness: number
  followDamping: number
  velocitySmoothing: number
  minCurlRadius: number
  maxCurlRadius: number
  speedForMaxCurl: number
  radiusResponse: number
  maxFoldAngle: number
  outwardLift: number
  flutterAmplitude: number
  flutterFrequency: number
  detachFraction: number
  flingSpeed: number
  minFlingFraction: number
  autoPeelSpeed: number
  flyDuration: number
  springBackStiffness: number
  springBackDamping: number
}

export const defaultPeelConfig: PeelConfig = {
  segments: 56,
  grabEdgeZone: 0.34,
  pinchLift: 0.1,
  followStiffness: 900,
  followDamping: 0.82,
  velocitySmoothing: 0.07,
  minCurlRadius: 0.1,
  maxCurlRadius: 0.5,
  speedForMaxCurl: 9,
  radiusResponse: 9,
  maxFoldAngle: 80,
  outwardLift: 0.45,
  flutterAmplitude: 0.07,
  flutterFrequency: 7,
  detachFraction: 0.6,
  flingSpeed: 11,
  minFlingFraction: 0.18,
  autoPeelSpeed: 7,
  flyDuration: 0.75,
  springBackStiffness: 260,
  springBackDamping: 0.42,
}

export interface PeelConfigField {
  key: keyof PeelConfig
  label: string
  min: number
  max: number
  step: number
}

export const peelConfigFields: PeelConfigField[] = [
  { key: 'grabEdgeZone', label: 'Grab edge zone', min: 0.1, max: 0.5, step: 0.01 },
  { key: 'pinchLift', label: 'Pinch lift on grab', min: 0, max: 0.4, step: 0.01 },
  { key: 'followStiffness', label: 'Follow stiffness', min: 50, max: 2500, step: 10 },
  { key: 'followDamping', label: 'Follow damping ratio', min: 0.2, max: 1.5, step: 0.01 },
  { key: 'velocitySmoothing', label: 'Velocity smoothing (s)', min: 0.01, max: 0.3, step: 0.005 },
  { key: 'minCurlRadius', label: 'Curl radius, slow', min: 0.01, max: 0.3, step: 0.005 },
  { key: 'maxCurlRadius', label: 'Curl radius, fast', min: 0.05, max: 0.8, step: 0.005 },
  { key: 'speedForMaxCurl', label: 'Speed for max curl', min: 1, max: 30, step: 0.5 },
  { key: 'radiusResponse', label: 'Curl response', min: 1, max: 30, step: 0.5 },
  { key: 'maxFoldAngle', label: 'Max fold angle (deg)', min: 20, max: 90, step: 1 },
  { key: 'outwardLift', label: 'Outward pull lift', min: 0, max: 1, step: 0.01 },
  { key: 'flutterAmplitude', label: 'Flutter amplitude', min: 0, max: 0.3, step: 0.005 },
  { key: 'flutterFrequency', label: 'Flutter frequency (Hz)', min: 1, max: 20, step: 0.5 },
  { key: 'detachFraction', label: 'Detach at peeled fraction', min: 0.2, max: 1, step: 0.01 },
  { key: 'flingSpeed', label: 'Fling speed', min: 2, max: 40, step: 0.5 },
  { key: 'minFlingFraction', label: 'Min fraction for fling', min: 0, max: 0.6, step: 0.01 },
  { key: 'autoPeelSpeed', label: 'Auto-peel speed', min: 1, max: 30, step: 0.5 },
  { key: 'flyDuration', label: 'Fly-off duration (s)', min: 0.2, max: 2, step: 0.05 },
  { key: 'springBackStiffness', label: 'Spring-back stiffness', min: 30, max: 1200, step: 10 },
  { key: 'springBackDamping', label: 'Spring-back damping ratio', min: 0.1, max: 1.5, step: 0.01 },
]
