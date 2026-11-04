import React, { useState, useMemo } from 'react'
import type { GroupedProduct } from '../hooks/useSearch'
import { PriceRow } from '../components/PriceRow'
import { PriceChart } from '../components/PriceChart'
import { PLATFORM_INFO, PLATFORM_ORDER } from '../utils/normalize'
import { formatAmount, formatEta } from '../utils/format'

interface ResultsPageProps {
  results: GroupedProduct[]
  loading: boolean
  error?: string | null
  isCached: boolean
  lastQuery: string
  onSetAlert: (productName: string, currentPrice: number) => void
}

type SortOption = 'cheapest' | 'savings' | 'stores'

const SORTS: { id: SortOption; label: string }[] = [
  { id: 'savings', label: 'Biggest gap' },
  { id: 'cheapest', label: 'Lowest price' },
  { id: 'stores', label: 'Most stores' },
]

const GRID =
  'grid grid-cols-1 lg:grid-cols-[minmax(13rem,2.4fr)_repeat(5,minmax(5.5rem,1fr))_minmax(4.5rem,0.7fr)]'

const isSafeUrl = (url?: string | null) => {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const spread = (p: GroupedProduct) => {
  const prices = p.platforms.map((x) => x.price).filter((price) => Number.isFinite(price))
  if (prices.length === 0) return 0
  return (
    prices.reduce((a, b) => Math.max(a, b), prices[0]) -
    prices.reduce((a, b) => Math.min(a, b), prices[0])
  )
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
  results,
  loading,
  error,
  isCached,
  lastQuery,
  onSetAlert,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('savings')
  const [openTrend, setOpenTrend] = useState<string | null>(null)
  const [showSingles, setShowSingles] = useState(false)

  const { compared, singles } = useMemo(() => {
    const multi = results.filter((r) => r.platforms.length > 1)
    if (sortBy === 'cheapest') {
      multi.sort(
        (a, b) =>
          (Number.isFinite(a.cheapest_price) ? a.cheapest_price : 0) -
          (Number.isFinite(b.cheapest_price) ? b.cheapest_price : 0)
      )
    }
    if (sortBy === 'savings') {
      multi.sort((a, b) => spread(b) - spread(a))
    }
    if (sortBy === 'stores') {
      multi.sort((a, b) => b.platforms.length - a.platforms.length)
    }
    const one = results
      .filter((r) => r.platforms.length === 1)
      .sort(
        (a, b) =>
          (Number.isFinite(a.cheapest_price) ? a.cheapest_price : 0) -
          (Number.isFinite(b.cheapest_price) ? b.cheapest_price : 0)
      )
    return { compared: multi, singles: one }
  }, [results, sortBy])

  if (loading) {
    return (
      <section aria-busy="true" className="flex flex-col gap-4">
        <p className="label">Reading {PLATFORM_ORDER.length} stores…</p>
        <div className={`${GRID} border-t-2 border-rule-ink`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="col-span-full grid grid-cols-subgrid border-b border-rule py-4">
              <div className="flex items-center gap-3">
                <span className="size-12 shrink-0 bg-paper-2" />
                <span className="h-4 w-40 max-w-full bg-paper-2" />
              </div>
              {[0, 1, 2, 3, 4, 5].map((j) => (
                <span key={j} className="mx-3 hidden h-6 self-center bg-paper-2 lg:block" />
              ))}
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="flex flex-col gap-2 border-t-2 border-error pt-4">
        <h2>Search failed</h2>
        <p className="text-error">{error}</p>
      </section>
    )
  }

  if (results.length === 0) {
    if (!lastQuery) return null
    return (
      <section className="flex flex-col gap-3 border-t-2 border-rule-ink pt-4">
        <h2>No store returned anything for {lastQuery} at this pincode.</h2>
        <p className="text-muted">Try a shorter term, or check the pincode.</p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="flex flex-col gap-2">
            <h2>
              {compared.length > 0
                ? `${compared.length} ${compared.length === 1 ? 'item is' : 'items are'} on more than one store`
                : `${results.length} ${results.length === 1 ? 'match' : 'matches'} for ${lastQuery}`}
            </h2>
            {isCached && <p className="text-sm text-muted">From cache</p>}
          </div>

          {compared.length > 1 && (
            <div role="group" aria-label="Sort" className="flex flex-wrap items-end gap-x-4">
              <span className="label hidden pb-3 md:inline">Sort by</span>
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSortBy(s.id)}
                  aria-pressed={sortBy === s.id}
                  className="tab"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {compared.length === 0 ? (
          <p className="border-t-2 border-rule-ink pt-4 text-muted">
            Each of the {singles.length} matches is on only one store, so there is nothing to
            compare.
          </p>
        ) : (
          <div className={GRID}>
            <div className="col-span-full hidden grid-cols-subgrid border-b-2 border-rule-ink pb-2 lg:grid">
              <span className="label">Item</span>
              {PLATFORM_ORDER.map((key) => (
                <span key={key} className="label px-3 text-right whitespace-nowrap">
                  {PLATFORM_INFO[key].short}
                </span>
              ))}
              <span className="label pl-3 text-right">Save</span>
            </div>

            {compared.map((product, i) => (
              <React.Fragment key={product.normalized_name}>
                <PriceRow
                  product={product}
                  index={i}
                  expanded={openTrend === product.normalized_name}
                  onToggleHistory={() =>
                    setOpenTrend((cur) => (cur === product.normalized_name ? null : product.normalized_name))
                  }
                  onSetAlert={onSetAlert}
                />
                {openTrend === product.normalized_name && (
                  <div className="col-span-full bg-paper-2 px-4">
                    <PriceChart productName={product.normalized_name} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {singles.length > 0 && (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setShowSingles((v) => !v)}
            aria-expanded={showSingles}
            className="flex min-h-10 w-full items-center justify-between gap-4 border-b-2 border-rule-ink pb-1 text-left font-medium transition-colors hover:text-accent"
          >
            <span>On one store only ({singles.length})</span>
            <span className="text-sm text-muted">{showSingles ? 'Hide' : 'Show'}</span>
          </button>

          {showSingles && (
            <ul className="m-0 flex list-none flex-col p-0">
              {singles.map((product, i) => {
                const only = product.platforms[0]
                return (
                  <li
                    key={`${product.normalized_name}-${only?.platform ?? i}`}
                    className="flex items-center gap-4 border-b border-rule py-3"
                  >
                    {only?.image_url ? (
                      <img
                        src={only.image_url}
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
                        className="size-10 shrink-0 bg-plate object-contain p-0.5"
                      />
                    ) : (
                      <span className="size-10 shrink-0 bg-paper-2" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2">{product.normalized_name}</span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {product.quantity}
                        <span className="sm:hidden">
                          {product.quantity && ', '}
                          {PLATFORM_INFO[only.platform]?.short ?? only.platform}
                        </span>
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-sm text-ink-2 sm:inline">
                      {PLATFORM_INFO[only.platform]?.short ?? only.platform}
                    </span>
                    <span className="hidden w-14 shrink-0 text-right text-sm text-muted sm:inline">
                      {formatEta(only.eta)}
                    </span>
                    {isSafeUrl(only.product_url) ? (
                      <a
                        href={only.product_url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="figure w-16 shrink-0 text-right text-lg text-ink underline decoration-muted decoration-1 underline-offset-4 transition-colors hover:decoration-accent"
                      >
                        {formatAmount(only.price)}
                      </a>
                    ) : (
                      <span className="figure w-16 shrink-0 text-right text-lg text-ink">
                        {formatAmount(only.price)}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
