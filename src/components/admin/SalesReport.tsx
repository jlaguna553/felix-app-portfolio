'use client'

import { Order, ProductMargin } from '@/lib/types'
import { TrendingUp, TrendingDown, Download } from 'lucide-react'
import { downloadCsv } from '@/lib/utils/csv'

interface Props {
  orders: Order[]
  margins: ProductMargin[]
}

export function SalesReport({ orders, margins }: Props) {
  const totalRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0)

  function exportOrders() {
    downloadCsv(
      `ventas-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Fecha', 'Pedido #', 'Mesa/Cliente', 'Total', 'Descuento', 'Cajero'],
      orders.map(o => [
        new Date(o.created_at).toLocaleString('es-MX'),
        o.order_number,
        o.table_number ?? '',
        o.total_amount,
        o.discount_amount ?? 0,
        o.profile?.full_name ?? '',
      ])
    )
  }

  function exportMargins() {
    downloadCsv(
      `margenes-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Producto', 'Precio venta', 'Costo', 'Utilidad', '% Margen'],
      margins.map(m => [m.name, m.sale_price, m.cost, m.margin, m.margin_percent])
    )
  }

  return (
    <div className="space-y-6">
      {/* Revenue summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-semibold text-stone-700 mb-1">Últimas 100 ventas</h2>
          <div className="text-3xl font-bold text-amber-700">${totalRevenue.toFixed(2)}</div>
          <p className="text-sm text-stone-400 mt-0.5">{orders.length} órdenes pagadas</p>
        </div>
        <button
          onClick={exportOrders}
          className="flex items-center gap-2 border border-stone-300 text-stone-600 hover:bg-stone-50 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" /> Exportar ventas CSV
        </button>
      </div>

      {/* Margins table */}
      {margins.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-stone-700">Margen por producto</h2>
            <button
              onClick={exportMargins}
              className="flex items-center gap-2 border border-stone-300 text-stone-600 hover:bg-stone-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-stone-500 uppercase text-xs">
                <tr>
                  {['Producto', 'Precio venta', 'Costo', 'Utilidad', '% Margen'].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {margins.map(m => (
                  <tr key={m.product_id} className="hover:bg-stone-50">
                    <td className="px-5 py-3 font-medium text-stone-800">{m.name}</td>
                    <td className="px-5 py-3 text-stone-600">${m.sale_price.toFixed(2)}</td>
                    <td className="px-5 py-3 text-stone-600">${m.cost.toFixed(2)}</td>
                    <td className={`px-5 py-3 font-semibold ${m.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${m.margin.toFixed(2)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        {m.margin_percent >= 0
                          ? <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                          : <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                        }
                        <span className={m.margin_percent >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {m.margin_percent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent orders */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="font-semibold text-stone-700">Órdenes recientes</h2>
        </div>
        <div className="divide-y divide-stone-100">
          {orders.slice(0, 20).map(o => (
            <div key={o.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-800">
                  {new Date(o.created_at).toLocaleString('es-MX')}
                  {o.table_number && <span className="text-stone-400 ml-2">· {o.table_number}</span>}
                </p>
                <p className="text-xs text-stone-400">{o.profile?.full_name ?? 'Usuario'}</p>
              </div>
              <span className="text-sm font-bold text-amber-700">${o.total_amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
