import React from 'react'
import type { GroupedProduct, PlatformProduct } from '../hooks/useSearch'
import { PLATFORM_INFO, PLATFORM_ORDER } from '../utils/normalize'
import { formatAmount, formatEta, calculateSavings } from '../utils/format'

interface PriceRowProps {
  product: GroupedProduct
  index: number
  expanded: boolean
  onToggleHistory: () => void
  onSetAlert: (productName: string, currentPrice: number) => void
}

function Cell({
  platform,
  entry,
  cheapest,
}: {
  platform: string
  entry: PlatformProduct | undefined
  cheapest: boolean
}) {
  const label = (
    <span className="text-sm font-medium text-muted lg:hidden">
      {PLATFORM_INFO[platform]?.short ?? platform}
    </span>
  )

  if (!entry) {
    return (
      <div className="hidden flex-col items-end gap-2 px-3 py-4 lg:flex">
        <span className="my-auto h-px w-4 bg-muted" title="does not deliver here" />
        <span className="sr-only">Not listed</span>
      </div>
    )
  }

  const figure = !entry.in_stock
    ? 'figure text-lg text-muted line-through decoration-muted decoration-1'
    : `figure decoration-accent decoration-2 underline-offset-4 group-hover:underline ${
        cheapest ? 'text-3xl font-medium text-ink' : 'text-lg text-ink-2'
      }`

  const body = (
    <>
      {label}
      <span className={figure}>
        {formatAmount(entry.price)}
      </span>
      <span className="text-sm text-muted">
        {!entry.in_stock ? 'Out' : formatEta(entry.eta) || ' '}
      </span>
    </>
  )

  const shell = `group flex min-w-20 flex-col items-start gap-1.5 px-3 py-4 lg:items-end ${cheapest ? 'bg-paper-3' : ''}`

  const isSafeUrl =
    entry.product_url && /^https?:\/\//i.test(entry.product_url)

  if (!isSafeUrl) {
    return <div className={shell}>{body}</div>
  }

  return (
    <a
      href={entry.product_url!}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open on ${PLATFORM_INFO[platform]?.name ?? platform}`}
      className={shell}
    >
      {body}
    </a>
  )
}

export const PriceRow: React.FC<PriceRowProps> = ({
  product,
  index,
  expanded,
  onToggleHistory,
  onSetAlert,
}) => {
  const byPlatform = new Map(product.platforms.map((p) => [p.platform.toLowerCase(), p]))
  const { savings, savingsPercent } = calculateSavings(product.platforms.map((p) => p.price))
  const image = product.platforms.find((p) => p.image_url)?.image_url
  const missing = PLATFORM_ORDER.filter((key) => !byPlatform.has(key)).map(
    (key) => PLATFORM_INFO[key]?.short ?? key
  )

  return (
    <div className="col-span-full flex flex-wrap border-t border-rule lg:grid lg:grid-cols-subgrid">
      <div className="flex w-full items-start gap-3 pt-4 pr-4 lg:w-auto lg:py-4">
        {image ? (
          <img
            src={image}
            alt=""
            width={48}
            height={48}
            loading={index === 0 ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : undefined}
            className="size-12 shrink-0 bg-plate object-contain p-0.5"
          />
        ) : (
          <span className="size-12 shrink-0 bg-paper-2" />
        )}
        <div className="min-w-0">
          <h3 className="line-clamp-3">{product.normalized_name}</h3>
          <p className="mt-0.5 truncate text-sm text-muted">
            {[product.brand, product.quantity].filter(Boolean).join(', ') || ' '}
          </p>
          {missing.length > 0 && (
            <p className="mt-0.5 text-sm text-muted lg:hidden">Not on {missing.join(', ')}</p>
          )}
          <div className="mt-1 flex gap-4">
            <button
              type="button"
              onClick={onToggleHistory}
              aria-expanded={expanded}
              className="link"
            >
              {expanded ? 'Hide trend' : 'Trend'}
            </button>
            <button
              type="button"
              onClick={() => onSetAlert(product.normalized_name, product.cheapest_price)}
              className="link"
            >
              Alert
            </button>
          </div>
        </div>
      </div>

      {PLATFORM_ORDER.map((key) => (
        <Cell
          key={key}
          platform={key}
          entry={byPlatform.get(key)}
          cheapest={savings > 0 && key === product.cheapest_platform?.toLowerCase()}
        />
      ))}

      <div className="flex min-w-20 flex-col items-start gap-1.5 px-3 py-4 lg:items-end lg:pr-0">
        <span className="text-sm font-medium text-muted lg:hidden">Save</span>
        {savings > 0 ? (
          <>
            <span className="figure text-lg font-medium text-ink">{formatAmount(savings)}</span>
            <span className="text-sm text-muted">{savingsPercent}%</span>
          </>
        ) : (
          <span className="text-sm text-muted">Same</span>
        )}
      </div>
    </div>
  )
}
