import { getCurrentBranchId } from '@/lib/supabase/server'
import { CorteCaja } from '@/components/admin/CorteCaja'

export const dynamic = 'force-dynamic'

export default async function CortePage() {
  const branchId = await getCurrentBranchId()
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-bold text-stone-800">Corte de caja</h1>
      <CorteCaja branchId={branchId!} />
    </div>
  )
}
