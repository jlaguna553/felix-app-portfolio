'use client'

import { useState } from 'react'
import { Product } from '@/lib/types'
import { Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface Props {
  product: Product
  onEdit: (p: Product) => void
  onRefresh: () => void
}

export function ProductRow({ product, onEdit, onRefresh }: Props) {
  const { t } = useI18n()
  const supabase = createClient()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setError(null)
    const { error: err } = await supabase.from('products').delete().eq('id', product.id)
    if (err) {
      setError(t.products.deleteFailed)
      setConfirming(false)
    } else {
      onRefresh()
    }
  }

  async function toggleActive() {
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id)
    onRefresh()
  }

  return (
    <tr className={`hover:bg-stone-50 ${!product.is_active ? 'opacity-50' : ''}`}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 overflow-hidden">
            {product.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={product.image_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-lg">🫓</span>
            }
          </div>
          <span className="font-medium text-stone-800">{product.name}</span>
        </div>
      </td>
      <td className="px-5 py-3 text-stone-500 text-sm">
        {product.category ? `${product.category.emoji ?? ''} ${product.category.name}` : '—'}
      </td>
      <td className="px-5 py-3 font-semibold text-amber-700">${product.sale_price.toFixed(2)}</td>
      <td className="px-5 py-3">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          product.is_active
            ? 'bg-green-100 text-green-700'
            : 'bg-stone-100 text-stone-500'
        }`}>
          {product.is_active ? t.common.active : t.common.inactive}
        </span>
      </td>
      <td className="px-5 py-3">
        {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500">{t.products.confirmDelete}</span>
            <button onClick={handleDelete} className="text-xs text-red-600 font-semibold hover:underline">
              {t.common.yes}
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs text-stone-400 hover:underline">
              {t.common.no}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={toggleActive} className="text-stone-400 hover:text-amber-600 transition-colors">
              {product.is_active
                ? <ToggleRight className="w-5 h-5 text-green-500" />
                : <ToggleLeft className="w-5 h-5" />
              }
            </button>
            <button onClick={() => onEdit(product)} className="text-stone-400 hover:text-amber-600 transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => setConfirming(true)} className="text-stone-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
