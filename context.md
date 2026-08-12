# Contexto del proyecto: Gorditas Doña Félix

## Descripción
Sistema POS + ERP multi-sucursal para una taquería/gorditas. Los roles operan en pantallas independientes:
- **Owner (propietario)** → acceso completo a todas las sucursales; gestiona sucursales, compara ventas, cambia de sucursal activa
- **Admin** → panel completo de su sucursal asignada (productos, inventario, reportes, caja, salón, usuarios, asistente IA)
- **Mesero (waiter)** → POS para tomar pedidos + salón (lectura/escritura)
- **Cocina (kitchen)** → pantalla de comandas en tiempo real
- **Cajero (cashier)** → módulo de caja + salón

## Funcionalidades implementadas

### POS (`/pos`)
- Selección de tab antes de ordenar: muestra mesas físicas registradas como cards (tipo Mesa) o entrada de texto (tipo Cliente)
- `TabSelector`: mesas libres → abre tab; mesas ocupadas → selecciona tab existente
- Botón cobrar (DollarSign) en cards ocupadas para admin/cashier: abre `TicketPreview` antes de cobrar
- Carrito con variantes de producto y promociones aplicadas automáticamente
- Inline editing del nombre del cliente en el tab
- `autoTabId`: si se navega desde el salón (`?tabId=X`), el POS auto-selecciona esa tab
- Botón Regresar: vuelve a `/floor` si vino del salón, o a la lista de tabs si no

### Tabs (cuentas)
- `type: 'table' | 'client' | 'mostrador'` — mesa numerada, cliente por nombre, o venta de mostrador (para llevar sin mesa)
- `source: 'pos' | 'agent'` — quién originó la tab; `'pos'` = usuario humano, `'agent'` = agente IA
- Una tab puede tener múltiples pedidos (`orders`)
- `opened_by` → UUID del usuario que abrió (mismo ID que `profiles.id`)
- `last_attended_at` → timestamptz; set al marcar "Mesa atendida" en el salón
- `billing_requested_at` → timestamptz; set al presionar "Pide cuenta" (explícito); se limpia al cobrar

### Cocina (`/kitchen`)
- Muestra pedidos en estado `pending` y `preparing`
- Actualización en tiempo real vía Realtime
- Botón para marcar como `preparing` → `ready`

### Caja (`/caja`)
- Turnos (`shifts`): abrir/cerrar turno, notas
- Muestra pedidos agrupados por tab durante el turno activo
- Cobrar: marca pedidos como `paid`, cierra el tab
- Historial de turnos con totales (re-query en cierre para evitar estado stale)
- Muestra quién abrió y cerró cada turno (`opened_by`, `closed_by`)
- Botón imprimir (Printer): abre `TicketPreview` para previsualizar e imprimir o cobrar desde el modal

### Salón (`/floor`)
- Canvas SVG con mesas numeradas posicionables; acceso admin **y waiter** (ambos pueden mover/agregar mesas)
- **Modo edición** (toggle): drag para reposicionar mesas, agregar/eliminar mesas, agregar/eliminar/renombrar formas decorativas
- **Formas decorativas** (`floor_shapes`): rectángulos con etiqueta y color, redimensionables por 8 handles; representan zonas sin interacción (barra, cocina, etc.)
- Colores por estado de mesa:
  | Estado | Color | Condición |
  |--------|-------|-----------|
  | `free` | crema | sin tab abierta |
  | `waiting` | arena | tab abierta, sin pedidos |
  | `active` | café oscuro | tiene pedidos activos |
  | `ready` | verde | todos los pedidos en `ready`, no atendida aún |
  | `served` | teal | atendida después del último `ready` |
  | `account` | dorado ámbar | `billing_requested_at` set |
