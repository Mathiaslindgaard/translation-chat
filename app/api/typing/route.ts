import { NextRequest, NextResponse } from 'next/server'
import { pusherServer } from '@/lib/pusher'
import { UserId } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { sender }: { sender: UserId } = await req.json()
  await pusherServer.trigger('chat-channel', 'typing', { sender })
  return NextResponse.json({ ok: true })
}
