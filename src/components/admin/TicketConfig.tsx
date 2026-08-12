'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Save, Loader2, Check, QrCode,
  Phone, MapPin, MessageCircle, Music2, Image, Type, AlignLeft,
  AtSign, Share2, Globe,
} from 'lucide-react'
import { settingsFromMap, invalidateTicketSettings, type TicketSettings } from '@/lib/utils/ticket-settings'

interface Props {
  settings: Record<string, string>
}

// QR image via free public API — no key needed
function qrImgUrl(url: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(url)}`
}

// ── Live ticket preview ────────────────────────────────────────────────────────
function TicketPreviewPane({ s, label }: { s: TicketSettings; label: string }) {
  const [now, setNow] = useState('')
  useEffect(() => {
    setNow(new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }))
  }, [])
  const socials = [
    s.instagram && `📷 @${s.instagram}`,
    s.facebook  && `📘 ${s.facebook}`,
    s.tiktok    && `🎵 @${s.tiktok}`,
    s.whatsapp  && `💬 ${s.whatsapp}`,
  ].filter(Boolean) as string[]

  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-stone-100 px-3 py-1.5 border-b border-stone-200 flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <span className="text-xs text-stone-400 font-medium">Vista previa del ticket</span>
      </div>

      <div
        className="font-mono text-[10px] leading-[1.4] p-3 text-center"
        style={{ width: '200px', minHeight: '280px', margin: '0 auto' }}
      >
        {s.showLogo && s.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.logoUrl}
            alt="Logo"
            className="h-10 object-contain mx-auto mb-1"
            onError={e => (e.currentTarget.style.display = 'none')}
          />
        )}

        <p className="font-bold text-[12px] leading-tight">{s.restaurantName}</p>
        {s.address && <p className="text-stone-500 text-[9px]">{s.address}</p>}
        {s.phone   && <p className="text-stone-500 text-[9px]">{s.phone}</p>}
        <p className="text-stone-600">{label || 'Mesa 1'}</p>
        <p className="text-stone-400 text-[9px]">{now}</p>

        <div className="border-t border-dashed border-stone-300 my-1" />

        <div className="text-left">
          <p className="font-semibold text-stone-600">Pedido #1</p>
          <div className="flex justify-between">
            <span>2× Gordita de frijoles</span>
            <span>$30.00</span>
          </div>
          <div className="flex justify-between">
            <span>1× Refresco</span>
            <span>$15.00</span>
          </div>
        </div>

        <div className="border-t border-dashed border-stone-300 my-1" />

        <div className="flex justify-between font-bold text-[11px]">
          <span>TOTAL</span>
          <span>$45.00</span>
        </div>

        {socials.length > 0 && (
          <div className="mt-1 text-[8px] text-stone-500 space-y-0.5">
            {socials.map(s => <p key={s}>{s}</p>)}
          </div>
        )}

        {s.qrUrl && (
          <div className="mt-1">
            {s.qrLabel && <p className="text-[8px] text-stone-500 mb-0.5">{s.qrLabel}</p>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImgUrl(s.qrUrl)} alt="QR" className="w-14 h-14 mx-auto" />
          </div>
        )}

        <p className="mt-1 text-[9px] text-stone-500">{s.footer}</p>
      </div>
    </div>
  )
}

// ── Main form ──────────────────────────────────────────────────────────────────
export function TicketConfig({ settings }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [form, setForm] = useState<TicketSettings>(() => settingsFromMap(settings))
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  function set<K extends keyof TicketSettings>(key: K, value: TicketSettings[K]) {
    setForm(p => ({ ...p, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    const rows: { key: string; value: string }[] = [
      { key: 'ticket_address',   value: form.address   },
      { key: 'ticket_phone',     value: form.phone     },
      { key: 'ticket_footer',    value: form.footer    },
      { key: 'ticket_instagram', value: form.instagram },
      { key: 'ticket_facebook',  value: form.facebook  },
      { key: 'ticket_whatsapp',  value: form.whatsapp  },
      { key: 'ticket_tiktok',    value: form.tiktok    },
      { key: 'ticket_qr_url',    value: form.qrUrl     },
      { key: 'ticket_qr_label',  value: form.qrLabel   },
      { key: 'ticket_logo_url',  value: form.logoUrl   },
      { key: 'ticket_show_logo', value: form.showLogo ? '1' : '0' },
    ]

    await Promise.all(
      rows.map(r =>
        supabase.from('settings').upsert({ key: r.key, value: r.value, updated_at: new Date().toISOString() })
      )
    )

    invalidateTicketSettings()  // force fresh fetch on next print
    setSaving(false)
    setSaved(true)
    startTransition(() => router.refresh())
  }

  const inputCls = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
  const labelCls = 'block text-xs font-semibold text-stone-600 mb-1'

  return (
    <div className="flex flex-col xl:flex-row gap-8 max-w-4xl">

      {/* ── Form ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 space-y-5">

        {/* Logo */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-stone-400" />
            <h3 className="font-semibold text-stone-800 text-sm">Logo en el ticket PDF</h3>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.showLogo}
              onChange={e => set('showLogo', e.target.checked)}
              className="w-4 h-4 rounded accent-brand-600"
            />
            <span className="text-sm text-stone-700">Mostrar logo en el ticket PDF</span>
          </label>

          {form.showLogo && (
            <div className="space-y-2">
              <label className={labelCls}>URL del logo para el ticket</label>
              <input
                value={form.logoUrl}
                onChange={e => set('logoUrl', e.target.value)}
                className={inputCls}
                placeholder="Vacío = usa el logo del restaurante"
              />
              {settings.restaurant_logo_url && form.logoUrl !== settings.restaurant_logo_url && (
                <button
                  type="button"
                  onClick={() => set('logoUrl', settings.restaurant_logo_url)}
                  className="text-xs text-brand-600 hover:underline"
                >
                  ← Usar logo del restaurante
                </button>
              )}
              {form.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logoUrl}
                  alt="preview"
                  className="h-12 object-contain rounded-lg border border-stone-200 p-1 bg-stone-50"
                  onError={e => (e.currentTarget.style.display = 'none')}
                />
              )}
            </div>
          )}
        </div>

        {/* Info del negocio */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-stone-400" />
            <h3 className="font-semibold text-stone-800 text-sm">Información del negocio</h3>
          </div>

          <div>
            <label className={labelCls}><MapPin className="w-3 h-3 inline mr-1" />Dirección</label>
            <input
              value={form.address}
              onChange={e => set('address', e.target.value)}
              className={inputCls}
              placeholder="Calle, número, colonia, ciudad"
            />
          </div>

          <div>
            <label className={labelCls}><Phone className="w-3 h-3 inline mr-1" />Teléfono</label>
            <input
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              className={inputCls}
              placeholder="(55) 1234-5678"
            />
          </div>
        </div>

        {/* Redes sociales */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-stone-400" />
            <h3 className="font-semibold text-stone-800 text-sm">Redes sociales</h3>
            <span className="text-xs text-stone-400">Se muestran al pie del ticket</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}><AtSign className="w-3 h-3 inline mr-1" />Instagram</label>
              <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-400">
                <span className="px-2 text-stone-400 text-sm bg-stone-50 border-r border-stone-300">@</span>
                <input
                  value={form.instagram}
                  onChange={e => set('instagram', e.target.value.replace('@', ''))}
                  className="flex-1 px-2 py-2 text-sm focus:outline-none"
                  placeholder="turestaurante"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}><Globe className="w-3 h-3 inline mr-1" />Facebook</label>
              <input
                value={form.facebook}
                onChange={e => set('facebook', e.target.value)}
                className={inputCls}
                placeholder="Gorditas Doña Félix"
              />
            </div>

            <div>
              <label className={labelCls}><Music2 className="w-3 h-3 inline mr-1" />TikTok</label>  {/* closest icon */}
              <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-400">
                <span className="px-2 text-stone-400 text-sm bg-stone-50 border-r border-stone-300">@</span>
                <input
                  value={form.tiktok}
                  onChange={e => set('tiktok', e.target.value.replace('@', ''))}
                  className="flex-1 px-2 py-2 text-sm focus:outline-none"
                  placeholder="turestaurante"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}><MessageCircle className="w-3 h-3 inline mr-1" />WhatsApp</label>
              <input
                value={form.whatsapp}
                onChange={e => set('whatsapp', e.target.value)}
                className={inputCls}
                placeholder="521234567890"
              />
              <p className="text-xs text-stone-400 mt-1">Con código de país, sin espacios ni guiones</p>
            </div>
          </div>
        </div>

        {/* Código QR */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-stone-400" />
            <h3 className="font-semibold text-stone-800 text-sm">Código QR</h3>
            <span className="text-xs text-stone-400">Aparece al final del ticket</span>
          </div>

          <div>
            <label className={labelCls}>URL del QR</label>
            <input
              value={form.qrUrl}
              onChange={e => set('qrUrl', e.target.value)}
              className={inputCls}
              placeholder="https://g.page/tu-restaurante o tu menú online"
            />
            <p className="text-xs text-stone-400 mt-1">
              Puede ser Google Maps, menú digital, Instagram, WhatsApp, etc.
            </p>
          </div>

          <div>
            <label className={labelCls}>Texto debajo del QR</label>
            <input
              value={form.qrLabel}
              onChange={e => set('qrLabel', e.target.value)}
              className={inputCls}
              placeholder="Síguenos en redes · ¡Déjanos tu reseña!"
            />
          </div>

          {form.qrUrl && (
            <div className="flex items-center gap-3 p-2 bg-stone-50 rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrImgUrl(form.qrUrl)} alt="QR preview" className="w-16 h-16 rounded" />
              <div>
                <p className="text-xs font-medium text-stone-700">Vista previa del QR</p>
                <p className="text-xs text-stone-400 break-all">{form.qrUrl.slice(0, 50)}{form.qrUrl.length > 50 ? '…' : ''}</p>
              </div>
            </div>
          )}
        </div>

        {/* Pie de página */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlignLeft className="w-4 h-4 text-stone-400" />
            <h3 className="font-semibold text-stone-800 text-sm">Mensaje de cierre</h3>
          </div>
          <textarea
            value={form.footer}
            onChange={e => set('footer', e.target.value)}
            rows={2}
            className={`${inputCls} resize-none`}
            placeholder="¡Gracias por su visita! Vuelva pronto 😊"
          />
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white'
          }`}
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
            : saved
            ? <><Check className="w-4 h-4" /> Cambios guardados</>
            : <><Save className="w-4 h-4" /> Guardar configuración del ticket</>
          }
        </button>
      </div>

      {/* ── Live preview ────────────────────────────────────────────────────── */}
      <div className="xl:w-56 xl:sticky xl:top-6 xl:self-start">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
          Vista previa en tiempo real
        </p>
        <TicketPreviewPane s={form} label="Mesa 1" />
        <p className="text-xs text-stone-400 mt-2 text-center leading-snug">
          El ticket real usa los pedidos y totales reales
        </p>
      </div>

    </div>
  )
}
