/**
 * Ticket settings — read from Supabase `settings` table, cached in memory
 * for the browser session and in localStorage so they survive a soft reload.
 *
 * Keys stored in `settings`:
 *   ticket_address      — street address
 *   ticket_phone        — phone / WhatsApp number (displayed as text)
 *   ticket_footer       — custom closing message
 *   ticket_instagram    — @handle (without @)
 *   ticket_facebook     — page name or full URL
 *   ticket_whatsapp     — number for wa.me link  (e.g. 521234567890)
 *   ticket_tiktok       — @handle (without @)
 *   ticket_qr_url       — URL to encode as QR code on the ticket
 *   ticket_qr_label     — small caption below the QR
 *   ticket_logo_url     — logo URL for PDF ticket (falls back to restaurant_logo_url)
 *   ticket_show_logo    — '1' | '0' — whether to print logo on PDF ticket
 */

export interface TicketSettings {
  restaurantName: string
  address:    string
  phone:      string
  footer:     string
  instagram:  string
  facebook:   string
  whatsapp:   string
  tiktok:     string
  qrUrl:      string
  qrLabel:    string
  logoUrl:    string   // for PDF
  showLogo:   boolean
}

export const DEFAULT_TICKET_SETTINGS: TicketSettings = {
  restaurantName: 'Gorditas Doña Félix',
  address:   '',
  phone:     '',
  footer:    '¡Gracias por su visita!',
  instagram: '',
  facebook:  '',
  whatsapp:  '',
  tiktok:    '',
  qrUrl:     '',
  qrLabel:   '',
  logoUrl:   '',
  showLogo:  true,
}

const CACHE_KEY = 'felix_ticket_settings_v1'
let _mem: TicketSettings | null = null

export function settingsFromMap(map: Record<string, string>): TicketSettings {
  return {
    restaurantName: map.restaurant_name  ?? DEFAULT_TICKET_SETTINGS.restaurantName,
    address:   map.ticket_address        ?? '',
    phone:     map.ticket_phone          ?? '',
    footer:    map.ticket_footer         || '¡Gracias por su visita!',
    instagram: map.ticket_instagram      ?? '',
    facebook:  map.ticket_facebook       ?? '',
    whatsapp:  map.ticket_whatsapp       ?? '',
    tiktok:    map.ticket_tiktok         ?? '',
    qrUrl:     map.ticket_qr_url         ?? '',
    qrLabel:   map.ticket_qr_label       ?? '',
    logoUrl:   map.ticket_logo_url       || map.restaurant_logo_url || '',
    showLogo:  (map.ticket_show_logo ?? '1') !== '0',
  }
}

/** Fetch ticket settings (with in-memory + localStorage cache). */
export async function getTicketSettings(): Promise<TicketSettings> {
  if (_mem) return _mem

  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      try { _mem = JSON.parse(raw); return _mem! } catch { /* stale */ }
    }
  }

  // Dynamic import so this file stays server-safe on edge routes
  const { createClient } = await import('@/lib/supabase/client')
  const { data } = await createClient().from('settings').select('key, value')
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value ?? ''

  _mem = settingsFromMap(map)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CACHE_KEY, JSON.stringify(_mem))
  }
  return _mem
}

/** Call after saving to force a fresh fetch on the next print. */
export function invalidateTicketSettings() {
  _mem = null
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(CACHE_KEY)
  }
}
