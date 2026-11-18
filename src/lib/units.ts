import type { Settings } from '../types'

const ML_PER_OZ = 29.5735
const LB_PER_KG = 2.20462
const CM_PER_IN = 2.54

function round(value: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

/** Each measurement converts between its stored metric value and the unit the user picked. */
export const units = {
  volume: {
    label: (s: Settings) => s.volume,
    toDisplay: (ml: number, s: Settings) => (s.volume === 'oz' ? round(ml / ML_PER_OZ, 1) : Math.round(ml)),
    fromDisplay: (v: number, s: Settings) => (s.volume === 'oz' ? v * ML_PER_OZ : v),
  },
  weight: {
    label: (s: Settings) => s.weight,
    toDisplay: (kg: number, s: Settings) => round(s.weight === 'lb' ? kg * LB_PER_KG : kg, 2),
    fromDisplay: (v: number, s: Settings) => (s.weight === 'lb' ? v / LB_PER_KG : v),
  },
  length: {
    label: (s: Settings) => s.length,
    toDisplay: (cm: number, s: Settings) => round(s.length === 'in' ? cm / CM_PER_IN : cm, 1),
    fromDisplay: (v: number, s: Settings) => (s.length === 'in' ? v * CM_PER_IN : v),
  },
  temp: {
    label: (s: Settings) => `°${s.temp}`,
    toDisplay: (c: number, s: Settings) => round(s.temp === 'F' ? (c * 9) / 5 + 32 : c, 1),
    fromDisplay: (v: number, s: Settings) => (s.temp === 'F' ? ((v - 32) * 5) / 9 : v),
  },
} as const

export type Measure = keyof typeof units

/** "120 ml", "4.1 oz" */
export function formatMeasure(measure: Measure, metric: number, s: Settings): string {
  const u = units[measure]
  const label = u.label(s)
  return `${u.toDisplay(metric, s)}${label.startsWith('°') ? '' : ' '}${label}`
}
