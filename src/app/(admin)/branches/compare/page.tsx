import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BranchCompare } from '@/components/admin/BranchCompare'

export const dynamic = 'force-dynamic'

export default async function BranchComparePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'owner') redirect('/dashboard')

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name')

  return <BranchCompare branches={branches ?? []} />
}
