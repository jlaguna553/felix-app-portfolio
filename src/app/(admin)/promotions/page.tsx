import { createClient, getCurrentBranchId } from '@/lib/supabase/server'
import { PromotionsManager } from '@/components/admin/PromotionsManager'
import { Promotion, Product } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function PromotionsPage() {
  const [supabase, branchId] = await Promise.all([createClient(), getCurrentBranchId()])

  const [{ data: promotions }, { data: products }] = await Promise.all([
    supabase
      .from('promotions')
      .select('*, items:promotion_items(*, product:products(*))')
      .eq('branch_id', branchId!)
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id, name, sale_price')
      .eq('is_active', true)
      .eq('branch_id', branchId!)
      .order('name'),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-bold text-stone-800">Promociones</h1>
      <PromotionsManager
        promotions={(promotions ?? []) as Promotion[]}
        products={(products ?? []) as Pick<Product, 'id' | 'name' | 'sale_price'>[]}
        branchId={branchId!}
      />
    </div>
  )
}
