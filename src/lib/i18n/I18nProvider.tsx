'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DEFAULT_LOCALE, LOCALE_COOKIE, getDictionary, intlLocale,
  type Dictionary, type Locale,
} from './index'

interface I18nContextValue {
  locale: Locale
  /** Locale BCP-47 para toLocaleString/Intl (es-MX / en-US). */
  intl: string
  t: Dictionary
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  intl: intlLocale(DEFAULT_LOCALE),
  t: getDictionary(DEFAULT_LOCALE),
  setLocale: () => {},
})

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const router = useRouter()
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = next
    // Re-renderiza Server Components (títulos de página, etc.) con el nuevo idioma
    router.refresh()
  }, [router])

  return (
    <I18nContext.Provider value={{ locale, intl: intlLocale(locale), t: getDictionary(locale), setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
