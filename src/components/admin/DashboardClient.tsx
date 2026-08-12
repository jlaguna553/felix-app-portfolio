'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp, ShoppingBag, Package, AlertTriangle,
  DollarSign, Clock, Users, XCircle, ChevronLeft, ChevronRight,
  RotateCcw, Save,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'

// ─── types ────────────────────────────────────────────────────────────────────

interface Order {
  id: string
  order_number: number
  table_number: string | null
  total_amount: number
  status: string
  created_at: string
}

interface Shift {
  id: string
  opened_at: string
  closed_at: string
  total_orders: number
  paid_orders: number
  cancelled_orders: number
  total_revenue: number
  notes: string | null
}

interface Supply {
  id: string
  name: string
  current_stock: number
  min_stock: number
  unit: string
}

interface DayData {
  orders: Order[]
  shifts: Shift[]
  activeOrders: Order[]   // only populated for today
  openTabs: number        // only populated for today
  lowStock: Supply[]
  totalProducts: number
  topProducts: { name: string; qty: number }[]
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function toLocalISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayBounds(dateStr: string): { start: Date; end: Date } {
  const start = new Date(dateStr + 'T00:00:00')
  const end   = new Date(dateStr + 'T23:59:59.999')
  return { start, end }
}

function fmtTime(iso: string, intl: string) {
  return new Date(iso).toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit' })
}
function duration(from: string, to: string) {
  const mins = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready:     'bg-green-100 text-green-700',
  paid:      'bg-stone-100 text-stone-500',
  cancelled: 'bg-red-100 text-red-600',
}

// ─── main component ───────────────────────────────────────────────────────────

export function DashboardClient({ branchId }: { branchId: string }) {
  const { t, intl } = useI18n()
  const todayStr = toLocalISODate(new Date())
  const [dateStr, setDateStr] = useState(todayStr)
  const [data, setData]       = useState<DayData | null>(null)
  const [loading, setLoading] = useState(true)
  const isToday = dateStr === todayStr

  const load = useCallback(async (date: string) => {
    setLoading(true)
    const supabase = createClient()
    const { start, end } = dayBounds(date)
    const isNow = date === toLocalISODate(new Date())

    const [
      { data: orders },
      { data: shifts },
      { data: lowStock },
      { count: totalProducts },
    ] = await Promise.all([
      supabase.from('orders')
        .select('id, order_number, table_number, total_amount, status, created_at')
        .eq('branch_id', branchId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false }),
      supabase.from('shifts')
        .select('*')
        .eq('branch_id', branchId)
        .gte('closed_at', start.toISOString())
        .lte('closed_at', end.toISOString())
        .order('closed_at', { ascending: false }),
      supabase.from('supplies')
        .select('id, name, current_stock, min_stock, unit')
        .eq('branch_id', branchId)
        .filter('current_stock', 'lte', 'min_stock'),
      supabase.from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('branch_id', branchId),
    ])

    // top products for this day
    const orderIds = (orders ?? []).map(o => o.id)
    let topProducts: { name: string; qty: number }[] = []
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('quantity, product:products(name)')
        .in('order_id', orderIds)
      const map = new Map<string, number>()
      items?.forEach(i => {
        const prod = i.product as unknown as { name: string } | { name: string }[] | null
        const name = Array.isArray(prod) ? prod[0]?.name : prod?.name ?? null
        if (name) map.set(name, (map.get(name) ?? 0) + i.quantity)
      })
      topProducts = Array.from(map.entries())
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5)
    }

    // today-only: active orders + open tabs
    let activeOrders: Order[] = []
    let openTabs = 0
    if (isNow) {
      const [{ data: active }, { count: tabs }] = await Promise.all([
        supabase.from('orders')
          .select('id, order_number, table_number, total_amount, status, created_at')
          .eq('branch_id', branchId)
          .in('status', ['pending', 'preparing', 'ready'])
          .order('created_at', { ascending: false }),
        supabase.from('tabs').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('branch_id', branchId),
      ])
      activeOrders = (active ?? []) as Order[]
      openTabs     = tabs ?? 0
    }

