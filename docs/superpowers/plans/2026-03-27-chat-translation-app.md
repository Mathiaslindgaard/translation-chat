# Chat Translation App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time bilingual chat app where Mathias (Danish) and Katya (Ukrainian) each write in their own language and automatically see the other's messages translated.

**Architecture:** Next.js App Router with three API routes (send-message, messages, typing). Messages are translated server-side via Claude Haiku, stored in Vercel KV as a Redis list, and delivered in real-time via Pusher Channels. The frontend is a single Client Component that subscribes to Pusher on mount and renders chat bubbles showing translation as primary text and original as secondary.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Tailwind CSS, `@anthropic-ai/sdk`, `pusher` (server), `pusher-js` (client), `@vercel/kv`, Jest + @testing-library/react

---

## File Map

| File | Responsibility |
|---|---|
| `lib/types.ts` | Shared `Message` and `UserId` types |
| `lib/kv.ts` | Vercel KV helpers: save and get messages |
| `lib/anthropic.ts` | Claude Haiku translation function |
| `lib/pusher.ts` | Pusher server-side client singleton |
| `lib/pusher-client.ts` | Pusher browser client singleton |
| `app/layout.tsx` | Root layout with Inter font (latin + cyrillic) |
| `app/page.tsx` | Redirect `/` → `/chat` |
| `app/chat/page.tsx` | Full chat UI — identity, message list, Pusher subscription |
| `app/api/messages/route.ts` | `GET` — return last 50 messages from KV |
| `app/api/send-message/route.ts` | `POST` — translate, store, trigger Pusher |
| `app/api/typing/route.ts` | `POST` — trigger Pusher typing event |
| `components/ChatBubble.tsx` | Single message bubble with translation |
| `components/TypingIndicator.tsx` | Animated "... is typing" indicator |
| `components/MessageInput.tsx` | Text input with send button and typing trigger |
| `jest.config.ts` | Jest config for Next.js |
| `jest.setup.ts` | `@testing-library/jest-dom` import |
| `.env.local` | Local environment variables |

---

### Task 1: Scaffold project and install dependencies

**Files:**
- Create: `package.json` (via CLI)
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

- [ ] **Step 1: Create the Next.js project**

Run from `/Users/mathiaslindgaard/projects/`:
```bash
npx create-next-app@latest chat-translation-app \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-eslint
```
When prompted for any remaining options, accept defaults.

- [ ] **Step 2: Install runtime dependencies**

```bash
cd /Users/mathiaslindgaard/projects/chat-translation-app
npm install @anthropic-ai/sdk pusher pusher-js @vercel/kv
```

- [ ] **Step 3: Install test dependencies**

```bash
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @types/jest
```

- [ ] **Step 4: Write jest.config.ts**

```ts
// jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
```

- [ ] **Step 5: Write jest.setup.ts**

```ts
// jest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test script to package.json**

In `package.json`, ensure `scripts` contains:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 7: Verify project runs**

```bash
npm run dev
```
Expected: Next.js dev server starts at http://localhost:3000 with no errors. Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js project with test setup"
```

---

### Task 2: Shared types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Write types**

```ts
// lib/types.ts
export type UserId = 'mathias' | 'katya'

export type Message = {
  id: string
  sender: UserId
  originalText: string
  translatedText: string
  timestamp: number
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared Message and UserId types"
```

---

### Task 3: Vercel KV helpers + tests

**Files:**
- Create: `lib/kv.ts`
- Create: `__tests__/lib/kv.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/kv.test.ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/lib/kv.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/kv'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/kv.ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/lib/kv.test.ts
```
Expected: PASS — 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add lib/kv.ts __tests__/lib/kv.test.ts
git commit -m "feat: add Vercel KV helpers with tests"
```

---

### Task 4: Translation client + tests

**Files:**
- Create: `lib/anthropic.ts`
- Create: `__tests__/lib/anthropic.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/anthropic.test.ts
// @jest-environment node

import { translateMessage } from '@/lib/anthropic'

const mockCreate = jest.fn()
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

beforeEach(() => jest.clearAllMocks())

test('translateMessage returns translated text from Claude', async () => {
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: '  Привіт  ' }],
  })

  const result = await translateMessage('Hej', 'Danish', 'Ukrainian')
  expect(result).toBe('Привіт') // trimmed
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Danish'),
        }),
      ],
    })
  )
})

test('translateMessage trims whitespace from response', async () => {
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: '\n  Hello\n' }],
  })
  const result = await translateMessage('Привіт', 'Ukrainian', 'Danish')
  expect(result).toBe('Hello')
})

