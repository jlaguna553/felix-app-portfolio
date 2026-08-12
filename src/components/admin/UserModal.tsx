'use client'

import { useState } from 'react'
import { X, Loader2, Save, Eye, EyeOff, KeyRound, ChevronDown, ChevronUp } from 'lucide-react'

interface UserRecord {
  id: string
  email: string
  profile: { full_name: string; role: 'admin' | 'waiter' | 'kitchen' | 'cashier'; pin_code: string | null } | null
}

interface Props {
  user: UserRecord | null
  branchId: string
  onClose: () => void
  onSave: () => void
}

const ROLES = [
  { value: 'waiter',   label: 'Mesero',  desc: 'Solo acceso al punto de venta' },
  { value: 'kitchen',  label: 'Cocina',  desc: 'Solo ve la pantalla de comandas' },
  { value: 'cashier',  label: 'Cajero',  desc: 'Solo acceso al módulo de caja' },
  { value: 'admin',    label: 'Admin',   desc: 'Acceso completo al sistema' },
]

export function UserModal({ user, branchId, onClose, onSave }: Props) {
  const isEdit = user !== null
  const [form, setForm] = useState({
    full_name: user?.profile?.full_name ?? '',
    email:     user?.email ?? '',
    password:  '',
    role:      user?.profile?.role ?? 'waiter',
  })
  const [showPass, setShowPass]         = useState(false)
  const [changePass, setChangePass]     = useState(false)
  const [newPassword, setNewPassword]   = useState('')
  const [showNewPass, setShowNewPass]   = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [passSuccess, setPassSuccess]   = useState(false)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.full_name.trim()) { setError('El nombre es obligatorio'); return }
    if (!isEdit && (!form.email.trim() || !form.password)) {
      setError('Email y contraseña son obligatorios'); return
    }
    if (isEdit && changePass && newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres'); return
    }
    setLoading(true)
    setError(null)

    const body = isEdit
      ? {
          userId:    user.id,
          full_name: form.full_name,
          userRole:  form.role,
          ...(changePass && newPassword ? { password: newPassword } : {}),
        }
      : { email: form.email, password: form.password, full_name: form.full_name, userRole: form.role, branchId }

    const res = await fetch('/api/users', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Error al guardar')
      setLoading(false)
      return
    }
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
          <h2 className="font-bold text-stone-800 text-lg">
            {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Ej. Juan López"
            />
          </div>

          {/* Email + password (create only) */}
          {!isEdit && (
            <>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Correo electrónico <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Change password (edit only) */}
          {isEdit && (
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => { setChangePass(p => !p); setNewPassword(''); setPassSuccess(false) }}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-stone-400" />
                  Cambiar contraseña
                </span>
                {changePass ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
              </button>

              {changePass && (
                <div className="px-4 pb-4 pt-1 border-t border-stone-100 space-y-3">
                  <p className="text-xs text-stone-400">
                    Correo: <span className="font-medium text-stone-600">{user?.email}</span>
                  </p>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setPassSuccess(false) }}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Nueva contraseña (mín. 6 caracteres)"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passSuccess && (
                    <p className="text-xs text-green-600 font-medium">Contraseña actualizada correctamente</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Rol</label>
            <div className="space-y-2">
              {ROLES.map(r => (
                <label
                  key={r.value}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    form.role === r.value
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={form.role === r.value}
                    onChange={e => set('role', e.target.value)}
                    className="accent-amber-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-stone-800">{r.label}</p>
                    <p className="text-xs text-stone-400">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-stone-100 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-semibold transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}
