import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cocina — Doña Félix',
}

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-900 text-white">
      {children}
    </div>
  )
}
