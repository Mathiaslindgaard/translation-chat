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
