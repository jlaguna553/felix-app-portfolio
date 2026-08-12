import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { matchPromotions } from '@/lib/utils/promotions'
import type { CartItem, Promotion, PromotionItem } from '@/lib/types'

// ── Factories ─────────────────────────────────────────────────────────────────

function makeProduct(id: string) {
  return {
    id,
    name: `Producto ${id}`,
    sale_price: 20,
    category_id: null,
    image_url: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    variants: null,
  }
}

function makeCartItem(productId: string, quantity: number): CartItem {
  return { product: makeProduct(productId), quantity }
}

function makePromotionItem(productId: string, quantity: number): PromotionItem {
  return { id: `pitem-${productId}`, promotion_id: 'promo-1', product_id: productId, quantity }
}

function makePromotion(overrides: Partial<Promotion> & { items: PromotionItem[] }): Promotion {
  return {
    id: 'promo-1',
    name: 'Test Promo',
    description: null,
    discount_type: 'fixed',
    discount_value: 10,
    schedule_type: 'all_day',
    start_time: null,
    end_time: null,
    is_active: true,
    pool_quantity: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('matchPromotions', () => {
  it('returns empty array when promotions list is empty', () => {
    expect(matchPromotions([makeCartItem('p1', 2)], [], 40)).toEqual([])
  })

  it('returns empty array when cart is empty', () => {
    const promo = makePromotion({ items: [makePromotionItem('p1', 1)] })
    expect(matchPromotions([], [promo], 0)).toEqual([])
  })

  it('skips inactive promotions', () => {
    const promo = makePromotion({ is_active: false, items: [makePromotionItem('p1', 1)] })
    expect(matchPromotions([makeCartItem('p1', 1)], [promo], 20)).toEqual([])
  })

  it('skips promotions with empty items list', () => {
    const promo = makePromotion({ items: [] })
    expect(matchPromotions([makeCartItem('p1', 1)], [promo], 20)).toEqual([])
  })

  describe('standard mode (no pool_quantity)', () => {
    it('applies fixed discount and returns enabled=true', () => {
      const promo = makePromotion({ discount_value: 15, items: [makePromotionItem('p1', 1)] })
      const result = matchPromotions([makeCartItem('p1', 1)], [promo], 20)
      expect(result).toHaveLength(1)
      expect(result[0].discountAmount).toBe(15)
      expect(result[0].times).toBe(1)
      expect(result[0].enabled).toBe(true)
      expect(result[0].promotion.id).toBe('promo-1')
    })

    it('applies times = floor(qty / required) for fixed discount', () => {
      const promo = makePromotion({ discount_value: 15, items: [makePromotionItem('p1', 1)] })
      const result = matchPromotions([makeCartItem('p1', 3)], [promo], 60)
      expect(result[0].times).toBe(3)
      expect(result[0].discountAmount).toBe(45) // 15 * 3
    })

    it('times = min across all required products', () => {
      const promo = makePromotion({
        items: [makePromotionItem('p1', 2), makePromotionItem('p2', 1)],
      })
      const items = [makeCartItem('p1', 6), makeCartItem('p2', 5)] // p1: 3×, p2: 5× → min=3
      const result = matchPromotions(items, [promo], 220)
      expect(result[0].times).toBe(3)
    })

    it('skips when cart has fewer units than required', () => {
      const promo = makePromotion({ items: [makePromotionItem('p1', 3)] })
      const result = matchPromotions([makeCartItem('p1', 2)], [promo], 40)
      expect(result).toHaveLength(0)
    })

    it('skips when a required product is missing from cart', () => {
      const promo = makePromotion({ items: [makePromotionItem('p2', 1)] })
      const result = matchPromotions([makeCartItem('p1', 1)], [promo], 20)
      expect(result).toHaveLength(0)
    })

    it('skips when one of multiple required products is missing', () => {
      const promo = makePromotion({
        items: [makePromotionItem('p1', 1), makePromotionItem('p2', 1)],
      })
      const result = matchPromotions([makeCartItem('p1', 2)], [promo], 40)
      expect(result).toHaveLength(0)
    })

    it('applies percent discount based on subtotal', () => {
      const promo = makePromotion({
        discount_type: 'percent',
        discount_value: 10,
        items: [makePromotionItem('p1', 1)],
      })
      const result = matchPromotions([makeCartItem('p1', 1)], [promo], 100)
      expect(result[0].discountAmount).toBe(10) // 10% of 100
    })

    it('rounds percent discount to 2 decimal places', () => {
      const promo = makePromotion({
        discount_type: 'percent',
        discount_value: 15,
        items: [makePromotionItem('p1', 1)],
      })
      const result = matchPromotions([makeCartItem('p1', 1)], [promo], 99.99)
      // 15% of 99.99 = 14.9985 → rounded to 15.00
      expect(result[0].discountAmount).toBe(15)
    })
  })

  describe('pool mode (pool_quantity set)', () => {
    it('applies once when combined qty meets pool_quantity', () => {
      const promo = makePromotion({
        pool_quantity: 2,
        items: [makePromotionItem('p1', 1), makePromotionItem('p2', 1)],
      })
      const items = [makeCartItem('p1', 1), makeCartItem('p2', 1)] // 2 total → 1 application
      const result = matchPromotions(items, [promo], 40)
      expect(result).toHaveLength(1)
      expect(result[0].times).toBe(1)
    })

    it('skips when combined qty is below pool_quantity', () => {
      const promo = makePromotion({
        pool_quantity: 3,
        items: [makePromotionItem('p1', 1), makePromotionItem('p2', 1)],
      })
      const items = [makeCartItem('p1', 1), makeCartItem('p2', 1)] // 2 total < 3
      expect(matchPromotions(items, [promo], 40)).toHaveLength(0)
    })

    it('applies multiple times via floor division', () => {
      const promo = makePromotion({
        pool_quantity: 2,
        discount_value: 5,
        items: [makePromotionItem('p1', 1), makePromotionItem('p2', 1)],
      })
      const items = [makeCartItem('p1', 3), makeCartItem('p2', 2)] // 5 total → 2 applications
      const result = matchPromotions(items, [promo], 100)
      expect(result[0].times).toBe(2)
      expect(result[0].discountAmount).toBe(10) // 5 × 2
    })

    it('counts only listed products toward pool total', () => {
      const promo = makePromotion({
        pool_quantity: 3,
        items: [makePromotionItem('p1', 1)], // only p1 counts
      })
      const items = [makeCartItem('p1', 2), makeCartItem('p2', 5)] // p2 is not listed
      expect(matchPromotions(items, [promo], 140)).toHaveLength(0) // only 2 eligible
    })
  })

  describe('window schedule', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('applies promo when current time is inside the window', () => {
      vi.setSystemTime(new Date('2024-01-15T14:30:00'))
      const promo = makePromotion({
        schedule_type: 'window',
        start_time: '13:00',
        end_time: '16:00',
        items: [makePromotionItem('p1', 1)],
      })
      const result = matchPromotions([makeCartItem('p1', 1)], [promo], 20)
      expect(result).toHaveLength(1)
    })

    it('skips promo when current time is before the window', () => {
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      const promo = makePromotion({
        schedule_type: 'window',
        start_time: '13:00',
        end_time: '16:00',
        items: [makePromotionItem('p1', 1)],
      })
      expect(matchPromotions([makeCartItem('p1', 1)], [promo], 20)).toHaveLength(0)
    })

    it('skips promo when current time is after the window', () => {
      vi.setSystemTime(new Date('2024-01-15T17:00:00'))
      const promo = makePromotion({
        schedule_type: 'window',
        start_time: '13:00',
        end_time: '16:00',
        items: [makePromotionItem('p1', 1)],
      })
      expect(matchPromotions([makeCartItem('p1', 1)], [promo], 20)).toHaveLength(0)
    })

    it('all_day promotions ignore time and always match', () => {
      vi.setSystemTime(new Date('2024-01-15T03:00:00')) // 3am — odd hour
      const promo = makePromotion({
        schedule_type: 'all_day',
        start_time: '13:00',
        end_time: '16:00',
        items: [makePromotionItem('p1', 1)],
      })
      const result = matchPromotions([makeCartItem('p1', 1)], [promo], 20)
      expect(result).toHaveLength(1)
    })
  })

  it('returns multiple applied promotions when several match', () => {
    const promo1 = makePromotion({ id: 'promo-a', items: [makePromotionItem('p1', 1)] })
    const promo2 = makePromotion({ id: 'promo-b', discount_value: 5, items: [makePromotionItem('p2', 1)] })
    const items = [makeCartItem('p1', 1), makeCartItem('p2', 1)]
    const result = matchPromotions(items, [promo1, promo2], 40)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.promotion.id)).toContain('promo-a')
    expect(result.map(r => r.promotion.id)).toContain('promo-b')
  })
})
