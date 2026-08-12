import type { SupabaseClient } from '@supabase/supabase-js'
import type { ToolCall, ToolDefinition } from './types'

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ── READ TOOLS ────────────────────────────────────────────────────────────
  {
    name: 'get_products',
    description: 'Lista los productos del menú. Filtra por categoría, estado activo o búsqueda por nombre.',
    parameters: {
      type: 'object',
      properties: {
        category_id: { type: 'string', description: 'ID de categoría para filtrar (opcional)' },
        active_only: { type: 'boolean', description: 'Solo productos activos (default: false)' },
        search:      { type: 'string', description: 'Texto para buscar en el nombre del producto' },
      },
    },
  },
  {
    name: 'get_categories',
    description: 'Lista todas las categorías de productos ordenadas por sort_order.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_inventory',
    description: 'Consulta el inventario de insumos (supplies). Puede filtrar solo los que tienen stock bajo.',
    parameters: {
      type: 'object',
      properties: {
        low_stock_only: { type: 'boolean', description: 'Solo insumos con current_stock < min_stock' },
      },
    },
  },
  {
    name: 'get_active_tabs',
    description: 'Obtiene todas las tabs (cuentas) actualmente abiertas con su total acumulado y estado.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_orders',
    description: 'Obtiene pedidos con sus items. Filtra por estado, tab, o rango de fechas.',
    parameters: {
      type: 'object',
      properties: {
        status:    { type: 'string', description: 'Estado: pending, preparing, ready, paid, cancelled', enum: ['pending', 'preparing', 'ready', 'paid', 'cancelled'] },
        tab_id:    { type: 'string', description: 'ID de la tab para filtrar pedidos' },
        date_from: { type: 'string', description: 'Fecha inicio ISO 8601 (ej: 2024-01-15T00:00:00)' },
        date_to:   { type: 'string', description: 'Fecha fin ISO 8601' },
        limit:     { type: 'number', description: 'Máximo de resultados (default: 20)' },
      },
    },
  },
  {
    name: 'get_shift_status',
    description: 'Obtiene el turno actualmente abierto o el último cerrado con sus totales.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_sales_summary',
    description: 'Resumen de ventas COBRADAS (status=paid): ingresos totales, número de pedidos pagados y desglose por categoría. Solo incluye pedidos ya cobrados, no pendientes ni en preparación.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Fecha inicio ISO 8601 (default: inicio del día de hoy)' },
        date_to:   { type: 'string', description: 'Fecha fin ISO 8601 (default: ahora)' },
      },
    },
  },
  {
    name: 'get_promotions',
    description: 'Lista las promociones configuradas con sus productos requeridos.',
    parameters: {
      type: 'object',
      properties: {
        active_only: { type: 'boolean', description: 'Solo promociones activas' },
      },
    },
  },
  // ── WRITE TOOLS ───────────────────────────────────────────────────────────
  {
    name: 'create_product',
    description: 'Crea un nuevo producto en el menú.',
    parameters: {
      type: 'object',
      properties: {
        name:        { type: 'string', description: 'Nombre del producto' },
        sale_price:  { type: 'number', description: 'Precio de venta en pesos' },
        category_id: { type: 'string', description: 'ID de la categoría (opcional)' },
        is_active:   { type: 'boolean', description: 'Si el producto está activo (default: true)' },
        variants:    { type: 'string', description: 'Variantes separadas por coma (ej: "con queso,sin chile")' },
      },
      required: ['name', 'sale_price'],
    },
  },
  {
    name: 'update_product',
    description: 'Actualiza nombre, precio, estado activo o categoría de un producto existente.',
    parameters: {
      type: 'object',
      properties: {
        product_id:  { type: 'string', description: 'ID del producto a actualizar' },
        name:        { type: 'string', description: 'Nuevo nombre' },
        sale_price:  { type: 'number', description: 'Nuevo precio de venta' },
        is_active:   { type: 'boolean', description: 'Estado activo/inactivo' },
        category_id: { type: 'string', description: 'ID de nueva categoría' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'update_inventory',
    description: 'Actualiza el stock actual de un insumo.',
    parameters: {
      type: 'object',
      properties: {
        supply_id:  { type: 'string', description: 'ID del insumo a actualizar' },
        new_stock:  { type: 'number', description: 'Nuevo valor de stock actual' },
      },
      required: ['supply_id', 'new_stock'],
    },
  },
  {
    name: 'toggle_promotion',
    description: 'Activa o desactiva una promoción.',
    parameters: {
      type: 'object',
      properties: {
        promotion_id: { type: 'string', description: 'ID de la promoción' },
        is_active:    { type: 'boolean', description: 'true = activar, false = desactivar' },
      },
      required: ['promotion_id', 'is_active'],
    },
  },
  {
    name: 'create_order',
    description: 'Crea un nuevo pedido para una tab existente con sus productos.',
    parameters: {
      type: 'object',
      properties: {
        tab_id: { type: 'string', description: 'ID de la tab (cuenta) a la que pertenece el pedido' },
        items:  { type: 'string', description: 'JSON array de items: [{"product_id":"...","quantity":2}]' },
        notes:  { type: 'string', description: 'Notas generales del pedido (opcional)' },
      },
      required: ['tab_id', 'items'],
    },
  },
  // ── USERS ─────────────────────────────────────────────────────────────────
  {
    name: 'get_users',
    description: 'Lista todos los usuarios del equipo registrados en el sistema con su nombre, rol y correo.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'create_user',
    description: 'Crea un nuevo usuario en el sistema. Requiere nombre completo, correo, contraseña y rol.',
    parameters: {
      type: 'object',
      properties: {
        full_name: { type: 'string', description: 'Nombre completo del usuario' },
        email:     { type: 'string', description: 'Correo electrónico (será el login)' },
        password:  { type: 'string', description: 'Contraseña inicial (mínimo 6 caracteres)' },
        role:      { type: 'string', enum: ['admin', 'waiter', 'kitchen', 'cashier'], description: 'Rol: admin, waiter (mesero), kitchen (cocina), cashier (cajero)' },
      },
      required: ['full_name', 'email', 'password', 'role'],
    },
  },
  {
    name: 'update_user',
    description: 'Actualiza el nombre o rol de un usuario existente. Primero usa get_users para obtener el ID real.',
    parameters: {
      type: 'object',
      properties: {
        user_id:   { type: 'string', description: 'ID del usuario a actualizar' },
        full_name: { type: 'string', description: 'Nuevo nombre completo (opcional)' },
        role:      { type: 'string', enum: ['admin', 'waiter', 'kitchen', 'cashier'], description: 'Nuevo rol (opcional)' },
      },
      required: ['user_id'],
    },
  },
  // ── SHIFTS ────────────────────────────────────────────────────────────────
  {
    name: 'open_shift',
    description: 'Abre un nuevo turno de caja. Solo funciona si no hay ningún turno abierto actualmente.',
    parameters: { type: 'object', properties: {} },
  },
  // ── ORDERS ────────────────────────────────────────────────────────────────
  {
    name: 'update_order_status',
    description: 'Cambia el estado de un pedido. Flujo normal: pending → preparing → ready. También puede cancelarse con "cancelled". Usa get_orders o get_active_tabs para obtener el ID real del pedido.',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'ID del pedido a actualizar' },
        status:   { type: 'string', enum: ['pending', 'preparing', 'ready', 'cancelled'], description: 'Nuevo estado' },
      },
      required: ['order_id', 'status'],
    },
  },
  // ── SUPPLIES ──────────────────────────────────────────────────────────────
  {
    name: 'create_supply',
    description: 'Registra un nuevo insumo o ingrediente en el inventario.',
    parameters: {
      type: 'object',
      properties: {
        name:          { type: 'string', description: 'Nombre del insumo (ej: "Queso Oaxaca")' },
        unit:          { type: 'string', enum: ['gr', 'ml', 'pza'], description: 'Unidad de medida: gr (gramos), ml (mililitros), pza (pieza)' },
        current_stock: { type: 'number', description: 'Stock inicial (default: 0)' },
        min_stock:     { type: 'number', description: 'Stock mínimo antes de alerta (default: 0)' },
        unit_cost:     { type: 'number', description: 'Costo por unidad en pesos (default: 0)' },
      },
      required: ['name', 'unit'],
    },
  },
  // ── CATEGORIES ────────────────────────────────────────────────────────────
  {
    name: 'create_category',
    description: 'Crea una nueva categoría de productos en el menú.',
    parameters: {
      type: 'object',
      properties: {
        name:       { type: 'string', description: 'Nombre de la categoría (ej: "Bebidas")' },
        emoji:      { type: 'string', description: 'Emoji representativo (ej: "🥤")' },
        sort_order: { type: 'number', description: 'Orden de aparición (número más bajo = primero)' },
      },
      required: ['name'],
    },
  },
  // ── TABLES ────────────────────────────────────────────────────────────────
  {
    name: 'get_tables',
    description: 'Lista las mesas físicas registradas en el salón con su número.',
    parameters: { type: 'object', properties: {} },
  },
  // ── TABS ──────────────────────────────────────────────────────────────────
  {
    name: 'open_tab',
    description: 'Abre una nueva cuenta. Para mesas el label es el NÚMERO de mesa (ej: "1"). Para clientes es el nombre. Para mostrador (venta directa sin mesa ni cliente) usa type="mostrador" y label="Mostrador".',
    parameters: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'Número de mesa, nombre del cliente, o "Mostrador" para venta de mostrador' },
        type:  { type: 'string', enum: ['table', 'client', 'mostrador'], description: '"table" para mesa física, "client" para cliente por nombre, "mostrador" para venta directa en mostrador' },
      },
      required: ['label', 'type'],
    },
  },
  {
    name: 'close_tab',
    description: 'Cobra todos los pedidos activos de una cuenta/mesa y la cierra. Primero usa get_active_tabs para obtener el ID real de la tab.',
    parameters: {
      type: 'object',
      properties: {
        tab_id: { type: 'string', description: 'ID de la tab/cuenta a cobrar y cerrar' },
      },
      required: ['tab_id'],
    },
  },
  {
    name: 'close_shift',
    description: 'Cierra el turno de caja actualmente abierto. Calcula los totales reales de los pedidos cobrados y registra el cierre.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  // ── OWNER-ONLY TOOLS ──────────────────────────────────────────────────────
  {
    name: 'get_branches',
    description: 'Lista todas las sucursales activas del negocio. Solo disponible para el propietario (owner).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'compare_branch_sales',
    description: 'Compara las ventas de todas las sucursales en un período. Retorna ingresos, pedidos y tabs abiertas por sucursal. Solo disponible para el propietario (owner).',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Fecha inicio ISO 8601 (default: inicio del día de hoy)' },
        date_to:   { type: 'string', description: 'Fecha fin ISO 8601 (default: ahora)' },
      },
    },
  },
]

