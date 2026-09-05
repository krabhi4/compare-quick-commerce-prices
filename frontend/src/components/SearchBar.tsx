import React, { useState, useEffect } from 'react'
import { Search, MapPin, Loader2, X, Filter } from 'lucide-react'

interface SearchBarProps {
  onSearch: (query: string, pin: string, platforms: string[]) => void
  loading: boolean
  currentPin: string
  onUpdatePin: (pin: string) => void
  onDetectLocation: () => void
  detectingLocation: boolean
  locationError?: string | null
}

const QUICK_SUGGESTIONS = [
  'Milk',
  'Amul Butter',
  'Eggs',
  'Brown Bread',
  'Curd',
  'Paneer',
  'Coca Cola',
  'Lays',
]

const ALL_PLATFORMS = [
  { id: 'blinkit', label: 'Blinkit' },
  { id: 'zepto', label: 'Zepto' },
  { id: 'instamart', label: 'Instamart' },
  { id: 'flipkart', label: 'Flipkart' },
  { id: 'bigbasket', label: 'BigBasket' },
]

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  loading,
  currentPin,
  onUpdatePin,
  onDetectLocation,
  detectingLocation,
  locationError,
}) => {
  const [query, setQuery] = useState('')
  const [pin, setPin] = useState(currentPin || '110001')
  const [showPinInput, setShowPinInput] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (currentPin) {
      setPin(currentPin)
    }
  }, [currentPin])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const activePin = pin.trim() || currentPin || '110001'
    if (activePin.length !== 6) {
      setShowPinInput(true)
      return
    }
    if (activePin !== currentPin) {
      onUpdatePin(activePin)
    }
    if (query.trim() && !loading) {
      onSearch(query.trim(), activePin, selectedPlatforms)
    }
  }

  const handleSuggestionClick = (item: string) => {
    setQuery(item)
    const activePin = pin.trim() || currentPin || '110001'
    onSearch(item, activePin, selectedPlatforms)
  }

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const handleSavePin = () => {
    if (pin.trim().length === 6) {
      onUpdatePin(pin.trim())
      setShowPinInput(false)
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="relative flex flex-col gap-3">
        <div className="relative flex items-center bg-slate-900/90 border border-slate-800 focus-within:border-emerald-500/80 rounded-2xl p-1.5 shadow-xl backdrop-blur-md transition-all">
          <div className="pl-3 text-slate-400">
            <Search className="w-5 h-5" />
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search groceries (e.g. Amul Milk, Croissant, Butter)..."
            className="w-full px-3 py-2.5 bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-sm md:text-base font-medium"
            disabled={loading}
          />

          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg transition-colors mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-1.5 pr-1 border-l border-slate-800 pl-2">
            <button
              type="button"
              onClick={() => setShowPinInput(!showPinInput)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-colors"
              title="Change Delivery Pincode"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{currentPin || pin || 'PIN'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters || selectedPlatforms.length > 0
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400'
              }`}
              title="Filter Platforms"
            >
              <Filter className="w-4 h-4" />
            </button>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm transition-all shadow-md shadow-emerald-950"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Searching</span>
                </>
              ) : (
                <span>Compare</span>
              )}
            </button>
          </div>
        </div>

        {showPinInput && (
          <div className="p-3 bg-slate-900/95 border border-slate-800 rounded-xl shadow-lg flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="text-xs font-semibold text-slate-300">Deliver to PIN:</span>
            <input
              type="text"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 800023"
              className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500 w-28 text-center tracking-widest font-mono"
            />
            <button
              type="button"
              onClick={handleSavePin}
              className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg transition-colors"
            >
              Set PIN
            </button>
            <button
              type="button"
              onClick={onDetectLocation}
              disabled={detectingLocation}
              className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors ml-auto"
            >
              {detectingLocation ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <MapPin className="w-3 h-3 text-emerald-400" />
              )}
              <span>Auto-Detect</span>
            </button>
            {locationError && (
              <span className="w-full text-xs text-rose-400">{locationError}</span>
            )}
          </div>
        )}

        {showFilters && (
          <div className="p-3 bg-slate-900/95 border border-slate-800 rounded-xl shadow-lg flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="text-xs font-semibold text-slate-300 mr-1">Platforms:</span>
            {ALL_PLATFORMS.map((plat) => {
              const isSelected = selectedPlatforms.includes(plat.id)
              return (
                <button
                  key={plat.id}
                  type="button"
                  onClick={() => togglePlatform(plat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-xs'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {plat.label}
                </button>
              )
            })}
            {selectedPlatforms.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedPlatforms([])}
                className="text-xs text-slate-400 hover:text-slate-200 underline ml-auto"
              >
                Reset
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
          <span className="text-xs font-medium text-slate-500 shrink-0">Popular:</span>
          {QUICK_SUGGESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSuggestionClick(item)}
              className="px-2.5 py-1 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors shrink-0"
            >
              {item}
            </button>
          ))}
        </div>
      </form>
    </div>
  )
}
