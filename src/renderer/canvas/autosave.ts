export interface AutosaveQueue {
  schedule: () => void
  flush: () => Promise<void>
  cancel: () => void
  isDirty: () => boolean
  setDelay: (delay: number) => void
  setSave: (save: () => Promise<void>) => void
}

export function createAutosaveQueue(save: () => Promise<void>, delay = 750): AutosaveQueue {
  let saveTask = save
  let saveDelay = delay
  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false
  let running: Promise<void> | null = null

  const clearTimer = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  const flush = async (): Promise<void> => {
    clearTimer()
    if (running) return running
    if (!dirty) return

    running = (async () => {
      while (dirty) {
        dirty = false
        try {
          await saveTask()
        } catch (error) {
          dirty = true
          throw error
        }
      }
    })()

    try {
      await running
    } finally {
      running = null
    }
  }

  return {
    schedule: () => {
      dirty = true
      clearTimer()
      timer = setTimeout(() => void flush().catch(() => undefined), saveDelay)
    },
    flush,
    cancel: () => {
      clearTimer()
      dirty = false
    },
    isDirty: () => dirty,
    setDelay: (nextDelay) => {
      saveDelay = nextDelay
      if (dirty) {
        clearTimer()
        timer = setTimeout(() => void flush().catch(() => undefined), saveDelay)
      }
    },
    setSave: (nextSave) => {
      saveTask = nextSave
    }
  }
}