    setData({
      orders:        (orders ?? []) as Order[],
      shifts:        (shifts ?? []) as Shift[],
      activeOrders,
      openTabs,
      lowStock:      ((lowStock ?? []).filter(s => s.current_stock <= s.min_stock)),
      totalProducts: totalProducts ?? 0,
      topProducts,
    })
    setLoading(false)
  }, [])

  // Initial load + date change
  useEffect(() => { load(dateStr) }, [dateStr, load])

  // Real-time: only subscribe when viewing today
  useEffect(() => {
    if (!isToday) return
    const supabase = createClient()
    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },  () => load(dateStr))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' },  () => load(dateStr))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tabs' },    () => load(dateStr))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplies'}, () => load(dateStr))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isToday, dateStr, load])

  function prevDay() {
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setDateStr(toLocalISODate(d))
  }
  function nextDay() {
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    if (toLocalISODate(d) <= todayStr) setDateStr(toLocalISODate(d))
  }

  // ── derived stats ──────────────────────────────────────────────────────────
  const allOrders    = data?.orders ?? []
  const paid         = allOrders.filter(o => o.status === 'paid')
  const cancelled    = allOrders.filter(o => o.status === 'cancelled')
  const dayRevenue   = paid.reduce((s, o) => s + o.total_amount, 0)

  // Revenue covered by closed shifts that day
  const shiftRevenue = (data?.shifts ?? []).reduce((s, sh) => s + sh.total_revenue, 0)
  // Unshifted (after last corte or not yet in a corte)
  const unshifted    = dayRevenue - shiftRevenue

  const displayDate = new Date(dateStr + 'T12:00:00').toLocaleDateString(intl, {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header with date nav */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-stone-800 flex-1">{t.dashboard.title}</h1>
        <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl px-1 py-1">
          <button onClick={prevDay} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-stone-700 px-2 min-w-[130px] text-center capitalize">
            {isToday ? t.dashboard.today : displayDate}
          </span>
          <button onClick={nextDay} disabled={isToday}
            className="p-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-30 text-stone-500">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <input
          type="date"
          value={dateStr}
          max={todayStr}
          onChange={e => e.target.value && setDateStr(e.target.value)}
          className="border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button onClick={() => load(dateStr)}
          className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-400">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-stone-300">
          <RotateCcw className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={isToday ? t.dashboard.revenueToday : t.dashboard.revenueOfDay}
              value={`$${dayRevenue.toFixed(2)}`}
              sub={t.corte.paidOrdersCount(paid.length)}
              icon={DollarSign} color="amber" />
            <StatCard title={t.dashboard.cortesOfDay}
              value={String(data?.shifts.length ?? 0)}
              sub={t.dashboard.inCortes(`$${shiftRevenue.toFixed(2)}`)}
              icon={Save} color="green" />
            {isToday
              ? <StatCard title={t.dashboard.openTables} value={String(data?.openTabs ?? 0)}
                  sub={t.dashboard.activeOrdersCount(data?.activeOrders.length ?? 0)}
                  icon={Users} color="blue" />
              : <StatCard title={t.dashboard.totalOrders} value={String(allOrders.length)}
                  sub={t.dashboard.cancelledSub(cancelled.length)}
                  icon={ShoppingBag} color="blue" />
            }
            <StatCard title={t.corte.cancelledLabel}
              value={String(cancelled.length)}
              sub={t.dashboard.cancelledOrdersSub}
              icon={XCircle} color={cancelled.length > 0 ? 'red' : 'stone'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: orders + shifts */}
            <div className="lg:col-span-2 space-y-4">

              {/* Active orders — today only */}
              {isToday && (data?.activeOrders.length ?? 0) > 0 && (
                <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-stone-700">{t.dashboard.activeOrdersTitle}</span>
                    <span className="ml-auto text-xs text-stone-400">{t.dashboard.inProgressCount(data!.activeOrders.length)}</span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {data!.activeOrders.map(o => (
                      <OrderRow key={o.id} order={o} />
                    ))}
                  </div>
                </div>
              )}

              {/* Cortes del día */}
              {(data?.shifts.length ?? 0) > 0 && (
                <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2">
                    <Save className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-stone-700">{t.dashboard.cortesOfDay}</span>
                    <span className="ml-auto text-xs text-stone-400">{t.dashboard.corteCount(data!.shifts.length)}</span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {data!.shifts.map((sh, i) => (
                      <div key={sh.id} className="px-5 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-stone-800">
                              {t.dashboard.corteN(data!.shifts.length - i, fmtTime(sh.closed_at, intl))}
                            </p>
                            <p className="text-xs text-stone-400 mt-0.5">
                              {t.dashboard.durationLabel(duration(sh.opened_at, sh.closed_at))}
                              {' · '}{t.floor.orderCount(sh.total_orders)}
                              {' · '}{t.caja.paidCount(sh.paid_orders)}
                              {sh.cancelled_orders > 0 && ` · ${t.caja.cancelledCount(sh.cancelled_orders)}`}
                            </p>
                            {sh.notes && (
                              <p className="text-xs text-stone-500 italic mt-0.5">&quot;{sh.notes}&quot;</p>
                            )}
                          </div>
                          <span className="text-base font-black text-green-700 shrink-0">
                            ${sh.total_revenue.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {unshifted > 0.01 && (
                    <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex justify-between text-sm">
                      <span className="text-amber-700 font-medium">{t.dashboard.noCorteYet}</span>
                      <span className="font-bold text-amber-800">${unshifted.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* All orders of the day */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-stone-400" />
                  <span className="font-semibold text-stone-700">
                    {isToday ? t.dashboard.lastOrders : t.dashboard.ordersOf(new Date(dateStr+'T12:00:00').toLocaleDateString(intl,{day:'numeric',month:'short'}))}
                  </span>
                  <span className="ml-auto text-xs text-stone-400">{allOrders.length} {t.dashboard.totalWord}</span>
                </div>
                {allOrders.length === 0 ? (
                  <p className="px-5 py-8 text-center text-stone-400 text-sm">{t.dashboard.noOrdersThisDay}</p>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {allOrders.slice(0, 15).map(o => (
                      <OrderRow key={o.id} order={o} />
                    ))}
                    {allOrders.length > 15 && (
                      <p className="px-5 py-2 text-xs text-center text-stone-400">
                        {t.dashboard.moreCount(allOrders.length - 15)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: top products + stock */}
            <div className="space-y-4">
              {data!.topProducts.length > 0 && (
                <div className="bg-white rounded-2xl border border-stone-200 p-5">
                  <h2 className="font-semibold text-stone-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    {isToday ? t.dashboard.topSoldToday : t.dashboard.topSoldThatDay}
                  </h2>
                  <div className="space-y-2">
                    {data!.topProducts.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-2">
                        <span className="text-xs font-black text-stone-400 w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1 bg-stone-100 rounded-full overflow-hidden h-5 relative">
                          <div className="absolute inset-y-0 left-0 bg-amber-400 rounded-full"
                            style={{ width: `${(p.qty / data!.topProducts[0].qty) * 100}%` }} />
                          <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-stone-700 z-10 truncate">
                            {p.name}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-stone-600 w-6 text-right shrink-0">{p.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-stone-200 p-5">
                <h2 className="font-semibold text-stone-700 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-stone-400" />
                  {t.dashboard.inventory}
                  {(data?.lowStock.length ?? 0) > 0 && (
                    <span className="ml-auto bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                      {t.dashboard.alerts(data!.lowStock.length)}
                    </span>
                  )}
                </h2>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-stone-500">{t.dashboard.activeProducts}</span>
                  <span className="font-semibold text-stone-800">{data!.totalProducts}</span>
                </div>
                {(data?.lowStock.length ?? 0) > 0 ? (
                  <div className="space-y-1.5">
                    {data!.lowStock.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-xs bg-red-50 rounded-lg px-3 py-2">
                        <span className="flex items-center gap-1.5 text-red-700 font-medium">
                          <AlertTriangle className="w-3 h-3 shrink-0" />{s.name}
                        </span>
                        <span className="text-red-500 font-semibold">{s.current_stock} {s.unit}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400">{t.dashboard.noStockAlerts}</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── sub-components ───────────────────────────────────────────────────────────

function OrderRow({ order }: { order: Order }) {
  const { t, intl } = useI18n()
  return (
    <div className="px-5 py-2.5 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-stone-800">
          #{order.order_number} · {order.table_number ?? t.caja.noTable}
        </p>
        <p className="text-xs text-stone-400">
          {new Date(order.created_at).toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[order.status] ?? ''}`}>
          {t.orderStatus[order.status as keyof typeof t.orderStatus] ?? order.status}
        </span>
        <span className="text-sm font-bold text-stone-700">${order.total_amount.toFixed(2)}</span>
      </div>
    </div>
  )
}

const COLORS = {
  amber: 'bg-amber-100 text-amber-600',
  green: 'bg-green-100 text-green-600',
  blue:  'bg-blue-100 text-blue-600',
  red:   'bg-red-100 text-red-600',
  stone: 'bg-stone-100 text-stone-500',
}

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string; sub: string
  icon: React.ElementType; color: keyof typeof COLORS
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-stone-500">{title}</p>
          <p className="text-2xl font-bold text-stone-800 mt-1 truncate">{value}</p>
          <p className="text-xs text-stone-400 mt-0.5">{sub}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-2 ${COLORS[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}