// ── EXECUTOR ──────────────────────────────────────────────────────────────

export async function executeTool(
  tc: ToolCall,
  supabase: SupabaseClient,
  context?: { userId?: string; branchId?: string; isOwner?: boolean }
): Promise<unknown> {
  const branchId = context?.branchId
  const userId   = context?.userId
  const isOwner  = context?.isOwner ?? false

  try {
    switch (tc.name) {
      case 'get_products':          return await getProducts(tc.input, supabase, branchId)
      case 'get_categories':        return await getCategories(supabase, branchId)
      case 'get_inventory':         return await getInventory(tc.input, supabase, branchId)
      case 'get_active_tabs':       return await getActiveTabs(supabase, branchId)
      case 'get_orders':            return await getOrders(tc.input, supabase, branchId)
      case 'get_shift_status':      return await getShiftStatus(supabase, branchId)
      case 'get_sales_summary':     return await getSalesSummary(tc.input, supabase, branchId)
      case 'get_promotions':        return await getPromotions(tc.input, supabase, branchId)
      case 'get_users':             return await getUsers(supabase)
      case 'get_tables':            return await getTables(supabase, branchId)
      case 'create_product':        return await createProduct(tc.input, supabase, branchId)
      case 'update_product':        return await updateProduct(tc.input, supabase)
      case 'update_inventory':      return await updateInventory(tc.input, supabase)
      case 'toggle_promotion':      return await togglePromotion(tc.input, supabase)
      case 'create_order':          return await createOrder(tc.input, supabase, userId, branchId)
      case 'create_user':           return await createUser(tc.input, supabase)
      case 'update_user':           return await updateUser(tc.input, supabase)
      case 'create_supply':         return await createSupply(tc.input, supabase, branchId)
      case 'create_category':       return await createCategory(tc.input, supabase, branchId)
      case 'update_order_status':   return await updateOrderStatus(tc.input, supabase)
      case 'open_tab':              return await openTab(tc.input, supabase, userId, branchId)
      case 'close_tab':             return await closeTab(tc.input, supabase)
      case 'open_shift':            return await openShift(supabase, userId, branchId)
      case 'close_shift':           return await closeShift(supabase, userId, branchId)
      case 'get_branches':
        if (!isOwner) return { error: 'Esta herramienta solo está disponible para el propietario' }
        return await getBranches(supabase)
      case 'compare_branch_sales':
        if (!isOwner) return { error: 'Esta herramienta solo está disponible para el propietario' }
        return await compareBranchSales(tc.input, supabase)
      default:
        return { error: `Herramienta desconocida: ${tc.name}` }
    }
  } catch (err) {
    return { error: String(err) }
  }
}

