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
