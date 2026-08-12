# Felix App — POS para restaurantes

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
![License](https://img.shields.io/badge/Licencia-MIT-green?style=for-the-badge)

> **Sistema de punto de venta completo para restaurantes: POS, cocina, inventario, recetas, caja y promociones en una sola app.**

Felix App es un **POS (Point of Sale)** integral para restaurantes construido con Next.js. Cubre todo el ciclo operativo: el punto de venta donde se registran órdenes, la pantalla de cocina que recibe los pedidos en tiempo real, la administración de productos, inventario, recetas, caja y promociones — con soporte multi-sucursal.

## ✨ Características

- **🖥 Punto de venta (POS)** — registro de órdenes rápido, con manejo de pagos pendientes y descarte de ventas
- **👨‍🍳 Pantalla de cocina** — los pedidos llegan a la cocina organizados y con su estado
- **📦 Inventario** — control de stock con alertas y ajustes
- **🧾 Recetas** — define los ingredientes de cada platillo y su costo
- **💰 Caja** — apertura, cierre y control de movimientos de efectivo
- **🏷 Promociones** — descuentos y ofertas configurables
- **📊 Dashboard** — métricas de ventas y operación en tiempo real
- **🏪 Multi-sucursal** — selector de sucursal (`select-branch`) para operar varios locales
- **🔐 Autenticación** — login con roles y rutas protegidas por grupo
- **📱 PWA** — instalable en móviles y tablets con manifest propio

## 🛠 Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js (App Router) |
| UI | React 19 + Tailwind CSS |
| Lenguaje | TypeScript |
| Estructura | Route groups: `(pos)`, `(kitchen)`, `(admin)`, `(auth)` |
| PWA | Manifest + configuración de instalación |

## 🚀 Inicio rápido

```bash
npm install
npm run dev
# http://localhost:3000
```

## 📁 Estructura

```
felix-app/
└── src/
    └── app/
        ├── (pos)/            # Punto de venta
        │   └── pos/
        ├── (kitchen)/        # Pantalla de cocina
        ├── (admin)/
        │   ├── dashboard/    # Métricas de ventas
        │   ├── products/     # Catálogo de productos
        │   ├── inventory/    # Control de stock
        │   ├── recipes/      # Recetas e ingredientes
        │   ├── orders/       # Gestión de órdenes
        │   ├── caja/         # Control de caja
        │   ├── promotions/   # Promociones y descuentos
        │   └── settings/     # Configuración
        ├── (auth)/           # Login y autenticación
        ├── select-branch/    # Selector de sucursal
        ├── api/              # Route handlers (backend)
        └── manifest.ts       # PWA manifest
```

## 🧠 Detalles técnicos

- **Route groups** de Next.js para separar las tres experiencias (POS, cocina, admin) con layouts propios, pero compartiendo la misma app.
- La **autenticación por grupo de rutas** protege cada área según el rol del usuario.
- El **flujo de pagos pendientes** permite registrar una venta y cobrarla después, con descarte controlado de ventas.

<!-- Agrega capturas en docs/screenshots/ -->

---

## Desarrollado por Francisco Javier Laguna

Full-stack developer · React · Vue · .NET · PHP

[GitHub](https://github.com/jlaguna553) · [LinkedIn](https://www.linkedin.com/in/francisco-javier-laguna-mondrag%C3%B3n-80a798154/) · [CV Online](https://cv-online.jlaguna553.workers.dev/v/xrdcnyej)
