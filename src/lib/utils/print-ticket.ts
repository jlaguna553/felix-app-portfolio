import { buildReceiptBytes } from './escpos'
import { printViaBluetooth, getPairedPrinterName } from './bluetooth-printer'
import { getTicketSettings, type TicketSettings } from './ticket-settings'

interface PrintItem {
  quantity: number
  subtotal: number
  notes?: string | null
  product?: { name: string } | null
}

interface PrintOrder {
  order_number: number
  discount_amount: number
  items?: PrintItem[]
}

function buildHtml(label: string, orders: PrintOrder[], total: number, s: TicketSettings): string {
  const now  = new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
  const sep  = '<hr style="border:none;border-top:1px dashed #aaa;margin:6px 0">'
  const qrApiUrl = s.qrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(s.qrUrl)}&color=000000&bgcolor=FFFFFF`
    : ''

  let rows = ''
  for (const order of orders) {
    const orderLabel = order.order_number === 0 ? 'Pedido en curso' : `Pedido #${order.order_number}`
    rows += `<p class="label">${orderLabel}</p>`
    for (const item of order.items ?? []) {
      const name = (item.product?.name ?? 'Producto').slice(0, 28)
      rows += `<div class="row"><span>${item.quantity}× ${name}</span><span>$${item.subtotal.toFixed(2)}</span></div>`
      if (item.notes) rows += `<p class="note">${item.notes}</p>`
    }
    if (order.discount_amount > 0) {
      rows += `<div class="row green"><span>Descuento</span><span>-$${order.discount_amount.toFixed(2)}</span></div>`
    }
  }

  const socials: string[] = []
  if (s.instagram) socials.push(`<span>📷 @${s.instagram}</span>`)
  if (s.facebook)  socials.push(`<span>📘 ${s.facebook}</span>`)
  if (s.tiktok)    socials.push(`<span>🎵 @${s.tiktok}</span>`)
  if (s.whatsapp)  socials.push(`<a href="https://wa.me/${s.whatsapp.replace(/\D/g, '')}">💬 ${s.whatsapp}</a>`)
  const socialsHtml = socials.length
    ? `<div class="socials">${socials.join('')}</div>`
    : ''

  const qrHtml = qrApiUrl
    ? `<div class="qr-block">
        ${s.qrLabel ? `<p class="qr-label">${s.qrLabel}</p>` : ''}
        <img src="${qrApiUrl}" width="100" height="100" alt="QR" style="display:block;margin:4px auto" />
       </div>`
    : ''

  const logoHtml = s.showLogo && s.logoUrl
    ? `<img src="${s.logoUrl}" alt="Logo" style="max-height:60px;max-width:140px;object-fit:contain;margin:0 auto 4px;display:block" />`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family:'Courier New',monospace; font-size:12px; padding:8px 6px; width:58mm; color:#000 }
  .center { text-align:center; margin-bottom:3px }
  .bold { font-weight:bold }
  .big { font-size:15px; font-weight:bold; margin-bottom:2px }
  .small { font-size:10px; color:#555 }
  .label { font-weight:bold; font-size:11px; color:#555; margin:4px 0 2px }
  .note { font-size:11px; color:#b45309; padding-left:10px; margin-bottom:1px }
  .row { display:flex; justify-content:space-between; margin-bottom:2px; gap:4px }
  .row span:first-child { flex:1; overflow:hidden }
  .row span:last-child { flex-shrink:0 }
  .green { color:#166534 }
  .total { font-size:14px; font-weight:bold }
  .socials { text-align:center; font-size:10px; color:#444; margin:6px 0; display:flex; flex-wrap:wrap; justify-content:center; gap:4px }
  .socials a { color:#444; text-decoration:none }
  .qr-block { text-align:center; margin:6px 0 }
  .qr-label { font-size:10px; color:#555; margin-bottom:2px }
  .footer { text-align:center; font-size:11px; color:#555; margin-top:6px }
</style>
</head><body>
${logoHtml}
<p class="center big">${s.restaurantName}</p>
${s.address ? `<p class="center small">${s.address}</p>` : ''}
${s.phone   ? `<p class="center small">${s.phone}</p>`   : ''}
<p class="center">${label}</p>
<p class="center small">${now}</p>
${sep}
${rows}
${sep}
<div class="row total"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>
${socialsHtml}
${qrHtml}
<p class="footer">${s.footer}</p>
</body></html>`
}

/**
 * Write receipt HTML into a window and trigger the print dialog.
 * Pass an already-opened window to avoid popup-blocker issues when this
 * is called after an async operation (user gesture would be lost).
 */
export async function printViaPopup(
  label: string,
  orders: PrintOrder[],
  total: number,
  existingWin?: Window | null,
) {
  const s   = await getTicketSettings()
  const html = buildHtml(label, orders, total, s)
  const win  = existingWin ?? window.open('', '_blank', 'width=380,height=600,top=60,left=60')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
  win.addEventListener('afterprint', () => win.close())
}

/**
 * Tries to print via Bluetooth first (using ticket settings for layout),
 * then falls back to a popup.
 * Returns true if BT succeeded.
 */
export async function printTicket(
  label: string,
  orders: PrintOrder[],
  total: number,
  fallbackWin?: Window | null,
): Promise<boolean> {
  const s = await getTicketSettings()
  if (getPairedPrinterName()) {
    const data = await buildReceiptBytes(label, orders, total, s)
    const ok   = await printViaBluetooth(data)
    if (ok) {
      fallbackWin?.close()
      return true
    }
  }
  await printViaPopup(label, orders, total, fallbackWin)
  return false
}
