'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderStatus } from '@/lib/types'
import { ChefHat, Clock, CheckCircle2, Bell, LogOut, LayoutDashboard, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'

const STATUS_COLORS: Record<string, string> = {
  pending:   'border-amber-500 bg-amber-950',
  preparing: 'border-blue-500 bg-blue-950',
  ready:     'border-green-500 bg-green-950',
}
const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-500 text-black',
  preparing: 'bg-blue-500 text-white',
  ready:     'bg-green-500 text-white',
}

function playBeep() {
  try {
    const ctx = new AudioContext()
    const times = [0, 0.18, 0.36]
    times.forEach(t => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime + t)
      gain.gain.setValueAtTime(0.35, ctx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.15)
    })
  } catch {
    // AudioContext not available (SSR or restricted browser)
  }
}

function elapsed(created_at: string) {
  const diff = Math.floor((Date.now() - new Date(created_at).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  return `${Math.floor(diff / 60)}m ${diff % 60}s`
}

function useElapsed(created_at: string, running: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  return elapsed(created_at)
}

function OrderCard({ order, onStatusChange }: {
  order: Order
  onStatusChange: (id: string, status: OrderStatus) => void
}) {
  const { t } = useI18n()
  const isReady = order.status === 'ready'
  const time = useElapsed(order.created_at, !isReady)
  const isUrgent = !isReady && Date.now() - new Date(order.created_at).getTime() > 10 * 60 * 1000

  // Show the origin context: numeric = "Mesa X", text = show as-is (Mostrador, name, etc.)
  const tableLabel = order.table_number
    ? (/^\d+$/.test(order.table_number) ? t.pos.tableN(order.table_number) : order.table_number)
    : null

  return (
    <div className={`rounded-2xl border-2 p-4 flex flex-col gap-3 ${STATUS_COLORS[order.status]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-3xl font-black text-white">#{order.order_number}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[order.status]}`}>
              {t.orderStatus[order.status as keyof typeof t.orderStatus] ?? order.status}
            </span>
            {order.prepaid && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                {t.kitchen.prepaid}
              </span>
            )}
          </div>
          {tableLabel && (
            <p className="text-sm text-stone-300 mt-0.5">{tableLabel}</p>
          )}
        </div>
        <div className={`flex items-center gap-1 text-sm font-mono ${isUrgent ? 'text-red-400 animate-pulse' : 'text-stone-400'}`}>
          <Clock className="w-3.5 h-3.5" />
          {time}
        </div>
      </div>

      <ul className="space-y-1.5">
        {order.items?.map(item => (
          <li key={item.id} className="flex items-start gap-2">
            <span className="text-lg font-bold text-white w-6 shrink-0">{item.quantity}×</span>
            <div className="min-w-0">
              <p className="text-base text-white font-medium leading-tight">{item.product?.name}</p>
              {item.notes && (
                <p className="text-xs text-amber-300 mt-0.5 italic">⚠ {item.notes}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex gap-2 mt-auto pt-1">
        {order.status === 'pending' && (
          <button
            onClick={() => onStatusChange(order.id, 'preparing')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-semibold text-sm"
          >
            <ChefHat className="w-4 h-4" />
            {t.orderStatus.preparing}
          </button>
        )}
        {order.status === 'preparing' && (
          <button
            onClick={() => onStatusChange(order.id, 'ready')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 active:scale-95 transition-all text-white font-semibold text-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            {order.prepaid ? t.pos.readyDeliver : t.kitchen.markReady}
          </button>
        )}
        {order.status === 'ready' && (
          <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-800 text-green-300 font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            {t.pos.readyToDeliver}
          </div>
        )}
      </div>
    </div>
  )
}

interface NewOrderBanner {
  id: string
  order_number: number
  table_number: string | null
}

export function KitchenDisplay({ initialOrders, isAdmin = false, branchId: _branchId }: { initialOrders: Order[]; isAdmin?: boolean; branchId: string }) {
  const router = useRouter()
  const { t } = useI18n()
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [banners, setBanners] = useState<NewOrderBanner[]>([])
  const bannerTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const showBanner = useCallback((order: NewOrderBanner) => {
    playBeep()
    setBanners(prev => prev.find(b => b.id === order.id) ? prev : [...prev, order])
    const timer = setTimeout(() => {
      setBanners(prev => prev.filter(b => b.id !== order.id))
      bannerTimers.current.delete(order.id)
    }, 8000)
    bannerTimers.current.set(order.id, timer)
  }, [])

  function dismissBanner(id: string) {
    clearTimeout(bannerTimers.current.get(id))
    bannerTimers.current.delete(id)
    setBanners(prev => prev.filter(b => b.id !== id))
  }

  useEffect(() => {
    const supabase = createClient()

    async function fetchAndAddOrder(orderId: string) {
      const { data } = await supabase
        .from('orders')
        .select('*, items:order_items(*, product:products(*))')
        .eq('id', orderId)
        .single()
      if (!data) return
      const order = data as Order
      setOrders(prev => prev.find(o => o.id === order.id) ? prev : [order, ...prev])
      showBanner({ id: order.id, order_number: order.order_number, table_number: order.table_number })
    }

    const channel = supabase
      .channel('kitchen-updates')
      // ── Broadcast: pedido nuevo enviado por el POS ───────────────
      // Es el mecanismo principal: se manda DESPUÉS de insertar los items,
      // así el fetch ya encuentra el pedido completo.
      .on('broadcast', { event: 'new_order' }, ({ payload }) => {
        fetchAndAddOrder((payload as { order_id: string }).order_id)
      })
      // ── postgres_changes: cambios de estado (preparando/listo/etc.) ─
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          setOrders(prev =>
            prev
              .map(o => o.id === payload.new.id ? { ...o, ...(payload.new as Partial<Order>) } : o)
              .filter(o => ['pending', 'preparing', 'ready'].includes(o.status))
          )
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' },
        (payload) => setOrders(prev => prev.filter(o => o.id !== payload.old.id))
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [showBanner])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleStatusChange(id: string, status: OrderStatus) {
    // Prepaid orders skip the 'ready' state — money was already collected,
    // so "Listo" = entregado = paid. The card disappears from kitchen immediately.
    const order = orders.find(o => o.id === id)
    const finalStatus: OrderStatus = status === 'ready' && order?.prepaid ? 'paid' : status

    // Update local state immediately so the card reacts without waiting for Realtime
    setOrders(prev =>
      prev
        .map(o => o.id === id ? { ...o, status: finalStatus } : o)
        .filter(o => ['pending', 'preparing', 'ready'].includes(o.status))
    )
    const supabase = createClient()
    await supabase.from('orders').update({ status: finalStatus }).eq('id', id)
  }

  const pending   = orders.filter(o => o.status === 'pending')
  const preparing = orders.filter(o => o.status === 'preparing')
  const ready     = orders.filter(o => o.status === 'ready')

  return (
    <div className="min-h-screen flex flex-col">
      {/* New order banners */}
      {banners.length > 0 && (
        <div className="fixed top-0 inset-x-0 z-50 flex flex-col gap-1">
          {banners.map(b => (
            <div key={b.id} className="bg-amber-500 text-black px-4 py-3 flex items-center gap-3 animate-bounce-once shadow-2xl">
              <Bell className="w-6 h-6 shrink-0 animate-bounce" />
              <p className="flex-1 font-black text-lg">
                {t.kitchen.newOrderBanner(b.order_number)}
                {b.table_number && <span className="font-normal text-base ml-2">{/^\d+$/.test(b.table_number) ? t.pos.tableN(b.table_number) : b.table_number}</span>}
              </p>
              <button onClick={() => dismissBanner(b.id)} className="p-1 hover:bg-amber-400 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="bg-stone-800 border-b border-stone-700 px-4 py-3 flex items-center gap-3 shrink-0">
        {isAdmin ? (
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
            title={t.kitchen.backToDashboard}
          >
            <LayoutDashboard className="w-5 h-5" />
          </Link>
        ) : (
          <ChefHat className="w-6 h-6 text-amber-400" />
        )}
        <h1 className="text-lg font-bold text-white">{t.kitchen.title}</h1>
        <div className="ml-auto flex items-center gap-4 text-sm text-stone-400">
          <span className="text-amber-400 font-semibold">{t.kitchen.pendingCount(pending.length)}</span>
          <span className="text-blue-400 font-semibold">{t.kitchen.preparingCount(preparing.length)}</span>
          <span className="text-green-400 font-semibold">{t.kitchen.readyCount(ready.length)}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-stone-700 text-stone-400 hover:text-white transition-colors text-xs"
            title={t.nav.logout}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.kitchen.exit}</span>
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-stone-500 gap-3">
          <ChefHat className="w-16 h-16 text-stone-700" />
          <p className="text-lg">{t.kitchen.noActiveOrders}</p>
        </div>
      ) : (
        <div className="flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
          {[...pending, ...preparing, ...ready].map(order => (
            <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  )
}
