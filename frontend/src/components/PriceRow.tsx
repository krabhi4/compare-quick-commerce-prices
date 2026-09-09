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
    <span className="tag text-ink-3 md:hidden">{PLATFORM_INFO[platform]?.short ?? platform}</span>
  )

  if (!entry) {
    return (
      <div className="flex flex-col items-end gap-2 px-2 py-3">
        {label}
        <span className="my-auto h-px w-4 bg-rule-strong" title="does not deliver here" />
      </div>
    )
  }

  const body = (
    <>
      {label}
      <span
        className={
          cheapest
            ? 'rate text-rate text-ink'
            : 'rate text-lead text-ink-2 [font-stretch:100%] [font-weight:500]'
        }
      >
        {formatAmount(entry.price)}
      </span>
      <span className="tag text-ink-3">
        {!entry.in_stock ? 'out' : formatEta(entry.eta) || ' '}
      </span>
    </>
  )

  const shell = `flex flex-col items-end gap-1.5 px-2 py-3 ${cheapest ? 'bg-mark-wash' : ''} ${
    !entry.in_stock ? 'opacity-45' : ''
  }`

  if (!entry.product_url) {
    return <div className={shell}>{body}</div>
  }

  return (
    <a
      href={entry.product_url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open on ${PLATFORM_INFO[platform]?.name ?? platform}`}
      className={`${shell} transition-colors hover:bg-sunk`}
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

  return (
    <div
      className="rise col-span-full grid grid-cols-subgrid border-t border-rule"
      style={{ animationDelay: `${Math.min(index, 12) * 24}ms` }}
    >
      <div className="col-span-full flex items-start gap-3 pt-3 pr-4 md:col-span-1 md:py-3">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="mt-0.5 size-10 shrink-0 bg-panel object-contain"
          />
        ) : (
          <span className="mt-0.5 size-10 shrink-0 bg-sunk" />
        )}
        <div className="min-w-0">
          <h3 className="board line-clamp-2 text-body leading-snug font-semibold [font-stretch:92%]">
            {product.normalized_name}
          </h3>
          <p className="mt-0.5 truncate text-micro text-ink-2">
            {[product.brand, product.quantity].filter(Boolean).join(' · ') || ' '}
          </p>
          <div className="mt-1.5 flex gap-3">
            <button
              type="button"
              onClick={onToggleHistory}
              aria-expanded={expanded}
              className="tag text-ink-3 underline decoration-rule-strong decoration-1 underline-offset-3 transition-colors hover:text-mark hover:decoration-mark"
            >
              {expanded ? 'hide trend' : 'trend'}
            </button>
            <button
              type="button"
              onClick={() => onSetAlert(product.normalized_name, product.cheapest_price)}
              className="tag text-ink-3 underline decoration-rule-strong decoration-1 underline-offset-3 transition-colors hover:text-mark hover:decoration-mark"
            >
              alert
            </button>
          </div>
        </div>
      </div>

      {PLATFORM_ORDER.map((key) => (
        <Cell
          key={key}
          platform={key}
          entry={byPlatform.get(key)}
          cheapest={savings > 0 && key === product.cheapest_platform.toLowerCase()}
        />
      ))}

      <div className="flex flex-col items-end gap-1.5 py-3 pl-2">
        <span className="tag text-ink-3 md:hidden">save</span>
        {savings > 0 ? (
          <>
            <span className="rate text-lead text-mark">{formatAmount(savings)}</span>
            <span className="tag text-ink-3">{savingsPercent}%</span>
          </>
        ) : (
          <span className="tag text-ink-3">same</span>
        )}
      </div>
    </div>
  )
}
