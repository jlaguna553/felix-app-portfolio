import { describe, it, expect, beforeEach } from 'vitest'
import {
  settingsFromMap,
  invalidateTicketSettings,
  DEFAULT_TICKET_SETTINGS,
} from '@/lib/utils/ticket-settings'

describe('DEFAULT_TICKET_SETTINGS', () => {
  it('has expected default values', () => {
    expect(DEFAULT_TICKET_SETTINGS.restaurantName).toBe('Gorditas Doña Félix')
    expect(DEFAULT_TICKET_SETTINGS.footer).toBe('¡Gracias por su visita!')
    expect(DEFAULT_TICKET_SETTINGS.showLogo).toBe(true)
    expect(DEFAULT_TICKET_SETTINGS.address).toBe('')
    expect(DEFAULT_TICKET_SETTINGS.phone).toBe('')
  })
})

describe('settingsFromMap', () => {
  it('maps all fields from a complete settings map', () => {
    const map = {
      restaurant_name:  'Mi Taquería',
      ticket_address:   'Calle 123, Col. Centro',
      ticket_phone:     '555-1234',
      ticket_footer:    'Hasta pronto',
      ticket_instagram: 'mitaqueria',
      ticket_facebook:  'Mi Taqueria Oficial',
      ticket_whatsapp:  '5212345678',
      ticket_tiktok:    'mitaqueria',
      ticket_qr_url:    'https://example.com/menu',
      ticket_qr_label:  'Escanea para ver el menú',
      ticket_logo_url:  'https://example.com/logo.png',
      ticket_show_logo: '1',
    }
    const s = settingsFromMap(map)
    expect(s.restaurantName).toBe('Mi Taquería')
    expect(s.address).toBe('Calle 123, Col. Centro')
    expect(s.phone).toBe('555-1234')
    expect(s.footer).toBe('Hasta pronto')
    expect(s.instagram).toBe('mitaqueria')
    expect(s.facebook).toBe('Mi Taqueria Oficial')
    expect(s.whatsapp).toBe('5212345678')
    expect(s.tiktok).toBe('mitaqueria')
    expect(s.qrUrl).toBe('https://example.com/menu')
    expect(s.qrLabel).toBe('Escanea para ver el menú')
    expect(s.logoUrl).toBe('https://example.com/logo.png')
    expect(s.showLogo).toBe(true)
  })

  it('returns defaults for an empty map', () => {
    const s = settingsFromMap({})
    expect(s.restaurantName).toBe(DEFAULT_TICKET_SETTINGS.restaurantName)
    expect(s.footer).toBe('¡Gracias por su visita!')
    expect(s.address).toBe('')
    expect(s.phone).toBe('')
    expect(s.instagram).toBe('')
    expect(s.qrUrl).toBe('')
    expect(s.logoUrl).toBe('')
    expect(s.showLogo).toBe(true)
  })

  it('sets showLogo to false when ticket_show_logo is "0"', () => {
    expect(settingsFromMap({ ticket_show_logo: '0' }).showLogo).toBe(false)
  })

  it('sets showLogo to true when ticket_show_logo is "1"', () => {
    expect(settingsFromMap({ ticket_show_logo: '1' }).showLogo).toBe(true)
  })

  it('sets showLogo to true when ticket_show_logo is absent', () => {
    expect(settingsFromMap({}).showLogo).toBe(true)
  })

  it('falls back to restaurant_logo_url when ticket_logo_url is absent', () => {
    const s = settingsFromMap({ restaurant_logo_url: 'https://example.com/fallback.png' })
    expect(s.logoUrl).toBe('https://example.com/fallback.png')
  })

  it('prefers ticket_logo_url over restaurant_logo_url', () => {
    const s = settingsFromMap({
      ticket_logo_url:     'https://example.com/ticket.png',
      restaurant_logo_url: 'https://example.com/fallback.png',
    })
    expect(s.logoUrl).toBe('https://example.com/ticket.png')
  })

  it('uses default footer when ticket_footer is an empty string', () => {
    const s = settingsFromMap({ ticket_footer: '' })
    expect(s.footer).toBe('¡Gracias por su visita!')
  })

  it('returns empty strings for social fields when absent', () => {
    const s = settingsFromMap({})
    expect(s.instagram).toBe('')
    expect(s.facebook).toBe('')
    expect(s.whatsapp).toBe('')
    expect(s.tiktok).toBe('')
  })
})

describe('invalidateTicketSettings', () => {
  beforeEach(() => {
    // Ensure localStorage is clean between tests
    localStorage.clear()
  })

  it('removes the cache key from localStorage', () => {
    const CACHE_KEY = 'felix_ticket_settings_v1'
    localStorage.setItem(CACHE_KEY, JSON.stringify({ restaurantName: 'Cached' }))
    invalidateTicketSettings()
    expect(localStorage.getItem(CACHE_KEY)).toBeNull()
  })

  it('can be called multiple times without throwing', () => {
    expect(() => {
      invalidateTicketSettings()
      invalidateTicketSettings()
    }).not.toThrow()
  })
})
