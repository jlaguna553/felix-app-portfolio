'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send, Plus, Trash2, Settings,
  Bot, MessageSquare, Wrench, Loader2, X, Save, Eye, EyeOff,
  RefreshCw, Building2,
} from 'lucide-react'

interface Conversation {
  id: string
  title: string
  provider: string
  model: string
  updated_at: string
}

interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  result: unknown
}

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  tool_calls?: ToolCall[] | null
}

interface AISettings {
  provider: 'claude' | 'gemini' | 'ollama'
  model: string
  ollamaUrl: string
  hasClaudeKey: boolean
  hasGeminiKey: boolean
  businessName: string
  businessType: string
  businessDescription: string
  businessContext: string
  lastTrainedAt: string
}

const TOOL_LABELS: Record<string, string> = {
  get_products:       'Consultó productos',
  get_categories:     'Consultó categorías',
  get_inventory:      'Consultó inventario',
  get_active_tabs:    'Consultó mesas activas',
  get_orders:         'Consultó pedidos',
  get_shift_status:   'Consultó estado del turno',
  get_sales_summary:  'Generó reporte de ventas',
  get_promotions:     'Consultó promociones',
  create_product:     'Creó producto',
  update_product:     'Actualizó producto',
  update_inventory:   'Actualizó inventario',
  toggle_promotion:   'Cambió promoción',
  create_order:       'Creó pedido',
  get_users:            'Consultó equipo',
  get_tables:           'Consultó mesas',
  create_user:          'Creó usuario',
  update_user:          'Actualizó usuario',
  open_shift:           'Abrió turno',
  update_order_status:  'Actualizó pedido',
  create_supply:        'Creó insumo',
  create_category:      'Creó categoría',
  open_tab:             'Abrió cuenta',
  close_tab:            'Cobró cuenta',
  close_shift:          'Cerró turno',
}

const DEFAULT_MODELS: Record<string, string[]> = {
  claude: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'],
  gemini: ['gemini-2.0-flash-lite', 'gemini-1.5-flash-8b', 'gemini-2.0-flash', 'gemini-1.5-flash'],
  ollama: ['llama3.1', 'qwen2.5', 'mistral', 'deepseek-r1', 'llama3.2'],
}

// ── Simple markdown renderer (no dependencies) ───────────────────────────
function parseInline(text: string, key: number): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>)
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>)
    else if (m[4]) parts.push(<code key={m.index} className="bg-stone-100 px-1 py-0.5 rounded text-xs font-mono">{m[4]}</code>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <span key={key}>{parts}</span>
}

function MarkdownContent({ content }: { content: string }) {
  const nodes: React.ReactNode[] = []
  const lines = content.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Heading
    const headingMatch = line.match(/^(#{1,3}) (.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const cls = level === 1 ? 'font-bold text-base mt-2' : level === 2 ? 'font-semibold mt-1.5' : 'font-medium'
      nodes.push(<p key={i} className={cls}>{parseInline(headingMatch[2], i)}</p>)
      i++; continue
    }

    // Bullet list — collect consecutive bullet lines
    if (/^[\-\*] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[\-\*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[\-\*] /, ''))
        i++
      }
      nodes.push(
        <ul key={i} className="list-disc pl-4 space-y-0.5">
          {items.map((item, j) => <li key={j}>{parseInline(item, j)}</li>)}
        </ul>
      )
      continue
    }

    // Numbered list — collect consecutive numbered lines
    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''))
        i++
      }
      nodes.push(
        <ol key={i} className="list-decimal pl-4 space-y-0.5">
          {items.map((item, j) => <li key={j}>{parseInline(item, j)}</li>)}
        </ol>
      )
      continue
    }

    // Empty line → small gap (skip consecutive)
    if (line.trim() === '') { i++; continue }

    // Regular paragraph
    nodes.push(<p key={i}>{parseInline(line, i)}</p>)
    i++
  }

  return <div className="space-y-1.5 leading-relaxed">{nodes}</div>
}

