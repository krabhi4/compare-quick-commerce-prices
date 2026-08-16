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

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/alerts')
      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.status}`)
      }
      const data: Alert[] = await response.json()
      setAlerts(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch alerts'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const addAlert = async (
    product_query: string,
    target_price: number,
    pin: string,
    platform?: string
  ): Promise<boolean> => {
    try {
      const response = await fetch('/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_query,
          target_price,
          pin,
          platform: platform || undefined,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to create alert')
      }
      await fetchAlerts()
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error creating alert'
      setError(message)
      return false
    }
  }

  const removeAlert = async (alertId: number): Promise<boolean> => {
    try {
      const response = await fetch(`/alerts/${alertId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete alert')
      }
      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error deleting alert'
      setError(message)
      return false
    }
  }

  useEffect(() => {
    fetchAlerts()
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
