import { useState, useCallback } from 'react'

export interface PlatformProduct {
  platform: string
  name: string
  price: number
  mrp?: number | null
  quantity?: string | null
  in_stock: boolean
  product_url?: string | null
  image_url?: string | null
  eta?: string | null
}

export interface GroupedProduct {
  normalized_name: string
  brand?: string | null
  quantity?: string | null
  cheapest_price: number
  cheapest_platform: string
  platforms: PlatformProduct[]
}

export interface SearchResponse {
  query: string
  pin: string
  total_groups: number
  cached: boolean
  results: GroupedProduct[]
}

export function useSearch() {
  const [results, setResults] = useState<GroupedProduct[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isCached, setIsCached] = useState<boolean>(false)
  const [lastQuery, setLastQuery] = useState<string>('')

  const executeSearch = useCallback(
    async (query: string, pin: string, platforms?: string[]) => {
      if (!query.trim()) return

      setLoading(true)
      setError(null)
      setLastQuery(query)

      try {
        const response = await fetch('/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query.trim(),
            pin: pin.trim(),
            platforms: platforms && platforms.length > 0 ? platforms : undefined,
          }),
        })

        if (!response.ok) {
          throw new Error(`Search failed with status: ${response.status}`)
        }

        const data: SearchResponse = await response.json()
        setResults(data.results || [])
        setIsCached(data.cached || false)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to perform search'
        setError(message)
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return {
    results,
    loading,
    error,
    isCached,
    lastQuery,
    executeSearch,
    setResults,
  }
}
