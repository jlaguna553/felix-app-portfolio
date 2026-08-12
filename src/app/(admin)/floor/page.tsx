import { createClient, getCurrentBranchId } from '@/lib/supabase/server'
import { FloorPlan } from '@/components/admin/FloorPlan'

export const dynamic = 'force-dynamic'

export default async function FloorPage() {
  const supabase = await createClient()
  const [branchId, { data: { user } }] = await Promise.all([
    getCurrentBranchId(),
    supabase.auth.getUser(),
  ])

  let canManage = false
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    canManage = profile?.role === 'admin' || profile?.role === 'owner' || profile?.role === 'waiter'
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 h-full">
      <h1 className="text-2xl font-bold text-stone-800 shrink-0">Salón</h1>
      <div className="flex-1 min-h-0">
        <FloorPlan canManage={canManage} branchId={branchId!} />
      </div>
    </div>
  )
}
