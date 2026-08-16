import { useState, useEffect, useCallback } from 'react'

export interface LocationData {
  pin: string
  lat: number
  lon: number
}

export function useLocation() {
  const [location, setLocation] = useState<LocationData>({
    pin: '110001',
    lat: 28.46,
    lon: 77.06,
  })
  const [detecting, setDetecting] = useState<boolean>(false)

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

  const updateLocation = async (pin: string, lat?: number, lon?: number) => {
    try {
      const response = await fetch('/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, lat, lon }),
      })
      if (response.ok) {
        const data: LocationData = await response.json()
        setLocation(data)
        localStorage.setItem('qc_pincode', pin)
      }
    } catch {
      setLocation((prev) => ({ ...prev, pin }))
      localStorage.setItem('qc_pincode', pin)
    }
  }

  const detectLocation = () => {
    if (!navigator.geolocation) return

    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        await updateLocation(location.pin, lat, lon)
        setDetecting(false)
      },
      () => {
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
    updateLocation,
    detectLocation,
  }
}