- Información en cada card de mesa: iniciales del responsable, tiempo transcurrido, total acumulado
- Panel lateral al seleccionar mesa: "Mesa atendida" / "Pide cuenta" / "Tomar pedido" (→ `/pos?tabId=X`) / "Cobrar"
- "Mesa atendida": set `last_attended_at = now()`; disponible en estados `ready`/`served`
- "Pide cuenta": set `billing_requested_at = now()`; disponible en estados `active`/`ready`/`served`
- "Tomar pedido": navega a `/pos?tabId=X` (POS auto-selecciona la tab)
- Cobrar: abre `TicketPreview` para previsualizar, imprimir y confirmar cobro; cierra el tab

### TicketPreview (componente compartido)
- Modal de previsualización del ticket; **`onConfirm` es opcional** — sin él entra en modo solo-imprimir (muestra "Cerrar" en vez de "Cobrar")
- Muestra items, descuentos, total en vista monoespaciada
- **Botones de impresión:**
  - Con impresora BT configurada: `[Imprimir BT]` (primario, brand color) + `[PDF]` (secundario)
  - Sin BT configurado: `[Imprimir / Guardar PDF]` como único botón principal
- **Flujo BT:** `printViaBluetooth()` → si falla con sentinel → abre picker `pairPrinter()` → `printViaPickedDevice()`
- BtStatus: `'idle' | 'printing' | 'ok' | 'error' | 'picking'`; feedback visual en el botón
- Error de conexión en Android: muestra hint específico ("Apaga y enciende la impresora…")
- Usado en: FloorPlan (print-only), TabSelector (print-only), CajaModule (print + cobrar)

### Impresión Bluetooth (BLE GATT)
Sistema de impresión inalámbrica a impresoras térmicas via Web Bluetooth API.

**`src/lib/utils/bluetooth-printer.ts`**

Estrategia de auto-conexión (en orden de prioridad):
1. **Cache en memoria** (`_cachedDevice`) — fastest; dura toda la sesión del navegador
2. **`navigator.bluetooth.getDevices()`** — Chrome 85+; sobrevive recargas de página
3. **`requestDevice()` picker** — requiere gesto del usuario; abre el selector de Chrome

Servicios BLE conocidos (en orden de intento):
| UUID de Servicio | Tipo |
|---|---|
| `000018f0-…-00805f9b34fb` | Generic BLE printer (OFICHIDO, chinos baratos) |
| `6e400001-b5a3-…` | Nordic UART Service (NUS) |
| `e7810a71-73ae-…` | Xprinter / iDPRT |
| `49535343-fe7d-…` | ISSC BLE UART |

**Compatibilidad por plataforma:**
| | Windows | Android |
|---|---|---|
| Chunk BLE | 100 bytes (MTU auto-negociado) | **20 bytes** (MTU default = 23 bytes) |
| Delay entre chunks | 30 ms | 50 ms |
| Espera post-connect | — | **400 ms** (servicio discovery) |
| Espera pre-connect | — | **1,500 ms** (bond settle tras pairing) |
| Reintentos GATT | 3 × 1 s | 4 × 3 s + `disconnect()` entre intentos |
| Pausa post-disconnect | 500 ms | 1,000 ms |

Funciones exportadas:
- `pairPrinter()` → filtros por UUID + prefijos de nombre; fallback a `acceptAllDevices`; retorna `{ name, device } | null`
- `printViaBluetooth(data)` → usa cache/getDevices; retorna `false` con sentinels `'getDevices_unsupported'` / `'getDevices_empty'`
- `printViaPickedDevice(device, data)` → usa device ya obtenido del picker
- `getPairedPrinterName()` / `clearPairedPrinter()` / `getLastBTError()`

**`src/lib/utils/escpos.ts`**
- `buildReceiptBytes(label, orders, total, settings?)` → `Uint8Array` con comandos ESC/POS
- Incluye: logo-área, nombre del restaurante, dirección, teléfono, redes sociales (al pie), QR nativo
- QR nativo via `GS ( k` — modelo 2, tamaño 4, error correction M
- Papel 58mm = 32 chars/línea; `order_number === 0` → "Pedido en curso" (para carrito mostrador)

