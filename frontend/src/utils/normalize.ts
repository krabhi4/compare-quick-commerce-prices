export interface PlatformMeta {
  id: string
  name: string
  short: string
}

export const PLATFORM_INFO: Record<string, PlatformMeta> = {
  blinkit: { id: 'blinkit', name: 'Blinkit', short: 'BLNK' },
  zepto: { id: 'zepto', name: 'Zepto', short: 'ZEPT' },
  instamart: { id: 'instamart', name: 'Instamart', short: 'INST' },
  flipkart: { id: 'flipkart', name: 'Flipkart Minutes', short: 'FLPK' },
  bigbasket: { id: 'bigbasket', name: 'BigBasket Now', short: 'BGBK' },
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
