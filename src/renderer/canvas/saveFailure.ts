export type SaveFailureKind = 'conflict' | 'validation' | 'storage'

export interface SaveFailure {
  kind: SaveFailureKind
  title: string
  message: string
  details: string
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'An unknown save error occurred.'
  return error.message
    .replace(/^Error invoking remote method '[^']+': Error: /, '')
    .replace(
      /Board [a-zA-Z0-9_-]+ changed outside this session\./,
      'Board changed outside this session.'
    )
}

export function describeSaveFailure(error: unknown): SaveFailure {
  const details = errorMessage(error)
  if (/changed outside this session/i.test(details)) {
    return {
      kind: 'conflict',
      title: 'Externally modified',
      message:
        'This board changed on disk after you opened it. Export a recovery copy before reloading the disk version.',
      details
    }
  }
  if (/lossy|unsupported canvas object|save blocked/i.test(details)) {
    return {
      kind: 'validation',
      title: 'Save blocked',
      message:
        'CanvasNote found an unsupported canvas object. Your changes are still open and have not been overwritten.',
      details
    }
  }
  return {
    kind: 'storage',
    title: 'Save failed',
    message: 'Your changes are still open. Retry the save or export a recovery copy.',
    details
  }
}
