import React from 'react'
import { Zap, Sparkles, ShoppingBag, Package, Store, ExternalLink } from 'lucide-react'
import { getPlatformMeta } from '../utils/normalize'
import { formatPrice } from '../utils/format'

interface PlatformBadgeProps {
  platform: string
  price: number
  mrp?: number | null
  inStock: boolean
  isCheapest?: boolean
  eta?: string | null
  productUrl?: string | null
}

export const PlatformBadge: React.FC<PlatformBadgeProps> = ({
  platform,
  price,
  mrp,
  inStock,
  isCheapest,
  eta,
  productUrl,
}) => {
  const meta = getPlatformMeta(platform)

  const renderIcon = () => {
    switch (platform.toLowerCase()) {
      case 'blinkit':
        return <Zap className="w-3.5 h-3.5 text-amber-400" />
      case 'zepto':
        return <Sparkles className="w-3.5 h-3.5 text-pink-400" />
      case 'instamart':
        return <ShoppingBag className="w-3.5 h-3.5 text-orange-400" />
      case 'flipkart':
        return <Package className="w-3.5 h-3.5 text-blue-400" />
      case 'bigbasket':
        return <Store className="w-3.5 h-3.5 text-red-400" />
      default:
        return <Store className="w-3.5 h-3.5 text-slate-400" />
    }
  }

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
        isCheapest
          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-sm shadow-emerald-900/20'
          : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
      } ${!inStock ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-slate-800/80 flex items-center justify-center">
          {renderIcon()}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-200">{meta.name}</span>
            {isCheapest && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 uppercase tracking-wider">
                Lowest
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            {eta && <span>{eta}</span>}
            {!inStock && <span className="text-rose-400 font-medium">Out of stock</span>}
          </div>
        </div>
      </div>

      <div className="text-right flex items-center gap-3">
        <div>
          <div className="flex items-baseline justify-end gap-1.5">
            <span className={`text-base font-bold ${isCheapest ? 'text-emerald-400' : 'text-slate-100'}`}>
              {formatPrice(price)}
            </span>
            {mrp && mrp > price && (
              <span className="text-xs text-slate-500 line-through">
                {formatPrice(mrp)}
              </span>
            )}
          </div>
        </div>

        {productUrl && (
          <a
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title={`Open on ${meta.name}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}
