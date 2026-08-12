import { createClient, getCurrentBranchId } from '@/lib/supabase/server'
import { InventoryTable } from '@/components/admin/InventoryTable'

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  const [supabase, branchId] = await Promise.all([createClient(), getCurrentBranchId()])

  const { data: supplies } = await supabase
    .from('supplies')
    .select('*')
    .eq('branch_id', branchId!)
    .order('name')

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-stone-800">Inventario</h1>
      <InventoryTable supplies={supplies ?? []} branchId={branchId!} />
    </div>
  )
}
