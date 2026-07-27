import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAutosaveQueue } from '../../src/renderer/canvas/autosave'

describe('createAutosaveQueue', () => {
  afterEach(() => vi.useRealTimers())

  it('debounces repeated document changes into one save', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async () => undefined)
    const queue = createAutosaveQueue(save, 750)

    queue.schedule()
    await vi.advanceTimersByTimeAsync(500)
    queue.schedule()
    await vi.advanceTimersByTimeAsync(749)
    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(queue.isDirty()).toBe(false)
  })

  it('serializes a change arriving during a save', async () => {
    let finishFirst: (() => void) | undefined
    const save = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishFirst = resolve
          })
      )
      .mockResolvedValue(undefined)
    const queue = createAutosaveQueue(save)

    queue.schedule()
    const flush = queue.flush()
    queue.schedule()
    finishFirst?.()
    await flush

    expect(save).toHaveBeenCalledTimes(2)
  })

  it('keeps a failed save dirty for explicit retry', async () => {
    const save = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValue(undefined)
    const queue = createAutosaveQueue(save)

    queue.schedule()
    await expect(queue.flush()).rejects.toThrow('disk full')
    expect(queue.isDirty()).toBe(true)
    await queue.flush()

    expect(save).toHaveBeenCalledTimes(2)
    expect(queue.isDirty()).toBe(false)
  })

  it('retries newer work when a concurrent flush observes a failed save', async () => {
    let rejectFirst: ((error: Error) => void) | undefined
    const save = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_, reject) => {
            rejectFirst = reject
          })
      )
      .mockResolvedValue(undefined)
    const queue = createAutosaveQueue(save)

    queue.schedule()
    const first = queue.flush()
    queue.schedule()
    const retry = queue.flush()
    rejectFirst?.(new Error('incomplete snapshot'))

    await expect(first).rejects.toThrow('incomplete snapshot')
    await expect(retry).resolves.toBeUndefined()
    expect(save).toHaveBeenCalledTimes(2)
    expect(queue.isDirty()).toBe(false)
  })

  it('uses an updated save handler', async () => {
    const first = vi.fn(async () => undefined)
    const latest = vi.fn(async () => undefined)
    const queue = createAutosaveQueue(first)

    queue.setSave(latest)
    queue.schedule()
    await queue.flush()

    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledOnce()
  })

  it('applies an updated delay to pending work', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async () => undefined)
    const queue = createAutosaveQueue(save, 3_000)

    queue.schedule()
    queue.setDelay(500)
    await vi.advanceTimersByTimeAsync(499)
    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledOnce()
  })
})
