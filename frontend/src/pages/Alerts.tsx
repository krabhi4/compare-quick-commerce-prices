import React, { useState } from 'react'
import { Bell, Plus, Trash2, Loader2, Clock } from 'lucide-react'
import { useAlerts } from '../hooks/useAlerts'
import { formatPrice, formatDate } from '../utils/format'
import { PLATFORM_INFO } from '../utils/normalize'

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
  const [showAddForm, setShowAddForm] = useState(Boolean(initialQuery))
  const [query, setQuery] = useState(initialQuery)
  const [targetPrice, setTargetPrice] = useState(
    initialPrice ? Math.floor(initialPrice * 0.9).toString() : ''
  )
  const [pin, setPin] = useState(currentPin)
  const [platform, setPlatform] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || !targetPrice) return

    setSubmitting(true)
    const success = await addAlert(
      query.trim(),
      parseFloat(targetPrice),
      pin.trim() || currentPin,
      platform || undefined
    )
    setSubmitting(false)

    if (success) {
      setShowAddForm(false)
      setQuery('')
      setTargetPrice('')
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-amber-400" />
            <span>Price Drop Alerts</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Get alerted whenever your frequently bought groceries drop below your target price.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-950"
        >
          <Plus className="w-4 h-4" />
          <span>New Alert</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4 animate-in fade-in slide-in-from-top-2"
        >
          <h3 className="font-bold text-slate-200 text-base">Create Price Alert</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Product or Search Keyword
              </label>
              <input
                type="text"
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Amul Taaza Milk 500ml"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Target Price (₹)
              </label>
              <input
                type="number"
                required
                min={1}
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="e.g. 25"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Delivery PIN
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="110001"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Specific Platform (Optional)
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="">Any Platform</option>
                {Object.keys(PLATFORM_INFO).map((plat) => (
                  <option key={plat} value={plat}>
                    {PLATFORM_INFO[plat].name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save Alert</span>
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
          <p className="text-sm">Loading active alerts...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <Bell className="w-12 h-12 text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-slate-300">No active price alerts</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Set an alert on your favorite grocery staples to get notified when the price drops across Blinkit, Zepto, Instamart, and more.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.map((alert) => {
            const platformMeta = alert.platform ? PLATFORM_INFO[alert.platform] : null

            return (
              <div
                key={alert.id}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-slate-100 text-base line-clamp-1">
                      {alert.product_query}
                    </h4>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full shrink-0">
                      ≤ {formatPrice(alert.target_price)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-400">
                    <span className="bg-slate-800 px-2 py-0.5 rounded font-mono">
                      PIN: {alert.pin}
                    </span>
                    {platformMeta ? (
                      <span className={`px-2 py-0.5 rounded font-semibold ${platformMeta.textColor} ${platformMeta.bgColor}`}>
                        {platformMeta.name}
                      </span>
                    ) : (
                      <span className="bg-slate-800 px-2 py-0.5 rounded">All Stores</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {alert.last_checked ? `Checked ${formatDate(alert.last_checked)}` : 'Pending check'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeAlert(alert.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                    title="Delete Alert"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
