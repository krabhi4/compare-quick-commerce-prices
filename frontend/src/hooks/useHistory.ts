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

  const fetchHistory = useCallback(async (name: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/history?name=${encodeURIComponent(name)}`)
      if (!response.ok) {
        throw new Error(`History fetch failed with status: ${response.status}`)
      }
      const data: PriceHistoryResponse = await response.json()
      setHistory(data.history || [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch price history'
      setError(message)
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (productName) {
      fetchHistory(productName)
    } else {
      setHistory([])
    }
  }, [productName, fetchHistory])

  return {
    history,
    loading,
    error,
    refetch: () => productName && fetchHistory(productName),
  }
}
