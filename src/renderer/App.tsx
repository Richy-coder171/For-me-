import { useEffect, useState } from 'react'

import { BoardEditor } from './canvas/BoardEditor'
import { Dashboard } from './components/Dashboard'
import { WelcomeScreen } from './components/WelcomeScreen'
import { useAppStore, type BoardSection } from './stores/appStore'

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
  const [dark, setDark] = useState(initialDarkMode)
  const store = useAppStore()
  const initialize = store.initialize

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  if (store.currentBoard) {
    return (
      <>
        <BoardEditor
          key={store.currentBoard.board.id}
          stored={store.currentBoard}
          onBack={store.closeBoard}
          onSave={store.saveBoard}
        />
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
          onOpenBoard={(boardId) => void store.openBoard(boardId).catch(() => undefined)}
          onToggleFavorite={(boardId, favorite) =>
            void store.toggleFavorite(boardId, favorite).catch(() => undefined)
          }
          onTrashBoard={(boardId) => void store.trashBoard(boardId).catch(() => undefined)}
          onRestoreBoard={(boardId) => void store.restoreBoard(boardId).catch(() => undefined)}
          onDeleteBoard={(boardId) => void store.deleteBoard(boardId).catch(() => undefined)}
          onCloseWorkspace={() => void store.closeWorkspace().catch(() => undefined)}
          onToggleTheme={() => setDark((value) => !value)}
        />
        {store.error && <ErrorToast message={store.error} onDismiss={store.clearError} />}
      </>
    )
  }

  return <WelcomeScreen dark={dark} onToggleTheme={() => setDark((value) => !value)} />
}
