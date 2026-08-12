import { createClient, getCurrentBranchId } from '@/lib/supabase/server'
import { KitchenDisplay } from '@/components/kitchen/KitchenDisplay'
import { Order } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function KitchenPage() {
  const [supabase, branchId] = await Promise.all([createClient(), getCurrentBranchId()])

  const [{ data }, { data: { user } }] = await Promise.all([
    supabase
      .from('orders')
      .select('*, items:order_items(*, product:products(*))')
      .in('status', ['pending', 'preparing', 'ready'])
      .eq('branch_id', branchId!)
      .order('created_at', { ascending: true }),
    supabase.auth.getUser(),
  ])

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin' || profile?.role === 'owner'
  }

  return <KitchenDisplay initialOrders={(data ?? []) as Order[]} isAdmin={isAdmin} branchId={branchId!} />
}