test('translateMessage throws if response type is not text', async () => {
  mockCreate.mockResolvedValue({
    content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
  })
  await expect(translateMessage('hi', 'Danish', 'Ukrainian')).rejects.toThrow(
    'Unexpected response type'
  )
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/lib/anthropic.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/anthropic'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/anthropic.ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SYSTEM_PROMPT =
  'You are a translation assistant. Translate the following message accurately and naturally. Preserve tone, emotion, and informal language. Do not add explanations or commentary — return only the translated text.'

export async function translateMessage(
  text: string,
  from: 'Danish' | 'Ukrainian',
  to: 'Danish' | 'Ukrainian'
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Translate from ${from} to ${to}: ${text}`,
      },
    ],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return block.text.trim()
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/lib/anthropic.test.ts
```
Expected: PASS — 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add lib/anthropic.ts __tests__/lib/anthropic.test.ts
git commit -m "feat: add Claude Haiku translation client with tests"
```

---

### Task 5: Pusher clients

**Files:**
- Create: `lib/pusher.ts`
- Create: `lib/pusher-client.ts`

- [ ] **Step 1: Write Pusher server client**

```ts
// lib/pusher.ts
import PusherServer from 'pusher'

export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})
```

- [ ] **Step 2: Write Pusher browser client singleton**

```ts
// lib/pusher-client.ts
import Pusher from 'pusher-js'

let instance: Pusher | null = null

export function getPusherClient(): Pusher {
  if (!instance) {
    instance = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    })
  }
  return instance
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/pusher.ts lib/pusher-client.ts
git commit -m "feat: add Pusher server and browser client singletons"
```

---

### Task 6: GET /api/messages route

**Files:**
- Create: `app/api/messages/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/messages/route.ts
import { NextResponse } from 'next/server'
import { getMessages } from '@/lib/kv'

