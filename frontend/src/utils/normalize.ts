export interface PlatformMeta {
  id: string
  name: string
  short: string
}

export const PLATFORM_INFO: Record<string, PlatformMeta> = {
  blinkit: { id: 'blinkit', name: 'Blinkit', short: 'Blinkit' },
  zepto: { id: 'zepto', name: 'Zepto', short: 'Zepto' },
  instamart: { id: 'instamart', name: 'Instamart', short: 'Instamart' },
  flipkart: { id: 'flipkart', name: 'Flipkart Minutes', short: 'Flipkart' },
  bigbasket: { id: 'bigbasket', name: 'BigBasket Now', short: 'BigBasket' },
}

export const PLATFORM_ORDER: readonly string[] = [
  'blinkit',
  'zepto',
  'instamart',
  'flipkart',
  'bigbasket',
]

export function getPlatformMeta(platformKey: string): PlatformMeta {
  if (!platformKey || typeof platformKey !== 'string') {
    return { id: 'unknown', name: 'Unknown', short: 'UNKN' }
  }
  const key = platformKey.trim().toLowerCase()
  if (!key) {
    return { id: 'unknown', name: 'Unknown', short: 'UNKN' }
  }
  return (
    PLATFORM_INFO[key] || {
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      short: key.slice(0, 4).toUpperCase(),
    }
  )
}
