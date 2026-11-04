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
    if (!editingPin) {
      setPin(currentPin)
    }
  }, [currentPin, editingPin])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || loading) return
    onSearch(query.trim(), pin.length === 6 ? pin : currentPin)
  }

  const savePin = () => {
    if (pin.length === 6) {
      onUpdatePin(pin)
      setEditingPin(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1.5">
          <label htmlFor="q" className="label">
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
            className="field w-full"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="btn min-w-32"
        >
          {loading ? 'Reading…' : 'Read prices'}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {editingPin ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label htmlFor="pin" className="label">
              Pincode
            </label>
            <input
              id="pin"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && savePin()}
              className="field w-28 tabular-nums"
            />
            <button
              type="button"
              onClick={savePin}
              disabled={pin.length !== 6}
              className="link"
            >
              Set
            </button>
            <button
              type="button"
              onClick={() => {
                setPin(currentPin)
                setEditingPin(false)
              }}
              className="link"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDetectLocation}
              disabled={detectingLocation}
              className="link"
            >
              {detectingLocation ? 'Locating…' : 'Use my location'}
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-3">
            <span className="label">Pincode</span>
            <span className="font-medium tabular-nums text-ink">{currentPin}</span>
            <button type="button" onClick={() => setEditingPin(true)} className="link">
              Change
            </button>
          </span>
        )}

        {locationError && <span className="text-sm text-error">{locationError}</span>}
      </div>
    </div>
  )
}
