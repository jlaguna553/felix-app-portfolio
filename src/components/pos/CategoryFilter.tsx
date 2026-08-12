'use client'

import { Category } from '@/lib/types'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface Props {
  categories: Category[]
  active: string | null
  onChange: (id: string | null) => void
}

export function CategoryFilter({ categories, active, onChange }: Props) {
  const { t } = useI18n()
  return (
    <div className="flex flex-wrap lg:flex-nowrap lg:overflow-x-auto gap-2 px-4 py-3 shrink-0 bg-white border-b border-stone-200">
      <button
        onClick={() => onChange(null)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          active === null
            ? 'bg-amber-600 text-white'
            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
        }`}
      >
        {t.pos.allCategories}
      </button>
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            active === cat.id
              ? 'bg-amber-600 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          {cat.emoji && <span className="mr-1">{cat.emoji}</span>}
          {cat.name}
        </button>
      ))}
    </div>
  )
}