// ── READ IMPLEMENTATIONS ──────────────────────────────────────────────────

async function getProducts(input: Record<string, unknown>, supabase: SupabaseClient, branchId?: string) {
  let query = supabase
    .from('products')
    .select('id, name, sale_price, is_active, variants, categories(name)')
    .order('name')

  if (branchId)        query = query.eq('branch_id', branchId)
  if (input.active_only) query = query.eq('is_active', true)
  if (input.category_id) query = query.eq('category_id', input.category_id as string)
  if (input.search)      query = query.ilike('name', `%${input.search}%`)

  const { data, error } = await query
  if (error) return { error: error.message }
  return { products: data, count: data?.length ?? 0 }
}

async function getCategories(supabase: SupabaseClient, branchId?: string) {
  let query = supabase
    .from('categories')
    .select('id, name, emoji, sort_order')
    .order('sort_order')
  if (branchId) query = query.eq('branch_id', branchId)
  const { data, error } = await query
  if (error) return { error: error.message }
  return { categories: data }
}

async function getInventory(input: Record<string, unknown>, supabase: SupabaseClient, branchId?: string) {
  let query = supabase
    .from('supplies')
    .select('id, name, unit, current_stock, min_stock, unit_cost')
    .order('name')
  if (branchId) query = query.eq('branch_id', branchId)
  const { data, error } = await query
  if (error) return { error: error.message }

  let items = data ?? []
  if (input.low_stock_only) {
    items = items.filter(s => s.current_stock < s.min_stock)
  }
  return {
    supplies: items.map(s => ({
      ...s,
      low_stock: s.current_stock < s.min_stock,
    })),
    low_stock_count: items.filter(s => s.current_stock < s.min_stock).length,
  }
}