**`src/lib/utils/print-ticket.ts`**
- `printViaPopup(label, orders, total)` → abre ventana `58mm auto` con HTML/CSS para PDF
- CSS: `@page { size: 58mm auto; margin: 0 }` — evita que la impresora siga jalando papel en blanco
- Incluye logo, dirección, teléfono, redes sociales, QR via `api.qrserver.com`, pie de página

**`src/lib/utils/ticket-settings.ts`** (nuevo)
- `TicketSettings` interface: `restaurantName, address, phone, footer, instagram, facebook, whatsapp, tiktok, qrUrl, qrLabel, logoUrl, showLogo`
- `getTicketSettings()` → cache en memoria → cache en localStorage → fetch Supabase
- `invalidateTicketSettings()` → invalida ambos caches; llamar después de guardar en SettingsPage
- Cache key localStorage: `'felix_ticket_settings_v1'`

**Botón imprimir en todas las pantallas:**
- **FloorPlan**: botón 🖨️ en panel lateral cuando la mesa tiene pedidos → `TicketPreview` sin `onConfirm`
- **TabSelector**: botón 🖨️ en cada card (todos los roles, incluyendo mesero) → `TicketPreview` sin `onConfirm`
- **Cart (mostrador)**: botones Imprimir BT + PDF en el carrito; `buildCartPrintData()` combina pedidos enviados + carrito actual como `order_number: 0`
- **CajaModule**: botón 🖨️ existente → `TicketPreview` con `onConfirm` (imprimir + cobrar)

### Configuración del ticket (`/settings` → sección 2)
**`src/components/admin/TicketConfig.tsx`** (nuevo)

Secciones del formulario:
1. **Logo**: toggle mostrar/ocultar + URL de imagen + botón "Usar logo del restaurante"
2. **Info del negocio**: dirección, teléfono
3. **Redes sociales**: Instagram (@), Facebook, TikTok (@), WhatsApp (con código de país)
4. **Código QR**: URL + texto debajo del QR + preview en tiempo real
5. **Mensaje de cierre**: textarea para el pie de página

Vista previa en tiempo real (sticky en xl): ticket de 200px de ancho con datos reales del formulario.

Guarda en tabla `settings` con claves:
`ticket_address`, `ticket_phone`, `ticket_footer`, `ticket_instagram`, `ticket_facebook`,
`ticket_whatsapp`, `ticket_tiktok`, `ticket_qr_url`, `ticket_qr_label`, `ticket_logo_url`, `ticket_show_logo`

Llama `invalidateTicketSettings()` al guardar para que el próximo ticket use los datos frescos.

### Editor de menú (`/menu`) — solo admin/owner
Canvas A4 (794×1123 px a 96 dpi) con drag-and-drop y resize para diseñar el menú impreso del restaurante.

**Tipos de elementos** (`MenuElementType`): `text`, `image`, `line`, `shape`, `product`
- **text**: fuente, tamaño, color, negrita, cursiva, alineación
- **image**: URL, `object-fit`, esquinas redondeadas
- **line**: grosor, color, opacidad
- **shape**: color de relleno, esquinas redondeadas, opacidad
- **product**: tarjeta con imagen + nombre + precio, o modo clásico `Nombre ····· $Precio` con `border-bottom: 1px dotted`

**Diseño sugerido** (`buildSuggestedElements()`):
- Genera menú completo A4 con header, secciones por categoría, productos en 2 columnas con líderes punteados
- Fondo y decoraciones incluidas; el usuario puede editarlo como punto de partida

**Exportación:**
| Formato | Tamaños disponibles |
|---------|-------------------|
| PDF | A4, Media carta, Carta, Oficio, 10×15 cm |
| PNG | 1× (pantalla), 2× (alta resolución) |

- PDF: popup con `@page { size: Wmm Hmm; margin: 0 }` + `print-color-adjust: exact !important` en selector `*` para preservar colores de fondo y figuras
- PNG: `html2canvas` con import dinámico (evita SSR); elimina `transform: scale()` temporalmente para capturar a resolución natural

