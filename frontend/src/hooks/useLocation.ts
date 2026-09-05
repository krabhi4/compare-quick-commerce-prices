import { useState, useEffect, useCallback } from 'react'

export interface LocationData {
  pin: string
  lat: number
  lon: number
}

export function useLocation() {
  const [location, setLocation] = useState<LocationData>({
    pin: '110001',
    lat: 28.6294,
    lon: 77.2189,
  })
  const [detecting, setDetecting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLocation = useCallback(async () => {
    try {
      const response = await fetch('/location')
      if (response.ok) {
        const data: LocationData = await response.json()
        setLocation(data)
      }
    } catch {
      const savedPin = localStorage.getItem('qc_pincode')
      if (savedPin) {
        setLocation((prev) => ({ ...prev, pin: savedPin }))
      }
    }
  }, [])

  const updateLocation = async (pin?: string, lat?: number, lon?: number): Promise<string | null> => {
    setError(null)
    try {
      const response = await fetch('/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, lat, lon }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.detail || `Could not set location (${response.status})`)
        return null
      }
      const data: LocationData = await response.json()
      setLocation(data)
      localStorage.setItem('qc_pincode', data.pin)
      return data.pin
    } catch {
      setError('Could not reach the server to set location')
      return null
    }
  }

  const detectLocation = () => {
    if (!navigator.geolocation) return

    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await updateLocation(undefined, pos.coords.latitude, pos.coords.longitude)
        setDetecting(false)
      },
      () => {
        setError('Location permission denied')
        setDetecting(false)
      }
    )
  }

  useEffect(() => {
    fetchLocation()
  }, [fetchLocation])

  return {
    location,
    detecting,
    error,
    updateLocation,
    detectLocation,
  }
}
