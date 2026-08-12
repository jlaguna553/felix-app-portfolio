'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tab, Order } from '@/lib/types'
import {
  Plus, Clock, Loader2, Users, RefreshCw,
  LayoutGrid, UserRound, ChefHat, CheckCircle2, Lock, DollarSign, ShoppingBag, Bot, Printer, Hourglass,
} from 'lucide-react'
import { TicketPreview } from './TicketPreview'
import { useI18n } from '@/lib/i18n/I18nProvider'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TabCard {
  id: string
  label: string
  opened_at: string
  type: 'table' | 'client' | 'mostrador'
  source?: 'pos' | 'agent'
  opened_by: string
  opener_name: string
  order_count: number
  total: number
  ready_count: number
  has_active: boolean
}

interface TableRow {
  id: string
  number: number
  pos_x: number
  pos_y: number
}

interface Props {
  onSelect: (tab: Tab) => void
  branchId: string
}

function timeOpen(date: string, justOpened: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 1) return justOpened
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TabSelector({ onSelect, branchId }: Props) {
  const { t } = useI18n()
  const [tabs, setTabs]               = useState<TabCard[]>([])
  const [tables, setTables]           = useState<TableRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [newLabel, setNewLabel]       = useState('')
  const [newType, setNewType]         = useState<'table' | 'client' | 'mostrador'>('mostrador')
  const [creating, setCreating]         = useState(false)
  const [createError, setCreateError]   = useState<string | null>(null)
  const [cobrandoId,      setCobrandoId]      = useState<string | null>(null)
  const [markingPendingId, setMarkingPendingId] = useState<string | null>(null)
  const [ticketData, setTicketData]     = useState<{ tab: Tab; orders: Order[]; total: number } | null>(null)
  const [printData,  setPrintData]      = useState<{ tab: Tab; orders: Order[]; total: number } | null>(null)
  const [printingId, setPrintingId]     = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentRole, setCurrentRole]     = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => { if (data) setCurrentRole(data.role) })
    })
  }, [])

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: tabsData }, { data: tablesData }] = await Promise.all([
      supabase
        .from('tabs')
        .select('id, label, opened_at, type, source, opened_by, orders(total_amount, status)')
        .eq('status', 'open')
        .eq('branch_id', branchId)
        .order('opened_at', { ascending: false }),
      supabase.from('tables').select('*').eq('branch_id', branchId).order('number'),
    ])

    if (tablesData) setTables(tablesData)

    if (!tabsData) { setLoading(false); return }

    const userIds = [...new Set(tabsData.map(t => t.opened_by))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)
    const nameMap = new Map(profiles?.map(p => [p.id, p.full_name as string]) ?? [])

    setTabs(tabsData.map(t => {
      const orders = ((t.orders ?? []) as { total_amount: number; status: string }[])
      const active = orders.filter(o => o.status !== 'cancelled')
      return {
        id:           t.id,
        label:        t.label,
        opened_at:    t.opened_at,
        type:         (t.type ?? 'table') as 'table' | 'client' | 'mostrador',
        source:       (t.source ?? 'pos') as 'pos' | 'agent',
        opened_by:    t.opened_by,
        opener_name:  nameMap.get(t.opened_by) ?? '',
        order_count:  active.length,
        total:        active.reduce((s, o) => s + o.total_amount, 0),
        ready_count:  active.filter(o => o.status === 'ready').length,
        has_active:   active.some(o => ['pending', 'preparing'].includes(o.status)),
      }
    }))
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const supabase = createClient()
    const channel = supabase
      .channel('tab-selector-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tabs' },   fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  // Step 1: fetch orders with items and show TicketPreview
  async function handleCobrarTab(e: React.MouseEvent, tabCard: TabCard) {
    e.stopPropagation()
    setCobrandoId(tabCard.id)
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select('*, items:order_items(*, product:products(*))')
      .eq('tab_id', tabCard.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
    const orders = (data ?? []) as Order[]
    const unpaid = orders.filter(o => o.status !== 'paid')
    const total  = unpaid.reduce((s, o) => s + o.total_amount, 0)
    const tab: Tab = {
      id: tabCard.id, label: tabCard.label, opened_by: tabCard.opened_by,
      opened_at: tabCard.opened_at, status: 'open', closed_at: null,
      type: tabCard.type, source: tabCard.source,
    }
    setTicketData({ tab, orders, total })
    setCobrandoId(null)
  }

  // Step 2: called by TicketPreview onConfirm
  async function handleCobrarConfirm() {
    if (!ticketData) return
    setCobrandoId(ticketData.tab.id)
    const supabase = createClient()
    await supabase.from('orders')
      .update({ status: 'paid' })
      .eq('tab_id', ticketData.tab.id)
      .in('status', ['pending', 'preparing', 'ready'])
    await supabase.from('tabs')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', ticketData.tab.id)
    setTicketData(null)
    setCobrandoId(null)
    await fetchData()
  }

  function canManageTab(tab: TabCard): boolean {
    if (!currentRole || !currentUserId) return true
    if (currentRole === 'admin' || currentRole === 'cashier') return true
    return tab.opened_by === currentUserId
  }

  // Print-only: fetch orders and show TicketPreview without charge step
  async function handlePrintTab(e: React.MouseEvent, tabCard: TabCard) {
    e.stopPropagation()
    setPrintingId(tabCard.id)
    const { data } = await createClient()
      .from('orders')
      .select('*, items:order_items(*, product:products(*))')
      .eq('tab_id', tabCard.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
    const orders = (data ?? []) as Order[]
    const total  = orders
      .filter(o => o.status !== 'paid')
      .reduce((s, o) => s + o.total_amount, 0)
    const tab: Tab = {
      id: tabCard.id, label: tabCard.label, opened_by: tabCard.opened_by,
      opened_at: tabCard.opened_at, status: 'open', closed_at: null,
      type: tabCard.type, source: tabCard.source,
    }
    setPrintData({ tab, orders, total })
    setPrintingId(null)
  }

  async function handlePendingPaymentTab(e: React.MouseEvent, tabCard: TabCard) {
    e.stopPropagation()
    setMarkingPendingId(tabCard.id)
    const supabase = createClient()
    await supabase.from('orders')
      .update({ status: 'paid', payment_source: 'pendiente' })
      .eq('tab_id', tabCard.id)
      .in('status', ['pending', 'preparing', 'ready'])
    await supabase.from('tabs')
      .update({ status: 'closed', closed_at: new Date().toISOString(), pending_payment: true })
      .eq('id', tabCard.id)
    setMarkingPendingId(null)
    await fetchData()
  }

  // ── Open a tab for a physical table (free table clicked) ──────────────────

  async function handleOpenTableTab(tableNumber: number) {
    setCreating(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreating(false); return }
    const { data } = await supabase
      .from('tabs')
      .insert({ label: String(tableNumber), opened_by: user.id, type: 'table', branch_id: branchId })
      .select()
      .single()
    if (data) onSelect(data as Tab)
    setCreating(false)
  }

  // ── Open a mostrador (counter) tab — no label needed ─────────────────────

  async function handleOpenMostradorTab() {
    setCreating(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreating(false); return }
    const { data } = await supabase
      .from('tabs')
      .insert({ label: 'Mostrador', opened_by: user.id, type: 'mostrador', branch_id: branchId })
      .select()
      .single()
    if (data) onSelect(data as Tab)
    setCreating(false)
  }

  // ── Create client tab via text input ──────────────────────────────────────

  function handleLabelChange(value: string) {
    setCreateError(null)
    setNewLabel(value)
  }

  async function handleCreate() {
    const label = newLabel.trim()
    if (!label) return
    setCreateError(null)
    setCreating(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreating(false); return }
    const { data } = await supabase
      .from('tabs')
      .insert({ label, opened_by: user.id, type: 'client', branch_id: branchId })
      .select()
      .single()
    if (data) onSelect(data as Tab)
    setCreating(false)
    setNewLabel('')
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  // Map table number → open tab (if any)
  const tabByTableNumber = new Map(
    tabs.filter(t => t.type === 'table').map(t => [t.label, t])
  )
  const clientTabs    = tabs.filter(t => t.type === 'client')
  const mostradorTabs = tabs.filter(t => t.type === 'mostrador')

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Type toggle */}
      <div className="bg-white border-b border-stone-200 px-4 py-3 shrink-0">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">{t.pos.accountType}</p>
        <div className="flex gap-1.5">
          <button
            onClick={() => setNewType('mostrador')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              newType === 'mostrador'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-stone-300 text-stone-600 hover:bg-stone-50'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" /> {t.pos.counterTab}
          </button>
          <button
            onClick={() => setNewType('table')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              newType === 'table'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-stone-300 text-stone-600 hover:bg-stone-50'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> {t.pos.tablesTab}
          </button>
          <button
            onClick={() => setNewType('client')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              newType === 'client'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-stone-300 text-stone-600 hover:bg-stone-50'
            }`}
          >
            <UserRound className="w-3.5 h-3.5" /> {t.pos.clientsTab}
          </button>
          <button
            onClick={fetchData}
            className="ml-auto p-2 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
            title={t.pos.refresh}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Client input — only shown in client mode */}
        {newType === 'client' && (
          <div className="flex gap-2 mt-3">
            <div className="flex-1 min-w-0">
              <input
                value={newLabel}
                onChange={e => handleLabelChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder={t.pos.clientPlaceholder}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                  createError ? 'border-red-400' : 'border-stone-300'
                }`}
              />
              {createError && <p className="text-xs text-red-500 mt-1">{createError}</p>}
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !newLabel.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-stone-300 disabled:text-stone-400 text-white rounded-xl font-semibold text-sm transition-colors shrink-0"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> {t.pos.open}</>}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
        </div>
      ) : newType === 'mostrador' ? (
        /* ── Mostrador (counter) ─────────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <button
            onClick={handleOpenMostradorTab}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 py-5 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-base transition-colors disabled:opacity-60"
          >
            {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShoppingBag className="w-5 h-5" /> {t.pos.newCounterSale}</>}
          </button>

          {mostradorTabs.length > 0 && (
            <>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{t.pos.openSales}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {mostradorTabs.map(tab => {
                  const isReady     = tab.ready_count > 0
                  const isInKitchen = tab.has_active && !isReady
                  const selectable  = canManageTab(tab)
                  const isOwn       = tab.opened_by === currentUserId
                  return (
                    <button
                      key={tab.id}
                      onClick={selectable ? () => onSelect({
                        id: tab.id, label: tab.label, opened_at: tab.opened_at,
                        opened_by: tab.opened_by, status: 'open', closed_at: null,
                        type: 'mostrador', source: tab.source,
                      }) : undefined}
                      disabled={!selectable}
                      className={`relative transition-all rounded-2xl border-2 p-4 text-left flex flex-col gap-1 min-h-[130px] ${
                        !selectable
                          ? 'bg-stone-50 border-stone-200 opacity-60 cursor-not-allowed'
                          : isReady
                            ? 'bg-green-50 border-green-400 hover:bg-green-100 active:scale-95'
                            : 'bg-white border-stone-200 hover:bg-brand-50 hover:border-brand-400 active:scale-95'
                      }`}
                    >
                      {!selectable && (
                        <span className="absolute top-2 right-2 text-stone-400">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {tab.source === 'agent' && (
                        <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold">
                          <Bot className="w-3 h-3" /> {t.pos.aiBadge}
                        </span>
                      )}

                      <div className="flex items-center gap-1.5 pr-10">
                        <ShoppingBag className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                        <p className="font-bold text-stone-800 text-sm">{t.pos.counterTab}</p>
                      </div>

                      <p className={`text-xs truncate ${isOwn ? 'text-brand-500 font-medium' : 'text-stone-400'}`}>
                        {tab.source === 'agent' ? t.pos.aiAssistant : (isOwn ? t.pos.you : (tab.opener_name || t.pos.unknown))}
                      </p>

                      <div className="flex items-center gap-1 text-xs text-stone-400">
                        <Clock className="w-3 h-3 shrink-0" />
                        {timeOpen(tab.opened_at, t.pos.justOpened)}
                      </div>

                      {isReady && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-green-500 text-white px-2 py-0.5 rounded-full mt-0.5 w-fit">
                          <CheckCircle2 className="w-3 h-3" />
                          {tab.ready_count === 1 ? t.pos.ready : t.pos.readyCount(tab.ready_count)}
                        </span>
                      )}
                      {isInKitchen && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-0.5 w-fit">
                          <ChefHat className="w-3 h-3" />
                          {t.pos.inKitchen}
                        </span>
                      )}

                      <div className="mt-auto pt-2 border-t border-stone-100 w-full flex items-end justify-between gap-1">
                        <div>
                          {tab.order_count > 0 ? (
                            <p className={`text-xl font-black ${isReady ? 'text-green-700' : 'text-brand-700'}`}>
                              ${tab.total.toFixed(2)}
                            </p>
                          ) : (
                            <p className="text-xs text-stone-400 italic">{t.pos.noOrdersYet}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {tab.order_count > 0 && (
                            <button
                              onClick={e => handlePrintTab(e, tab)}
                              disabled={printingId === tab.id}
                              title={t.pos.printTicket}
                              className="shrink-0 p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-50 transition-colors"
                            >
                              {printingId === tab.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Printer className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}
                          {(currentRole === 'admin' || currentRole === 'cashier') && tab.order_count > 0 && (
                            <button
                              onClick={e => handlePendingPaymentTab(e, tab)}
                              disabled={markingPendingId === tab.id || cobrandoId === tab.id}
                              title={t.pos.pendingPayment}
                              className="shrink-0 p-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 disabled:opacity-50 transition-colors"
                            >
                              {markingPendingId === tab.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Hourglass className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}
                          {(currentRole === 'admin' || currentRole === 'cashier') && tab.order_count > 0 && (
                            <button
                              onClick={e => handleCobrarTab(e, tab)}
                              disabled={cobrandoId === tab.id || !!markingPendingId}
                              title={t.pos.charge}
                              className="shrink-0 p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 disabled:opacity-50 transition-colors"
                            >
                              {cobrandoId === tab.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <DollarSign className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      ) : newType === 'table' ? (
        /* ── Table grid ─────────────────────────────────────────────────── */
        tables.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-400 gap-3 pb-12">
            <LayoutGrid className="w-14 h-14 text-stone-200" />
            <p className="font-medium text-stone-500">{t.pos.noTables}</p>
            <p className="text-sm text-stone-400 text-center px-8">{t.pos.noTablesHint}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 content-start">
            {tables.map(table => {
              const tab = tabByTableNumber.get(String(table.number)) ?? null
              const isFree      = !tab
              const isReady     = tab ? tab.ready_count > 0 : false
              const isInKitchen = tab ? tab.has_active && !isReady : false
              const selectable  = isFree || (tab ? canManageTab(tab) : true)

              return (
                <button
                  key={table.id}
                  disabled={!selectable || creating}
                  onClick={async () => {
                    if (!selectable) return
                    if (isFree) {
                      await handleOpenTableTab(table.number)
                    } else if (tab) {
                      onSelect({
                        id: tab.id, label: tab.label, opened_at: tab.opened_at,
                        opened_by: tab.opened_by, status: 'open', closed_at: null, type: 'table',
                      })
                    }
                  }}
                  className={`relative transition-all rounded-2xl border-2 p-4 text-left flex flex-col gap-1 min-h-[130px] ${
                    !selectable
                      ? 'bg-stone-50 border-stone-200 opacity-60 cursor-not-allowed'
                      : isFree
                        ? 'bg-white border-stone-200 hover:bg-brand-50 hover:border-brand-400 active:scale-95'
                        : isReady
                          ? 'bg-green-50 border-green-400 hover:bg-green-100 active:scale-95'
                          : 'bg-amber-50 border-amber-300 hover:bg-amber-100 active:scale-95'
                  }`}
                >
                  {!selectable && (
                    <span className="absolute top-2 right-2 text-stone-400">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <p className="font-bold text-stone-800 text-sm">{t.pos.tableN(table.number)}</p>
                  </div>

                  {tab ? (
                    <>
                      <p className="text-xs text-stone-400 truncate">
                        {tab.opened_by === currentUserId ? t.pos.you : (tab.opener_name || t.pos.unknown)}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-stone-400">
                        <Clock className="w-3 h-3 shrink-0" />
                        {timeOpen(tab.opened_at, t.pos.justOpened)}
                      </div>
                      {isReady && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-green-500 text-white px-2 py-0.5 rounded-full mt-0.5 w-fit">
                          <CheckCircle2 className="w-3 h-3" />
                          {tab.ready_count === 1 ? t.pos.ready : t.pos.readyCount(tab.ready_count)}
                        </span>
                      )}
                      {isInKitchen && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-0.5 w-fit">
                          <ChefHat className="w-3 h-3" />
                          {t.pos.inKitchen}
                        </span>
                      )}
                      <div className="mt-auto pt-2 border-t border-stone-100 w-full flex items-end justify-between gap-1">
                        <div>
                          {tab.order_count > 0 ? (
                            <p className={`text-xl font-black ${isReady ? 'text-green-700' : 'text-brand-700'}`}>
                              ${tab.total.toFixed(2)}
                            </p>
                          ) : (
                            <p className="text-xs text-stone-400 italic">{t.pos.noOrdersYet}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {tab.order_count > 0 && (
                            <button
                              onClick={e => handlePrintTab(e, tab)}
                              disabled={printingId === tab.id}
                              title={t.pos.printTicket}
                              className="shrink-0 p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-50 transition-colors"
                            >
                              {printingId === tab.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Printer className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}
                          {(currentRole === 'admin' || currentRole === 'cashier') && tab.order_count > 0 && (
                            <button
                              onClick={e => handlePendingPaymentTab(e, tab)}
                              disabled={markingPendingId === tab.id || cobrandoId === tab.id}
                              title={t.pos.pendingPayment}
                              className="shrink-0 p-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 disabled:opacity-50 transition-colors"
                            >
                              {markingPendingId === tab.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Hourglass className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}
                          {(currentRole === 'admin' || currentRole === 'cashier') && tab.order_count > 0 && (
                            <button
                              onClick={e => handleCobrarTab(e, tab)}
                              disabled={cobrandoId === tab.id || !!markingPendingId}
                              title={t.pos.charge}
                              className="shrink-0 p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 disabled:opacity-50 transition-colors"
                            >
                              {cobrandoId === tab.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <DollarSign className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-stone-400 mt-auto pt-2">{t.pos.freeTable}</p>
                  )}
                </button>
              )
            })}
          </div>
        )
      ) : (
        /* ── Client tabs ─────────────────────────────────────────────────── */
        clientTabs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-400 gap-3 pb-12">
            <Users className="w-14 h-14 text-stone-200" />
            <p className="font-medium text-stone-500">{t.pos.noClients}</p>
            <p className="text-sm text-stone-400 text-center px-8">{t.pos.noClientsHint}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 content-start">
            {clientTabs.map(tab => {
              const isReady     = tab.ready_count > 0
              const isInKitchen = tab.has_active && !isReady
              const selectable  = canManageTab(tab)
              const isOwn       = tab.opened_by === currentUserId

              return (
                <button
                  key={tab.id}
                  onClick={selectable ? () => onSelect({
                    id: tab.id, label: tab.label, opened_at: tab.opened_at,
                    opened_by: tab.opened_by, status: 'open', closed_at: null, type: tab.type,
                  }) : undefined}
                  disabled={!selectable}
                  className={`relative transition-all rounded-2xl border-2 p-4 text-left flex flex-col gap-1 min-h-[130px] ${
                    !selectable
                      ? 'bg-stone-50 border-stone-200 opacity-60 cursor-not-allowed'
                      : isReady
                        ? 'bg-green-50 border-green-400 hover:bg-green-100 active:scale-95'
                        : 'bg-white border-stone-200 hover:bg-brand-50 hover:border-brand-400 active:scale-95'
                  }`}
                >
                  {!selectable && (
                    <span className="absolute top-2 right-2 text-stone-400">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  )}

                  <div className="flex items-center gap-1.5 pr-5">
                    <UserRound className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                    <p className="font-bold text-stone-800 text-sm leading-tight line-clamp-2">{tab.label}</p>
                  </div>

                  <p className={`text-xs truncate ${isOwn ? 'text-brand-500 font-medium' : 'text-stone-400'}`}>
                    {isOwn ? t.pos.you : (tab.opener_name || t.pos.unknown)}
                  </p>

                  <div className="flex items-center gap-1 text-xs text-stone-400">
                    <Clock className="w-3 h-3 shrink-0" />
                    {timeOpen(tab.opened_at, t.pos.justOpened)}
                  </div>

                  {isReady && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-green-500 text-white px-2 py-0.5 rounded-full mt-0.5 w-fit">
                      <CheckCircle2 className="w-3 h-3" />
                      {tab.ready_count === 1 ? t.pos.readyDeliver : t.pos.readyCount(tab.ready_count)}
                    </span>
                  )}
                  {isInKitchen && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-0.5 w-fit">
                      <ChefHat className="w-3 h-3" />
                      {t.pos.inKitchen}
                    </span>
                  )}

                  <div className="mt-auto pt-2 border-t border-stone-100 w-full flex items-end justify-between gap-1">
                    <div>
                      {tab.order_count > 0 ? (
                        <>
                          <p className="text-xs text-stone-400">{t.pos.rounds(tab.order_count)}</p>
                          <p className={`text-xl font-black ${isReady ? 'text-green-700' : 'text-brand-700'}`}>
                            ${tab.total.toFixed(2)}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-stone-400 italic">{t.pos.noOrdersYet}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {tab.order_count > 0 && (
                        <button
                          onClick={e => handlePrintTab(e, tab)}
                          disabled={printingId === tab.id}
                          title={t.pos.printTicket}
                          className="shrink-0 p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-50 transition-colors"
                        >
                          {printingId === tab.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Printer className="w-3.5 h-3.5" />
                          }
                        </button>
                      )}
                      {(currentRole === 'admin' || currentRole === 'cashier') && tab.order_count > 0 && (
                        <button
                          onClick={e => handleCobrarTab(e, tab)}
                          disabled={cobrandoId === tab.id}
                          title={t.pos.charge}
                          className="shrink-0 p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 disabled:opacity-50 transition-colors"
                        >
                          {cobrandoId === tab.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <DollarSign className="w-3.5 h-3.5" />
                          }
                        </button>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )
      )}
      {ticketData && (
        <TicketPreview
          tab={ticketData.tab}
          orders={ticketData.orders}
          cobrarTotal={ticketData.total}
          onConfirm={handleCobrarConfirm}
          onCancel={() => setTicketData(null)}
          loading={cobrandoId !== null}
        />
      )}
      {/* Print-only preview — no charge step */}
      {printData && (
        <TicketPreview
          tab={printData.tab}
          orders={printData.orders}
          cobrarTotal={printData.total}
          onCancel={() => setPrintData(null)}
        />
      )}
    </div>
  )
}
