import { describe, expect, it } from 'vitest'
import { nearestTime } from './time'

describe('nearestTime', () => {
  const evening = new Date(2026, 10, 23, 23, 50).getTime()

  it('takes a time on the same day when that is closest', () => {
    expect(nearestTime('23:30', evening)).toBe(new Date(2026, 10, 23, 23, 30).getTime())
  })

  it('rolls past midnight to the next day', () => {
    expect(nearestTime('00:10', evening)).toBe(new Date(2026, 10, 24, 0, 10).getTime())
  })

  it('is NaN when empty', () => {
    expect(nearestTime('', evening)).toBeNaN()
  })
})
