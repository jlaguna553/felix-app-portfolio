'use client'

import { useRouter } from 'next/navigation'
import { Building2, MapPin, Phone, Plus } from 'lucide-react'
import type { Branch } from '@/lib/types'

interface Props {
  branches: Branch[]
}

export function BranchSelector({ branches }: Props) {
  const router = useRouter()

  function selectBranch(id: string) {
    document.cookie = `current_branch_id=${id}; path=/; samesite=lax`
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-brand-700" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Selecciona una sucursal</h1>
          <p className="text-stone-500 mt-1">¿Desde qué sucursal vas a trabajar hoy?</p>
        </div>

        {branches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
            <Building2 className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 font-medium">No hay sucursales registradas</p>
            <p className="text-stone-400 text-sm mt-1">Crea tu primera sucursal para empezar</p>
            <button
              onClick={() => router.push('/branches')}
              className="mt-4 inline-flex items-center gap-2 bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva sucursal
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {branches.map(branch => (
              <button
                key={branch.id}
                onClick={() => selectBranch(branch.id)}
                className="bg-white rounded-2xl border border-stone-200 hover:border-brand-400 hover:shadow-md p-5 text-left transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 bg-brand-50 group-hover:bg-brand-100 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                    <Building2 className="w-5 h-5 text-brand-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-900 group-hover:text-brand-700 transition-colors">
                      {branch.name}
                    </p>
                    {branch.business_name && branch.business_name !== branch.name && (
                      <p className="text-sm text-stone-500">{branch.business_name}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                      {branch.address && (
                        <span className="flex items-center gap-1 text-xs text-stone-400">
                          <MapPin className="w-3 h-3" />
                          {branch.address}
                        </span>
                      )}
                      {branch.phone && (
                        <span className="flex items-center gap-1 text-xs text-stone-400">
                          <Phone className="w-3 h-3" />
                          {branch.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-brand-400 group-hover:text-brand-600 transition-colors text-sm font-medium shrink-0">
                    Entrar →
                  </div>
                </div>
              </button>
            ))}

            <button
              onClick={() => router.push('/branches')}
              className="bg-white rounded-2xl border border-dashed border-stone-300 hover:border-brand-300 p-5 text-center transition-all group"
            >
              <div className="flex items-center justify-center gap-2 text-stone-400 group-hover:text-brand-600 transition-colors">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Administrar sucursales</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
