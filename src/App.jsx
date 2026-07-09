import { Suspense, useEffect, useState, useCallback } from 'react'
import Sidebar from './components/Sidebar.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import PrivacyBadge from './components/PrivacyBadge.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import Note from './components/Note.jsx'
import Icon from './components/Icon.jsx'
import Progress from './components/Progress.jsx'
import { useTheme } from './hooks/useTheme.js'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import { operations, getOperation } from './registry/registry.js'

function useHashSelection(defaultId) {
  const [lastTool, setLastTool] = useLocalStorage('doxdock:lastTool', defaultId)
  const fromHash = () => {
    const id = window.location.hash.replace(/^#\/?/, '')
    return getOperation(id) ? id : null
  }
  const [activeId, setActiveId] = useState(() => fromHash() || lastTool || defaultId)

  const select = useCallback(
    (id) => {
      setActiveId(id)
      setLastTool(id)
      if (window.location.hash !== `#/${id}`) window.location.hash = `#/${id}`
    },
    [setLastTool],
  )

  useEffect(() => {
    const onHash = () => {
      const id = fromHash()
      if (id) {
        setActiveId(id)
        setLastTool(id)
      }
    }
    window.addEventListener('hashchange', onHash)
    // Ensure the URL reflects the initial selection.
    if (!fromHash()) window.location.hash = `#/${activeId}`
    return () => window.removeEventListener('hashchange', onHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [activeId, select]
}

export default function App() {
  const [theme, setTheme] = useTheme()
  const defaultId = operations[0]?.id
  const [activeId, select] = useHashSelection(defaultId)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const activeOp = getOperation(activeId) || operations[0]

  // Global Cmd/Ctrl+K to open the palette.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSelect = (id) => {
    select(id)
    setMobileNavOpen(false)
  }

  const Component = activeOp?.Component

  // Standalone "pop-out" mode: render only the active tool, no sidebar/palette.
  const standalone = new URLSearchParams(window.location.search).get('standalone') === '1'
  if (standalone && activeOp) {
    return (
      <div className="flex h-full flex-col">
        <header className="z-20 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Icon name={activeOp.icon} className="h-5 w-5" />
          </span>
          <span className="font-semibold tracking-tight">{activeOp.name}</span>
          <span className="ml-1 hidden sm:block"><PrivacyBadge compact /></span>
          <div className="ml-auto">
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
            <Suspense fallback={<Progress message="Loading tool…" />}>
              {Component && <Component key={activeOp.id} />}
            </Suspense>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="z-20 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <button
          type="button"
          className="btn-ghost -ml-2 px-2 lg:hidden"
          aria-label="Toggle navigation"
          onClick={() => setMobileNavOpen((o) => !o)}
        >
          <Icon name={mobileNavOpen ? 'x' : 'grid'} className="h-5 w-5" />
        </button>
        <a href="#/" className="flex items-center gap-2" onClick={() => defaultId && handleSelect(defaultId)}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Icon name="layers" className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">DoxDock</span>
        </a>
        <div className="ml-2 hidden md:block">
          <PrivacyBadge />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="ideology.html"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost gap-1.5 px-2.5"
            title="Why DoxDock exists — a letter to our users"
          >
            <Icon name="shieldCheck" className="h-4 w-4 text-brand-500" />
            <span className="hidden sm:inline">Ideology</span>
          </a>
          <a
            href="https://github.com/mithun-srinivas/DoxDock"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost hidden px-2 sm:inline-flex"
            title="Open source (MIT) — view or self-host"
            aria-label="GitHub"
          >
            <Icon name="github" className="h-5 w-5" />
          </a>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-72 flex-shrink-0 border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 lg:block">
          <Sidebar activeId={activeId} onSelect={handleSelect} onOpenPalette={() => setPaletteOpen(true)} />
        </aside>

        {/* Sidebar (mobile drawer) */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileNavOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 border-r border-slate-200 bg-slate-50 shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <Sidebar
                activeId={activeId}
                onSelect={handleSelect}
                onOpenPalette={() => {
                  setMobileNavOpen(false)
                  setPaletteOpen(true)
                }}
              />
            </aside>
          </div>
        )}

        {/* Main */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
            {activeOp && (
              <>
                <div className="mb-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
                      <Icon name={activeOp.icon} className="h-6 w-6" />
                    </span>
                    <div>
                      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{activeOp.name}</h1>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{activeOp.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 md:hidden">
                    <PrivacyBadge compact />
                  </div>
                  {activeOp.notes && (
                    <div className="mt-4">
                      <Note type="warning" title="Good to know">
                        {activeOp.notes}
                      </Note>
                    </div>
                  )}
                </div>

                <Suspense fallback={<Progress message="Loading tool…" />}>
                  {Component && <Component key={activeOp.id} />}
                </Suspense>
              </>
            )}
          </div>

          <footer className="mx-auto max-w-3xl px-4 pb-10 pt-4 text-xs text-slate-400 sm:px-6">
            <p>
              DoxDock processes everything on your device. No file you open is ever uploaded — the
              app makes zero network requests at runtime. Open source under the MIT license.
            </p>
          </footer>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={handleSelect}
      />
    </div>
  )
}
