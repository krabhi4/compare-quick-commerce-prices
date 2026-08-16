import React, { useState, useEffect, useCallback } from 'react'
import { LineChart, Search, Package, Clock, Loader2, ArrowRight } from 'lucide-react'
import { formatDate } from '../utils/format'
import { PLATFORM_INFO } from '../utils/normalize'

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

interface HistoryPageProps {
  onSelectProduct: (normalizedName: string) => void
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onSelectProduct }) => {
  const [products, setProducts] = useState<TrackedProduct[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const fetchTrackedProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/history/products')
      if (!response.ok) {
        throw new Error('Failed to load tracked products')
      }
      const data = await response.json()
      setProducts(data.products || [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching history'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrackedProducts()
  }, [fetchTrackedProducts])

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.normalized_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const uniqueNormalizedProducts = Array.from(
    new Map(filteredProducts.map((item) => [item.normalized_name, item])).values()
  )

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <LineChart className="w-6 h-6 text-blue-400" />
            <span>Price Tracking History</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Browse tracked grocery items and analyze price fluctuations over time across stores.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter tracked products..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
          <p className="text-sm">Loading price history database...</p>
        </div>
      ) : uniqueNormalizedProducts.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <Package className="w-12 h-12 text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-slate-300">No tracked products found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Search for products like milk, eggs, or butter to begin automatically capturing price history across quick-commerce apps.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {uniqueNormalizedProducts.map((product) => {
            const meta = PLATFORM_INFO[product.platform.toLowerCase()]

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product.normalized_name)}
                className="bg-slate-900/70 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 flex items-center justify-between gap-4 cursor-pointer transition-all hover:shadow-lg group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center overflow-hidden shrink-0">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.normalized_name}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-slate-500" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {product.brand && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {product.brand}
                        </span>
                      )}
                      {meta && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${meta.bgColor} ${meta.textColor}`}>
                          {meta.name}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-100 text-sm line-clamp-1 group-hover:text-blue-400 transition-colors">
                      {product.normalized_name}
                    </h4>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>Updated {formatDate(product.updated_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-800/80 group-hover:bg-blue-500/20 group-hover:text-blue-400 text-slate-400 transition-colors shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
