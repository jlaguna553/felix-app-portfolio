import { getCurrentBranchId } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/admin/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const branchId = await getCurrentBranchId()
  return <DashboardClient branchId={branchId!} />
}
