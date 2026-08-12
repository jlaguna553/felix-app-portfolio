import type { AIConfig, AIProvider } from '../types'
import { ClaudeProvider } from './claude'
import { GeminiProvider } from './gemini'
import { OllamaProvider } from './ollama'

export function getProvider(config: AIConfig): AIProvider {
  switch (config.provider) {
    case 'claude':
      if (!config.claudeKey) throw new Error('Falta la API key de Claude. Configúrala en Configuración > IA.')
      return new ClaudeProvider(config.claudeKey, config.model ?? 'claude-haiku-4-5-20251001')

    case 'gemini':
      if (!config.geminiKey) throw new Error('Falta la API key de Gemini. Configúrala en Configuración > IA.')
      return new GeminiProvider(config.geminiKey, config.model ?? 'gemini-2.0-flash-lite')

    case 'ollama':
      return new OllamaProvider(
        (config.ollamaUrl ?? 'http://localhost:11434').trim(),
        (config.model ?? 'llama3.1').trim()
      )

    default:
      throw new Error(`Proveedor desconocido: ${config.provider}`)
  }
}
