import { createClient, getCurrentBranchId } from '@/lib/supabase/server'
import { POSScreen } from '@/components/pos/POSScreen'
import { Promotion } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function POSPage({
  searchParams,
}: {
  searchParams: Promise<{ tabId?: string }>
}) {
  const [supabase, branchId, params] = await Promise.all([
    createClient(),
    getCurrentBranchId(),
    searchParams,
  ])

  const [
    { data: products },
    { data: categories },
    { data: promotions },
    { data: { user } },
  ] = await Promise.all([
    supabase.from('products').select('*, category:categories(*)').eq('is_active', true).eq('branch_id', branchId!).order('name'),
    supabase.from('categories').select('*').eq('branch_id', branchId!).order('sort_order'),
    supabase
      .from('promotions')
      .select('*, items:promotion_items(*, product:products(id, name, sale_price))')
      .eq('is_active', true)
      .eq('branch_id', branchId!),
    supabase.auth.getUser(),
  ])

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    isAdmin = profile?.role === 'admin' || profile?.role === 'owner'
  }

  return (
    <POSScreen
      products={products ?? []}
      categories={categories ?? []}
      promotions={(promotions ?? []) as Promotion[]}
      isAdmin={isAdmin}
      autoTabId={params.tabId}
      branchId={branchId!}
    />
  )
}
