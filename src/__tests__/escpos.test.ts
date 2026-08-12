import { describe, it, expect } from 'vitest'
import { buildReceiptBytes } from '@/lib/utils/escpos'

// Searches for a UTF-8 text string inside raw ESC/POS bytes
function includesText(arr: Uint8Array, text: string): boolean {
  const needle = new TextEncoder().encode(text)
  outer: for (let i = 0; i <= arr.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (arr[i + j] !== needle[j]) continue outer
    }
    return true
  }
  return false
}

const ESC = 0x1b
const GS  = 0x1d

const baseOrder = {
  order_number: 1,
  discount_amount: 0,
  items: [
    { quantity: 2, subtotal: 40, product: { name: 'Gordita' } },
  ],
}

describe('buildReceiptBytes', () => {
  it('returns a Uint8Array', async () => {
    const result = await buildReceiptBytes('Mesa 1', [baseOrder], 40)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBeGreaterThan(0)
  })

  it('begins with ESC INIT command', async () => {
    const result = await buildReceiptBytes('Mesa 1', [baseOrder], 40)
    expect(result[0]).toBe(ESC)
    expect(result[1]).toBe(0x40)
  })

  it('ends with partial-cut command', async () => {
    const result = await buildReceiptBytes('Mesa 1', [baseOrder], 40)
    const last4 = Array.from(result.slice(-4))
    expect(last4).toEqual([GS, 0x56, 0x41, 0x00])
  })

  it('uses custom restaurant name when provided', async () => {
    const result = await buildReceiptBytes('Mesa 1', [baseOrder], 40, {
      restaurantName: 'TestResto',
    })
    expect(includesText(result, 'TestResto')).toBe(true)
  })

  it('defaults to "Gorditas Dona Felix" when no settings', async () => {
    const result = await buildReceiptBytes('Mesa 1', [baseOrder], 40)
    expect(includesText(result, 'Gorditas Dona Felix')).toBe(true)
  })

  it('includes the tab label in the output', async () => {
    const result = await buildReceiptBytes('Mesa 5', [baseOrder], 40)
    expect(includesText(result, 'Mesa 5')).toBe(true)
  })

  it('includes TOTAL and the formatted amount', async () => {
    const result = await buildReceiptBytes('Mesa 1', [baseOrder], 99.50)
    expect(includesText(result, 'TOTAL')).toBe(true)
    expect(includesText(result, '99.50')).toBe(true)
  })

  it('labels order_number 0 as "Pedido en curso"', async () => {
    const order = { order_number: 0, discount_amount: 0, items: [] }
    const result = await buildReceiptBytes('Mostrador', [order], 0)
    expect(includesText(result, 'Pedido en curso')).toBe(true)
  })

  it('labels positive order numbers as "Pedido #N"', async () => {
    const result = await buildReceiptBytes('Mesa 1', [baseOrder], 40)
    expect(includesText(result, 'Pedido #1')).toBe(true)
  })

  it('includes discount line when discount_amount > 0', async () => {
    const order = { ...baseOrder, discount_amount: 5 }
    const result = await buildReceiptBytes('Mesa 1', [order], 35)
    expect(includesText(result, 'Descuento')).toBe(true)
    expect(includesText(result, '5.00')).toBe(true)
  })

  it('does not include discount line when discount_amount is 0', async () => {
    const result = await buildReceiptBytes('Mesa 1', [baseOrder], 40)
    expect(includesText(result, 'Descuento')).toBe(false)
  })

  it('normalizes Spanish characters to ASCII equivalents', async () => {
    const result = await buildReceiptBytes('Mesa 1', [baseOrder], 40, {
      restaurantName: 'Taquerías Ñoño',
    })
    expect(includesText(result, 'Taquerias Nono')).toBe(true)
    expect(includesText(result, 'Taquerías')).toBe(false)
  })

  it('includes 32-character separator lines', async () => {
    const result = await buildReceiptBytes('Mesa 1', [baseOrder], 40)
    expect(includesText(result, '--------------------------------')).toBe(true)
  })

  it('includes instagram handle in settings', async () => {
    const result = await buildReceiptBytes('Mesa 1', [baseOrder], 40, {
      instagram: 'gorditas',
    })
    expect(includesText(result, 'IG: @gorditas')).toBe(true)
  })

  it('handles multiple orders in one receipt', async () => {
    const orders = [
      { order_number: 1, discount_amount: 0, items: [{ quantity: 1, subtotal: 20, product: { name: 'Taco' } }] },
      { order_number: 2, discount_amount: 0, items: [{ quantity: 2, subtotal: 40, product: { name: 'Gordita' } }] },
    ]
    const result = await buildReceiptBytes('Mesa 3', orders, 60)
    expect(includesText(result, 'Pedido #1')).toBe(true)
    expect(includesText(result, 'Pedido #2')).toBe(true)
    expect(includesText(result, 'Taco')).toBe(true)
    expect(includesText(result, 'Gordita')).toBe(true)
  })

  it('includes item notes when present', async () => {
    const order = {
      order_number: 1,
      discount_amount: 0,
      items: [{ quantity: 1, subtotal: 20, notes: 'sin chile', product: { name: 'Taco' } }],
    }
    const result = await buildReceiptBytes('Mesa 1', [order], 20)
    expect(includesText(result, 'sin chile')).toBe(true)
  })
})
