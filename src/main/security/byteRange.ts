export interface ByteRange {
  start: number
  end: number
}

export function parseByteRange(value: string, size: number): ByteRange {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || size <= 0) throw new RangeError('Invalid byte range.')

  const [, rawStart, rawEnd] = match
  let start: number
  let end: number
  if (!rawStart) {
    const suffixLength = Number(rawEnd)
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      throw new RangeError('Invalid byte range.')
    }
    start = Math.max(0, size - suffixLength)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    throw new RangeError('Unsatisfiable byte range.')
  }
  return { start, end }
}
