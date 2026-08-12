'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Trash2, X, DollarSign, Loader2,
  Pencil, Check, Square, ShoppingBag, CheckCheck, Printer, Hourglass,
} from 'lucide-react'
import { TicketPreview } from '@/components/pos/TicketPreview'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { Order, Tab } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TableRow { id: string; number: number; pos_x: number; pos_y: number }
interface ShapeRow {
  id: string; label: string
  pos_x: number; pos_y: number; width: number; height: number; fill: string
}
interface TabRow {
  id: string; label: string; status: 'open' | 'closed'
  type: 'table' | 'client'
  opened_by: string; opened_at: string; closed_at: string | null
  last_attended_at: string | null
  billing_requested_at: string | null
}
interface OrderRow { id: string; tab_id: string; status: string; total_amount: number; created_at: string }

type TableStatus = 'free' | 'waiting' | 'active' | 'ready' | 'served' | 'account'

interface TableVM extends TableRow {
  tableStatus: TableStatus
  tab: TabRow | null
  tabTotal: number
  orderCount: number
  openerName: string
  openerInitials: string
}

type DragState = {
  kind: 'table' | 'shape' | 'shape-resize'
  id: string
  startX: number; startY: number
  origX: number;  origY: number
  origW?: number; origH?: number   // resize only
  handle?: string                  // resize only
  moved: boolean
}

// ── Palette ────────────────────────────────────────────────────────────────────

const STYLE: Record<TableStatus, {
  fill: string; stroke: string; text: string
  badge: string; badgeBg: string
}> = {
  free:    { fill: '#fdf6ec', stroke: '#c9a87a', text: '#7a5c3a', badge: 'bg-amber-100 text-amber-700',   badgeBg: '#c9a87a' },
  waiting: { fill: '#e8c99a', stroke: '#a07030', text: '#5c3a10', badge: 'bg-yellow-200 text-yellow-900', badgeBg: '#a07030' },
  active:  { fill: '#7a3b10', stroke: '#5c2a08', text: '#ffffff', badge: 'bg-amber-900 text-amber-100',   badgeBg: '#5c2a08' },
  ready:   { fill: '#c49010', stroke: '#9a7008', text: '#ffffff', badge: 'bg-yellow-500 text-white',       badgeBg: '#9a7008' },
  served:  { fill: '#3a7a48', stroke: '#285534', text: '#ffffff', badge: 'bg-green-700 text-white',        badgeBg: '#285534' },
  account: { fill: '#a07820', stroke: '#7a5c10', text: '#ffffff', badge: 'bg-yellow-700 text-white',       badgeBg: '#7a5c10' },
}

const HANDLE_CURSOR: Record<string, string> = {
  nw: 'nw-resize', n: 'ns-resize', ne: 'ne-resize',
  e: 'ew-resize',  se: 'se-resize', s: 'ns-resize',
  sw: 'sw-resize', w: 'ew-resize',
}

const SHAPE_COLORS = ['#f0e8d8', '#d4c4a8', '#c8d8c8', '#c8d8e8', '#d8c8d8', '#e8c8c8']

