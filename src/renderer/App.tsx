import { useCallback, useEffect, useRef, useState } from 'react'

import { BoardEditor } from './canvas/BoardEditor'
import { Dashboard } from './components/Dashboard'
import { WelcomeScreen } from './components/WelcomeScreen'
import { SettingsPanel } from './components/SettingsPanel'
import { useAppStore, type BoardSection } from './stores/appStore'
import { DEFAULT_APP_SETTINGS } from '../shared/schemas/settings'

function initialDarkMode(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function ErrorToast({
  message,
  onDismiss
}: {
  message: string
  onDismiss: () => void
}): React.JSX.Element {
  return (
    <div
      role="alert"
      className="fixed bottom-5 right-5 z-[1000] flex max-w-md items-start gap-4 rounded-xl border border-danger/25 bg-surface px-4 py-3 text-sm text-danger shadow-panel"
    >
      <span>{message}</span>
      <button type="button" className="font-semibold" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}

export default function App(): React.JSX.Element {
  const [systemDark, setSystemDark] = useState(initialDarkMode)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const closePreparation = useRef<() => Promise<void>>(async () => undefined)
  const store = useAppStore()
  const initialize = store.initialize
  const settings = store.settingsSnapshot?.values ?? DEFAULT_APP_SETTINGS
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const update = (): void => setSystemDark(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.dataset.accent = settings.accent
  }, [dark, settings.accent])

  useEffect(
    () =>
      window.canvasNote.app.onCloseRequested(() => {
        void closePreparation
          .current()
          .then(() => window.canvasNote.app.readyToClose())
          .catch(() => undefined)
      }),
    []
  )

  const registerClosePreparation = useCallback((handler: () => Promise<void>) => {
    closePreparation.current = handler
    return () => {
      if (closePreparation.current === handler) closePreparation.current = async () => undefined
    }
  }, [])

  const toggleTheme = (): void => {
    void store
      .updateSettings({ ...settings, theme: dark ? 'light' : 'dark' })
      .catch(() => undefined)
  }

  const settingsPanel =
    settingsOpen && store.settingsSnapshot ? (
      <SettingsPanel
        snapshot={store.settingsSnapshot}
        recentWorkspaces={store.recentWorkspaces}
        onChange={store.updateSettings}
        onOpenDataLocation={store.openDataLocation}
        onOpenBackups={store.openBackups}
        onClose={() => setSettingsOpen(false)}
      />
    ) : null

  if (store.currentBoard) {
    return (
      <>
        <BoardEditor
          key={store.currentBoard.board.id}
          stored={store.currentBoard}
          onBack={store.closeBoard}
          onSave={store.saveBoard}
          settings={settings}
          onOpenSettings={() => setSettingsOpen(true)}
          onRegisterClosePreparation={registerClosePreparation}
        />
        {settingsPanel}
        {store.error && <ErrorToast message={store.error} onDismiss={store.clearError} />}
      </>
    )
  }

  if (store.currentWorkspace) {
    return (
      <>
        <Dashboard
          workspace={store.currentWorkspace}
          boards={store.boards}
          section={store.boardSection}
          view={store.boardView}
          query={store.boardQuery}
          dark={dark}
          storage={
            store.workspaceStats ? { usedBytes: store.workspaceStats.storageBytes } : undefined
          }
          creating={store.operation === 'creating-board'}
          onSectionChange={(section: BoardSection) => store.setBoardSection(section)}
          onViewChange={store.setBoardView}
          onQueryChange={store.setBoardQuery}
          onCreateBoard={store.createBoard}
          onCreateTemplate={store.createBoardFromTemplate}
          onImportBoard={store.importBoard}
          onOpenBoard={(boardId) => void store.openBoard(boardId).catch(() => undefined)}
          onToggleFavorite={(boardId, favorite) =>
            void store.toggleFavorite(boardId, favorite).catch(() => undefined)
          }
          onTrashBoard={(boardId) => void store.trashBoard(boardId).catch(() => undefined)}
          onRestoreBoard={(boardId) => void store.restoreBoard(boardId).catch(() => undefined)}
          onDeleteBoard={(boardId) => void store.deleteBoard(boardId).catch(() => undefined)}
          onCloseWorkspace={() => void store.closeWorkspace().catch(() => undefined)}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {settingsPanel}
        {store.error && <ErrorToast message={store.error} onDismiss={store.clearError} />}
      </>
    )
  }

  return (
    <>
      <WelcomeScreen
        dark={dark}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
        onImportBoard={() => void store.importBoard().catch(() => undefined)}
      />
      {settingsPanel}
      {store.error && <ErrorToast message={store.error} onDismiss={store.clearError} />}
    </>
  )
}
