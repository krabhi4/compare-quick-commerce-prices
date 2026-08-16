import { useState, useEffect, useCallback } from 'react'

export interface AuthStatusResponse {
  identities: Record<string, string | null>
}

export function useAuth() {
  const [identities, setIdentities] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState<boolean>(false)
  const [loggingInPlatform, setLoggingInPlatform] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAuthStatus = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/auth/status')
      if (response.ok) {
        const data: AuthStatusResponse = await response.json()
        setIdentities(data.identities || {})
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch auth status'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const login = async (platform: string): Promise<boolean> => {
    setLoggingInPlatform(platform)
    setError(null)
    try {
      const response = await fetch(`/auth/login/${platform}`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error(`Login failed for ${platform}`)
      }
      await fetchAuthStatus()
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Error logging into ${platform}`
      setError(message)
      return false
    } finally {
      setLoggingInPlatform(null)
    }
  }

  const logout = async (platform: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/auth/logout/${platform}`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error(`Logout failed for ${platform}`)
      }
      await fetchAuthStatus()
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Error logging out of ${platform}`
      setError(message)
      return false
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAuthStatus()
  }, [fetchAuthStatus])

  return {
    identities,
    loading,
    loggingInPlatform,
    error,
    fetchAuthStatus,
    login,
    logout,
  }
}
