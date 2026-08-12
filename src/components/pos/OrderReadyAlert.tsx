'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface ReadyOrder {
  id: string
  order_number: number
  table_number: string | null
}

export function OrderReadyAlert() {
  const { t } = useI18n()
  const [alerts, setAlerts] = useState<ReadyOrder[]>([])

  useEffect(() => {
    const supabase = createClient()
    let userId: string | null = null

    supabase.auth.getUser().then(({ data: { user } }) => {
      userId = user?.id ?? null
    })

    const channel = supabase
      .channel('pos-order-ready')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const updated = payload.new as { id: string; status: string; order_number: number; table_number: string | null; created_by: string }
          if (updated.status === 'ready' && updated.created_by === userId) {
            setAlerts(prev => {
              if (prev.find(a => a.id === updated.id)) return prev
              return [...prev, {
                id: updated.id,
                order_number: updated.order_number,
                table_number: updated.table_number,
              }]
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function dismiss(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  if (alerts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className="flex items-center gap-3 bg-green-600 text-white px-4 py-3 rounded-2xl shadow-xl animate-bounce-once"
        >
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-tight">
              {t.pos.orderReadyAlert(alert.order_number)}
            </p>
            <p className="text-green-200 text-sm">
              {alert.table_number ? `${t.pos.tableN(alert.table_number)} — ` : ''}
              {t.pos.readyToDeliver}
            </p>
          </div>
          <button
            onClick={() => dismiss(alert.id)}
            className="p-1 rounded-lg hover:bg-green-500 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
