'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, RefreshCw, TrendingUp, ShoppingBag, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface BranchRow {
  id: string
  name: string
  is_active: boolean
}

interface BranchStat {
  branch_id: string
  branch_name: string
  revenue: number
  paid_orders: number
  open_tabs: number
}

type Period = 'today' | 'week' | 'month'

function periodRange(period: Period): { from: Date; to: Date } {
  const now = new Date()
  const from = new Date(now)
  if (period === 'today') {
    from.setHours(0, 0, 0, 0)
  } else if (period === 'week') {
    const day = from.getDay()
    from.setDate(from.getDate() - day)
    from.setHours(0, 0, 0, 0)
  } else {
    from.setDate(1)
    from.setHours(0, 0, 0, 0)
  }
  return { from, to: now }
}

interface Props {
  branches: BranchRow[]
}

export function BranchCompare({ branches }: Props) {
  const [period, setPeriod] = useState<Period>('today')
  const [stats, setStats] = useState<BranchStat[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = periodRange(period)
    const supabase = createClient()

    const [{ data: orders }, { data: openTabs }] = await Promise.all([
      supabase
        .from('orders')
        .select('branch_id, total_amount, discount_amount')
        .eq('status', 'paid')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString()),
      supabase
        .from('tabs')
        .select('branch_id')
        .eq('status', 'open'),
    ])

    const revenueByBranch: Record<string, { revenue: number; orders: number }> = {}
    for (const o of orders ?? []) {
      const bid = o.branch_id as string
      if (!revenueByBranch[bid]) revenueByBranch[bid] = { revenue: 0, orders: 0 }
      revenueByBranch[bid].revenue += (o.total_amount ?? 0) - (o.discount_amount ?? 0)
      revenueByBranch[bid].orders++
    }

    const openTabsByBranch: Record<string, number> = {}
    for (const t of openTabs ?? []) {
      const bid = t.branch_id as string
      openTabsByBranch[bid] = (openTabsByBranch[bid] ?? 0) + 1
    }

    const result: BranchStat[] = branches.map(b => ({
      branch_id:   b.id,
      branch_name: b.name,
      revenue:     revenueByBranch[b.id]?.revenue ?? 0,
      paid_orders: revenueByBranch[b.id]?.orders  ?? 0,
      open_tabs:   openTabsByBranch[b.id] ?? 0,
    })).sort((a, b) => b.revenue - a.revenue)

    setStats(result)
    setLoading(false)
  }, [period, branches])

  useEffect(() => { load() }, [load])

  const totalRevenue = stats.reduce((s, b) => s + b.revenue, 0)
  const topBranch = stats[0]

  const PERIOD_LABELS: Record<Period, string> = {
    today: 'Hoy',
    week:  'Esta semana',
    month: 'Este mes',
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/branches"
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-stone-800">Comparativa de sucursales</h1>
          <p className="text-sm text-stone-500 mt-0.5">Ventas cobradas por sucursal</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Period selector */}
      <div className="flex gap-1.5">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p
                ? 'bg-brand-700 text-white'
                : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <p className="text-xs text-stone-400 font-medium mb-1">Total combinado</p>
              <p className="text-2xl font-black text-stone-800">${totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-stone-400 mt-0.5">{stats.reduce((s, b) => s + b.paid_orders, 0)} pedidos</p>
            </div>
            {topBranch && totalRevenue > 0 && (
              <div className="bg-brand-50 rounded-2xl border border-brand-100 p-4">
                <p className="text-xs text-brand-600 font-medium mb-1">Mejor sucursal</p>
                <p className="text-lg font-black text-brand-800 truncate">{topBranch.branch_name}</p>
                <div className="flex items-center gap-1 text-xs text-brand-600 mt-0.5">
                  <TrendingUp className="w-3 h-3" />
                  {totalRevenue > 0 ? Math.round((topBranch.revenue / totalRevenue) * 100) : 0}% del total
                </div>
              </div>
            )}
          </div>

          {/* Branch table */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            {stats.length === 0 ? (
              <div className="py-12 text-center text-stone-400 text-sm">
                Sin datos para el período seleccionado
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Sucursal</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Ventas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">
                      <ShoppingBag className="w-3.5 h-3.5 inline" />
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Tabs abiertas</th>
                    <th className="text-right px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {stats.map((b, i) => (
                    <tr key={b.branch_id} className={i === 0 && b.revenue > 0 ? 'bg-brand-50/40' : ''}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {i === 0 && b.revenue > 0 && <TrendingUp className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                          <span className="font-medium text-stone-800">{b.branch_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-stone-800">
                        ${b.revenue.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-500">{b.paid_orders}</td>
                      <td className="px-4 py-3 text-right">
                        {b.open_tabs > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                            {b.open_tabs}
                          </span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href="/dashboard"
                          onClick={() => {
                            document.cookie = `current_branch_id=${b.branch_id}; path=/; max-age=86400`
                          }}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          Ir →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
