/**
 * ESC/POS command builder for 58 mm thermal paper (32 chars/line).
 * Only uses printable ASCII + basic Latin replacements so any codepage works.
 */

import type { TicketSettings } from './ticket-settings'

const COLS = 32  // chars per line on 58 mm paper at default density

// ── ASCII fallback map for Spanish/extended chars ────────────────────────────
const LATIN_MAP: Record<string, string> = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u',
  Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U',
  ñ: 'n', Ñ: 'N', ü: 'u', Ü: 'U', '¿': '?', '¡': '!',
  '@': '@',   // keep — used in social handles
}
function ascii(s: string) {
  return s.replace(/[^\x00-\x7F]/g, c => LATIN_MAP[c] ?? '?')
}

// ── Command constants ─────────────────────────────────────────────────────────
const ESC = 0x1b
const GS  = 0x1d
const LF  = 0x0a

const CMD = {
  init:        [ESC, 0x40],
  alignLeft:   [ESC, 0x61, 0x00],
  alignCenter: [ESC, 0x61, 0x01],
  boldOn:      [ESC, 0x45, 0x01],
  boldOff:     [ESC, 0x45, 0x00],
  doubleOn:    [ESC, 0x21, 0x10],   // double height + width
  doubleOff:   [ESC, 0x21, 0x00],
  smallOn:     [ESC, 0x21, 0x01],   // small font
  smallOff:    [ESC, 0x21, 0x00],
  cut:         [GS,  0x56, 0x41, 0x00], // partial cut
}

function bytes(...chunks: (number[] | string)[]): number[] {
  const out: number[] = []
  for (const chunk of chunks) {
    if (typeof chunk === 'string') {
      out.push(...Array.from(new TextEncoder().encode(chunk)))
    } else {
      out.push(...chunk)
    }
  }
  return out
}

// Left text + right text on the same line, padded to COLS
function twoCol(left: string, right: string): string {
  const gap = COLS - left.length - right.length
  return left + (gap > 0 ? ' '.repeat(gap) : ' ') + right + '\n'
}

function separator(): string {
  return '-'.repeat(COLS) + '\n'
}

// Center-pad a string to COLS
function center(s: string): string {
  const pad = Math.max(0, Math.floor((COLS - s.length) / 2))
  return ' '.repeat(pad) + s + '\n'
}

// ── ESC/POS native QR code ────────────────────────────────────────────────────
/**
 * Builds the byte sequence to print a QR code using the GS ( k command set.
 * Most ESC/POS printers that support QR codes implement this.
 */
function qrCodeBytes(data: string): number[] {
  const enc  = new TextEncoder().encode(data)
  const len  = enc.length + 3        // +3 for pL, pH, cn, fn bytes after pL pH
  const pL   = len & 0xff
  const pH   = (len >> 8) & 0xff

  return [
    // Set QR model (model 2, standard)
    GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0,
    // Set module size (3 = ~4 mm per module — readable at arm's length)
    GS, 0x28, 0x6b, 3, 0, 49, 67, 4,
    // Set error correction level M
    GS, 0x28, 0x6b, 3, 0, 49, 69, 49,
    // Store data
    GS, 0x28, 0x6b, pL, pH, 49, 80, 48, ...Array.from(enc),
    // Print
    GS, 0x28, 0x6b, 3, 0, 49, 81, 48,
  ]
}

// ── Logo raster conversion (browser only) ────────────────────────────────────
/**
 * Fetches an image URL, renders it centered on a full-width canvas, and
 * returns ESC/POS GS v 0 raster bytes ready to send to the printer.
 * Returns [] on any failure (CORS, load error, SSR).
 */
async function logoRasterBytes(url: string): Promise<number[]> {
  if (typeof document === 'undefined') return []

  const PAPER_PX     = 384   // 58 mm paper at 8 dots/mm = 384 px wide
  const MAX_LOGO_H   = 120   // cap logo height to avoid huge prints
  const BYTES_PER_LINE = PAPER_PX / 8  // = 48

  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const scale  = Math.min(PAPER_PX / img.width, MAX_LOGO_H / img.height, 1)
      const logoW  = Math.floor(img.width  * scale)
      const logoH  = Math.floor(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width  = PAPER_PX
      canvas.height = logoH
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve([]); return }

      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, PAPER_PX, logoH)
      ctx.drawImage(img, Math.floor((PAPER_PX - logoW) / 2), 0, logoW, logoH)

      let imageData: ImageData
      try {
        imageData = ctx.getImageData(0, 0, PAPER_PX, logoH)
      } catch {
        resolve([])   // canvas tainted (CORS) — skip logo silently
        return
      }

      const raster: number[] = []
      for (let y = 0; y < logoH; y++) {
        for (let bx = 0; bx < BYTES_PER_LINE; bx++) {
          let byte = 0
          for (let bit = 0; bit < 8; bit++) {
            const x   = bx * 8 + bit
            const idx = (y * PAPER_PX + x) * 4
            const a   = imageData.data[idx + 3]
            if (a < 128) continue   // transparent → white
            const gray = 0.299 * imageData.data[idx] +
                         0.587 * imageData.data[idx + 1] +
                         0.114 * imageData.data[idx + 2]
            if (gray < 128) byte |= (0x80 >> bit)
          }
          raster.push(byte)
        }
      }

      const xL = BYTES_PER_LINE & 0xff
      const xH = (BYTES_PER_LINE >> 8) & 0xff
      const yL = logoH & 0xff
      const yH = (logoH >> 8) & 0xff

      resolve([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...raster, LF])
    }

    img.onerror = () => resolve([])
    img.src = url
  })
}

