export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price)
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return dateString
  }
}

export function calculateSavings(prices: number[]): {
  maxPrice: number
  minPrice: number
  savings: number
  savingsPercent: number
} {
  if (!prices || prices.length <= 1) {
    return { maxPrice: 0, minPrice: 0, savings: 0, savingsPercent: 0 }
  }

  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const savings = maxPrice - minPrice
  const savingsPercent = maxPrice > 0 ? Math.round((savings / maxPrice) * 100) : 0

  return { maxPrice, minPrice, savings, savingsPercent }
}
