'use client'

import { Globe } from 'lucide-react'
import { LOCALES } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface Props {
  /** 'dark' para fondos brand-900 (sidebar), 'light' para fondos claros. */
  variant?: 'dark' | 'light'
  /** Oculta el icono y compacta el toggle (sidebar colapsado). */
  compact?: boolean
}

export function LanguageSwitcher({ variant = 'light', compact = false }: Props) {
  const { locale, setLocale } = useI18n()
  const dark = variant === 'dark'

  return (
    <div className={`flex items-center gap-2 ${compact ? 'justify-center' : ''}`}>
      {!compact && <Globe className={`w-3.5 h-3.5 shrink-0 ${dark ? 'text-brand-400' : 'text-stone-400'}`} />}
      <div className={`flex rounded-lg overflow-hidden border ${dark ? 'border-brand-700' : 'border-stone-300'}`}>
        {LOCALES.map(({ code, label }) => {
          const active = locale === code
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={`px-2 py-1 text-xs font-semibold transition-colors ${
                active
                  ? dark ? 'bg-brand-600 text-white' : 'bg-brand-700 text-white'
                  : dark ? 'text-brand-300 hover:bg-brand-800' : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
