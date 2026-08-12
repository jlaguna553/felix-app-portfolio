'use client'

import { Product } from '@/lib/types'
import { ChevronDown } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface Props {
  products: Product[]
  onAdd: (product: Product) => void
}

export function ProductGrid({ products, onAdd }: Props) {
  const { t } = useI18n()
  if (products.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-400">
        <p>{t.pos.noProductsInCategory}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {products.map(product => (
          <button
            key={product.id}
            onClick={() => onAdd(product)}
            className="min-h-[100px] bg-white rounded-2xl shadow-sm border border-stone-100 p-3 flex flex-col items-center justify-center gap-1 hover:bg-amber-50 hover:border-amber-300 active:scale-95 transition-all text-center relative"
          >
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt={product.name}
                className="w-12 h-12 object-cover rounded-lg mb-1"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center text-2xl mb-1">
                🫓
              </div>
            )}
            <span className="text-sm font-semibold text-stone-800 leading-tight">
              {product.name}
            </span>
            <span className="text-xs font-bold text-amber-700">
              ${product.sale_price.toFixed(2)}
            </span>
            {product.variants && product.variants.length > 0 && (
              <span className="absolute top-2 right-2 flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                <ChevronDown className="w-2.5 h-2.5" />
                {t.pos.optionsBadge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