async function getUsers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .order('role')
  if (error) return { error: error.message }
  return { users: data, count: data?.length ?? 0 }
}

async function getTables(supabase: SupabaseClient, branchId?: string) {
  let query = supabase
    .from('tables')
    .select('id, number')
    .order('number')
  if (branchId) query = query.eq('branch_id', branchId)
  const { data, error } = await query
  if (error) return { error: error.message }
  return { tables: data, count: data?.length ?? 0 }
}

async function getActiveTabs(supabase: SupabaseClient, branchId?: string) {
  let query = supabase
    .from('tabs')
    .select('id, label, type, opened_at, billing_requested_at, orders(status, total_amount, discount_amount)')
    .eq('status', 'open')
    .order('opened_at')
  if (branchId) query = query.eq('branch_id', branchId)
  const { data: tabs, error } = await query

  if (error) return { error: error.message }

  const enriched = (tabs ?? []).map(tab => {
    const orders = (tab.orders as { status: string; total_amount: number; discount_amount: number }[]) ?? []
    const activeOrders = orders.filter(o => !['paid', 'cancelled'].includes(o.status))
    const total = orders.reduce((sum, o) => sum + (o.total_amount ?? 0) - (o.discount_amount ?? 0), 0)
    return {
      id: tab.id,
      label: tab.label,
      type: tab.type,
      opened_at: tab.opened_at,
      billing_requested: !!tab.billing_requested_at,
      active_orders: activeOrders.length,
      total_amount: total,
    }
  })

  return { tabs: enriched, count: enriched.length }
}

