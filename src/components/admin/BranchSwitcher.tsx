'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronDown, Check, BarChart2, Plus } from 'lucide-react'
import type { Branch } from '@/lib/types'

interface Props {
  currentBranch: Branch | null
  branches: Branch[]
  collapsed: boolean
}

export function BranchSwitcher({ currentBranch, branches, collapsed }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function switchBranch(id: string) {
    document.cookie = `current_branch_id=${id}; path=/; samesite=lax`
    setOpen(false)
    router.refresh()
  }

  function goToSelectBranch() {
    setOpen(false)
    router.push('/select-branch')
  }

  if (collapsed) {
    return (
      <button
        onClick={goToSelectBranch}
        title={currentBranch?.name ?? 'Sucursal'}
        className="w-full flex justify-center py-2 px-1 rounded-lg hover:bg-brand-800 transition-colors"
      >
        <Building2 className="w-4 h-4 text-brand-300" />
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-brand-800 transition-colors group"
      >
        <Building2 className="w-4 h-4 text-brand-400 shrink-0" />
        <span className="flex-1 text-left text-xs font-medium text-brand-200 truncate">
          {currentBranch?.name ?? 'Sin sucursal'}
        </span>
        <ChevronDown className={`w-3 h-3 text-brand-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 bg-brand-800 rounded-xl border border-brand-700 shadow-xl z-20 overflow-hidden">
            <div className="py-1">
              {branches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => switchBranch(branch.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-brand-700 transition-colors text-left"
                >
                  <Building2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                  <span className="flex-1 text-xs text-brand-100 truncate">{branch.name}</span>
                  {branch.id === currentBranch?.id && (
                    <Check className="w-3.5 h-3.5 text-brand-300 shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-brand-700 py-1">
              <button
                onClick={() => { setOpen(false); router.push('/branches/compare') }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-brand-700 transition-colors"
              >
                <BarChart2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span className="text-xs text-brand-300">Comparativa de sucursales</span>
              </button>
              <button
                onClick={() => { setOpen(false); router.push('/branches') }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-brand-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span className="text-xs text-brand-300">Gestionar sucursales</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
