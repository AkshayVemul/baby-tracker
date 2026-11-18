import { describe, expect, it } from 'vitest'
import { isIosDevice } from './platform'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'

describe('isIosDevice', () => {
  it('recognises iPhone (Safari or another browser) and iPad Safari, which reports a Mac user agent with touch', () => {
    expect(isIosDevice({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false })).toBe(true)
    expect(isIosDevice({ userAgent: IPHONE_CHROME, maxTouchPoints: 5 })).toBe(true)
    expect(isIosDevice({ userAgent: IPAD, maxTouchPoints: 5, standalone: false })).toBe(true)
  })

  it('ignores a Mac, Android, and a Mac browser emulating a touch phone', () => {
    expect(isIosDevice({ userAgent: MAC_CHROME, maxTouchPoints: 0 })).toBe(false)
    expect(isIosDevice({ userAgent: ANDROID, maxTouchPoints: 5 })).toBe(false)
    // Chrome device mode / the app's browser pane on a Mac: Mac user agent with touch points, but no `standalone`.
    expect(isIosDevice({ userAgent: MAC_CHROME, maxTouchPoints: 5 })).toBe(false)
  })
})