**Persistencia:** tablas `menus` y `menu_elements` con `branch_id` + RLS (`is_owner() OR branch_id = get_user_branch_id()`); soporte multi-menú por sucursal.

**Coordenadas con canvas escalado:** `s = canvasRect.width / CANVAS_W; canvasX = (e.clientX - rect.left) / s`
— el canvas usa `transform: scale(s); transform-origin: top left` y el wrapper ocupa `CANVAS_W * s × CANVAS_H * s` para no colapsar el layout.

**Prevenir deselección involuntaria:** los elementos llaman `e.stopPropagation()` tanto en `onMouseDown` como en `onClick` para evitar que el evento burbujee al contenedor que limpia la selección.

### Promociones (`/promotions`)
- `discount_type: 'fixed' | 'percent'` con horario (`all_day` o ventana `window`)
- **Modo estándar**: requiere N unidades de cada producto listado
- **Modo agrupado** (`pool_quantity`): el descuento aplica cada N artículos del grupo combinado
  - Ejemplo: "2 gorditas cualquiera = descuento" → pool_quantity=2, productos=[todas las gorditas]
- Matching en `src/components/pos/Cart.tsx` función `matchPromotions`

### Multi-sucursal (`/branches`, `/select-branch`)
- Tabla `branches` aísla completamente todos los datos operativos (menú, inventario, mesas, turnos, pedidos, IA)
- Cookie `current_branch_id` transmite la sucursal activa en cada request (server y client)
- **Owner**: selecciona sucursal al login (`/select-branch`); puede cambiar desde el sidebar (BranchSwitcher); ve comparativa entre sucursales (`/branches/compare`)
- **Admin/waiter/etc.**: asignados a una sola sucursal en `profiles.branch_id`; la cookie se set automáticamente en middleware, sin selector visible
- **Aislamiento por `branch_id`**: todos los inserts incluyen `branch_id`; todas las queries filtran por él; RLS policies lo refuerzan en la base de datos
- Ajustes de IA por sucursal: `business_name`, `business_type`, `business_description`, `ai_business_context`, `ai_last_trained_at` viven en la tabla `branches`; las claves de proveedor siguen globales en `settings`

### Usuarios (`/users`)
- CRUD de usuarios (admin y owner)
- Cambio de contraseña desde el modal
- Roles disponibles: owner, admin, waiter, kitchen, cashier
- Al crear usuario se asigna `branch_id` (el del administrador activo)

### Reportes y Dashboard
- Margen por producto, ventas por categoría
- Dashboard con métricas del turno activo

### Agente IA (`/assistant`) — solo admin
Sistema de agente IA con dos etapas de entrenamiento:

**Etapa 1 — Conocimiento base estático** (`src/lib/ai/system-prompt.ts`)
- `SYSTEM_BASE`: personalidad "Félix", recetas de tareas, pantallas del sistema, regla de honestidad
- Siempre incluido en cada conversación; no requiere setup del usuario
- `buildSystemPrompt(datetime, businessContext)` combina SYSTEM_BASE + contexto del negocio + fecha/hora actual

**Etapa 2 — Entrenamiento dinámico del negocio** (`api/ai/initialize`)
- Botón "Entrenar ahora" en configuración: escanea productos activos, personal, mesas, promociones **de la sucursal activa**
- Guarda contexto generado en `branches.ai_business_context` + `ai_last_trained_at` (antes en `settings`)
- El contexto es editable manualmente por el admin

**26 herramientas** (`src/lib/ai/tools.ts`):
| Consulta | Acción |
|----------|--------|
| `get_products`, `get_categories`, `get_inventory` | `create_product`, `update_product`, `create_category` |
| `get_active_tabs`, `get_tables` | `open_tab`, `close_tab` |
| `get_orders`, `get_shift_status`, `get_sales_summary` | `create_order`, `update_order_status` |
| `get_promotions` | `toggle_promotion` |
| `get_users` | `create_user`, `update_user` |
| — | `update_inventory`, `create_supply` |
| — | `open_shift`, `close_shift` |
| `get_branches` *(owner)* | `compare_branch_sales` *(owner)* |

