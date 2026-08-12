import { createClient, getCurrentBranchId } from '@/lib/supabase/server'
import { CategoryManagerClient } from '@/components/admin/CategoryManagerClient'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const [supabase, branchId] = await Promise.all([createClient(), getCurrentBranchId()])

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('branch_id', branchId!)
    .order('sort_order')

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-stone-200 px-6 py-4">
        <h1 className="text-xl font-bold text-stone-800">Categorías</h1>
        <p className="text-sm text-stone-400">Organiza los productos del menú por categoría</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <CategoryManagerClient categories={categories ?? []} branchId={branchId!} />
      </div>
    </div>
  )
}
