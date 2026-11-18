import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

// Production only: in development a cached copy would hide code changes.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then(() => navigator.serviceWorker.ready)
    .then((registration) => {
      // Hand over the scripts and styles this page already loaded so the first visit is enough to work offline.
      const urls = [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[rel=stylesheet], link[rel=modulepreload]')]
        .map((el) => ('src' in el ? el.src : el.href))
        .filter((u) => u.startsWith(window.location.origin))
      registration.active?.postMessage({ type: 'cache', urls })
    })
    .catch(() => {
      // No offline support in this browser; the app works the same online.
    })
}
