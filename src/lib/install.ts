import { useSyncExternalStore } from 'react'
import { isIosDevice, type NavigatorInfo } from './platform'

/** Chrome/Edge/Android's install prompt event (not in TypeScript's DOM types). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

// Registered when this module loads (main.tsx imports it first), since the browser fires this once, early.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferred = event as InstallPromptEvent
  notify()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  notify()
})

/** Opened from the home screen rather than a browser tab. */
export function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

/** iPhone or iPad, which never show an install prompt: only Share → Add to Home Screen. */
export function isIos(): boolean {
  return isIosDevice(navigator as NavigatorInfo)
}

/**
 * What this device can be offered: the browser's install prompt, the iPhone/iPad steps, or nothing (already
 * installed, or a browser with no install path to show).
 */
export function useInstallOption(): 'prompt' | 'ios' | null {
  const { canPrompt } = useInstallPrompt()
  if (isInstalled()) return null
  if (canPrompt) return 'prompt'
  return isIos() ? 'ios' : null
}

/** Whether the browser's own install prompt is available, and a function that shows it. */
export function useInstallPrompt(): { canPrompt: boolean; prompt: () => Promise<void> } {
  const event = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => deferred,
  )
  return {
    canPrompt: event !== null,
    prompt: async () => {
      if (!deferred) return
      await deferred.prompt()
      await deferred.userChoice
      deferred = null
      notify()
    },
  }
}
