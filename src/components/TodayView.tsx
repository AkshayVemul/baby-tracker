import { useState, type ReactNode } from 'react'
import { describe } from '../lib/describe'
import { durationMs, finish, hasBreak, isRunning, kindLabel, pause, resume, sortNewestFirst, subtractBreak, TYPE_ORDER, TYPES } from '../lib/entries'
import { sleepGaps } from '../lib/gaps'
import { nextFeedDue } from '../lib/nextFeed'
import { dailyStats, latest } from '../lib/stats'
import { formatAgo, formatClock, formatDuration, formatTime, MINUTE, startOfDay } from '../lib/time'
import { formatMeasure } from '../lib/units'
import type { Actions, Entry, Settings } from '../types'
import { EntryList } from './EntryList'
import { Icon } from './Icon'
import { InstallHint } from './InstallHelp'

interface Props {
  entries: Entry[]
  settings: Settings
  now: number
  actions: Actions
}

type Side = 'left' | 'right'
type PumpSide = Side | 'both'

const sideLabel = (side?: string) => (side === 'right' ? 'Right' : side === 'left' ? 'Left' : 'Both')

export function TodayView({ entries, settings, now, actions }: Props) {
  const [activityKind, setActivityKind] = useState('tummy')

  const running = (type: Entry['type']) => entries.find((e) => e.type === type && isRunning(e))
  const sleep = running('sleep')
  const feed = running('feed')
  const activity = running('activity')
  const pump = running('pump')

  const lastFeed = latest(entries, (e) => e.type === 'feed')
  const lastBreast = latest(entries, (e) => e.type === 'feed' && e.kind === 'breast' && (e.side === 'left' || e.side === 'right'))
  const nextSide: Side = lastBreast?.side === 'left' ? 'right' : 'left'
  const lastPump = latest(entries, (e) => e.type === 'pump' && e.side !== undefined)
  const nextPumpSide: PumpSide =
    lastPump?.side === 'left' ? 'right' : lastPump?.side === 'right' ? 'left' : 'both'
  const lastBottle = latest(entries, (e) => e.type === 'feed' && e.kind === 'bottle')
  const lastDiaper = latest(entries, (e) => e.type === 'diaper')
  const lastSleep = latest(entries, (e) => e.type === 'sleep' && e.end !== undefined)
  // The session that ended most recently, within 15 minutes, can still have break time taken off from its card.
  const justFinished = (test: (e: Entry) => boolean) =>
    entries
      .filter((e) => test(e) && e.end !== undefined && e.end > e.start && now - e.end < 15 * MINUTE)
      .reduce<Entry | undefined>((best, e) => (!best || e.end! > best.end! ? e : best), undefined)
  const finishedBreastfeed = feed ? undefined : justFinished((e) => e.type === 'feed' && e.kind === 'breast')
  const finishedPump = pump ? undefined : justFinished((e) => e.type === 'pump')

  const next = nextFeedDue(entries, settings)
  const today = startOfDay(now)
  const [stats] = dailyStats(entries, [today], now)
  const todays = sortNewestFirst(entries.filter((e) => e.start >= today || isRunning(e)))

  const stop = (entry: Entry) => actions.save(finish(entry, Date.now()))
  const togglePause = (entry: Entry) =>
    actions.save(entry.pausedAt === undefined ? pause(entry, Date.now()) : resume(entry, Date.now()))
  const takeOff = (entry: Entry, minutes: number) => actions.save(subtractBreak(entry, minutes * MINUTE, Date.now()))
  const startFeed = (side: Side) => {
    actions.log({ type: 'feed', kind: 'breast', side, start: Date.now() }, `Feeding on the ${side}`)
  }
  const switchSide = (entry: Entry) => {
    const at = Date.now()
    actions.save(finish(entry, at))
    actions.log({ type: entry.type, kind: entry.kind, side: entry.side === 'left' ? 'right' : 'left', start: at }, 'Switched sides')
  }
  const startPump = (side: PumpSide) => {
    actions.log({ type: 'pump', side, start: Date.now() }, side === 'both' ? 'Pumping both sides' : `Pumping on the ${side}`)
  }
  const logDiaper = (kind: string, label: string) =>
    actions.log({ type: 'diaper', kind, start: Date.now() }, `${label} diaper logged`)

  return (
    <div className="stack">
      <InstallHint />
      <section className="card since" aria-label="Since last">
        <div>
          <span className="label">Last feed</span>
          <strong>{feed ? 'Feeding now' : lastFeed ? formatAgo(lastFeed.start, now) : '—'}</strong>
          {lastFeed && !feed && <span className="muted small">{describe(lastFeed, settings, now) || kindLabel(lastFeed)}</span>}
        </div>
        <div>
          <span className="label">Last diaper</span>
          <strong>{lastDiaper ? formatAgo(lastDiaper.start, now) : '—'}</strong>
          {lastDiaper && <span className="muted small">{kindLabel(lastDiaper)}</span>}
        </div>
        <div>
          <span className="label">{sleep ? 'Asleep for' : 'Awake for'}</span>
          <strong>
            {sleep
              ? formatDuration(now - sleep.start)
              : lastSleep?.end
                ? formatDuration(now - lastSleep.end)
                : '—'}
          </strong>
          {!sleep && lastSleep?.end && <span className="muted small">woke {formatTime(lastSleep.end, settings.timeFormat)}</span>}
        </div>
      </section>

      {next && (
        <section className={next.due <= now ? 'card next-feed overdue' : 'card next-feed'} aria-label="Next feed">
          <span className="badge" style={{ background: TYPES.feed.color }} aria-hidden="true">
            🍼
          </span>
          <div className="grow">
            <strong>Next feed {formatTime(next.due, settings.timeFormat)}</strong>
            <span className="small">
              {next.due <= now ? `Overdue by ${formatDuration(now - next.due)}` : `In ${formatDuration(next.due - now)}`}
              <span className="muted">
                {' '}· every {formatDuration(settings.feedIntervalMin * MINUTE)} from the {settings.feedIntervalFrom} of the last feed ·{' '}
                <a href="#/settings">Change</a>
              </span>
            </span>
          </div>
          <button className="btn primary" onClick={() => startFeed(nextSide)} aria-label={`Start breastfeeding on the ${nextSide}`}>
            <Icon name="play" /> Start feed
          </button>
        </section>
      )}

      <section className="timers" aria-label="Timers">
        <TimerCard
          emoji="😴"
          color={TYPES.sleep.color}
          title="Sleep"
          subtitle={sleep ? `since ${formatTime(sleep.start, settings.timeFormat)}` : 'Tap when baby falls asleep'}
          running={sleep}
          now={now}
          onEdit={actions.edit}
        >
          {sleep ? (
            <button className="btn primary block" onClick={() => stop(sleep)}>
              <Icon name="stop" /> Woke up
            </button>
          ) : (
            <button className="btn primary block" onClick={() => actions.log({ type: 'sleep', start: Date.now() }, 'Sleep timer started')}>
              <Icon name="play" /> Start sleep
            </button>
          )}
        </TimerCard>

        <TimerCard
          emoji="🤱"
          color={TYPES.feed.color}
          title="Breastfeed"
          subtitle={
            feed
              ? `${feed.pausedAt !== undefined ? 'Paused · ' : ''}${sideLabel(feed.side)} side · since ${formatTime(feed.start, settings.timeFormat)}`
              : lastBreast
                ? `Next: ${sideLabel(nextSide)} (last was ${sideLabel(lastBreast.side).toLowerCase()})`
                : 'Pick the side you start on'
          }
          running={feed}
          now={now}
          onEdit={actions.edit}
        >
          {feed ? (
            <div className="row">
              <PauseButton entry={feed} onToggle={togglePause} />
              {feed.side !== 'both' && (
                <button className="btn grow" onClick={() => switchSide(feed)} aria-label={`Switch to ${feed.side === 'left' ? 'right' : 'left'} side`}>
                  <Icon name="swap" /> {feed.side === 'left' ? 'Right' : 'Left'}
                </button>
              )}
              <button className="btn primary grow" onClick={() => stop(feed)}>
                <Icon name="stop" /> Stop
              </button>
            </div>
          ) : (
            <>
            {finishedBreastfeed && <TakeOff entry={finishedBreastfeed} now={now} onTakeOff={takeOff} />}
            <div className="row">
              {(['left', 'right'] as const).map((side) => (
                <button key={side} className={side === nextSide ? 'btn primary grow' : 'btn grow'} onClick={() => startFeed(side)}>
                  <Icon name="play" /> {sideLabel(side)}
                </button>
              ))}
            </div>
            </>
          )}
        </TimerCard>

        <TimerCard
          emoji="🥛"
          color={TYPES.pump.color}
          title="Pump"
          subtitle={
            pump
              ? `${pump.pausedAt !== undefined ? 'Paused · ' : ''}${sideLabel(pump.side)} · since ${formatTime(pump.start, settings.timeFormat)}`
              : lastPump?.side === 'both'
                ? 'Last time: both sides'
                : lastPump
                  ? `Next: ${sideLabel(nextPumpSide)} (last was ${sideLabel(lastPump.side).toLowerCase()})`
                  : 'Pick a side, or both'
          }
          running={pump}
          now={now}
          onEdit={actions.edit}
        >
          {pump ? (
            <div className="row">
              <PauseButton entry={pump} onToggle={togglePause} />
              {pump.side !== 'both' && (
                <button className="btn grow" onClick={() => switchSide(pump)} aria-label={`Switch to ${pump.side === 'left' ? 'right' : 'left'} side`}>
                  <Icon name="swap" /> {pump.side === 'left' ? 'Right' : 'Left'}
                </button>
              )}
              <button
                className="btn primary grow"
                onClick={() => {
                  const done = finish(pump, Date.now())
                  actions.save(done)
                  // Straight to the form for the amount.
                  actions.edit(done)
                }}
              >
                <Icon name="stop" /> Stop
              </button>
            </div>
          ) : (
            <>
              {finishedPump && <TakeOff entry={finishedPump} now={now} onTakeOff={takeOff} />}
              <div className="row">
                {(['left', 'right', 'both'] as const).map((side) => (
                  <button key={side} className={side === nextPumpSide ? 'btn primary grow' : 'btn grow'} onClick={() => startPump(side)}>
                    <Icon name="play" /> {sideLabel(side)}
                  </button>
                ))}
              </div>
            </>
          )}
        </TimerCard>

        <TimerCard
          emoji="🧸"
          color={TYPES.activity.color}
          title="Activity"
          subtitle={activity ? `${kindLabel(activity)} · since ${formatTime(activity.start, settings.timeFormat)}` : 'Tummy time, bath, outdoors…'}
          running={activity}
          now={now}
          onEdit={actions.edit}
        >
          {activity ? (
            <button className="btn primary block" onClick={() => stop(activity)}>
              <Icon name="stop" /> Stop
            </button>
          ) : (
            <div className="row">
              <select aria-label="Activity" value={activityKind} onChange={(e) => setActivityKind(e.target.value)}>
                {TYPES.activity.kinds?.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <button
                className="btn primary"
                onClick={() => actions.log({ type: 'activity', kind: activityKind, start: Date.now() }, 'Activity timer started')}
              >
                <Icon name="play" /> Start
              </button>
            </div>
          )}
        </TimerCard>
      </section>

      <section className="card" aria-labelledby="quick-log">
        <h3 id="quick-log">Quick log</h3>
        <div className="quick">
          <button className="quick-btn" onClick={() => logDiaper('wet', 'Wet')}>💧<span>Wet</span></button>
          <button className="quick-btn" onClick={() => logDiaper('dirty', 'Dirty')}>💩<span>Dirty</span></button>
          <button className="quick-btn" onClick={() => logDiaper('mixed', 'Wet + dirty')}>💧💩<span>Both</span></button>
          <button
            className="quick-btn"
            onClick={() => actions.create('feed', { kind: 'bottle', amountMl: lastBottle?.amountMl, milk: lastBottle?.milk })}
          >
            🍼<span>Bottle</span>
          </button>
        </div>
        <div className="quick more">
          {TYPE_ORDER.filter((t) => t !== 'diaper').map((type) => (
            <button key={type} className="chip" onClick={() => actions.create(type)}>
              {TYPES[type].emoji} {TYPES[type].label}
            </button>
          ))}
        </div>
      </section>

      <section className="tiles" aria-label="Today so far">
        <div className="card tile">
          <span className="label">Sleep today</span>
          <strong>{formatDuration(stats.nightSleepMs + stats.daySleepMs)}</strong>
          <span className="muted small">
            {stats.naps} {stats.naps === 1 ? 'nap' : 'naps'} · {formatDuration(stats.daySleepMs)} daytime
          </span>
        </div>
        <div className="card tile">
          <span className="label">Feeds today</span>
          <strong>{stats.breast + stats.bottle + stats.solids}</strong>
          <span className="muted small">
            {stats.breast} breast · {stats.bottle} bottle
            {stats.bottleMl > 0 && ` (${formatMeasure('volume', stats.bottleMl, settings)})`}
          </span>
        </div>
        <div className="card tile">
          <span className="label">Diapers today</span>
          <strong>{stats.wet + stats.dirty + stats.mixed + stats.dry}</strong>
          <span className="muted small">
            {stats.wet + stats.mixed} wet · {stats.dirty + stats.mixed} dirty
          </span>
        </div>
      </section>

      <section aria-labelledby="today-log">
        <h3 id="today-log" className="section-title">Today’s log</h3>
        {todays.length === 0 ? (
          <div className="card empty">
            <p>Nothing logged yet today.</p>
            <p className="muted small">Start a timer or tap a quick-log button. Everything is saved on this device.</p>
          </div>
        ) : (
          <EntryList entries={todays} gaps={sleepGaps(entries, now)} settings={settings} now={now} actions={actions} />
        )}
      </section>
    </div>
  )
}

interface TimerCardProps {
  emoji: string
  color: string
  title: string
  subtitle: string
  running: Entry | undefined
  now: number
  onEdit: (entry: Entry) => void
  children: ReactNode
}

/** Timer layout: title row with the live clock on the right, controls underneath. */
function TimerCard({ emoji, color, title, subtitle, running, now, onEdit, children }: TimerCardProps) {
  return (
    <div className={running ? (running.pausedAt !== undefined ? 'card timer live paused' : 'card timer live') : 'card timer'}>
      <div className="timer-head">
        <span className="badge" style={{ background: color }} aria-hidden="true">
          {emoji}
        </span>
        <div className="grow">
          <h2>{title}</h2>
          <p className="muted small">{subtitle}</p>
        </div>
        {running && (
          <button className="clock" onClick={() => onEdit(running)} title="Edit start time" aria-label={`${title} timer, edit`}>
            {formatClock(durationMs(running, now))}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function PauseButton({ entry, onToggle }: { entry: Entry; onToggle: (entry: Entry) => void }) {
  const paused = entry.pausedAt !== undefined
  return (
    <button className="btn grow" onClick={() => onToggle(entry)} aria-pressed={paused}>
      <Icon name={paused ? 'play' : 'pause'} /> {paused ? 'Resume' : 'Pause'}
    </button>
  )
}

/** After stopping: take off minutes the baby was unlatched or pumping was interrupted. */
function TakeOff({ entry, now, onTakeOff }: { entry: Entry; now: number; onTakeOff: (entry: Entry, minutes: number) => void }) {
  return (
    <div className="take-off">
      <span className="small">
        Finished · <strong>{formatDuration(durationMs(entry, now))}</strong>
        {hasBreak(entry) && <span className="muted"> ({formatDuration(entry.pausedMs!)} break)</span>}
      </span>
      <div className="take-off-buttons" role="group" aria-label="Take off break time">
        {[1, 2, 5].map((minutes) => (
          <button key={minutes} className="chip" onClick={() => onTakeOff(entry, minutes)} aria-label={`Take off ${minutes} minutes`}>
            −{minutes}m
          </button>
        ))}
      </div>
    </div>
  )
}
