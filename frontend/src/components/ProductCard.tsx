import React, { useState } from 'react'
import { TrendingDown, LineChart, Bell, Package, ChevronDown, ChevronUp } from 'lucide-react'
import type { GroupedProduct } from '../hooks/useSearch'
import { PlatformBadge } from './PlatformBadge'
import { formatPrice, calculateSavings } from '../utils/format'

interface ProductCardProps {
  product: GroupedProduct
  onViewHistory: (normalizedName: string) => void
  onSetAlert: (productName: string, currentPrice: number) => void
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onViewHistory,
  onSetAlert,
}) => {
  const [expanded, setExpanded] = useState(false)
  const [imgError, setImgError] = useState(false)

  const prices = product.platforms.map((p) => p.price)
  const { savings, savingsPercent } = calculateSavings(prices)
  const primaryImage = product.platforms.find((p) => p.image_url)?.image_url

  const sortedPlatforms = [...product.platforms].sort((a, b) => a.price - b.price)

  return (
    <div className="flex flex-col bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition-all shadow-lg hover:shadow-xl backdrop-blur-xs">
      <div className="flex gap-4">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center overflow-hidden shrink-0">
          {primaryImage && !imgError ? (
            <img
              src={primaryImage}
              alt={product.normalized_name}
              onError={() => setImgError(true)}
              className="w-full h-full object-contain p-1.5"
            />
          ) : (
            <Package className="w-8 h-8 text-slate-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {product.brand && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 uppercase tracking-wide">
                {product.brand}
              </span>
            )}
            {product.quantity && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400">
                {product.quantity}
              </span>
            )}
          </div>

          <h3 className="text-sm sm:text-base font-bold text-slate-100 line-clamp-2 leading-snug">
            {product.normalized_name}
          </h3>

          <div className="flex flex-wrap items-baseline gap-2 mt-2">
            <span className="text-xs text-slate-400">From</span>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-400">
              {formatPrice(product.cheapest_price)}
            </span>
            <span className="text-xs text-slate-400">
              on <span className="font-semibold text-slate-200 capitalize">{product.cheapest_platform}</span>
            </span>

            {savings > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full ml-auto">
                <TrendingDown className="w-3 h-3" />
                Save {formatPrice(savings)} ({savingsPercent}%)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">
            Available on {product.platforms.length} {product.platforms.length === 1 ? 'store' : 'stores'}:
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onViewHistory(product.normalized_name)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-slate-100 transition-colors"
              title="Price Trends & History"
            >
              <LineChart className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Trends</span>
            </button>

            <button
              type="button"
              onClick={() => onSetAlert(product.normalized_name, product.cheapest_price)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-slate-100 transition-colors"
              title="Set Price Drop Alert"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Alert</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          {sortedPlatforms.slice(0, expanded ? undefined : 3).map((plat) => (
            <PlatformBadge
              key={plat.platform}
              platform={plat.platform}
              price={plat.price}
              mrp={plat.mrp}
              inStock={plat.in_stock}
              isCheapest={plat.platform === product.cheapest_platform}
              eta={plat.eta}
              productUrl={plat.product_url}
            />
          ))}
        </div>

        {sortedPlatforms.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            {expanded ? (
              <>
                <span>Show less</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>+{sortedPlatforms.length - 3} more stores</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
