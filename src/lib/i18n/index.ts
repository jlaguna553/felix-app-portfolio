import { es, type Dictionary } from './es'
import { en } from './en'

export type Locale = 'es' | 'en'
export type { Dictionary }

export const LOCALE_COOKIE = 'felix_lang'
export const DEFAULT_LOCALE: Locale = 'es'
export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
]

export function isLocale(value: unknown): value is Locale {
  return value === 'es' || value === 'en'
}

export function getDictionary(locale: Locale): Dictionary {
  return locale === 'en' ? en : es
}

/** Locale BCP-47 para formateo de fechas/números. */
export function intlLocale(locale: Locale): string {
  return locale === 'en' ? 'en-US' : 'es-MX'
}
