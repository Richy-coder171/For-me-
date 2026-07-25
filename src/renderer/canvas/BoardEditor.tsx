import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  Frame,
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
  StickyNote,
  Trash2,
  Undo2,
  Ungroup,
  Unlock,
  Video,
  X
} from 'lucide-react'
import {
  TldrawEditor,
  createShapeId,
  createTLStore,
  defaultAssetUtils,
  defaultBindingUtils,
  defaultOverlayUtils,
  defaultShapeTools,
  defaultShapeUtils,
  defaultTools,
  type Editor,
  type TLShape,
  type TLShapeId
} from 'tldraw'

import type { BoardFile, OpenBoard } from '../../shared/schemas/board'
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
  CN_NOTE_TYPE,
  CN_TIMESTAMP_NOTE_TYPE,
  canvasShapeUtils,
  createChecklistShape,
  createCNEmbeddedVideoShape,
  createCNFileShape,
  createCNImageShape,
  createCNLocalVideoShape,
  createCNTimestampNoteShape,
  createNoteShape,
  getNextShapePosition,
  isCNChecklistShape,
  isCNEmbeddedVideoShape,
  isCNFileShape,
  isCNImageShape,
  isCNLocalVideoShape,
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
  type CNNoteShape,
  type CNTimestampNoteShape,
  type CNTextAlign,
  type CNTextBackground
} from './shapes'

const CANVAS_SHAPE_UTILS = [...defaultShapeUtils, ...canvasShapeUtils] as const
const CANVAS_TOOLS = [...defaultTools, ...defaultShapeTools] as const

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
  return typeof shape.meta.canvasNoteId === 'string'
    ? shape.meta.canvasNoteId
    : shape.id.replace(/^shape:/, '')
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 50)
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

export function BoardEditor({ stored, onBack, onSave }: BoardEditorProps): React.JSX.Element {
  const [store] = useState(() => createTLStore({ shapeUtils: CANVAS_SHAPE_UTILS }))
  const [editor, setEditor] = useState<Editor | null>(null)
  const [title, setTitle] = useState(stored.board.title)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [selectedShape, setSelectedShape] = useState<TLShape | null>(null)
  const [selectedShapeIds, setSelectedShapeIds] = useState<TLShapeId[]>([])
  const [activeTool, setActiveTool] = useState('select')
  const [zoom, setZoom] = useState(stored.board.camera.zoom)
  const [revision, setRevision] = useState(stored.revision)
  const [propertiesOpen, setPropertiesOpen] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [importing, setImporting] = useState<'image' | 'video' | 'file' | null>(null)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const [embedUrl, setEmbedUrl] = useState('')
  const [embedError, setEmbedError] = useState<string | null>(null)
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
      setNotice('Save blocked: remove or repair the unsupported canvas object first.')
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

  const [saveQueue] = useState<AutosaveQueue>(() => createAutosaveQueue(async () => undefined))

  useEffect(() => {
    saveQueue.setSave(saveCurrentBoard)
  }, [saveCurrentBoard, saveQueue])

  const markDirty = useCallback(() => {
    setSaveState((current) => (current === 'saving' ? current : 'dirty'))
    saveQueue.schedule()
  }, [saveQueue])

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

  const importMedia = useCallback(
    async (kind: 'image' | 'video' | 'file'): Promise<void> => {
      if (!editor || importing) return
      setImporting(kind)
      try {
        const media = await window.canvasNote.media.importFile(kind)
        if (!media) return
        const width = kind === 'video' ? 480 : kind === 'image' ? 360 : 320
        const height = kind === 'video' ? 360 : kind === 'image' ? 240 : 148
        const position = getNextShapePosition(editor, width, height)
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
                  caption: media.filename
                })
              : createCNFileShape(position.x, position.y, {
                  mediaId: media.id,
                  mediaPath: media.relativePath,
                  filename: media.filename,
                  extension: media.extension,
                  sizeBytes: media.sizeBytes
                })
        editor.createShape(shape).select(shape.id)
      } catch {
        setNotice(`CanvasNote could not import that ${kind}.`)
      } finally {
        setImporting(null)
      }
    },
    [editor, importing]
  )

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
  const embeddedVideoShape =
    selectedShape && isCNEmbeddedVideoShape(selectedShape) ? selectedShape : null
  const timestampShape =
    selectedShape && isCNTimestampNoteShape(selectedShape) ? selectedShape : null

  const updateImageShape = useCallback(
    (props: Partial<Pick<CNImageShape['props'], 'caption' | 'altText' | 'fit' | 'tags'>>) => {
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
    (props: Partial<Pick<CNFileShape['props'], 'tags'>>) => {
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
    (props: Partial<Pick<CNLocalVideoShape['props'], 'caption' | 'playbackRate' | 'tags'>>) => {
      if (!editor || !localVideoShape) return
      editor.updateShape<CNLocalVideoShape>({
        id: localVideoShape.id,
        type: CN_LOCAL_VIDEO_TYPE,
        props: { ...props, updatedAt: new Date().toISOString() }
      })
    },
    [editor, localVideoShape]
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
          aria-label={propertiesOpen ? 'Hide properties' : 'Show properties'}
          aria-pressed={propertiesOpen}
          onClick={() => setPropertiesOpen((open) => !open)}
        >
          {propertiesOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
        </button>
      </header>

      <section className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 overflow-hidden" data-testid="canvas-editor">
          <TldrawEditor
            store={store}
            shapeUtils={CANVAS_SHAPE_UTILS}
            bindingUtils={defaultBindingUtils}
            assetUtils={defaultAssetUtils}
            overlayUtils={defaultOverlayUtils}
            tools={CANVAS_TOOLS}
            initialState="select"
            onMount={handleMount}
            {...(licenseKey ? { licenseKey } : {})}
          />

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
            <ToolButton
              label="Embed YouTube or Vimeo video"
              onClick={() => {
                setEmbedError(null)
                setEmbedDialogOpen(true)
              }}
            >
              <MonitorPlay size={18} />
            </ToolButton>
            <ToolButton
              label="Attach file"
              disabled={importing !== null}
              onClick={() => void importMedia('file')}
            >
              {importing === 'file' ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <Paperclip size={18} />
              )}
            </ToolButton>
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
            <span className="canvas-tool-divider" />
            <ToolButton
              label="Undo"
              shortcut="Ctrl+Z"
              disabled={!editor?.canUndo()}
              onClick={() => editor?.undo()}
            >
              <Undo2 size={18} />
            </ToolButton>
            <ToolButton
              label="Redo"
              shortcut="Ctrl+Shift+Z"
              disabled={!editor?.canRedo()}
              onClick={() => editor?.redo()}
            >
              <Redo2 size={18} />
            </ToolButton>
          </nav>

          <div className="canvas-zoom" aria-label="Canvas zoom controls">
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
                onClick={() => setPropertiesOpen(false)}
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
    </main>
  )
}
