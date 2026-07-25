import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'CSS', {
    configurable: true,
    value: { supports: () => false }
  })
})

import {
  CHECKLIST_MIN_HEIGHT,
  CHECKLIST_MIN_WIDTH,
  CN_CHECKLIST_TYPE,
  CN_FILE_TYPE,
  CN_IMAGE_TYPE,
  CN_EMBEDDED_VIDEO_TYPE,
  CN_LOCAL_VIDEO_TYPE,
  CN_NOTE_TYPE,
  CN_TIMESTAMP_NOTE_TYPE,
  CNChecklistShapeUtil,
  CNEmbeddedVideoShapeUtil,
  CNFileShapeUtil,
  CNImageShapeUtil,
  CNLocalVideoShapeUtil,
  CNNoteShapeUtil,
  CNTimestampNoteShapeUtil,
  NOTE_MIN_HEIGHT,
  NOTE_MIN_WIDTH,
  canvasShapeUtils,
  createCNChecklistItem,
  createCNChecklistShape,
  createCNNoteShape,
  getDefaultCNChecklistProps,
  getDefaultCNNoteProps,
  shapeUtils
} from '../../src/renderer/canvas/shapes'

describe('CanvasNote custom shapes', () => {
  it('exports one stable shape util list', () => {
    expect(shapeUtils).toBe(canvasShapeUtils)
    expect(canvasShapeUtils).toEqual([
      CNNoteShapeUtil,
      CNChecklistShapeUtil,
      CNImageShapeUtil,
      CNFileShapeUtil,
      CNLocalVideoShapeUtil,
      CNEmbeddedVideoShapeUtil,
      CNTimestampNoteShapeUtil
    ])
    expect(CNNoteShapeUtil.type).toBe(CN_NOTE_TYPE)
    expect(CNChecklistShapeUtil.type).toBe(CN_CHECKLIST_TYPE)
    expect(CNImageShapeUtil.type).toBe(CN_IMAGE_TYPE)
    expect(CNFileShapeUtil.type).toBe(CN_FILE_TYPE)
    expect(CNLocalVideoShapeUtil.type).toBe(CN_LOCAL_VIDEO_TYPE)
    expect(CNEmbeddedVideoShapeUtil.type).toBe(CN_EMBEDDED_VIDEO_TYPE)
    expect(CNTimestampNoteShapeUtil.type).toBe(CN_TIMESTAMP_NOTE_TYPE)
  })

  it('creates schema-aligned notes and checklists', () => {
    const now = '2026-07-25T00:00:00.000Z'
    const noteDefaults = getDefaultCNNoteProps(now)
    const checklistDefaults = getDefaultCNChecklistProps(now)
    const note = createCNNoteShape(40, 80, { ...noteDefaults, title: 'Research' })
    const item = createCNChecklistItem('Review clip')
    const checklist = createCNChecklistShape(100, 120, {
      ...checklistDefaults,
      items: [item]
    })

    expect(note).toMatchObject({
      type: 'cn-note',
      x: 40,
      y: 80,
      props: { title: 'Research', w: 300, h: 220, createdAt: now, updatedAt: now }
    })
    expect(checklist).toMatchObject({
      type: 'cn-checklist',
      x: 100,
      y: 120,
      props: { items: [{ text: 'Review clip', checked: false }], createdAt: now }
    })
    expect(item.id).toMatch(/^item:/)
  })

  it('validates styles/items and publishes usable resize minimums', () => {
    expect(() => CNNoteShapeUtil.props.background.validate('mint')).not.toThrow()
    expect(() => CNNoteShapeUtil.props.background.validate('neon')).toThrow()
    expect(() =>
      CNChecklistShapeUtil.props.items.validate([{ id: 'item:1', text: 'Done', checked: true }])
    ).not.toThrow()
    expect(() =>
      CNChecklistShapeUtil.props.items.validate([{ id: 'item:1', text: 'Done', checked: 'yes' }])
    ).toThrow()
    expect([NOTE_MIN_WIDTH, NOTE_MIN_HEIGHT, CHECKLIST_MIN_WIDTH, CHECKLIST_MIN_HEIGHT]).toEqual([
      220, 140, 240, 170
    ])
  })
})
