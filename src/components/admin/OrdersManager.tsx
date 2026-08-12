'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderStatus, Shift } from '@/lib/types'
import {
  Search, ChevronDown, ChevronUp, DollarSign, X, Clock, ChefHat,
  CheckCircle2, Ban, LayoutGrid, UserRound, Save, Bot, ShoppingBag,
} from 'lucide-react'

const ALL_STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready', 'paid', 'cancelled']

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending:   'Pendiente',
  preparing: 'Preparando',
  ready:     'Listo',
  paid:      'Pagado',
  cancelled: 'Cancelado',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending:   'bg-amber-100 text-amber-800',
  preparing: 'bg-blue-100 text-blue-800',
  ready:     'bg-green-100 text-green-800',
  paid:      'bg-stone-100 text-stone-500',
  cancelled: 'bg-red-100 text-red-700',
}

const STATUS_ICON: Record<OrderStatus, React.ReactNode> = {
  pending:   <Clock className="w-3.5 h-3.5" />,
  preparing: <ChefHat className="w-3.5 h-3.5" />,
  ready:     <CheckCircle2 className="w-3.5 h-3.5" />,
  paid:      <DollarSign className="w-3.5 h-3.5" />,
  cancelled: <Ban className="w-3.5 h-3.5" />,
}

// ─── Tab group (within a shift) ───────────────────────────────────────────────

interface TabGroup {
  key: string
  tabId: string | null
  tableNumber: string | null
  orders: Order[]
  total: number
  cobrarTotal: number
  allPaid: boolean
}

function groupOrders(orders: Order[]): TabGroup[] {
  const map = new Map<string, Order[]>()
  for (const o of orders) {
    const k = o.tab_id ?? `__solo_${o.id}`
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(o)
  }
  return Array.from(map.entries())
    .map(([key, grp]) => {
      const sorted = grp.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      const active     = sorted.filter(o => o.status !== 'cancelled')
      const cobrarTotal = active.filter(o => o.status !== 'paid').reduce((s, o) => s + o.total_amount, 0)
      return {
        key,
        tabId:       sorted[0].tab_id ?? null,
        tableNumber: sorted[0].table_number ?? null,
        orders:      sorted,
        total:       active.reduce((s, o) => s + o.total_amount, 0),
        cobrarTotal,
        allPaid:     active.length > 0 && active.every(o => o.status === 'paid'),
      }
    })
    .sort((a, b) => (a.allPaid ? 1 : -1) - (b.allPaid ? 1 : -1))
}

// ─── Shift bucket ─────────────────────────────────────────────────────────────

interface ShiftBucket {
  shiftId: string | null   // null = current (unshifted)
  label: string
  openedAt: string
  closedAt: string | null
  shiftRevenue: number | null   // from the shifts table, null if current
  closedById: string | null
  openedById: string | null
  orders: Order[]
}

