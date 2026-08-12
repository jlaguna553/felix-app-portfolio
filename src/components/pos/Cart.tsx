'use client'

import { useState, useEffect } from 'react'
import { CartItem, Order, Tab, Promotion, AppliedPromotion } from '@/lib/types'
import {
  Minus, Plus, Trash2, ShoppingBag, Loader2, X, Send, ChefHat,
  DollarSign, AlertTriangle, Percent, CreditCard, Printer, FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TicketPreview } from './TicketPreview'
import { buildReceiptBytes } from '@/lib/utils/escpos'
import { printViaBluetooth, printViaPickedDevice, getPairedPrinterName, pairPrinter, getLastBTError } from '@/lib/utils/bluetooth-printer'
import { printViaPopup } from '@/lib/utils/print-ticket'
import { getTicketSettings } from '@/lib/utils/ticket-settings'
import { matchPromotions } from '@/lib/utils/promotions'
import { useI18n } from '@/lib/i18n/I18nProvider'

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready:     'bg-green-100 text-green-700',
  paid:      'bg-stone-100 text-stone-500',
  cancelled: 'bg-red-100 text-red-600',
}

interface Props {
  items: CartItem[]
  onRemove: (id: string, notes?: string) => void
  onUpdate: (id: string, qty: number, notes?: string) => void
  onClear: () => void
  onClose?: () => void
  tab: Tab
  tabOrders: Order[]
  onOrderSent: (order: Order) => void
  onCloseTab: () => void
  promotions: Promotion[]
  shiftOpen?: boolean | null
}

type ConfirmMode = null | 'send' | 'cobrar' | 'cobrar_enviar' | 'descartar'

