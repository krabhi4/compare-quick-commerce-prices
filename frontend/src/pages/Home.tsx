import React from 'react'
import { PLATFORM_INFO, PLATFORM_ORDER } from '../utils/normalize'

interface HomePageProps {
  onQuickSearch: (query: string) => void
}

const STARTERS = ['milk', 'atta', 'eggs', 'amul butter', 'curd', 'brown bread', 'onion', 'maggi']

export const HomePage: React.FC<HomePageProps> = ({ onQuickSearch }) => (
  <section className="flex flex-col gap-8">
    <div className="grid grid-cols-2 gap-x-6 border-y-2 border-ink py-2 sm:grid-cols-3 lg:grid-cols-5">
      {PLATFORM_ORDER.map((key) => (
        <div key={key} className="flex items-baseline gap-2">
          <p className="tag text-mark">{PLATFORM_INFO[key].short}</p>
          <p className="board text-micro [font-stretch:88%] text-ink-2">
            {PLATFORM_INFO[key].name}
          </p>
        </div>
      ))}
    </div>

    <div>
      <p className="tag border-b border-rule pb-1.5 text-ink-2">start with</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2.5">
        {STARTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onQuickSearch(item)}
            className="board text-body [font-stretch:92%] text-ink underline decoration-rule-strong decoration-1 underline-offset-4 transition-colors hover:text-mark hover:decoration-mark"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  </section>
)
