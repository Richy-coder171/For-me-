import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const projectRoot = path.resolve(import.meta.dirname, '..')
const electronExecutable = path.join(
  projectRoot,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron'
)

if (!existsSync(electronExecutable)) {
  const installer = path.join(projectRoot, 'node_modules', 'electron', 'install.js')
  const result = spawnSync(process.execPath, [installer], { cwd: projectRoot, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const Database = require('better-sqlite3')
const database = new Database(':memory:')
try {
  database.exec('SELECT 1')
} finally {
  database.close()
}

console.log('Electron and better-sqlite3 are ready.')
