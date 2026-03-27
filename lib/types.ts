export type UserId = 'mathias' | 'ira'

export type Message = {
  id: string
  sender: UserId
  originalText: string
  translatedText: string
  timestamp: number
}
