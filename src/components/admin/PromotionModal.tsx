'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Promotion, DiscountType, ScheduleType, Product } from '@/lib/types'
import { X, Plus, Trash2, Loader2 } from 'lucide-react'

type SimpleProduct = Pick<Product, 'id' | 'name' | 'sale_price'>

interface Props {
  promo: Promotion | null
  products: SimpleProduct[]
  branchId: string
  onClose: () => void
  onSave: () => void
}

interface FormState {
  name: string
  description: string
  discount_type: DiscountType
  discount_value: string
  schedule_type: ScheduleType
  start_time: string
  end_time: string
  is_active: boolean
  pool_mode: boolean
  pool_quantity: string
}

interface RequiredItem {
  productId: string
  quantity: number
}

export function PromotionModal({ promo, products, branchId, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>({
    name:           promo?.name ?? '',
    description:    promo?.description ?? '',
    discount_type:  promo?.discount_type ?? 'fixed',
    discount_value: promo?.discount_value?.toString() ?? '',
    schedule_type:  promo?.schedule_type ?? 'all_day',
    start_time:     promo?.start_time?.slice(0, 5) ?? '',
    end_time:       promo?.end_time?.slice(0, 5) ?? '',
    is_active:      promo?.is_active ?? true,
    pool_mode:      promo?.pool_quantity != null,
    pool_quantity:  promo?.pool_quantity?.toString() ?? '2',
  })
  const [requiredItems, setRequiredItems] = useState<RequiredItem[]>(
    promo?.items?.map(i => ({ productId: i.product_id, quantity: i.quantity })) ?? []
  )
  const [newProductId, setNewProductId] = useState('')
  const [newQty, setNewQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }))

  const availableProducts = products.filter(
    p => !requiredItems.find(r => r.productId === p.id)
  )

  function addItem() {
    if (!newProductId) return
    setRequiredItems(prev => [...prev, { productId: newProductId, quantity: newQty }])
    setNewProductId('')
    setNewQty(1)
  }

  function removeItem(productId: string) {
    setRequiredItems(prev => prev.filter(i => i.productId !== productId))
  }

  function updateItemQty(productId: string, qty: number) {
    if (qty < 1) return
    setRequiredItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i))
  }

  function productName(id: string) {
    return products.find(p => p.id === id)?.name ?? id
  }

  async function handleSave() {
    setError(null)
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    const dv = parseFloat(form.discount_value)
    if (isNaN(dv) || dv <= 0) { setError('El descuento debe ser mayor a 0'); return }
    if (requiredItems.length === 0) { setError('Agrega al menos un producto requerido'); return }
    if (form.schedule_type === 'window' && (!form.start_time || !form.end_time)) {
      setError('Ingresa horario de inicio y fin'); return
    }

    setLoading(true)
    const supabase = createClient()

    const payload = {
      name:           form.name.trim(),
      description:    form.description.trim() || null,
      discount_type:  form.discount_type,
      discount_value: dv,
      schedule_type:  form.schedule_type,
      start_time:     form.schedule_type === 'window' ? form.start_time : null,
      end_time:       form.schedule_type === 'window' ? form.end_time : null,
      is_active:      form.is_active,
      pool_quantity:  form.pool_mode ? (parseInt(form.pool_quantity) || 2) : null,
    }

    let promoId = promo?.id
    if (promoId) {
      const { error: e } = await supabase.from('promotions').update(payload).eq('id', promoId)
      if (e) { setError(e.message); setLoading(false); return }
    } else {
      const { data, error: e } = await supabase.from('promotions').insert({ ...payload, branch_id: branchId }).select().single()
      if (e || !data) { setError(e?.message ?? 'Error al guardar'); setLoading(false); return }
      promoId = data.id
    }

    // Replace all promotion_items
    await supabase.from('promotion_items').delete().eq('promotion_id', promoId)
    const { error: itemsErr } = await supabase.from('promotion_items').insert(
      requiredItems.map(i => ({ promotion_id: promoId, product_id: i.productId, quantity: i.quantity }))
    )
    if (itemsErr) { setError(itemsErr.message); setLoading(false); return }

    setLoading(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="font-bold text-stone-800">{promo ? 'Editar promoción' : 'Nueva promoción'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100 text-stone-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ej. Combo 2 Gorditas + Refresco"
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Descripción (opcional)</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {/* Discount type + value */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Descuento *</label>
            <div className="flex gap-2 mb-2">
              {(['fixed', 'percent'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('discount_type', t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    form.discount_type === t
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {t === 'fixed' ? 'Monto fijo ($)' : 'Porcentaje (%)'}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-medium">
                {form.discount_type === 'fixed' ? '$' : '%'}
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.discount_value}
                onChange={e => set('discount_value', e.target.value)}
                placeholder="0.00"
                className="w-full border border-stone-300 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Horario</label>
            <div className="flex gap-2 mb-2">
              {(['all_day', 'window'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('schedule_type', t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    form.schedule_type === t
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {t === 'all_day' ? 'Todo el día' : 'Por horario'}
                </button>
              ))}
            </div>
            {form.schedule_type === 'window' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-stone-500 mb-1">Desde</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => set('start_time', e.target.value)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-stone-500 mb-1">Hasta</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={e => set('end_time', e.target.value)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pool mode toggle */}
          <div className="border border-stone-200 rounded-xl p-4 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-stone-700">Modo agrupado</p>
                <p className="text-xs text-stone-400 mt-0.5">Cuenta el total de productos del grupo, sin importar el tipo</p>
              </div>
              <button
                type="button"
                onClick={() => set('pool_mode', !form.pool_mode)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ml-3 ${form.pool_mode ? 'bg-amber-500' : 'bg-stone-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.pool_mode ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </button>
            </label>
            {form.pool_mode && (
              <div className="flex items-center gap-3 pt-1">
                <label className="text-sm text-stone-600 shrink-0">Cada</label>
                <input
                  type="number"
                  min="2"
                  value={form.pool_quantity}
                  onChange={e => set('pool_quantity', e.target.value)}
                  className="w-20 border border-stone-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <label className="text-sm text-stone-600">productos del grupo = 1 descuento</label>
              </div>
            )}
          </div>

          {/* Required items */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              {form.pool_mode ? 'Productos del grupo *' : 'Productos requeridos *'}
            </label>

            {/* Added items */}
            {requiredItems.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {requiredItems.map(item => (
                  <div key={item.productId} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <span className="flex-1 text-sm text-stone-800 truncate">{productName(item.productId)}</span>
                    {!form.pool_mode && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateItemQty(item.productId, item.quantity - 1)}
                          className="w-6 h-6 rounded-full bg-white border border-stone-300 text-stone-600 flex items-center justify-center text-xs hover:bg-stone-50"
                        >−</button>
                        <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateItemQty(item.productId, item.quantity + 1)}
                          className="w-6 h-6 rounded-full bg-white border border-stone-300 text-stone-600 flex items-center justify-center text-xs hover:bg-stone-50"
                        >+</button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="text-red-400 hover:text-red-600 ml-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new item row */}
            {availableProducts.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={newProductId}
                  onChange={e => setNewProductId(e.target.value)}
                  className="flex-1 border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Selecciona producto…</option>
                  {availableProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — ${p.sale_price.toFixed(2)}</option>
                  ))}
                </select>
                {!form.pool_mode && (
                  <input
                    type="number"
                    min="1"
                    value={newQty}
                    onChange={e => setNewQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 border border-stone-300 rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                )}
                <button
                  type="button"
                  onClick={addItem}
                  disabled={!newProductId}
                  className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 text-white transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-700">Promoción activa</span>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={`w-11 h-6 rounded-full transition-colors relative ${form.is_active ? 'bg-amber-500' : 'bg-stone-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-600 text-sm font-medium hover:bg-stone-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-semibold text-sm flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (promo ? 'Guardar cambios' : 'Crear promoción')}
          </button>
        </div>
      </div>
    </div>
  )
}
