import React, { useState, useMemo } from 'react'
import { ArrowUpDown, ShoppingBag, Sparkles, Filter } from 'lucide-react'
import type { GroupedProduct } from '../hooks/useSearch'
import { ProductCard } from '../components/ProductCard'

interface ResultsPageProps {
  results: GroupedProduct[]
  loading: boolean
  isCached: boolean
  lastQuery: string
  onViewHistory: (normalizedName: string) => void
  onSetAlert: (productName: string, currentPrice: number) => void
}

type SortOption = 'cheapest' | 'savings' | 'stores'

export const ResultsPage: React.FC<ResultsPageProps> = ({
  results,
  loading,
  isCached,
  lastQuery,
  onViewHistory,
  onSetAlert,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('cheapest')
  const [filterPlatform, setFilterPlatform] = useState<string>('all')

  const availablePlatforms = useMemo(() => {
    const set = new Set<string>()
    results.forEach((r) => r.platforms.forEach((p) => set.add(p.platform)))
    return Array.from(set)
  }, [results])

  const filteredAndSortedResults = useMemo(() => {
    let list = [...results]

    if (filterPlatform !== 'all') {
      list = list.filter((item) =>
        item.platforms.some((p) => p.platform.toLowerCase() === filterPlatform.toLowerCase())
      )
    }

    if (sortBy === 'cheapest') {
      list.sort((a, b) => a.cheapest_price - b.cheapest_price)
    } else if (sortBy === 'savings') {
      list.sort((a, b) => {
        const savingsA =
          Math.max(...a.platforms.map((p) => p.price)) - Math.min(...a.platforms.map((p) => p.price))
        const savingsB =
          Math.max(...b.platforms.map((p) => p.price)) - Math.min(...b.platforms.map((p) => p.price))
        return savingsB - savingsA
      })
    } else if (sortBy === 'stores') {
      list.sort((a, b) => b.platforms.length - a.platforms.length)
    }

    return list
  }, [results, sortBy, filterPlatform])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <ShoppingBag className="w-5 h-5 text-emerald-400 absolute" />
        </div>
        <h3 className="text-base font-bold text-slate-200">
          Comparing prices across Blinkit, Zepto, Instamart & more...
        </h3>
        <p className="text-xs text-slate-500 mt-1">Scanning quick-commerce catalogs concurrently</p>
      </div>
    )
  }

  if (results.length === 0 && lastQuery) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center max-w-xl mx-auto">
        <ShoppingBag className="w-12 h-12 text-slate-600 mb-3" />
        <h3 className="text-base font-bold text-slate-300">No products found for "{lastQuery}"</h3>
        <p className="text-xs text-slate-500 mt-1">
          Try searching with broader terms like "Milk", "Bread", "Eggs", or check your delivery PIN code.
        </p>
      </div>
    )
  }

  if (results.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-200">
            {filteredAndSortedResults.length} {filteredAndSortedResults.length === 1 ? 'Product' : 'Products'} found
          </span>
          {isCached && (
            <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Cached
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {availablePlatforms.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500 capitalize"
              >
                <option value="all">All Platforms</option>
                {availablePlatforms.map((plat) => (
                  <option key={plat} value={plat}>
                    {plat}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
            >
              <option value="cheapest">Lowest Price</option>
              <option value="savings">Max Savings</option>
              <option value="stores">Most Store Options</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedResults.map((product) => (
          <ProductCard
            key={product.normalized_name}
            product={product}
            onViewHistory={onViewHistory}
            onSetAlert={onSetAlert}
          />
        ))}
      </div>
    </div>
  )
}
