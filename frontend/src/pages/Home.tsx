import React from 'react'
import { PLATFORM_INFO, PLATFORM_ORDER } from '../utils/normalize'

interface HomePageProps {
  onQuickSearch: (query: string) => void
}

const STARTERS = ['milk', 'atta', 'eggs', 'amul butter', 'curd', 'brown bread', 'onion', 'maggi']

export const HomePage: React.FC<HomePageProps> = ({ onQuickSearch }) => (
  <dl className="grid border-t-2 border-rule-ink">
    <div className="grid gap-x-8 gap-y-2 border-b border-rule py-4 md:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="label pt-1">Stores read</dt>
      <dd className="m-0 flex flex-wrap gap-x-6 gap-y-1 text-lg text-ink-2">
        {PLATFORM_ORDER.map((key) => (
          <span key={key}>{PLATFORM_INFO[key]?.name ?? key}</span>
        ))}
      </dd>
    </div>
    <div className="grid gap-x-8 gap-y-2 border-b border-rule py-4 md:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="label pt-2">Start with</dt>
      <dd className="m-0 flex flex-wrap gap-x-6 gap-y-1">
        {STARTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onQuickSearch(item)}
            className="link min-h-10 text-lg"
          >
            {item}
          </button>
        ))}
      </dd>
    </div>
  </dl>
)
