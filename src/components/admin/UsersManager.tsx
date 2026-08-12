'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserPlus, Pencil, Trash2, Check, X, Loader2, ShieldCheck, UtensilsCrossed, ChefHat, RefreshCw, Wallet } from 'lucide-react'
import { UserModal } from './UserModal'

interface UserRecord {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  profile: {
    full_name: string
    role: 'admin' | 'waiter' | 'kitchen' | 'cashier'
    pin_code: string | null
  } | null
}

const ROLE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  owner:   { label: 'Propietario', icon: ShieldCheck,     color: 'bg-purple-100 text-purple-700' },
  admin:   { label: 'Admin',       icon: ShieldCheck,     color: 'bg-amber-100 text-amber-700'   },
  waiter:  { label: 'Mesero',      icon: UtensilsCrossed, color: 'bg-blue-100 text-blue-700'     },
  kitchen: { label: 'Cocina',      icon: ChefHat,         color: 'bg-green-100 text-green-700'   },
  cashier: { label: 'Cajero',      icon: Wallet,          color: 'bg-orange-100 text-orange-700' },
}

export function UsersManager({ branchId }: { branchId: string }) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; user: UserRecord | null }>({ open: false, user: null })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/users')
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users)
    } else {
      setError('No se pudieron cargar los usuarios')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function handleDelete(userId: string) {
    setDeleting(userId)
    const res = await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== userId))
    }
    setDeleting(null)
    setConfirmDelete(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800">Usuarios</h1>
          <p className="text-sm text-stone-400">{users.length} usuarios registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setModal({ open: true, user: null })}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo usuario
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-stone-500 uppercase text-xs">
                  <tr>
                    {['Usuario', 'Correo', 'Rol', 'Último acceso', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {users.map(u => {
                    const roleInfo = ROLE_LABELS[u.profile?.role ?? 'waiter']
                    const RoleIcon = roleInfo.icon
                    return (
                      <tr key={u.id} className="hover:bg-stone-50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0">
                              {(u.profile?.full_name ?? u.email ?? '?')[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-stone-800">
                              {u.profile?.full_name ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-stone-500">{u.email}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
                            <RoleIcon className="w-3 h-3" />
                            {roleInfo.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-stone-400 text-xs">
                          {u.last_sign_in_at
                            ? new Date(u.last_sign_in_at).toLocaleString('es-MX')
                            : 'Nunca'}
                        </td>
                        <td className="px-5 py-3">
                          {confirmDelete === u.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-stone-500">¿Eliminar?</span>
                              <button
                                onClick={() => handleDelete(u.id)}
                                disabled={!!deleting}
                                className="text-xs text-red-600 font-semibold hover:underline disabled:opacity-50"
                              >
                                {deleting === u.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Sí'}
                              </button>
                              <button onClick={() => setConfirmDelete(null)} className="text-xs text-stone-400 hover:underline">
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setModal({ open: true, user: u })}
                                className="text-stone-400 hover:text-amber-600 transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setConfirmDelete(u.id)}
                                className="text-stone-400 hover:text-red-500 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-stone-100">
              {users.map(u => {
                const roleInfo = ROLE_LABELS[u.profile?.role ?? 'waiter']
                const RoleIcon = roleInfo.icon
                return (
                  <div key={u.id} className="px-4 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold shrink-0">
                      {(u.profile?.full_name ?? u.email ?? '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-800 truncate">{u.profile?.full_name ?? '—'}</p>
                      <p className="text-xs text-stone-400 truncate">{u.email}</p>
                      <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>
                        <RoleIcon className="w-3 h-3" />
                        {roleInfo.label}
                      </span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setModal({ open: true, user: u })} className="text-stone-400 hover:text-amber-600">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDelete(confirmDelete === u.id ? null : u.id)} className="text-stone-400 hover:text-red-500">
                        {confirmDelete === u.id
                          ? <Check className="w-4 h-4 text-red-500" onClick={(e) => { e.stopPropagation(); handleDelete(u.id) }} />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {modal.open && (
        <UserModal
          user={modal.user}
          branchId={branchId}
          onClose={() => setModal({ open: false, user: null })}
          onSave={() => {
            setModal({ open: false, user: null })
            fetchUsers()
          }}
        />
      )}
    </div>
  )
}
