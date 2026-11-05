import React, { useState, useEffect } from 'react'
import { useSearch } from './hooks/useSearch'
import { useLocation } from './hooks/useLocation'
import { SearchBar } from './components/SearchBar'
import { ResultsPage } from './pages/Results'
import { AlertsPage } from './pages/Alerts'
import { HistoryPage } from './pages/History'
import { HomePage } from './pages/Home'

type ActiveTab = 'board' | 'trends' | 'alerts'

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'board', label: 'Board' },
  { id: 'trends', label: 'Trends' },
  { id: 'alerts', label: 'Alerts' },
]

type Mode = 'system' | 'light' | 'dark'

const readMode = (): Mode => {
  try {
    const saved = localStorage.getItem('mode')
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('board')
  const [mode, setMode] = useState<Mode>(readMode)
  const [alertPreset, setAlertPreset] = useState<{ query: string; price: number } | null>(null)

  const { results, loading, error, isCached, lastQuery, executeSearch } = useSearch()
  const {
    location,
    detecting: detectingLocation,
    error: locationError,
    updateLocation,
    detectLocation,
  } = useLocation()

  useEffect(() => {
    const base = 'QuickCompare'
    const query = lastQuery?.trim()
    const pin = location?.pin?.trim()
    if (activeTab === 'trends') document.title = `Trends · ${base}`
    else if (activeTab === 'alerts') document.title = `Alerts · ${base}`
    else if (loading && query) document.title = `Reading ${query}... · ${base}`
    else if (query && pin) document.title = `${query} · ${pin} · ${base}`
    else if (query) document.title = `${query} · ${base}`
    else document.title = base
  }, [activeTab, loading, lastQuery, location?.pin])

  useEffect(() => {
    const root = document.documentElement
    if (mode === 'system') delete root.dataset.mode
    else root.dataset.mode = mode
    try {
      if (mode === 'system') localStorage.removeItem('mode')
      else localStorage.setItem('mode', mode)
    } catch {
      return
    }
  }, [mode])

  const handleSearch = (query: string, pin: string) => {
    setActiveTab('board')
    executeSearch(query, pin, [], location.lat, location.lon)
  }

  const openAlert = (productName: string, currentPrice: number) => {
    setAlertPreset({ query: productName, price: currentPrice })
    setActiveTab('alerts')
  }

  const showBoard = results.length > 0 || loading || Boolean(lastQuery) || Boolean(error)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-2 border-rule-ink">
        <div className="mx-auto flex w-full max-w-(--container) flex-wrap items-end justify-between gap-x-8 gap-y-1 px-(--gutter) pt-5">
          <button
            type="button"
            onClick={() => setActiveTab('board')}
            className="wordmark pb-3 transition-colors hover:text-accent"
          >
            QuickCompare
          </button>

          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <nav aria-label="Screens" className="flex items-end gap-6">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className="tab"
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <label className="mb-1.5 flex items-center gap-2">
              <span className="label">Theme</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
                className="field min-h-8 text-sm"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-(--container) flex-1 flex-col gap-10 px-(--gutter) pt-10 pb-24">
        {activeTab === 'board' && (
          <>
            {!showBoard && <h2>Live grocery prices for one pincode</h2>}

            <SearchBar
              onSearch={handleSearch}
              loading={loading}
              currentPin={location.pin}
              onUpdatePin={(pin) => updateLocation(pin)}
              onDetectLocation={detectLocation}
              detectingLocation={detectingLocation}
              locationError={locationError}
            />

            {showBoard ? (
              <ResultsPage
                results={results}
                loading={loading}
                error={error}
                isCached={isCached}
                lastQuery={lastQuery}
                onSetAlert={openAlert}
              />
            ) : (
              <HomePage onQuickSearch={(q) => handleSearch(q, location.pin)} />
            )}
          </>
        )}

        {activeTab === 'trends' && <HistoryPage />}

        {activeTab === 'alerts' && (
          <AlertsPage
            currentPin={location.pin}
            initialQuery={alertPreset?.query}
            initialPrice={alertPreset?.price}
          />
        )}
      </main>
    </div>
  )
}

export default App