- `open_tab`: el `label` debe ser el NÚMERO de mesa como string (`"1"`, `"2"`) para tipo `table`
- `get_shift_status`: cuando el turno está abierto, consulta `orders.status='paid'` en tiempo real (no el campo `total_revenue` que solo se escribe al cerrar)
- `create_user`: usa `supabase.auth.admin.createUser()` con service role client
- Pedidos del agente se identifican con `payment_source = 'agent'` (migration 024)
- Todas las herramientas filtran por `branch_id` del contexto; las tools de owner (`get_branches`, `compare_branch_sales`) no tienen filtro de sucursal
- `buildSystemPrompt(datetime, businessContext, branchName?)` incluye "Sucursal activa: X" cuando está disponible

**Proveedores** (`src/lib/ai/providers/`):
| Proveedor | Modelo default | Notas |
|-----------|----------------|-------|
| Claude | `claude-haiku-4-5-20251001` | Prompt caching en system prompt + último tool definition |
| Gemini | `gemini-2.0-flash-lite` | Free tier; evitar gemini-2.0-flash (cuota limitada) |
| Ollama | `llama3.1` | Solo modelos con soporte real de function calling |

**FloatingChat**: burbuja flotante disponible para admin en todas las páginas excepto `/assistant`; en mobile/tablet (< 1024px) se muestra como panel casi fullscreen, en desktop como popup 384×520px.

**Conversaciones**: almacenadas en `ai_conversations` + `ai_messages`; historial completo cargado en cada conversación

## Esquema de base de datos

### Tablas principales
| Tabla | Descripción |
|-------|-------------|
| `branches` | Sucursales: name, address, phone, business_name/type/description, ai_business_context, ai_last_trained_at, is_active |
| `profiles` | Extiende auth.users; campos: id, full_name, role, pin_code, branch_id (nullable para owner) |
| `products` | Productos con sale_price, category_id, image_url, is_active, variants[], **branch_id** |
| `categories` | Categorías con emoji y sort_order, **branch_id** |
| `supplies` | Insumos con stock y costo unitario, **branch_id** |
| `recipe_items` | Relación producto-insumo con cantidad |
| `tabs` | Cuentas abiertas: label, type (`table`/`client`/`mostrador`), source (`pos`/`agent`), status, opened_by, closed_at, last_attended_at, billing_requested_at, **branch_id** |
| `orders` | Pedidos: tab_id, status, total_amount, table_number, discount_amount, payment_source, prepaid (boolean), **branch_id** |
| `order_items` | Líneas de pedido: product_id, quantity, unit_price, subtotal |
| `shifts` | Turnos de caja: opened_by, closed_by, totales, status, **branch_id** |
| `promotions` | Promociones: discount_type, schedule_type, pool_quantity, **branch_id** |
| `promotion_items` | Productos requeridos por promoción con quantity |
| `tables` | Mesas físicas: number, pos_x, pos_y para el canvas, **branch_id** |
| `floor_shapes` | Formas decorativas del salón: label, pos_x, pos_y, width, height, fill, **branch_id** |
| `settings` | Configuración **global** (key-value) — solo claves AI y tema/nombre de restaurante |
| `storage.images` | Bucket público de Supabase Storage — `logos/` para logos del restaurante, `products/` para imágenes de productos |
| `ai_conversations` | Conversaciones del agente: user_id, title, provider, model, **branch_id** |
| `ai_messages` | Mensajes por conversación: role, content, tool_calls (jsonb) |
| `menus` | Menús visuales: name, background_color, background_image_url, **branch_id** |
| `menu_elements` | Elementos del canvas: menu_id, type, x, y, width, height, z_index, config (jsonb), **branch_id** |

### Claves de `settings` (solo globales)
`ai_provider`, `ai_model`, `ai_claude_key`, `ai_gemini_key`, `ai_ollama_url`