export function Cart({
  items, onRemove, onUpdate, onClear, onClose,
  tab, tabOrders, onOrderSent, onCloseTab, promotions, shiftOpen,
}: Props) {
  const { t } = useI18n()
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null)
  const [loading, setLoading] = useState(false)
  const [sentToast, setSentToast] = useState<number | null>(null)
  const [appliedPromos, setAppliedPromos] = useState<AppliedPromotion[]>([])
  const [printingCart, setPrintingCart] = useState(false)

  const roundTotal  = items.reduce((s, i) => s + i.product.sale_price * i.quantity, 0)
  const tabTotal    = tabOrders.reduce((s, o) => s + o.total_amount, 0)
  const cobrarTotal = tabOrders.filter(o => o.status !== 'paid').reduce((s, o) => s + o.total_amount, 0)
  const hasPendingOrders = tabOrders.some(o => ['pending', 'preparing'].includes(o.status))

  const totalDiscount = appliedPromos.filter(ap => ap.enabled).reduce((s, ap) => s + ap.discountAmount, 0)
  const roundTotalAfterDiscount = Math.max(0, roundTotal - totalDiscount)
  const grandTotal  = tabTotal + roundTotalAfterDiscount

  // Recompute applicable promotions whenever cart items change
  useEffect(() => {
    const matched = matchPromotions(items, promotions, roundTotal)
    setAppliedPromos(prev =>
      matched.map(ap => {
        const existing = prev.find(p => p.promotion.id === ap.promotion.id)
        return existing ? { ...ap, enabled: existing.enabled } : ap
      })
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, promotions])

  function togglePromo(id: string) {
    setAppliedPromos(prev =>
      prev.map(ap => ap.promotion.id === id ? { ...ap, enabled: !ap.enabled } : ap)
    )
  }

  async function handleSend() {
    if (items.length === 0) return
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        created_by:    user.id,
        total_amount:  roundTotalAfterDiscount,
        discount_amount: totalDiscount,
        status:        'pending',
        table_number:  tab.label,
        tab_id:        tab.id,
      })
      .select()
      .single()

    if (error || !order) { setLoading(false); return }

    await supabase.from('order_items').insert(
      items.map(i => ({
        order_id:   order.id,
        product_id: i.product.id,
        quantity:   i.quantity,
        unit_price: i.product.sale_price,
        subtotal:   i.product.sale_price * i.quantity,
        notes:      i.notes ?? null,
      }))
    )

    // Broadcast AFTER items are inserted so kitchen fetches a complete order
    const bc = supabase.channel('kitchen-updates')
    bc.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        bc.send({ type: 'broadcast', event: 'new_order', payload: { order_id: order.id } })
          .finally(() => setTimeout(() => supabase.removeChannel(bc), 1000))
      }
    })

    setLoading(false)
    setConfirmMode(null)
    onOrderSent({ ...order, items: items.map(i => ({
      id: '', order_id: order.id, product_id: i.product.id,
      product: i.product, quantity: i.quantity,
      unit_price: i.product.sale_price, subtotal: i.product.sale_price * i.quantity,
      notes: i.notes ?? null,
    })) })
    onClear()
    setSentToast(order.order_number)
    setTimeout(() => setSentToast(null), 4000)
  }

  async function handleCobrar() {
    setLoading(true)
    const supabase = createClient()
    const now = new Date().toISOString()
    await supabase
      .from('orders')
      .update({ status: 'paid', payment_source: 'pos' })
      .eq('tab_id', tab.id)
      .neq('status', 'cancelled')
      .neq('status', 'paid')
    await supabase
      .from('tabs')
      .update({ status: 'closed', closed_at: now })
      .eq('id', tab.id)
    setLoading(false)
    setConfirmMode(null)
    onCloseTab()
  }

  async function handleDescartar() {
    setLoading(true)
    const supabase = createClient()
    await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('tab_id', tab.id)
    await supabase
      .from('tabs')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', tab.id)
    setLoading(false)
    setConfirmMode(null)
    onCloseTab()
  }

  // ── Helpers compartidos para imprimir el carrito ─────────────────────────────
  function buildCartPrintData() {
    const sentOrders = tabOrders
      .filter(o => o.status !== 'cancelled' && o.status !== 'paid')
      .map(o => ({
        order_number:    o.order_number,
        discount_amount: o.discount_amount,
        items:           o.items,
      }))
    const cartOrder = items.length > 0 ? {
      order_number:    0,
      discount_amount: totalDiscount,
      items: items.map(i => ({
        quantity: i.quantity,
        subtotal: i.product.sale_price * i.quantity,
        notes:    i.notes ?? null,
        product:  { name: i.product.name },
      })),
    } : null
    const printOrders = cartOrder ? [...sentOrders, cartOrder] : sentOrders
    const printTotal  = grandTotal > 0
      ? grandTotal
      : printOrders.reduce((s, o) => s + (o.items ?? []).reduce((ss, i) => ss + i.subtotal, 0), 0)
    return { printOrders, printTotal }
  }

  /** Imprimir vía Bluetooth (con fallback a picker si hace falta) */
  async function handlePrintCart() {
    const { printOrders, printTotal } = buildCartPrintData()
    if (printOrders.length === 0) return
    setPrintingCart(true)

    const ts   = await getTicketSettings()
    const data = await buildReceiptBytes(tab.label, printOrders, printTotal, ts)
    const ok   = await printViaBluetooth(data)
    if (ok) { setPrintingCart(false); return }

    const err = getLastBTError()
    if (err === 'getDevices_unsupported' || err === 'getDevices_empty') {
      // picker will cache the device for the rest of the session
      const result = await pairPrinter()
      if (result) await printViaPickedDevice(result.device, data)
    }
    setPrintingCart(false)
  }

  /** Imprimir vía PDF (sincrónico, siempre disponible) */
  function handlePrintCartPDF() {
    const { printOrders, printTotal } = buildCartPrintData()
    if (printOrders.length === 0) return
    printViaPopup(tab.label, printOrders, printTotal)
  }

  async function handleCobrarYEnviar() {
    if (items.length === 0) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        created_by:      user.id,
        total_amount:    roundTotalAfterDiscount,
        discount_amount: totalDiscount,
        status:          'pending',
        table_number:    tab.type === 'mostrador' ? 'Mostrador' : tab.label,
        tab_id:          tab.id,
        prepaid:         true,
        payment_source:  'pos',
      })
      .select()
      .single()

    if (error || !order) { setLoading(false); return }

    await supabase.from('order_items').insert(
      items.map(i => ({
        order_id:   order.id,
        product_id: i.product.id,
        quantity:   i.quantity,
        unit_price: i.product.sale_price,
        subtotal:   i.product.sale_price * i.quantity,
        notes:      i.notes ?? null,
      }))
    )

    // Notificar a cocina
    const bc = supabase.channel('kitchen-updates')
    bc.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        bc.send({ type: 'broadcast', event: 'new_order', payload: { order_id: order.id } })
          .finally(() => setTimeout(() => supabase.removeChannel(bc), 1000))
      }
    })

    // Cerrar la tab inmediatamente — el pago ya fue cobrado
    await supabase.from('tabs')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', tab.id)

    setLoading(false)
    setConfirmMode(null)
    onCloseTab()
  }

  return (
    <>
    <div className="w-full lg:w-80 lg:border-l lg:border-stone-200 bg-white flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2 shrink-0">
        <ChefHat className="w-4 h-4 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-800 truncate">{tab.label}</p>
          {tabOrders.length > 0 && (
            <p className="text-xs text-stone-400">
              {t.pos.rounds(tabOrders.length)} · {t.pos.accumulated(`$${tabTotal.toFixed(2)}`)}
            </p>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-stone-400 hover:text-stone-600 shrink-0">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Sent toast */}
      {sentToast !== null && (
        <div className="mx-4 mt-3 shrink-0 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-3 py-2 rounded-xl flex items-center gap-2">
          <Send className="w-4 h-4 shrink-0" />
          {t.cart.sentToast(sentToast)}
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Sent orders for this tab */}
        {tabOrders.length > 0 && (
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">{t.cart.alreadySent}</p>
            <div className="space-y-1.5">
              {tabOrders.map(o => (
                <div key={o.id} className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-600 w-8 shrink-0">#{o.order_number}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[o.status]}`}>
                    {t.orderStatus[o.status as keyof typeof t.orderStatus] ?? o.status}
                  </span>
                  <span className="flex-1 text-xs text-stone-400 truncate">
                    {t.cart.productCount(o.items?.length ?? 0)}
                  </span>
                  <span className="text-sm font-semibold text-stone-700 shrink-0">${o.total_amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-stone-100 flex justify-between text-xs text-stone-500 font-medium">
              <span>{t.cart.sentSubtotal}</span>
              <span>${tabTotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Divider */}
        {tabOrders.length > 0 && (
          <div className="mx-4 my-2 flex items-center gap-2">
            <div className="flex-1 border-t border-stone-200" />
            <span className="text-xs text-stone-400 font-medium shrink-0">{t.cart.newRound}</span>
            <div className="flex-1 border-t border-stone-200" />
          </div>
        )}

        {/* Current cart items */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-stone-400 text-sm gap-2 py-8 px-4">
            <ShoppingBag className="w-10 h-10 text-stone-200" />
            <p>{tabOrders.length > 0 ? t.cart.addForNextRound : t.cart.addForOrder}</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {items.map(item => (
              <div key={`${item.product.id}::${item.notes ?? ''}`} className="flex items-center gap-2 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{item.product.name}</p>
                  {item.notes && (
                    <p className="text-xs text-amber-600 font-medium truncate">{item.notes}</p>
                  )}
                  <p className="text-xs text-stone-400">
                    ${item.product.sale_price.toFixed(2)}
                    {item.quantity > 1 && (
                      <span className="ml-1">
                        × {item.quantity} = ${(item.product.sale_price * item.quantity).toFixed(2)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onUpdate(item.product.id, item.quantity - 1, item.notes)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 active:scale-90 transition-all"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => onUpdate(item.product.id, item.quantity + 1, item.notes)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 active:scale-90 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onRemove(item.product.id, item.notes)}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 active:scale-90 transition-all ml-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Promociones aplicadas */}
        {appliedPromos.length > 0 && (
          <div className="px-4 pt-2 pb-3">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Percent className="w-3 h-3" /> {t.cart.promotions}
            </p>
            <div className="space-y-2">
              {appliedPromos.map(ap => (
                <label
                  key={ap.promotion.id}
                  className="flex items-center gap-3 cursor-pointer select-none bg-green-50 border border-green-200 rounded-xl px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={ap.enabled}
                    onChange={() => togglePromo(ap.promotion.id)}
                    className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-brand-400 shrink-0"
                  />
                  <span className="flex-1 text-sm text-stone-800 leading-tight truncate">
                    {ap.times > 1 && (
                      <span className="text-xs font-bold text-green-700 mr-1">{ap.times}×</span>
                    )}
                    {ap.promotion.name}
                  </span>
                  <span className={`text-sm font-bold shrink-0 ${ap.enabled ? 'text-green-700' : 'text-stone-400 line-through'}`}>
                    -${ap.discountAmount.toFixed(2)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-stone-200 space-y-3 shrink-0">
        {/* Totals */}
        <div className="space-y-1">
          {items.length > 0 && (
            <div className="flex justify-between text-sm text-stone-500">
              <span>{t.cart.thisRound}</span>
              <span>${roundTotal.toFixed(2)}</span>
            </div>
          )}
          {totalDiscount > 0 && (
            <div className="flex justify-between text-sm text-green-700 font-medium">
              <span>{t.cart.promoDiscount}</span>
              <span>-${totalDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="font-semibold text-stone-700">{t.cart.totalOf(tab.label)}</span>
            <span className="text-xl font-bold text-amber-700">${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Confirm: send */}
        {confirmMode === 'send' && (
          <div className="space-y-2">
            <div className="text-sm text-center text-stone-600">
              <span>{t.cart.confirmSend} </span>
              <span className="font-semibold">${roundTotalAfterDiscount.toFixed(2)}</span>
              {totalDiscount > 0 && (
                <p className="text-xs text-green-700 mt-0.5">{t.cart.includesDiscount(`$${totalDiscount.toFixed(2)}`)}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmMode(null)}
                className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-600 text-sm font-medium hover:bg-stone-50"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleSend}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold flex items-center justify-center gap-1"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> {t.cart.send}</>}
              </button>
            </div>
          </div>
        )}

        {/* Ticket preview portal — rendered outside scroll container */}

        {/* Confirm: cobrar y enviar (mostrador) */}
        {confirmMode === 'cobrar_enviar' && (
          <div className="space-y-2">
            <div className="text-center">
              <p className="text-2xl font-black text-green-700">${roundTotalAfterDiscount.toFixed(2)}</p>
              {totalDiscount > 0 && (
                <p className="text-xs text-green-600 mt-0.5">{t.cart.includesDiscount(`$${totalDiscount.toFixed(2)}`)}</p>
              )}
              <p className="text-sm text-stone-500 mt-1">{t.cart.chargeCustomerAndSend}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmMode(null)}
                className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-600 text-sm font-medium hover:bg-stone-50"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleCobrarYEnviar}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold flex items-center justify-center gap-1"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" /> {t.cart.chargeAndSend}</>}
              </button>
            </div>
          </div>
        )}

        {/* Default actions */}
        {confirmMode === null && (
          <div className="space-y-2">
            {shiftOpen === false && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {t.cart.noShiftInline}
              </div>
            )}

            {tab.type === 'mostrador' ? (
              /* Mostrador: cobro inmediato al enviar */
              <>
                <button
                  onClick={() => setConfirmMode('cobrar_enviar')}
                  disabled={items.length === 0 || shiftOpen === false}
                  className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold text-base transition-colors active:scale-95 flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  {items.length > 0 ? t.cart.chargeAndSendAmount(`$${roundTotalAfterDiscount.toFixed(2)}`) : t.cart.chargeAndSend}
                </button>
                {(items.length > 0 || tabOrders.some(o => o.status !== 'paid' && o.status !== 'cancelled')) && (
                  getPairedPrinterName() ? (
                    /* BT configurada: dos botones en fila */
                    <div className="flex gap-2">
                      <button
                        onClick={handlePrintCart}
                        disabled={printingCart}
                        className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-50 disabled:opacity-60 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        {printingCart ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                        {t.cart.print}
                      </button>
                      <button
                        onClick={handlePrintCartPDF}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-50 text-sm font-medium transition-colors"
                      >
                        <FileText className="w-4 h-4" /> {t.cart.pdf}
                      </button>
                    </div>
                  ) : (
                    /* Sin BT: solo PDF */
                    <button
                      onClick={handlePrintCartPDF}
                      className="w-full py-2.5 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-50 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <FileText className="w-4 h-4" /> {t.cart.printSavePdf}
                    </button>
                  )
                )}
              </>
            ) : (
              /* Mesa / cliente: enviar primero, cobrar después */
              <>
                <button
                  onClick={() => setConfirmMode('send')}
                  disabled={items.length === 0 || shiftOpen === false}
                  className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold text-base transition-colors active:scale-95 flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  {t.cart.sendToKitchen}
                </button>
                {items.length > 0 ? (
                  <p className="text-xs text-center text-stone-400">{t.cart.sendBeforeCharge}</p>
                ) : (
                  <button
                    onClick={() => setConfirmMode('cobrar')}
                    disabled={tabOrders.length === 0}
                    className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    {t.pos.charge} {tabOrders.length > 0 ? `$${cobrarTotal.toFixed(2)}` : ''}
                  </button>
                )}
              </>
            )}

            {/* Descartar venta */}
            {(items.length > 0 || tabOrders.some(o => o.status !== 'paid' && o.status !== 'cancelled')) && (
              <button
                onClick={() => setConfirmMode('descartar')}
                disabled={loading}
                className="w-full py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:bg-red-50 text-sm font-medium transition-colors"
              >
                {t.cart.discardSale}
              </button>
            )}
          </div>
        )}
      </div>
    </div>

    {confirmMode === 'cobrar' && (
      <TicketPreview
        tab={tab}
        orders={tabOrders}
        cobrarTotal={cobrarTotal}
        onConfirm={handleCobrar}
        onCancel={() => setConfirmMode(null)}
        loading={loading}
      />
    )}

    {confirmMode === 'descartar' && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-stone-900">{t.cart.discardSale}</h3>
            <p className="text-sm text-stone-600">{t.cart.discardBody}</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setConfirmMode(null)}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 font-medium transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleDescartar}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t.cart.discard}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
