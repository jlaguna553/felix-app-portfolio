import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { AdminLayout } from '@/components/admin/AdminLayout'
import type { UserRole, Branch } from '@/lib/types'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role: UserRole = 'admin'
  let currentBranch: Branch | null = null
  let branches: Branch[] = []

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, branch_id')
      .eq('id', user.id)
      .single()

    if (profile?.role) role = profile.role as UserRole

    const isOwner = role === 'owner'

    if (isOwner) {
      // Owner: load all active branches + resolve current from cookie
      const cookieStore = await cookies()
      const currentBranchId = cookieStore.get('current_branch_id')?.value

      const { data: allBranches } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('created_at')

      branches = (allBranches ?? []) as Branch[]
      currentBranch = branches.find(b => b.id === currentBranchId) ?? branches[0] ?? null
    } else if (profile?.branch_id) {
      // Non-owner: load their assigned branch
      const { data: branch } = await supabase
        .from('branches')
        .select('*')
        .eq('id', profile.branch_id)
        .single()

      currentBranch = branch as Branch | null
    }
  }

  return (
    <AdminLayout role={role} currentBranch={currentBranch} branches={branches}>
      {children}
    </AdminLayout>
  )
}
