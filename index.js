export const ENDPOINT = 'wss://api.tessium.dev/stream'

export const STREAMS = [
  'launches',
  'migrations',
  'pool_creations',
  'token_trades',
  'token_transfers',
  'candles',
  'wallet_trades',
  'wallet_transfers',
]

export function endpoint(apiKey, base = ENDPOINT) {
  return `${base}?key=${apiKey}`
}

export function subscribeFrame(stream, params, id = 1) {
  const frame = { op: 'subscribe', stream, id }
  if (params) frame.params = params
  return frame
}

/**
 * Yield `event` frames for one subscription.
 *
 * Frames are yielded whole, not just `data`: `cursor` is what you persist to
 * replay a short disconnect, and it lives on the frame.
 */
export async function* events(apiKey, stream, params, { base = ENDPOINT } = {}) {
  const ws = new WebSocket(endpoint(apiKey, base))

  // Frames that arrive between two `next()` calls would be dropped by an
  // await-per-message loop, so they queue here instead.
  const queue = []
  let wake
  let closed
  const push = (value) => {
    queue.push(value)
    wake?.()
  }

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify(subscribeFrame(stream, params)))
  })
  ws.addEventListener('message', (e) => {
    const frame = JSON.parse(e.data)
    if (frame.op === 'event') push(frame)
  })
  ws.addEventListener('error', () => {
    closed = new Error('tessium: socket error')
    wake?.()
  })
  ws.addEventListener('close', () => {
    closed ??= null
    wake?.()
  })

  try {
    while (true) {
      while (queue.length) yield queue.shift()
      if (closed !== undefined) {
        if (closed) throw closed
        return
      }
      await new Promise((resolve) => {
        wake = resolve
      })
    }
  } finally {
    ws.close()
  }
}
