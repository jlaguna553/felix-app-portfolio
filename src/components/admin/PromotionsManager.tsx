'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Promotion, Product } from '@/lib/types'
import { PromotionModal } from './PromotionModal'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Clock, Tag, Percent } from 'lucide-react'

type SimpleProduct = Pick<Product, 'id' | 'name' | 'sale_price'>

interface Props {
  promotions: Promotion[]
  products: SimpleProduct[]
  branchId: string
}

function formatTime(t: string | null) {
  return t ? t.slice(0, 5) : ''
}

export function PromotionsManager({ promotions: initial, products, branchId }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [list, setList] = useState<Promotion[]>(initial)
  const [modal, setModal] = useState<{ open: boolean; promo: Promotion | null }>({ open: false, promo: null })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function toggleActive(promo: Promotion) {
    const supabase = createClient()
    const next = !promo.is_active
    setList(prev => prev.map(p => p.id === promo.id ? { ...p, is_active: next } : p))
    await supabase.from('promotions').update({ is_active: next }).eq('id', promo.id)
    refresh()
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('promotions').delete().eq('id', id)
    setList(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
    refresh()
  }

  async function handleSave() {
    setModal({ open: false, promo: null })
    // Re-fetch list directly so new/edited promo appears immediately
    const supabase = createClient()
    const { data } = await supabase
      .from('promotions')
      .select('*, items:promotion_items(*, product:products(id, name, sale_price))')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    if (data) setList(data as Promotion[])
    refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{list.length} promoción{list.length !== 1 ? 'es' : ''} registrada{list.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setModal({ open: true, promo: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva promoción
        </button>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <Percent className="w-10 h-10 text-stone-200 mx-auto mb-3" />
          <p className="text-stone-500 text-sm">Sin promociones</p>
          <p className="text-stone-400 text-xs mt-1">Crea combos o descuentos que se apliquen automáticamente en el POS</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(promo => {
            const isDeleting = confirmDelete === promo.id
            return (
              <div
                key={promo.id}
                className={`bg-white rounded-2xl border overflow-hidden transition-colors ${promo.is_active ? 'border-stone-200' : 'border-stone-100 opacity-60'}`}
              >
                <div className="flex items-start gap-3 px-5 py-4">
                  {/* Active toggle */}
                  <button
                    onClick={() => toggleActive(promo)}
                    title={promo.is_active ? 'Desactivar' : 'Activar'}
                    className={`mt-0.5 w-10 h-6 rounded-full shrink-0 transition-colors relative ${promo.is_active ? 'bg-amber-500' : 'bg-stone-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${promo.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-stone-800 truncate">{promo.name}</p>
                    {promo.description && (
                      <p className="text-xs text-stone-400 mt-0.5 truncate">{promo.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {/* Discount badge */}
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        <Tag className="w-3 h-3" />
                        {promo.discount_type === 'fixed'
                          ? `$${promo.discount_value.toFixed(2)} off`
                          : `${promo.discount_value}% off`
                        }
                      </span>

                      {/* Schedule badge */}
                      {promo.schedule_type === 'window' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          {formatTime(promo.start_time)} – {formatTime(promo.end_time)}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">Todo el día</span>
                      )}

                      {/* Pool badge */}
                      {promo.pool_quantity && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          Cada {promo.pool_quantity} = 1 descuento
                        </span>
                      )}

                      {/* Required items */}
                      {promo.items && promo.items.length > 0 && (
                        <span className="text-xs text-stone-500">
                          {promo.pool_quantity
                            ? `Grupo: ${promo.items.map(i => i.product?.name ?? '?').join(', ')}`
                            : `Requiere: ${promo.items.map(i => `${i.quantity}× ${i.product?.name ?? '?'}`).join(', ')}`
                          }
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setModal({ open: true, promo })}
                      className="p-2 rounded-xl hover:bg-stone-100 text-stone-500 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(isDeleting ? null : promo.id)}
                      className="p-2 rounded-xl hover:bg-red-50 text-red-400 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Inline delete confirm */}
                {isDeleting && (
                  <div className="px-5 pb-4 flex items-center gap-3">
                    <p className="text-sm text-stone-600 flex-1">¿Eliminar esta promoción?</p>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-sm px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleDelete(promo.id)}
                      className="text-sm px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modal.open && (
        <PromotionModal
          promo={modal.promo}
          products={products}
          branchId={branchId}
          onClose={() => setModal({ open: false, promo: null })}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
