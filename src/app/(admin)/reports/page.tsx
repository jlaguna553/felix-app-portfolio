import { createClient, getCurrentBranchId } from '@/lib/supabase/server'
import { SalesReport } from '@/components/admin/SalesReport'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const [supabase, branchId] = await Promise.all([createClient(), getCurrentBranchId()])

  const { data: orders } = await supabase
    .from('orders')
    .select('*, profile:profiles(full_name), items:order_items(*, product:products(name, sale_price))')
    .eq('status', 'paid')
    .eq('branch_id', branchId!)
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: margins } = await supabase
    .from('product_margins')
    .select('*')
    .order('margin_percent', { ascending: false })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Reportes</h1>
      <SalesReport orders={orders ?? []} margins={margins ?? []} />
    </div>
  )
}
