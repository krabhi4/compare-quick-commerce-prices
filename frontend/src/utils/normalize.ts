export interface PlatformMeta {
  id: string
  name: string
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  iconName: string
}

export const PLATFORM_INFO: Record<string, PlatformMeta> = {
  blinkit: {
    id: 'blinkit',
    name: 'Blinkit',
    color: '#f8cb46',
    bgColor: 'bg-amber-400/10',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-400/30',
    iconName: 'Zap',
  },
  zepto: {
    id: 'zepto',
    name: 'Zepto',
    color: '#ec4899',
    bgColor: 'bg-pink-500/10',
    textColor: 'text-pink-400',
    borderColor: 'border-pink-500/30',
    iconName: 'Sparkles',
  },
  instamart: {
    id: 'instamart',
    name: 'Instamart',
    color: '#f97316',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/30',
    iconName: 'ShoppingBag',
  },
  flipkart: {
    id: 'flipkart',
    name: 'Flipkart Minutes',
    color: '#3b82f6',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    iconName: 'Package',
  },
  bigbasket: {
    id: 'bigbasket',
    name: 'BigBasket Now',
    color: '#ef4444',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    iconName: 'Store',
  },
}

export function getPlatformMeta(platformKey: string): PlatformMeta {
  const normalizedKey = platformKey.toLowerCase()
  return (
    PLATFORM_INFO[normalizedKey] || {
      id: normalizedKey,
      name: normalizedKey.charAt(0).toUpperCase() + normalizedKey.slice(1),
      color: '#94a3b8',
      bgColor: 'bg-slate-500/10',
      textColor: 'text-slate-400',
      borderColor: 'border-slate-500/30',
      iconName: 'Store',
    }
  )
}
