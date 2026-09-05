import React, { useState } from 'react'
import {
  ShoppingBag,
  Bell,
  UserCheck,
  Search as SearchIcon,
  LineChart,
} from 'lucide-react'
import { useSearch } from './hooks/useSearch'
import { useLocation } from './hooks/useLocation'
import { SearchBar } from './components/SearchBar'
import { ResultsPage } from './pages/Results'
import { AlertsPage } from './pages/Alerts'
import { HistoryPage } from './pages/History'
import { HomePage } from './pages/Home'
import { LoginPanel } from './components/LoginPanel'
import { PriceChart } from './components/PriceChart'

type ActiveTab = 'search' | 'history' | 'alerts' | 'auth'

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('search')
  const [historyModalProduct, setHistoryModalProduct] = useState<string | null>(null)
  const [alertPreset, setAlertPreset] = useState<{ query: string; price: number } | null>(null)

  const {
    results,
    loading: searchLoading,
    error: searchError,
    isCached,
    lastQuery,
    executeSearch,
  } = useSearch()

  const {
    location,
    detecting: detectingLocation,
    error: locationError,
    updateLocation,
    detectLocation,
  } = useLocation()

  const handleSearch = (query: string, pin: string, platforms: string[]) => {
    setActiveTab('search')
    executeSearch(query, pin, platforms, location.lat, location.lon)
  }

  const handleQuickSearch = (query: string) => {
    setActiveTab('search')
    executeSearch(query, location.pin, [], location.lat, location.lon)
  }

  const handleOpenAlertWithPreset = (productName: string, currentPrice: number) => {
    setAlertPreset({ query: productName, price: currentPrice })
    setActiveTab('alerts')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950 font-sans">
      <header className="sticky top-0 z-40 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div
            onClick={() => setActiveTab('search')}
            className="flex items-center gap-2.5 cursor-pointer group shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-950 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                QuickCompare
              </span>
              <span className="hidden sm:inline-block text-[10px] font-bold text-emerald-400 uppercase tracking-widest ml-2 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60">
                Live
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'search'
                  ? 'bg-slate-800 text-emerald-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <SearchIcon className="w-4 h-4" />
              <span>Search</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-slate-800 text-blue-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <LineChart className="w-4 h-4" />
              <span>History</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('alerts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'alerts'
                  ? 'bg-slate-800 text-amber-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Alerts</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('auth')}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'auth'
                  ? 'bg-slate-800 text-purple-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Accounts</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {activeTab === 'search' && (
          <div className="flex flex-col gap-6">
            <SearchBar
              onSearch={handleSearch}
              loading={searchLoading}
              currentPin={location.pin}
              onUpdatePin={(pin) => updateLocation(pin)}
              onDetectLocation={detectLocation}
              detectingLocation={detectingLocation}
              locationError={locationError}
            />

            {results.length > 0 || searchLoading || lastQuery || searchError ? (
              <ResultsPage
                results={results}
                loading={searchLoading}
                error={searchError}
                isCached={isCached}
                lastQuery={lastQuery}
                onViewHistory={(name) => setHistoryModalProduct(name)}
                onSetAlert={handleOpenAlertWithPreset}
              />
            ) : (
              <HomePage onQuickSearch={handleQuickSearch} />
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryPage onSelectProduct={(name) => setHistoryModalProduct(name)} />
        )}

        {activeTab === 'alerts' && (
          <AlertsPage
            currentPin={location.pin}
            initialQuery={alertPreset?.query}
            initialPrice={alertPreset?.price}
          />
        )}

        {activeTab === 'auth' && <LoginPanel />}
      </main>

      <PriceChart
        productName={historyModalProduct}
        onClose={() => setHistoryModalProduct(null)}
      />

      <footer className="mt-auto py-6 border-t border-slate-900 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Quick-Commerce Price Comparison Engine</span>
          <span>Self-hosted on Raspberry Pi 5 &bull; Private &amp; Open</span>
        </div>
      </footer>
    </div>
  )
}

export default App