function ToolCallBlock({ tc }: { tc: ToolCall }) {
  const label = TOOL_LABELS[tc.name] ?? tc.name

  return (
    <div className="mt-1 text-xs flex items-center gap-1.5 text-amber-700 px-1">
      <Wrench className="w-3 h-3 shrink-0" />
      <span>{label}</span>
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-brand-700 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-start">
      <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-4 h-4 text-brand-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-stone-800 shadow-sm border border-stone-100">
          <MarkdownContent content={msg.content} />
        </div>
        {msg.tool_calls && msg.tool_calls.length > 0 && (
          <div className="mt-1 space-y-1">
            {msg.tool_calls.map((tc, i) => <ToolCallBlock key={i} tc={tc} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [settings, setSettings] = useState<AISettings | null>(null)
  const [tab, setTab] = useState<'business' | 'ai'>('business')
  const [form, setForm] = useState({
    provider: 'claude' as string,
    model: 'claude-sonnet-4-6',
    ollamaUrl: 'http://localhost:11434',
    claudeKey: '',
    geminiKey: '',
    businessName: '',
    businessType: '',
    businessDescription: '',
    businessContext: '',
  })
  const [showClaudeKey, setShowClaudeKey] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/ai/settings')
      .then(r => r.json())
      .then(data => {
        setSettings(data)
        setForm(f => ({
          ...f,
          provider:            data.provider            ?? 'claude',
          model:               data.model               ?? 'claude-sonnet-4-6',
          ollamaUrl:           data.ollamaUrl           ?? 'http://localhost:11434',
          businessName:        data.businessName        ?? '',
          businessType:        data.businessType        ?? '',
          businessDescription: data.businessDescription ?? '',
          businessContext:     data.businessContext     ?? '',
        }))
      })
  }, [])

  async function handleAnalyze() {
    setAnalyzing(true)
    setError('')
    try {
      // Save business name/type/description first so the analyzer picks them up
      await fetch('/api/ai/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName:        form.businessName,
          businessType:        form.businessType,
          businessDescription: form.businessDescription,
        }),
      })
      const res = await fetch('/api/ai/initialize', { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      setForm(f => ({ ...f, businessContext: data.context }))
    } catch (e) {
      setError(String(e))
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const body: Record<string, string> = {
        provider:            form.provider,
        model:               form.model,
        ollamaUrl:           form.ollamaUrl,
        businessName:        form.businessName,
        businessType:        form.businessType,
        businessDescription: form.businessDescription,
        businessContext:     form.businessContext,
      }
      if (form.claudeKey) body.claudeKey = form.claudeKey
      if (form.geminiKey) body.geminiKey = form.geminiKey

      const res = await fetch('/api/ai/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      onSaved()
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const models = DEFAULT_MODELS[form.provider] ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-3 flex flex-col max-h-[92dvh]">
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="font-semibold text-stone-800">Configuración del Agente IA</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          {([
            { id: 'business', label: 'Negocio', icon: Building2 },
            { id: 'ai',       label: 'Proveedor IA', icon: Bot },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-colors
                ${tab === id
                  ? 'border-brand-700 text-brand-700'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── NEGOCIO TAB ── */}
          {tab === 'business' && (<>

            {/* Stage 1 — Pre-training (read-only info) */}
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-stone-700 text-white text-xs font-bold shrink-0">1</span>
                <p className="text-sm font-semibold text-stone-700">Conocimiento base del sistema</p>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                El agente ya viene entrenado de fábrica. Sabe cómo manejar el menú, pedidos, mesas, usuarios, inventario y reportes. Conoce las pantallas del sistema y sabe qué hacer cuando se lo pides, sin necesitar instrucciones adicionales.
              </p>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {['Menú', 'Pedidos', 'Mesas', 'Usuarios', 'Inventario', 'Reportes', 'Promociones', 'Caja'].map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 text-xs">{tag}</span>
                ))}
              </div>
            </div>

            {/* Stage 2 — Business data training */}
            <div className="rounded-xl border border-dashed border-brand-400 bg-brand-50 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-700 text-white text-xs font-bold shrink-0">2</span>
                <p className="text-sm font-semibold text-brand-800">Entrenamiento con datos del negocio</p>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                Escanea el menú, las mesas, el equipo y las promociones actuales para que el agente conozca tu negocio en específico. Vuelve a entrenar cada que hagas cambios importantes.
              </p>

              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Nombre del negocio</label>
                  <input
                    type="text"
                    value={form.businessName}
                    onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                    placeholder="Ej: Taquería El Paisa"
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Giro del negocio</label>
                  <input
                    type="text"
                    value={form.businessType}
                    onChange={e => setForm(f => ({ ...f, businessType: e.target.value }))}
                    placeholder="Ej: Taquería, restaurante, cafetería…"
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Notas adicionales <span className="text-stone-400 font-normal">(opcional)</span></label>
                  <textarea
                    value={form.businessDescription}
                    onChange={e => setForm(f => ({ ...f, businessDescription: e.target.value }))}
                    placeholder="Horario, estilo del negocio, público objetivo, notas especiales…"
                    rows={2}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-brand-700 hover:bg-brand-600 text-white disabled:opacity-60 transition-colors font-medium"
                >
                  {analyzing
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <RefreshCw className="w-3 h-3" />
                  }
                  {analyzing ? 'Entrenando…' : 'Entrenar ahora'}
                </button>
                {settings?.lastTrainedAt && (
                  <p className="text-xs text-stone-400">
                    Último entrenamiento: {new Date(settings.lastTrainedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>

            {/* Editable context output */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Contexto generado
                <span className="ml-1 text-xs text-stone-400 font-normal">(editable)</span>
              </label>
              <textarea
                value={form.businessContext}
                onChange={e => setForm(f => ({ ...f, businessContext: e.target.value }))}
                placeholder="El contexto aparecerá aquí tras entrenar, o puedes escribirlo manualmente…"
                rows={8}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none font-mono text-xs"
              />
              <p className="mt-1 text-xs text-stone-400">
                Este texto se incluye en cada conversación para personalizar al agente con tu negocio.
              </p>
            </div>
          </>)}

          {/* ── PROVEEDOR IA TAB ── */}
          {tab === 'ai' && (<>
          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Proveedor</label>
            <div className="grid grid-cols-3 gap-2">
              {(['claude', 'gemini', 'ollama'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => {
                    setForm(f => ({
                      ...f,
                      provider: p,
                      model: DEFAULT_MODELS[p]?.[0] ?? '',
                    }))
                  }}
                  className={`py-2 rounded-lg border text-sm font-medium capitalize transition-colors
                    ${form.provider === p
                      ? 'bg-brand-700 border-brand-700 text-white'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                >
                  {p === 'claude' ? 'Claude' : p === 'gemini' ? 'Gemini' : 'Ollama (local)'}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Modelo</label>
            {form.provider === 'ollama' ? (
              <input
                type="text"
                value={form.model}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                placeholder="ej: llama3.1, qwen2.5, mistral"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            ) : (
              <select
                value={form.model}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>

          {/* Claude Key */}
          {form.provider === 'claude' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                API Key de Anthropic
                {settings?.hasClaudeKey && <span className="ml-2 text-green-600 text-xs">✓ configurada</span>}
              </label>
              <div className="relative">
                <input
                  type={showClaudeKey ? 'text' : 'password'}
                  value={form.claudeKey}
                  onChange={e => setForm(f => ({ ...f, claudeKey: e.target.value }))}
                  placeholder={settings?.hasClaudeKey ? 'Dejar vacío para mantener la actual' : 'sk-ant-...'}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowClaudeKey(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showClaudeKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Gemini Key */}
          {form.provider === 'gemini' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                API Key de Google AI
                {settings?.hasGeminiKey && <span className="ml-2 text-green-600 text-xs">✓ configurada</span>}
              </label>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={form.geminiKey}
                  onChange={e => setForm(f => ({ ...f, geminiKey: e.target.value }))}
                  placeholder={settings?.hasGeminiKey ? 'Dejar vacío para mantener la actual' : 'AIza...'}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Ollama URL */}
          {form.provider === 'ollama' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">URL de Ollama</label>
              <input
                type="text"
                value={form.ollamaUrl}
                onChange={e => setForm(f => ({ ...f, ollamaUrl: e.target.value }))}
                placeholder="http://localhost:11434"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="mt-1 text-xs text-stone-400">
                Para acceso desde Vercel usa una URL pública (ngrok, Cloudflare Tunnel, etc.)
              </p>
            </div>
          )}

          </>)}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-brand-700 hover:bg-brand-600 text-white flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

interface ChatPanelProps {
  compact?: boolean
  initialConversationId?: string
}

export function ChatPanel({ compact = false, initialConversationId }: ChatPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | undefined>(initialConversationId)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  const fetchConversations = useCallback(async () => {
    const res = await fetch('/api/ai/conversations')
    if (res.ok) {
      const data = await res.json()
      setConversations(data.conversations ?? [])
    }
  }, [])

  useEffect(() => {
    if (!compact) fetchConversations()
  }, [compact, fetchConversations])

  const loadConversation = useCallback(async (id: string) => {
    setActiveConvId(id)
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/ai/conversations/${id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages ?? [])
      }
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  function newConversation() {
    setActiveConvId(undefined)
    setMessages([])
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch('/api/ai/conversations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (activeConvId === id) newConversation()
    fetchConversations()
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim()
    if (!text || isLoading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setIsLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId: activeConvId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error ?? 'Ocurrió un error. Intenta de nuevo.' }])
        return
      }

      if (!activeConvId) {
        setActiveConvId(data.conversationId)
        fetchConversations()
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        tool_calls: data.toolCalls?.length ? data.toolCalls : null,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'No se pudo conectar. Verifica tu conexión e intenta de nuevo.' }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    return isToday
      ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="flex h-full bg-stone-50 relative overflow-hidden">
      {/* Mobile sidebar overlay backdrop */}
      {!compact && mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar — only in full mode */}
      {!compact && (
        <aside className={`
          flex-col bg-white border-r border-stone-200 shrink-0
          /* mobile: display:none when closed so it never occupies flex space */
          fixed inset-y-0 left-0 w-72 z-50
          ${mobileSidebarOpen ? 'flex' : 'hidden'}
          /* desktop: always visible as static flex item */
          lg:flex lg:relative lg:inset-auto lg:w-60 lg:z-30
        `}>
          <div className="p-3 border-b border-stone-100 flex items-center gap-2">
            <button
              onClick={newConversation}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-700 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva conversación
            </button>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-stone-100 text-stone-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {conversations.length === 0 && (
              <p className="text-xs text-stone-400 text-center py-4">Sin conversaciones aún</p>
            )}
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => { loadConversation(conv.id); setMobileSidebarOpen(false) }}
                className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors
                  ${activeConvId === conv.id
                    ? 'bg-brand-50 text-brand-900'
                    : 'text-stone-600 hover:bg-stone-50'
                  }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                <span className="flex-1 truncate">{conv.title}</span>
                <span className="text-xs text-stone-400 shrink-0">{formatDate(conv.updated_at)}</span>
                <button
                  onClick={e => deleteConversation(conv.id, e)}
                  className="hidden group-hover:flex p-0.5 rounded text-stone-400 hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </button>
            ))}
          </nav>

          <div className="p-2 border-t border-stone-100">
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-stone-500 hover:bg-stone-100 text-sm transition-colors"
            >
              <Settings className="w-4 h-4" />
              Configuración IA
            </button>
          </div>
        </aside>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-3 bg-white border-b border-stone-200 shrink-0">
          {/* Mobile sidebar toggle — only in full mode */}
          {!compact && (
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors shrink-0"
              title="Conversaciones"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Bot className="w-5 h-5 text-brand-700 shrink-0" />
            <span className="font-semibold text-stone-800 text-sm truncate">
              {activeConvId
                ? (conversations.find(c => c.id === activeConvId)?.title ?? 'Conversación')
                : 'Nueva conversación'}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {compact && (
              <button
                onClick={newConversation}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors"
                title="Nueva conversación"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors"
              title="Configuración IA"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 flex flex-col">
          {loadingMessages ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-stone-400 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center">
                <Bot className="w-7 h-7 text-brand-700" />
              </div>
              <div>
                <p className="font-semibold text-stone-700">Asistente de Doña Félix</p>
                <p className="text-sm text-stone-400 mt-1">
                  Pregúntame sobre ventas, inventario, productos,<br />o pídeme que haga cambios en el sistema.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 mt-2 w-full max-w-sm">
                {[
                  '¿Cómo van las ventas de hoy?',
                  '¿Qué productos tienen stock bajo?',
                  '¿Cuántas mesas hay activas ahora?',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => send(suggestion)}
                    className="px-4 py-2 text-sm rounded-xl border border-stone-200 text-stone-600 hover:bg-white hover:shadow-sm transition-all text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))
          )}

          {isLoading && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-brand-700" />
              </div>
              <div className="flex gap-1 items-center bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-stone-100">
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 bg-white border-t border-stone-200 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje…"
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 min-h-[40px] max-h-32 overflow-y-auto"
              onInput={e => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = `${Math.min(t.scrollHeight, 128)}px`
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-xl bg-brand-700 hover:bg-brand-600 text-white disabled:opacity-40 transition-colors shrink-0"
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </button>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}
