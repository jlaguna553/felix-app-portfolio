'use client'

import { useState } from 'react'
import { Category } from '@/lib/types'
import { Plus, Trash2, Pencil, GripVertical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface Props {
  categories: Category[]
  branchId: string
  onRefresh: () => void
}

export function CategoryManager({ categories, branchId, onRefresh }: Props) {
  const { t } = useI18n()
  const supabase = createClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Category>>({})
  const [adding, setAdding] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', emoji: '' })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function saveEdit(id: string) {
    await supabase.from('categories').update({ name: editData.name, emoji: editData.emoji }).eq('id', id)
    setEditing(null)
    onRefresh()
  }

  async function saveNew() {
    if (!newCat.name.trim()) return
    await supabase.from('categories').insert({
      name: newCat.name.trim(),
      emoji: newCat.emoji.trim() || null,
      sort_order: categories.length + 1,
      branch_id: branchId,
    })
    setAdding(false)
    setNewCat({ name: '', emoji: '' })
    onRefresh()
  }

  async function handleDelete(id: string) {
    await supabase.from('categories').delete().eq('id', id)
    setConfirmDelete(null)
    onRefresh()
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-4 border-b border-stone-100">
          <div>
            <h2 className="font-semibold text-stone-800">{t.categories.title}</h2>
            <p className="text-xs text-stone-400 mt-0.5">{t.categories.subtitle}</p>
          </div>
          <button
            onClick={() => { setAdding(true); setEditing(null) }}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> {t.categories.newBtn}
          </button>
        </div>

        <div className="divide-y divide-stone-100">
          {/* New category form */}
          {adding && (
            <div className="px-4 py-3 bg-amber-50 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newCat.emoji}
                  onChange={e => setNewCat(p => ({ ...p, emoji: e.target.value }))}
                  className="w-12 shrink-0 border border-stone-300 rounded-lg px-2 py-2 text-sm text-center"
                  placeholder="🫓"
                  maxLength={4}
                />
                <input
                  value={newCat.name}
                  onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && saveNew()}
                  className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={t.categories.namePlaceholder}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setAdding(false)}
                  className="flex-1 py-2 rounded-lg border border-stone-300 text-stone-600 text-sm hover:bg-stone-50 transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={saveNew}
                  className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
                >
                  {t.common.save}
                </button>
              </div>
            </div>
          )}

          {categories.length === 0 && !adding && (
            <div className="px-5 py-8 text-center text-stone-400 text-sm">
              {t.categories.empty}
            </div>
          )}

          {categories.map(cat => (
            <div key={cat.id} className="px-4 py-3">
              {editing === cat.id ? (
                /* Edit form */
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={editData.emoji ?? ''}
                      onChange={e => setEditData(p => ({ ...p, emoji: e.target.value }))}
                      className="w-12 shrink-0 border border-stone-300 rounded-lg px-2 py-2 text-sm text-center"
                      maxLength={4}
                    />
                    <input
                      autoFocus
                      value={editData.name ?? ''}
                      onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && saveEdit(cat.id)}
                      className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-lg border border-stone-300 text-stone-600 text-sm hover:bg-stone-50 transition-colors">
                      {t.common.cancel}
                    </button>
                    <button onClick={() => saveEdit(cat.id)} className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors">
                      {t.common.save}
                    </button>
                  </div>
                </div>
              ) : confirmDelete === cat.id ? (
                /* Delete confirm */
                <div className="flex items-center gap-3">
                  <span className="text-xl shrink-0">{cat.emoji}</span>
                  <span className="flex-1 text-sm text-stone-500 truncate">{t.categories.confirmDelete(cat.name)}</span>
                  <button onClick={() => handleDelete(cat.id)} className="text-xs text-red-600 font-semibold hover:underline shrink-0">{t.common.yes}</button>
                  <button onClick={() => setConfirmDelete(null)} className="text-xs text-stone-400 hover:underline shrink-0">{t.common.no}</button>
                </div>
              ) : (
                /* Normal row */
                <div className="flex items-center gap-3 hover:bg-stone-50 -mx-4 px-4 -my-3 py-3 rounded-lg">
                  <GripVertical className="w-4 h-4 text-stone-300 shrink-0" />
                  <span className="text-xl w-8 text-center shrink-0">{cat.emoji ?? '📁'}</span>
                  <span className="flex-1 text-sm font-medium text-stone-700 truncate">{cat.name}</span>
                  <button
                    onClick={() => { setEditing(cat.id); setEditData({ name: cat.name, emoji: cat.emoji ?? '' }) }}
                    className="text-stone-400 hover:text-amber-600 transition-colors shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(cat.id)}
                    className="text-stone-400 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
