import { render, screen } from '@testing-library/react'
import { TypingIndicator } from '@/components/TypingIndicator'

test('displays the correct name', () => {
  render(<TypingIndicator name="Ira" />)
  expect(screen.getByText('Ira is typing...')).toBeInTheDocument()
})

test('displays three dots', () => {
  const { container } = render(<TypingIndicator name="Ira" />)
  const dots = container.querySelectorAll('.animate-bounce')
  expect(dots.length).toBe(3)
})
