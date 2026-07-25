interface ResponseDetails {
  url: string
  resourceType: string
  webContentsId?: number
}

function canonicalUrl(value: string): string | null {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.href
  } catch {
    return null
  }
}

export function isCanvasNoteDocumentResponse(
  details: ResponseDetails,
  documentUrl: string,
  canvasNoteWebContentsId: number | undefined
): boolean {
  const responseUrl = canonicalUrl(details.url)
  const expectedUrl = canonicalUrl(documentUrl)
  return (
    details.resourceType === 'mainFrame' &&
    canvasNoteWebContentsId !== undefined &&
    details.webContentsId === canvasNoteWebContentsId &&
    responseUrl !== null &&
    responseUrl === expectedUrl
  )
}