### Claves de `settings` para personalización del ticket
`ticket_address`, `ticket_phone`, `ticket_footer`, `ticket_instagram`, `ticket_facebook`,
`ticket_whatsapp`, `ticket_tiktok`, `ticket_qr_url`, `ticket_qr_label`, `ticket_logo_url`, `ticket_show_logo`

### Columnas por sucursal (en tabla `branches`)
`business_name`, `business_type`, `business_description`, `ai_business_context`, `ai_last_trained_at`

### Estados de pedido
`pending` → `preparing` → `ready` → `paid` | `cancelled`

### `orders.payment_source`
`'pos'` | `'caja'` | `'agent'`

### `orders.prepaid`
`boolean DEFAULT false` — `true` indica que el pago fue cobrado al momento de crear el pedido (mostrador / para llevar). El pedido sigue el flujo normal de cocina (`pending → preparing → ready → paid`) pero el dinero ya está registrado desde la creación.

### `tabs.type`
`'table'` | `'client'` | `'mostrador'`

### `tabs.source`
`'pos'` | `'agent'` — origen de la tab; default `'pos'`

### Migraciones aplicadas
| Archivo | Qué hace |
|---------|----------|
| 001 | Schema inicial |
| 002 | Fix recursión RLS |
| 003 | Tabla settings |
| 004 | orders v2 (tab_id, discount) |
| 005 | Rol kitchen |
| 006 | RLS para kitchen |
| 007 | Tabla tabs |
| 008 | Variantes de producto |
| 009 | Tabla shifts |
| 010 | Tabla promotions + promotion_items |
| 011 | Columna type en tabs |
| 012 | Acceso cashier a shifts |
| 013 | Columna payment_source en orders |
| 014 | SET NULL en products al borrar |
| 015 | Añade 'cashier' al CHECK de profiles.role |
| 016 | Añade pool_quantity a promotions |
| 017 | Añade opened_by a shifts |
| 018 | Tabla tables (salón) |
| 019 | Escribe en tables: admin + waiter (antes solo admin) |
| 020 | Tabla floor_shapes (formas decorativas del salón) |
| 021 | Columna last_attended_at en tabs |
| 022 | Columna billing_requested_at en tabs |
| 023 | Tablas ai_conversations + ai_messages |
| 024 | Añade 'agent' al CHECK de orders.payment_source |
| 025 | Tabla branches; branch_id en profiles + todas las tablas operativas; rol 'owner'; sucursal por defecto 'Principal' |
| 026 | RLS branch isolation policies en todas las tablas operativas |
| 027 | Añade `type='mostrador'` a tabs CHECK + columna `source='pos'\|'agent'` en tabs |
| 028 | Añade `prepaid boolean DEFAULT false` a orders |
| 029 | Bucket público `images` en Supabase Storage + políticas RLS (autenticados escriben, público lee) |
| 030 | Tablas `menus` + `menu_elements` para el editor visual de menú, RLS por sucursal |

