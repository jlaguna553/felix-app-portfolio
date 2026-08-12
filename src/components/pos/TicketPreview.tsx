'use client'

import { useState, useEffect } from 'react'
import { Order, Tab } from '@/lib/types'
import { X, Printer, Loader2, Check, AlertTriangle, FileText, BluetoothSearching } from 'lucide-react'
import { buildReceiptBytes } from '@/lib/utils/escpos'
import {
  printViaBluetooth,
  printViaPickedDevice,
  getPairedPrinterName,
  getLastBTError,
  pairPrinter,
} from '@/lib/utils/bluetooth-printer'
import { printViaPopup } from '@/lib/utils/print-ticket'
import { getTicketSettings, DEFAULT_TICKET_SETTINGS, type TicketSettings } from '@/lib/utils/ticket-settings'
import { warmDeviceCache } from '@/lib/utils/bluetooth-printer'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface Props {
  tab: Tab
  orders: Order[]
  cobrarTotal: number
  /** Omit to show a print-only modal (no "Cobrar" button). */
  onConfirm?: () => void
  onCancel: () => void
  loading?: boolean
}

type BtStatus = 'idle' | 'printing' | 'ok' | 'error' | 'picking'

const BT_NO_GETDEVICES = 'getDevices_unsupported'
const BT_NO_DEVICE     = 'getDevices_empty'

