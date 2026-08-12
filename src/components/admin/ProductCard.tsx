'use client'

import { useState } from 'react'
import { Product } from '@/lib/types'
import { Pencil, Trash2, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface Props {
  product: Product
  onEdit: (p: Product) => void
  onRefresh: () => void
}

export function ProductCard({ product, onEdit, onRefresh }: Props) {
  const { t } = useI18n()
  const supabase = createClient()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const { error: err } = await supabase.from('products').delete().eq('id', product.id)
    if (err) {
      setError(t.products.deleteFailed)
      setConfirming(false)
    } else {
      onRefresh()
    }
    setDeleting(false)
  }

  async function toggleActive() {
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id)
    onRefresh()
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-opacity ${
      !product.is_active ? 'opacity-50 border-stone-200' : 'border-stone-200 hover:shadow-md'
    }`}>
      {/* Image */}
      <div className="relative h-32 bg-amber-50 flex items-center justify-center">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-4xl">🫓</span>
        )}
        {!product.is_active && (
          <div className="absolute top-2 right-2 bg-stone-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
            <EyeOff className="w-3 h-3" /> {t.common.inactive}
          </div>
        )}
        {product.category && (
          <div className="absolute top-2 left-2 bg-white/90 text-stone-600 text-xs px-2 py-0.5 rounded-full">
            {product.category.emoji} {product.category.name}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <p className="font-semibold text-stone-800 text-sm leading-tight line-clamp-2">
          {product.name}
        </p>
        <p className="text-amber-700 font-bold text-base">${product.sale_price.toFixed(2)}</p>

        {/* Actions */}
        {error && (
          <p className="text-xs text-red-500 text-center mt-1">{error}</p>
        )}
        {confirming ? (
          <div className="mt-auto space-y-1.5">
            <p className="text-xs text-center text-stone-500">{t.products.confirmDeletePermanent}</p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-1.5 text-xs rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50"
              >
                {t.common.no}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-1.5 text-xs rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium"
              >
                {deleting ? '...' : t.products.yesDelete}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-auto flex gap-1.5">
            <button
              onClick={toggleActive}
              title={product.is_active ? t.products.deactivate : t.products.activate}
              className="flex-1 py-1.5 text-xs rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors"
            >
              {product.is_active ? t.products.deactivate : t.products.activate}
            </button>
            <button
              onClick={() => onEdit(product)}
              className="w-8 flex items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="w-8 flex items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
