'use client'

import { useState, useTransition } from 'react'
import { Product, Category } from '@/lib/types'
import { Plus, LayoutGrid, List, Tag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ProductCard } from './ProductCard'
import { ProductRow } from './ProductRow'
import { ProductModal } from './ProductModal'
import { CategoryManager } from './CategoryManager'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface Props {
  products: Product[]
  categories: Category[]
  branchId: string
}

type View = 'grid' | 'list'
type Panel = 'products' | 'categories'

export function ProductsManager({ products, categories, branchId }: Props) {
  const { t } = useI18n()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [view, setView] = useState<View>('grid')
  const [panel, setPanel] = useState<Panel>('products')
  const [modal, setModal] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  })
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = filterCategory === 'all' || p.category_id === filterCategory
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && p.is_active) ||
      (filterStatus === 'inactive' && !p.is_active)
    return matchesSearch && matchesCategory && matchesStatus
  })

  function refresh() {
    startTransition(() => router.refresh())
  }

  function openNew() {
    setModal({ open: true, product: null })
  }

  function openEdit(product: Product) {
    setModal({ open: true, product })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-stone-800">{t.products.title}</h1>
            <p className="text-sm text-stone-400">{t.products.registered(products.length)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPanel(panel === 'categories' ? 'products' : 'categories')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                panel === 'categories'
                  ? 'bg-amber-100 border-amber-300 text-amber-800'
                  : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              <Tag className="w-4 h-4" />
              {t.categories.title}
            </button>
            <button
              onClick={openNew}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t.products.newProduct}
            </button>
          </div>
        </div>

        {panel === 'products' && (
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.products.searchPlaceholder}
              className="border border-stone-300 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="all">{t.products.allCategories}</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
              className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="all">{t.common.all}</option>
              <option value="active">{t.products.filterActive}</option>
              <option value="inactive">{t.products.filterInactive}</option>
            </select>
            <span className="text-sm text-stone-400 ml-auto">
              {t.products.results(filtered.length)}
            </span>
            <div className="flex rounded-lg border border-stone-200 overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={`p-2 ${view === 'grid' ? 'bg-amber-100 text-amber-700' : 'bg-white text-stone-400 hover:bg-stone-50'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2 ${view === 'list' ? 'bg-amber-100 text-amber-700' : 'bg-white text-stone-400 hover:bg-stone-50'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {panel === 'categories' ? (
          <CategoryManager categories={categories} branchId={branchId} onRefresh={refresh} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-stone-400">
            <p className="text-lg">{t.products.noProducts}</p>
            <p className="text-sm mt-1">{t.products.adjustFilters}</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} onEdit={openEdit} onRefresh={refresh} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-stone-500 uppercase text-xs">
                <tr>
                  {[t.products.colProduct, t.products.colCategory, t.common.price, t.common.status, t.common.actions].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map(p => (
                  <ProductRow key={p.id} product={p} onEdit={openEdit} onRefresh={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <ProductModal
          product={modal.product}
          categories={categories}
          branchId={branchId}
          onClose={() => setModal({ open: false, product: null })}
          onSave={() => {
            setModal({ open: false, product: null })
            refresh()
          }}
        />
      )}
    </div>
  )
}
