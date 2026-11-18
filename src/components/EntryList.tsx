import type { Gap } from '../lib/gaps'
import { formatDuration, formatTime } from '../lib/time'
import type { Actions, Entry, Settings } from '../types'
import { EntryRow } from './EntryRow'

interface Props {
  /** Newest first. */
  entries: Entry[]
  /** Unlogged sleep gaps, keyed by the feed they follow (from `sleepGaps` over all entries). */
  gaps: Map<string, Gap>
  settings: Settings
  now: number
  actions: Actions
}

/**
 * Entry rows, with an "Add sleep" row between two feeds that have no sleep logged in between. One tap adds it
 * as a normal sleep entry (with undo); tapping that entry edits it like any other.
 */
export function EntryList({ entries, gaps, settings, now, actions }: Props) {
  return (
    <ul className="card list">
      {entries.map((entry) => {
        const gap = gaps.get(entry.id)
        return [
          // Newest first, so the gap after this feed sits just above it.
          gap && (
            <li key={`gap-${entry.id}`}>
              <button
                className="gap-row"
                onClick={() => actions.log({ type: 'sleep', start: gap.start, end: gap.end }, 'Sleep added between feeds')}
              >
                <span className="gap-icon" aria-hidden="true">
                  +
                </span>
                <span className="gap-text">
                  Add sleep between feeds
                  <span className="muted small">
                    {formatTime(gap.start, settings.timeFormat)} – {formatTime(gap.end, settings.timeFormat)} ·{' '}
                    {formatDuration(gap.end - gap.start)}
                  </span>
                </span>
              </button>
            </li>
          ),
          <EntryRow key={entry.id} entry={entry} settings={settings} now={now} onOpen={actions.edit} />,
        ]
      })}
    </ul>
  )
}
