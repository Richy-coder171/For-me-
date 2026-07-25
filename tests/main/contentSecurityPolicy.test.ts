import { describe, expect, it } from 'vitest'

import { isCanvasNoteDocumentResponse } from '../../src/main/security/contentSecurityPolicy'

describe('CanvasNote CSP response scope', () => {
  const documentUrl = 'http://localhost:5173'
  const webContentsId = 7

  it('matches only the CanvasNote window main document', () => {
    expect(
      isCanvasNoteDocumentResponse(
        { url: 'http://localhost:5173/', resourceType: 'mainFrame', webContentsId },
        documentUrl,
        webContentsId
      )
    ).toBe(true)
  })

  it.each([
    {
      url: 'https://www.youtube-nocookie.com/embed/video',
      resourceType: 'subFrame',
      webContentsId
    },
    { url: 'https://player.vimeo.com/video/1', resourceType: 'subFrame', webContentsId },
    { url: 'http://localhost:5173/src/main.tsx', resourceType: 'script', webContentsId },
    { url: 'https://example.com/', resourceType: 'mainFrame', webContentsId },
    { url: 'http://localhost:5173/', resourceType: 'mainFrame', webContentsId: 8 }
  ])('leaves unrelated response $url unchanged', (details) => {
    expect(isCanvasNoteDocumentResponse(details, documentUrl, webContentsId)).toBe(false)
  })
})
