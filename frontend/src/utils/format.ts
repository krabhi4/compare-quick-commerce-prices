export function formatPrice(price: number): string {
  const safePrice = Number.isFinite(price) && price >= 0 ? price : 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(safePrice)
}

export function formatAmount(price: number): string {
  const safePrice = Number.isFinite(price) && price >= 0 ? price : 0
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(safePrice)
}

export function formatEta(eta?: string | null): string {
  if (!eta || typeof eta !== 'string') return ''
  const text = eta.trim().toLowerCase()
  if (text === 'earliest') return 'now'
  return text.replace(/\s*min(ute)?s?\b/g, 'm').replace(/\s+/g, '')
}

export function formatDate(dateString: string): string {
  if (!dateString || typeof dateString !== 'string') return ''
  try {
    const d = new Date(dateString)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return ''
  }
}

export function calculateSavings(prices: number[]): {
  maxPrice: number
  minPrice: number
  savings: number
  savingsPercent: number
} {
  const validPrices = (prices || []).filter(
    (p) => typeof p === 'number' && Number.isFinite(p) && p >= 0
  )
  if (validPrices.length <= 1) {
    return { maxPrice: 0, minPrice: 0, savings: 0, savingsPercent: 0 }
  }

  const minPrice = validPrices.reduce((a, b) => Math.min(a, b), Infinity)
  const maxPrice = validPrices.reduce((a, b) => Math.max(a, b), -Infinity)
  const savings = maxPrice - minPrice
  const savingsPercent = maxPrice > 0 ? Math.round((savings / maxPrice) * 100) : 0

  return { maxPrice, minPrice, savings, savingsPercent }
}
