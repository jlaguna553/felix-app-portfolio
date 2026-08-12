import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Gorditas Doña Félix',
    short_name: 'Doña Félix',
    description: 'Sistema POS & ERP para Gorditas Doña Félix',
    start_url: '/pos',
    scope: '/',
    display: 'standalone',
    background_color: '#fafaf9',
    theme_color: '#b45309',
    orientation: 'portrait',
    categories: ['food', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