// ── Public interface ──────────────────────────────────────────────────────────

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

export async function buildReceiptBytes(
  label:   string,
  orders:  PrintOrder[],
  total:   number,
  settings?: Partial<TicketSettings>,
): Promise<Uint8Array> {
  const now = new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
  const buf: number[] = []
  const add = (...chunks: (number[] | string)[]) => buf.push(...bytes(...chunks))

  const name    = ascii(settings?.restaurantName ?? 'Gorditas Dona Felix')
  const address = settings?.address ? ascii(settings.address) : ''
  const phone   = settings?.phone   ? ascii(settings.phone)   : ''
  const footer  = ascii(settings?.footer ?? '¡Gracias por su visita!')

  // ── Header ────────────────────────────────────────────────────────────────
  add(CMD.init)
  add(CMD.alignCenter)

  if (settings?.showLogo && settings?.logoUrl) {
    const lbytes = await logoRasterBytes(settings.logoUrl)
    buf.push(...lbytes)
  }

  add(CMD.doubleOn, CMD.boldOn)
  add(name + '\n')
  add(CMD.doubleOff, CMD.boldOff)
  if (address) add(CMD.smallOn, center(address), CMD.smallOff)
  if (phone)   add(CMD.smallOn, center(phone),   CMD.smallOff)
  add(ascii(label) + '\n')
  add(ascii(now) + '\n')
  add(CMD.alignLeft)
  add(separator())

  // ── Orders ────────────────────────────────────────────────────────────────
  for (const order of orders) {
    add(CMD.boldOn)
    const orderLabel = order.order_number === 0
      ? 'Pedido en curso'
      : `Pedido #${order.order_number}`
    add(ascii(orderLabel) + '\n')
    add(CMD.boldOff)
    for (const item of order.items ?? []) {
      const name  = ascii((item.product?.name ?? 'Producto').slice(0, 22))
      const price = `$${item.subtotal.toFixed(2)}`
      const left  = `${item.quantity}x ${name}`
      add(twoCol(left.slice(0, COLS - price.length - 1), price))
      if (item.notes) add(CMD.smallOn, ascii(`  * ${item.notes}`) + '\n', CMD.smallOff)
    }
    if (order.discount_amount > 0) {
      add(twoCol('  Descuento', `-$${order.discount_amount.toFixed(2)}`))
    }
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  add(separator())
  add(CMD.boldOn, CMD.doubleOn)
  add(CMD.alignCenter)
  add(ascii(`TOTAL  $${total.toFixed(2)}`) + '\n')
  add(CMD.doubleOff, CMD.boldOff)

  // ── Social + QR ───────────────────────────────────────────────────────────
  add(CMD.alignCenter)

  const socials: string[] = []
  if (settings?.instagram) socials.push(ascii(`IG: @${settings.instagram}`))
  if (settings?.facebook)  socials.push(ascii(`FB: ${settings.facebook}`))
  if (settings?.tiktok)    socials.push(ascii(`TT: @${settings.tiktok}`))
  if (settings?.whatsapp)  socials.push(ascii(`WA: ${settings.whatsapp}`))

  if (socials.length > 0) {
    add('\n')
    add(CMD.smallOn)
    for (const s of socials) add(center(s.slice(0, COLS)))
    add(CMD.smallOff)
  }

  if (settings?.qrUrl) {
    add('\n')
    if (settings.qrLabel) add(CMD.smallOn, center(ascii(settings.qrLabel)), CMD.smallOff)
    add(qrCodeBytes(settings.qrUrl))
    add([LF])
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  add('\n')
  add(footer + '\n')
  add('\n\n\n')
  add(CMD.cut)

  return new Uint8Array(buf)
}
