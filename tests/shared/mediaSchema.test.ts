import { describe, expect, it } from 'vitest'

import {
  imageDataImportRequestSchema,
  importedMediaSchema,
  mediaPathFromUrl,
  mediaRelativePathSchema,
  mediaUrlForPath
} from '../../src/shared/schemas/media'

describe('media schemas', () => {
  it('round-trips a portable media path through the custom protocol URL', () => {
    const relativePath = 'media/files/research notes.pdf'
    const url = mediaUrlForPath(relativePath)

    expect(url).toBe('canvasnote-media://workspace/media/files/research%20notes.pdf')
    expect(mediaPathFromUrl(url)).toBe(relativePath)
    expect(url).not.toContain('file:')
  })

  it.each([
    '../outside.txt',
    'media/../outside.txt',
    'media\\files\\outside.txt',
    'boards/board.canvasnote',
    'media/audio/recording.mp3',
    'media/files/nested/file.txt'
  ])('rejects unsafe or unsupported media path %s', (relativePath) => {
    expect(() => mediaRelativePathSchema.parse(relativePath)).toThrow()
    expect(() => mediaUrlForPath(relativePath)).toThrow()
  })

  it.each([
    'https://workspace/media/files/note.txt',
    'canvasnote-media://other/media/files/note.txt',
    'canvasnote-media://workspace/media/files/%252e%252e/note.txt',
    'canvasnote-media://workspace/media/files/note.txt?source=outside'
  ])('rejects untrusted media URL %s', (url) => {
    expect(() => mediaPathFromUrl(url)).toThrow()
  })

  it('requires imported metadata URLs to match their portable paths', () => {
    expect(() =>
      importedMediaSchema.parse({
        id: 'media-1',
        kind: 'file',
        relativePath: 'media/files/one.txt',
        filename: 'one.txt',
        extension: 'txt',
        sizeBytes: 3,
        mimeType: 'text/plain',
        url: mediaUrlForPath('media/files/two.txt')
      })
    ).toThrow(/does not match/)
  })

  it('bounds image byte transfers', () => {
    expect(
      imageDataImportRequestSchema.parse({
        filename: 'paste.png',
        data: new Uint8Array([1, 2, 3])
      }).data
    ).toHaveLength(3)
    expect(() =>
      imageDataImportRequestSchema.parse({ filename: 'empty.png', data: new Uint8Array() })
    ).toThrow(/25 MB/)
  })
})
