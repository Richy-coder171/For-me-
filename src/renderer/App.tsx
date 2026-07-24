import { useEffect, useState } from 'react'

import { WelcomeScreen } from './components/WelcomeScreen'
import { WorkspaceShell } from './components/WorkspaceShell'
import { useAppStore } from './stores/appStore'

function initialDarkMode(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export default function App(): React.JSX.Element {
  const [dark, setDark] = useState(initialDarkMode)
  const { currentWorkspace, initialize, closeWorkspace } = useAppStore()

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  if (currentWorkspace) {
    return <WorkspaceShell workspace={currentWorkspace} onClose={closeWorkspace} />
  }

  return <WelcomeScreen dark={dark} onToggleTheme={() => setDark((value) => !value)} />
}