async function getOrders(input: Record<string, unknown>, supabase: SupabaseClient, branchId?: string) {
  const limit = (input.limit as number) ?? 20

  let query = supabase
    .from('orders')
    .select('id, order_number, status, total_amount, discount_amount, created_at, tab_id, order_items(quantity, unit_price, products(name))')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (branchId)        query = query.eq('branch_id', branchId)
  if (input.status)    query = query.eq('status', input.status as string)
  if (input.tab_id)    query = query.eq('tab_id', input.tab_id as string)
  if (input.date_from) query = query.gte('created_at', input.date_from as string)
  if (input.date_to)   query = query.lte('created_at', input.date_to as string)

  const { data, error } = await query
  if (error) return { error: error.message }
  return { orders: data, count: data?.length ?? 0 }
}

async function getShiftStatus(supabase: SupabaseClient, branchId?: string) {
  let q = supabase
    .from('shifts')
    .select('id, status, opened_at, closed_at, total_revenue, total_orders, paid_orders, cancelled_orders, notes')
    .order('opened_at', { ascending: false })
    .limit(1)
  if (branchId) q = q.eq('branch_id', branchId)
  const { data: shift, error } = await q.maybeSingle()

  if (error) return { error: error.message }
  if (!shift) return { shift: null, message: 'No hay turnos registrados' }

  // For open shifts compute real-time revenue — total_revenue is only written on close
  if (shift?.status === 'open') {
    let ordQuery = supabase
      .from('orders')
      .select('total_amount, discount_amount')
      .eq('status', 'paid')
      .gte('created_at', shift.opened_at)
    if (branchId) ordQuery = ordQuery.eq('branch_id', branchId)
    const { data: paidOrders } = await ordQuery

    const realRevenue = (paidOrders ?? []).reduce(
      (s, o) => s + (o.total_amount ?? 0) - (o.discount_amount ?? 0), 0
    )
    return {
      shift: {
        ...shift,
        total_revenue: realRevenue,
        paid_orders: paidOrders?.length ?? 0,
      },
    }
  }

  return { shift }
}

async function getSalesSummary(input: Record<string, unknown>, supabase: SupabaseClient, branchId?: string) {
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  const dateFrom = (input.date_from as string) ?? startOfDay.toISOString()
  const dateTo   = (input.date_to   as string) ?? now.toISOString()

  let query = supabase
    .from('orders')
    .select('total_amount, discount_amount, status, order_items(quantity, unit_price, products(name, categories(name)))')
    .eq('status', 'paid')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo)
  if (branchId) query = query.eq('branch_id', branchId)

  const { data: orders, error } = await query

  if (error) return { error: error.message }

  const paid = orders ?? []
  const totalRevenue = paid.reduce((s, o) => s + (o.total_amount ?? 0) - (o.discount_amount ?? 0), 0)
  const totalDiscount = paid.reduce((s, o) => s + (o.discount_amount ?? 0), 0)

  type SaleItem = { quantity: number; unit_price: number; products: { categories: { name: string } | null } | null }
  // Category breakdown
  const byCategory: Record<string, { revenue: number; units_sold: number }> = {}
  for (const order of paid) {
    for (const item of (order.order_items as unknown as SaleItem[]) ?? []) {
      const cat = item.products?.categories?.name ?? 'Sin categoría'
      if (!byCategory[cat]) byCategory[cat] = { revenue: 0, units_sold: 0 }
      byCategory[cat].revenue    += item.quantity * item.unit_price
      byCategory[cat].units_sold += item.quantity
    }
  }

  return {
    period: { from: dateFrom, to: dateTo },
    total_revenue: totalRevenue,
    total_discount: totalDiscount,
    paid_orders: paid.length,
    note: paid.length === 0 ? 'No hay pedidos cobrados en este período. Usa get_orders para ver pedidos en otros estados.' : undefined,
    by_category: byCategory,
  }
}

async function getPromotions(input: Record<string, unknown>, supabase: SupabaseClient, branchId?: string) {
  let query = supabase
    .from('promotions')
    .select('id, name, description, discount_type, discount_value, is_active, pool_quantity, promotion_items(quantity, products(name))')
    .order('name')

  if (branchId)          query = query.eq('branch_id', branchId)
  if (input.active_only) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return { error: error.message }
  return { promotions: data }
}

// ── WRITE IMPLEMENTATIONS ─────────────────────────────────────────────────

