import type { Theme } from '../types'

const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

/** Applies the theme to the page (and the phone's status bar colour); System follows the OS setting. */
export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && systemDark.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector<HTMLMetaElement>('meta[name=theme-color]')?.setAttribute('content', dark ? '#141413' : '#f6f4f1')
}

/** Re-applies `theme()` whenever the OS switches between light and dark. Returns a cleanup. */
export function followSystemTheme(theme: () => Theme): () => void {
  const onChange = () => applyTheme(theme())
  systemDark.addEventListener('change', onChange)
  return () => systemDark.removeEventListener('change', onChange)
}
