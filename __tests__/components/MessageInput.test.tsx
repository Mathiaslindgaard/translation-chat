import { render, screen, fireEvent } from '@testing-library/react'
import { MessageInput } from '@/components/MessageInput'

const noop = () => {}

test('shows English placeholder for mathias', () => {
  render(
    <MessageInput currentUser="mathias" onSend={noop} onTyping={noop} isLoading={false} />
  )
  expect(screen.getByPlaceholderText('Write a message...')).toBeInTheDocument()
})

test('shows Russian placeholder for ira', () => {
  render(
    <MessageInput currentUser="ira" onSend={noop} onTyping={noop} isLoading={false} />
  )
  expect(screen.getByPlaceholderText('Написать сообщение...')).toBeInTheDocument()
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
