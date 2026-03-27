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

const iraMessage: Message = {
  id: '2',
  sender: 'ira',
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
  render(<ChatBubble message={iraMessage} currentUser="mathias" />)
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
    <ChatBubble message={iraMessage} currentUser="mathias" />
  )
  const wrapper = container.firstChild as HTMLElement
  expect(wrapper.className).toMatch(/justify-start/)
})

test('timestamp is displayed', () => {
  render(<ChatBubble message={mathiasMessage} currentUser="mathias" />)
  expect(screen.getByText(/14:23/)).toBeInTheDocument()
})
