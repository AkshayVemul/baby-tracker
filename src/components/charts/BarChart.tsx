import { useState } from 'react'
import { useWidth } from '../../hooks/useWidth'
import { formatShortDate } from '../../lib/time'
import { labelEvery, niceTicks, topRoundedRect } from './scale'

export interface BarSeries {
  label: string
  color: string
  /** One value per day, same order as `days`. */
  values: number[]
}

interface Props {
  days: number[]
  series: BarSeries[]
  /** Tooltip value, e.g. 1.5 -> "1h 30m". */
  format: (value: number) => string
  /** Axis tick, e.g. 1.5 -> "1.5h". */
  tick?: (value: number) => string
  label: string
  height?: number
}

const M = { top: 10, right: 4, bottom: 24, left: 38 }
const GAP = 2

/** Stacked daily bars with a per-day hover tooltip. */
export function BarChart({ days, series, format, tick = String, label, height = 190 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const totals = days.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0))
  const ticks = niceTicks(Math.max(...totals, 0) || 1)
  const yMax = ticks[ticks.length - 1]
  const plotW = Math.max(0, width - M.left - M.right)
  const plotH = height - M.top - M.bottom
  const band = plotW / Math.max(1, days.length)
  const barW = Math.max(2, Math.min(28, band * 0.68))
  const y = (v: number) => M.top + plotH - (v / yMax) * plotH
  const every = labelEvery(days.length, plotW)
  const short = days.length <= 7

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
            <text className="axis" x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
              {tick(t)}
            </text>
          </g>
        ))}
        {days.map((day, i) => {
          const cx = M.left + band * i + band / 2
          let base = 0
          const top = series.findLastIndex((s) => s.values[i] > 0)
          return (
            <g key={day}>
              {hover === i && <rect className="hover-band" x={cx - band / 2} y={M.top} width={band} height={plotH} />}
              {series.map((s, si) => {
                const v = s.values[i]
                if (v <= 0) return null
                const y0 = y(base)
                base += v
                const y1 = y(base)
                // A surface-coloured gap separates stacked segments.
                const h = Math.max(1, y0 - y1 - (si > 0 && base - v > 0 ? GAP : 0))
                const x = cx - barW / 2
                return si === top ? (
                  <path key={s.label} d={topRoundedRect(x, y1, barW, h, 4)} fill={s.color} />
                ) : (
                  <rect key={s.label} x={x} y={y1} width={barW} height={h} fill={s.color} />
                )
              })}
              {i % every === (days.length - 1) % every && (
                <text className="axis" x={cx} y={height - 6} textAnchor="middle">
                  {short ? new Date(day).toLocaleDateString([], { weekday: 'short' }) : formatShortDate(day)}
                </text>
              )}
              <rect
                className="hit"
                x={cx - band / 2}
                y={M.top}
                width={band}
                height={plotH}
                onPointerEnter={() => setHover(i)}
                onPointerDown={() => setHover(i)}
              />
            </g>
          )
        })}
        <line className="baseline" x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} />
      </svg>
      {hover !== null && (
        <div
          className="tooltip"
          style={{ left: Math.min(Math.max(M.left + band * hover + band / 2, 70), width - 70) }}
          role="status"
        >
          <strong>{new Date(days[hover]).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
          {series.map((s) => (
            <span key={s.label} className="tooltip-row">
              <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
              <b>{format(s.values[hover])}</b>
            </span>
          ))}
          {series.length > 1 && (
            <span className="tooltip-row total">
              Total <b>{format(totals[hover])}</b>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