const TW = 104
const TH = 82
const TR = 14

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return (parts[0]?.[0] ?? '?').toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function elapsed(isoDate: string): string {
  const mins = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h${m}` : `${h}h`
}

// Compute new shape geometry from a resize drag
function applyResize(
  handle: string,
  origX: number, origY: number, origW: number, origH: number,
  dx: number, dy: number,
): { pos_x: number; pos_y: number; width: number; height: number } {
  const MIN_W = 40; const MIN_H = 30
  let x = origX, y = origY, w = origW, h = origH

  switch (handle) {
    case 'se': w = Math.max(MIN_W, origW + dx); h = Math.max(MIN_H, origH + dy); break
    case 'e':  w = Math.max(MIN_W, origW + dx); break
    case 's':  h = Math.max(MIN_H, origH + dy); break
    case 'nw': {
      w = Math.max(MIN_W, origW - dx); h = Math.max(MIN_H, origH - dy)
      x = origX + origW - w; y = origY + origH - h; break
    }
    case 'ne': {
      w = Math.max(MIN_W, origW + dx); h = Math.max(MIN_H, origH - dy)
      y = origY + origH - h; break
    }
    case 'sw': {
      w = Math.max(MIN_W, origW - dx); h = Math.max(MIN_H, origH + dy)
      x = origX + origW - w; break
    }
    case 'n':  { h = Math.max(MIN_H, origH - dy); y = origY + origH - h; break }
    case 'w':  { w = Math.max(MIN_W, origW - dx); x = origX + origW - w; break }
  }
  return { pos_x: x, pos_y: y, width: w, height: h }
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props { canManage: boolean; branchId: string }

export function FloorPlan({ canManage, branchId }: Props) {
  const router = useRouter()
  // `tr` en vez de `t`: los .map() de este componente usan `t` para las mesas
  const { t: tr } = useI18n()

  const [tables,   setTables]   = useState<TableVM[]>([])
  const [shapes,   setShapes]   = useState<ShapeRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editMode, setEditMode] = useState(false)

  const [selTable, setSelTable] = useState<string | null>(null)
  const [selShape, setSelShape] = useState<string | null>(null)

  const [cobrando,         setCobrando]         = useState(false)
  const [pendingPayment,   setPendingPayment]   = useState(false)
  const [ticketData,       setTicketData]       = useState<{ tab: Tab; orders: Order[]; total: number } | null>(null)
  const [printData,        setPrintData]        = useState<{ tab: Tab; orders: Order[]; total: number } | null>(null)
  const [printing,         setPrinting]         = useState(false)
  const [adding,           setAdding]           = useState(false)
  const [addingShape,      setAddingShape]      = useState(false)
  const [openingTab,       setOpeningTab]       = useState(false)
  const [attending,        setAttending]        = useState(false)
  const [requesting,       setRequesting]       = useState(false)
  const [flashError,       setFlashError]       = useState<string | null>(null)
  const [shapeLabelDraft,  setShapeLabelDraft]  = useState('')

  const drag   = useRef<DragState | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const supabase = createClient()
    const [
      { data: tabsRaw },
      { data: tablesRaw },
      { data: ordersRaw },
      { data: shapesRaw },
    ] = await Promise.all([
      supabase.from('tabs')
        .select('id, label, status, type, opened_by, opened_at, closed_at, last_attended_at, billing_requested_at')
        .eq('status', 'open')
        .eq('branch_id', branchId),
      supabase.from('tables').select('*').eq('branch_id', branchId).order('number'),
      supabase.from('orders')
        .select('id, tab_id, status, total_amount, created_at')
        .neq('status', 'cancelled')
        .eq('branch_id', branchId),
      supabase.from('floor_shapes').select('*').eq('branch_id', branchId).order('created_at'),
    ])

    // Fetch opener names (PostgREST can't join auth.users directly)
    const openerIds = [...new Set((tabsRaw ?? []).map(t => t.opened_by))]
    const { data: profiles } = openerIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', openerIds)
      : { data: [] }
    const nameMap = new Map((profiles ?? []).map(p => [p.id, p.full_name as string]))

    const ordersByTab = new Map<string, OrderRow[]>()
    for (const o of (ordersRaw ?? [])) {
      if (!o.tab_id) continue
      if (!ordersByTab.has(o.tab_id)) ordersByTab.set(o.tab_id, [])
      ordersByTab.get(o.tab_id)!.push(o as OrderRow)
    }

    const tabByLabel = new Map<string, TabRow>()
    for (const t of (tabsRaw ?? [])) tabByLabel.set(t.label, t as TabRow)

    const vms: TableVM[] = (tablesRaw ?? []).map(t => {
      const tab      = tabByLabel.get(String(t.number)) ?? null
      const orders   = tab ? (ordersByTab.get(tab.id) ?? []) : []
      const tabTotal = orders.reduce((s, o) => s + o.total_amount, 0)

      let tableStatus: TableStatus = 'free'
      if (tab) {
        if (tab.billing_requested_at) {
          tableStatus = 'account'
        } else if (orders.length === 0) {
          tableStatus = 'waiting'
        } else {
          const activeOrders = orders.filter(o => o.status !== 'paid')
          if (activeOrders.length === 0) {
            tableStatus = 'waiting'  // all paid but not closed yet (edge case)
          } else if (activeOrders.every(o => o.status === 'ready')) {
            const lastOrderTime = Math.max(...activeOrders.map(o => new Date(o.created_at).getTime()))
            const attendedTime  = tab.last_attended_at ? new Date(tab.last_attended_at).getTime() : 0
            tableStatus = attendedTime >= lastOrderTime ? 'served' : 'ready'
          } else {
            tableStatus = 'active'
          }
        }
      }

      const openerName     = tab ? (nameMap.get(tab.opened_by) ?? '') : ''
      const openerInitials = openerName ? initials(openerName) : ''
      return { ...t, tableStatus, tab, tabTotal, orderCount: orders.length, openerName, openerInitials }
    })

    setTables(vms)
    setShapes((shapesRaw ?? []) as ShapeRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const ch = supabase.channel('floor-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables'       }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tabs'         }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders'       }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'floor_shapes' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  // ── SVG helpers ────────────────────────────────────────────────────────────

  function toSvg(e: React.MouseEvent) {
    const svg = svgRef.current!
    const pt  = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    return pt.matrixTransform(svg.getScreenCTM()!.inverse())
  }

  // ── Drag & resize ──────────────────────────────────────────────────────────

  function onTableMouseDown(e: React.MouseEvent, t: TableVM) {
    if (!editMode) return
    e.stopPropagation()
    const { x, y } = toSvg(e)
    drag.current = { kind: 'table', id: t.id, startX: x, startY: y, origX: t.pos_x, origY: t.pos_y, moved: false }
  }

  function onShapeMouseDown(e: React.MouseEvent, s: ShapeRow) {
    if (!editMode) return
    e.stopPropagation()
    const { x, y } = toSvg(e)
    drag.current = { kind: 'shape', id: s.id, startX: x, startY: y, origX: s.pos_x, origY: s.pos_y, moved: false }
  }

  function onResizeHandleMouseDown(e: React.MouseEvent, s: ShapeRow, handle: string) {
    e.stopPropagation()
    const { x, y } = toSvg(e)
    drag.current = {
      kind: 'shape-resize', id: s.id,
      startX: x, startY: y,
      origX: s.pos_x, origY: s.pos_y, origW: s.width, origH: s.height,
      handle, moved: false,
    }
  }

  function onSvgMouseMove(e: React.MouseEvent) {
    const d = drag.current
    if (!d) return
    const { x, y } = toSvg(e)
    const dx = x - d.startX
    const dy = y - d.startY

    const threshold = d.kind === 'shape-resize' ? 1 : 6
    if (!d.moved && Math.hypot(dx, dy) < threshold) return
    d.moved = true

    if (d.kind === 'table') {
      setTables(prev => prev.map(t =>
        t.id === d.id ? { ...t, pos_x: Math.max(0, d.origX + dx), pos_y: Math.max(0, d.origY + dy) } : t
      ))
    } else if (d.kind === 'shape') {
      setShapes(prev => prev.map(s =>
        s.id === d.id ? { ...s, pos_x: Math.max(0, d.origX + dx), pos_y: Math.max(0, d.origY + dy) } : s
      ))
    } else if (d.kind === 'shape-resize') {
      const patch = applyResize(d.handle!, d.origX!, d.origY!, d.origW!, d.origH!, dx, dy)
      setShapes(prev => prev.map(s => s.id === d.id ? { ...s, ...patch } : s))
    }
  }

  async function onSvgMouseUp() {
    const d = drag.current
    drag.current = null
    if (!d) return

    const supabase = createClient()

    if (d.kind === 'table') {
      if (d.moved) {
        const t = tables.find(x => x.id === d.id)
        if (t) await supabase.from('tables').update({ pos_x: t.pos_x, pos_y: t.pos_y }).eq('id', d.id)
      } else {
        setSelShape(null)
        setSelTable(prev => prev === d.id ? null : d.id)
      }
    } else if (d.kind === 'shape') {
      if (d.moved) {
        const s = shapes.find(x => x.id === d.id)
        if (s) await supabase.from('floor_shapes').update({ pos_x: s.pos_x, pos_y: s.pos_y }).eq('id', d.id)
      } else {
        setSelTable(null)
        const s = shapes.find(x => x.id === d.id)
        if (s) setShapeLabelDraft(s.label)
        setSelShape(prev => prev === d.id ? null : d.id)
      }
    } else if (d.kind === 'shape-resize') {
      if (d.moved) {
        const s = shapes.find(x => x.id === d.id)
        if (s) await supabase.from('floor_shapes')
          .update({ pos_x: s.pos_x, pos_y: s.pos_y, width: s.width, height: s.height })
          .eq('id', d.id)
      }
      // Keep shape selected after resize
    }
  }

  function onTableClick(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (editMode) return
    setSelShape(null)
    setSelTable(prev => prev === id ? null : id)
  }

  // ── Tables CRUD ────────────────────────────────────────────────────────────

  async function handleAddTable() {
    setAdding(true)
    const supabase = createClient()
    const maxNum = tables.reduce((m, t) => Math.max(m, t.number), 0)
    const col = maxNum % 6; const row = Math.floor(maxNum / 6)
    const { error } = await supabase.from('tables').insert({
      number: maxNum + 1,
      pos_x: 60 + col * 120, pos_y: 60 + row * 110,
      branch_id: branchId,
    })
    if (error) setFlashError(error.message)
    else await load()
    setAdding(false)
  }

  async function handleDeleteTable(id: string) {
    const { error } = await createClient().from('tables').delete().eq('id', id)
    if (error) setFlashError(error.message)
    else setSelTable(null)
  }

  // ── Shapes CRUD ────────────────────────────────────────────────────────────

  async function handleAddShape() {
    setAddingShape(true)
    const { error } = await createClient().from('floor_shapes').insert({
      label: 'Área', pos_x: 100, pos_y: 100, width: 180, height: 110, fill: '#f0e8d8', branch_id: branchId,
    })
    if (error) setFlashError(error.message)
    else await load()     // explicit reload — don't rely only on realtime
    setAddingShape(false)
  }

  async function handleDeleteShape(id: string) {
    const { error } = await createClient().from('floor_shapes').delete().eq('id', id)
    if (error) setFlashError(error.message)
    else setSelShape(null)
  }

  async function handleUpdateShape(id: string, patch: Partial<ShapeRow>) {
    setShapes(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
    await createClient().from('floor_shapes').update(patch).eq('id', id)
  }

  // ── Tab actions ────────────────────────────────────────────────────────────

  async function handleOpenTab(tableNumber: number): Promise<string | null> {
    setOpeningTab(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setOpeningTab(false); return null }
    const { data, error } = await supabase
      .from('tabs')
      .insert({ label: String(tableNumber), opened_by: user.id, type: 'table', branch_id: branchId })
      .select('id').single()
    setOpeningTab(false)
    if (error) { setFlashError(error.message); return null }
    await load()
    return data?.id ?? null
  }

  async function handleRequestBilling(tabId: string) {
    setRequesting(true)
    const { error } = await createClient()
      .from('tabs')
      .update({ billing_requested_at: new Date().toISOString() })
      .eq('id', tabId)
    if (error) setFlashError(error.message)
    else await load()
    setRequesting(false)
  }

  async function handleAttend(tabId: string) {
    setAttending(true)
    const { error } = await createClient()
      .from('tabs')
      .update({ last_attended_at: new Date().toISOString() })
      .eq('id', tabId)
    if (error) setFlashError(error.message)
    else await load()
    setAttending(false)
  }

  // Step 1: fetch orders with items and show TicketPreview
  async function handleCobrar(tableId: string) {
    const table = tables.find(t => t.id === tableId)
    if (!table?.tab) return
    setCobrando(true)
    const { data } = await createClient()
      .from('orders')
      .select('*, items:order_items(*, product:products(*))')
      .eq('tab_id', table.tab.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
    const orders = (data ?? []) as Order[]
    const unpaid  = orders.filter(o => o.status !== 'paid')
    const total   = unpaid.reduce((s, o) => s + o.total_amount, 0)
    const tab: Tab = { ...table.tab, closed_at: table.tab.closed_at ?? null }
    setTicketData({ tab, orders, total })
    setCobrando(false)
  }

  // Step 2: called by TicketPreview onConfirm
  async function handleCobrarConfirm() {
    if (!ticketData) return
    setCobrando(true)
    try {
      const supabase = createClient()
      const tabId = ticketData.tab.id
      await supabase.from('orders')
        .update({ status: 'paid' })
        .eq('tab_id', tabId)
        .in('status', ['pending', 'preparing', 'ready'])
      await supabase.from('tabs')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', tabId)
      setTicketData(null)
      setSelTable(null)
      await load()
    } catch (err) {
      setFlashError(String(err))
    } finally {
      setCobrando(false)
    }
  }

  async function handlePendingPayment(tableId: string) {
    const table = tables.find(t => t.id === tableId)
    if (!table?.tab) return
    setPendingPayment(true)
    try {
      const supabase = createClient()
      const tabId = table.tab.id
      await supabase.from('orders')
        .update({ status: 'paid', payment_source: 'pendiente' })
        .eq('tab_id', tabId)
        .in('status', ['pending', 'preparing', 'ready'])
      await supabase.from('tabs')
        .update({ status: 'closed', closed_at: new Date().toISOString(), pending_payment: true })
        .eq('id', tabId)
      setSelTable(null)
      await load()
    } catch (err) {
      setFlashError(String(err))
    } finally {
      setPendingPayment(false)
    }
  }

  // Fetch orders for print-only preview (no charge)
  async function handlePrintTicket(tableId: string) {
    const table = tables.find(t => t.id === tableId)
    if (!table?.tab) return
    setPrinting(true)
    const { data } = await createClient()
      .from('orders')
      .select('*, items:order_items(*, product:products(*))')
      .eq('tab_id', table.tab.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
    const orders = (data ?? []) as Order[]
    const total  = orders
      .filter(o => o.status !== 'paid')
      .reduce((s, o) => s + o.total_amount, 0)
    const tab: Tab = { ...table.tab, closed_at: table.tab.closed_at ?? null }
    setPrintData({ tab, orders, total })
    setPrinting(false)
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const selTableVM  = tables.find(t => t.id === selTable)
  const selShapeObj = shapes.find(s => s.id === selShape)
  const showPanel   = !!(selTableVM || (selShapeObj && editMode))

  // Resize handle positions relative to shape top-left
  function shapeHandles(s: ShapeRow) {
    const { width: w, height: h } = s
    return [
      { key: 'nw', cx: 0,     cy: 0     }, { key: 'n', cx: w/2,  cy: 0     },
      { key: 'ne', cx: w,     cy: 0     }, { key: 'e', cx: w,    cy: h/2   },
      { key: 'se', cx: w,     cy: h     }, { key: 's', cx: w/2,  cy: h     },
      { key: 'sw', cx: 0,     cy: h     }, { key: 'w', cx: 0,    cy: h/2   },
    ]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">

      {/* ── Canvas ── */}
      <div className="flex-1 min-w-0">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {canManage && (
            <button
              onClick={() => { setEditMode(m => !m); setSelShape(null); setSelTable(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                editMode ? 'bg-blue-600 text-white border-blue-600' : 'border-stone-300 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {editMode
                ? <><Check className="w-3.5 h-3.5" /> {tr.floor.exitEdit}</>
                : <><Pencil className="w-3.5 h-3.5" /> {tr.floor.editPlan}</>}
            </button>
          )}
          {editMode && (
            <>
              <button onClick={handleAddTable} disabled={adding}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors">
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {tr.floor.table}
              </button>
              <button onClick={handleAddShape} disabled={addingShape}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-600 hover:bg-stone-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors">
                {addingShape ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                {tr.floor.area}
              </button>
            </>
          )}
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            {(Object.entries(STYLE) as [TableStatus, typeof STYLE[TableStatus]][])
              .filter(([k]) => k !== 'free')
              .map(([k, v]) => (
                <span key={k} className="flex items-center gap-1 text-xs text-stone-500">
                  <span className="inline-block w-3 h-3 rounded border" style={{ background: v.fill, borderColor: v.stroke }} />
                  {tr.floor.status[k]}
                </span>
              ))}
          </div>
        </div>

        {/* SVG canvas */}
        <div className={`border rounded-xl overflow-hidden bg-[#f5ede0] transition-all ${
          editMode ? 'border-2 border-blue-400' : 'border-stone-200'
        }`}>
          {tables.length === 0 && shapes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-stone-400">
              <p className="text-sm">{tr.floor.noTables}</p>
              {canManage && <p className="text-xs mt-1">{tr.floor.noTablesHint}</p>}
            </div>
          ) : (
            <svg
              ref={svgRef}
              viewBox="0 0 1200 700"
              className="w-full h-auto select-none"
              style={{ maxHeight: 'calc(100vh - 220px)', cursor: drag.current ? 'grabbing' : 'default' }}
              onMouseMove={onSvgMouseMove}
              onMouseUp={onSvgMouseUp}
              onMouseLeave={onSvgMouseUp}
              onClick={() => { setSelTable(null); setSelShape(null) }}
            >
              {/* ── Decorative shapes (behind tables) ── */}
              {shapes.map(s => {
                const isSel = selShape === s.id
                return (
                  <g
                    key={s.id}
                    transform={`translate(${s.pos_x},${s.pos_y})`}
                    style={{ cursor: editMode ? 'grab' : 'default' }}
                    onMouseDown={e => onShapeMouseDown(e, s)}
                    onClick={e => e.stopPropagation()}
                  >
                    <rect
                      width={s.width} height={s.height} rx={10} ry={10}
                      fill={s.fill}
                      stroke={isSel ? '#2563eb' : '#b8a090'}
                      strokeWidth={isSel ? 2.5 : 1.5}
                      strokeDasharray={editMode ? '7 3' : undefined}
                    />
                    {s.label && (
                      <text
                        x={s.width / 2} y={s.height / 2}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={14} fill="#7a5c3a" opacity={0.65} fontWeight="600"
                      >
                        {s.label}
                      </text>
                    )}
                    {/* Resize handles — only when selected in edit mode */}
                    {editMode && isSel && shapeHandles(s).map(h => (
                      <circle
                        key={h.key}
                        cx={h.cx} cy={h.cy} r={6}
                        fill="white" stroke="#2563eb" strokeWidth={1.5}
                        style={{ cursor: HANDLE_CURSOR[h.key] }}
                        onMouseDown={e => onResizeHandleMouseDown(e, s, h.key)}
                        onClick={e => e.stopPropagation()}
                      />
                    ))}
                  </g>
                )
              })}

              {/* ── Tables ── */}
              {tables.map(t => {
                const s    = STYLE[t.tableStatus]
                const isSel = selTable === t.id
                return (
                  <g
                    key={t.id}
                    transform={`translate(${t.pos_x},${t.pos_y})`}
                    style={{ cursor: editMode ? 'grab' : 'pointer' }}
                    onMouseDown={e => onTableMouseDown(e, t)}
                    onClick={e => onTableClick(e, t.id)}
                  >
                    <rect x={2} y={3} width={TW} height={TH} rx={TR} ry={TR} fill="rgba(0,0,0,0.10)" />
                    <rect
                      width={TW} height={TH} rx={TR} ry={TR}
                      fill={s.fill} stroke={isSel ? '#2563eb' : s.stroke}
                      strokeWidth={isSel ? 3 : 1.5}
                    />
                    {/* Number */}
                    <text x={TW/2 - (t.openerInitials ? 8 : 0)} y={TH/2 - 8}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={26} fontWeight="700" fill={s.text}>
                      {t.number}
                    </text>
                    {/* Status */}
                    <text x={TW/2} y={TH/2 + 12}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={10} fill={s.text} opacity={0.85}>
                      {tr.floor.status[t.tableStatus]}
                    </text>
                    {/* Footer: time + total */}
                    {t.tab && (
                      <>
                        <text x={10} y={TH - 8} fontSize={8} fill={s.text} opacity={0.75}>
                          {elapsed(t.tab.opened_at)}
                        </text>
                        {t.tabTotal > 0 && (
                          <text x={TW - 10} y={TH - 8} textAnchor="end" fontSize={8} fill={s.text} opacity={0.75}>
                            ${t.tabTotal.toFixed(0)}
                          </text>
                        )}
                      </>
                    )}
                    {/* Opener initials badge */}
                    {t.openerInitials && (
                      <>
                        <circle cx={TW - 14} cy={14} r={13} fill={s.badgeBg} opacity={0.9} />
                        <text x={TW - 14} y={14} textAnchor="middle" dominantBaseline="middle"
                          fontSize={9} fontWeight="700" fill="#fff">
                          {t.openerInitials}
                        </text>
                      </>
                    )}
                  </g>
                )
              })}
            </svg>
          )}
        </div>

        {editMode && (
          <p className="mt-2 text-xs text-blue-500 text-center">{tr.floor.editHint}</p>
        )}
      </div>

      {/* ── Detail panel ── */}
      {showPanel && (
        <div className="w-full lg:w-72 shrink-0 bg-white border border-stone-200 rounded-xl p-4 flex flex-col gap-3">

          {/* Table panel */}
          {selTableVM && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-stone-800">{tr.pos.tableN(selTableVM.number)}</h3>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STYLE[selTableVM.tableStatus].badge}`}>
                    {tr.floor.status[selTableVM.tableStatus]}
                  </span>
                </div>
                <button onClick={() => setSelTable(null)} className="p-1 rounded-lg hover:bg-stone-100 text-stone-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selTableVM.tab && (
                <div className="flex items-center justify-between text-xs text-stone-500 bg-stone-50 rounded-lg px-3 py-2">
                  <span className="font-medium truncate">{selTableVM.openerName}</span>
                  <span className="shrink-0 ml-2 tabular-nums">{elapsed(selTableVM.tab.opened_at)}</span>
                </div>
              )}

              {selTableVM.tab ? (
                <>
                  <div className="space-y-0.5">
                    <p className="text-xs text-stone-400">{tr.floor.accumulatedTotal}</p>
                    <p className="text-3xl font-bold text-stone-800">${selTableVM.tabTotal.toFixed(2)}</p>
                    <p className="text-xs text-stone-500">{tr.floor.orderCount(selTableVM.orderCount)}</p>
                  </div>

                  {(selTableVM.tableStatus === 'ready' || selTableVM.tableStatus === 'served') && (
                    <button
                      onClick={() => handleAttend(selTableVM.tab!.id)}
                      disabled={attending}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-60 ${
                        selTableVM.tableStatus === 'ready'
                          ? 'bg-yellow-500 hover:bg-yellow-400 text-white'
                          : 'bg-green-700 hover:bg-green-600 text-white'
                      }`}
                    >
                      {attending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                      {tr.floor.attended}
                    </button>
                  )}

                  {/* Pide cuenta — visible for any occupied table not already in account state */}
                  {selTableVM.tableStatus !== 'account' && selTableVM.tableStatus !== 'waiting' && (
                    <button
                      onClick={() => handleRequestBilling(selTableVM.tab!.id)}
                      disabled={requesting}
                      className="w-full flex items-center justify-center gap-2 py-2 text-yellow-800 hover:bg-yellow-50 rounded-lg text-sm font-semibold border border-yellow-300 bg-yellow-50 transition-colors disabled:opacity-60"
                    >
                      {requesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                      {tr.floor.requestBill}
                    </button>
                  )}

                  {canManage && (
                    <button
                      onClick={() => router.push(`/pos?tabId=${selTableVM.tab!.id}`)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-700 hover:bg-brand-600 text-white rounded-lg font-semibold transition-colors"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      {tr.floor.takeOrder}
                    </button>
                  )}

                  {/* Print ticket — available any time the table has orders */}
                  {selTableVM.orderCount > 0 && (
                    <button
                      onClick={() => handlePrintTicket(selTableVM.id)}
                      disabled={printing}
                      className="w-full flex items-center justify-center gap-2 py-2 text-stone-600 hover:bg-stone-50 rounded-lg text-sm border border-stone-200 transition-colors disabled:opacity-60"
                    >
                      {printing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                      {tr.pos.printTicket}
                    </button>
                  )}

                  <button
                    onClick={() => handlePendingPayment(selTableVM.id)}
                    disabled={pendingPayment || cobrando}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-semibold transition-colors border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800 disabled:opacity-50"
                  >
                    {pendingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hourglass className="w-4 h-4" />}
                    {tr.pos.pendingPayment}
                  </button>

                  <button
                    onClick={() => handleCobrar(selTableVM.id)}
                    disabled={cobrando || pendingPayment}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
                  >
                    {cobrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                    {selTableVM.tableStatus === 'account' ? tr.floor.closeAccount : tr.pos.charge}
                  </button>
                </>
              ) : canManage ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-stone-400 text-center py-2">{tr.floor.freeTable}</p>
                  <button
                    onClick={async () => {
                      const tabId = await handleOpenTab(selTableVM.number)
                      if (tabId) router.push(`/pos?tabId=${tabId}`)
                    }}
                    disabled={openingTab}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-700 hover:bg-brand-600 disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
                  >
                    {openingTab ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                    {tr.floor.openAndTake}
                  </button>
                  <button
                    onClick={() => handleOpenTab(selTableVM.number)}
                    disabled={openingTab}
                    className="w-full flex items-center justify-center gap-2 py-2 text-stone-600 hover:bg-stone-50 rounded-lg text-sm border border-stone-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> {tr.floor.justOpen}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-stone-400 text-center py-6">{tr.floor.freeTable}</p>
              )}

              {editMode && (
                <button
                  onClick={() => handleDeleteTable(selTableVM.id)}
                  className="mt-auto w-full flex items-center justify-center gap-2 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium border border-red-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> {tr.floor.deleteTable}
                </button>
              )}
            </>
          )}

          {/* Shape panel (edit mode) */}
          {selShapeObj && editMode && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-stone-800">{tr.floor.areaElement}</h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {Math.round(selShapeObj.width)} × {Math.round(selShapeObj.height)} px
                  </p>
                </div>
                <button onClick={() => setSelShape(null)} className="p-1 rounded-lg hover:bg-stone-100 text-stone-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">{tr.floor.label}</label>
                <input
                  value={shapeLabelDraft}
                  onChange={e => setShapeLabelDraft(e.target.value)}
                  onBlur={() => handleUpdateShape(selShapeObj.id, { label: shapeLabelDraft })}
                  onKeyDown={e => e.key === 'Enter' && handleUpdateShape(selShapeObj.id, { label: shapeLabelDraft })}
                  placeholder={tr.floor.labelPlaceholder}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">{tr.floor.color}</label>
                <div className="flex gap-2 flex-wrap">
                  {SHAPE_COLORS.map(c => (
                    <button key={c} onClick={() => handleUpdateShape(selShapeObj.id, { fill: c })}
                      className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                        selShapeObj.fill === c ? 'border-blue-500 scale-110' : 'border-stone-300'
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <p className="text-xs text-stone-400">{tr.floor.resizeHint}</p>

              <button
                onClick={() => handleDeleteShape(selShapeObj.id)}
                className="mt-auto w-full flex items-center justify-center gap-2 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium border border-red-200 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> {tr.floor.deleteArea}
              </button>
            </>
          )}
        </div>
      )}

      {flashError && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {flashError}
          <button onClick={() => setFlashError(null)} className="underline ml-1">{tr.common.close}</button>
        </div>
      )}

      {ticketData && (
        <TicketPreview
          tab={ticketData.tab}
          orders={ticketData.orders}
          cobrarTotal={ticketData.total}
          onConfirm={handleCobrarConfirm}
          onCancel={() => setTicketData(null)}
          loading={cobrando}
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
