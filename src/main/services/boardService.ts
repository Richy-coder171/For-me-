import { createHash, randomUUID } from 'node:crypto'
import { mkdir, lstat, open, readdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { TextDecoder } from 'node:util'

import {
  boardFileSchema,
  createEmptyBoard,
  revisionSchema,
  type BoardFile,
  type OpenBoard
} from '../../shared/schemas/board'
import { stableIdSchema } from '../../shared/schemas/common'
import { createBoardFromTemplate, type TemplateId } from '../../shared/templates'
import { assertNoSymlinkEscape } from '../security/pathValidation'

const BOARD_EXTENSION = '.canvasnote'
const BACKUP_LIMIT = 5
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])$/i
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

export const MAX_BOARD_FILE_BYTES = 25 * 1024 * 1024

export type StoredBoard = OpenBoard

export class BoardConflictError extends Error {
  override readonly name = 'BoardConflictError'

  constructor(
    readonly boardId: string,
    readonly expectedRevision: string | null,
    readonly actualRevision: string | null
  ) {
    super(`Board ${boardId} changed outside this session.`)
  }
}

function hasCode(error: unknown, ...codes: string[]): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    codes.includes(String(error.code))
  )
}

function validateBoardId(value: string): string {
  const id = stableIdSchema.parse(value)
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || WINDOWS_RESERVED_NAME.test(id)) {
    throw new Error('Board ID cannot be used as a filename.')
  }
  return id
}

function revisionOf(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

async function readLimitedFile(filePath: string): Promise<Buffer> {
  const pathDetails = await lstat(filePath)
  if (!pathDetails.isFile()) throw new Error('Board path is not a regular file.')

  const handle = await open(filePath, 'r')
  try {
    const details = await handle.stat()
    if (!details.isFile() || details.dev !== pathDetails.dev || details.ino !== pathDetails.ino) {
      throw new Error('Board file changed while it was being opened.')
    }
    if (details.size > MAX_BOARD_FILE_BYTES) throw new Error('Board file is too large.')

    const chunks: Buffer[] = []
    let total = 0
    while (total <= MAX_BOARD_FILE_BYTES) {
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, MAX_BOARD_FILE_BYTES + 1 - total))
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null)
      if (bytesRead === 0) break
      chunks.push(chunk.subarray(0, bytesRead))
      total += bytesRead
    }
    if (total > MAX_BOARD_FILE_BYTES) throw new Error('Board file is too large.')
    return Buffer.concat(chunks, total)
  } finally {
    await handle.close()
  }
}

