import { useState, useCallback, useRef } from 'react'

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
  const abortRef = useRef<AbortController | null>(null)

  const executeSearch = useCallback(
    async (query: string, pin: string, platforms?: string[], lat?: number, lon?: number) => {
      if (!query.trim()) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

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
            lat: lat,
            lon: lon,
            platforms: platforms && platforms.length > 0 ? platforms : undefined,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          let serverMessage = ''
          try {
            const errBody = await response.json()
            serverMessage = typeof errBody?.detail === 'string' ? errBody.detail : ''
          } catch {
            serverMessage = ''
          }
          throw new Error(
            serverMessage
              ? `The search failed: ${serverMessage}`
              : `The search failed (${response.status})`
          )
        }

        const data: SearchResponse = await response.json()
        setResults(data.results || [])
        setIsCached(data.cached || false)
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        const message = err instanceof Error ? err.message : 'Could not reach the server to search'
        setError(message)
        setResults([])
      } finally {
        if (abortRef.current === controller) {
          setLoading(false)
        }
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
  }
}
