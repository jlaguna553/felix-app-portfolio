'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, Tab } from '@/lib/types'
import { TicketPreview } from '@/components/pos/TicketPreview'
import { useI18n } from '@/lib/i18n/I18nProvider'
import {
  DollarSign, Clock, PlayCircle, StopCircle, Loader2,
  CheckCircle2, RotateCcw, ShoppingBag, Save,
  ChevronDown, ChevronUp, History, Printer, CreditCard,
  Monitor, Smartphone, AlertTriangle, UserRound, Bot, LayoutGrid,
  Hourglass, CircleCheckBig,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderWithTabOpener = { tab?: { opened_by?: string | null } }

interface PendingPaymentTab {
  tabId: string
  tabLabel: string
  tabType: 'table' | 'client' | 'mostrador'
  total: number
  closedAt: string
}

interface ActiveShift {
  id: string
  opened_at: string
}

interface ShiftRecord {
  id: string
  opened_at: string
  closed_at: string | null
  status: string
  total_orders: number
  paid_orders: number
  cancelled_orders: number
  total_revenue: number
  notes: string | null
  opened_by: string | null
  closed_by: string | null
}

interface TabGroup {
  key: string
  tabId: string | null
  tabLabel: string
  tabType: 'table' | 'client' | 'mostrador'
  tabSource: 'pos' | 'agent'
  openerName: string | null
  orders: Order[]
  total: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByTab(orders: Order[], ownerNames: Map<string, string>, noTableLabel: string): TabGroup[] {
  const map = new Map<string, TabGroup>()
  for (const o of orders) {
    const key = o.tab_id ?? `__table__${o.table_number ?? 'sin_mesa'}`
    if (!map.has(key)) {
      const t = o.tab as (Tab & { opened_by?: string; source?: string }) | undefined
      const label      = t?.label ?? o.table_number ?? noTableLabel
      const tabType: 'table' | 'client' | 'mostrador' = (t?.type ?? 'table') as 'table' | 'client' | 'mostrador'
      const tabSource: 'pos' | 'agent' = (t?.source ?? 'pos') as 'pos' | 'agent'
      const openerName = t?.opened_by ? (ownerNames.get(t.opened_by) ?? null) : null
      map.set(key, { key, tabId: o.tab_id, tabLabel: label, tabType, tabSource, openerName, orders: [], total: 0 })
    }
    const g = map.get(key)!
    g.orders.push(o)
    g.total += o.total_amount
  }
  return [...map.values()]
}

function elapsed(from: string) {
  const mins = Math.floor((Date.now() - new Date(from).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
function fmtTime(iso: string, intl: string) {
  return new Date(iso).toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit' })
}
function fmtShort(iso: string | null, intl: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(intl, { dateStyle: 'short', timeStyle: 'short' })
}

// ── Main component ────────────────────────────────────────────────────────────

export function CajaModule({ branchId }: { branchId: string }) {
  const { t, intl } = useI18n()
  const [activeShift, setActiveShift]       = useState<ActiveShift | null | undefined>(undefined)
  const [paidOrders, setPaidOrders]         = useState<Order[]>([])
  const [activeOrders, setActiveOrders]     = useState<Order[]>([])
  const [ownerNames, setOwnerNames]         = useState<Map<string, string>>(new Map())
  const [history, setHistory]               = useState<ShiftRecord[]>([])
  const [shiftUserNames, setShiftUserNames] = useState<Map<string, string>>(new Map())
  const [historyOpen, setHistoryOpen]       = useState(false)
  const [starting, setStarting]         = useState(false)
  const [closing, setClosing]           = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [notes, setNotes]               = useState('')
  const [loadingTab, setLoadingTab]     = useState<string | null>(null)
  const [ticketGroup, setTicketGroup]   = useState<TabGroup | null>(null)
  const [filterTabType, setFilterTabType] = useState<'all' | 'table' | 'client' | 'mostrador'>('all')
  const [pendingPaymentTabs, setPendingPaymentTabs] = useState<PendingPaymentTab[]>([])
  const [markingPending, setMarkingPending]         = useState<string | null>(null)
  const [completingPayment, setCompletingPayment]   = useState<string | null>(null)
  const [, setTick]                     = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  const loadShift = useCallback(async () => {
    const supabase = createClient()

    const { data: open } = await supabase
      .from('shifts')
      .select('id, opened_at')
      .eq('status', 'open')
      .eq('branch_id', branchId)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setActiveShift(open ?? null)

    // History: ALL shifts except current active one
    const { data: allShifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('branch_id', branchId)
      .order('opened_at', { ascending: false })
      .limit(30)
    const histShifts = (allShifts ?? []).filter(s => s.id !== (open?.id ?? '')) as ShiftRecord[]
    setHistory(histShifts)

    // Fetch names for all openers / closers in history
    const shiftUserIds = new Set<string>()
    histShifts.forEach(s => {
      if (s.opened_by) shiftUserIds.add(s.opened_by)
      if (s.closed_by) shiftUserIds.add(s.closed_by)
    })
    if (shiftUserIds.size > 0) {
      const { data: sProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', [...shiftUserIds])
      setShiftUserNames(new Map(sProfiles?.map(p => [p.id, p.full_name as string]) ?? []))
    } else {
      setShiftUserNames(new Map())
    }

    // Load pending payment tabs (cross-shift, always)
    const { data: pendingTabsData } = await supabase
      .from('tabs')
      .select('id, label, type, closed_at, orders(total_amount, payment_source)')
      .eq('branch_id', branchId)
      .eq('status', 'closed')
      .eq('pending_payment', true)
      .order('closed_at', { ascending: false })
    const pendingList: PendingPaymentTab[] = (pendingTabsData ?? []).map(t => {
      const ords = ((t.orders ?? []) as { total_amount: number; payment_source: string | null }[])
      return {
        tabId:    t.id,
        tabLabel: t.label,
        tabType:  (t.type ?? 'table') as PendingPaymentTab['tabType'],
        total:    ords.reduce((s, o) => s + o.total_amount, 0),
        closedAt: t.closed_at ?? '',
      }
    })
    setPendingPaymentTabs(pendingList)

    if (open) {
      const [{ data: paid }, { data: active }] = await Promise.all([
        supabase.from('orders')
          .select('id, order_number, table_number, total_amount, status, created_at, payment_source, prepaid')
          .eq('status', 'paid')
          .neq('payment_source', 'pendiente')
          .eq('branch_id', branchId)
          .gte('created_at', open.opened_at)
          .order('created_at', { ascending: false }),
        supabase.from('orders')
          .select('id, order_number, table_number, total_amount, discount_amount, status, created_at, tab_id, prepaid, tab:tabs(id, label, type, source, opened_by), items:order_items(id, quantity, subtotal, notes, product:products(id, name))')
          .in('status', ['pending', 'preparing', 'ready'])
          .eq('branch_id', branchId)
          .order('created_at', { ascending: true }),
      ])
      setPaidOrders((paid ?? []) as Order[])

      // Fetch owner names for tab groups
      const tabOwnerIds = new Set<string>()
      active?.forEach(o => {
        const ob = (o as OrderWithTabOpener).tab?.opened_by
        if (ob) tabOwnerIds.add(ob)
      })
      if (tabOwnerIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', [...tabOwnerIds])
        setOwnerNames(new Map(profiles?.map(p => [p.id, p.full_name as string]) ?? []))
      } else {
        setOwnerNames(new Map())
      }

      setActiveOrders((active ?? []) as unknown as Order[])
    } else {
      // No active shift — still load all pending orders (fuera de turno)
      const { data: active } = await supabase
        .from('orders')
        .select('id, order_number, table_number, total_amount, discount_amount, status, created_at, tab_id, tab:tabs(id, label, type, source, opened_by), items:order_items(id, quantity, subtotal, notes, product:products(id, name))')
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: true })

      const tabOwnerIds = new Set<string>()
      active?.forEach(o => {
        const ob = (o as OrderWithTabOpener).tab?.opened_by
        if (ob) tabOwnerIds.add(ob)
      })
      if (tabOwnerIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', [...tabOwnerIds])
        setOwnerNames(new Map(profiles?.map(p => [p.id, p.full_name as string]) ?? []))
      }

      setPaidOrders([])
      setActiveOrders((active ?? []) as unknown as Order[])
    }
  }, [])

  useEffect(() => { loadShift() }, [loadShift])

  useEffect(() => {
    if (activeShift === undefined) return
    const supabase = createClient()
    const channel = supabase
      .channel('caja-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadShift())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeShift, loadShift])

  async function handleStart() {
    setStarting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('shifts')
      .insert({ opened_at: new Date().toISOString(), status: 'open', opened_by: user?.id, branch_id: branchId })
      .select('id, opened_at')
      .single()
    if (data) setActiveShift(data)
    setStarting(false)
    await loadShift()
  }

  async function handleClose() {
    if (!activeShift) return
    setClosing(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()

    // Re-query fresh to avoid stale state (e.g. POS payments made while Caja was closed)
    const [{ data: freshPaid }, { count: cancelledCount }] = await Promise.all([
      supabase.from('orders').select('id, total_amount, payment_source').eq('status', 'paid').eq('branch_id', branchId).gte('created_at', activeShift.opened_at),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'cancelled').eq('branch_id', branchId).gte('created_at', activeShift.opened_at),
    ])
    const realPaid   = (freshPaid ?? []).filter(o => o.payment_source !== 'pendiente')
    const paid       = freshPaid?.length ?? 0
    const cancelled  = cancelledCount ?? 0
    const total      = realPaid.reduce((s, o) => s + o.total_amount, 0)
    const allOrders  = paid + cancelled + inShiftGroups.reduce((s, g) => s + g.orders.length, 0)
    await supabase.from('shifts').update({
      status: 'closed', closed_at: now, closed_by: user?.id,
      total_orders: allOrders, paid_orders: paid, cancelled_orders: cancelled,
      total_revenue: total, notes: notes.trim() || null,
    }).eq('id', activeShift.id)
    setActiveShift(null)
    setConfirmClose(false)
    setNotes('')
    setClosing(false)
    await loadShift()
  }

  async function handleCobrarTab(group: TabGroup) {
    setLoadingTab(group.key)
    const supabase = createClient()
    const now = new Date().toISOString()
    const ids = group.orders.filter(o => o.status !== 'cancelled').map(o => o.id)
    if (ids.length > 0) {
      await supabase.from('orders')
        .update({ status: 'paid', payment_source: 'caja' })
        .in('id', ids)
    }
    if (group.tabId) {
      await supabase.from('tabs')
        .update({ status: 'closed', closed_at: now })
        .eq('id', group.tabId)
    }
    setLoadingTab(null)
    setTicketGroup(null)
    await loadShift()
  }

  async function handleMarkPending(group: TabGroup) {
    setMarkingPending(group.key)
    const supabase = createClient()
    const now = new Date().toISOString()
    const ids = group.orders.filter(o => o.status !== 'cancelled').map(o => o.id)
    if (ids.length > 0) {
      await supabase.from('orders')
        .update({ status: 'paid', payment_source: 'pendiente' })
        .in('id', ids)
    }
    if (group.tabId) {
      await supabase.from('tabs')
        .update({ status: 'closed', closed_at: now, pending_payment: true })
        .eq('id', group.tabId)
    }
    setMarkingPending(null)
    await loadShift()
  }

  async function handleCompletePendingPayment(tabId: string) {
    setCompletingPayment(tabId)
    const supabase = createClient()
    await supabase.from('orders')
      .update({ payment_source: 'caja' })
      .eq('tab_id', tabId)
      .eq('payment_source', 'pendiente')
    await supabase.from('tabs')
      .update({ pending_payment: false })
      .eq('id', tabId)
    setCompletingPayment(null)
    await loadShift()
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (activeShift === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
      </div>
    )
  }

  const allTabGroups    = groupByTab(activeOrders, ownerNames, t.caja.noTable)

  // Split in-shift vs out-of-shift groups
  const inShiftGroups  = activeShift
    ? allTabGroups.filter(g => g.orders.some(o => new Date(o.created_at) >= new Date(activeShift.opened_at)))
    : []
  const outShiftGroups = activeShift
    ? allTabGroups.filter(g => g.orders.every(o => new Date(o.created_at) < new Date(activeShift.opened_at)))
    : allTabGroups // no shift → all are "outside"

  // totalCobrado = paid orders + prepaid active orders (cash already collected)
  const prepaidActiveTotal = inShiftGroups
    .flatMap(g => g.orders)
    .filter(o => o.prepaid)
    .reduce((s, o) => s + o.total_amount, 0)
  const totalCobrado = paidOrders.reduce((s, o) => s + o.total_amount, 0) + prepaidActiveTotal

  const filteredInShift  = filterTabType === 'all' ? inShiftGroups  : inShiftGroups.filter(g => filterTabType === 'mostrador' ? g.tabType === 'mostrador' : g.tabType === filterTabType)
  const filteredOutShift = filterTabType === 'all' ? outShiftGroups : outShiftGroups.filter(g => filterTabType === 'mostrador' ? g.tabType === 'mostrador' : g.tabType === filterTabType)

  const ticketTab: Tab | null = ticketGroup ? {
    id: ticketGroup.tabId ?? '',
    label: ticketGroup.tabLabel,
    type: ticketGroup.tabType,
    source: ticketGroup.tabSource,
    status: 'open',
    opened_by: '',
    opened_at: '',
    closed_at: null,
  } : null

  // ── No active shift ───────────────────────────────────────────────────────
  if (!activeShift) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="bg-white rounded-2xl border border-stone-200 p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
            <PlayCircle className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-stone-800">{t.caja.noShiftTitle}</p>
            <p className="text-sm text-stone-400 mt-1">{t.caja.noShiftBody}</p>
          </div>
          <button onClick={handleStart} disabled={starting}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-bold text-base transition-colors">
            {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
            {t.caja.startShift}
          </button>
        </div>

        {/* Pedidos pendientes sin turno */}
        {outShiftGroups.length > 0 && (
          <OutShiftSection groups={filteredOutShift} allGroups={outShiftGroups}
            filterTabType={filterTabType} setFilterTabType={setFilterTabType}
            loadingTab={loadingTab} markingPending={markingPending}
            onCobrar={handleCobrarTab} onPrint={g => setTicketGroup(g)}
            onPendingPayment={handleMarkPending} />
        )}

        {pendingPaymentTabs.length > 0 && (
          <PendingPaymentsSection
            tabs={pendingPaymentTabs}
            completingPayment={completingPayment}
            onComplete={handleCompletePendingPayment}
          />
        )}

        {history.length > 0 && (
          <ShiftHistory history={history} userNames={shiftUserNames} open={historyOpen} onToggle={() => setHistoryOpen(h => !h)} />
        )}
        {ticketTab && ticketGroup && (
          <TicketPreview
            tab={ticketTab}
            orders={ticketGroup.orders}
            cobrarTotal={ticketGroup.total}
            onConfirm={() => handleCobrarTab(ticketGroup)}
            onCancel={() => setTicketGroup(null)}
            loading={loadingTab === ticketGroup.key}
          />
        )}
      </div>
    )
  }

  // ── Active shift ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-2xl">

      {/* Shift status bar */}
      <div className="bg-amber-600 rounded-2xl px-5 py-4 flex items-center gap-4 text-white">
        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold">{t.caja.shiftInProgress}</p>
          <p className="text-amber-200 text-sm">
            {t.caja.startedAt(fmtTime(activeShift.opened_at, intl), elapsed(activeShift.opened_at))}
          </p>
        </div>
        <button onClick={loadShift} className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 transition-colors" title={t.pos.refresh}>
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <div className="flex items-center gap-2 text-stone-400 mb-1">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium">{t.caja.charged}</span>
          </div>
          <p className="text-2xl font-black text-green-700">${totalCobrado.toFixed(2)}</p>
          <p className="text-xs text-stone-400 mt-0.5">{t.caja.paymentCount(paidOrders.length)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <div className="flex items-center gap-2 text-stone-400 mb-1">
            <ShoppingBag className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium">{t.caja.inProgress}</span>
          </div>
          <p className="text-2xl font-black text-stone-800">{inShiftGroups.length}</p>
          <p className="text-xs text-stone-400 mt-0.5">{t.caja.accountsWord(inShiftGroups.length)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <div className="flex items-center gap-2 text-stone-400 mb-1">
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium">{t.caja.paidLabel}</span>
          </div>
          <p className="text-2xl font-black text-stone-800">{paidOrders.length}</p>
          <p className="text-xs text-stone-400 mt-0.5">{t.caja.thisShift}</p>
        </div>
      </div>

      {/* Pedidos fuera de turno */}
      {outShiftGroups.length > 0 && (
        <OutShiftSection groups={filteredOutShift} allGroups={outShiftGroups}
          filterTabType={filterTabType} setFilterTabType={setFilterTabType}
          loadingTab={loadingTab} markingPending={markingPending}
          onCobrar={handleCobrarTab} onPrint={g => setTicketGroup(g)}
          onPendingPayment={handleMarkPending} />
      )}

      {/* Cuentas del turno */}
      {inShiftGroups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-stone-600 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              {t.caja.shiftAccounts}
            </p>
            <TypeFilterChips value={filterTabType} onChange={setFilterTabType} />
          </div>
          {filteredInShift.map(group => (
            <TabGroupCard key={group.key} group={group}
              loading={loadingTab === group.key}
              pendingLoading={markingPending === group.key}
              onCobrar={handleCobrarTab} onPrint={g => setTicketGroup(g)}
              onPendingPayment={handleMarkPending} />
          ))}
        </div>
      )}

      {pendingPaymentTabs.length > 0 && (
        <PendingPaymentsSection
          tabs={pendingPaymentTabs}
          completingPayment={completingPayment}
          onComplete={handleCompletePendingPayment}
        />
      )}

      {/* Payment feed */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-500" />
          <span className="font-semibold text-stone-700 text-sm">{t.caja.shiftPayments}</span>
          <span className="ml-auto text-xs text-stone-400">{t.caja.chargeCount(paidOrders.length)}</span>
        </div>
        {paidOrders.length === 0 ? (
          <p className="px-5 py-8 text-center text-stone-400 text-sm">{t.caja.noPaymentsYet}</p>
        ) : (
          <div className="divide-y divide-stone-100 max-h-72 overflow-y-auto">
            {paidOrders.map(o => (
              <div key={o.id} className="px-5 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-stone-800">#{o.order_number} · {o.table_number ?? t.caja.noTable}</p>
                    <SourceBadge source={o.payment_source} />
                  </div>
                  <p className="text-xs text-stone-400">{fmtTime(o.created_at, intl)}</p>
                </div>
                <span className="text-sm font-black text-green-700 shrink-0">${o.total_amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
        {paidOrders.length > 0 && (
          <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex justify-between text-sm">
            <span className="text-stone-500 font-medium">{t.caja.totalCharged}</span>
            <span className="font-black text-green-700">${totalCobrado.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Close shift */}
      {!confirmClose ? (
        <button onClick={() => setConfirmClose(true)}
          className="w-full py-4 rounded-2xl bg-stone-800 hover:bg-stone-900 text-white font-bold text-base transition-colors flex items-center justify-center gap-2">
          <StopCircle className="w-5 h-5" />
          {t.caja.closeShift}
        </button>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-stone-300 p-5 space-y-4">
          <div>
            <p className="font-bold text-stone-800 text-lg">{t.caja.confirmCloseTitle}</p>
            <p className="text-sm text-stone-500 mt-1">{t.caja.confirmCloseBody}</p>
          </div>
          <div className="bg-stone-50 rounded-xl px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-600">{t.caja.duration}</span>
              <span className="font-semibold">{elapsed(activeShift.opened_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">{t.caja.registeredPayments}</span>
              <span className="font-semibold">{paidOrders.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">{t.caja.totalCharged}</span>
              <span className="font-bold text-green-700">${totalCobrado.toFixed(2)}</span>
            </div>
            {inShiftGroups.length > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>{t.caja.unchargedAccounts}</span>
                <span className="font-semibold">{inShiftGroups.length}</span>
              </div>
            )}
            {outShiftGroups.length > 0 && (
              <div className="flex justify-between text-red-600">
                <span>{t.caja.outOfShiftOrders}</span>
                <span className="font-semibold">{outShiftGroups.length}</span>
              </div>
            )}
            {pendingPaymentTabs.length > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>{t.caja.pendingPayments}</span>
                <span className="font-semibold">${pendingPaymentTabs.reduce((s, t) => s + t.total, 0).toFixed(2)}</span>
              </div>
            )}
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder={t.caja.notesPlaceholder}
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setConfirmClose(false)}
              className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50">
              {t.common.cancel}
            </button>
            <button onClick={handleClose} disabled={closing}
              className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold text-sm flex items-center justify-center gap-1.5">
              {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> {t.caja.closeShift}</>}
            </button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <ShiftHistory history={history} userNames={shiftUserNames} open={historyOpen} onToggle={() => setHistoryOpen(h => !h)} />
      )}
      {ticketTab && ticketGroup && (
        <TicketPreview
          tab={ticketTab}
          orders={ticketGroup.orders}
          cobrarTotal={ticketGroup.total}
          onConfirm={() => handleCobrarTab(ticketGroup)}
          onCancel={() => setTicketGroup(null)}
          loading={loadingTab === ticketGroup.key}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeFilterChips({ value, onChange }: { value: 'all' | 'table' | 'client' | 'mostrador'; onChange: (v: 'all' | 'table' | 'client' | 'mostrador') => void }) {
  const { t } = useI18n()
  return (
    <div className="flex gap-1 flex-wrap">
      {(['all', 'mostrador', 'table', 'client'] as const).map(ft => (
        <button key={ft} onClick={() => onChange(ft)}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            value === ft ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
          }`}
        >
          {ft === 'all' ? t.common.all : ft === 'table' ? t.pos.tablesTab : ft === 'client' ? t.pos.clientsTab : t.pos.counterTab}
        </button>
      ))}
    </div>
  )
}

function OutShiftSection({ groups, allGroups, filterTabType, setFilterTabType, loadingTab, markingPending, onCobrar, onPrint, onPendingPayment }: {
  groups: TabGroup[]
  allGroups: TabGroup[]
  filterTabType: 'all' | 'table' | 'client' | 'mostrador'
  setFilterTabType: (v: 'all' | 'table' | 'client' | 'mostrador') => void
  loadingTab: string | null
  markingPending: string | null
  onCobrar: (g: TabGroup) => void
  onPrint: (g: TabGroup) => void
  onPendingPayment: (g: TabGroup) => void
}) {
  const { t } = useI18n()
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {t.caja.outOfShiftOrders}
          <span className="text-xs font-normal text-amber-600">({allGroups.length})</span>
        </p>
        <TypeFilterChips value={filterTabType} onChange={setFilterTabType} />
      </div>
      {groups.map(group => (
        <TabGroupCard key={group.key} group={group}
          loading={loadingTab === group.key}
          pendingLoading={markingPending === group.key}
          onCobrar={onCobrar} onPrint={onPrint}
          onPendingPayment={onPendingPayment}
          highlight="warning" />
      ))}
    </div>
  )
}

function SourceBadge({ source }: { source?: 'pos' | 'caja' | 'agent' | 'pendiente' | null }) {
  const { t } = useI18n()
  if (source === 'caja') return (
    <span className="inline-flex items-center gap-0.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
      <Monitor className="w-3 h-3" /> {t.caja.sourceCaja}
    </span>
  )
  if (source === 'pos') return (
    <span className="inline-flex items-center gap-0.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
      <Smartphone className="w-3 h-3" /> {t.caja.sourcePOS}
    </span>
  )
  if (source === 'agent') return (
    <span className="inline-flex items-center gap-0.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
      <Bot className="w-3 h-3" /> {t.caja.sourceAI}
    </span>
  )
  return null
}

function TabGroupCard({ group, loading, pendingLoading, onCobrar, onPrint, onPendingPayment, highlight }: {
  group: TabGroup
  loading: boolean
  pendingLoading?: boolean
  onCobrar: (g: TabGroup) => void
  onPrint: (g: TabGroup) => void
  onPendingPayment?: (g: TabGroup) => void
  highlight?: 'warning'
}) {
  const { t, intl } = useI18n()
  const isWarning   = highlight === 'warning'
  const allPrepaid  = group.orders.length > 0 && group.orders.every(o => o.prepaid)

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${isWarning ? 'border-amber-300' : 'border-stone-200'}`}>
      <div className={`flex items-center gap-3 px-5 py-3 border-b ${isWarning ? 'bg-amber-50 border-amber-100' : 'bg-amber-50 border-amber-100'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {group.tabType === 'table'
              ? <><LayoutGrid className="w-3 h-3 text-stone-400 shrink-0" /><span className="text-xs text-stone-400">{t.floor.table}</span></>
              : group.tabType === 'mostrador'
                ? <ShoppingBag className="w-3 h-3 text-brand-400 shrink-0" />
                : <UserRound className="w-3 h-3 text-brand-400 shrink-0" />
            }
            <p className="font-bold text-amber-800 truncate">{group.tabLabel}</p>
            {group.tabSource === 'agent' && (
              <span className="inline-flex items-center gap-0.5 text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold">
                <Bot className="w-3 h-3" /> {t.caja.sourceAI}
              </span>
            )}
            {allPrepaid && (
              <span className="inline-flex items-center gap-0.5 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">
                {t.caja.alreadyPaid}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-amber-600">{t.caja.ordersInKitchen(group.orders.length)}</p>
            {group.openerName && group.tabSource !== 'agent' && (
              <p className="text-xs text-stone-400 flex items-center gap-1">
                <UserRound className="w-3 h-3" />{group.openerName}
              </p>
            )}
            {group.tabSource === 'agent' && (
              <p className="text-xs text-violet-500 flex items-center gap-1">
                <Bot className="w-3 h-3" /> {t.pos.aiAssistant}
              </p>
            )}
          </div>
        </div>
        <span className="font-black text-stone-800 text-base shrink-0">${group.total.toFixed(2)}</span>
        <button onClick={() => onPrint(group)}
          className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 transition-colors shrink-0"
          title={t.caja.printAccount}>
          <Printer className="w-4 h-4" />
        </button>
        {!allPrepaid && onPendingPayment && (
          <button onClick={() => onPendingPayment(group)} disabled={pendingLoading || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-100 hover:bg-orange-200 disabled:opacity-50 text-orange-800 text-sm font-semibold transition-colors shrink-0 border border-orange-200">
            {pendingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hourglass className="w-4 h-4" />}
            {t.caja.pendingBtn}
          </button>
        )}
        {!allPrepaid && (
          <button onClick={() => onCobrar(group)} disabled={loading || !!pendingLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold transition-colors shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {t.pos.charge}
          </button>
        )}
      </div>
      <div className="divide-y divide-stone-100">
        {group.orders.map(order => (
          <div key={order.id} className="px-5 py-2.5">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold text-stone-500">{t.ticket.orderN(order.order_number)} · {fmtTime(order.created_at, intl)}</p>
              {order.prepaid && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">{t.kitchen.prepaid}</span>
              )}
            </div>
            <div className="space-y-0.5">
              {order.items?.map(item => (
                <div key={item.id} className="flex justify-between text-sm text-stone-700">
                  <span>{item.quantity}× {item.product?.name}</span>
                  <span className="text-stone-500">${item.subtotal.toFixed(2)}</span>
                </div>
              ))}
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>{t.common.discount}</span>
                  <span>-${order.discount_amount.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PendingPaymentsSection({ tabs, completingPayment, onComplete }: {
  tabs: PendingPaymentTab[]
  completingPayment: string | null
  onComplete: (tabId: string) => void
}) {
  const { t: tr, intl } = useI18n()

  return (
    <div className="bg-white rounded-2xl border border-orange-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-orange-100 bg-orange-50 flex items-center gap-2">
        <Hourglass className="w-4 h-4 text-orange-500" />
        <span className="font-semibold text-orange-800 text-sm">{tr.caja.pendingPayments}</span>
        <span className="ml-auto text-xs text-orange-500">{tr.caja.accountCount(tabs.length)}</span>
      </div>
      <div className="divide-y divide-stone-100">
        {tabs.map(t => (
          <div key={t.tabId} className="px-5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {t.tabType === 'table'
                  ? <LayoutGrid className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  : t.tabType === 'mostrador'
                    ? <ShoppingBag className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    : <UserRound className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                }
                <p className="font-semibold text-stone-800 text-sm">
                  {t.tabType === 'table' ? tr.pos.tableN(t.tabLabel) : t.tabLabel}
                </p>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">{fmtShort(t.closedAt, intl)}</p>
            </div>
            <span className="font-black text-orange-700 text-base shrink-0">${t.total.toFixed(2)}</span>
            <button
              onClick={() => onComplete(t.tabId)}
              disabled={completingPayment === t.tabId}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold transition-colors shrink-0"
            >
              {completingPayment === t.tabId
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CircleCheckBig className="w-4 h-4" />
              }
              {tr.caja.completePayment}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ShiftHistory({ history, userNames, open, onToggle }: {
  history: ShiftRecord[]
  userNames: Map<string, string>
  open: boolean
  onToggle: () => void
}) {
  const { t, intl } = useI18n()
  function duration(from: string, to: string | null) {
    if (!to) return elapsed(from) + ' ' + t.caja.openSuffix
    const mins = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000)
    if (mins < 60) return `${mins} min`
    const h = Math.floor(mins / 60), m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-stone-400" />
          <span className="font-semibold text-stone-800">{t.caja.shiftHistory}</span>
          <span className="text-xs text-stone-400">({history.length})</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>
      {open && (
        <div className="divide-y divide-stone-100">
          {history.map(sh => {
            const closerName  = sh.closed_by  ? (userNames.get(sh.closed_by)  ?? t.pos.unknown) : null
            const openerName  = sh.opened_by  ? (userNames.get(sh.opened_by)  ?? t.pos.unknown) : null
            return (
              <div key={sh.id} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-stone-800">
                      {sh.closed_at ? fmtShort(sh.closed_at, intl) : fmtShort(sh.opened_at, intl)}
                    </p>
                    {sh.status === 'open' && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{t.caja.notClosed}</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {duration(sh.opened_at, sh.closed_at)}
                    {sh.total_orders > 0 && ` · ${t.floor.orderCount(sh.total_orders)}`}
                    {sh.paid_orders > 0 && ` · ${t.caja.paidCount(sh.paid_orders)}`}
                    {sh.cancelled_orders > 0 && ` · ${t.caja.cancelledCount(sh.cancelled_orders)}`}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {openerName && (
                      <p className="text-xs text-stone-400">
                        <span className="text-stone-500 font-medium">{t.caja.openedBy}</span> {openerName}
                      </p>
                    )}
                    {closerName && sh.status === 'closed' && (
                      <p className="text-xs text-stone-400">
                        <span className="text-stone-500 font-medium">{t.caja.closedBy}</span> {closerName}
                      </p>
                    )}
                  </div>
                  {sh.notes && <p className="text-xs text-stone-500 italic mt-0.5">&quot;{sh.notes}&quot;</p>}
                </div>
                <span className="text-base font-black text-green-700 shrink-0">${(sh.total_revenue ?? 0).toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
