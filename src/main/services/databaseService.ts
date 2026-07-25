import { mkdirSync } from 'node:fs'
import path from 'node:path'

import Database from 'better-sqlite3'

const DATABASE_VERSION = 1

const MIGRATIONS = [
  `
    CREATE TABLE boards (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      opened_at TEXT,
      favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
      deleted_at TEXT,
      item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0)
    ) STRICT;

    CREATE TABLE media (
      id TEXT PRIMARY KEY NOT NULL,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      type TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (board_id, path)
    ) STRICT;

    CREATE TABLE tags (
      name TEXT PRIMARY KEY NOT NULL COLLATE NOCASE
    ) STRICT;

    CREATE TABLE board_tags (
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      tag_name TEXT NOT NULL REFERENCES tags(name) ON DELETE CASCADE,
      PRIMARY KEY (board_id, tag_name)
    ) STRICT;

    CREATE TABLE activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id TEXT REFERENCES boards(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      details TEXT
    ) STRICT;

    CREATE VIRTUAL TABLE search_index USING fts5(
      board_id UNINDEXED,
      object_id UNINDEXED,
      object_type UNINDEXED,
      title,
      content,
      tags,
      caption,
      tokenize = 'unicode61 remove_diacritics 2'
    );

    CREATE INDEX boards_active_updated_idx ON boards(deleted_at, updated_at DESC);
    CREATE INDEX boards_favorite_idx ON boards(favorite, deleted_at, updated_at DESC);
    CREATE INDEX boards_opened_idx ON boards(opened_at DESC);
    CREATE INDEX media_board_idx ON media(board_id);
    CREATE INDEX activity_board_created_idx ON activity(board_id, created_at DESC);

    CREATE TRIGGER boards_search_insert AFTER INSERT ON boards BEGIN
      INSERT INTO search_index(board_id, object_id, object_type, title, content, tags, caption)
      VALUES (new.id, new.id, 'board', new.title, '', '', '');
    END;

    CREATE TRIGGER boards_search_title_update AFTER UPDATE OF title ON boards BEGIN
      UPDATE search_index
      SET title = new.title
      WHERE board_id = old.id AND object_id = old.id AND object_type = 'board';
    END;

    CREATE TRIGGER boards_search_delete AFTER DELETE ON boards BEGIN
      DELETE FROM search_index WHERE board_id = old.id;
    END;
  `
] as const

export interface BoardMetadataInput {
  id: string
  path: string
  title: string
  createdAt: string
  updatedAt: string
  openedAt?: string | null
  itemCount: number
}

export interface BoardMetadata {
  id: string
  path: string
  title: string
  createdAt: string
  updatedAt: string
  openedAt: string | null
  favorite: boolean
  deletedAt: string | null
  itemCount: number
}

export interface BoardListOptions {
  trashed?: boolean
  favorite?: boolean
}

interface BoardRow {
  id: string
  path: string
  title: string
  created_at: string
  updated_at: string
  opened_at: string | null
  favorite: 0 | 1
  deleted_at: string | null
  item_count: number
}

function migrate(database: Database.Database): void {
  const currentVersion = database.pragma('user_version', { simple: true }) as number
  if (currentVersion > DATABASE_VERSION) {
    throw new Error(
      `Database version ${currentVersion} is newer than supported version ${DATABASE_VERSION}.`
    )
  }

  for (let version = currentVersion; version < DATABASE_VERSION; version += 1) {
    database.transaction(() => {
      database.exec(MIGRATIONS[version]!)
      database.pragma(`user_version = ${version + 1}`)
    })()
  }
}

function toBoardMetadata(row: BoardRow): BoardMetadata {
  return {
    id: row.id,
    path: row.path,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    openedAt: row.opened_at,
    favorite: row.favorite === 1,
    deletedAt: row.deleted_at,
    itemCount: row.item_count
  }
}

export class DatabaseService {
  #database: Database.Database | null = null

  initialize(workspaceRoot: string): void {
    this.close()
    const dataDirectory = path.join(path.resolve(workspaceRoot), '.canvasnote')
    mkdirSync(dataDirectory, { recursive: true })
    const database = new Database(path.join(dataDirectory, 'index.sqlite3'))

    try {
      database.pragma('foreign_keys = ON')
      database.pragma('journal_mode = WAL')
      database.pragma('busy_timeout = 5000')
      migrate(database)
      this.#database = database
    } catch (error) {
      database.close()
      throw error
    }
  }

  close(): void {
    this.#database?.close()
    this.#database = null
  }

  upsertBoard(board: BoardMetadataInput): BoardMetadata {
    const database = this.#getDatabase()
    database
      .prepare(
        `INSERT INTO boards (
          id, path, title, created_at, updated_at, opened_at, item_count
        ) VALUES (
          @id, @path, @title, @createdAt, @updatedAt, @openedAt, @itemCount
        )
        ON CONFLICT(id) DO UPDATE SET
          path = excluded.path,
          title = excluded.title,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          opened_at = COALESCE(excluded.opened_at, boards.opened_at),
          item_count = excluded.item_count`
      )
      .run({ ...board, openedAt: board.openedAt ?? null })

    return this.getBoard(board.id)!
  }

  listBoards(options: BoardListOptions = {}): BoardMetadata[] {
    const clauses = [options.trashed ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL']
    if (options.favorite !== undefined) clauses.push('favorite = @favorite')
    const order = options.trashed
      ? 'deleted_at DESC'
      : 'CASE WHEN opened_at IS NULL THEN 1 ELSE 0 END, opened_at DESC, updated_at DESC'
    const rows = this.#getDatabase()
      .prepare(`SELECT * FROM boards WHERE ${clauses.join(' AND ')} ORDER BY ${order}`)
      .all({ favorite: options.favorite ? 1 : 0 }) as BoardRow[]
    return rows.map(toBoardMetadata)
  }

  getBoard(id: string): BoardMetadata | null {
    const row = this.#getDatabase().prepare('SELECT * FROM boards WHERE id = ?').get(id) as
      BoardRow | undefined
    return row ? toBoardMetadata(row) : null
  }

  setFavorite(id: string, favorite: boolean): boolean {
    return (
      this.#getDatabase()
        .prepare('UPDATE boards SET favorite = ? WHERE id = ?')
        .run(favorite ? 1 : 0, id).changes > 0
    )
  }

  trashBoard(id: string, deletedAt = new Date().toISOString()): boolean {
    return (
      this.#getDatabase()
        .prepare('UPDATE boards SET deleted_at = ? WHERE id = ?')
        .run(deletedAt, id).changes > 0
    )
  }

  restoreBoard(id: string): boolean {
    return (
      this.#getDatabase().prepare('UPDATE boards SET deleted_at = NULL WHERE id = ?').run(id)
        .changes > 0
    )
  }

  deleteBoard(id: string): boolean {
    return this.#getDatabase().prepare('DELETE FROM boards WHERE id = ?').run(id).changes > 0
  }

  #getDatabase(): Database.Database {
    if (!this.#database) throw new Error('DatabaseService has not been initialized.')
    return this.#database
  }
}
