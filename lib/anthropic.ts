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
