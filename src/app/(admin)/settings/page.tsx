import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/admin/SettingsForm'
import { TicketConfig } from '@/components/admin/TicketConfig'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('key, value')

  const settings = Object.fromEntries((data ?? []).map(r => [r.key, r.value ?? '']))

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-stone-200 px-6 py-4">
        <h1 className="text-xl font-bold text-stone-800">Configuración</h1>
        <p className="text-sm text-stone-400">Personaliza el restaurante, apariencia y tickets</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-10">

        {/* ── Identity + Theme + Bluetooth ────────────────────────────────── */}
        <section>
          <h2 className="text-base font-bold text-stone-700 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">1</span>
            Identidad y apariencia
          </h2>
          <SettingsForm settings={settings} />
        </section>

        <div className="border-t border-stone-100" />

        {/* ── Ticket customization ────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-bold text-stone-700 mb-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">2</span>
            Personalización del ticket
          </h2>
          <p className="text-sm text-stone-400 mb-4 ml-8">
            Logo, dirección, redes sociales, código QR y mensaje de cierre
          </p>
          <TicketConfig settings={settings} />
        </section>

      </div>
    </div>
  )
}
