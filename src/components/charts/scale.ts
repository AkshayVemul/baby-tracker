/** Round tick values from 0 (or `min`) to just above `max`, about `count` of them. */
export function niceTicks(max: number, count = 4, min = 0): number[] {
  const span = Math.max(max - min, 1e-9)
  const raw = span / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw
  const first = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = first; v < max + step * 0.999; v += step) ticks.push(Number(v.toFixed(10)))
  if (ticks.length < 2) ticks.push(first + step)
  return ticks
}

/** Picks every n-th label so they don't collide: about one per `minGap` pixels. */
export function labelEvery(count: number, width: number, minGap = 52): number {
  return Math.max(1, Math.ceil(count / Math.max(1, Math.floor(width / minGap))))
}

/** Rect path with only the top corners rounded — bars sit flat on the baseline. */
export function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}