export function TicketPreview({ tab, orders, cobrarTotal, onConfirm, onCancel, loading }: Props) {
  const { t, intl } = useI18n()
  const unpaid = orders.filter(o => o.status !== 'cancelled' && o.status !== 'paid')
  const now = new Date().toLocaleString(intl, { dateStyle: 'short', timeStyle: 'short' })
  const [btStatus, setBtStatus] = useState<BtStatus>('idle')
  const [btError,  setBtError]  = useState('')
  const [tSettings, setTSettings] = useState<TicketSettings>(DEFAULT_TICKET_SETTINGS)

  useEffect(() => {
    getTicketSettings().then(setTSettings)
    warmDeviceCache()  // pre-warm BT so first print doesn't need picker
  }, [])

  const hasBT = !!getPairedPrinterName()

  // ── Bluetooth print ─────────────────────────────────────────────────────────
  async function handleBTPrint() {
    if (btStatus === 'printing' || btStatus === 'picking') return
    setBtStatus('printing')
    setBtError('')

    const ts   = await getTicketSettings()
    const data = await buildReceiptBytes(tab.label, unpaid, cobrarTotal, ts)
    const ok   = await printViaBluetooth(data)
    if (ok) {
      setBtStatus('ok')
      setTimeout(() => setBtStatus('idle'), 3000)
      return
    }

    const err = getLastBTError()
    // getDevices() unavailable or no cached device → show picker once
    if (err === BT_NO_GETDEVICES || err === BT_NO_DEVICE) {
      setBtStatus('picking')
      const result = await pairPrinter()
      if (result) {
        const ok2 = await printViaPickedDevice(result.device, data)
        if (ok2) {
          setBtStatus('ok')
          setTimeout(() => setBtStatus('idle'), 3000)
          return
        }
        setBtError(getLastBTError())
      }
    } else {
      setBtError(err)
    }
    setBtStatus('error')
  }

  // ── PDF print ───────────────────────────────────────────────────────────────
  function handlePDFPrint() {
    // Open window synchronously (user gesture) to avoid popup blocker
    const win = window.open('', '_blank', 'width=380,height=600,top=60,left=60')
    printViaPopup(tab.label, unpaid, cobrarTotal, win)
  }

  // ── Button state helpers ────────────────────────────────────────────────────
  const btBusy = btStatus === 'printing' || btStatus === 'picking'

  const btLabel =
    btStatus === 'printing' ? t.ticket.printing   :
    btStatus === 'picking'  ? t.ticket.selecting  :
    btStatus === 'ok'       ? t.ticket.sentOk     :
    btStatus === 'error'    ? t.ticket.errorRetry :
                              t.cart.print

  const btIcon =
    btBusy                  ? <Loader2  className="w-4 h-4 animate-spin" /> :
    btStatus === 'ok'       ? <Check    className="w-4 h-4" />              :
    btStatus === 'error'    ? <AlertTriangle className="w-4 h-4" />         :
                              <Printer  className="w-4 h-4" />

  const btClass =
    btStatus === 'ok'    ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' :
    btStatus === 'error' ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-300'     :
                           'bg-brand-700 hover:bg-brand-600 text-white border-brand-700'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
          <p className="font-bold text-stone-800">{t.ticket.previewTitle}</p>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ticket body */}
        <div className="p-4 bg-stone-50 overflow-y-auto max-h-[55vh]">
          <div className="font-mono text-[11px] leading-[1.45] mx-auto text-center" style={{ maxWidth: '220px' }}>

            {/* Logo */}
            {tSettings.showLogo && tSettings.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tSettings.logoUrl}
                alt="Logo"
                className="h-10 object-contain mx-auto mb-1"
                onError={e => (e.currentTarget.style.display = 'none')}
              />
            )}

            {/* Header */}
            <p className="font-bold text-[13px] leading-tight">{tSettings.restaurantName}</p>
            {tSettings.address && <p className="text-stone-500 text-[9px]">{tSettings.address}</p>}
            {tSettings.phone   && <p className="text-stone-500 text-[9px]">{tSettings.phone}</p>}
            <p className="text-stone-600 mt-0.5">{tab.label}</p>
            <p className="text-stone-400 text-[9px]">{now}</p>

            <div className="border-t border-dashed border-stone-300 my-1.5" />

            {/* Orders */}
            <div className="text-left">
              {unpaid.map(order => (
                <div key={order.id} className="mb-2">
                  <p className="font-semibold text-stone-600 text-[10px]">
                    {order.order_number === 0 ? t.ticket.orderInProgress : t.ticket.orderN(order.order_number)}
                  </p>
                  {order.items?.map(item => (
                    <div key={item.id} className="flex justify-between gap-1">
                      <span className="flex-1 truncate">{item.quantity}× {item.product?.name}</span>
                      <span className="shrink-0 text-stone-500">${item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                  {order.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>{t.common.discount}</span>
                      <span>-${order.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-stone-300 my-1.5" />

            {/* Total */}
            <div className="flex justify-between font-bold text-[14px] text-stone-800">
              <span>{t.ticket.totalCaps}</span>
              <span>${cobrarTotal.toFixed(2)}</span>
            </div>

            {/* Socials */}
            {(tSettings.instagram || tSettings.facebook || tSettings.tiktok || tSettings.whatsapp) && (
              <div className="mt-2 text-[8px] text-stone-500 space-y-0.5">
                {tSettings.instagram && <p>📷 @{tSettings.instagram}</p>}
                {tSettings.facebook  && <p>📘 {tSettings.facebook}</p>}
                {tSettings.tiktok    && <p>🎵 @{tSettings.tiktok}</p>}
                {tSettings.whatsapp  && <p>💬 {tSettings.whatsapp}</p>}
              </div>
            )}

            {/* QR */}
            {tSettings.qrUrl && (
              <div className="mt-1.5">
                {tSettings.qrLabel && <p className="text-[8px] text-stone-500 mb-0.5">{tSettings.qrLabel}</p>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(tSettings.qrUrl)}&color=000000&bgcolor=FFFFFF`}
                  alt="QR"
                  className="w-14 h-14 mx-auto"
                />
              </div>
            )}

            {/* Footer */}
            <p className="mt-1.5 text-[8px] text-stone-500">{tSettings.footer}</p>
          </div>
        </div>

        {/* Error detail */}
        {btStatus === 'error' && btError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-100 space-y-1">
            <p className="text-xs text-red-600 leading-snug">{btError}</p>
            {/android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') &&
             /connection/i.test(btError) && (
              <p className="text-xs text-red-500 leading-snug">{t.ticket.androidHint}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="p-4 space-y-2 border-t border-stone-100">

          {/* Print row */}
          <div className={`flex gap-2 ${!hasBT ? 'hidden' : ''}`}>
            {/* BT print — primary */}
            <button
              onClick={handleBTPrint}
              disabled={btBusy}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border font-semibold text-sm transition-colors disabled:opacity-60 ${btClass}`}
            >
              {btIcon} {btLabel}
            </button>

            {/* PDF — secondary, always available */}
            <button
              onClick={handlePDFPrint}
              title={t.ticket.savePdfTitle}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-50 text-sm font-medium transition-colors"
            >
              <FileText className="w-4 h-4" /> {t.cart.pdf}
            </button>
          </div>

          {/* No BT configured — show PDF as primary */}
          {!hasBT && (
            <button
              onClick={handlePDFPrint}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-50 text-sm font-medium transition-colors"
            >
              <FileText className="w-4 h-4" /> {t.cart.printSavePdf}
            </button>
          )}

          {/* Picking helper text */}
          {btStatus === 'picking' && (
            <p className="text-xs text-stone-400 text-center flex items-center justify-center gap-1">
              <BluetoothSearching className="w-3.5 h-3.5" />
              {t.ticket.pickerHint}
            </p>
          )}

          {/* Cobrar / Cerrar row */}
          <div className="flex gap-2">
            {onConfirm ? (
              <>
                <button
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold text-sm flex items-center justify-center"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.pos.charge}
                </button>
              </>
            ) : (
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50"
              >
                {t.common.close}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
