import { getCurrentBranchId } from '@/lib/supabase/server'
import { UsersManager } from '@/components/admin/UsersManager'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const branchId = await getCurrentBranchId()
  return <UsersManager branchId={branchId!} />
}
