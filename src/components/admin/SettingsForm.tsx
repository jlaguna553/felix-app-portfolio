'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Save, Loader2, Check, Printer, Bluetooth, BluetoothOff, BluetoothSearching } from 'lucide-react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { invalidateTicketSettings } from '@/lib/utils/ticket-settings'
import {
  isBluetoothSupported,
  getPairedPrinterName,
  pairPrinter,
  clearPairedPrinter,
} from '@/lib/utils/bluetooth-printer'

interface Props {
  settings: Record<string, string>
}

const THEMES = [
  {
    id: 'amber',
    label: 'Ámbar',
    description: 'Cálido y acogedor',
    palette: ['#78350f', '#b45309', '#d97706', '#fbbf24', '#fef3c7'],
  },
  {
    id: 'emerald',
    label: 'Verde',
    description: 'Fresco y natural',
    palette: ['#064e3b', '#065f46', '#059669', '#34d399', '#d1fae5'],
  },
  {
    id: 'blue',
    label: 'Azul',
    description: 'Profesional y claro',
    palette: ['#1e3a8a', '#1d4ed8', '#3b82f6', '#93c5fd', '#dbeafe'],
  },
  {
    id: 'violet',
    label: 'Morado',
    description: 'Elegante y creativo',
    palette: ['#4c1d95', '#6d28d9', '#8b5cf6', '#c4b5fd', '#ede9fe'],
  },
  {
    id: 'rose',
    label: 'Rosa',
    description: 'Vibrante y alegre',
    palette: ['#9f1239', '#be123c', '#f43f5e', '#fda4af', '#ffe4e6'],
  },
  {
    id: 'slate',
    label: 'Pizarra',
    description: 'Sobrio y moderno',
    palette: ['#0f172a', '#1e293b', '#475569', '#94a3b8', '#f1f5f9'],
  },
]

