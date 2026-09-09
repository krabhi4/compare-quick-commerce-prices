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

const DASHES = ['0', '5 3', '1 3', '9 3 2 3', '6 2 1 2']

const INK = 'oklch(24% 0.022 255)'
const INK_2 = 'oklch(46% 0.018 255)'
const INK_3 = 'oklch(64% 0.014 255)'
const RULE = 'oklch(87% 0.010 150)'
const PANEL = 'oklch(97.8% 0.005 150)'

export const PriceChart: React.FC<{ productName: string }> = ({ productName }) => {
  const { history, loading, error } = useHistory(productName)

  const rows: Record<string, Record<string, number | string>> = {}
  history.forEach((item: PriceHistoryItem) => {
    const key = formatDate(item.scraped_at)
    rows[key] ??= { time: key }
    rows[key][item.platform] = item.price
  })
  const data = Object.values(rows).reverse()

  const seen = PLATFORM_ORDER.filter((p) => history.some((h) => h.platform === p))
  const prices = history.map((h) => h.price)

  if (loading) {
    return <p className="tag px-1 py-6 text-ink-3">reading snapshots…</p>
  }

  if (error) {
    return <p className="tag px-1 py-6 text-mark">{error}</p>
  }

  if (history.length === 0) {
    return (
      <p className="px-1 py-6 text-label text-ink-2">This item has no snapshots yet.</p>
    )
  }

  const stats: [string, number][] = [
    ['low', Math.min(...prices)],
    ['mean', Math.round(prices.reduce((a, c) => a + c, 0) / prices.length)],
    ['high', Math.max(...prices)],
  ]

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        {stats.map(([label, value], i) => (
          <span key={label} className="flex items-baseline gap-2">
            <span className="tag text-ink-3">{label}</span>
            <span className={`rate text-lead ${i === 0 ? 'text-mark' : 'text-ink'}`}>
              {formatAmount(value)}
            </span>
          </span>
        ))}
        <span className="tag ml-auto text-ink-3">{history.length} snapshots</span>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid stroke={RULE} vertical={false} />
            <XAxis
              dataKey="time"
              stroke={INK_3}
              tick={{ fontSize: 11, fill: INK_2 }}
              tickLine={false}
              axisLine={{ stroke: INK }}
            />
            <YAxis
              stroke={INK_3}
              tick={{ fontSize: 11, fill: INK_2 }}
              tickFormatter={(v) => `${v}`}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: PANEL,
                border: `1px solid ${INK}`,
                borderRadius: 0,
                fontSize: 12,
                color: INK,
              }}
              formatter={(value: unknown) => formatPrice(Number(value))}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8, color: INK_2 }}
              iconType="plainline"
            />
            {seen.map((platform, i) => (
              <Line
                key={platform}
                type="linear"
                dataKey={platform}
                name={PLATFORM_INFO[platform]?.name ?? platform}
                stroke={i === 0 ? INK : INK_2}
                strokeWidth={i === 0 ? 2 : 1.5}
                strokeDasharray={DASHES[i % DASHES.length]}
                dot={false}
                activeDot={{ r: 3, fill: 'oklch(52% 0.19 32)', stroke: 'none' }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
