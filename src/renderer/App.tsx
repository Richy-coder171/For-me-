import { useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'

import { BoardEditor } from './canvas/BoardEditor'
import { Dashboard } from './components/Dashboard'
import { BrandMark } from './components/BrandMark'
import { WelcomeScreen } from './components/WelcomeScreen'
import { SettingsPanel, type SettingsSection } from './components/SettingsPanel'
import { Button, Feedback } from './components/ui'
import { useAppStore, type BoardSection } from './stores/appStore'
import { DEFAULT_APP_SETTINGS } from '../shared/schemas/settings'

function initialDarkMode(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function ErrorToast({
  message,
  onDismiss,
  onRetry
}: {
  message: string
  onDismiss: () => void
  onRetry?: () => void
}): React.JSX.Element {
  return (
    <div className="fixed bottom-4 right-4 z-[1200] w-[min(26rem,calc(100vw-2rem))]">
      <Feedback
        tone="danger"
        title="CanvasNote could not complete that action"
        message={message}
        actions={
          onRetry ? (
            <Button size="small" onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
        onDismiss={onDismiss}
      />
    </div>
  )
}

function StartupScreen(): React.JSX.Element {
  return (
    <main className="grid min-h-screen place-items-center bg-background text-ink" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <BrandMark />
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
          Opening CanvasNote…
        </p>
      </div>
    </main>
  )
}

export default function App(): React.JSX.Element {
  const [systemDark, setSystemDark] = useState(initialDarkMode)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('appearance')
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

  const openSettings = (section: SettingsSection = 'appearance'): void => {
    setSettingsSection(section)
    setSettingsOpen(true)
  }

  const settingsPanel =
    settingsOpen && store.settingsSnapshot ? (
      <SettingsPanel
        snapshot={store.settingsSnapshot}
        recentWorkspaces={store.recentWorkspaces}
        initialSection={settingsSection}
        version={store.appInfo?.version}
        platform={store.appInfo?.platform}
        onChange={store.updateSettings}
        onOpenDataLocation={store.openDataLocation}
        onOpenBackups={store.openBackups}
        onClose={() => setSettingsOpen(false)}
      />
    ) : null

  if (!store.initialized) return <StartupScreen />

  if (store.currentBoard) {
    return (
      <>
        <BoardEditor
          key={store.currentBoard.board.id}
          stored={store.currentBoard}
          onBack={store.closeBoard}
          onSave={store.saveBoard}
          settings={settings}
          onOpenSettings={openSettings}
          onOpenTemplates={async () => {
            await store.closeBoard()
            store.setBoardSection('templates')
          }}
          onToggleTheme={toggleTheme}
          onRegisterClosePreparation={registerClosePreparation}
        />
        {settingsPanel}
        {store.error && !settingsOpen && (
          <ErrorToast message={store.error} onDismiss={store.clearError} />
        )}
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
          loading={store.operation === 'loading-boards'}
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
          onOpenSettings={() => openSettings()}
        />
        {settingsPanel}
        {store.error && !settingsOpen && (
          <ErrorToast message={store.error} onDismiss={store.clearError} />
        )}
      </>
    )
  }

  return (
    <>
      <WelcomeScreen
        dark={dark}
        settingsAvailable={Boolean(store.settingsSnapshot)}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => openSettings()}
        onImportBoard={() => void store.importBoard().catch(() => undefined)}
      />
      {settingsPanel}
      {store.error && !settingsOpen && (
        <ErrorToast
          message={store.error}
          onDismiss={store.clearError}
          onRetry={store.settingsSnapshot ? undefined : () => void initialize()}
        />
      )}
    </>
  )
}
