import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'CSS', {
    configurable: true,
    value: { supports: () => false }
  })
})

import { createShapeId } from 'tldraw'

import {
  CN_EMBEDDED_VIDEO_TYPE,
  CNEmbeddedVideoShapeUtil,
  createCNEmbeddedVideoShape,
  normalizeEmbeddedVideoUrl,
  parseEmbeddedVideoUrl
} from '../../src/renderer/canvas/shapes/EmbeddedVideoShapeUtil'
import {
  CN_LOCAL_VIDEO_TYPE,
  CNLocalVideoShapeUtil,
  createCNLocalVideoShape
} from '../../src/renderer/canvas/shapes/LocalVideoShapeUtil'
import {
  CN_TIMESTAMP_NOTE_TYPE,
  CNTimestampNoteShapeUtil,
  createCNTimestampNoteShape,
  formatTimestamp
} from '../../src/renderer/canvas/shapes/TimestampNoteShapeUtil'
import {
  onVideoShapeEvent,
  registerVideoController,
  requestTimestampNote,
  requestVideoSeek,
  type VideoShapeEvent
} from '../../src/renderer/canvas/shapes/videoShapeEvents'

describe('video and timestamp shape layer', () => {
  it('creates schema-aligned persisted props without runtime media URLs', () => {
    const now = '2026-07-25T00:00:00.000Z'
    const local = createCNLocalVideoShape(10, 20, {
      mediaId: 'media:clip',
      mediaPath: 'media/videos/clip.mp4',
      caption: 'Interview',
      playbackRate: 1.25,
      createdAt: now,
      updatedAt: now
    })
    const embedded = createCNEmbeddedVideoShape(30, 40, {
      provider: 'vimeo',
      url: 'https://vimeo.com/123456',
      videoId: '123456',
      createdAt: now,
      updatedAt: now
    })
    const timestamp = createCNTimestampNoteShape(50, 60, {
      videoNodeId: 'video:clip',
      timestampSeconds: 155.4,
      content: 'Use this transition',
      createdAt: now,
      updatedAt: now
    })

    expect(local).toMatchObject({
      type: CN_LOCAL_VIDEO_TYPE,
      props: { mediaId: 'media:clip', mediaPath: 'media/videos/clip.mp4', playbackRate: 1.25 }
    })
    expect(local.props).not.toHaveProperty('src')
    expect(embedded).toMatchObject({
      type: CN_EMBEDDED_VIDEO_TYPE,
      props: { provider: 'vimeo', videoId: '123456' }
    })
    expect(timestamp).toMatchObject({
      type: CN_TIMESTAMP_NOTE_TYPE,
      props: { videoNodeId: 'video:clip', timestampSeconds: 155.4 }
    })
    expect(() =>
      CNLocalVideoShapeUtil.props.mediaPath.validate('media/videos/clip.mp4')
    ).not.toThrow()
    expect(() => CNEmbeddedVideoShapeUtil.props.provider.validate('untrusted')).toThrow()
    expect(() => CNTimestampNoteShapeUtil.props.timestampSeconds.validate(155.4)).not.toThrow()
  })

  it('normalizes only approved YouTube and Vimeo embeds', () => {
    expect(
      normalizeEmbeddedVideoUrl(
        'youtube',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'dQw4w9WgXcQ'
      )
    ).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1')
    expect(normalizeEmbeddedVideoUrl('vimeo', 'https://vimeo.com/123456', '123456', 'p:1')).toBe(
      'https://player.vimeo.com/video/123456?api=1&player_id=p%3A1'
    )
    expect(
      normalizeEmbeddedVideoUrl('youtube', 'https://youtube.com.evil.test/watch', 'dQw4w9WgXcQ')
    ).toBeNull()
    expect(
      normalizeEmbeddedVideoUrl('youtube', 'http://www.youtube.com/watch', 'dQw4w9WgXcQ')
    ).toBeNull()
    expect(normalizeEmbeddedVideoUrl('vimeo', 'https://vimeo.com/123', '../123')).toBeNull()
    expect(parseEmbeddedVideoUrl('https://youtu.be/dQw4w9WgXcQ?t=4')).toEqual({
      provider: 'youtube',
      url: 'https://youtu.be/dQw4w9WgXcQ?t=4',
      videoId: 'dQw4w9WgXcQ'
    })
    expect(parseEmbeddedVideoUrl('https://player.vimeo.com/video/123456')).toEqual({
      provider: 'vimeo',
      url: 'https://player.vimeo.com/video/123456',
      videoId: '123456'
    })
    expect(parseEmbeddedVideoUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
  })

  it('formats short and long timestamps', () => {
    expect(formatTimestamp(155.9)).toBe('02:35')
    expect(formatTimestamp(3_661)).toBe('01:01:01')
    expect(formatTimestamp(Number.NaN)).toBe('00:00')
  })

  it('publishes add-note and seek events through the registered video controller', () => {
    const pause = vi.fn()
    const seek = vi.fn()
    const events: VideoShapeEvent[] = []
    const unregister = registerVideoController('video:clip', {
      getCurrentTime: () => 155.4,
      pause,
      seek
    })
    const stopListening = onVideoShapeEvent((event) => events.push(event))
    const shapeId = createShapeId('video:clip')

    try {
      requestTimestampNote('video:clip', shapeId)
      expect(requestVideoSeek('video:clip', 61.2)).toBe(true)
      expect(events).toEqual([
        {
          type: 'timestamp-note-request',
          videoNodeId: 'video:clip',
          videoShapeId: shapeId,
          timestampSeconds: 155.4
        },
        { type: 'video-seek-request', videoNodeId: 'video:clip', timestampSeconds: 61.2 }
      ])
      expect(pause).toHaveBeenCalledOnce()
      expect(seek).toHaveBeenCalledWith(61.2)
    } finally {
      stopListening()
      unregister()
    }
  })
})