export async function GET() {
  const messages = await getMessages()
  return NextResponse.json(messages)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/messages/route.ts
git commit -m "feat: add GET /api/messages route"
```

---

### Task 7: POST /api/send-message route

**Files:**
- Create: `app/api/send-message/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/send-message/route.ts
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
```

- [ ] **Step 2: Commit**

```bash
git add app/api/send-message/route.ts
git commit -m "feat: add POST /api/send-message route"
```

---

### Task 8: POST /api/typing route

**Files:**
- Create: `app/api/typing/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/typing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { pusherServer } from '@/lib/pusher'
import { UserId } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { sender }: { sender: UserId } = await req.json()
  await pusherServer.trigger('chat-channel', 'typing', { sender })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/typing/route.ts
git commit -m "feat: add POST /api/typing route"
```

---

### Task 9: ChatBubble component + tests

**Files:**
- Create: `components/ChatBubble.tsx`
- Create: `__tests__/components/ChatBubble.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/ChatBubble.test.tsx
import { render, screen } from '@testing-library/react'
import { ChatBubble } from '@/components/ChatBubble'
import { Message } from '@/lib/types'

const mathiasMessage: Message = {
  id: '1',
  sender: 'mathias',
  originalText: 'Hej',
  translatedText: 'Привіт',
  timestamp: new Date('2026-01-01T14:23:00').getTime(),
}

const katyaMessage: Message = {
  id: '2',
  sender: 'katya',
  originalText: 'Як справи?',
  translatedText: 'How are you?',
  timestamp: new Date('2026-01-01T14:24:00').getTime(),
}

test('own message shows original as primary and translation as secondary', () => {
  render(<ChatBubble message={mathiasMessage} currentUser="mathias" />)
  expect(screen.getByText('Hej')).toBeInTheDocument()
  expect(screen.getByText('Привіт')).toBeInTheDocument()
})

test("other's message shows translation as primary and original as secondary", () => {
  render(<ChatBubble message={katyaMessage} currentUser="mathias" />)
  expect(screen.getByText('How are you?')).toBeInTheDocument()
  expect(screen.getByText('Як справи?')).toBeInTheDocument()
})

test('own message container is right-aligned', () => {
  const { container } = render(
    <ChatBubble message={mathiasMessage} currentUser="mathias" />
  )
  const wrapper = container.firstChild as HTMLElement
  expect(wrapper.className).toMatch(/justify-end/)
})

test("other's message container is left-aligned", () => {
  const { container } = render(
    <ChatBubble message={katyaMessage} currentUser="mathias" />
  )
  const wrapper = container.firstChild as HTMLElement
  expect(wrapper.className).toMatch(/justify-start/)
})

test('timestamp is displayed', () => {
  render(<ChatBubble message={mathiasMessage} currentUser="mathias" />)
  expect(screen.getByText(/14:23/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/components/ChatBubble.test.tsx
```
Expected: FAIL — `Cannot find module '@/components/ChatBubble'`

- [ ] **Step 3: Write the component**

```tsx
// components/ChatBubble.tsx
import { Message, UserId } from '@/lib/types'

interface ChatBubbleProps {
  message: Message
  currentUser: UserId
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
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
          {message.sender === 'katya' ? 'K' : 'M'}
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/components/ChatBubble.test.tsx
```
Expected: PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add components/ChatBubble.tsx __tests__/components/ChatBubble.test.tsx
git commit -m "feat: add ChatBubble component with tests"
```

---

### Task 10: TypingIndicator component + tests

**Files:**
- Create: `components/TypingIndicator.tsx`
- Create: `__tests__/components/TypingIndicator.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/TypingIndicator.test.tsx
import { render, screen } from '@testing-library/react'
import { TypingIndicator } from '@/components/TypingIndicator'

test('displays the correct name', () => {
  render(<TypingIndicator name="Katya" />)
  expect(screen.getByText('Katya is typing...')).toBeInTheDocument()
})

test('displays three dots', () => {
  const { container } = render(<TypingIndicator name="Katya" />)
  const dots = container.querySelectorAll('.animate-bounce')
  expect(dots.length).toBe(3)
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/components/TypingIndicator.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Write the component**

```tsx
// components/TypingIndicator.tsx
interface TypingIndicatorProps {
  name: string
}

export function TypingIndicator({ name }: TypingIndicatorProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 mb-1">
      <div className="flex gap-1 items-center">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-gray-400">{name} is typing...</span>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/components/TypingIndicator.test.tsx
```
Expected: PASS — 2 tests passed

- [ ] **Step 5: Commit**

```bash
git add components/TypingIndicator.tsx __tests__/components/TypingIndicator.test.tsx
git commit -m "feat: add TypingIndicator component with tests"
```

---

### Task 11: MessageInput component + tests

**Files:**
- Create: `components/MessageInput.tsx`
- Create: `__tests__/components/MessageInput.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/MessageInput.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageInput } from '@/components/MessageInput'

const noop = () => {}

test('shows Danish placeholder for mathias', () => {
  render(
    <MessageInput currentUser="mathias" onSend={noop} onTyping={noop} isLoading={false} />
  )
  expect(screen.getByPlaceholderText('Skriv en besked...')).toBeInTheDocument()
})

test('shows Ukrainian placeholder for katya', () => {
  render(
    <MessageInput currentUser="katya" onSend={noop} onTyping={noop} isLoading={false} />
  )
  expect(screen.getByPlaceholderText('Написати повідомлення...')).toBeInTheDocument()
})

test('send button is disabled when input is empty', () => {
  render(
    <MessageInput currentUser="mathias" onSend={noop} onTyping={noop} isLoading={false} />
  )
  expect(screen.getByRole('button')).toBeDisabled()
})

test('send button is disabled while loading', () => {
  render(
    <MessageInput currentUser="mathias" onSend={noop} onTyping={noop} isLoading={true} />
  )
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'Hello' } })
  expect(screen.getByRole('button')).toBeDisabled()
})

test('calls onSend with text when send button is clicked', () => {
  const onSend = jest.fn()
  render(
    <MessageInput currentUser="mathias" onSend={onSend} onTyping={noop} isLoading={false} />
  )
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'Hej' } })
  fireEvent.click(screen.getByRole('button'))
  expect(onSend).toHaveBeenCalledWith('Hej')
})

test('calls onSend when Enter is pressed', () => {
  const onSend = jest.fn()
  render(
    <MessageInput currentUser="mathias" onSend={onSend} onTyping={noop} isLoading={false} />
  )
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'Hej' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onSend).toHaveBeenCalledWith('Hej')
})

