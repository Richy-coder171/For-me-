import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  Download,
  Frame,
  Globe2,
  Group,
  Hand,
  ImagePlus,
  Link2,
  ListChecks,
  LoaderCircle,
  Lock,
  Maximize2,
  Minus,
  MousePointer2,
  MonitorPlay,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Plus,
  Redo2,
  Save,
  Search,
  Settings2,
  StickyNote,
  Trash2,
  Undo2,
  Ungroup,
  Unlock,
  Video,
  X
} from 'lucide-react'
import {
  BreakPointProvider,
  TldrawEditor,
  createShapeId,
  createTLStore,
  defaultAssetUtils,
  defaultBindingUtils,
  defaultOverlayUtils,
  defaultShapeTools,
  defaultShapeUtils,
  defaultTools,
  useEditor,
  useValue,
  type Editor,
  type TLContent,
  type TLShape,
  type TLShapeId
} from 'tldraw'

import type { BoardFile, OpenBoard } from '../../shared/schemas/board'
import { MAX_IMAGE_TRANSFER_BYTES, type ImportedMedia } from '../../shared/schemas/media'
import type { AppSettings } from '../../shared/schemas/settings'
import { BrandMark } from '../components/BrandMark'
import { createAutosaveQueue, type AutosaveQueue } from './autosave'
import { searchBoard, type BoardSearchType } from './boardSearch'
import { boardToTldraw, tldrawToBoard } from './boardSerializer'
import {
  CN_CHECKLIST_TYPE,
  CN_EMBEDDED_VIDEO_TYPE,
  CN_FILE_TYPE,
  CN_IMAGE_TYPE,
  CN_LOCAL_VIDEO_TYPE,
  CN_LINK_TYPE,
  CN_NOTE_TYPE,
  CN_TIMESTAMP_NOTE_TYPE,
  canvasShapeUtils,
  createChecklistShape,
  createCNEmbeddedVideoShape,
  createCNFileShape,
  createCNImageShape,
  createCNLocalVideoShape,
  createCNLinkShape,
  createCNTimestampNoteShape,
  createNoteShape,
  getNextShapePosition,
  isCNChecklistShape,
  isCNEmbeddedVideoShape,
  isCNFileShape,
  isCNImageShape,
  isCNLocalVideoShape,
  isCNLinkShape,
  isCNNoteShape,
  isCNTimestampNoteShape,
  onVideoShapeEvent,
  parseEmbeddedVideoUrl,
  requestTimestampNote,
  type CNChecklistShape,
  type CNEmbeddedVideoShape,
  type CNFileShape,
  type CNImageShape,
  type CNLocalVideoShape,
  type CNLinkShape,
  type CNNoteShape,
  type CNTimestampNoteShape,
  type CNTextAlign,
  type CNTextBackground
} from './shapes'

const CANVAS_SHAPE_UTILS = [...defaultShapeUtils, ...canvasShapeUtils] as const
const CANVAS_TOOLS = [...defaultTools, ...defaultShapeTools] as const
const CANVAS_CLIPBOARD_MIME = 'application/x-canvasnote-tldraw'
const MAX_CANVAS_CLIPBOARD_CHARS = 5_000_000
const COMPACT_PROPERTIES_QUERY = '(max-width: 1079px)'

const BACKGROUNDS: Array<{ value: CNTextBackground; label: string; color: string }> = [
  { value: 'paper', label: 'Paper', color: '#fffefa' },
  { value: 'amber', label: 'Amber', color: '#fff0be' },
  { value: 'rose', label: 'Rose', color: '#ffe5e8' },
  { value: 'mint', label: 'Mint', color: '#e4f5e9' },
  { value: 'sky', label: 'Sky', color: '#e3f1fa' },
  { value: 'slate', label: 'Slate', color: '#e7e9ed' }
]

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

interface BoardEditorProps {
  stored: OpenBoard
  onBack: () => Promise<void>
  onSave: (board: BoardFile, expectedRevision: string) => Promise<OpenBoard>
  settings: AppSettings
  onOpenSettings: () => void
  onRegisterClosePreparation: (handler: () => Promise<void>) => () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement ||
    target instanceof HTMLVideoElement ||
    target instanceof HTMLIFrameElement ||
    (target instanceof HTMLElement &&
      (target.isContentEditable ||
        Boolean(target.closest('dialog,[role="dialog"],[role="menu"],[role="listbox"]'))))
  )
}

function saveLabel(state: SaveState): string {
  switch (state) {
    case 'dirty':
      return 'Unsaved changes'
    case 'saving':
      return 'Saving...'
    case 'error':
      return 'Save failed'
    default:
      return 'Saved locally'
  }
}

function selectedShapeLabel(shape: TLShape): string {
  switch (shape.type) {
    case CN_NOTE_TYPE:
      return 'Note'
    case CN_CHECKLIST_TYPE:
      return 'Checklist'
    case CN_IMAGE_TYPE:
      return 'Image'
    case CN_FILE_TYPE:
      return 'File'
    case CN_LOCAL_VIDEO_TYPE:
      return 'Local video'
    case CN_LINK_TYPE:
      return 'Link card'
    case CN_EMBEDDED_VIDEO_TYPE:
      return 'Embedded video'
    case CN_TIMESTAMP_NOTE_TYPE:
      return 'Timestamp note'
    case 'frame':
      return 'Frame'
    case 'arrow':
      return 'Connection'
    default:
      return 'Object'
  }
}

function canvasNoteId(shape: TLShape): string {
  const persistedId = shape.meta.canvasNoteId
  return typeof persistedId === 'string' && shape.id === `shape:${persistedId}`
    ? persistedId
    : shape.id.replace(/^shape:/, '')
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 50)
}

function parseLinkUrl(value: string): { url: string; domain: string } | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    if (
      (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      parsed.username ||
      parsed.password
    ) {
      return null
    }
    return { url: parsed.href, domain: parsed.hostname.toLowerCase() }
  } catch {
    return null
  }
}

function imageImportFilename(file: File): string | null {
  if (/\.(jpe?g|png|webp|gif)$/i.test(file.name)) return file.name
  const extension =
    {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    }[file.type.toLocaleLowerCase()] ?? null
  return extension ? `pasted-image.${extension}` : null
}

function TagsField({
  id,
  tags,
  placeholder,
  onChange
}: {
  id: string
  tags: string[]
  placeholder: string
  onChange: (tags: string[]) => void
}): React.JSX.Element {
  return (
    <label className="canvas-property-group">
      <span>Tags</span>
      <input
        key={`${id}:${tags.join(',')}`}
        type="text"
        defaultValue={tags.join(', ')}
        placeholder={placeholder}
        onBlur={(event) => onChange(parseTags(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </label>
  )
}

function HighlightedText({ text, query }: { text: string; query: string }): React.JSX.Element {
  const needle = query.trim().split(/\s+/)[0]?.toLocaleLowerCase() ?? ''
  const index = needle ? text.toLocaleLowerCase().indexOf(needle) : -1
  if (index < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  )
}

function ToolButton({
  label,
  shortcut,
  active = false,
  disabled = false,
  onClick,
  children
}: {
  label: string
  shortcut?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={`canvas-tool ${active ? 'is-active' : ''}`}
      aria-label={label}
      aria-pressed={active || undefined}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

interface BoardAddMenuProps {
  importing: 'image' | 'video' | 'file' | null
  onAttachFile: () => void
  onAddLink: () => void
  onEmbedVideo: () => void
}

export function BoardAddMenu({
  importing,
  onAttachFile,
  onAddLink,
  onEmbedVideo
}: BoardAddMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pendingFocusRef = useRef(0)

  const focusItem = useCallback((start: number, direction: 1 | -1 = 1) => {
    const items = itemRefs.current
    for (let offset = 0; offset < items.length; offset += 1) {
      const index = (start + offset * direction + items.length) % items.length
      const item = items[index]
      if (item && !item.disabled) {
        item.focus()
        return
      }
    }
  }, [])

  const openMenu = useCallback((focusIndex = 0) => {
    pendingFocusRef.current = focusIndex
    setOpen(true)
  }, [])

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!open) return
    focusItem(pendingFocusRef.current, pendingFocusRef.current === 2 ? -1 : 1)
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) closeMenu()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [closeMenu, focusItem, open])

  const handleItemKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusItem(index + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusItem(index - 1, -1)
        break
      case 'Home':
        event.preventDefault()
        focusItem(0)
        break
      case 'End':
        event.preventDefault()
        focusItem(itemRefs.current.length - 1, -1)
        break
      case 'Escape':
        event.preventDefault()
        closeMenu(true)
        break
    }
  }

  const run = (action: () => void, restoreFocus = false): void => {
    closeMenu(restoreFocus)
    action()
  }

  return (
    <div className="canvas-add-menu" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`canvas-tool ${open ? 'is-active' : ''}`}
        aria-label="Add"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'canvas-add-menu' : undefined}
        title="Add file, link, or embedded video"
        onClick={() => (open ? closeMenu(true) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            openMenu(event.key === 'ArrowUp' ? 2 : 0)
          }
        }}
      >
        <Plus size={18} />
      </button>
      {open && (
        <div
          id="canvas-add-menu"
          className="canvas-add-popover"
          role="menu"
          aria-label="Add to board"
        >
          <button
            ref={(element) => {
              itemRefs.current[0] = element
            }}
            type="button"
            role="menuitem"
            disabled={importing !== null}
            onKeyDown={(event) => handleItemKeyDown(event, 0)}
            onClick={() => run(onAttachFile, true)}
          >
            {importing === 'file' ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <Paperclip size={16} />
            )}
            Attach file
          </button>
          <button
            ref={(element) => {
              itemRefs.current[1] = element
            }}
            type="button"
            role="menuitem"
            onKeyDown={(event) => handleItemKeyDown(event, 1)}
            onClick={() => run(onAddLink)}
          >
            <Globe2 size={16} />
            Add link card
          </button>
          <button
            ref={(element) => {
              itemRefs.current[2] = element
            }}
            type="button"
            role="menuitem"
            onKeyDown={(event) => handleItemKeyDown(event, 2)}
            onClick={() => run(onEmbedVideo)}
          >
            <MonitorPlay size={16} />
            Embed YouTube or Vimeo video
          </button>
        </div>
      )}
    </div>
  )
}

