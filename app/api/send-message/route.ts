import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { translateMessage } from '@/lib/anthropic'
import { saveMessage } from '@/lib/kv'
import { pusherServer } from '@/lib/pusher'
import { Message, UserId } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { sender, text }: { sender: UserId; text: string } = await req.json()

  const from = sender === 'mathias' ? 'Danish' : 'Ukrainian'
  const to = sender === 'mathias' ? 'Ukrainian' : 'Danish'

  const translatedText = await translateMessage(text, from, to)

  const message: Message = {
    id: crypto.randomUUID(),
    sender,
    originalText: text,
    translatedText,
    timestamp: Date.now(),
  }

  await saveMessage(message)
  await pusherServer.trigger('chat-channel', 'new-message', message)

  return NextResponse.json(message)
}
