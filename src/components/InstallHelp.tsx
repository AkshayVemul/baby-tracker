import { useState } from 'react'
import { useInstallOption, useInstallPrompt } from '../lib/install'
import { read, write } from '../lib/storage'
import { Icon } from './Icon'

/**
 * How to put the app on the home screen: the browser's Install button where there is one (Android Chrome,
 * desktop Chrome/Edge), step-by-step instructions only on iPhone/iPad, which have no install prompt. Nothing
 * elsewhere.
 */
export function InstallHelp() {
  const option = useInstallOption()
  const { prompt } = useInstallPrompt()

  if (option === 'prompt') {
    return (
      <button className="btn primary" onClick={prompt}>
        <Icon name="download" /> Install app
      </button>
    )
  }

  if (option === 'ios') {
    return (
      <ol className="steps small">
        <li>
          Open this page in <strong>Safari</strong>.
        </li>
        <li>
          Tap <strong>Share</strong> <ShareIcon /> in the toolbar (on newer iOS it may be under the <strong>⋯</strong> button).
        </li>
        <li>
          Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
        </li>
        <li>Open Baby Tracker from the new icon on your home screen.</li>
      </ol>
    )
  }

  return null
}

/** The iOS share glyph: a box with an arrow pointing up. */
function ShareIcon() {
  return (
    <svg className="inline-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" />
    </svg>
  )
}

const HINT_DISMISSED_KEY = 'baby-tracker.install-hint-dismissed'

/** A one-time card on Today until the app is installed or the hint is closed. */
export function InstallHint() {
  const option = useInstallOption()
  const [dismissed, setDismissed] = useState(() => read<boolean>(HINT_DISMISSED_KEY) === true)
  if (dismissed || !option) return null
  return (
    <section className="card install-hint" aria-labelledby="install-hint">
      <div className="install-hint-head">
        <h2 id="install-hint">📲 Add Baby Tracker to your home screen</h2>
        <button
          className="icon-btn"
          aria-label="Hide this tip"
          onClick={() => {
            write(HINT_DISMISSED_KEY, true)
            setDismissed(true)
          }}
        >
          <Icon name="close" />
        </button>
      </div>
      <p className="muted small">It opens full screen like an app and works without signal.</p>
      <InstallHelp />
    </section>
  )
}
