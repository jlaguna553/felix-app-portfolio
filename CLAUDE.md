@AGENTS.md
@context.md

# Felix App — Instrucciones de desarrollo

## Stack
- **Next.js 16** App Router — middleware en `src/middleware.ts` (export `middleware` + `config.matcher`)
- **Supabase** — Postgres + Auth + Realtime + Storage
- **Tailwind CSS v4** — escala de color `brand-*` definida como CSS variable en `globals.css`; tema por defecto es amber. Usar `brand-*` en lugar de colores hardcoded para UI de la app
- **Lucide React** para todos los iconos
- **html2canvas** (`^1.4.1`) — captura DOM a PNG; importar dinámicamente (`import('html2canvas')`) para evitar SSR; tipos incluidos en el paquete (no instalar `@types/html2canvas`)
- **Vercel free tier** — sin procesos long-running; todo serverless

## Estructura de rutas
```
src/app/
  (admin)/          → layout con AdminSidebar + FloatingChat; acceso controlado por middleware
    assistant/      → ChatPanel fullpage (admin + owner)
    branches/       → BranchManager CRUD (solo owner)
    branches/compare/ → BranchCompare comparativa (solo owner)
  select-branch/    → BranchSelector para owner al login (no requiere cookie de sucursal)
  (auth)/login/     → pública
  (kitchen)/        → acceso a todos los roles autenticados
  (pos)/            → mesero + admin
  api/users/        → PATCH/POST con supabase.auth.admin (service role)
  api/ai/
    chat/           → POST: envía mensaje al agente IA
    conversations/  → GET/DELETE: listar y borrar conversaciones
    conversations/[id]/ → GET: cargar mensajes de una conversación
    settings/       → GET/POST: config global (claves) + config por sucursal (contexto IA)
    initialize/     → POST: Etapa 2 — escanea negocio filtrado por sucursal, guarda en branches
```
    menu/           → MenuEditor canvas A4 (admin + owner)

## Acceso por rol
| Ruta | owner | admin | waiter | kitchen | cashier |
|------|-------|-------|--------|---------|---------|
| /dashboard /products /categories /inventory /recipes /reports /orders /promotions /users /settings /corte /assistant | ✓ | ✓ | — | — | — |
| /menu | ✓ | ✓ | — | — | — |
| /branches /branches/compare | ✓ | — | — | — | — |
| /caja | ✓ | ✓ | — | — | ✓ |
| /floor | ✓ | ✓ | ✓ | ✓ | ✓ |
| /pos | ✓ | ✓ | ✓ | — | — |
| /kitchen | ✓ | ✓ | ✓ | ✓ | ✓ |
| /select-branch | ✓ | — | — | — | — |

Restricciones implementadas en `src/lib/supabase/middleware.ts`.

## Patrones clave

### Server vs Client
- Los `page.tsx` bajo `(admin)/` son Server Components: hacen el fetch inicial y pasan `initialData` como props
- Los componentes `*Manager`, `*Module`, `FloorPlan` son Client Components (`'use client'`) y manejan realtime + interacción
- Siempre añadir `export const dynamic = 'force-dynamic'` en pages que leen datos frescos

### Supabase
- Cliente browser: `import { createClient } from '@/lib/supabase/client'`
- Cliente servidor: `import { createClient } from '@/lib/supabase/server'`
- Realtime: suscribirse en `useEffect`, retornar `supabase.removeChannel(channel)` en cleanup
- `tabs.opened_by` y `shifts.opened_by` referencian `auth.users` (mismo UUID que `profiles.id`); PostgREST no puede hacer join directo — usar patrón de dos queries: recoger IDs → fetch profiles

### Multi-sucursal — contexto de branch
- Cookie `current_branch_id` transmite la sucursal activa en cada request
- Helper `getCurrentBranchId()` en `src/lib/supabase/server.ts` lee la cookie desde Server Components
- Todos los server `page.tsx` llaman `getCurrentBranchId()` y filtran con `.eq('branch_id', branchId!)`
- Todos los client components reciben `branchId: string` como prop y filtran sus queries y tags sus inserts
- Middleware: non-owner → set cookie automático desde `profiles.branch_id`; owner sin cookie → redirect a `/select-branch`
- Funciones helper en DB: `is_owner()`, `get_user_branch_id()` (SECURITY DEFINER)

### RLS
- `is_admin()`, `is_cashier()`, `is_owner()` son funciones SECURITY DEFINER disponibles en policies
- Políticas de aislamiento de sucursal: `is_owner() OR branch_id = get_user_branch_id()` en todas las tablas operativas
- Todas las tablas nuevas necesitan `enable row level security` + policies explícitas

### API route de usuarios
`src/app/api/users/route.ts` usa `supabase.auth.admin` con service role key. Acepta `admin` y `owner`.
- POST: crea usuario en auth + insert en profiles; acepta `branchId` para asignar sucursal
- PATCH: actualiza full_name, role; opcionalmente cambia password si se envía campo `password`