## Componentes clave
| Componente | Ubicación | Propósito |
|------------|-----------|-----------|
| `AdminLayout` | `components/admin/AdminLayout.tsx` | Shell con sidebar + FloatingChat; recibe currentBranch + branches |
| `AdminSidebar` | `components/admin/AdminSidebar.tsx` | Nav por rol; muestra BranchSwitcher para owner o badge de sucursal para otros |
| `BranchSelector` | `components/admin/BranchSelector.tsx` | Grid de cards de sucursal para el owner en /select-branch |
| `BranchSwitcher` | `components/admin/BranchSwitcher.tsx` | Dropdown en sidebar para que owner cambie de sucursal activa |
| `BranchManager` | `components/admin/BranchManager.tsx` | CRUD de sucursales (owner); activar/desactivar |
| `BranchCompare` | `components/admin/BranchCompare.tsx` | Comparativa de ventas por sucursal: hoy/semana/mes |
| `CajaModule` | `components/admin/CajaModule.tsx` | Turnos + cobro + TicketPreview |
| `FloorPlan` | `components/admin/FloorPlan.tsx` | Canvas SVG salón con modo edición y 6 estados; botón imprimir ticket por mesa |
| `OrdersManager` | `components/admin/OrdersManager.tsx` | Historial pedidos |
| `PromotionsManager` | `components/admin/PromotionsManager.tsx` | CRUD promociones |
| `PromotionModal` | `components/admin/PromotionModal.tsx` | Form promoción |
| `TicketConfig` | `components/admin/TicketConfig.tsx` | Form configuración del ticket: logo, dirección, redes, QR, pie; vista previa en tiempo real |
| `UserModal` | `components/admin/UserModal.tsx` | CRUD + cambio clave |
| `POSScreen` | `components/pos/POSScreen.tsx` | POS principal; props autoTabId + branchId |
| `Cart` | `components/pos/Cart.tsx` | Carrito + matchPromotions + botones imprimir BT/PDF para mostrador |
| `TabSelector` | `components/pos/TabSelector.tsx` | Mesas físicas como cards + cobrar + imprimir ticket (todos los roles); filtra por branchId |
| `TicketPreview` | `components/pos/TicketPreview.tsx` | Modal previsualización ticket: BT print + PDF + cobrar (onConfirm opcional) |
| `ChatPanel` | `components/ai/ChatPanel.tsx` | Chat IA completo: sidebar de conversaciones + mensajes + config modal |
| `FloatingChat` | `components/ai/FloatingChat.tsx` | Burbuja flotante de chat (ChatPanel compact) para admin/owner |
| `ImageUpload` | `components/ui/ImageUpload.tsx` | Cuadro clickeable de subida de imágenes a Supabase Storage; props: `value, onChange, bucket, folder, previewSize`; acepta PNG/JPG/SVG máx. 5 MB |
| `MenuEditor` | `components/admin/MenuEditor.tsx` | Editor visual de menú A4: canvas escalado con drag-and-drop, resize 8 handles, panel de propiedades contextual, diseño sugerido, exportación PDF/PNG |

## Utilidades clave
| Utilidad | Ubicación | Propósito |
|----------|-----------|-----------|
| `bluetooth-printer` | `lib/utils/bluetooth-printer.ts` | Web Bluetooth BLE: pairing, auto-reconexión, cache de sesión, Android/Desktop adaptado |
| `escpos` | `lib/utils/escpos.ts` | Genera bytes ESC/POS para impresoras térmicas 58mm con ticket settings |
| `print-ticket` | `lib/utils/print-ticket.ts` | Impresión PDF via popup (58mm, sin papel en blanco extra) |
| `ticket-settings` | `lib/utils/ticket-settings.ts` | Carga/cachea configuración del ticket desde Supabase; `invalidateTicketSettings()` tras guardar |

## Supabase Storage
- Bucket **`images`** (público) creado en migration 029
- Políticas: autenticados pueden INSERT/UPDATE/DELETE; público puede SELECT
- `logos/` — logos del restaurante (subidos desde `SettingsForm`)
- `products/` — imágenes de productos (subidos desde `ProductModal`)
- Los campos `settings.restaurant_logo_url` y `products.image_url` almacenan la URL pública del archivo subido
- **No mezclar con URLs externas**: el bucket es la fuente canónica; las URLs externas siguen aceptadas para retrocompatibilidad

