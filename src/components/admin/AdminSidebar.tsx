'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingBag, BookOpen,
  BarChart2, LogOut, UtensilsCrossed, ChevronLeft, ChevronRight, X, Users, Tag, Settings,
  ClipboardList, ChefHat, Wallet, Percent, LayoutGrid, Bot, Building2, LayoutTemplate,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BranchSwitcher } from './BranchSwitcher'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { useI18n } from '@/lib/i18n/I18nProvider'
import type { Dictionary } from '@/lib/i18n'
import type { UserRole, Branch } from '@/lib/types'

type NavKey = keyof Dictionary['nav']

const adminLinks: { href: string; key: NavKey; icon: typeof LayoutDashboard }[] = [
  { href: '/dashboard',  key: 'dashboard',  icon: LayoutDashboard },
  { href: '/products',   key: 'products',   icon: ShoppingBag },
  { href: '/categories', key: 'categories', icon: Tag },
  { href: '/promotions', key: 'promotions', icon: Percent },
  { href: '/inventory',  key: 'inventory',  icon: Package },
  { href: '/recipes',    key: 'recipes',    icon: BookOpen },
  { href: '/reports',    key: 'reports',    icon: BarChart2 },
  { href: '/orders',     key: 'orders',     icon: ClipboardList },
  { href: '/caja',       key: 'caja',       icon: Wallet },
  { href: '/floor',      key: 'floor',      icon: LayoutGrid },
  { href: '/users',      key: 'users',      icon: Users },
  { href: '/menu',       key: 'menuEditor', icon: LayoutTemplate },
  { href: '/settings',   key: 'settings',   icon: Settings },
  { href: '/assistant',  key: 'assistant',  icon: Bot },
]

const ownerLinks = [
  ...adminLinks,
  { href: '/branches', key: 'branches' as NavKey, icon: Building2 },
]

const cashierLinks = [
  { href: '/caja',  key: 'caja' as NavKey,  icon: Wallet },
  { href: '/floor', key: 'floor' as NavKey, icon: LayoutGrid },
]

interface Props {
  collapsed: boolean
  mobileOpen: boolean
  role?: UserRole
  currentBranch?: Branch | null
  branches?: Branch[]
  restaurantName?: string
  logoUrl?: string
  onToggleCollapse: () => void
  onCloseMobile: () => void
}

export function AdminSidebar({
  collapsed, mobileOpen, role, currentBranch, branches = [],
  restaurantName = 'Doña Félix', logoUrl = '',
  onToggleCollapse, onCloseMobile,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useI18n()

  const isOwner = role === 'owner'
  const isCashier = role === 'cashier'
  const links = isCashier ? cashierLinks : isOwner ? ownerLinks : adminLinks

  async function handleLogout() {
    document.cookie = 'current_branch_id=; path=/; max-age=0'
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sidebarWidth = collapsed ? 'lg:w-16' : 'lg:w-56'

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-30 flex flex-col bg-brand-900 text-brand-100
        transition-transform duration-300 ease-in-out overflow-hidden
        w-64 lg:w-auto lg:relative lg:translate-x-0
        ${sidebarWidth}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      {/* Header */}
      <div className={`flex items-center border-b border-brand-800 shrink-0 ${collapsed ? 'lg:justify-center px-3 py-3' : 'px-4 py-3 gap-2'}`}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="w-8 h-8 object-contain rounded-lg shrink-0 bg-brand-800/50 p-0.5"
            onError={e => (e.currentTarget.style.display = 'none')} />
        ) : (
          <span className="text-2xl shrink-0">🫓</span>
        )}
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm leading-tight truncate">{restaurantName}</p>
            <p className="text-brand-300 text-xs">{isCashier ? t.nav.roleCashier : isOwner ? t.nav.roleOwner : t.nav.roleAdmin}</p>
          </div>
        )}
        {/* Mobile close */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1 rounded-lg hover:bg-brand-800 text-brand-300 transition-colors ml-auto"
        >
          <X className="w-4 h-4" />
        </button>
        {/* Desktop collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex p-1 rounded-lg hover:bg-brand-800 text-brand-300 transition-colors ml-auto"
          title={collapsed ? t.nav.expandMenu : t.nav.collapseMenu}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Branch indicator / switcher */}
      {!isCashier && (
        <div className={`border-b border-brand-800 shrink-0 ${collapsed ? 'py-2 px-1' : 'px-2 py-2'}`}>
          {isOwner ? (
            <BranchSwitcher
              currentBranch={currentBranch ?? null}
              branches={branches}
              collapsed={collapsed}
            />
          ) : (
            !collapsed && currentBranch && (
              <div className="flex items-center gap-2 px-3 py-1.5">
                <Building2 className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                <span className="text-xs text-brand-400 truncate">{currentBranch.name}</span>
              </div>
            )
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto scrollbar-hidden" style={{ scrollbarWidth: 'none' }}>
        {links.map(({ href, key, icon: Icon }) => {
          const active = pathname === href
          const label = t.nav[key]
          return (
            <Link
              key={href}
              href={href}
              onClick={onCloseMobile}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors
                ${collapsed ? 'lg:justify-center lg:px-0 lg:py-2 px-3 py-1.5' : 'px-3 py-2'}
                ${active ? 'bg-brand-700 text-white' : 'text-brand-200 hover:bg-brand-800 hover:text-white'}
              `}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 space-y-1 border-t border-brand-800 shrink-0">
        <div className={`${collapsed ? 'lg:px-0 px-3' : 'px-3'} py-1.5`}>
          <LanguageSwitcher variant="dark" compact={collapsed} />
        </div>
        {!isCashier && (
          <>
            <Link
              href="/pos"
              onClick={onCloseMobile}
              title={collapsed ? t.nav.pos : undefined}
              className={`flex items-center gap-3 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white transition-colors
                ${collapsed ? 'lg:justify-center lg:px-0 lg:py-2 px-3 py-1.5' : 'px-3 py-2.5'}
              `}
            >
              <UtensilsCrossed className="w-4 h-4 shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>{t.nav.pos}</span>
            </Link>
            <Link
              href="/kitchen"
              onClick={onCloseMobile}
              title={collapsed ? t.nav.kitchen : undefined}
              className={`flex items-center gap-3 rounded-lg text-sm font-medium text-brand-200 hover:bg-brand-800 hover:text-white transition-colors
                ${collapsed ? 'lg:justify-center lg:px-0 lg:py-2 px-3 py-1.5' : 'px-3 py-2.5'}
              `}
            >
              <ChefHat className="w-4 h-4 shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>{t.nav.kitchen}</span>
            </Link>
          </>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? t.nav.logout : undefined}
          className={`w-full flex items-center gap-3 rounded-lg text-sm text-brand-300 hover:bg-brand-800 hover:text-white transition-colors
            ${collapsed ? 'lg:justify-center lg:px-0 lg:py-2 px-3 py-1.5' : 'px-3 py-2.5'}
          `}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className={collapsed ? 'lg:hidden' : ''}>{t.nav.logout}</span>
        </button>
      </div>
    </aside>
  )
}
