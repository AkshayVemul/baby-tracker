import { useCallback, useEffect, useState } from 'react'

/**
 * The current screen from the URL hash (`#/history`), so each screen has its own address, the phone's back
 * button moves between screens, and a refresh stays put. Hash URLs need no server rewrites on GitHub Pages.
 */
export function useHashRoute<T extends string>(routes: readonly T[], fallback: T): [T, (route: T) => void] {
  const read = useCallback(() => {
    const path = window.location.hash.replace(/^#\/?/, '') as T
    return routes.includes(path) ? path : fallback
  }, [routes, fallback])
  const [route, setRoute] = useState(read)

  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [read])

  const navigate = useCallback((next: T) => {
    if (window.location.hash !== `#/${next}`) window.location.hash = `/${next}`
  }, [])

  return [route, navigate]
}

/**
 * While `open`, adds a history entry so the phone's back button calls `onBack` instead of leaving the screen.
 * Returns `close`, which closing buttons use so that entry is removed again.
 */
export function useBackToClose(open: boolean, onBack: () => void): () => void {
  useEffect(() => {
    if (!open) return
    // Guarded so StrictMode's double effect in development doesn't add two entries.
    if (!(window.history.state as { sheet?: boolean } | null)?.sheet) window.history.pushState({ sheet: true }, '')
    window.addEventListener('popstate', onBack)
    return () => window.removeEventListener('popstate', onBack)
  }, [open, onBack])

  return useCallback(() => {
    if ((window.history.state as { sheet?: boolean } | null)?.sheet) window.history.back()
    else onBack()
  }, [onBack])
}
