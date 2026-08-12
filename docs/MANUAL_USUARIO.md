# Manual de Usuario — Sistema Felix

**Sistema POS + ERP para restaurantes**
Versión 1.0 · Gorditas Doña Félix

---

## Tabla de contenidos

1. [Introducción](#1-introducción)
2. [Roles del sistema](#2-roles-del-sistema)
3. [Primer acceso — Login](#3-primer-acceso--login)
4. [Propietario (Owner)](#4-propietario-owner)
   - 4.1 [Selección de sucursal](#41-selección-de-sucursal)
   - 4.2 [Gestión de sucursales](#42-gestión-de-sucursales)
   - 4.3 [Comparativa entre sucursales](#43-comparativa-entre-sucursales)
   - 4.4 [Cambiar de sucursal activa](#44-cambiar-de-sucursal-activa)
5. [Administrador (Admin)](#5-administrador-admin)
   - 5.1 [Dashboard](#51-dashboard)
   - 5.2 [Productos y Categorías](#52-productos-y-categorías)
   - 5.3 [Inventario y Recetas](#53-inventario-y-recetas)
   - 5.4 [Promociones](#54-promociones)
   - 5.5 [Pedidos](#55-pedidos)
   - 5.6 [Reportes](#56-reportes)
   - 5.7 [Usuarios](#57-usuarios)
   - 5.8 [Caja](#58-caja)
   - 5.9 [Salón (Floor Plan)](#59-salón-floor-plan)
   - 5.10 [Corte de caja](#510-corte-de-caja)
   - 5.11 [Asistente IA](#511-asistente-ia)
   - 5.12 [Configuración (IA y sistema)](#512-configuración-ia-y-sistema)
6. [Mesero (Waiter)](#6-mesero-waiter)
   - 6.1 [Punto de venta (POS)](#61-punto-de-venta-pos)
   - 6.2 [Salón — vista del mesero](#62-salón--vista-del-mesero)
7. [Cocina (Kitchen)](#7-cocina-kitchen)
8. [Cajero (Cashier)](#8-cajero-cashier)
9. [Instalación como app (PWA)](#9-instalación-como-app-pwa)
10. [Preguntas frecuentes](#10-preguntas-frecuentes)

---

## 1. Introducción

**Felix** es un sistema de punto de venta y gestión de restaurante diseñado para taquerías y fondas. Funciona directamente desde el navegador (Chrome, Safari, Edge) y puede instalarse como aplicación en celulares y tabletas sin necesidad de descargar nada de una tienda de aplicaciones.

### ¿Qué puede hacer el sistema?

| Módulo | Descripción |
|--------|-------------|
| POS | Tomar pedidos por mesa o cliente |
| Salón | Ver el estado de todas las mesas en tiempo real |
| Cocina | Pantalla de comandas para el cocinero |
| Caja | Abrir/cerrar turnos y cobrar |
| Inventario | Control de insumos y recetas |
| Reportes | Ventas, márgenes y métricas |
| Asistente IA | Chatbot para consultas y acciones por voz/texto |
| Multi-sucursal | Gestión de varias ubicaciones desde una sola cuenta |

---

## 2. Roles del sistema

El sistema tiene **5 roles**. Cada rol tiene acceso solo a las pantallas que necesita:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ROL          │ ACCESO                                                │
├─────────────────────────────────────────────────────────────────────┤
│ 👑 Owner     │ Todo + gestión de sucursales + comparativas           │
│ 🔧 Admin     │ Panel completo de su sucursal (productos, caja, IA…)  │
│ 🛎️ Mesero    │ POS + Salón                                           │
│ 👨‍🍳 Cocina   │ Pantalla de comandas                                  │
│ 💰 Cajero    │ Caja + Salón                                          │
└─────────────────────────────────────────────────────────────────────┘
```

> **Importante:** Los roles se asignan al crear el usuario desde el módulo de **Usuarios**. Solo el admin y el owner pueden crear usuarios.

---

## 3. Primer acceso — Login

### Pantalla de inicio de sesión

```
┌──────────────────────────────────────────┐
│                                          │
│         🌮  Sistema Felix                │
│                                          │
│   ┌────────────────────────────────┐     │
│   │  correo@ejemplo.com            │     │
│   └────────────────────────────────┘     │
│   ┌────────────────────────────────┐     │
│   │  ••••••••                      │     │
│   └────────────────────────────────┘     │
│                                          │
│   [ Iniciar sesión ]                     │
│                                          │
└──────────────────────────────────────────┘
```

1. Abre el sistema en tu navegador (la URL que te proporcionó el administrador).
2. Ingresa tu **correo electrónico** y **contraseña**.
3. Presiona **Iniciar sesión**.

**Después del login:**
- **Owner** → Ve a la pantalla de selección de sucursal.
- **Admin / Mesero / Cajero / Cocina** → Entra directamente a su sucursal asignada.

> Si olvidaste tu contraseña, pide al administrador que la restablezca desde el módulo de Usuarios.

---

## 4. Propietario (Owner)

El propietario tiene acceso a **todas las sucursales**. Al iniciar sesión, primero debe seleccionar con cuál sucursal trabajar.

### 4.1 Selección de sucursal

```
┌───────────────────────────────────────────────────────┐
│           Selecciona tu sucursal                      │
│                                                       │
│  ┌──────────────────┐   ┌──────────────────┐          │
│  │                  │   │                  │          │
│  │   🏠 Principal   │   │  🏠 Sucursal Norte│          │
│  │   Activa ✓       │   │   Activa ✓       │          │
│  │                  │   │                  │          │
│  └──────────────────┘   └──────────────────┘          │
│                                                       │
│  ┌──────────────────┐                                 │
│  │  🏠 Sucursal Sur  │                                 │
│  │  Inactiva        │                                 │
│  └──────────────────┘                                 │
└───────────────────────────────────────────────────────┘
```

- Toca o haz clic en la sucursal que quieres gestionar.
- Quedarás en esa sucursal hasta que la cambies.

---

### 4.2 Gestión de sucursales

**Ruta:** Menú lateral → **Sucursales**

Aquí puedes **agregar, editar y activar/desactivar** sucursales.

```
┌───────────────────────────────────────────────────────────┐
│ Sucursales                            [ + Nueva sucursal] │
├───────────────────────────────────────────────────────────┤
│ Principal                 Activa  [Editar]  [Desactivar]  │
│ 📍 Calle Morelos 10                                       │
├───────────────────────────────────────────────────────────┤
│ Sucursal Norte            Activa  [Editar]  [Desactivar]  │
│ 📍 Av. Hidalgo 45                                         │
├───────────────────────────────────────────────────────────┤
│ Sucursal Sur             Inactiva [Editar]  [Activar]     │
│ 📍 Blvd. Juárez 80                                        │
└───────────────────────────────────────────────────────────┘
```

**Para crear una sucursal:**
1. Presiona **+ Nueva sucursal**.
2. Llena el formulario: nombre, dirección, teléfono.
3. Guarda los cambios.

**Para editar:**
1. Presiona **Editar** en la fila de la sucursal.
2. Modifica los datos y guarda.

**Para desactivar:** Presiona **Desactivar**. Las sucursales inactivas no aparecen en la selección de sucursal pero sus datos se conservan.

---

### 4.3 Comparativa entre sucursales

**Ruta:** Menú lateral → **Comparar sucursales**

Visualiza las ventas de todas las sucursales activas en un mismo panel.

```
┌─────────────────────────────────────────────────────────┐
│ Comparativa de ventas          [Hoy] [Semana] [Mes]     │
├───────────────┬───────────────┬──────────────────────────┤
│ Sucursal      │ Pedidos       │ Total ventas             │
├───────────────┼───────────────┼──────────────────────────┤
│ Principal     │ 48            │ $4,320.00                │
│ Norte         │ 31            │ $2,890.00                │
│ Sur           │ 22            │ $1,750.00                │
├───────────────┼───────────────┼──────────────────────────┤
│ TOTAL         │ 101           │ $8,960.00                │
└───────────────┴───────────────┴──────────────────────────┘
```

- Alterna entre **Hoy / Semana / Mes** con los botones superiores.
- Útil para identificar qué sucursal tiene mayor rendimiento.

---

### 4.4 Cambiar de sucursal activa

En el **menú lateral**, en la parte inferior, aparece un selector de sucursal:

```
┌──────────────────────────────┐
│ 🏠 Principal          ▼      │
└──────────────────────────────┘
```

Haz clic y selecciona otra sucursal. **Todo el panel cambia** para mostrar los datos de la nueva sucursal seleccionada.

---

## 5. Administrador (Admin)

El administrador gestiona todos los aspectos de su sucursal asignada.

### Menú lateral del admin

```
┌──────────────────────┐
│  🌮 Felix            │
│  ─────────────────   │
│  📊 Dashboard        │
│  🛒 Productos        │
│  🗂️ Categorías       │
│  📦 Inventario       │
│  📋 Recetas          │
│  🏷️ Promociones      │
│  📑 Pedidos          │
│  📈 Reportes         │
│  👥 Usuarios         │
│  💰 Caja             │
│  🗺️ Salón            │
│  🗃️ Corte de caja    │
│  🤖 Asistente IA     │
│  ⚙️ Configuración    │
│  ─────────────────   │
│  🏠 Principal   ▼    │  ← solo para owner
└──────────────────────┘
```

---

### 5.1 Dashboard

**Ruta:** Menú lateral → **Dashboard**

Vista rápida de las métricas del turno activo.

```
┌────────────────────────────────────────────────────────────┐
│ Dashboard                                                  │
├──────────────┬──────────────┬──────────────┬───────────────┤
│  Ventas hoy  │  Pedidos     │ Mesas activas│ Turno         │
│  $2,450.00   │  38          │  5 / 12      │  Abierto      │
└──────────────┴──────────────┴──────────────┴───────────────┘
│                                                            │
│  Ventas por categoría          Productos más vendidos      │
│  ┌─────────────────────────┐   ┌─────────────────────────┐ │
│  │ Gorditas  ████████ 45% │   │ 1. Gordita de chicharrón│ │
│  │ Bebidas   ████   25%   │   │ 2. Agua de horchata     │ │
│  │ Extras    ██     15%   │   │ 3. Taco de asada        │ │
│  └─────────────────────────┘   └─────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

### 5.2 Productos y Categorías

#### Categorías

**Ruta:** Menú lateral → **Categorías**

```
┌──────────────────────────────────────────────┐
│ Categorías                  [+ Nueva]        │
├──────────────────────────────────────────────┤
│  🌮 Gorditas          [Editar] [Eliminar]    │
│  🌯 Tacos             [Editar] [Eliminar]    │
│  🥤 Bebidas           [Editar] [Eliminar]    │
│  🍟 Extras            [Editar] [Eliminar]    │
└──────────────────────────────────────────────┘
```

**Para agregar una categoría:**
1. Presiona **+ Nueva**.
2. Escribe el nombre y selecciona un emoji.
3. Guarda.

#### Productos

**Ruta:** Menú lateral → **Productos**

```
┌───────────────────────────────────────────────────────────┐
│ Productos                                   [+ Nuevo]     │
├───────────────────────────────────────────────────────────┤
│ [Todas] [Gorditas] [Tacos] [Bebidas] [Extras]             │
├───────────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│ │ [foto]       │  │ [foto]       │  │ [foto]       │      │
│ │ Gordita de   │  │ Gordita de   │  │ Taco de      │      │
│ │ chicharrón   │  │ frijol       │  │ asada        │      │
│ │ $20.00 ✓    │  │ $18.00 ✓    │  │ $16.00 ✓    │      │
│ │ [Ed][Del]    │  │ [Ed][Del]    │  │ [Ed][Del]    │      │
│ └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────────────────────────────────────┘
```

**Para agregar un producto:**
1. Presiona **+ Nuevo**.
2. Llena el formulario:
   - **Nombre** del producto.
   - **Categoría** a la que pertenece.
   - **Precio de venta**.
   - **Foto** (opcional — puedes subir una imagen).
   - **Variantes** (opcional — ej: tamaño chico/grande con precios distintos).
3. Guarda.

**Para editar un producto:** Presiona el ícono de edición en la tarjeta.

**Para desactivar un producto:** Usa el toggle de activo/inactivo. Los productos inactivos no aparecen en el POS.

#### Variantes de producto

Al crear o editar un producto, puedes agregar variantes:

```
Variantes:
  [+ Agregar variante]

  Variante 1:  Nombre: [Chico    ]  Precio: [$16.00]  [x]
  Variante 2:  Nombre: [Grande   ]  Precio: [$22.00]  [x]
```

En el POS, al agregar un producto con variantes, aparecerá un selector para elegir cuál.

---

### 5.3 Inventario y Recetas

#### Inventario (Insumos)

**Ruta:** Menú lateral → **Inventario**

```
┌───────────────────────────────────────────────────────────┐
│ Inventario                                   [+ Insumo]  │
├─────────────────┬─────────────┬──────────────┬────────────┤
│ Insumo          │ Stock actual│ Unidad       │ Costo      │
├─────────────────┼─────────────┼──────────────┼────────────┤
│ Masa de maíz    │ 15.0 kg     │ kg           │ $22.00/kg  │
│ Chicharrón      │ 3.5 kg      │ kg           │ $85.00/kg  │
│ Frijoles        │ 8.0 kg      │ kg           │ $30.00/kg  │
│ Agua horchata   │ 12.0 L      │ L            │ $8.00/L    │
└─────────────────┴─────────────┴──────────────┴────────────┘
```

**Para agregar un insumo:**
1. Presiona **+ Insumo**.
2. Escribe el nombre, unidad (kg, L, piezas…) y costo.
3. Ingresa el stock inicial.
4. Guarda.

**Para actualizar el stock:** Edita el insumo y modifica la cantidad.

#### Recetas

**Ruta:** Menú lateral → **Recetas**

Las recetas vinculan los productos con sus insumos para calcular costos y descontar inventario automáticamente.

```
┌───────────────────────────────────────────────────────────┐
│ Recetas                                                   │
├─────────────────────┬─────────────────────────────────────┤
│ Producto            │ Insumos                             │
├─────────────────────┼─────────────────────────────────────┤
│ Gordita chicharrón  │ Masa 150g + Chicharrón 80g          │
│ Gordita frijol      │ Masa 150g + Frijoles 100g           │
│ Agua horchata       │ Agua horchata 350ml                 │
└─────────────────────┴─────────────────────────────────────┘
```

**Para configurar una receta:**
1. Selecciona el producto.
2. Presiona **+ Agregar insumo**.
3. Selecciona el insumo y la cantidad por porción.
4. Guarda.

---

### 5.4 Promociones

**Ruta:** Menú lateral → **Promociones**

Configura descuentos automáticos que se aplican en el POS cuando se cumplen las condiciones.

```
┌───────────────────────────────────────────────────────────┐
│ Promociones                               [+ Promoción]  │
├───────────────────────────────────────────────────────────┤
│ 2x1 Gorditas los martes                   Activa  ✓      │
│ 2 gorditas cualquiera = 2da al 50%                       │
│ Mar — 12:00 a 15:00                                      │
│                                 [Editar] [Activar/Desact] │
├───────────────────────────────────────────────────────────┤
│ Combo familiar                            Activa  ✓      │
│ 4 tacos + 2 bebidas = $15 de descuento                   │
│ Todo el día                                              │
│                                 [Editar] [Activar/Desact] │
└───────────────────────────────────────────────────────────┘
```

**Tipos de descuento:**
- **Fijo ($):** descuenta una cantidad fija al total.
- **Porcentaje (%):** descuenta un porcentaje del subtotal.

**Tipos de horario:**
- **Todo el día:** aplica siempre.
- **Ventana horaria:** aplica solo en un rango de horas (ej: 12:00 – 15:00).

**Modo agrupado (pool):** Permite que el descuento aplique cuando se combinan N artículos de un grupo, sin importar cuáles. Por ejemplo: "cualquier 2 gorditas = descuento", sin importar el sabor.

**Para crear una promoción:**
1. Presiona **+ Promoción**.
2. Escribe el nombre y el tipo de descuento.
3. Agrega los productos que participan.
4. Configura el horario.
5. Guarda y activa.

Las promociones se aplican **automáticamente en el carrito del POS** cuando se cumplen las condiciones.

---

### 5.5 Pedidos

**Ruta:** Menú lateral → **Pedidos**

Historial de todos los pedidos de la sucursal.

```
┌──────────────────────────────────────────────────────────────┐
│ Pedidos                              [Hoy ▼] [Filtrar]      │
├────────┬──────────┬──────────────┬──────────┬────────────────┤
│ Folio  │ Mesa     │ Items        │ Total    │ Estado         │
├────────┼──────────┼──────────────┼──────────┼────────────────┤
│ #0124  │ Mesa 3   │ 3 items      │ $68.00   │ ✅ Pagado       │
│ #0123  │ Cliente  │ 5 items      │ $95.00   │ ✅ Pagado       │
│ #0122  │ Mesa 7   │ 2 items      │ $38.00   │ 🔵 Preparando  │
│ #0121  │ Mesa 1   │ 4 items      │ $74.00   │ 🟡 Pendiente   │
└────────┴──────────┴──────────────┴──────────┴────────────────┘
```

**Estados de un pedido:**
| Estado | Significado |
|--------|-------------|
| 🟡 Pendiente | Recién creado, en espera de cocina |
| 🔵 Preparando | Cocina lo tiene en proceso |
| ✅ Listo | Cocina terminó, listo para servir |
| 💚 Pagado | Cobrado y cerrado |
| ❌ Cancelado | Cancelado por el admin |

---

### 5.6 Reportes

**Ruta:** Menú lateral → **Reportes**

```
┌──────────────────────────────────────────────────────────────┐
│ Reportes                     [Esta semana ▼]                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Ventas por categoría                                        │
│  Gorditas   ████████████████████████  $3,200  52%           │
│  Tacos      ████████████             $1,800  29%            │
│  Bebidas    ██████                   $  820  13%            │
│  Extras     ███                      $  380   6%            │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Margen por producto                                         │
│  Gordita chicharrón   Costo: $8.20   Precio: $20   Margen: 59%│
│  Gordita frijol       Costo: $5.50   Precio: $18   Margen: 69%│
│  Agua horchata        Costo: $2.80   Precio: $25   Margen: 89%│
└──────────────────────────────────────────────────────────────┘
```

> El margen por producto solo es preciso si tienes configuradas las **recetas** con los costos de insumos actualizados.

---

### 5.7 Usuarios

**Ruta:** Menú lateral → **Usuarios**

Gestiona el personal de tu sucursal.

```
┌───────────────────────────────────────────────────────────┐
│ Usuarios                                  [+ Nuevo]      │
├────────────────┬─────────────┬───────────────────────────┤
│ Nombre         │ Rol         │ Acciones                  │
├────────────────┼─────────────┼───────────────────────────┤
│ Ana García     │ Admin       │ [Editar] [Cambiar clave]  │
│ Luis Martínez  │ Mesero      │ [Editar] [Cambiar clave]  │
│ Pedro Ruiz     │ Cocina      │ [Editar] [Cambiar clave]  │
│ Sofia Leal     │ Cajero      │ [Editar] [Cambiar clave]  │
└────────────────┴─────────────┴───────────────────────────┘
```

**Para crear un usuario:**
1. Presiona **+ Nuevo**.
2. Ingresa nombre completo, correo electrónico y contraseña temporal.
3. Selecciona el rol.
4. Guarda — el usuario podrá iniciar sesión de inmediato.

**Para cambiar contraseña:**
1. Presiona **Cambiar clave** en la fila del usuario.
2. Ingresa la nueva contraseña.
3. Guarda.

**Roles disponibles:**

| Rol | Descripción |
|-----|-------------|
| Admin | Acceso completo a la sucursal |
| Mesero | POS + Salón |
| Cocina | Pantalla de comandas |
| Cajero | Caja + Salón |

---

### 5.8 Caja

**Ruta:** Menú lateral → **Caja**

Gestión de turnos y cobro de mesas.

#### Abrir turno

```
┌─────────────────────────────────────────────────┐
│ Caja — Sin turno activo                         │
│                                                 │
│  Para empezar a registrar ventas,               │
│  abre un nuevo turno.                           │
│                                                 │
│  Notas del turno (opcional):                   │
│  ┌─────────────────────────────────────────┐   │
│  │ Fondo de caja: $500                     │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [ Abrir turno ]                               │
└─────────────────────────────────────────────────┘
```

1. (Opcional) Escribe una nota, por ejemplo el fondo de caja.
2. Presiona **Abrir turno**.

#### Turno activo — cobrar mesas

```
┌──────────────────────────────────────────────────────────┐
│ Caja — Turno abierto desde 09:00                         │
│ Vendido: $1,250.00  |  Pedidos cobrados: 18              │
│                                             [Cerrar turno]│
├────────────┬──────────┬────────────────────┬─────────────┤
│ Tab        │ Items    │ Total              │ Acción      │
├────────────┼──────────┼────────────────────┼─────────────┤
│ Mesa 3     │ 3 items  │ $68.00             │ [🖨️][Cobrar]│
│ Mesa 5     │ 5 items  │ $95.00             │ [🖨️][Cobrar]│
│ Juan Pérez │ 2 items  │ $38.00             │ [🖨️][Cobrar]│
└────────────┴──────────┴────────────────────┴─────────────┘
```

**Para cobrar una mesa:**
1. Presiona **Cobrar** en la fila correspondiente.
2. Se abre la **vista previa del ticket** con el detalle de la cuenta.
3. Puedes **imprimir** el ticket o directamente **cobrar**.
4. Al cobrar, la mesa queda libre.

#### Vista previa del ticket

```
┌─────────────────────────────────────────┐
│        GORDITAS DOÑA FÉLIX              │
│        Mesa 3  •  12:30                 │
│ ─────────────────────────────────────── │
│  2x Gordita chicharrón       $40.00     │
│  1x Agua horchata            $25.00     │
│  1x Taco asada               $16.00     │
│ ─────────────────────────────────────── │
│  Subtotal                    $81.00     │
│  Descuento (Promo 2x1)       -$13.00    │
│  TOTAL                       $68.00     │
│ ─────────────────────────────────────── │
│                                         │
│  [ Imprimir ]   [ Cancelar ]  [ Cobrar ]│
└─────────────────────────────────────────┘
```

#### Cerrar turno

1. Presiona **Cerrar turno** (esquina superior derecha).
2. Confirma el cierre.
3. El sistema calcula el total del turno y lo registra en el historial.

> Solo puedes cerrar el turno cuando no hay mesas pendientes de cobro.

---

### 5.9 Salón (Floor Plan)

**Ruta:** Menú lateral → **Salón**

Vista del plano del restaurante con el estado de cada mesa en tiempo real.

#### Estados de las mesas

```
┌─────────────────────────────────────────────────────────┐
│  leyenda de colores:                                    │
│                                                         │
│  [ 1 ] Crema/beige    = Libre (sin clientes)           │
│  [ 2 ] Arena          = Abierta (sin pedidos aún)      │
│  [ 3 ] Café oscuro    = Activa (con pedidos en curso)  │
│  [ 4 ] Verde          = Lista (todos los pedidos listos)│
│  [ 5 ] Teal           = Atendida (ya se sirvió)        │
│  [ 6 ] Dorado/ámbar   = Pide cuenta                   │
└─────────────────────────────────────────────────────────┘
```

#### Plano del salón

```
┌───────────────────────────────────────────────────────────┐
│ Salón                      [ Modo edición ]  [ + Mesa ]   │
│                                                           │
│   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐             │
│   │  1   │   │  2   │   │  3 ▶ │   │  4   │             │
│   │ Libre│   │ Activa│  │Lista │   │Cta💰 │             │
│   └──────┘   └──────┘   └──────┘   └──────┘             │
│                                                           │
│   ┌──────┐   ┌──────┐   ┌─────────────────────┐         │
│   │  5   │   │  6   │   │    BARRA / COCINA    │         │
│   │Libre │   │ Act. │   │                     │         │
│   └──────┘   └──────┘   └─────────────────────┘         │
└───────────────────────────────────────────────────────────┘
```

#### Acciones disponibles al seleccionar una mesa

Al tocar una mesa ocupada, aparece un panel lateral con opciones según el estado:

```
┌────────────────────────────────────────┐
│  Mesa 3 — Lista ✅                     │
│  Mesero: LM  •  Hace 45 min  •  $68   │
│ ─────────────────────────────────────  │
│  [ ✅ Mesa atendida ]                  │
│  [ 💰 Pide cuenta   ]                  │
│  [ 🛒 Tomar pedido  ]                  │
│  [ 💵 Cobrar        ]                  │
└────────────────────────────────────────┘
```

| Acción | Cuándo usarla |
|--------|---------------|
| **Mesa atendida** | Cuando ya llevaste los platos a la mesa |
| **Pide cuenta** | Cuando el cliente pide la cuenta — cambia la mesa a color dorado |
| **Tomar pedido** | Abre el POS con esa mesa preseleccionada |
| **Cobrar** | Abre la vista previa del ticket para cobrar |

#### Modo edición del salón

Activa el **modo edición** para reorganizar el restaurante:

```
┌───────────────────────────────────────────────────────┐
│ Salón  ● Modo edición activo    [+ Mesa] [+ Forma]    │
├───────────────────────────────────────────────────────┤
│  • Arrastra las mesas para reposicionarlas            │
│  • Usa [+ Mesa] para agregar una nueva mesa           │
│  • Usa [+ Forma] para agregar zonas (barra, cocina)   │
│  • Haz clic en una forma para redimensionarla         │
│  • Usa [🗑️] para eliminar mesas o formas              │
└───────────────────────────────────────────────────────┘
```

**Formas decorativas:** Los rectángulos con nombre sirven para representar la barra, cocina, u otras áreas del local. Solo son visuales y no interactúan con pedidos.

---

### 5.10 Corte de caja

**Ruta:** Menú lateral → **Corte de caja**

Historial de todos los turnos cerrados con sus totales.

```
┌─────────────────────────────────────────────────────────────┐
│ Corte de caja                                               │
├──────────┬──────────────┬──────────────┬────────────────────┤
│ Fecha    │ Abrió        │ Cerró        │ Total vendido      │
├──────────┼──────────────┼──────────────┼────────────────────┤
│ 25 mayo  │ Ana G. 09:00 │ Ana G. 17:30 │ $4,320.00          │
│ 24 mayo  │ Ana G. 09:00 │ Ana G. 17:15 │ $3,890.00          │
│ 23 mayo  │ Luis M. 09:00│ Ana G. 17:00 │ $5,100.00          │
└──────────┴──────────────┴──────────────┴────────────────────┘
```

---

### 5.11 Asistente IA

**Ruta:** Menú lateral → **Asistente IA** (pantalla completa) o burbuja flotante 💬 en cualquier pantalla.

El asistente **Félix** puede consultar y realizar acciones en el sistema mediante lenguaje natural.

```
┌─────────────────────────────────────────────────────────────┐
│  💬 Conversaciones           Asistente Félix  ⚙️ Config      │
│ ─────────────────────────  ────────────────────────────────  │
│  Nueva conversación        │                               │ │
│  Hoy —                     │  Hola! Soy Félix 👋           │ │
│   Consulta inventario      │  ¿En qué te ayudo hoy?        │ │
│   Pedidos del turno        │                               │ │
│  Ayer —                    │  ┌────────────────────────┐   │ │
│   Reporte de ventas        │  │ ¿Cuánto llevamos       │   │ │
│                            │  │ vendido hoy?           │   │ │
│                            │  └────────────────────────┘   │ │
│                            │                               │ │
│                            │  El turno lleva $1,250 en     │ │
│                            │  18 pedidos cobrados.         │ │
│                            │                               │ │
│                            │  ┌──────────────────────────┐ │ │
│                            │  │ Escribe tu pregunta...   │ │ │
│                            │  └────────────────[ Enviar ]┘ │ │
└─────────────────────────────────────────────────────────────┘
```

#### ¿Qué puede hacer el asistente?

**Consultas:**
- "¿Cuánto llevamos vendido hoy?"
- "¿Cuál es el stock de chicharrón?"
- "¿Qué mesas están activas?"
- "¿Cuáles son las promociones activas?"

**Acciones:**
- "Abre la mesa 5 para el cliente Juan"
- "Crea un pedido de 2 gorditas de frijol para la mesa 3"
- "Actualiza el stock de masa a 20 kg"
- "Cierra la mesa 7 y márcala como cobrada"
- "Activa la promoción 2x1 gorditas"
- "Crea un usuario mesero con el correo pedro@felix.com"

#### Configurar el asistente

Presiona el ícono **⚙️ Config** en el chat.

```
┌─────────────────────────────────────────────────────────┐
│ Configuración del asistente                             │
├─────────────────────────────────────────────────────────┤
│ Proveedor IA:  [Claude ▼]   [Gemini]   [Ollama]        │
│ Modelo:        [claude-haiku-4-5-20251001 ▼]            │
│ Clave API:     [•••••••••••••••••••]  [Guardar]         │
├─────────────────────────────────────────────────────────┤
│ Contexto del negocio (editable):                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Somos una taquería familiar llamada "Gorditas      │ │
│ │ Doña Félix" ubicada en Guadalajara. Servimos       │ │
│ │ gorditas, tacos y aguas frescas...                 │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Último entrenamiento: 25 mayo 2026 09:30               │
│                                                         │
│ [ Entrenar ahora ]                   [ Guardar ]       │
└─────────────────────────────────────────────────────────┘
```

**Proveedores disponibles:**

| Proveedor | Cuándo usarlo | Requiere clave |
|-----------|--------------|----------------|
| **Claude** | El más capaz y preciso | Sí — api.anthropic.com |
| **Gemini** | Gratis con cuota limitada | Sí — aistudio.google.com |
| **Ollama** | 100% local, sin costo | No (instalar Ollama) |

**Entrenar el asistente:**
1. Presiona **Entrenar ahora**.
2. El sistema escanea automáticamente los productos, personal, mesas y promociones de tu sucursal.
3. El asistente queda actualizado con la información actual del negocio.

> Se recomienda entrenar el asistente cada vez que hagas cambios importantes en el menú o el personal.

---

### 5.12 Configuración (IA y sistema)

**Ruta:** Menú lateral → **Configuración**

Aquí se guardan las claves API globales (compartidas entre todas las sucursales).

```
┌──────────────────────────────────────────────────────────┐
│ Configuración global                                     │
├──────────────────────────────────────────────────────────┤
│ Proveedor IA predeterminado:  [Claude ▼]                 │
│ Clave Claude (Anthropic):     [•••••••••••] [Guardar]   │
│ Clave Gemini (Google):        [•••••••••••] [Guardar]   │
│ URL Ollama:                   [http://localhost:11434]   │
└──────────────────────────────────────────────────────────┘
```

> El contexto del negocio (descripción, nombre) se configura **por sucursal** desde el chat del asistente, no aquí.

---

## 6. Mesero (Waiter)

El mesero tiene acceso al **POS** y al **Salón**.

### 6.1 Punto de venta (POS)

**Ruta:** Menú → **POS**

#### Paso 1 — Seleccionar mesa o cliente

```
┌──────────────────────────────────────────────────────────┐
│ ¿A quién vas a atender?                                  │
├──────────────────────────────────────────────────────────┤
│ MESAS DISPONIBLES                                        │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐         │
│  │  Mesa  │  │  Mesa  │  │  Mesa  │  │  Mesa  │         │
│  │   1    │  │   4    │  │   6    │  │   8    │         │
│  │ Libre  │  │ Libre  │  │ Libre  │  │ Libre  │         │
│  └────────┘  └────────┘  └────────┘  └────────┘         │
│                                                          │
│  ┌────────┐                                              │
│  │  Mesa  │                                              │
│  │   9    │  ← Mesa ocupada (toca para agregar pedido)  │
│  │ Activa │                                              │
│  └────────┘                                              │
│                                                          │
│  ──── O atender a un cliente por nombre ────             │
│  ┌──────────────────────────────────┐                   │
│  │ Nombre del cliente...            │                   │
│  └──────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────┘
```

- **Mesa libre:** Toca para abrir una nueva cuenta en esa mesa.
- **Mesa ocupada:** Toca para agregar pedidos a la cuenta existente.
- **Cliente por nombre:** Escribe el nombre y presiona Enter.

#### Paso 2 — Tomar el pedido

```
┌──────────────────────────────────────────────────────────┐
│ ← Mesa 3          🛒 Carrito  (3 items — $68.00)         │
├────────────────────────────────────┬─────────────────────┤
│ [Todas] [Gorditas] [Tacos] [Bebidas│ 2× Gordita chich.  │
│                                    │    $40.00           │
│ ┌─────────────┐ ┌─────────────┐    │ 1× Agua horchata   │
│ │ Gordita     │ │ Gordita     │    │    $25.00           │
│ │ chicharrón  │ │ frijol      │    │ ──────────────────  │
│ │ $20.00      │ │ $18.00      │    │ Subtotal:   $65.00  │
│ │  [ + ]      │ │  [ + ]      │    │ Desc. 2x1: - $3.00 │
│ └─────────────┘ └─────────────┘    │ Total:      $62.00  │
│                                    │                     │
│ ┌─────────────┐ ┌─────────────┐    │ [ Enviar pedido ]   │
│ │ Taco asada  │ │ Taco suadero│    │                     │
│ │ $16.00      │ │ $16.00      │    │                     │
│ │  [ + ]      │ │  [ + ]      │    │                     │
│ └─────────────┘ └─────────────┘    │                     │
└────────────────────────────────────┴─────────────────────┘
```

1. Filtra por categoría tocando las pestañas superiores.
2. Toca **[ + ]** en cada producto para agregarlo al carrito.
3. Si el producto tiene variantes, aparecerá un selector de tamaño/tipo.
4. Las **promociones** se aplican automáticamente y se muestran en el resumen.
5. Presiona **Enviar pedido** para enviarlo a cocina.

#### Enviar pedido

Al presionar **Enviar pedido:**
- El pedido aparece en la pantalla de cocina.
- La mesa cambia a estado **Activa** en el salón.
- El carrito se vacía para el siguiente pedido.

---

### 6.2 Salón — vista del mesero

El mesero ve el mismo plano de salón que el admin, con las mismas acciones disponibles:
- **Mesa atendida** — cuando llevó los platos.
- **Pide cuenta** — cuando el cliente lo solicita.
- **Tomar pedido** — abre el POS con esa mesa.

> El mesero **no puede cobrar** directamente — el cobro lo hace el cajero o el admin.

---

## 7. Cocina (Kitchen)

**Ruta:** `/kitchen` — accesible para todos los roles.

Pantalla de comandas en tiempo real. Diseñada para montarse en una tablet en la cocina.

```
┌──────────────────────────────────────────────────────────┐
│ 🍳 Cocina                                 [Sonido ON 🔔] │
├───────────────┬──────────────────┬───────────────────────┤
│  Mesa 3       │  Mesa 7          │  Juan Pérez           │
│  hace 2 min   │  hace 5 min      │  hace 8 min           │
│ ────────────  │ ────────────     │ ─────────────         │
│  2× Gordita   │  3× Taco asada   │  1× Gordita frijol    │
│    chicharrón │  2× Agua natural │  1× Taco suadero      │
│  1× Horchata  │                  │                       │
│               │                  │                       │
│ [ Preparando ]│ [ Preparando ]   │ [ Preparando ]        │
│ → [ Listo ✓ ] │ → [ Listo ✓ ]   │ → [ Listo ✓ ]        │
└───────────────┴──────────────────┴───────────────────────┘
```

**Flujo de la cocina:**
1. Llega un pedido → aparece como tarjeta.
2. Al empezar a preparar → presiona **Preparando**.
3. Al terminar → presiona **Listo ✓**.
4. El mesero y el salón se actualizan automáticamente.

> La pantalla se actualiza en **tiempo real** sin necesidad de recargar la página. Se recomienda mantenerla siempre visible en una tablet fija.

---

## 8. Cajero (Cashier)

El cajero tiene acceso a **Caja** y **Salón**. Las instrucciones son las mismas que para el admin en esas secciones (ver [5.8](#58-caja) y [5.9](#59-salón-floor-plan)).

**Resumen de acciones del cajero:**
- Abrir y cerrar turno.
- Cobrar mesas desde la caja o desde el salón.
- Ver el estado del salón y marcar mesas como atendidas.

---

## 9. Instalación como app (PWA)

El sistema se puede instalar como aplicación en el celular o tablet, sin necesidad de una tienda de apps.

### En Android (Chrome)

1. Abre el sistema en Chrome.
2. Toca el menú **⋮** (tres puntos) en la esquina superior derecha.
3. Selecciona **"Añadir a pantalla de inicio"** o **"Instalar app"**.
4. Confirma.

### En iPhone/iPad (Safari)

1. Abre el sistema en Safari.
2. Toca el ícono **⬆️ Compartir** (en la barra inferior).
3. Selecciona **"Añadir a pantalla de inicio"**.
4. Confirma el nombre y presiona **Añadir**.

### En computadora (Chrome/Edge)

1. En la barra de direcciones aparece un ícono de instalación 🖥️.
2. Haz clic y confirma.

> Una vez instalada, la app funciona como cualquier aplicación nativa y abre directamente sin el navegador.

---

## 10. Preguntas frecuentes

### ¿Por qué no veo algunas opciones del menú?

El menú muestra solo las opciones de tu rol. Si necesitas acceso a una sección que no aparece, contacta al administrador para que cambie tu rol.

### ¿Cómo recupero mi contraseña?

El sistema no tiene recuperación de contraseña por correo en este momento. Pide al administrador que restablezca tu contraseña desde el módulo de **Usuarios**.

### ¿Los datos se guardan automáticamente?

Sí. Todo se guarda en la nube automáticamente en tiempo real. No necesitas presionar "guardar" para la mayoría de las acciones operativas (pedidos, movimientos de mesa).

### ¿Qué pasa si se va la señal de internet?

El sistema requiere conexión a internet para funcionar. Se recomienda contar con una conexión estable en el restaurante (WiFi o datos móviles). Si se pierde la conexión, los cambios no se guardarán hasta que se restablezca.

### ¿Puedo usar el sistema desde varios dispositivos a la vez?

Sí. Múltiples usuarios pueden estar conectados al mismo tiempo. El salón, la cocina y la caja se actualizan en tiempo real entre todos los dispositivos.

### ¿Cómo agrego una nueva sucursal?

Solo el propietario (Owner) puede hacerlo desde **Menú → Sucursales → + Nueva sucursal**.

### El asistente IA no responde bien, ¿qué hago?

1. Verifica que la clave API sea correcta en **Configuración**.
2. Presiona **Entrenar ahora** en el chat del asistente para actualizar el contexto del negocio.
3. Si usas Gemini, asegúrate de que no hayas agotado la cuota gratuita del día.

### ¿Cómo imprimo un ticket?

Presiona el ícono de impresora 🖨️ en la caja o en el salón al seleccionar una mesa. Se abre la vista previa del ticket y desde ahí puedes imprimir usando la impresora configurada en tu dispositivo.

---

*Manual generado para el sistema Felix · Todos los derechos reservados*
