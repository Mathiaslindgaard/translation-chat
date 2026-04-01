// @jest-environment node

jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn()
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }))
  ;(MockAnthropic as any).__mockCreate = mockCreate
  return { __esModule: true, default: MockAnthropic }
})

import Anthropic from '@anthropic-ai/sdk'
import { translateMessage } from '@/lib/anthropic'

const mockCreate = (Anthropic as any).__mockCreate as jest.Mock

beforeEach(() => jest.clearAllMocks())

test('translateMessage returns translated text from Claude', async () => {
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: '  Привет  ' }],
  })

  const result = await translateMessage('Hello', 'English', 'Russian')
  expect(result).toBe('Привет') // trimmed
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('English'),
        }),
      ],
    })
  )
})

test('translateMessage trims whitespace from response', async () => {
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: '\n  Hello\n' }],
  })
  const result = await translateMessage('Привет', 'Russian', 'English')
  expect(result).toBe('Hello')
})

test('translateMessage throws if response type is not text', async () => {
  mockCreate.mockResolvedValue({
    content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
  })
  await expect(translateMessage('hi', 'English', 'Russian')).rejects.toThrow(
    'Unexpected response type'
  )
})
