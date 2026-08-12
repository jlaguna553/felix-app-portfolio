import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE, getDictionary, isLocale, type Dictionary, type Locale } from './index'

/** Lee el idioma activo desde la cookie (Server Components / route handlers). */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const value = cookieStore.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/** Diccionario del idioma activo para Server Components. */
export async function getT(): Promise<Dictionary> {
  return getDictionary(await getLocale())
}
