import React, { useState, useEffect, useCallback } from 'react'
import { formatDate } from '../utils/format'
import { PriceChart } from '../components/PriceChart'

interface TrackedProduct {
  id: number
  normalized_name: string
  platform: string
  name: string
  quantity?: string | null
  brand?: string | null
  image_url?: string | null
  product_url?: string | null
  in_stock: boolean
  updated_at: string
}

export const HistoryPage: React.FC = () => {
  const [products, setProducts] = useState<TrackedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/history/products')
      if (!res.ok) throw new Error('Could not load tracked items')
      const data = await res.json()
      setProducts(data.products || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load tracked items')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const term = filter.toLowerCase()
  const matched = products.filter(
    (p) =>
      p.name.toLowerCase().includes(term) ||
      p.normalized_name.toLowerCase().includes(term) ||
      p.brand?.toLowerCase().includes(term)
  )
  const unique = Array.from(new Map(matched.map((p) => [p.normalized_name, p])).values())

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b-2 border-ink pb-2">
        <div className="max-w-prose">
          <h2 className="board text-lead [font-stretch:88%] font-semibold">Tracked items</h2>
        </div>
        <label className="flex items-baseline gap-2">
          <span className="tag text-ink-2">filter</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="brand or item"
            className="board w-40 border-b border-rule-strong bg-transparent pb-0.5 text-label [font-stretch:96%] outline-none focus:border-ink"
          />
        </label>
      </div>

      {error && <p className="tag text-mark">{error}</p>}

      {loading ? (
        <p className="tag text-ink-3">reading snapshots…</p>
      ) : unique.length === 0 ? (
        <p className="text-label text-ink-2">
          {products.length === 0
            ? 'Nothing is tracked yet. Each search records the prices it reads.'
            : `No tracked item matches ${filter}.`}
        </p>
      ) : (
        <ul className="flex flex-col">
          {unique.map((product, i) => {
            const isOpen = open === product.normalized_name
            return (
              <li key={product.id} className="border-t border-rule last:border-b">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : product.normalized_name)}
                  aria-expanded={isOpen}
                  className="rise flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-panel"
                  style={{ animationDelay: `${Math.min(i, 12) * 24}ms` }}
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt=""
                      loading="lazy"
                      className="size-10 shrink-0 bg-panel object-contain"
                    />
                  ) : (
                    <span className="size-10 shrink-0 bg-sunk" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="board block truncate text-body [font-stretch:92%] font-semibold">
                      {product.normalized_name}
                    </span>
                    <span className="mt-0.5 block text-micro text-ink-2">
                      {[product.brand, product.quantity].filter(Boolean).join(' · ')}
                      {product.brand || product.quantity ? ' · ' : ''}
                      updated {formatDate(product.updated_at)}
                    </span>
                  </span>
                  <span className="tag shrink-0 text-ink-3">{isOpen ? 'close' : 'trend'}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-dashed border-rule-strong bg-panel px-1">
                    <PriceChart productName={product.normalized_name} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
