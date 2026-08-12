import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, AgentResponse, ChatMessage, ToolCall, ToolDefinition } from '../types'

type ClaudeMessage = Anthropic.MessageParam

function toClaudeMessages(messages: ChatMessage[]): ClaudeMessage[] {
  return messages.map(m => ({ role: m.role, content: m.content }))
}

function toClaudeTools(tools: ToolDefinition[]): Anthropic.Tool[] {
  return tools.map((t, i) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool['input_schema'],
    // Cache the full tool list on the last tool entry — saves ~70% on tool tokens
    ...(i === tools.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
  }))
}

export class ClaudeProvider implements AIProvider {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey })
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
    const claudeMessages: ClaudeMessage[] = toClaudeMessages(messages)
    const claudeTools = toClaudeTools(tools)
    const executedCalls: AgentResponse['toolCalls'] = []
    let maxIterations = 10

    // Cache the system prompt — it's static per conversation and the largest token block
    const systemWithCache: Anthropic.TextBlockParam[] = [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
    ]

    while (maxIterations-- > 0) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemWithCache,
        messages: claudeMessages,
        tools: claudeTools,
      })

      const textBlocks = response.content.filter(b => b.type === 'text')
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')

      if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
        return {
          content: textBlocks.map(b => (b as Anthropic.TextBlock).text).join(''),
          toolCalls: executedCalls,
        }
      }

      // Execute all tool calls in this turn
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of toolUseBlocks) {
        const tb = block as Anthropic.ToolUseBlock
        const result = await onToolCall({ id: tb.id, name: tb.name, input: tb.input as Record<string, unknown> })
        executedCalls.push({ id: tb.id, name: tb.name, input: tb.input as Record<string, unknown>, result })
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tb.id,
          content: JSON.stringify(result),
        })
      }

      claudeMessages.push({ role: 'assistant', content: response.content })
      claudeMessages.push({ role: 'user', content: toolResults })
    }

    return { content: 'Se alcanzó el límite de iteraciones del agente.', toolCalls: executedCalls }
  }
}
