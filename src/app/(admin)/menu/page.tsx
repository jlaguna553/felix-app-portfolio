import { createClient, getCurrentBranchId } from '@/lib/supabase/server'
import { MenuEditor } from '@/components/admin/MenuEditor'
import type { Menu, MenuElement, Product, Category } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function MenuPage() {
  const [supabase, branchId] = await Promise.all([createClient(), getCurrentBranchId()])

  const [
    { data: menus },
    { data: products },
    { data: categories },
  ] = await Promise.all([
    supabase
      .from('menus')
      .select('*')
      .eq('branch_id', branchId!)
      .order('created_at'),
    supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('branch_id', branchId!)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('categories')
      .select('*')
      .eq('branch_id', branchId!)
      .order('sort_order'),
  ])

  const initialMenu = menus?.[0] ?? null

  let initialElements: MenuElement[] = []
  if (initialMenu) {
    const { data: elements } = await supabase
      .from('menu_elements')
      .select('*')
      .eq('menu_id', initialMenu.id)
      .order('z_index')
    initialElements = (elements as MenuElement[]) ?? []
  }

  return (
    <MenuEditor
      branchId={branchId!}
      menus={(menus as Menu[]) ?? []}
      initialMenu={initialMenu as Menu | null}
      initialElements={initialElements}
      products={(products as Product[]) ?? []}
      categories={(categories as Category[]) ?? []}
    />
  )
}
