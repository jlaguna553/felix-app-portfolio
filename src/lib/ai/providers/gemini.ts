import { GoogleGenerativeAI, type FunctionDeclaration, type Part } from '@google/generative-ai'
import type { AIProvider, AgentResponse, ChatMessage, ToolCall, ToolDefinition } from '../types'

function toGeminiTools(tools: ToolDefinition[]): FunctionDeclaration[] {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: 'OBJECT',
      properties: Object.fromEntries(
        Object.entries(t.parameters.properties).map(([k, v]) => [
          k,
          { type: v.type.toUpperCase(), description: v.description },
        ])
      ),
      required: t.parameters.required ?? [],
    } as unknown as FunctionDeclaration['parameters'],
  }))
}

export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI
  private model: string

  constructor(apiKey: string, model: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
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
    const genModel = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: toGeminiTools(tools) }],
    })

    // Convert history (all but the last user message)
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }] as Part[],
    }))

    const chat = genModel.startChat({ history })
    const lastMessage = messages[messages.length - 1]?.content ?? ''

    const executedCalls: AgentResponse['toolCalls'] = []
    let maxIterations = 10
    let currentMessage: string | Part[] = lastMessage

    while (maxIterations-- > 0) {
      const result = await chat.sendMessage(currentMessage)
      const response = result.response
      const parts = response.candidates?.[0]?.content?.parts ?? []

      const functionCalls = parts.filter(p => p.functionCall)
      const textParts = parts.filter(p => p.text).map(p => p.text ?? '').join('')

      if (functionCalls.length === 0) {
        return { content: textParts, toolCalls: executedCalls }
      }

      // Execute function calls and build response parts
      const responseParts: Part[] = []
      for (const part of functionCalls) {
        const fc = part.functionCall!
        const input = fc.args as Record<string, unknown>
        const callId = fc.name + '_' + Date.now()
        const toolResult = await onToolCall({ id: callId, name: fc.name, input })
        executedCalls.push({ id: callId, name: fc.name, input, result: toolResult })
        responseParts.push({
          functionResponse: {
            name: fc.name,
            response: { result: toolResult },
          },
        })
      }

      currentMessage = responseParts
    }

    return { content: 'Se alcanzó el límite de iteraciones del agente.', toolCalls: executedCalls }
  }
}