### API routes del agente IA
Las rutas `api/ai/*` requieren rol `admin` o `owner` (verificado por `getAuthContext()`).
- Usan `adminSupabase()` (service role) para leer/escribir sin restricciones RLS — **pero filtran por branchId manualmente**
- `api/ai/chat`: lee `current_branch_id` cookie; pasa `branchId` + `isOwner` a `executeTool()`; inyecta nombre de sucursal en system prompt
- `api/ai/initialize`: filtra todas las queries por `branchId`; guarda contexto en `branches.ai_business_context`
- `api/ai/settings`: claves AI (global) en `settings`; contexto de negocio por sucursal en `branches`

### Agente IA — convenciones críticas
- `open_tab` con tipo `table`: `label` es el NÚMERO de mesa como string (`"1"`, no `"Mesa 1"`)
- `get_shift_status` con turno abierto: suma `orders.total_amount where status='paid'` — el campo `total_revenue` solo se escribe al cerrar
- Todas las tools filtran por `branchId` del contexto — el supabase service role bypasses RLS, por eso es obligatorio el filtro manual
- Owner puede usar `get_branches` y `compare_branch_sales` — esas tools NO filtran por sucursal
- Modelos Gemini gratuitos confirmados: `gemini-2.0-flash-lite`, `gemini-1.5-flash-8b`; evitar `gemini-2.0-flash` (cuota baja en free tier)
- Ollama: solo modelos con soporte real de function calling (llama3.1+, NOT qwen2.5 ni modelos pequeños)

### Layout fullscreen para páginas de chat
`main` en AdminLayout tiene `overflow-y-auto relative`. Las páginas que necesitan llenar toda la altura (como `/assistant`) usan `absolute inset-0` en su wrapper para evitar el bug de `h-full` en contenedores `overflow-y-auto` en WebKit.

### Impresión Bluetooth BLE — convenciones críticas
- **Web Bluetooth = BLE GATT únicamente.** No puede acceder a Classic Bluetooth SPP (que usan las apps nativas de Android).
- Detección de plataforma: `isAndroid()` via `navigator.userAgent` en `bluetooth-printer.ts`
- **Chunks Android = 20 bytes** (MTU default BLE = 23 bytes). No usar 100 bytes en Android.
- **Delay pre-connect Android = 1,500 ms** después de `requestDevice()` + pairing (bond settle). Sin este delay → "Connection attempt failed".
- `TicketPreview.onConfirm` es **opcional** — omitirlo activa modo solo-imprimir (sin botón Cobrar).
- Llamar `invalidateTicketSettings()` **siempre** después de guardar en `SettingsPage` para que el próximo ticket use datos frescos.
- Acceder a `navigator.bluetooth` solo en cliente: usar `useState<boolean | null>(null)` + `useEffect` para evitar hydration mismatch SSR.
- El botón Imprimir en `Cart` (mostrador) construye `order_number: 0` para el pedido en curso del carrito — renderizado como "Pedido en curso" en `buildReceiptBytes`.

## Convenciones de UI
- Sidebar: fondo `brand-900`, texto `brand-100/200`
- Botones primarios: `bg-brand-700 hover:bg-brand-600 text-white`
- Botones destructivos: `text-red-600 border-red-200 hover:bg-red-50`
- Modales: `flex flex-col max-h-[90vh] overflow-y-auto` para evitar overflow en PC
- Siempre `shrink-0` en elementos del sidebar
- FloatingChat: fullscreen en mobile/tablet (`< lg:1024px`), popup 384×520px en desktop

## No hacer
- No mockear Supabase en tests
- No guardar el ID del abridor en `closed_by` (bug histórico corregido en migration 017)
- No añadir rutas admin-only sin actualizar el middleware
- No hardcodear el modelo en los proveedores IA — siempre usar `this.model` del constructor
- No exponer `String(err)` de APIs externas al frontend — traducir a mensajes amigables
- No olvidar `branch_id` en inserts cuando el cliente usa service role (RLS no lo aplica automáticamente)
- No leer `settings` para datos de negocio por sucursal — esos van en la tabla `branches`
- No añadir rutas owner-only sin actualizar middleware (`OWNER_ONLY_PATHS`) y la tabla de acceso
- No leer `navigator.bluetooth` en render time (SSR undefined) — siempre en `useEffect`
- No enviar chunks BLE > 20 bytes en Android — el MTU default es 23 bytes (20 usables)
- No llamar `device.gatt.connect()` inmediatamente tras `requestDevice()` en Android — esperar 1,500 ms para bond settle
- No usar `window.open()` después de `await` — perderás el gesto del usuario en iOS/Android; el PDF debe abrirse sincrónicamente o en botón separado
- No instalar `@types/html2canvas` — `html2canvas@1.4.1` ya incluye sus propios tipos y el paquete `@types` colisiona con ellos
- No calcular coordenadas del canvas con `e.clientX - containerRect.left` directamente cuando el canvas usa `transform: scale()` — siempre dividir entre el factor de escala: `x = (e.clientX - canvasRect.left) / scale`
- No omitir `print-color-adjust: exact` al exportar HTML a PDF — sin esta propiedad los navegadores descartan `background-color` e imágenes de fondo en la vista de impresión
