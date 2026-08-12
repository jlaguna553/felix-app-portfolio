'use client'

import { useState, useEffect } from 'react'
import { Supply } from '@/lib/types'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface RecipeRow {
  id: string
  supply_id: string
  quantity: number
  supply?: Supply
}

interface Props {
  products: { id: string; name: string }[]
  supplies: Supply[]
  branchId: string
}

export function RecipesManager({ products, supplies, branchId: _branchId }: Props) {
  const supabase = createClient()
  const [selectedProduct, setSelectedProduct] = useState<string>(products[0]?.id ?? '')
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [addingSupply, setAddingSupply] = useState('')
  const [addingQty, setAddingQty] = useState<number>(0)

  useEffect(() => {
    if (!selectedProduct) return
    setLoading(true)
    supabase
      .from('recipes')
      .select('*, supply:supplies(*)')
      .eq('product_id', selectedProduct)
      .then(({ data }) => {
        setRecipes((data as RecipeRow[]) ?? [])
        setLoading(false)
      })
  }, [selectedProduct]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addIngredient() {
    if (!addingSupply || addingQty <= 0) return
    const { data } = await supabase
      .from('recipes')
      .insert({ product_id: selectedProduct, supply_id: addingSupply, quantity: addingQty })
      .select('*, supply:supplies(*)')
      .single()
    if (data) setRecipes(prev => [...prev, data as RecipeRow])
    setAddingSupply('')
    setAddingQty(0)
  }

  async function removeIngredient(id: string) {
    await supabase.from('recipes').delete().eq('id', id)
    setRecipes(prev => prev.filter(r => r.id !== id))
  }

  const totalCost = recipes.reduce((sum, r) => {
    const cost = (r.supply?.unit_cost ?? 0) * r.quantity
    return sum + cost
  }, 0)

  const selectedProductData = products.find(p => p.id === selectedProduct)

  const usedSupplyIds = new Set(recipes.map(r => r.supply_id))
  const availableSupplies = supplies.filter(s => !usedSupplyIds.has(s.id))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Product selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4">
        <h2 className="font-semibold text-stone-700 mb-3 text-sm">Seleccionar producto</h2>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {products.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProduct(p.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                selectedProduct === p.id
                  ? 'bg-amber-100 text-amber-900 font-semibold'
                  : 'hover:bg-stone-50 text-stone-700'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe editor */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-semibold text-stone-700">
            Receta: <span className="text-amber-700">{selectedProductData?.name ?? '—'}</span>
          </h2>
          {totalCost > 0 && (
            <span className="text-sm text-stone-500">
              Costo total: <strong className="text-stone-800">${totalCost.toFixed(2)}</strong>
            </span>
          )}
        </div>

        <div className="p-5 space-y-3">
          {loading ? (
            <p className="text-stone-400 text-sm">Cargando...</p>
          ) : recipes.length === 0 ? (
            <p className="text-stone-400 text-sm">No hay insumos en esta receta.</p>
          ) : (
            <div className="divide-y divide-stone-100">
              {recipes.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="text-sm font-medium text-stone-800">{r.supply?.name}</span>
                    <span className="text-xs text-stone-400 ml-2">
                      ${((r.supply?.unit_cost ?? 0) * r.quantity).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-stone-600 font-medium">
                      {r.quantity} {r.supply?.unit}
                    </span>
                    <button
                      onClick={() => removeIngredient(r.id)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add ingredient row */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100">
            <select
              value={addingSupply}
              onChange={e => setAddingSupply(e.target.value)}
              className="flex-1 min-w-[160px] border border-stone-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Seleccionar insumo</option>
              {availableSupplies.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.unit})
                </option>
              ))}
            </select>
            <input
              type="number"
              value={addingQty || ''}
              onChange={e => setAddingQty(Number(e.target.value))}
              className="w-28 border border-stone-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Cantidad"
              min={0}
              step={0.1}
            />
            <button
              onClick={addIngredient}
              disabled={!addingSupply || addingQty <= 0}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 text-white disabled:text-stone-400 text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
