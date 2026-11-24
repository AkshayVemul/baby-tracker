import { toTimeInput } from './time'

/** The iPhone Shortcut that sets the alarm; set up once from Settings → Feed alarm. */
export const ALARM_SHORTCUT = 'Baby Tracker Alarm'

/**
 * A link that runs the alarm Shortcut with the time ("21:30"); the Shortcut creates an alarm in the Clock app.
 * Web pages can't set alarms themselves, and iOS has no link that does it directly.
 */
export function alarmLink(at: number): string {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(ALARM_SHORTCUT)}&input=text&text=${encodeURIComponent(toTimeInput(at))}`
}