function clipboardPayload(content: TLContent): string {
  return JSON.stringify({ type: 'application/tldraw', kind: 'content', version: 2, data: content })
}

function clipboardContent(value: string): TLContent | null {
  if (!value || value.length > MAX_CANVAS_CLIPBOARD_CHARS) return null
  try {
    const parsed = JSON.parse(value) as {
      type?: unknown
      kind?: unknown
      version?: unknown
      data?: unknown
    }
    if (
      parsed.type !== 'application/tldraw' ||
      parsed.kind !== 'content' ||
      parsed.version !== 2 ||
      !parsed.data ||
      typeof parsed.data !== 'object'
    ) {
      return null
    }
    const content = parsed.data as Partial<TLContent>
    if (
      !Array.isArray(content.shapes) ||
      !Array.isArray(content.rootShapeIds) ||
      !Array.isArray(content.assets) ||
      (content.bindings !== undefined && !Array.isArray(content.bindings)) ||
      !content.schema ||
      typeof content.schema !== 'object'
    ) {
      return null
    }
    return content as TLContent
  } catch {
    return null
  }
}

function clipboardContentFromHtml(value: string): TLContent | null {
  const payload = /<div data-tldraw[^>]*>([\s\S]*)<\/div>/.exec(value)?.[1]
  return payload ? clipboardContent(payload) : null
}

