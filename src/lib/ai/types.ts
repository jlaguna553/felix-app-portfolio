export type AIProviderType = 'claude' | 'gemini' | 'ollama'

export interface AIConfig {
  provider: AIProviderType
  model: string
  claudeKey?: string
  geminiKey?: string
  ollamaUrl?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ExecutedToolCall[]
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required?: string[]
  }
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ExecutedToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  result: unknown
}

export interface AgentResponse {
  content: string
  toolCalls: ExecutedToolCall[]
}

export interface AIProvider {
  run(options: {
    messages: ChatMessage[]
    tools: ToolDefinition[]
    systemPrompt: string
    onToolCall: (tc: ToolCall) => Promise<unknown>
  }): Promise<AgentResponse>
}
