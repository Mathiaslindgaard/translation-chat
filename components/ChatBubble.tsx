import { Message, UserId } from '@/lib/types'

interface ChatBubbleProps {
  message: Message
  currentUser: UserId
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function ChatBubble({ message, currentUser }: ChatBubbleProps) {
  const isOwn = message.sender === currentUser
  const primaryText = isOwn ? message.originalText : message.translatedText
  const secondaryText = isOwn ? message.translatedText : message.originalText

  return (
    <div className={`flex mb-3 ${isOwn ? 'justify-end' : 'justify-start gap-2'}`}>
      {!isOwn && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 self-end">
          {message.sender === 'ira' ? 'K' : 'M'}
        </div>
      )}
      <div className="max-w-[75%]">
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isOwn
              ? 'rounded-br-sm bg-blue-500 text-white'
              : 'rounded-bl-sm bg-white shadow-sm border border-gray-100 text-gray-900'
          }`}
        >
          <p className="text-sm font-medium leading-relaxed">{primaryText}</p>
          <p
            className={`text-xs italic mt-1 leading-relaxed ${
              isOwn ? 'text-blue-200' : 'text-gray-400'
            }`}
          >
            {secondaryText}
          </p>
        </div>
        <p
          className={`text-xs text-gray-400 mt-1 ${
            isOwn ? 'text-right pr-1' : 'text-left pl-1'
          }`}
        >
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  )
}
