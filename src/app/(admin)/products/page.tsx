import { createClient, getCurrentBranchId } from '@/lib/supabase/server'
import { ProductsManager } from '@/components/admin/ProductsManager'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const [supabase, branchId] = await Promise.all([createClient(), getCurrentBranchId()])

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products').select('*, category:categories(*)').eq('branch_id', branchId!).order('name'),
    supabase.from('categories').select('*').eq('branch_id', branchId!).order('sort_order'),
  ])

  return <ProductsManager products={products ?? []} categories={categories ?? []} branchId={branchId!} />
}
