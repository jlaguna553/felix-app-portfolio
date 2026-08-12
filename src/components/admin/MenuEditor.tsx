'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImageUpload } from '@/components/ui/ImageUpload'
import {
  Plus, Trash2, Save, Eye, EyeOff, ChevronDown,
  Type, Image as ImageIcon, Minus, Square, Circle,
  AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Loader2, Check, X, LayoutTemplate,
  ChevronUp, ChevronLeft, ChevronRight, Layers, Sparkles, Download,
} from 'lucide-react'
import type { Menu, MenuElement, MenuElementConfig, MenuElementType, Product, Category } from '@/lib/types'

// ── Export helpers ─────────────────────────────────────────────────────────────

type ExportFormat = 'pdf' | 'png'
type ExportSize   = 'a4' | 'a5' | 'letter'

const PAGE_SIZES: Record<ExportSize, { wMm: number; hMm: number; label: string }> = {
  a4:     { wMm: 210, hMm: 297, label: 'A4  (21 × 29.7 cm)' },
  a5:     { wMm: 148, hMm: 210, label: 'A5  (14.8 × 21 cm)' },
  letter: { wMm: 216, hMm: 279, label: 'Letter  (21.6 × 27.9 cm)' },
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function elementToHTML(el: MenuElement, products: Product[]): string {
  const cfg = el.config
  const wrap = `position:absolute;left:${Math.round(el.x)}px;top:${Math.round(el.y)}px;width:${Math.round(el.width)}px;height:${Math.round(el.height)}px;z-index:${el.z_index};overflow:hidden;`

  let inner = ''

  switch (el.type) {
    case 'text':
      inner = `<div style="width:100%;height:100%;display:flex;align-items:center;padding:0 4px;box-sizing:border-box;overflow:hidden;word-break:break-word;font-size:${cfg.fontSize ?? 16}px;font-weight:${cfg.fontWeight ?? 'normal'};color:${cfg.color ?? '#000'};text-align:${cfg.textAlign ?? 'left'};font-style:${cfg.italic ? 'italic' : 'normal'};line-height:1.3;">${esc(cfg.text ?? '')}</div>`
      break

    case 'shape': {
      const br = cfg.shapeType === 'circle' ? '50%' : `${cfg.borderRadius ?? 0}px`
      const border = cfg.borderWidth && cfg.borderColor ? `${cfg.borderWidth}px solid ${cfg.borderColor}` : 'none'
      inner = `<div style="width:100%;height:100%;background-color:${cfg.fillColor ?? 'transparent'};border:${border};border-radius:${br};opacity:${cfg.opacity ?? 1};"></div>`
      break
    }

    case 'line': {
      const isH = (cfg.orientation ?? 'horizontal') === 'horizontal'
      const t   = cfg.thickness ?? 2
      const lineS = `background:${cfg.lineColor ?? '#000'};border-style:${cfg.lineStyle ?? 'solid'};`
      const lineEl = isH
        ? `<div style="width:100%;height:${t}px;${lineS}"></div>`
        : `<div style="width:${t}px;height:100%;${lineS}"></div>`
      inner = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${lineEl}</div>`
      break
    }

    case 'image':
      if (cfg.imageUrl)
        inner = `<img src="${cfg.imageUrl}" style="width:100%;height:100%;object-fit:${cfg.objectFit ?? 'cover'};opacity:${cfg.opacity ?? 1};" crossorigin="anonymous" />`
      break

    case 'product': {
      const prod  = products.find(p => p.id === cfg.productId)
      const name  = esc(prod?.name ?? cfg.productName ?? 'Producto')
      const price = prod?.sale_price ?? cfg.productPrice
      const img   = prod?.image_url ?? cfg.productImageUrl

      if (cfg.showImage && img) {
        inner = `<div style="display:flex;gap:8px;padding:8px;width:100%;height:100%;box-sizing:border-box;overflow:hidden;">
          <img src="${img}" style="width:56px;height:56px;object-fit:cover;border-radius:4px;flex-shrink:0;" crossorigin="anonymous" />
          <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:2px;min-width:0;">
            <div style="font-weight:600;font-size:14px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div>
            ${price != null ? `<div style="font-weight:700;font-size:14px;color:#7a3b10;">$${price.toFixed(2)}</div>` : ''}
          </div>
        </div>`
      } else {
        inner = `<div style="display:flex;align-items:flex-end;padding:6px 8px;width:100%;height:100%;box-sizing:border-box;gap:4px;overflow:hidden;">
          <span style="font-size:14px;font-weight:500;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%;flex-shrink:0;">${name}</span>
          <span style="flex:1;border-bottom:1px dotted #9ca3af;margin-bottom:4px;min-width:8px;"></span>
          ${price != null && cfg.showPrice !== false ? `<span style="font-size:14px;font-weight:700;color:#7a3b10;flex-shrink:0;">$${price.toFixed(2)}</span>` : ''}
        </div>`
      }
      break
    }
  }

  return `<div style="${wrap}">${inner}</div>`
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CANVAS_W = 794  // A4 at 96 dpi
const CANVAS_H = 1123

const MIN_W = 40
const MIN_H = 24

const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type ResizeHandle = typeof RESIZE_HANDLES[number]

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nw-resize', n: 'ns-resize', ne: 'ne-resize',
  e: 'ew-resize',  se: 'se-resize', s: 'ns-resize',
  sw: 'sw-resize', w: 'ew-resize',
}

// ── Types ──────────────────────────────────────────────────────────────────────

type InteractionState =
  | { kind: 'idle' }
  | { kind: 'drag'; id: string; startMouseX: number; startMouseY: number; startElX: number; startElY: number }
  | { kind: 'resize'; id: string; handle: ResizeHandle; startMouseX: number; startMouseY: number; startEl: MenuElement }

// ── Helpers ────────────────────────────────────────────────────────────────────

function applyResize(
  handle: ResizeHandle,
  start: MenuElement,
  dx: number, dy: number,
): Pick<MenuElement, 'x' | 'y' | 'width' | 'height'> {
  let { x, y, width, height } = start
  if (handle.includes('e')) width  = Math.max(MIN_W, width + dx)
  if (handle.includes('w')) { x += dx; width = Math.max(MIN_W, width - dx); if (width === MIN_W) x = start.x + start.width - MIN_W }
  if (handle.includes('s')) height = Math.max(MIN_H, height + dy)
  if (handle.includes('n')) { y += dy; height = Math.max(MIN_H, height - dy); if (height === MIN_H) y = start.y + start.height - MIN_H }
  return { x, y, width, height }
}

function newId(): string {
  return crypto.randomUUID()
}

function defaultConfig(type: MenuElementType): MenuElementConfig {
  switch (type) {
    case 'text':    return { text: 'Texto del menú', fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center' }
    case 'image':   return { imageUrl: '', objectFit: 'cover', opacity: 1 }
    case 'line':    return { orientation: 'horizontal', thickness: 2, lineColor: '#c9a87a', lineStyle: 'solid' }
    case 'shape':   return { shapeType: 'rectangle', fillColor: '#f5e6cc', borderColor: '', borderWidth: 0, borderRadius: 8, opacity: 1 }
    case 'product': return { showImage: true, showPrice: true }
    default:        return {}
  }
}

function defaultSize(type: MenuElementType): { width: number; height: number } {
  switch (type) {
    case 'text':    return { width: 400, height: 60 }
    case 'image':   return { width: 300, height: 200 }
    case 'line':    return { width: 600, height: 8 }
    case 'shape':   return { width: 300, height: 120 }
    case 'product': return { width: 340, height: 90 }
    default:        return { width: 200, height: 100 }
  }
}

// ── Element content renderer ───────────────────────────────────────────────────

function ElementContent({ el, products }: { el: MenuElement; products: Product[] }) {
  const cfg = el.config

  if (el.type === 'product') {
    const product = products.find(p => p.id === cfg.productId)
    const name  = product?.name ?? cfg.productName ?? 'Producto'
    const price = product?.sale_price ?? cfg.productPrice
    const img   = product?.image_url ?? cfg.productImageUrl

    // Card format (with image)
    if (cfg.showImage && img) {
      return (
        <div className="flex gap-2 w-full h-full p-2 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="w-14 h-14 object-cover rounded shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <p className="font-semibold text-sm leading-tight line-clamp-2">{name}</p>
            {cfg.showPrice && price != null && (
              <p className="font-bold text-sm" style={{ color: '#7a3b10' }}>${price.toFixed(2)}</p>
            )}
          </div>
        </div>
      )
    }

    // Classic menu format: Name ····· Price
    return (
      <div className="flex items-end w-full h-full px-2 py-1.5 overflow-hidden gap-1">
        <span className="text-sm font-medium leading-snug shrink-0 max-w-[60%] line-clamp-2">{name}</span>
        <span className="flex-1 border-b border-dotted border-stone-400 mb-1 min-w-2" />
        {cfg.showPrice && price != null ? (
          <span className="text-sm font-bold shrink-0" style={{ color: '#7a3b10' }}>${price.toFixed(2)}</span>
        ) : (
          <span className="text-xs text-stone-400 shrink-0 italic">sin precio</span>
        )}
      </div>
    )
  }

  if (el.type === 'text') {
    return (
      <div
        className="w-full h-full flex items-center overflow-hidden px-1 break-words"
        style={{
          fontSize:   cfg.fontSize   ?? 16,
          fontWeight: cfg.fontWeight ?? 'normal',
          color:      cfg.color      ?? '#000000',
          textAlign:  cfg.textAlign  ?? 'left',
          fontStyle:  cfg.italic ? 'italic' : 'normal',
          fontFamily: cfg.fontFamily ?? 'inherit',
          lineHeight: 1.3,
        }}
      >
        <span className="w-full">{cfg.text ?? 'Texto'}</span>
      </div>
    )
  }

  if (el.type === 'image') {
    if (!cfg.imageUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-stone-100 rounded">
          <ImageIcon className="w-8 h-8 text-stone-300" />
        </div>
      )
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cfg.imageUrl}
        alt=""
        className="w-full h-full"
        style={{ objectFit: cfg.objectFit as 'cover' | 'contain' ?? 'cover', opacity: cfg.opacity ?? 1 }}
      />
    )
  }

  if (el.type === 'line') {
    const isH = (cfg.orientation ?? 'horizontal') === 'horizontal'
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div style={{
          width:       isH ? '100%' : cfg.thickness ?? 2,
          height:      isH ? cfg.thickness ?? 2 : '100%',
          background:  cfg.lineColor   ?? '#000000',
          borderStyle: cfg.lineStyle   ?? 'solid',
        }} />
      </div>
    )
  }

  if (el.type === 'shape') {
    return (
      <div
        className="w-full h-full"
        style={{
          backgroundColor: cfg.fillColor   ?? 'transparent',
          border:          cfg.borderWidth && cfg.borderColor
            ? `${cfg.borderWidth}px solid ${cfg.borderColor}`
            : 'none',
          borderRadius:    cfg.shapeType === 'circle' ? '50%' : (cfg.borderRadius ?? 0),
          opacity:         cfg.opacity ?? 1,
        }}
      />
    )
  }

  return null
}

// ── Toolbox panel ──────────────────────────────────────────────────────────────

interface ToolboxProps {
  bgColor: string
  bgImageUrl: string | null
  onBgColorChange: (c: string) => void
  onBgImageChange: (url: string) => void
  onAdd: (type: MenuElementType, extra?: Partial<MenuElementConfig>) => void
  products: Product[]
  categories: Category[]
  searchQuery: string
  onSearchChange: (q: string) => void
}

function Toolbox({ bgColor, bgImageUrl, onBgColorChange, onBgImageChange, onAdd, products, categories, searchQuery, onSearchChange }: ToolboxProps) {
  const [bgSection, setBgSection] = useState(true)
  const [prodSection, setProdSection] = useState(true)

  const filtered = searchQuery
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : products

  const grouped = categories.reduce<Record<string, Product[]>>((acc, cat) => {
    const prods = filtered.filter(p => p.category_id === cat.id)
    if (prods.length) acc[cat.name] = prods
    return acc
  }, {})
  const uncategorized = filtered.filter(p => !p.category_id)

  return (
    <div className="w-56 shrink-0 bg-white border-r border-stone-200 flex flex-col overflow-y-auto">
      {/* Background */}
      <div className="border-b border-stone-100">
        <button
          onClick={() => setBgSection(s => !s)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide hover:bg-stone-50"
        >
          <span>Fondo</span>
          {bgSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {bgSection && (
          <div className="px-3 pb-3 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-stone-500 w-14 shrink-0">Color</label>
              <input
                type="color"
                value={bgColor}
                onChange={e => onBgColorChange(e.target.value)}
                className="w-8 h-8 rounded border border-stone-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={bgColor}
                onChange={e => onBgColorChange(e.target.value)}
                className="flex-1 text-xs border border-stone-200 rounded px-2 py-1 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Imagen de fondo</label>
              <ImageUpload
                value={bgImageUrl ?? ''}
                onChange={url => onBgImageChange(url)}
                bucket="images"
                folder="menu-bg"
                previewSize="sm"
              />
              {bgImageUrl && (
                <button
                  onClick={() => onBgImageChange('')}
                  className="mt-1 text-xs text-red-500 hover:underline"
                >
                  Quitar imagen
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add elements */}
      <div className="border-b border-stone-100">
        <p className="px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Agregar</p>
        <div className="px-2 pb-3 grid grid-cols-2 gap-1.5">
          {[
            { type: 'text'  as const, label: 'Texto',   Icon: Type    },
            { type: 'image' as const, label: 'Imagen',  Icon: ImageIcon },
            { type: 'line'  as const, label: 'Línea',   Icon: Minus   },
            { type: 'shape' as const, label: 'Forma',   Icon: Square  },
          ].map(({ type, label, Icon }) => (
            <button
              key={type}
              onClick={() => onAdd(type)}
              className="flex flex-col items-center gap-1 py-2.5 rounded-lg border border-stone-200 hover:border-amber-400 hover:bg-amber-50 text-stone-600 hover:text-amber-700 transition-colors text-xs"
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="flex-1 flex flex-col min-h-0">
        <button
          onClick={() => setProdSection(s => !s)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide hover:bg-stone-50 shrink-0"
        >
          <span>Productos</span>
          {prodSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {prodSection && (
          <>
            <div className="px-2 pb-2 shrink-0">
              <input
                type="search"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-400"
              />
            </div>
            <div className="overflow-y-auto flex-1 px-2 pb-2 space-y-3">
              {Object.entries(grouped).map(([catName, prods]) => (
                <div key={catName}>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1 px-1">{catName}</p>
                  <div className="space-y-0.5">
                    {prods.map(p => (
                      <button
                        key={p.id}
                        onClick={() => onAdd('product', { productId: p.id, productName: p.name, productPrice: p.sale_price, productImageUrl: p.image_url })}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-amber-50 text-left group transition-colors"
                      >
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image_url} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded bg-stone-100 shrink-0 flex items-center justify-center">
                            <Square className="w-3.5 h-3.5 text-stone-300" />
                          </div>
                        )}
                        <span className="flex-1 text-xs text-stone-700 truncate">{p.name}</span>
                        <span className="text-xs text-amber-700 font-medium shrink-0">${p.sale_price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {uncategorized.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1 px-1">Sin categoría</p>
                  <div className="space-y-0.5">
                    {uncategorized.map(p => (
                      <button
                        key={p.id}
                        onClick={() => onAdd('product', { productId: p.id, productName: p.name, productPrice: p.sale_price, productImageUrl: p.image_url })}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-amber-50 text-left transition-colors"
                      >
                        <div className="w-7 h-7 rounded bg-stone-100 shrink-0 flex items-center justify-center">
                          <Square className="w-3.5 h-3.5 text-stone-300" />
                        </div>
                        <span className="flex-1 text-xs text-stone-700 truncate">{p.name}</span>
                        <span className="text-xs text-amber-700 font-medium shrink-0">${p.sale_price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {filtered.length === 0 && (
                <p className="text-xs text-stone-400 text-center py-4">Sin resultados</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Properties panel ───────────────────────────────────────────────────────────

interface PropertiesPanelProps {
  el: MenuElement
  products: Product[]
  onUpdate: (config: Partial<MenuElementConfig>) => void
  onUpdateGeometry: (geom: Partial<Pick<MenuElement, 'x' | 'y' | 'width' | 'height'>>) => void
  onDelete: () => void
  onBringForward: () => void
  onSendBackward: () => void
}

function PropertiesPanel({ el, products, onUpdate, onUpdateGeometry, onDelete, onBringForward, onSendBackward }: PropertiesPanelProps) {
  const cfg = el.config

  return (
    <div className="w-56 shrink-0 bg-white border-l border-stone-200 flex flex-col overflow-y-auto">
      <div className="px-3 py-2.5 border-b border-stone-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Propiedades</span>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 py-3 space-y-4 flex-1 overflow-y-auto">
        {/* Position + Size */}
        <div>
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Posición y tamaño</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'X', key: 'x' as const },
              { label: 'Y', key: 'y' as const },
              { label: 'Ancho', key: 'width' as const },
              { label: 'Alto', key: 'height' as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="text-[10px] text-stone-400 block mb-0.5">{label}</label>
                <input
                  type="number"
                  value={Math.round(el[key])}
                  onChange={e => onUpdateGeometry({ [key]: Number(e.target.value) })}
                  className="w-full text-xs border border-stone-200 rounded px-2 py-1 outline-none focus:border-amber-400"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Z-order */}
        <div className="flex gap-1.5">
          <button
            onClick={onBringForward}
            className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border border-stone-200 hover:border-amber-400 hover:bg-amber-50 text-stone-600 transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            Adelante
          </button>
          <button
            onClick={onSendBackward}
            className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border border-stone-200 hover:border-amber-400 hover:bg-amber-50 text-stone-600 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Atrás
          </button>
        </div>

        {/* Type-specific */}
        {el.type === 'text' && (
          <TextProperties cfg={cfg} onUpdate={onUpdate} />
        )}
        {el.type === 'image' && (
          <ImageProperties cfg={cfg} onUpdate={onUpdate} />
        )}
        {el.type === 'line' && (
          <LineProperties cfg={cfg} onUpdate={onUpdate} />
        )}
        {el.type === 'shape' && (
          <ShapeProperties cfg={cfg} onUpdate={onUpdate} />
        )}
        {el.type === 'product' && (
          <ProductProperties cfg={cfg} products={products} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-stone-400 block mb-1">{label}</label>
      {children}
    </div>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
          className="w-7 h-7 rounded border border-stone-200 cursor-pointer p-0.5 shrink-0" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 text-xs border border-stone-200 rounded px-2 py-1 font-mono outline-none focus:border-amber-400" />
      </div>
    </Row>
  )
}

function TextProperties({ cfg, onUpdate }: { cfg: MenuElementConfig; onUpdate: (c: Partial<MenuElementConfig>) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Texto</p>
      <Row label="Contenido">
        <textarea
          value={cfg.text ?? ''}
          onChange={e => onUpdate({ text: e.target.value })}
          rows={3}
          className="w-full text-xs border border-stone-200 rounded px-2 py-1.5 outline-none focus:border-amber-400 resize-none"
        />
      </Row>
      <Row label="Tamaño de fuente">
        <input
          type="number"
          value={cfg.fontSize ?? 16}
          min={8} max={200}
          onChange={e => onUpdate({ fontSize: Number(e.target.value) })}
          className="w-full text-xs border border-stone-200 rounded px-2 py-1 outline-none focus:border-amber-400"
        />
      </Row>
      <Row label="Estilo">
        <div className="flex gap-1">
          <button
            onClick={() => onUpdate({ fontWeight: cfg.fontWeight === 'bold' ? 'normal' : 'bold' })}
            className={`flex-1 py-1 rounded border text-xs transition-colors ${cfg.fontWeight === 'bold' ? 'bg-amber-100 border-amber-400 text-amber-700' : 'border-stone-200 text-stone-600 hover:border-amber-300'}`}
          >
            <Bold className="w-3.5 h-3.5 mx-auto" />
          </button>
          <button
            onClick={() => onUpdate({ italic: !cfg.italic })}
            className={`flex-1 py-1 rounded border text-xs transition-colors ${cfg.italic ? 'bg-amber-100 border-amber-400 text-amber-700' : 'border-stone-200 text-stone-600 hover:border-amber-300'}`}
          >
            <Italic className="w-3.5 h-3.5 mx-auto" />
          </button>
        </div>
      </Row>
      <Row label="Alineación">
        <div className="flex gap-1">
          {(['left', 'center', 'right'] as const).map(align => {
            const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight
            return (
              <button
                key={align}
                onClick={() => onUpdate({ textAlign: align })}
                className={`flex-1 py-1 rounded border text-xs transition-colors ${cfg.textAlign === align ? 'bg-amber-100 border-amber-400 text-amber-700' : 'border-stone-200 text-stone-600 hover:border-amber-300'}`}
              >
                <Icon className="w-3.5 h-3.5 mx-auto" />
              </button>
            )
          })}
        </div>
      </Row>
      <ColorRow label="Color" value={cfg.color ?? '#000000'} onChange={v => onUpdate({ color: v })} />
    </div>
  )
}

function ImageProperties({ cfg, onUpdate }: { cfg: MenuElementConfig; onUpdate: (c: Partial<MenuElementConfig>) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Imagen</p>
      <Row label="Imagen">
        <ImageUpload
          value={cfg.imageUrl ?? ''}
          onChange={url => onUpdate({ imageUrl: url })}
          bucket="images"
          folder="menu-elements"
          previewSize="sm"
        />
      </Row>
      <Row label="Ajuste">
        <select
          value={cfg.objectFit ?? 'cover'}
          onChange={e => onUpdate({ objectFit: e.target.value as 'cover' | 'contain' })}
          className="w-full text-xs border border-stone-200 rounded px-2 py-1 outline-none focus:border-amber-400"
        >
          <option value="cover">Cubrir</option>
          <option value="contain">Contener</option>
        </select>
      </Row>
      <Row label={`Opacidad: ${Math.round((cfg.opacity ?? 1) * 100)}%`}>
        <input
          type="range" min={0} max={1} step={0.05}
          value={cfg.opacity ?? 1}
          onChange={e => onUpdate({ opacity: Number(e.target.value) })}
          className="w-full accent-amber-500"
        />
      </Row>
    </div>
  )
}

function LineProperties({ cfg, onUpdate }: { cfg: MenuElementConfig; onUpdate: (c: Partial<MenuElementConfig>) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Línea</p>
      <Row label="Orientación">
        <div className="flex gap-1">
          {(['horizontal', 'vertical'] as const).map(o => (
            <button
              key={o}
              onClick={() => onUpdate({ orientation: o })}
              className={`flex-1 text-xs py-1 rounded border transition-colors ${cfg.orientation === o ? 'bg-amber-100 border-amber-400 text-amber-700' : 'border-stone-200 text-stone-600 hover:border-amber-300'}`}
            >
              {o === 'horizontal' ? 'Horizontal' : 'Vertical'}
            </button>
          ))}
        </div>
      </Row>
      <Row label={`Grosor: ${cfg.thickness ?? 2}px`}>
        <input
          type="range" min={1} max={20}
          value={cfg.thickness ?? 2}
          onChange={e => onUpdate({ thickness: Number(e.target.value) })}
          className="w-full accent-amber-500"
        />
      </Row>
      <ColorRow label="Color" value={cfg.lineColor ?? '#000000'} onChange={v => onUpdate({ lineColor: v })} />
      <Row label="Estilo">
        <select
          value={cfg.lineStyle ?? 'solid'}
          onChange={e => onUpdate({ lineStyle: e.target.value as 'solid' | 'dashed' | 'dotted' })}
          className="w-full text-xs border border-stone-200 rounded px-2 py-1 outline-none focus:border-amber-400"
        >
          <option value="solid">Sólido</option>
          <option value="dashed">Punteado largo</option>
          <option value="dotted">Punteado corto</option>
        </select>
      </Row>
    </div>
  )
}

function ShapeProperties({ cfg, onUpdate }: { cfg: MenuElementConfig; onUpdate: (c: Partial<MenuElementConfig>) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Forma</p>
      <Row label="Tipo">
        <div className="flex gap-1">
          {([['rectangle', 'Rectángulo', Square], ['circle', 'Círculo', Circle]] as const).map(([val, label, Icon]) => (
            <button
              key={val}
              onClick={() => onUpdate({ shapeType: val })}
              className={`flex-1 flex items-center justify-center gap-1 text-xs py-1 rounded border transition-colors ${cfg.shapeType === val ? 'bg-amber-100 border-amber-400 text-amber-700' : 'border-stone-200 text-stone-600 hover:border-amber-300'}`}
            >
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>
      </Row>
      <ColorRow label="Relleno" value={cfg.fillColor ?? '#ffffff'} onChange={v => onUpdate({ fillColor: v })} />
      <ColorRow label="Borde" value={cfg.borderColor ?? '#000000'} onChange={v => onUpdate({ borderColor: v })} />
      <Row label={`Grosor borde: ${cfg.borderWidth ?? 0}px`}>
        <input
          type="range" min={0} max={10}
          value={cfg.borderWidth ?? 0}
          onChange={e => onUpdate({ borderWidth: Number(e.target.value) })}
          className="w-full accent-amber-500"
        />
      </Row>
      {cfg.shapeType !== 'circle' && (
        <Row label={`Radio: ${cfg.borderRadius ?? 0}px`}>
          <input
            type="range" min={0} max={60}
            value={cfg.borderRadius ?? 0}
            onChange={e => onUpdate({ borderRadius: Number(e.target.value) })}
            className="w-full accent-amber-500"
          />
        </Row>
      )}
      <Row label={`Opacidad: ${Math.round((cfg.opacity ?? 1) * 100)}%`}>
        <input
          type="range" min={0} max={1} step={0.05}
          value={cfg.opacity ?? 1}
          onChange={e => onUpdate({ opacity: Number(e.target.value) })}
          className="w-full accent-amber-500"
        />
      </Row>
    </div>
  )
}

function ProductProperties({ cfg, products, onUpdate }: { cfg: MenuElementConfig; products: Product[]; onUpdate: (c: Partial<MenuElementConfig>) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Producto</p>
      <Row label="Producto">
        <select
          value={cfg.productId ?? ''}
          onChange={e => {
            const product = products.find(p => p.id === e.target.value)
            if (product) onUpdate({ productId: product.id, productName: product.name, productPrice: product.sale_price, productImageUrl: product.image_url })
          }}
          className="w-full text-xs border border-stone-200 rounded px-2 py-1 outline-none focus:border-amber-400"
        >
          <option value="">Seleccionar...</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </Row>
      <Row label="Mostrar">
        <div className="space-y-1">
          {[
            { key: 'showImage', label: 'Imagen' } as const,
            { key: 'showPrice', label: 'Precio' } as const,
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cfg[key] ?? true}
                onChange={e => onUpdate({ [key]: e.target.checked })}
                className="accent-amber-500"
              />
              <span className="text-xs text-stone-600">{label}</span>
            </label>
          ))}
        </div>
      </Row>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  branchId: string
  menus: Menu[]
  initialMenu: Menu | null
  initialElements: MenuElement[]
  products: Product[]
  categories: Category[]
}

export function MenuEditor({ branchId, menus: initialMenus, initialMenu, initialElements, products, categories }: Props) {
  const supabase = createClient()

  // ── State ──────────────────────────────────────────────────────────────────
  const [menus, setMenus]               = useState<Menu[]>(initialMenus)
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(initialMenu?.id ?? null)
  const [menuName, setMenuName]         = useState(initialMenu?.name ?? 'Mi Menú')
  const [bgColor, setBgColor]           = useState(initialMenu?.bg_color ?? '#FFFFFF')
  const [bgImageUrl, setBgImageUrl]     = useState<string | null>(initialMenu?.bg_image_url ?? null)
  const [elements, setElements]         = useState<MenuElement[]>(initialElements)
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [previewMode, setPreviewMode]   = useState(false)
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [dirty, setDirty]               = useState(false)
  const [creatingMenu, setCreatingMenu] = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [showMenuDropdown, setShowMenuDropdown]       = useState(false)
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false)
  const [showExportModal, setShowExportModal]         = useState(false)
  const [exportFormat, setExportFormat]               = useState<ExportFormat>('pdf')
  const [exportSize, setExportSize]                   = useState<ExportSize>('a4')
  const [exportScale, setExportScale]                 = useState<1 | 2>(2)
  const [exporting, setExporting]                     = useState(false)
  const [scale, setScale]               = useState(0.7)

  const interactionRef = useRef<InteractionState>({ kind: 'idle' })
  const canvasRef      = useRef<HTMLDivElement>(null)
  const containerRef   = useRef<HTMLDivElement>(null)

  // ── Scale observer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(() => {
      const w = containerRef.current!.clientWidth - 64
      setScale(Math.min(w / CANVAS_W, 1))
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // ── Mark dirty on changes ──────────────────────────────────────────────────
  useEffect(() => { setDirty(true) }, [elements, bgColor, bgImageUrl, menuName])

  // ── Load menu ──────────────────────────────────────────────────────────────
  const loadMenu = useCallback(async (menuId: string) => {
    const [{ data: menu }, { data: els }] = await Promise.all([
      supabase.from('menus').select('*').eq('id', menuId).single(),
      supabase.from('menu_elements').select('*').eq('menu_id', menuId).order('z_index'),
    ])
    if (menu) {
      setMenuName(menu.name)
      setBgColor(menu.bg_color)
      setBgImageUrl(menu.bg_image_url)
    }
    setElements((els as MenuElement[]) ?? [])
    setSelectedId(null)
    setDirty(false)
  }, [supabase])

  // ── Canvas mouse coordinate helper ─────────────────────────────────────────
  function getCanvasCoords(e: MouseEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect()
    const s    = rect.width / CANVAS_W
    return {
      x: (e.clientX - rect.left) / s,
      y: (e.clientY - rect.top)  / s,
    }
  }

  // ── Mouse events (canvas-level) ────────────────────────────────────────────
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const interaction = interactionRef.current
      if (interaction.kind === 'idle') return
      const { x, y } = getCanvasCoords(e)

      if (interaction.kind === 'drag') {
        const dx = x - interaction.startMouseX
        const dy = y - interaction.startMouseY
        setElements(prev => prev.map(el =>
          el.id === interaction.id
            ? { ...el, x: interaction.startElX + dx, y: interaction.startElY + dy }
            : el
        ))
      } else if (interaction.kind === 'resize') {
        const dx = x - interaction.startMouseX
        const dy = y - interaction.startMouseY
        const geom = applyResize(interaction.handle, interaction.startEl, dx, dy)
        setElements(prev => prev.map(el => el.id === interaction.id ? { ...el, ...geom } : el))
      }
    }

    function onMouseUp() {
      interactionRef.current = { kind: 'idle' }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // ── Delete on keyboard ─────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!selectedId) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
        setElements(prev => prev.filter(el => el.id !== selectedId))
        setSelectedId(null)
      }
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId])

  // ── Add element ────────────────────────────────────────────────────────────
  function addElement(type: MenuElementType, extra?: Partial<MenuElementConfig>) {
    const maxZ = elements.reduce((m, el) => Math.max(m, el.z_index), 0)
    const { width, height } = defaultSize(type)
    const x = Math.max(0, (CANVAS_W - width) / 2)
    const y = Math.max(0, (CANVAS_H - height) / 2)
    const newEl: MenuElement = {
      id:      newId(),
      menu_id: selectedMenuId ?? '',
      type,
      x, y, width, height,
      z_index: maxZ + 1,
      config:  { ...defaultConfig(type), ...extra },
    }
    setElements(prev => [...prev, newEl])
    setSelectedId(newEl.id)
  }

  // ── Update element ─────────────────────────────────────────────────────────
  function updateConfig(id: string, config: Partial<MenuElementConfig>) {
    setElements(prev => prev.map(el => el.id === id ? { ...el, config: { ...el.config, ...config } } : el))
  }

  function updateGeometry(id: string, geom: Partial<Pick<MenuElement, 'x' | 'y' | 'width' | 'height'>>) {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...geom } : el))
  }

  function deleteElement(id: string) {
    setElements(prev => prev.filter(el => el.id !== id))
    setSelectedId(null)
  }

  function bringForward(id: string) {
    setElements(prev => {
      const el = prev.find(e => e.id === id)
      if (!el) return prev
      const above = prev.filter(e => e.z_index > el.z_index).sort((a, b) => a.z_index - b.z_index)[0]
      if (!above) return prev
      return prev.map(e => {
        if (e.id === id) return { ...e, z_index: above.z_index }
        if (e.id === above.id) return { ...e, z_index: el.z_index }
        return e
      })
    })
  }

  function sendBackward(id: string) {
    setElements(prev => {
      const el = prev.find(e => e.id === id)
      if (!el) return prev
      const below = prev.filter(e => e.z_index < el.z_index).sort((a, b) => b.z_index - a.z_index)[0]
      if (!below) return prev
      return prev.map(e => {
        if (e.id === id) return { ...e, z_index: below.z_index }
        if (e.id === below.id) return { ...e, z_index: el.z_index }
        return e
      })
    })
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true)
    try {
      let menuId = selectedMenuId

      if (!menuId) {
        const { data: created, error } = await supabase
          .from('menus')
          .insert({ branch_id: branchId, name: menuName, bg_color: bgColor, bg_image_url: bgImageUrl || null })
          .select()
          .single()
        if (error || !created) throw error
        menuId = created.id
        setSelectedMenuId(menuId)
        setMenus(prev => [...prev, created as Menu])
      } else {
        await supabase.from('menus').update({
          name: menuName, bg_color: bgColor, bg_image_url: bgImageUrl || null, updated_at: new Date().toISOString(),
        }).eq('id', menuId)
      }

      // Replace all elements
      await supabase.from('menu_elements').delete().eq('menu_id', menuId)
      if (elements.length > 0) {
        await supabase.from('menu_elements').insert(
          elements.map(el => ({
            menu_id: menuId!, type: el.type,
            x: Math.round(el.x), y: Math.round(el.y),
            width: Math.round(el.width), height: Math.round(el.height),
            z_index: el.z_index, config: el.config,
          }))
        )
      }

      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  // ── Create new menu ────────────────────────────────────────────────────────
  async function createNewMenu() {
    setCreatingMenu(true)
    const { data, error } = await supabase
      .from('menus')
      .insert({ branch_id: branchId, name: 'Nuevo Menú', bg_color: '#FFFFFF' })
      .select()
      .single()
    setCreatingMenu(false)
    if (error || !data) return
    const newMenu = data as Menu
    setMenus(prev => [...prev, newMenu])
    setSelectedMenuId(newMenu.id)
    setMenuName(newMenu.name)
    setBgColor(newMenu.bg_color)
    setBgImageUrl(null)
    setElements([])
    setSelectedId(null)
    setDirty(false)
    setShowMenuDropdown(false)
  }

  const selectedEl = elements.find(el => el.id === selectedId)

  // ── Generate suggested menu ────────────────────────────────────────────────
  function buildSuggestedElements(): MenuElement[] {
    const MARGIN = 30
    const GAP    = 14
    const COL_W  = Math.floor((CANVAS_W - MARGIN * 2 - GAP) / 2)
    const COL1_X = MARGIN
    const COL2_X = MARGIN + COL_W + GAP

    const items: MenuElement[] = []
    let zc = 0
    const mk = (type: MenuElementType, x: number, y: number, w: number, h: number, config: MenuElementConfig): MenuElement => ({
      id: newId(), menu_id: selectedMenuId ?? '', type, x, y, width: w, height: h, z_index: ++zc, config,
    })

    // ── Header background ──────────────────────────────────────────────────
    items.push(mk('shape', 0, 0, CANVAS_W, 118, { shapeType: 'rectangle', fillColor: '#5c2a08', borderWidth: 0, borderRadius: 0 }))

    // Decorative border frame
    items.push(mk('shape', 10, 128, CANVAS_W - 20, CANVAS_H - 138, {
      shapeType: 'rectangle', fillColor: 'transparent',
      borderColor: '#c9a87a', borderWidth: 2, borderRadius: 4,
    }))

    // Restaurant name
    const restName = menuName || 'Mi Restaurante'
    items.push(mk('text', MARGIN, 16, CANVAS_W - MARGIN * 2, 52, {
      text: restName, fontSize: 30, fontWeight: 'bold', color: '#ffffff', textAlign: 'center',
    }))

    // Tagline
    items.push(mk('text', MARGIN, 70, CANVAS_W - MARGIN * 2, 28, {
      text: '— Menú —', fontSize: 13, fontWeight: 'normal', color: '#c9a87a', textAlign: 'center', italic: true,
    }))

    // Gold top separator
    items.push(mk('line', MARGIN + 20, 134, CANVAS_W - (MARGIN + 20) * 2, 3, {
      orientation: 'horizontal', lineColor: '#c9a87a', thickness: 3, lineStyle: 'solid',
    }))

    let y = 152
    const MAX_Y = CANVAS_H - 46

    // ── Sections ───────────────────────────────────────────────────────────
    const sections = [
      ...categories
        .map(cat => ({ name: cat.emoji ? `${cat.emoji}  ${cat.name}` : cat.name, prods: products.filter(p => p.category_id === cat.id) }))
        .filter(s => s.prods.length > 0),
      ...(products.filter(p => !p.category_id).length > 0
        ? [{ name: 'Otros', prods: products.filter(p => !p.category_id) }]
        : []),
    ]

    for (let si = 0; si < sections.length; si++) {
      const { name, prods } = sections[si]
      if (y > MAX_Y - 90) break

      // Category heading
      items.push(mk('text', MARGIN + 20, y, CANVAS_W - (MARGIN + 20) * 2, 36, {
        text: name, fontSize: 17, fontWeight: 'bold', color: '#5c2a08', textAlign: 'center',
      }))
      y += 36

      // Short gold rule under heading
      const ruleW = 180
      items.push(mk('line', (CANVAS_W - ruleW) / 2, y, ruleW, 2, {
        orientation: 'horizontal', lineColor: '#c9a87a', thickness: 2, lineStyle: 'solid',
      }))
      y += 10

      // Products 2-column
      const PROD_H = 58
      for (let pi = 0; pi < prods.length; pi += 2) {
        if (y + PROD_H > MAX_Y) break
        const p1 = prods[pi], p2 = prods[pi + 1]
        items.push(mk('product', COL1_X, y, COL_W, PROD_H, {
          productId: p1.id, productName: p1.name, productPrice: p1.sale_price,
          productImageUrl: p1.image_url, showImage: false, showPrice: true,
        }))
        if (p2) {
          items.push(mk('product', COL2_X, y, COL_W, PROD_H, {
            productId: p2.id, productName: p2.name, productPrice: p2.sale_price,
            productImageUrl: p2.image_url, showImage: false, showPrice: true,
          }))
        }
        y += PROD_H + 4
      }

      y += 10

      // Section divider (except after last)
      if (si < sections.length - 1 && y < MAX_Y - 50) {
        items.push(mk('line', MARGIN + 50, y, CANVAS_W - (MARGIN + 50) * 2, 1, {
          orientation: 'horizontal', lineColor: '#e2cba8', thickness: 1, lineStyle: 'dashed',
        }))
        y += 14
      }
    }

    // ── Footer ─────────────────────────────────────────────────────────────
    items.push(mk('line', MARGIN + 20, CANVAS_H - 36, CANVAS_W - (MARGIN + 20) * 2, 2, {
      orientation: 'horizontal', lineColor: '#c9a87a', thickness: 2, lineStyle: 'solid',
    }))
    items.push(mk('text', MARGIN, CANVAS_H - 30, CANVAS_W - MARGIN * 2, 24, {
      text: '¡Gracias por su visita!', fontSize: 11, color: '#9a7a5a', textAlign: 'center', italic: true,
    }))

    return items
  }

  // ── Export PDF ─────────────────────────────────────────────────────────────
  function exportPDF(size: ExportSize) {
    const { wMm, hMm } = PAGE_SIZES[size]
    const scaleFactor  = wMm / 210  // A4 canvas = 210mm base

    const elementsHTML = [...elements]
      .sort((a, b) => a.z_index - b.z_index)
      .map(el => elementToHTML(el, products))
      .join('')

    const bgImg = bgImageUrl
      ? `background-image:url('${bgImageUrl}');background-size:cover;background-position:center;`
      : ''

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(menuName)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
@page{size:${wMm}mm ${hMm}mm;margin:0;}
html,body{width:${wMm}mm;height:${hMm}mm;overflow:hidden;font-family:system-ui,sans-serif;}
.canvas{position:relative;width:${CANVAS_W}px;height:${CANVAS_H}px;background-color:${bgColor};${bgImg}overflow:hidden;transform-origin:top left;${scaleFactor !== 1 ? `transform:scale(${scaleFactor.toFixed(6)});` : ''}}
</style>
</head>
<body>
<div class="canvas">${elementsHTML}</div>
<script>
window.addEventListener('load',function(){
  var imgs=document.images,pending=imgs.length;
  if(!pending){setTimeout(function(){window.print();},200);return;}
  var done=function(){if(--pending<=0)setTimeout(function(){window.print();},200);};
  for(var i=0;i<imgs.length;i++){if(imgs[i].complete)done();else{imgs[i].addEventListener('load',done);imgs[i].addEventListener('error',done);}}
});
<\/script>
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) { alert('Permite popups para exportar.'); return }
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  // ── Export PNG ─────────────────────────────────────────────────────────────
  async function exportPNG(scale: 1 | 2) {
    if (!canvasRef.current) return
    setExporting(true)
    try {
      // Import dynamically to avoid SSR issues
      const html2canvas = (await import('html2canvas')).default

      // Temporarily remove the CSS transform so html2canvas captures full-res
      const el = canvasRef.current
      const prevTransform = el.style.transform
      const prevPosition  = el.style.position
      el.style.transform  = 'none'
      el.style.position   = 'relative'

      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: bgColor,
        width:  CANVAS_W,
        height: CANVAS_H,
        logging: false,
      })

      el.style.transform = prevTransform
      el.style.position  = prevPosition

      canvas.toBlob(blob => {
        if (!blob) return
        const url  = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = `${menuName.replace(/\s+/g, '-')}.png`
        link.href = url
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }, 'image/png')
    } finally {
      setExporting(false)
    }
  }

  async function runExport() {
    setShowExportModal(false)
    if (exportFormat === 'pdf') {
      exportPDF(exportSize)
    } else {
      await exportPNG(exportScale)
    }
  }

  function applyGeneratedMenu() {
    const newElements = buildSuggestedElements()
    setElements(newElements)
    setBgColor('#FDF6EC')
    setBgImageUrl(null)
    setSelectedId(null)
    setDirty(true)
    setShowGenerateConfirm(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-stone-100">
      {/* Top bar */}
      <div className="bg-white border-b border-stone-200 px-4 py-2.5 flex items-center gap-3 shrink-0">
        <LayoutTemplate className="w-5 h-5 text-amber-600 shrink-0" />

        {/* Menu selector */}
        <div className="relative">
          <button
            onClick={() => setShowMenuDropdown(s => !s)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 hover:border-amber-400 text-sm font-medium text-stone-700 min-w-0 max-w-[200px]"
          >
            <span className="truncate">{menuName}</span>
            <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
          </button>
          {showMenuDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-50 min-w-[200px] overflow-hidden">
              {menus.map(m => (
                <button
                  key={m.id}
                  onClick={async () => {
                    setSelectedMenuId(m.id)
                    setShowMenuDropdown(false)
                    await loadMenu(m.id)
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50 transition-colors flex items-center gap-2 ${m.id === selectedMenuId ? 'text-amber-700 font-medium' : 'text-stone-700'}`}
                >
                  {m.id === selectedMenuId && <Check className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{m.name}</span>
                </button>
              ))}
              <div className="border-t border-stone-100">
                <button
                  onClick={createNewMenu}
                  disabled={creatingMenu}
                  className="w-full text-left px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2 transition-colors"
                >
                  {creatingMenu ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Nuevo menú
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Editable name */}
        <input
          type="text"
          value={menuName}
          onChange={e => setMenuName(e.target.value)}
          className="flex-1 min-w-0 text-sm font-medium text-stone-700 border-b border-transparent hover:border-stone-300 focus:border-amber-400 outline-none px-1 py-0.5 bg-transparent"
          placeholder="Nombre del menú"
        />

        <div className="flex items-center gap-2 shrink-0">
          {dirty && !saving && (
            <span className="text-xs text-stone-400">Sin guardar</span>
          )}
          {saved && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Guardado
            </span>
          )}

          {/* Generate suggested layout */}
          {!previewMode && (
            <button
              onClick={() => {
                if (elements.length > 0) {
                  setShowGenerateConfirm(true)
                } else {
                  applyGeneratedMenu()
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-medium transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Generar diseño
            </button>
          )}

          <button
            onClick={() => { setPreviewMode(m => !m); setSelectedId(null) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${previewMode ? 'bg-amber-100 border-amber-400 text-amber-700' : 'border-stone-200 text-stone-600 hover:border-amber-400'}`}
          >
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {previewMode ? 'Editar' : 'Vista previa'}
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            disabled={elements.length === 0 || exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:border-amber-400 hover:text-amber-700 text-sm transition-colors disabled:opacity-40"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar
          </button>

          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Toolbox */}
        {!previewMode && (
          <Toolbox
            bgColor={bgColor}
            bgImageUrl={bgImageUrl}
            onBgColorChange={setBgColor}
            onBgImageChange={url => setBgImageUrl(url || null)}
            onAdd={addElement}
            products={products}
            categories={categories}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}

        {/* Canvas area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto"
          style={{ padding: 32 }}
          onClick={() => setSelectedId(null)}
        >
          {/* Scaled canvas wrapper */}
          <div
            style={{
              width:    CANVAS_W * scale,
              height:   CANVAS_H * scale,
              position: 'relative',
              margin:   '0 auto',
            }}
          >
            <div
              ref={canvasRef}
              style={{
                width:           CANVAS_W,
                height:          CANVAS_H,
                transform:       `scale(${scale})`,
                transformOrigin: 'top left',
                position:        'absolute',
                backgroundColor: bgColor,
                boxShadow:       '0 4px 24px rgba(0,0,0,0.12)',
                overflow:        'hidden',
                userSelect:      'none',
              }}
            >
              {/* Background image */}
              {bgImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bgImageUrl}
                  alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                />
              )}

              {/* Elements sorted by z_index */}
              {[...elements].sort((a, b) => a.z_index - b.z_index).map(el => {
                const isSelected = selectedId === el.id && !previewMode

                return (
                  <div
                    key={el.id}
                    style={{
                      position:  'absolute',
                      left:      el.x,
                      top:       el.y,
                      width:     el.width,
                      height:    el.height,
                      zIndex:    el.z_index,
                      cursor:    previewMode ? 'default' : 'move',
                      outline:   isSelected ? '2px solid #f59e0b' : 'none',
                      outlineOffset: 1,
                    }}
                    onMouseDown={e => {
                      if (previewMode) return
                      e.stopPropagation()
                      e.preventDefault()
                      setSelectedId(el.id)
                      const { x, y } = getCanvasCoords(e.nativeEvent)
                      interactionRef.current = {
                        kind: 'drag',
                        id: el.id,
                        startMouseX: x, startMouseY: y,
                        startElX: el.x, startElY: el.y,
                      }
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <ElementContent el={el} products={products} />

                    {/* Resize handles */}
                    {isSelected && RESIZE_HANDLES.map(handle => {
                      const isN = handle.includes('n')
                      const isS = handle.includes('s')
                      const isW = handle.includes('w')
                      const isE = handle.includes('e')
                      const top  = isN ? -4 : isS ? el.height - 4 : el.height / 2 - 4
                      const left = isW ? -4 : isE ? el.width - 4  : el.width  / 2 - 4

                      return (
                        <div
                          key={handle}
                          style={{
                            position: 'absolute',
                            top, left,
                            width:  8, height: 8,
                            background: 'white',
                            border: '2px solid #f59e0b',
                            borderRadius: 2,
                            cursor: HANDLE_CURSORS[handle],
                            zIndex: 999,
                          }}
                          onMouseDown={e => {
                            e.stopPropagation()
                            e.preventDefault()
                            const { x, y } = getCanvasCoords(e.nativeEvent)
                            interactionRef.current = {
                              kind: 'resize',
                              id: el.id,
                              handle,
                              startMouseX: x, startMouseY: y,
                              startEl: { ...el },
                            }
                          }}
                        />
                      )
                    })}
                  </div>
                )
              })}

              {/* Empty state */}
              {elements.length === 0 && !previewMode && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                  style={{ opacity: 0.35 }}
                >
                  <Layers className="w-16 h-16 text-stone-400 mb-3" />
                  <p className="text-stone-500 text-lg font-medium">Canvas vacío</p>
                  <p className="text-stone-400 text-sm mt-1">Usa el panel izquierdo para agregar elementos</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Properties panel */}
        {!previewMode && selectedEl && (
          <PropertiesPanel
            el={selectedEl}
            products={products}
            onUpdate={config => updateConfig(selectedEl.id, config)}
            onUpdateGeometry={geom => updateGeometry(selectedEl.id, geom)}
            onDelete={() => deleteElement(selectedEl.id)}
            onBringForward={() => bringForward(selectedEl.id)}
            onSendBackward={() => sendBackward(selectedEl.id)}
          />
        )}
      </div>

      {/* Click outside menu dropdown */}
      {showMenuDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenuDropdown(false)}
        />
      )}

      {/* Export modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-amber-600" />
                <span className="font-semibold text-stone-800">Exportar menú</span>
              </div>
              <button onClick={() => setShowExportModal(false)} className="p-1 rounded hover:bg-stone-100 text-stone-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Format */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Formato</p>
              <div className="flex gap-2">
                {([['pdf', '📄 PDF', 'Para imprimir o compartir'], ['png', '🖼️ PNG', 'Imagen de alta resolución']] as const).map(([fmt, label, desc]) => (
                  <button
                    key={fmt}
                    onClick={() => setExportFormat(fmt)}
                    className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-left transition-colors ${exportFormat === fmt ? 'border-amber-400 bg-amber-50' : 'border-stone-200 hover:border-stone-300'}`}
                  >
                    <p className="text-sm font-medium text-stone-700">{label}</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Size (PDF only) */}
            {exportFormat === 'pdf' && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Tamaño de página</p>
                <div className="space-y-1.5">
                  {(Object.entries(PAGE_SIZES) as [ExportSize, typeof PAGE_SIZES[ExportSize]][]).map(([key, { label }]) => (
                    <label key={key} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-stone-50 cursor-pointer">
                      <input
                        type="radio"
                        name="export-size"
                        value={key}
                        checked={exportSize === key}
                        onChange={() => setExportSize(key)}
                        className="accent-amber-500"
                      />
                      <span className="text-sm text-stone-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution (PNG only) */}
            {exportFormat === 'png' && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Resolución</p>
                <div className="flex gap-2">
                  {([
                    [1, 'Normal', '794 × 1123 px'],
                    [2, 'Alta calidad', '1588 × 2246 px'],
                  ] as const).map(([sc, label, dims]) => (
                    <button
                      key={sc}
                      onClick={() => setExportScale(sc)}
                      className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-left transition-colors ${exportScale === sc ? 'border-amber-400 bg-amber-50' : 'border-stone-200 hover:border-stone-300'}`}
                    >
                      <p className="text-sm font-medium text-stone-700">{label}</p>
                      <p className="text-[10px] text-stone-400 mt-0.5">{dims}</p>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-400 mt-2">
                  Las imágenes externas (fotos de productos) requieren que Supabase Storage tenga CORS habilitado.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t border-stone-100">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-lg border border-stone-200 text-stone-600 text-sm hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={runExport}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {exportFormat === 'pdf' ? 'Abrir PDF' : 'Descargar PNG'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm generate modal */}
      {showGenerateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-stone-800">Generar diseño sugerido</p>
                <p className="text-sm text-stone-500">Se reemplazarán los elementos actuales</p>
              </div>
            </div>
            <p className="text-sm text-stone-600 mb-5">
              El sistema creará un menú completo con tus productos organizados por categoría, con un diseño profesional listo para editar.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowGenerateConfirm(false)}
                className="px-4 py-2 rounded-lg border border-stone-200 text-stone-600 text-sm hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={applyGeneratedMenu}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Generar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
