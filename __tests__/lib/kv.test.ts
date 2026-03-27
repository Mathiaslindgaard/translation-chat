// @jest-environment node

import { saveMessage, getMessages } from '@/lib/kv'
import { Message } from '@/lib/types'

jest.mock('@vercel/kv', () => ({
  kv: {
    lpush: jest.fn(),
    ltrim: jest.fn(),
    lrange: jest.fn(),
  },
}))

import { kv } from '@vercel/kv'

const mockMessage: Message = {
  id: 'test-id',
  sender: 'mathias',
  originalText: 'Hej',
  translatedText: 'Привіт',
  timestamp: 1000000,
}

beforeEach(() => jest.clearAllMocks())

test('saveMessage calls lpush then ltrim', async () => {
  await saveMessage(mockMessage)
  expect(kv.lpush).toHaveBeenCalledWith('messages', JSON.stringify(mockMessage))
  expect(kv.ltrim).toHaveBeenCalledWith('messages', 0, 49)
})

test('getMessages returns messages in chronological order (oldest first)', async () => {
  const older: Message = { ...mockMessage, id: 'older', timestamp: 1000 }
  const newer: Message = { ...mockMessage, id: 'newer', timestamp: 2000 }
  // KV list stores newest-first (LPUSH), so LRANGE returns [newer, older]
  ;(kv.lrange as jest.Mock).mockResolvedValue([
    JSON.stringify(newer),
    JSON.stringify(older),
  ])

  const result = await getMessages()
  expect(result[0].id).toBe('older')
  expect(result[1].id).toBe('newer')
  expect(kv.lrange).toHaveBeenCalledWith('messages', 0, 49)
})

test('getMessages returns empty array when KV is empty', async () => {
  ;(kv.lrange as jest.Mock).mockResolvedValue([])
  const result = await getMessages()
  expect(result).toEqual([])
})
