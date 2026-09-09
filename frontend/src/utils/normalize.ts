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

export const PLATFORM_ORDER = Object.keys(PLATFORM_INFO)

export function getPlatformMeta(platformKey: string): PlatformMeta {
  const key = platformKey.toLowerCase()
  return (
    PLATFORM_INFO[key] || {
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      short: key.slice(0, 4).toUpperCase(),
    }
  )
}
