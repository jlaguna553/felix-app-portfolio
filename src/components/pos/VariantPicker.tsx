'use client'

import { useState } from 'react'
import { Product } from '@/lib/types'
import { X, ShoppingBag } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface Props {
  product: Product
  onConfirm: (note: string) => void
  onCancel: () => void
}

export function VariantPicker({ product, onConfirm, onCancel }: Props) {
  const { t } = useI18n()
  const [note, setNote] = useState('')

  const selected = note ? note.split(', ').filter(Boolean) : []

  function toggleVariant(v: string) {
    setNote(prev => {
      const parts = prev ? prev.split(', ').filter(Boolean) : []
      const idx = parts.indexOf(v)
      if (idx >= 0) parts.splice(idx, 1)
      else parts.push(v)
      return parts.join(', ')
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-0 sm:hidden">
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3">
          <div>
            <p className="font-bold text-stone-800 text-lg leading-tight">{product.name}</p>
            <p className="text-amber-700 font-semibold text-sm">${product.sale_price.toFixed(2)}</p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors mt-0.5 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Variant buttons */}
          <div>
            <p className="text-sm font-semibold text-stone-600 mb-2">{t.variant.howPrepared}</p>
            <div className="flex flex-wrap gap-2">
              {product.variants?.map(v => {
                const isSelected = selected.includes(v)
                return (
                  <button
                    key={v}
                    onClick={() => toggleVariant(v)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : 'bg-white border-stone-200 text-stone-700 hover:border-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    {v}
                  </button>
                )
              })}
            </div>
            {selected.length > 0 && (
              <p className="text-xs text-amber-700 font-medium mt-2">
                {t.variant.selectedPrefix} {note}
              </p>
            )}
          </div>

          {/* Free-text note */}
          <div>
            <p className="text-xs text-stone-500 mb-1">{t.variant.extraNote}</p>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t.variant.notePlaceholder}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={() => onConfirm(note.trim())}
              className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-semibold text-sm flex items-center justify-center gap-1.5 transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              {t.common.add}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
