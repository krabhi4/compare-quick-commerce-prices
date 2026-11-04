import React, { useState, useEffect } from 'react'
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

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetch('/history/products', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load tracked items (${res.status})`)
        const data = await res.json()
        setProducts(data.products || [])
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Could not load tracked items')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [])

  const term = filter.toLowerCase()
  const matched = products.filter(
    (p) =>
      p.name.toLowerCase().includes(term) ||
      p.normalized_name.toLowerCase().includes(term) ||
      p.brand?.toLowerCase().includes(term)
  )
  const unique = Array.from(new Map(matched.map((p) => [p.normalized_name, p])).values())

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <h2>Tracked items</h2>
        <label className="flex flex-col gap-1.5">
          <span className="label">Filter</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="brand or item"
            className="field w-60"
          />
        </label>
      </div>

      {error && <p className="text-error">{error}</p>}

      {loading ? (
        <div aria-busy="true" className="flex flex-col gap-4">
          <p className="label">Reading snapshots…</p>
          <div className="flex flex-col border-t-2 border-rule-ink">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-rule py-4">
              <span className="size-12 shrink-0 bg-paper-2" />
              <span className="h-4 w-56 max-w-full bg-paper-2" />
            </div>
          ))}
          </div>
        </div>
      ) : unique.length === 0 ? (
        <p className="border-t-2 border-rule-ink pt-4 text-muted">
          {products.length === 0
            ? 'Nothing is tracked yet. Each search records the prices it reads.'
            : `No tracked item matches ${filter}.`}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col border-t-2 border-rule-ink p-0">
          {unique.map((product) => {
            const isOpen = open === product.normalized_name
            return (
              <li key={product.normalized_name} className="border-b border-rule">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : product.normalized_name)}
                  aria-expanded={isOpen}
                  className="group flex w-full items-center gap-4 py-4 text-left"
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                      className="size-12 shrink-0 bg-plate object-contain p-0.5"
                    />
                  ) : (
                    <span className="size-12 shrink-0 bg-paper-2" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium">{product.normalized_name}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {[
                        product.brand,
                        product.quantity,
                        `updated ${product.updated_at ? formatDate(product.updated_at) : 'unknown'}`,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-ink-2 underline decoration-muted decoration-1 underline-offset-4 transition-colors group-hover:decoration-accent">
                    {isOpen ? 'Close' : 'Trend'}
                  </span>
                </button>
                {isOpen && (
                  <div className="bg-paper-2 px-4">
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
