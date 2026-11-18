import { useState, type PointerEvent } from 'react'
import { useWidth } from '../../hooks/useWidth'
import { formatShortDate } from '../../lib/time'
import { niceTicks } from './scale'

export interface Point {
  t: number
  v: number
}

interface Props {
  points: Point[]
  color: string
  format: (value: number) => string
  label: string
  height?: number
}

const M = { top: 12, right: 12, bottom: 24, left: 42 }
const DAY = 86_400_000

/** One series over time with a crosshair tooltip on the nearest point. */
export function LineChart({ points, color, format, label, height = 180 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const sorted = points.toSorted((a, b) => a.t - b.t)

  const tMin = sorted[0].t - (sorted.length === 1 ? DAY : 0)
  const tMax = sorted[sorted.length - 1].t + (sorted.length === 1 ? DAY : 0)
  const values = sorted.map((p) => p.v)
  const pad = (Math.max(...values) - Math.min(...values)) * 0.15 || Math.max(...values) * 0.05 || 1
  const ticks = niceTicks(Math.max(...values) + pad, 4, Math.max(0, Math.min(...values) - pad))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const plotW = Math.max(0, width - M.left - M.right)
  const plotH = height - M.top - M.bottom
  const x = (t: number) => M.left + ((t - tMin) / (tMax - tMin)) * plotW
  const y = (v: number) => M.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH
  const path = sorted.map((p, i) => `${i ? 'L' : 'M'}${x(p.t)},${y(p.v)}`).join('')
  const xTickCount = plotW > 360 ? 5 : 3
  const xTicks = Array.from({ length: xTickCount }, (_, i) => tMin + ((tMax - tMin) * i) / (xTickCount - 1))

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const px = event.clientX - event.currentTarget.getBoundingClientRect().left
    let best = 0
    sorted.forEach((p, i) => {
      if (Math.abs(x(p.t) - px) < Math.abs(x(sorted[best].t) - px)) best = i
    })
    setHover(best)
  }

  const hovered = hover === null ? null : sorted[hover]

  return (
    <div className="chart" ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={label}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
            <text className="axis" x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
              {Number(t.toFixed(2))}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text
            key={t}
            className="axis"
            x={x(t)}
            y={height - 6}
            textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
          >
            {formatShortDate(t)}
          </text>
        ))}
        {hovered && <line className="crosshair" x1={x(hovered.t)} x2={x(hovered.t)} y1={M.top} y2={M.top + plotH} />}
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {sorted.map((p, i) => (
          <circle
            key={p.t}
            className="dot"
            cx={x(p.t)}
            cy={y(p.v)}
            r={i === hover ? 5.5 : 4}
            fill={color}
          />
        ))}
      </svg>
      {hovered && (
        <div className="tooltip" style={{ left: Math.min(Math.max(x(hovered.t), 70), width - 70) }} role="status">
          <strong>{new Date(hovered.t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
          <span className="tooltip-row">
            <b>{format(hovered.v)}</b>
          </span>
        </div>
      )}
    </div>
  )
}
