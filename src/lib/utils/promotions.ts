import type { CartItem, Promotion, AppliedPromotion } from '@/lib/types'

export function matchPromotions(
  items: CartItem[],
  promotions: Promotion[],
  subtotal: number,
): AppliedPromotion[] {
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()

  const qtyMap = new Map<string, number>()
  for (const item of items) {
    qtyMap.set(item.product.id, (qtyMap.get(item.product.id) ?? 0) + item.quantity)
  }

  const result: AppliedPromotion[] = []
  for (const p of promotions) {
    if (!p.is_active || !p.items || p.items.length === 0) continue
    if (p.schedule_type === 'window' && p.start_time && p.end_time) {
      const [sh, sm] = p.start_time.split(':').map(Number)
      const [eh, em] = p.end_time.split(':').map(Number)
      if (nowMins < sh * 60 + sm || nowMins > eh * 60 + em) continue
    }

    let times: number
    if (p.pool_quantity) {
      const totalEligible = p.items.reduce((s, req) => s + (qtyMap.get(req.product_id) ?? 0), 0)
      if (totalEligible < p.pool_quantity) continue
      times = Math.floor(totalEligible / p.pool_quantity)
    } else {
      if (!p.items.every(req => (qtyMap.get(req.product_id) ?? 0) >= req.quantity)) continue
      times = Math.min(...p.items.map(req => Math.floor((qtyMap.get(req.product_id) ?? 0) / req.quantity)))
    }

    const discountAmount = p.discount_type === 'fixed'
      ? p.discount_value * times
      : Math.round(subtotal * p.discount_value / 100 * 100) / 100
    result.push({ promotion: p, discountAmount, times, enabled: true })
  }
  return result
}
