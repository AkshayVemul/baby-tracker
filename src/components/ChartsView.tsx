import { useMemo, useState } from 'react'
import { dailyStats, summarize } from '../lib/stats'
import { formatDuration, formatShortDate, HOUR, lastDays, MINUTE } from '../lib/time'
import { formatMeasure, units } from '../lib/units'
import type { Entry, Settings } from '../types'
import { BarChart, type BarSeries } from './charts/BarChart'
import { ChartCard } from './charts/ChartCard'
import { LineChart } from './charts/LineChart'
import { RhythmChart } from './charts/RhythmChart'

interface Props {
  entries: Entry[]
  settings: Settings
  now: number
}

const RANGES = [7, 14, 30, 90] as const
const RHYTHM_MAX_DAYS = 30

const C = {
  night: 'var(--s-night)',
  nap: 'var(--s-nap)',
  breast: 'var(--s-breast)',
  bottle: 'var(--s-bottle)',
  solids: 'var(--s-solids)',
  wet: 'var(--s-wet)',
  dirty: 'var(--s-dirty)',
  mixed: 'var(--s-mixed)',
}

const hours = (h: number) => formatDuration(h * HOUR)
const count = (n: number) => String(Math.round(n * 10) / 10)

/** Table rows for a bar chart: date, each series, total. */
function tableFor(days: number[], series: BarSeries[], format: (v: number) => string) {
  return {
    columns: ['Day', ...series.map((s) => s.label), ...(series.length > 1 ? ['Total'] : [])],
    rows: days
      .map((day, i) => {
        const values = series.map((s) => s.values[i])
        const total = values.reduce((a, b) => a + b, 0)
        return [formatShortDate(day), ...values.map(format), ...(series.length > 1 ? [format(total)] : [])]
      })
      .toReversed(),
  }
}

