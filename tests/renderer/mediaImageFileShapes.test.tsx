import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'CSS', {
    configurable: true,
    value: { supports: () => false }
  })
})

import {
  CN_FILE_TYPE,
  CN_IMAGE_TYPE,
  createCNFileShape,
  createCNImageShape,
  getDefaultCNFileProps,
  getDefaultCNImageProps
} from '../../src/renderer/canvas/shapes/MediaShapeTypes'
import {
  CNImageShapeUtil,
  IMAGE_MIN_HEIGHT,
  IMAGE_MIN_WIDTH
} from '../../src/renderer/canvas/shapes/ImageShapeUtil'
import {
  CNFileShapeUtil,
  FILE_MIN_HEIGHT,
  FILE_MIN_WIDTH,
  formatFileSize
} from '../../src/renderer/canvas/shapes/FileShapeUtil'
import { toMediaUrl } from '../../src/renderer/canvas/shapes/mediaRuntime'

describe('image and file canvas shapes', () => {
  it('keeps portable schema fields in shape props and derives no URL', () => {
    const now = '2026-07-25T00:00:00.000Z'
    const image = createCNImageShape(10, 20, {
      ...getDefaultCNImageProps(now),
      mediaId: 'media:image-1',
      mediaPath: 'media/images/photo.webp',
      caption: 'Reference image',
      altText: 'A pencil sketch'
    })
    const file = createCNFileShape(30, 40, {
      ...getDefaultCNFileProps(now),
      mediaId: 'media:file-1',
      mediaPath: 'media/files/brief.pdf',
      filename: 'brief.pdf',
      extension: 'pdf',
      sizeBytes: 1536
    })

    expect(image).toMatchObject({
      type: CN_IMAGE_TYPE,
      x: 10,
      y: 20,
      props: {
        mediaId: 'media:image-1',
        mediaPath: 'media/images/photo.webp',
        fit: 'contain',
        createdAt: now
      }
    })
    expect(file).toMatchObject({
      type: CN_FILE_TYPE,
      x: 30,
      y: 40,
      props: {
        filename: 'brief.pdf',
        extension: 'pdf',
        sizeBytes: 1536,
        createdAt: now
      }
    })
    expect(image.props).not.toHaveProperty('mediaUrl')
    expect(file.props).not.toHaveProperty('mediaUrl')
  })

  it('validates fit and file size and exposes usable resize minimums', () => {
    expect(CNImageShapeUtil.type).toBe(CN_IMAGE_TYPE)
    expect(CNFileShapeUtil.type).toBe(CN_FILE_TYPE)
    expect(() => CNImageShapeUtil.props.fit.validate('cover')).not.toThrow()
    expect(() => CNImageShapeUtil.props.fit.validate('stretch')).toThrow()
    expect(() => CNFileShapeUtil.props.sizeBytes.validate(0)).not.toThrow()
    expect(() => CNFileShapeUtil.props.sizeBytes.validate(-1)).toThrow()
    expect([IMAGE_MIN_WIDTH, IMAGE_MIN_HEIGHT, FILE_MIN_WIDTH, FILE_MIN_HEIGHT]).toEqual([
      160, 120, 240, 120
    ])
  })

  it('formats binary file sizes without another dependency', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10 MB')
  })

  it('resolves renderer URLs through the narrow media bridge', () => {
    const toUrl = vi.fn((path: string) => `canvasnote-media://workspace/${path}`)
    Object.defineProperty(window, 'canvasNote', {
      configurable: true,
      value: { media: { toUrl, open: vi.fn(), reveal: vi.fn() } }
    })

    expect(toMediaUrl('media/images/photo.webp')).toBe(
      'canvasnote-media://workspace/media/images/photo.webp'
    )
    expect(toUrl).toHaveBeenCalledWith('media/images/photo.webp')
  })
})
