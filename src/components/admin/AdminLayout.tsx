'use client'

import { useState, useEffect } from 'react'
import { AdminSidebar } from './AdminSidebar'
import { PWAInstallButton } from '@/components/ui/PWAInstallButton'
import { FloatingChat } from '@/components/ai/FloatingChat'
import { getTicketSettings } from '@/lib/utils/ticket-settings'
import { useI18n } from '@/lib/i18n/I18nProvider'
import type { UserRole, Branch } from '@/lib/types'

interface Props {
  children: React.ReactNode
  role?: UserRole
  currentBranch?: Branch | null
  branches?: Branch[]
}

export function AdminLayout({ children, role, currentBranch, branches = [] }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('Doña Félix')
  const [logoUrl, setLogoUrl] = useState('')
  const { t } = useI18n()
  const isAdmin = role === 'admin' || role === 'owner'

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1024) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    function loadSettings() {
      getTicketSettings().then(s => {
        setRestaurantName(s.restaurantName)
        setLogoUrl(s.logoUrl)
      })
    }
    loadSettings()
    window.addEventListener('felix:settings-updated', loadSettings)
    return () => window.removeEventListener('felix:settings-updated', loadSettings)
  }, [])

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <AdminSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        role={role}
        currentBranch={currentBranch}
        branches={branches}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        onToggleCollapse={() => setCollapsed(c => !c)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-3 bg-brand-900 text-white px-4 py-3 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg hover:bg-brand-800 transition-colors"
            aria-label={t.nav.openMenu}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-7 h-7 object-contain rounded shrink-0"
              onError={e => (e.currentTarget.style.display = 'none')} />
          ) : (
            <span className="text-xl shrink-0">🫓</span>
          )}
          <span className="font-bold text-sm flex-1 truncate">
            {currentBranch ? currentBranch.name : restaurantName}
          </span>
          <PWAInstallButton />
        </header>

        <main className="flex-1 overflow-y-auto relative">{children}</main>
      </div>

      {/* Floating AI assistant — admin/owner only */}
      {isAdmin && <FloatingChat />}
    </div>
  )
}
