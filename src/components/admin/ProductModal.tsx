'use client'

import { useState } from 'react'
import { Product, Category } from '@/lib/types'
import { X, Loader2, Save, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface Props {
  product: Product | null
  categories: Category[]
  branchId: string
  onClose: () => void
  onSave: () => void
}

export function ProductModal({ product, categories, branchId, onClose, onSave }: Props) {
  const { t } = useI18n()
  const supabase = createClient()
  const isEdit = product !== null

  const [form, setForm] = useState({
    name: product?.name ?? '',
    sale_price: product?.sale_price?.toString() ?? '',
    category_id: product?.category_id ?? '',
    image_url: product?.image_url ?? '',
    is_active: product?.is_active ?? true,
  })
  const [variants, setVariants] = useState<string[]>(product?.variants ?? [])
  const [newVariant, setNewVariant] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.name.trim() || !form.sale_price) {
      setError(t.products.nameAndPriceRequired)
      return
    }
    setLoading(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      sale_price: parseFloat(form.sale_price),
      category_id: form.category_id || null,
      image_url: form.image_url.trim() || null,
      is_active: form.is_active,
      variants: variants.length > 0 ? variants : null,
    }

    const { error: dbError } = isEdit
      ? await supabase.from('products').update(payload).eq('id', product.id)
      : await supabase.from('products').insert({ ...payload, branch_id: branchId })

    if (dbError) {
      setError(dbError.message)
      setLoading(false)
      return
    }

    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="font-bold text-stone-800 text-lg">
            {isEdit ? t.products.editProduct : t.products.newProduct}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              {t.common.name} <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder={t.products.namePlaceholder}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              {t.products.salePrice} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
              <input
                type="number"
                value={form.sale_price}
                onChange={e => set('sale_price', e.target.value)}
                min={0}
                step={0.5}
                className="w-full border border-stone-300 rounded-lg pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.products.category}</label>
            <select
              value={form.category_id}
              onChange={e => set('category_id', e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">{t.products.noCategory}</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">{t.products.productImage}</label>
            <ImageUpload
              value={form.image_url}
              onChange={url => set('image_url', url)}
              bucket="images"
              folder="products"
              previewSize="lg"
            />
          </div>

          {/* Variants */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              {t.products.variantsLabel}
              <span className="text-stone-400 font-normal ml-1">({t.common.optional})</span>
            </label>
            <p className="text-xs text-stone-400 mb-2">{t.products.variantsHint}</p>
            {variants.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {variants.map(v => (
                  <span key={v} className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {v}
                    <button
                      type="button"
                      onClick={() => setVariants(prev => prev.filter(x => x !== v))}
                      className="hover:text-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newVariant}
                onChange={e => setNewVariant(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const v = newVariant.trim()
                    if (v && !variants.includes(v)) { setVariants(prev => [...prev, v]); setNewVariant('') }
                  }
                }}
                placeholder={t.products.variantPlaceholder}
                className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={() => {
                  const v = newVariant.trim()
                  if (v && !variants.includes(v)) { setVariants(prev => [...prev, v]); setNewVariant('') }
                }}
                className="p-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-stone-700">{t.products.activeProduct}</p>
              <p className="text-xs text-stone-400">{t.products.activeProductHint}</p>
            </div>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                form.is_active ? 'bg-amber-500' : 'bg-stone-300'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  form.is_active ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-stone-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-semibold transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? t.common.saving : isEdit ? t.products.saveChanges : t.products.createProduct}
          </button>
        </div>
      </div>
    </div>
  )
}
