import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { QueryProvider } from '@/components/ui/QueryProvider'
import { QaArchitectProvider } from '@/components/ui/QaArchitectProvider'
import { createClient } from '@/lib/supabase/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getLocale } from '@/lib/i18n/server'

const geist = Geist({ subsets: ['latin'] })

// brand-700 hex per theme — used for <meta name="theme-color">
const THEME_COLORS: Record<string, string> = {
  amber:   '#b45309',
  emerald: '#047857',
  blue:    '#1d4ed8',
  violet:  '#6d28d9',
  rose:    '#be123c',
  slate:   '#334155',
}

async function getTheme(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'theme')
    .maybeSingle()
  return data?.value ?? 'amber'
}

export const metadata: Metadata = {
  title: 'Gorditas Doña Félix',
  description: 'Sistema POS & ERP',
  // manifest link is injected automatically by app/manifest.ts → /manifest.webmanifest
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Doña Félix',
  },
  icons: {
    apple: '/icon-192.png',
  },
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await getTheme()
  return {
    themeColor: THEME_COLORS[theme] ?? THEME_COLORS.amber,
    width: 'device-width',
    initialScale: 1,
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [theme, locale] = await Promise.all([getTheme(), getLocale()])

  return (
    <html lang={locale} className="h-full" data-theme={theme}>
      <body className={`${geist.className} h-full antialiased`}>
        <QaArchitectProvider>
          <QueryProvider>
            <I18nProvider initialLocale={locale}>{children}</I18nProvider>
          </QueryProvider>
        </QaArchitectProvider>
        <Script id="pwa-init" strategy="afterInteractive">{`
          window.__pwaPrompt = null;
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.__pwaPrompt = e;
            window.dispatchEvent(new Event('pwa-prompt-ready'));
          });
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js');
            });
          }
        `}</Script>
      </body>
    </html>
  )
}
