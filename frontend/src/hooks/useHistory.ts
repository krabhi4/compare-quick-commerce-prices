import { useState, useEffect, useCallback } from 'react'

export interface PriceHistoryItem {
  scraped_at: string
  platform: string
  product_name: string
  price: number
  mrp?: number | null
  in_stock: boolean
  pin: string
  logged_in: boolean
}

export interface PriceHistoryResponse {
  normalized_name: string
  history: PriceHistoryItem[]
}

export function useHistory(productName: string | null) {
  const [history, setHistory] = useState<PriceHistoryItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async (name: string, signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/history?name=${encodeURIComponent(name)}`, { signal })
      if (!response.ok) {
        throw new Error(`Could not load the price history (${response.status})`)
      }
      const data: PriceHistoryResponse = await response.json()
      setHistory(data.history || [])
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      const message = err instanceof Error ? err.message : 'Could not load the price history'
      setError(message)
      setHistory([])
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!productName) {
      setHistory([])
      return
    }
    const controller = new AbortController()
    fetchHistory(productName, controller.signal)
    return () => {
      controller.abort()
    }
  }, [productName, fetchHistory])

  return {
    history,
    loading,
    error,
    refetch: () => productName && fetchHistory(productName),
  }
}
