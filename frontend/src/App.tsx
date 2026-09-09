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
  { id: 'board', label: 'board' },
  { id: 'trends', label: 'trends' },
  { id: 'alerts', label: 'alerts' },
]

const Mark = () => (
  <svg viewBox="0 0 32 32" aria-hidden className="size-6 shrink-0">
    <rect x="4" y="20" width="4" height="8" fill="var(--color-mark)" />
    <rect x="10" y="12" width="4" height="16" fill="currentColor" />
    <rect x="16" y="15" width="4" height="13" fill="currentColor" />
    <rect x="22" y="7" width="4" height="21" fill="currentColor" />
    <rect x="4" y="4" width="22" height="2" fill="var(--color-mark)" />
  </svg>
)

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('board')
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
    if (activeTab === 'trends') document.title = `Trends · ${base}`
    else if (activeTab === 'alerts') document.title = `Alerts · ${base}`
    else if (loading) document.title = `Reading ${lastQuery}... · ${base}`
    else if (lastQuery) document.title = `${lastQuery} · ${location.pin} · ${base}`
    else document.title = base
  }, [activeTab, loading, lastQuery, location.pin])

  const handleSearch = (query: string, pin: string) => {
    setActiveTab('board')
    executeSearch(query, pin, [], location.lat, location.lon)
  }

  const openAlert = (productName: string, currentPrice: number) => {
    setAlertPreset({ query: productName, price: currentPrice })
    setActiveTab('alerts')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b-2 border-ink pt-6 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('board')}
          className="flex items-end gap-2.5 text-ink"
        >
          <Mark />
          <span className="board text-lead [font-stretch:80%] font-extrabold uppercase tracking-[0.02em] leading-none">
            QuickCompare
          </span>
        </button>

        <nav className="flex items-baseline gap-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`tag transition-colors ${
                activeTab === tab.id
                  ? 'text-mark underline decoration-mark decoration-2 underline-offset-6'
                  : 'text-ink-3 hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex flex-1 flex-col gap-6 py-6 pb-16">
        {activeTab === 'board' && (
          <>
            <SearchBar
              onSearch={handleSearch}
              loading={loading}
              currentPin={location.pin}
              onUpdatePin={(pin) => updateLocation(pin)}
              onDetectLocation={detectLocation}
              detectingLocation={detectingLocation}
              locationError={locationError}
            />

            {results.length > 0 || loading || lastQuery || error ? (
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
