'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DollarSign, ShoppingBag, CheckCircle2, XCircle, Clock, TrendingUp,
  Loader2, Save, RotateCcw, ChevronDown, ChevronUp, AlertTriangle, History,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface TabSummary {
  label: string
  orderCount: number
  total: number
  isPaid: boolean
}

interface Stats {
  shiftStart: string | null
  totalOrders: number
  paidOrders: number
  cancelledOrders: number
  activeOrders: number
  totalRevenue: number
  pendingRevenue: number
  openTabs: number
  topProducts: { name: string; qty: number }[]
  tabSummaries: TabSummary[]
}

interface ShiftRecord {
  id: string
  opened_at: string
  closed_at: string
  total_orders: number
  paid_orders: number
  cancelled_orders: number
  total_revenue: number
  notes: string | null
}

function fmt(iso: string, intl: string) {
  return new Date(iso).toLocaleString(intl, { dateStyle: 'short', timeStyle: 'short' })
}

function duration(from: string, to: string) {
  const mins = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function StatCard({ icon, label, value, sub, color = 'stone' }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string
}) {
  const colors: Record<string, string> = {
    stone:  'bg-white border-stone-200',
    green:  'bg-green-50 border-green-200',
    amber:  'bg-amber-50 border-amber-200',
    red:    'bg-red-50 border-red-200',
    blue:   'bg-blue-50 border-blue-200',
  }
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 text-stone-500 mb-1">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="text-2xl font-black text-stone-800">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export function CorteCaja({ branchId }: { branchId: string }) {
  const { t, intl } = useI18n()
  const [stats, setStats] = useState<Stats | null>(null)
  const [history, setHistory] = useState<ShiftRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [notes, setNotes] = useState('')
  const [closing, setClosing] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Last closed shift → defines start of current period
    const { data: lastShift } = await supabase
      .from('shifts')
      .select('closed_at')
      .eq('branch_id', branchId)
      .order('closed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const shiftStart: string | null = lastShift?.closed_at ?? null

    // Orders in current period
    let q = supabase.from('orders').select('id, status, total_amount, tab_id, table_number, tab:tabs(label)').eq('branch_id', branchId)
    if (shiftStart) q = q.gte('created_at', shiftStart)
    const { data: orders } = await q

    const all        = orders ?? []
    const paid       = all.filter(o => o.status === 'paid')
    const cancelled  = all.filter(o => o.status === 'cancelled')
    const active     = all.filter(o => ['pending', 'preparing', 'ready'].includes(o.status))
    const totalRevenue   = paid.reduce((s, o) => s + o.total_amount, 0)
    const pendingRevenue = active.reduce((s, o) => s + o.total_amount, 0)

    // Group by tab for summary
    const tabMap = new Map<string, { label: string; orders: typeof all }>()
    for (const o of all) {
      const key = (o as {tab_id?: string}).tab_id ?? `solo_${o.id}`
      const tab = (o as {tab?: {label: string} | {label: string}[] | null}).tab
      const label = (tab && !Array.isArray(tab) ? tab.label : Array.isArray(tab) ? tab[0]?.label : null) ?? (o as {table_number?: string}).table_number ?? t.caja.noTable
      if (!tabMap.has(key)) tabMap.set(key, { label, orders: [] })
      tabMap.get(key)!.orders.push(o)
    }
    const tabSummaries: TabSummary[] = Array.from(tabMap.values()).map(t => {
      const active = t.orders.filter(o => o.status !== 'cancelled')
      return {
        label: t.label,
        orderCount: active.length,
        total: active.reduce((s, o) => s + o.total_amount, 0),
        isPaid: active.length > 0 && active.every(o => o.status === 'paid'),
      }
    }).sort((a, b) => (a.isPaid ? 1 : -1) - (b.isPaid ? 1 : -1))

    // Top products from those orders
    let topProducts: { name: string; qty: number }[] = []
    const orderIds = all.map(o => o.id)
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('quantity, product:products(name)')
        .in('order_id', orderIds)

      const map = new Map<string, number>()
      items?.forEach(i => {
        const prod = i.product as { name: string } | { name: string }[] | null
        const name = prod && !Array.isArray(prod) ? prod.name : (Array.isArray(prod) ? prod[0]?.name : undefined)
        if (name) map.set(name, (map.get(name) ?? 0) + i.quantity)
      })
      topProducts = Array.from(map.entries())
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5)
    }

    // Open tabs
    const { count: openTabs } = await supabase
      .from('tabs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')
      .eq('branch_id', branchId)

    // Shift history
    const { data: shifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('branch_id', branchId)
      .order('closed_at', { ascending: false })
      .limit(30)

    setStats({
      shiftStart,
      totalOrders: all.length,
      paidOrders: paid.length,
      cancelledOrders: cancelled.length,
      activeOrders: active.length,
      totalRevenue,
      pendingRevenue,
      openTabs: openTabs ?? 0,
      topProducts,
      tabSummaries,
    })
    setHistory((shifts ?? []) as ShiftRecord[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleCorte() {
    if (!stats) return
    setClosing(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const now = new Date().toISOString()
    await supabase.from('shifts').insert({
      opened_at:        stats.shiftStart ?? new Date(0).toISOString(),
      closed_at:        now,
      closed_by:        user?.id,
      total_orders:     stats.totalOrders,
      paid_orders:      stats.paidOrders,
      cancelled_orders: stats.cancelledOrders,
      total_revenue:    stats.totalRevenue,
      notes:            notes.trim() || null,
      branch_id:        branchId,
    })

    setClosing(false)
    setConfirming(false)
    setNotes('')
    setSuccessMsg(t.corte.corteDone(fmt(now, intl)))
    setTimeout(() => setSuccessMsg(null), 6000)
    await loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
      </div>
    )
  }

  if (!stats) return null

  const periodLabel = stats.shiftStart
    ? t.corte.sinceDate(fmt(stats.shiftStart, intl))
    : t.corte.sinceBeginning

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Success banner */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Current period */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-stone-800">{t.corte.currentShift}</h2>
            <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {periodLabel}
            </p>
          </div>
          <button
            onClick={loadData}
            className="p-2 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
            title={t.pos.refresh}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard
            icon={<DollarSign className="w-4 h-4 text-green-600" />}
            label={t.corte.collectedIncome}
            value={`$${stats.totalRevenue.toFixed(2)}`}
            sub={t.corte.paidOrdersCount(stats.paidOrders)}
            color="green"
          />
          <StatCard
            icon={<ShoppingBag className="w-4 h-4 text-amber-600" />}
            label={t.corte.totalOrders}
            value={stats.totalOrders}
            sub={t.corte.activeCount(stats.activeOrders)}
            color="amber"
          />
          <StatCard
            icon={<AlertTriangle className="w-4 h-4 text-blue-500" />}
            label={t.corte.toCollect}
            value={`$${stats.pendingRevenue.toFixed(2)}`}
            sub={t.corte.openTablesCount(stats.openTabs)}
            color="blue"
          />
          <StatCard
            icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
            label={t.caja.paidLabel}
            value={stats.paidOrders}
            color="stone"
          />
          <StatCard
            icon={<XCircle className="w-4 h-4 text-red-400" />}
            label={t.corte.cancelledLabel}
            value={stats.cancelledOrders}
            color={stats.cancelledOrders > 0 ? 'red' : 'stone'}
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4 text-amber-500" />}
            label={t.corte.pendingCharge}
            value={stats.activeOrders}
            color="stone"
          />
        </div>

        {/* Top products */}
        {stats.topProducts.length > 0 && (
          <div className="px-5 pb-5">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">{t.corte.topProducts}</p>
            <div className="space-y-1.5">
              {stats.topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="text-xs font-black text-stone-400 w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 bg-stone-100 rounded-full overflow-hidden h-5 relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-amber-400 rounded-full"
                      style={{ width: `${(p.qty / stats.topProducts[0].qty) * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-stone-700 z-10">
                      {p.name}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-stone-600 w-8 text-right shrink-0">{p.qty}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Corte action */}
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={stats.totalOrders === 0}
          className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold text-base transition-colors active:scale-95 flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          {t.corte.doCorte}
        </button>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-amber-300 p-5 space-y-4">
          <div>
            <p className="font-bold text-stone-800 text-lg">{t.corte.confirmTitle}</p>
            <p className="text-sm text-stone-500 mt-1">{t.corte.confirmBody}</p>
          </div>

          <div className="bg-amber-50 rounded-xl px-4 py-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-600">{t.corte.shiftOrders}</span>
              <span className="font-semibold">{stats.totalOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">{t.corte.collectedIncome}</span>
              <span className="font-bold text-green-700">${stats.totalRevenue.toFixed(2)}</span>
            </div>
            {stats.openTabs > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>{t.corte.openTablesStill}</span>
                <span className="font-semibold">{stats.openTabs}</span>
              </div>
            )}
          </div>

          {stats.tabSummaries.length > 0 && (
            <div className="border border-stone-200 rounded-xl overflow-hidden text-sm">
              <div className="bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                {t.corte.tabSummaryTitle}
              </div>
              <div className="divide-y divide-stone-100 max-h-48 overflow-y-auto">
                {stats.tabSummaries.map((ts, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 gap-2">
                    <span className="text-stone-700 truncate flex-1">{ts.label}</span>
                    <span className="text-xs text-stone-400 shrink-0">{t.pos.rounds(ts.orderCount)}</span>
                    <span className={`font-semibold shrink-0 ${ts.isPaid ? 'text-stone-400' : 'text-green-700'}`}>
                      ${ts.total.toFixed(2)}
                    </span>
                    {ts.isPaid
                      ? <span className="text-xs bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded-full shrink-0">{t.corte.paidBadge}</span>
                      : <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">{t.corte.pendingBadge}</span>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">
              {t.corte.notesLabel}
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder={t.corte.notesPlaceholder}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleCorte}
              disabled={closing}
              className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold text-sm flex items-center justify-center gap-1.5"
            >
              {closing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><Save className="w-4 h-4" /> {t.corte.saveCorte}</>
              }
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <button
            onClick={() => setHistoryOpen(h => !h)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-stone-400" />
              <span className="font-semibold text-stone-800">{t.corte.corteHistory}</span>
              <span className="text-xs text-stone-400">({history.length})</span>
            </div>
            {historyOpen
              ? <ChevronUp className="w-4 h-4 text-stone-400" />
              : <ChevronDown className="w-4 h-4 text-stone-400" />
            }
          </button>

          {historyOpen && (
            <div className="divide-y divide-stone-100">
              {history.map(shift => (
                <div key={shift.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-800">
                        {fmt(shift.closed_at, intl)}
                      </p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {t.corte.shiftOf(duration(shift.opened_at, shift.closed_at))}
                        {' · '}
                        {t.floor.orderCount(shift.total_orders)}
                        {' · '}
                        {t.caja.paidCount(shift.paid_orders)}
                        {shift.cancelled_orders > 0 && ` · ${t.caja.cancelledCount(shift.cancelled_orders)}`}
                      </p>
                      {shift.notes && (
                        <p className="text-xs text-stone-500 italic mt-0.5">&quot;{shift.notes}&quot;</p>
                      )}
                    </div>
                    <span className="text-base font-black text-green-700 shrink-0">
                      ${shift.total_revenue.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
