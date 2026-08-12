import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseUrl } from '@/lib/supabase/server'

async function getRequestingUserRole() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  return profile?.role ?? null
}

function isAdminOrOwner(role: string | null) {
  return role === 'admin' || role === 'owner'
}

function adminClient() {
  return createAdminClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET — list all users
export async function GET() {
  const role = await getRequestingUserRole()
  if (!isAdminOrOwner(role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const supabase = adminClient()
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profiles } = await supabase.from('profiles').select('*')
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const users = data.users.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    profile: profileMap[u.id] ?? null,
  }))

  return NextResponse.json({ users })
}

// POST — create user
export async function POST(req: NextRequest) {
  const role = await getRequestingUserRole()
  if (!isAdminOrOwner(role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { email, password, full_name, userRole, branchId } = await req.json()
  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Email, contraseña y nombre son requeridos' }, { status: 400 })
  }

  const supabase = adminClient()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: userRole ?? 'waiter' },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Ensure profile exists (trigger may have already created it)
  await supabase.from('profiles').upsert({
    id: data.user.id,
    full_name,
    role: userRole ?? 'waiter',
    ...(branchId ? { branch_id: branchId } : {}),
  })

  return NextResponse.json({ user: data.user }, { status: 201 })
}

// PATCH — update user role / name / password
export async function PATCH(req: NextRequest) {
  const role = await getRequestingUserRole()
  if (!isAdminOrOwner(role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { userId, full_name, userRole, password } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const supabase = adminClient()

  if (password) {
    if (password.length < 6) return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    const { error: passErr } = await supabase.auth.admin.updateUserById(userId, { password })
    if (passErr) return NextResponse.json({ error: passErr.message }, { status: 500 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name, role: userRole })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — delete user
export async function DELETE(req: NextRequest) {
  const role = await getRequestingUserRole()
  if (!isAdminOrOwner(role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const supabase = adminClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
