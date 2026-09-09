import React, { useState } from 'react'
import { useAlerts } from '../hooks/useAlerts'
import { formatAmount, formatDate } from '../utils/format'
import { PLATFORM_INFO, PLATFORM_ORDER } from '../utils/normalize'

interface AlertsPageProps {
  currentPin: string
  initialQuery?: string
  initialPrice?: number
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  currentPin,
  initialQuery = '',
  initialPrice,
}) => {
  const { alerts, loading, error, addAlert, removeAlert } = useAlerts()
  const [query, setQuery] = useState(initialQuery)
  const [targetPrice, setTargetPrice] = useState(
    initialPrice ? Math.floor(initialPrice * 0.9).toString() : ''
  )
  const [pin, setPin] = useState(currentPin)
  const [platform, setPlatform] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || !targetPrice) return
    setSubmitting(true)
    const ok = await addAlert(
      query.trim(),
      parseFloat(targetPrice),
      pin.trim() || currentPin,
      platform || undefined
    )
    setSubmitting(false)
    if (ok) {
      setQuery('')
      setTargetPrice('')
    }
  }

  const field =
    'board border-b border-rule-strong bg-transparent pb-1 text-body [font-stretch:96%] outline-none focus:border-ink'

  return (
    <section className="flex flex-col gap-8">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="border-b-2 border-ink pb-2">
          <h2 className="board text-lead [font-stretch:88%] font-semibold">Watch a price</h2>
          <p className="mt-1 text-label text-ink-2">
            The backend rechecks these on its own. It sends no notifications, so check back here.
          </p>
        </div>

        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5">
            <span className="tag text-ink-2">item</span>
            <input
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="amul taaza 500ml"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="tag text-ink-2">under (₹)</span>
            <input
              required
              type="number"
              min={1}
              step="any"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="25"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="tag text-ink-2">pincode</span>
            <input
              required
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className={`${field} tracking-[0.15em]`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="tag text-ink-2">store</span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className={field}
            >
              <option value="">any store</option>
              {PLATFORM_ORDER.map((key) => (
                <option key={key} value={key}>
                  {PLATFORM_INFO[key].name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="tag self-start bg-ink px-4 py-2.5 text-ground transition-colors hover:bg-mark disabled:bg-rule-strong"
        >
          {submitting ? 'saving' : 'start watching'}
        </button>

        {error && <p className="tag text-mark">{error}</p>}
      </form>

      <div>
        <p className="tag border-b border-rule pb-1.5 text-ink-2">
          watching {alerts.length > 0 && `· ${alerts.length}`}
        </p>

        {loading ? (
          <p className="tag pt-3 text-ink-3">reading…</p>
        ) : alerts.length === 0 ? (
          <p className="pt-3 text-label text-ink-2">You are not watching anything yet.</p>
        ) : (
          <ul className="flex flex-col">
            {alerts.map((alert, i) => (
              <li
                key={alert.id}
                className="rise flex items-center gap-4 border-b border-rule py-3"
                style={{ animationDelay: `${Math.min(i, 12) * 24}ms` }}
              >
                <span className="min-w-0 flex-1">
                  <span className="board block truncate text-body [font-stretch:92%] font-semibold">
                    {alert.product_query}
                  </span>
                  <span className="mt-0.5 block text-micro text-ink-2">
                    {alert.platform ? PLATFORM_INFO[alert.platform]?.name : 'any store'} ·{' '}
                    {alert.pin} ·{' '}
                    {alert.last_checked ? `checked ${formatDate(alert.last_checked)}` : 'not yet checked'}
                  </span>
                </span>

                <span className="flex shrink-0 items-baseline gap-1.5">
                  <span className="tag text-ink-3">under</span>
                  <span className="rate text-lead text-ink">{formatAmount(alert.target_price)}</span>
                </span>

                <button
                  type="button"
                  onClick={() => removeAlert(alert.id)}
                  className="tag shrink-0 text-ink-3 transition-colors hover:text-mark"
                >
                  stop
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
