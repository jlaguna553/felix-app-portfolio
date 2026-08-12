'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window { __pwaPrompt: BeforeInstallPromptEvent | null }
}

export function PWAInstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    // Event may have fired before React hydrated — grab it from global
    if (window.__pwaPrompt) {
      setPrompt(window.__pwaPrompt)
      return
    }

    const onReady = () => setPrompt(window.__pwaPrompt)
    const onInstalled = () => setInstalled(true)
    window.addEventListener('pwa-prompt-ready', onReady)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('pwa-prompt-ready', onReady)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || !prompt) return null

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  return (
    <button
      onClick={install}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
    >
      <Download className="w-4 h-4" />
      Instalar app
    </button>
  )
}
