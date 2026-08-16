import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import { X, Loader2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { useHistory, type PriceHistoryItem } from '../hooks/useHistory'
import { formatPrice, formatDate } from '../utils/format'
import { PLATFORM_INFO } from '../utils/normalize'

interface PriceChartProps {
  productName: string | null
  onClose: () => void
}

export const PriceChart: React.FC<PriceChartProps> = ({ productName, onClose }) => {
  const { history, loading, error } = useHistory(productName)

  if (!productName) return null

  const platformsInHistory = Array.from(new Set(history.map((h) => h.platform)))

  const groupedByTimestamp: Record<string, Record<string, number | string>> = {}
  history.forEach((item: PriceHistoryItem) => {
    const timeKey = formatDate(item.scraped_at)
    if (!groupedByTimestamp[timeKey]) {
      groupedByTimestamp[timeKey] = { time: timeKey }
    }
    groupedByTimestamp[timeKey][item.platform] = item.price
  })

  const chartData = Object.values(groupedByTimestamp).reverse()

  const allPrices = history.map((h) => h.price)
  const minPrice = allPrices.length ? Math.min(...allPrices) : 0
  const maxPrice = allPrices.length ? Math.max(...allPrices) : 0
  const avgPrice = allPrices.length
    ? Math.round(allPrices.reduce((acc, curr) => acc + curr, 0) / allPrices.length)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100 line-clamp-1">
              Price History & Trends
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
              <p className="text-sm font-medium">Fetching historical price data...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-400 text-sm">
              {error}
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <LineChart className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm font-medium text-slate-400">No price history recorded yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Prices will be tracked automatically each time this item is searched.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/50 border border-slate-800 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mb-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Lowest</span>
                  </div>
                  <div className="text-base sm:text-lg font-bold text-slate-100">
                    {formatPrice(minPrice)}
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-800 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Average</span>
                  </div>
                  <div className="text-base sm:text-lg font-bold text-slate-100">
                    {formatPrice(avgPrice)}
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-800 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold mb-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Highest</span>
                  </div>
                  <div className="text-base sm:text-lg font-bold text-slate-100">
                    {formatPrice(maxPrice)}
                  </div>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis
                      dataKey="time"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(val) => `₹${val}`}
                      tickLine={false}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        color: '#f8fafc',
                      }}
                      formatter={(value: unknown) => [formatPrice(Number(value)), 'Price']}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    {platformsInHistory.map((platform) => {
                      const color = PLATFORM_INFO[platform]?.color || '#94a3b8'
                      const name = PLATFORM_INFO[platform]?.name || platform
                      return (
                        <Line
                          key={platform}
                          type="monotone"
                          dataKey={platform}
                          name={name}
                          stroke={color}
                          strokeWidth={2}
                          dot={{ r: 3, fill: color }}
                          activeDot={{ r: 5 }}
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="text-xs text-slate-500 text-center">
                Total {history.length} snapshots recorded for this product
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