async function createProduct(input: Record<string, unknown>, supabase: SupabaseClient, branchId?: string) {
  const variants = input.variants
    ? (input.variants as string).split(',').map(v => v.trim()).filter(Boolean)
    : null

  const { data, error } = await supabase
    .from('products')
    .insert({
      name:        input.name,
      sale_price:  input.sale_price,
      category_id: input.category_id ?? null,
      is_active:   (input.is_active as boolean) ?? true,
      variants,
      ...(branchId ? { branch_id: branchId } : {}),
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { success: true, product: data }
}

async function updateProduct(input: Record<string, unknown>, supabase: SupabaseClient) {
  const updates: Record<string, unknown> = {}
  if (input.name        !== undefined) updates.name        = input.name
  if (input.sale_price  !== undefined) updates.sale_price  = input.sale_price
  if (input.is_active   !== undefined) updates.is_active   = input.is_active
  if (input.category_id !== undefined) updates.category_id = input.category_id

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', input.product_id as string)
    .select()
    .single()

  if (error) return { error: error.message }
  return { success: true, product: data }
}

async function updateInventory(input: Record<string, unknown>, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('supplies')
    .update({ current_stock: input.new_stock })
    .eq('id', input.supply_id as string)
    .select()
    .single()

  if (error) return { error: error.message }
  return { success: true, supply: data }
}

async function togglePromotion(input: Record<string, unknown>, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('promotions')
    .update({ is_active: input.is_active })
    .eq('id', input.promotion_id as string)
    .select()
    .single()

  if (error) return { error: error.message }
  return { success: true, promotion: data }
}

async function createUser(input: Record<string, unknown>, supabase: SupabaseClient) {
  const fullName = input.full_name as string
  const email    = input.email    as string
  const password = input.password as string
  const role     = (input.role as string) ?? 'waiter'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.auth as any).admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  })
  if (error) return { error: error.message }

  await supabase.from('profiles').upsert({ id: data.user.id, full_name: fullName, role })

  return { success: true, user_id: data.user.id, email, full_name: fullName, role }
}

async function updateUser(input: Record<string, unknown>, supabase: SupabaseClient) {
  const updates: Record<string, unknown> = {}
  if (input.full_name !== undefined) updates.full_name = input.full_name
  if (input.role      !== undefined) updates.role      = input.role

  if (Object.keys(updates).length === 0) return { error: 'Indica al menos un campo a actualizar: full_name o role' }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', input.user_id as string)

  if (error) return { error: error.message }
  return { success: true }
}

async function openShift(supabase: SupabaseClient, userId?: string, branchId?: string) {
  let existQuery = supabase.from('shifts').select('id').eq('status', 'open')
  if (branchId) existQuery = existQuery.eq('branch_id', branchId)
  const { data: existing } = await existQuery.maybeSingle()

  if (existing) return { error: 'Ya hay un turno abierto. Ciérralo antes de abrir uno nuevo.' }

  const { data: shift, error } = await supabase
    .from('shifts')
    .insert({
      status: 'open',
      opened_by: userId ?? null,
      ...(branchId ? { branch_id: branchId } : {}),
    })
    .select('id, opened_at')
    .single()

  if (error) return { error: error.message }
  return { success: true, shift_id: shift.id, opened_at: shift.opened_at }
}