export function ChartsView({ entries, settings, now }: Props) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(14)
  const days = useMemo(() => lastDays(range, now), [range, now])
  const stats = useMemo(() => dailyStats(entries, days, now), [entries, days, now])
  const summary = summarize(stats)
  const vol = units.volume

  const sleepSeries: BarSeries[] = [
    { label: 'Night', color: C.night, values: stats.map((s) => s.nightSleepMs / HOUR) },
    { label: 'Naps', color: C.nap, values: stats.map((s) => s.daySleepMs / HOUR) },
  ]
  const feedSeries: BarSeries[] = [
    { label: 'Breast', color: C.breast, values: stats.map((s) => s.breast) },
    { label: 'Bottle', color: C.bottle, values: stats.map((s) => s.bottle) },
    { label: 'Solids', color: C.solids, values: stats.map((s) => s.solids) },
  ]
  const bottleSeries: BarSeries[] = [
    { label: 'Bottle', color: C.bottle, values: stats.map((s) => vol.toDisplay(s.bottleMl, settings)) },
  ]
  const breastSeries: BarSeries[] = [
    { label: 'Breastfeeding', color: C.breast, values: stats.map((s) => s.breastMs / MINUTE) },
  ]
  const diaperSeries: BarSeries[] = [
    { label: 'Wet', color: C.wet, values: stats.map((s) => s.wet) },
    { label: 'Dirty', color: C.dirty, values: stats.map((s) => s.dirty) },
    { label: 'Both', color: C.mixed, values: stats.map((s) => s.mixed) },
  ]

  const growth = entries.filter((e) => e.type === 'growth')
  const weights = growth.filter((e) => e.weightKg !== undefined).map((e) => ({ t: e.start, v: units.weight.toDisplay(e.weightKg!, settings) }))
  const lengths = growth.filter((e) => e.heightCm !== undefined).map((e) => ({ t: e.start, v: units.length.toDisplay(e.heightCm!, settings) }))
  const heads = growth.filter((e) => e.headCm !== undefined).map((e) => ({ t: e.start, v: units.length.toDisplay(e.headCm!, settings) }))
  const growthTable = (points: { t: number; v: number }[], unit: string) => ({
    columns: ['Date', unit],
    rows: points.toSorted((a, b) => b.t - a.t).map((p) => [formatShortDate(p.t), p.v]),
  })

  const volumeLabel = vol.label(settings)
  const rhythmDays = days.slice(-RHYTHM_MAX_DAYS)

  return (
    <div className="stack">
      <div className="segmented" role="group" aria-label="Date range">
        {RANGES.map((r) => (
          <button key={r} className={r === range ? 'active' : undefined} aria-pressed={r === range} onClick={() => setRange(r)}>
            {r} days
          </button>
        ))}
      </div>

      {entries.length === 0 && (
        <div className="card empty">
          <p>No data yet.</p>
          <p className="muted small">Log a few days, or load sample data from Settings to explore the charts.</p>
        </div>
      )}

      <section className="tiles four" aria-label="Daily averages">
        <div className="card tile">
          <span className="label">Sleep / day</span>
          <strong>{formatDuration(summary.sleepMs)}</strong>
          <span className="muted small">{formatDuration(summary.nightSleepMs)} at night</span>
        </div>
        <div className="card tile">
          <span className="label">Naps / day</span>
          <strong>{count(summary.naps)}</strong>
          <span className="muted small">longest sleep {formatDuration(summary.longestSleepMs)}</span>
        </div>
        <div className="card tile">
          <span className="label">Feeds / day</span>
          <strong>{count(summary.feeds)}</strong>
          <span className="muted small">
            {summary.bottleMl > 0 ? `${formatMeasure('volume', summary.bottleMl, settings)} bottle` : 'no bottles'}
          </span>
        </div>
        <div className="card tile">
          <span className="label">Diapers / day</span>
          <strong>{count(summary.diapers)}</strong>
          <span className="muted small">
            {count(summary.wet)} wet · {count(summary.dirty)} dirty
          </span>
        </div>
      </section>
      <p className="muted small center">
        Averages over {summary.trackedDays} tracked {summary.trackedDays === 1 ? 'day' : 'days'} in the last {range} days.
      </p>

      <ChartCard
        title="Daily rhythm"
        subtitle={range > RHYTHM_MAX_DAYS ? `Last ${RHYTHM_MAX_DAYS} days` : `Last ${range} days, newest on top`}
        legend={[
          { label: 'Sleep', color: C.night },
          { label: 'Feed', color: C.breast },
          { label: 'Diaper', color: C.wet },
        ]}
        table={tableFor(rhythmDays, [sleepSeries[0], sleepSeries[1]], hours)}
      >
        <RhythmChart entries={entries} days={rhythmDays} settings={settings} now={now} />
      </ChartCard>

      <ChartCard
        title="Sleep per day"
        subtitle={`Average ${formatDuration(summary.sleepMs)}`}
        legend={sleepSeries}
        table={tableFor(days, sleepSeries, hours)}
      >
        <BarChart days={days} series={sleepSeries} format={hours} tick={(v) => `${v}h`} label="Hours of sleep per day" />
      </ChartCard>

      <ChartCard
        title="Feeds per day"
        subtitle={`Average ${count(summary.feeds)} feeds`}
        legend={feedSeries}
        table={tableFor(days, feedSeries, count)}
      >
        <BarChart days={days} series={feedSeries} format={count} label="Number of feeds per day" />
      </ChartCard>

      <ChartCard
        title="Time breastfeeding"
        subtitle="Minutes per day"
        table={tableFor(days, breastSeries, (m) => formatDuration(m * MINUTE))}
      >
        <BarChart
          days={days}
          series={breastSeries}
          format={(m) => formatDuration(m * MINUTE)}
          tick={(m) => `${m}m`}
          label="Minutes breastfeeding per day"
        />
      </ChartCard>

      <ChartCard
        title="Bottle volume"
        subtitle={`${volumeLabel} per day`}
        table={tableFor(days, bottleSeries, (v) => `${v} ${volumeLabel}`)}
      >
        <BarChart
          days={days}
          series={bottleSeries}
          format={(v) => `${v} ${volumeLabel}`}
          label={`Bottle volume per day in ${volumeLabel}`}
        />
      </ChartCard>

      <ChartCard
        title="Diapers per day"
        subtitle={`Average ${count(summary.wet)} wet and ${count(summary.dirty)} dirty`}
        legend={diaperSeries}
        table={tableFor(days, diaperSeries, count)}
      >
        <BarChart days={days} series={diaperSeries} format={count} label="Diapers per day" />
      </ChartCard>

      {weights.length > 0 && (
        <ChartCard title="Weight" subtitle="All measurements" table={growthTable(weights, units.weight.label(settings))}>
          <LineChart points={weights} color={C.night} format={(v) => `${v} ${units.weight.label(settings)}`} label="Weight over time" />
        </ChartCard>
      )}
      {lengths.length > 0 && (
        <ChartCard title="Length" subtitle="All measurements" table={growthTable(lengths, units.length.label(settings))}>
          <LineChart points={lengths} color={C.night} format={(v) => `${v} ${units.length.label(settings)}`} label="Length over time" />
        </ChartCard>
      )}
      {heads.length > 0 && (
        <ChartCard title="Head circumference" subtitle="All measurements" table={growthTable(heads, units.length.label(settings))}>
          <LineChart points={heads} color={C.night} format={(v) => `${v} ${units.length.label(settings)}`} label="Head circumference over time" />
        </ChartCard>
      )}
      {growth.length === 0 && entries.length > 0 && (
        <div className="card empty">
          <p className="muted small">Log a 📏 Growth entry to see weight and length charts here.</p>
        </div>
      )}
    </div>
  )
}
