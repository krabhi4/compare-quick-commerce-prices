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
import { useHistory, type PriceHistoryItem } from '../hooks/useHistory'
import { formatPrice, formatAmount, formatDate } from '../utils/format'
import { PLATFORM_INFO, PLATFORM_ORDER } from '../utils/normalize'

const DASHES = ['0', '6 3', '2 3', '9 3 2 3', '4 2']
const SERIES = [1, 2, 3, 4, 5].map((n) => `var(--color-series-${n})`)

const INK = 'var(--color-ink)'
const MUTED = 'var(--color-muted)'
const RULE = 'var(--color-rule)'
const PAPER = 'var(--color-paper)'
const TICK = { fontSize: 12, fill: MUTED, fontFamily: 'var(--font-outlier)' }

export const PriceChart: React.FC<{ productName: string }> = ({ productName }) => {
  const { history, loading, error } = useHistory(productName)

  if (loading) {
    return <p className="label py-6">Reading snapshots…</p>
  }

  if (error) {
    return <p className="py-6 text-error">{error}</p>
  }

  const safeHistory = Array.isArray(history) ? history : []
  if (safeHistory.length === 0) {
    return <p className="py-6 text-muted">This item has no snapshots yet.</p>
  }

  const rows: Record<string, Record<string, number | string>> = {}
  safeHistory.forEach((item: PriceHistoryItem) => {
    const key = formatDate(item.scraped_at)
    rows[key] ??= { time: key }
    rows[key][item.platform] = item.price
  })
  const data = Object.values(rows).reverse()

  const seen = PLATFORM_ORDER.filter((p) => safeHistory.some((h) => h.platform === p))
  const prices = safeHistory.map((h) => h.price).filter((p) => Number.isFinite(p))

  const stats: [string, number][] = [
    ['Low', prices.reduce((a, c) => Math.min(a, c), prices[0] ?? 0)],
    ['Mean', prices.length > 0 ? Math.round(prices.reduce((a, c) => a + c, 0) / prices.length) : 0],
    ['High', prices.reduce((a, c) => Math.max(a, c), prices[0] ?? 0)],
  ]

  return (
    <div className="flex flex-col gap-4 py-5">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        {stats.map(([label, value], i) => (
          <span key={label} className="flex items-baseline gap-2">
            <span className="label">{label}</span>
            <span className={`figure text-lg text-ink ${i === 0 ? 'font-medium' : ''}`}>
              {formatAmount(value)}
            </span>
          </span>
        ))}
        <span className="ml-auto text-sm text-muted">
          {history.length} {history.length === 1 ? 'snapshot' : 'snapshots'}
        </span>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={RULE} vertical={false} />
            <XAxis
              dataKey="time"
              stroke={MUTED}
              tick={TICK}
              tickLine={false}
              axisLine={{ stroke: RULE }}
              padding={{ left: 56, right: 56 }}
            />
            <YAxis
              stroke={MUTED}
              tick={TICK}
              tickFormatter={(v) => `${v}`}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: PAPER,
                border: `1px solid ${INK}`,
                borderRadius: 0,
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                color: INK,
              }}
              formatter={(value: unknown) => {
                const num = Number(value)
                return Number.isFinite(num) ? formatPrice(num) : '—'
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 14, paddingTop: 8 }}
              iconType="plainline"
              formatter={(value) => <span style={{ color: INK }}>{value}</span>}
            />
            {seen.map((platform, i) => (
              <Line
                key={platform}
                type="linear"
                dataKey={platform}
                name={PLATFORM_INFO[platform]?.name ?? platform}
                stroke={SERIES[i % SERIES.length]}
                strokeWidth={2}
                strokeDasharray={DASHES[i % DASHES.length]}
                dot={false}
                activeDot={{ r: 3, fill: INK, stroke: 'none' }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
