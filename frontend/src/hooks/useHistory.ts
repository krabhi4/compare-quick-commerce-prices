import { useState, useEffect } from 'react'

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

interface HistoryResult {
  name: string
  history: PriceHistoryItem[]
  error: string | null
}

export function useHistory(productName: string) {
  const [result, setResult] = useState<HistoryResult | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/history?name=${encodeURIComponent(productName)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Could not load the price history (${response.status})`)
        }
        const data: PriceHistoryResponse = await response.json()
        setResult({ name: productName, history: data.history || [], error: null })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : 'Could not load the price history'
        setResult({ name: productName, history: [], error: message })
      })
    return () => controller.abort()
  }, [productName])

  const current = result?.name === productName ? result : null
  return {
    history: current?.history ?? [],
    loading: current === null,
    error: current?.error ?? null,
  }
}
