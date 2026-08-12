import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseUrl } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
  return { branchId }
}

function serviceClient() {
  return createAdminClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST() {
  const auth = await requireAdminOrOwner()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = serviceClient() as any
  const branchId = auth.branchId

  // Load branch identity
  const branch = branchId
    ? (await supabase.from('branches').select('name, business_name, business_type, business_description').eq('id', branchId).single()).data
    : null

  // Build filtered queries
  function addBranch(q: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return branchId ? (q as any).eq('branch_id', branchId) : q
  }

  const [
    { data: categories },
    { data: products },
    { data: tables },
    { data: shifts },
    { data: users },
    { data: promotions },
    { data: supplies },
  ] = await Promise.all([
    addBranch(supabase.from('categories').select('id, name, emoji').order('sort_order')),
    addBranch(supabase.from('products').select('name, sale_price, category_id, is_active').order('name')),
    addBranch(supabase.from('tables').select('id, number').order('number')),
    addBranch(supabase.from('shifts').select('id, status').limit(5)),
    supabase.from('profiles').select('full_name, role').order('role'),
    addBranch(supabase.from('promotions').select('name, discount_type, discount_value, is_active, pool_quantity').order('name')),
    addBranch(supabase.from('supplies').select('name, current_stock, min_stock, unit').order('name')),
  ])

  const bizName = branch?.business_name || branch?.name || 'el restaurante'
  const bizType = branch?.business_type || ''
  const bizDesc = branch?.business_description || ''

  const categoryMap = Object.fromEntries(((categories ?? []) as { id: string; name: string; emoji: string }[]).map(c => [c.id, c]))
  const byCategory: Record<string, { emoji: string; items: Array<{ name: string; price: number }> }> = {}

  for (const p of (products ?? []) as { name: string; sale_price: number; category_id: string; is_active: boolean }[]) {
    if (!p.is_active) continue
    const cat = categoryMap[p.category_id]
    const catKey = cat?.name ?? 'Sin categoría'
    if (!byCategory[catKey]) byCategory[catKey] = { emoji: cat?.emoji ?? '', items: [] }
    byCategory[catKey].items.push({ name: p.name, price: p.sale_price })
  }

  const ROLE_LABELS: Record<string, string> = {
    admin: 'administradores', waiter: 'meseros', kitchen: 'cocina', cashier: 'cajeros', owner: 'propietarios',
  }
  const byRole: Record<string, string[]> = {}
  for (const u of (users ?? []) as { full_name: string; role: string }[]) {
    const label = ROLE_LABELS[u.role] ?? u.role
    if (!byRole[label]) byRole[label] = []
    byRole[label].push(u.full_name)
  }

  const lowStock = ((supplies ?? []) as { name: string; current_stock: number; min_stock: number }[])
    .filter(s => s.current_stock < s.min_stock)

  const lines: string[] = []
  lines.push(`**${bizName}**${bizType ? ` — ${bizType}` : ''}`)
  if (bizDesc) lines.push(bizDesc)
  lines.push('')

  const tableCount = (tables ?? []).length
  lines.push(`**Mesas registradas:** ${tableCount}${tableCount ? ` (mesas ${(tables as { number: number }[] ?? []).map(t => t.number).join(', ')})` : ''}`)

  if (Object.keys(byRole).length > 0) {
    const teamParts = Object.entries(byRole).map(([role, names]) => `${names.join(', ')} (${role})`)
    lines.push(`**Equipo:** ${teamParts.join(' | ')}`)
  }

  if ((shifts ?? []).length === 0) {
    lines.push('*(Sistema recién configurado — aún no hay turnos registrados)*')
  }

  lines.push('')
  lines.push('**Menú completo:**')
  for (const [catName, { emoji, items }] of Object.entries(byCategory)) {
    lines.push(`\n${emoji} **${catName}** (${items.length} productos):`)
    for (const item of items) {
      lines.push(`  - ${item.name}: $${item.price}`)
    }
  }

  const inactiveCount = ((products ?? []) as { is_active: boolean }[]).filter(p => !p.is_active).length
  if (inactiveCount > 0) lines.push(`\n*(${inactiveCount} productos inactivos no mostrados)*`)

  const activePromos = ((promotions ?? []) as { name: string; discount_type: string; discount_value: number; is_active: boolean; pool_quantity: number | null }[])
    .filter(p => p.is_active)
  if (activePromos.length > 0) {
    lines.push('')
    lines.push('**Promociones activas:**')
    for (const promo of activePromos) {
      const discount = promo.discount_type === 'percent'
        ? `${promo.discount_value}% de descuento`
        : `$${promo.discount_value} de descuento`
      const poolNote = promo.pool_quantity ? ` (cada ${promo.pool_quantity} artículos del grupo)` : ''
      lines.push(`  - ${promo.name}: ${discount}${poolNote}`)
    }
  }

  if (lowStock.length > 0) {
    lines.push('')
    lines.push(`**Ingredientes con stock bajo:** ${lowStock.map(s => s.name).join(', ')}`)
  }

  const trainedAt = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
  lines.push('')
  lines.push(`*(Entrenamiento actualizado: ${trainedAt})*`)

  const context = lines.join('\n')
  const now = new Date().toISOString()

  if (branchId) {
    await supabase.from('branches').update({ ai_business_context: context, ai_last_trained_at: now }).eq('id', branchId)
  } else {
    await supabase.from('settings').upsert({ key: 'ai_business_context', value: context }, { onConflict: 'key' })
    await supabase.from('settings').upsert({ key: 'ai_last_trained_at', value: now }, { onConflict: 'key' })
  }

  return NextResponse.json({ context })
}
