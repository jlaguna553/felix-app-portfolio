import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseUrl } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const GLOBAL_KEYS = ['ai_provider', 'ai_model', 'ai_claude_key', 'ai_gemini_key', 'ai_ollama_url']

async function requireAdminOrOwner() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'owner'].includes(profile.role)) return null
  const branchId = cookieStore.get('current_branch_id')?.value ?? null
  return { role: profile.role, branchId }
}

function serviceClient() {
  return createAdminClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const auth = await requireAdminOrOwner()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const sc = serviceClient()
  const [{ data: settingsRows }, branchRow] = await Promise.all([
    sc.from('settings').select('key, value').in('key', GLOBAL_KEYS),
    auth.branchId
      ? sc.from('branches').select('name, business_name, business_type, business_description, ai_business_context, ai_last_trained_at').eq('id', auth.branchId).single()
      : Promise.resolve({ data: null }),
  ])

  const cfg = Object.fromEntries((settingsRows ?? []).map(r => [r.key, r.value]))
  const branch = branchRow.data

  return NextResponse.json({
    provider:     cfg.ai_provider   ?? 'claude',
    model:        cfg.ai_model      ?? 'claude-sonnet-4-6',
    ollamaUrl:    cfg.ai_ollama_url ?? 'http://localhost:11434',
    hasClaudeKey: !!(cfg.ai_claude_key),
    hasGeminiKey: !!(cfg.ai_gemini_key),
    businessName:        branch?.business_name        ?? '',
    businessType:        branch?.business_type        ?? '',
    businessDescription: branch?.business_description ?? '',
    businessContext:     branch?.ai_business_context  ?? '',
    lastTrainedAt:       branch?.ai_last_trained_at   ?? '',
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminOrOwner()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()
  const supabase = serviceClient()

  // Global settings (AI provider/keys)
  const globalUpdates: Record<string, string> = {}
  if (body.provider  !== undefined) globalUpdates.ai_provider  = body.provider
  if (body.model     !== undefined) globalUpdates.ai_model     = body.model
  if (body.ollamaUrl !== undefined) globalUpdates.ai_ollama_url = body.ollamaUrl
  if (body.claudeKey !== undefined) globalUpdates.ai_claude_key = body.claudeKey
  if (body.geminiKey !== undefined) globalUpdates.ai_gemini_key = body.geminiKey

  for (const [key, value] of Object.entries(globalUpdates)) {
    await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' })
  }

  // Per-branch settings
  if (auth.branchId) {
    const branchUpdates: Record<string, string> = {}
    if (body.businessName        !== undefined) branchUpdates.business_name        = body.businessName
    if (body.businessType        !== undefined) branchUpdates.business_type        = body.businessType
    if (body.businessDescription !== undefined) branchUpdates.business_description = body.businessDescription
    if (body.businessContext     !== undefined) branchUpdates.ai_business_context  = body.businessContext

    if (Object.keys(branchUpdates).length > 0) {
      await supabase.from('branches').update(branchUpdates).eq('id', auth.branchId)
    }
  }

  return NextResponse.json({ ok: true })
}
