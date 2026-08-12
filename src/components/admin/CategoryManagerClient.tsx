'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { CategoryManager } from './CategoryManager'
import { Category } from '@/lib/types'

export function CategoryManagerClient({ categories, branchId }: { categories: Category[]; branchId: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  return (
    <CategoryManager
      categories={categories}
      branchId={branchId}
      onRefresh={() => startTransition(() => router.refresh())}
    />
  )
}
