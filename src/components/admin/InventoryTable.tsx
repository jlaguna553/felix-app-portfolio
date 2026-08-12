'use client'

import { useState } from 'react'
import { Supply } from '@/lib/types'
import { AlertTriangle, Plus, Pencil, Check, X, Trash2, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { downloadCsv } from '@/lib/utils/csv'

interface Props {
  supplies: Supply[]
  branchId: string
}

const UNITS = ['gr', 'ml', 'pza'] as const

export function InventoryTable({ supplies, branchId }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Supply>>({})
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState<Partial<Supply>>({ unit: 'gr' })
  const [confirming, setConfirming] = useState<string | null>(null)

  const supabase = createClient()

  async function saveEdit(id: string) {
    await supabase.from('supplies').update(editData).eq('id', id)
    setEditing(null)
    router.refresh()
  }

  async function deleteSupply(id: string) {
    await supabase.from('supplies').delete().eq('id', id)
    setConfirming(null)
    router.refresh()
  }

  async function saveNew() {
    if (!newItem.name || !newItem.unit) return
    await supabase.from('supplies').insert({
      name: newItem.name,
      unit: newItem.unit,
      current_stock: newItem.current_stock ?? 0,
      min_stock: newItem.min_stock ?? 0,
      unit_cost: newItem.unit_cost ?? 0,
      branch_id: branchId,
    })
    setAdding(false)
    setNewItem({ unit: 'gr' })
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <p className="text-sm text-stone-500">{supplies.length} insumos registrados</p>
        <div className="flex gap-2">
          <button
            onClick={() => downloadCsv(
              `inventario-${new Date().toISOString().slice(0,10)}.csv`,
              ['Nombre', 'Unidad', 'Stock actual', 'Stock mínimo', 'Costo unitario'],
              supplies.map(s => [s.name, s.unit, s.current_stock, s.min_stock, s.unit_cost])
            )}
            className="flex items-center gap-1.5 border border-stone-300 text-stone-600 hover:bg-stone-50 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo insumo
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 uppercase text-xs">
            <tr>
              {['Nombre', 'Unidad', 'Stock actual', 'Stock mínimo', 'Costo unitario', ''].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {adding && (
              <tr className="bg-amber-50">
                <td className="px-5 py-3">
                  <input
                    autoFocus
                    value={newItem.name ?? ''}
                    onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                    className="border border-stone-300 rounded-lg px-2 py-1 w-full text-sm"
                    placeholder="Nombre del insumo"
                  />
                </td>
                <td className="px-5 py-3">
                  <select
                    value={newItem.unit}
                    onChange={e => setNewItem(p => ({ ...p, unit: e.target.value as Supply['unit'] }))}
                    className="border border-stone-300 rounded-lg px-2 py-1 text-sm"
                  >
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </td>
                {(['current_stock', 'min_stock', 'unit_cost'] as const).map(f => (
                  <td key={f} className="px-5 py-3">
                    <input
                      type="number"
                      value={newItem[f] ?? ''}
                      onChange={e => setNewItem(p => ({ ...p, [f]: Number(e.target.value) }))}
                      className="border border-stone-300 rounded-lg px-2 py-1 w-24 text-sm"
                      min={0}
                      step={0.01}
                    />
                  </td>
                ))}
                <td className="px-5 py-3 flex gap-2">
                  <button onClick={saveNew} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setAdding(false)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
                </td>
              </tr>
            )}
            {supplies.map(s => {
              const isLow = s.current_stock <= s.min_stock
              const isEditing = editing === s.id

              return (
                <tr key={s.id} className={isLow ? 'bg-red-50' : 'hover:bg-stone-50'}>
                  <td className="px-5 py-3 font-medium text-stone-800">
                    {isLow && <AlertTriangle className="w-3.5 h-3.5 text-red-500 inline mr-1" />}
                    {isEditing
                      ? <input value={editData.name ?? s.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} className="border border-stone-300 rounded px-2 py-0.5 text-sm w-full" />
                      : s.name
                    }
                  </td>
                  <td className="px-5 py-3 text-stone-500">{s.unit}</td>
                  {(['current_stock', 'min_stock', 'unit_cost'] as const).map(f => (
                    <td key={f} className={`px-5 py-3 ${f === 'current_stock' && isLow ? 'text-red-600 font-semibold' : 'text-stone-700'}`}>
                      {isEditing
                        ? <input type="number" value={editData[f] ?? s[f]} onChange={e => setEditData(p => ({ ...p, [f]: Number(e.target.value) }))} className="border border-stone-300 rounded px-2 py-0.5 text-sm w-24" step={0.01} min={0} />
                        : f === 'unit_cost' ? `$${s[f].toFixed(2)}` : `${s[f]} ${s.unit}`
                      }
                    </td>
                  ))}
                  <td className="px-5 py-3">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(s.id)} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditing(null)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
                      </div>
                    ) : confirming === s.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500">¿Eliminar?</span>
                        <button onClick={() => deleteSupply(s.id)} className="text-xs text-red-600 font-semibold hover:underline">Sí</button>
                        <button onClick={() => setConfirming(null)} className="text-xs text-stone-400 hover:underline">No</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => { setEditing(s.id); setEditData(s) }} className="text-stone-400 hover:text-amber-600">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setConfirming(s.id)} className="text-stone-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
