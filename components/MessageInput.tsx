'use client'

import { useRef, useState } from 'react'
import { UserId } from '@/lib/types'

interface MessageInputProps {
  currentUser: UserId
  onSend: (text: string) => void
  onTyping: () => void
  isLoading: boolean
}

const PLACEHOLDERS: Record<UserId, string> = {
  mathias: 'Skriv en besked...',
  ira: 'Написати повідомлення...',
}

export function MessageInput({ currentUser, onSend, onTyping, isLoading }: MessageInputProps) {
  const [text, setText] = useState('')
  const lastTypingCall = useRef(0)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value)
    const now = Date.now()
    if (now - lastTypingCall.current > 1000) {
      lastTypingCall.current = now
      onTyping()
    }
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="bg-white border-t border-gray-100 px-4 py-3">
      <div className="flex items-center gap-3 bg-gray-50 rounded-full px-4 py-2.5 border border-gray-200">
        <input
          type="text"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDERS[currentUser]}
          disabled={isLoading}
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || isLoading}
          aria-label="Send"
          className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center disabled:opacity-40 hover:bg-blue-600 transition-colors active:scale-95 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