test('clears input after sending', () => {
  render(
    <MessageInput currentUser="mathias" onSend={noop} onTyping={noop} isLoading={false} />
  )
  const input = screen.getByRole('textbox') as HTMLInputElement
  fireEvent.change(input, { target: { value: 'Hej' } })
  fireEvent.click(screen.getByRole('button'))
  expect(input.value).toBe('')
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/components/MessageInput.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Write the component**

```tsx
// components/MessageInput.tsx
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
  katya: 'Написати повідомлення...',
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/components/MessageInput.test.tsx
```
Expected: PASS — 7 tests passed

- [ ] **Step 5: Commit**

```bash
git add components/MessageInput.tsx __tests__/components/MessageInput.test.tsx
git commit -m "feat: add MessageInput component with tests"
```

---

### Task 12: Root layout, home redirect, and .env.local

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Create: `.env.local`

- [ ] **Step 1: Update root layout with Inter font (latin + cyrillic)**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'Chat',
  description: 'Bilingual chat',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Make home page redirect to /chat**

```tsx
// app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/chat')
}
```

- [ ] **Step 3: Create .env.local with your credentials**

```bash
# .env.local
ANTHROPIC_API_KEY=your_anthropic_key_here
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=eu
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=eu
KV_REST_API_URL=your_kv_url_here
KV_REST_API_TOKEN=your_kv_token_here
```

Note: `KV_REST_API_URL` and `KV_REST_API_TOKEN` come from the Vercel dashboard after adding KV storage to the project (done at deploy time — leave as placeholder for now).

- [ ] **Step 4: Add .env.local to .gitignore**

Open `.gitignore` and confirm `.env.local` is listed (Next.js includes this by default).

- [ ] **Step 5: Commit layout and redirect (not .env.local)**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: add Inter font with cyrillic subset and redirect home to /chat"
```

---

### Task 13: Chat page — identity selector + message list

**Files:**
- Create: `app/chat/page.tsx`

- [ ] **Step 1: Write the chat page**

```tsx
// app/chat/page.tsx
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
```

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 3: Test locally with two tabs**

Open two browser tabs:
- Tab 1: http://localhost:3000/chat?user=mathias
- Tab 2: http://localhost:3000/chat?user=katya

Verify:
- [ ] Both tabs show the identity selector if you clear localStorage, or directly show chat if URL param is present
- [ ] Mathias tab shows Danish placeholder, Katya tab shows Ukrainian
- [ ] Sending a message in Tab 1 appears in both tabs within 1–2 seconds
- [ ] Translation appears correctly (Danish → Ukrainian for Mathias, Ukrainian → Danish for Katya)
- [ ] Typing in Tab 1 shows indicator in Tab 2 after ~1 second
- [ ] Auto-scroll works on new messages

- [ ] **Step 4: Commit**

```bash
git add app/chat/page.tsx
git commit -m "feat: add chat page with identity selector, real-time Pusher, and optimistic messages"
```

---

### Task 14: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/YOUR_USERNAME/chat-translation-app.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Import to Vercel**

1. Go to vercel.com → New Project
2. Import the `chat-translation-app` GitHub repo
3. Accept default settings (Next.js auto-detected)
4. Do NOT deploy yet — add environment variables first

- [ ] **Step 3: Add Vercel KV storage**

In the Vercel project dashboard:
1. Go to **Storage** tab → **Create Database** → **KV**
2. Name it `chat-kv` (or anything)
3. Click **Create and Connect**
4. Vercel automatically adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your project's env vars

- [ ] **Step 4: Add remaining environment variables in Vercel dashboard**

In **Settings → Environment Variables**, add:
```
ANTHROPIC_API_KEY        = your key
PUSHER_APP_ID            = your app id
PUSHER_KEY               = your key
PUSHER_SECRET            = your secret
PUSHER_CLUSTER           = eu
NEXT_PUBLIC_PUSHER_KEY   = your key (same as PUSHER_KEY)
NEXT_PUBLIC_PUSHER_CLUSTER = eu
```

- [ ] **Step 5: Deploy**

Click **Deploy** (or push a new commit). Vercel builds and deploys automatically.

- [ ] **Step 6: Copy KV credentials to .env.local**

After Vercel KV is created, copy `KV_REST_API_URL` and `KV_REST_API_TOKEN` from the Vercel dashboard into your local `.env.local` so local dev also uses the real KV store.

- [ ] **Step 7: Verify production**

Open:
- `https://your-app.vercel.app/chat?user=mathias` on one device
- `https://your-app.vercel.app/chat?user=katya` on another device (or another browser)

Send a message from each side and confirm real-time delivery and translation works.

---

### Task 15: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
npm test
```
Expected: All tests pass (kv, anthropic, ChatBubble, TypingIndicator, MessageInput)

- [ ] **Step 2: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any test failures"
git push
```
