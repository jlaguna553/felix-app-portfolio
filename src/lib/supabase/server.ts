import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// In Docker, SUPABASE_URL points to the internal Kong container (http://kong:8000).
// In cloud deployments, it's unset and falls back to the public URL.
export const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!

export async function getCurrentBranchId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('current_branch_id')?.value ?? null
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(process.env.NEXT_PUBLIC_SUPABASE_STORAGE_KEY
        ? { auth: { storageKey: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_KEY } }
        : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — middleware handles session refresh
          }
        },
      },
    }
  )
}
