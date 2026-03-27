'use client'

import { useEffect, useRef, useState } from 'react'
import { Message, UserId } from '@/lib/types'
import { getPusherClient } from '@/lib/pusher-client'
import { ChatBubble } from '@/components/ChatBubble'
import { MessageInput } from '@/components/MessageInput'
import { TypingIndicator } from '@/components/TypingIndicator'

function IdentitySelector({ onSelect }: { onSelect: (user: UserId) => void }) {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-8 z-50 px-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Who are you?</h1>
        <p className="text-sm text-gray-500">You only need to choose once</p>
      </div>
      <div className="flex gap-4 w-full max-w-xs">
        <button
          onClick={() => onSelect('mathias')}
          className="flex-1 py-3 rounded-2xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors active:scale-95"
        >
          Mathias
        </button>
        <button
          onClick={() => onSelect('katya')}
          className="flex-1 py-3 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 text-white font-semibold hover:opacity-90 transition-opacity active:scale-95"
        >
          Katya
        </button>
      </div>
    </div>
  )
}

const OTHER_NAME: Record<UserId, string> = {
  mathias: 'Katya',
  katya: 'Mathias',
}

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<UserId | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resolve identity from URL param or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlUser = params.get('user') as UserId | null
    const stored = localStorage.getItem('chatUser') as UserId | null
    const user = urlUser || stored
    if (user === 'mathias' || user === 'katya') {
      setCurrentUser(user)
      localStorage.setItem('chatUser', user)
    }
  }, [])

  // Fetch message history
  useEffect(() => {
    if (!currentUser) return
    fetch('/api/messages')
      .then((r) => r.json())
      .then((msgs: Message[]) => setMessages(msgs))
  }, [currentUser])

  // Pusher subscription
  useEffect(() => {
    if (!currentUser) return
    const pusher = getPusherClient()
    const channel = pusher.subscribe('chat-channel')

    channel.bind('new-message', (data: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev
        return [...prev, data]
      })
    })

    channel.bind('typing', ({ sender }: { sender: UserId }) => {
      if (sender !== currentUser) {
        setIsTyping(true)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000)
      }
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe('chat-channel')
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [currentUser])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = async (text: string) => {
    if (!currentUser || isLoading) return
    setIsLoading(true)

    const optimisticId = `optimistic-${Date.now()}`
    const optimistic: Message = {
      id: optimisticId,
      sender: currentUser,
      originalText: text,
      translatedText: 'Translating...',
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: currentUser, text }),
      })
      const real: Message = await res.json()
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? real : m)))
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
    } finally {
      setIsLoading(false)
    }
  }

  const handleTyping = async () => {
    if (!currentUser) return
    await fetch('/api/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: currentUser }),
    })
  }

  const handleSelectUser = (user: UserId) => {
    setCurrentUser(user)
    localStorage.setItem('chatUser', user)
  }

  if (!currentUser) {
    return <IdentitySelector onSelect={handleSelectUser} />
  }

  const otherName = OTHER_NAME[currentUser]

  return (
    <div className="flex flex-col h-dvh bg-gray-50 max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm flex-shrink-0">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
            currentUser === 'mathias'
              ? 'bg-gradient-to-br from-yellow-400 to-amber-600'
              : 'bg-blue-500'
          }`}
        >
          {otherName[0]}
        </div>
        <span className="font-semibold text-gray-900">{otherName}</span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-8">No messages yet. Say hello!</p>
        )}
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} currentUser={currentUser} />
        ))}
        {isTyping && <TypingIndicator name={otherName} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0">
        <MessageInput
          currentUser={currentUser}
          onSend={handleSend}
          onTyping={handleTyping}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
