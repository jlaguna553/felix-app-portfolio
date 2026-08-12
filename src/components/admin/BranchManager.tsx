'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Branch } from '@/lib/types'
import { Plus, Pencil, Building2, MapPin, Phone, BarChart2, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

interface Props {
  branches: Branch[]
}

interface BranchForm {
  name: string
  address: string
  phone: string
  business_name: string
}

const empty: BranchForm = { name: '', address: '', phone: '', business_name: '' }

export function BranchManager({ branches }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<BranchForm>(empty)
  const [saving, setSaving] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState<string | null>(null)

  function startEdit(branch: Branch) {
    setEditing(branch.id)
    setAdding(false)
    setForm({
      name:          branch.name,
      address:       branch.address ?? '',
      phone:         branch.phone ?? '',
      business_name: branch.business_name ?? '',
    })
  }

  function startAdd() {
    setAdding(true)
    setEditing(null)
    setForm(empty)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)

    if (editing) {
      await supabase.from('branches').update({
        name:          form.name.trim(),
        address:       form.address.trim() || null,
        phone:         form.phone.trim() || null,
        business_name: form.business_name.trim() || null,
      }).eq('id', editing)
      setEditing(null)
    } else {
      await supabase.from('branches').insert({
        name:          form.name.trim(),
        address:       form.address.trim() || null,
        phone:         form.phone.trim() || null,
        business_name: form.business_name.trim() || null,
      })
      setAdding(false)
    }

    setSaving(false)
    setForm(empty)
    router.refresh()
  }

  async function handleToggleActive(branch: Branch) {
    await supabase
      .from('branches')
      .update({ is_active: !branch.is_active })
      .eq('id', branch.id)
    setConfirmToggle(null)
    router.refresh()
  }

  function cancel() {
    setAdding(false)
    setEditing(null)
    setForm(empty)
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800">Sucursales</h1>
          <p className="text-sm text-stone-500 mt-0.5">Gestiona las ubicaciones de tu negocio</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/branches/compare"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 text-sm transition-colors"
          >
            <BarChart2 className="w-4 h-4" />
            Comparar
          </Link>
          <button
            onClick={startAdd}
            className="flex items-center gap-1.5 bg-brand-700 hover:bg-brand-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Nueva sucursal
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <BranchForm
          form={form}
          onChange={setForm}
          onSave={handleSave}
          onCancel={cancel}
          saving={saving}
          title="Nueva sucursal"
        />
      )}

      {/* Branch list */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        {branches.length === 0 && !adding ? (
          <div className="px-5 py-12 text-center text-stone-400 text-sm">
            <Building2 className="w-12 h-12 mx-auto text-stone-200 mb-3" />
            <p>No hay sucursales. Crea la primera.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {branches.map(branch => (
              <div key={branch.id}>
                {editing === branch.id ? (
                  <div className="px-4 py-4">
                    <BranchForm
                      form={form}
                      onChange={setForm}
                      onSave={handleSave}
                      onCancel={cancel}
                      saving={saving}
                      title={`Editar: ${branch.name}`}
                    />
                  </div>
                ) : confirmToggle === branch.id ? (
                  <div className="px-4 py-3 flex items-center gap-3 bg-amber-50">
                    <span className="flex-1 text-sm text-stone-600">
                      {branch.is_active ? `¿Desactivar "${branch.name}"?` : `¿Activar "${branch.name}"?`}
                    </span>
                    <button
                      onClick={() => handleToggleActive(branch)}
                      className="text-xs font-semibold text-amber-700 hover:underline"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmToggle(null)}
                      className="text-xs text-stone-400 hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-4 flex items-start gap-3 hover:bg-stone-50 group">
                    <div className={`mt-0.5 shrink-0 ${branch.is_active ? 'text-green-500' : 'text-stone-300'}`}>
                      {branch.is_active
                        ? <CheckCircle className="w-5 h-5" />
                        : <XCircle className="w-5 h-5" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-stone-800 text-sm">{branch.name}</p>
                      {branch.business_name && (
                        <p className="text-xs text-stone-500 mt-0.5">{branch.business_name}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                        {branch.address && (
                          <span className="flex items-center gap-1 text-xs text-stone-400">
                            <MapPin className="w-3 h-3 shrink-0" />{branch.address}
                          </span>
                        )}
                        {branch.phone && (
                          <span className="flex items-center gap-1 text-xs text-stone-400">
                            <Phone className="w-3 h-3 shrink-0" />{branch.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(branch)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-brand-600 hover:bg-stone-100 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmToggle(branch.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          branch.is_active
                            ? 'text-stone-400 hover:text-amber-600 hover:bg-amber-50'
                            : 'text-stone-400 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={branch.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {branch.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BranchForm({
  form, onChange, onSave, onCancel, saving, title,
}: {
  form: BranchForm
  onChange: (f: BranchForm) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  title: string
}) {
  return (
    <div className="bg-brand-50 rounded-xl p-4 space-y-3 border border-brand-100">
      <p className="text-sm font-semibold text-stone-700">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-medium text-stone-500 mb-1 block">Nombre *</label>
          <input
            autoFocus
            value={form.name}
            onChange={e => onChange({ ...form, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && onSave()}
            placeholder="Sucursal Centro"
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-medium text-stone-500 mb-1 block">Nombre del negocio</label>
          <input
            value={form.business_name}
            onChange={e => onChange({ ...form, business_name: e.target.value })}
            placeholder="Gorditas Doña Félix"
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-medium text-stone-500 mb-1 block">Dirección</label>
          <input
            value={form.address}
            onChange={e => onChange({ ...form, address: e.target.value })}
            placeholder="Av. Principal 123"
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-medium text-stone-500 mb-1 block">Teléfono</label>
          <input
            value={form.phone}
            onChange={e => onChange({ ...form, phone: e.target.value })}
            placeholder="555-000-0000"
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-stone-300 text-stone-600 text-sm hover:bg-stone-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="flex-1 py-2 rounded-lg bg-brand-700 hover:bg-brand-600 disabled:bg-stone-300 disabled:text-stone-400 text-white text-sm font-semibold transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
