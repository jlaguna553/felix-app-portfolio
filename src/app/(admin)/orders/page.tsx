import { createClient, getCurrentBranchId } from '@/lib/supabase/server'
import { OrdersManager } from '@/components/admin/OrdersManager'
import { Order, Shift } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const [supabase, branchId] = await Promise.all([createClient(), getCurrentBranchId()])

  const [{ data: orders }, { data: shifts }] = await Promise.all([
    supabase
      .from('orders')
      .select('*, tab:tabs(id, label, type), items:order_items(*, product:products(*))')
      .eq('branch_id', branchId!)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('shifts')
      .select('*')
      .eq('branch_id', branchId!)
      .order('closed_at', { ascending: false })
      .limit(60),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-bold text-stone-800">Pedidos</h1>
      <OrdersManager
        initialOrders={(orders ?? []) as Order[]}
        initialShifts={(shifts ?? []) as Shift[]}
        branchId={branchId!}
      />
    </div>
  )
}