## Bugs históricos corregidos
- **Stale state en cierre de turno**: `handleClose()` re-queries la DB en lugar de usar estado React
- **`opened_by` guardado en `closed_by`**: corregido en migration 017 + fix en `handleStart()`
- **Crash en /users con rol cashier**: `ROLE_LABELS['cashier']` era undefined → TypeError
- **CHECK constraint bloqueaba cashier**: migration 015 añade 'cashier' a la constraint
- **Click en mesa deseleccionaba inmediatamente**: `onTableClick` no hacía `e.stopPropagation()` antes del early return; click burbujeaba al SVG que limpiaba la selección
- **Formas no visibles hasta refrescar**: `handleAddShape`/`handleAddTable` dependían solo del canal Realtime para re-cargar; se añadió `await load()` explícito tras el insert
- **Estado "Pide cuenta" nunca se activaba**: antes derivado de todos los pedidos `paid` con tab abierta (imposible por el flujo de cobro atómico); reemplazado por columna explícita `billing_requested_at` con botón dedicado
- **Agente siempre usando Claude Sonnet**: modelo hardcodeado en `run()`; corregido pasando `model` al constructor
- **Gemini ignorando modelo configurado**: modelo como parámetro default de `run()` nunca se pasaba; corregido moviéndolo al constructor
- **Agente reportando ventas incorrectas**: `get_shift_status` leía campo `total_revenue` (solo escrito al cerrar); ahora suma `orders.total_amount` where `status='paid'` en tiempo real
- **Agente hallucinating actions**: faltaban herramientas `open_tab`, `close_tab`, `close_shift`; agente describía acciones sin ejecutarlas
- **Errores de API crudos visibles**: `String(err)` expuesto al frontend; reemplazado por mensajes amigables según código HTTP
- **Sección BT no aparecía en Chrome (SSR)**: `isBluetoothSupported()` se llamaba en render time (undefined en servidor) → hydration mismatch; corregido con `useState<boolean | null>(null)` + `useEffect`
- **`navigator.bluetooth.getDevices is not a function`**: API no disponible en Chrome antiguo; corregido con `typeof` check + sentinels + fallback a picker
- **GATT "Connection attempt failed" en Windows**: Chrome falla la primera conexión después de `requestDevice()`; corregido con `gattConnect()` 3 reintentos × 1s
- **`writeValueWithoutResponse` fallando en Windows**: drivers BLE de Windows requieren ACK; `writeChunk()` intenta sin respuesta primero, fallback a `writeValue`
- **Impresora jalando papel en blanco después del ticket**: el navegador enviaba tamaño A4; corregido con `@page { size: 58mm auto; margin: 0 }` en el HTML del PDF
- **BT MTU en Android (chunks de 100 bytes rechazados)**: MTU default de Android BLE = 23 bytes (20 usables); reducido a 20 bytes en Android, manteniendo 100 en Desktop
- **GATT "Connection attempt failed" en Android tras pairing**: el stack BLE de Android necesita ~1.5s después del bonding Classic BT para aceptar conexiones GATT; corregido con delay pre-connect + `disconnect()` entre reintentos
- **Warning React por `<script dangerouslySetInnerHTML>`**: tag PWA en `layout.tsx` provocaba warning en la consola; reemplazado por `<Script strategy="afterInteractive">` de `next/script`
- **Hydration mismatch en TicketConfig**: `new Date().toLocaleString()` difería entre servidor y cliente; corregido con `useState('')` + `useEffect`
- **Scrollbar visible en sidebar**: doble fix — clase `.scrollbar-hidden` en CSS global + reducción de densidad (`py-4→py-2`, `py-2→py-1.5`, `space-y-1→space-y-0.5`) para evitar overflow
- **Selección de elemento en MenuEditor se cerraba al instante**: click en elemento burbujeaba al contenedor que limpiaba la selección; corregido con `e.stopPropagation()` en `onMouseDown` Y en `onClick` de cada elemento
- **Drag roto en MenuEditor tras fix de selección**: `e.preventDefault()` faltaba en mousedown de elementos y handles de resize; sin él el navegador iniciaba drag nativo del texto e interrumpía el movimiento
- **PDF exportado perdía colores de fondo y figuras**: los navegadores omiten `background-color` al imprimir por defecto; corregido añadiendo `print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important` al selector `*` del HTML del popup de exportación
- **Conflicto de tipos con `@types/html2canvas`**: `@types/html2canvas@0.5.35` colisionaba con los tipos incluidos en `html2canvas@1.4.1` (campo `scale` no reconocido); solucionado desinstalando `@types/html2canvas`
