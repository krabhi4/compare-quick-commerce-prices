import React, { useState, useEffect } from 'react'

interface SearchBarProps {
  onSearch: (query: string, pin: string) => void
  loading: boolean
  currentPin: string
  onUpdatePin: (pin: string) => void
  onDetectLocation: () => void
  detectingLocation: boolean
  locationError?: string | null
}

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
  const [pin, setPin] = useState(currentPin)
  const [editingPin, setEditingPin] = useState(false)

  useEffect(() => {
    setPin(currentPin)
  }, [currentPin])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || loading) return
    onSearch(query.trim(), currentPin)
  }

  const savePin = () => {
    if (pin.length === 6) {
      onUpdatePin(pin)
      setEditingPin(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={submit} className="flex items-stretch gap-0 border-b-2 border-ink">
        <label htmlFor="q" className="sr-only">
          Grocery item
        </label>
        <input
          id="q"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="milk, atta, eggs, amul butter"
          disabled={loading}
          autoComplete="off"
          className="board min-w-0 flex-1 bg-transparent py-2 text-lead [font-stretch:96%] outline-none disabled:text-ink-3"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="tag self-stretch bg-ink px-4 text-ground transition-colors hover:bg-mark disabled:bg-transparent disabled:text-ink-3"
        >
          {loading ? 'reading' : 'read prices'}
        </button>
      </form>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {editingPin ? (
          <span className="flex items-baseline gap-2">
            <label htmlFor="pin" className="tag text-ink-2">
              pincode
            </label>
            <input
              id="pin"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && savePin()}
              className="board w-20 border-b border-ink bg-transparent text-label tracking-[0.15em] outline-none"
            />
            <button type="button" onClick={savePin} className="tag text-mark">
              set
            </button>
            <button
              type="button"
              onClick={onDetectLocation}
              disabled={detectingLocation}
              className="tag text-ink-3 hover:text-ink"
            >
              {detectingLocation ? 'locating…' : 'use my location'}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setEditingPin(true)}
            className="tag text-ink-2 hover:text-mark"
          >
            pincode{' '}
            <span className="board text-label tracking-[0.15em] text-ink">{currentPin}</span>
            <span className="ml-1.5 text-ink-3">change</span>
          </button>
        )}

        {locationError && <span className="text-micro text-mark">{locationError}</span>}
      </div>
    </div>
  )
}
