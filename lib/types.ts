export type UserId = 'mathias' | 'katya'

export type Message = {
  id: string
  sender: UserId
  originalText: string
  translatedText: string
  timestamp: number
}
