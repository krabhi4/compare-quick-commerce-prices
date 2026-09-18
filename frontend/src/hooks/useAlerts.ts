import { useState, useEffect, useCallback } from 'react'

export interface Alert {
  id: number
  product_query: string
  platform?: string | null
  target_price: number
  pin: string
  active: boolean
  created_at: string
  last_checked?: string | null
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/alerts', { signal })
      if (!response.ok) {
        throw new Error(`Could not load your alerts (${response.status})`)
      }
      const data: Alert[] = await response.json()
      setAlerts(data)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      const message = err instanceof Error ? err.message : 'Could not load your alerts'
      setError(message)
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [])

  const addAlert = async (
    product_query: string,
    target_price: number,
    pin: string,
    platform?: string
  ): Promise<boolean> => {
    const trimmedQuery = product_query.trim()
    const trimmedPin = pin.trim()
    if (!trimmedQuery || !Number.isFinite(target_price) || target_price <= 0 || trimmedPin.length !== 6) {
      setError('Please provide a valid item name, positive price, and 6-digit pincode')
      return false
    }

    try {
      const response = await fetch('/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_query: trimmedQuery,
          target_price,
          pin: trimmedPin,
          platform: platform || undefined,
        }),
      })
      if (!response.ok) {
        throw new Error('Could not save the alert')
      }
      await fetchAlerts()
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save the alert'
      setError(message)
      return false
    }
  }

  const removeAlert = async (alertId: number): Promise<boolean> => {
    const previous = alerts
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    try {
      const response = await fetch(`/alerts/${alertId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Could not delete the alert')
      }
      return true
    } catch (err: unknown) {
      setAlerts(previous)
      const message = err instanceof Error ? err.message : 'Could not delete the alert'
      setError(message)
      return false
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchAlerts(controller.signal)
    return () => {
      controller.abort()
    }
  }, [fetchAlerts])

  return {
    alerts,
    loading,
    error,
    fetchAlerts,
    addAlert,
    removeAlert,
  }
}
