import { describe } from '../lib/describe'
import { isRunning, isTimed, TYPES } from '../lib/entries'
import { formatTime } from '../lib/time'
import type { Entry, Settings } from '../types'

interface Props {
  entry: Entry
  settings: Settings
  now: number
  onOpen: (entry: Entry) => void
}

export function EntryRow({ entry, settings, now, onOpen }: Props) {
  const type = TYPES[entry.type]
  const detail = describe(entry, settings, now)
  const running = isRunning(entry)
  const time =
    isTimed(entry) && entry.end !== undefined
      ? `${formatTime(entry.start, settings.timeFormat)} – ${formatTime(entry.end, settings.timeFormat)}`
      : formatTime(entry.start, settings.timeFormat)

  return (
    <li>
      <button className="entry-row" onClick={() => onOpen(entry)}>
        <span className="badge" style={{ background: type.color }} aria-hidden="true">
          {type.emoji}
        </span>
        <span className="entry-main">
          <span className="entry-title">
            {type.label}
            {running && <span className="pill live">running</span>}
          </span>
          {detail && <span className="entry-detail">{detail}</span>}
          {entry.notes && <span className="entry-notes">{entry.notes}</span>}
        </span>
        <span className="entry-time">{time}</span>
      </button>
    </li>
  )
}
