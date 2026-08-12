import { createClient, getCurrentBranchId } from '@/lib/supabase/server'
import { RecipesManager } from '@/components/admin/RecipesManager'

export const dynamic = 'force-dynamic'

export default async function RecipesPage() {
  const [supabase, branchId] = await Promise.all([createClient(), getCurrentBranchId()])

  const [{ data: products }, { data: supplies }] = await Promise.all([
    supabase.from('products').select('id, name').eq('is_active', true).eq('branch_id', branchId!).order('name'),
    supabase.from('supplies').select('*').eq('branch_id', branchId!).order('name'),
  ])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-stone-800">Recetas (Explosión de insumos)</h1>
      <RecipesManager products={products ?? []} supplies={supplies ?? []} branchId={branchId!} />
    </div>
  )
}
