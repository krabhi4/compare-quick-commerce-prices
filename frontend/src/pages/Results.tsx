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
  { id: 'savings', label: 'biggest gap' },
  { id: 'cheapest', label: 'lowest price' },
  { id: 'stores', label: 'most stores' },
]

const GRID =
  'grid grid-cols-[repeat(6,minmax(0,1fr))] md:grid-cols-[minmax(13rem,1.7fr)_repeat(5,minmax(3.25rem,1fr))_minmax(3.5rem,0.6fr)]'

const spread = (p: GroupedProduct) => {
  const prices = p.platforms.map((x) => x.price)
  return Math.max(...prices) - Math.min(...prices)
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
  const [openTrend, setOpenTrend] = useState<number | null>(null)
  const [showSingles, setShowSingles] = useState(false)

  const { compared, singles } = useMemo(() => {
    const multi = results.filter((r) => r.platforms.length > 1)
    if (sortBy === 'cheapest') multi.sort((a, b) => a.cheapest_price - b.cheapest_price)
    if (sortBy === 'savings') multi.sort((a, b) => spread(b) - spread(a))
    if (sortBy === 'stores') multi.sort((a, b) => b.platforms.length - a.platforms.length)
    const one = results
      .filter((r) => r.platforms.length === 1)
      .sort((a, b) => a.cheapest_price - b.cheapest_price)
    return { compared: multi, singles: one }
  }, [results, sortBy])

  if (loading) {
    return (
      <section className="border-t-2 border-ink pt-4">
        <p className="tag text-ink-2">
          reading {PLATFORM_ORDER.length} stores<span className="text-mark">…</span>
        </p>
        <div className="mt-6 flex flex-col gap-px">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rise h-16 bg-sunk"
              style={{ animationDelay: `${i * 60}ms`, opacity: 1 - i * 0.15 }}
            />
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="border-t-2 border-mark pt-4">
        <p className="tag text-mark">search failed</p>
        <p className="mt-2 text-body">{error}</p>
      </section>
    )
  }

  if (results.length === 0) {
    if (!lastQuery) return null
    return (
      <section className="border-t-2 border-ink pt-4">
        <p className="tag text-ink-2">no rows</p>
        <p className="mt-2 board text-lead [font-stretch:92%]">
          No store returned anything for {lastQuery} at this pincode.
        </p>
        <p className="mt-1 text-label text-ink-2">Try a shorter term, or check the pincode.</p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-8">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pb-2">
          <h2 className="board text-label [font-stretch:88%] font-semibold">
            {compared.length > 0
              ? `${compared.length} ${compared.length === 1 ? 'item is' : 'items are'} on more than one store`
              : `${results.length} ${results.length === 1 ? 'match' : 'matches'} for ${lastQuery}`}
            {isCached && <span className="tag ml-3 font-normal text-ink-3">from cache</span>}
          </h2>

          {compared.length > 1 && (
            <div className="flex items-baseline gap-3">
              <span className="tag text-ink-3">sort</span>
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSortBy(s.id)}
                  aria-pressed={sortBy === s.id}
                  className={`tag transition-colors ${
                    sortBy === s.id
                      ? 'text-mark underline decoration-mark decoration-2 underline-offset-4'
                      : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {compared.length === 0 ? (
          <p className="border-t-2 border-ink pt-3 text-label text-ink-2">
            Each of the {singles.length} matches is on only one store, so there is nothing to
            compare.
          </p>
        ) : (
          <div className={GRID}>
            <div className="col-span-full hidden grid-cols-subgrid border-b-2 border-ink pb-1.5 md:grid">
              <span className="tag text-ink-2">item</span>
              {PLATFORM_ORDER.map((key) => (
                <span key={key} className="tag text-right text-ink-2">
                  {PLATFORM_INFO[key].short}
                </span>
              ))}
              <span className="tag text-right text-ink-2">save</span>
            </div>

            {compared.map((product, i) => (
              <React.Fragment key={`${product.normalized_name}-${i}`}>
                <PriceRow
                  product={product}
                  index={i}
                  expanded={openTrend === i}
                  onToggleHistory={() => setOpenTrend((cur) => (cur === i ? null : i))}
                  onSetAlert={onSetAlert}
                />
                {openTrend === i && (
                  <div className="col-span-full border-t border-dashed border-rule-strong bg-panel px-1">
                    <PriceChart productName={product.normalized_name} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

      </div>

      {singles.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowSingles((v) => !v)}
            aria-expanded={showSingles}
            className="tag flex w-full items-baseline justify-between border-b border-rule pb-1.5 text-ink-2 transition-colors hover:text-mark"
          >
            <span>on one store only · {singles.length}</span>
            <span className="text-ink-3">{showSingles ? 'hide' : 'show'}</span>
          </button>

          {showSingles && (
            <ul className="flex flex-col">
              {singles.map((product, i) => {
                const only = product.platforms[0]
                return (
                  <li
                    key={`${product.normalized_name}-single-${i}`}
                    className="flex items-baseline gap-4 border-b border-rule py-2"
                  >
                    <span className="board min-w-0 flex-1 truncate text-label [font-stretch:92%]">
                      {product.normalized_name}
                      {product.quantity && (
                        <span className="ml-2 text-micro text-ink-2">{product.quantity}</span>
                      )}
                    </span>
                    <span className="tag shrink-0 text-ink-2">
                      {PLATFORM_INFO[only.platform]?.short ?? only.platform}
                    </span>
                    <span className="tag hidden shrink-0 text-ink-3 sm:inline">
                      {formatEta(only.eta)}
                    </span>
                    {only.product_url ? (
                      <a
                        href={only.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rate w-14 shrink-0 text-right text-label text-ink transition-colors hover:text-mark"
                      >
                        {formatAmount(only.price)}
                      </a>
                    ) : (
                      <span className="rate w-14 shrink-0 text-right text-label text-ink">
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
