import { createBrowserClient } from '@supabase/ssr'

// In Docker, NEXT_PUBLIC_SUPABASE_STORAGE_KEY is set to fix the cookie name mismatch
// between browser (localhost:8000) and server (kong:8000). In production it's unset
// so we don't pass auth options at all — keeps existing Vercel sessions intact.
const _storageKey = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_KEY

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    _storageKey ? { auth: { storageKey: _storageKey } } : {}
  )
}
