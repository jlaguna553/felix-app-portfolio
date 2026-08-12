export type UserRole = 'owner' | 'admin' | 'waiter' | 'kitchen' | 'cashier'

export interface Branch {
  id: string
  name: string
  address: string | null
  phone: string | null
  business_name: string
  business_type: string
  business_description: string
  ai_business_context: string
  ai_last_trained_at: string | null
  is_active: boolean
  created_at: string
}

export interface Shift {
  id: string
  opened_at: string
  closed_at: string | null
  status: 'open' | 'closed'
  total_orders: number
  paid_orders: number
  cancelled_orders: number
  total_revenue: number
  notes: string | null
  opened_by: string | null
  closed_by: string | null
}

export interface Tab {
  id: string
  label: string
  opened_by: string
  opened_at: string
  status: 'open' | 'closed'
  closed_at: string | null
  type: 'table' | 'client' | 'mostrador'
  source?: 'pos' | 'agent'
  last_attended_at?: string | null
  pending_payment?: boolean
}

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  pin_code: string | null
  branch_id: string | null
  created_at: string
}

export interface Supply {
  id: string
  name: string
  unit: 'gr' | 'ml' | 'pza'
  current_stock: number
  min_stock: number
  unit_cost: number
  created_at: string
}

export interface Category {
  id: string
  name: string
  emoji: string | null
  sort_order: number
}

export interface Product {
  id: string
  name: string
  sale_price: number
  category_id: string | null
  category?: Category
  image_url: string | null
  is_active: boolean
  created_at: string
  variants: string[] | null
}

export interface RecipeItem {
  id: string
  product_id: string
  supply_id: string
  quantity: number
  supply?: Supply
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'paid' | 'cancelled'

export interface Order {
  id: string
  order_number: number
  created_at: string
  created_by: string
  profile?: Profile
  total_amount: number
  status: OrderStatus
  table_number: string | null
  notes: string | null
  tab_id: string | null
  tab?: Tab
  discount_amount: number
  payment_source?: 'pos' | 'caja' | 'agent' | 'pendiente' | null
  prepaid?: boolean
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  product?: Product
  quantity: number
  unit_price: number
  subtotal: number
  notes: string | null
}

export interface CartItem {
  product: Product
  quantity: number
  notes?: string
}

export type DiscountType = 'fixed' | 'percent'
export type ScheduleType = 'all_day' | 'window'

export interface PromotionItem {
  id: string
  promotion_id: string
  product_id: string
  product?: Product
  quantity: number
}

export interface Promotion {
  id: string
  name: string
  description: string | null
  discount_type: DiscountType
  discount_value: number
  schedule_type: ScheduleType
  start_time: string | null
  end_time: string | null
  is_active: boolean
  pool_quantity: number | null
  created_at: string
  items?: PromotionItem[]
}

export interface AppliedPromotion {
  promotion: Promotion
  discountAmount: number
  times: number
  enabled: boolean
}

export interface TableRecord {
  id: string
  number: number
  pos_x: number
  pos_y: number
  created_at: string
}

export interface ProductMargin {
  product_id: string
  name: string
  sale_price: number
  cost: number
  margin: number
  margin_percent: number
}

// ── Menu Builder ───────────────────────────────────────────────────────────────

export type MenuElementType = 'product' | 'text' | 'image' | 'line' | 'shape'

export interface MenuElementConfig {
  // product
  productId?: string
  productName?: string
  productPrice?: number
  productImageUrl?: string | null
  showImage?: boolean
  showPrice?: boolean
  showDescription?: boolean
  // text
  text?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  color?: string
  textAlign?: 'left' | 'center' | 'right'
  italic?: boolean
  fontFamily?: string
  // image
  imageUrl?: string
  objectFit?: 'cover' | 'contain'
  opacity?: number
  // line
  orientation?: 'horizontal' | 'vertical'
  thickness?: number
  lineColor?: string
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  // shape
  shapeType?: 'rectangle' | 'circle'
  fillColor?: string
  borderColor?: string
  borderRadius?: number
  borderWidth?: number
}

export interface MenuElement {
  id: string
  menu_id: string
  type: MenuElementType
  x: number
  y: number
  width: number
  height: number
  z_index: number
  config: MenuElementConfig
}

export interface Menu {
  id: string
  branch_id: string
  name: string
  bg_color: string
  bg_image_url: string | null
  created_at: string
  updated_at: string
}