async function updateOrderStatus(input: Record<string, unknown>, supabase: SupabaseClient) {
  const newStatus = input.status as string
  const validStatuses = ['pending', 'preparing', 'ready', 'cancelled']
  if (!validStatuses.includes(newStatus)) {
    return { error: `Estado inválido. Valores permitidos: ${validStatuses.join(', ')}` }
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', input.order_id as string)
    .select('id, status')
    .single()

  if (error) return { error: error.message }
  return { success: true, order_id: data.id, new_status: data.status }
}

async function createSupply(input: Record<string, unknown>, supabase: SupabaseClient, branchId?: string) {
  const { data, error } = await supabase
    .from('supplies')
    .insert({
      name:          input.name,
      unit:          input.unit,
      current_stock: (input.current_stock as number) ?? 0,
      min_stock:     (input.min_stock     as number) ?? 0,
      unit_cost:     (input.unit_cost     as number) ?? 0,
      ...(branchId ? { branch_id: branchId } : {}),
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { success: true, supply: data }
}

async function createCategory(input: Record<string, unknown>, supabase: SupabaseClient, branchId?: string) {
  let maxQuery = supabase
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  if (branchId) maxQuery = maxQuery.eq('branch_id', branchId)
  const { data: maxRow } = await maxQuery.maybeSingle()

  const nextOrder = (input.sort_order as number | undefined) ?? ((maxRow?.sort_order ?? 0) + 1)

  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: input.name,
      emoji: (input.emoji as string) ?? '',
      sort_order: nextOrder,
      ...(branchId ? { branch_id: branchId } : {}),
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { success: true, category: data }
}

async function openTab(input: Record<string, unknown>, supabase: SupabaseClient, userId?: string, branchId?: string) {
  const label = String(input.label)
  const type = (input.type as 'table' | 'client' | 'mostrador') ?? 'table'

  // For physical tables, check it's not already open
  if (type === 'table') {
    let existQuery = supabase
      .from('tabs')
      .select('id')
      .eq('label', label)
      .eq('type', 'table')
      .eq('status', 'open')
    if (branchId) existQuery = existQuery.eq('branch_id', branchId)
    const { data: existing } = await existQuery.maybeSingle()

    if (existing) return { error: `La Mesa ${label} ya tiene una cuenta abierta` }
  }

  const { data: tab, error } = await supabase
    .from('tabs')
    .insert({
      label,
      type,
      source: 'agent',
      status: 'open',
      opened_by: userId ?? null,
      ...(branchId ? { branch_id: branchId } : {}),
    })
    .select()
    .single()

  if (error) return { error: error.message }
  const displayName = type === 'table' ? `Mesa ${label}` : type === 'mostrador' ? 'Mostrador' : label
  return {
    success: true,
    tab_id: tab.id,
    display_name: displayName,
  }
}

async function closeTab(input: Record<string, unknown>, supabase: SupabaseClient) {
  const tabId = input.tab_id as string

  // Verify tab exists and is open
  const { data: tab, error: tabCheckError } = await supabase
    .from('tabs')
    .select('id, label, status')
    .eq('id', tabId)
    .single()

  if (tabCheckError || !tab) return { error: 'No se encontró la cuenta indicada' }
  if (tab.status !== 'open') return { error: `La cuenta "${tab.label}" ya está cerrada` }

  // Get all active (non-paid, non-cancelled) orders
  const { data: activeOrders, error: ordersError } = await supabase
    .from('orders')
    .select('id, total_amount, discount_amount')
    .eq('tab_id', tabId)
    .not('status', 'in', '(paid,cancelled)')

  if (ordersError) return { error: ordersError.message }

  // Mark all active orders as paid
  if (activeOrders && activeOrders.length > 0) {
    const { error: payError } = await supabase
      .from('orders')
      .update({ status: 'paid' })
      .in('id', activeOrders.map(o => o.id))

    if (payError) return { error: payError.message }
  }

  // Close the tab
  const { error: closeError } = await supabase
    .from('tabs')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', tabId)

  if (closeError) return { error: closeError.message }

  const totalCharged = (activeOrders ?? []).reduce(
    (s, o) => s + (o.total_amount ?? 0) - (o.discount_amount ?? 0), 0
  )

  return {
    success: true,
    tab_label: tab.label,
    orders_paid: activeOrders?.length ?? 0,
    total_charged: totalCharged,
  }
}

async function closeShift(supabase: SupabaseClient, userId?: string, branchId?: string) {
  // Get current open shift
  let shiftQ = supabase
    .from('shifts')
    .select('id, opened_at')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
  if (branchId) shiftQ = shiftQ.eq('branch_id', branchId)
  const { data: shift, error: shiftError } = await shiftQ.maybeSingle()

  if (shiftError || !shift) return { error: 'No hay ningún turno abierto en este momento' }

  // Compute real totals from paid orders during this shift
  let ordQ = supabase
    .from('orders')
    .select('total_amount, discount_amount')
    .eq('status', 'paid')
    .gte('created_at', shift.opened_at)
  if (branchId) ordQ = ordQ.eq('branch_id', branchId)
  const { data: paidOrders, error: ordersError } = await ordQ

  if (ordersError) return { error: ordersError.message }

  const totalRevenue = (paidOrders ?? []).reduce(
    (s, o) => s + (o.total_amount ?? 0) - (o.discount_amount ?? 0), 0
  )
  const totalPaid = paidOrders?.length ?? 0

  const { error: closeError } = await supabase
    .from('shifts')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: userId ?? null,
      total_revenue: totalRevenue,
      total_orders: totalPaid,
      paid_orders: totalPaid,
    })
    .eq('id', shift.id)

  if (closeError) return { error: closeError.message }

  return {
    success: true,
    shift_id: shift.id,
    total_revenue: totalRevenue,
    paid_orders: totalPaid,
  }
}

async function createOrder(input: Record<string, unknown>, supabase: SupabaseClient, userId?: string, branchId?: string) {
  // items can arrive as a JSON string (Claude/Gemini) or already-parsed array (Ollama)
  const rawItems = (
    typeof input.items === 'string'
      ? JSON.parse(input.items)
      : input.items
  ) as Array<{ product_id: string; quantity: number }>

  // Fetch product prices
  const productIds = rawItems.map(i => i.product_id)
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, sale_price')
    .in('id', productIds)

  if (prodError) return { error: prodError.message }

  const priceMap = Object.fromEntries((products ?? []).map(p => [p.id, p.sale_price]))
  const orderItems = rawItems.map(item => ({
    product_id:  item.product_id,
    quantity:    item.quantity,
    unit_price:  priceMap[item.product_id] ?? 0,
    subtotal:    (priceMap[item.product_id] ?? 0) * item.quantity,
  }))
  const totalAmount = orderItems.reduce((s, i) => s + i.subtotal, 0)

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      tab_id:       input.tab_id,
      total_amount: totalAmount,
      status:       'pending',
      notes:        input.notes ?? null,
      payment_source: 'agent',
      created_by:     userId ?? null,
      ...(branchId ? { branch_id: branchId } : {}),
    })
    .select()
    .single()

  if (orderError) return { error: orderError.message }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems.map(i => ({ ...i, order_id: order.id })))

  if (itemsError) return { error: itemsError.message }
  return { success: true, order_id: order.id, total_amount: totalAmount }
}