function bucketByShift(orders: Order[], shifts: Shift[]): ShiftBucket[] {
  const sorted = [...shifts].filter(s => s.closed_at).sort(
    (a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime()
  )

  const buckets: ShiftBucket[] = []

  // Current (after last shift or all if no shifts)
  const lastClose = sorted.length > 0 ? sorted[sorted.length - 1].closed_at : null
  const currentOrders = lastClose
    ? orders.filter(o => new Date(o.created_at) >= new Date(lastClose))
    : orders

  // Only show "Turno actual" when a shift is genuinely open or there are orphan orders
  const hasOpenShift = shifts.some(s => s.status === 'open')
  if (hasOpenShift || currentOrders.length > 0) {
    buckets.push({
      shiftId:       null,
      label:         'Turno actual',
      openedAt:      lastClose ?? orders.length > 0 ? (orders[orders.length - 1]?.created_at ?? new Date().toISOString()) : new Date().toISOString(),
      closedAt:      null,
      shiftRevenue:  null,
      closedById:    null,
      openedById:    null,
      orders:        currentOrders,
    })
  }

  // Past shifts (newest first)
  for (let i = sorted.length - 1; i >= 0; i--) {
    const sh = sorted[i]
    const prev = i > 0 ? sorted[i - 1].closed_at : null
    const shOrders = orders.filter(o => {
      const t = new Date(o.created_at).getTime()
      return sh.closed_at && t < new Date(sh.closed_at).getTime() &&
        (prev === null || t >= new Date(prev!).getTime())
    })
    const idx = sorted.length - i
    buckets.push({
      shiftId:      sh.id,
      label:        `Corte #${idx}`,
      openedAt:     sh.opened_at,
      closedAt:     sh.closed_at,
      shiftRevenue: sh.total_revenue,
      closedById:   sh.closed_by,
      openedById:   sh.opened_by,
      orders:       shOrders,
    })
  }

  return buckets
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialOrders: Order[]
  initialShifts: Shift[]
  branchId: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OrdersManager({ initialOrders, initialShifts, branchId: _branchId }: Props) {
  const [orders, setOrders]         = useState<Order[]>(initialOrders)
  const [shifts]                    = useState<Shift[]>(initialShifts)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus]   = useState<OrderStatus | 'all'>('all')
  const [filterTabType, setFilterTabType] = useState<'all' | 'table' | 'client' | 'mostrador'>('all')
  const [expandedTab, setExpandedTab]     = useState<string | null>(null)
  const [expandedShift, setExpandedShift] = useState<string>('current')
  const [loadingKey, setLoadingKey]       = useState<string | null>(null)
  const [shiftUserNames, setShiftUserNames] = useState<Map<string, string>>(new Map())

  // Fetch profile names for shift openers / closers
  useEffect(() => {
    const ids = new Set<string>()
    initialShifts.forEach(s => {
      if (s.opened_by) ids.add(s.opened_by)
      if (s.closed_by) ids.add(s.closed_by)
    })
    if (ids.size === 0) return
    const supabase = createClient()
    supabase.from('profiles').select('id, full_name').in('id', [...ids])
      .then(({ data }) => {
        if (data) setShiftUserNames(new Map(data.map(p => [p.id, p.full_name as string])))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Real-time
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('orders-manager-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => setOrders(prev =>
          prev.map(o => o.id === payload.new.id ? { ...o, ...(payload.new as Partial<Order>) } : o)
        )
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          const { data } = await supabase
            .from('orders')
            .select('*, items:order_items(*, product:products(*))')
            .eq('id', payload.new.id)
            .single()
          if (data) setOrders(prev => [data as Order, ...prev])
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Filter
  const filteredIds = useMemo(() => {
    const q = search.trim().toLowerCase()
    return new Set(
      orders.filter(o => {
        const matchStatus  = filterStatus === 'all' || o.status === filterStatus
        const tabType      = (o.tab as { type?: string } | undefined)?.type ?? 'table'
        const matchTabType = filterTabType === 'all' || tabType === filterTabType
        if (!q) return matchStatus && matchTabType
        return matchStatus && matchTabType && (
          String(o.order_number).includes(q) ||
          (o.table_number ?? '').toLowerCase().includes(q)
        )
      }).map(o => o.id)
    )
  }, [orders, filterStatus, filterTabType, search])

  const buckets = useMemo(() => bucketByShift(orders, shifts), [orders, shifts])

  async function cobrarTab(group: TabGroup) {
    setLoadingKey(group.key)
    const supabase = createClient()
    const toPay = group.orders
      .filter(o => o.status !== 'cancelled' && o.status !== 'paid')
      .map(o => o.id)
    if (toPay.length > 0) {
      await supabase.from('orders').update({ status: 'paid' }).in('id', toPay)
      setOrders(prev => prev.map(o => toPay.includes(o.id) ? { ...o, status: 'paid' } : o))
    }
    if (group.tabId) {
      await supabase.from('tabs').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', group.tabId)
    }
    setLoadingKey(null)
  }

  async function changeOrderStatus(order: Order, status: OrderStatus) {
    const supabase = createClient()
    await supabase.from('orders').update({ status }).eq('id', order.id)
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status } : o))
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por # pedido o mesa…"
            className="w-full pl-9 pr-4 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'mostrador', 'table', 'client'] as const).map(t => (
            <button key={t} onClick={() => setFilterTabType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterTabType === t ? 'bg-stone-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {t === 'all' ? 'Todos' : t === 'table' ? 'Mesas' : t === 'client' ? 'Clientes' : 'Mostrador'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', ...ALL_STATUSES] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterStatus === s ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {s === 'all' ? 'Todos' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Shift buckets */}
      {buckets.map(bucket => {
        const bucketKey  = bucket.shiftId ?? 'current'
        const isExpanded = expandedShift === bucketKey
        const groups     = groupOrders(bucket.orders)
        const visibleGroups = groups.filter(g => g.orders.some(o => filteredIds.has(o.id)))

        // Skip empty buckets when filtering
        if (search || filterStatus !== 'all') {
          if (visibleGroups.length === 0) return null
        }

        const bucketRevenue = bucket.orders
          .filter(o => o.status === 'paid')
          .reduce((s, o) => s + o.total_amount, 0)
        const pendingCount = bucket.orders.filter(o => ['pending','preparing','ready'].includes(o.status)).length

        return (
          <div key={bucketKey} className="rounded-2xl border border-stone-200 overflow-hidden">
            {/* Shift header */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
              onClick={() => setExpandedShift(isExpanded ? '' : bucketKey)}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                bucket.shiftId === null ? 'bg-amber-100' : 'bg-stone-200'
              }`}>
                {bucket.shiftId === null
                  ? <Clock className="w-4 h-4 text-amber-600" />
                  : <Save className="w-4 h-4 text-stone-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-stone-800">{bucket.label}</p>
                  {bucket.shiftId === null && pendingCount > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                      {pendingCount} activo{pendingCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  {bucket.shiftId === null
                    ? `Desde ${fmtDate(bucket.openedAt)}`
                    : `${fmtDate(bucket.openedAt)} → ${fmtDate(bucket.closedAt!)}`
                  }
                  {' · '}{bucket.orders.length} pedido{bucket.orders.length !== 1 ? 's' : ''}
                  {' · '}{groups.length} mesa{groups.length !== 1 ? 's' : ''}
                </p>
                {bucket.shiftId !== null && (bucket.closedById || bucket.openedById) && (
                  <div className="flex flex-wrap gap-x-3 mt-0.5">
                    {bucket.openedById && (
                      <p className="text-xs text-stone-400">
                        <span className="font-medium text-stone-500">Abierto por:</span>{' '}
                        {shiftUserNames.get(bucket.openedById) ?? 'Desconocido'}
                      </p>
                    )}
                    {bucket.closedById && (
                      <p className="text-xs text-stone-400">
                        <span className="font-medium text-stone-500">Cerrado por:</span>{' '}
                        {shiftUserNames.get(bucket.closedById) ?? 'Desconocido'}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-sm font-black text-green-700">${bucketRevenue.toFixed(2)}</p>
                  {bucket.shiftRevenue !== null && Math.abs(bucket.shiftRevenue - bucketRevenue) > 0.01 && (
                    <p className="text-xs text-stone-400">corte: ${bucket.shiftRevenue.toFixed(2)}</p>
                  )}
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
              </div>
            </button>

            {/* Tab groups within this shift */}
            {isExpanded && (
              <div className="divide-y divide-stone-100 bg-white">
                {visibleGroups.length === 0 ? (
                  <p className="px-5 py-6 text-center text-stone-400 text-sm">Sin pedidos en este período</p>
                ) : (
                  visibleGroups.map(group => (
                    <TabGroupRow
                      key={group.key}
                      group={group}
                      expanded={expandedTab === group.key}
                      isLoading={loadingKey === group.key}
                      onToggle={() => setExpandedTab(expandedTab === group.key ? null : group.key)}
                      onCobrar={() => cobrarTab(group)}
                      onChangeStatus={changeOrderStatus}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}

      {buckets.every(b => b.orders.length === 0) && (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-400 text-sm">
          Sin pedidos
        </div>
      )}
    </div>
  )
}

// ─── TabGroupRow ──────────────────────────────────────────────────────────────

interface TabGroupRowProps {
  group: TabGroup
  expanded: boolean
  isLoading: boolean
  onToggle: () => void
  onCobrar: () => void
  onChangeStatus: (order: Order, status: OrderStatus) => void
}

function TabGroupRow({ group, expanded, isLoading, onToggle, onCobrar, onChangeStatus }: TabGroupRowProps) {
  const label        = group.tableNumber ?? 'Sin mesa'
  const pendingCount = group.orders.filter(o => ['pending','preparing'].includes(o.status)).length
  const readyCount   = group.orders.filter(o => o.status === 'ready').length
  const tabType      = group.orders[0].tab?.type ?? 'table'
  const tabSource    = (group.orders[0].tab as { source?: string } | undefined)?.source ?? 'pos'
  const isTable      = tabType === 'table'
  const isMostrador  = tabType === 'mostrador'
  const isAgent      = tabSource === 'agent'

  const typeColor = isTable ? 'bg-amber-100' : isMostrador ? 'bg-brand-100' : 'bg-violet-100'
  const typeIconColor = isTable ? 'text-amber-600' : isMostrador ? 'text-brand-600' : 'text-violet-600'
  const badgeColor = isTable ? 'bg-amber-100 text-amber-700' : isMostrador ? 'bg-brand-100 text-brand-700' : 'bg-violet-100 text-violet-700'
  const typeLabel = isTable ? 'Mesa' : isMostrador ? 'Mostrador' : 'Cliente'

  return (
    <div className={readyCount > 0 ? 'bg-green-50' : ''}>
      {/* Tab header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-black/[0.03] transition-colors"
        onClick={onToggle}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${typeColor}`}>
          {isTable
            ? <LayoutGrid className={`w-3.5 h-3.5 ${typeIconColor}`} />
            : isMostrador
              ? <ShoppingBag className={`w-3.5 h-3.5 ${typeIconColor}`} />
              : <UserRound className={`w-3.5 h-3.5 ${typeIconColor}`} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-stone-800 truncate text-sm">{label}</p>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badgeColor}`}>
              {typeLabel}
            </span>
            {isAgent && (
              <span className="inline-flex items-center gap-0.5 text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                <Bot className="w-3 h-3" /> IA
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {pendingCount > 0 && (
              <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                <ChefHat className="w-3 h-3" />{pendingCount} en cocina
              </span>
            )}
            {readyCount > 0 && (
              <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />{readyCount} listo{readyCount !== 1 ? 's' : ''} — entregar
              </span>
            )}
            {group.allPaid && (
              <span className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full font-medium">Pagado</span>
            )}
            <span className="text-xs text-stone-400">{group.orders.length} ronda{group.orders.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!group.allPaid && group.cobrarTotal > 0 && (
            <button
              disabled={isLoading}
              onClick={e => { e.stopPropagation(); onCobrar() }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-semibold transition-colors"
            >
              <DollarSign className="w-3.5 h-3.5" />${group.cobrarTotal.toFixed(2)}
            </button>
          )}
          <span className="font-bold text-amber-700 text-sm">${group.total.toFixed(2)}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </div>
      </div>

      {/* Orders detail */}
      {expanded && (
        <div className="border-t border-stone-100 divide-y divide-stone-50 bg-white">
          {group.orders.map(order => (
            <div key={order.id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-black text-stone-700">#{order.order_number}</span>
                {order.payment_source === 'agent' && (
                  <span className="inline-flex items-center gap-0.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                    <Bot className="w-3 h-3" /> IA
                  </span>
                )}
                {order.prepaid && (
                  <span className="inline-flex items-center gap-0.5 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                    ✓ Prepagado
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                  {STATUS_ICON[order.status]}{STATUS_LABEL[order.status]}
                </span>
                <span className="text-xs text-stone-400 ml-auto">
                  {new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-semibold text-stone-600 text-sm">${order.total_amount.toFixed(2)}</span>
              </div>
              <ul className="space-y-0.5 ml-1 mb-2">
                {order.items?.map(item => (
                  <li key={item.id} className="flex items-start gap-2 text-sm">
                    <span className="font-semibold text-stone-600 w-5 shrink-0">{item.quantity}×</span>
                    <span className="flex-1 text-stone-600">{item.product?.name}</span>
                    {item.notes && <span className="text-xs text-amber-600 shrink-0">{item.notes}</span>}
                    <span className="text-stone-400 shrink-0">${item.subtotal.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              {order.status !== 'paid' && order.status !== 'cancelled' && (
                <div className="flex gap-2">
                  {order.status === 'pending' && (
                    <button onClick={() => onChangeStatus(order, 'preparing')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">
                      <ChefHat className="w-3.5 h-3.5" /> Preparando
                    </button>
                  )}
                  <button onClick={() => onChangeStatus(order, 'cancelled')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 text-xs font-medium">
                    <Ban className="w-3.5 h-3.5" /> Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
