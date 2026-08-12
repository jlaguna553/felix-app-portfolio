'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Product, Category, CartItem, Tab, Order, Promotion } from '@/lib/types'
import { ProductGrid } from './ProductGrid'
import { Cart } from './Cart'
import { CategoryFilter } from './CategoryFilter'
import { TabSelector } from './TabSelector'
import { VariantPicker } from './VariantPicker'
import { OrderReadyAlert } from './OrderReadyAlert'
import { ShoppingBag, LayoutDashboard, LogOut, ArrowLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface Props {
  products: Product[]
  categories: Category[]
  promotions: Promotion[]
  branchId: string
  isAdmin?: boolean
  autoTabId?: string
}

export function POSScreen({ products, categories, promotions, branchId, isAdmin = false, autoTabId }: Props) {
  const router = useRouter()
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<Tab | null>(null)
  const autoTabFired = useRef(false)
  const [tabOrders, setTabOrders] = useState<Order[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null)
  const [shiftOpen, setShiftOpen] = useState<boolean | null>(null)

  // Check for an active shift on mount and keep watching
  useEffect(() => {
    const supabase = createClient()
    async function checkShift() {
      const { data } = await supabase
        .from('shifts')
        .select('id')
        .eq('status', 'open')
        .eq('branch_id', branchId)
        .limit(1)
        .maybeSingle()
      setShiftOpen(!!data)
    }
    checkShift()
    const channel = supabase
      .channel('pos-shift-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, checkShift)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [branchId])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Fetch existing orders for a tab when activating it
  const handleSelectTab = useCallback(async (tab: Tab) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select('*, items:order_items(*, product:products(*))')
      .eq('tab_id', tab.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
    setTabOrders((data ?? []) as Order[])
    setActiveTab(tab)
    setCart([])
    setCartOpen(false)
  }, [])

  // Auto-select a tab when arriving from the floor plan (?tabId=...)
  useEffect(() => {
    if (!autoTabId || autoTabFired.current) return
    autoTabFired.current = true
    createClient()
      .from('tabs')
      .select('*')
      .eq('id', autoTabId)
      .eq('status', 'open')
      .single()
      .then(({ data }) => { if (data) handleSelectTab(data as Tab) })
  }, [autoTabId, handleSelectTab])

  function handleOrderSent(order: Order) {
    setTabOrders(prev => [...prev, order])
    setCart([])
    setCartOpen(false)
  }

  function handleCloseTab() {
    setActiveTab(null)
    setTabOrders([])
    setCart([])
    setCartOpen(false)
  }

  // Live order status updates for active tab (kitchen / caja changes)
  useEffect(() => {
    if (!activeTab) return
    const supabase = createClient()
    const channel = supabase
      .channel(`tab-live-${activeTab.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `tab_id=eq.${activeTab.id}` },
        (payload) => {
          setTabOrders(prev =>
            prev.map(o => o.id === payload.new.id ? { ...o, ...(payload.new as Partial<Order>) } : o)
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tabs', filter: `id=eq.${activeTab.id}` },
        (payload) => {
          if (payload.new.status === 'closed') handleCloseTab()
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id])

  function handleProductTap(product: Product) {
    if (product.variants && product.variants.length > 0) {
      setPendingProduct(product)
    } else {
      addToCart(product)
    }
  }

  function addToCart(product: Product, note?: string) {
    setCart(prev => {
      const key = (i: CartItem) => `${i.product.id}::${i.notes ?? ''}`
      const targetKey = `${product.id}::${note ?? ''}`
      const existing = prev.find(i => key(i) === targetKey)
      if (existing) return prev.map(i => key(i) === targetKey ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product, quantity: 1, notes: note }]
    })
  }

  function removeFromCart(productId: string, notes?: string) {
    setCart(prev => prev.filter(i => !(i.product.id === productId && (i.notes ?? '') === (notes ?? ''))))
  }

  function updateQuantity(productId: string, qty: number, notes?: string) {
    if (qty <= 0) return removeFromCart(productId, notes)
    setCart(prev => prev.map(i =>
      i.product.id === productId && (i.notes ?? '') === (notes ?? '')
        ? { ...i, quantity: qty }
        : i
    ))
  }

  const filtered = activeCategory
    ? products.filter(p => p.category_id === activeCategory)
    : products

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0)
  const roundTotal = cart.reduce((s, i) => s + i.product.sale_price * i.quantity, 0)
  const tabTotal   = tabOrders.reduce((s, o) => s + o.total_amount, 0)

  // ── Tab selector ─────────────────────────────────────────────
  if (!activeTab) {
    return (
      <div className="flex h-screen bg-stone-100 overflow-hidden flex-col">
        <OrderReadyAlert />
        {pendingProduct && (
          <VariantPicker
            product={pendingProduct}
            onConfirm={note => { addToCart(pendingProduct, note); setPendingProduct(null) }}
            onCancel={() => setPendingProduct(null)}
          />
        )}
        <header className="bg-brand-700 text-white px-4 py-3 flex items-center gap-3 shrink-0">
          {isAdmin ? (
            <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-brand-600 transition-colors" title="Dashboard">
              <LayoutDashboard className="w-5 h-5" />
            </Link>
          ) : (
            <span className="text-2xl">🫓</span>
          )}
          <h1 className="font-bold text-lg flex-1">{t.pos.title}</h1>
          <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-brand-600 transition-colors" title={t.nav.logout}>
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        {/* Gate: block POS until caja opens a shift */}
        {shiftOpen === false ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center pb-16">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <p className="text-lg font-bold text-stone-800">{t.pos.noShiftTitle}</p>
            <p className="text-sm text-stone-500 max-w-xs">{t.pos.noShiftBody}</p>
          </div>
        ) : (
          <TabSelector onSelect={handleSelectTab} branchId={branchId} />
        )}
      </div>
    )
  }

  // ── Ordering mode ─────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden">
      <OrderReadyAlert />
      {pendingProduct && (
        <VariantPicker
          product={pendingProduct}
          onConfirm={note => { addToCart(pendingProduct, note); setPendingProduct(null) }}
          onCancel={() => setPendingProduct(null)}
        />
      )}

      {/* Product catalog */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-brand-700 text-white px-4 py-3 flex items-center gap-3 shrink-0">
          <button
            onClick={() => autoTabId ? router.push('/floor') : setActiveTab(null)}
            className="p-1.5 rounded-lg hover:bg-brand-600 transition-colors"
            title={autoTabId ? t.pos.backToFloor : t.pos.backToTabs}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-tight truncate">{activeTab.label}</p>
            {tabOrders.length > 0 && (
              <p className="text-brand-300 text-xs">{t.pos.accumulated(`$${tabTotal.toFixed(2)}`)}</p>
            )}
          </div>
          {isAdmin && (
            <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-brand-600 transition-colors" title="Dashboard">
              <LayoutDashboard className="w-5 h-5" />
            </Link>
          )}
          <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-brand-600 transition-colors" title={t.nav.logout}>
            <LogOut className="w-5 h-5" />
          </button>
          {/* Mobile cart button */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative lg:hidden p-2 rounded-xl bg-brand-600 hover:bg-brand-500 transition-colors"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </button>
        </header>

        <CategoryFilter categories={categories} active={activeCategory} onChange={setActiveCategory} />
        <ProductGrid products={filtered} onAdd={handleProductTap} />
      </div>

      {/* Desktop: side cart */}
      <div className="hidden lg:flex">
        <Cart
          items={cart}
          onRemove={(id, notes) => removeFromCart(id, notes)}
          onUpdate={(id, qty, notes) => updateQuantity(id, qty, notes)}
          onClear={() => setCart([])}
          tab={activeTab}
          tabOrders={tabOrders}
          onOrderSent={handleOrderSent}
          onCloseTab={handleCloseTab}
          promotions={promotions}
          shiftOpen={shiftOpen}
        />
      </div>

      {/* Mobile: bottom sheet cart */}
      <div className="lg:hidden">
        {cartOpen && (
          <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setCartOpen(false)} />
        )}
        <div
          className={`fixed inset-x-0 bottom-0 z-40 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out flex flex-col
            ${cartOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ maxHeight: '90vh' }}
        >
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-stone-300 rounded-full" />
          </div>
          <Cart
            items={cart}
            onRemove={removeFromCart}
            onUpdate={updateQuantity}
            onClear={() => setCart([])}
            onClose={() => setCartOpen(false)}
            tab={activeTab}
            tabOrders={tabOrders}
            onOrderSent={handleOrderSent}
            onCloseTab={handleCloseTab}
            promotions={promotions}
          />
        </div>

        {/* Floating button */}
        {!cartOpen && (
          <button
            onClick={() => setCartOpen(true)}
            className="fixed bottom-5 right-5 z-30 flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-3 rounded-2xl shadow-lg transition-colors"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalItems > 0
              ? <><span>{t.pos.itemCount(totalItems)}</span><span className="ml-1 text-amber-200">${roundTotal.toFixed(2)}</span></>
              : <span>{t.pos.account}</span>
            }
            {tabOrders.length > 0 && totalItems === 0 && (
              <span className="text-amber-200 text-xs ml-1">{t.pos.totalAmount(`$${tabTotal.toFixed(2)}`)}</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