export function SettingsForm({ settings }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [form, setForm] = useState({
    restaurant_name:     settings.restaurant_name     ?? '',
    restaurant_tagline:  settings.restaurant_tagline  ?? '',
    restaurant_logo_url: settings.restaurant_logo_url ?? '',
    theme:               settings.theme               ?? 'amber',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // ── Bluetooth printer state ────────────────────────────────────────────────
  const [btName, setBtName]           = useState<string | null>(null)
  const [btPairing, setBtPairing]     = useState(false)
  const [btSupported, setBtSupported] = useState<boolean | null>(null)

  useEffect(() => {
    setBtSupported(isBluetoothSupported())
    setBtName(getPairedPrinterName())
  }, [])

  async function handlePairPrinter() {
    setBtPairing(true)
    const result = await pairPrinter()
    setBtPairing(false)
    if (result) setBtName(result.name)
  }

  function handleUnpairPrinter() {
    clearPairedPrinter()
    setBtName(null)
  }

  function set(key: string, value: string) {
    setForm(p => ({ ...p, [key]: value }))
    setSaved(false)
  }

  function selectTheme(id: string) {
    set('theme', id)
    // Live preview — instantly change the app chrome without saving
    document.documentElement.setAttribute('data-theme', id)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    await Promise.all(
      Object.entries(form).map(([key, value]) =>
        supabase
          .from('settings')
          .upsert({ key, value, updated_at: new Date().toISOString() })
      )
    )

    invalidateTicketSettings()
    window.dispatchEvent(new CustomEvent('felix:settings-updated'))
    setSaving(false)
    setSaved(true)
    startTransition(() => router.refresh())
  }

  const logoPreview = form.restaurant_logo_url
  const currentTheme = THEMES.find(t => t.id === form.theme) ?? THEMES[0]

  return (
    <div className="max-w-lg space-y-6">

      {/* Identity */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <h2 className="font-semibold text-stone-800">Identidad del restaurante</h2>

        <div className="flex items-start gap-4">
          <ImageUpload
            value={form.restaurant_logo_url}
            onChange={url => set('restaurant_logo_url', url)}
            bucket="images"
            folder="logos"
            previewSize="md"
            className="shrink-0"
          />
          <div className="flex-1 space-y-1">
            <label className="block text-sm font-medium text-stone-700">Logotipo</label>
            <p className="text-xs text-stone-400">
              Haz clic para subir una imagen (PNG o SVG, fondo transparente, máx. 5 MB)
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Nombre del restaurante</label>
          <input
            value={form.restaurant_name}
            onChange={e => set('restaurant_name', e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="Gorditas Doña Félix"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Eslogan / subtítulo</label>
          <input
            value={form.restaurant_tagline}
            onChange={e => set('restaurant_tagline', e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="Sistema POS & ERP"
          />
        </div>
      </div>

      {/* Theme picker */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-stone-800">Color del sistema</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Cambia al instante — se aplica en el panel de administración y el punto de venta
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {THEMES.map(theme => {
            const selected = form.theme === theme.id
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => selectTheme(theme.id)}
                className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                  selected
                    ? 'border-stone-800 shadow-sm'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                {/* Color palette strip */}
                <div className="flex gap-1 mb-2">
                  {theme.palette.map((color, i) => (
                    <div
                      key={i}
                      className="flex-1 h-6 rounded-md first:rounded-l-lg last:rounded-r-lg"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <p className="text-sm font-semibold text-stone-800 leading-tight">{theme.label}</p>
                <p className="text-xs text-stone-400 mt-0.5 leading-tight">{theme.description}</p>
                {selected && (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-stone-800 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Live preview mini-sidebar */}
        <div>
          <p className="text-xs text-stone-400 mb-2">Vista previa</p>
          <div
            className="rounded-xl overflow-hidden flex shadow-sm"
            style={{ backgroundColor: currentTheme.palette[0] }}
          >
            {/* Mini sidebar */}
            <div className="w-28 p-2 space-y-1" style={{ backgroundColor: currentTheme.palette[0] }}>
              {['Dashboard', 'Productos', 'Pedidos', 'Reportes'].map((item, i) => (
                <div
                  key={item}
                  className="rounded-lg px-2 py-1.5 text-xs font-medium"
                  style={{
                    backgroundColor: i === 0 ? currentTheme.palette[2] : 'transparent',
                    color: i === 0 ? '#fff' : currentTheme.palette[3],
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
            {/* Content area */}
            <div className="flex-1 bg-stone-50 p-3">
              <div
                className="h-6 w-3/4 rounded-lg mb-2"
                style={{ backgroundColor: currentTheme.palette[2] }}
              />
              <div className="space-y-1.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-4 bg-stone-200 rounded-md" style={{ width: `${80 - i * 10}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header preview */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h2 className="font-semibold text-stone-800 mb-3">Vista previa del encabezado</h2>
        <div className="text-white px-4 py-3 rounded-xl flex items-center gap-3" style={{ backgroundColor: currentTheme.palette[2] }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0" style={{ backgroundColor: currentTheme.palette[1] }}>
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="" className="w-full h-full object-contain"
                onError={e => (e.currentTarget.style.display = 'none')} />
            ) : (
              <span className="text-lg">🫓</span>
            )}
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">
              {form.restaurant_name || 'Nombre del restaurante'}
            </p>
            {form.restaurant_tagline && (
              <p className="text-xs opacity-75">{form.restaurant_tagline}</p>
            )}
          </div>
        </div>
      </div>

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
          ? '✓ Cambios guardados'
          : <><Save className="w-4 h-4" /> Guardar cambios</>
        }
      </button>

      {/* ── Impresora Bluetooth ─────────────────────────────────────────── */}
      <div className="border-t border-stone-200 pt-6 space-y-3">
        <div className="flex items-center gap-2">
          <Printer className="w-4 h-4 text-stone-500" />
          <p className="font-semibold text-stone-800 text-sm">Impresora Bluetooth</p>
        </div>

        {btSupported === null ? (
          /* Still hydrating — don't flash the "not supported" message */
          <div className="h-10" />
        ) : !btSupported ? (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <BluetoothOff className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-700">
              <p className="font-semibold">Bluetooth no disponible en este navegador</p>
              <p className="mt-0.5">Usa Chrome o Edge en Android/Windows para imprimir por Bluetooth.</p>
            </div>
          </div>
        ) : btName ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
            <Bluetooth className="w-5 h-5 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800 truncate">{btName}</p>
              <p className="text-xs text-green-600">Al imprimir se conectará automáticamente</p>
            </div>
            <button
              onClick={handleUnpairPrinter}
              className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
            >
              Desconectar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-stone-500">
              Asegúrate de que la impresora esté encendida y vinculada al dispositivo antes de emparejar.
            </p>
            <button
              onClick={handlePairPrinter}
              disabled={btPairing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-60 text-stone-700 font-medium text-sm transition-colors"
            >
              {btPairing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Buscando impresora...</>
                : <><BluetoothSearching className="w-4 h-4" /> Emparejar impresora Bluetooth</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
