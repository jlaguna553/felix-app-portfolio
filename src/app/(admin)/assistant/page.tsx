import { ChatPanel } from '@/components/ai/ChatPanel'

export const dynamic = 'force-dynamic'

export default function AssistantPage() {
  return (
    <div className="absolute inset-0">
      <ChatPanel />
    </div>
  )
}
