import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const BRANCH_COOKIE = 'current_branch_id'

// Paths that don't need a branch cookie even for authenticated users
const BRANCH_FREE_PATHS = ['/login', '/select-branch']

// Admin-only paths (owner also allowed)
const ADMIN_ONLY_PATHS = [
  '/dashboard', '/inventory', '/products', '/recipes', '/reports',
  '/orders', '/categories', '/users', '/settings', '/corte',
  '/promotions', '/assistant', '/menu',
]

// Owner-only paths
const OWNER_ONLY_PATHS = ['/branches']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // In Docker, SUPABASE_URL is the internal Kong URL (http://kong:8000).
  // Edge runtime can't import from server.ts (uses next/headers), so we inline here.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabase = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(process.env.NEXT_PUBLIC_SUPABASE_STORAGE_KEY
        ? { auth: { storageKey: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_KEY } }
        : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // ── Unauthenticated: redirect to login ─────────────────────────────────────
  if (!user && !BRANCH_FREE_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (!user) return supabaseResponse

  // ── Authenticated: load profile (role + branch_id) ─────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'waiter'
  const isOwner = role === 'owner'
  const isAdmin = role === 'admin' || isOwner

  // ── /login redirect after auth ──────────────────────────────────────────────
  if (pathname === '/login') {
    const url = request.nextUrl.clone()
    if (isOwner)                    url.pathname = '/select-branch'
    else if (role === 'admin')      url.pathname = '/dashboard'
    else if (role === 'kitchen')    url.pathname = '/kitchen'
    else if (role === 'cashier')    url.pathname = '/caja'
    else                            url.pathname = '/pos'
    return NextResponse.redirect(url)
  }

  // ── /select-branch: only owner needs it; others get auto-redirected ─────────
  if (pathname === '/select-branch') {
    if (!isOwner) {
      const url = request.nextUrl.clone()
      url.pathname = role === 'kitchen' ? '/kitchen' : role === 'cashier' ? '/caja' : '/pos'
      return NextResponse.redirect(url)
    }
    // Owner on select-branch: allow through (clears the cookie so they can pick)
    supabaseResponse.cookies.delete(BRANCH_COOKIE)
    return supabaseResponse
  }

  // ── Branch cookie resolution ────────────────────────────────────────────────
  if (isOwner) {
    // Owner must have a branch cookie to proceed to operational routes
    const branchCookie = request.cookies.get(BRANCH_COOKIE)?.value
    if (!branchCookie && !BRANCH_FREE_PATHS.includes(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/select-branch'
      return NextResponse.redirect(url)
    }
  } else {
    // Non-owners: auto-set branch cookie from their profile
    const userBranchId = profile?.branch_id
    if (!userBranchId) {
      // User has no branch assigned — edge case, let them through with no cookie
      // (ops pages will show empty data rather than crashing)
    } else {
      supabaseResponse.cookies.set(BRANCH_COOKIE, userBranchId, {
        httpOnly: false, // readable by client JS for the sidebar display
        sameSite: 'lax',
        path: '/',
      })
    }
  }

  // ── Owner-only path guard ───────────────────────────────────────────────────
  if (OWNER_ONLY_PATHS.some(p => pathname.startsWith(p)) && !isOwner) {
    const url = request.nextUrl.clone()
    url.pathname = isAdmin ? '/dashboard' : role === 'kitchen' ? '/kitchen' : role === 'cashier' ? '/caja' : '/pos'
    return NextResponse.redirect(url)
  }

  // ── Admin-only path guard ───────────────────────────────────────────────────
  if (ADMIN_ONLY_PATHS.some(p => pathname.startsWith(p)) && !isAdmin) {
    const url = request.nextUrl.clone()
    url.pathname = role === 'kitchen' ? '/kitchen' : role === 'cashier' ? '/caja' : '/pos'
    return NextResponse.redirect(url)
  }

  // ── /caja: admin + cashier only ─────────────────────────────────────────────
  if (pathname.startsWith('/caja') && role !== 'admin' && !isOwner && role !== 'cashier') {
    const url = request.nextUrl.clone()
    url.pathname = role === 'kitchen' ? '/kitchen' : '/pos'
    return NextResponse.redirect(url)
  }

  // ── /pos: kitchen cannot access ─────────────────────────────────────────────
  if (pathname.startsWith('/pos')) {
    if (role === 'kitchen') {
      const url = request.nextUrl.clone()
      url.pathname = '/kitchen'
      return NextResponse.redirect(url)
    }
    if (role === 'cashier') {
      const url = request.nextUrl.clone()
      url.pathname = '/caja'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
