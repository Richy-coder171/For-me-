interface ResponseDetails {
  url: string
  resourceType: string
  webContentsId?: number
}

export function contentSecurityPolicy(isPackaged: boolean): string {
  const scriptSource = isPackaged ? "'self'" : "'self' 'unsafe-inline'"
  const connectSource = isPackaged ? "'self'" : "'self' ws: http://localhost:*"
  return [
    "default-src 'self'",
    `script-src ${scriptSource}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: canvasnote-media:",
    "font-src 'self' data:",
    "media-src 'self' blob: canvasnote-media:",
    'frame-src https://www.youtube-nocookie.com https://player.vimeo.com',
    `connect-src ${connectSource}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ].join('; ')
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
