/** The parts of `navigator` the iOS check reads; `standalone` exists only in Apple's mobile WebKit. */
export interface NavigatorInfo {
  userAgent: string
  maxTouchPoints: number
  standalone?: boolean
}

/**
 * iPhone or iPad, in any browser (Safari, Chrome, Firefox… all name the device in their user agent). iPadOS Safari
 * reports a Mac user agent instead, so a "Mac" counts only with touch *and* `navigator.standalone`, which only
 * Apple's mobile WebKit has: a desktop browser emulating a phone has touch points but never that property.
 */
export function isIosDevice(nav: NavigatorInfo): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true
  return /Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1 && 'standalone' in nav
}
