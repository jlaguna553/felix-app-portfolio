import type { AIProvider, AgentResponse, ChatMessage, ToolCall, ToolDefinition } from '../types'

// Native Ollama /api/chat format (works in all versions)
interface OllamaMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> }
  }>
}

interface OllamaResponse {
  message: OllamaMessage
  done: boolean
  done_reason?: string
}

function toOllamaTools(tools: ToolDefinition[]) {
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

export class OllamaProvider implements AIProvider {
  private baseUrl: string
  private model: string

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl.trim().replace(/\/$/, '')
    this.model = model
  }

  async run({
    messages,
    tools,
    systemPrompt,
    onToolCall,
  }: {
    messages: ChatMessage[]
    tools: ToolDefinition[]
    systemPrompt: string
    onToolCall: (tc: ToolCall) => Promise<unknown>
  }): Promise<AgentResponse> {
    const ollamaMessages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ]
    const ollamaTools = toOllamaTools(tools)
    const executedCalls: AgentResponse['toolCalls'] = []
    let maxIterations = 10

    while (maxIterations-- > 0) {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: ollamaMessages,
          tools: ollamaTools,
          stream: false,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        return { content: `Error de Ollama (${res.status}): ${text}`, toolCalls: executedCalls }
      }

      const data: OllamaResponse = await res.json()
      const assistantMsg = data.message

      if (!assistantMsg) {
        return { content: 'Ollama no devolvió respuesta.', toolCalls: executedCalls }
      }

      // No tool calls → done
      if (!assistantMsg.tool_calls?.length) {
        return { content: assistantMsg.content ?? '', toolCalls: executedCalls }
      }

      // Add assistant message with tool calls to history
      ollamaMessages.push(assistantMsg)

      // Execute each tool call — native Ollama sends arguments as object (not JSON string)
      for (const tc of assistantMsg.tool_calls) {
        const input = tc.function.arguments ?? {}
        const callId = `${tc.function.name}_${Date.now()}`
        const result = await onToolCall({ id: callId, name: tc.function.name, input })
        executedCalls.push({ id: callId, name: tc.function.name, input, result })

        ollamaMessages.push({
          role: 'tool',
          content: JSON.stringify(result),
        })
      }
    }

    return { content: 'Se alcanzó el límite de iteraciones del agente.', toolCalls: executedCalls }
  }
}
