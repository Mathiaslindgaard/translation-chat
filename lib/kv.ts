import { kv } from '@vercel/kv'
import { Message } from '@/lib/types'

const KV_KEY = 'messages'

export async function saveMessage(message: Message): Promise<void> {
  await kv.lpush(KV_KEY, JSON.stringify(message))
  await kv.ltrim(KV_KEY, 0, 49)
}

export async function getMessages(): Promise<Message[]> {
  const raw = await kv.lrange(KV_KEY, 0, 49)
  // KV list is newest-first (LPUSH). Reverse for chronological display.
  return (raw as string[]).reverse().map((item) => JSON.parse(item) as Message)
}