function CanvasInteractionLayer(): React.JSX.Element {
  const editor = useEditor()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const clipboardCache = useRef<string | null>(null)

  const currentClipboard = useCallback((): { payload: string; text: string } | null => {
    const content = editor.getContentFromCurrentPage(editor.getSelectedShapeIds())
    if (!content) return null
    const payload = clipboardPayload(content)
    const text = content.shapes
      .map((shape) => editor.getShapeUtil(shape).getText(shape))
      .filter((value): value is string => Boolean(value))
      .join(' ')
    clipboardCache.current = payload
    return { payload, text: text || ' ' }
  }, [editor])

  const pastePayload = useCallback(
    (payload: string): boolean => {
      const content = clipboardContent(payload)
      if (!content) return false
      try {
        editor.complete()
        editor.markHistoryStoppingPoint('paste')
        editor.putContentOntoCurrentPage(content, { select: true })
        return true
      } catch {
        return false
      }
    },
    [editor]
  )

  const copyFromMenu = useCallback(async (): Promise<void> => {
    const copied = currentClipboard()
    if (!copied) return
    const html = `<div data-tldraw>${copied.payload}</div>`
    const navigator = editor.getContainer().ownerDocument.defaultView?.navigator
    if (!navigator) return
    if (navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([copied.text], { type: 'text/plain' })
        })
      ])
    } else {
      await navigator.clipboard?.writeText(html)
    }
  }, [currentClipboard, editor])

  const pasteFromMenu = useCallback(async (): Promise<void> => {
    const navigator = editor.getContainer().ownerDocument.defaultView?.navigator
    if (!navigator) return
    try {
      for (const item of (await navigator.clipboard?.read()) ?? []) {
        if (!item.types.includes('text/html')) continue
        const html = await (await item.getType('text/html')).text()
        const content = clipboardContentFromHtml(html)
        if (content && pastePayload(clipboardPayload(content))) return
      }
    } catch {
      // The in-memory copy remains available if the OS denies a menu-triggered read.
    }
    if (clipboardCache.current) pastePayload(clipboardCache.current)
  }, [editor, pastePayload])

  useEffect(() => {
    const document = editor.getContainer().ownerDocument
    const copy = (event: ClipboardEvent): void => {
      if (isEditableTarget(event.target)) return
      const copied = currentClipboard()
      if (!copied || !event.clipboardData) return
      const html = `<div data-tldraw>${copied.payload}</div>`
      event.clipboardData.setData(CANVAS_CLIPBOARD_MIME, copied.payload)
      event.clipboardData.setData('text/html', html)
      event.clipboardData.setData('text/plain', copied.text)
      event.preventDefault()
    }
    const cut = (event: ClipboardEvent): void => {
      const selected = editor.getSelectedShapeIds()
      copy(event)
      if (event.defaultPrevented) {
        editor.markHistoryStoppingPoint('cut')
        editor.deleteShapes(selected)
      }
    }
    const paste = (event: ClipboardEvent): void => {
      if (isEditableTarget(event.target)) return
      const direct = event.clipboardData?.getData(CANVAS_CLIPBOARD_MIME)
      const html = event.clipboardData?.getData('text/html') ?? ''
      const htmlContent = direct ? null : clipboardContentFromHtml(html)
      const payload = direct || (htmlContent ? clipboardPayload(htmlContent) : '')
      if (!payload) return
      if (!pastePayload(payload)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    document.addEventListener('copy', copy, true)
    document.addEventListener('cut', cut, true)
    document.addEventListener('paste', paste, true)
    return () => {
      document.removeEventListener('copy', copy, true)
      document.removeEventListener('cut', cut, true)
      document.removeEventListener('paste', paste, true)
    }
  }, [currentClipboard, editor, pastePayload])

  const minimap = useValue(
    'CanvasNote minimap',
    () => {
      const viewport = editor.getViewportPageBounds()
      const content = editor.getCurrentPageBounds()
      const x = Math.min(viewport.x, content?.x ?? viewport.x)
      const y = Math.min(viewport.y, content?.y ?? viewport.y)
      const maxX = Math.max(viewport.maxX, content?.maxX ?? viewport.maxX)
      const maxY = Math.max(viewport.maxY, content?.maxY ?? viewport.maxY)
      return {
        bounds: { x, y, w: Math.max(1, maxX - x), h: Math.max(1, maxY - y) },
        viewport: { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h },
        shapes: editor.getCurrentPageShapes().flatMap((shape) => {
          if (shape.type === 'group' || shape.type === 'arrow') return []
          const bounds = editor.getShapePageBounds(shape)
          return bounds
            ? [{ id: shape.id, x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }]
            : []
        })
      }
    },
    [editor]
  )

  useEffect(() => {
    const document = editor.getContainer().ownerDocument
    const openMenu = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Element) || !editor.getContainer().contains(target)) return
      if (isEditableTarget(target)) return
      event.preventDefault()
      const bounds = editor.getContainer().getBoundingClientRect()
      setMenu({
        x: Math.max(bounds.left + 8, Math.min(event.clientX, bounds.right - 184)),
        y: Math.max(bounds.top + 8, Math.min(event.clientY, bounds.bottom - 260))
      })
    }
    const closeMenu = (event: PointerEvent): void => {
      const target = event.target
      if (target instanceof Element && target.closest('.canvas-context-menu')) return
      setMenu(null)
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenu(null)
    }
    document.addEventListener('contextmenu', openMenu)
    document.addEventListener('pointerdown', closeMenu, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('contextmenu', openMenu)
      document.removeEventListener('pointerdown', closeMenu, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [editor])

  const percentRect = (bounds: { x: number; y: number; w: number; h: number }) => ({
    left: `${((bounds.x - minimap.bounds.x) / minimap.bounds.w) * 100}%`,
    top: `${((bounds.y - minimap.bounds.y) / minimap.bounds.h) * 100}%`,
    width: `${(bounds.w / minimap.bounds.w) * 100}%`,
    height: `${(bounds.h / minimap.bounds.h) * 100}%`
  })

  const run = (action: () => unknown): void => {
    setMenu(null)
    void action()
  }
  const selected = editor.getSelectedShapeIds()

  return (
    <>
      <div
        className="canvas-minimap"
        role="img"
        aria-label="Canvas minimap"
        title="Click to move around the board"
        onPointerDown={(event) => {
          editor.markEventAsHandled(event)
          event.stopPropagation()
          const rect = event.currentTarget.getBoundingClientRect()
          const point = {
            x: minimap.bounds.x + ((event.clientX - rect.left) / rect.width) * minimap.bounds.w,
            y: minimap.bounds.y + ((event.clientY - rect.top) / rect.height) * minimap.bounds.h
          }
          editor.centerOnPoint(point)
        }}
      >
        {minimap.shapes.map((shape) => (
          <span className="canvas-minimap-shape" key={shape.id} style={percentRect(shape)} />
        ))}
        <span className="canvas-minimap-viewport" style={percentRect(minimap.viewport)} />
      </div>

      {menu && (
        <div
          className="canvas-context-menu"
          role="menu"
          aria-label="Canvas context menu"
          style={{ left: menu.x, top: menu.y }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            role="menuitem"
            disabled={selected.length === 0}
            onClick={() => run(copyFromMenu)}
          >
            Copy <span>Ctrl+C</span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={selected.length === 0}
            onClick={() =>
              run(async () => {
                await copyFromMenu()
                editor.markHistoryStoppingPoint('cut')
                editor.deleteShapes(selected)
              })
            }
          >
            Cut <span>Ctrl+X</span>
          </button>
          <button type="button" role="menuitem" onClick={() => run(pasteFromMenu)}>
            Paste <span>Ctrl+V</span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={selected.length === 0}
            onClick={() => run(() => editor.duplicateShapes(selected, { x: 24, y: 24 }))}
          >
            Duplicate <span>Ctrl+D</span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={selected.length === 0}
            onClick={() => run(() => editor.toggleLock(selected))}
          >
            Toggle lock
          </button>
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            disabled={selected.length === 0}
            onClick={() => run(() => editor.deleteShapes(selected))}
          >
            Delete <span>Del</span>
          </button>
        </div>
      )}
    </>
  )
}

const CANVAS_COMPONENTS = { InFrontOfTheCanvas: CanvasInteractionLayer }

export function BoardEditor({
  stored,
  onBack,
  onSave,
  settings,
  onOpenSettings,
  onRegisterClosePreparation
}: BoardEditorProps): React.JSX.Element {
  const [store] = useState(() => createTLStore({ shapeUtils: CANVAS_SHAPE_UTILS }))
  const [editor, setEditor] = useState<Editor | null>(null)
  const [title, setTitle] = useState(stored.board.title)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [selectedShape, setSelectedShape] = useState<TLShape | null>(null)
  const [selectedShapeIds, setSelectedShapeIds] = useState<TLShapeId[]>([])
  const [activeTool, setActiveTool] = useState('select')
  const [zoom, setZoom] = useState(stored.board.camera.zoom)
  const [revision, setRevision] = useState(stored.revision)
  const [propertiesOpen, setPropertiesOpen] = useState(
    () => !(window.matchMedia?.(COMPACT_PROPERTIES_QUERY).matches ?? false)
  )
  const [hasCanvasObjects, setHasCanvasObjects] = useState(
    stored.board.nodes.length > 0 || stored.board.connections.length > 0
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [importing, setImporting] = useState<'image' | 'video' | 'file' | null>(null)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const [embedUrl, setEmbedUrl] = useState('')
  const [embedError, setEmbedError] = useState<string | null>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkDescription, setLinkDescription] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'all' | 'selection'>('all')
  const [exporting, setExporting] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<BoardSearchType>('all')
  const [searchTag, setSearchTag] = useState('')
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)
  const [searchBoardSnapshot, setSearchBoardSnapshot] = useState(stored.board)
  const editorRef = useRef<Editor | null>(null)
  const titleRef = useRef(title)
  const boardRef = useRef(stored.board)
  const revisionRef = useRef(stored.revision)
  const propertiesPreferenceRef = useRef(true)

  const saveCurrentBoard = useCallback(async (): Promise<void> => {
    const currentEditor = editorRef.current
    if (!currentEditor) return

    setSaveState('saving')
    const camera = currentEditor.getCamera()
    const result = tldrawToBoard(
      {
        ...boardRef.current,
        title: titleRef.current.trim() || boardRef.current.title
      },
      currentEditor.store.allRecords(),
      { x: camera.x, y: camera.y, zoom: camera.z }
    )

    if (result.diagnostics.length > 0) {
      setSaveState('error')
      setNotice(`Save blocked: ${result.diagnostics[0]?.message ?? 'unsupported canvas object.'}`)
      throw new Error('CanvasNote refused a lossy board save.')
    }

    try {
      const saved = await onSave(result.board, revisionRef.current)
      boardRef.current = saved.board
      revisionRef.current = saved.revision
      setRevision(saved.revision)
      titleRef.current = saved.board.title
      setTitle(saved.board.title)
      setSaveState('saved')
    } catch (error) {
      setSaveState('error')
      throw error
    }
  }, [onSave])

  const [saveQueue] = useState<AutosaveQueue>(() =>
    createAutosaveQueue(async () => undefined, settings.autosaveDelayMs)
  )

  useEffect(() => {
    saveQueue.setSave(saveCurrentBoard)
  }, [saveCurrentBoard, saveQueue])

  useEffect(() => {
    saveQueue.setDelay(settings.autosaveDelayMs)
  }, [saveQueue, settings.autosaveDelayMs])

  useEffect(
    () => onRegisterClosePreparation(() => saveQueue.flush()),
    [onRegisterClosePreparation, saveQueue]
  )

  const markDirty = useCallback(() => {
    setSaveState((current) => (current === 'saving' ? current : 'dirty'))
    saveQueue.schedule()
  }, [saveQueue])

  const toggleProperties = useCallback(() => {
    setPropertiesOpen((open) => {
      propertiesPreferenceRef.current = !open
      return !open
    })
  }, [])

  const hideProperties = useCallback(() => {
    propertiesPreferenceRef.current = false
    setPropertiesOpen(false)
  }, [])

  const handleMount = useCallback((mountedEditor: Editor) => {
    const loaded = boardToTldraw(boardRef.current, mountedEditor.getCurrentPageId())
    mountedEditor.store.put(loaded.records)
    mountedEditor.setCamera(
      {
        x: loaded.camera.x,
        y: loaded.camera.y,
        z: loaded.camera.zoom
      },
      { immediate: true }
    )
    mountedEditor.clearHistory()
    editorRef.current = mountedEditor
    setEditor(mountedEditor)
    setZoom(mountedEditor.getZoomLevel())
    if (loaded.diagnostics.length > 0) {
      setNotice(
        `${loaded.diagnostics.length} board object(s) could not be shown in this editor yet.`
      )
    }
  }, [])

  useEffect(() => {
    if (!editor) return

    let previousCamera = editor.getCamera()
    const updateShell = (): void => {
      const selection = editor.getSelectedShapeIds()
      setSelectedShapeIds(selection)
      setSelectedShape(selection.length === 1 ? editor.getOnlySelectedShape() : null)
      setActiveTool(editor.getCurrentToolId())
      setZoom(editor.getZoomLevel())
      setHasCanvasObjects(editor.getCurrentPageShapes().length > 0)
      const camera = editor.getCamera()
      if (
        camera.x !== previousCamera.x ||
        camera.y !== previousCamera.y ||
        camera.z !== previousCamera.z
      ) {
        previousCamera = camera
        markDirty()
      }
    }

    updateShell()
    const stopDocumentListener = editor.store.listen(markDirty, {
      source: 'user',
      scope: 'document'
    })
    const stopShellListener = editor.store.listen(updateShell, { source: 'all', scope: 'all' })
    return () => {
      stopDocumentListener()
      stopShellListener()
    }
  }, [editor, markDirty])

  useEffect(() => {
    return () => {
      editorRef.current = null
      saveQueue.cancel()
    }
  }, [saveQueue])

  useEffect(() => {
    const flushOnBlur = (): void => {
      void saveQueue.flush().catch(() => undefined)
    }
    window.addEventListener('blur', flushOnBlur)
    return () => window.removeEventListener('blur', flushOnBlur)
  }, [saveQueue])

  useEffect(() => {
    const media = window.matchMedia?.(COMPACT_PROPERTIES_QUERY)
    if (!media) return
    const applyCompactLayout = (event: MediaQueryListEvent): void => {
      setPropertiesOpen(event.matches ? false : propertiesPreferenceRef.current)
    }
    media.addEventListener('change', applyCompactLayout)
    return () => media.removeEventListener('change', applyCompactLayout)
  }, [])

  const createFrame = useCallback(() => {
    if (!editor) return
    const center = editor.getViewportPageBounds().center
    const id = createShapeId()
    editor
      .createShape({
        id,
        type: 'frame',
        x: center.x - 320,
        y: center.y - 210,
        props: { w: 640, h: 420, name: 'Frame' }
      })
      .select(id)
  }, [editor])

  const setTool = useCallback(
    (tool: string) => {
      editor?.setCurrentTool(tool)
    },
    [editor]
  )

  const placeImportedMedia = useCallback(
    (
      media: ImportedMedia,
      kind: 'image' | 'video' | 'file',
      dropPoint?: { x: number; y: number }
    ): void => {
      if (!editor) return
      const width = kind === 'video' ? 480 : kind === 'image' ? 360 : 320
      const height = kind === 'video' ? 360 : kind === 'image' ? 240 : 148
      const position = dropPoint
        ? { x: dropPoint.x - width / 2, y: dropPoint.y - height / 2 }
        : getNextShapePosition(editor, width, height)
      const shape =
        kind === 'image'
          ? createCNImageShape(position.x, position.y, {
              mediaId: media.id,
              mediaPath: media.relativePath,
              altText: media.filename
            })
          : kind === 'video'
            ? createCNLocalVideoShape(position.x, position.y, {
                mediaId: media.id,
                mediaPath: media.relativePath,
                caption: media.filename,
                playbackRate: settings.defaultPlaybackRate
              })
            : createCNFileShape(position.x, position.y, {
                mediaId: media.id,
                mediaPath: media.relativePath,
                filename: media.filename,
                extension: media.extension,
                sizeBytes: media.sizeBytes
              })
      editor.createShape(shape).select(shape.id)
    },
    [editor, settings.defaultPlaybackRate]
  )

  const importMedia = useCallback(
    async (kind: 'image' | 'video' | 'file'): Promise<void> => {
      if (!editor || importing) return
      setImporting(kind)
      try {
        const media = await window.canvasNote.media.importFile(kind)
        if (media) placeImportedMedia(media, kind)
      } catch {
        setNotice(`CanvasNote could not import that ${kind}.`)
      } finally {
        setImporting(null)
      }
    },
    [editor, importing, placeImportedMedia]
  )

  const importImageData = useCallback(
    async (file: File, dropPoint?: { x: number; y: number }): Promise<void> => {
      if (!editor || importing) return
      const filename = imageImportFilename(file)
      if (!filename) {
        setNotice('CanvasNote supports dropped or pasted JPG, PNG, WebP, and GIF images.')
        return
      }
      if (file.size <= 0 || file.size > MAX_IMAGE_TRANSFER_BYTES) {
        setNotice('Dropped or pasted images must be no larger than 25 MB.')
        return
      }
      setImporting('image')
      try {
        const data = new Uint8Array(await file.arrayBuffer())
        const media = await window.canvasNote.media.importImageData(filename, data)
        placeImportedMedia(media, 'image', dropPoint)
      } catch {
        setNotice('CanvasNote could not import that image.')
      } finally {
        setImporting(null)
      }
    },
    [editor, importing, placeImportedMedia]
  )

  useEffect(() => {
    if (!editor) return
    const pasteImage = (event: ClipboardEvent): void => {
      if (isEditableTarget(event.target)) return
      const file = Array.from(event.clipboardData?.files ?? []).find(imageImportFilename)
      if (!file) return
      event.preventDefault()
      event.stopImmediatePropagation()
      void importImageData(file)
    }
    document.addEventListener('paste', pasteImage, true)
    return () => document.removeEventListener('paste', pasteImage, true)
  }, [editor, importImageData])

  const addEmbeddedVideo = useCallback(() => {
    if (!editor) return
    const parsed = parseEmbeddedVideoUrl(embedUrl)
    if (!parsed) {
      setEmbedError('Paste a valid HTTPS YouTube or Vimeo video URL.')
      return
    }
    const position = getNextShapePosition(editor, 480, 360)
    const shape = createCNEmbeddedVideoShape(position.x, position.y, parsed)
    editor.createShape(shape).select(shape.id)
    setEmbedUrl('')
    setEmbedError(null)
    setEmbedDialogOpen(false)
  }, [editor, embedUrl])

  const addLinkCard = useCallback(() => {
    if (!editor) return
    const parsed = parseLinkUrl(linkUrl)
    if (!parsed) {
      setLinkError('Enter a valid HTTP or HTTPS URL without a username or password.')
      return
    }
    const position = getNextShapePosition(editor, 340, 190)
    const shape = createCNLinkShape(position.x, position.y, {
      ...parsed,
      title: linkTitle.trim(),
      description: linkDescription.trim()
    })
    editor.createShape(shape).select(shape.id)
    setLinkUrl('')
    setLinkTitle('')
    setLinkDescription('')
    setLinkError(null)
    setLinkDialogOpen(false)
  }, [editor, linkDescription, linkTitle, linkUrl])

  useEffect(() => {
    if (!editor) return
    return onVideoShapeEvent((event) => {
      if (event.type !== 'timestamp-note-request') return
      const videoBounds = editor.getShapePageBounds(event.videoShapeId)
      const position = videoBounds
        ? { x: videoBounds.maxX + 32, y: videoBounds.y }
        : getNextShapePosition(editor, 300, 180)
      const shape = createCNTimestampNoteShape(position.x, position.y, {
        videoNodeId: event.videoNodeId,
        timestampSeconds: event.timestampSeconds
      })
      editor.createShape(shape).select(shape.id).setEditingShape(shape.id)
    })
  }, [editor])

  const openSearch = useCallback(() => {
    const currentEditor = editorRef.current
    if (currentEditor) {
      const camera = currentEditor.getCamera()
      const result = tldrawToBoard(boardRef.current, currentEditor.store.allRecords(), {
        x: camera.x,
        y: camera.y,
        zoom: camera.z
      })
      setSearchBoardSnapshot(result.board)
    }
    setActiveSearchIndex(0)
    setSearchOpen(true)
  }, [])

  const searchResults = useMemo(
    () => searchBoard(searchBoardSnapshot, searchQuery, searchType, searchTag),
    [searchBoardSnapshot, searchQuery, searchTag, searchType]
  )

  const focusSearchResult = useCallback(
    (index: number) => {
      if (!editor) return
      const result = searchResults[index]
      if (!result) return
      const id = createShapeId(result.nodeId)
      if (!editor.getShape(id)) {
        setNotice('That result is not available on the canvas.')
        return
      }
      editor.select(id).zoomToSelection({ animation: { duration: 180 } })
      setSearchOpen(false)
    },
    [editor, searchResults]
  )

  useEffect(() => {
    if (!editor) return

    const onKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase()
      const command = event.ctrlKey || event.metaKey

      if (command && key === 'k') {
        event.preventDefault()
        openSearch()
        return
      }
      if (isEditableTarget(event.target)) return

      if (command && key === 's') {
        event.preventDefault()
        void saveQueue.flush().catch(() => undefined)
        return
      }
      if (command && key === 'd') {
        event.preventDefault()
        editor.duplicateShapes(editor.getSelectedShapeIds(), { x: 24, y: 24 })
        return
      }
      if (command && key === 'g') {
        event.preventDefault()
        const selection = editor.getSelectedShapeIds()
        if (event.shiftKey) editor.ungroupShapes(selection)
        else if (selection.length > 1) editor.groupShapes(selection)
        return
      }
      if (command && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) editor.redo()
        else editor.undo()
        return
      }
      if (command || event.altKey) return

      switch (key) {
        case 'v':
          if (event.shiftKey) void importMedia('video')
          else setTool('select')
          break
        case 'h':
          setTool('hand')
          break
        case 'n':
          createNoteShape(editor)
          break
        case 'c':
          createChecklistShape(editor)
          break
        case 'f':
          createFrame()
          break
        case 'i':
          void importMedia('image')
          break
        case 'l':
          setTool('arrow')
          break
        case '0':
          editor.zoomToFit({ animation: { duration: 160 } })
          break
        case '1':
          editor.resetZoom(undefined, { animation: { duration: 160 } })
          break
        case 'delete':
        case 'backspace':
          editor.deleteShapes(editor.getSelectedShapeIds())
          break
        case 'escape':
          editor.complete().setCurrentTool('select').selectNone()
          break
        default:
          return
      }
      event.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [createFrame, editor, importMedia, openSearch, saveQueue, setTool])

  const updateTextShape = useCallback(
    (props: {
      background?: CNTextBackground
      textColor?: string
      fontSize?: number
      textAlign?: CNTextAlign
      tags?: string[]
    }) => {
      if (!editor) return
      const selected = editor.getOnlySelectedShape()
      const updatedAt = new Date().toISOString()
      if (selected && isCNNoteShape(selected)) {
        editor.updateShape<CNNoteShape>({
          id: selected.id,
          type: CN_NOTE_TYPE,
          props: { ...props, updatedAt }
        })
      } else if (selected && isCNChecklistShape(selected)) {
        editor.updateShape<CNChecklistShape>({
          id: selected.id,
          type: CN_CHECKLIST_TYPE,
          props: { ...props, updatedAt }
        })
      }
    },
    [editor]
  )

  const textShape =
    selectedShape && (isCNNoteShape(selectedShape) || isCNChecklistShape(selectedShape))
      ? selectedShape
      : null
  const imageShape = selectedShape && isCNImageShape(selectedShape) ? selectedShape : null
  const fileShape = selectedShape && isCNFileShape(selectedShape) ? selectedShape : null
  const localVideoShape = selectedShape && isCNLocalVideoShape(selectedShape) ? selectedShape : null
  const linkShape = selectedShape && isCNLinkShape(selectedShape) ? selectedShape : null
  const embeddedVideoShape =
    selectedShape && isCNEmbeddedVideoShape(selectedShape) ? selectedShape : null
  const timestampShape =
    selectedShape && isCNTimestampNoteShape(selectedShape) ? selectedShape : null

  const updateImageShape = useCallback(
    (
      props: Partial<
        Pick<
          CNImageShape['props'],
          'mediaId' | 'mediaPath' | 'caption' | 'altText' | 'fit' | 'tags'
        >
      >
    ) => {
      if (!editor || !imageShape) return
      editor.updateShape<CNImageShape>({
        id: imageShape.id,
        type: CN_IMAGE_TYPE,
        props: { ...props, updatedAt: new Date().toISOString() }
      })
    },
    [editor, imageShape]
  )

  const updateFileShape = useCallback(
    (
      props: Partial<
        Pick<
          CNFileShape['props'],
          'mediaId' | 'mediaPath' | 'filename' | 'extension' | 'sizeBytes' | 'tags'
        >
      >
    ) => {
      if (!editor || !fileShape) return
      editor.updateShape<CNFileShape>({
        id: fileShape.id,
        type: CN_FILE_TYPE,
        props: { ...props, updatedAt: new Date().toISOString() }
      })
    },
    [editor, fileShape]
  )

  const updateLocalVideoShape = useCallback(
    (
      props: Partial<
        Pick<
          CNLocalVideoShape['props'],
          'mediaId' | 'mediaPath' | 'caption' | 'playbackRate' | 'tags'
        >
      >
    ) => {
      if (!editor || !localVideoShape) return
      editor.updateShape<CNLocalVideoShape>({
        id: localVideoShape.id,
        type: CN_LOCAL_VIDEO_TYPE,
        props: { ...props, updatedAt: new Date().toISOString() }
      })
    },
    [editor, localVideoShape]
  )

  const replaceSelectedMedia = useCallback(
    async (kind: 'image' | 'video' | 'file'): Promise<void> => {
      if (importing) return
      setImporting(kind)
      try {
        const media = await window.canvasNote.media.importFile(kind)
        if (!media) return
        if (kind === 'image' && imageShape) {
          updateImageShape({
            mediaId: media.id,
            mediaPath: media.relativePath,
            altText: imageShape.props.altText || media.filename
          })
        } else if (kind === 'video' && localVideoShape) {
          updateLocalVideoShape({
            mediaId: media.id,
            mediaPath: media.relativePath,
            caption: localVideoShape.props.caption || media.filename
          })
        } else if (kind === 'file' && fileShape) {
          updateFileShape({
            mediaId: media.id,
            mediaPath: media.relativePath,
            filename: media.filename,
            extension: media.extension,
            sizeBytes: media.sizeBytes
          })
        }
        setNotice(`${kind === 'video' ? 'Video' : kind === 'image' ? 'Image' : 'File'} replaced.`)
      } catch {
        setNotice(`CanvasNote could not replace that ${kind}.`)
      } finally {
        setImporting(null)
      }
    },
    [
      fileShape,
      imageShape,
      importing,
      localVideoShape,
      updateFileShape,
      updateImageShape,
      updateLocalVideoShape
    ]
  )

  const updateEmbeddedVideoShape = useCallback(
    (props: Partial<Pick<CNEmbeddedVideoShape['props'], 'caption' | 'tags'>>) => {
      if (!editor || !embeddedVideoShape) return
      editor.updateShape<CNEmbeddedVideoShape>({
        id: embeddedVideoShape.id,
        type: CN_EMBEDDED_VIDEO_TYPE,
        props: { ...props, updatedAt: new Date().toISOString() }
      })
    },
    [editor, embeddedVideoShape]
  )

  const updateLinkShape = useCallback(
    (
      props: Partial<
        Pick<CNLinkShape['props'], 'url' | 'title' | 'description' | 'domain' | 'tags'>
      >
    ) => {
      if (!editor || !linkShape) return
      editor.updateShape<CNLinkShape>({
        id: linkShape.id,
        type: CN_LINK_TYPE,
        props: { ...props, updatedAt: new Date().toISOString() }
      })
    },
    [editor, linkShape]
  )

  const updateTimestampShape = useCallback(
    (
      props: Partial<
        Pick<
          CNTimestampNoteShape['props'],
          | 'timestampSeconds'
          | 'content'
          | 'background'
          | 'textColor'
          | 'fontSize'
          | 'textAlign'
          | 'tags'
        >
      >
    ) => {
      if (!editor || !timestampShape) return
      editor.updateShape<CNTimestampNoteShape>({
        id: timestampShape.id,
        type: CN_TIMESTAMP_NOTE_TYPE,
        props: { ...props, updatedAt: new Date().toISOString() }
      })
    },
    [editor, timestampShape]
  )

  const goBack = async (): Promise<void> => {
    try {
      await saveQueue.flush()
      await onBack()
    } catch {
      // The store exposes the save error; staying here prevents silent data loss.
    }
  }

  const saveNow = (): void => {
    void saveQueue.flush().catch(() => undefined)
  }

  const exportJson = async (): Promise<void> => {
    if (exporting) return
    setExporting(true)
    try {
      await saveQueue.flush()
      const saved = await window.canvasNote.export.json(boardRef.current)
      if (saved) setNotice('Board JSON exported.')
      setExportDialogOpen(false)
    } catch {
      setNotice('CanvasNote could not export this board as JSON.')
    } finally {
      setExporting(false)
    }
  }

  const exportVisual = async (format: 'png' | 'pdf'): Promise<void> => {
    if (!editor || exporting) return
    const previousCamera = editor.getCamera()
    const previousSelection = editor.getSelectedShapeIds()
    const exportIds =
      exportScope === 'selection' ? previousSelection : [...editor.getCurrentPageShapeIds()]
    if (exportIds.length === 0) {
      setNotice(
        exportScope === 'selection'
          ? 'Select at least one object to export.'
          : 'The board is empty.'
      )
      return
    }

    setExporting(true)
    try {
      if (exportScope === 'selection') editor.select(...exportIds).zoomToSelection()
      else editor.zoomToFit()
      await new Promise((resolve) => setTimeout(resolve, 180))

      const canvas = document.querySelector<HTMLElement>('[data-testid="canvas-editor"]')
      if (!canvas) throw new Error('Canvas element is unavailable.')
      const canvasRect = canvas.getBoundingClientRect()
      let left = canvasRect.left
      let top = canvasRect.top
      let right = canvasRect.right
      let bottom = canvasRect.bottom

      if (exportScope === 'selection') {
        const bounds = editor.getSelectionPageBounds()
        if (!bounds) throw new Error('Selection bounds are unavailable.')
        const start = editor.pageToViewport({ x: bounds.x, y: bounds.y })
        const end = editor.pageToViewport({ x: bounds.maxX, y: bounds.maxY })
        const padding = 18
        left = Math.max(canvasRect.left, canvasRect.left + start.x - padding)
        top = Math.max(canvasRect.top, canvasRect.top + start.y - padding)
        right = Math.min(canvasRect.right, canvasRect.left + end.x + padding)
        bottom = Math.min(canvasRect.bottom, canvasRect.top + end.y + padding)
      }

      editor.selectNone()
      document.documentElement.classList.add('canvas-exporting')
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
      const saved = await window.canvasNote.export.canvas({
        format,
        title: titleRef.current.trim() || boardRef.current.title,
        rect: {
          x: Math.max(0, Math.floor(left)),
          y: Math.max(0, Math.floor(top)),
          width: Math.max(1, Math.ceil(right - left)),
          height: Math.max(1, Math.ceil(bottom - top))
        }
      })
      if (saved) setNotice(`${format.toUpperCase()} exported.`)
      setExportDialogOpen(false)
    } catch {
      setNotice(`CanvasNote could not export this board as ${format.toUpperCase()}.`)
    } finally {
      document.documentElement.classList.remove('canvas-exporting')
      editor.setCamera(previousCamera, { immediate: true })
      if (previousSelection.length > 0) editor.select(...previousSelection)
      setExporting(false)
    }
  }

  const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY?.trim()

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-board text-ink">
      <header className="canvas-header">
        <button
          type="button"
          onClick={() => void goBack()}
          className="icon-button"
          aria-label="Back to boards"
        >
          <ArrowLeft size={17} />
        </button>
        <BrandMark compact />
        <span className="hidden h-7 w-px bg-line sm:block" aria-hidden="true" />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Board title</span>
          <input
            value={title}
            maxLength={240}
            className="canvas-title-input"
            onChange={(event) => {
              setTitle(event.target.value)
              titleRef.current = event.target.value
              markDirty()
            }}
            onBlur={() => {
              if (title.trim()) return
              const fallback = boardRef.current.title
              setTitle(fallback)
              titleRef.current = fallback
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
                saveNow()
              }
            }}
          />
        </label>

        <div className={`canvas-save-status is-${saveState}`} role="status" aria-live="polite">
          {saveState === 'saving' ? (
            <LoaderCircle className="animate-spin" size={14} />
          ) : saveState === 'saved' ? (
            <Check size={14} />
          ) : (
            <span className="h-2 w-2 rounded-full bg-current" />
          )}
          <span className="hidden sm:inline">{saveLabel(saveState)}</span>
        </div>
        <div className="canvas-history-actions" role="group" aria-label="Edit history">
          <button
            type="button"
            className="icon-button"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            disabled={!editor?.canUndo()}
            onClick={() => editor?.undo()}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!editor?.canRedo()}
            onClick={() => editor?.redo()}
          >
            <Redo2 size={16} />
          </button>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Search this board"
          title="Search (Ctrl+K)"
          onClick={openSearch}
        >
          <Search size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Export board"
          title="Export board"
          onClick={() => setExportDialogOpen(true)}
        >
          <Download size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Save board"
          title="Save (Ctrl+S)"
          disabled={saveState === 'saving'}
          onClick={saveNow}
        >
          <Save size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Open settings"
          title="Settings"
          onClick={onOpenSettings}
        >
          <Settings2 size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={propertiesOpen ? 'Hide properties' : 'Show properties'}
          aria-pressed={propertiesOpen}
          onClick={toggleProperties}
        >
          {propertiesOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
        </button>
      </header>

      <section className="relative flex min-h-0 flex-1">
        <div
          className="relative min-w-0 flex-1 overflow-hidden"
          data-testid="canvas-editor"
          onDragOverCapture={(event) => {
            if (Array.from(event.dataTransfer.files).some(imageImportFilename)) {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }
          }}
          onDropCapture={(event) => {
            const file = Array.from(event.dataTransfer.files).find(imageImportFilename)
            if (!file || !editor) return
            event.preventDefault()
            event.stopPropagation()
            const point = editor.screenToPage({ x: event.clientX, y: event.clientY })
            void importImageData(file, point)
          }}
        >
          <BreakPointProvider>
            <TldrawEditor
              store={store}
              components={CANVAS_COMPONENTS}
              shapeUtils={CANVAS_SHAPE_UTILS}
              bindingUtils={defaultBindingUtils}
              assetUtils={defaultAssetUtils}
              overlayUtils={defaultOverlayUtils}
              tools={CANVAS_TOOLS}
              initialState="select"
              onMount={handleMount}
              {...(licenseKey ? { licenseKey } : {})}
            />
          </BreakPointProvider>

          <nav className="canvas-toolbar" aria-label="Canvas tools">
            <ToolButton
              label="Select"
              shortcut="V"
              active={activeTool === 'select'}
              onClick={() => setTool('select')}
            >
              <MousePointer2 size={18} />
            </ToolButton>
            <ToolButton
              label="Pan"
              shortcut="H"
              active={activeTool === 'hand'}
              onClick={() => setTool('hand')}
            >
              <Hand size={18} />
            </ToolButton>
            <span className="canvas-tool-divider" />
            <ToolButton
              label="New note"
              shortcut="N"
              onClick={() => editor && createNoteShape(editor)}
            >
              <StickyNote size={18} />
            </ToolButton>
            <ToolButton
              label="New checklist"
              shortcut="C"
              onClick={() => editor && createChecklistShape(editor)}
            >
              <ListChecks size={18} />
            </ToolButton>
            <ToolButton
              label="Import image"
              shortcut="I"
              disabled={importing !== null}
              onClick={() => void importMedia('image')}
            >
              {importing === 'image' ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <ImagePlus size={18} />
              )}
            </ToolButton>
            <ToolButton
              label="Import local video"
              shortcut="Shift+V"
              disabled={importing !== null}
              onClick={() => void importMedia('video')}
            >
              {importing === 'video' ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <Video size={18} />
              )}
            </ToolButton>
            <BoardAddMenu
              importing={importing}
              onAttachFile={() => void importMedia('file')}
              onAddLink={() => {
                setLinkError(null)
                setLinkDialogOpen(true)
              }}
              onEmbedVideo={() => {
                setEmbedError(null)
                setEmbedDialogOpen(true)
              }}
            />
            <ToolButton label="New frame" shortcut="F" onClick={createFrame}>
              <Frame size={18} />
            </ToolButton>
            <ToolButton
              label="Draw connection"
              shortcut="L"
              active={activeTool === 'arrow'}
              onClick={() => setTool('arrow')}
            >
              <Link2 size={18} />
            </ToolButton>
          </nav>

          {editor && !hasCanvasObjects && (
            <p className="canvas-empty-hint" role="status">
              <strong>Start with a note.</strong> Press N or choose a tool on the left.
            </p>
          )}

          <div className="canvas-zoom" role="group" aria-label="Canvas zoom controls">
            <button type="button" aria-label="Zoom out" onClick={() => editor?.zoomOut()}>
              <Minus size={15} />
            </button>
            <button type="button" title="Reset zoom (1)" onClick={() => editor?.resetZoom()}>
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" aria-label="Zoom in" onClick={() => editor?.zoomIn()}>
              <Plus size={15} />
            </button>
            <button
              type="button"
              aria-label="Zoom to fit"
              title="Zoom to fit (0)"
              onClick={() => editor?.zoomToFit()}
            >
              <Maximize2 size={15} />
            </button>
          </div>

          {notice && (
            <button type="button" className="canvas-notice" onClick={() => setNotice(null)}>
              {notice}
            </button>
          )}
        </div>

        {propertiesOpen && (
          <aside className="canvas-properties" aria-label="Properties panel">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-faint">
                  Properties
                </p>
                <h2 className="mt-0.5 text-sm font-semibold">
                  {selectedShape
                    ? selectedShapeLabel(selectedShape)
                    : selectedShapeIds.length > 1
                      ? `${selectedShapeIds.length} objects`
                      : 'No selection'}
                </h2>
              </div>
              <button
                type="button"
                className="canvas-panel-close"
                aria-label="Hide properties"
                onClick={hideProperties}
              >
                <PanelRightClose size={16} />
              </button>
            </div>

            {!selectedShape && selectedShapeIds.length === 0 ? (
              <div className="px-4 py-5 text-xs leading-5 text-muted">
                Select a note, checklist, media card, frame, or connection to edit its properties.
              </div>
            ) : !selectedShape ? (
              <div className="canvas-properties-body">
                <p className="m-0 text-xs leading-5 text-muted">
                  Group the selection to move and resize these objects together.
                </p>
                <div className="canvas-property-actions">
                  <button type="button" onClick={() => editor?.groupShapes(selectedShapeIds)}>
                    <Group size={15} /> Group
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.duplicateShapes(selectedShapeIds, { x: 24, y: 24 })}
                  >
                    <Copy size={15} /> Duplicate
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => editor?.deleteShapes(selectedShapeIds)}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="canvas-properties-body">
                {textShape && (
                  <>
                    <fieldset className="canvas-property-group">
                      <legend>Background</legend>
                      <div className="flex flex-wrap gap-2">
                        {BACKGROUNDS.map((background) => (
                          <button
                            type="button"
                            key={background.value}
                            className={`canvas-color-chip ${textShape.props.background === background.value ? 'is-active' : ''}`}
                            style={{ background: background.color }}
                            title={background.label}
                            aria-label={`${background.label} background`}
                            aria-pressed={textShape.props.background === background.value}
                            onClick={() => updateTextShape({ background: background.value })}
                          />
                        ))}
                      </div>
                    </fieldset>

                    <label className="canvas-property-group">
                      <span>Text color</span>
                      <input
                        type="color"
                        value={textShape.props.textColor}
                        onChange={(event) => updateTextShape({ textColor: event.target.value })}
                      />
                    </label>

                    <label className="canvas-property-group">
                      <span>Font size</span>
                      <select
                        value={textShape.props.fontSize}
                        onChange={(event) =>
                          updateTextShape({ fontSize: Number(event.target.value) })
                        }
                      >
                        {[12, 14, 16, 18, 24, 32].map((size) => (
                          <option key={size} value={size}>
                            {size}px
                          </option>
                        ))}
                      </select>
                    </label>

                    <fieldset className="canvas-property-group">
                      <legend>Alignment</legend>
                      <div className="canvas-segmented-control">
                        {(['left', 'center', 'right'] as const).map((alignment) => (
                          <button
                            type="button"
                            key={alignment}
                            aria-pressed={textShape.props.textAlign === alignment}
                            className={textShape.props.textAlign === alignment ? 'is-active' : ''}
                            onClick={() => updateTextShape({ textAlign: alignment })}
                          >
                            {alignment}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <TagsField
                      id={textShape.id}
                      tags={textShape.props.tags}
                      placeholder="research, ideas"
                      onChange={(tags) => updateTextShape({ tags })}
                    />
                  </>
                )}

                {imageShape && (
                  <>
                    <label className="canvas-property-group">
                      <span>Caption</span>
                      <input
                        type="text"
                        value={imageShape.props.caption}
                        maxLength={2_000}
                        onChange={(event) => updateImageShape({ caption: event.target.value })}
                      />
                    </label>
                    <label className="canvas-property-group">
                      <span>Alternative text</span>
                      <input
                        type="text"
                        value={imageShape.props.altText}
                        maxLength={2_000}
                        onChange={(event) => updateImageShape({ altText: event.target.value })}
                      />
                    </label>
                    <fieldset className="canvas-property-group">
                      <legend>Fit</legend>
                      <div className="canvas-segmented-control">
                        {(['contain', 'cover'] as const).map((fit) => (
                          <button
                            type="button"
                            key={fit}
                            aria-pressed={imageShape.props.fit === fit}
                            className={imageShape.props.fit === fit ? 'is-active' : ''}
                            onClick={() => updateImageShape({ fit })}
                          >
                            {fit}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <TagsField
                      id={imageShape.id}
                      tags={imageShape.props.tags}
                      placeholder="reference, visual"
                      onChange={(tags) => updateImageShape({ tags })}
                    />
                    <button
                      type="button"
                      className="canvas-secondary-action"
                      disabled={importing !== null}
                      onClick={() => void replaceSelectedMedia('image')}
                    >
                      <ImagePlus size={15} /> Replace image file
                    </button>
                  </>
                )}

                {fileShape && (
                  <>
                    <div className="canvas-property-group">
                      <span>File</span>
                      <p className="m-0 break-all text-xs text-muted">{fileShape.props.filename}</p>
                    </div>
                    <TagsField
                      id={fileShape.id}
                      tags={fileShape.props.tags}
                      placeholder="source, attachment"
                      onChange={(tags) => updateFileShape({ tags })}
                    />
                    <button
                      type="button"
                      className="canvas-secondary-action"
                      disabled={importing !== null}
                      onClick={() => void replaceSelectedMedia('file')}
                    >
                      <Paperclip size={15} /> Replace attached file
                    </button>
                  </>
                )}

                {linkShape && (
                  <>
                    <label className="canvas-property-group">
                      <span>Title</span>
                      <input
                        type="text"
                        value={linkShape.props.title}
                        maxLength={500}
                        onChange={(event) => updateLinkShape({ title: event.target.value })}
                      />
                    </label>
                    <label className="canvas-property-group">
                      <span>Description</span>
                      <textarea
                        value={linkShape.props.description}
                        maxLength={4_000}
                        rows={4}
                        onChange={(event) => updateLinkShape({ description: event.target.value })}
                      />
                    </label>
                    <div className="canvas-property-group">
                      <span>URL</span>
                      <p className="m-0 break-all text-xs font-normal text-muted">
                        {linkShape.props.url}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="canvas-secondary-action"
                      onClick={() => void window.canvasNote.app.openExternal(linkShape.props.url)}
                    >
                      <Globe2 size={15} /> Open link in browser
                    </button>
                    <TagsField
                      id={linkShape.id}
                      tags={linkShape.props.tags}
                      placeholder="source, website"
                      onChange={(tags) => updateLinkShape({ tags })}
                    />
                  </>
                )}

                {localVideoShape && (
                  <>
                    <label className="canvas-property-group">
                      <span>Caption</span>
                      <input
                        type="text"
                        value={localVideoShape.props.caption}
                        maxLength={2_000}
                        onChange={(event) => updateLocalVideoShape({ caption: event.target.value })}
                      />
                    </label>
                    <label className="canvas-property-group">
                      <span>Playback speed</span>
                      <select
                        value={localVideoShape.props.playbackRate}
                        onChange={(event) =>
                          updateLocalVideoShape({ playbackRate: Number(event.target.value) })
                        }
                      >
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <option key={rate} value={rate}>
                            {rate}×
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="canvas-secondary-action"
                      onClick={() =>
                        requestTimestampNote(canvasNoteId(localVideoShape), localVideoShape.id)
                      }
                    >
                      <Clock3 size={15} /> Add note at current time
                    </button>
                    <button
                      type="button"
                      className="canvas-secondary-action"
                      disabled={importing !== null}
                      onClick={() => void replaceSelectedMedia('video')}
                    >
                      <Video size={15} /> Replace video file
                    </button>
                    <TagsField
                      id={localVideoShape.id}
                      tags={localVideoShape.props.tags}
                      placeholder="interview, source"
                      onChange={(tags) => updateLocalVideoShape({ tags })}
                    />
                  </>
                )}

                {embeddedVideoShape && (
                  <>
                    <label className="canvas-property-group">
                      <span>Caption</span>
                      <input
                        type="text"
                        value={embeddedVideoShape.props.caption}
                        maxLength={2_000}
                        onChange={(event) =>
                          updateEmbeddedVideoShape({ caption: event.target.value })
                        }
                      />
                    </label>
                    <div className="canvas-property-group">
                      <span>Source</span>
                      <p className="m-0 break-all text-xs font-normal text-muted">
                        {embeddedVideoShape.props.url}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="canvas-secondary-action"
                      onClick={() =>
                        requestTimestampNote(
                          canvasNoteId(embeddedVideoShape),
                          embeddedVideoShape.id
                        )
                      }
                    >
                      <Clock3 size={15} /> Add note at current time
                    </button>
                    <TagsField
                      id={embeddedVideoShape.id}
                      tags={embeddedVideoShape.props.tags}
                      placeholder="video, reference"
                      onChange={(tags) => updateEmbeddedVideoShape({ tags })}
                    />
                  </>
                )}

                {timestampShape && (
                  <>
                    <label className="canvas-property-group">
                      <span>Timestamp (seconds)</span>
                      <input
                        type="number"
                        min={0}
                        max={604_800}
                        step={0.1}
                        value={timestampShape.props.timestampSeconds}
                        onChange={(event) =>
                          updateTimestampShape({
                            timestampSeconds: Math.min(
                              604_800,
                              Math.max(0, event.target.valueAsNumber || 0)
                            )
                          })
                        }
                      />
                    </label>
                    <label className="canvas-property-group">
                      <span>Note</span>
                      <textarea
                        value={timestampShape.props.content}
                        maxLength={100_000}
                        rows={5}
                        onChange={(event) => updateTimestampShape({ content: event.target.value })}
                      />
                    </label>
                    <fieldset className="canvas-property-group">
                      <legend>Background</legend>
                      <div className="flex flex-wrap gap-2">
                        {BACKGROUNDS.map((background) => (
                          <button
                            type="button"
                            key={background.value}
                            className={`canvas-color-chip ${timestampShape.props.background === background.value ? 'is-active' : ''}`}
                            style={{ background: background.color }}
                            aria-label={`${background.label} background`}
                            aria-pressed={timestampShape.props.background === background.value}
                            onClick={() => updateTimestampShape({ background: background.value })}
                          />
                        ))}
                      </div>
                    </fieldset>
                    <TagsField
                      id={timestampShape.id}
                      tags={timestampShape.props.tags}
                      placeholder="quote, insight"
                      onChange={(tags) => updateTimestampShape({ tags })}
                    />
                  </>
                )}

                <div className="canvas-property-actions">
                  {selectedShape.type === 'group' && (
                    <button type="button" onClick={() => editor?.ungroupShapes([selectedShape.id])}>
                      <Ungroup size={15} /> Ungroup
                    </button>
                  )}
                  <button type="button" onClick={() => editor?.toggleLock([selectedShape.id])}>
                    {selectedShape.isLocked ? <Unlock size={15} /> : <Lock size={15} />}
                    {selectedShape.isLocked ? 'Unlock' : 'Lock'}
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.duplicateShapes([selectedShape.id], { x: 24, y: 24 })}
                  >
                    <Copy size={15} /> Duplicate
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => editor?.deleteShapes([selectedShape.id])}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            )}

            <footer className="mt-auto border-t border-line px-4 py-3 text-[10px] text-faint">
              Revision {revision.slice(0, 7)}
            </footer>
          </aside>
        )}
      </section>

      {exportDialogOpen && (
        <div className="canvas-dialog-backdrop">
          <section
            className="canvas-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-board-title"
          >
            <div className="canvas-dialog-header">
              <div>
                <p>Portable output</p>
                <h2 id="export-board-title">Export board</h2>
              </div>
              <button
                type="button"
                aria-label="Close export dialog"
                disabled={exporting}
                onClick={() => setExportDialogOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <label>
              <span>PNG / PDF area</span>
              <select
                value={exportScope}
                disabled={exporting}
                onChange={(event) => setExportScope(event.target.value as 'all' | 'selection')}
              >
                <option value="all">Whole board</option>
                <option value="selection">Selected objects</option>
              </select>
            </label>
            <div className="canvas-export-options">
              <button type="button" disabled={exporting} onClick={() => void exportJson()}>
                <strong>JSON</strong>
                <span>Editable .canvasnote data</span>
              </button>
              <button type="button" disabled={exporting} onClick={() => void exportVisual('png')}>
                <strong>PNG</strong>
                <span>Rendered board image</span>
              </button>
              <button type="button" disabled={exporting} onClick={() => void exportVisual('pdf')}>
                <strong>PDF</strong>
                <span>Printable board document</span>
              </button>
            </div>
            {exporting && (
              <p className="canvas-export-status" role="status">
                <LoaderCircle className="animate-spin" size={14} /> Preparing export…
              </p>
            )}
          </section>
        </div>
      )}

      {searchOpen && (
        <div className="canvas-dialog-backdrop">
          <section
            className="canvas-dialog canvas-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="board-search-title"
          >
            <div className="canvas-dialog-header">
              <div>
                <p>Find locally</p>
                <h2 id="board-search-title">Search this board</h2>
              </div>
              <button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)}>
                <X size={17} />
              </button>
            </div>
            <label>
              <span>Search notes, tags, files, and captions</span>
              <input
                autoFocus
                type="search"
                value={searchQuery}
                placeholder="Type to search…"
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setActiveSearchIndex(0)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchOpen(false)
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setActiveSearchIndex((index) =>
                      searchResults.length ? (index + 1) % searchResults.length : 0
                    )
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActiveSearchIndex((index) =>
                      searchResults.length
                        ? (index - 1 + searchResults.length) % searchResults.length
                        : 0
                    )
                  }
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    focusSearchResult(activeSearchIndex)
                  }
                }}
              />
            </label>
            <div className="canvas-search-filters">
              <label>
                <span>Object type</span>
                <select
                  value={searchType}
                  onChange={(event) => {
                    setSearchType(event.target.value as BoardSearchType)
                    setActiveSearchIndex(0)
                  }}
                >
                  <option value="all">All objects</option>
                  <option value="note">Notes</option>
                  <option value="checklist">Checklists</option>
                  <option value="timestamp-note">Timestamp notes</option>
                  <option value="image">Images</option>
                  <option value="local-video">Local videos</option>
                  <option value="embedded-video">Embedded videos</option>
                  <option value="file">Files</option>
                  <option value="link">Links</option>
                  <option value="frame">Frames</option>
                </select>
              </label>
              <label>
                <span>Tag</span>
                <input
                  value={searchTag}
                  placeholder="Any tag"
                  onChange={(event) => {
                    setSearchTag(event.target.value)
                    setActiveSearchIndex(0)
                  }}
                />
              </label>
            </div>
            <div className="canvas-search-results" role="listbox" aria-label="Search results">
              {searchResults.length > 0 ? (
                searchResults.map((result, index) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeSearchIndex}
                    className={index === activeSearchIndex ? 'is-active' : ''}
                    key={result.nodeId}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => focusSearchResult(index)}
                  >
                    <span>
                      <HighlightedText text={result.title} query={searchQuery} />
                    </span>
                    <small>{result.type.replaceAll('-', ' ')}</small>
                    {result.excerpt && (
                      <p>
                        <HighlightedText text={result.excerpt} query={searchQuery} />
                      </p>
                    )}
                  </button>
                ))
              ) : (
                <p className="canvas-search-empty">
                  {searchQuery || searchTag ? 'No matching objects.' : 'Start typing to search.'}
                </p>
              )}
            </div>
            <p className="canvas-search-hint">↑↓ Navigate · Enter focus · Esc close</p>
          </section>
        </div>
      )}

      {embedDialogOpen && (
        <div className="canvas-dialog-backdrop">
          <form
            className="canvas-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="embed-video-title"
            onSubmit={(event) => {
              event.preventDefault()
              addEmbeddedVideo()
            }}
          >
            <div className="canvas-dialog-header">
              <div>
                <p>Video</p>
                <h2 id="embed-video-title">Embed YouTube or Vimeo</h2>
              </div>
              <button
                type="button"
                aria-label="Close video dialog"
                onClick={() => setEmbedDialogOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <label>
              <span>Video URL</span>
              <input
                autoFocus
                type="url"
                value={embedUrl}
                placeholder="https://www.youtube.com/watch?v=…"
                onChange={(event) => {
                  setEmbedUrl(event.target.value)
                  setEmbedError(null)
                }}
              />
            </label>
            {embedError && <p className="canvas-dialog-error">{embedError}</p>}
            <div className="canvas-dialog-actions">
              <button type="button" onClick={() => setEmbedDialogOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="is-primary">
                Embed video
              </button>
            </div>
          </form>
        </div>
      )}

      {linkDialogOpen && (
        <div className="canvas-dialog-backdrop">
          <form
            className="canvas-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-card-title"
            onSubmit={(event) => {
              event.preventDefault()
              addLinkCard()
            }}
          >
            <div className="canvas-dialog-header">
              <div>
                <p>Reference</p>
                <h2 id="link-card-title">Add link card</h2>
              </div>
              <button
                type="button"
                aria-label="Close link dialog"
                onClick={() => setLinkDialogOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <label>
              <span>URL</span>
              <input
                autoFocus
                value={linkUrl}
                placeholder="https://example.com/article"
                onChange={(event) => {
                  setLinkUrl(event.target.value)
                  setLinkError(null)
                }}
              />
            </label>
            <label>
              <span>Title (optional)</span>
              <input
                value={linkTitle}
                maxLength={500}
                placeholder="Useful reference"
                onChange={(event) => setLinkTitle(event.target.value)}
              />
            </label>
            <label>
              <span>Description (optional)</span>
              <textarea
                value={linkDescription}
                maxLength={4_000}
                rows={3}
                placeholder="Why this link matters"
                onChange={(event) => setLinkDescription(event.target.value)}
              />
            </label>
            {linkError && <p className="canvas-dialog-error">{linkError}</p>}
            <div className="canvas-dialog-actions">
              <button type="button" onClick={() => setLinkDialogOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="is-primary">
                Add link
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
