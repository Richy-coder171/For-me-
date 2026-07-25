import { useEffect, useState } from 'react'

import { BoardDetails } from './components/BoardDetails'
import { Dashboard } from './components/Dashboard'
import { WelcomeScreen } from './components/WelcomeScreen'
import { useAppStore, type BoardSection } from './stores/appStore'

function initialDarkMode(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
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
      <BoardDetails
        stored={store.currentBoard}
        saving={store.operation === 'saving-board'}
        onBack={() => void store.closeBoard()}
        onSaveTitle={store.saveBoardTitle}
      />
    )
  }

  if (store.currentWorkspace) {
    return (
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
        onOpenBoard={(boardId) => void store.openBoard(boardId)}
        onToggleFavorite={(boardId, favorite) => void store.toggleFavorite(boardId, favorite)}
        onTrashBoard={(boardId) => void store.trashBoard(boardId)}
        onRestoreBoard={(boardId) => void store.restoreBoard(boardId)}
        onDeleteBoard={(boardId) => void store.deleteBoard(boardId)}
        onCloseWorkspace={() => void store.closeWorkspace()}
        onToggleTheme={() => setDark((value) => !value)}
      />
    )
  }

  return <WelcomeScreen dark={dark} onToggleTheme={() => setDark((value) => !value)} />
}