// ── OWNER-ONLY IMPLEMENTATIONS ────────────────────────────────────────────

async function getBranches(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, address, phone, is_active')
    .eq('is_active', true)
    .order('name')
  if (error) return { error: error.message }
  return { branches: data, count: data?.length ?? 0 }
}

async function compareBranchSales(input: Record<string, unknown>, supabase: SupabaseClient) {
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const dateFrom = (input.date_from as string) ?? startOfDay.toISOString()
  const dateTo   = (input.date_to   as string) ?? now.toISOString()

  const { data: branches, error: branchError } = await supabase
    .from('branches')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
  if (branchError) return { error: branchError.message }

  const { data: orders, error: ordError } = await supabase
    .from('orders')
    .select('branch_id, total_amount, discount_amount, status')
    .eq('status', 'paid')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo)
  if (ordError) return { error: ordError.message }

  const { data: openTabs } = await supabase
    .from('tabs')
    .select('branch_id')
    .eq('status', 'open')

  const revenueByBranch: Record<string, { revenue: number; orders: number }> = {}
  for (const o of orders ?? []) {
    const bid = o.branch_id as string
    if (!revenueByBranch[bid]) revenueByBranch[bid] = { revenue: 0, orders: 0 }
    revenueByBranch[bid].revenue += (o.total_amount ?? 0) - (o.discount_amount ?? 0)
    revenueByBranch[bid].orders++
  }

  const openTabsByBranch: Record<string, number> = {}
  for (const t of openTabs ?? []) {
    const bid = t.branch_id as string
    openTabsByBranch[bid] = (openTabsByBranch[bid] ?? 0) + 1
  }

  const comparison = (branches ?? []).map(b => ({
    branch_id:   b.id,
    branch_name: b.name,
    revenue:     revenueByBranch[b.id]?.revenue ?? 0,
    paid_orders: revenueByBranch[b.id]?.orders  ?? 0,
    open_tabs:   openTabsByBranch[b.id] ?? 0,
  })).sort((a, b) => b.revenue - a.revenue)

  return { period: { from: dateFrom, to: dateTo }, comparison }
}
