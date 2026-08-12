import { getCurrentBranchId } from '@/lib/supabase/server'
import { CajaModule } from '@/components/admin/CajaModule'

export const dynamic = 'force-dynamic'

export default async function CajaPage() {
  const branchId = await getCurrentBranchId()
  return <CajaModule branchId={branchId!} />
}
