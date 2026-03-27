# Chat Translation App — Design Spec

**Date:** 2026-03-27
**Status:** Approved

---

## Overview

A real-time bilingual chat web app for two users — Mathias (Danish) and Katya (Ukrainian). Each user writes in their own language; the other sees a translation as the primary text with the original shown small beneath. The app feels like a normal chat (iMessage/WhatsApp style), not a translation tool.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Real-time | Pusher Channels (free tier) |
| Translation | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) |
| Persistence | Vercel KV (Redis) |
| Deployment | Vercel |

---

## Users

Exactly two users, hardcoded:

- **mathias** — writes Danish, sees Ukrainian translated to Danish
- **katya** — writes Ukrainian, sees Danish translated to Ukrainian

Access via URL param: `/chat?user=mathias` or `/chat?user=katya`. Identity is persisted to `localStorage` on first visit — the URL param only needs to be used once.

---

## Architecture

### API Routes

**`POST /api/send-message`**
- Receives: `{ sender: "mathias" | "katya", text: string }`
- Calls Claude Haiku to translate (server-side only)
- Stores message in Vercel KV
- Triggers Pusher `new-message` event on `chat-channel`
- Returns: full message object

**`GET /api/messages`**
- Returns last 50 messages from Vercel KV
- Called once on initial page load

**`POST /api/typing`**
- Receives: `{ sender: "mathias" | "katya" }`
- Triggers Pusher `typing` event on `chat-channel`
- Returns: `{ ok: true }`
- Called client-side on input `onChange`, debounced 500ms

### Real-time

Single Pusher channel: `chat-channel`. Two events:
- `new-message` — full message object pushed to both clients when a message is sent
- `typing` — `{ sender }` payload, debounced, pushed when a user is typing

Both clients subscribe on mount. Incoming events are appended to local state immediately — no polling.

---

## Data Model

```ts
type Message = {
  id: string           // crypto.randomUUID()
  sender: "mathias" | "katya"
  originalText: string
  translatedText: string
  timestamp: number    // Date.now()
}
```

Stored in Vercel KV as a Redis list. On each write: `LPUSH` the new message, then `LTRIM 0 49` to keep only the 50 most recent. On read: `LRANGE 0 49`.

---

## Translation Logic

Translation is server-side only via a Next.js API route calling Claude Haiku.

**System prompt:**
> "You are a translation assistant. Translate the following message accurately and naturally. Preserve tone, emotion, and informal language. Do not add explanations or commentary — return only the translated text."

**Model:** `claude-haiku-4-5-20251001`
**Max tokens:** 500

**Display rules:**
- **Sender** sees: their original text (primary) + translation small/italic below — so they can verify it translated correctly
- **Receiver** sees: translation (primary) + original small/italic below — so they can read in their language and optionally learn the other

---

## Chat UI

### Route
`/chat` — single page, identity determined by `localStorage` (set from URL param on first visit). If neither URL param nor localStorage is present, a simple overlay asks "Who are you?" with two buttons: Mathias / Katya. Selection is saved to localStorage.

### Layout
- Fixed header: avatar initial (gold for Katya, blue for Mathias) + name (no dynamic online indicator — always shows the other person's name)
- Scrollable message list, auto-scrolls to bottom on new messages
- Fixed input bar at bottom
- Typing indicator above input bar when the other person is typing

### Bubbles
- **Your messages:** right-aligned, blue background (`#3b82f6`), white text
- **Their messages:** left-aligned, white background, soft shadow, gold avatar (`#d97706` gradient)
- Primary text: normal size and weight
- Translation: `0.75rem`, muted/italic, beneath the primary text
- Timestamp: small grey text below each bubble

### Input
- Placeholder in the user's own language: `"Skriv en besked..."` (Mathias) / `"Написати повідомлення..."` (Katya)
- Send on Enter or send button
- Send button disabled + spinner while translation is in progress
- Optimistic bubble rendered immediately with `"translating..."` placeholder, replaced when API responds

### Typing Indicator
- Triggered via Pusher on `typing` event when the other user focuses/types in the input
- Shows `"Katya is typing..."` / `"Mathias is typing..."` above the input

---

## Folder Structure

```
/app
  /chat
    page.tsx              ← Main chat UI
  /api
    /send-message
      route.ts            ← Translation + storage + Pusher trigger
    /messages
      route.ts            ← Fetch message history
    /typing
      route.ts            ← Trigger Pusher typing event
/components
  ChatBubble.tsx          ← Individual message bubble
  MessageInput.tsx        ← Input field + send button
  TypingIndicator.tsx     ← "is typing..." display
/lib
  anthropic.ts            ← Claude API client
  pusher.ts               ← Pusher server client
  pusher-client.ts        ← Pusher browser client (singleton)
  kv.ts                   ← Vercel KV helpers
```

---

## Design

- **Visual direction:** Clean & Airy (Option A) — white background, soft shadows, rounded bubbles, iMessage feel
- **Font:** Inter (Google Fonts)
- **Mathias bubbles:** `#3b82f6` blue (right)
- **Katya bubbles:** white with border/shadow + gold avatar — subtle nod to Ukrainian flag 🇺🇦
- **Translation text:** `text-xs italic text-gray-400` beneath primary
- **Mobile-first** — both users primarily on phones

---

## Environment Variables

```
ANTHROPIC_API_KEY=
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=eu
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=eu
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

---

## Setup Checklist

1. Create Next.js project with TypeScript + Tailwind + App Router
2. Install: `@anthropic-ai/sdk pusher pusher-js @vercel/kv`
3. Build and test API routes in isolation (translation, storage)
4. Build chat UI, connect Pusher
5. Test locally with two browser tabs (one as mathias, one as katya)
6. Push to GitHub, import to Vercel
7. Add Vercel KV storage to project (Vercel dashboard → Storage → Create KV)
8. Add all environment variables in Vercel dashboard
9. Deploy

---

## Out of Scope (v1)

- Voice messages
- Image sharing
- Push notifications
- Multiple conversations
- User settings or profiles
- Read receipts
