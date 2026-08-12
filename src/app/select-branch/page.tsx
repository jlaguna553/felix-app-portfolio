import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BranchSelector } from '@/components/admin/BranchSelector'
import type { Branch } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function SelectBranchPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'owner') {
    redirect('/dashboard')
  }

  const { data: branches } = await supabase
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('created_at')

  return (
    <BranchSelector branches={(branches ?? []) as Branch[]} />
  )
}
