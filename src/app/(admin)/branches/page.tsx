import { createClient, getCurrentBranchId } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BranchManager } from '@/components/admin/BranchManager'

export const dynamic = 'force-dynamic'

export default async function BranchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'owner') redirect('/dashboard')

  const { data: branches } = await supabase
    .from('branches')
    .select('*')
    .order('created_at')

  return <BranchManager branches={branches ?? []} />
}
