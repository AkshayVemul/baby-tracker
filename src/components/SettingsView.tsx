import { useRef, useState, type ChangeEvent } from 'react'
import type { Household } from '../lib/db'
import { sampleEntries } from '../lib/sample'
import { clearLocalEntries, loadLocalEntries } from '../lib/storage'
import { supabase } from '../lib/supabase'
import { toDateInput } from '../lib/time'
import { download, fromBackup, toBackup, toCsv } from '../lib/transfer'
import type { Entry, Settings } from '../types'
import { Icon } from './Icon'

interface Props {
  entries: Entry[]
  settings: Settings
  household: Household
  email: string | undefined
  now: number
  onSettings: (settings: Settings) => void
  bulk: {
    replaceAll: (entries: Entry[]) => Promise<void>
    add: (entries: Entry[]) => Promise<void>
  }
  onOpenToday: () => void
}

function Select<K extends keyof Settings>({
  label,
  field,
  options,
  settings,
  onSettings,
}: {
  label: string
  field: K
  options: [Settings[K], string][]
  settings: Settings
  onSettings: (s: Settings) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={settings[field]} onChange={(e) => onSettings({ ...settings, [field]: e.target.value })}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SettingsView({ entries, settings, household, email, now, onSettings, bulk, onOpenToday }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [localEntries, setLocalEntries] = useState(loadLocalEntries)
  const [password, setPassword] = useState('')
  const stamp = toDateInput(now)

  /** Runs a bulk database change, reporting success or the error. */
  const run = async (work: () => Promise<void>, done: string) => {
    setBusy(true)
    setMessage('')
    try {
      await work()
      setMessage(done)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    let backup: ReturnType<typeof fromBackup>
    try {
      backup = fromBackup(await file.text())
    } catch (error) {
      return setMessage(error instanceof Error ? error.message : 'Import failed.')
    }
    if (!window.confirm(`Replace the household’s ${entries.length} entries with the ${backup.entries.length} in this backup?`)) return
    run(() => bulk.replaceAll(backup.entries), `Restored ${backup.entries.length} entries.`)
  }

  const loadSample = () => {
    if (entries.length > 0 && !window.confirm('Replace the household’s entries with a month of sample data?')) return
    run(() => bulk.replaceAll(sampleEntries(Date.now())), 'Sample data loaded.').then(onOpenToday)
  }

  const uploadLocal = () =>
    run(async () => {
      await bulk.add(localEntries)
      clearLocalEntries()
      setLocalEntries([])
    }, `Uploaded ${localEntries.length} entries from this device.`)

  const clearAll = () => {
    if (!window.confirm(`Delete all ${entries.length} entries for everyone in the household? This can’t be undone — export a backup first if unsure.`)) return
    run(() => bulk.replaceAll([]), 'All entries deleted.')
  }

  const changePassword = () =>
    run(async () => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw new Error(error.message)
      setPassword('')
    }, 'Password updated.')

  return (
    <div className="stack">
      {localEntries.length > 0 && (
        <section className="card form" aria-labelledby="local">
          <h3 id="local">Entries on this device</h3>
          <p className="small">
            {localEntries.length} entries were saved in this browser before the app moved to the cloud. Upload them to the
            household so everyone can see them.
          </p>
          <button className="btn primary" onClick={uploadLocal} disabled={busy}>
            <Icon name="upload" /> Upload {localEntries.length} entries
          </button>
        </section>
      )}

      <section className="card form" aria-labelledby="profile">
        <h3 id="profile">Baby</h3>
        <div className="grid-2">
          <label className="field">
            <span>Name</span>
            <input value={settings.babyName} onChange={(e) => onSettings({ ...settings, babyName: e.target.value })} />
          </label>
          <label className="field">
            <span>Birth date</span>
            <input
              type="date"
              value={settings.birthDate}
              max={stamp}
              onChange={(e) => onSettings({ ...settings, birthDate: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="card form" aria-labelledby="household">
        <h3 id="household">Household</h3>
        <p className="small">
          Share this code with a partner or carer. They create their own account, choose “Join with an invite code”, and
          then see and log the same entries live.
        </p>
        <div className="row">
          <code className="invite-code">{household.invite_code}</code>
          <button
            className="btn"
            onClick={() => navigator.clipboard.writeText(household.invite_code).then(() => setMessage('Invite code copied.'))}
          >
            Copy
          </button>
        </div>
      </section>

      <section className="card form" aria-labelledby="units">
        <h3 id="units">Units and time on this device</h3>
        <div className="grid-2">
          <Select label="Volume" field="volume" options={[['ml', 'Millilitres (ml)'], ['oz', 'Fluid ounces (oz)']]} settings={settings} onSettings={onSettings} />
          <Select label="Weight" field="weight" options={[['kg', 'Kilograms (kg)'], ['lb', 'Pounds (lb)']]} settings={settings} onSettings={onSettings} />
          <Select label="Length" field="length" options={[['cm', 'Centimetres (cm)'], ['in', 'Inches (in)']]} settings={settings} onSettings={onSettings} />
          <Select label="Temperature" field="temp" options={[['C', 'Celsius (°C)'], ['F', 'Fahrenheit (°F)']]} settings={settings} onSettings={onSettings} />
          <Select label="Time format" field="timeFormat" options={[['12h', '12-hour (9:05 PM)'], ['24h', '24-hour (21:05)']]} settings={settings} onSettings={onSettings} />
        </div>
      </section>

      <section className="card form" aria-labelledby="data">
        <h3 id="data">Data</h3>
        <p className="muted small">{entries.length} entries in the household, stored in Supabase.</p>
        <div className="row wrap">
          <button className="btn" onClick={() => download(`baby-tracker-${stamp}.json`, toBackup(entries, settings), 'application/json')}>
            <Icon name="download" /> Backup (JSON)
          </button>
          <button className="btn" onClick={() => download(`baby-tracker-${stamp}.csv`, toCsv(entries), 'text/csv')}>
            <Icon name="download" /> Spreadsheet (CSV)
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()} disabled={busy}>
            <Icon name="upload" /> Restore backup
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile} />
        </div>
        <div className="row wrap">
          <button className="btn" onClick={loadSample} disabled={busy}>
            Load sample data
          </button>
          <button className="btn danger" onClick={clearAll} disabled={busy || entries.length === 0}>
            <Icon name="trash" /> Delete all entries
          </button>
        </div>
      </section>

      <section className="card form" aria-labelledby="account">
        <h3 id="account">Account</h3>
        <p className="small">Signed in as {email}</p>
        <div className="input-with-btn">
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            placeholder="New password"
            aria-label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn" onClick={changePassword} disabled={busy || password.length < 6}>
            Change
          </button>
        </div>
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </section>

      {message && (
        <p className="small center" role="status">
          {message}
        </p>
      )}
    </div>
  )
}