async function writeAndSync(filePath: string, data: Uint8Array): Promise<void> {
  const handle = await open(filePath, 'wx', 0o600)
  try {
    await handle.writeFile(data)
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function syncDirectory(directoryPath: string): Promise<void> {
  if (process.platform === 'win32') return
  const handle = await open(directoryPath, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function writeAtomically(destinationPath: string, data: Uint8Array): Promise<void> {
  const temporaryPath = path.join(
    path.dirname(destinationPath),
    `.${path.basename(destinationPath)}.${randomUUID()}.tmp`
  )
  try {
    await writeAndSync(temporaryPath, data)
    await rename(temporaryPath, destinationPath)
    await syncDirectory(path.dirname(destinationPath))
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

async function rotateBackup(backupDirectory: string, data: Uint8Array): Promise<void> {
  await mkdir(backupDirectory, { recursive: true })
  const temporaryPath = path.join(backupDirectory, `.${randomUUID()}.tmp`)
  try {
    await writeAndSync(temporaryPath, data)
    await rm(path.join(backupDirectory, `${BACKUP_LIMIT}${BOARD_EXTENSION}`), { force: true })
    for (let index = BACKUP_LIMIT - 1; index >= 1; index -= 1) {
      try {
        await rename(
          path.join(backupDirectory, `${index}${BOARD_EXTENSION}`),
          path.join(backupDirectory, `${index + 1}${BOARD_EXTENSION}`)
        )
      } catch (error) {
        if (!hasCode(error, 'ENOENT')) throw error
      }
    }
    await rename(temporaryPath, path.join(backupDirectory, `1${BOARD_EXTENSION}`))
    await syncDirectory(backupDirectory)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

export class BoardService {
  readonly #workspaceRoot: string
  readonly #boardsDirectory: string
  readonly #trashDirectory: string
  readonly #backupsDirectory: string
  readonly #queues = new Map<string, Promise<void>>()

  constructor(workspaceRoot: string) {
    if (!workspaceRoot.trim()) throw new Error('A workspace root is required.')
    this.#workspaceRoot = path.resolve(workspaceRoot)
    this.#boardsDirectory = path.join(this.#workspaceRoot, 'boards')
    this.#trashDirectory = path.join(this.#workspaceRoot, 'trash', 'boards')
    this.#backupsDirectory = path.join(this.#workspaceRoot, 'backups')
  }

  async list(): Promise<StoredBoard[]> {
    await this.#ensureDirectory(this.#boardsDirectory)
    const entries = await readdir(this.#boardsDirectory, { withFileTypes: true })
    const ids: string[] = []
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(BOARD_EXTENSION)) continue
      try {
        ids.push(validateBoardId(entry.name.slice(0, -BOARD_EXTENSION.length)))
      } catch {
        // Ignore files that cannot be CanvasNote-owned board filenames.
      }
    }

    const reads = await Promise.allSettled(ids.map((id) => this.read(id)))
    const boards = reads.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    return boards.sort((left, right) => right.board.updatedAt.localeCompare(left.board.updatedAt))
  }

  async create(title: string): Promise<StoredBoard> {
    return this.save(createEmptyBoard(`board-${randomUUID()}`, title))
  }

  async createFromTemplate(templateId: TemplateId): Promise<StoredBoard> {
    return this.save(createBoardFromTemplate(`board-${randomUUID()}`, templateId))
  }

  async importFile(sourcePath: string): Promise<StoredBoard> {
    if (!sourcePath.trim()) throw new Error('Choose a CanvasNote board to import.')
    const data = await readLimitedFile(path.resolve(sourcePath))
    let imported: BoardFile
    try {
      imported = boardFileSchema.parse(JSON.parse(utf8Decoder.decode(data)))
    } catch (error) {
      throw new Error('The selected file is not a supported CanvasNote board.', { cause: error })
    }
    const timestamp = new Date().toISOString()
    return this.save({
      ...imported,
      id: `board-${randomUUID()}`,
      createdAt: timestamp,
      updatedAt: timestamp
    })
  }

  async read(id: string): Promise<StoredBoard> {
    const safeId = validateBoardId(id)
    return this.#serialize(safeId, () =>
      this.#readBoard(safeId, this.#boardPath(this.#boardsDirectory, safeId))
    )
  }

  async save(board: BoardFile, expectedRevision?: string): Promise<StoredBoard> {
    const validBoard = boardFileSchema.parse(board)
    const id = validateBoardId(validBoard.id)
    if (expectedRevision !== undefined) revisionSchema.parse(expectedRevision)

    const data = Buffer.from(`${JSON.stringify(validBoard, null, 2)}\n`, 'utf8')
    if (data.byteLength > MAX_BOARD_FILE_BYTES) throw new Error('Board file is too large.')

    return this.#serialize(id, async () => {
      await this.#ensureDirectory(this.#boardsDirectory)
      const destinationPath = this.#boardPath(this.#boardsDirectory, id)
      await assertNoSymlinkEscape(this.#workspaceRoot, destinationPath)

      let currentData: Buffer | null = null
      try {
        currentData = await readLimitedFile(destinationPath)
      } catch (error) {
        if (!hasCode(error, 'ENOENT')) throw error
      }

      const actualRevision = currentData === null ? null : revisionOf(currentData)
      if (currentData !== null && expectedRevision === undefined) {
        throw new BoardConflictError(id, null, actualRevision)
      }
      if (expectedRevision !== undefined && expectedRevision !== actualRevision) {
        throw new BoardConflictError(id, expectedRevision, actualRevision)
      }

      if (currentData !== null) {
        const backupDirectory = path.join(this.#backupsDirectory, id)
        await this.#ensureDirectory(backupDirectory)
        await rotateBackup(backupDirectory, currentData)
      }

      await writeAtomically(destinationPath, data)
      return { board: validBoard, revision: revisionOf(data) }
    })
  }

  async moveToTrash(id: string): Promise<void> {
    const safeId = validateBoardId(id)
    await this.#serialize(safeId, async () => {
      await this.#ensureDirectory(this.#trashDirectory)
      const sourcePath = this.#boardPath(this.#boardsDirectory, safeId)
      const destinationPath = this.#boardPath(this.#trashDirectory, safeId)
      await this.#readBoard(safeId, sourcePath)
      await this.#assertMissing(destinationPath)
      await rename(sourcePath, destinationPath)
    })
  }

  async restore(id: string): Promise<StoredBoard> {
    const safeId = validateBoardId(id)
    return this.#serialize(safeId, async () => {
      await this.#ensureDirectory(this.#boardsDirectory)
      const sourcePath = this.#boardPath(this.#trashDirectory, safeId)
      const destinationPath = this.#boardPath(this.#boardsDirectory, safeId)
      const storedBoard = await this.#readBoard(safeId, sourcePath)
      await this.#assertMissing(destinationPath)
      await rename(sourcePath, destinationPath)
      return storedBoard
    })
  }

  async deletePermanently(id: string): Promise<void> {
    const safeId = validateBoardId(id)
    await this.#serialize(safeId, async () => {
      const trashPath = this.#boardPath(this.#trashDirectory, safeId)
      await assertNoSymlinkEscape(this.#workspaceRoot, trashPath)
      const details = await lstat(trashPath)
      if (!details.isFile()) throw new Error('Board path is not a regular file.')
      await rm(trashPath)

      const backupDirectory = path.join(this.#backupsDirectory, safeId)
      await assertNoSymlinkEscape(this.#workspaceRoot, backupDirectory)
      await rm(backupDirectory, { recursive: true, force: true })
    })
  }

  #boardPath(directory: string, id: string): string {
    return path.join(directory, `${id}${BOARD_EXTENSION}`)
  }

  async #readBoard(id: string, filePath: string): Promise<StoredBoard> {
    await assertNoSymlinkEscape(this.#workspaceRoot, filePath)
    const data = await readLimitedFile(filePath)
    try {
      const board = boardFileSchema.parse(JSON.parse(utf8Decoder.decode(data)))
      if (board.id !== id) throw new Error('Board ID does not match its filename.')
      return { board, revision: revisionOf(data) }
    } catch (error) {
      throw new Error(`Board ${id} is not a valid CanvasNote board.`, { cause: error })
    }
  }

  async #ensureDirectory(directory: string): Promise<void> {
    await assertNoSymlinkEscape(this.#workspaceRoot, directory)
    await mkdir(directory, { recursive: true })
    await assertNoSymlinkEscape(this.#workspaceRoot, directory)
  }

  async #assertMissing(filePath: string): Promise<void> {
    await assertNoSymlinkEscape(this.#workspaceRoot, filePath)
    try {
      await lstat(filePath)
    } catch (error) {
      if (hasCode(error, 'ENOENT')) return
      throw error
    }
    throw new Error('A board with this ID already exists at the destination.')
  }

  #serialize<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const queueId = process.platform === 'win32' ? id.toLowerCase() : id
    const previous = this.#queues.get(queueId) ?? Promise.resolve()
    const result = previous.then(operation)
    const tail = result.then(
      () => undefined,
      () => undefined
    )
    this.#queues.set(queueId, tail)
    return result.finally(() => {
      if (this.#queues.get(queueId) === tail) this.#queues.delete(queueId)
    })
  }
}
