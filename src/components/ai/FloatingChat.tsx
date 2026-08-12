'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bot, X, Maximize2 } from 'lucide-react'
import Link from 'next/link'
import { ChatPanel } from './ChatPanel'

export function FloatingChat() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  if (pathname === '/assistant') return null

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-5 right-5 z-40 rounded-full shadow-lg flex items-center justify-center transition-all duration-200
          ${open ? 'bg-stone-700 hover:bg-stone-600' : 'bg-brand-700 hover:bg-brand-600'}
          text-white`}
        style={{ width: 52, height: 52 }}
        title="Asistente IA"
      >
        {open ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </button>

      {/* Floating panel — fullscreen on mobile, fixed popup on desktop */}
      {open && (
        <div className="
          fixed z-40 flex flex-col overflow-hidden
          bg-stone-50 shadow-2xl border border-stone-200
          /* mobile/tablet: nearly fullscreen */
          inset-x-2 bottom-16 top-4 rounded-2xl
          /* desktop only: fixed-size popup */
          lg:inset-auto lg:bottom-20 lg:right-5 lg:w-96 lg:h-[520px] lg:rounded-2xl
        ">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-brand-900 text-white shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <span className="text-sm font-medium">Asistente IA</span>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/assistant"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-brand-700 text-brand-200 hover:text-white transition-colors"
                title="Abrir en pantalla completa"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-brand-700 text-brand-200 hover:text-white transition-colors sm:hidden"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <ChatPanel compact />
          </div>
        </div>
      )}
    </>
  )
}
