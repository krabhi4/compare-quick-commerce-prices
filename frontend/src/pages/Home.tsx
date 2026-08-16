import React from 'react'
import { Sparkles, TrendingDown, Clock, Shield, ArrowRight, Zap, ShoppingBag, Package, Store } from 'lucide-react'

interface HomePageProps {
  onQuickSearch: (query: string) => void
}

const POPULAR_CATEGORIES = [
  { name: 'Dairy & Bread', query: 'Milk', icon: ShoppingBag, color: 'text-amber-400 bg-amber-400/10' },
  { name: 'Snacks & Drinks', query: 'Coke', icon: Zap, color: 'text-rose-400 bg-rose-400/10' },
  { name: 'Breakfast & Eggs', query: 'Eggs', icon: Package, color: 'text-emerald-400 bg-emerald-400/10' },
  { name: 'Kitchen Staples', query: 'Atta', icon: Store, color: 'text-blue-400 bg-blue-400/10' },
]

export const HomePage: React.FC<HomePageProps> = ({ onQuickSearch }) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center max-w-4xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-xs font-semibold text-emerald-400 mb-6">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Real-Time Quick-Commerce Arbitrage</span>
      </div>

      <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-100 tracking-tight leading-tight">
        Stop overpaying for groceries on 10-minute delivery apps.
      </h1>

      <p className="text-sm sm:text-base text-slate-400 mt-4 max-w-2xl leading-relaxed">
        Compare prices simultaneously across Blinkit, Zepto, Swiggy Instamart, Flipkart Minutes, and BigBasket to find the lowest price and save on every order.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mt-8">
        {POPULAR_CATEGORIES.map((cat) => {
          const Icon = cat.icon
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => onQuickSearch(cat.query)}
              className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 flex flex-col items-center text-center gap-2 transition-all hover:scale-[1.02] group"
            >
              <div className={`p-2.5 rounded-xl ${cat.color} transition-colors`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">
                {cat.name}
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <span>Compare</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-10 text-left">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="p-2 w-fit rounded-xl bg-emerald-500/10 text-emerald-400 mb-3">
            <TrendingDown className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-200 text-sm">Save 15-30%</h3>
          <p className="text-xs text-slate-400 mt-1">
            Identical products vary wildly across platforms due to dynamic surge and algorithms.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="p-2 w-fit rounded-xl bg-amber-500/10 text-amber-400 mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-200 text-sm">Real-Time Search</h3>
          <p className="text-xs text-slate-400 mt-1">
            Concurrent scrapers query all catalogs at once with zero stale cache delays.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="p-2 w-fit rounded-xl bg-blue-500/10 text-blue-400 mb-3">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-200 text-sm">100% Private</h3>
          <p className="text-xs text-slate-400 mt-1">
            Self-hosted on your Raspberry Pi. No telemetry, third-party analytics, or cloud trackers.
          </p>
        </div>
      </div>
    </div>
  )
}
