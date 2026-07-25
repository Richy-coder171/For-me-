import { describe, expect, it } from 'vitest'

import { parseByteRange } from '../../src/main/security/byteRange'

describe('byte ranges', () => {
  it.each([
    ['bytes=0-7', 100, { start: 0, end: 7 }],
    ['bytes=90-', 100, { start: 90, end: 99 }],
    ['bytes=-10', 100, { start: 90, end: 99 }],
    ['bytes=0-999', 100, { start: 0, end: 99 }]
  ])('parses %s', (value, size, expected) => {
    expect(parseByteRange(value, size)).toEqual(expected)
  })

  it.each(['bytes=', 'bytes=100-200', 'bytes=8-7', 'items=0-1', 'bytes=0-1,4-5'])(
    'rejects %s',
    (value) => expect(() => parseByteRange(value, 100)).toThrow(RangeError)
  )
})
