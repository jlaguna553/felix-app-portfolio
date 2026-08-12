import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { TOOL_DEFINITIONS, executeTool } from '@/lib/ai/tools'
import { getProvider } from '@/lib/ai/providers'
import type { AIConfig, ChatMessage } from '@/lib/ai/types'
import { supabaseUrl } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getAuthContext() {
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
    .from('profiles').select('role, branch_id').eq('id', user.id).single()

  if (!profile || !['admin', 'owner'].includes(profile.role)) return null

  const isOwner = profile.role === 'owner'
  const branchId = isOwner
    ? (cookieStore.get('current_branch_id')?.value ?? null)
    : profile.branch_id

  return { userId: user.id, branchId, isOwner }
}

function adminSupabase() {
  return createAdminClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function loadAIConfig(
  supabase: ReturnType<typeof adminSupabase>,
  branchId?: string | null,
): Promise<AIConfig & { businessContext: string; branchName: string }> {
  const [{ data: settingsRows }, branchRow] = await Promise.all([
    supabase
      .from('settings')
      .select('key, value')
      .in('key', ['ai_provider', 'ai_model', 'ai_claude_key', 'ai_gemini_key', 'ai_ollama_url']),
    branchId
      ? supabase
          .from('branches')
          .select('name, ai_business_context')
          .eq('id', branchId)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const cfg = Object.fromEntries((settingsRows ?? []).map(r => [r.key, r.value]))
  return {
    provider: (cfg.ai_provider ?? 'claude') as AIConfig['provider'],
    model:    cfg.ai_model ?? 'claude-sonnet-4-6',
    claudeKey:       cfg.ai_claude_key || undefined,
    geminiKey:       cfg.ai_gemini_key || undefined,
    ollamaUrl:       cfg.ai_ollama_url || undefined,
    businessContext: branchRow.data?.ai_business_context ?? '',
    branchName:      branchRow.data?.name ?? '',
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { message, conversationId } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })

  const supabase = adminSupabase()
  const config = await loadAIConfig(supabase, auth.branchId)

  // Get or create conversation
  let convId = conversationId as string | undefined
  if (!convId) {
    const title = (message as string).slice(0, 60)
    const { data: conv, error } = await supabase
      .from('ai_conversations')
      .insert({
        user_id:  auth.userId,
        title,
        provider: config.provider,
        model:    config.model,
        ...(auth.branchId ? { branch_id: auth.branchId } : {}),
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    convId = conv.id
  }

  // Load conversation history
  const { data: history } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', convId)
    .order('created_at')

  const messages: ChatMessage[] = [
    ...(history ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: message },
  ]

  // Save user message
  await supabase.from('ai_messages').insert({
    conversation_id: convId,
    role: 'user',
    content: message,
  })

  // Run the agent
  try {
    const provider = getProvider(config)
    const result = await provider.run({
      messages,
      tools: TOOL_DEFINITIONS,
      systemPrompt: buildSystemPrompt(
        new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
        config.businessContext,
        config.branchName || undefined,
      ),
      onToolCall: tc => executeTool(tc, supabase, {
        userId: auth.userId,
        branchId: auth.branchId ?? undefined,
        isOwner: auth.isOwner,
      }),
    })

    // Save assistant response
    await supabase.from('ai_messages').insert({
      conversation_id: convId,
      role: 'assistant',
      content: result.content,
      tool_calls: result.toolCalls.length ? result.toolCalls : null,
    })

    // Update conversation timestamp
    await supabase
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId)

    return NextResponse.json({
      reply: result.content,
      toolCalls: result.toolCalls,
      conversationId: convId,
    })
  } catch (err) {
    const raw = String(err)
    let friendly = 'Ocurrió un error al procesar tu mensaje. Intenta de nuevo.'

    if (raw.includes('429') || raw.toLowerCase().includes('quota') || raw.toLowerCase().includes('rate limit')) {
      friendly = 'Se alcanzó el límite de uso del proveedor de IA. Si usas Gemini gratuito, espera unos minutos o cambia de proveedor en Configuración IA. Si usas Claude, verifica tu saldo en console.anthropic.com.'
    } else if (raw.includes('401') || raw.toLowerCase().includes('api key') || raw.toLowerCase().includes('unauthorized')) {
      friendly = 'La API key no es válida o no está configurada. Revisa la configuración del proveedor de IA.'
    } else if (raw.includes('404') || raw.toLowerCase().includes('not found')) {
      friendly = 'El modelo seleccionado no existe o fue retirado. Cambia el modelo en Configuración IA.'
    } else if (raw.toLowerCase().includes('network') || raw.toLowerCase().includes('fetch')) {
      friendly = 'No se pudo conectar con el proveedor de IA. Verifica tu conexión o la URL de Ollama.'
    }

    return NextResponse.json({ error: friendly }, { status: 500 })
  }
}
