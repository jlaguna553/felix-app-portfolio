import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseUrl } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getAdminUserId() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user.id : null
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAdminUserId()
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const supabase = createAdminClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify ownership
  const { data: conv } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!conv) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const { data: messages, error } = await supabase
    .from('ai_messages')
    .select('id, role, content, tool_calls, created_at')
    .eq('conversation_id', id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages })
}
